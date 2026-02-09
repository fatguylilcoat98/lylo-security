import React, { useState, useEffect, Suspense, lazy } from 'react';
import Layout, { personas, PersonaConfig } from '../components/Layout';

// Lazy load ChatInterface to prevent blocking
const ChatInterface = lazy(() => import('../components/ChatInterface'));

export default function Dashboard() {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);

  // Get the persona config object
  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];

  // Force scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load saved persona from localStorage
  useEffect(() => {
    const savedPersona = localStorage.getItem('lylo_selected_persona');
    if (savedPersona && personas.find(p => p.id === savedPersona)) {
      setCurrentPersona(savedPersona);
    }
  }, []);

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(50, Math.min(150, prev + delta)));
  };

  return (
    <Layout 
      currentPersona={currentPersona}
      onPersonaChange={setCurrentPersona}
    >
      {/* Header with Persona Info */}
      <div className="p-4 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold text-white">
              Active: <span className="text-cyan-400">{currentPersonaConfig.name}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 px-3 py-2">
              <button
                onClick={() => adjustZoom(-10)}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded transition-all"
              >
                A-
              </button>
              <span className="text-xs text-gray-300 min-w-[3rem] text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => adjustZoom(10)}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded transition-all"
              >
                A+
              </button>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Neural Link Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area with Suspense */}
      <div className="flex-1 relative" style={{ fontSize: `${zoomLevel}%` }}>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 animate-pulse" />
              <div className="text-cyan-400 text-sm animate-pulse">Initializing LYLO Systems...</div>
            </div>
          </div>
        }>
          <ChatInterface 
            currentPersona={currentPersonaConfig} 
            zoomLevel={zoomLevel} 
          />
        </Suspense>
      </div>
    </Layout>
  );
}
