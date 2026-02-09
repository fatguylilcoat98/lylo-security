import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface'; 

export default function Dashboard() {
  const [currentMission, setCurrentMission] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);

  // 1. Force the page to scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden font-sans">
      
      {/* SIMPLE HEADER */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-[#050505] z-50">
        <div className="text-xl font-bold text-blue-500 tracking-tighter italic">LYLO</div>
        <div className="flex gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest items-center">
           <span>Vault Secure</span>
           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        </div>
      </header>

      {/* CHAT AREA - No "Suspense" or "Lazy" loading to crash the app */}
      <div className="flex-1 relative" style={{ fontSize: `${zoomLevel}%` }}>
        <ChatInterface currentMission={currentMission} zoomLevel={zoomLevel} />
      </div>

    </div>
  );
}
