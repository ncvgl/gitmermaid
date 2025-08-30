import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractRepoContextRobust } from './extractRepoContextRobust.js';
import { validateMermaidDiagram } from './utils/mermaidValidator.js';
import { getGitCloneUrl } from './utils/gitUrlParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

// Clean Mermaid code helper
const cleanMermaidCode = (rawOutput) => {
  const cleaned = rawOutput.replace(/```mermaid/g, '').replace(/```/g, '');
  const graphStartIndex = cleaned.search(/graph\s+(TD|LR|TB|RL|BT)/);

  if (graphStartIndex === -1) {
    console.error("Could not find a valid Mermaid graph definition in the response.");
    return `
      graph TD
        A[Error] --> B(Could not generate diagram);
        B --> C{Please try a different URL or rephrase your request};
    `;
  }
  
  let mermaidCode = cleaned.substring(graphStartIndex).trim();
  
  // Remove quotes from node labels to prevent syntax issues
  mermaidCode = mermaidCode.replace(/"([^"]+)"/g, '$1');
  mermaidCode = mermaidCode.replace(/'([^']+)'/g, '$1');
  
  return mermaidCode;
};

// Read the Gemini prompt from file
const promptTemplate = fs.readFileSync(path.join(__dirname, 'gemini-prompt.txt'), 'utf8');

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
      useCache: true // Enable caching
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
        maxOutputTokens: 1000, // Further reduced for simpler diagrams
      }
    };

    const result = await model.generateContent(request);
    const response = await result.response;
    const rawCode = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawCode) {
      throw new Error("Received an empty response from the API.");
    }

    const cleanedCode = cleanMermaidCode(rawCode);
    
    // Step 4: Validate the generated diagram
    console.log('🔍 Validating generated diagram...');
    try {
      const validationResult = validateMermaidDiagram(cleanedCode);
      console.log(`✅ Diagram validation: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
      
      if (validationResult.hasWarnings()) {
        console.log(`⚠️  Validation warnings: ${validationResult.warnings.join(', ')}`);
      }
      
      res.json({ 
        diagramCode: cleanedCode,
        validation: {
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        },
        metadata: {
          repoUrl: repoUrl,
          cloneUrl: cloneUrl,
          filesAnalyzed: extractionResult.data.fileCount,
          repoSize: `${(extractionResult.data.totalSize / 1024).toFixed(2)} KB`,
          processingTime: `${(extractionResult.duration / 1000).toFixed(2)}s`
        }
      });
    } catch (validationError) {
      console.warn('⚠️  Could not validate diagram:', validationError.message);
      // Still return the diagram even if validation fails
      res.json({ 
        diagramCode: cleanedCode,
        validation: {
          isValid: null,
          errors: [`Validation failed: ${validationError.message}`],
          warnings: []
        },
        metadata: {
          repoUrl: repoUrl,
          cloneUrl: cloneUrl,
          filesAnalyzed: extractionResult.data.fileCount,
          repoSize: `${(extractionResult.data.totalSize / 1024).toFixed(2)} KB`,
          processingTime: `${(extractionResult.duration / 1000).toFixed(2)}s`
        }
      });
    }

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