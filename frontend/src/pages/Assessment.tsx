import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// --- VIP BYPASS LIST (DO NOT REMOVE) ---
const ELITE_USERS: Record<string, { tier: string; name: string }> = {
    "stangman9898@gmail.com": {"tier": "elite", "name": "Christopher"},
    "laura@startupsac.org": {"tier": "elite", "name": "Laura"},
    "paintonmynails80@gmail.com": {"tier": "elite", "name": "Aubrey"}
};

// --- STRIPE LINKS (UPDATED FOR 3-TIER MODEL) ---
// REPLACE THESE PLACEHOLDERS WITH YOUR NEW STRIPE LINKS
const STRIPE_LINKS = {
  pro: "https://buy.stripe.com/PLACEHOLDER_LINK_FOR_PRO_299", 
  elite: "https://buy.stripe.com/PLACEHOLDER_LINK_FOR_ELITE_1499",
  max: "https://buy.stripe.com/PLACEHOLDER_LINK_FOR_MAX_2999"
};

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [userEmail, setUserEmail] = useState('');
  const [selectedTier, setSelectedTier] = useState('free'); // Default to free
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check if they just returned from a successful Stripe payment
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const savedEmail = localStorage.getItem('lylo_user_email');
    
    if (paymentStatus === 'success' && savedEmail) {
      // Payment verified (via redirect) - Grant access
      localStorage.setItem('isBetaTester', 'true');
      localStorage.setItem('lylo_assessment_complete', 'true');
      navigate('/dashboard');
    }
  }, [searchParams, navigate]);

  const completeAssessment = async () => {
    if (!agreedToTerms) {
      alert("Please agree to the terms to proceed.");
      return;
    }

    const cleanEmail = userEmail.toLowerCase().trim();
    const vipData = ELITE_USERS[cleanEmail];
    
    // Save email immediately so it's there when they return from Stripe
    localStorage.setItem('lylo_user_email', cleanEmail);
    localStorage.setItem('lylo_user_tier', selectedTier);

    // 1. VIP BYPASS: If they are on the list, let them in for free (Elite status)
    if (vipData) {
      setIsCompleting(true);
      localStorage.setItem('isEliteUser', 'true');
      localStorage.setItem('isBetaTester', 'true');
      localStorage.setItem('lylo_user_name', vipData.name);
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigate('/dashboard');
      return;
    }

    // 2. PAID TIERS: Redirect to appropriate Stripe Link
    if (selectedTier === 'pro') {
      window.location.href = STRIPE_LINKS.pro;
      return;
    }
    if (selectedTier === 'elite') {
      window.location.href = STRIPE_LINKS.elite;
      return;
    }
    if (selectedTier === 'max') {
      window.location.href = STRIPE_LINKS.max;
      return;
    }

    // 3. FREE TIER: Let them in
    setIsCompleting(true);
    localStorage.setItem('isEliteUser', 'false');
    localStorage.setItem('isBetaTester', 'true');
    await new Promise(resolve => setTimeout(resolve, 1500));
    navigate('/dashboard');
  };

  const getTierDetails = (tier: string) => {
    switch(tier) {
      case 'free': return { price: '$0', desc: 'Basic Access', limit: 'Trial Mode' };
      case 'pro': return { price: '$2.99/mo', desc: 'Casual Protection', limit: '50 Msgs/mo' };
      case 'elite': return { price: '$14.99/mo', desc: 'Full Security', limit: '500 Msgs/mo' };
      case 'max': return { price: '$29.99/mo', desc: 'Unlimited Access', limit: 'Legal Bridge' };
      default: return { price: '', desc: '', limit: '' };
    }
  };

  if (isCompleting) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white italic uppercase font-black">Activating Protocol...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-xl bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-3xl shadow-2xl">
        <h2 className="text-3xl font-black mb-8 text-center uppercase italic tracking-tighter">LYLO <span className="text-blue-500">ACCESS</span></h2>
        
        {step === 1 && (
          <div className="space-y-6 text-center">
            <h3 className="text-xl font-bold">IDENTITY VERIFICATION</h3>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Enter email to verify account status</p>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full p-5 bg-white/5 border border-white/20 rounded-2xl text-center text-xl focus:border-blue-500 outline-none transition-colors"
              placeholder="YOUR EMAIL"
            />
            <button onClick={() => setStep(2)} disabled={!userEmail.includes('@')} className="w-full p-6 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest disabled:opacity-30 transition-all">CONTINUE</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl text-center font-bold uppercase tracking-widest text-xs opacity-50">Select Your Security Level</h3>
            
            <div className="grid gap-3">
              {['free', 'pro', 'elite', 'max'].map(tier => {
                const details = getTierDetails(tier);
                const isSelected = selectedTier === tier;
                
                return (
                  <button 
                    key={tier} 
                    onClick={() => setSelectedTier(tier)} 
                    className={`relative p-4 rounded-xl border flex justify-between items-center transition-all ${isSelected ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20 scale-[1.02]' : 'border-white/10 hover:bg-white/5'}`}
                  >
                    <div className="text-left">
                      <div className="font-black uppercase text-lg italic">{tier}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{details.desc}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{details.price}</div>
                      <div className={`text-[10px] font-bold uppercase ${tier === 'max' ? 'text-yellow-400' : 'text-blue-400'}`}>{details.limit}</div>
                    </div>
                    {isSelected && <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none"></div>}
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <input type="checkbox" id="legal" className="w-6 h-6 accent-blue-500" onChange={(e) => setAgreedToTerms(e.target.checked)} />
              <label htmlFor="legal" className="text-[10px] text-gray-500 uppercase leading-tight cursor-pointer select-none">
                I agree to the <a href="https://mylylo.pro/terms.html" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Terms</a> and <a href="https://mylylo.pro/privacy.html" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>.
              </label>
            </div>

            <button 
              onClick={completeAssessment} 
              disabled={!agreedToTerms} 
              className={`w-full p-6 rounded-2xl font-black uppercase tracking-widest transition-all ${!agreedToTerms ? 'bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl'}`}
            >
              {selectedTier === 'free' ? 'ACTIVATE FREE ACCESS' : `SUBSCRIBE TO ${selectedTier}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
