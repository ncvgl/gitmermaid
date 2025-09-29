/**
 * Robust repository context extractor with error handling
 * Handles private repos, non-existent repos, and invalid URLs gracefully
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import ignore from 'ignore';
import { getCachedExtraction, setCachedExtraction } from './utils/diagramCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default exclusion patterns (same as gemini-cli)
const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/*.pyo',
  '**/*.bin',
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  '**/*.class',
  '**/*.jar',
  '**/*.war',
  '**/*.zip',
  '**/*.tar',
  '**/*.gz',
  '**/*.bz2',
  '**/*.rar',
  '**/*.7z',
  '**/*.doc',
  '**/*.docx',
  '**/*.xls',
  '**/*.xlsx',
  '**/*.ppt',
  '**/*.pptx',
  '**/*.odt',
  '**/*.ods',
  '**/*.odp',
  '**/.DS_Store',
  '**/.env',
  '**/*.json',
  '**/*.csv',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.svg',
  '**/*.ico',
  '**/*.pdf',
  '**/*.mp3',
  '**/*.mp4',
  '**/*.avi',
  '**/*.mov',
  '**/*.wmv',
  '**/*.flv',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
];

const DEFAULT_IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build', 'coverage'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file (skip larger files)
const MAX_OUTPUT_CHARS = 50 * 1000; // 50K characters - much smaller limit
const MAX_FILES = 500;
const MAX_TREE_ITEMS = 200;
const MAX_LINES_PER_FILE = 1000;
const MAX_LINE_LENGTH = 2000;

class IgnoreParser {
  constructor() {
    this.ig = ignore();
    this.patterns = [];
  }

  loadPatterns(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const patterns = content
        .split('\n')
        .map(p => p.trim())
        .filter(p => p !== '' && !p.startsWith('#'));
      this.ig.add(patterns);
      this.patterns.push(...patterns);
    } catch {
      // File doesn't exist, ignore
    }
  }

  isIgnored(relativePath) {
    return this.ig.ignores(relativePath.replace(/\\/g, '/'));
  }

  getPatterns() {
    return this.patterns;
  }
}

/**
 * Generates a directory tree structure
 */
function generateDirectoryTree(rootDir, ignoreFn, maxItems = MAX_TREE_ITEMS) {
  const lines = [];
  const rootName = path.basename(rootDir);
  lines.push(`${rootName}/`);
  
  let itemCount = 0;
  
  function traverse(dir, prefix = '', isLast = true) {
    if (itemCount >= maxItems) {
      if (itemCount === maxItems) {
        lines.push(`${prefix}└─── ... (truncated)`);
        itemCount++;
      }
      return;
    }
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const filteredEntries = entries
        .filter(entry => {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootDir, fullPath);
          return !ignoreFn(relativePath);
        })
        .sort((a, b) => {
          // Directories first, then files
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });
      
      filteredEntries.forEach((entry, index) => {
        if (itemCount >= maxItems) return;
        
        const isLastEntry = index === filteredEntries.length - 1;
        const connector = isLastEntry ? '└───' : '├───';
        const extension = isLastEntry ? '    ' : '│   ';
        
        if (entry.isDirectory()) {
          if (DEFAULT_IGNORED_FOLDERS.includes(entry.name)) {
            lines.push(`${prefix}${connector}${entry.name}/...`);
            itemCount++;
          } else {
            lines.push(`${prefix}${connector}${entry.name}/`);
            itemCount++;
            const newPrefix = prefix + extension;
            traverse(path.join(dir, entry.name), newPrefix, false);
          }
        } else {
          lines.push(`${prefix}${connector}${entry.name}`);
          itemCount++;
        }
      });
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  traverse(rootDir, '');
  return lines.join('\n');
}

/**
 * Detects if a file is a CSV and returns sample rows
 */
function processCSVFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.csv') return null;
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return '';
    
    // Take header + first data row (or just header if only one line)
    const sampled = lines.slice(0, Math.min(2, lines.length)).join('\n');
    
    if (lines.length > 2) {
      return `${sampled}\n... (${lines.length - 2} more rows)`;
    }
    
    return sampled;
  } catch {
    return null;
  }
}

/**
 * Processes file content with line and character truncation
 */
function processFileContent(content, maxLines, maxLineLength) {
  const lines = content.split('\n');
  let processedLines = lines;
  let truncatedLines = false;
  let truncatedChars = false;
  
  // Truncate lines if needed
  if (lines.length > maxLines) {
    processedLines = lines.slice(0, maxLines);
    truncatedLines = true;
  }
  
  // Truncate line length if needed
  processedLines = processedLines.map(line => {
    if (line.length > maxLineLength) {
      truncatedChars = true;
      return line.substring(0, maxLineLength) + '...';
    }
    return line;
  });
  
  let result = processedLines.join('\n');
  
  // Add truncation notices
  if (truncatedLines) {
    result += `\n\n... (truncated: ${lines.length - maxLines} more lines)`;
  }
  if (truncatedChars) {
    result += truncatedLines ? ' and long lines' : '\n\n... (truncated: some long lines)';
  }
  
  return result;
}

/**
 * Main function to extract repository context
 */
