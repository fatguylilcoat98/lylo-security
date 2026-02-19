import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2, Heart,
 UserCheck
} from 'lucide-react';

// --- IMPORT EXTRACTED LOGIC & DATA ---
import { PERSONAS, REAL_INTEL_DROPS, canAccessPersona, getAccessiblePersonas, PersonaConfig } from '../data/personas';
import { getPersonaColorClass } from '../utils/theme';
import { detectExpertSuggestion } from '../logic/contextEngine';
import { useAudioEngine } from '../logic/audioEngine';

const API_URL = 'https://lylo-backend.onrender.com';

interface BestieConfig { gender: 'male' | 'female'; voiceId: string; vibeLabel: string; }

interface ChatInterfaceProps {
 currentPersona?: PersonaConfig; 
 userEmail: string; 
 zoomLevel?: number;
 onZoomChange?: (zoom: number) => void; 
 onPersonaChange?: (persona: PersonaConfig) => void;
 onLogout?: () => void; 
 onUsageUpdate?: () => void;
}

function ChatInterface({ 
  currentPersona: initialPersona, 
  userEmail = '', 
  onPersonaChange = () => {}, 
  onLogout = () => {}, 
  onUsageUpdate = () => {} 
}: ChatInterfaceProps) {
 
 // --- STATE ---
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => initialPersona || PERSONAS[0]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [userName, setUserName] = useState<string>('User');
 const [notifications, setNotifications] = useState<string[]>([]);
 const [bestieConfig, setBestieConfig] = useState<BestieConfig | null>(null);
 const [showBestieSetup, setShowBestieSetup] = useState(false);
 const [setupStep, setSetupStep] = useState<'gender' | 'voice'>('gender');
 const [tempGender, setTempGender] = useState<'male' | 'female'>('female');
 const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
 const [showDropdown, setShowDropdown] = useState(false);
 const [userStats, setUserStats] = useState<UserStats | null>(null);
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [showCrisisShield, setShowCrisisShield] = useState(false);
 const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
 const [pushEnabled, setPushEnabled] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [isEliteUser, setIsEliteUser] = useState(true);
 
 // --- NEW: SENIOR MODE TOGGLE ---
 const [isSeniorMode, setIsSeniorMode] = useState(false);
 
 // --- REFS ---
 const chatContainerRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // --- EXTERNAL HOOKS ---
 const {
   isRecording,
   isSpeaking,
   micSupported,
   quickStopAllAudio,
   speakText,
   initMic,
   handleWalkieTalkieMic,
   clearMicBuffer
 } = useAudioEngine(API_URL);

 // --- INITIALIZATION ---
 useEffect(() => {
  const init = async () => {
   const emailRaw = (localStorage.getItem('lylo_user_email') || userEmail).toLowerCase();
   
   if (emailRaw.includes('stangman')) setUserName('Christopher');
   else if (emailRaw.includes('betatester6')) setUserName('Ron');
   else if (emailRaw.includes('betatester7')) setUserName('Marilyn');
   else setUserName(localStorage.getItem('lylo_user_name') || 'User');

   const savedBestie = localStorage.getItem('lylo_bestie_config');
   if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
   
   const savedSeniorMode = localStorage.getItem('lylo_senior_mode');
   if (savedSeniorMode) setIsSeniorMode(savedSeniorMode === 'true');

   const allDrops = Object.keys(REAL_INTEL_DROPS);
   const cleared = JSON.parse(localStorage.getItem('lylo_cleared_intel') || '[]');
   const available = allDrops.filter(id => !cleared.includes(id));
   const randomSelection = available.sort(() => 0.5 - Math.random()).slice(0, 3);
   setNotifications(randomSelection);
   
   if ('Notification' in window && Notification.permission === 'granted') setPushEnabled(true);
   await loadUserStats();
   await checkEliteStatus();
  };
  init();
  return () => quickStopAllAudio();
 }, [userEmail]);

 // Init STT logic
 useEffect(() => {
   initMic(
     (liveText) => setInput(liveText), 
     (finalText) => {
       setInput(finalText);
       handleSend(finalText); 
     }
   );
 }, [activePersona, messages, selectedImage, isSeniorMode]);

 useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
 }, [messages]);

 // --- API CALLS ---
 const checkEliteStatus = async () => {
  try {
   const emailClean = userEmail.toLowerCase();
   if (emailClean.includes("stangman") || emailClean.includes("betatester6") || emailClean.includes("betatester7")) {
      setUserTier('max');
   } else {
    const response = await fetch(`${API_URL}/check-beta-access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail }) });
    const data = await response.json();
    if (userTier !== 'max') setUserTier(data.tier || 'free');
   }
  } catch (e) { console.error(e); }
 };

 const loadUserStats = async () => {
  try {
   const stats = await getUserStats(userEmail);
   setUserStats(stats);
  } catch (e) { console.error(e); }
 };

 const setupNotifications = async () => {
  if (!('Notification' in window)) return;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setPushEnabled(true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(err => console.error(err));
  }
 };

 const clearAllNotifications = () => {
   setNotifications([]);
   localStorage.setItem('lylo_cleared_intel', JSON.stringify(Object.keys(REAL_INTEL_DROPS)));
 };

 // --- CORE ACTIONS ---

 // 1. Standard Switch
 const handlePersonaChange = async (persona: PersonaConfig) => {
  if (!canAccessPersona(persona, userTier)) { speakText('Upgrade required.', 'onyx'); return; }
  if (persona.id === 'bestie' && !bestieConfig) { setTempGender('female'); setSetupStep('gender'); setShowBestieSetup(true); return; }
  
  const wasNotified = notifications.includes(persona.id);
  quickStopAllAudio();
  setSelectedPersonaId(persona.id);
  
  if (wasNotified) {
    const cleared = JSON.parse(localStorage.getItem('lylo_cleared_intel') || '[]');
    localStorage.setItem('lylo_cleared_intel', JSON.stringify([...cleared, persona.id]));
    setNotifications(prev => prev.filter(id => id !== persona.id));
    const intelMsg: Message = { id: Date.now().toString(), content: REAL_INTEL_DROPS[persona.id], sender: 'bot', timestamp: new Date(), confidenceScore: 100 };
    setMessages([intelMsg]);
  } else {
    const hookContent = persona.spokenHook.replace('{userName}', userName || 'user');
    const hookMsg: Message = { id: Date.now().toString(), content: hookContent, sender: 'bot', timestamp: new Date() };
    setMessages([hookMsg]);
    let voiceToUse = persona.fixedVoice || 'onyx';
    if (persona.id === 'bestie' && bestieConfig) voiceToUse = bestieConfig.voiceId;
    speakText(hookContent, voiceToUse);
  }
  
  setTimeout(() => { setActivePersona(persona); onPersonaChange(persona); setSelectedPersonaId(null); setShowDropdown(false); }, 300);
 };

 // 2. Expert Handoff 
 const handleExpertHandoff = async (newPersona: PersonaConfig) => {
  if (!canAccessPersona(newPersona, userTier)) { speakText('Upgrade required.', 'onyx'); return; }
  
  quickStopAllAudio();
  setActivePersona(newPersona);
  setLoading(true);

  const transitionId = Date.now().toString();
  const transitionMsg: Message = { 
    id: transitionId, 
    content: `⚡ SECURE LINE TRANSFERRED TO: ${newPersona.name.toUpperCase()} ⚡\n\nReviewing case file...`, 
    sender: 'bot', 
    timestamp: new Date() 
  };
  setMessages(prev => [...prev, transitionMsg]);

  try {
    const lastUserMsg = messages.slice().reverse().find(m => m.sender === 'user')?.content || 'Review my previous messages.';
    const handoffPrompt = `[CRITICAL HANDOFF]: Do NOT give a generic greeting. The user is currently dealing with this specific situation: "${lastUserMsg}". As ${newPersona.name}, give an immediate, step-by-step strategy to resolve this exact issue.`;
    
    // Pass 'senior' or 'standard' to the backend based on the toggle
    const apiStyle = isSeniorMode ? 'senior' : 'standard';
    const response = await sendChatMessage(handoffPrompt, messages, newPersona.id, userEmail, null, 'en', apiStyle);
    
    const botMsg: Message = { 
      id: (Date.now() + 1).toString(), 
      content: response.answer, 
      sender: 'bot', 
      timestamp: new Date(), 
      confidenceScore: response.confidence_score,
      scamDetected: response.scam_detected
    };
    
    setMessages(prev => [...prev.filter(m => m.id !== transitionId), botMsg]);
    
    let voiceToUse = newPersona.fixedVoice || 'onyx';
    if (newPersona.id === 'bestie' && bestieConfig) voiceToUse = bestieConfig.voiceId;
    
    speakText(botMsg.content, voiceToUse, () => {
      setShowReplayButton(null);
    });
    setShowReplayButton(botMsg.id);
    setTimeout(() => setShowReplayButton(null), 5000);

  } catch (e) {
    console.error(e);
    setMessages(prev => [...prev.filter(m => m.id !== transitionId)]);
  } finally {
    setLoading(false);
  }
 };

 // 3. Send Message
 const handleSend = async (forcedText?: string) => {
  const textToSend = forcedText || input.trim();
  if (!textToSend && !selectedImage) return;
  
  quickStopAllAudio(); 
  setLoading(true); 
  
  setInput('');
  clearMicBuffer();
  
  const userMsg: Message = { id: Date.now().toString(), content: textToSend, sender: 'user', timestamp: new Date() };
  setMessages(prev => [...prev, userMsg]);

  try {
   // Pass 'senior' or 'standard' to the backend based on the toggle
   const apiStyle = isSeniorMode ? 'senior' : 'standard';
   const response = await sendChatMessage(textToSend, messages, activePersona.id, userEmail, selectedImage, 'en', apiStyle);
   
   const botMsg: Message = { id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(), confidenceScore: response.confidence_score, scamDetected: response.scam_detected };
   setMessages(prev => [...prev, botMsg]);
   
   let voiceToUse = activePersona.fixedVoice || 'onyx';
   if (activePersona.id === 'bestie' && bestieConfig) voiceToUse = bestieConfig.voiceId;
   
   speakText(botMsg.content, voiceToUse, () => {
     setShowReplayButton(null);
   });
   setShowReplayButton(botMsg.id);
   setTimeout(() => setShowReplayButton(null), 5000);
   
  } catch (e) { console.error(e); } 
  finally { setLoading(false); setSelectedImage(null); }
 };

 const handleBackToServices = () => { quickStopAllAudio(); setMessages([]); setInput(''); clearMicBuffer(); setSelectedImage(null); };

 // --- DYNAMIC CRISIS LOGIC ---
 let crisisTitle = "Emergency OS";
 let crisisWarning = "Call your bank immediately. Report unauthorized access.";
 let crisisAction = "General Support Hub";
 let crisisLink = "#"; 

 if (activePersona.id === 'lawyer') {
   crisisTitle = "LEGAL ESCALATION";
   crisisWarning = "AI cannot represent you in court. You need a licensed attorney to establish attorney-client privilege and take legal action.";
   crisisAction = "Find a Verified Attorney";
   crisisLink = "https://www.legalmatch.com"; 
 } else if (activePersona.id === 'doctor') {
   crisisTitle = "MEDICAL ESCALATION";
   crisisWarning = "AI cannot diagnose medical emergencies. If this is life-threatening, dial 911 immediately.";
   crisisAction = "Connect with Telehealth";
   crisisLink = "https://www.teladoc.com"; 
 } else if (activePersona.id === 'wealth') {
   crisisTitle = "FINANCIAL ESCALATION";
   crisisWarning = "AI is not a certified fiduciary. For major financial moves or severe fraud, speak to a licensed advisor.";
   crisisAction = "Find a Financial Advisor";
   crisisLink = "https://smartasset.com"; 
 }

 // --- RENDER UI ---
 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans" style={{ zIndex: 99999 }}>
   
   {/* CRISIS OVERLAY - DYNAMIC SHIELD */}
   {showCrisisShield && (
    <div className="fixed inset-0 z-[100050] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-red-900/20 border border-red-400/50 rounded-xl p-5 max-w-sm w-full shadow-2xl">
      <div className="flex justify-between items-center mb-5">
       <h2 className="text-red-100 font-black text-lg uppercase">{crisisTitle}</h2>
       <button onClick={() => setShowCrisisShield(false)} className="p-2"><X className="text-white" /></button>
      </div>
      <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4 text-center mb-4">
       <h3 className="text-red-200 font-bold mb-3 flex items-center justify-center gap-2"><AlertTriangle /> SYSTEM WARNING</h3>
       <p className="text-red-100 text-sm">{crisisWarning}</p>
      </div>
      <a 
        href={crisisLink} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="w-full block text-center py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase rounded-lg shadow-lg transition-all active:scale-95"
      >
        {crisisAction} <ArrowRight className="w-4 h-4 inline ml-2" />
      </a>
     </div>
    </div>
   )}

   {/* BESTIE SETUP */}
   {showBestieSetup && (
    <div className="fixed inset-0 z-[100200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-pink-900/30 border border-pink-500/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
      <h2 className="text-pink-100 font-black text-xl mb-4 text-center uppercase tracking-widest">Calibration</h2>
      {setupStep === 'gender' ? (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="p-6 rounded-xl bg-pink-500/20 border border-pink-400/50 flex flex-col items-center"><span className="text-4xl mb-2">👩</span><span className="font-bold text-white">Female</span></button>
          <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="p-6 rounded-xl bg-blue-500/20 border border-blue-400/50 flex flex-col items-center"><span className="text-4xl mb-2">👨</span><span className="font-bold text-white">Male</span></button>
        </div>
      ) : (
        <div className="space-y-3">
          {(tempGender === 'female' ? [{id: 'nova', label: 'Energetic'}, {id: 'alloy', label: 'Chill'}] : [{id: 'echo', label: 'Chill Guy'}, {id: 'onyx', label: 'Deep Voice'}]).map((voice) => (
            <div key={voice.id} className="flex items-center gap-2">
                <button onClick={() => speakText("Vibe check.", voice.id)} className="p-3 bg-pink-500/20 border border-pink-400/50 text-white"><PlayCircle className="w-5 h-5" /></button>
                <button onClick={() => {
                  const newConfig: BestieConfig = { gender: tempGender, voiceId: voice.id, vibeLabel: voice.label };
                  setBestieConfig(newConfig);
                  localStorage.setItem('lylo_bestie_config', JSON.stringify(newConfig));
                  setShowBestieSetup(false);
                  const bestiePersona = PERSONAS.find(p => p.id === 'bestie');
                  if (bestiePersona) handlePersonaChange(bestiePersona);
                }} className="flex-1 p-3 bg-black/40 border border-white/10 hover:border-pink-400 font-bold text-white">{voice.label} Vibe</button>
            </div>
          ))}
        </div>
      )}
     </div>
    </div>
   )}

   {/* HEADER / SETTINGS MENU */}
   <div className="bg-black/90 border-b border-white/10 p-2 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     <div className="relative">
      <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-lg active:scale-95 transition-all"><Settings className="w-5 h-5 text-white" /></button>
      {showDropdown && (
       <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-xl p-4 min-w-[250px] shadow-2xl z-[100001] max-h-[80vh] overflow-y-auto">
        
        {/* SENIOR MODE TOGGLE */}
        <button onClick={() => { 
          const newState = !isSeniorMode;
          setIsSeniorMode(newState);
          localStorage.setItem('lylo_senior_mode', String(newState));
          setShowDropdown(false);
        }} className={`w-full p-3 ${isSeniorMode ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-white/5 border-white/10 text-gray-300'} border rounded-lg font-bold flex items-center justify-between mb-4 active:scale-95 transition-all`}>
          <div className="flex items-center gap-2"><UserCheck className="w-4 h-4"/> Senior Mode</div>
          <div className={`text-xs font-black uppercase ${isSeniorMode ? 'text-indigo-400' : 'text-gray-500'}`}>{isSeniorMode ? 'ON' : 'OFF'}</div>
        </button>

        <div className="h-px bg-white/10 w-full mb-4"></div>

        <button onClick={() => { setupNotifications(); setShowDropdown(false); }} className={`w-full p-3 ${pushEnabled ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-blue-500/10 border-blue-400/30 text-blue-400'} border rounded-lg font-bold flex items-center justify-center gap-2 mb-4 active:scale-95`}>
          {pushEnabled ? <><CheckCircle className="w-4 h-4"/> Alerts Active</> : <><Bell className="w-4 h-4"/> Enable Alerts</>}
        </button>
        <button onClick={() => { clearAllNotifications(); setShowDropdown(false); }} className="w-full p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-bold flex items-center justify-center gap-2 mb-4 active:scale-95">
          <Trash2 className="w-4 h-4" /> Clear Intelligence
        </button>
        <button onClick={() => { setShowBestieSetup(true); setShowDropdown(false); }} className="w-full p-3 bg-pink-500/20 border border-pink-400/50 rounded-lg text-white font-bold flex items-center justify-center gap-2 mb-4 active:scale-95"><Sliders className="w-4 h-4" /> Calibrate Bestie</button>

        {messages.length > 0 && <div className="mb-4 pb-4 border-b border-white/10"><h3 className="text-white font-bold text-sm mb-3">Switch Expert</h3><div className="grid grid-cols-2 gap-2">{getAccessiblePersonas(userTier).slice(0, 6).map(persona => (<button key={persona.id} onClick={() => handlePersonaChange(persona)} className="p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-xs font-bold flex items-center gap-2"><span className="truncate">{persona.serviceLabel.split(' ')[0]}</span></button>))}</div></div>}
        <button onClick={onLogout} className="w-full flex items-center gap-3 text-red-400 p-3 hover:bg-white/5 rounded-lg active:scale-95"><LogOut className="w-4 h-4"/> <span className="font-bold text-sm">Exit OS</span></button>
       </div>
      )}
     </div>
     <div className="text-center flex-1">
      <h1 className="text-white font-black text-xl tracking-[0.2em]">L<span className={getPersonaColorClass(activePersona, 'text')}>Y</span>LO</h1>
      <p className="text-gray-500 text-[8px] uppercase tracking-widest font-bold">{messages.length > 0 ? activePersona.serviceLabel : 'Operating System'}</p>
     </div>
     <div className="flex items-center gap-2">
      {messages.length > 0 ? (
        <button onClick={handleBackToServices} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg active:scale-95 transition-all">
          <div className="w-5 h-5 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </div>
        </button>
      ) : (
        <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/20 border border-red-400 rounded-lg animate-pulse"><Shield className="w-5 h-5 text-red-400" /></button>
      )}
      <div className="text-right">
       <div className="text-white font-bold text-xs uppercase">{userName || 'Owner'}{isEliteUser && <Crown className="w-3 h-3 text-yellow-400 inline ml-1" />}</div>
       <div className="text-[8px] text-gray-400 font-black">SECURE</div>
      </div>
     </div>
    </div>
   </div>

   {/* MAIN CONTENT */}
   <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative p-4" style={{ paddingBottom: '220px' }}>
    {messages.length === 0 ? (
     <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
      {PERSONAS.map(persona => {
        const Icon = persona.icon;
        const hasNotif = notifications.includes(persona.id);
        const isSelected = selectedPersonaId === persona.id;
        return (
          <div key={persona.id} className="relative group">
            <button onClick={() => handlePersonaChange(persona)} className={`w-full p-4 rounded-xl backdrop-blur-xl border transition-all ${getPersonaColorClass(persona, 'glow')} bg-black/50 border-white/10 active:scale-95 min-h-[120px] ${isSelected ? 'scale-105 border-white/40' : ''}`}>
              {hasNotif && <div className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-black z-30 animate-bounce">1</div>}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className={`p-2 rounded-lg bg-black/40 border ${getPersonaColorClass(persona, 'border')}`}><Icon className={`w-6 h-6 ${getPersonaColorClass(persona, 'text')}`} /></div>
                <div><h3 className="font-bold text-xs uppercase text-white">{persona.serviceLabel}</h3><p className="text-[10px] text-gray-400">{persona.description}</p></div>
              </div>
            </button>
          </div>
        );
      })}
      {notifications.length > 0 && (
       <div className="col-span-2 mt-4">
        <button onClick={clearAllNotifications} className="w-full py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 hover:bg-red-500/30 transition-all">
         <Trash2 className="w-4 h-4" /> ACKNOWLEDGE & CLEAR ALL
        </button>
       </div>
      )}
     </div>
    ) : (
      <div className="space-y-4 max-w-2xl mx-auto">
        {messages.map((msg, idx) => {
          const isLatestBot = msg.sender === 'bot' && idx === messages.length - 1;
          const userHistory = messages.filter(m => m.sender === 'user').map(m => m.content).join(' ');
          const suggestion = isLatestBot ? detectExpertSuggestion(userHistory, activePersona.id, PERSONAS) : null;

          return (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-xl border 
              ${msg.sender === 'user' 
                ? `${getPersonaColorClass(activePersona, 'bg')}/20 ${getPersonaColorClass(activePersona, 'border')}/50 text-white shadow-lg` 
                : 'bg-black/40 border-white/10 text-gray-100 shadow-lg'
              }
            `}>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              
              {msg.sender === 'bot' && (
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => {
                    let voiceToUse = activePersona.fixedVoice || 'onyx';
                    if (activePersona.id === 'bestie' && bestieConfig) voiceToUse = bestieConfig.voiceId;
                    speakText(msg.content, voiceToUse);
                  }} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 ${getPersonaColorClass(activePersona, 'bg')} text-white border-white/20 shadow-lg`}>
                    <Volume2 className="w-3 h-3" /> Play Audio
                  </button>
                  {showReplayButton === msg.id && (
                   <button onClick={() => {
                     let voiceToUse = activePersona.fixedVoice || 'onyx';
                     if (activePersona.id === 'bestie' && bestieConfig) voiceToUse = bestieConfig.voiceId;
                     speakText(msg.content, voiceToUse);
                   }} className="p-2 text-gray-400 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
                  )}
                  {msg.confidenceScore && <div className={`text-[10px] font-black uppercase flex items-center gap-1 ${getPersonaColorClass(activePersona, 'text')}`}><Shield className="w-3 h-3"/> {msg.confidenceScore}%</div>}
                </div>
              )}
            </div>

            {/* EXPERT HANDOFF BUTTON */}
            {suggestion && (
              <div className="mt-3 w-full max-w-[85%] p-4 bg-indigo-600 border border-indigo-400 rounded-xl shadow-lg">
                <p className="text-[10px] font-black text-white uppercase mb-2 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-current" /> Expert Handoff Available
                </p>
                <button 
                  onClick={() => handleExpertHandoff(suggestion)} 
                  className="w-full py-3 bg-white text-indigo-600 text-xs font-black uppercase rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
                >
                  Switch to {suggestion.name} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )})}
      </div>
    )}
   </div>

   {/* FOOTER INPUT */}
   <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-3 z-50">
    <div className="max-w-md mx-auto space-y-3">
     <div className="flex items-center justify-between mb-3 gap-2">
      <button onClick={handleWalkieTalkieMic} className={`flex-1 py-3 px-3 rounded-xl font-black text-sm uppercase tracking-wide border-2 transition-all flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl min-h-[50px] ${isRecording ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-gradient-to-b from-gray-600 to-gray-800 text-white border-gray-500 active:scale-95'}`}>
        {isRecording ? <><MicOff className="w-5 h-5"/> STOP & SEND</> : <><Mic className="w-5 h-5"/> START TALKING</>}
      </button>
     </div>
     <div className="flex gap-2 items-end">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) setSelectedImage(e.target.files[0]); }} />
      <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-xl backdrop-blur-xl transition-all active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center ${selectedImage ? 'bg-green-500/20 border border-green-400/30 text-green-400' : 'bg-gray-800/60 text-gray-400 border border-gray-600'}`}><Camera className="w-4 h-4" /></button>
      <div className="flex-1 bg-black/60 rounded-xl border border-white/10 px-3 py-2 backdrop-blur-xl min-h-[40px] flex items-center">
       <input 
        value={input} 
        onChange={e => { setInput(e.target.value); }} 
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
        placeholder={isRecording ? "Listening..." : `Command ${activePersona?.serviceLabel?.split(' ')?.[0] || 'expert'}...`} 
        className="bg-transparent w-full text-white text-base focus:outline-none placeholder-gray-500" 
        style={{ fontSize: '16px' }} 
       />
      </div>
      <button onClick={() => handleSend()} disabled={loading || (!input.trim() && !selectedImage) || isRecording} className={`px-3 py-2 rounded-xl font-black text-sm uppercase tracking-wide transition-all min-w-[60px] min-h-[40px] active:scale-95 ${input.trim() || selectedImage ? `${getPersonaColorClass(activePersona, 'bg')} text-white` : 'bg-gray-800 text-gray-500'}`}>SEND</button>
     </div>
     
     {/* PERMANENT LEGAL DISCLAIMER & VERSIONING */}
     <div className="flex flex-col items-center mt-2 pt-2 border-t border-white/10">
       <div className="w-full flex justify-between items-center mb-1">
         <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO BODYGUARD OS v33.0</p>
         <div className="text-[8px] text-gray-400 uppercase font-bold">{activePersona?.serviceLabel?.split(' ')?.[0] || 'LOADING'} STATUS: ACTIVE</div>
       </div>
       <p className="text-[8px] text-gray-500 text-center leading-tight">
         LYLO AI can make mistakes. This OS provides informational guidance, not official legal, medical, or financial advice. Always verify critical information.
       </p>
     </div>
    </div>
   </div>
  </div>
 );
}

export default ChatInterface;
