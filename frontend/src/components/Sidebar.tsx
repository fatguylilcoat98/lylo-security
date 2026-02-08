import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, MessageSquare, LogOut } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Detect tier and persist it
  const query = new URLSearchParams(location.search);
  const urlTier = query.get('tier');
  const storedTier = localStorage.getItem('lylo_tier');
  const tier = urlTier || storedTier || 'free';

  if (urlTier) localStorage.setItem('lylo_tier', urlTier);

  // Use your new high-quality ImgBB links
  const getShieldImg = () => {
    if (tier === 'elite') return 'https://i.ibb.co/7xC3Kn3g/elite-shield.png';
    if (tier === 'pro') return 'https://i.ibb.co/cKW1Qtn9/Untitled-design-removebg-preview.png';
    return 'https://i.ibb.co/Xx96vg39/free-shield-png.png';
  };

  const getGlowColor = () => {
    if (tier === 'elite') return 'drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]';
    if (tier === 'pro') return 'drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]';
    return 'drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]';
  };

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen">
      <div className="p-6 flex flex-col items-center border-b border-slate-800/50">
        <div className="relative group">
          <img 
            src={getShieldImg()} 
            alt="LYLO Shield" 
            className={`w-32 h-32 object-contain mb-4 transition-transform duration-500 group-hover:scale-110 ${getGlowColor()}`} 
          />
        </div>
        <h1 className="text-xl font-black text-white uppercase italic tracking-tighter">
          LYLO <span className="text-xs not-italic font-bold border border-slate-700 px-2 py-0.5 rounded ml-1 text-slate-400">{tier}</span>
        </h1>
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
