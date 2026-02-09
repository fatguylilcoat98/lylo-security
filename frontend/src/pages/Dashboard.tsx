import React, { useState, useEffect, Suspense, lazy } from 'react';

// Lazy load ChatInterface to prevent blocking
const ChatInterface = lazy(() => import('../components/ChatInterface'));

export default function Dashboard() {
  const [currentMission, setCurrentMission] = useState('guardian');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const missions = [
    { id: 'guardian', name: 'Guardian', icon: '🛡️', desc: 'Scam & threat protection' },
    { id: 'chef', name: 'Chef', icon: '👨‍🍳', desc: 'Cooking & recipes' },
    { id: 'tech', name: 'Tech', icon: '💻', desc: 'PC building & troubleshooting' },
    { id: 'legal', name: 'Legal', icon: '⚖️', desc: 'Contracts & advice' }
  ];

  // Force scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(50, Math.min(150, prev + delta)));
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-[#0a0a0a] border-r border-white/10 transition-all duration-300 flex flex-col`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 text-blue-500 hover:text-blue-400 transition-colors"
          >
            <span className="text-xl">☰</span>
            {sidebarOpen && <span className="font-bold italic">LYLO</span>}
          </button>
        </div>

        {/* Mission Selector */}
        <div className="flex-1 p-2 space-y-2">
          {missions.map(mission => (
            <button
              key={mission.id}
              onClick={() => setCurrentMission(mission.id)}
              className={`w-full p-3 rounded-xl transition-all text-left ${
                currentMission === mission.id 
                  ? 'bg-blue-600 border-blue-400' 
                  : 'bg-[#111] hover:bg-[#1a1a1a] border-white/10'
              } border`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{mission.icon}</span>
                {sidebarOpen && (
                  <div>
                    <div className="font-bold text-sm">{mission.name}</div>
                    <div className="text-xs text-gray-400">{mission.desc}</div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        {sidebarOpen && (
          <div className="p-4 border-t border-white/10">
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Font Size</div>
            <div className="flex gap-2">
              <button
                onClick={() => adjustZoom(-10)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded-lg transition-all"
              >
                A-
              </button>
              <div className="flex-1 text-center text-xs py-2 text-gray-300">
                {zoomLevel}%
              </div>
              <button
                onClick={() => adjustZoom(10)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded-lg transition-all"
              >
                A+
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        
        {/* Header Status Bar */}
        <header className="flex items-center justify-between p-4 border-b border-white/10 bg-[#050505] z-50">
          <div className="flex items-center gap-4">
            <div className="text-xl font-bold text-blue-500 tracking-tighter italic">
              LYLO
            </div>
            <div className="text-sm text-gray-400 capitalize">
              {missions.find(m => m.id === currentMission)?.name} Mode
            </div>
          </div>
          
          <div className="flex gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest items-center">
            <span>Vault: Secure</span>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Neural Link: Active</span>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          </div>
        </header>

        {/* Chat Area with Suspense */}
        <div className="flex-1 relative" style={{ fontSize: `${zoomLevel}%` }}>
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4 animate-pulse">🛡️</div>
                <div className="text-blue-500 text-sm animate-pulse">Initializing LYLO Systems...</div>
              </div>
            </div>
          }>
            <ChatInterface currentMission={currentMission} zoomLevel={zoomLevel} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