async function extractRepoContext(rootDir, options = {}) {
  const {
    respectGitIgnore = true,
    respectGeminiIgnore = true,
    useDefaultExcludes = true,
    maxFiles = MAX_FILES,
    maxOutputChars = MAX_OUTPUT_CHARS,
    maxFileSize = MAX_FILE_SIZE,
    maxLinesPerFile = MAX_LINES_PER_FILE,
    maxLineLength = MAX_LINE_LENGTH,
  } = options;
  
  const resolvedRoot = path.resolve(rootDir);
  
  // Initialize ignore parsers
  const gitIgnore = new IgnoreParser();
  const geminiIgnore = new IgnoreParser();
  
  if (respectGitIgnore) {
    gitIgnore.loadPatterns(path.join(resolvedRoot, '.gitignore'));
    gitIgnore.loadPatterns(path.join(resolvedRoot, '.git', 'info', 'exclude'));
    // Always ignore .git directory
    gitIgnore.ig.add(['.git']);
    gitIgnore.patterns.push('.git');
  }
  
  if (respectGeminiIgnore) {
    geminiIgnore.loadPatterns(path.join(resolvedRoot, '.geminiignore'));
  }
  
  // Combine all exclusion patterns
  const effectiveExcludes = useDefaultExcludes ? [...DEFAULT_EXCLUDES] : [];
  
  // Function to check if a file should be ignored
  const shouldIgnore = (relativePath) => {
    if (respectGitIgnore && gitIgnore.isIgnored(relativePath)) return true;
    if (respectGeminiIgnore && geminiIgnore.isIgnored(relativePath)) return true;
    return false;
  };
  
  // Find all files using glob
  const files = await glob('**/*', {
    cwd: resolvedRoot,
    nodir: true,
    dot: true,
    ignore: effectiveExcludes,
    absolute: false,
  });
  
  // Filter files based on ignore rules
  const filteredFiles = files.filter(file => !shouldIgnore(file));
  
  // Sort files for consistent output
  filteredFiles.sort();
  
  // Build output
  const outputParts = [];
  let fileCount = 0;
  let skippedCount = 0;
  let totalSize = 0;
  let outputChars = 0;
  const processedFiles = [];
  const skippedFiles = [];
  
  // Add header with metadata
  outputParts.push('=== REPOSITORY CONTEXT ===\n');
  outputParts.push(`Root Directory: ${resolvedRoot}\n`);
  outputParts.push(`Timestamp: ${new Date().toISOString()}\n`);
  
  // Add directory tree
  outputParts.push('\n=== DIRECTORY STRUCTURE ===\n');
  const tree = generateDirectoryTree(resolvedRoot, shouldIgnore, MAX_TREE_ITEMS);
  outputParts.push(tree);
  outputParts.push('\n');
  
  // Collect excluded patterns for metadata
  const excludedPatterns = [];
  if (respectGitIgnore && gitIgnore.getPatterns().length > 0) {
    excludedPatterns.push(...gitIgnore.getPatterns().map(p => `[gitignore] ${p}`));
  }
  if (respectGeminiIgnore && geminiIgnore.getPatterns().length > 0) {
    excludedPatterns.push(...geminiIgnore.getPatterns().map(p => `[geminiignore] ${p}`));
  }
  if (useDefaultExcludes) {
    excludedPatterns.push('[default] node_modules, dist, build, binaries, etc.');
  }
  
  // Add excluded patterns info
  outputParts.push('=== EXCLUDED PATTERNS ===\n');
  if (excludedPatterns.length > 0) {
    excludedPatterns.forEach(pattern => {
      outputParts.push(`- ${pattern}\n`);
    });
  } else {
    outputParts.push('None\n');
  }
  outputParts.push('\n');
  
  // Process files
  outputParts.push('=== FILE CONTENTS ===\n\n');
  
  // Initialize outputChars with current content length
  outputChars = outputParts.join('').length;
  
  for (const file of filteredFiles) {
    if (fileCount >= maxFiles) {
      skippedFiles.push({ path: file, reason: 'max files limit reached' });
      skippedCount++;
      continue;
    }
    
    const fullPath = path.join(resolvedRoot, file);
    
    try {
      const stats = fs.statSync(fullPath);
      
      if (stats.size > maxFileSize) {
        skippedFiles.push({ path: file, reason: 'file too large' });
        skippedCount++;
        continue;
      }
      
      // Try to read as text first
      let rawContent;
      try {
        rawContent = fs.readFileSync(fullPath, 'utf-8');
      } catch {
        skippedFiles.push({ path: file, reason: 'not a text file' });
        skippedCount++;
        continue;
      }
      
      // Process content with truncation
      const processedContent = processFileContent(rawContent, maxLinesPerFile, maxLineLength);
      
      // Create file section
      const fileSection = `--- ${file} ---\n\n${processedContent}\n\n`;
      
      // Check if adding this file would exceed character limit
      if (outputChars + fileSection.length > maxOutputChars) {
        skippedFiles.push({ path: file, reason: 'character limit reached' });
        skippedCount++;
        continue;
      }
      
      // Add file to output
      outputParts.push(fileSection);
      outputChars += fileSection.length;
      
      processedFiles.push(file);
      fileCount++;
      totalSize += stats.size;
      
    } catch (error) {
      skippedFiles.push({ path: file, reason: 'read error' });
      skippedCount++;
    }
  }
  
  // Add summary at the end
  outputParts.push('=== SUMMARY ===\n');
  outputParts.push(`Files included: ${fileCount}\n`);
  outputParts.push(`Files skipped: ${skippedCount}\n`);
  outputParts.push(`Total size: ${(totalSize / 1024).toFixed(2)} KB\n`);
  
  if (skippedFiles.length > 0 && skippedFiles.length <= 10) {
    outputParts.push('\nSkipped files:\n');
    skippedFiles.forEach(({ path, reason }) => {
      outputParts.push(`- ${path} (${reason})\n`);
    });
  } else if (skippedFiles.length > 10) {
    outputParts.push(`\nSkipped files (first 10 of ${skippedFiles.length}):\n`);
    skippedFiles.slice(0, 10).forEach(({ path, reason }) => {
      outputParts.push(`- ${path} (${reason})\n`);
    });
  }
  
  return {
    content: outputParts.join(''),
    fileCount,
    skippedCount,
    totalSize,
    excludedPatterns,
  };
}

/**
 * Result types for different outcomes
 */
const ResultType = {
  SUCCESS: 'success',
  CLONE_ERROR: 'clone_error',
  EXTRACTION_ERROR: 'extraction_error',
  VALIDATION_ERROR: 'validation_error'
};

