import React, { useState, useEffect } from 'react';
import Layout, { personas } from '../components/Layout';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [userEmail, setUserEmail] = useState('');
  const [usageUpdateTrigger, setUsageUpdateTrigger] = useState(0);
  const [isElite, setIsElite] = useState(false); 
  const [userName, setUserName] = useState('');
  
  // This finds the full persona configuration (colors, logic, etc.)
  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];
  
  useEffect(() => {
    // 1. Retrieve the data saved by App.tsx
    // We check both new keys and old keys just to be safe
    const savedEmail = localStorage.getItem('userEmail') || localStorage.getItem('lylo_user_email');
    const savedTier = localStorage.getItem('userTier') || 'free';
    const savedName = localStorage.getItem('userName') || localStorage.getItem('lylo_user_name') || 'User';
    const savedPersona = localStorage.getItem('lylo_selected_persona');

    // 2. Gatekeeper: If they aren't logged in, kick them back to the Home Page
    if (!savedEmail) {
      window.location.href = '/'; 
      return;
    }

    // 3. Set State
    setUserEmail(savedEmail);
    setUserName(savedName);
    
    // Determine Elite Status based on the Tier
    // Elite AND Max users get the recovery bar
    const eliteStatus = savedTier === 'elite' || savedTier === 'max' || localStorage.getItem('isEliteUser') === 'true';
    setIsElite(eliteStatus);

    // Restore Persona if they had one selected
    if (savedPersona && personas.find(p => p.id === savedPersona)) {
      setCurrentPersona(savedPersona);
    }
  }, []);
  
  // Save persona whenever it changes
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
    // Clear all data to ensure a clean logout
    localStorage.clear();
    // Send them back to the landing page
    window.location.href = '/';
  };

  if (!userEmail) return null; // Wait for load

  return (
    <Layout 
      currentPersona={currentPersonaConfig} 
      onPersonaChange={handlePersonaChange} 
      userEmail={userEmail}
      onUsageUpdate={handleUsageUpdate}
    >
      <div className="flex-1 relative h-full flex flex-col" style={{ fontSize: `${zoomLevel}%` }}>
        
        {/* ELITE/MAX RECOVERY BAR */}
        {isElite && (
          <div className="p-4 bg-blue-600/10 border-b border-blue-600/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <span className="text-white text-[10px] font-black uppercase tracking-tighter italic">Elite</span>
               </div>
               <div className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">
                 Recovery Protocol Active: Monitoring for {userName}
               </div>
            </div>
            <a 
              href="mailto:mylylo.ai@gmail.com?subject=Elite Legal Recovery Request" 
              className="text-[9px] bg-blue-600 text-white px-4 py-2 font-black rounded-sm uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
            >
              Connect with Legal Counsel
            </a>
          </div>
        )}

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
