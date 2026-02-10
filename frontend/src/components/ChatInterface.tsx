import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, ChatMessage, ChatResponse, UserStats } from '../lib/api';
import { PersonaConfig } from './Layout';

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  confidence?: number;
  timestamp: number;
}

const PERSONAS: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', description: 'Protective Security Expert', color: 'blue' },
  { id: 'roast', name: 'The Roast Master', description: 'Witty but Helpful', color: 'orange' },
  { id: 'friend', name: 'The Friend', description: 'Caring Best Friend', color: 'green' },
  { id: 'chef', name: 'The Chef', description: 'Food & Cooking Expert', color: 'red' },
  { id: 'techie', name: 'The Techie', description: 'Technology Expert', color: 'purple' },
  { id: 'lawyer', name: 'The Lawyer', description: 'Legal Advisor', color: 'yellow' }
];

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel,
  onZoomChange,
  onPersonaChange,
  onLogout
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loadUserStats();
  }, [userEmail]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => handleSend(transcript), 100);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const speakText = (text: string) => {
    if (!autoTTS || !text || isSpeaking) return;
    
    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    
    if (window.speechSynthesis && cleanText) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      
      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(voice => 
        voice.name.includes('Natural') || 
        voice.name.includes('Neural') ||
        (voice.lang.startsWith('en') && !voice.name.includes('Google'))
      );
      
      if (naturalVoice) utterance.voice = naturalVoice;
      
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS) {
      setTimeout(() => speakText(lastMessage.content), 500);
    }
  }, [messages, autoTTS]);

  const startListening = () => {
    if (recognitionRef.current && !loading && !isListening) {
      if (isSpeaking) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const toggleTTS = () => {
    if (autoTTS && isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setAutoTTS(!autoTTS);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: Message = { 
      id: Date.now(), 
      content: textToSend, 
      sender: 'user', 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(
        textToSend, 
        [], 
        currentPersona.id,
        userEmail
      );
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, botMsg]);
      await loadUserStats();
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "Connection error. Please try again.", 
        sender: 'bot',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getUserDisplayName = () => {
    if (userEmail.includes('stangman')) return 'Christopher';
    return userEmail.split('@')[0];
  };

  return (
    <div 
      className="h-screen flex flex-col bg-[#050505] relative"
      style={{ fontSize: `${zoomLevel / 100}rem` }}
    >
      
      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-4 flex-shrink-0 relative">
        <div className="flex items-center justify-between max-w-none">
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="space-y-1.5">
                <div className="w-5 h-0.5 bg-white"></div>
                <div className="w-5 h-0.5 bg-white"></div>
                <div className="w-5 h-0.5 bg-white"></div>
              </div>
            </button>

            {showDropdown && (
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[280px] z-50">
                
                <div className="mb-4 p-3 bg-white/5 rounded-lg">
                  <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Account Status</h3>
                  {userStats && (
                    <div className="space-y-1 text-xs text-gray-300">
                      <p>Tier: <span className="text-[#3b82f6] font-bold">{userStats.tier.toUpperCase()}</span></p>
                      <p>Conversations Today: <span className="text-white">{userStats.conversations_today}</span></p>
                      <p>Total Conversations: <span className="text-white">{userStats.total_conversations}</span></p>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Usage:</span>
                          <span>{userStats.usage.current}/{userStats.usage.limit}</span>
                        </div>
                        <div className="bg-gray-800 rounded-full h-1">
                          <div 
                            className="h-1 bg-[#3b82f6] rounded-full transition-all"
                            style={{ width: `${Math.min(100, userStats.usage.percentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">AI Personality</h3>
                  <div className="space-y-2">
                    {PERSONAS.map(persona => (
                      <button
                        key={persona.id}
                        onClick={() => {
                          onPersonaChange(persona);
                          setShowDropdown(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          currentPersona.id === persona.id 
                            ? 'bg-[#3b82f6] text-white' 
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-sm">{persona.name}</div>
                        <div className="text-xs opacity-70">{persona.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Text Size</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white font-bold"
                    >
                      -
                    </button>
                    <span className="text-white font-bold text-sm min-w-[60px] text-center">
                      {zoomLevel}%
                    </span>
                    <button 
                      onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))}
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onLogout();
                    setShowDropdown(false);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-white font-black text-xl uppercase tracking-[0.3em]">
              L<span className="text-[#3b82f6]">Y</span>LO
            </h1>
            <p className="text-gray-500 text-xs uppercase tracking-[0.4em] font-bold">
              Digital Bodyguard
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white font-bold text-sm">
                {getUserDisplayName()}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-400 text-xs uppercase font-bold">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ paddingBottom: '160px', minHeight: 0 }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-3xl flex items-center justify-center mb-6">
              <span className="text-white font-black text-3xl">L</span>
            </div>
            
            <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-3">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 text-lg max-w-md uppercase tracking-[0.1em] font-medium">
              Your AI Security System is Ready
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-4 rounded-2xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                <div className={`text-xs mt-3 opacity-70 font-bold uppercase tracking-wider ${
                  msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {msg.sender === 'bot' && msg.confidence && (
              <div className="max-w-[85%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-black uppercase text-xs tracking-[0.2em]">
                      Truth Confidence
                    </span>
                    <span className="text-[#3b82f6] font-black">
                      {msg.confidence}%
                    </span>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000"
                      style={{ width: `${msg.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 font-medium uppercase tracking-wider">
                  {currentPersona.name} analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-4">
        <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={startListening}
              disabled={loading || isListening}
              className={`
                px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all
                ${isListening 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }
                disabled:opacity-50
              `}
            >
              Mic {isListening ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={toggleTTS}
              className={`
                px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all relative
                ${autoTTS 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }
              `}
            >
              Voice {autoTTS ? 'ON' : 'OFF'}
              {isSpeaking && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
          
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <textarea 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isListening ? "Listening..." : `Message ${currentPersona.name}...`}
                disabled={loading || isListening}
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[50px] max-h-[120px] font-medium"
                rows={2}
              />
            </div>
            
            <button 
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || isListening}
              className={`
                px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-[0.2em] transition-all
                ${input.trim() && !loading && !isListening
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
