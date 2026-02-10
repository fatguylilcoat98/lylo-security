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

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // TEXT TO SPEECH (Talking Back)
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop previous
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1;
      utterance.rate = 1;
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

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
      
      // Auto-Speak the response
      speakText(response.answer);
      
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "Error connecting.", sender: 'bot' }]);
    } finally {
      setLoading(false);
      onUsageUpdate();
    }
  };

  // SPEECH TO TEXT (Listening)
  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => alert("Listening...");
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };
      
      recognition.start();
    } else {
      alert("Voice input not supported in this browser. Try Chrome.");
    }
  };

  if (!icons) return <div className="p-10 text-gray-500">Loading...</div>;

  return (
    <div 
      className="flex flex-col h-full bg-[#050505] relative"
      // ACCESSIBILITY ZOOM: Using the CSS 'zoom' property scales the ENTIRE layout
      style={{ zoom: zoomLevel / 100 }}
    >
      
      {/* HEADER: User Name + Logo */}
      <div className="bg-black border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {/* LOGO BOX */}
          <div className="w-12 h-12 bg-blue-900/30 border border-blue-500/30 rounded-lg flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            {/* USER NAME (Not Persona Name) */}
            <h1 className="text-white font-black uppercase text-lg tracking-wider">
              {userName}
            </h1>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <p className="text-gray-400 text-xs font-bold">ONLINE</p>
            </div>
          </div>
        </div>
        
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 p-1">
          {onZoomOut && (
            <button onClick={onZoomOut} className="p-2 text-gray-400 hover:text-white">
              <icons.Minus size={20} />
            </button>
          )}
          {onZoomIn && (
             <button onClick={onZoomIn} className="p-2 text-gray-400 hover:text-white">
              <icons.Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-32" // Added huge padding bottom so messages aren't hidden by sticky footer
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[85%] p-4 rounded-2xl text-lg leading-relaxed
              ${msg.sender === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-white border border-white/10'
              }
              ${msg.isScam ? 'border-2 border-red-500 bg-red-900/20' : ''}
            `}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-gray-500 p-4 animate-pulse">Processing...</div>
        )}
      </div>

      {/* STICKY FOOTER INPUT (Locked to Bottom) */}
      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-white/10 p-4 z-30 md:static md:bg-transparent">
        <div className="max-w-4xl mx-auto flex gap-2">
           {/* Mic Button */}
           <button 
             onClick={startListening}
             className="p-4 bg-gray-800 rounded-xl text-white hover:bg-gray-700 active:bg-blue-600 transition-colors"
           >
             <icons.Mic size={24} />
           </button>

           {/* Stop Speaking Button (If speaking) */}
           {isSpeaking && (
             <button 
               onClick={stopSpeaking}
               className="p-4 bg-red-600 rounded-xl text-white animate-pulse"
             >
               <icons.VolumeX size={24} />
             </button>
           )}

           <input 
             className="flex-1 bg-gray-900 border border-white/20 text-white text-lg px-4 rounded-xl focus:outline-none focus:border-blue-500"
             value={input} 
             onChange={(e) => setInput(e.target.value)} 
             placeholder="Type or speak..." 
           />
           
           <button 
             onClick={handleSend}
             className="p-4 bg-blue-600 rounded-xl text-white font-bold"
           >
             <icons.Send size={24} />
           </button>
        </div>
      </div>
    </div>
  );
}
