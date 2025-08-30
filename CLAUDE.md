# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm install` - Install dependencies
- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Environment Setup
- Set `GEMINI_API_KEY` in `.env.local` file before running the app

## Architecture

This is a React + TypeScript application that generates Mermaid.js architecture diagrams from GitHub repository URLs using Google's Gemini AI.

### Key Components

**Frontend Architecture:**
- Single-page React app using Vite as the build tool
- Main component (`App.tsx`) handles state management for diagram generation
- `DiagramDisplay` component renders Mermaid.js diagrams
- Two-tab interface: "Diagram" view and "Mermaid Code" view

**Service Layer:**
- `geminiService.ts` handles all Gemini API interactions
- Uses Google's GenAI SDK (`@google/genai`)
- Cleans and validates Mermaid code output from AI responses

**Configuration:**
- TypeScript with ES2022 target and ESNext modules
- Path alias `@/` configured for project root imports
- Vite configured to inject `GEMINI_API_KEY` from environment

### Data Flow
1. User enters GitHub repository URL
2. App calls `generateDiagram()` in geminiService
3. Service sends prompt to Gemini API (gemini-2.5-flash model)
4. Response is cleaned to extract valid Mermaid.js code
5. Diagram is rendered using Mermaid.js library
6. User can view diagram or raw Mermaid code

### Important Notes
- No test framework currently configured
- Tailwind CSS classes are used inline (no separate config file)
- Mermaid.js is loaded via CDN in index.html
- Light theme configured with neutral color scheme