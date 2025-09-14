import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

interface MarkdownDisplayProps {
  content: string;
}

const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({ content }) => {
  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      fontFamily: '"Inter", sans-serif',
      suppressErrorRendering: true,
      logLevel: 1,
      themeVariables: {
        background: '#ffffff',
        primaryColor: '#f3f4f6',
        primaryTextColor: '#111827',
        primaryBorderColor: '#e5e7eb',
        lineColor: '#6b7280',
        secondaryColor: '#f9fafb',
        tertiaryColor: '#f3f4f6'
      }
    });

    // Render all mermaid diagrams after component mounts/updates
    const renderMermaidDiagrams = async () => {
      const mermaidElements = document.querySelectorAll('.mermaid');
      mermaidElements.forEach(async (element, index) => {
        try {
          const graphDefinition = element.textContent || '';
          const id = `mermaid-diagram-${Date.now()}-${index}`;
          const { svg } = await mermaid.render(id, graphDefinition);
          element.innerHTML = svg;
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          element.innerHTML = '<div class="text-red-600 p-4 border border-red-300 rounded">Error rendering diagram</div>';
        }
      });
    };

    // Small delay to ensure DOM is ready
    setTimeout(renderMermaidDiagrams, 100);
  }, [content]);

  const components = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && language === 'mermaid') {
        return (
          <div className="my-6">
            <div className="mermaid bg-white p-4 rounded-lg border border-gray-200 text-center">
              {String(children).replace(/\n$/, '')}
            </div>
          </div>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="w-full h-full p-6 bg-white overflow-auto">
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          components={components}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownDisplay;