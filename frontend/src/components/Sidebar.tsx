import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, MessageSquare, LogOut } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const tier = new URLSearchParams(location.search).get('tier') || localStorage.getItem('lylo_tier') || 'free';

  if (new URLSearchParams(location.search).get('tier')) {
    localStorage.setItem('lylo_tier', tier);
  }

  const shieldSrc = `/${tier}-shield.png`;

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen">
      <div className="p-6 flex flex-col items-center border-b border-slate-800/50">
        <img src={shieldSrc} alt="LYLO Shield" className="w-32 h-32 object-contain drop-shadow-2xl mb-4" />
        <h1 className="text-xl font-black text-white uppercase italic tracking-tighter">LYLO {tier}</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:bg-slate-900 rounded-xl transition-colors">
          <Shield size={20} /> Dashboard
        </button>
        <button onClick={() => navigate('/chat')} className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:bg-slate-900 rounded-xl transition-colors">
          <MessageSquare size={20} /> Consult LYLO
        </button>
        <div className="pt-4 mt-4 border-t border-slate-900">
           <button onClick={() => { localStorage.clear(); window.location.href='/'; }} className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-950/30 rounded-xl transition-colors">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </nav>
    </div>
  );
}
