import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react'; 

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [hardware, setHardware] = useState('');
  const [finances, setFinances] = useState('');
  const [techLevel, setTechLevel] = useState('average');
  const [personality, setPersonality] = useState('protective');

  const handleComplete = () => {
    setLoading(true);
    localStorage.setItem('lylo_calibration_hardware', hardware);
    localStorage.setItem('lylo_calibration_finances', finances);
    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_personality', personality);
    localStorage.setItem('lylo_assessment_complete', 'true');
    
    // THE JUMP: Bypasses the routing freeze
    setTimeout(() => {
      window.location.href = '/dashboard'; 
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 flex flex-col items-center justify-center font-['Inter']">
      
      <div className="mb-12 flex flex-col items-center gap-4 text-center">
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full animate-pulse"></div>
          <img src="lylo-sheild.png" alt="LYLO" className="w-20 h-20 object-contain relative z-10" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">Neural Calibration</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Syncing assistant mission & safety protocols</p>
        </div>
      </div>

      <div className="w-full max-w-lg bg-[#0b101b] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Icons.UserCheck className="text-blue-500" /> 01. Tech IQ Level
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'low', label: 'I struggle with tech', desc: 'LYLO will use simple words.' },
                { id: 'average', label: 'I know my way around', desc: 'Standard protection.' },
                { id: 'high', label: 'I am an expert', desc: 'Advanced data.' }
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
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]">
              Next Step <Icons.ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Icons.Brain className="text-purple-500" /> 02. Bodyguard Persona
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'gentle', icon: Icons.Heart, label: 'Gentle & Comforting', color: 'text-pink-400' },
                { id: 'funny', icon: Icons.Laugh, label: 'Funny & Humorous', color: 'text-yellow-400' },
                { id: 'smartass', icon: Icons.Zap, label: 'The Smartass', color: 'text-orange-400' },
                { id: 'protective', icon: Icons.Shield, label: 'Elite & Professional', color: 'text-blue-400' }
              ].map((p) => {
                const PersonaIcon = p.icon;
                return (
                  <button 
                    key={p.id}
                    onClick={() => setPersonality(p.id)}
                    className={`p-5 rounded-2xl border text-left flex items-center gap-4 transition-all ${personality === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-[#02040a]'}`}
                  >
                    <PersonaIcon className={p.color} size={24} />
                    <div className="font-bold text-sm uppercase tracking-widest">{p.label}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px]">Back</button>
                <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px]">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Icons.Cpu className="text-blue-500" /> 03. Hardware Inventory
              </h2>
              <textarea 
                value={hardware}
                onChange={(e) => setHardware(e.target.value)}
                placeholder="iPhone, Custom PC, etc..."
                className="w-full h-24 bg-[#02040a] border border-white/5 rounded-2xl p-5 text-white text-xs font-bold focus:border-blue-600 outline-none"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Icons.Wallet className="text-cyan-400" /> 04. Digital Wallet
              </h2>
              <textarea 
                value={finances}
                onChange={(e) => setFinances(e.target.value)}
                placeholder="Cash App, PayPal, Chase..."
                className="w-full h-24 bg-[#02040a] border border-white/5 rounded-2xl p-5 text-white text-xs font-bold focus:border-blue-600 outline-none"
              />
            </div>

            <button 
              disabled={loading}
              onClick={handleComplete} 
              className={`w-full ${loading ? 'bg-blue-900' : 'bg-blue-600'} text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20`}
            >
              {loading ? (
                <>Establishing Neural Link <Icons.Loader2 className="animate-spin" size={14} /></>
              ) : (
                <>Activate My Assistant <Icons.CheckCircle2 size={14} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
