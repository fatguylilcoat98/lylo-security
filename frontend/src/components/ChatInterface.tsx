import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { PersonaConfig } from '../types';

// --- INTERFACES ---
interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
  onUsageUpdate?: () => void;
}

interface RecoveryGuideData {
  title: string;
  subtitle: string;
  immediate_actions: string[];
  recovery_steps: { step: number; title: string; actions: string[] }[];
  phone_scripts: { bank_script: string; police_script: string };
  prevention_tips: string[];
}

// Added 'The Disciple' with Gold color theme
const PERSONAS: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', description: 'Protective Security Expert', color: 'blue' },
  { id: 'disciple', name: 'The Disciple', description: 'Faith-Based Wise Advisor (KJV)', color: 'gold' },
  { id: 'roast', name: 'The Roast Master', description: 'Witty but Helpful', color: 'orange' },
  { id: 'friend', name: 'The Friend', description: 'Caring Best Friend', color: 'green' },
  { id: 'chef', name: 'The Chef', description: 'Food & Cooking Expert', color: 'red' },
  { id: 'techie', name: 'The Techie', description: 'Technology Expert', color: 'purple' },
  { id: 'lawyer', name: 'The Lawyer', description: 'Legal Advisor', color: 'yellow' }
];

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel,
  onZoomChange,
  onPersonaChange,
  onLogout,
  onUsageUpdate
}: ChatInterfaceProps) {
  // --- STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
  const [speechTimeout, setSpeechTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  const [showScamRecovery, setShowScamRecovery] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null);
  
  const [isEliteUser, setIsEliteUser] = useState(
    userEmail.toLowerCase().includes('stangman') || 
    userEmail.toLowerCase().includes('elite')
  );
   
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NEW: DYNAMIC SECURITY GLOW UI LOGIC ---
  const getSecurityGlowClass = () => {
    if (loading) return 'border-yellow-500 shadow-[0_0_15px_rgba(255,191,0,0.4)] animate-pulse';
    const lastBotMsg = [...messages].reverse().find(m => m.sender === 'bot');
    if (!lastBotMsg) return 'border-white/10';
    
    // 100% Scam = Pulsing Red
    if (lastBotMsg.scamDetected && lastBotMsg.confidenceScore === 100) {
      return 'border-red-500 shadow-[0_0_20px_rgba(255,77,77,0.8)] animate-bounce';
    }
    // 85-95% = Caution Amber
    if (lastBotMsg.confidenceScore && lastBotMsg.confidenceScore >= 85 && lastBotMsg.confidenceScore <= 95) {
      return 'border-yellow-500 shadow-[0_0_15px_rgba(255,191,0,0.6)]';
    }
    // 100% Verified Truth = Solid Blue
    if (lastBotMsg.confidenceScore === 100 && !lastBotMsg.scamDetected) {
      return 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]';
    }
    return 'border-white/10';
  };

  useEffect(() => {
    loadUserStats();
    checkEliteStatus();
  }, [userEmail]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const checkEliteStatus = async () => {
    try {
      if (userEmail.toLowerCase().includes("stangman")) setIsEliteUser(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://lylo-backend.onrender.com'}/check-beta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `email=${encodeURIComponent(userEmail)}`
      });
      const data = await response.json();
      if (data.tier === 'elite') setIsEliteUser(true);
    } catch (error) { console.error('Failed status check:', error); }
  };

  const handleGetFullGuide = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://lylo-backend.onrender.com'}/scam-recovery/${userEmail}`);
      const data = await response.json();
      setGuideData(data);
      setShowFullGuide(true);
    } catch (error) { console.error("Load guide error", error); } finally { setLoading(false); }
  };

  // --- SPEECH LOGIC ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'es' ? 'es-MX' : 'en-US'; 
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
          else interimTranscript += event.results[i][0].transcript;
        }
        setTranscript(input + finalTranscript + interimTranscript);
        setInput(input + finalTranscript);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      setMicSupported(true);
    }
  }, [input, language]);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
      if (onUsageUpdate) onUsageUpdate();
    } catch (error) { console.error(error); }
  };

  const speakText = (text: string) => {
    if (!autoTTS || !text || isSpeaking) return;
    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    if (window.speechSynthesis && cleanText) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS) setTimeout(() => speakText(lastMessage.content), 500);
  }, [messages, autoTTS]);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else { window.speechSynthesis?.cancel(); setIsSpeaking(false); recognitionRef.current?.start(); }
  };

  const cycleFontSize = () => {
    if (zoomLevel < 100) onZoomChange(100);
    else if (zoomLevel < 125) onZoomChange(125);
    else onZoomChange(85);
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if ((!textToSend && !selectedImage) || loading) return;
    if (userStats && userStats.usage.current >= userStats.usage.limit) { setShowLimitModal(true); return; }

    const userMsg: Message = { id: Date.now().toString(), content: textToSend || "[Image Uploaded]", sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      const response = await sendChatMessage(textToSend || "Analyze this image", conversationHistory, currentPersona.id, userEmail, selectedImage, language);
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        content: response.answer, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: response.scam_indicators || [] 
      };
      setMessages(prev => [...prev, botMsg]);
      setSelectedImage(null);
      await loadUserStats();
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), content: "Connection Error.", sender: 'bot', timestamp: new Date() }]);
    } finally { setLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const getUserDisplayName = () => userEmail.toLowerCase().includes('stangman') ? 'Christopher' : userEmail.split('@')[0];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: '#050505', display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      
      {/* LIMIT MODAL */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100050] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
             <div className="text-4xl mb-3">🛑</div>
             <h2 className="text-white font-black text-lg uppercase tracking-wider mb-2">Limit Reached</h2>
             <p className="text-gray-300 text-sm mb-6">Daily quota used ({userStats?.usage.limit}). Upgrade to Elite/Max.</p>
             <button onClick={() => { setShowLimitModal(false); onLogout(); }} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg uppercase transition-all">Upgrade Now</button>
             <button onClick={() => setShowLimitModal(false)} className="mt-3 text-gray-500 text-xs font-bold">Close & Read History</button>
          </div>
        </div>
      )}

      {/* RECOVERY MODALS */}
      {showFullGuide && guideData && (
        <div className="fixed inset-0 z-[100030] bg-black/95 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 bg-red-900/20 flex justify-between items-start flex-shrink-0">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">🛡️ {guideData.title}</h2>
              <button onClick={() => setShowFullGuide(false)} className="text-white">❌</button>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              <section><h3 className="text-red-500 font-black mb-2 uppercase text-xs border-b border-red-500/30 pb-1">Phase 1: Immediate</h3>{guideData.immediate_actions.map((a, i) => <li key={i} className="text-gray-200 text-sm list-none">• {a}</li>)}</section>
              <section><h3 className="text-blue-500 font-black mb-2 uppercase text-xs border-b border-blue-500/30 pb-1">Phase 2: Recovery</h3>{guideData.recovery_steps.map((s) => <div key={s.step} className="mb-2"><p className="text-white text-xs font-bold">Step {s.step}: {s.title}</p></div>)}</section>
            </div>
            <div className="p-3 bg-gray-900 flex-shrink-0"><button onClick={() => setShowFullGuide(false)} className="bg-white text-black w-full py-3 rounded-lg font-black uppercase text-sm">Close Guide</button></div>
          </div>
        </div>
      )}

      {showScamRecovery && (
        <div className="fixed inset-0 z-[100020] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-red-500/30 rounded-xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4"><h2 className="text-red-400 font-black text-lg uppercase">🚨 RECOVERY CENTER</h2><button onClick={() => setShowScamRecovery(false)} className="text-white px-3 py-1 bg-red-600 rounded-lg">✕</button></div>
            <button className="w-full py-4 rounded-lg font-bold bg-red-600 text-white uppercase" onClick={handleGetFullGuide}>📋 GET FULL GUIDE</button>
          </div>
        </div>
      )}

      {/* HEADER WITH DYNAMIC SECURITY GLOW */}
      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-3 flex-shrink-0 relative z-[100002]">
        <div className="flex items-center justify-between">
          <button onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }} className="w-8 h-8 flex flex-col gap-1 justify-center items-center bg-white/5 rounded-lg transition-colors">
            <div className="w-4 h-0.5 bg-white"></div><div className="w-4 h-0.5 bg-white"></div><div className="w-4 h-0.5 bg-white"></div>
          </button>
          {showDropdown && (
            <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[200px] z-[100003] shadow-2xl">
              <div className="mb-3 border-b border-white/10 pb-3">
                 <h3 className="text-white font-bold text-xs uppercase mb-2">Language</h3>
                 <div className="flex gap-2"><button onClick={() => setLanguage('en')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>🇺🇸 ENG</button><button onClick={() => setLanguage('es')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'es' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400'}`}>🇲🇽 ESP</button></div>
              </div>
              <div className="mb-3">
                <h3 className="text-white font-bold text-xs uppercase mb-1">AI Personality</h3>
                {PERSONAS.map(p => <button key={p.id} onClick={() => { onPersonaChange(p); setShowDropdown(false); }} className={`w-full text-left p-2 rounded-lg text-xs mb-1 ${currentPersona.id === p.id ? 'bg-[#3b82f6] text-white' : 'text-gray-300 hover:bg-white/10'}`}>{p.name}</button>)}
              </div>
              <button onClick={() => { onLogout(); setShowDropdown(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase transition-colors">Logout</button>
            </div>
          )}
          <div className="text-center flex-1">
            <div className={`inline-flex items-center gap-3 px-6 py-1 rounded-full border-2 transition-all duration-700 ${getSecurityGlowClass()}`}>
              <img src="lylologo.png" alt="LYLO" className="w-5 h-5 object-contain" />
              <h1 className="text-white font-black text-lg uppercase" style={{ fontSize: `${zoomLevel / 100}rem` }}>L<span className="text-[#3b82f6]">Y</span>LO</h1>
            </div>
            <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mt-1">Digital Bodyguard</p>
          </div>
          <div className="text-right cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowUserDetails(!showUserDetails); }}>
            <div className="text-white font-bold text-xs">{getUserDisplayName()}{isEliteUser && <span className="text-yellow-400 ml-1">★</span>}</div>
            <div className="text-gray-400 text-[10px] font-black uppercase">{isOnline ? 'Online' : 'Offline'}</div>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-4 relative z-[100000]" style={{ paddingBottom: '240px', fontSize: `${zoomLevel / 100}rem` }}>
        {messages.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#3b82f6] rounded-2xl flex items-center justify-center mb-4 mx-auto"><span className="text-white font-black text-xl">L</span></div>
            <h2 className="text-lg font-black text-white uppercase">{currentPersona.name} Active</h2>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">AI Defense Systems Ready</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border ${msg.sender === 'user' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/60 border-white/10 text-gray-100'}`}>{msg.content}</div>
            </div>
            {msg.sender === 'bot' && msg.confidenceScore && (
              <div className="max-w-[85%] bg-black/40 border border-white/10 rounded-xl p-3 shadow-lg">
                <div className="flex justify-between mb-2"><span className="text-white font-black text-[10px] uppercase">Truth Confidence</span><span className="text-[#3b82f6] font-black text-sm">{msg.confidenceScore}%</span></div>
                <div className="bg-gray-800 h-2 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${msg.confidenceScore}%` }} /></div>
                {msg.scamDetected && <div className="mt-2 text-red-400 text-[10px] font-black uppercase animate-pulse">⚠️ SCAM DETECTED</div>}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-gray-400 text-xs font-black uppercase tracking-widest px-4 italic animate-pulse">{currentPersona.name} analyzing threat...</div>}
      </div>

      {/* INPUT AREA */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-[100002]">
        <div className="bg-black/70 rounded-xl border border-white/10 p-3">
          {isListening && <div className="mb-2 p-2 bg-green-900/20 border-green-500/30 rounded text-green-400 text-[10px] font-black uppercase text-center animate-pulse tracking-widest">🎤 Listening Active</div>}
          <div className="flex justify-between mb-3">
            <button onClick={toggleListening} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${isListening ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-300'}`}>Mic {isListening ? 'ON' : 'OFF'}</button>
            <button onClick={cycleFontSize} className="text-[10px] px-3 py-1 bg-zinc-800 text-blue-400 font-black uppercase border border-blue-500/20">Zoom: {zoomLevel}%</button>
            <button onClick={toggleTTS} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${autoTTS ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300'}`}>Voice {autoTTS ? 'ON' : 'OFF'}</button>
          </div>
          <div className="flex items-end gap-3">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center transition-hover hover:bg-white/20">📷</button>
            <textarea value={isListening ? transcript : input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={`Message ${currentPersona.name}...`} className="flex-1 bg-transparent text-white focus:outline-none resize-none pt-2 font-medium" rows={1} />
            <button onClick={handleSend} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-black uppercase text-sm hover:bg-blue-500 transition-colors">Send</button>
          </div>
          <div className="text-center mt-3 pb-1"><p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] italic">LYLO SECURITY SYSTEMS: VERIFY ALL SENSITIVE REQUESTS.</p></div>
        </div>
      </div>
    </div>
  );
}
