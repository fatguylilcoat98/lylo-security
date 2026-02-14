import React, { useState, useEffect } from 'react';

// DIRECT LINK TO YOUR LOCAL LOGO
const LYLO_LOGO_URL = "/logo.png";

// Dynamic import of Lucide icons
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
}

// Standardized list including The Disciple
export const personas: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', color: 'blue', iconName: 'Shield', description: 'Protective, serious', systemInstruction: 'You are The Guardian.' },
  { id: 'disciple', name: 'The Disciple', color: 'gold', iconName: 'BookOpen', description: 'Wise Advisor (KJV)', systemInstruction: 'You are The Disciple. Use King James Bible scripture.' },
  { id: 'chef', name: 'The Chef', color: 'red', iconName: 'ChefHat', description: 'Culinary expert', systemInstruction: 'You are The Chef.' },
  { id: 'techie', name: 'The Techie', color: 'purple', iconName: 'Cpu', description: 'Tech expert', systemInstruction: 'You are The Techie.' },
  { id: 'lawyer', name: 'The Lawyer', color: 'yellow', iconName: 'Scale', description: 'Legal advisor', systemInstruction: 'You are The Lawyer.' },
  { id: 'roast', name: 'The Roast Master', color: 'orange', iconName: 'Flame', description: 'Witty & sarcastic', systemInstruction: 'You are The Roast Master.' },
  { id: 'friend', name: 'The Best Friend', color: 'green', iconName: 'Heart', description: 'Supportive friend', systemInstruction: 'You are The Best Friend.' }
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

  // Safely determine which persona is active
  const activePersonaId = typeof currentPersona === 'string' ? currentPersona : currentPersona?.id;

  const getPersonaIcon = (iconName: string) => {
    if (!icons) return null;
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-6 h-6" /> : null;
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-black/95 border-r border-white/10 
        transition-transform duration-300 ease-in-out w-72 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:w-20 md:hover:w-72 md:group
      `}>
        
        {/* Sidebar Header */}
        <div className="p-4 flex items-center gap-4 border-b border-white/10 h-16">
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {icons?.X && <icons.X className="w-6 h-6" />}
            </button>

            <div className="flex items-center gap-3 overflow-hidden">
              <img src={LYLO_LOGO_URL} alt="LYLO" className="w-8 h-8 object-contain flex-shrink-0" />
              <span className="font-bold text-xl tracking-wider md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap italic text-white uppercase">
                LYLO<span className="text-blue-500">.</span>PRO
              </span>
            </div>
        </div>

        {/* Persona List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
                  ? `bg-white/10 border-white/20 text-white shadow-lg` 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }
              `}
            >
              <div className={`flex-shrink-0 ${activePersonaId === persona.id ? 'text-blue-500' : ''}`}>
                {getPersonaIcon(persona.iconName)}
              </div>
              <div className="text-left whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                <div className="font-bold text-sm uppercase tracking-widest">{persona.name}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative w-full">
        {/* Mobile Header Bar */}
        <div className="md:hidden h-16 bg-black border-b border-white/10 flex items-center px-4 gap-4 flex-shrink-0 z-30">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-white bg-white/5 rounded-lg border border-white/10"
          >
            {icons?.Menu && <icons.Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <img src={LYLO_LOGO_URL} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg tracking-tighter italic uppercase text-white">LYLO<span className="text-blue-500">.</span>PRO</span>
          </div>
        </div>

        {/* Child Content */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
