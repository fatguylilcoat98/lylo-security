import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Dynamic icon imports
const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

// YOUR BACKEND ELITE LIST INTEGRATED
const ELITE_USERS: Record<string, { tier: string; name: string }> = {
    "stangman9898@gmail.com": {"tier": "elite", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "elite", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "elite", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "elite", "name": "Jeff"},
    "jcgcbear@gmail.com": {"tier": "elite", "name": "Gloria"},
    "laura@startupsac.org": {"tier": "elite", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "elite", "name": "Corie"}
};

const personas = [
  { id: 'guardian', name: 'The Guardian', icon: 'Shield', color: 'cyan', description: 'Protective and vigilant.', traits: ['Security Expert', 'Threat Detection'] },
  { id: 'chef', name: 'The Chef', icon: 'ChefHat', color: 'orange', description: 'Warm and instructive.', traits: ['Recipe Expert', 'Cooking Tips'] },
  { id: 'techie', name: 'The Techie', icon: 'Cpu', color: 'purple', description: 'Technical and detailed.', traits: ['Technical Support', 'Analysis'] },
  { id: 'lawyer', name: 'The Lawyer', icon: 'Scale', color: 'yellow', description: 'Formal and precise.', traits: ['Legal Analysis', 'Documentation'] },
  { id: 'roast', name: 'The Roast Master', icon: 'Flame', color: 'red', description: 'Witty and sarcastic.', traits: ['Honest Feedback', 'Humor'] },
  { id: 'friend', name: 'The Best Friend', icon: 'Heart', color: 'green', description: 'Empathetic and supportive.', traits: ['Emotional Support', 'Active Listening'] }
];

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [techLevel, setTechLevel] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [selectedTier, setSelectedTier] = useState('free');
  const [icons, setIcons] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false); // NEW LEGAL STATE
  const navigate = useNavigate();

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  const completeAssessment = async () => {
    // SECURITY CHECK: Must agree to terms
    if (!agreedToTerms) {
      alert("Please review and agree to the Terms of Service and Privacy Policy to activate LYLO.");
      return;
    }

    setIsCompleting(true);
    const cleanEmail = userEmail.toLowerCase().trim();
    const vipData = ELITE_USERS[cleanEmail];

    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_selected_persona', selectedPersona);
    localStorage.setItem('lylo_user_email', cleanEmail);
    localStorage.setItem('lylo_assessment_complete', 'true');

    if (vipData || selectedTier === 'elite') {
      localStorage.setItem('isEliteUser', 'true');
      localStorage.setItem('isBetaTester', 'true');
      localStorage.setItem('lylo_user_tier', 'elite');
      if (vipData) {
        localStorage.setItem('lylo_user_name', vipData.name);
      }
    } else {
      localStorage.setItem('isEliteUser', 'false');
      localStorage.setItem('isBetaTester', 'true'); 
      localStorage.setItem('lylo_user_tier', selectedTier);
      localStorage.setItem('lylo_user_name', 'User');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    navigate('/dashboard');
  };

  const canProceed = () => {
    switch (step) {
      case 1: return userEmail.includes('@');
      case 2: return techLevel !== '';
      case 3: return selectedPersona !== '';
      case 4: return selectedTier !== '' && agreedToTerms; // Must check box to finish
      default: return false;
    }
  };

  const getPersonaIcon = (iconName: string) => {
    if (!icons || !iconName) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-8 h-8" /> : null;
  };

  const getColorClasses = (color: string) => {
    const colors = {
      cyan: 'border-cyan-400 bg-cyan-500/10 text-cyan-400 shadow-cyan-500/20',
      orange: 'border-orange-400 bg-orange-500/10 text-orange-400 shadow-orange-500/20',
      purple: 'border-purple-400 bg-purple-500/10 text-purple-400 shadow-purple-500/20',
      yellow: 'border-yellow-400 bg-yellow-500/10 text-yellow-400 shadow-yellow-500/20',
      red: 'border-red-400 bg-red-500/10 text-red-400 shadow-red-500/20',
      green: 'border-green-400 bg-green-500/10 text-green-400 shadow-green-500/20'
    };
    return colors[color as keyof typeof colors] || colors.cyan;
  };

  if (isCompleting) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-6">
        <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center animate-pulse shadow-2xl">
          {icons?.Shield && <icons.Shield className="w-12 h-12 text-white" />}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter italic">Activating LYLO</h2>
        <p className="text-gray-400 uppercase tracking-widest text-[10px]">Syncing security profile for {userEmail}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-black/40 p-8 md:p-12 rounded-[2rem] border border-white/10 backdrop-blur-3xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2 italic uppercase">LYLO Protocol</h1>
          <p className="text-gray-500 uppercase tracking-widest text-sm">Step {step} of 4</p>
        </div>

        {step === 1 && (
          <div className="text-center space-y-6">
            <h3 className="text-2xl font-bold">Identity Verification</h3>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full max-w-md p-5 bg-white/5 border border-white/20 rounded-2xl text-center text-xl focus:border-cyan-400 outline-none transition-all"
              placeholder="name@email.com"
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-center mb-4 uppercase tracking-widest text-xs opacity-50">Tech Experience</h3>
            {['beginner', 'intermediate', 'advanced'].map(lvl => (
              <button key={lvl} onClick={() => setTechLevel(lvl)} className={`p-5 rounded-2xl border text-lg font-semibold transition-all ${techLevel === lvl ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {personas.map(p => (
               <button key={p.id} onClick={() => setSelectedPersona(p.id)} className={`p-6 rounded-2xl border text-left transition-all ${selectedPersona === p.id ? getColorClasses(p.color) : 'border-white/10 hover:bg-white/5'}`}>
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-xl">{getPersonaIcon(p.icon)}</div>
                    <div>
                      <div className="font-bold text-lg">{p.name}</div>
                      <div className="text-xs opacity-60">{p.description}</div>
                    </div>
                 </div>
               </button>
             ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-3">
               {['free', 'pro', 'elite'].map(t => (
                 <button key={t} onClick={() => setSelectedTier(t)} className={`p-8 rounded-3xl border text-center transition-all ${selectedTier === t ? 'border-green-400 bg-green-400/10' : 'border-white/10 hover:bg-white/5'}`}>
                   <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">{t}</div>
                   <div className="text-3xl font-black mb-2">{t === 'free' ? '$0' : t === 'pro' ? '$9.99' : '$29.99'}</div>
                   <div className="text-[10px] leading-tight text-gray-400 uppercase tracking-widest font-bold">Select Tier</div>
                 </button>
               ))}
            </div>

            {/* LEGAL CHECKBOX - SURGICAL ADDITION */}
            <div className="max-w-md mx-auto flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <input 
                type="checkbox" 
                id="legal-agree" 
                className="w-6 h-6 mt-1 rounded border-white/20 bg-black text-blue-500 focus:ring-blue-500" 
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <label htmlFor="legal-agree" className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">
                I agree to the <a href="https://mylylo.pro/terms.html" target="_blank" className="text-blue-500 underline">Terms of Service</a> and <a href="https://mylylo.pro/privacy.html" target="_blank" className="text-blue-500 underline">Privacy Policy</a>. I understand LYLO is an AI assistant and not a licensed legal professional.
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-12">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all uppercase tracking-widest text-xs">BACK</button>
          )}
          <button 
            onClick={step < 4 ? () => setStep(step + 1) : completeAssessment} 
            disabled={!canProceed()}
            className="flex-1 p-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-black shadow-lg shadow-cyan-500/20 disabled:opacity-30 disabled:grayscale transition-all uppercase tracking-widest"
          >
            {step < 4 ? 'CONTINUE' : 'ACTIVATE LYLO'}
          </button>
        </div>
      </div>
    </div>
  );
}
