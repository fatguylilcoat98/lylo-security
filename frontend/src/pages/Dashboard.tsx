
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, MessageSquare, Lock, Activity, Menu, Zap, Bell } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = localStorage.getItem('lylo_user') || 'Agent';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
      {/* Top Bar */}
      <div className="px-6 py-6 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800/50">
        <div>
          <h2 className="text-xs font-bold text-yellow-500 tracking-wider uppercase mb-1">Welcome Back</h2>
          <h1 className="text-xl font-bold text-white">{user}</h1>
        </div>
        <div className="p-2 bg-slate-800 rounded-full relative">
          <Bell size={20} className="text-slate-400" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-800"></span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Status Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900 border border-slate-800 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Shield size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              System Optimal
            </div>
            <div className="text-4xl font-bold text-white mb-1">92<span className="text-lg text-slate-500">%</span></div>
            <div className="text-slate-400 text-sm">Security Rating</div>
          </div>
        </motion.div>

        {/* Action Grid */}
        <div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 px-1">Command Center</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Consult AI Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/chat')}
              className="col-span-2 p-5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-900/20 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-white/10 rounded-xl">
                  <MessageSquare className="text-white w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-lg">Consult LYLO</div>
                  <div className="text-blue-100 text-xs opacity-80">AI Security Assistant</div>
                </div>
              </div>
              <ChevronRight className="text-white/50 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col justify-center items-center gap-3 text-center opacity-50">
              <Lock className="text-slate-500" />
              <div className="text-sm font-bold text-slate-400">Vault</div>
            </div>
            <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col justify-center items-center gap-3 text-center opacity-50">
              <Zap className="text-slate-500" />
              <div className="text-sm font-bold text-slate-400">Scan</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
