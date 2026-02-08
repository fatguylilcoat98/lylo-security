import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, MessageSquare, Lock, Activity, ChevronRight, Menu, LogOut } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  // SECURE LOGOUT LOGIC
  const handleLogout = () => {
    localStorage.removeItem('lylo_session_active');
    localStorage.removeItem('lylo_user_email');
    localStorage.removeItem('lylo_vault_key');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      {/* HEADER WITH LOGOUT */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold italic tracking-tighter">LYLO<span className="text-blue-500">.</span>PRO</h1>
        <div className="flex items-center gap-4">
          <div className="text-green-400 text-[10px] uppercase font-bold tracking-widest">System Active</div>
          <button 
            onClick={handleLogout}
            className="p-2 bg-slate-900 border border-white/5 rounded-lg hover:bg-red-900/20 hover:border-red-500/30 transition-all group"
            title="Secure Logout"
          >
            <LogOut size={16} className="text-slate-500 group-hover:text-red-500" />
          </button>
        </div>
      </div>
      
      {/* SECURITY SCORE CARD */}
      <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-900/20 to-slate-900/50 border border-blue-500/20 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Shield size={80} fill="currentColor" />
        </div>
        <div className="flex justify-between items-center relative z-10">
          <Shield className="text-blue-400" />
          <span className="text-4xl font-black italic tracking-tighter">98</span>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full mt-4 overflow-hidden relative z-10">
             <div className="h-full w-[98%] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
        </div>
        <p className="text-[10px] text-blue-200/50 font-black uppercase tracking-[0.3em] mt-3">Security Score</p>
      </div>

      <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Modules</h3>

      {/* CHAT MODULE */}
      <button onClick={() => navigate('/chat')} className="w-full p-5 bg-white text-slate-950 rounded-2xl flex items-center justify-between mb-4 shadow-xl active:scale-95 transition-transform">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-100 rounded-xl">
            <MessageSquare className="text-blue-600" />
          </div>
          <div className="text-left">
            <div className="font-black uppercase tracking-tighter italic">Consult LYLO</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Neural Link Active</div>
          </div>
        </div>
        <ChevronRight className="text-slate-400" />
      </button>

      {/* LOCKED MODULES (Opacity maintained for privacy/tier look) */}
      <div className="grid grid-cols-2 gap-3 opacity-40">
         <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
            <Lock className="text-slate-600" size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 tracking-widest">Vault</span>
         </div>
         <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
            <Activity className="text-slate-600" size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 tracking-widest">Monitor</span>
         </div>
      </div>

      {/* PRIVACY FOOTER */}
      <p className="mt-8 text-center text-[9px] text-slate-700 font-bold uppercase tracking-[0.3em]">
        End-to-End Encryption • Anti-Thief Protocol
      </p>
    </div>
  );
}
