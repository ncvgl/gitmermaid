import { VertexAI } from "@google-cloud/vertexai";

// Initialize Vertex AI with your Google Cloud project and location
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

if (!PROJECT_ID) {
  throw new Error("GOOGLE_CLOUD_PROJECT environment variable not set");
}

const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

// Get the generative model
const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
});

/**
 * Cleans the raw output from the Gemini API to extract only the MermaidJS code.
 * @param rawOutput The raw string response from the API.
 * @returns A string containing just the MermaidJS code.
 */
const cleanMermaidCode = (rawOutput: string): string => {
  // Remove markdown fences if they exist
  const cleaned = rawOutput.replace(/```mermaid/g, '').replace(/```/g, '');
  
  // Find the start of the graph definition
  const graphStartIndex = cleaned.search(/graph\s+(TD|LR|TB|RL|BT)/);

  if (graphStartIndex === -1) {
    // If no graph definition is found, return a fallback error diagram
    console.error("Could not find a valid Mermaid graph definition in the response.");
    return `
      graph TD
        A[Error] --> B(Could not generate diagram);
        B --> C{Please try a different URL or rephrase your request};
    `;
  }
  
  // Return the substring from the start of the graph definition
  return cleaned.substring(graphStartIndex).trim();
};


export const generateDiagram = async (repoUrl: string): Promise<string> => {
  const prompt = `
    You are an expert software architect. Analyze the public Git repository at the following URL: ${repoUrl}. 
    Based on its likely purpose and file structure, create a high-level architecture diagram in MermaidJS 'graph TD' format. 
    The diagram should illustrate the main components and their interactions.

    IMPORTANT INSTRUCTIONS:
    1. Your entire response must be ONLY the MermaidJS code, starting with 'graph TD'.
    2. Do not include any explanations, markdown fences (\`\`\`), or any other text.
    3. If a node's text contains special characters like parentheses (), slashes /, or brackets [], you MUST enclose the entire text in double quotes. For example, use C["Description with (details/path)"] instead of C[Description with (details/path)].
  `;

  try {
    const request = {
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
      }
    };

    const result = await model.generateContent(request);
    const response = await result.response;
    const rawCode = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawCode) {
      throw new Error("Received an empty response from the API.");
    }

    return cleanMermaidCode(rawCode);
  } catch (error) {
    console.error("Error generating diagram with Vertex AI:", error);
    throw new Error("Failed to generate the architecture diagram. Please check the repository URL and try again.");
  }
};