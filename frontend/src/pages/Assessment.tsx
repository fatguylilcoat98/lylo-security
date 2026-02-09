import React from 'react';

export default function Assessment() {

  const forceStart = () => {
    // 1. Set Default Data (so the AI knows who it's talking to)
    localStorage.setItem('lylo_calibration_hardware', 'iPhone, PC');
    localStorage.setItem('lylo_calibration_finances', 'PayPal, Bank');
    localStorage.setItem('lylo_tech_level', 'average');
    localStorage.setItem('lylo_personality', 'protective');
    
    // 2. Mark Assessment as Done
    localStorage.setItem('lylo_assessment_complete', 'true');

    // 3. HARD JUMP to the Dashboard (Bypasses any freezes)
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      
      <div className="mb-8 animate-pulse">
        <div className="text-6xl mb-4">🛡️</div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-blue-500 mb-2">LYLO SYSTEM</h1>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">System Online</p>
      </div>

      <button 
        onClick={forceStart}
        className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-3xl text-xl shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all"
      >
        TAP TO ACTIVATE
      </button>

      <p className="mt-8 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
        Click to enter the vault
      </p>

    </div>
  );
}
