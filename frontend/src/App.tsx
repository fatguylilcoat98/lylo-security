import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- LANDING PAGE COMPONENT (The Home Screen) ---
const LandingPage = () => {
  const navigate = useNavigate();

  // LOGIN LOGIC
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
        // Save User Data
        localStorage.setItem('userEmail', email.toLowerCase().trim());
        localStorage.setItem('userTier', data.tier);
        localStorage.setItem('userName', data.name);
        
        alert("Access Granted! Welcome " + data.name);
        
        // SEND TO DASHBOARD
        navigate('/dashboard'); 
      } else {
        alert("Access Denied: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Connection Error. Check your internet.");
    }
  };

  return (
    <div className="bg-[#050505] text-white font-sans min-h-screen">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="LYLO" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-black tracking-tighter uppercase italic">LYLO<span className="text-blue-500">.</span>PRO</span>
          </div>
          <button onClick={runBetaLogin} className="px-6 py-2 border border-blue-600 text-blue-500 rounded-sm hover:bg-blue-600 hover:text-white transition shadow-[0_0_20px_rgba(59,130,246,0.2)]">Login</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-48 pb-32 text-center px-6">
        <h1 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter leading-none italic uppercase">
          LOVE YOUR <br /><span className="text-blue-500">LOVED ONES</span>
        </h1>
        <p className="text-blue-400 text-xl font-bold uppercase tracking-[0.3em] mb-12">Protection for them, Peace of mind for you.</p>
        <button onClick={runBetaLogin} className="px-12 py-6 bg-blue-600 text-white font-black uppercase tracking-widest rounded-sm hover:bg-blue-500 transition shadow-2xl">Start Now</button>
      </section>

      {/* PRICING SECTION */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* FREE TIER */}
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center hover:-translate-y-2 transition duration-300">
            <img src="/freetier.png" className="h-32 mb-6" alt="Free" />
            <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] mb-2">Basic Shield</h3>
            <div className="text-4xl font-black mb-6">$0</div>
            <ul className="text-xs text-gray-500 mb-8 space-y-2">
              <li>• 5 Scans Daily</li>
              <li>• Standard Speed</li>
            </ul>
            <button onClick={runBetaLogin} className="w-full py-4 border border-white/10 rounded font-bold uppercase text-xs tracking-widest hover:bg-white hover:text-black transition">Join Free</button>
          </div>

          {/* PRO TIER ($1.99) */}
          <div className="p-8 rounded-3xl bg-blue-900/10 border border-blue-500/30 flex flex-col items-center text-center hover:-translate-y-2 transition duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]">
            <img src="/protier.png" className="h-32 mb-6" alt="Pro" />
            <h3 className="text-blue-400 font-black uppercase tracking-[0.2em] mb-2">Pro Guardian</h3>
            <div className="text-4xl font-black mb-6">$1.99</div>
            <ul className="text-xs text-gray-400 mb-8 space-y-2">
              <li>• 50 Scans Daily</li>
              <li>• Fast Analysis</li>
            </ul>
            <a href="https://buy.stripe.com/YOUR_PRO_LINK" target="_blank" className="block w-full py-4 bg-blue-600 rounded font-bold uppercase text-xs tracking-widest hover:bg-blue-500 transition">Get Pro</a>
          </div>

          {/* ELITE TIER ($4.99) */}
          <div className="p-8 rounded-3xl bg-amber-900/10 border border-amber-500/30 flex flex-col items-center text-center hover:-translate-y-2 transition duration-300 hover:shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <img src="/elitetier.png" className="h-32 mb-6" alt="Elite" />
            <h3 className="text-amber-500 font-black uppercase tracking-[0.2em] mb-2">Elite Justice</h3>
            <div className="text-4xl font-black mb-6">$4.99</div>
            <ul className="text-xs text-gray-300 mb-8 space-y-2">
              <li>• 500 Scans Daily</li>
              <li>• Auto-Talk Voice</li>
            </ul>
            <a href="https://buy.stripe.com/YOUR_ELITE_LINK" target="_blank" className="block w-full py-4 bg-gradient-to-r from-amber-600 to-yellow-600 text-black rounded font-black uppercase text-xs tracking-widest hover:brightness-110 transition">Start Elite</a>
          </div>

          {/* MAX TIER ($9.99) */}
          <div className="p-8 rounded-3xl bg-purple-900/10 border border-purple-500/30 flex flex-col items-center text-center hover:-translate-y-2 transition duration-300 hover:shadow-[0_0_40px_rgba(147,51,234,0.2)]">
            <img src="/maxtier.png" className="h-32 mb-6" alt="Max" />
            <h3 className="text-purple-500 font-black uppercase tracking-[0.2em] mb-2">Max Unlimited</h3>
            <div className="text-4xl font-black mb-6">$9.99</div>
            <ul className="text-xs text-gray-300 mb-8 space-y-2">
              <li>• Unlimited Access</li>
              <li>• Legal Aid Connect</li>
            </ul>
            <a href="https://buy.stripe.com/YOUR_MAX_LINK" target="_blank" className="block w-full py-4 border border-purple-500 text-purple-400 rounded font-bold uppercase text-xs tracking-widest hover:bg-purple-600 hover:text-white transition">Go Max</a>
          </div>

        </div>
      </section>

      <footer className="py-20 text-center text-gray-600 text-xs tracking-widest uppercase font-bold border-t border-white/5">
        &copy; 2026 LYLO Security Systems.
      </footer>
    </div>
  );
};

// --- MAIN APP ROUTING ---
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* WE CHANGED THIS: Root path now shows LandingPage instead of redirecting */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Protected Dashboard Route */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Other Pages */}
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </BrowserRouter>
  );
}
