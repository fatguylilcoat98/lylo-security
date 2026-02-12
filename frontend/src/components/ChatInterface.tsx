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

// New Interface for the Recovery Guide Data
interface RecoveryGuideData {
  title: string;
  subtitle: string;
  immediate_actions: string[];
  recovery_steps: { step: number; title: string; actions: string[] }[];
  phone_scripts: { bank_script: string; police_script: string };
  prevention_tips: string[];
}

const PERSONAS: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', description: 'Protective Security Expert', color: 'blue' },
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
  
  // New Features State
  const [language, setLanguage] = useState<'en' | 'es'>('en'); // Default to English
  const [showLimitModal, setShowLimitModal] = useState(false); // Pop up when limit hit
  
  // Scam Recovery State
  const [showScamRecovery, setShowScamRecovery] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false); // Toggle for the new guide
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null); // Store the fetched data
  
  const [isEliteUser, setIsEliteUser] = useState(
    userEmail.toLowerCase().includes('stangman') || 
    userEmail.toLowerCase().includes('elite')
  );
   
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserStats();
    checkEliteStatus();
  }, [userEmail]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }
    };
  }, [speechTimeout]);

  // --- HANDLERS ---
  const checkEliteStatus = async () => {
    try {
      if (userEmail.toLowerCase().includes("stangman")) {
          setIsEliteUser(true);
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://lylo-backend.onrender.com'}/check-beta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `email=${encodeURIComponent(userEmail)}`
      });
      const data = await response.json();
      if (data.tier === 'elite') {
          setIsEliteUser(true);
      }
    } catch (error) {
      console.error('Failed to check elite status:', error);
    }
  };

  // --- FETCH GUIDE HANDLER ---
  const handleGetFullGuide = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://lylo-backend.onrender.com'}/scam-recovery/${userEmail}`);
      const data = await response.json();
      setGuideData(data);
      setShowFullGuide(true); // Open the pretty modal
    } catch (error) {
      console.error("Failed to load guide", error);
      alert("Could not load the guide. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- SPEECH LOGIC ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // Switch speech language based on toggle
      recognition.lang = language === 'es' ? 'es-MX' : 'en-US'; 
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        if (speechTimeout) {
          clearTimeout(speechTimeout);
          setSpeechTimeout(null);
        }
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript + ' ';
          else interimTranscript += result[0].transcript;
        }
        const currentText = input + finalTranscript + interimTranscript;
        setTranscript(currentText);
        setInput(input + finalTranscript);
        
        if (speechTimeout) clearTimeout(speechTimeout);
        setSpeechTimeout(setTimeout(() => console.log('Mic open...'), 30000));
      };

      recognition.onend = () => {
        if (isListening && !loading) {
          setTimeout(() => { try { recognition.start(); } catch (e) {} }, 100);
        } else {
          setIsListening(false);
          setTranscript('');
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'audio-capture' || event.error === 'not-allowed') {
          alert('Microphone error/permission denied.');
          setIsListening(false);
        }
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    } else {
      setMicSupported(false);
    }
  }, [input, isListening, loading, speechTimeout, language]); // Added language dep

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
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      // Set TTS language
      utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS) {
      setTimeout(() => speakText(lastMessage.content), 500);
    }
  }, [messages, autoTTS]);

  const toggleListening = () => {
    if (!micSupported) return alert('Not supported');
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      if (isSpeaking) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      try { recognitionRef.current?.start(); setIsListening(true); } catch (e) {}
    }
  };

  const toggleTTS = () => {
    if (autoTTS && isSpeaking) { window.speechSynthesis?.cancel(); setIsSpeaking(false); }
    setAutoTTS(!autoTTS);
  };

  const cycleFontSize = () => {
    if (zoomLevel < 100) onZoomChange(100);
    else if (zoomLevel < 125) onZoomChange(125);
    else onZoomChange(85);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedImage(e.target.files[0]);
  };

  const openScamRecovery = () => {
    if (!isEliteUser) return alert('Scam Recovery Center is available for Elite members only.');
    setShowScamRecovery(true);
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if ((!textToSend && !selectedImage) || loading) return;

    // --- USAGE CAP ENFORCEMENT ---
    // If they hit the limit (e.g. 50/50 or 500/500), BLOCK them.
    if (userStats && userStats.usage.current >= userStats.usage.limit) {
      setShowLimitModal(true); // Show the upgrade popup
      return; // STOP here. Do not send message.
    }

    let previewContent = textToSend;
    if (selectedImage) previewContent = textToSend ? `${textToSend} [Image: ${selectedImage.name}]` : `[Image: ${selectedImage.name}]`;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: previewContent, 
      sender: 'user', 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      const response = await sendChatMessage(
        textToSend || "Analyze this image", 
        conversationHistory,
        currentPersona.id,
        userEmail,
        selectedImage,
        language // Pass the language to the API (You need to update api.ts next!)
      );
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        content: response.answer, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: [] 
      };
      
      setMessages(prev => [...prev, botMsg]);
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadUserStats();
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        content: language === 'es' ? "Error de conexión. Por favor intente de nuevo." : "Connection error. Please try again.", 
        sender: 'bot', 
        timestamp: new Date() 
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

  useEffect(() => {
    const handleClickOutside = () => { setShowDropdown(false); setShowUserDetails(false); };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getUserDisplayName = () => {
    if (userEmail.toLowerCase().includes('stangman')) return 'Christopher';
    return userEmail.split('@')[0];
  };

  const displayText = isListening ? transcript : input;

  return (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
        backgroundColor: '#050505', display: 'flex', flexDirection: 'column',
        height: '100dvh', width: '100vw', overflow: 'hidden',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont'
    }}>
      
      {/* --- LIMIT REACHED MODAL (NEW) --- */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100050] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
             <div className="text-4xl mb-3">🛑</div>
             <h2 className="text-white font-black text-lg uppercase tracking-wider mb-2">Daily Limit Reached</h2>
             <p className="text-gray-300 text-sm mb-6">
               You have used all {userStats?.usage.limit} messages for your current plan. Upgrade to <b>Elite</b> for 500 messages/day or <b>Max</b> for Unlimited.
             </p>
             <button 
               onClick={() => { setShowLimitModal(false); onLogout(); }} // Logs them out so they see Pricing page
               className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg uppercase tracking-wider transition-all"
             >
               Upgrade Now
             </button>
             <button 
               onClick={() => setShowLimitModal(false)}
               className="mt-3 text-gray-500 text-xs font-bold hover:text-gray-300"
             >
               Close & Read History
             </button>
          </div>
        </div>
      )}

      {/* --- RECOVERY GUIDE MODAL --- */}
      {showFullGuide && guideData && (
        <div className="fixed inset-0 z-[100030] bg-black/95 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 bg-red-900/20 flex justify-between items-start flex-shrink-0">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wider">
                  🛡️ {guideData.title}
                </h2>
                <p className="text-red-300 text-xs mt-1 font-bold">{guideData.subtitle}</p>
              </div>
              <button 
                onClick={() => setShowFullGuide(false)}
                className="p-2 bg-black/40 hover:bg-white/10 rounded-lg text-white transition-colors"
              >
                ❌
              </button>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              <section>
                <h3 className="text-red-500 font-black mb-2 uppercase tracking-widest text-xs border-b border-red-500/30 pb-1">Phase 1: Stop the Bleeding</h3>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <ul className="space-y-2">
                    {guideData.immediate_actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-200 text-sm">
                        <span className="text-red-500 font-bold mt-0.5">●</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-blue-500 font-black mb-2 uppercase tracking-widest text-xs border-b border-blue-500/30 pb-1">Phase 2: Recovery Protocol</h3>
                {guideData.recovery_steps.map((step) => (
                  <div key={step.step} className="bg-gray-800/40 rounded-lg p-3 border border-white/5">
                    <h4 className="font-bold text-white text-sm mb-1">Step {step.step}: {step.title}</h4>
                    <ul className="space-y-1 pl-4 border-l-2 border-blue-500/30">
                      {step.actions.map((act, i) => <li key={i} className="text-gray-400 text-xs">{act}</li>)}
                    </ul>
                  </div>
                ))}
              </section>
              <section>
                <h3 className="text-green-500 font-black mb-2 uppercase tracking-widest text-xs border-b border-green-500/30 pb-1">Phase 3: Future Prevention</h3>
                <ul className="grid grid-cols-1 gap-2">
                  {guideData.prevention_tips.map((tip, i) => (
                    <li key={i} className="bg-green-900/10 text-green-200 p-2 rounded border border-green-500/20 text-xs font-medium">🔒 {tip}</li>
                  ))}
                </ul>
              </section>
            </div>
            <div className="p-3 border-t border-gray-800 bg-gray-900 flex-shrink-0">
              <button 
                onClick={() => setShowFullGuide(false)}
                className="bg-white text-black w-full py-3 rounded-lg font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SCAM RECOVERY MODAL --- */}
      {showScamRecovery && (
        <div className="fixed inset-0 z-[100020] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-black/95 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-red-400 font-black text-lg uppercase tracking-wider">🚨 SCAM RECOVERY CENTER</h2>
              <button onClick={() => setShowScamRecovery(false)} className="text-white text-xl font-bold px-3 py-1 bg-red-600 rounded-lg">✕</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                <p className="text-red-300 font-bold mb-2">IMMEDIATE ACTIONS:</p>
                <ul className="text-gray-300 space-y-1 text-xs">
                  <li>🛑 STOP sending any more money</li>
                  <li>📞 Call your bank immediately</li>
                  <li>🔒 Change all passwords</li>
                  <li>📸 Screenshot everything</li>
                  <li>🚔 File police report</li>
                </ul>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                <p className="text-yellow-300 font-bold mb-2">PHONE SCRIPT FOR BANK:</p>
                <p className="text-gray-300 text-xs italic">"I need to report fraudulent activity. I was scammed and unauthorized transfers were made..."</p>
              </div>
              <button
                className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${loading ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                onClick={handleGetFullGuide}
                disabled={loading}
              >
                {loading ? <span>GENERATING GUIDE...</span> : <><span>📋</span> GET FULL RECOVERY GUIDE</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-3 flex-shrink-0 relative z-[100002]">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
              <div className="space-y-1">
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
              </div>
            </button>
            {showDropdown && (
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[200px] z-[100003] max-h-[60vh] overflow-y-auto shadow-2xl">
                {/* LANGUAGE TOGGLE - NEW */}
                <div className="mb-3 pb-3 border-b border-white/10">
                   <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Language / Idioma</h3>
                   <div className="flex gap-2">
                     <button onClick={() => setLanguage('en')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>
                       🇺🇸 ENG
                     </button>
                     <button onClick={() => setLanguage('es')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'es' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400'}`}>
                       🇲🇽 ESP
                     </button>
                   </div>
                </div>

                {isEliteUser && (
                  <div className="mb-3 pb-3 border-b border-red-500/20">
                    <button onClick={() => { openScamRecovery(); setShowDropdown(false); }} className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"><span>🚨</span> SCAM RECOVERY</button>
                  </div>
                )}
                <div className="mb-3">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">AI Personality</h3>
                  <div className="space-y-1">
                    {PERSONAS.map(persona => (
                      <button key={persona.id} onClick={() => { onPersonaChange(persona); setShowDropdown(false); }} className={`w-full text-left p-2 rounded-lg transition-colors ${currentPersona.id === persona.id ? 'bg-[#3b82f6] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
                        <div className="font-medium text-xs">{persona.name}</div>
                        <div className="text-xs opacity-70">{persona.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">Text Size</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))} className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white font-bold text-xs">-</button>
                    <span className="text-white font-bold text-xs min-w-[40px] text-center">{zoomLevel}%</span>
                    <button onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))} className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white font-bold text-xs">+</button>
                  </div>
                </div>
                <button onClick={() => { onLogout(); setShowDropdown(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">Logout</button>
              </div>
            )}
          </div>
          <div className="text-center flex-1 px-2">
            <h1 className="text-white font-black text-lg uppercase tracking-[0.2em]" style={{ fontSize: `${zoomLevel / 100}rem` }}>L<span className="text-[#3b82f6]">Y</span>LO</h1>
            <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-bold">Digital Bodyguard</p>
          </div>
          <div className="flex items-center gap-2 relative">
            <div className="text-right cursor-pointer hover:bg-white/10 rounded p-2 transition-colors" onClick={(e) => { e.stopPropagation(); setShowUserDetails(!showUserDetails); }}>
              <div className="text-white font-bold text-xs" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>{getUserDisplayName()}{isEliteUser && <span className="text-yellow-400 ml-1">★</span>}</div>
              <div className="flex items-center gap-1 justify-end"><div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div><span className="text-gray-400 text-xs uppercase font-bold">{isOnline ? 'Online' : 'Offline'}</span></div>
            </div>
            {showUserDetails && userStats && (
              <div className="absolute top-16 right-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[250px] z-[100003] shadow-2xl">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Account Details</h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex justify-between"><span>Tier:</span><span className={`font-bold ${isEliteUser ? 'text-yellow-400' : 'text-[#3b82f6]'}`}>{userStats.tier.toUpperCase()} {isEliteUser && ' ★'}</span></div>
                  <div className="flex justify-between"><span>Today:</span><span className="text-white">{userStats.conversations_today}</span></div>
                  <div className="flex justify-between"><span>Total:</span><span className="text-white">{userStats.total_conversations}</span></div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1"><span>Usage:</span><span>{userStats.usage.current}/{userStats.usage.limit}</span></div>
                    <div className="bg-gray-800 rounded-full h-2"><div className="h-2 bg-[#3b82f6] rounded-full transition-all" style={{ width: `${Math.min(100, userStats.usage.percentage)}%` }} /></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGES AREA - UPDATED PADDING FOR SCROLL */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-3 relative z-[100000]"
        style={{ paddingBottom: '240px', minHeight: 0, fontSize: `${zoomLevel / 100}rem` }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-16 h-16 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <span className="text-white font-black text-xl">L</span>
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-[0.1em] mb-2">{currentPersona.name}</h2>
            <p className="text-gray-400 text-sm max-w-sm uppercase tracking-[0.1em] font-medium">Your AI Security System is Ready</p>
            {isEliteUser && (
              <button onClick={openScamRecovery} className="mt-4 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors animate-pulse">
                🚨 SCAM RECOVERY CENTER
              </button>
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border transition-all ${msg.sender === 'user' ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white shadow-lg shadow-blue-500/10' : 'bg-black/60 border-white/10 text-gray-100'}`}>
                <div className="leading-relaxed font-medium">{msg.content}</div>
                <div className={`text-xs mt-2 opacity-70 font-bold uppercase tracking-wider ${msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            {msg.sender === 'bot' && msg.confidenceScore && (
              <div className="max-w-[85%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-black uppercase text-xs tracking-[0.1em]">Truth Confidence</span>
                    <span className="text-[#3b82f6] font-black text-sm">{msg.confidenceScore}%</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000" style={{ width: `${msg.confidenceScore}%` }} /></div>
                  {msg.scamDetected && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs font-bold">
                      ⚠️ SCAM DETECTED
                      {msg.scamIndicators && msg.scamIndicators.length > 0 && <div className="mt-1 text-xs opacity-80 font-normal">{msg.scamIndicators.join(', ')}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
                <span className="text-gray-300 font-medium uppercase tracking-wider text-sm">{currentPersona.name} analyzing...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-[100002]">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3">
          {isListening && <div className="mb-2 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-xs font-bold text-center">🎤 LISTENING - No time limit. Click "Mic OFF" when ready.</div>}
          <div className="flex items-center justify-between mb-3">
            <button onClick={toggleListening} disabled={loading || !micSupported} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : micSupported ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-700 text-gray-500 cursor-not-allowed'} disabled:opacity-50`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>Mic {isListening ? 'ON' : 'OFF'}</button>
            <button onClick={cycleFontSize} className="text-xs px-3 py-1 rounded bg-zinc-800 text-blue-400 font-bold border border-blue-500/30 hover:bg-blue-900/20 active:scale-95 transition-all uppercase tracking-wide">Text Size: {zoomLevel}%</button>
            <button onClick={toggleTTS} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all relative ${autoTTS ? 'bg-[#3b82f6] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>Voice {autoTTS ? 'ON' : 'OFF'}{isSpeaking && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}</button>
          </div>
          <div className="flex items-end gap-3">
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
             <button onClick={() => fileInputRef.current?.click()} className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-all ${selectedImage ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`} title="Upload Image">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </button>
            <div className="flex-1">
              <textarea 
                ref={inputRef}
                value={displayText} 
                onChange={(e) => !isListening && setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isListening ? "🎤 Listening..." : selectedImage ? `Image selected: ${selectedImage.name}. Add context...` : `Message ${currentPersona.name}...`}
                disabled={loading}
                className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium pt-2 ${isListening ? 'text-yellow-300' : ''}`}
                style={{ fontSize: `${zoomLevel / 100}rem` }}
                rows={1}
              />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedImage)} className={`px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-[0.1em] transition-all ${(input.trim() || selectedImage) && !loading ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg hover:shadow-blue-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`} style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}>{loading ? 'Sending' : 'Send'}</button>
          </div>
          {/* DISCLAIMER ADDED HERE */}
          <div className="text-center mt-3 pb-1">
            <p className="text-[10px] text-gray-500 font-medium tracking-wide">
              LYLO is an AI and can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
