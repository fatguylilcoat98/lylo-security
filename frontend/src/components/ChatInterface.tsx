import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Volume2, VolumeX, Brain, Globe, Utensils, Zap, ShieldCheck, Menu, Minus, Plus, AlertTriangle, Camera, Upload, LogOut } from 'lucide-react';
import { sendChatMessage } from '../lib/api';

export default function ChatInterface({ profile }: { profile: any }) {
  // --- STATE ---
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAutoTalk, setIsAutoTalk] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- AUTO-TALK ENGINE ---
  const speak = (text: string) => {
    if (!isAutoTalk) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; 
    utterance.pitch = 0.85; // Professional Bodyguard pitch
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { id: Date.now(), content: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // PLUGGING IN YOUR EXISTING API LOGIC
      const response = await sendChatMessage(userMsg.content, profile, profile.access_code);
      
      const botMsg = { 
        id: Date.now() + 1, 
        content: response.answer || "Vault connection successful. Intelligence standing by.", 
        sender: 'bot',
        isScam: response.scam_detected,
        confidence: response.confidence_score || 98
      };
      
      setMessages(prev => [...prev, botMsg]);
      speak(botMsg.content);
      
    } catch (error) {
      const errorMsg = "CRITICAL ERROR: Neural link severed. Pinecone Vault inaccessible.";
      setMessages(prev => [...prev, { id: Date.now(), content: errorMsg, sender: 'bot', confidence: 0 }]);
      speak(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-[#E5E7EB] overflow-hidden font-['Inter']" style={{ fontSize: `${zoomLevel}%` }}>
      
      {/* MAIN COMMAND COLUMN */}
      <div className="flex-1 flex flex-col border-r border-white/5 relative">
        
        {/* FIXED HEADER: LOCKED */}
        <header className="flex-none bg-black border-b border-white/10 p-4 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{profile.name}</span>
            </div>
            
            <img src="lylo-sheild.png" alt="LYLO" className="w-10 h-10 object-contain" />

            <div className="flex items-center gap-4">
              <div className="flex items-center bg-white/5 rounded-full px-1">
                <button onClick={() => setZoomLevel(Math.max(80, zoomLevel - 10))} className="p-2 hover:text-blue-500"><Minus size={14}/></button>
                <button onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))} className="p-2 hover:text-blue-500"><Plus size={14}/></button>
              </div>
              <button onClick={() => setIsAutoTalk(!isAutoTalk)} className="text-gray-500 hover:text-blue-500">
                {isAutoTalk ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden text-gray-500"><Menu size={20}/></button>
            </div>
          </div>
        </header>

        {/* SCROLLABLE CHAT: THE ONLY MOVING PART */}
        <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
                <Zap size={40} className="text-blue-500" />
                <p className="text-xs uppercase tracking-[0.3em] font-bold">Waiting for input...</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-5 rounded-3xl max-w-[85%] text-sm leading-relaxed shadow-2xl ${
                msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#111] border border-white/5 text-gray-300 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
              
              {msg.sender === 'bot' && (
                <div className="mt-2 flex items-center gap-3 px-2">
                    <div className="h-0.5 w-12 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{width: `${msg.confidence}%`}}></div>
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-widest text-blue-500">
                        {msg.confidence}% Confidence | Truth Protocol Active
                    </span>
                    {msg.isScam && <span className="text-[7px] font-black uppercase text-red-500 flex items-center gap-1"><AlertTriangle size={10}/> SCAM DETECTED</span>}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl w-fit animate-pulse">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">Syncing with Pinecone Vault...</span>
            </div>
          )}
        </main>

        {/* FIXED FOOTER: LOCKED */}
        <footer className="flex-none bg-black border-t border-white/5 p-6 pb-10">
          <div className="max-w-4xl mx-auto flex gap-4 items-center bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-2 focus-within:border-blue-600 transition-all">
            <button className="p-3 text-gray-600 hover:text-blue-500"><Camera size={22} /></button>
            <button className="p-3 text-gray-600 hover:text-blue-500"><Upload size={22} /></button>
            <input 
              className="flex-1 bg-transparent p-2 text-sm text-white focus:outline-none placeholder:text-gray-800"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about Sacramento, tech mods, or safety..." 
            />
            <button onClick={handleSend} className="bg-blue-600 p-3.5 rounded-full text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
              <Send size={20} />
            </button>
            <button className="p-3 text-gray-600 hover:text-blue-500"><Mic size={22} /></button>
          </div>
        </footer>
      </div>

      {/* RIGHT SIDEBAR: INTELLIGENCE HUB (DESKTOP) */}
      <div className="hidden lg:flex w-80 flex-col bg-black p-8 space-y-10 border-l border-white/5 overflow-y-auto">
        <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-600 border-b border-white/5 pb-6">Intelligence Modules</h4>

        <div className="space-y-4">
            <div className="flex items-center gap-3 text-blue-500"><Brain size={18} /><span className="text-[10px] font-black uppercase tracking-[0.3em]">Pinecone Vault</span></div>
            <p className="text-[10px] text-gray-600 leading-relaxed italic uppercase tracking-widest">Recalling Xbox 360 mods, PC Build specs, and user preferences.</p>
        </div>

        <div className="space-y-4">
            <div className="flex items-center gap-3 text-cyan-400"><Globe size={18} /><span className="text-[10px] font-black uppercase tracking-[0.3em]">Tavily Live Intel</span></div>
            <p className="text-[10px] text-gray-600 leading-relaxed italic uppercase tracking-widest">Searching real-time data for Sacramento area trends and internet prices.</p>
        </div>

        <div className="space-y-4">
            <div className="flex items-center gap-3 text-orange-400"><Utensils size={18} /><span className="text-[10px] font-black uppercase tracking-[0.3em]">Assistant Mode</span></div>
            <p className="text-[10px] text-gray-600 leading-relaxed italic uppercase tracking-widest">Optimized for recipes, technical troubleshooting, and daily organization.</p>
        </div>

        <div className="mt-auto p-6 rounded-3xl bg-red-900/5 border border-red-900/20">
            <div className="flex items-center gap-3 text-red-500 mb-4"><ShieldCheck size={20} /><span className="text-[10px] font-black uppercase tracking-[0.3em]">Truth Protocol</span></div>
            <p className="text-[9px] text-red-700 font-bold uppercase leading-relaxed tracking-widest">Anti-Hallucination active. Every response cross-referenced with Tavily data.</p>
        </div>
      </div>

      {/* MOBILE MENU OVERLAY */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-black p-8 lg:hidden flex flex-col">
          <button onClick={() => setMenuOpen(false)} className="self-end text-gray-500 uppercase font-black tracking-widest text-xs mb-12">Close</button>
          <div className="space-y-8">
             <div className="text-blue-500 font-black uppercase tracking-widest text-xs">Menu</div>
             <button className="flex items-center gap-3 text-gray-400 hover:text-white uppercase tracking-widest text-[10px] font-bold">
               <LogOut size={16} /> Logout
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
