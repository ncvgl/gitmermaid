/**
 * Test script for the robust repository context extractor
 */

import { extractAndSave, printResult } from './extractRepoContextRobust.js';

async function runTests() {
  console.log('🚀 Testing robust repository extraction with various scenarios...\n');
  
  const testCases = [
    {
      name: 'Valid Public Repository',
      url: 'https://github.com/ncvgl/gitmermaid.git',
      outputFile: 'output-success.txt'
    },
    {
      name: 'Non-existent Repository',
      url: 'https://github.com/nonexistentuser/fakerepo123456.git',
      outputFile: 'output-nonexistent.txt'
    },
    {
      name: 'Invalid URL Format',
      url: 'not-a-valid-url',
      outputFile: 'output-invalid.txt'
    },
    {
      name: 'Invalid Git URL',
      url: 'https://google.com/not-a-repo',
      outputFile: 'output-invalid-git.txt'
    },
    {
      name: 'Network Error (Fake Host)',
      url: 'https://definitelyfakehost123.com/user/repo.git',
      outputFile: 'output-network-error.txt'
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`🔗 URL: ${testCase.url}`);
    console.log(`${'='.repeat(80)}`);
    
    const result = await extractAndSave(testCase.url, testCase.outputFile, {
      maxFiles: 50, // Limit for testing
      cleanupOnSuccess: true,
      cleanupOnError: true
    });
    
    printResult(result);
    
    // Add some spacing between tests
    if (i < testCases.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n🎉 All tests completed!');
  
  // Show summary
  console.log('\n📊 Test Summary:');
  console.log('- Check the generated output files for successful extractions');
  console.log('- Review the error messages for failed cases');
  console.log('- Notice how each error type provides specific guidance');
}

runTests().catch(console.error);