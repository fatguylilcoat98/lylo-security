import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, ChatMessage, ChatResponse, UserStats } from '../lib/api';
import { PersonaConfig, Message } from '../types';

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
  onUsageUpdate?: () => void;
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
  onLogout,
  onUsageUpdate
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
  const [micSupported, setMicSupported] = useState(false);
   
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

  // FIXED MICROPHONE SETUP
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 Speech result:', transcript);
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => handleSend(transcript), 500);
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Speech error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
      console.log('✅ Speech recognition initialized');
    } else {
      console.log('❌ Speech recognition not supported');
      setMicSupported(false);
    }
  }, []);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
      if (onUsageUpdate) onUsageUpdate();
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

  // FIXED MICROPHONE ACTIVATION
  const startListening = () => {
    if (!micSupported) {
      alert('Speech recognition not supported on this device');
      return;
    }

    if (recognitionRef.current && !loading && !isListening) {
      if (isSpeaking) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      
      try {
        console.log('🎤 Starting speech recognition...');
        recognitionRef.current.start();
      } catch (error) {
        console.error('🎤 Failed to start recognition:', error);
        setIsListening(false);
      }
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

    console.log('📤 Sending message:', textToSend);

    const userMsg: Message = { 
      id: Date.now().toString(),
      content: textToSend, 
      sender: 'user', 
      timestamp: new Date()
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
      
      console.log('📥 Response:', response);
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(),
        content: response.answer, 
        sender: 'bot',
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: [] // Fixed missing property based on interface
      };
      
      setMessages(prev => [...prev, botMsg]);
      await loadUserStats();
      
    } catch (error) {
      console.error('❌ Chat error:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(),
        content: "Connection error. Please try again.", 
        sender: 'bot',
        timestamp: new Date()
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
    // FIXED: Added 'fixed inset-0 z-50' to force fullscreen and hide background headers
    <div className="fixed inset-0 z-50 flex flex-col h-[100dvh] bg-[#050505] relative overflow-hidden font-sans">
      
      {/* HEADER - No Overflow */}
      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-3 flex-shrink-0 relative">
        <div className="flex items-center justify-between">
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="space-y-1">
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
              </div>
            </button>

            {showDropdown && (
              <div className="absolute top-10 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[250px] z-50 max-h-[80vh] overflow-y-auto">
                
                <div className="mb-3 p-2 bg-white/5 rounded-lg">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">Account Status</h3>
                  {userStats && (
                    <div className="space-y-1 text-xs text-gray-300">
                      <p>Tier: <span className="text-[#3b82f6] font-bold">{userStats.tier.toUpperCase()}</span></p>
                      <p>Today: <span className="text-white">{userStats.conversations_today}</span></p>
                      <div className="mt-1">
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

                <div className="mb-3">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">AI Personality</h3>
                  <div className="space-y-1">
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
                        <div className="font-medium text-xs">{persona.name}</div>
                        <div className="text-xs opacity-70">{persona.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">Text Size</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
                      className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="text-white font-bold text-xs min-w-[40px] text-center">
                      {zoomLevel}%
                    </span>
                    <button 
                      onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))}
                      className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white font-bold text-xs"
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
                  className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          <div className="text-center flex-1 px-2">
            <h1 className="text-white font-black text-lg uppercase tracking-[0.2em]" style={{ fontSize: `${zoomLevel / 100}rem` }}>
              L<span className="text-[#3b82f6]">Y</span>LO
            </h1>
            <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-bold">
              Digital Bodyguard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-white font-bold text-xs" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>
                {getUserDisplayName()}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-400 text-xs uppercase font-bold">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA - PROPERLY SIZED */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
        style={{ 
          paddingBottom: '140px', // Space for fixed input
          minHeight: 0,
          fontSize: `${zoomLevel / 100}rem`
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-16 h-16 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white font-black text-xl">L</span>
            </div>
            
            <h2 className="text-lg font-black text-white uppercase tracking-[0.1em] mb-2">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 text-sm max-w-sm uppercase tracking-[0.1em] font-medium">
              Your AI Security System is Ready
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-3 rounded-xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                <div className={`text-xs mt-2 opacity-70 font-bold uppercase tracking-wider ${
                  msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {msg.sender === 'bot' && msg.confidenceScore && (
              <div className="max-w-[85%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-black uppercase text-xs tracking-[0.1em]">
                      Truth Confidence
                    </span>
                    <span className="text-[#3b82f6] font-black text-sm">
                      {msg.confidenceScore}%
                    </span>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000"
                      style={{ width: `${msg.confidenceScore}%` }}
                    />
                  </div>
                  
                  {msg.scamDetected && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
                      ⚠️ SCAM DETECTED
                      {msg.scamIndicators && msg.scamIndicators.length > 0 && (
                        <div className="mt-1 text-xs opacity-80">
                          {msg.scamIndicators.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 font-medium uppercase tracking-wider text-sm">
                  {currentPersona.name} analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM INPUT - LOCKED POSITION */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-40">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3">
          
          {/* CONTROLS ROW */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={startListening}
              disabled={loading || isListening || !micSupported}
              className={`
                px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all
                ${isListening 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : micSupported 
                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }
                disabled:opacity-50
              `}
              style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}
            >
              Mic {isListening ? 'ON' : micSupported ? 'OFF' : 'N/A'}
            </button>

            <button
              onClick={toggleTTS}
              className={`
                px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all relative
                ${autoTTS 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }
              `}
              style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}
            >
              Voice {autoTTS ? 'ON' : 'OFF'}
              {isSpeaking && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
          
          {/* INPUT ROW */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isListening ? "Listening..." : `Message ${currentPersona.name}...`}
                disabled={loading || isListening}
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium"
                style={{ fontSize: `${zoomLevel / 100}rem` }}
                rows={1}
              />
            </div>
            
            <button 
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || isListening}
              className={`
                px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-[0.1em] transition-all
                ${input.trim() && !loading && !isListening
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }
              `}
              style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}
            >
              {loading ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
