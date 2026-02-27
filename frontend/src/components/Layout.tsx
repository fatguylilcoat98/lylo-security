/**
 * LYLO OS — Layout.tsx  v31.2
 * Mobile-first. Single hamburger. Persona grid picker on mobile.
 * Desktop: collapsible icon rail → full sidebar on hover.
 */
import React, { useState, useEffect, useRef } from 'react';

export interface PersonaConfig {
  id: string; name: string; color: string;
  iconName: string; description: string;
  systemInstruction: string; requiredTier: 'free' | 'pro' | 'elite' | 'max';
}

export const personas: PersonaConfig[] = [
  { id: 'guardian',  name: 'Guardian',  color: '#00CFFF', iconName: 'Shield',        description: 'Security Expert',      systemInstruction: '', requiredTier: 'free'  },
  { id: 'doctor',    name: 'Doctor',    color: '#39FF14', iconName: 'Stethoscope',   description: 'Medical Advisor',      systemInstruction: '', requiredTier: 'pro'   },
  { id: 'lawyer',    name: 'Lawyer',    color: '#FFD700', iconName: 'Scale',         description: 'Legal Advisor',        systemInstruction: '', requiredTier: 'pro'   },
  { id: 'wealth',    name: 'Wealth',    color: '#F59E0B', iconName: 'TrendingUp',    description: 'Financial Strategist', systemInstruction: '', requiredTier: 'pro'   },
  { id: 'therapist', name: 'Therapist', color: '#FF69B4', iconName: 'Heart',         description: 'Mental Health',        systemInstruction: '', requiredTier: 'pro'   },
  { id: 'career',    name: 'Career',    color: '#FF6B35', iconName: 'Briefcase',     description: 'Career Growth',        systemInstruction: '', requiredTier: 'pro'   },
  { id: 'tutor',     name: 'Tutor',     color: '#A78BFA', iconName: 'BookOpen',      description: 'Education Expert',     systemInstruction: '', requiredTier: 'pro'   },
  { id: 'vitality',  name: 'Vitality',  color: '#00FF87', iconName: 'Dumbbell',      description: 'Fitness & Wellness',   systemInstruction: '', requiredTier: 'pro'   },
  { id: 'hype',      name: 'Hype',      color: '#FF1744', iconName: 'Zap',           description: 'Motivation',           systemInstruction: '', requiredTier: 'pro'   },
  { id: 'bestie',    name: 'Bestie',    color: '#CE93D8', iconName: 'MessageCircle', description: 'Trusted Confidant',    systemInstruction: '', requiredTier: 'elite' },
  { id: 'pastor',    name: 'Pastor',    color: '#F9A825', iconName: 'BookMarked',    description: 'Spiritual Advisor',    systemInstruction: '', requiredTier: 'pro'   },
  { id: 'mechanic',  name: 'Mechanic',  color: '#94A3B8', iconName: 'Wrench',        description: 'Auto Expert',          systemInstruction: '', requiredTier: 'pro'   },
];

// Emoji fallbacks (no lucide dependency needed)
const PERSONA_EMOJI: Record<string, string> = {
  guardian: '🛡', doctor: '🩺', lawyer: '⚖️', wealth: '📈',
  therapist: '💜', career: '💼', tutor: '📚', vitality: '💪',
  hype: '⚡', bestie: '💬', pastor: '🙏', mechanic: '🔧',
};

const FONT_SIZES = [
  { label: 'S', value: 14 }, { label: 'M', value: 16 },
  { label: 'L', value: 19 }, { label: 'XL', value: 22 },
];

interface LayoutProps {
  children:          React.ReactNode;
  currentPersona:    any;
  onPersonaChange:   (persona: PersonaConfig) => void;
  userEmail:         string;
  onUsageUpdate?:    () => void;
  fontSize?:         number;
  onFontSizeChange?: (size: number) => void;
}

