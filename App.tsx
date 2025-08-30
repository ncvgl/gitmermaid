
import React, { useState, useEffect, useCallback } from 'react';
import { generateDiagram } from './services/geminiService';
import DiagramDisplay from './components/DiagramDisplay';
import './types';

// SVG Icon for the header, updated for the light theme
const LogoIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3L18 3" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 21L18 21" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3V7.5M12 16.5V21" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 7.5L16 12L12 16.5L8 12L12 7.5Z" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type Tab = 'diagram' | 'code';

// Main Application Component
const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/facebook/react');
  const [diagramCode, setDiagramCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('diagram');
  const [copyButtonText, setCopyButtonText] = useState('Copy');

  useEffect(() => {
    // Initialize Mermaid.js on component mount with a light theme
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral', // A clean, light theme
        fontFamily: '"Inter", sans-serif',
        themeVariables: {
            background: '#ffffff', // bg-white
            primaryColor: '#f3f4f6', // bg-gray-100
            primaryTextColor: '#111827', // text-gray-900
            primaryBorderColor: '#e5e7eb', // border-gray-200
            lineColor: '#6b7280', // text-gray-500
            secondaryColor: '#f9fafb', // bg-gray-50
            tertiaryColor: '#f3f4f6'
        }
      });
    }
  }, []);

  const handleGenerateClick = useCallback(async () => {
    if (!repoUrl) {
      setError("Please enter a repository URL.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setDiagramCode('');
    setActiveTab('diagram'); // Reset to diagram view on new generation

    try {
      const code = await generateDiagram(repoUrl);
      setDiagramCode(code);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [repoUrl]);
  
  const handleCopyCode = useCallback(() => {
    if (diagramCode) {
      navigator.clipboard.writeText(diagramCode).then(() => {
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
      });
    }
  }, [diagramCode]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans antialiased p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="flex items-center justify-center space-x-3 mb-8 text-center">
          <LogoIcon />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800">
            GitMermaid
          </h1>
        </header>

        <p className="text-center text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Enter a public Git repository URL and let AI generate a high-level architecture diagram for you.
        </p>

        {/* Input Form */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-10">
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="e.g., https://github.com/vercel/next.js"
            disabled={isLoading}
            className="flex-grow bg-white border border-gray-300 rounded-md px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow disabled:opacity-50"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateClick()}
          />
          <button
            onClick={handleGenerateClick}
            disabled={isLoading}
            className="bg-green-600 text-white font-semibold rounded-md px-6 py-3 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-green-500 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : "Generate Diagram"}
          </button>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="max-w-2xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-8 text-center">
            {error}
          </div>
        )}
        
        {/* Tabs - Only show when there is diagram code */}
        {!isLoading && diagramCode && (
          <div className="mb-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('diagram')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'diagram' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }
              >
                Diagram
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'code' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }
              >
                Mermaid Code
              </button>
            </nav>
          </div>
        )}

        {/* Diagram Area */}
        <main className="w-full bg-white border border-gray-200 rounded-lg shadow-sm min-h-[500px] flex justify-center items-center p-4 sm:p-8 transition-all duration-300">
          {!isLoading && !diagramCode && (
            <div className="text-center text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-xl font-semibold">Your Diagram Awaits</h2>
              <p>The generated architecture diagram will appear here.</p>
            </div>
          )}

          {isLoading && (
            <div className="text-center text-gray-600">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold">Analyzing Repository...</h2>
              <p>AI is crafting your diagram. This may take a moment.</p>
            </div>
          )}
          
          {!isLoading && diagramCode && (
            <div className="w-full h-full">
              {activeTab === 'diagram' && <DiagramDisplay diagramCode={diagramCode} />}
              {activeTab === 'code' && (
                <div className="relative w-full h-full bg-gray-900 rounded-md">
                  <pre className="text-left text-sm text-gray-200 p-4 overflow-auto">
                    <code>{diagramCode}</code>
                  </pre>
                  <button 
                    onClick={handleCopyCode}
                    className="absolute top-3 right-3 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold py-1 px-3 rounded-md transition-colors"
                    aria-label="Copy mermaid code"
                  >
                    {copyButtonText}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
        
        <footer className="text-center text-gray-500 mt-10 text-sm">
          <p>Powered by Google Gemini & Mermaid.js</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
