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
    
    // 1. Optimistically add user message
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    
    const originalInput = input;
    setInput('');
    setLoading(true);

    try {
      // 2. CRITICAL FIX: Format History for the AI
      // We convert the React state 'messages' into the simple list the API needs
      const history = messages.map(msg => ({
        role: msg.sender, // 'user' or 'bot'
        content: msg.content
      }));

      // 3. Send Input + HISTORY to the Backend
      const response = await sendChatMessage(
        originalInput, 
        history, // <--- Now the AI has memory!
        currentPersona.id, 
        userEmail
      );
      
      const botMsg = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        isScam: response.scam_detected,
        confidence: response.confidence_score || 0
      };
      
      setMessages(prev => [...prev, botMsg]);
      speakText(response.answer); 
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "I'm having trouble connecting to the mainframe. Please try again.", sender: 'bot' }]);
    } finally {
      setLoading(false);
      onUsageUpdate();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  if (!icons) return <div className="p-10 text-gray-500">Loading...</div>;

  return (
    // MAIN LAYOUT: Flex Column that fills the Viewport Height (dvh)
    <div className="flex flex-col h-[100dvh] bg-[#050505] font-sans overflow-hidden">
      
      {/* 1. HEADER (Logo + User Name + Zoom) */}
      <div className="bg-black border-b border-white/10 p-3 flex-shrink-0 flex items-center justify-between z-10">
         <div className="flex items-center gap-3">
            {/* LOGO BOX */}
            <div className="w-10 h-10 bg-blue-900/20 border border-blue-500/30 rounded-lg flex items-center justify-center overflow-hidden">
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              {/* USER NAME */}
              <h1 className="text-white font-black uppercase tracking-wider text-sm md:text-base">
                {userName.toUpperCase()}
              </h1>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                 <p className="text-gray-400 text-[10px] font-bold uppercase">SECURE LINK</p>
              </div>
            </div>
         </div>
         
         {/* ZOOM CONTROLS */}
         <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/10">
            {onZoomOut && (
              <button onClick={onZoomOut} className="p-2 text-gray-400 hover:text-white">
                <icons.Minus size={16} />
              </button>
            )}
            <span className="text-xs font-mono text-blue-400 w-8 text-center">{zoomLevel}%</span>
            {onZoomIn && (
               <button onClick={onZoomIn} className="p-2 text-gray-400 hover:text-white">
                <icons.Plus size={16} />
              </button>
            )}
         </div>
      </div>

      {/* 2. MESSAGES AREA */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6"
        style={{ fontSize: `${zoomLevel}%` }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            
            {/* Message Bubble */}
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`
                  max-w-[85%] p-4 rounded-2xl leading-relaxed whitespace-pre-wrap text-base
                  ${msg.sender === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-zinc-800 text-gray-100 border border-white/10 rounded-tl-sm'
                  }
                  ${msg.isScam ? 'border-2 border-red-500 bg-red-900/20' : ''}
                `}
              >
                {msg.isScam && (
                  <div className="flex items-center gap-2 text-red-400 font-bold mb-2 pb-2 border-b border-red-500/30 uppercase tracking-wider text-xs">
                    <icons.AlertTriangle size={16} /> Threat Detected
                  </div>
                )}
                {msg.content}
              </div>
            </div>

            {/* Truth/Confidence Meter (Bot Only) */}
            {msg.sender === 'bot' && (
               <div className="max-w-[85%] bg-zinc-900/50 border border-white/5 rounded-xl p-3 ml-1">
                  <div className="flex justify-between text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">
                     <span className={msg.isScam ? "text-red-400" : "text-blue-400"}>
                        {msg.isScam ? "Threat Level" : "Truth Confidence"}
                     </span>
                     <span className={msg.isScam ? "text-red-400" : "text-blue-400"}>
                        {msg.confidence || 0}%
                     </span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                     <div 
                       className={`h-full ${msg.isScam ? "bg-red-500" : "bg-blue-500"}`}
                       style={{ width: `${msg.confidence || 0}%` }} 
                     />
                  </div>
               </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 pl-2">
            <icons.Loader2 className="animate-spin" size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Processing...</span>
          </div>
        )}
      </div>

      {/* 3. INPUT AREA (Flexbox - Pinned to Bottom) */}
      <div className="flex-shrink-0 bg-black border-t border-white/10 p-3 pb-6 z-20 shadow-2xl">
         <div className="max-w-4xl mx-auto space-y-2">
            
            {/* ROW 1: TOOLS */}
            <div className="flex gap-2">
               <button className="flex-1 p-3 bg-zinc-800 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2">
                 <icons.Mic size={20} />
                 <span className="text-xs uppercase font-bold">Speak</span>
               </button>
               <button className="flex-1 p-3 bg-zinc-800 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2">
                 <icons.Camera size={20} />
                 <span className="text-xs uppercase font-bold">Scan</span>
               </button>
               <button className="flex-1 p-3 bg-zinc-800 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2">
                 <icons.Upload size={20} />
                 <span className="text-xs uppercase font-bold">Upload</span>
               </button>
            </div>

            {/* ROW 2: INPUT */}
            <div className="flex gap-2">
               <textarea 
                 ref={inputRef}
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                 placeholder="Type message..."
                 className="flex-1 bg-zinc-900 border border-white/20 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-500 resize-none h-[60px]"
               />
               <button 
                 onClick={handleSend}
                 disabled={!input.trim() || loading}
                 className={`
                   px-6 rounded-xl font-bold transition-all h-[60px] flex items-center justify-center
                   ${input.trim() 
                     ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' 
                     : 'bg-zinc-800 text-gray-500'
                   }
                 `}
               >
                 <icons.Send size={28} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
