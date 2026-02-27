import React, { useState, useEffect } from 'react';

const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

export interface PersonaConfig {
  id: string;
  name: string;
  color: string;
  iconName: string;
  description: string;
  systemInstruction: string;
  requiredTier: 'free' | 'pro' | 'elite' | 'max';
}

export const personas: PersonaConfig[] = [
  { id: 'guardian',  name: 'The Guardian',       color: 'blue',   iconName: 'Shield',        description: 'Protective Security Expert',        systemInstruction: 'You are The Guardian.',            requiredTier: 'free'  },
  { id: 'doctor',    name: 'The Doctor',          color: 'green',  iconName: 'Stethoscope',   description: 'Medical Advisor & Health Expert',    systemInstruction: 'You are The Doctor.',              requiredTier: 'pro'   },
  { id: 'lawyer',    name: 'The Lawyer',          color: 'yellow', iconName: 'Scale',         description: 'Legal Advisor & Risk Analyst',       systemInstruction: 'You are The Lawyer.',              requiredTier: 'pro'   },
  { id: 'wealth',    name: 'Wealth Architect',    color: 'gold',   iconName: 'TrendingUp',    description: 'Financial Strategist',               systemInstruction: 'You are the Wealth Architect.',   requiredTier: 'pro'   },
  { id: 'therapist', name: 'The Therapist',       color: 'pink',   iconName: 'Heart',         description: 'Mental Health & Emotional Support',  systemInstruction: 'You are The Therapist.',          requiredTier: 'pro'   },
  { id: 'career',    name: 'Career Coach',        color: 'orange', iconName: 'Briefcase',     description: 'Career Growth & Job Expert',         systemInstruction: 'You are the Career Coach.',       requiredTier: 'pro'   },
  { id: 'tutor',     name: 'The Tutor',           color: 'purple', iconName: 'BookOpen',      description: 'Education & Learning Expert',        systemInstruction: 'You are The Tutor.',              requiredTier: 'pro'   },
  { id: 'vitality',  name: 'Vitality Coach',      color: 'lime',   iconName: 'Dumbbell',      description: 'Fitness & Wellness Expert',          systemInstruction: 'You are the Vitality Coach.',     requiredTier: 'pro'   },
  { id: 'hype',      name: 'Hype Engine',         color: 'red',    iconName: 'Zap',           description: 'Motivation & Mindset Expert',        systemInstruction: 'You are the Hype Engine.',        requiredTier: 'pro'   },
  { id: 'bestie',    name: 'The Bestie',          color: 'cyan',   iconName: 'MessageCircle', description: 'Your Trusted Friend & Confidant',    systemInstruction: 'You are The Bestie.',             requiredTier: 'elite' },
  { id: 'pastor',    name: 'The Pastor',          color: 'amber',  iconName: 'BookMarked',    description: 'Spiritual Advisor & Faith Guide',    systemInstruction: 'You are The Pastor.',             requiredTier: 'pro'   },
  { id: 'mechanic',  name: 'The Mechanic',        color: 'gray',   iconName: 'Wrench',        description: 'Auto Expert & Car Enthusiast',       systemInstruction: 'You are The Mechanic.',           requiredTier: 'pro'   },
];

interface LayoutProps {
  children: React.ReactNode;
  currentPersona: any;
  onPersonaChange: (persona: PersonaConfig) => void;
  userEmail: string;
  onUsageUpdate?: () => void;
}

export default function Layout({
  children,
  currentPersona,
  onPersonaChange
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [icons, setIcons] = useState<any>(null);

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  const activePersonaId = typeof currentPersona === 'string' ? currentPersona : currentPersona?.id;

  const getPersonaIcon = (iconName: string) => {
    if (!icons) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-6 h-6" /> : null;
  };

  const tierColors: Record<string, string> = {
    free:  'text-gray-400',
    pro:   'text-blue-400',
    elite: 'text-purple-400',
    max:   'text-yellow-400',
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-black/95 border-r border-white/10
        transition-transform duration-300 ease-in-out w-72 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:w-20 md:hover:w-72 md:group
      `}>

        {/* Header */}
        <div className="p-4 flex items-center gap-4 border-b border-white/10 h-16">
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            {icons?.X && <icons.X className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="font-bold text-xl tracking-wider md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap italic text-white uppercase">
              LYLO<span className="text-blue-500">.</span>PRO
            </span>
          </div>
        </div>

        {/* Persona List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                onPersonaChange(persona);
                setSidebarOpen(false);
              }}
              className={`
                w-full p-3 rounded-xl flex items-center gap-4 transition-all border
                ${activePersonaId === persona.id
                  ? 'bg-white/10 border-white/20 text-white shadow-lg'
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }
              `}
            >
              <div className={`flex-shrink-0 ${activePersonaId === persona.id ? 'text-blue-400' : ''}`}>
                {getPersonaIcon(persona.iconName)}
              </div>
              <div className="text-left whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                <div className="font-bold text-sm uppercase tracking-widest">{persona.name}</div>
                <div className={`text-xs mt-0.5 ${tierColors[persona.requiredTier]}`}>
                  {persona.requiredTier.toUpperCase()}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative w-full">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-black border-b border-white/10 flex items-center px-4 gap-4 flex-shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-white bg-white/5 rounded-lg border border-white/10"
          >
            {icons?.Menu && <icons.Menu className="w-6 h-6" />}
          </button>
          <span className="font-bold text-lg tracking-tighter italic uppercase text-white">
            LYLO<span className="text-blue-500">.</span>PRO
          </span>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
