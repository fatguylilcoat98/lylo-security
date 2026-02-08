
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
      formData.append('history', '[]');

      const response = await fetch('http://localhost:10000/chat', {
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
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        sender: 'bot', 
        content: "⚠️ CONNECTION ERROR: Is the Brain (backend) running?",
        isScam: false
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-800 rounded-lg">
             <ArrowLeft className="text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-500" />
            <h1 className="font-bold text-lg text-slate-100">LYLO CONSULT</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              msg.sender === 'user' 
                ? 'bg-blue-600 text-white' 
                : msg.isScam 
                  ? 'bg-red-900/50 border border-red-500 text-red-100'
                  : 'bg-slate-800 text-slate-200'
            }`}>
              {msg.isScam && (
                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs uppercase">
                  <AlertTriangle size={14} /> Scam Alert
                </div>
              )}
              <div>{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-500 text-sm ml-4">Thinking...</div>}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none text-white"
          />
          <button onClick={handleSend} className="bg-yellow-600 p-3 rounded-xl text-white">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
