/**
 * Test script for Mermaid validation utility
 */

import { validateMermaidDiagram, isValidMermaidDiagram, validateWithSuggestions } from './utils/mermaidValidator.js';

// Test cases - valid diagrams
const validDiagrams = [
  {
    name: 'Simple Graph TD',
    code: `graph TD
      A[Start] --> B{Decision}
      B -->|Yes| C[Process]
      B -->|No| D[End]
      C --> D`
  },
  {
    name: 'Flowchart LR',
    code: `flowchart LR
      A[Input] --> B[Process]
      B --> C[Output]`
  },
  {
    name: 'Graph TB with various nodes',
    code: `graph TB
      A[Rectangle] --> B(Round)
      B --> C{Diamond}
      C --> D((Circle))
      D --> E[End]`
  },
  {
    name: 'Sequence Diagram',
    code: `sequenceDiagram
      Alice->>Bob: Hello Bob, how are you?
      Bob-->>John: How about you John?
      Bob--x Alice: I am good thanks!`
  },
  {
    name: 'Class Diagram',
    code: `classDiagram
      Animal <|-- Duck
      Animal <|-- Fish
      Animal : +int age
      Animal : +String gender
      Duck : +String beakColor
      Duck : +swim()
      Fish : -int sizeInFeet`
  },
  {
    name: 'State Diagram',
    code: `stateDiagram-v2
      [*] --> Still
      Still --> [*]
      Still --> Moving
      Moving --> Still
      Moving --> Crash
      Crash --> [*]`
  },
  {
    name: 'Simple Graph with Labels',
    code: `graph TD
      A[User clicks button] --> B[Validate input]
      B --> C{Input valid?}
      C -->|Yes| D[Submit form]
      C -->|No| E[Show error]
      D --> F[Success page]
      E --> A`
  },
  {
    name: 'Different Arrow Types',
    code: `graph TD
      A --> B
      B -.-> C
      C ==> D
      D -.-> E
      E --- F`
  }
];

// Test cases - invalid diagrams
const invalidDiagrams = [
  {
    name: 'Empty string',
    code: ''
  },
  {
    name: 'Null/undefined',
    code: null
  },
  {
    name: 'No diagram type',
    code: 'A --> B'
  },
  {
    name: 'Invalid diagram type',
    code: `invalidtype TD
      A --> B`
  },
  {
    name: 'Unbalanced brackets - missing close',
    code: `graph TD
      A[Start --> B[End]`
  },
  {
    name: 'Unbalanced brackets - missing open',
    code: `graph TD
      A Start] --> B[End]`
  },
  {
    name: 'Mixed bracket types',
    code: `graph TD
      A[Start) --> B(End]`
  },
  {
    name: 'Graph with no nodes',
    code: `graph TD`
  },
  {
    name: 'Sequence diagram with no interactions',
    code: `sequenceDiagram
      participant Alice
      participant Bob`
  },
  {
    name: 'Malformed arrow syntax',
    code: `graph TD
      A[Start] -> B[End]
      B ->-> C[Another]`
  },
  {
    name: 'Unclosed text in brackets',
    code: `graph TD
      A[This text is never closed --> B[End]`
  },
  {
    name: 'Node with quotes in label',
    code: `graph TD
    Frontend --> Backend
    Backend --> "Gemini API"`
  }
];

// Test cases for edge cases
const edgeCases = [
  {
    name: 'Very long node labels',
    code: `graph TD
      A[This is an extremely long label that goes on and on and might cause rendering issues] --> B[Short]`,
    expectWarning: true
  },
  {
    name: 'Many nodes (over limit)',
    code: `graph TD
      ${Array.from({length: 60}, (_, i) => `N${i}[Node ${i}]`).join('\n      ')}
      ${Array.from({length: 59}, (_, i) => `N${i} --> N${i+1}`).join('\n      ')}`,
    expectWarning: true
  },
  {
    name: 'Special characters in quotes',
    code: `graph TD
      A["Node with 'quotes'"] --> B["Another 'quoted' node"]`,
    shouldPass: false
  },
  {
    name: 'Empty nodes',
    code: `graph TD
      A[] --> B[]`,
    shouldPass: true
  },
  {
    name: 'Whitespace handling',
    code: `   graph TD   
      
      A[Start]   -->   B[End]   
      `,
    shouldPass: true
  }
];

