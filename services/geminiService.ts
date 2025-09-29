// Use same origin for API calls when deployed, localhost for development
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : window.location.origin;

export const generateDiagram = async (repoUrl: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-diagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate diagram');
    }

    const data = await response.json();
    return data.diagramCode;
  } catch (error) {
    console.error("Error generating diagram:", error);

    // If it's an Error with a message that contains our timeout message, preserve it
    if (error instanceof Error && error.message.includes("repository is too large")) {
      throw error;
    }

    throw new Error("Failed to generate the architecture diagram. Please check the repository URL and try again.");
  }
};