
import React, { useState, useEffect, useCallback } from 'react';
import { generateDiagram } from './services/geminiService';
import MarkdownDisplay from './components/MarkdownDisplay';
import './types';
import sentences from './sentences.json';
import mockData from './mock_data.md?raw';

// Custom hook for typewriter effect
const useTypewriter = (text: string, speed: number = 50) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      return;
    }

    setIsTyping(true);
    setDisplayedText('');
    let currentIndex = 0;

    const timer = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayedText, isTyping };
};

// SVG Icon for the header, updated for the light theme
const LogoIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3L18 3" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 21L18 21" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3V7.5M12 16.5V21" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 7.5L16 12L12 16.5L8 12L12 7.5Z" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


// Development mode flag - set to true to use mock data
const USE_MOCK_DATA = true;

// Main Application Component
const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/ncvgl/gitmermaid');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSentence, setCurrentSentence] = useState<string>('');
  const [loadingSeconds, setLoadingSeconds] = useState<number>(0);
  const { displayedText: typewriterText, isTyping } = useTypewriter(currentSentence, 30);

  useEffect(() => {
    // Initialize Mermaid.js on component mount with a light theme
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral', // A clean, light theme
        fontFamily: '"Inter", sans-serif',
        suppressErrorRendering: true, // Prevent Mermaid from showing error UI
        logLevel: 1, // Reduce console logging (1=fatal only)
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

  // Handle sentence rotation during loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let usedSentences: number[] = [];
    
    if (isLoading) {
      // Set initial random sentence
      const getRandomSentence = () => {
        if (usedSentences.length >= sentences.length) {
          usedSentences = []; // Reset when all sentences have been used
        }
        
        let availableIndices = sentences
          .map((_, index) => index)
          .filter(index => !usedSentences.includes(index));
        
        const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        usedSentences.push(randomIndex);
        return sentences[randomIndex];
      };
      
      setCurrentSentence(getRandomSentence());
      
      // Rotate sentences every 6 seconds (giving time for typewriter effect)
      interval = setInterval(() => {
        setCurrentSentence(getRandomSentence());
      }, 6000);
    } else {
      setCurrentSentence('');
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);

  // Handle loading seconds counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLoading) {
      setLoadingSeconds(1); // Start at 1 second
      
      interval = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);

  const handleGenerateClick = useCallback(async () => {
    if (!repoUrl) {
      setError("Please enter a repository URL.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setMarkdownContent('');

    try {
      if (USE_MOCK_DATA) {
        // Use mock data for development
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate loading time
        setMarkdownContent(mockData);
      } else {
        const content = await generateDiagram(repoUrl);
        setMarkdownContent(content);
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [repoUrl]);
  

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
          Enter a public Git repository URL and let AI generate high-level architecture diagrams for you.
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

        {/* Diagram Area */}
        <main className="w-full bg-white border border-gray-200 rounded-lg shadow-sm min-h-[500px] transition-all duration-300 overflow-hidden">
          {!isLoading && !markdownContent && (
            <div className="flex justify-center items-center h-full min-h-[500px]">
              <div className="text-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-xl font-semibold">Your Architecture Analysis Awaits</h2>
                <p>The generated architecture diagrams and analysis will appear here.</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center h-full min-h-[500px]">
              <div className="text-center text-gray-600">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold">Analyzing Repository... {loadingSeconds}s</h2>
                <p className="mb-3">AI is crafting your diagram. This may take a moment.</p>
                {typewriterText && (
                  <p className="text-sm text-gray-500 italic min-h-[20px]">
                    {typewriterText}
                    {isTyping && <span className="animate-pulse">|</span>}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {!isLoading && markdownContent && (
            <MarkdownDisplay content={markdownContent} />
          )}
        </main>
        
        <footer className="text-center text-gray-500 mt-10 text-sm">
          <p>Powered by Gemini, Mermaid.js, <a href="https://ncvgl.github.io" target="_blank">ncvgl.github.io</a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
