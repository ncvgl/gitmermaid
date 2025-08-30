import React, { useState, useEffect } from 'react';
import '../types'; // Ensures the global Mermaid type is available

interface DiagramDisplayProps {
  diagramCode: string;
}

const DiagramDisplay: React.FC<DiagramDisplayProps> = ({ diagramCode }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (diagramCode) {
      const renderDiagram = async () => {
        try {
          setError(null);
          setSvg(''); // Clear previous SVG
          const id = `mermaid-graph-${Date.now()}`;
          const result = await window.mermaid.render(id, diagramCode);
          setSvg(result.svg);
        } catch (e) {
          console.error("Mermaid rendering error:", e);
          setError("Failed to render the diagram. The generated code might be invalid.");
          setSvg(''); // Clear svg on error
        }
      };
      renderDiagram();
    }
  }, [diagramCode]);

  if (error) {
    return (
      <div className="w-full text-center text-red-700 bg-red-100 p-4 rounded-lg border border-red-400">
        <p><strong>Rendering Error</strong></p>
        <p>{error}</p>
      </div>
    );
  }

  if (svg) {
    // The container's styles are applied to center the SVG and handle its default styling
    return (
      <div 
        className="w-full flex justify-center items-center p-4"
        dangerouslySetInnerHTML={{ __html: svg }} 
      />
    );
  }

  return null; // Don't render anything if there's no code or SVG yet
};

export default DiagramDisplay;
