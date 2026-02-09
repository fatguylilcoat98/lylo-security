import React, { useState, useEffect } from 'react';

// Dynamic import of Lucide icons to prevent crashes
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
    systemInstruction: 'You are The Guardian, a protective AI bodyguard. Be serious, vigilant, and concise. Focus on security, threats, and safety. Warn about risks and provide clear, actionable protection advice.'
  },
  {
    id: 'chef',
    name: 'The Chef',
    color: 'orange',
    iconName: 'ChefHat',
    description: 'Warm, instructive, helpful',
    systemInstruction: 'You are The Chef, a warm and instructive culinary expert. Be helpful, enthusiastic about food, and provide detailed cooking guidance. Share tips, recipes, and make cooking accessible and enjoyable.'
  },
  {
    id: 'techie',
    name: 'The Techie',
    color: 'purple',
    iconName: 'Cpu',
    description: 'Nerdy, detailed, technical',
    systemInstruction: 'You are The Techie, a technical expert who loves diving deep into details. Be nerdy, precise, and comprehensive. Explain complex technical concepts thoroughly and provide detailed troubleshooting steps.'
  },
  {
    id: 'lawyer',
    name: 'The Lawyer',
    color: 'yellow',
    iconName: 'Scale',
    description: 'Formal, precise, careful',
    systemInstruction: 'You are The Lawyer, a formal and precise legal advisor. Be careful, methodical, and thorough. Provide detailed legal analysis while being clear about disclaimers and limitations.'
  },
  {
    id: 'roast',
    name: 'The Roast Master',
    color: 'red',
    iconName: 'Flame',
    description: 'Sarcastic, funny, human-like',
    systemInstruction: 'You are The Roast Master, a sarcastic and witty AI with a sharp tongue. Be funny, human-like, and use humor to make points. Roast when appropriate but stay helpful underneath the sass.'
  },
  {
    id: 'friend',
    name: 'The Best Friend',
    color: 'green',
    iconName: 'Heart',
    description: 'Empathetic, casual, listener',
    systemInstruction: 'You are The Best Friend, an empathetic and caring companion. Be casual, supportive, and a good listener. Focus on emotional support and genuine human connection.'
  }
];

interface LayoutProps {
  children: React.ReactNode;
  currentPersona: string;
  onPersonaChange: (persona: string) => void;
}

export default function Layout({ children, currentPersona, onPersonaChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  const currentPersonaConfig = personas.find(p => p.id === currentPersona) || personas[0];

  // Load icons dynamically
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
        ${sidebarOpen ? 'w-72' : 'w-20'} 
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
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 uppercase tracking-wider">System Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium">Online</span>
              </div>
            </div>
          </div>
        )}

        {/* Personas */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          {sidebarOpen && (
            <div className="mb-4 px-3 animate-in slide-in-from-left duration-400">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                AI Personalities
              </h3>
            </div>
          )}
          
          {personas.map((persona, index) => (
            <button
              key={persona.id}
              onClick={() => onPersonaChange(persona.id)}
              style={{ animationDelay: `${index * 50}ms` }}
              className={`
                w-full p-4 rounded-2xl border transition-all duration-200 
                ${getColorClasses(persona.color, currentPersona === persona.id)}
                ${!sidebarOpen ? 'aspect-square' : ''}
                ${currentPersona === persona.id ? 'shadow-lg' : ''}
                animate-in slide-in-from-left
              `}
            >
              <div className={`flex items-center ${sidebarOpen ? 'gap-4' : 'justify-center'}`}>
                <div className={`
                  p-2 rounded-xl border transition-all
                  ${currentPersona === persona.id 
                    ? `border-${persona.color}-400 bg-${persona.color}-500/10` 
                    : 'border-white/20 bg-white/5'
                  }
                `}>
                  {getPersonaIcon(persona.iconName)}
                </div>
                
                {sidebarOpen && (
                  <div className="text-left">
                    <div className="font-semibold text-sm">{persona.name}</div>
                    <div className="text-xs text-gray-400">{persona.description}</div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Current Persona Display */}
        {sidebarOpen && (
          <div className="p-6 border-t border-white/10 animate-in slide-in-from-left duration-500">
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
              <img 
                src="/logo.png" 
                alt="LYLO" 
                className="w-6 h-6 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]"
              />
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