export default function Layout({
  children, currentPersona, onPersonaChange,
  fontSize = 16, onFontSizeChange,
}: LayoutProps) {
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [hovered,      setHovered]      = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Lock body scroll when drawer open on mobile
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const activeId    = typeof currentPersona === 'string' ? currentPersona : currentPersona?.id;
  const activeColor = personas.find(p => p.id === activeId)?.color ?? '#00CFFF';
  const activePersona = personas.find(p => p.id === activeId);

  const handleSelect = (p: PersonaConfig) => {
    onPersonaChange(p);
    setDrawerOpen(false);
  };

  // ── Desktop sidebar persona list ────────────────────────────────────────────
  const DesktopSidebar = () => (
    <>
      <div className="h-14 px-3 flex items-center border-b border-white/10 flex-shrink-0 overflow-hidden">
        <span className="font-black text-base italic uppercase tracking-wider whitespace-nowrap select-none">
          <span className="text-white">L</span>
          <span style={{ color: activeColor }}>Y</span>
          <span className="text-white">LO</span>
          <span className={`text-white/50 text-xs transition-all duration-200 ${hovered ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>.PRO</span>
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {personas.map(p => {
          const isActive = activeId === p.id;
          return (
            <button key={p.id} onClick={() => onPersonaChange(p)} title={p.name}
              className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl border transition-all text-left ${
                isActive ? 'border-white/15 bg-white/10' : 'border-transparent hover:bg-white/5'}`}>
              <span className="flex-shrink-0 text-lg w-5 text-center leading-none"
                style={{ color: isActive ? p.color : 'rgba(255,255,255,0.35)' }}>
                {PERSONA_EMOJI[p.id]}
              </span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${
                hovered ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0'}`}
                style={{ color: isActive ? p.color : 'rgba(255,255,255,0.6)' }}>
                {p.name}
              </span>
              {isActive && hovered && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );

  // ── Mobile drawer — full-screen grid of personas ────────────────────────────
  const MobileDrawer = () => (
    <div className={`fixed inset-0 z-50 flex flex-col bg-[#090909] transition-transform duration-300 ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}`}>
      {/* Drawer header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/10">
        <span className="font-black text-xl italic uppercase tracking-wider">
          <span className="text-white">L</span>
          <span style={{ color: activeColor }}>Y</span>
          <span className="text-white">LO.PRO</span>
        </span>
        <button onClick={() => setDrawerOpen(false)}
          className="w-10 h-10 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center text-white/60 text-xl">
          ✕
        </button>
      </div>

      <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 font-bold px-5 pt-4 pb-2">
        Choose Your Specialist
      </p>

      {/* 3-column persona grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-3 gap-3 pt-1">
          {personas.map(p => {
            const isActive = activeId === p.id;
            return (
              <button key={p.id} onClick={() => handleSelect(p)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all active:scale-95"
                style={{
                  backgroundColor: isActive ? p.color + '18' : 'rgba(255,255,255,0.04)',
                  borderColor:     isActive ? p.color + '60' : 'rgba(255,255,255,0.08)',
                }}>
                <span className="text-3xl">{PERSONA_EMOJI[p.id]}</span>
                <span className="text-xs font-bold text-center leading-tight"
                  style={{ color: isActive ? p.color : 'rgba(255,255,255,0.65)' }}>
                  {p.name}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden" style={{ fontSize }}>

      {/* Mobile drawer */}
      <MobileDrawer />

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex flex-col bg-[#080808] border-r border-white/10
          transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
          ${hovered ? 'w-52' : 'w-14'}`}>
        <DesktopSidebar />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Single top bar ── */}
        <header className="h-14 px-3 flex items-center gap-2 border-b border-white/10 bg-[#080808] flex-shrink-0">

          {/* Mobile: grid button to open persona drawer */}
          <button onClick={() => setDrawerOpen(true)}
            className="md:hidden w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg active:bg-white/15 flex-shrink-0"
            aria-label="Choose specialist">
            {activePersona ? (
              <span style={{ color: activeColor }}>{PERSONA_EMOJI[activeId] ?? '🛡'}</span>
            ) : '🛡'}
          </button>

          {/* Mobile logo */}
          <span className="md:hidden font-black text-base italic uppercase tracking-wider select-none">
            <span className="text-white">L</span>
            <span style={{ color: activeColor }}>Y</span>
            <span className="text-white">LO.PRO</span>
          </span>

          <div className="flex-1" />

          {/* Settings — ONE button, top-right */}
          <div className="relative flex-shrink-0" ref={settingsRef}>
            <button onClick={() => setSettingsOpen(v => !v)}
              className={`w-10 h-10 rounded-2xl border transition-all flex items-center justify-center text-sm ${
                settingsOpen ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10'}`}
              aria-label="Settings">
              ⚙️
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-12 w-48 bg-[#111] border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-4">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/25 font-bold mb-3">Text Size</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {FONT_SIZES.map(fs => (
                      <button key={fs.value}
                        onClick={() => { onFontSizeChange?.(fs.value); setSettingsOpen(false); }}
                        className="py-2 rounded-xl text-xs font-bold border transition-all"
                        style={fontSize === fs.value
                          ? { borderColor: activeColor + '66', color: activeColor, backgroundColor: activeColor + '15' }
                          : { borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
                        {fs.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-white/8 mx-3" />
                <p className="text-center text-[9px] text-white/15 py-3 select-none">LYLO.PRO v31.2</p>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-hidden min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
