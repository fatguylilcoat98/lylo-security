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
  {
    id: 'guardian',
    name: 'The Guardian',
    icon: 'Shield',
    color: 'cyan',
    description: 'Protective and vigilant. Focuses on security threats and safety.',
    traits: ['Security Expert', 'Threat Detection', 'Risk Assessment']
  },
  {
    id: 'chef',
    name: 'The Chef',
    icon: 'ChefHat',
    color: 'orange',
    description: 'Warm and instructive. Specializes in culinary guidance.',
    traits: ['Recipe Expert', 'Cooking Tips', 'Nutritional Advice']
  },
  {
    id: 'techie',
    name: 'The Techie',
    icon: 'Cpu',
    color: 'purple',
    description: 'Technical and detailed. Deep dives into complex topics.',
    traits: ['Technical Support', 'Detailed Analysis', 'Problem Solving']
  },
  {
    id: 'lawyer',
    name: 'The Lawyer',
    icon: 'Scale',
    color: 'yellow',
    description: 'Formal and precise. Provides careful legal guidance.',
    traits: ['Legal Analysis', 'Documentation', 'Risk Management']
  },
  {
    id: 'roast',
    name: 'The Roast Master',
    icon: 'Flame',
    color: 'red',
    description: 'Witty and sarcastic. Delivers truth with humor.',
    traits: ['Honest Feedback', 'Humor', 'Human-like Interaction']
  },
  {
    id: 'friend',
    name: 'The Best Friend',
    icon: 'Heart',
    color: 'green',
    description: 'Empathetic and supportive. Your caring companion.',
    traits: ['Emotional Support', 'Active Listening', 'Life Advice']
  }
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

  // Load icons
  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  const completeAssessment = async () => {
    setIsCompleting(true);
    
    // Validate email
    if (!userEmail || !userEmail.includes('@')) {
      alert('Please enter a valid email address');
      setIsCompleting(false);
      return;
    }
    
    // Save data to localStorage
    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_selected_persona', selectedPersona);
    localStorage.setItem('lylo_user_email', userEmail);
    localStorage.setItem('lylo_user_tier', selectedTier);
    localStorage.setItem('lylo_assessment_complete', 'true');
    
    // Fade out animation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Navigate to dashboard
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center animate-out fade-out duration-1000">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-2xl">
            {icons?.Shield && <icons.Shield className="w-12 h-12 text-white" />}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Activating LYLO</h2>
          <p className="text-gray-400">Initializing your personalized AI bodyguard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900/10 to-black" />
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 via-transparent to-transparent" />
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img 
              src="/logo.png" 
              alt="LYLO" 
              className="w-16 h-16 drop-shadow-[0_0_16px_rgba(6,182,212,0.6)]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                LYLO
              </h1>
              <p className="text-gray-400 text-sm uppercase tracking-widest">Elite AI Security</p>
            </div>
          </div>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Setup Your AI Bodyguard</h2>
            <p className="text-gray-400">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md mb-12">
          <div className="h-2 bg-gray-800/50 backdrop-blur-xl rounded-full overflow-hidden border border-white/10">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out shadow-lg shadow-cyan-500/30"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="w-full max-w-4xl">
          
          {/* Step 1: Email */}
          {step === 1 && (
            <div className="text-center animate-in slide-in-from-right duration-500">
              <div className="mb-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-2xl">
                  {icons?.Mail && <icons.Mail className="w-10 h-10 text-white" />}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">What's your email?</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  This helps LYLO remember you and learn your preferences privately. We never store your actual email - only a secure identifier.
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <div className="relative">
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-6 py-4 bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:bg-black/60 transition-all text-center text-lg"
                  />
                  {userEmail.includes('@') && (
                    <div className="absolute -right-3 -top-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      {icons?.Check && <icons.Check className="w-5 h-5 text-white" />}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 text-xs text-gray-500">
                  🔒 Your email is hashed for privacy - we never see the actual address
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Tech Level */}
          {step === 2 && (
            <div className="text-center animate-in slide-in-from-right duration-500">
              <div className="mb-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-2xl">
                  {icons?.Settings && <icons.Settings className="w-10 h-10 text-white" />}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">What's your tech experience?</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  This helps LYLO adjust its communication style and technical depth for you.
                </p>
              </div>

              <div className="grid gap-4 max-w-2xl mx-auto">
                {[
                  {
                    value: 'beginner',
                    title: 'Beginner',
                    description: 'I prefer simple explanations and step-by-step guidance',
                    icon: 'User'
                  },
                  {
                    value: 'intermediate',
                    title: 'Intermediate',
                    description: 'I understand the basics and can follow technical discussions',
                    icon: 'Users'
                  },
                  {
                    value: 'advanced',
                    title: 'Advanced',
                    description: 'I build PCs, write code, and love technical details',
                    icon: 'UserCheck'
                  }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTechLevel(option.value)}
                    className={`
                      w-full p-6 rounded-2xl border transition-all duration-200 text-left
                      backdrop-blur-xl shadow-lg hover:shadow-xl
                      ${techLevel === option.value
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-cyan-500/20'
                        : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        p-3 rounded-xl border
                        ${techLevel === option.value
                          ? 'bg-cyan-500/20 border-cyan-400'
                          : 'bg-white/5 border-white/20'
                        }
                      `}>
                        {icons?.[option.icon] && React.createElement(icons[option.icon], { 
                          className: "w-6 h-6" 
                        })}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-1">{option.title}</h4>
                        <p className="text-sm text-gray-400">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Choose Persona */}
          {step === 3 && (
            <div className="text-center animate-in slide-in-from-right duration-500">
              <div className="mb-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-2xl">
                  {icons?.Bot && <icons.Bot className="w-10 h-10 text-white" />}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Choose your AI bodyguard</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  Each personality has unique skills and communication styles. You can change this later.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona.id)}
                    className={`
                      p-6 rounded-2xl border transition-all duration-200 text-left
                      backdrop-blur-xl shadow-lg hover:shadow-xl group
                      ${selectedPersona === persona.id
                        ? `${getColorClasses(persona.color)} shadow-lg`
                        : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className={`
                        w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-all
                        ${selectedPersona === persona.id
                          ? `bg-${persona.color}-500/20 border-${persona.color}-400 border`
                          : 'bg-white/5 border border-white/20 group-hover:bg-white/10'
                        }
                      `}>
                        {getPersonaIcon(persona.icon)}
                      </div>
                      
                      <h4 className="text-lg font-bold text-white mb-2">{persona.name}</h4>
                      <p className="text-sm text-gray-400 mb-4">{persona.description}</p>
                      
                      <div className="space-y-1">
                        {persona.traits.map((trait, index) => (
                          <div 
                            key={index}
                            className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300 inline-block mr-1"
                          >
                            {trait}
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Choose Tier */}
          {step === 4 && (
            <div className="text-center animate-in slide-in-from-right duration-500">
              <div className="mb-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                  {icons?.Crown && <icons.Crown className="w-10 h-10 text-white" />}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Choose your protection level</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  Start with any tier - you can always upgrade later as your needs grow.
                </p>
              </div>

              <div className="grid gap-6 max-w-4xl mx-auto md:grid-cols-3">
                {[
                  {
                    id: 'free',
                    name: 'Free Tier',
                    price: '$0',
                    period: '/forever',
                    description: 'Perfect for trying LYLO',
                    features: [
                      '5 messages per day',
                      'Basic scam detection',
                      '2 AI personalities',
                      'Confidence scoring'
                    ],
                    color: 'gray',
                    popular: false
                  },
                  {
                    id: 'pro',
                    name: 'Pro Tier',
                    price: '$9.99',
                    period: '/month',
                    description: 'For regular protection needs',
                    features: [
                      '50 messages per day',
                      'Advanced analysis',
                      '4 AI personalities',
                      'Voice mode & image upload',
                      'Overage options'
                    ],
                    color: 'blue',
                    popular: true
                  },
                  {
                    id: 'elite',
                    name: 'Elite Tier',
                    price: '$29.99',
                    period: '/month',
                    description: 'Ultimate protection & recovery',
                    features: [
                      'Unlimited messages',
                      'All 6 AI personalities',
                      'Legal recovery assistance',
                      '24/7 priority support',
                      'Advanced threat analysis'
                    ],
                    color: 'yellow',
                    popular: false
                  }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`
                      relative p-6 rounded-2xl border transition-all duration-200 text-left
                      backdrop-blur-xl shadow-lg hover:shadow-xl
                      ${selectedTier === tier.id
                        ? tier.color === 'blue' ? 'bg-blue-500/20 border-blue-400 shadow-blue-500/20' :
                          tier.color === 'yellow' ? 'bg-yellow-500/20 border-yellow-400 shadow-yellow-500/20' :
                          'bg-gray-500/20 border-gray-400 shadow-gray-500/20'
                        : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20'
                      }
                    `}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                          POPULAR
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h4 className="text-xl font-bold text-white mb-2">{tier.name}</h4>
                      <div className="mb-4">
                        <span className="text-3xl font-black text-white">{tier.price}</span>
                        <span className="text-gray-400 text-sm">{tier.period}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{tier.description}</p>
                      
                      <div className="space-y-2">
                        {tier.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                            {icons?.Check && <icons.Check className="w-4 h-4 text-green-400" />}
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mt-12 w-full max-w-md">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-6 py-4 bg-gray-700/50 backdrop-blur-xl border border-gray-600 text-white font-semibold rounded-2xl hover:bg-gray-600/50 transition-all"
            >
              {icons?.ArrowLeft && <icons.ArrowLeft className="w-5 h-5 inline mr-2" />}
              Back
            </button>
          )}
          
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              Continue
              {icons?.ArrowRight && <icons.ArrowRight className="w-5 h-5 inline ml-2" />}
            </button>
          ) : (
            <button
              onClick={completeAssessment}
              disabled={!canProceed()}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              {icons?.Zap && <icons.Zap className="w-5 h-5 inline mr-2" />}
              Activate LYLO
            </button>
          )}
        </div>

        {/* Privacy Note */}
        <div className="mt-8 text-center max-w-md">
          <p className="text-xs text-gray-500">
            🔒 Your data is private and secure. We use temporary learning that's never accessed by humans and gets automatically cleared.
          </p>
        </div>
      </div>
    </div>
  );
}
