import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../lib/api';

// Dynamic imports to prevent startup crashes
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

export default function ChatInterface({ 
  currentPersona, 
  userEmail, 
  userName,
  onZoomIn,
  onZoomOut,
  onUsageUpdate 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load icons
  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { id: Date.now(), content: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(input, [], currentPersona.id, userEmail);
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        isScam: response.scam_detected
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "System Offline.", sender: 'bot' }]);
    } finally {
      setLoading(false);
      onUsageUpdate();
    }
  };

  const getPersonaColor = (color: string) => {
    switch(color) {
      case 'red': return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'blue': return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
      case 'green': return 'text-green-500 border-green-500/30 bg-green-500/10';
      case 'orange': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
      case 'purple': return 'text-purple-500 border-purple-500/30 bg-purple-500/10';
      case 'yellow': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10';
    }
  };

  if (!icons) return <div className="p-10 text-center text-gray-500">Loading Interface...</div>;

  return (
    <div className="flex flex-col h-full relative">
      
      {/* THE FLOATING HEADER: Minimal & Transparent
         Instead of a big bar, this just puts Zoom buttons in the top right.
      */}
      {messages.length > 0 && (
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {onZoomOut && (
            <button onClick={onZoomOut} className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-white/20 backdrop-blur-md">
              <icons.Minus size={14} />
            </button>
          )}
          {onZoomIn && (
            <button onClick={onZoomIn} className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-white/20 backdrop-blur-md">
              <icons.Plus size={14} />
            </button>
          )}
        </div>
      )}

      {/* MESSAGES AREA
         If empty, show a centered (but smaller) welcome screen.
      */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6">
            <div className={`
              w-20 h-20 md:w-24 md:h-24 rounded-full border mb-4 flex items-center justify-center animate-pulse
              ${getPersonaColor(currentPersona.color)}
            `}>
              <icons.Bot size={40} />
            </div>
            
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2 text-center tracking-tight">
              {currentPersona.name.toUpperCase()}
            </h2>
            
            <p className="text-sm text-gray-400 text-center max-w-xs">
              {currentPersona.description}
            </p>
            
            {/* Zoom Controls for Empty State */}
            <div className="flex gap-4 mt-8 pointer-events-auto">
              {onZoomOut && (
                <button onClick={onZoomOut} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-400">
                  Smaller Text
                </button>
              )}
              {onZoomIn && (
                <button onClick={onZoomIn} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-400">
                  Larger Text
                </button>
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[85%] md:max-w-[70%] p-4 rounded-2xl relative group
              ${msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/20' 
                : 'bg-white/5 border border-white/10 text-gray-100 rounded-tl-sm backdrop-blur-sm'
              }
              ${msg.isScam ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}
            `}>
              {msg.isScam && (
                <div className="flex items-center gap-2 text-red-400 text-xs font-bold mb-2 uppercase tracking-wider border-b border-red-500/30 pb-2">
                  <icons.AlertTriangle size={12} /> Threat Detected
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 p-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
              <icons.Loader2 className="animate-spin text-cyan-400" size={16} />
              <span className="text-xs text-gray-400 font-mono animate-pulse">ANALYZING DATA STREAM...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT BAR
         Fixed to bottom, cleaner look.
      */}
      <div className="p-4 md:p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
        <div className="max-w-4xl mx-auto relative flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl shadow-2xl">
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Upload Image"
          >
            <icons.ImagePlus size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => {
               // Handle file upload logic later
               console.log(e.target.files?.[0]);
            }}
          />
          
          <input 
            className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none py-2 text-sm md:text-base"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            placeholder={`Ask ${currentPersona.name}...`} 
          />
          
          <button className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <icons.Mic size={20} />
          </button>

          <button 
            onClick={handleSend} 
            disabled={!input.trim() || loading}
            className={`
              p-3 rounded-xl font-bold transition-all shadow-lg
              ${!input.trim() || loading 
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 hover:shadow-blue-500/40'
              }
            `}
          >
            <icons.Send size={18} />
          </button>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
            SECURE CHANNEL ENCRYPTED
          </p>
        </div>
      </div>
    </div>
  );
}
