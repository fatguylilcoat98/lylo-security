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
  
  // SECURITY CHECK & LOADING
  useEffect(() => {
    const savedPersona = localStorage.getItem('lylo_selected_persona');
    const savedEmail = localStorage.getItem('lylo_user_email') || '';
    
    // Check for VIP/Beta access stamps
    const isElite = localStorage.getItem('isEliteUser') === 'true';
    const isBeta = localStorage.getItem('isBetaTester') === 'true';
    
    // Set Persona if it exists
    if (savedPersona && personas.find(p => p.id === savedPersona)) {
      setCurrentPersona(savedPersona);
    }
    
    setUserEmail(savedEmail);

    // THE GATEKEEPER: If no email OR not authorized, kick them to Assessment/Login
    if (!savedEmail || (!isElite && !isBeta)) {
      console.warn("Unauthorized access. Redirecting to onboarding.");
      window.location.href = '/assessment';
    }
  }, []);
  
  // Save persona changes to local storage
  useEffect(() => {
    if (currentPersona) {
      localStorage.setItem('lylo_selected_persona', currentPersona);
    }
  }, [currentPersona]);
  
  const handleUsageUpdate = () => {
    setUsageUpdateTrigger(prev => prev + 1);
  };

  const handlePersonaChange = (persona: any) => {
    setCurrentPersona(persona.id);
  };

  const handleLogout = () => {
    // Clean out ALL storage on logout
    localStorage.removeItem('lylo_user_email');
    localStorage.removeItem('lylo_selected_persona');
    localStorage.removeItem('isEliteUser');
    localStorage.removeItem('isBetaTester');
    window.location.href = '/';
  };

  // If we don't have an email yet, don't show the UI (prevents the "flicker")
  if (!userEmail) return null;

  return (
    <Layout 
      currentPersona={currentPersona}
      onPersonaChange={setCurrentPersona}
      userEmail={userEmail}
      onUsageUpdate={handleUsageUpdate}
    >
      <div className="flex-1 relative h-full" style={{ fontSize: `${zoomLevel}%` }}>
        <ChatInterface 
          currentPersona={currentPersonaConfig} 
          userEmail={userEmail}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          onPersonaChange={handlePersonaChange}
          onLogout={handleLogout}
          onUsageUpdate={handleUsageUpdate}
        />
      </div>
    </Layout>
  );
}
