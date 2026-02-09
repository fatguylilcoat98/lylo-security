
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
  const [isListening, setIsListening] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle send message
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

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-[#050505] relative"
      style={{ fontSize: `${zoomLevel}%` }}
    >
      
      {/* Clean Header - Like Your Website */}
      <div className="bg-black border-b border-white/10 p-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-lg">L</span>
            </div>
            <div>
              <h1 className="text-white font-black uppercase tracking-[0.3em] text-lg">
                {currentPersona.name}
              </h1>
              <p className="text-gray-500 text-xs uppercase tracking-[0.4em] font-bold">
                Digital Bodyguard Active
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-white font-black text-sm tracking-wider">
                {zoomLevel}%
              </div>
              <div className="text-gray-500 text-xs uppercase tracking-widest font-bold">
                Clarity
              </div>
            </div>
            <div className="w-3 h-3 bg-[#3b82f6] rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Messages Area - Clean & Spacious */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6"
        style={{ paddingBottom: '140px' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-3xl flex items-center justify-center mb-8 relative">
              <span className="text-white font-black text-4xl">L</span>
              <div className="absolute -inset-8 bg-[#3b82f6]/20 rounded-full blur-3xl" />
            </div>
            
            <h2 className="text-3xl font-black text-white uppercase tracking-[0.3em] mb-4">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 text-lg max-w-md uppercase tracking-[0.2em] font-medium">
              Your AI Security System is Online
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-4">
            
            {/* Message Bubble */}
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[75%] p-6 rounded-2xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="text-base leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                <div className={`text-xs mt-4 opacity-70 font-bold uppercase tracking-widest ${
                  msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Confidence Display - Only for Bot Messages */}
            {msg.sender === 'bot' && msg.confidence && (
              <div className="max-w-[75%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-black uppercase text-sm tracking-[0.3em]">
                      Analysis Complete
                    </span>
                    <span className="text-[#3b82f6] font-black text-lg">
                      {msg.confidence}%
                    </span>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000 ease-out"
                      style={{ width: `${msg.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Loading State */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 font-medium uppercase tracking-wider text-sm">
                  {currentPersona.name} Analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Clean & Simple */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/20">
            
            {/* Controls */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <button
                onClick={() => setIsListening(!isListening)}
                disabled={loading}
                className={`
                  px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-[0.3em] transition-all
                  ${isListening 
                    ? 'bg-red-600 text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }
                `}
              >
                Mic {isListening ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => setAutoTTS(!autoTTS)}
                className={`
                  px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-[0.3em] transition-all
                  ${autoTTS 
                    ? 'bg-[#3b82f6] text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }
                `}
              >
                Speech {autoTTS ? 'ON' : 'OFF'}
              </button>
            </div>
            
            {/* Input */}
            <div className="p-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <textarea 
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={`Message ${currentPersona.name}...`}
                    disabled={loading}
                    className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-lg py-4 resize-none min-h-[60px] max-h-[120px] font-medium"
                    rows={2}
                  />
                </div>
                
                <button 
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className={`
                    px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-[0.3em] transition-all min-w-[100px]
                    ${input.trim() && !loading
                      ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg hover:shadow-[#3b82f6]/25'
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
      </div>
    </div>
  );
}
