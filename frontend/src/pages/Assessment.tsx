import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// --- VIP BYPASS LIST (Every user now upgraded to MAX) ---
const ELITE_USERS: Record<string, { tier: string; name: string }> = {
    "stangman9898@gmail.com": {"tier": "max", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "max", "name": "Sandy"},
    "plabane916@gmail.com": {"tier": "max", "name": "Paul"},
    "nemeses1298@gmail.com": {"tier": "max", "name": "Eric"},
    "bearjcameron@icloud.com": {"tier": "max", "name": "Bear"},
    "jcgcbear@gmail.com": {"tier": "max", "name": "Gloria"},
    "laura@startupsac.org": {"tier": "max", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "max", "name": "Corie"},
    "chris.betatester1@gmail.com": {"tier": "max", "name": "James"},
    "chris.betatester2@gmail.com": {"tier": "max", "name": "Beta 2"},
    "chris.betatester3@gmail.com": {"tier": "max", "name": "Beta 3"},
    "chris.betatester4@gmail.com": {"tier": "max", "name": "Beta 4"},
    "chris.betatester5@gmail.com": {"tier": "max", "name": "Beta 5"},
    "chris.betatester6@gmail.com": {"tier": "max", "name": "Beta 6"},
    "chris.betatester7@gmail.com": {"tier": "max", "name": "Beta 7"},
    "chris.betatester8@gmail.com": {"tier": "max", "name": "Beta 8"},
    "chris.betatester9@gmail.com": {"tier": "max", "name": "Beta 9"},
    "chris.betatester10@gmail.com": {"tier": "max", "name": "Beta 10"},
    "chris.betatester11@gmail.com": {"tier": "max", "name": "Beta 11"},
    "chris.betatester12@gmail.com": {"tier": "max", "name": "Beta 12"},
    "chris.betatester13@gmail.com": {"tier": "max", "name": "Beta 13"},
    "chris.betatester14@gmail.com": {"tier": "max", "name": "Beta 14"},
    "chris.betatester15@gmail.com": {"tier": "max", "name": "Beta 15"},
    "chris.betatester16@gmail.com": {"tier": "max", "name": "Beta 16"},
    "chris.betatester17@gmail.com": {"tier": "max", "name": "Beta 17"},
    "chris.betatester18@gmail.com": {"tier": "max", "name": "Beta 18"},
    "chris.betatester19@gmail.com": {"tier": "max", "name": "Beta 19"},
    "chris.betatester20@gmail.com": {"tier": "max", "name": "Beta 20"}
};

