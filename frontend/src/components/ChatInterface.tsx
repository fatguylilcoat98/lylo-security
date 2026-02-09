import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, ChatMessage } from '../lib/api';
import { PersonaConfig } from './Layout';

// Dynamic import of Lucide icons
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
  zoomLevel?: number;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  isScam?: boolean;
  confidence?: number;
  timestamp: number;
  isImage?: boolean;
}

export default function ChatInterface({ currentPersona, zoomLevel = 100 }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  
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
        // Auto-send after voice input
        setTimeout(() => handleSend(transcript), 100);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // Focus input after voice or normal interaction
  useEffect(() => {
    if (!isListening && !loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening, loading]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Add image preview message
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
    
    // Clear file input
    event.target.value = '';
  };

  const handleSend = async (messageText?: string, imageData?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;
    
    // Don't add user message if it's from image upload (already added)
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
      // Build conversation history
      const history: ChatMessage[] = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Add current message
      history.push({
        role: 'user',
        content: textToSend,
        timestamp: Date.now()
      });

      // Include persona instruction
      const response = await sendChatMessage(
        `${currentPersona.systemInstruction}\n\nUser: ${textToSend}`, 
        history, 
        {}, 
        "ELITE-2026", 
        imageData
      );
      
      setThinking(false);
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        isScam: response.scam_detected,
        confidence: response.confidence_score || 98,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setThinking(false);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "Neural link interrupted. LYLO systems temporarily offline.", 
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

      {/* Chat Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
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
              {currentPersona.description}. Ready to assist you with advanced AI capabilities.
            </p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className="space-y-3 animate-in slide-in-from-bottom duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Scam Warning */}
            {msg.isScam && (
              <div className="mx-auto max-w-md">
                <div className="bg-red-900/30 backdrop-blur-xl border border-red-500/50 rounded-2xl p-4 text-center shadow-lg shadow-red-500/10">
                  <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm mb-2">
                    {icons?.AlertTriangle && <icons.AlertTriangle className="w-5 h-5 animate-pulse" />}
                    THREAT DETECTED
                  </div>
                  <div className="text-red-300 text-xs">Confidence: {msg.confidence}%</div>
                </div>
              </div>
            )}
            
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[80%] md:max-w-[70%] p-4 rounded-2xl shadow-xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? `bg-gradient-to-br ${getPersonaGradient()} border-white/20 text-white shadow-${currentPersona.color}-500/20`
                  : msg.isScam 
                    ? 'bg-red-900/20 border-red-500/30 text-red-100 shadow-red-500/10' 
                    : 'bg-black/40 border-white/10 text-gray-100 shadow-black/50'
                }
              `}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
                
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
                  {currentPersona.name} is thinking...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-black/40 backdrop-blur-xl border-t border-white/10 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
            <div className="flex items-end gap-3 p-4">
              
              {/* Voice Button */}
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
                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm py-3 px-4 pr-12"
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
                
                {/* Character Count */}
                {input.length > 100 && (
                  <div className="absolute bottom-1 right-14 text-xs text-gray-500">
                    {input.length}/1000
                  </div>
                )}
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
