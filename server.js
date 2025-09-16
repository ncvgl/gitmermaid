import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractRepoContextRobust } from './extractRepoContextRobust.js';
import { getGitCloneUrl } from './utils/gitUrlParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize Vertex AI
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

if (!PROJECT_ID) {
  console.error("GOOGLE_CLOUD_PROJECT environment variable not set");
  process.exit(1);
}

const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
});

// Helper function to handle parentheses in node definitions
function formatParentheses(line) {
  // Skip if line already contains double quotes
  if (line.includes('"')) {
    return line;
  }
  
  // Look for pattern like A(text) or B(text with (nested) parens)
  const nodePattern = /(\w+)\((.+)\)/;
  const match = line.match(nodePattern);
  
  if (match) {
    // Find the first opening paren after the node identifier
    const firstParenIndex = line.indexOf('(', line.indexOf(match[1]));
    // Find the last closing paren on the line
    const lastParenIndex = line.lastIndexOf(')');
    
    if (firstParenIndex !== -1 && lastParenIndex !== -1 && firstParenIndex < lastParenIndex) {
      return line.substring(0, firstParenIndex + 1) + '"' +
             line.substring(firstParenIndex + 1, lastParenIndex) + '"' +
             line.substring(lastParenIndex);
    }
  }
  return line;
}

// Function to format Mermaid syntax for proper rendering
function formatMermaidSyntax(rawCode) {
  // Simple replacement to wrap square bracket content with quotes
  let formattedCode = rawCode.replace(/\[/g, '["').replace(/\]/g, '"]');
  // Also wrap curly brace content with quotes
  formattedCode = formattedCode.replace(/\{/g, '{"').replace(/\}/g, '"}');
  
  // Handle pipe characters for edge labels - process line by line
  const lines = formattedCode.split('\n');
  const processedLines = lines.map(line => {
    let processedLine = line;
    
    // Handle pipes for edge labels
    const pipeCount = (processedLine.match(/\|/g) || []).length;
    if (pipeCount >= 2) {
      const firstPipeIndex = processedLine.indexOf('|');
      const secondPipeIndex = processedLine.indexOf('|', firstPipeIndex + 1);
      
      if (firstPipeIndex !== -1 && secondPipeIndex !== -1) {
        processedLine = processedLine.substring(0, firstPipeIndex + 1) + '"' +
                       processedLine.substring(firstPipeIndex + 1, secondPipeIndex) + '"' +
                       processedLine.substring(secondPipeIndex);
      }
    }
    
    // Handle parentheses for rounded rectangle nodes
    processedLine = formatParentheses(processedLine);
    
    return processedLine;
  });
  
  return processedLines.join('\n');
}

// Read the Gemini prompt from file
const promptTemplate = fs.readFileSync(path.join(__dirname, 'gemini-prompt-1.txt'), 'utf8');

// API endpoint for generating diagrams
app.post('/api/generate-diagram', async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }

  try {
    // Convert user input to clone URL
    const cloneUrl = getGitCloneUrl(repoUrl);
    if (!cloneUrl) {
      return res.status(400).json({ 
        error: 'Invalid GitHub repository URL',
        suggestion: 'Please provide a valid GitHub repository URL (e.g., https://github.com/user/repo or user/repo)'
      });
    }

    console.log(`🚀 Starting repository analysis for: ${repoUrl}`);
    console.log(`📥 Will extract from: ${cloneUrl}`);
    
    // Step 1: Extract repository context (caching handled internally)
    // Uses defaults from extractRepoContextRobust.js:
    // - maxFiles: 500
    // - maxTotalSize: 10MB
    // - maxFileSize: 1MB per file
    const extractionResult = await extractRepoContextRobust(cloneUrl, {
      respectGitIgnore: true,
      respectGeminiIgnore: true,
      useDefaultExcludes: true,
      cleanupOnSuccess: true,
      cleanupOnError: true,
      useCache: false // Disable caching - recompute every time
    });

    if (!extractionResult.success) {
      console.error('Repository extraction failed:', extractionResult.error);
      return res.status(400).json({ 
        error: `Failed to analyze repository: ${extractionResult.error.message}`,
        suggestion: extractionResult.error.suggestion
      });
    }

    const contentLength = extractionResult.data.content.length;
    console.log(`✅ Repository extracted: ${extractionResult.data.fileCount} files, ${(extractionResult.data.totalSize / 1024).toFixed(2)} KB`);
    console.log(`📝 Context string length: ${contentLength.toLocaleString()} characters`);

    // Step 2: Create prompt with repository context
    const prompt = promptTemplate + '\n\n' + 
      'REPOSITORY CONTEXT:\n' + extractionResult.data.content;

    // Step 3: Generate diagram with Vertex AI
    const request = {
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 15000, // Increased for 6 diagrams
      }
    };

    const result = await model.generateContent(request);
    const response = await result.response;
    const rawCode = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawCode) {
      throw new Error("Received an empty response from the API.");
    }

    // Format the Mermaid syntax for proper rendering
    const formattedCode = formatMermaidSyntax(rawCode);
    
    // Return the generated diagram without validation
    res.json({ 
      diagramCode: formattedCode,
      metadata: {
        repoUrl: repoUrl,
        cloneUrl: cloneUrl,
        filesAnalyzed: extractionResult.data.fileCount,
        repoSize: `${(extractionResult.data.totalSize / 1024).toFixed(2)} KB`,
        processingTime: `${(extractionResult.duration / 1000).toFixed(2)}s`
      }
    });

  } catch (error) {
    console.error("Error generating diagram:", error);
    res.status(500).json({ 
      error: "Failed to generate the architecture diagram. Please check the repository URL and try again.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});