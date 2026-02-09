import React, { useState, useEffect } from 'react';
import UsageDisplay from './UsageDisplay';

// Dynamic import of Lucide icons
const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

interface PersonaConfig {
  id: string;
  name: string;
  color: string;
  iconName: string;
  description: string;
  systemInstruction: string;
}

const personas: PersonaConfig[] = [
  {
    id: 'guardian',
    name: 'The Guardian',
    color: 'cyan',
    iconName: 'Shield',
    description: 'Protective, serious, concise',
    systemInstruction: 'You are The Guardian, a protective AI bodyguard. Be serious, vigilant, and concise. Focus on security, threats, and safety.'
  },
  {
    id: 'chef',
    name: 'The Chef',
    color: 'orange',
    iconName: 'ChefHat',
    description: 'Warm, instructive, helpful',
    systemInstruction: 'You are The Chef, a warm and instructive culinary expert. Be helpful and enthusiastic about food.'
  },
  {
    id: 'techie',
    name: 'The Techie',
    color: 'purple',
    iconName: 'Cpu',
    description: 'Nerdy, detailed, technical',
    systemInstruction: 'You are The Techie, a technical expert who loves diving deep into details. Be nerdy and comprehensive.'
  },
  {
    id: 'lawyer',
    name: 'The Lawyer',
    color: 'yellow',
    iconName: 'Scale',
    description: 'Formal, precise, careful',
    systemInstruction: 'You are The Lawyer, a formal and precise legal advisor. Be careful and methodical.'
  },
  {
    id: 'roast',
    name: 'The Roast Master',
    color: 'red',
    iconName: 'Flame',
    description: 'Sarcastic, funny, human-like',
    systemInstruction: 'You are The Roast Master, sarcastic and witty but ultimately helpful. Use humor effectively.'
  },
  {
    id: 'friend',
    name: 'The Best Friend',
    color: 'green',
    iconName: 'Heart',
    description: 'Empathetic, casual, listener',
    systemInstruction: 'You are The Best Friend, empathetic and caring. Be supportive and a good listener.'
  }
];

interface LayoutProps {
  children: React.ReactNode;
  currentPersona: string;
  onPersonaChange: (persona: string) => void;
  userEmail: string;
  onUsageUpdate?: () => void;
}

