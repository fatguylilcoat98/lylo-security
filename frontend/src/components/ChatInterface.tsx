import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';

// DIRECT CONNECTION TO YOUR BACKEND
const API_URL = 'https://lylo-backend.onrender.com';

// --- INTERFACES ---
export interface PersonaConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  voice?: string;
  requiredTier: 'free' | 'pro' | 'elite' | 'max';
}

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
  onUsageUpdate?: () => void;
}

// Recovery Guide Data Interface
interface RecoveryGuideData {
  title: string;
  subtitle: string;
  immediate_actions: string[];
  recovery_steps: { step: number; title: string; actions: string[] }[];
  phone_scripts: { bank_script: string; police_script: string };
  prevention_tips: string[];
}

const PERSONAS: PersonaConfig[] = [
  // FREE TIER (1)
  { id: 'guardian', name: 'The Guardian', description: 'Protective Security Expert', color: 'blue', requiredTier: 'free' },
  
  // PRO TIER (4 total)
  { id: 'roast', name: 'The Roast Master', description: 'Witty but Helpful Comedian', color: 'orange', requiredTier: 'pro' },
  { id: 'disciple', name: 'The Disciple', description: 'Biblical Advisor & Wise Counselor', color: 'gold', requiredTier: 'pro' },
  { id: 'mechanic', name: 'The Mechanic', description: 'Auto Expert & Car Enthusiast', color: 'gray', requiredTier: 'pro' },
  
  // ELITE TIER (7 total)
  { id: 'chef', name: 'The Chef', description: 'Culinary Master & Food Expert', color: 'red', requiredTier: 'elite' },
  { id: 'techie', name: 'The Techie', description: 'Technology Expert & Geek Guide', color: 'purple', requiredTier: 'elite' },
  { id: 'comedian', name: 'The Comedian', description: 'Stand-Up Comic & Entertainment Expert', color: 'pink', requiredTier: 'elite' },
  
  // MAX TIER (10 total)
  { id: 'lawyer', name: 'The Lawyer', description: 'Legal Advisor & Risk Analyst', color: 'yellow', requiredTier: 'max' },
  { id: 'storyteller', name: 'The Storyteller', description: 'Master of Tales & Creative Writing', color: 'indigo', requiredTier: 'max' },
  { id: 'fitness', name: 'The Fitness Coach', description: 'Health & Wellness Expert', color: 'green', requiredTier: 'max' }
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
  
  // VOICE STATE - Enhanced for better control
  const [isListening, setIsListening] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [premiumVoice, setPremiumVoice] = useState(false); // Toggle for OpenAI vs Browser TTS

  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  
  // New Features State
  const [language, setLanguage] = useState<'en' | 'es'>('en'); 
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [bibleVersion, setBibleVersion] = useState<'kjv' | 'esv'>('kjv');
  
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>(
    (localStorage.getItem('userTier') as any) || 'free'
  );
  
  // Scam Recovery State
  const [showScamRecovery, setShowScamRecovery] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false); 
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null);
  
  const [isEliteUser, setIsEliteUser] = useState(
    userEmail.toLowerCase().includes('stangman') || 
    userEmail.toLowerCase().includes('elite') ||
    localStorage.getItem('userTier') === 'max'
  );
   
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TIER CHECKING ---
  const canAccessPersona = (persona: PersonaConfig): boolean => {
    const tierHierarchy = { free: 0, pro: 1, elite: 2, max: 3 };
    return tierHierarchy[userTier] >= tierHierarchy[persona.requiredTier];
  };

  const getPersonasByTier = () => {
    return PERSONAS.filter(persona => canAccessPersona(persona));
  };

  const getTierName = (tier: string): string => {
    switch(tier) {
      case 'free': return 'Basic Shield';
      case 'pro': return 'Pro Guardian';
      case 'elite': return 'Elite Justice';
      case 'max': return 'Max Unlimited';
      default: return 'Unknown';
    }
  };

  const getTierColor = (tier: string): string => {
    switch(tier) {
      case 'free': return 'text-gray-400';
      case 'pro': return 'text-blue-400';
      case 'elite': return 'text-amber-400';
      case 'max': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

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
    const savedVoice = localStorage.getItem('lylo_voice_gender');
    if (savedVoice === 'female') setVoiceGender('female');
    
    const savedBibleVersion = localStorage.getItem('lylo_bible_version');
    if (savedBibleVersion === 'esv') setBibleVersion('esv');
    
    // Load premium voice preference
    const savedPremiumVoice = localStorage.getItem('lylo_premium_voice');
    if (savedPremiumVoice === 'true') setPremiumVoice(true);
  }, [userEmail]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- SPEED-OPTIMIZED AUDIO CLEANUP ---
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // --- OPTIMIZED MICROPHONE CONTROL ---
  const forceStopRecognition = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition._manuallyStopped = true;
      try {
        recognition.stop();
      } catch (e) {}
    }
    setIsListening(false);
    setMicActive(false);
  };

  // OPTIMIZED SPEECH RECOGNITION (Faster initialization)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'es' ? 'es-MX' : 'en-US'; 
      recognition.maxAlternatives = 1;
      recognition._manuallyStopped = false;

      recognition.onstart = () => { if (!recognition._manuallyStopped) setMicActive(true); };
      
      recognition.onresult = (event: any) => {
        if (recognition._manuallyStopped) return;
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setInput((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setMicActive(false);
      };

      recognition.onend = () => {
        setMicActive(false);
        if (isListening && !recognition._manuallyStopped) {
          setTimeout(() => {
            if (isListening && !recognition._manuallyStopped) {
              try { recognition.start(); } catch (e) { setIsListening(false); }
            }
          }, 50); // Reduced delay
        }
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    } else {
      setMicSupported(false);
    }
  }, [language]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening && !micActive && !recognition._manuallyStopped) {
      recognition._manuallyStopped = false;
      try { recognition.start(); } catch(e) { setIsListening(false); }
    }
  }, [isListening]);

  // --- HANDLERS ---
  const checkEliteStatus = async () => {
    try {
      const cleanEmail = userEmail.toLowerCase().trim();
      if (cleanEmail.includes("stangman")) {
          setIsEliteUser(true);
          setUserTier('max');
      }
      const response = await fetch(`${API_URL}/check-beta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await response.json();
      
      if (data.tier === 'max') {
        setUserTier('max');
        setIsEliteUser(true);
      } else if (data.tier === 'elite') {
        setUserTier('elite');
        setIsEliteUser(true);
      } else if (data.tier === 'pro') {
        setUserTier('pro');
      } else {
        setUserTier('free');
      }
    } catch (error) {
      console.error('Failed to check elite status:', error);
    }
  };

  const handleGetFullGuide = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/scam-recovery/${userEmail}`);
      const data = await response.json();
      setGuideData(data);
      setShowFullGuide(true); 
    } catch (error) {
      alert("Could not load the guide. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // SPEED-OPTIMIZED Bible Version Toggle
  const handleBibleVersionToggle = (version: 'kjv' | 'esv') => {
    quickStopAllAudio();
    setBibleVersion(version);
    localStorage.setItem('lylo_bible_version', version);
    
    setTimeout(() => {
      const versionName = version === 'kjv' ? 'King James Version' : 'English Standard Version';
      speakText(`Bible version changed to ${versionName}.`, voiceGender);
    }, 50); // Reduced delay
  };

  const handlePersonaChange = (persona: PersonaConfig) => {
    if (!canAccessPersona(persona)) {
      alert(`${persona.name} requires ${getTierName(persona.requiredTier)} tier or higher.`);
      return;
    }
    onPersonaChange(persona);
    setShowDropdown(false);
  };

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
      if (onUsageUpdate) onUsageUpdate();
    } catch (error) { console.error(error); }
  };

  // SPEED-OPTIMIZED TTS FUNCTION - Hybrid approach
  const speakText = async (text: string, forceGender?: string) => {
    if ((!autoTTS && !forceGender) || !text) return;
    
    // INSTANT STOP
    quickStopAllAudio();
    if (isListening || micActive) forceStopRecognition();

    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;

    setIsSpeaking(true);

    // SPEED OPTIMIZATION: Use browser TTS by default (instant), premium TTS as option
    if (!premiumVoice || cleanText.length > 500) {
      // FAST BROWSER TTS (No network delay)
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      // PREMIUM OPENAI TTS (for shorter messages when enabled)
      try {
        const formData = new FormData();
        formData.append('text', cleanText.substring(0, 300)); // Limit length for speed
        formData.append('voice', forceGender === 'male' || voiceGender === 'male' ? 'onyx' : 'nova');

        const response = await fetch(`${API_URL}/generate-audio`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.audio_b64) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
        } else {
          throw new Error("No audio returned");
        }
      } catch (error) {
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 0.9;
        utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS && !isSpeaking && !isListening) {
      setTimeout(() => speakText(lastMessage.content), 100); // Reduced delay
    }
  }, [messages, autoTTS]);

  // SPEED-OPTIMIZED Controls
  const toggleListening = () => {
    if (!micSupported) return alert('Not supported');
    if (isListening || micActive) {
      forceStopRecognition();
    } else {
      quickStopAllAudio();
      setTimeout(() => setIsListening(true), 50); // Reduced delay
    }
  };

  const toggleTTS = () => {
    quickStopAllAudio();
    setAutoTTS(!autoTTS);
  };

  const handleVoiceToggle = (gender: 'male' | 'female') => {
    quickStopAllAudio();
    forceStopRecognition();
    setVoiceGender(gender);
    localStorage.setItem('lylo_voice_gender', gender);
    
    setTimeout(() => {
      const previewText = gender === 'male' 
        ? (language === 'es' ? "Voz configurada a Masculino." : "Voice set to Male.") 
        : (language === 'es' ? "Voz configurada a Femenino." : "Voice set to Female.");
      speakText(previewText, gender);
    }, 100); // Reduced delay
  };

  const togglePremiumVoice = () => {
    quickStopAllAudio();
    const newPremium = !premiumVoice;
    setPremiumVoice(newPremium);
    localStorage.setItem('lylo_premium_voice', newPremium.toString());
    
    setTimeout(() => {
      speakText(newPremium ? "Premium voice enabled." : "Fast voice enabled.", voiceGender);
    }, 100);
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

    if (userStats && userStats.usage.current >= userStats.usage.limit) {
      setShowLimitModal(true); 
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
      // SPEED OPTIMIZATION: Only send last 2 messages instead of full history
      const conversationHistory = messages.slice(-2).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      let personaWithBible = currentPersona.id;
      if (currentPersona.id === 'disciple') {
        personaWithBible = `disciple_${bibleVersion}`;
      }

      const response = await sendChatMessage(
        textToSend || "Analyze this image", 
        conversationHistory,
        personaWithBible,
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

  const displayText = input;

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
             <div className="text-4xl mb-3">STOP</div>
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
                  {guideData.title}
                </h2>
                <p className="text-red-300 text-xs mt-1 font-bold">{guideData.subtitle}</p>
              </div>
              <button 
                onClick={() => setShowFullGuide(false)}
                className="p-2 bg-black/40 hover:bg-white/10 rounded-lg text-white transition-colors"
              >
                X
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
                    <li key={i} className="bg-green-900/10 text-green-200 p-2 rounded border border-green-500/20 text-xs font-medium">{tip}</li>
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
              <h2 className="text-red-400 font-black text-lg uppercase tracking-wider">SCAM RECOVERY CENTER</h2>
              <button onClick={() => setShowScamRecovery(false)} className="text-white text-xl font-bold px-3 py-1 bg-red-600 rounded-lg">X</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                <p className="text-red-300 font-bold mb-2">IMMEDIATE ACTIONS:</p>
                <ul className="text-gray-300 space-y-1 text-xs">
                  <li>STOP sending any more money</li>
                  <li>Call your bank immediately</li>
                  <li>Change all passwords</li>
                  <li>Screenshot everything</li>
                  <li>File police report</li>
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
                {loading ? <span>GENERATING GUIDE...</span> : <span>GET FULL RECOVERY GUIDE</span>}
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
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[280px] z-[100003] max-h-[70vh] overflow-y-auto shadow-2xl">
                {/* LANGUAGE TOGGLE */}
                <div className="mb-3 pb-3 border-b border-white/10">
                   <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Language / Idioma</h3>
                   <div className="flex gap-2">
                     <button onClick={() => setLanguage('en')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>ENG</button>
                     <button onClick={() => setLanguage('es')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'es' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400'}`}>ESP</button>
                   </div>
                </div>

                {/* VOICE CONTROLS */}
                <div className="mb-3 pb-3 border-b border-white/10">
                   <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Voice Settings</h3>
                   <div className="flex gap-2 mb-2">
                     <button onClick={() => handleVoiceToggle('male')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${voiceGender === 'male' ? 'bg-slate-700 text-white' : 'bg-white/5 text-gray-400'}`}>Male</button>
                     <button onClick={() => handleVoiceToggle('female')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${voiceGender === 'female' ? 'bg-pink-900/60 text-pink-200' : 'bg-white/5 text-gray-400'}`}>Female</button>
                   </div>
                   <button onClick={togglePremiumVoice} className={`w-full py-2 rounded text-xs font-bold uppercase ${premiumVoice ? 'bg-purple-700 text-purple-200' : 'bg-white/5 text-gray-400'}`}>
                     {premiumVoice ? 'Premium Voice ON' : 'Fast Voice ON'}
                   </button>
                </div>

                {currentPersona.id === 'disciple' && (
                  <div className="mb-3 pb-3 border-b border-yellow-500/20">
                     <h3 className="text-yellow-400 font-bold text-xs uppercase tracking-wider mb-2">Bible Version</h3>
                     <div className="flex gap-2">
                       <button onClick={() => handleBibleVersionToggle('kjv')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${bibleVersion === 'kjv' ? 'bg-yellow-800 text-yellow-200 border border-yellow-500' : 'bg-white/5 text-gray-400'}`}>KJV</button>
                       <button onClick={() => handleBibleVersionToggle('esv')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${bibleVersion === 'esv' ? 'bg-yellow-800 text-yellow-200 border border-yellow-500' : 'bg-white/5 text-gray-400'}`}>ESV</button>
                     </div>
                  </div>
                )}

                {isEliteUser && (
                  <div className="mb-3 pb-3 border-b border-red-500/20">
                    <button onClick={() => { openScamRecovery(); setShowDropdown(false); }} className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">SCAM RECOVERY</button>
                  </div>
                )}
                
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">AI Personality</h3>
                  </div>
                  <div className="space-y-1">
                    {PERSONAS.map(persona => {
                      const canAccess = canAccessPersona(persona);
                      return (
                        <button key={persona.id} onClick={() => canAccess ? handlePersonaChange(persona) : null} disabled={!canAccess} className={`w-full text-left p-2 rounded-lg transition-colors ${currentPersona.id === persona.id ? (persona.id === 'disciple' ? 'bg-yellow-700 text-yellow-200' : 'bg-[#3b82f6] text-white') : canAccess ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'}`}>
                          <div className="font-medium text-xs flex items-center justify-between">
                            <span>{persona.name}</span>
                            {!canAccess && <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${getTierColor(persona.requiredTier)}`}>{getTierName(persona.requiredTier)}</span>}
                          </div>
                          <div className="text-xs opacity-70">{persona.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => { onLogout(); setShowDropdown(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">Logout</button>
              </div>
            )}
          </div>
          
          <div className="text-center flex-1 px-2">
            <div className={`inline-flex items-center gap-3 px-4 py-1 rounded-full border-2 transition-all duration-700 ${getSecurityGlowClass()}`}>
              <h1 className="text-white font-black text-lg uppercase tracking-[0.2em]" style={{ fontSize: `${zoomLevel / 100}rem` }}>L<span className="text-[#3b82f6]">Y</span>LO</h1>
            </div>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-black mt-1">Digital Bodyguard</p>
          </div>
          
          <div className="flex items-center gap-2 relative">
            <div className="text-right cursor-pointer hover:bg-white/10 rounded p-2 transition-colors" onClick={(e) => { e.stopPropagation(); setShowUserDetails(!showUserDetails); }}>
              <div className="text-white font-bold text-xs" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>{getUserDisplayName()}{isEliteUser && <span className="text-yellow-400 ml-1">★</span>}</div>
              <div className="flex items-center gap-1 justify-end"><div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div><span className="text-gray-400 text-[10px] uppercase font-black">{isOnline ? 'Online' : 'Offline'}</span></div>
            </div>
            {showUserDetails && userStats && (
              <div className="absolute top-16 right-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[250px] z-[100003] shadow-2xl">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Account Details</h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex justify-between"><span>Tier:</span><span className={`font-bold ${isEliteUser ? 'text-yellow-400' : 'text-[#3b82f6]'}`}>{userStats.tier.toUpperCase()} {isEliteUser && ' ★'}</span></div>
                  <div className="flex justify-between"><span>Today:</span><span className="text-white">{userStats.conversations_today}</span></div>
                  <div className="flex justify-between"><span>Total:</span><span className="text-white">{userStats.total_conversations}</span></div>
                  <div className="flex justify-between"><span>Personalities:</span><span className="text-white">{getPersonasByTier().length}/10</span></div>
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

      {/* MESSAGES */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-4 relative z-[100000]"
        style={{ paddingBottom: '240px', minHeight: 0, fontSize: `${zoomLevel / 100}rem` }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className={`w-16 h-16 ${currentPersona.id === 'disciple' ? 'bg-gradient-to-br from-yellow-600 to-yellow-800' : 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8]'} rounded-2xl flex items-center justify-center mb-4 shadow-lg ${currentPersona.id === 'disciple' ? 'shadow-yellow-500/20' : 'shadow-blue-500/20'}`}>
              <span className="text-white font-black text-xl">L</span>
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-[0.1em] mb-2">{currentPersona.name}</h2>
            <p className="text-gray-400 text-sm max-w-sm uppercase tracking-[0.1em] font-medium italic">
              {currentPersona.id === 'disciple' 
                ? `Biblical Wisdom & Scripture Guidance (${bibleVersion.toUpperCase()})` 
                : 'Security & Wisdom Systems Ready'
              }
            </p>
            {isEliteUser && (
              <button onClick={openScamRecovery} className="mt-4 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors animate-pulse">
                SCAM RECOVERY CENTER
              </button>
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border transition-all ${msg.sender === 'user' ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white shadow-lg shadow-blue-500/10' : 'bg-black/60 border-white/10 text-gray-100'}`}>
                <div className="leading-relaxed font-medium">{msg.content}</div>
                <div className={`text-[10px] mt-2 opacity-70 font-black uppercase tracking-wider ${msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            {msg.sender === 'bot' && msg.confidenceScore && (
              <div className="max-w-[85%]">
                <div className={`bg-black/40 backdrop-blur-xl border rounded-xl p-3 shadow-lg transition-all duration-1000 ${msg.scamDetected && msg.confidenceScore === 100 ? 'border-red-500' : 'border-white/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-black uppercase text-[10px] tracking-[0.1em]">Truth Confidence</span>
                    <span className={`font-black text-sm ${msg.scamDetected && msg.confidenceScore === 100 ? 'text-red-500' : 'text-[#3b82f6]'}`}>{msg.confidenceScore}%</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${msg.scamDetected && msg.confidenceScore === 100 ? 'bg-red-500' : 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8]'}`} style={{ width: `${msg.confidenceScore}%` }} />
                  </div>
                  {msg.scamDetected && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-[10px] font-black uppercase">
                      SCAM DETECTED
                      {msg.scamIndicators && msg.scamIndicators.length > 0 && <div className="mt-1 text-[9px] opacity-80 font-normal normal-case">{msg.scamIndicators.join(', ')}</div>}
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
                <span className="text-gray-300 font-black uppercase tracking-widest text-[10px] italic">{currentPersona.name} thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-[100002]">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3">
          {(isListening || micActive) && <div className="mb-2 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-[10px] font-black uppercase text-center animate-pulse tracking-widest">MIC ACTIVE</div>}
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={toggleListening} 
              disabled={loading || !micSupported} 
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all ${
                (isListening || micActive) 
                  ? 'bg-red-600 text-white animate-pulse border-red-500' 
                  : micSupported 
                    ? 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              } disabled:opacity-50 border`} 
              style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}
            >
              Mic {(isListening || micActive) ? 'ON' : 'OFF'}
            </button>
            
            <button onClick={cycleFontSize} className="text-sm px-8 py-3 rounded-lg bg-zinc-800 text-blue-400 font-black border-2 border-blue-500/40 hover:bg-blue-900/20 active:scale-95 transition-all uppercase tracking-widest shadow-lg">Size: {zoomLevel}%</button>
            
            <button 
              onClick={toggleTTS} 
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all relative border ${
                autoTTS 
                  ? 'bg-[#3b82f6] text-white border-blue-500' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'
              }`} 
              style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}
            >
              Voice {autoTTS ? 'ON' : 'OFF'}
              {isSpeaking && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </button>
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
                onChange={(e) => !(isListening || micActive) && setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={(isListening || micActive) ? "Listening..." : selectedImage ? `Image selected: ${selectedImage.name}...` : `Message ${currentPersona.name}...`}
                disabled={loading || isListening || micActive}
                className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium pt-2 ${(isListening || micActive) ? 'text-yellow-300 italic cursor-not-allowed' : ''}`}
                style={{ fontSize: `${zoomLevel / 100}rem` }}
                rows={1}
              />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedImage) || isListening || micActive} className={`px-6 py-3 rounded-lg font-black text-sm uppercase tracking-[0.1em] transition-all ${(input.trim() || selectedImage) && !loading && !isListening && !micActive ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg hover:shadow-blue-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`} style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}>{loading ? 'Sending' : 'Send'}</button>
          </div>
          <div className="text-center mt-3 pb-1">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] italic">
              LYLO SECURITY SYSTEMS: VERIFY ALL CRITICAL FINANCIAL OR LEGAL ACTIONS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
