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
        
        // --- THE FIX ---
        // Using React Router's navigate prevents the 404 error on Render
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
      <style>{`
        /* THE NEON BOX SYSTEM */
        .price-card {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2rem;
          border-radius: 1.5rem;
        }

        /* PRO - BLUE GLOW */
        .card-pro { 
          border-color: rgba(59, 130, 246, 0.4); 
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.1); 
        }
        .card-pro:hover, .card-pro:active { 
          background: #2563eb !important; 
          border-color: #3b82f6; 
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.5); 
          transform: translateY(-8px);
        }

        /* ELITE - GOLD GLOW */
        .card-elite { 
          border-color: rgba(245, 158, 11, 0.4); 
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.1); 
        }
        .card-elite:hover, .card-elite:active { 
          background: #d97706 !important; 
          border-color: #fbbf24; 
          box-shadow: 0 0 30px rgba(245, 158, 11, 0.5); 
          transform: translateY(-8px);
        }

        /* MAX - PURPLE GLOW */
        .card-max { 
          border-color: rgba(147, 51, 234, 0.4); 
          box-shadow: 0 0 15px rgba(147, 51, 234, 0.1); 
        }
        .card-max:hover, .card-max:active { 
          background: #9333ea !important; 
          border-color: #a855f7; 
          box-shadow: 0 0 30px rgba(147, 51, 234, 0.5); 
          transform: translateY(-8px);
        }
        
        /* Auto-adjust text when background turns solid */
        .price-card:hover h3, .price-card:hover div, .price-card:hover li { 
          color: white !important; 
        }
        .price-card:hover button, .price-card:hover a {
          background: white !important;
          color: black !important;
          border-color: white !important;
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="LYLO" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-black tracking-tighter uppercase italic text-white">LYLO<span className="text-blue-500">.</span>PRO</span>
          </div>
          <button onClick={runBetaLogin} className="px-6 py-2 border border-blue-600 text-blue-500 rounded-sm hover:bg-blue-600 hover:text-white transition shadow-lg">Login</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-48 pb-32 text-center px-6">
        <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-none italic uppercase">
          LOVE YOUR <br /><span className="text-blue-500">LOVED ONES</span>
        </h1>
        <p className="text-blue-400 text-xl font-bold uppercase tracking-[0.3em] mb-12">Protection for them, Peace of mind for you.</p>
        <button onClick={runBetaLogin} className="px-12 py-6 bg-blue-600 text-white font-black uppercase tracking-widest rounded-sm hover:bg-blue-500 transition shadow-2xl">Start Now</button>
      </section>

      {/* PRICING */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="price-card border-white/10 hover:bg-white/5 transition duration-300">
            <img src="/freetier.png" className="h-32 mb-6" alt="Free" />
            <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] mb-2">Basic Shield</h3>
            <div className="text-4xl font-black mb-6">$0</div>
            <ul className="text-xs text-gray-500 mb-8 space-y-2 flex-1">
              <li>• 5 Scans Daily</li>
              <li>• Standard Speed</li>
            </ul>
            <button onClick={runBetaLogin} className="w-full py-4 border border-white/10 rounded font-bold uppercase text-xs tracking-widest hover:bg-white hover:text-black transition">Join Free</button>
          </div>

          <div className="price-card card-pro" onClick={runBetaLogin}>
            <img src="/protier.png" className="h-32 mb-6" alt="Pro" />
            <h3 className="text-blue-400 font-black uppercase tracking-[0.2em] mb-2">Pro Guardian</h3>
            <div className="text-4xl font-black mb-6">$1.99</div>
            <ul className="text-xs text-blue-100/60 mb-8 space-y-2 flex-1">
              <li>• 50 Scans Daily</li>
              <li>• Fast Analysis</li>
            </ul>
            <a href="https://buy.stripe.com/YOUR_PRO_LINK" className="w-full py-4 border border-blue-500 text-blue-400 rounded font-bold uppercase text-xs tracking-widest text-center">Get Pro</a>
          </div>

          <div className="price-card card-elite" onClick={runBetaLogin}>
            <img src="/elitetier.png" className="h-32 mb-6" alt="Elite" />
            <h3 className="text-amber-500 font-black uppercase tracking-[0.2em] mb-2">Elite Justice</h3>
            <div className="text-4xl font-black mb-6">$4.99</div>
            <ul className="text-xs text-amber-100/60 mb-8 space-y-2 flex-1">
              <li>• 500 Scans Daily</li>
              <li>• Auto-Talk Voice</li>
            </ul>
            <a href="https://buy.stripe.com/YOUR_ELITE_LINK" className="w-full py-4 border border-amber-500 text-amber-500 rounded font-black uppercase text-xs tracking-widest text-center">Start Elite</a>
          </div>

          <div className="price-card card-max" onClick={runBetaLogin}>
            <img src="/maxtier.png" className="h-32 mb-6" alt="Max" />
            <h3 className="text-purple-500 font-black uppercase tracking-[0.2em] mb-2">Max Unlimited</h3>
            <div className="text-4xl font-black mb-6">$9.99</div>
            <ul className="text-xs text-purple-100/60 mb-8 space-y-2 flex-1">
              <li>• Unlimited Access</li>
              <li>• Identity Theft Ins.</li>
            </ul>
            <a href="https://buy.stripe.com/YOUR_MAX_LINK" className="w-full py-4 border border-purple-500 text-purple-400 rounded font-bold uppercase text-xs tracking-widest text-center">Go Max</a>
          </div>

        </div>
      </section>

      <footer className="py-20 text-center text-gray-600 text-xs tracking-widest uppercase font-bold border-t border-white/5">
        &copy; 2026 LYLO Security Systems.
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
