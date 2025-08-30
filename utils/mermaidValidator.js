/**
 * Mermaid Diagram Validator
 * Provides utilities to validate Mermaid diagram syntax
 * Note: This is a syntax-based validator that works in Node.js environments
 * For full validation, use the browser-based validator
 */

/**
 * Validation result structure
 */
export class ValidationResult {
  constructor(isValid, errors = [], warnings = []) {
    this.isValid = isValid;
    this.errors = errors;
    this.warnings = warnings;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  getAllMessages() {
    return [...this.errors, ...this.warnings];
  }
}

/**
 * Validates a Mermaid diagram string for basic syntax errors
 * This is a lightweight validator that works in Node.js environments
 * @param {string} diagramCode - The Mermaid diagram code to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult} - Validation result
 */
export function validateMermaidDiagram(diagramCode, options = {}) {
  const {
    strict = true,
    checkNodeLimits = true,
    maxNodes = 50,
    maxEdges = 100
  } = options;

  const errors = [];
  const warnings = [];

  // Basic validation - check if string is provided
  if (!diagramCode || typeof diagramCode !== 'string') {
    errors.push('Diagram code must be a non-empty string');
    return new ValidationResult(false, errors, warnings);
  }

  const trimmedCode = diagramCode.trim();
  if (trimmedCode.length === 0) {
    errors.push('Diagram code cannot be empty');
    return new ValidationResult(false, errors, warnings);
  }

  // Check for basic Mermaid diagram patterns
  const diagramTypePattern = /^(graph\s+(TB|TD|BT|RL|LR)|flowchart\s+(TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitgraph|pie|quadrantChart|requirement|mindmap|timeline|zenuml|sankey|architecture|graph|flowchart)/i;
  
  if (!diagramTypePattern.test(trimmedCode)) {
    errors.push('Diagram must start with a valid Mermaid diagram type (graph TD, flowchart LR, sequenceDiagram, etc.)');
  }

  // Validate basic syntax patterns
  const syntaxErrors = checkBasicSyntax(trimmedCode);
  errors.push(...syntaxErrors);

  // Perform additional checks if requested
  if (checkNodeLimits) {
    const nodeCount = countNodes(trimmedCode);
    const edgeCount = countEdges(trimmedCode);
    
    if (nodeCount > maxNodes) {
      warnings.push(`Diagram has ${nodeCount} nodes, which exceeds the recommended limit of ${maxNodes}`);
    }
    
    if (edgeCount > maxEdges) {
      warnings.push(`Diagram has ${edgeCount} edges, which exceeds the recommended limit of ${maxEdges}`);
    }
  }

  // Check for quotes which cause syntax issues
  if (trimmedCode.includes('"') || trimmedCode.includes("'")) {
    errors.push('Quotes detected in diagram - quotes are not allowed in node labels');
  }

  // Check for potential issues
  const potentialIssues = checkForCommonIssues(trimmedCode);
  warnings.push(...potentialIssues);

  return new ValidationResult(errors.length === 0, errors, warnings);
}

/**
 * Checks for basic syntax errors in Mermaid diagrams
 */
function checkBasicSyntax(diagramCode) {
  const errors = [];
  const lines = diagramCode.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Check for balanced brackets and parentheses
  const brackets = { '[': ']', '(': ')', '{': '}' };
  const stack = [];
  
  for (const line of lines) {
    for (const char of line) {
      if (brackets[char]) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const lastOpen = stack.pop();
        if (!lastOpen || brackets[lastOpen] !== char) {
          errors.push(`Mismatched brackets: found '${char}' without proper opening bracket`);
          break;
        }
      }
    }
  }
  
  if (stack.length > 0) {
    errors.push(`Unclosed brackets found: ${stack.join(', ')}`);
  }
  
  // Check for graph/flowchart specific syntax
  if (diagramCode.match(/^(graph|flowchart)/i)) {
    // Look for nodes and connections
    const hasNodes = lines.some(line => 
      line.includes('[') || line.includes('(') || line.includes('{') ||
      /\w+\s*-->/.test(line) || /\w+\s*---/.test(line)
    );
    
    if (!hasNodes) {
      errors.push('Graph diagrams should contain nodes or connections');
    }
    
    // Check for obviously malformed patterns (very basic check)
    for (const line of lines) {
      // Check for incomplete arrows like single ->
      if (line.includes(' -> ') && !line.includes(' --> ')) {
        errors.push(`Possible incomplete arrow syntax in line: "${line}" (use --> instead of ->)`);
      }
    }
  }
  
  // Check for sequence diagram syntax
  if (diagramCode.match(/^sequenceDiagram/i)) {
    const hasParticipants = lines.some(line => 
      line.includes('->') || line.includes('->>') || line.includes('-->')
    );
    
    if (!hasParticipants) {
      errors.push('Sequence diagrams should contain participant interactions');
    }
  }
  
  return errors;
}

/**
 * Cleans up the temporary container
 */
function cleanupTempContainer(container) {
  if (typeof document !== 'undefined' && container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

/**
 * Extracts meaningful error message from Mermaid error
 */
function extractMermaidError(error) {
  if (!error) return 'Unknown error';
  
  let message = error.message || error.toString();
  
  // Clean up common Mermaid error patterns
  message = message
    .replace(/Error:\s*/g, '')
    .replace(/\n.*$/g, '') // Remove stack trace
    .trim();
  
  // Provide more user-friendly messages for common errors
  if (message.includes('Parse error')) {
    return 'Syntax parse error - check your diagram syntax';
  }
  if (message.includes('Expecting')) {
    return 'Syntax error - unexpected token or missing element';
  }
  if (message.includes('Lexical error')) {
    return 'Invalid characters or tokens in diagram';
  }
  
  return message;
}

/**
 * Counts approximate number of nodes in a diagram
 */
function countNodes(diagramCode) {
  // Simple regex to count node definitions
  // This is approximate and may not be 100% accurate for all diagram types
  const nodePatterns = [
    /\w+\[.*?\]/g, // Rectangle nodes [text]
    /\w+\(.*?\)/g, // Round nodes (text)
    /\w+\{.*?\}/g, // Rhombus nodes {text}
    /\w+\[\[.*?\]\]/g, // Subroutine nodes [[text]]
    /\w+\[\(.*?\)\]/g, // Circular nodes [(text)]
    /\w+>\w+\]/g, // Asymmetric nodes >text]
    /\w+\(\(.*?\)\)/g, // Circle nodes ((text))
  ];
  
  let totalNodes = 0;
  for (const pattern of nodePatterns) {
    const matches = diagramCode.match(pattern) || [];
    totalNodes += matches.length;
  }
  
  return totalNodes;
}

/**
 * Counts approximate number of edges in a diagram
 */
function countEdges(diagramCode) {
  // Simple regex to count edge definitions
  const edgePatterns = [
    /-->/g,    // Arrow edges
    /---/g,    // Line edges
    /-\.-/g,   // Dotted edges
    /==>/g,    // Thick arrow edges
    /===/g,    // Thick line edges
    /-\.\./g,  // Dotted line edges
  ];
  
  let totalEdges = 0;
  for (const pattern of edgePatterns) {
    const matches = diagramCode.match(pattern) || [];
    totalEdges += matches.length;
  }
  
  return totalEdges;
}

/**
 * Checks for common issues that might cause problems
 */
function checkForCommonIssues(diagramCode) {
  const warnings = [];
  
  // Check for very long node labels
  const longLabelPattern = /\[([^[\]]{50,})\]/g;
  const longLabels = diagramCode.match(longLabelPattern);
  if (longLabels && longLabels.length > 0) {
    warnings.push(`Found ${longLabels.length} node(s) with very long labels that might affect readability`);
  }
  
  // Check for potential circular references (basic check)
  const lines = diagramCode.split('\n').filter(line => line.trim().length > 0);
  const edgeLines = lines.filter(line => line.includes('-->') || line.includes('---'));
  if (edgeLines.length > 20) {
    warnings.push('Large number of connections detected - diagram might be complex to read');
  }
  
  
  return warnings;
}

/**
 * Quick validation function that only checks if diagram can be parsed
 * @param {string} diagramCode - The Mermaid diagram code
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidMermaidDiagram(diagramCode) {
  const result = validateMermaidDiagram(diagramCode, { 
    strict: false, 
    checkNodeLimits: false 
  });
  return result.isValid;
}

/**
 * Validates and provides suggestions for fixing common issues
 * @param {string} diagramCode - The Mermaid diagram code
 * @returns {Object} - Validation result with suggestions
 */
export function validateWithSuggestions(diagramCode) {
  const result = validateMermaidDiagram(diagramCode);
  const suggestions = [];
  
  if (!result.isValid) {
    // Provide suggestions based on common errors
    if (result.errors.some(e => e.includes('diagram type'))) {
      suggestions.push('Try starting your diagram with "graph TD" or "flowchart TD"');
    }
    
    if (result.errors.some(e => e.includes('brackets'))) {
      suggestions.push('Check for missing or mismatched brackets, parentheses, or braces');
      suggestions.push('Ensure all opening brackets have corresponding closing brackets');
    }
    
    if (result.errors.some(e => e.includes('arrow syntax'))) {
      suggestions.push('Check for missing arrows (-->) or incorrect arrow syntax');
      suggestions.push('Common arrows: -->, ---, -.->, ==>, ===');
    }
    
    if (result.errors.some(e => e.includes('nodes or connections'))) {
      suggestions.push('Add some nodes like A[Label] or connections like A --> B');
    }
  }
  
  return {
    ...result,
    suggestions
  };
}

// Export the class and functions
export default {
  validateMermaidDiagram,
  isValidMermaidDiagram,
  validateWithSuggestions,
  ValidationResult
};