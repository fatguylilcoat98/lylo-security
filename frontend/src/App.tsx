import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- LANDING PAGE COMPONENT ---
const LandingPage = () => {
  const navigate = useNavigate();

  const runBetaLogin = async () => {
    const email = prompt("Enter your Beta Tester Email:");
    if (!email) return;

    try {
      const response = await fetch('https://lylo-backend.onrender.com/check-beta-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      const data = await response.json();

      if (data.access) {
        localStorage.setItem('userEmail', email.toLowerCase().trim());
        localStorage.setItem('userTier', data.tier);
        localStorage.setItem('userName', data.name);
        alert("Access Granted! Welcome " + data.name);
        navigate('/dashboard'); 
      } else {
        alert("Access Denied: " + data.message);
      }
    } catch (err) {
      alert("Connection Error. Check your internet.");
    }
  };

  return (
    <div className="bg-[#050505] text-white font-sans min-h-screen">
      <style>{`
        /* ICON RADIANT GLOW */
        .glow-wrapper {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 2rem;
        }
        .radiant-light {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.15;
          z-index: 0;
          animation: pulse-glow 4s infinite ease-in-out;
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.3); opacity: 0.3; }
        }

        /* CARD SYSTEM */
        .price-card {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          background: rgba(255, 255, 255, 0.01);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 3rem 1.5rem;
          border-radius: 2rem;
          height: 100%;
          position: relative;
          z-index: 1;
        }

        .card-pro { border-color: rgba(59, 130, 246, 0.2); }
        .card-pro:hover { background: #2563eb !important; border-color: #3b82f6; box-shadow: 0 0 40px rgba(59, 130, 246, 0.4); transform: translateY(-10px); }

        .card-elite { border-color: rgba(245, 158, 11, 0.2); }
        .card-elite:hover { background: #d97706 !important; border-color: #fbbf24; box-shadow: 0 0 40px rgba(245, 158, 11, 0.4); transform: translateY(-10px); }

        .card-max { border-color: rgba(147, 51, 234, 0.2); }
        .card-max:hover { background: #9333ea !important; border-color: #a855f7; box-shadow: 0 0 40px rgba(147, 51, 234, 0.4); transform: translateY(-10px); }
        
        .price-card:hover * { color: white !important; opacity: 1 !important; }
        .tier-button { transition: all 0.3s ease; background: transparent; }
        .price-card:hover .tier-button { background: white !important; color: black !important; border-color: white !important; }
      `}</style>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="LYLO" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-black tracking-tighter uppercase italic text-white">LYLO<span className="text-blue-500">.</span>PRO</span>
          </div>
          <button onClick={runBetaLogin} className="px-6 py-2 border border-blue-600 text-blue-500 rounded-sm hover:bg-blue-600 hover:text-white transition">Login</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-48 pb-32 text-center px-6">
        <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-none italic uppercase text-white">
          LOVE YOUR <br /><span className="text-blue-500">LOVED ONES</span>
        </h1>
        <p className="text-blue-400 text-xl font-bold uppercase tracking-[0.3em] mb-12 italic">Protecting the most vulnerable from digital harm.</p>
        <button onClick={runBetaLogin} className="px-12 py-6 bg-blue-600 text-white font-black uppercase tracking-widest rounded-sm hover:bg-blue-500 transition shadow-2xl">Deploy Shield</button>
      </section>

      {/* PRICING SECTION */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* BASIC */}
          <div className="price-card border-white/10" onClick={runBetaLogin}>
            <div className="glow-wrapper">
              <div className="radiant-light bg-white" />
              <img src="/freetier.png" className="h-32 relative z-10" alt="Free" />
            </div>
            <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] mb-2">Basic Shield</h3>
            <div className="text-4xl font-black mb-6 text-white">$0</div>
            <ul className="text-[11px] text-gray-500 mb-8 space-y-3 flex-1 text-left w-full px-4 border-t border-white/5 pt-4">
              <li className="flex gap-2"><span>🛡️</span> 5 Security Scans / Daily</li>
              <li className="flex gap-2"><span>🕒</span> Standard Analysis Speed</li>
              <li className="flex gap-2"><span>🔒</span> Basic Threat Filtering</li>
            </ul>
            <button className="tier-button w-full py-4 border border-white/20 rounded font-bold uppercase text-[10px] tracking-widest text-white">Activate</button>
          </div>

          {/* PRO */}
          <div className="price-card card-pro" onClick={runBetaLogin}>
            <div className="glow-wrapper">
              <div className="radiant-light bg-blue-500" />
              <img src="/protier.png" className="h-32 relative z-10" alt="Pro" />
            </div>
            <h3 className="text-blue-400 font-black uppercase tracking-[0.2em] mb-2">Pro Guardian</h3>
            <div className="text-4xl font-black mb-6 text-white">$1.99</div>
            <ul className="text-[11px] text-blue-100/60 mb-8 space-y-3 flex-1 text-left w-full px-4 border-t border-blue-500/20 pt-4">
              <li className="flex gap-2"><span>⚡</span> 50 Security Scans / Daily</li>
              <li className="flex gap-2"><span>🏎️</span> High-Speed GPU Processing</li>
              <li className="flex gap-2"><span>📱</span> Social Media Scan Access</li>
              <li className="flex gap-2 text-blue-400 font-bold italic">Perfect for Individual Use</li>
            </ul>
            <button className="tier-button w-full py-4 border border-blue-500 text-blue-400 rounded font-bold uppercase text-[10px] tracking-widest">Upgrade to Pro</button>
          </div>

          {/* ELITE */}
          <div className="price-card card-elite" onClick={runBetaLogin}>
            <div className="glow-wrapper">
              <div className="radiant-light bg-amber-500" />
              <img src="/elitetier.png" className="h-32 relative z-10" alt="Elite" />
            </div>
            <h3 className="text-amber-500 font-black uppercase tracking-[0.2em] mb-2">Elite Justice</h3>
            <div className="text-4xl font-black mb-6 text-white">$4.99</div>
            <ul className="text-[11px] text-amber-100/60 mb-8 space-y-3 flex-1 text-left w-full px-4 border-t border-amber-500/20 pt-4">
              <li className="flex gap-2 font-bold text-amber-500 tracking-tighter italic">EVERYTHING IN PRO, PLUS:</li>
              <li className="flex gap-2"><span>🗣️</span> <b>Voice Response (Auto-Talk)</b></li>
              <li className="flex gap-2"><span>📋</span> <b>Scam Recovery Center Access</b></li>
              <li className="flex gap-2"><span>📈</span> 500 Security Scans / Daily</li>
              <li className="flex gap-2"><span>🔑</span> Multi-Device Sync</li>
            </ul>
            <button className="tier-button w-full py-4 border border-amber-500 text-amber-500 rounded font-bold uppercase text-[10px] tracking-widest">Deploy Elite</button>
          </div>

          {/* MAX */}
          <div className="price-card card-max" onClick={runBetaLogin}>
            <div className="glow-wrapper">
              <div className="radiant-light bg-purple-500" />
              <img src="/maxtier.png" className="h-32 relative z-10" alt="Max" />
            </div>
            <h3 className="text-purple-500 font-black uppercase tracking-[0.2em] mb-2">Max Unlimited</h3>
            <div className="text-4xl font-black mb-6 text-white">$9.99</div>
            <ul className="text-[11px] text-purple-100/60 mb-8 space-y-3 flex-1 text-left w-full px-4 border-t border-purple-500/20 pt-4">
               <li className="flex gap-2 font-bold text-purple-400 tracking-tighter italic">TOTAL FAMILY PROTECTION:</li>
              <li className="flex gap-2"><span>♾️</span> <b>Unlimited Security Scans</b></li>
              <li className="flex gap-2"><span>🏛️</span> <b>Direct Bridge to Legal Aid</b></li>
              <li className="flex gap-2"><span>🕵️</span> Identity & Fraud Monitoring</li>
              <li className="flex gap-2"><span>🎧</span> 24/7 VIP Concierge Support</li>
            </ul>
            <button className="tier-button w-full py-4 border border-purple-500 text-purple-400 rounded font-bold uppercase text-[10px] tracking-widest">Go Unlimited</button>
          </div>

        </div>
      </section>

      <footer className="py-20 text-center text-gray-600 text-[10px] tracking-[0.5em] uppercase font-black border-t border-white/5">
        &copy; 2026 LYLO SECURITY SYSTEMS. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </BrowserRouter>
  );
}
