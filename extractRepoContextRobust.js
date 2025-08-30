/**
 * Robust repository context extractor with error handling
 * Handles private repos, non-existent repos, and invalid URLs gracefully
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractRepoContext } from './extractRepoContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  UNKNOWN: 'unknown'
};

/**
 * Classifies git clone errors based on stderr output
 */
function classifyCloneError(stderr) {
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
    maxFiles = 500,
    maxTotalSize = 10 * 1024 * 1024, // 10MB
    maxFileSize = 1024 * 1024, // 1MB per file
    cleanupOnSuccess = true,
    cleanupOnError = true
  } = options;
  
  const startTime = Date.now();
  let tempDir = null;
  let cloneDir = null;
  
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
        timeout: 60000 // 60 second timeout
      });
      console.log('✅ Repository cloned successfully');
    } catch (cloneError) {
      const stderr = cloneError.stderr ? cloneError.stderr.toString() : '';
      const classifiedError = classifyCloneError(stderr);
      
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
        maxTotalSize,
        maxFileSize
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