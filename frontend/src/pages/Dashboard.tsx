import React, { useState, useEffect } from 'react';
import Layout, { personas, PersonaConfig } from '../components/Layout';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [userEmail, setUserEmail] = useState('');
  const [userTier, setUserTier] = useState('free'); // Added state for Tier
  const [userName, setUserName] = useState('');
  
  // This finds the full persona configuration (colors, logic, etc.)
  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];
  
  useEffect(() => {
    // 1. Retrieve the data saved by the Website Login
    const savedEmail = localStorage.getItem('userEmail');
    const savedTier = localStorage.getItem('userTier') as any || 'free';
    const savedName = localStorage.getItem('userName') || 'User';
    const savedPersona = localStorage.getItem('lylo_selected_persona');
    const isComplete = localStorage.getItem('lylo_assessment_complete');

    // 2. Gatekeeper: If not logged in or hasn't passed assessment, kick to Home
    if (!savedEmail || !isComplete) {
      window.location.href = '/'; 
      return;
    }

    // 3. Set State
    setUserEmail(savedEmail);
    setUserName(savedName);
    setUserTier(savedTier); // Store the actual tier (max, elite, or free)

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
    // Trigger re-fetch of usage stats if needed
  };

  const handlePersonaChange = (persona: PersonaConfig) => {
    setCurrentPersona(persona.id);
  };

  const handleLogout = () => {
    localStorage.clear();
    // Redirect back to the main marketing site root
    window.location.href = '/';
  };

  if (!userEmail) return null; 

  return (
    <Layout 
      currentPersona={currentPersonaConfig} 
      onPersonaChange={handlePersonaChange} 
      userEmail={userEmail}
      onUsageUpdate={handleUsageUpdate}
    >
      <div className="flex-1 relative h-full flex flex-col" style={{ fontSize: `${zoomLevel}%` }}>
        
        {/* --- MAX TIER BAR (PURPLE) --- */}
        {userTier === 'max' && (
          <div className="p-4 bg-purple-900/20 border-b border-purple-500/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
                  <span className="text-white text-[10px] font-black uppercase tracking-tighter italic">MAX</span>
               </div>
               <div className="text-[10px] text-purple-300 font-black uppercase tracking-[0.2em]">
                 Unlimited Protection Active: {userName}
               </div>
            </div>
            <a 
              href="mailto:mylylo.ai@gmail.com?subject=MAX Tier Priority Legal Request" 
              className="text-[9px] bg-purple-600 text-white px-4 py-2 font-black rounded-sm uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/20"
            >
              Contact Priority Legal Team
            </a>
          </div>
        )}

        {/* --- ELITE TIER BAR (BLUE/GOLD) - Only shows if Elite but NOT Max --- */}
        {userTier === 'elite' && (
          <div className="p-4 bg-blue-600/10 border-b border-blue-600/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <span className="text-white text-[10px] font-black uppercase tracking-tighter italic">Elite</span>
               </div>
               <div className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">
                 Recovery Protocol Active: {userName}
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
          currentPersona={currentPersonaConfig as any} 
          userEmail={userEmail}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          onPersonaChange={handlePersonaChange as any}
          onLogout={handleLogout}
          onUsageUpdate={handleUsageUpdate}
        />
      </div>
    </Layout>
  );
}
