/**
 * File-based cache for repository context extractions
 * Structure:
 * - cache/
 *   - index.json (maps normalized URLs to filenames and metadata)
 *   - extractions/
 *     - repo-hash-1.txt (actual repository context content)
 *     - repo-hash-2.txt
 *     - ...
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_ROOT = path.join(__dirname, '..', 'cache');
const EXTRACTIONS_DIR = path.join(CACHE_ROOT, 'extractions');
const INDEX_FILE = path.join(CACHE_ROOT, 'index.json');

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize cache directories and index file
 */
function initializeCache() {
  try {
    // Create directories if they don't exist
    if (!fs.existsSync(CACHE_ROOT)) {
      fs.mkdirSync(CACHE_ROOT, { recursive: true });
    }
    if (!fs.existsSync(EXTRACTIONS_DIR)) {
      fs.mkdirSync(EXTRACTIONS_DIR, { recursive: true });
    }
    
    // Create index file if it doesn't exist
    if (!fs.existsSync(INDEX_FILE)) {
      fs.writeFileSync(INDEX_FILE, JSON.stringify({}, null, 2));
    }
  } catch (error) {
    console.warn('Failed to initialize cache:', error.message);
  }
}

/**
 * Generate a safe filename from a normalized URL
 */
function generateFilename(normalizedUrl) {
  // Create a hash for uniqueness and add readable part
  const hash = crypto.createHash('md5').update(normalizedUrl).digest('hex').substring(0, 8);
  const repoName = normalizedUrl.split('/').slice(-2).join('-').replace(/[^a-zA-Z0-9\-]/g, '');
  return `${repoName}-${hash}.txt`;
}

/**
 * Load the cache index
 */
function loadIndex() {
  try {
    if (!fs.existsSync(INDEX_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch (error) {
    console.warn('Failed to load cache index:', error.message);
    return {};
  }
}

/**
 * Save the cache index
 */
function saveIndex(index) {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  } catch (error) {
    console.warn('Failed to save cache index:', error.message);
  }
}

/**
 * Get cached repository extraction for a normalized URL
 * @param {string} normalizedUrl - The normalized GitHub URL
 * @returns {Object|null} - Cached extraction result or null if not found/expired
 */
export function getCachedExtraction(normalizedUrl) {
  initializeCache();
  
  try {
    const index = loadIndex();
    const entry = index[normalizedUrl];
    
    if (!entry) {
      return null;
    }
    
    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
      console.log(`Cache expired for ${normalizedUrl}`);
      // Don't delete here, let cleanup handle it
      return null;
    }
    
    // Try to read the extraction file
    const extractionPath = path.join(EXTRACTIONS_DIR, entry.filename);
    if (!fs.existsSync(extractionPath)) {
      console.warn(`Cache file missing: ${entry.filename}`);
      return null;
    }
    
    const extractionContent = fs.readFileSync(extractionPath, 'utf8');
    console.log(`Cache hit for ${normalizedUrl} (${entry.filename})`);
    
    // Return the extraction result structure with essential data
    return {
      data: {
        content: extractionContent,
        fileCount: entry.fileCount || 0,
        totalSize: entry.totalSize || 0
      },
      duration: entry.duration || 0
    };
    
  } catch (error) {
    console.warn('Failed to get cached extraction:', error.message);
    return null;
  }
}

/**
 * Cache a repository extraction for a normalized URL
 * @param {string} normalizedUrl - The normalized GitHub URL
 * @param {Object} extractionResult - The extraction result from extractRepoContextRobust
 */
export function setCachedExtraction(normalizedUrl, extractionResult) {
  initializeCache();
  
  try {
    const index = loadIndex();
    const filename = generateFilename(normalizedUrl);
    const extractionPath = path.join(EXTRACTIONS_DIR, filename);
    
    // Write extraction content to file
    fs.writeFileSync(extractionPath, extractionResult.data.content, 'utf8');
    
    // Update index with essential metadata only
    index[normalizedUrl] = {
      filename,
      timestamp: Date.now(),
      size: extractionResult.data.content.length,
      fileCount: extractionResult.data.fileCount,
      totalSize: extractionResult.data.totalSize,
      duration: extractionResult.duration
    };
    
    saveIndex(index);
    console.log(`Cached extraction for ${normalizedUrl} as ${filename}`);
    
  } catch (error) {
    console.warn('Failed to cache extraction:', error.message);
  }
}



/**
 * Clear all cache
 */
export function clearAllCache() {
  try {
    if (fs.existsSync(EXTRACTIONS_DIR)) {
      const files = fs.readdirSync(EXTRACTIONS_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(EXTRACTIONS_DIR, file));
      });
    }
    
    if (fs.existsSync(INDEX_FILE)) {
      fs.writeFileSync(INDEX_FILE, JSON.stringify({}, null, 2));
    }
    
    console.log('All cache cleared');
  } catch (error) {
    console.warn('Failed to clear cache:', error.message);
  }
}

/**
 * List all cached repositories
 * @returns {Array} - List of cached repos with metadata
 */
export function listCachedRepos() {
  initializeCache();
  
  try {
    const index = loadIndex();
    const now = Date.now();
    
    return Object.entries(index).map(([url, entry]) => ({
      url,
      filename: entry.filename,
      cached: new Date(entry.timestamp).toLocaleString(),
      expired: now - entry.timestamp > CACHE_EXPIRY_MS,
      size: entry.size ? `${(entry.size / 1024).toFixed(2)} KB` : 'unknown',
      metadata: {
        fileCount: entry.fileCount,
        repoSize: entry.repoSize,
        processingTime: entry.processingTime
      }
    }));
  } catch (error) {
    console.warn('Failed to list cached repos:', error.message);
    return [];
  }
}

export default {
  getCachedExtraction,
  setCachedExtraction,
  clearAllCache,
  listCachedRepos
};