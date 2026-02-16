import React, { useState, useEffect, useRef, ComponentType } from 'react';

// SAFE IMPORT - Check if api functions exist
let sendChatMessage: any, getUserStats: any;
try {
  const apiModule = require('../lib/api');
  sendChatMessage = apiModule.sendChatMessage;
  getUserStats = apiModule.getUserStats;
} catch (e) {
  console.error('API module not found');
  sendChatMessage = async () => ({ answer: 'API Error', confidence_score: 0 });
  getUserStats = async () => ({ usage: { current: 0, limit: 10 } });
}

// SAFE ICON IMPORTS - Fallback to div if not available
import {
  Shield,
  Wrench, 
  Gavel,
  Monitor,
  BookOpen,
  Laugh,
  ChefHat,
  Activity,
  Camera,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  AlertTriangle,
  Phone,
  CreditCard,
  FileText,
  Zap,
  Brain,
  Settings,
  LogOut,
  X,
  Crown
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// SAFE ICON FALLBACK
const SafeIcon: React.FC<{icon: any, className?: string}> = ({ icon: Icon, className = "w-4 h-4" }) => {
  if (!Icon || typeof Icon !== 'function') {
    return <div className={className} style={{backgroundColor: 'currentColor', borderRadius: '2px'}} />;
  }
  return <Icon className={className} />;
};

// TYPE DEFINITIONS
export interface PersonaConfig {
  id: string;
  name: string;
  serviceLabel: string;
  description: string;
  protectiveJob: string;
  spokenHook: string;
  briefing: string;
  color: string;
  requiredTier: 'free' | 'pro' | 'elite' | 'max';
  capabilities: string[];
  icon: ComponentType<any>;
}

interface ChatInterfaceProps {
  currentPersona?: PersonaConfig;
  userEmail: string;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  onPersonaChange?: (persona: PersonaConfig) => void;
  onLogout?: () => void;
  onUsageUpdate?: () => void;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  confidenceScore?: number;
  scamDetected?: boolean;
  scamIndicators?: string[];
}

interface UserStats {
  usage: {
    current: number;
    limit: number;
  };
}

// SAFE PERSONA DATA
const PERSONAS: PersonaConfig[] = [
  {
    id: 'guardian',
    name: 'The Guardian',
    serviceLabel: 'SECURITY SCAN',
    description: 'Security Lead',
    protectiveJob: 'Security Lead',
    spokenHook: 'Security protocols active. How can I protect you today?',
    briefing: 'I provide comprehensive security analysis, scam detection, and digital threat protection.',
    color: 'blue',
    requiredTier: 'free',
    icon: Shield,
    capabilities: ['Scam detection', 'Phishing protection', 'Account security', 'Identity theft prevention']
  },
  {
    id: 'roast',
    name: 'The Roast Master',
    serviceLabel: 'MOOD SUPPORT',
    description: 'Humor Shield',
    protectiveJob: 'Humor Shield',
    spokenHook: 'Mood support activated. Let me help lighten the situation.',
    briefing: 'I use strategic humor to help you handle difficult situations with confidence.',
    color: 'orange',
    requiredTier: 'pro',
    icon: Laugh,
    capabilities: ['Sarcastic responses', 'Witty deflection', 'Humorous advice']
  },
  {
    id: 'mechanic',
    name: 'The Mechanic', 
    serviceLabel: 'VEHICLE SUPPORT',
    description: 'Garage Protector',
    protectiveJob: 'Garage Protector',
    spokenHook: 'Vehicle support ready. What automotive issue can I help with?',
    briefing: 'I provide expert automotive guidance and protect you from vehicle-related scams.',
    color: 'gray',
    requiredTier: 'pro',
    icon: Wrench,
    capabilities: ['Car diagnostics', 'Engine analysis', 'Automotive protection']
  }
];

// MAIN COMPONENT
const ChatInterface: React.FC<ChatInterfaceProps> = ({
  currentPersona,
  userEmail = '',
  zoomLevel = 100,
  onZoomChange = () => {},
  onPersonaChange = () => {},
  onLogout = () => {},
  onUsageUpdate = () => {}
}) => {
  // SAFE STATE INITIALIZATION
  const [activePersona, setActivePersona] = useState<PersonaConfig>(() => {
    return currentPersona || PERSONAS[0];
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('free');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // REFS
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SAFE PERSONA ACCESS
  const canAccessPersona = (persona: PersonaConfig): boolean => {
    const tiers = { free: 0, pro: 1, elite: 2, max: 3 };
    return tiers[userTier] >= tiers[persona.requiredTier];
  };

  const getAccessiblePersonas = () => PERSONAS.filter(p => canAccessPersona(p));

  // SAFE COLOR CLASSES
  const getPersonaColorClass = (persona: PersonaConfig, type: string = 'border'): string => {
    const colorMap: any = {
      blue: { border: 'border-blue-400', bg: 'bg-blue-500', text: 'text-blue-400' },
      orange: { border: 'border-orange-400', bg: 'bg-orange-500', text: 'text-orange-400' },
      gray: { border: 'border-gray-400', bg: 'bg-gray-500', text: 'text-gray-400' }
    };
    return colorMap[persona.color]?.[type] || colorMap.blue[type];
  };

  // SAFE HANDLERS
  const handlePersonaChange = (persona: PersonaConfig) => {
    if (!canAccessPersona(persona)) return;
    
    setSelectedPersonaId(persona.id);
    setTimeout(() => {
      setActivePersona(persona);
      onPersonaChange(persona);
      setSelectedPersonaId(null);
    }, 200);
  };

  const handleBackToServices = () => {
    setMessages([]);
    setInput('');
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(
        input.trim(), 
        [], 
        activePersona.id, 
        userEmail, 
        null, 
        'en'
      );
      
      const botMsg: Message = {
        id: Date.now().toString(),
        content: response.answer || 'Response received.',
        sender: 'bot',
        timestamp: new Date(),
        confidenceScore: response.confidence_score || 100
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        content: 'Connection error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // RENDER
  return (
    <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans">
      {/* HEADER */}
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/10 p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* BACK BUTTON */}
          {messages.length > 0 && (
            <button 
              onClick={handleBackToServices}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
            >
              <div className="w-5 h-5 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </div>
            </button>
          )}
          
          {/* LOGO */}
          <div className="text-center flex-1">
            <h1 className="text-white font-black text-xl tracking-wider">
              L<span className={getPersonaColorClass(activePersona, 'text')}>Y</span>LO
            </h1>
            <p className="text-gray-500 text-xs uppercase tracking-wider">
              {messages.length > 0 ? activePersona.serviceLabel : 'Digital Bodyguard'}
            </p>
          </div>

          {/* USER INFO */}
          <div className="text-right">
            <div className="text-white font-bold text-xs">
              {userName || userEmail.split('@')[0] || 'User'}
            </div>
            <div className="text-gray-400 text-xs uppercase">Protected</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative backdrop-blur-sm">
        {messages.length === 0 ? (
          /* SERVICE GRID */
          <div className="min-h-full flex flex-col p-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-black/60 backdrop-blur-xl rounded-xl flex items-center justify-center mx-auto mb-3 border-2 border-blue-400">
                <span className="text-white font-black text-lg">LYLO</span>
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Digital Bodyguard</h1>
              <p className="text-gray-400 text-sm">Tap a service to activate your expert</p>
            </div>
            
            <div className="flex-1 px-4" style={{ paddingBottom: '200px' }}>
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {getAccessiblePersonas().map(persona => {
                  const isSelected = selectedPersonaId === persona.id;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => handlePersonaChange(persona)}
                      className={`
                        relative p-4 rounded-xl backdrop-blur-xl border transition-all duration-300 min-h-[120px]
                        ${isSelected 
                          ? 'bg-white/20 border-white/60 scale-105 animate-pulse shadow-2xl' 
                          : 'bg-black/50 border-white/20 hover:bg-black/70 active:scale-95'
                        }
                      `}
                    >
                      <div className="flex flex-col items-center text-center space-y-2">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-black/40'} border ${getPersonaColorClass(persona, 'border')}`}>
                          <SafeIcon icon={persona.icon} className={`w-6 h-6 ${isSelected ? 'text-white' : getPersonaColorClass(persona, 'text')}`} />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-xs uppercase tracking-wide leading-tight">
                            {persona.serviceLabel}
                          </h3>
                          <p className={`text-[10px] mt-1 leading-tight ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                            {isSelected ? 'ACTIVATING...' : persona.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* CHAT MESSAGES */
          <div className="px-3 py-3 space-y-3" style={{ paddingBottom: '200px' }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border ${
                  msg.sender === 'user' 
                    ? 'bg-blue-500/20 border-blue-400/30 text-white' 
                    : 'bg-black/40 text-gray-100 border-white/10'
                }`}>
                  <div className="text-sm">{msg.content}</div>
                  <div className="text-xs mt-2 opacity-70">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <span className="text-gray-300 text-xs ml-2">Processing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-3">
        <div className="bg-black/70 rounded-xl border border-white/10 p-3">
          <div className="flex items-center gap-2">
            {/* MIC BUTTON */}
            <button 
              onClick={() => setIsRecording(!isRecording)}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm uppercase border-2 transition-all flex items-center justify-center gap-2 ${
                isRecording ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              <SafeIcon icon={isRecording ? MicOff : Mic} className="w-5 h-5" />
              {isRecording ? 'STOP' : 'RECORD'}
            </button>
            
            {/* VOICE TOGGLE */}
            <button 
              onClick={() => setAutoTTS(!autoTTS)}
              className="p-3 rounded-xl bg-gray-800/60 border border-gray-600 text-white"
            >
              <SafeIcon icon={autoTTS ? Volume2 : VolumeX} className="w-5 h-5" />
            </button>
          </div>
          
          {/* INPUT ROW */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 bg-black/60 rounded-xl border border-white/10 px-3 py-2 flex items-center">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={`Ask ${activePersona?.serviceLabel || 'LYLO'}...`}
                className="bg-transparent w-full text-white text-sm focus:outline-none placeholder-gray-500"
                disabled={loading}
              />
            </div>
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className={`px-4 py-2 rounded-xl font-bold text-sm uppercase transition-all ${
                input.trim() && !loading
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
