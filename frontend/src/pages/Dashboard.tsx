import React, { useState, useEffect } from 'react';
import Layout, { personas } from '../components/Layout';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [userEmail, setUserEmail] = useState('');
  const [usageUpdateTrigger, setUsageUpdateTrigger] = useState(0);

  // Get the persona config object
  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];

  // Load user data
  useEffect(() => {
    const savedPersona = localStorage.getItem('lylo_selected_persona');
    const savedEmail = localStorage.getItem('lylo_user_email') || '';
    
    if (savedPersona && personas.find(p => p.id === savedPersona)) {
      setCurrentPersona(savedPersona);
    }
    
    setUserEmail(savedEmail);

    // Redirect to assessment if no email
    if (!savedEmail) {
      window.location.href = '/assessment';
    }
  }, []);

  // Save persona changes
  useEffect(() => {
    localStorage.setItem('lylo_selected_persona', currentPersona);
  }, [currentPersona]);

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(50, Math.min(150, prev + delta)));
  };

  const handleUsageUpdate = () => {
    setUsageUpdateTrigger(prev => prev + 1);
  };

  // Generate User Name
  const userName = userEmail ? userEmail.split('@')[0] : 'Commander';

  return (
    <Layout 
      currentPersona={currentPersona}
      onPersonaChange={setCurrentPersona}
      userEmail={userEmail}
      onUsageUpdate={handleUsageUpdate}
    >
      {/* Header with Controls */}
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

      {/* Chat Area */}
      <div className="flex-1 relative" style={{ fontSize: `${zoomLevel}%` }}>
        <ChatInterface 
          currentPersona={currentPersonaConfig} 
          userEmail={userEmail}
          zoomLevel={zoomLevel}
          onUsageUpdate={handleUsageUpdate}
          userName={userName}
        />
      </div>
    </Layout>
  );
}
