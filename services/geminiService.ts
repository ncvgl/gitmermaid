export const generateDiagram = async (repoUrl: string): Promise<string> => {
  try {
    const response = await fetch('http://localhost:3001/api/generate-diagram', {
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
    throw new Error("Failed to generate the architecture diagram. Please check the repository URL and try again.");
  }
};