import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Copy, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Success() {
  const navigate = useNavigate();
  // We generate a "Simulated" unique code for them here
  const [accessCode] = useState(`LYLO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);

  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#06b6d4', '#ffffff']
    });
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(accessCode);
    alert("Access Code Copied! Use this on the login screen.");
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-[#0b101b] p-10 rounded-[2.5rem] border border-blue-500/30 shadow-2xl text-center">
        
        <div className="space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-blue-400" />
          </div>

          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Payment Verified</h1>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Your Access Code is Ready</p>
          </div>

          {/* THE CODE BOX */}
          <div className="p-6 bg-slate-950 rounded-2xl border border-white/5 space-y-3">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Your Private Vault Key</p>
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-blue-500/20">
              <span className="text-xl font-mono font-black text-white tracking-widest">{accessCode}</span>
              <button onClick={copyCode} className="text-blue-400 hover:text-white transition-colors">
                <Copy size={20} />
              </button>
            </div>
            <p className="text-[9px] text-slate-600 font-bold italic">Keep this safe. You will need it to enter the app.</p>
          </div>

          <button 
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px]"
          >
            Go to Login <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
