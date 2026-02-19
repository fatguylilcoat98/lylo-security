import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// --- DATA: REAL INTELLIGENCE ---
const REAL_INTEL_DROPS: { [key: string]: string } = {
  'guardian': "URGENT SECURITY INTEL: I've detected a massive spike in 'Toll Road' smishing. 437 new fraudulent E-ZPass sites were registered this week targeting California residents. If you get a text about unpaid tolls, it is a 100% trap. Do not click.",
  'wealth': "MARKET INTEL: I found a high-yield opportunity at 4.09% APY—that is 7x the national average. Based on your goals, shifting $100 to this account today would net you an extra $55 in annual interest. Let's move it.",
  'lawyer': "LEGAL INTEL: California just activated AB 628 and SB 610. Landlords are now legally required to maintain working refrigerators, and wildfire debris cleanup is now strictly the owner's responsibility.",
  'career': "ATS ALERT: The 2026 hiring algorithms just shifted. Resumes without 'Predictive Analytics' or 'Boolean AI Sourcing' are being auto-rejected by major firms. We need to update your resume stack.",
  'doctor': "HEALTH INTEL: CDPH issued a Sacramento-area alert for measles. Also, with the current winter cloud cover, your bone-density markers suggest a critical Vitamin D window is closing.",
  'mechanic': "SYSTEM INTEL: Microsoft's Feb 2026 'Patch Tuesday' just dropped. There is an active Zero-Day (CVE-2026-21510) in the Windows Shell that bypasses all safety prompts. We need to patch the kernel.",
  'bestie': "Okay, I've been thinking about that drama you told me about... I did some digging and I have a much better plan to handle it. You're gonna love this.",
  'therapist': "WELLNESS INTEL: I noticed your digital interaction frequency spiked last night. Gen Alpha cultural norms are shifting toward 'Calm/Cozy' aesthetics for a reason—you are hitting a wall.",
  'tutor': "KNOWLEDGE INTEL: The Open Visualization Academy just launched. They have a new method for simplifying complex data sets that is perfect for your current project.",
  'pastor': "FAITH INTEL: In the chaos of this week, remember: 'Peace I leave with you.' I've prepared a mid-week spiritual reset for you to find clarity.",
  'vitality': "PERFORMANCE INTEL: Winter performance data is in. Your recovery scores are dipping due to low sun exposure. We need to implement a 10-minute 'light-stack'.",
  'hype': "ALGORITHM INTEL: Instagram just opened a viral window for 'Original Audio' creators. If we drop a hook in the next 3 hours, we hit the Explore page."
};

// --- TYPES ---
export interface PersonaConfig {
 id: string; name: string; serviceLabel: string; description: string;
 protectiveJob: string; spokenHook: string; briefing: string; color: string;
 requiredTier: 'free' | 'pro' | 'elite' | 'max'; capabilities: string[]; icon: React.ComponentType<any>;
 fixedVoice: string; 
}

interface BestieConfig { gender: 'male' | 'female'; voiceId: string; vibeLabel: string; }

interface ChatInterfaceProps {
 currentPersona?: PersonaConfig; userEmail: string; zoomLevel: number;
 onZoomChange: (zoom: number) => void; onPersonaChange: (persona: PersonaConfig) => void;
 onLogout: () => void; onUsageUpdate?: () => void;
}

