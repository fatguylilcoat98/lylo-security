import React, { useState, useEffect, Suspense } from 'react';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const [currentMission, setCurrentMission] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);

  // Simple authorization check
  useEffect(() => {
    const isComplete = localStorage.getItem('lylo_assessment_complete');
    if (isComplete !== 'true') {
      window.location.href = '/assessment';
    }
  }, []);

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-[#050505] z-50">
        <div className="text-xl font-bold text-blue-500 tracking-tighter italic">LYLO</div>
        <div className="flex gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
           <span>Vaules Secured</span>
           <span className="text-green-500 animate-pulse">● Online</span>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 relative" style={{ fontSize: `${zoomLevel}%` }}>
        <Suspense fallback={<div className="p-10 text-center text-blue-500 animate-pulse">LOADING VAULT...</div>}>
          <ChatInterface currentMission={currentMission} zoomLevel={zoomLevel} />
        </Suspense>
      </div>
    </div>
  );
}
