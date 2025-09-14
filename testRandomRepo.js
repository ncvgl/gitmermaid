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

async function testRandomRepository() {
  // Get repository index from command line argument
  const repoIndex = process.argv[2] ? parseInt(process.argv[2]) : null;
  
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
  
  // Select repository based on index or randomly
  let selectedRepo;
  if (repoIndex !== null) {
    if (repoIndex < 0 || repoIndex >= testRepos.length) {
      console.error(colorize('red', `❌ Invalid index: ${repoIndex}. Must be between 0 and ${testRepos.length - 1}`));
      console.log(colorize('cyan', '\n📋 Available repositories:'));
      testRepos.forEach((repo, idx) => {
        console.log(colorize('gray', `  ${idx}: ${repo.name} - ${repo.description}`));
      });
      process.exit(1);
    }
    selectedRepo = testRepos[repoIndex];
    console.log(colorize('cyan', `📊 Testing Repository #${repoIndex}\n`));
  } else {
    selectedRepo = testRepos[Math.floor(Math.random() * testRepos.length)];
    console.log(colorize('cyan', '🎲 Testing Random Repository Diagram Generation\n'));
  }
  
  const randomRepo = selectedRepo;
  
  console.log(colorize('blue', `📋 Selected repository: ${randomRepo.name}`));
  console.log(colorize('gray', `📋 Description: ${randomRepo.description}`));
  console.log(colorize('gray', `🔗 URL: ${randomRepo.url}\n`));
  
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
  
  try {
    const startTime = Date.now();
    console.log(colorize('yellow', '⏳ Generating diagrams...'));
    
    const response = await fetch(`${API_BASE_URL}/api/generate-diagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl: randomRepo.url }),
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json();
      console.log(colorize('red', `❌ FAILED (${response.status})`));
      console.log(colorize('red', `   Error: ${error.error}`));
      if (error.suggestion) {
        console.log(colorize('yellow', `   Suggestion: ${error.suggestion}`));
      }
      return;
    }

    const data = await response.json();
    
    console.log(colorize('green', `✅ SUCCESS (${duration}ms)`));
    console.log(colorize('blue', `📊 Metadata:`));
    console.log(colorize('gray', `   Files analyzed: ${data.metadata?.filesAnalyzed || 'unknown'}`));
    console.log(colorize('gray', `   Repo size: ${data.metadata?.repoSize || 'unknown'}`));
    console.log(colorize('gray', `   Processing time: ${data.metadata?.processingTime || 'unknown'}`));
    
    // Generate markdown content
    const timestamp = formatDateTime();
    const filename = `diagram_${timestamp}.md`;
    const filepath = path.join(__dirname, filename);
    
    const markdownContent = `# Architecture Diagrams for ${randomRepo.name}

**Generated on:** ${new Date().toISOString()}  
**Repository:** ${randomRepo.url}  
**Description:** ${randomRepo.description}  

## Generation Metadata
- **Files analyzed:** ${data.metadata?.filesAnalyzed || 'unknown'}
- **Repository size:** ${data.metadata?.repoSize || 'unknown'}
- **Processing time:** ${data.metadata?.processingTime || 'unknown'}
- **Generation duration:** ${duration}ms

## Validation Results
- **Valid:** ${data.validation?.isValid ? '✅ Yes' : '❌ No'}
- **Warnings:** ${data.validation?.warnings?.length || 0}
- **Errors:** ${data.validation?.errors?.length || 0}

${data.validation?.warnings?.length > 0 ? `### Warnings
${data.validation.warnings.map(w => `- ${w}`).join('\n')}
` : ''}

${data.validation?.errors?.length > 0 ? `### Errors
${data.validation.errors.map(e => `- ${e}`).join('\n')}
` : ''}

## Generated Diagrams

${data.diagramCode}

---
*Generated by GitMermaid - AI-powered architecture diagram generator*
`;
    
    // Save to file
    fs.writeFileSync(filepath, markdownContent);
    
    console.log(colorize('green', `\n✅ Diagrams saved to: ${filename}`));
    console.log(colorize('blue', `📄 File path: ${filepath}`));
    
    // Show preview of first few lines
    const firstLines = data.diagramCode.split('\n').slice(0, 5).join('\n');
    console.log(colorize('gray', `\n📝 Preview of generated content:`));
    console.log(colorize('gray', `${firstLines.replace(/\n/g, '\n   ')}`));
    
  } catch (error) {
    console.log(colorize('red', `❌ ERROR: ${error.message}`));
  }
}

// Run test if this file is executed directly
if (process.argv[1] === __filename) {
  testRandomRepository().catch(console.error);
}

export { testRandomRepository };