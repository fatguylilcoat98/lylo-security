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
        isScam: response.scam_detected,
        confidence: response.confidence_score || 0 // Store confidence for ALL messages
      };
      
      setMessages(prev => [...prev, botMsg]);
      speakText(response.answer); 
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "Connection Error.", sender: 'bot' }]);
    } finally {
      setLoading(false);
      onUsageUpdate();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  if (!icons) return <div className="p-10 text-gray-500">Loading...</div>;

  return (
    // MAIN CONTAINER (100dvh for mobile stability)
    <div className="flex flex-col h-[100dvh] bg-[#050505] relative overflow-hidden font-sans">
      
      {/* 1. HEADER (Fixed Top) */}
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
        className="flex-1 overflow-y-auto p-4 space-y-6 pb-64" // Extra padding so nothing hides behind the footer
      >
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            
            {/* The Message Bubble */}
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
                style={{ fontSize: `${zoomLevel}%` }}
              >
                {/* Threat Banner (Only if Scam) */}
                {msg.isScam && (
                  <div className="flex items-center gap-2 text-red-400 font-bold mb-2 pb-2 border-b border-red-500/30 uppercase tracking-wider text-xs">
                    <icons.AlertTriangle size={16} /> Threat Detected
                  </div>
                )}
                
                {msg.content}
              </div>
            </div>

            {/* TRUTH METER (Always Visible for Bot) */}
            {msg.sender === 'bot' && (
               <div className="max-w-[85%] bg-black/40 border border-white/10 rounded-xl p-3 ml-1">
                  <div className="flex justify-between text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold">
                     <span className={msg.isScam ? "text-red-400" : "text-blue-400"}>
                        {msg.isScam ? "Threat Level" : "Truth Confidence"}
                     </span>
                     <span className={msg.isScam ? "text-red-400" : "text-blue-400"}>
                        {msg.confidence || 0}%
                     </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
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
            <span className="text-xs font-bold uppercase tracking-wider">Analyzing Truth...</span>
          </div>
        )}
      </div>

      {/* 3. INPUT AREA (Fixed Bottom - Locked to Screen) */}
      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-white/10 p-3 pb-6 z-50 shadow-2xl">
         <div className="max-w-4xl mx-auto space-y-2">
            
            {/* ROW 1: TOOLS (Mic, Camera, Upload, Zoom) */}
            <div className="flex items-center justify-between">
               <div className="flex gap-2">
                  <button className="p-3 bg-zinc-800 rounded-xl text-gray-400 hover:text-white active:bg-zinc-700">
                    <icons.Mic size={24} />
                  </button>
                  <button className="p-3 bg-zinc-800 rounded-xl text-gray-400 hover:text-white active:bg-zinc-700">
                    <icons.Camera size={24} />
                  </button>
                  <button className="p-3 bg-zinc-800 rounded-xl text-gray-400 hover:text-white active:bg-zinc-700">
                    <icons.Upload size={24} />
                  </button>
               </div>
               
               {/* Zoom Controls */}
               <div className="flex items-center gap-2 bg-zinc-900 rounded-xl p-1 border border-white/10">
                  {onZoomOut && (
                    <button onClick={onZoomOut} className="p-2 text-gray-400 hover:text-white">
                      <icons.Minus size={20} />
                    </button>
                  )}
                  <span className="text-sm font-mono text-blue-400 w-10 text-center font-bold">{zoomLevel}%</span>
                  {onZoomIn && (
                     <button onClick={onZoomIn} className="p-2 text-gray-400 hover:text-white">
                      <icons.Plus size={20} />
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
