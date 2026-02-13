import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- THE WEBSITE LANDING PAGE COMPONENT ---
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
        // HANDSHAKE: Priming for the App
        localStorage.setItem('userEmail', email.toLowerCase().trim());
        localStorage.setItem('userName', data.name);
        localStorage.setItem('userTier', 'max'); 
        localStorage.setItem('isEliteUser', 'true');
        localStorage.setItem('isBetaTester', 'true');
        localStorage.setItem('lylo_assessment_complete', 'true');

        alert("Access Granted! Welcome " + data.name);
        // BRIDGE: Moving from "Website" to "App"
        navigate('/dashboard'); 
      } else {
        alert("Access Denied: " + data.message);
      }
    } catch (err) {
      alert("Connection Error. Check internet.");
    }
  };

  return (
    <div className="bg-[#050505] text-white min-h-screen">
      <style>{`
        .card { transition: all 0.4s ease; background: rgba(255,255,255,0.01); border: 2px solid rgba(255,255,255,0.05); cursor: pointer; }
        .border-pro { border-color: rgba(59, 130, 246, 0.3); }
        .border-pro:hover { background: #2563eb !important; border-color: #3b82f6; }
        .border-elite { border-color: rgba(245, 158, 11, 0.3); }
        .border-elite:hover { background: #d97706 !important; border-color: #fbbf24; }
        .border-max { border-color: rgba(147, 51, 234, 0.3); }
        .border-max:hover { background: #9333ea !important; border-color: #a855f7; }
        .card:hover * { color: white !important; opacity: 1 !important; }
        .shield-box-img { height: 120px !important; width: auto; object-fit: contain; }
      `}</style>

      <nav className="p-6 flex justify-between items-center border-b border-white/10">
        <span className="text-2xl font-black italic">LYLO.PRO</span>
        <button onClick={runBetaLogin} className="px-6 py-2 border border-blue-600 text-blue-500">Login</button>
      </nav>

      <section className="py-20 text-center">
        <h1 className="text-6xl font-black mb-6 uppercase italic">Love Your <span className="text-blue-500">Loved Ones</span></h1>
        <button onClick={runBetaLogin} className="px-12 py-6 bg-blue-600 text-white font-black uppercase">Start Now</button>
      </section>

      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-pro p-8 rounded-3xl flex flex-col items-center" onClick={runBetaLogin}>
            <img src="/protier.png" className="shield-box-img mb-6" />
            <h3 className="text-blue-400 font-black uppercase mb-2">Pro Guardian</h3>
            <div className="text-4xl font-black mb-8">$1.99</div>
            <button className="w-full py-4 border border-blue-500 text-blue-400 font-bold uppercase">Get Pro</button>
        </div>
        {/* ... (Repeat for Elite and Max as per your design) ... */}
      </section>
    </div>
  );
};

// --- APP ROUTING ---
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Path "/" shows the Website Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Other paths handle the App logic */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </BrowserRouter>
  );
}
