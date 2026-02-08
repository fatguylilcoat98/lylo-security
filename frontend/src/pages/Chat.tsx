import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Shield, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', content: 'Security Systems Online. I am LYLO. How can I protect you?', isScam: false }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // SCROLL TO BOTTOM
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { id: Date.now(), sender: 'user', content: input, isScam: false };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('msg', userMsg.content);
      
      // *** THIS IS THE CRITICAL LINE: DIRECT CONNECTION ***
      const response = await fetch('https://lylo-backend.onrender.com/chat', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      const botMsg = { 
        id: Date.now() + 1, 
        sender: 'bot', 
        content: data.answer || "I am online.",
        isScam: data.scam_detected
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        sender: 'bot', 
        content: "⚠️ CONNECTION ERROR: Brain not responding. (Check Render Backend Logs)",
        isScam: false
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
             <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h1 className="font-bold text-lg text-white tracking-tight">LYLO LIVE</h1>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-5 ${
              msg.sender === 'user' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : msg.isScam 
                  ? 'bg-red-500/10 border border-red-500/50 text-red-100'
                  : 'bg-slate-900 border border-slate-800 text-slate-200'
            }`}>
              {msg.isScam && (
                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} /> Threat Detected
                </div>
              )}
              <div className="leading-relaxed text-sm">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-500 text-xs ml-4 font-mono animate-pulse">COMPUTING...</div>}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-950 border-t border-slate-800/50">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Enter security query..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600 transition-all shadow-inner"
          />
          <button onClick={handleSend} className="bg-white hover:bg-slate-200 text-black p-4 rounded-xl transition-colors shadow-lg shadow-white/5">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