// --- PERSONAS ---
const PERSONAS: PersonaConfig[] = [
 { id: 'guardian', name: 'The Guardian', serviceLabel: 'SECURITY LEAD', description: 'Digital Bodyguard', protectiveJob: 'Security Lead', spokenHook: 'Security protocols active. I am monitoring your digital perimeter.', briefing: 'I provide frontline cybersecurity.', color: 'blue', requiredTier: 'free', icon: Shield, capabilities: ['Scam detection', 'Identity protection'], fixedVoice: 'onyx' },
 { id: 'lawyer', name: 'The Lawyer', serviceLabel: 'LEGAL SHIELD', description: 'Justice Partner', protectiveJob: 'Legal Lead', spokenHook: 'Legal shield activated. Before you sign anything, let me review the fine print.', briefing: 'I provide contract review.', color: 'yellow', requiredTier: 'elite', icon: Gavel, capabilities: ['Contract review', 'Tenant rights'], fixedVoice: 'fable' },
 { id: 'doctor', name: 'The Doctor', serviceLabel: 'MEDICAL GUIDE', description: 'Symptom Analyst', protectiveJob: 'Medical Lead', spokenHook: 'Digital MD online. I can translate medical jargon or analyze symptoms.', briefing: 'I provide medical explanation.', color: 'red', requiredTier: 'pro', icon: Activity, capabilities: ['Symptom check', 'Triage'], fixedVoice: 'nova' },
 { id: 'wealth', name: 'The Wealth Architect', serviceLabel: 'FINANCE CHIEF', description: 'Money Strategist', protectiveJob: 'Finance Lead', spokenHook: 'Let’s get your money working for you. ROI is the only metric that matters.', briefing: 'I provide financial planning.', color: 'green', requiredTier: 'elite', icon: CreditCard, capabilities: ['Budgeting', 'Debt destruction'], fixedVoice: 'onyx' },
 { id: 'career', name: 'The Career Strategist', serviceLabel: 'CAREER COACH', description: 'Professional Growth', protectiveJob: 'Career Lead', spokenHook: 'Let’s level up your career. Resume, salary, or office politics—I’m here to help you win.', briefing: 'I provide career growth strategy.', color: 'indigo', requiredTier: 'pro', icon: Briefcase, capabilities: ['Resume optimization', 'Salary negotiation'], fixedVoice: 'shimmer' },
 { id: 'therapist', name: 'The Therapist', serviceLabel: 'MENTAL WELLNESS', description: 'Emotional Anchor', protectiveJob: 'Clinical Lead', spokenHook: 'I’m here to listen. No judgment, just a safe space to process.', briefing: 'I provide CBT support.', color: 'indigo', requiredTier: 'pro', icon: Brain, capabilities: ['Anxiety relief', 'Mood tracking'], fixedVoice: 'alloy' },
 { id: 'mechanic', name: 'The Tech Specialist', serviceLabel: 'MASTER FIXER', description: 'Technical Lead', protectiveJob: 'Technical Lead', spokenHook: 'Technical manual loaded. Tell me the symptoms and I’ll walk you through the fix.', briefing: 'I provide step-by-step repair guides.', color: 'gray', requiredTier: 'pro', icon: Wrench, capabilities: ['Car repair', 'Tech troubleshooting'], fixedVoice: 'echo' },
 { id: 'tutor', name: 'The Master Tutor', serviceLabel: 'KNOWLEDGE BRIDGE', description: 'Education Lead', protectiveJob: 'Education Lead', spokenHook: 'Class is in session. I can break down any subject until it clicks.', briefing: 'I provide academic tutoring.', color: 'purple', requiredTier: 'pro', icon: Zap, capabilities: ['Skill acquisition', 'Simplification'], fixedVoice: 'fable' },
 { id: 'pastor', name: 'The Pastor', serviceLabel: 'FAITH ANCHOR', description: 'Spiritual Lead', protectiveJob: 'Spiritual Lead', spokenHook: 'Peace be with you. I am here for prayer, scripture, and moral clarity.', briefing: 'I provide spiritual counseling.', color: 'gold', requiredTier: 'pro', icon: BookOpen, capabilities: ['Prayer', 'Scripture guidance'], fixedVoice: 'onyx' },
 { id: 'vitality', name: 'The Vitality Coach', serviceLabel: 'HEALTH OPTIMIZER', description: 'Fitness & Food', protectiveJob: 'Wellness Lead', spokenHook: 'Let’s optimize your engine. Fuel and movement—what’s the goal today?', briefing: 'I provide workout and meal plans.', color: 'green', requiredTier: 'max', icon: Activity, capabilities: ['Meal planning', 'Habit building'], fixedVoice: 'nova' },
 { id: 'hype', name: 'The Hype Strategist', serviceLabel: 'CREATIVE DIRECTOR', description: 'Viral Specialist', protectiveJob: 'Creative Lead', spokenHook: 'Let’s make some noise! I’m here for hooks, jokes, and viral strategy.', briefing: 'I provide viral content strategy.', color: 'orange', requiredTier: 'pro', icon: Laugh, capabilities: ['Viral hooks', 'Humor'], fixedVoice: 'shimmer' },
 { id: 'bestie', name: 'The Bestie', serviceLabel: 'RIDE OR DIE', description: 'Inner Circle', protectiveJob: 'Loyalty Lead', spokenHook: 'I’ve got your back, 100%. No filters, no judgment. What’s actually going on?', briefing: 'I provide blunt life advice.', color: 'pink', requiredTier: 'pro', icon: Shield, capabilities: ['Venting space', 'Secret keeping'], fixedVoice: 'nova' }
];

