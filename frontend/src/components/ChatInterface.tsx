import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, ChatMessage } from '../lib/api';

interface ChatInterfaceProps {
  currentMission: string;
  zoomLevel: number;
}

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  isScam?: boolean;
  confidence?: number;
  timestamp: number;
}

export default function ChatInterface({ currentMission, zoomLevel }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to keep newest messages visible
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await handleSend(`Analyze this image: ${file.name}`, base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (messageText?: string, imageData?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;
    
    const userMsg: Message = { 
      id: Date.now(), 
      content: textToSend, 
      sender: 'user', 
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setThinking(true);

    try {
      // Build conversation history
      const history: ChatMessage[] = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Add current message
      history.push({
        role: 'user',
        content: textToSend,
        timestamp: Date.now()
      });

      const response = await sendChatMessage(textToSend, history, {}, "BETA-2026", imageData);
      
      setThinking(false);
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        isScam: response.scam_detected,
        confidence: response.confidence_score || 98,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setThinking(false);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "Neural Link Error. LYLO systems temporarily offline.", 
        sender: 'bot',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !thinking && (
          <div className="flex flex-col items-center justify-center h-full opacity-20">
            <span className="text-4xl mb-2">🛡️</span>
            <p className="text-[10px] uppercase font-bold tracking-widest">Vault Active | Mission: {currentMission}</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* Scam Warning */}
            {msg.isScam && (
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-center">
                <div className="text-red-400 font-bold text-sm">⚠️ SCAM DETECTED</div>
                <div className="text-red-300 text-xs">Confidence: {msg.confidence}%</div>
              </div>
            )}
            
            <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm ${
                msg.sender === 'user' 
                  ? 'bg-blue-600' 
                  : msg.isScam 
                    ? 'bg-red-900/30 border border-red-500/50' 
                    : 'bg-[#111] border border-white/5'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {thinking && (
          <div className="flex items-start">
            <div className="bg-[#111] border border-white/5 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-blue-400">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-xs">LYLO thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        {loading && !thinking && <div className="text-blue-500 text-[10px] animate-pulse">SYNCING VAULT...</div>}
      </div>

      <div className="p-4 bg-black border-t border-white/5">
        <div className="flex gap-2 max-w-4xl mx-auto bg-[#0a0a0a] border border-white/10 rounded-2xl p-2">
          
          {/* Voice Button */}
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-2 rounded-xl transition-all ${
              isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Voice Input"
          >
            🎤
          </button>

          {/* Image Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all"
            title="Upload Image"
          >
            📷
          </button>

          <input 
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <input 
            className="flex-1 bg-transparent p-2 text-sm text-white focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "🎤 Listening..." : "Command LYLO..."}
            disabled={isListening || loading}
          />
          
          <button 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
