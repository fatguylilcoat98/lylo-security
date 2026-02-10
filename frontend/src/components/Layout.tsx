import React, { useState, useEffect } from 'react';

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
    systemInstruction: 'You are The Guardian.'
  },
  {
    id: 'chef',
    name: 'The Chef',
    color: 'orange',
    iconName: 'ChefHat',
    description: 'Warm, instructive, helpful',
    systemInstruction: 'You are The Chef.'
  },
  {
    id: 'techie',
    name: 'The Techie',
    color: 'purple',
    iconName: 'Cpu',
    description: 'Nerdy, detailed, technical',
    systemInstruction: 'You are The Techie.'
  },
  {
    id: 'lawyer',
    name: 'The Lawyer',
    color: 'yellow',
    iconName: 'Scale',
    description: 'Formal, precise, careful',
    systemInstruction: 'You are The Lawyer.'
  },
  {
    id: 'roast',
    name: 'The Roast Master',
    color: 'red',
    iconName: 'Flame',
    description: 'Sarcastic, funny, human-like',
    systemInstruction: 'You are The Roast Master.'
  },
  {
    id: 'friend',
    name: 'The Best Friend',
    color: 'green',
    iconName: 'Heart',
    description: 'Empathetic, casual, listener',
    systemInstruction: 'You are The Best Friend.'
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
  userEmail 
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default CLOSED on mobile
  const [icons, setIcons] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Load icons
  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  // Handle mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Force sidebar close if switching to mobile
      if (mobile) setSidebarOpen(false);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getPersonaIcon = (iconName: string) => {
    if (!icons) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-6 h-6" /> : null;
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">
      
      {/* Sidebar Overlay for Mobile (Click to close) */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 bg-black/90 border-r border-white/10 
        transition-transform duration-300 ease-in-out flex flex-col
        ${isMobile ? (sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64') : 'relative translate-x-0 w-20 hover:w-64 group'}
      `}>
        
        {/* Logo Area */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
           <button 
             onClick={() => setSidebarOpen(!sidebarOpen)}
             className="md:hidden p-2 bg-white/10 rounded-lg"
           >
             {icons?.Menu && <icons.Menu className="w-5 h-5" />}
           </button>
           <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
           <span className="font-bold text-lg md:hidden group-hover:block">LYLO</span>
        </div>

        {/* Personas List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                onPersonaChange(persona.id);
                if (isMobile) setSidebarOpen(false);
              }}
              className={`
                w-full p-3 rounded-xl flex items-center gap-4 transition-all
                ${currentPersona === persona.id 
                  ? `bg-${persona.color}-500/20 text-${persona.color}-400 border border-${persona.color}-500/30` 
                  : 'hover:bg-white/5 text-gray-400'
                }
              `}
            >
              <div className="p-1">
                {getPersonaIcon(persona.iconName)}
              </div>
              <div className={`text-left md:hidden group-hover:block ${!isMobile && 'hidden'}`}>
                <div className="font-bold text-sm">{persona.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full">
        {/* Mobile Header Trigger */}
        {isMobile && !sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-30 p-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 text-white"
          >
            {icons?.Menu && <icons.Menu className="w-6 h-6" />}
          </button>
        )}
        
        {children}
      </div>
    </div>
  );
}

export { personas };
export type { PersonaConfig };