// --- STRIPE LINKS ---
const STRIPE_LINKS = {
  pro: "https://buy.stripe.com/YOUR_PRO_199_LINK",
  elite: "https://buy.stripe.com/YOUR_ELITE_499_LINK",
  max: "https://buy.stripe.com/YOUR_MAX_999_LINK"
};

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [userEmail, setUserEmail] = useState('');
  const [selectedTier, setSelectedTier] = useState('free');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const savedEmail = localStorage.getItem('userEmail');
    
    if (paymentStatus === 'success' && savedEmail) {
      localStorage.setItem('lylo_assessment_complete', 'true');
      navigate('/dashboard');
    }
  }, [searchParams, navigate]);

  const completeAssessment = async () => {
    const cleanEmail = userEmail.toLowerCase().trim();
    const vipData = ELITE_USERS[cleanEmail];
    
    localStorage.setItem('userEmail', cleanEmail);

    // 1. IMMEDIATE VIP BYPASS (Straight to MAX)
    if (vipData) {
      setIsCompleting(true);
      localStorage.setItem('userTier', 'max'); 
      localStorage.setItem('userName', vipData.name);
      localStorage.setItem('isEliteUser', 'true');
      localStorage.setItem('isBetaTester', 'true');
      localStorage.setItem('lylo_assessment_complete', 'true'); // BRIDGE KEY
      
      // Short delay for "Initializing" feel
      await new Promise(resolve => setTimeout(resolve, 1200));
      navigate('/dashboard');
      return;
    }

    // If not a VIP, proceed to terms and tier selection
    if (step === 1) {
        setStep(2);
        return;
    }

    if (!agreedToTerms) {
      alert("Please agree to the terms to proceed.");
      return;
    }

    // 2. PAID TIERS (For non-VIPs)
    if (selectedTier === 'pro' || selectedTier === 'elite' || selectedTier === 'max') {
      localStorage.setItem('userTier', selectedTier);
      let stripeUrl = STRIPE_LINKS.pro;
      if (selectedTier === 'elite') stripeUrl = STRIPE_LINKS.elite;
      if (selectedTier === 'max') stripeUrl = STRIPE_LINKS.max;

      window.location.href = stripeUrl;
      return;
    }

    // 3. FREE TIER
    setIsCompleting(true);
    localStorage.setItem('userTier', 'free');
    localStorage.setItem('userName', cleanEmail.split('@')[0]);
    localStorage.setItem('isEliteUser', 'false');
    localStorage.setItem('lylo_assessment_complete', 'true');
    await new Promise(resolve => setTimeout(resolve, 1500));
    navigate('/dashboard');
  };

  if (isCompleting) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white italic uppercase font-black tracking-tighter">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        Initializing MAX Protocol...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-3xl shadow-2xl">
        <h2 className="text-3xl font-black mb-8 text-center uppercase italic tracking-tighter">LYLO <span className="text-blue-500">GATED ACCESS</span></h2>
        
        {step === 1 && (
          <div className="space-y-6 text-center">
            <h3 className="text-xl font-bold uppercase tracking-widest opacity-70">Identity Verification</h3>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full p-5 bg-white/5 border border-white/20 rounded-2xl text-center text-xl focus:border-blue-500 outline-none transition-all"
              placeholder="ENTER EMAIL"
            />
            <button 
              onClick={completeAssessment} 
              disabled={!userEmail.includes('@')} 
              className="w-full p-6 bg-blue-600 rounded-2xl font-black uppercase tracking-widest disabled:opacity-30 hover:bg-blue-500 transition-all shadow-xl"
            >
              AUTHENTICATE
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-center font-bold uppercase tracking-widest text-xs opacity-50">Select Tier</h3>
            <div className="grid gap-4">
              
              <button onClick={() => setSelectedTier('free')} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedTier === 'free' ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-white/10'}`}>
                <div>
                  <div className="font-black">BASIC</div>
                  <div className="text-[10px] opacity-70">5 Scans Daily</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$0</div>
                  <div className="text-[10px] text-gray-400 italic">Limited</div>
                </div>
              </button>

              <button onClick={() => setSelectedTier('pro')} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedTier === 'pro' ? 'border-blue-400 bg-blue-400/10 shadow-[0_0_20px_rgba(96,165,250,0.2)]' : 'border-white/10'}`}>
                <div>
                  <div className="font-black text-blue-400">PRO</div>
                  <div className="text-[10px] opacity-70">50 Scans Daily</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$1.99</div>
                  <div className="text-[10px] text-blue-400">Impulse Buy</div>
                </div>
              </button>

              <button onClick={() => setSelectedTier('elite')} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedTier === 'elite' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-white/10'}`}>
                 <div>
                  <div className="font-black text-amber-500 uppercase italic">Elite</div>
                  <div className="text-[10px] opacity-70">500 Scans Daily</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-500">$4.99</div>
                  <div className="text-[10px] text-amber-600">Power User</div>
                </div>
              </button>

              <button onClick={() => setSelectedTier('max')} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedTier === 'max' ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'border-white/10'}`}>
                 <div>
                  <div className="font-black text-purple-400">MAX</div>
                  <div className="text-[10px] opacity-70">Unlimited* Experience</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-purple-400">$9.99</div>
                  <div className="text-[10px] text-purple-500 italic">No Limits</div>
                </div>
              </button>

            </div>

            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <input 
                type="checkbox" 
                id="legal" 
                className="w-6 h-6 rounded border-white/20 bg-transparent text-blue-600 focus:ring-blue-500" 
                onChange={(e) => setAgreedToTerms(e.target.checked)} 
              />
              <label htmlFor="legal" className="text-[10px] text-gray-500 uppercase leading-tight">
                I agree to the <a href="https://mylylo.pro/terms.html" target="_blank" rel="noreferrer" className="text-blue-400">Terms</a> and <a href="https://mylylo.pro/privacy.html" target="_blank" rel="noreferrer" className="text-blue-400">Privacy Policy</a>.
              </label>
            </div>

            <button 
              onClick={completeAssessment} 
              disabled={!agreedToTerms} 
              className="w-full p-6 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 transition-all rounded-2xl font-black uppercase tracking-widest disabled:opacity-30 shadow-xl"
            >
              {selectedTier === 'free' ? 'ACTIVATE SHIELD' : `SECURE ${selectedTier.toUpperCase()} PROTECTION`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
