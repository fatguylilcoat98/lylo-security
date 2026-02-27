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
  { id: 'guardian',  name: 'The Guardian',      color: 'blue',   iconName: 'Shield',        description: 'Protective Security Expert',       systemInstruction: 'You are The Guardian.',          requiredTier: 'free'  },
  { id: 'doctor',    name: 'The Doctor',         color: 'green',  iconName: 'Stethoscope',   description: 'Medical Advisor & Health Expert',  systemInstruction: 'You are The Doctor.',            requiredTier: 'pro'   },
  { id: 'lawyer',    name: 'The Lawyer',         color: 'yellow', iconName: 'Scale',         description: 'Legal Advisor & Risk Analyst',     systemInstruction: 'You are The Lawyer.',            requiredTier: 'pro'   },
  { id: 'wealth',    name: 'Wealth Architect',   color: 'gold',   iconName: 'TrendingUp',    description: 'Financial Strategist',             systemInstruction: 'You are the Wealth Architect.', requiredTier: 'pro'   },
  { id: 'therapist', name: 'The Therapist',      color: 'pink',   iconName: 'Heart',         description: 'Mental Health Support',            systemInstruction: 'You are The Therapist.',         requiredTier: 'pro'   },
  { id: 'career',    name: 'Career Coach',       color: 'orange', iconName: 'Briefcase',     description: 'Career Growth Expert',             systemInstruction: 'You are the Career Coach.',      requiredTier: 'pro'   },
  { id: 'tutor',     name: 'The Tutor',          color: 'purple', iconName: 'BookOpen',      description: 'Education & Learning Expert',      systemInstruction: 'You are The Tutor.',             requiredTier: 'pro'   },
  { id: 'vitality',  name: 'Vitality Coach',     color: 'lime',   iconName: 'Dumbbell',      description: 'Fitness & Wellness Expert',        systemInstruction: 'You are the Vitality Coach.',   requiredTier: 'pro'   },
  { id: 'hype',      name: 'Hype Engine',        color: 'red',    iconName: 'Zap',           description: 'Motivation & Mindset',             systemInstruction: 'You are the Hype Engine.',      requiredTier: 'pro'   },
  { id: 'bestie',    name: 'The Bestie',         color: 'cyan',   iconName: 'MessageCircle', description: 'Your Trusted Confidant',           systemInstruction: 'You are The Bestie.',            requiredTier: 'elite' },
  { id: 'pastor',    name: 'The Pastor',         color: 'amber',  iconName: 'BookMarked',    description: 'Spiritual Advisor',                systemInstruction: 'You are The Pastor.',            requiredTier: 'pro'   },
  { id: 'mechanic',  name: 'The Mechanic',       color: 'gray',   iconName: 'Wrench',        description: 'Auto Expert',                      systemInstruction: 'You are The Mechanic.',          requiredTier: 'pro'   },
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { importIcons().then(setIcons); }, []);

  const activePersonaId = typeof currentPersona === 'string' ? currentPersona : currentPersona?.id;

  const getIcon = (iconName: string) => {
    if (!icons) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : null;
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-black/95 border-r border-white/10
        transition-all duration-300 ease-in-out flex flex-col
        ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
        md:relative md:translate-x-0 md:w-16 md:hover:w-64 md:group
      `}>

        {/* Header */}
        <div className="p-3 flex items-center gap-3 border-b border-white/10 h-14 overflow-hidden">
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-white">
            {icons?.X && <icons.X className="w-5 h-5" />}
          </button>
          <span className="font-bold text-lg tracking-wider italic text-white uppercase whitespace-nowrap
            md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            LYLO<span className="text-blue-500">.</span>PRO
          </span>
        </div>

        {/* Persona list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {personas.map((persona) => {
            const isActive = activePersonaId === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => { onPersonaChange(persona); setSidebarOpen(false); }}
                onMouseEnter={() => setHoveredId(persona.id)}
                onMouseLeave={() => setHoveredId(null)}
                title={persona.name}
                className={`
                  w-full p-2.5 rounded-xl flex items-center gap-3 transition-all border
                  ${isActive
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200'
                  }
                `}
              >
                {/* Icon — always visible */}
                <div className={`flex-shrink-0 w-5 h-5 ${isActive ? 'text-blue-400' : ''}`}>
                  {getIcon(persona.iconName)}
                </div>

                {/* Name — visible on hover/expand */}
                <div className="text-left overflow-hidden whitespace-nowrap
                  md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                  <div className="font-semibold text-sm">{persona.name}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    {persona.requiredTier}
                  </div>
                </div>

                {/* Active dot */}
                {isActive && (
                  <div className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400
                    md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden h-14 bg-black border-b border-white/10 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 text-white bg-white/5 rounded-lg border border-white/10">
            {icons?.Menu && <icons.Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-lg italic uppercase text-white">
            LYLO<span className="text-blue-500">.</span>PRO
          </span>
        </div>
        <div className="flex-1 relative overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
