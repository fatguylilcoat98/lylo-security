import React, { useState, useEffect } from 'react';
import Layout, { personas } from '../components/Layout';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [userEmail, setUserEmail] = useState('');
  const [usageUpdateTrigger, setUsageUpdateTrigger] = useState(0);
  const [isElite, setIsElite] = useState(false); // Elite Tracking
  const [userName, setUserName] = useState('');
  
  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];
  
  useEffect(() => {
    const savedPersona = localStorage.getItem('lylo_selected_persona');
    const savedEmail = localStorage.getItem('lylo_user_email') || '';
    const eliteStatus = localStorage.getItem('isEliteUser') === 'true';
    const betaStatus = localStorage.getItem('isBetaTester') === 'true';
    const name = localStorage.getItem('lylo_user_name') || 'User';
    
    if (savedPersona && personas.find(p => p.id === savedPersona)) {
      setCurrentPersona(savedPersona);
    }
    
    setUserEmail(savedEmail);
    setIsElite(eliteStatus);
    setUserName(name);

    // GATEKEEPER
    if (!savedEmail || (!eliteStatus && !betaStatus)) {
      window.location.href = '/assessment';
    }
  }, []);
  
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
    localStorage.removeItem('lylo_user_email');
    localStorage.removeItem('lylo_selected_persona');
    localStorage.removeItem('isEliteUser');
    localStorage.removeItem('isBetaTester');
    localStorage.removeItem('lylo_user_name');
    window.location.href = '/';
  };

  if (!userEmail) return null;

  return (
    <Layout 
      currentPersona={currentPersona}
      onPersonaChange={setCurrentPersona}
      userEmail={userEmail}
      onUsageUpdate={handleUsageUpdate}
    >
      <div className="flex-1 relative h-full flex flex-col" style={{ fontSize: `${zoomLevel}%` }}>
        
        {/* ELITE RECOVERY BAR - SURGICAL ADDITION */}
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
