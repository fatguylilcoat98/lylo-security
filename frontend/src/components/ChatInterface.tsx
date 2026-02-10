import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../lib/api';

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
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onUsageUpdate
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // --- TEXT TO SPEECH ---
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // --- SEND LOGIC ---
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    stopSpeaking();

    const userMsg = { id: Date.now(), content: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    const originalInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(originalInput, [], currentPersona.id, userEmail);
      const botMsg = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        isScam: response.scam_detected
      };
      setMessages(prev => [...prev, botMsg]);
      speakText(response.answer); // Auto-speak response
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "Connection Error.", sender: 'bot' }]);
    } finally {
      setLoading(false);
      onUsageUpdate();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  if (!icons) return <div className="p-10 text-gray-500">Loading...</div>;

  // Calculate dynamic font size based on zoomLevel (Base 16px)
  // 100% = 1rem, 200% = 2rem. 
  // We apply this to the chat container so layout doesn't break.
  const dynamicFontSize = { fontSize: `${zoomLevel}%` };

  return (
    <div className="flex flex-col h-full bg-[#050505] relative">
      
      {/* 1. HEADER (Persona Info + Logo) */}
      <div className="bg-black border-b border-white/10 p-3 flex-shrink-0 flex items-center justify-between z-10">
         <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${currentPersona.color}-500/20 text-${currentPersona.color}-400 border border-${currentPersona.color}-500/30`}>
               {currentPersona.iconName === 'Shield' && <icons.Shield size={20} />}
               {currentPersona.iconName === 'ChefHat' && <icons.ChefHat size={20} />}
               {currentPersona.iconName === 'Cpu' && <icons.Cpu size={20} />}
               {currentPersona.iconName === 'Scale' && <icons.Scale size={20} />}
               {currentPersona.iconName === 'Flame' && <icons.Flame size={20} />}
               {currentPersona.iconName === 'Heart' && <icons.Heart size={20} />}
            </div>
            <div>
              <h1 className="text-white font-bold text-sm uppercase tracking-wider">{currentPersona.name}</h1>
              <p className="text-gray-500 text-xs">Talking to {userName}</p>
            </div>
         </div>
      </div>

      {/* 2. MESSAGES AREA (Scrollable) */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={dynamicFontSize} // Zoom applies only to text size here
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[85%] p-4 rounded-2xl leading-relaxed whitespace-pre-wrap
              ${msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-sm' 
                : 'bg-zinc-800 text-gray-100 border border-white/10 rounded-tl-sm'
              }
              ${msg.isScam ? 'border-2 border-red-500 bg-red-900/20' : ''}
            `}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-500 animate-pulse pl-2">Thinking...</div>}
      </div>

      {/* 3. INPUT AREA (Fixed Bottom) */}
      <div className="flex-shrink-0 bg-black border-t border-white/10 p-3 pb-6 z-20">
         <div className="max-w-4xl mx-auto space-y-2">
            
            {/* ROW 1: TOOLS (Mic, Camera, Zoom) */}
            <div className="flex items-center justify-between">
               <div className="flex gap-2">
                  <button className="p-2 bg-zinc-800 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-700">
                    <icons.Mic size={20} />
                  </button>
                  <button className="p-2 bg-zinc-800 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-700">
                    <icons.Camera size={20} />
                  </button>
                  <button className="p-2 bg-zinc-800 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-700">
                    <icons.Upload size={20} />
                  </button>
               </div>
               
               {/* Zoom Controls moved here */}
               <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/10">
                  {onZoomOut && (
                    <button onClick={onZoomOut} className="p-1.5 text-gray-400 hover:text-white">
                      <icons.Minus size={16} />
                    </button>
                  )}
                  <span className="text-xs font-mono text-blue-400 w-8 text-center">{zoomLevel}%</span>
                  {onZoomIn && (
                     <button onClick={onZoomIn} className="p-1.5 text-gray-400 hover:text-white">
                      <icons.Plus size={16} />
                    </button>
                  )}
               </div>
            </div>

            {/* ROW 2: INPUT + SEND */}
            <div className="flex gap-2">
               <textarea 
                 ref={inputRef}
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                 placeholder="Type or speak..."
                 className="flex-1 bg-zinc-900 border border-white/20 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500 resize-none h-[54px]"
               />
               <button 
                 onClick={handleSend}
                 disabled={!input.trim() || loading}
                 className={`
                   px-6 rounded-xl font-bold transition-all h-[54px] flex items-center justify-center
                   ${input.trim() 
                     ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' 
                     : 'bg-zinc-800 text-gray-500'
                   }
                 `}
               >
                 <icons.Send size={24} />
               </button>
            </div>

         </div>
      </div>

    </div>
  );
}
