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

    if (!savedEmail) {
      window.location.href = '/assessment';
    }
  }, []);

  // Save persona changes
  useEffect(() => {
    localStorage.setItem('lylo_selected_persona', currentPersona);
  }, [currentPersona]);

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(75, Math.min(125, prev + delta)));
  };

  const handleUsageUpdate = () => {
    setUsageUpdateTrigger(prev => prev + 1);
  };

  const userName = userEmail ? userEmail.split('@')[0] : 'Commander';

  return (
    <Layout 
      currentPersona={currentPersona}
      onPersonaChange={setCurrentPersona}
      userEmail={userEmail}
      onUsageUpdate={handleUsageUpdate}
    >
      {/* UI PURGE: The Header is GONE. 
         We are passing the zoom controls down to the chat interface 
         so they can float inside the window instead of taking up space.
      */}
      <div className="flex-1 relative h-full" style={{ fontSize: `${zoomLevel}%` }}>
        <ChatInterface 
          currentPersona={currentPersonaConfig} 
          userEmail={userEmail}
          userName={userName}
          zoomLevel={zoomLevel}
          onZoomIn={() => adjustZoom(10)}
          onZoomOut={() => adjustZoom(-10)}
          onUsageUpdate={handleUsageUpdate}
        />
      </div>
    </Layout>
  );
}
