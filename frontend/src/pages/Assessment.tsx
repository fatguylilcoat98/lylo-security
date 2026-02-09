import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react'; // This is the "Safety Version"

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  // Calibration Data Points
  const [hardware, setHardware] = useState('');
  const [finances, setFinances] = useState('');
  const [techLevel, setTechLevel] = useState('average');
  const [personality, setPersonality] = useState('protective');

  const handleComplete = () => {
    setLoading(true);

    // 1. Lock the data into the browser's hard memory
    localStorage.setItem('lylo_calibration_hardware', hardware);
    localStorage.setItem('lylo_calibration_finances', finances);
    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_personality', personality);
    localStorage.setItem('lylo_assessment_complete', 'true');
    
    // 2. THE SLEDGEHAMMER FIX: 
    // Instead of using 'navigate', we force the browser to reload the Dashboard.
    // This clears any "hangups" and forces the new UI to appear.
    setTimeout(() => {
      window.location.href = '/dashboard'; 
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 flex flex-col items-center justify-center font-['Inter']">
      
      {/* --- ELITE BRANDING --- */}
      <div className="mb-12 flex flex-col items-center gap-4 text-center">
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full animate-pulse"></div>
          <img 
            src="lylo-sheild.png" 
            alt="LYLO" 
            className="w-20 h-20 object-contain relative z-10"
          />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">Neural Calibration</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Syncing assistant mission & safety protocols</p>
        </div>
      </div>

      <div className="w-full max-w-lg bg-[#0b101b] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        
        {/* STEP 1: TECH IQ */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <UserCheck className="text-blue-500" /> 01. Tech IQ Level
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'low', label: 'I struggle with tech', desc: 'LYLO will use simple words and explain everything like family.' },
                { id: 'average', label: 'I know my way around', desc: 'Standard protection with clear, helpful alerts.' },
                { id: 'high', label: 'I am an expert', desc: 'Detailed technical breakdowns and advanced data.' }
              ].map((t) => (
                <button 
                  key={t.id}
                  onClick={() => setTechLevel(t.id)}
                  className={`p-5 rounded-2xl border text-left transition-all ${techLevel === t.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-[#02040a]'}`}
                >
                  <div className="font-bold text-sm uppercase tracking-widest">{t.label}</div>
                  <div className="text-[10px] text-slate-600 font-bold uppercase mt-1 leading-relaxed">{t.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20">
              Next Step <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 2: PERSONALITY */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Brain className="text-purple-500" /> 02. Bodyguard Persona
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'gentle', icon: Heart, label: 'Gentle & Comforting', color: 'text-pink-400' },
                { id: 'funny', icon: Laugh, label: 'Funny & Humorous', color: 'text-yellow-400' },
                { id: 'smartass', icon: Zap, label: 'The Smartass', color: 'text-orange-400' },
                { id: 'protective', icon: Shield, label: 'Elite & Professional', color: 'text-blue-400' }
              ].map((p) => (
                <button 
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`p-5 rounded-2xl border text-left flex items-center gap-4 transition-all ${personality === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-[#02040a]'}`}
                >
                  <p.icon className={p.color} size={24} />
                  <div className="font-bold text-sm uppercase tracking-widest">{p.label}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px]">Back</button>
                <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20">Continue</button>
            </div>
          </div>
        )}

        {/* STEP 3: DATA VAULT */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Cpu className="text-blue-500" /> 03. Hardware Inventory
              </h2>
              <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest leading-none">Scanning for devices: iPhone, PC, Xbox, etc.</p>
              <textarea 
                value={hardware}
                onChange={(e) => setHardware(e.target.value)}
                placeholder="e.g. iPhone 15, Custom Gaming PC, Modded Xbox 360..."
                className="w-full h-24 bg-[#02040a] border border-white/5 rounded-2xl p-5 text-white text-xs font-bold focus:border-blue-600 outline-none transition-all placeholder:text-slate-800"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Wallet className="text-cyan-400" /> 04. Digital Wallet
              </h2>
              <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest leading-none">Protecting: Cash App (Bitcoin), PayPal, Chase...</p>
              <textarea 
                value={finances}
                onChange={(e) => setFinances(e.target.value)}
                placeholder="e.g. Cash App (Bitcoin), PayPal, Chase Bank..."
                className="w-full h-24 bg-[#02040a] border border-white/5 rounded-2xl p-5 text-white text-xs font-bold focus:border-blue-600 outline-none transition-all placeholder:text-slate-800"
              />
            </div>

            <button 
              disabled={loading}
              onClick={handleComplete} 
              className={`w-full ${loading ? 'bg-blue-900' : 'bg-blue-600 hover:bg-blue-500'} text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20`}
            >
              {loading ? (
                <>Establishing Neural Link <Loader2 className="animate-spin" size={14} /></>
              ) : (
                <>Activate My Assistant <CheckCircle2 size={14} /></>
              )}
            </button>
          </div>
        )}

        <div className="mt-8 flex justify-between items-center px-2">
           <p className="text-[9px] text-slate-800 font-bold uppercase tracking-[0.3em]">Privacy Locked</p>
           <p className="text-[9px] text-slate-800 font-bold uppercase tracking-[0.3em]">Vault Secure</p>
        </div>
      </div>
    </div>
  );
}
