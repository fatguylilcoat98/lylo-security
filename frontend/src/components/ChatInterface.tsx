import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, ChatMessage } from '../lib/api';
import { PersonaConfig } from './Layout';

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  userName: string;
  zoomLevel?: number;
  onUsageUpdate?: () => void;
  onPersonalityChange?: (personality: string) => void;
  onLogout?: () => void;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  confidence?: number;
  timestamp: number;
}

interface UserStats {
  daily_usage: number;
  monthly_usage: number;
  tier: string;
  total_conversations: number;
}

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  userName,
  zoomLevel = 100,
  onUsageUpdate,
  onPersonalityChange,
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

  // Load user stats
  useEffect(() => {
    fetchUserStats();
    
    // Check online status
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [userEmail]);

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`https://lylo-backend.onrender.com/user-stats/${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const stats = await response.json();
        setUserStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Natural TTS Setup
  const speakText = (text: string) => {
    if (!autoTTS || !text || isSpeaking) return;
    
    // Clean text for natural speech
    const cleanText = text
      .replace(/\([^)]*\)/g, '') // Remove confidence percentages
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown
      .trim();
    
    if (window.speechSynthesis && cleanText) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Natural human-like voice settings
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      
      // Try to get a natural voice
      const voices = window.speechSynthesis.getVoices();
      const naturalVoices = voices.filter(voice => 
        (voice.name.includes('Natural') || voice.name.includes('Premium') || 
         voice.name.includes('Samantha') || voice.name.includes('Karen')) &&
        voice.lang.startsWith('en')
      );
      
      if (naturalVoices.length > 0) {
        utterance.voice = naturalVoices[0];
      } else {
        // Fallback to best available English voice
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        if (englishVoices.length > 0) {
          utterance.voice = englishVoices[0];
        }
      }
      
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-speak bot messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS) {
      setTimeout(() => speakText(lastMessage.content), 700);
    }
  }, [messages, autoTTS]);

  // Voice Recognition Setup
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
        setTimeout(() => handleSend(transcript), 200);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !loading && !isListening) {
      // Stop any current speech
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
      const history: ChatMessage[] = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      const response = await sendChatMessage(
        textToSend, 
        history, 
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
      
      // Update stats
      if (onUsageUpdate) onUsageUpdate();
      fetchUserStats();
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "I'm having trouble connecting right now. Please check your internet connection and try again.", 
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

  const personalities = [
    { id: 'guardian', name: 'Guardian', desc: 'Protective and security-focused' },
    { id: 'friend', name: 'Friend', desc: 'Warm and supportive' },
    { id: 'roast', name: 'Roast Master', desc: 'Witty and sarcastic' },
    { id: 'chef', name: 'Chef', desc: 'Food and cooking expert' },
    { id: 'techie', name: 'Techie', desc: 'Technology specialist' },
    { id: 'lawyer', name: 'Lawyer', desc: 'Legal and professional' }
  ];

  return (
    <div 
      className="h-screen flex flex-col bg-[#050505] relative"
      style={{ fontSize: `${zoomLevel / 100}rem` }}
    >
      
      {/* Header */}
      <div className="bg-black border-b border-white/10 px-4 py-3 flex-shrink-0 relative">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          
          {/* Left: Hamburger Menu */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-10 h-10 flex flex-col justify-center items-center space-y-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="w-5 h-0.5 bg-white"></div>
              <div className="w-5 h-0.5 bg-white"></div>
              <div className="w-5 h-0.5 bg-white"></div>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/20 rounded-xl p-4 min-w-[300px] z-50">
                
                {/* User Info */}
                <div className="pb-4 border-b border-white/10 mb-4">
                  <div className="text-white font-bold">{userName || userEmail}</div>
                  <div className="text-gray-400 text-sm">
                    {userStats?.tier.toUpperCase()} TIER
                  </div>
                </div>

                {/* Usage Stats */}
                {userStats && (
                  <div className="mb-4 p-3 bg-white/5 rounded-lg">
                    <div className="text-white text-sm font-bold mb-2 uppercase tracking-wider">
                      Today's Usage
                    </div>
                    <div className="text-gray-300 text-sm">
                      Conversations: {userStats.daily_usage}
                    </div>
                    <div className="text-gray-300 text-sm">
                      Total Chats: {userStats.total_conversations}
                    </div>
                  </div>
                )}

                {/* Personality Selector */}
                <div className="mb-4">
                  <div className="text-white text-sm font-bold mb-3 uppercase tracking-wider">
                    AI Personality
                  </div>
                  <div className="space-y-2">
                    {personalities.map((personality) => (
                      <button
                        key={personality.id}
                        onClick={() => {
                          if (onPersonalityChange) {
                            onPersonalityChange(personality.id);
                          }
                          setShowDropdown(false);
                        }}
                        className={`
                          w-full text-left p-3 rounded-lg transition-colors text-sm
                          ${currentPersona.id === personality.id
                            ? 'bg-[#3b82f6] text-white'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                          }
                        `}
                      >
                        <div className="font-medium">{personality.name}</div>
                        <div className="text-xs opacity-75">{personality.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full p-3 text-left text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Center: LYLO Logo */}
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-black text-sm">L</span>
            </div>
            <h1 className="text-white font-black uppercase tracking-[0.3em] text-lg">
              LYLO
            </h1>
          </div>

          {/* Right: User Status */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white font-bold text-sm">
                {userName || 'User'}
              </div>
              <div className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        style={{ paddingBottom: '160px' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-3xl flex items-center justify-center mb-8 relative">
              <span className="text-white font-black text-3xl">L</span>
              <div className="absolute -inset-4 bg-[#3b82f6]/20 rounded-full blur-2xl" />
            </div>
            
            <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-4">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 text-lg max-w-md uppercase tracking-[0.1em] font-medium leading-relaxed">
              Your Personal AI Security Advisor is Online
            </p>
            
            {autoTTS && (
              <div className="mt-6 text-green-400 text-sm font-medium">
                🎙️ Voice Output: ON
              </div>
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            
            {/* Message Bubble */}
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-4 rounded-2xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="text-base leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                {/* Speaking Indicator */}
                {msg.sender === 'bot' && isSpeaking && (
                  <div className="flex items-center gap-2 mt-3 text-green-400 text-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1 h-1 bg-green-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                    <span>Speaking...</span>
                  </div>
                )}
                
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

            {/* Confidence Display */}
            {msg.sender === 'bot' && msg.confidence && (
              <div className="max-w-[85%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-bold uppercase text-sm tracking-[0.2em]">
                      Analysis Complete
                    </span>
                    <span className="text-[#3b82f6] font-black text-lg">
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
        
        {/* Loading */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 font-medium">
                  {currentPersona.name} analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/20">
            
            {/* Controls Row */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              
              {/* Microphone */}
              <button
                onClick={isListening ? () => setIsListening(false) : startListening}
                disabled={loading}
                className={`
                  px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-[0.2em] transition-all
                  ${isListening 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                Mic {isListening ? 'ON' : 'OFF'}
              </button>

              {/* Voice Output Toggle */}
              <button
                onClick={toggleTTS}
                className={`
                  px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-[0.2em] transition-all relative
                  ${autoTTS 
                    ? 'bg-green-600 text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }
                `}
              >
                Voice {autoTTS ? 'ON' : 'OFF'}
                {isSpeaking && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>
            
            {/* Input Row */}
            <div className="p-4">
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
                    style={{ fontSize: `${zoomLevel / 100}rem`, padding: '12px 0' }}
                    rows={2}
                  />
                </div>
                
                <button 
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className={`
                    px-8 py-4 rounded-xl font-bold uppercase tracking-[0.2em] transition-all min-w-[100px]
                    ${input.trim() && !loading
                      ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg hover:shadow-[#3b82f6]/25'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }
                  `}
                  style={{ fontSize: `${zoomLevel / 100 * 0.875}rem` }}
                >
                  {loading ? 'Sending' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
