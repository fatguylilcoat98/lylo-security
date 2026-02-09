import React from 'react';

export default function Assessment() {

  const forceStart = () => {
    // 1. Set Default "Safe Mode" Values
    // This gives the AI something to read so it doesn't crash
    localStorage.setItem('lylo_calibration_hardware', 'iPhone, PC');
    localStorage.setItem('lylo_calibration_finances', 'PayPal, Bank');
    localStorage.setItem('lylo_tech_level', 'average');
    localStorage.setItem('lylo_personality', 'protective');
    
    // 2. Mark the assessment as COMPLETE
    localStorage.setItem('lylo_assessment_complete', 'true');

    // 3. FORCE the browser to go to the dashboard
    // We use window.location to bypass any React Router freezes
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      
      {/* LARGE ACTIVATION BUTTON */}
      <div className="mb-8 animate-in fade-in zoom-in duration-1000">
        <div className="text-6xl mb-4 animate-pulse">🛡️</div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-blue-500 mb-2">LYLO SYSTEM</h1>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Manual Override Active</p>
      </div>

      <button 
        onClick={forceStart}
        className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-3xl text-xl shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all active:scale-95 flex flex-col items-center gap-2"
      >
        <span>TAP TO ACTIVATE</span>
        <span className="text-[10px] opacity-70 font-normal uppercase tracking-[0.2em]">Enter The Vault</span>
      </button>

      <p className="mt-8 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
        By clicking, you accept the beta protocols.
      </p>

    </div>
  );
}
