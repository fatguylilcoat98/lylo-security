import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, ChatMessage } from '../lib/api';
import { PersonaConfig } from './Layout';

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel?: number;
  onUsageUpdate?: () => void;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  confidence?: number;
  timestamp: number;
}

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel = 100 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { 
      id: Date.now(), 
      content: input.trim(), 
      sender: 'user', 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    const messageToSend = input.trim();
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(
        messageToSend, 
        [], 
        currentPersona.id,
        userEmail
      );
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, botMsg]);
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "Connection error. Please try again.", 
        sender: 'bot',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className="h-screen flex flex-col bg-[#050505] relative overflow-hidden"
      style={{ fontSize: `${zoomLevel}%` }}
    >
      
      {/* Header */}
      <div className="bg-black border-b border-white/10 p-4 flex-shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">L</span>
            </div>
            <div>
              <h1 className="text-white font-black uppercase tracking-[0.2em] text-sm">
                {currentPersona.name}
              </h1>
              <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-bold">
                Active
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white font-black text-sm">{zoomLevel}%</div>
              <div className="text-gray-500 text-xs uppercase font-bold">Signal</div>
            </div>
            <div className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Messages Area - FIXED SCROLLING */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ 
          paddingBottom: '200px', // Much more space for input area
          minHeight: 0 // Critical for flex scrolling
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-2xl flex items-center justify-center mb-6">
              <span className="text-white font-black text-2xl">L</span>
            </div>
            
            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-3">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 text-sm max-w-sm uppercase tracking-[0.1em] font-medium">
              Your AI Security System is Online
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            
            {/* Message Bubble */}
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[80%] p-4 rounded-xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="text-sm leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                <div className={`text-xs mt-3 opacity-70 font-bold uppercase tracking-wider ${
                  msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Confidence Display */}
            {msg.sender === 'bot' && msg.confidence && (
              <div className="max-w-[80%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-black uppercase text-xs tracking-[0.2em]">
                      Analysis Complete
                    </span>
                    <span className="text-[#3b82f6] font-black text-base">
                      {msg.confidence}%
                    </span>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000"
                      style={{ width: `${msg.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Loading */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 font-medium text-sm">
                  {currentPersona.name} analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - FIXED POSITIONING */}
      <div className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-4">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/20 p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Message ${currentPersona.name}...`}
                disabled={loading}
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-base py-2 resize-none min-h-[40px] max-h-[100px] font-medium"
                rows={1}
              />
            </div>
            
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className={`
                px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-[0.2em] transition-all
                ${input.trim() && !loading
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
