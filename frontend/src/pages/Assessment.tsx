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
  const navigate = useNavigate();

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  const completeAssessment = async () => {
    setIsCompleting(true);
    
    if (!userEmail || !userEmail.includes('@')) {
      alert('Please enter a valid email address');
      setIsCompleting(false);
      return;
    }
    
    // 1. SAVE BASIC DATA
    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_selected_persona', selectedPersona);
    localStorage.setItem('lylo_user_email', userEmail.toLowerCase().trim());
    localStorage.setItem('lylo_user_tier', selectedTier);
    localStorage.setItem('lylo_assessment_complete', 'true');

    // 2. THE SECURITY FIX: SET VIP STAMPS
    // Hardcode your VIPs here so they always get in
    const vips = ['laura@startupsac.org', 'christopher@example.com']; // UPDATE WITH YOUR REAL EMAIL
    
    const isVip = vips.includes(userEmail.toLowerCase().trim());

    if (isVip || selectedTier === 'elite') {
      localStorage.setItem('isEliteUser', 'true');
      localStorage.setItem('isBetaTester', 'true');
    } else if (selectedTier === 'pro') {
      localStorage.setItem('isEliteUser', 'false');
      localStorage.setItem('isBetaTester', 'true');
    } else {
      // For Free tier strangers, we keep them as false
      localStorage.setItem('isEliteUser', 'false');
      localStorage.setItem('isBetaTester', 'false');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    navigate('/dashboard');
  };

  const canProceed = () => {
    switch (step) {
      case 1: return userEmail.includes('@');
      case 2: return techLevel !== '';
      case 3: return selectedPersona !== '';
      case 4: return selectedTier !== '';
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
      cyan: 'border-cyan-400 bg-cyan-500/10 text-cyan-400',
      orange: 'border-orange-400 bg-orange-500/10 text-orange-400',
      purple: 'border-purple-400 bg-purple-500/10 text-purple-400',
      yellow: 'border-yellow-400 bg-yellow-500/10 text-yellow-400',
      red: 'border-red-400 bg-red-500/10 text-red-400',
      green: 'border-green-400 bg-green-500/10 text-green-400'
    };
    return colors[color as keyof typeof colors] || colors.cyan;
  };

  if (isCompleting) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center animate-pulse">
          <h2 className="text-2xl font-bold text-white mb-2">Activating LYLO</h2>
          <p className="text-gray-400">Initializing your personalized AI bodyguard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
        <h2 className="text-3xl font-bold mb-8 text-center">Step {step} of 4</h2>
        
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-xl text-center">What is your email?</h3>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full p-4 bg-white/5 border border-white/20 rounded-xl text-center"
              placeholder="email@example.com"
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
             {['beginner', 'intermediate', 'advanced'].map(lvl => (
               <button key={lvl} onClick={() => setTechLevel(lvl)} className={`p-4 rounded-xl border ${techLevel === lvl ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10'}`}>
                 {lvl.toUpperCase()}
               </button>
             ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-2 gap-4">
             {personas.map(p => (
               <button key={p.id} onClick={() => setSelectedPersona(p.id)} className={`p-4 rounded-xl border ${selectedPersona === p.id ? 'border-purple-400 bg-purple-400/10' : 'border-white/10'}`}>
                 {p.name}
               </button>
             ))}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4">
             {['free', 'pro', 'elite'].map(t => (
               <button key={t} onClick={() => setSelectedTier(t)} className={`p-4 rounded-xl border ${selectedTier === t ? 'border-green-400 bg-green-400/10' : 'border-white/10'}`}>
                 {t.toUpperCase()}
               </button>
             ))}
          </div>
        )}

        <div className="flex gap-4 mt-8">
          {step > 1 && <button onClick={() => setStep(step-1)} className="flex-1 p-4 bg-white/5 rounded-xl">Back</button>}
          <button 
            onClick={step < 4 ? () => setStep(step+1) : completeAssessment} 
            disabled={!canProceed()}
            className="flex-1 p-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold disabled:opacity-50"
          >
            {step < 4 ? 'Next' : 'Activate LYLO'}
          </button>
        </div>
      </div>
    </div>
  );
}
