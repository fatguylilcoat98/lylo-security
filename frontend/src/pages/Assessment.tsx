import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Cpu, Wallet, UserCheck, Heart, Laugh, Brain, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Assessment() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  
  // State for Calibration
  const [hardware, setHardware] = useState('');
  const [finances, setFinances] = useState('');
  const [techLevel, setTechLevel] = useState('average'); // 'low', 'average', 'high'
  const [personality, setPersonality] = useState('protective'); // Default

  const handleComplete = () => {
    localStorage.setItem('lylo_calibration_hardware', hardware);
    localStorage.setItem('lylo_calibration_finances', finances);
    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_personality', personality);
    localStorage.setItem('lylo_assessment_complete', 'true');
    
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-white p-6 flex flex-col items-center justify-center">
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="p-3 bg-blue-600/20 border border-blue-500/40 rounded-full">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Setting up your Shield</h1>
      </div>

      <div className="w-full max-w-lg bg-[#0b101b] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        
        {/* STEP 1: TECH SAVVY CHECK */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <UserCheck className="text-blue-500" /> How comfortable are you with tech?
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'low', label: 'I struggle with tech', desc: 'LYLO will use simple words and slow down.' },
                { id: 'average', label: 'I know my way around', desc: 'Standard protection and alerts.' },
                { id: 'high', label: 'I am an expert', desc: 'Full technical breakdowns and data.' }
              ].map((t) => (
                <button 
                  key={t.id}
                  onClick={() => setTechLevel(t.id)}
                  className={`p-5 rounded-2xl border text-left transition-all ${techLevel === t.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-[#02040a]'}`}
                >
                  <div className="font-bold text-sm uppercase tracking-widest">{t.label}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px]">
              Next Step <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 2: PERSONALITY SELECTION */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Brain className="text-purple-500" /> Choose your Bodyguard
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'gentle', icon: Heart, label: 'Gentle & Patient', color: 'text-pink-400' },
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
                <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px]">Continue</button>
            </div>
          </div>
        )}

        {/* STEP 3: FINAL TECH/FINANCE INFO */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Cpu className="text-blue-500" /> Security Briefing
            </h2>
            <textarea 
              value={hardware}
              onChange={(e) => setHardware(e.target.value)}
              placeholder="List your Tech (e.g. Custom PC, iPhone...)"
              className="w-full h-24 bg-[#02040a] border border-white/5 rounded-2xl p-5 text-white text-xs font-bold uppercase focus:border-blue-600 outline-none transition-all placeholder:text-slate-800"
            />
            <textarea 
              value={finances}
              onChange={(e) => setFinances(e.target.value)}
              placeholder="List your Financial apps (e.g. Bitcoin, Chase...)"
              className="w-full h-24 bg-[#02040a] border border-white/5 rounded-2xl p-5 text-white text-xs font-bold uppercase focus:border-blue-600 outline-none transition-all placeholder:text-slate-800"
            />
            <button onClick={handleComplete} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px]">
              Activate Lylo <CheckCircle2 size={14} />
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-[9px] text-slate-700 font-bold uppercase tracking-[0.3em]">
          Anti-Thief Protocol • Privacy Locked
        </p>
      </div>
    </div>
  );
}
