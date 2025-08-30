/**
 * Test script for validating diagram generation across multiple repositories
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

async function testRepository(repo) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(colorize('cyan', `🧪 Testing: ${repo.name}`));
  console.log(colorize('gray', `📋 Description: ${repo.description}`));
  console.log(colorize('gray', `🔗 URL: ${repo.url}`));
  console.log(`${'='.repeat(80)}`);
  
  try {
    const startTime = Date.now();
    
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
      console.log(colorize('red', `❌ FAILED (${response.status})`));
      console.log(colorize('red', `   Error: ${error.error}`));
      if (error.suggestion) {
        console.log(colorize('yellow', `   Suggestion: ${error.suggestion}`));
      }
      return {
        name: repo.name,
        status: 'failed',
        error: error.error,
        duration: duration
      };
    }

    const data = await response.json();
    
    // Check validation
    const validation = data.validation;
    const isValid = validation?.isValid !== false;
    
    console.log(colorize('green', `✅ SUCCESS (${duration}ms)`));
    console.log(colorize('blue', `📊 Metadata:`));
    console.log(colorize('gray', `   Files analyzed: ${data.metadata?.filesAnalyzed || 'unknown'}`));
    console.log(colorize('gray', `   Repo size: ${data.metadata?.repoSize || 'unknown'}`));
    console.log(colorize('gray', `   Processing time: ${data.metadata?.processingTime || 'unknown'}`));
    
    // Count nodes and connections in diagram
    const diagramCode = data.diagramCode;
    const nodeMatches = diagramCode.match(/[A-Z]+[\[\(]/g) || [];
    const connectionMatches = diagramCode.match(/-->/g) || [];
    
    console.log(colorize('blue', `📈 Diagram metrics:`));
    console.log(colorize('gray', `   Nodes: ${nodeMatches.length}`));
    console.log(colorize('gray', `   Connections: ${connectionMatches.length}`));
    console.log(colorize('gray', `   Valid: ${isValid ? '✅' : '❌'}`));
    
    if (validation?.warnings?.length > 0) {
      console.log(colorize('yellow', `⚠️  Warnings:`));
      validation.warnings.forEach(warning => {
        console.log(colorize('yellow', `   - ${warning}`));
      });
    }
    
    if (validation?.errors?.length > 0) {
      console.log(colorize('red', `❌ Validation Errors:`));
      validation.errors.forEach(error => {
        console.log(colorize('red', `   - ${error}`));
      });
    }
    
    // Show first few lines of diagram
    const firstLines = diagramCode.split('\n').slice(0, 3).join('\n');
    console.log(colorize('gray', `📝 Diagram preview:`));
    console.log(colorize('gray', `   ${firstLines.replace(/\n/g, '\n   ')}`));
    
    return {
      name: repo.name,
      status: 'success',
      duration: duration,
      validation: {
        isValid: isValid,
        warnings: validation?.warnings || [],
        errors: validation?.errors || []
      },
      metrics: {
        nodes: nodeMatches.length,
        connections: connectionMatches.length,
        filesAnalyzed: data.metadata?.filesAnalyzed,
        repoSize: data.metadata?.repoSize
      },
      diagramCode: diagramCode
    };
    
  } catch (error) {
    console.log(colorize('red', `❌ ERROR: ${error.message}`));
    return {
      name: repo.name,
      status: 'error',
      error: error.message,
      duration: 0
    };
  }
}

async function runRepositoryTests() {
  console.log(colorize('cyan', '🚀 Starting Repository Diagram Generation Tests\n'));
  
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
  
  console.log(colorize('blue', `📋 Found ${testRepos.length} repositories to test`));
  
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
  
  const results = [];
  
  // Test each repository
  for (let i = 0; i < testRepos.length; i++) {
    const repo = testRepos[i];
    console.log(colorize('blue', `\n📊 Progress: ${i + 1}/${testRepos.length}`));
    
    const result = await testRepository(repo);
    results.push(result);
    
    // Add delay between requests to avoid overwhelming the server
    if (i < testRepos.length - 1) {
      console.log(colorize('gray', '\n⏳ Waiting 2 seconds before next test...'));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Generate summary
  console.log(`\n${'='.repeat(100)}`);
  console.log(colorize('cyan', '📊 TEST RESULTS SUMMARY'));
  console.log(`${'='.repeat(100)}`);
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const errored = results.filter(r => r.status === 'error');
  
  console.log(colorize('green', `✅ Successful: ${successful.length}`));
  console.log(colorize('red', `❌ Failed: ${failed.length}`));
  console.log(colorize('red', `💥 Errored: ${errored.length}`));
  console.log(colorize('blue', `📈 Success Rate: ${(successful.length / results.length * 100).toFixed(1)}%`));
  
  if (successful.length > 0) {
    console.log(colorize('green', '\n✅ Successful repositories:'));
    successful.forEach(result => {
      const metrics = result.metrics;
      console.log(colorize('green', `   - ${result.name} (${result.duration}ms, ${metrics.nodes} nodes, ${metrics.connections} connections)`));
      if (result.validation.warnings.length > 0) {
        console.log(colorize('yellow', `     ⚠️  ${result.validation.warnings.length} warning(s)`));
      }
    });
  }
  
  if (failed.length > 0) {
    console.log(colorize('red', '\n❌ Failed repositories:'));
    failed.forEach(result => {
      console.log(colorize('red', `   - ${result.name}: ${result.error}`));
    });
  }
  
  if (errored.length > 0) {
    console.log(colorize('red', '\n💥 Errored repositories:'));
    errored.forEach(result => {
      console.log(colorize('red', `   - ${result.name}: ${result.error}`));
    });
  }
  
  // Save detailed results
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(colorize('blue', `\n📄 Detailed results saved to: ${reportPath}`));
  
  console.log(colorize('cyan', '\n🎉 Repository testing completed!'));
  
  return results;
}

// Run tests if this file is executed directly
if (process.argv[1] === __filename) {
  runRepositoryTests().catch(console.error);
}

export { runRepositoryTests, testRepository };