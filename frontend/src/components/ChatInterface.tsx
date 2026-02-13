import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
// We define the types locally if they aren't exported from types.ts to ensure this file is self-contained
export interface PersonaConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  voice?: string;
}

// DIRECT CONNECTION TO YOUR BACKEND
const API_URL = 'https://lylo-backend.onrender.com';

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
  { id: 'disciple', name: 'The Disciple', description: 'Wise Advisor (King James Bible)', color: 'gold' },
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
  
  // VOICE STATE
  const [autoTTS, setAutoTTS] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male'); // NEW: Gender State

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

  // --- SECURITY UI LOGIC (GLOW) ---
  const getSecurityGlowClass = () => {
    if (loading) return 'border-yellow-500 shadow-[0_0_15px_rgba(255,191,0,0.4)] animate-pulse';
    const lastBotMsg = [...messages].reverse().find(m => m.sender === 'bot');
    if (!lastBotMsg) return 'border-white/10';
    
    if (lastBotMsg.scamDetected && lastBotMsg.confidenceScore === 100) {
      return 'border-red-500 shadow-[0_0_20px_rgba(255,77,77,0.8)] animate-bounce';
    }
    if (lastBotMsg.confidenceScore && lastBotMsg.confidenceScore >= 85 && lastBotMsg.confidenceScore <= 95) {
      return 'border-yellow-500 shadow-[0_0_15px_rgba(255,191,0,0.5)]';
    }
    if (lastBotMsg.confidenceScore === 100 && !lastBotMsg.scamDetected) {
      return 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]';
    }
    return 'border-white/10';
  };

  useEffect(() => {
    loadUserStats();
    checkEliteStatus();
    
    // Load saved voice preference
    const savedVoice = localStorage.getItem('lylo_voice_gender');
    if (savedVoice === 'female') setVoiceGender('female');
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
      const response = await fetch(`${API_URL}/check-beta-access`, {
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
      const response = await fetch(`${API_URL}/scam-recovery/${userEmail}`);
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

  // --- SPEECH LOGIC (INPUT) ---
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
  }, [input, isListening, loading, speechTimeout, language]); 

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
      if (onUsageUpdate) onUsageUpdate();
    } catch (error) { console.error(error); }
  };

  // --- NEW: BACKEND VOICE GENERATION LOGIC ---
  const speakText = async (text: string, forceGender?: string) => {
    // If user clicked "Voice OFF" (autoTTS is false) AND this wasn't a forced preview click, don't speak.
    // But if forceGender is present (user clicked toggle), we speak regardless of autoTTS.
    if ((!autoTTS && !forceGender) || !text) return;
    
    // Stop any current audio
    if (isSpeaking) {
      window.speechSynthesis.cancel(); // Cancel browser fallback
      setIsSpeaking(false);
      // Note: HTML Audio elements handle their own stopping usually, but setting state helps UI
    }

    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;

    // Determine Voice ID: 'onyx' = Male, 'nova' = Female
    const genderToUse = forceGender || voiceGender;
    const voiceId = genderToUse === 'male' ? 'onyx' : 'nova';

    setIsSpeaking(true);

    try {
      // 1. Try Backend High-Quality Voice
      const formData = new FormData();
      formData.append('text', cleanText);
      formData.append('voice', voiceId);

      const response = await fetch(`${API_URL}/generate-audio`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.audio_b64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
        audio.onended = () => setIsSpeaking(false);
        audio.play().catch(e => {
            console.error("Audio play error", e);
            setIsSpeaking(false);
        });
      } else {
        throw new Error("No audio returned");
      }

    } catch (error) {
      console.warn("Backend TTS failed, using browser fallback", error);
      // 2. Fallback to Browser Voice
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 0.9;
        utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
        
        // Try to find a matching browser voice gender if possible (imperfect)
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            // Simple heuristic: 'Google US English' is often female-ish, 'Google UK English Male' etc.
            // We just let default happen for fallback to keep it robust
        }
        
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    // Only auto-speak if it's a bot message AND not already speaking
    if (lastMessage?.sender === 'bot' && autoTTS && !isSpeaking) {
      // Small delay to ensure state settles
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
    // If turning OFF, silence immediately
    if (autoTTS) { 
        window.speechSynthesis?.cancel(); 
        setIsSpeaking(false); 
    }
    setAutoTTS(!autoTTS);
  };

  // --- NEW: VOICE TOGGLE HANDLER ---
  const handleVoiceToggle = (gender: 'male' | 'female') => {
    setVoiceGender(gender);
    localStorage.setItem('lylo_voice_gender', gender);
    
    // Play instant preview
    const previewText = gender === 'male' 
      ? (language === 'es' ? "Voz configurada a Masculino." : "Voice set to Male.") 
      : (language === 'es' ? "Voz configurada a Femenino." : "Voice set to Female.");
      
    speakText(previewText, gender);
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
    if (userStats && userStats.usage.current >= userStats.usage.limit) {
      setShowLimitModal(true); // Show the upgrade popup
      return; 
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
        language 
      );
      
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
      
      {/* --- LIMIT REACHED MODAL --- */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100050] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
             <div className="text-4xl mb-3">🛑</div>
             <h2 className="text-white font-black text-lg uppercase tracking-wider mb-2">Daily Limit Reached</h2>
             <p className="text-gray-300 text-sm mb-6">
               You have used all {userStats?.usage.limit} messages for your current plan. Upgrade to <b>Elite</b> for 500 messages/day or <b>Max</b> for Unlimited.
             </p>
             <button 
               onClick={() => { setShowLimitModal(false); onLogout(); }} 
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

      {/* HEADER WITH DYNAMIC SECURITY GLOW */}
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
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[220px] z-[100003] max-h-[60vh] overflow-y-auto shadow-2xl">
                {/* LANGUAGE TOGGLE */}
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

                {/* NEW: VOICE GENDER TOGGLE */}
                <div className="mb-3 pb-3 border-b border-white/10">
                   <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Voice Gender / Género</h3>
                   <div className="flex gap-2">
                     <button 
                       onClick={() => handleVoiceToggle('male')} 
                       className={`flex-1 py-2 rounded text-xs font-bold uppercase flex items-center justify-center gap-1 ${voiceGender === 'male' ? 'bg-slate-700 text-white border border-slate-500' : 'bg-white/5 text-gray-400'}`}
                     >
                       ♂ Male
                     </button>
                     <button 
                       onClick={() => handleVoiceToggle('female')} 
                       className={`flex-1 py-2 rounded text-xs font-bold uppercase flex items-center justify-center gap-1 ${voiceGender === 'female' ? 'bg-pink-900/60 text-pink-200 border border-pink-500/50' : 'bg-white/5 text-gray-400'}`}
                     >
                       ♀ Female
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
                    <span className="text-white
