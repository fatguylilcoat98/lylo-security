import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, ChatMessage, connectLegal } from '../lib/api';
import { PersonaConfig } from './Layout';
import ConfidenceDisplay from './ConfidenceDisplay';

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
  scam_indicators?: string[];
  detailed_analysis?: string;
  timestamp: number;
  isImage?: boolean;
  legal_connect?: any;
  usage_info?: any;
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
  const [thinking, setThinking] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, thinking]);

  // Text-to-Speech function
  const speakText = (text: string) => {
    if (!autoTTS || !window.speechSynthesis || isSpeaking) return;
    
    const cleanText = text
      .replace(/[⚠️🛡️✅📷]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\n+/g, '. ')
      .trim();
    
    if (!cleanText) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    
    setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  // Auto-speak when new bot message arrives
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && lastMessage.content && autoTTS) {
      setTimeout(() => speakText(lastMessage.content), 800);
    }
  }, [messages, autoTTS]);

  // Speech recognition setup
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
        
        // Auto-send after voice input
        setTimeout(() => {
          if (transcript.trim()) {
            handleSend(transcript);
          }
        }, 100);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening && !loading) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
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

  const toggleTTS = () => {
    if (autoTTS && isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setAutoTTS(!autoTTS);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageMsg: Message = {
      id: Date.now(),
      content: `📷 Uploaded: ${file.name}`,
      sender: 'user',
      timestamp: Date.now(),
      isImage: true
    };
    setMessages(prev => [...prev, imageMsg]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await handleSend(`Analyze this image: ${file.name}`, base64);
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
  };

  const handleSend = async (messageText?: string, imageData?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;
    
    // Stop any current speech
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    
    // Add user message
    if (!imageData) {
      const userMsg: Message = { 
        id: Date.now(), 
        content: textToSend, 
        sender: 'user', 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, userMsg]);
    }
    
    // Clear input and set loading
    setInput('');
    setLoading(true);
    setThinking(true);

    try {
      const history: ChatMessage[] = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      history.push({
        role: 'user',
        content: textToSend,
        timestamp: Date.now()
      });

      const response = await sendChatMessage(
        textToSend, 
        history, 
        currentPersona.id,
        userEmail,
        Date.now().toString()
      );
      
      setThinking(false);

      if (response.upgrade_needed) {
        const upgradeMsg: Message = {
          id: Date.now() + 1,
          content: response.answer,
          sender: 'bot',
          timestamp: Date.now(),
          usage_info: response.usage_info
        };
        setMessages(prev => [...prev, upgradeMsg]);
        if (onUsageUpdate) onUsageUpdate();
        return;
      }
      
      const botMsg: Message = { 
        id: Date.now() + 1, 
        content: response.answer, 
        sender: 'bot',
        confidence: response.confidence_score,
        confidence_explanation: response.confidence_explanation,
        scam_detected: response.scam_detected,
        scam_indicators: response.scam_indicators,
        detailed_analysis: response.detailed_analysis,
        timestamp: Date.now(),
        legal_connect: response.legal_connect,
        usage_info: response.usage_info
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      if (onUsageUpdate) onUsageUpdate();
      
    } catch (error) {
      setThinking(false);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        content: "I'm having connection trouble. Please try again.", 
        sender: 'bot',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getPersonaGradient = () => {
    const gradients = {
      cyan: 'from-cyan-500 to-blue-500',
      orange: 'from-orange-500 to-red-500',
      purple: 'from-purple-500 to-indigo-500',
      yellow: 'from-yellow-500 to-orange-500',
      red: 'from-red-500 to-pink-500',
      green: 'from-green-500 to-emerald-500'
    };
    return gradients[currentPersona.color as keyof typeof gradients] || gradients.cyan;
  };

  // Handle input change - FIXED VERSION
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
  };

  // Handle key press - FIXED VERSION  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow shift+enter for new line
        return;
      } else {
        // Send message on enter
        e.preventDefault();
        if (input.trim() && !loading) {
          handleSend();
        }
      }
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#050505] relative"
      style={{ fontSize: `${zoomLevel}%` }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900/5 to-black pointer-events-none" />
      <div className={`absolute inset-0 bg-gradient-to-t from-${currentPersona.color}-500/5 via-transparent to-transparent pointer-events-none`} />

      {/* Chat Messages Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 relative z-10 pb-40">
        {messages.length === 0 && !thinking && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 px-4">
            <div className="relative mb-6">
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${getPersonaGradient()} p-4 md:p-6 shadow-2xl`}>
                <div className="w-full h-full bg-white rounded" />
              </div>
              <div className="absolute -inset-2 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-xl" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-2 text-center">{currentPersona.name}</h3>
            <p className="text-gray-400 text-center max-w-md text-sm leading-relaxed">
              {currentPersona.description}. I learn from our conversations to help you better.
            </p>
            {autoTTS && (
              <p className="text-cyan-400 text-center text-xs mt-2">
                🔊 Auto-speech is ON - I'll read my responses aloud
              </p>
            )}
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className="space-y-3 animate-in slide-in-from-bottom duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Message Bubble */}
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-3 md:p-4 rounded-2xl shadow-xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? `bg-gradient-to-br ${getPersonaGradient()} border-white/20 text-white shadow-${currentPersona.color}-500/20`
                  : 'bg-black/40 border-white/10 text-gray-100 shadow-black/50'
                }
              `}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
                
                {/* Speaking Indicator */}
                {msg.sender === 'bot' && isSpeaking && index === messages.length - 1 && (
                  <div className="flex items-center gap-2 mt-2 text-cyan-400 text-xs">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                    <span>Speaking...</span>
                  </div>
                )}
                
                <div className={`text-xs mt-2 opacity-60 ${
                  msg.sender === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Confidence Display */}
            {msg.sender === 'bot' && msg.confidence !== undefined && (
              <div className="max-w-[85%]">
                <ConfidenceDisplay
                  confidence={msg.confidence}
                  explanation={msg.confidence_explanation}
                  scamDetected={msg.scam_detected || false}
                  indicators={msg.scam_indicators}
                  detailedAnalysis={msg.detailed_analysis}
                />
              </div>
            )}
          </div>
        ))}
        
        {/* Thinking Animation */}
        {thinking && (
          <div className="flex justify-start animate-in slide-in-from-bottom duration-300">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 md:p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`w-2 h-2 bg-${currentPersona.color}-400 rounded-full animate-bounce`}
                      style={{ animationDelay: `${i * 200}ms` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-300">
                  {currentPersona.name} is analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Input Area - COMPLETELY REWRITTEN FOR MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 p-3 md:p-6 bg-black/80 backdrop-blur-xl border-t border-white/10 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
            
            {/* Control Buttons Row */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              
              {/* Voice Input Button */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={loading}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium border
                  ${isListening 
                    ? 'bg-red-500 border-red-400 text-white animate-pulse' 
                    : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                🎤 {isListening ? 'Mic ON' : 'Mic OFF'}
              </button>

              {/* Speech Toggle Button */}
              <button
                type="button"
                onClick={toggleTTS}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium border relative
                  ${autoTTS 
                    ? 'bg-green-500 border-green-400 text-white' 
                    : 'bg-gray-700 border-gray-600 text-gray-300'
                  }
                `}
              >
                🔊 {autoTTS ? 'Speech ON' : 'Speech OFF'}
                {isSpeaking && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                )}
              </button>

              {/* Image Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50"
              >
                📎 Image
              </button>

              <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            
            {/* Input Area - FIXED FOR MOBILE */}
            <div className="p-4">
              <div className="flex items-end gap-3">
                
                {/* Text Input - COMPLETELY FIXED */}
                <div className="flex-1">
                  <textarea 
                    ref={inputRef}
                    className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none text-base py-3 px-4 resize-none min-h-[60px] max-h-[120px] border-0"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isListening 
                        ? "🎤 Listening..." 
                        : `Message ${currentPersona.name}...`
                    }
                    disabled={isListening || loading}
                    rows={2}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                </div>
                
                {/* Send Button */}
                <button 
                  type="button"
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className={`
                    px-6 py-4 rounded-xl font-medium text-sm transition-all shadow-lg border min-w-[80px]
                    ${input.trim() && !loading
                      ? `bg-gradient-to-r ${getPersonaGradient()} border-white/20 text-white hover:shadow-${currentPersona.color}-500/30`
                      : 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {loading ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
