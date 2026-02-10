import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../lib/api';

// Dynamic imports for Icons
const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

interface ChatInterfaceProps {
  currentPersona: any;
  userEmail: string;
  userName: string;
  zoomLevel: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onUsageUpdate: () => void;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  confidence?: number;
  timestamp: number;
  isScam?: boolean;
}

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onUsageUpdate
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  // Auto-scroll to bottom with accessibility announcement
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { 
      id: Date.now(), 
      content: input.trim(), 
      sender: 'user', 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    const messageToSend = input.trim();
    setInput('');
    setLoading(true);

    // Focus back on input for keyboard users
    setTimeout(() => inputRef.current?.focus(), 100);

    try {
      const response = await sendChatMessage(messageToSend, [], currentPersona.id, userEmail);
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        isScam: response.scam_detected,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, botMsg]);
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "Connection error. Please try again.", 
        sender: 'bot',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
      onUsageUpdate();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!icons) return <div className="p-10 text-gray-500" role="status">Loading Interface...</div>;

  return (
    <div 
      className="flex flex-col h-full bg-[#050505] font-sans relative"
      role="main"
      aria-label="Chat Interface"
    >
      
      {/* HEADER: Accessible & High Contrast */}
      <header className="bg-black border-b border-white/10 p-3 md:p-4 flex-shrink-0 z-10 sticky top-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Persona Icon with Alt Text */}
            <div 
              className="w-10 h-10 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20"
              aria-hidden="true"
            >
              {currentPersona.icon === 'Shield' && <icons.Shield className="text-white w-5 h-5" />}
              {currentPersona.icon === 'ChefHat' && <icons.ChefHat className="text-white w-5 h-5" />}
              {currentPersona.icon === 'Cpu' && <icons.Cpu className="text-white w-5 h-5" />}
              {currentPersona.icon === 'Scale' && <icons.Scale className="text-white w-5 h-5" />}
              {currentPersona.icon === 'Flame' && <icons.Flame className="text-white w-5 h-5" />}
              {currentPersona.icon === 'Heart' && <icons.Heart className="text-white w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-white font-black uppercase tracking-[0.1em] text-sm md:text-base">
                {currentPersona.name}
              </h1>
              <div className="flex items-center gap-2" role="status" aria-label="System Status: Online">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                 <p className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Online</p>
              </div>
            </div>
          </div>
          
          {/* Zoom Controls: High Contrast & Large Touch Targets */}
          <div 
            className="flex items-center gap-2 bg-white/5 rounded-lg p-1 border border-white/10"
            role="group"
            aria-label="Text Size Controls"
          >
            {onZoomOut && (
              <button 
                onClick={onZoomOut} 
                className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Decrease Text Size"
              >
                <icons.Minus size={16} />
              </button>
            )}
            <span className="text-xs font-mono text-blue-400 min-w-[30px] text-center" aria-hidden="true">
              {zoomLevel}%
            </span>
            {onZoomIn && (
               <button 
                 onClick={onZoomIn} 
                 className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                 aria-label="Increase Text Size"
               >
                <icons.Plus size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages Area: Scrollable & Readable */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        role="log"
        aria-live="polite"
        style={{ fontSize: `${zoomLevel}%` }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center opacity-60">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
              <icons.MessageSquare size={24} className="text-blue-500" />
            </div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">
              Secure Channel
            </h2>
            <p className="text-gray-500 text-xs">
              Encrypted connection established with {currentPersona.name}
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <article 
            key={msg.id} 
            className="space-y-1"
            aria-label={`Message from ${msg.sender === 'user' ? 'You' : currentPersona.name}`}
          >
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] md:max-w-[75%] p-3 md:p-4 rounded-2xl backdrop-blur-sm border transition-all text-sm md:text-base leading-relaxed
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#2563eb] border-[#3b82f6]/50 text-white shadow-lg shadow-blue-900/20 rounded-tr-sm' 
                  : 'bg-zinc-900/80 border-white/10 text-gray-200 rounded-tl-sm'
                }
                ${msg.isScam ? 'border-red-500 bg-red-900/10' : ''}
              `}>
                 {msg.isScam && (
                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold mb-2 border-b border-red-500/20 pb-2" role="alert">
                      <icons.AlertTriangle size={12} /> THREAT DETECTED
                    </div>
                  )}
                {msg.content}
              </div>
            </div>
            
            <div className={`flex items-center gap-2 text-[10px] text-gray-600 uppercase tracking-wider font-bold ${msg.sender === 'user' ? 'justify-end' : 'justify-start ml-1'}`}>
              {msg.sender === 'bot' && msg.confidence && (
                 <span className="text-blue-500/80" aria-label={`Confidence score: ${msg.confidence}%`}>
                   Conf: {msg.confidence}%
                 </span>
              )}
              <time dateTime={new Date(msg.timestamp).toISOString()}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          </article>
        ))}
        
        {loading && (
          <div className="flex justify-start" role="status">
             <div className="bg-zinc-900/50 border border-white/5 px-4 py-3 rounded-xl flex items-center gap-3">
               <icons.Loader2 className="animate-spin text-blue-500" size={16} />
               <span className="text-xs text-gray-400 font-mono tracking-wider">PROCESSING...</span>
             </div>
          </div>
        )}
      </div>

      {/* Input Area: Accessible Form */}
      <footer className="flex-shrink-0 bg-black/80 backdrop-blur-md border-t border-white/10 p-3 md:p-4 pb-6 md:pb-6 sticky bottom-0">
        <div className="max-w-4xl mx-auto bg-zinc-900/50 backdrop-blur-xl rounded-xl border border-white/10 p-2 flex items-end gap-2 shadow-xl">
           
           <button 
             onClick={() => alert("Image Upload Coming Soon")}
             className="p-3 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
             aria-label="Upload Image"
           >
             <icons.Paperclip size={20} />
           </button>

           <label htmlFor="chat-input" className="sr-only">Type your message</label>
           <textarea 
             id="chat-input"
             ref={inputRef}
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={handleKeyPress}
             placeholder="Type your message..."
             disabled={loading}
             className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-base py-3 resize-none max-h-[120px] min-h-[44px]"
             rows={1}
             aria-invalid="false"
           />
           
           <button 
             onClick={handleSend}
             disabled={loading || !input.trim()}
             className={`
               p-3 rounded-lg transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none
               ${input.trim() && !loading
                 ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                 : 'bg-zinc-800 text-gray-600 cursor-not-allowed'
               }
             `}
             aria-label="Send Message"
           >
             <icons.Send size={20} />
           </button>
        </div>
      </footer>
    </div>
  );
}
