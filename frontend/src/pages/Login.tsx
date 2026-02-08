import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Zap, Star, Crown } from 'lucide-react';

export default function Login() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      localStorage.setItem('lylo_user', 'Agent'); 
      navigate('/assessment');
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-white p-6 font-sans flex flex-col items-center">
      {/* LOGIN CARD */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-20">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Shield className="w-6 h-6 text-white" fill="currentColor" /></div>
            <h1 className="text-2xl font-black italic">LYLO<span className="text-blue-500">.</span>PRO</h1>
          </div>
          <h2 className="text-6xl font-black leading-none uppercase tracking-tighter">VAST AI <br/><span className="text-blue-500">SCAM DEFENSE</span></h2>
          <p className="text-slate-400 text-lg max-w-md font-medium">Sacramento's elite digital bodyguard. Enter your code or upgrade below.</p>
        </div>

        <div className="w-full max-w-md bg-[#0b101b] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <h3 className="text-2xl font-black uppercase italic mb-2 text-center text-white">Vault Access</h3>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest text-center mb-8">Enter access code</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="ENTER ACCESS CODE"
              className="w-full bg-[#02040a] border border-white/5 rounded-2xl py-5 px-6 text-white text-xs font-bold tracking-widest focus:border-blue-600 outline-none transition-all"
            />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-[10px]">
              Connect to Lylo
            </button>
          </form>
        </div>
      </div>

      {/* PRICING SECTION */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 py-10">
        <div className="bg-[#0b101b] p-8 rounded-[2rem] border border-white/5 flex flex-col">
          <Star className="text-blue-500 mb-4" />
          <h3 className="text-xl font-black uppercase italic text-white mb-2">Pro Guardian</h3>
          <p className="text-slate-500 text-xs mb-6 flex-1">Full Scam Intelligence & 24/7 Monitoring.</p>
          <button onClick={() => window.location.href = 'https://buy.stripe.com/PASTE_YOUR_PRO_LINK_HERE'} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-[10px]">Start Pro Trial</button>
        </div>

        <div className="bg-slate-900/20 p-8 rounded-[2rem] border border-blue-600/30 flex flex-col">
          <Crown className="text-cyan-400 mb-4" />
          <h3 className="text-xl font-black uppercase italic text-white mb-2">Elite Sentinel</h3>
          <p className="text-slate-500 text-xs mb-6 flex-1">Priority Neural Link & Custom Hardware Vault.</p>
          <button onClick={() => window.location.href = 'https://buy.stripe.com/PASTE_YOUR_ELITE_LINK_HERE'} className="w-full py-4 border border-blue-600/50 text-white font-black rounded-xl uppercase text-[10px]">Activate Elite</button>
        </div>
      </div>
    </div>
  );
}
