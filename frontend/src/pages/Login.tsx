import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Zap, Bell, UserCheck, AlertTriangle, Crown, Star } from 'lucide-react';
// IMPORT THE STRIPE LOGIC
import { startSubscription } from '../lib/api';

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
      
      {/* --- SECTION 1: LOGIN & BRANDING --- */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-20">
        
        {/* LEFT SIDE: Branding */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/40">
              <Shield className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter italic">LYLO<span className="text-blue-500">.</span>PRO</h1>
              <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.3em]">Truth Shield Active</p>
            </div>
          </div>

          <h2 className="text-5xl lg:text-7xl font-black leading-[0.9] tracking-tighter">
            VAST AI <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              SCAM DEFENSE
            </span>
          </h2>

          <p className="text-slate-400 text-lg max-w-md leading-relaxed font-medium">
            LYLO analyzes suspicious links, PC build specs, and Sacramento area local data to keep you elite.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: AlertTriangle, title: "Truth Protocol", desc: "Tavily Verified" },
              { icon: Zap, title: "Gemini 1.5", desc: "Instant Analysis" },
              { icon: UserCheck, title: "Sacramento Local", desc: "Custom Context" },
              { icon: Bell, title: "Neural Link", desc: "24/7 Protection" }
            ].map((item, i) => (
              <div key={i} className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl flex items-start gap-3 hover:border-blue-500/30 transition-all">
                <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400">
                  <item.icon size={18} />
                </div>
                <div>
                  <div className="font-black text-[10px] uppercase tracking-widest">{item.title}</div>
                  <div className="text-[10px] text-slate-500 font-bold">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE: Access Card */}
        <div className="flex justify-center">
          <div className="w-full max-w-md bg-[#0b101b] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Shield size={120} />
            </div>
            <div className="text-center mb-8 relative z-10">
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">Vault Access</h3>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Encrypted Connection Required</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 relative z-10">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input 
                  type="password"
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
                Connect to Lylo
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* --- SECTION 2: THE VAULT PLANS (PRICING) --- */}
      <div className="w-full max-w-6xl py-20 border-t border-white/5">
        <div className="text-center mb-16">
            <h4 className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Pricing Tiers</h4>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Choose Your Protection</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* PRO GUARDIAN CARD */}
            <div className="bg-[#0b101b] p-8 rounded-[2rem] border border-white/5 hover:border-blue-500/50 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <Star className="text-blue-500 mb-2" size={24} />
                        <h3 className="text-xl font-black italic uppercase tracking-tighter">Pro Guardian</h3>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black">$24.99</span>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">per month</p>
                    </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                    {['Full Scam Intelligence', 'Tavily Live Search', 'Xbox/PC Tech Support', '24/7 Monitoring'].map((feat, i) => (
                        <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Shield size={10} className="text-blue-500" /> {feat}
                        </li>
                    ))}
                </ul>
                <button 
                  onClick={() => startSubscription('price_1SuOtIAmwGQYQg4wHbw0IlWo')}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all uppercase tracking-widest text-[10px]"
                >
                  Start Pro Trial
                </button>
            </div>

            {/* ELITE SENTINEL CARD */}
            <div className="bg-slate-900/20 p-8 rounded-[2rem] border border-blue-600/30 hover:border-blue-400 transition-all flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-[8px] font-black uppercase px-4 py-1 tracking-widest">Most Popular</div>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <Crown className="text-cyan-400 mb-2" size={24} />
                        <h3 className="text-xl font-black italic uppercase tracking-tighter">Elite Sentinel</h3>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black">$49.99</span>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">per month</p>
                    </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                    {['Priority Neural Link', 'Custom Sacramento Intel', 'Full Hardware Vault', 'Direct Agent Access'].map((feat, i) => (
                        <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                            <Shield size={10} className="text-cyan-400" /> {feat}
                        </li>
                    ))}
                </ul>
                <button 
                  onClick={() => startSubscription('price_1SviQgAmwGQYQg4waexnP8ds')}
                  className="w-full py-4 border border-blue-600/50 hover:bg-blue-600 text-white font-black rounded-xl transition-all uppercase tracking-widest text-[10px]"
                >
                  Activate Elite Vault
                </button>
            </div>

        </div>
      </div>
      
    </div>
  );
}
