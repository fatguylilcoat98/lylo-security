import React, { useState, useEffect } from 'react';

const importIcons = async () => {
  try { return await import('lucide-react'); } catch { return null; }
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
  { id: 'guardian',  name: 'The Guardian',     color: 'blue',   iconName: 'Shield',        description: 'Protective Security Expert',  systemInstruction: 'You are The Guardian.',          requiredTier: 'free'  },
  { id: 'doctor',    name: 'The Doctor',        color: 'green',  iconName: 'Stethoscope',   description: 'Medical Advisor',             systemInstruction: 'You are The Doctor.',            requiredTier: 'pro'   },
  { id: 'lawyer',    name: 'The Lawyer',        color: 'yellow', iconName: 'Scale',         description: 'Legal Advisor',               systemInstruction: 'You are The Lawyer.',            requiredTier: 'pro'   },
  { id: 'wealth',    name: 'Wealth Architect',  color: 'gold',   iconName: 'TrendingUp',    description: 'Financial Strategist',        systemInstruction: 'You are the Wealth Architect.', requiredTier: 'pro'   },
  { id: 'therapist', name: 'The Therapist',     color: 'pink',   iconName: 'Heart',         description: 'Mental Health Support',       systemInstruction: 'You are The Therapist.',         requiredTier: 'pro'   },
  { id: 'career',    name: 'Career Coach',      color: 'orange', iconName: 'Briefcase',     description: 'Career Growth Expert',        systemInstruction: 'You are the Career Coach.',      requiredTier: 'pro'   },
  { id: 'tutor',     name: 'The Tutor',         color: 'purple', iconName: 'BookOpen',      description: 'Education Expert',            systemInstruction: 'You are The Tutor.',             requiredTier: 'pro'   },
  { id: 'vitality',  name: 'Vitality Coach',    color: 'lime',   iconName: 'Dumbbell',      description: 'Fitness & Wellness',          systemInstruction: 'You are the Vitality Coach.',   requiredTier: 'pro'   },
  { id: 'hype',      name: 'Hype Engine',       color: 'red',    iconName: 'Zap',           description: 'Motivation & Mindset',        systemInstruction: 'You are the Hype Engine.',      requiredTier: 'pro'   },
  { id: 'bestie',    name: 'The Bestie',        color: 'cyan',   iconName: 'MessageCircle', description: 'Your Trusted Confidant',      systemInstruction: 'You are The Bestie.',            requiredTier: 'elite' },
  { id: 'pastor',    name: 'The Pastor',        color: 'amber',  iconName: 'BookMarked',    description: 'Spiritual Advisor',           systemInstruction: 'You are The Pastor.',            requiredTier: 'pro'   },
  { id: 'mechanic',  name: 'The Mechanic',      color: 'gray',   iconName: 'Wrench',        description: 'Auto Expert',                 systemInstruction: 'You are The Mechanic.',          requiredTier: 'pro'   },
];

interface LayoutProps {
  children: React.ReactNode;
  currentPersona: any;
  onPersonaChange: (persona: PersonaConfig) => void;
  userEmail: string;
  onUsageUpdate?: () => void;
}

export default function Layout({ children, currentPersona, onPersonaChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [icons, setIcons] = useState<any>(null);

  useEffect(() => { importIcons().then(setIcons); }, []);

  const activePersonaId = typeof currentPersona === 'string' ? currentPersona : currentPersona?.id;

  const getIcon = (iconName: string) => {
    if (!icons) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : null;
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — always expanded on desktop, slide-in on mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-[#0a0a0a] border-r border-white/10 flex flex-col w-56
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>

        {/* Header */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between h-14">
          <span className="font-black text-base italic uppercase tracking-wider text-white">
            LYLO<span className="text-blue-500">.</span>PRO
          </span>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            {icons?.X && <icons.X className="w-4 h-4" />}
          </button>
        </div>

        {/* Persona list — names always visible */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {personas.map((persona) => {
            const isActive = activePersonaId === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => { onPersonaChange(persona); setSidebarOpen(false); }}
                className={`
                  w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all border text-left
                  ${isActive
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200'
                  }
                `}
              >
                <div className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
                  {getIcon(persona.iconName)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{persona.name}</div>
                </div>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden h-14 bg-black border-b border-white/10 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 text-white bg-white/5 rounded-lg border border-white/10">
            {icons?.Menu && <icons.Menu className="w-5 h-5" />}
          </button>
          <span className="font-black text-base italic uppercase text-white">
            LYLO<span className="text-blue-500">.</span>PRO
          </span>
        </div>
        <div className="flex-1 relative overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
