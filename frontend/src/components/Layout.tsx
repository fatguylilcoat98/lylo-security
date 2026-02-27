import React, { useState, useEffect, useRef } from 'react';

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
  { id: 'guardian',  name: 'The Guardian',    color: '#00CFFF', iconName: 'Shield',        description: 'Protective Security Expert',  systemInstruction: 'You are The Guardian.',          requiredTier: 'free'  },
  { id: 'doctor',    name: 'The Doctor',       color: '#39FF14', iconName: 'Stethoscope',   description: 'Medical Advisor',             systemInstruction: 'You are The Doctor.',            requiredTier: 'pro'   },
  { id: 'lawyer',    name: 'The Lawyer',       color: '#FFD700', iconName: 'Scale',         description: 'Legal Advisor',               systemInstruction: 'You are The Lawyer.',            requiredTier: 'pro'   },
  { id: 'wealth',    name: 'Wealth Architect', color: '#F59E0B', iconName: 'TrendingUp',    description: 'Financial Strategist',        systemInstruction: 'You are the Wealth Architect.', requiredTier: 'pro'   },
  { id: 'therapist', name: 'The Therapist',    color: '#FF69B4', iconName: 'Heart',         description: 'Mental Health Support',       systemInstruction: 'You are The Therapist.',         requiredTier: 'pro'   },
  { id: 'career',    name: 'Career Coach',     color: '#FF6B35', iconName: 'Briefcase',     description: 'Career Growth Expert',        systemInstruction: 'You are the Career Coach.',      requiredTier: 'pro'   },
  { id: 'tutor',     name: 'The Tutor',        color: '#A78BFA', iconName: 'BookOpen',      description: 'Education Expert',            systemInstruction: 'You are The Tutor.',             requiredTier: 'pro'   },
  { id: 'vitality',  name: 'Vitality Coach',   color: '#00FF87', iconName: 'Dumbbell',      description: 'Fitness & Wellness',          systemInstruction: 'You are the Vitality Coach.',   requiredTier: 'pro'   },
  { id: 'hype',      name: 'Hype Engine',      color: '#FF1744', iconName: 'Zap',           description: 'Motivation & Mindset',        systemInstruction: 'You are the Hype Engine.',      requiredTier: 'pro'   },
  { id: 'bestie',    name: 'The Bestie',       color: '#CE93D8', iconName: 'MessageCircle', description: 'Your Trusted Confidant',      systemInstruction: 'You are The Bestie.',            requiredTier: 'elite' },
  { id: 'pastor',    name: 'The Pastor',       color: '#F9A825', iconName: 'BookMarked',    description: 'Spiritual Advisor',           systemInstruction: 'You are The Pastor.',            requiredTier: 'pro'   },
  { id: 'mechanic',  name: 'The Mechanic',     color: '#94A3B8', iconName: 'Wrench',        description: 'Auto Expert',                 systemInstruction: 'You are The Mechanic.',          requiredTier: 'pro'   },
];

interface LayoutProps {
  children: React.ReactNode;
  currentPersona: any;
  onPersonaChange: (persona: PersonaConfig) => void;
  userEmail: string;
  onUsageUpdate?: () => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
}

const FONT_SIZES = [
  { label: 'Small',   value: 14 },
  { label: 'Medium',  value: 16 },
  { label: 'Large',   value: 19 },
  { label: 'X-Large', value: 22 },
];

export default function Layout({ children, currentPersona, onPersonaChange, fontSize = 16, onFontSizeChange }: LayoutProps) {
  const [icons, setIcons]             = useState<any>(null);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hovered, setHovered]         = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { importIcons().then(setIcons); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const activeId    = typeof currentPersona === 'string' ? currentPersona : currentPersona?.id;
  const activeColor = personas.find(p => p.id === activeId)?.color ?? '#00CFFF';

  // Sidebar is "expanded" when: mobile drawer open OR desktop hovered
  const expanded = sidebarOpen || hovered;

  const getIcon = (name: string, cls = 'w-5 h-5') => {
    if (!icons) return null;
    const Icon = icons[name];
    return Icon ? <Icon className={cls} /> : null;
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans" style={{ fontSize }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          fixed inset-y-0 left-0 z-50 bg-[#080808] border-r border-white/10 flex flex-col
          transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${expanded ? 'w-56' : 'w-14'}
        `}
      >
        {/* Logo */}
        <div className="h-14 px-3 flex items-center border-b border-white/10 overflow-hidden">
          <span className="font-black text-base italic uppercase tracking-wider whitespace-nowrap select-none">
            <span className="text-white">L</span>
            <span style={{ color: activeColor }} className="transition-colors duration-300">Y</span>
            <span className={`text-white transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>LO.PRO</span>
          </span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden text-gray-400 hover:text-white">
            {getIcon('X', 'w-4 h-4')}
          </button>
        </div>

        {/* Persona list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {personas.map((persona) => {
            const isActive = activeId === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => { onPersonaChange(persona); setSidebarOpen(false); }}
                title={persona.name}
                className={`
                  w-full px-2 py-2.5 rounded-xl flex items-center gap-3 transition-all border text-left
                  ${isActive
                    ? 'bg-white/10 border-white/15 text-white'
                    : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200'
                  }
                `}
              >
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
                  style={{ color: isActive ? persona.color : undefined }}>
                  {getIcon(persona.iconName)}
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 overflow-hidden
                  ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}>
                  {persona.name}
                </span>
                {isActive && expanded && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: persona.color }} />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top bar */}
        <div className="h-14 px-4 flex items-center border-b border-white/10 flex-shrink-0 bg-[#080808]">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 mr-2 text-white/50 hover:text-white">
            {getIcon('Menu', 'w-5 h-5')}
          </button>
          <span className="md:hidden font-black text-base italic uppercase select-none">
            <span className="text-white">L</span>
            <span style={{ color: activeColor }}>Y</span>
            <span className="text-white">LO.PRO</span>
          </span>
          <div className="flex-1" />

          {/* Hamburger menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              {getIcon('Menu', 'w-5 h-5')}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-52 bg-[#111] border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-3">Text Size</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_SIZES.map(fs => (
                      <button key={fs.value}
                        onClick={() => { onFontSizeChange?.(fs.value); setMenuOpen(false); }}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border
                          ${fontSize === fs.value
                            ? 'text-white bg-white/15 border-white/30'
                            : 'text-white/40 border-white/5 hover:text-white hover:bg-white/5'}`}
                        style={fontSize === fs.value ? { borderColor: activeColor + '66', color: activeColor } : {}}>
                        {fs.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-white/10 mx-4" />
                <p className="text-center text-[10px] text-white/15 py-3">LYLO.PRO v31.0</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
