import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, ChatMessage, connectLegal } from '../lib/api';
import { PersonaConfig } from './Layout';
import ConfidenceDisplay from './ConfidenceDisplay';

// Dynamic icon imports
const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel?: number;
  onUsageUpdate?: () => void;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  confidence?: number;
  confidence_explanation?: string;
  scam_detected?: boolean;
  scam_indicators?: string[];
  detailed_analysis?: string;
  timestamp: number;
  isImage?: boolean;
  legal_connect?: any;
  usage_info?: any;
}

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel = 100,
  onUsageUpdate
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  const [showLegalConnect, setShowLegalConnect] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load icons
  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, thinking]);

  // Text-to-Speech function
  const speakText = (text: string) => {
    if (!autoTTS || !window.speechSynthesis || isSpeaking) return;
    
    // Clean the text for better speech
    const cleanText = text
      .replace(/[⚠️🛡️✅📷]/g, '') // Remove emojis
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\n+/g, '. ') // Replace newlines with periods
      .trim();
    
    if (!cleanText) return;
    
    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Make it sound natural and human
    utterance.rate = 0.85; // Slightly slower for clarity
    utterance.pitch = 1.0; // Natural pitch
    utterance.volume = 0.9; // Good volume
    
    // Use the most natural voice available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = [
      'Samantha', 'Karen', 'Daniel', 'Alex', 'Victoria', 'Thomas'
    ];
    
    let selectedVoice = voices.find(voice => 
      preferredVoices.some(preferred => voice.name.includes(preferred))
    );
    
    // Fallback to any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        voice.lang.startsWith('en') && !voice.name.includes('Google')
      );
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    setIsSpeaking(true);
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = () => {
      setIsSpeaking(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Auto-speak when new bot message arrives
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && lastMessage.content && autoTTS) {
      // Wait a moment for the message to render, then speak
      setTimeout(() => {
        speakText(lastMessage.content);
      }, 800);
    }
  }, [messages, autoTTS]);

  // Speech recognition setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => handleSend(transcript), 100);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      // Stop any current speech before listening
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleTTS = () => {
    if (autoTTS && isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setAutoTTS(!autoTTS);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageMsg: Message = {
      id: Date.now(),
      content: `📷 Uploaded: ${file.name}`,
      sender: 'user',
      timestamp: Date.now(),
      isImage: true
    };
    setMessages(prev => [...prev, imageMsg]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await handleSend(`Analyze this image: ${file.name}`, base64);
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
  };

  const handleLegalConnect = async (caseType: string = "scam_recovery") => {
    try {
      const result = await connectLegal(
        Date.now().toString(),
        caseType,
        userEmail,
        "User requested legal assistance from chat"
      );
      
      const legalMsg: Message = {
        id: Date.now(),
        content: `✅ ${result.message}\n\nCase ID: ${result.case_id}\n\nNext steps:\n${result.next_steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}`,
        sender: 'bot',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, legalMsg]);
      setShowLegalConnect(false);
    } catch (error) {
      console.error('Legal connect error:', error);
    }
  };

  const handleSend = async (messageText?: string, imageData?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;
    
    // Stop any current speech when sending a message
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    
    if (!imageData) {
      const userMsg: Message = { 
        id: Date.now(), 
        content: textToSend, 
        sender: 'user', 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, userMsg]);
    }
    
    setInput('');
    setLoading(true);
    setThinking(true);

    try {
      const history: ChatMessage[] = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      history.push({
        role: 'user',
        content: textToSend,
        timestamp: Date.now()
      });

      const response = await sendChatMessage(
        textToSend, 
        history, 
        currentPersona.id,
        userEmail,
        Date.now().toString()
      );
      
      setThinking(false);

      // Check for usage limit reached
      if (response.upgrade_needed) {
        const upgradeMsg: Message = {
          id: Date.now() + 1,
          content: response.answer,
          sender: 'bot',
          timestamp: Date.now(),
          usage_info: response.usage_info
        };
        setMessages(prev => [...prev, upgradeMsg]);
        if (onUsageUpdate) onUsageUpdate();
        return;
      }
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        confidence_explanation: response.confidence_explanation,
        scam_detected: response.scam_detected,
        scam_indicators: response.scam_indicators,
        detailed_analysis: response.detailed_analysis,
        timestamp: Date.now(),
        legal_connect: response.legal_connect,
        usage_info: response.usage_info
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      // Update usage tracking
      if (onUsageUpdate) onUsageUpdate();
      
    } catch (error) {
      setThinking(false);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "I'm having connection trouble. Please try again.", 
        sender: 'bot',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getPersonaGradient = () => {
    const gradients = {
      cyan: 'from-cyan-500 to-blue-500',
      orange: 'from-orange-500 to-red-500',
      purple: 'from-purple-500 to-indigo-500',
      yellow: 'from-yellow-500 to-orange-500',
      red: 'from-red-500 to-pink-500',
      green: 'from-green-500 to-emerald-500'
    };
    return gradients[currentPersona.color as keyof typeof gradients] || gradients.cyan;
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#050505] relative"
      style={{ fontSize: `${zoomLevel}%` }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900/5 to-black pointer-events-none" />
      <div className={`absolute inset-0 bg-gradient-to-t from-${currentPersona.color}-500/5 via-transparent to-transparent pointer-events-none`} />

      {/* Chat Messages Area - Add padding bottom for fixed input */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 pb-32">
        {messages.length === 0 && !thinking && (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <div className="relative mb-6">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getPersonaGradient()} p-6 shadow-2xl`}>
                {icons?.[currentPersona.iconName] && 
                  React.createElement(icons[currentPersona.iconName], { 
                    className: "w-full h-full text-white" 
                  })
                }
              </div>
              <div className="absolute -inset-2 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-xl" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{currentPersona.name}</h3>
            <p className="text-gray-400 text-center max-w-md text-sm leading-relaxed">
              {currentPersona.description}. I learn from our conversations to help you better.
            </p>
            {autoTTS && (
              <p className="text-cyan-400 text-center text-xs mt-2">
                🔊 Auto-speech is ON - I'll read my responses aloud
              </p>
            )}
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className="space-y-4 animate-in slide-in-from-bottom duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Message Bubble */}
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[80%] md:max-w-[70%] p-4 rounded-2xl shadow-xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? `bg-gradient-to-br ${getPersonaGradient()} border-white/20 text-white shadow-${currentPersona.color}-500/20`
                  : 'bg-black/40 border-white/10 text-gray-100 shadow-black/50'
                }
              `}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
                
                {/* Speaking Indicator for Bot Messages */}
                {msg.sender === 'bot' && isSpeaking && index === messages.length - 1 && (
                  <div className="flex items-center gap-2 mt-2 text-cyan-400 text-xs">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                    <span>Speaking...</span>
                  </div>
                )}
                
                {/* Timestamp */}
                <div className={`text-xs mt-2 opacity-60 ${
                  msg.sender === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Confidence Display for Bot Messages */}
            {msg.sender === 'bot' && msg.confidence !== undefined && (
              <div className="max-w-[80%] md:max-w-[70%]">
                <ConfidenceDisplay
                  confidence={msg.confidence}
                  explanation={msg.confidence_explanation}
                  scamDetected={msg.scam_detected || false}
                  indicators={msg.scam_indicators}
                  detailedAnalysis={msg.detailed_analysis}
                />
              </div>
            )}

            {/* Legal Connect Option */}
            {msg.legal_connect?.available && !showLegalConnect && (
              <div className="max-w-[80%] md:max-w-[70%]">
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {icons?.Scale && <icons.Scale className="w-5 h-5 text-yellow-400" />}
                    <span className="text-yellow-400 font-semibold">Legal Assistance Available</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">{msg.legal_connect.message}</p>
                  <button
                    onClick={() => setShowLegalConnect(true)}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Connect with Legal Partner
                  </button>
                </div>
              </div>
            )}

            {/* Usage Warning */}
            {msg.usage_info?.is_overage && (
              <div className="max-w-[80%] md:max-w-[70%]">
                <div className="bg-orange-500/20 border border-orange-400/30 rounded-2xl p-3">
                  <div className="text-orange-400 text-sm font-medium mb-1">
                    ⚠️ Over daily limit
                  </div>
                  <div className="text-orange-300 text-xs">
                    This message cost ${msg.usage_info.overage_cost?.toFixed(2)} extra
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Thinking Animation */}
        {thinking && (
          <div className="flex justify-start animate-in slide-in-from-bottom duration-300">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`w-2 h-2 bg-${currentPersona.color}-400 rounded-full animate-bounce`}
                      style={{ animationDelay: `${i * 200}ms` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-300">
                  {currentPersona.name} is analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legal Connect Modal */}
      {showLegalConnect && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              {icons?.Scale && <icons.Scale className="w-6 h-6 text-yellow-400" />}
              <h3 className="text-xl font-bold text-white">Legal Assistance</h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              Connect with our legal partners for scam recovery assistance. This service is included with your Elite membership.
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleLegalConnect("scam_recovery")}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-3 rounded-lg transition-colors"
              >
                Scam Recovery Case
              </button>
              <button
                onClick={() => handleLegalConnect("fraud_investigation")}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-3 rounded-lg transition-colors"
              >
                Fraud Investigation
              </button>
              <button
                onClick={() => handleLegalConnect("identity_theft")}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-3 rounded-lg transition-colors"
              >
                Identity Theft
              </button>
            </div>
            
            <button
              onClick={() => setShowLegalConnect(false)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fixed Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-white/10 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
            <div className="flex items-end gap-3 p-4">
              
              {/* Voice Input Button */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={loading}
                className={`
                  p-3 rounded-xl transition-all border shadow-lg
                  ${isListening 
                    ? 'bg-red-500 border-red-400 text-white animate-pulse shadow-red-500/30' 
                    : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {icons?.Mic && <icons.Mic className="w-5 h-5" />}
              </button>

              {/* TTS Toggle Button */}
              <button
                onClick={toggleTTS}
                className={`
                  p-3 rounded-xl transition-all border shadow-lg relative
                  ${autoTTS 
                    ? 'bg-green-500 border-green-400 text-white shadow-green-500/30' 
                    : 'bg-gray-700 border-gray-600 text-gray-300'
                  }
                `}
                title={autoTTS ? "Turn off auto-speech" : "Turn on auto-speech"}
              >
                {autoTTS ? '🔊' : '🔇'}
                {isSpeaking && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                )}
              </button>

              {/* Image Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="p-3 rounded-xl bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Upload image"
              >
                {icons?.Paperclip && <icons.Paperclip className="w-5 h-5" />}
              </button>

              <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {/* Text Input */}
              <div className="flex-1 relative">
                <input 
                  ref={inputRef}
                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm py-3 px-4"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isListening 
                      ? "🎤 Listening..." 
                      : `Message ${currentPersona.name}...`
                  }
                  disabled={isListening || loading}
                />
              </div>
              
              {/* Send Button */}
              <button 
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={`
                  px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-lg border
                  ${input.trim() && !loading
                    ? `bg-gradient-to-r ${getPersonaGradient()} border-white/20 text-white hover:shadow-${currentPersona.color}-500/30 shadow-${currentPersona.color}-500/20`
                    : 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {loading 
                  ? (icons?.Loader2 && <icons.Loader2 className="w-4 h-4 animate-spin" />) || '...'
                  : (icons?.Send && <icons.Send className="w-4 h-4" />) || 'Send'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
