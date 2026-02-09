import React from 'react';

export default function Assessment() {

  const forceStart = () => {
    // 1. Save Default Data
    localStorage.setItem('lylo_calibration_hardware', 'iPhone, PC');
    localStorage.setItem('lylo_calibration_finances', 'PayPal, Bank');
    localStorage.setItem('lylo_tech_level', 'average');
    localStorage.setItem('lylo_personality', 'protective');
    localStorage.setItem('lylo_assessment_complete', 'true');

    // 2. Hard Jump to Dashboard
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      
      <div className="mb-8 animate-pulse">
        <div className="text-6xl mb-4">🛡️</div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-blue-500 mb-2">LYLO SYSTEM</h1>
      </div>

      <button 
        onClick={forceStart}
        className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-3xl text-xl shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all"
      >
        TAP TO ACTIVATE
      </button>

      <p className="mt-8 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
        System Ready.
      </p>

    </div>
  );
}
