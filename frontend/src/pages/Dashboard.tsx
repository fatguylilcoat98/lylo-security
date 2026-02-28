import React, { useState, useEffect } from 'react';
import Layout, { personas, PersonaConfig } from '../components/Layout';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [userEmail,  setUserEmail]  = useState('');
  const [userTier,   setUserTier]   = useState('free');
  const [userName,   setUserName]   = useState('');
  const [fontSize,   setFontSize]   = useState(16);

  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];

  useEffect(() => {
    const savedEmail   = localStorage.getItem('userEmail');
    const savedTier    = localStorage.getItem('userTier') as any || 'free';
    const savedName    = localStorage.getItem('userName') || 'User';
    const savedPersona = localStorage.getItem('lylo_selected_persona');
    const isComplete   = localStorage.getItem('lylo_assessment_complete');

    if (!savedEmail || !isComplete) { window.location.href = '/'; return; }

    setUserEmail(savedEmail);
    setUserName(savedName);
    setUserTier(savedTier);

    if (savedPersona && personas.find(p => p.id === savedPersona)) {
      setCurrentPersona(savedPersona);
    }
  }, []);

  useEffect(() => {
    if (currentPersona) localStorage.setItem('lylo_selected_persona', currentPersona);
  }, [currentPersona]);

  const handlePersonaChange = (persona: PersonaConfig) => setCurrentPersona(persona.id);
  const handleLogout = () => { localStorage.clear(); window.location.href = '/'; };

  if (!userEmail) return null;

  return (
    <Layout
      currentPersona={currentPersonaConfig}
      onPersonaChange={handlePersonaChange}
      userEmail={userEmail}
      fontSize={fontSize}
      onFontSizeChange={setFontSize}
    >
      <div className="flex-1 relative h-full flex flex-col">

        {/* MAX tier bar */}
        {userTier === 'max' && (
          <div className="p-4 bg-purple-900/20 border-b border-purple-500/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
                <span className="text-white text-[10px] font-black uppercase italic">MAX</span>
              </div>
              <div className="text-[10px] text-purple-300 font-black uppercase tracking-[0.2em]">
                Unlimited Protection Active: {userName}
              </div>
            </div>
            <a href="mailto:mylylo.ai@gmail.com?subject=MAX Tier Priority Legal Request"
              className="text-[9px] bg-purple-600 text-white px-4 py-2 font-black rounded-sm uppercase tracking-widest hover:bg-purple-500 transition-all">
              Contact Priority Legal Team
            </a>
          </div>
        )}

        {/* ELITE tier bar */}
        {userTier === 'elite' && (
          <div className="p-4 bg-blue-600/10 border-b border-blue-600/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white text-[10px] font-black uppercase italic">Elite</span>
              </div>
              <div className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">
                Recovery Protocol Active: {userName}
              </div>
            </div>
            <a href="mailto:mylylo.ai@gmail.com?subject=Elite Legal Recovery Request"
              className="text-[9px] bg-blue-600 text-white px-4 py-2 font-black rounded-sm uppercase tracking-widest hover:bg-blue-500 transition-all">
              Connect with Legal Counsel
            </a>
          </div>
        )}

        {/* ── FIXED: renamed currentPersonaId→currentPersona, onSignOut→onLogout ── */}
        <ChatInterface
          userEmail={userEmail}
          userTier={userTier}
          currentPersona={currentPersonaConfig}
          onLogout={handleLogout}
          onPersonaChange={handlePersonaChange}
        />
      </div>
    </Layout>
  );
}