const EXPERT_TRIGGERS: { [key: string]: string[] } = {
 'mechanic': ['car', 'engine', 'repair', 'broken', 'fix', 'leak', 'computer', 'wifi', 'glitch'],
 'lawyer': ['legal', 'sue', 'court', 'contract', 'rights', 'lease', 'divorce', 'ticket', 'evicted', 'notice'],
 'doctor': ['sick', 'pain', 'symptom', 'hurt', 'fever', 'medicine', 'rash', 'swollen'],
 'wealth': ['money', 'budget', 'invest', 'stock', 'debt', 'credit', 'bank', 'crypto', 'tax', 'paycheck', 'short-changed', '180', '$'],
 'therapist': ['sad', 'anxious', 'depressed', 'stress', 'panic', 'cry', 'feeling', 'overwhelmed'],
 'vitality': ['diet', 'food', 'workout', 'gym', 'weight', 'muscle', 'meal', 'protein', 'run'],
 'tutor': ['learn', 'study', 'homework', 'history', 'math', 'code', 'explain', 'teach'],
 'pastor': ['god', 'pray', 'bible', 'church', 'spirit', 'verse', 'jesus', 'faith'],
 'hype': ['joke', 'funny', 'viral', 'tiktok', 'video', 'prank', 'laugh'],
 'career': ['job', 'work', 'boss', 'resume', 'interview', 'salary', 'promotion', 'fired', 'hired']
};

const VIBE_SAMPLES = {
 'standard': "I've analyzed your situation and detected potential security threats.",
 'senior': "Let me explain this step by step in simple terms. This looks like a scam.",
 'business': "• Threat level: HIGH\n• Recommendation: Terminate contact",
 'roast': "Oh honey, this scammer thinks you were born yesterday. Let's roast this fool!",
 'tough': "STOP! Drop everything NOW! This is a CODE RED!",
 'teacher': "Think of scammers like wolves in sheep's clothing...",
 'friend': "Hey bestie! 🛡️ This totally screams scammer vibes.",
 'geek': "Analyzing payload... Implementing countermeasures.",
 'zen': "Take a deep breath. You are safe.",
 'story': "In the shadows of the digital world...",
 'hype': "Yo, this scammer has ZERO rizz! no cap! 🔥"
};

// --- GLOBAL UTILS ---
const canAccessPersona = (persona: PersonaConfig, tier: string) => {
 const tiers: any = { free: 0, pro: 1, elite: 2, max: 3 };
 return (tiers[tier] || 0) >= tiers[persona.requiredTier];
};

const getAccessiblePersonas = (tier: string) => PERSONAS.filter(p => canAccessPersona(p, tier));

const detectExpertSuggestion = (text: string, currentId: string, userTier: string): PersonaConfig | null => {
  const lower = text.toLowerCase();
  for (const [id, keywords] of Object.entries(EXPERT_TRIGGERS)) {
    if (id === currentId) continue;
    if (keywords.some(k => lower.includes(k))) {
      const expert = PERSONAS.find(p => p.id === id);
      if (expert && canAccessPersona(expert, userTier)) return expert;
    }
  }
  return null;
};

const getPersonaColorClass = (persona: PersonaConfig, type: 'border' | 'glow' | 'bg' | 'text' = 'border') => {
 const colorMap: any = {
  blue: { border: 'border-blue-400', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]', bg: 'bg-blue-500', text: 'text-blue-400' },
  orange: { border: 'border-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]', bg: 'bg-orange-500', text: 'text-orange-400' },
  gold: { border: 'border-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]', bg: 'bg-yellow-500', text: 'text-yellow-400' },
  gray: { border: 'border-gray-400', glow: 'shadow-[0_0_20px_rgba(107,114,128,0.3)]', bg: 'bg-gray-500', text: 'text-gray-400' },
  yellow: { border: 'border-yellow-300', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]', bg: 'bg-yellow-400', text: 'text-yellow-300' },
  purple: { border: 'border-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]', bg: 'bg-purple-500', text: 'text-purple-400' },
  indigo: { border: 'border-indigo-400', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]', bg: 'bg-indigo-500', text: 'text-indigo-400' },
  pink: { border: 'border-pink-400', glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)]', bg: 'bg-pink-500', text: 'text-pink-400' },
  red: { border: 'border-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]', bg: 'bg-red-500', text: 'text-red-400' },
  green: { border: 'border-green-400', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]', bg: 'bg-green-500', text: 'text-green-400' }
 };
 return colorMap[persona.color]?.[type] || colorMap.blue[type];
};

