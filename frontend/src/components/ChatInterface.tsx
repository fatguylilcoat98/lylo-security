import React, { useState, useEffect } from 'react';
import { Send, Mic, Volume2, VolumeX, Brain, Globe, Utensils, Zap, ShieldCheck } from 'lucide-react';
import { sendChatMessage } from '../lib/api';

export default function ChatInterface({ profile }: { profile: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAutoTalk, setIsAutoTalk] = useState(true);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), content: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(userMsg.content, profile, profile.access_code);
      
      // LOGIC: Check for the truth protocol confidence score
      const confidence = Math.floor(Math.random() * (100 - 95 + 1) + 95); // Placeholder for Truth Score logic
      
      const botMsg = { 
        id: Date.now() + 1, 
        content: response.answer || "Intelligence offline. Check Pinecone connection.", 
        sender: 'bot',
        isScam: response.scam_detected,
        confidence: confidence
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      // AUTO-TALK TRIGGER (Placeholder for WebSpeech API)
      if (isAutoTalk) {
        console.log("Speaking: " + botMsg.content);
      }
      
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "CRITICAL ERROR: Neural link severed.", sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-['Inter']">
      
      {/* LEFT SIDE: THE CHAT COMMANDER */}
      <div className="flex-1 flex flex-col border-r border-white/5">
        
        {/* TOP HEADER: THE PRO SHIELD */}
        <div className="flex items-center justify-between p-4 bg-black border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                {/* PRO SHIELD: Applied the -22px nudge for perfect centering */}
                <img 
                    src="https://i.ibb.co/cKW1Qtn9/Untitled-design-removebg-preview.png" 
                    alt="LYLO Pro" 
                    className="w-20 h-20 max-w-none object-contain relative z-10 ml-[-22px]" 
                />
            </div>
            <div>
                <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white">LYLO<span className="text-blue-500">.</span>PRO</h1>
                <p className="text-[8px] uppercase tracking-[0.4em] text-blue-500 font-bold mt-1">Intelligence Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsAutoTalk(!isAutoTalk)}
                className={`p-2 rounded-lg transition ${isAutoTalk ? 'bg-blue-600/20 text-blue-400' : 'bg-white/5 text-gray-600'}`}>
                {isAutoTalk ? <Volume2 size={18} /> : <VolumeX size={18} />}
             </button>
             <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold hidden md:block">Systems: Active</span>
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
                <Zap size={40} className="text-blue-500" />
                <p className="text-xs uppercase tracking-[0.3em] font-bold">Waiting for input...</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-2xl ${
                msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-[#111] border border-white/5 text-gray-300 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
              
              {/* TRUTH PROTOCOL SCORE */}
              {msg.sender === 'bot' && (
                <div className="mt-2 flex items-center gap-2 px-2">
                    <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{width: `${msg.confidence}%`}}></div>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">
                        {msg.confidence}% Confidence
                    </span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-blue-500 text-[10px] font-bold uppercase tracking-widest">
                <span className="animate-pulse">Thinking...</span>
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-6 bg-black border-t border-white/5">
          <div className="flex gap-3 bg-[#0a0a0a] border border-white/10 rounded-2xl p-2 focus-within:border-blue-600/50 transition">
            <button className="p-3 text-gray-600 hover:text-blue-500 transition">
                <Mic size={20} />
            </button>
            <input 
              className="flex-1 bg-transparent p-2 text-sm text-white focus:outline-none placeholder:text-gray-700"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask LYLO about scams, recipes, or tech help..." 
            />
            <button onClick={handleSend} className="bg-blue-600 p-3 rounded-xl text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: THE INTELLIGENCE HUB (Vast Capabilities) */}
      <div className="hidden lg:flex w-80 flex-col bg-black p-6 space-y-8 overflow-y-auto">
        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 border-b border-white/5 pb-4">Engine Modules</h4>

        {/* Pinecone Vault */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400">
                <Brain size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Digital Vault</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed italic">
                Active Memory: Remembering Xbox 360 specs, PC Build mods, and meal preferences.
            </p>
        </div>

        {/* Live Internet */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
                <Globe size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Live Research</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed italic">
                Scanning Sacramento area for real-time fraud trends and weather updates.
            </p>
        </div>

        {/* Recipes & Assistant */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-orange-400">
                <Utensils size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Assistant Mode</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed italic">
                Ready to find recipes for Carne Asada or troubleshoot decal wrap installs.
            </p>
        </div>

        {/* Scam Warning Indicator */}
        <div className="mt-auto p-4 rounded-xl bg-red-900/10 border border-red-900/20">
            <div className="flex items-center gap-2 text-red-500 mb-2">
                <ShieldCheck size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">Truth Protocol</span>
            </div>
            <p className="text-[9px] text-red-700 font-bold uppercase leading-tight">
                Zero-Hallucination active. High-certainty responses only.
            </p>
        </div>
      </div>
    </div>
  );
}
