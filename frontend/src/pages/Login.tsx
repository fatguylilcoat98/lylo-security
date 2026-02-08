
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, ChevronRight, Zap, Bell, UserCheck, AlertTriangle } from 'lucide-react';

export default function Login() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (code.trim()) {
      localStorage.setItem('lylo_user', 'Agent'); 
      navigate('/assessment');
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* LEFT SIDE: Branding & Features (Matches Screenshot) */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">LYLO</h1>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">Truth Shield</p>
            </div>
          </div>

          <h2 className="text-5xl font-bold leading-tight">
            Your Personal AI <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Scam Protection
            </span>
          </h2>

          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            LYLO analyzes suspicious messages, emails, and calls to keep you safe online. Powered by advanced AI.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: AlertTriangle, title: "Scam Detection", desc: "Instant analysis" },
              { icon: Zap, title: "AI Powered", desc: "Advanced understanding" },
              { icon: UserCheck, title: "Personalized", desc: "Adapts to you" },
              { icon: Bell, title: "Real-time Alerts", desc: "Immediate threats" }
            ].map((item, i) => (
              <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400">
                  <item.icon size={18} />
                </div>
                <div>
                  <div className="font-bold text-sm">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE: "Welcome Back" Card (Matches Screenshot) */}
        <div className="flex justify-center">
          <div className="w-full max-w-md bg-[#0b101b] p-8 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">Welcome Back</h3>
              <p className="text-slate-400 text-sm">Enter your access code to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ACCESS CODE"
                  className="w-full bg-[#02040a] border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
              >
                <Shield size={18} fill="currentColor" /> Enter LYLO
              </button>
            </form>

            <div className="mt-8 flex justify-between text-xs text-slate-600 font-medium px-2">
              <span>Private & Secure</span>
              <span>•</span>
              <span>AI Powered</span>
              <span>•</span>
              <span>24/7 Protection</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
