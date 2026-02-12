import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ELITE_USERS: Record<string, { tier: string; name: string }> = {
    "stangman9898@gmail.com": {"tier": "elite", "name": "Christopher"},
    "laura@startupsac.org": {"tier": "elite", "name": "Laura"},
    "paintonmynails80@gmail.com": {"tier": "elite", "name": "Aubrey"}
};

// STRIPE LINKS - REPLACE THESE WITH YOUR ACTUAL STRIPE LINKS
const STRIPE_LINKS = {
  pro: "https://buy.stripe.com/PLACEHOLDER_FOR_PRO_299",
  elite: "https://buy.stripe.com/PLACEHOLDER_FOR_ELITE_1499",
  max: "https://buy.stripe.com/PLACEHOLDER_FOR_MAX_2999"
};

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [userEmail, setUserEmail] = useState('');
  const [selectedTier, setSelectedTier] = useState('free');
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

    // 1. VIP BYPASS: If they are on the list, let them in for free
    if (vipData) {
      setIsCompleting(true);
      localStorage.setItem('isEliteUser', 'true');
      localStorage.setItem('isBetaTester', 'true');
      localStorage.setItem('lylo_user_name', vipData.name);
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigate('/dashboard');
      return;
    }

    // 2. PAID TIERS: If they picked Pro, Elite, or Max, send to Stripe
    if (selectedTier === 'pro' || selectedTier === 'elite' || selectedTier === 'max') {
      // @ts-ignore
      const stripeUrl = STRIPE_LINKS[selectedTier];
      window.location.href = stripeUrl;
      return;
    }

    // 3. FREE TIER: Let them in
    setIsCompleting(true);
    localStorage.setItem('isEliteUser', 'false');
    localStorage.setItem('isBetaTester', 'true');
    await new Promise(resolve => setTimeout(resolve, 1500));
    navigate('/dashboard');
  };

  const canProceed = () => {
    if (step === 1) return userEmail.includes('@');
    if (step === 2) return selectedTier !== '' && agreedToTerms;
    return false;
  };

  if (isCompleting) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white italic uppercase font-black">Activating Protocol...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-3xl shadow-2xl">
        <h2 className="text-3xl font-black mb-8 text-center uppercase italic tracking-tighter">LYLO <span className="text-blue-500">GATED ACCESS</span></h2>
        
        {step === 1 && (
          <div className="space-y-6 text-center">
            <h3 className="text-xl font-bold">IDENTITY VERIFICATION</h3>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full p-5 bg-white/5 border border-white/20 rounded-2xl text-center text-xl focus:border-blue-500 outline-none"
              placeholder="YOUR EMAIL"
            />
            <button onClick={() => setStep(2)} disabled={!userEmail.includes('@')} className="w-full p-6 bg-blue-600 rounded-2xl font-black uppercase tracking-widest disabled:opacity-30">CONTINUE</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl text-center font-bold uppercase tracking-widest text-xs opacity-50">Select Tier</h3>
            <div className="grid gap-4">
              {/* FREE TIER */}
              <button onClick={() => setSelectedTier('free')} className={`p-4 rounded-xl border text-left flex justify-between items-center ${selectedTier === 'free' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}`}>
                <div>
                  <div className="font-black">FREE</div>
                  <div className="text-[10px] opacity-70">Standard Access</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$0</div>
                  <div className="text-[10px] text-gray-400">Trial Mode</div>
                </div>
              </button>

              {/* PRO TIER */}
              <button onClick={() => setSelectedTier('pro')} className={`p-4 rounded-xl border text-left flex justify-between items-center ${selectedTier === 'pro' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}`}>
                <div>
                  <div className="font-black">PRO</div>
                  <div className="text-[10px] opacity-70">Casual Protection</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$2.99</div>
                  <div className="text-[10px] text-blue-400">50 Msgs/mo</div>
                </div>
              </button>

              {/* ELITE TIER */}
              <button onClick={() => setSelectedTier('elite')} className={`p-4 rounded-xl border text-left flex justify-between items-center ${selectedTier === 'elite' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}`}>
                 <div>
                  <div className="font-black">ELITE</div>
                  <div className="text-[10px] opacity-70">Full Security</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$14.99</div>
                  <div className="text-[10px] text-blue-400">500 Msgs/mo</div>
                </div>
              </button>

              {/* MAX TIER */}
              <button onClick={() => setSelectedTier('max')} className={`p-4 rounded-xl border text-left flex justify-between items-center ${selectedTier === 'max' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}`}>
                 <div>
                  <div className="font-black text-yellow-400">MAX</div>
                  <div className="text-[10px] opacity-70">Unlimited Access</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$29.99</div>
                  <div className="text-[10px] text-yellow-400">Legal Bridge</div>
                </div>
              </button>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <input type="checkbox" id="legal" className="w-6 h-6" onChange={(e) => setAgreedToTerms(e.target.checked)} />
              <label htmlFor="legal" className="text-[10px] text-gray-500 uppercase leading-tight">
                I agree to the <a href="https://mylylo.pro/terms.html" target="_blank" className="text-blue-400">Terms</a> and <a href="https://mylylo.pro/privacy.html" target="_blank" className="text-blue-400">Privacy Policy</a>.
              </label>
            </div>

            <button onClick={completeAssessment} disabled={!agreedToTerms} className="w-full p-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-black uppercase">
              {selectedTier === 'free' ? 'ACTIVATE' : `PURCHASE ${selectedTier.toUpperCase()}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
