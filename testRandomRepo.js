/**
 * Test script for generating diagrams from a random repository
 * Saves the result as a markdown file with timestamp
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:3001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatDateTime() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
}

async function testSingleRepository(repo, index) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-diagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl: repo.url }),
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json();
      console.log(colorize('red', `  ${index}: ${repo.name} - ❌ FAILED (${response.status}) - ${error.error}`));
      return { success: false, repo, index, error: error.error };
    }

    const data = await response.json();
    
    // Save only the raw endpoint output
    const timestamp = formatDateTime();
    const filename = `diagram_${index}_${repo.name.replace(/\s+/g, '_')}_${timestamp}.md`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, data.diagramCode);
    
    console.log(colorize('green', `  ${index}: ${repo.name} - ✅ SUCCESS (${duration}ms) - Saved to: ${filename}`));
    
    return { success: true, repo, index, filename, duration };
    
  } catch (error) {
    console.log(colorize('red', `  ${index}: ${repo.name} - ❌ ERROR: ${error.message}`));
    return { success: false, repo, index, error: error.message };
  }
}

async function runWithConcurrencyLimit(tasks, limit = 10) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

function parseRangeOrIndex(arg) {
  if (!arg) return null;

  // Check if it's a range (e.g., "10-20")
  if (arg.includes('-')) {
    const [start, end] = arg.split('-').map(s => parseInt(s.trim()));
    if (isNaN(start) || isNaN(end) || start > end) {
      throw new Error(`Invalid range: ${arg}. Use format "start-end" where start <= end`);
    }
    return { type: 'range', start, end };
  }

  // Single index
  const index = parseInt(arg);
  if (isNaN(index)) {
    throw new Error(`Invalid index: ${arg}. Use a number or range like "10-20"`);
  }
  return { type: 'single', index };
}

async function testRandomRepository() {
  // Get repository index or range from command line argument
  let selection = null;
  try {
    selection = parseRangeOrIndex(process.argv[2]);
  } catch (error) {
    console.error(colorize('red', `❌ ${error.message}`));
    console.log(colorize('yellow', '💡 Usage: node testRandomRepo.js [index] or [start-end]'));
    console.log(colorize('yellow', '   Examples: node testRandomRepo.js 5'));
    console.log(colorize('yellow', '             node testRandomRepo.js 10-15'));
    process.exit(1);
  }
  
  // Load test repositories
  const testReposPath = path.join(__dirname, 'test-repos.json');
  let testRepos;
  
  try {
    const data = fs.readFileSync(testReposPath, 'utf8');
    testRepos = JSON.parse(data);
  } catch (error) {
    console.error(colorize('red', `❌ Failed to load test repositories: ${error.message}`));
    process.exit(1);
  }
  
  // Check if server is running
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-diagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: 'test' })
    });
    // We expect this to fail, but if it reaches here, server is running
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(colorize('red', `❌ Server not running at ${API_BASE_URL}`));
      console.log(colorize('yellow', '💡 Please start the server with: npm run server'));
      process.exit(1);
    }
  }
  
  // Handle specific selection
  if (selection !== null) {
    let selectedRepos, selectedIndices;

    if (selection.type === 'single') {
      const repoIndex = selection.index;
      if (repoIndex < 0 || repoIndex >= testRepos.length) {
        console.error(colorize('red', `❌ Invalid index: ${repoIndex}. Must be between 0 and ${testRepos.length - 1}`));
        console.log(colorize('cyan', '\n📋 Available repositories:'));
        testRepos.forEach((repo, idx) => {
          console.log(colorize('gray', `  ${idx}: ${repo.name} - ${repo.description}`));
        });
        process.exit(1);
      }
      selectedRepos = [testRepos[repoIndex]];
      selectedIndices = [repoIndex];
    } else {
      // Range
      const { start, end } = selection;
      if (start < 0 || end >= testRepos.length) {
        console.error(colorize('red', `❌ Invalid range: ${start}-${end}. Indices must be between 0 and ${testRepos.length - 1}`));
        console.log(colorize('cyan', '\n📋 Available repositories:'));
        testRepos.forEach((repo, idx) => {
          console.log(colorize('gray', `  ${idx}: ${repo.name} - ${repo.description}`));
        });
        process.exit(1);
      }
      selectedRepos = testRepos.slice(start, end + 1);
      selectedIndices = Array.from({length: end - start + 1}, (_, i) => start + i);
    }

    console.log(colorize('cyan', `📊 Testing ${selectedRepos.length} repositories in parallel\n`));
    console.log(colorize('blue', `📋 Selected repositories:\n`));

    selectedRepos.forEach((repo, idx) => {
      console.log(colorize('gray', `  ${selectedIndices[idx]}: ${repo.name}`));
    });

    console.log(colorize('yellow', '\n⏳ Starting parallel generation (max 10 concurrent)...\n'));

    const tasks = selectedRepos.map((repo, idx) => () => testSingleRepository(repo, selectedIndices[idx]));
    const results = await runWithConcurrencyLimit(tasks, 10);

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(colorize('cyan', '\n📊 Summary:'));
    console.log(colorize('green', `  ✅ Successful: ${successful.length}/${selectedRepos.length}`));
    if (failed.length > 0) {
      console.log(colorize('red', `  ❌ Failed: ${failed.length}/${selectedRepos.length}`));
      failed.forEach(f => {
        console.log(colorize('red', `     - ${f.repo.name}: ${f.error}`));
      });
    }

    if (successful.length > 0) {
      console.log(colorize('blue', '\n📁 Generated files:'));
      successful.forEach(s => {
        console.log(colorize('gray', `  - ${s.filename} (${s.duration}ms)`));
      });
    }

  } else {
    // Run all repositories in parallel
    console.log(colorize('cyan', '🚀 Testing ALL repositories in parallel\n'));
    console.log(colorize('blue', `📋 Found ${testRepos.length} repositories to test:\n`));
    
    testRepos.forEach((repo, idx) => {
      console.log(colorize('gray', `  ${idx}: ${repo.name}`));
    });
    
    console.log(colorize('yellow', '\n⏳ Starting parallel generation (max 10 concurrent)...\n'));
    
    const tasks = testRepos.map((repo, idx) => () => testSingleRepository(repo, idx));
    const results = await runWithConcurrencyLimit(tasks, 10);
    
    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(colorize('cyan', '\n📊 Summary:'));
    console.log(colorize('green', `  ✅ Successful: ${successful.length}/${testRepos.length}`));
    if (failed.length > 0) {
      console.log(colorize('red', `  ❌ Failed: ${failed.length}/${testRepos.length}`));
      failed.forEach(f => {
        console.log(colorize('red', `     - ${f.repo.name}: ${f.error}`));
      });
    }
    
    if (successful.length > 0) {
      console.log(colorize('blue', '\n📁 Generated files:'));
      successful.forEach(s => {
        console.log(colorize('gray', `  - ${s.filename} (${s.duration}ms)`));
      });
    }
  }
}

// Run test if this file is executed directly
if (process.argv[1] === __filename) {
  testRandomRepository().catch(console.error);
}

export { testRandomRepository };