import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

interface MarkdownDisplayProps {
  content: string;
}

const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({ content }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  useEffect(() => {
    // Only initialize and render mermaid when in rendered mode
    if (viewMode !== 'rendered') return;

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
  }, [content, viewMode]);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    });
  };

  const components = {
    h1: ({ children }: any) => <h1 className="text-3xl font-bold mb-6 text-gray-900">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-900">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-xl font-semibold mb-3 mt-6 text-gray-900">{children}</h3>,
    p: ({ children }: any) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
    strong: ({ children }: any) => <strong className="font-semibold text-gray-900">{children}</strong>,
    ul: ({ children }: any) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
    li: ({ children }: any) => <li className="mb-2 text-gray-700">{children}</li>,
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

      if (inline) {
        return (
          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono" {...props}>
            {children}
          </code>
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
    <div className="w-full h-full bg-white overflow-hidden relative">
      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2">
        <button
          onClick={() => setViewMode(viewMode === 'rendered' ? 'raw' : 'rendered')}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
        >
          {viewMode === 'rendered' ? 'Show Raw' : 'Show Rendered'}
        </button>
        {viewMode === 'raw' && (
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            {copyButtonText}
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="w-full h-full p-6 overflow-auto">
        {viewMode === 'rendered' ? (
          <div className="max-w-none">
            <ReactMarkdown
              components={components}
              remarkPlugins={[remarkGfm]}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="text-left text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-md border">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
};

export default MarkdownDisplay;