export default function Layout({ 
  children, 
  currentPersona, 
  onPersonaChange, 
  userEmail,
  onUsageUpdate 
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [currentTier, setCurrentTier] = useState('free');

  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];

  // Load icons
  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  // Handle mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load tier from localStorage
  useEffect(() => {
    const tier = localStorage.getItem('lylo_user_tier') || 'free';
    setCurrentTier(tier);
  }, []);

  // Close sidebar on mobile when persona changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [currentPersona, isMobile]);

  const getPersonaIcon = (iconName: string) => {
    if (!icons) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-6 h-6" /> : null;
  };

  const getColorClasses = (color: string, isActive: boolean = false) => {
    const colors = {
      cyan: isActive 
        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-cyan-500/20' 
        : 'hover:bg-cyan-500/10 hover:border-cyan-500/30',
      orange: isActive 
        ? 'bg-orange-500/20 border-orange-400 text-orange-400 shadow-orange-500/20' 
        : 'hover:bg-orange-500/10 hover:border-orange-500/30',
      purple: isActive 
        ? 'bg-purple-500/20 border-purple-400 text-purple-400 shadow-purple-500/20' 
        : 'hover:bg-purple-500/10 hover:border-purple-500/30',
      yellow: isActive 
        ? 'bg-yellow-500/20 border-yellow-400 text-yellow-400 shadow-yellow-500/20' 
        : 'hover:bg-yellow-500/10 hover:border-yellow-500/30',
      red: isActive 
        ? 'bg-red-500/20 border-red-400 text-red-400 shadow-red-500/20' 
        : 'hover:bg-red-500/10 hover:border-red-500/30',
      green: isActive 
        ? 'bg-green-500/20 border-green-400 text-green-400 shadow-green-500/20' 
        : 'hover:bg-green-500/10 hover:border-green-500/30'
    };
    return colors[color as keyof typeof colors] || colors.cyan;
  };

  const getTierAccess = (personaId: string): boolean => {
    const tierAccess = {
      free: ['guardian', 'friend'],
      pro: ['guardian', 'friend', 'chef', 'techie'],
      elite: ['guardian', 'friend', 'chef', 'techie', 'lawyer', 'roast']
    };
    return tierAccess[currentTier as keyof typeof tierAccess]?.includes(personaId) || false;
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">
      
      {/* Sidebar Overlay for Mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${isMobile ? 'fixed left-0 top-0 h-full z-50' : 'relative'}
        ${sidebarOpen ? 'w-80' : 'w-20'} 
        bg-black/40 backdrop-blur-xl border-r border-white/10 
        transition-all duration-300 flex flex-col
        ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        
        {/* Logo & Toggle */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              {icons?.Menu && <icons.Menu className="w-5 h-5" />}
            </button>
            
            {sidebarOpen && (
              <div className="flex items-center gap-3 animate-in slide-in-from-left duration-200">
                <img 
                  src="/logo.png" 
                  alt="LYLO" 
                  className="w-8 h-8 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    LYLO
                  </h1>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Elite AI Security</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        {sidebarOpen && (
          <div className="px-6 py-4 border-b border-white/10 animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-400 uppercase tracking-wider">System Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium">Online</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              <span className="capitalize">{currentTier}</span> Tier • User: {userEmail.split('@')[0]}
            </div>
          </div>
        )}

        {/* Usage Display */}
        {sidebarOpen && (
          <div className="px-4 py-3 animate-in slide-in-from-left duration-400">
            <UsageDisplay 
              userEmail={userEmail} 
              currentTier={currentTier}
            />
          </div>
        )}

        {/* Personas */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          {sidebarOpen && (
            <div className="mb-4 px-3 animate-in slide-in-from-left duration-500">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                AI Personalities
              </h3>
            </div>
          )}
          
          {personas.map((persona, index) => {
            const hasAccess = getTierAccess(persona.id);
            
            return (
              <div key={persona.id} className="relative">
                <button
                  onClick={() => hasAccess && onPersonaChange(persona.id)}
                  disabled={!hasAccess}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className={`
                    w-full p-4 rounded-2xl border transition-all duration-200 
                    ${hasAccess 
                      ? getColorClasses(persona.color, currentPersona === persona.id)
                      : 'opacity-50 cursor-not-allowed bg-gray-800/30 border-gray-700'
                    }
                    ${!sidebarOpen ? 'aspect-square' : ''}
                    ${currentPersona === persona.id ? 'shadow-lg' : ''}
                    animate-in slide-in-from-left
                  `}
                >
                  <div className={`flex items-center ${sidebarOpen ? 'gap-4' : 'justify-center'}`}>
                    <div className={`
                      p-2 rounded-xl border transition-all
                      ${currentPersona === persona.id && hasAccess
                        ? `border-${persona.color}-400 bg-${persona.color}-500/10` 
                        : 'border-white/20 bg-white/5'
                      }
                    `}>
                      {getPersonaIcon(persona.iconName)}
                    </div>
                    
                    {sidebarOpen && (
                      <div className="text-left flex-1">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {persona.name}
                          {!hasAccess && (
                            <span className="text-xs bg-yellow-600 px-2 py-1 rounded-full">
                              {currentTier === 'free' ? 'PRO' : 'ELITE'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">{persona.description}</div>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Current Persona Display */}
        {sidebarOpen && (
          <div className="p-6 border-t border-white/10 animate-in slide-in-from-left duration-700">
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Active</div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
                getColorClasses(currentPersonaConfig.color, true)
              }`}>
                {getPersonaIcon(currentPersonaConfig.iconName)}
                <span className="text-sm font-medium">{currentPersonaConfig.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-xl">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              {icons?.Menu && <icons.Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                LYLO
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 relative">
          {children}
        </div>
      </div>
    </div>
  );
}

export { personas };
export type { PersonaConfig };
