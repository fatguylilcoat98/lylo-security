import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, MessageSquare, Lock, Activity, ChevronRight, Menu } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-green-400 text-xs uppercase font-bold">System Active</div>
      </div>
      
      <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-900/20 to-slate-900/50 border border-blue-500/20 mb-6">
        <div className="flex justify-between items-center">
          <Shield className="text-blue-400" />
          <span className="text-4xl font-bold">98</span>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full mt-4 overflow-hidden">
             <div className="h-full w-[98%] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
        </div>
        <p className="text-xs text-blue-200/50 uppercase mt-2">Security Score</p>
      </div>

      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">Modules</h3>

      <button onClick={() => navigate('/chat')} className="w-full p-5 bg-white text-slate-950 rounded-2xl flex items-center justify-between mb-4 shadow-xl">
        <div className="flex items-center gap-4">
          <MessageSquare className="text-blue-600" />
          <div className="text-left">
            <div className="font-bold">Consult LYLO</div>
            <div className="text-xs text-slate-500">AI Security Analysis</div>
          </div>
        </div>
        <ChevronRight className="text-slate-400" />
      </button>

      <div className="grid grid-cols-2 gap-3 opacity-50">
         <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
            <Lock className="text-slate-600" />
            <span className="text-sm font-bold text-slate-500">Vault</span>
         </div>
         <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
            <Activity className="text-slate-600" />
            <span className="text-sm font-bold text-slate-500">Monitor</span>
         </div>
      </div>
    </div>
  );
}
