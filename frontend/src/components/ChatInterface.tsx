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
  confidence_explanation?: string;
  scam_detected?: boolean;
  timestamp: number;
}

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel = 100,
  onUsageUpdate
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // TTS Setup
  const speakText = (text: string) => {
    if (!autoTTS || !text) return;
    
    const cleanText = text.replace(/\([^)]*\)/g, '').trim();
    
    if (window.speechSynthesis && cleanText) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-speak bot messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS) {
      setTimeout(() => speakText(lastMessage.content), 500);
    }
  }, [messages, autoTTS]);

  // Voice Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => handleSend(transcript), 100);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !loading) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const toggleTTS = () => {
    if (autoTTS && isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setAutoTTS(!autoTTS);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: Message = { 
      id: Date.now(), 
      content: textToSend, 
      sender: 'user', 
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatMessage[] = messages.slice(-5).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      const response = await sendChatMessage(
        textToSend, 
        history, 
        currentPersona.id,
        userEmail
      );
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        confidence_explanation: response.confidence_explanation,
        scam_detected: response.scam_detected,
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

  return (
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      
      {/* Background Pattern - Like Website */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
      
      {/* Chat Header - Clean Like Website */}
      <div className="border-b border-white/5 bg-black/90 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">L</span>
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-widest text-sm">
                Active: <span className="text-blue-500">{currentPersona.name}</span>
              </h3>
              <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">
                Neural Link Active
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white text-sm font-bold tracking-wider uppercase">100%</div>
              <div className="text-gray-500 text-xs font-bold uppercase tracking-widest">Signal</div>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Messages Area - Clean Typography */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6"
        style={{ paddingBottom: '180px' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-8 relative">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                <span className="text-white font-black text-2xl">L</span>
              </div>
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/20 to-transparent rounded-3xl blur-xl" />
            </div>
            
            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-3">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 max-w-md text-sm leading-relaxed uppercase tracking-wider font-medium">
              Your personal AI security advisor is online and ready to protect your digital life.
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-4">
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[80%] rounded-2xl p-6 backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-400/20 text-white'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="text-sm leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                <div className={`text-xs mt-3 opacity-60 font-bold uppercase tracking-widest ${
                  msg.sender === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Confidence Display - Website Style */}
            {msg.sender === 'bot' && msg.confidence && (
              <div className="max-w-[80%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-bold uppercase text-xs tracking-widest">
                      Analysis Complete
                    </span>
                    <span className="text-blue-400 font-black text-sm">
                      {msg.confidence}% Confidence
                    </span>
                  </div>
                  
                  <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
                      style={{ width: `${msg.confidence}%` }}
                    />
                  </div>
                  
                  {msg.confidence_explanation && (
                    <p className="text-gray-400 text-xs mt-3 font-medium uppercase tracking-wider">
                      {msg.confidence_explanation}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 200}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 text-sm font-medium uppercase tracking-wider">
                  {currentPersona.name} is analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Website Aesthetic */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/80 backdrop-blur-xl rounded-xl border border-white/10">
            
            {/* Controls Row */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <button
                onClick={isListening ? () => setIsListening(false) : startListening}
                disabled={loading}
                className={`
                  px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border
                  ${isListening 
                    ? 'bg-red-600 border-red-500 text-white' 
                    : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                  }
                `}
              >
                Mic {isListening ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={toggleTTS}
                className={`
                  px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border relative
                  ${autoTTS 
                    ? 'bg-green-600 border-green-500 text-white' 
                    : 'bg-gray-700 border-gray-600 text-gray-300'
                  }
                `}
              >
                Speech {autoTTS ? 'ON' : 'OFF'}
                {isSpeaking && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>
            
            {/* Input Row */}
            <div className="p-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <textarea 
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={isListening ? "Listening..." : `Message ${currentPersona.name}...`}
                    disabled={isListening || loading}
                    className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-base py-4 px-0 resize-none min-h-[50px] max-h-[100px] font-medium"
                    rows={1}
                  />
                </div>
                
                <button 
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className={`
                    px-8 py-4 rounded-lg font-bold text-sm uppercase tracking-widest transition-all
                    ${input.trim() && !loading
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}