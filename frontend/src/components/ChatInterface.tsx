import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../lib/api';

export default function ChatInterface({ currentMission, zoomLevel }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { id: Date.now(), content: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Calls the new SAFE API you just fixed
      const response = await sendChatMessage(input, {}, "BETA-2026");
      
      const botMsg = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        isScam: response.scam_detected,
        confidence: response.confidence_score
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "Neural Link Error. System Offline.", sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-20">
            <span className="text-4xl mb-2">🛡️</span>
            <p className="text-[10px] uppercase font-bold tracking-widest">Vault Active | Mission: {currentMission}</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] text-sm ${
              msg.sender === 'user' ? 'bg-blue-600' : 'bg-[#111] border border-white/5'
            }`}>
              {msg.content}
            </div>
            {msg.sender === 'bot' && (
              <div className="mt-2 ml-2 text-[8px] font-bold text-blue-500 uppercase tracking-widest">
                {msg.confidence > 0 ? `${msg.confidence}% VERIFIED` : 'SYSTEM ALERT'}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-blue-500 text-[10px] animate-pulse p-4">CONNECTING TO VAULT...</div>}
      </div>

      <div className="p-4 bg-black border-t border-white/5">
        <div className="flex gap-2 max-w-4xl mx-auto bg-[#0a0a0a] border border-white/10 rounded-2xl p-2">
          <input 
            className="flex-1 bg-transparent p-2 text-sm text-white focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Command LYLO..." 
          />
          <button onClick={handleSend} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold">SEND</button>
        </div>
      </div>
    </div>
  );
}
