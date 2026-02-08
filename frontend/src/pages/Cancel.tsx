import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function Cancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#02040a] text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-[#0b101b] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl text-center">
        
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-900/20 rounded-full border border-red-500/30">
            <ShieldAlert className="w-12 h-12 text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl font-black uppercase tracking-tighter italic mb-4">
          Vault Access <span className="text-red-500">Paused</span>
        </h1>
        
        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
          The checkout process was not completed. No charges were made, but your LYLO Truth Shield is currently limited to Basic Mode.
        </p>

        <button 
          onClick={() => navigate('/')}
          className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all border border-white/10 uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft size={14} /> Back to Protection Plans
        </button>
      </div>
    </div>
  );
}