/**
 * Error classifications for better user feedback
 */
const ErrorType = {
  REPOSITORY_NOT_FOUND: 'repository_not_found',
  PRIVATE_REPOSITORY: 'private_repository', 
  NETWORK_ERROR: 'network_error',
  INVALID_URL: 'invalid_url',
  PERMISSION_DENIED: 'permission_denied',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

/**
 * Classifies git clone errors based on stderr output
 */
function classifyCloneError(stderr, originalError) {
  // Check for timeout first (comes from originalError, not stderr)
  if (originalError && originalError.includes('ETIMEDOUT')) {
    return {
      type: ErrorType.TIMEOUT,
      message: 'Sorry, repository is too large. Try a smaller repo.',
      suggestion: 'Try a smaller repository. Large repositories like frameworks or operating systems may exceed the time limit.'
    };
  }
  
  const errorText = stderr.toLowerCase();
  
  if (errorText.includes('repository not found')) {
    // Could be either non-existent or private - Git returns same error for security
    return {
      type: ErrorType.REPOSITORY_NOT_FOUND,
      message: 'Repository not found. It may be private, non-existent, or you may lack access.',
      suggestion: 'Verify the repository URL is correct and public, or provide authentication for private repos.'
    };
  }
  
  if (errorText.includes('could not resolve host')) {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network error: Could not resolve hostname.',
      suggestion: 'Check your internet connection and verify the Git hosting service URL.'
    };
  }
  
  if (errorText.includes('permission denied') || errorText.includes('authentication failed')) {
    return {
      type: ErrorType.PERMISSION_DENIED,
      message: 'Authentication required or permission denied.',
      suggestion: 'This repository requires authentication. Provide a GitHub token or SSH key.'
    };
  }
  
  if (errorText.includes('fatal:') && errorText.includes('not a git repository')) {
    return {
      type: ErrorType.INVALID_URL,
      message: 'Invalid Git repository URL.',
      suggestion: 'Ensure the URL points to a valid Git repository.'
    };
  }
  
  return {
    type: ErrorType.UNKNOWN,
    message: 'Unknown error occurred during cloning.',
    suggestion: 'Check the repository URL and try again.'
  };
}

/**
 * Validates if a URL looks like a valid Git repository URL
 */
function validateRepoUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }
  
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }
  
  // Basic URL validation
  try {
    new URL(trimmedUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  // Check for common Git hosting patterns
  const gitPatterns = [
    /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/,
    /^https:\/\/gitlab\.com\/[\w\-\.\/]+(?:\.git)?$/,
    /^https:\/\/bitbucket\.org\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/,
    /^https:\/\/[\w\-\.]+\/.*\.git$/
  ];
  
  const isValidGitUrl = gitPatterns.some(pattern => pattern.test(trimmedUrl));
  if (!isValidGitUrl) {
    return { 
      valid: false, 
      error: 'URL does not appear to be a valid Git repository URL. Expected format: https://github.com/user/repo.git' 
    };
  }
  
  return { valid: true };
}

/**
 * Robustly extracts repository context with comprehensive error handling
 */
async function extractRepoContextRobust(repoUrl, options = {}) {
  const {
    respectGitIgnore = true,
    respectGeminiIgnore = true,
    useDefaultExcludes = true,
    maxFiles = MAX_FILES,
    maxOutputChars = MAX_OUTPUT_CHARS,
    maxFileSize = MAX_FILE_SIZE,
    maxLinesPerFile = MAX_LINES_PER_FILE,
    maxLineLength = MAX_LINE_LENGTH,
    cleanupOnSuccess = true,
    cleanupOnError = true,
    useCache = true // New option to control caching
  } = options;
  
  const startTime = Date.now();
  let tempDir = null;
  let cloneDir = null;
  
  // Normalize URL for caching (remove .git extension)
  const normalizedUrl = repoUrl.replace(/\.git$/, '');
  
  // Check cache first if enabled
  if (useCache) {
    const cachedResult = getCachedExtraction(normalizedUrl);
    if (cachedResult) {
      console.log(`✅ Using cached extraction for ${normalizedUrl}`);
      return {
        type: ResultType.SUCCESS,
        success: true,
        ...cachedResult
      };
    }
  }
  
  try {
    // Step 1: Validate URL
    console.log('🔍 Validating repository URL...');
    const validation = validateRepoUrl(repoUrl);
    if (!validation.valid) {
      return {
        type: ResultType.VALIDATION_ERROR,
        success: false,
        error: {
          type: ErrorType.INVALID_URL,
          message: validation.error,
          suggestion: 'Please provide a valid Git repository URL.'
        },
        repoUrl,
        duration: Date.now() - startTime
      };
    }
    
    // Step 2: Setup temporary directories
    console.log('📁 Setting up temporary directory...');
    tempDir = path.join(__dirname, `temp-extraction-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const repoName = path.basename(repoUrl.replace(/\.git$/, ''));
    cloneDir = path.join(tempDir, repoName);
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Step 3: Clone repository
    console.log(`📥 Cloning repository: ${repoUrl}`);
    try {
      execSync(`git clone "${repoUrl}" "${cloneDir}"`, {
        cwd: tempDir,
        stdio: 'pipe',
        timeout: 60000 // 60 second timeout for repos
      });
      console.log('✅ Repository cloned successfully');
    } catch (cloneError) {
      const stderr = cloneError.stderr ? cloneError.stderr.toString() : '';
      const classifiedError = classifyCloneError(stderr, cloneError.message);
      
      return {
        type: ResultType.CLONE_ERROR,
        success: false,
        error: {
          ...classifiedError,
          originalError: cloneError.message,
          stderr: stderr
        },
        repoUrl,
        duration: Date.now() - startTime
      };
    }
    
    // Step 4: Verify clone directory exists and has content
    if (!fs.existsSync(cloneDir)) {
      return {
        type: ResultType.CLONE_ERROR,
        success: false,
        error: {
          type: ErrorType.UNKNOWN,
          message: 'Clone appeared to succeed but directory was not created.',
          suggestion: 'Try the operation again or check available disk space.'
        },
        repoUrl,
        duration: Date.now() - startTime
      };
    }
    
    // Step 5: Extract repository context
    console.log('🔍 Extracting repository context...');
    try {
      const extractionResult = await extractRepoContext(cloneDir, {
        respectGitIgnore,
        respectGeminiIgnore,
        useDefaultExcludes,
        maxFiles,
        maxOutputChars,
        maxFileSize,
        maxLinesPerFile,
        maxLineLength
      });
      
      console.log(`✅ Extraction completed: ${extractionResult.fileCount} files processed`);
      
      const result = {
        type: ResultType.SUCCESS,
        success: true,
        data: {
          content: extractionResult.content,
          fileCount: extractionResult.fileCount,
          skippedCount: extractionResult.skippedCount,
          totalSize: extractionResult.totalSize,
          excludedPatterns: extractionResult.excludedPatterns,
          repoUrl,
          cloneDir,
          tempDir
        },
        duration: Date.now() - startTime
      };
      
      // Cache the successful extraction if caching is enabled
      if (useCache) {
        try {
          setCachedExtraction(normalizedUrl, result);
        } catch (cacheError) {
          console.warn('Failed to cache extraction:', cacheError.message);
          // Don't fail the entire operation if caching fails
        }
      }
      
      return result;
      
    } catch (extractionError) {
      return {
        type: ResultType.EXTRACTION_ERROR,
        success: false,
        error: {
          type: ErrorType.UNKNOWN,
          message: `Failed to extract repository context: ${extractionError.message}`,
          suggestion: 'The repository was cloned but could not be processed. Check repository structure.',
          originalError: extractionError.message
        },
        repoUrl,
        duration: Date.now() - startTime
      };
    }
    
  } catch (unexpectedError) {
    return {
      type: ResultType.EXTRACTION_ERROR,
      success: false,
      error: {
        type: ErrorType.UNKNOWN,
        message: `Unexpected error: ${unexpectedError.message}`,
        suggestion: 'An unexpected error occurred. Please try again.',
        originalError: unexpectedError.message
      },
      repoUrl,
      duration: Date.now() - startTime
    };
    
  } finally {
    // Cleanup
    const shouldCleanup = tempDir && fs.existsSync(tempDir);
    if (shouldCleanup) {
      const cleanupCondition = (options.success && cleanupOnSuccess) || (!options.success && cleanupOnError);
      if (cleanupCondition) {
        try {
          console.log('🧹 Cleaning up temporary directory...');
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn(`⚠️  Warning: Could not clean up temp directory ${tempDir}: ${cleanupError.message}`);
        }
      } else {
        console.log(`📂 Temporary directory preserved: ${tempDir}`);
      }
    }
  }
}

/**
 * Convenience function that extracts repo context and saves to file
 */
async function extractAndSave(repoUrl, outputPath, options = {}) {
  const result = await extractRepoContextRobust(repoUrl, options);
  
  if (result.success) {
    try {
      fs.writeFileSync(outputPath, result.data.content);
      result.outputPath = outputPath;
      result.outputSize = fs.statSync(outputPath).size;
      console.log(`💾 Content saved to: ${outputPath} (${(result.outputSize / 1024).toFixed(2)} KB)`);
    } catch (saveError) {
      result.saveError = `Failed to save to ${outputPath}: ${saveError.message}`;
      console.error(`❌ Save error: ${result.saveError}`);
    }
  }
  
  return result;
}

/**
 * Pretty prints the result with appropriate formatting
 */
function printResult(result) {
  console.log('\n' + '='.repeat(60));
  
  if (result.success) {
    console.log('✅ SUCCESS');
    console.log('='.repeat(60));
    console.log(`📊 Repository: ${result.data.repoUrl}`);
    console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)} seconds`);
    console.log(`📄 Files included: ${result.data.fileCount}`);
    console.log(`🚫 Files skipped: ${result.data.skippedCount}`);
    console.log(`📦 Total size: ${(result.data.totalSize / 1024).toFixed(2)} KB`);
    
    if (result.outputPath) {
      console.log(`💾 Output file: ${result.outputPath} (${(result.outputSize / 1024).toFixed(2)} KB)`);
    }
    
    if (result.data.excludedPatterns.length > 0) {
      console.log(`\n🚫 Exclusion patterns applied: ${result.data.excludedPatterns.length}`);
    }
    
  } else {
    console.log('❌ FAILED');
    console.log('='.repeat(60));
    console.log(`🔗 Repository: ${result.repoUrl}`);
    console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)} seconds`);
    console.log(`❌ Error type: ${result.error.type}`);
    console.log(`💬 Message: ${result.error.message}`);
    console.log(`💡 Suggestion: ${result.error.suggestion}`);
    
    if (result.error.stderr) {
      console.log(`\n📝 Technical details:\n${result.error.stderr.trim()}`);
    }
  }
  
  console.log('='.repeat(60));
}

// Export functions
export { 
  extractRepoContextRobust, 
  extractAndSave, 
  printResult,
  ResultType,
  ErrorType 
};

// Example usage when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testUrls = [
    'https://github.com/ncvgl/gitmermaid.git', // public repo
    'https://github.com/nonexistentuser/nonexistentrepo.git', // non-existent
    'https://github.com/microsoft/vscode.git', // large public repo
    'invalid-url' // invalid URL
  ];
  
  (async () => {
    for (const url of testUrls) {
      console.log(`\n🧪 Testing: ${url}`);
      const result = await extractRepoContextRobust(url);
      printResult(result);
    }
  })();
}