function runTests() {
  console.log('🧪 Testing Mermaid Diagram Validator\n');
  console.log('=' .repeat(80));
  
  let passCount = 0;
  let failCount = 0;
  let totalTests = 0;
  
  // Test valid diagrams
  console.log('\n✅ Testing Valid Diagrams:');
  console.log('-'.repeat(50));
  
  for (const test of validDiagrams) {
    totalTests++;
    console.log(`\n📋 Testing: ${test.name}`);
    try {
      const isValid = isValidMermaidDiagram(test.code);
      const fullResult = validateMermaidDiagram(test.code);
      
      if (isValid) {
        console.log(`   ✅ Valid: ${isValid}`);
        passCount++;
      } else {
        console.log(`   ❌ Expected valid but got invalid: ${isValid}`);
        console.log(`   🚫 Errors: ${fullResult.errors.join(', ')}`);
        failCount++;
      }
      
      if (fullResult.hasWarnings()) {
        console.log(`   ⚠️  Warnings: ${fullResult.warnings.join(', ')}`);
      }
    } catch (error) {
      console.log(`   ❌ Error during validation: ${error.message}`);
      failCount++;
    }
  }
  
  // Test invalid diagrams
  console.log('\n\n❌ Testing Invalid Diagrams:');
  console.log('-'.repeat(50));
  
  for (const test of invalidDiagrams) {
    totalTests++;
    console.log(`\n📋 Testing: ${test.name}`);
    try {
      const resultWithSuggestions = validateWithSuggestions(test.code);
      
      if (!resultWithSuggestions.isValid) {
        console.log(`   ✅ Correctly identified as invalid`);
        passCount++;
      } else {
        console.log(`   ❌ Expected invalid but got valid`);
        failCount++;
      }
      
      if (resultWithSuggestions.errors && resultWithSuggestions.errors.length > 0) {
        console.log(`   🚫 Errors: ${resultWithSuggestions.errors.join(', ')}`);
      }
      if (resultWithSuggestions.suggestions && resultWithSuggestions.suggestions.length > 0) {
        console.log(`   💡 Suggestions:`);
        resultWithSuggestions.suggestions.forEach(suggestion => {
          console.log(`      - ${suggestion}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Error during validation: ${error.message}`);
      failCount++;
    }
  }
  
  // Test edge cases
  console.log('\n\n🎯 Testing Edge Cases:');
  console.log('-'.repeat(50));
  
  for (const test of edgeCases) {
    totalTests++;
    console.log(`\n📋 Testing: ${test.name}`);
    try {
      const result = validateMermaidDiagram(test.code, {
        checkNodeLimits: true,
        maxNodes: 50,
        maxEdges: 100
      });
      
      const shouldPass = test.shouldPass !== false; // Default to expecting pass unless explicitly set to false
      const expectWarning = test.expectWarning === true;
      
      if (shouldPass && result.isValid) {
        console.log(`   ✅ Valid as expected: ${result.isValid}`);
        passCount++;
      } else if (!shouldPass && !result.isValid) {
        console.log(`   ✅ Correctly identified issues`);
        passCount++;
      } else {
        console.log(`   ❌ Unexpected result. Expected valid: ${shouldPass}, Got: ${result.isValid}`);
        failCount++;
      }
      
      if (result.hasErrors()) {
        console.log(`   🚫 Errors: ${result.errors.join(', ')}`);
      }
      
      if (result.hasWarnings()) {
        console.log(`   ⚠️  Warnings: ${result.warnings.join(', ')}`);
        if (expectWarning) {
          console.log(`   ✅ Expected warnings found`);
        }
      } else if (expectWarning) {
        console.log(`   ❌ Expected warnings but none found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error during validation: ${error.message}`);
      failCount++;
    }
  }

  // Test performance with a complex diagram
  console.log('\n\n⚡ Performance & Stress Test:');
  console.log('-'.repeat(50));
  
  const complexDiagram = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Check logs]
    D --> F[Check config]
    D --> G[Ask for help]
    E --> H[Found issue?]
    F --> H
    G --> H
    H -->|Yes| I[Fix it]
    H -->|No| J[Escalate]
    I --> K[Test fix]
    K --> B
    J --> L[Senior dev]
    L --> D
    C --> M[Deploy]
    M --> N[Monitor]
    N --> O[Success!]`;
  
  console.log('📋 Testing complex diagram with 17+ nodes...');
  const startTime = Date.now();
  try {
    const result = validateMermaidDiagram(complexDiagram, {
      checkNodeLimits: true,
      maxNodes: 10,
      maxEdges: 15
    });
    const endTime = Date.now();
    
    console.log(`   ⏱️  Validation time: ${endTime - startTime}ms`);
    console.log(`   ✅ Valid: ${result.isValid}`);
    if (result.hasWarnings()) {
      console.log(`   ⚠️  Warnings:`);
      result.warnings.forEach(warning => {
        console.log(`      - ${warning}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`🎉 Test Results Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passCount} ✅`);
  console.log(`   Failed: ${failCount} ❌`);
  console.log(`   Success Rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));
}

// Run the tests
runTests();