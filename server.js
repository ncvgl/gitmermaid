import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  
  return cleaned.substring(graphStartIndex).trim();
};

// Read the Gemini prompt from file
const promptTemplate = fs.readFileSync(path.join(__dirname, 'gemini-prompt.txt'), 'utf8');

// API endpoint for generating diagrams
app.post('/api/generate-diagram', async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }

  const prompt = promptTemplate.replace('${repoUrl}', repoUrl);

  try {
    const request = {
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 10000,
      }
    };

    const result = await model.generateContent(request);
    const response = await result.response;
    const rawCode = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawCode) {
      throw new Error("Received an empty response from the API.");
    }

    const cleanedCode = cleanMermaidCode(rawCode);
    res.json({ diagramCode: cleanedCode });
  } catch (error) {
    console.error("Error generating diagram with Vertex AI:", error);
    res.status(500).json({ 
      error: "Failed to generate the architecture diagram. Please check the repository URL and try again." 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});