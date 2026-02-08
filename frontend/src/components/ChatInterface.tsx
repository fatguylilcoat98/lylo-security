import React, { useState } from 'react';
import { Send, Shield, AlertTriangle } from 'lucide-react';
import { sendChatMessage } from '../lib/api';

export default function ChatInterface({ profile }: { profile: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), content: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(userMsg.content, profile, profile.access_code);
      const botMsg = { 
        id: Date.now() + 1, 
        content: response.answer || "I am here, but I can't think yet because the Brain is off.", 
        sender: 'bot',
        isScam: response.scam_detected
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), content: "Error: The Brain is offline.", sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white p-4">
      <div className="flex items-center gap-2 p-4 bg-slate-800 rounded-t-lg border-b border-slate-700">
        <Shield className="text-yellow-500" />
        <h1 className="text-xl font-bold text-yellow-500">LYLO SAFE MODE</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">System Online. Type 'Hello'.</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`p-3 rounded-lg max-w-[80%] ${msg.sender === 'user' ? 'bg-blue-600 ml-auto' : 'bg-slate-700'}`}>
            {msg.content}
          </div>
        ))}
        {loading && <div className="text-slate-500">Thinking...</div>}
      </div>

      <div className="p-4 bg-slate-800 rounded-b-lg flex gap-2">
        <input 
          className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type here..." 
        />
        <button onClick={handleSend} className="bg-yellow-600 p-2 rounded text-white">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
