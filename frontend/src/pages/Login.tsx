import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && code.trim()) {
      // This is where we will add the "Lock to Email" logic next
      localStorage.setItem('lylo_user', email); 
      navigate('/assessment');
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-white p-6 font-sans flex flex-col items-center justify-center">
      
      {/* --- PRO SHIELD LOGO --- */}
      <div className="mb-12 flex flex-col items-center gap-4">
        <div className="p-4 bg-blue-600 rounded-2xl shadow-2xl shadow-blue-900/40">
          <Shield className="w-12 h-12 text-white" fill="currentColor" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tighter italic uppercase">LYLO<span className="text-blue-500">.</span>PRO</h1>
          <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.4em]">Truth Shield Active</p>
        </div>
      </div>

      {/* --- LOGIN CARD --- */}
      <div className="w-full max-w-md bg-[#0b101b] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-8 relative z-10">
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">Vault Access</h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Secure Nationwide Connection</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          {/* EMAIL FIELD */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="YOUR EMAIL"
              className="w-full bg-[#02040a] border border-white/5 rounded-2xl py-5 pl-12 pr-4 text-white text-xs font-bold tracking-widest focus:outline-none focus:border-blue-600 transition-all placeholder:text-slate-800"
            />
          </div>

          {/* ACCESS CODE FIELD */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="password"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ENTER ACCESS CODE"
              className="w-full bg-[#02040a] border border-white/5 rounded-2xl py-5 pl-12 pr-4 text-white text-xs font-bold tracking-widest focus:outline-none focus:border-blue-600 transition-all placeholder:text-slate-800"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-900/20 uppercase tracking-widest text-[10px]"
          >
            Connect to Lylo <ArrowRight size={14} />
          </button>
        </form>
        
        <p className="mt-8 text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">
          100% Confidential • End-to-End Encryption
        </p>
      </div>
    </div>
  );
}
