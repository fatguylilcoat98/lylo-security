import React from 'react';

export default function Assessment() {
  const forceStart = () => {
    // Set default safe values so the Chat has data to read
    localStorage.setItem('lylo_calibration_hardware', 'iPhone, PC');
    localStorage.setItem('lylo_calibration_finances', 'PayPal, Bank');
    localStorage.setItem('lylo_tech_level', 'average');
    localStorage.setItem('lylo_personality', 'protective');
    
    // Mark complete and Jump
    localStorage.setItem('lylo_assessment_complete', 'true');
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="mb-8">
        <div className="text-6xl mb-4 animate-pulse">🛡️</div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-blue-500 mb-2">LYLO SYSTEM</h1>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Manual Override Active</p>
      </div>

      <button 
        onClick={forceStart}
        className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-2xl text-xl shadow-lg transition-all active:scale-95"
      >
        TAP TO ACTIVATE
      </button>
      
      <p className="mt-8 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
        Beta Protocol: Bypassing calibration...
      </p>
    </div>
  );
}
