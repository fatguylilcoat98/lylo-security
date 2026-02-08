import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && code.trim()) {
      localStorage.setItem('lylo_session_active', 'true'); 
      localStorage.setItem('lylo_user_email', email.toLowerCase().trim());
      localStorage.setItem('lylo_vault_key', btoa(`${email.trim()}:${code.trim()}`)); 
      navigate('/assessment');
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-white p-6 font-sans flex flex-col items-center justify-center">
      
      {/* --- UNIVERSAL LOGO --- */}
      <div className="mb-12 flex flex-col items-center gap-4 text-center">
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full group-hover:bg-blue-600/40 transition-all duration-700"></div>
          <img 
            src="lylo-sheild.png" 
            alt="LYLO" 
            className="w-28 h-28 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase">LYLO<span className="text-blue-500">.</span>PRO</h1>
          <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.4em]">Truth Shield Active</p>
        </div>
      </div>

      {/* --- LOGIN CARD --- */}
      <div className="w-full max-w-md bg-[#0b101b] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-8 relative z-10">
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic text-white">Vault Access</h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black">Secure Nationwide Connection</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
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
        
        <div className="mt-8 pt-8 border-t border-white/5 flex items-start gap-3 relative z-10">
           <EyeOff size={20} className="text-blue-500 mt-1 flex-shrink-0" />
           <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed text-slate-500">
             Privacy Protocol: We are the anti-thief. Your data is processed in a volatile memory environment and purged instantly. No human logging.
           </p>
        </div>
      </div>

      <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-800">
        End-to-End Encrypted Protection
      </p>
    </div>
  );
}