// --- COMPONENT ---
function ChatInterface({ currentPersona: initialPersona, userEmail = '', onPersonaChange = () => {}, onLogout = () => {}, onUsageUpdate = () => {} }: ChatInterfaceProps) {
 
 // State
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => initialPersona || PERSONAS[0]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [userName, setUserName] = useState<string>('');
 const [notifications, setNotifications] = useState<string[]>([]);
 const [bestieConfig, setBestieConfig] = useState<BestieConfig | null>(null);
 const [showBestieSetup, setShowBestieSetup] = useState(false);
 const [setupStep, setSetupStep] = useState<'gender' | 'voice'>('gender');
 const [tempGender, setTempGender] = useState<'male' | 'female'>('female');
 const [isRecording, setIsRecording] = useState(false);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
 const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
 const [showDropdown, setShowDropdown] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [communicationStyle, setCommunicationStyle] = useState<string>('standard');
 const [pushEnabled, setPushEnabled] = useState(false);
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [showCrisisShield, setShowCrisisShield] = useState(false);
 const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

 // Refs
 const chatContainerRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const recognitionRef = useRef<any>(null);
 const isRecordingRef = useRef(false);
 const shouldSendRef = useRef(false);
 const accumulatedRef = useRef<string>(''); 
 const inputTextRef = useRef<string>(''); 

 // --- LIFECYCLE ---
 useEffect(() => {
  const init = async () => {
   const emailRaw = userEmail.toLowerCase();
   if (emailRaw.includes('stangman')) setUserName('Christopher');
   else if (emailRaw.includes('betatester6')) setUserName('Ron');
   else if (emailRaw.includes('betatester7')) setUserName('Marilyn');
   else setUserName('User');

   const savedBestie = localStorage.getItem('lylo_bestie_config');
   if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
   
   const savedStyle = localStorage.getItem('lylo_communication_style');
   if (savedStyle) setCommunicationStyle(savedStyle);

   const allDrops = Object.keys(REAL_INTEL_DROPS);
   const cleared = JSON.parse(localStorage.getItem('lylo_cleared_intel') || '[]');
   setNotifications(allDrops.filter(id => !cleared.includes(id)).sort(() => 0.5 - Math.random()).slice(0, 3));
  };
  init();
  return () => { window.speechSynthesis.cancel(); };
 }, [userEmail]);

 // --- AUDIO & MIC ---
 const speakText = async (text: string, voice?: string) => {
  window.speechSynthesis.cancel();
  setIsSpeaking(true);
  try {
   const formData = new FormData();
   formData.append('text', text);
   formData.append('voice', voice || activePersona.fixedVoice || 'onyx');
   const response = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
   const data = await response.json();
   if (data.audio_b64) {
    const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
    audio.onended = () => setIsSpeaking(false);
    await audio.play();
   }
  } catch (e) { setIsSpeaking(false); }
 };

 useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
   const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
   const recognition = new SpeechRecognition();
   recognition.continuous = false; 
   recognition.interimResults = true; 
   recognition.lang = 'en-US';
   
   recognition.onresult = (event: any) => {
    let interim = '', final = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }
    if (final) { accumulatedRef.current += final + ' '; }
    const fullText = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim();
    setInput(fullText);
    inputTextRef.current = fullText;
   };

   recognition.onend = () => {
    if (isRecordingRef.current && !shouldSendRef.current) {
      setTimeout(() => { try { recognition.start(); } catch(e) {} }, 10);
    } else if (shouldSendRef.current) {
      shouldSendRef.current = false;
      if (inputTextRef.current.trim()) handleSend();
    }
   };
   recognitionRef.current = recognition;
  }
 }, []);

 const handleWalkieTalkieMic = () => {
  if (isRecording) {
   isRecordingRef.current = false;
   setIsRecording(false);
   shouldSendRef.current = true;
   recognitionRef.current?.stop();
  } else {
   window.speechSynthesis.cancel();
   setIsRecording(true);
   isRecordingRef.current = true;
   shouldSendRef.current = false;
   setInput('');
   accumulatedRef.current = '';
   inputTextRef.current = '';
   recognitionRef.current?.start();
  }
 };

 // --- ACTIONS ---
 const handleSend = async () => {
  const text = inputTextRef.current.trim() || input.trim();
  if (!text && !selectedImage) return;
  setLoading(true);
  setInput('');
  inputTextRef.current = '';
  accumulatedRef.current = '';
  
  const userMsg: Message = { id: Date.now().toString(), content: text, sender: 'user', timestamp: new Date() };
  setMessages(prev => [...prev, userMsg]);

  try {
   const response = await sendChatMessage(text, messages, activePersona.id, userEmail, selectedImage, 'en', communicationStyle);
   const botMsg: Message = { id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(), confidenceScore: response.confidence_score };
   setMessages(prev => [...prev, botMsg]);
   speakText(botMsg.content, activePersona.id === 'bestie' ? bestieConfig?.voiceId : activePersona.fixedVoice);
   onUsageUpdate();
  } catch (e) { console.error(e); } 
  finally { setLoading(false); setSelectedImage(null); }
 };

 const handlePersonaChange = (persona: PersonaConfig) => {
  if (persona.id === 'bestie' && !bestieConfig) { setTempGender('female'); setSetupStep('gender'); setShowBestieSetup(true); return; }
  window.speechSynthesis.cancel();
  setActivePersona(persona);
  onPersonaChange(persona);
  setShowDropdown(false);
  const hook = persona.spokenHook.replace('{userName}', userName);
  const hookMsg: Message = { id: Date.now().toString(), content: hook, sender: 'bot', timestamp: new Date() };
  setMessages([hookMsg]);
  speakText(hook, persona.id === 'bestie' ? bestieConfig?.voiceId : persona.fixedVoice);
 };

 const handleBestieVoiceSelect = (voiceId: string, label: string) => {
   const newConfig: BestieConfig = { gender: tempGender, voiceId, vibeLabel: label };
   setBestieConfig(newConfig);
   localStorage.setItem('lylo_bestie_config', JSON.stringify(newConfig));
   setShowBestieSetup(false);
   handlePersonaChange(PERSONAS.find(p => p.id === 'bestie')!);
 };

 // --- RENDER ---
 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans z-[99999]">
   
   {/* CRISIS SHIELD */}
   {showCrisisShield && (
    <div className="fixed inset-0 z-[100050] bg-black/95 flex items-center justify-center p-4">
     <div className="bg-red-900/20 border border-red-400 p-5 rounded-xl max-w-sm w-full text-center">
      <button onClick={() => setShowCrisisShield(false)} className="float-right"><X className="text-white"/></button>
      <h2 className="text-red-100 font-black text-lg uppercase mb-4">Emergency Protocol</h2>
      <p className="text-red-200 text-sm mb-6">Security breach or imminent threat detected? Freeze all active bank cards now.</p>
      <button className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-lg">Notify Emergency Contact</button>
     </div>
    </div>
   )}

   {/* BESTIE SETUP */}
   {showBestieSetup && (
    <div className="fixed inset-0 z-[100200] bg-black/95 flex items-center justify-center p-4">
     <div className="bg-pink-900/20 border border-pink-500 p-6 rounded-xl max-w-sm w-full">
      <h2 className="text-pink-100 font-black text-xl mb-4 text-center uppercase">Bestie Calibration</h2>
      {setupStep === 'gender' ? (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="p-4 bg-pink-500/20 rounded-xl text-white font-bold">Female</button>
          <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="p-4 bg-blue-500/20 rounded-xl text-white font-bold">Male</button>
        </div>
      ) : (
        <div className="space-y-3">
          {(tempGender === 'female' ? [{id:'nova',label:'Energetic'},{id:'alloy',label:'Chill'}] : [{id:'echo',label:'Chill Guy'},{id:'onyx',label:'Deep'}])
            .map(v => <button key={v.id} onClick={() => handleBestieVoiceSelect(v.id, v.label)} className="w-full p-3 bg-white/10 text-white rounded-lg">{v.label} Vibe</button>)}
        </div>
      )}
     </div>
    </div>
   )}

   {/* HEADER */}
   <div className="bg-black/90 border-b border-white/10 p-2 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     <div className="relative">
      <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-lg text-white"><Settings /></button>
      {showDropdown && (
       <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-xl p-4 min-w-[250px] shadow-2xl z-[100001] max-h-[70vh] overflow-y-auto">
        <button onClick={() => { setShowBestieSetup(true); setShowDropdown(false); }} className="w-full p-3 bg-pink-500/20 text-white font-bold rounded-lg mb-4">Calibrate Bestie</button>
        <div className="mb-4">
          <p className="text-[10px] text-gray-500 uppercase font-black mb-2">Comms Style</p>
          <select value={communicationStyle} onChange={(e) => setCommunicationStyle(e.target.value)} className="w-full bg-white/5 text-white p-2 rounded">
            <option value="standard">Standard</option><option value="roast">Roast</option><option value="hype">Hype</option>
          </select>
        </div>
        <button onClick={onLogout} className="w-full p-3 text-red-400 font-bold border border-red-400/20 rounded-lg">Exit OS</button>
       </div>
      )}
     </div>
     <div className="text-center">
      <h1 className="text-white font-black text-xl tracking-widest">LYLO</h1>
      <p className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">{activePersona.serviceLabel}</p>
     </div>
     <div className="flex gap-2">
      {messages.length > 0 ? (
        <button onClick={() => setMessages([])} className="p-3 bg-white/5 rounded-lg text-white"><RotateCcw /></button>
      ) : (
        <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/20 text-red-400 rounded-lg"><Shield /></button>
      )}
     </div>
    </div>
   </div>

   {/* MAIN CONVERSATION AREA - FIXED PADDING FOR MOBILE */}
   <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative p-4 space-y-4" style={{ paddingBottom: '280px' }}>
    {messages.length === 0 ? (
     <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
      {PERSONAS.map(p => (
       <button key={p.id} onClick={() => handlePersonaChange(p)} className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-2">
        <p.icon className={`w-6 h-6 ${getPersonaColorClass(p, 'text')}`} />
        <span className="text-[9px] text-white font-black uppercase">{p.name}</span>
       </button>
      ))}
     </div>
    ) : (
      <div className="max-w-2xl mx-auto space-y-6">
        {messages.map((msg, idx) => {
          const isLatestBot = msg.sender === 'bot' && idx === messages.length - 1;
          const suggestion = isLatestBot ? detectExpertSuggestion(messages.map(m=>m.content).join(' '), activePersona.id, userTier) : null;
          return (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${msg.sender === 'user' ? `${getPersonaColorClass(activePersona, 'bg')} text-white font-bold` : 'bg-white/10 text-gray-100 border border-white/10'}`}>
                {msg.content}
              </div>
              
              {suggestion && (
                <div className="mt-3 w-full max-w-[85%] p-4 bg-indigo-600 border border-indigo-400 rounded-2xl shadow-xl">
                  <p className="text-[10px] font-black text-white uppercase mb-2 flex items-center gap-2"><Zap className="w-3 h-3 fill-current"/> Expert Transition Ready</p>
                  <button onClick={() => handlePersonaChange(suggestion)} className="w-full py-3 bg-white text-indigo-700 text-[11px] font-black uppercase rounded-xl flex items-center justify-center gap-2">
                    Switch to {suggestion.name} <ArrowRight className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
   </div>

   {/* FOOTER BAR - FIXED DEPTH FOR PHONE VIEW */}
   <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 p-3 z-[100] pb-10">
    <div className="max-w-md mx-auto space-y-3">
     <button onClick={handleWalkieTalkieMic} className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-black'}`}>
      {isRecording ? <><MicOff /> Stop & Send</> : <><Mic /> Start Talking</>}
     </button>
     <div className="flex gap-2">
      <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/10 rounded-xl text-gray-400"><Camera /></button>
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => setSelectedImage(e.target.files?.[0] || null)} />
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
       <input 
         value={input} 
         onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }} 
         placeholder={`Speak to ${activePersona.name}...`} 
         className="bg-transparent w-full text-white text-sm outline-none" 
       />
      </div>
      <button onClick={handleSend} className="bg-indigo-600 text-white p-3 rounded-xl"><ArrowRight /></button>
     </div>
    </div>
   </div>

  </div>
 );
}

export default ChatInterface;
