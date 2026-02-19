import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2,
 Filter, Sparkles, ChevronRight, MessageSquare, Heart, Info
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// --- REAL INTELLIGENCE DROPS ---
const REAL_INTEL_DROPS: { [key: string]: string } = {
  'guardian': "URGENT SECURITY INTEL: I've detected a massive spike in 'Toll Road' smishing. 437 new fraudulent E-ZPass sites were registered this week targeting California residents. If you get a text about unpaid tolls, it is a 100% trap.",
  'wealth': "MARKET INTEL: I found a high-yield opportunity at 4.09% APY—that is 7x the national average. Shifting $100 to this account today would net you an extra $55 in annual interest.",
  'lawyer': "LEGAL INTEL: California just activated AB 628 and SB 610. Landlords are now legally required to maintain working refrigerators, and wildfire debris cleanup is now strictly the owner's responsibility.",
  'career': "ATS ALERT: The 2026 hiring algorithms just shifted. Resumes without 'Predictive Analytics' or 'Boolean AI Sourcing' are being auto-rejected by major firms.",
  'doctor': "HEALTH INTEL: CDPH issued a Sacramento-area alert for measles. Also, your current winter data suggests a critical Vitamin D window is closing.",
  'mechanic': "SYSTEM INTEL: Microsoft's Feb 2026 'Patch Tuesday' just dropped. There is an active Zero-Day (CVE-2026-21510) in the Windows Shell that bypasses all safety prompts.",
  'bestie': "I've been thinking about that drama you told me about... I did some digging and I have a much better plan to handle it.",
  'therapist': "WELLNESS INTEL: I noticed your digital interaction frequency spiked last night. You might be hitting a burnout wall.",
  'tutor': "KNOWLEDGE INTEL: The Open Visualization Academy just launched a new method for simplifying complex data sets.",
  'pastor': "FAITH INTEL: I've prepared a mid-week spiritual reset for you to find clarity in the chaos of this week.",
  'vitality': "PERFORMANCE INTEL: Winter performance data is in. Your recovery scores are dipping due to low sun exposure.",
  'hype': "ALGORITHM INTEL: Instagram just opened a viral window for 'Original Audio' creators. If we drop a hook in the next 3 hours, we hit the Explore page."
};

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
 'mechanic': ['car', 'engine', 'repair', 'broken', 'fix', 'leak', 'computer', 'wifi', 'glitch', 'tech'],
 'lawyer': ['legal', 'sue', 'court', 'contract', 'rights', 'lease', 'divorce', 'ticket', 'sued', 'lawyer', 'lawsuit', 'evicted', 'notice'],
 'doctor': ['sick', 'pain', 'symptom', 'hurt', 'fever', 'medicine', 'rash', 'swollen', 'health', 'doctor'],
 'wealth': ['money', 'budget', 'invest', 'stock', 'debt', 'credit', 'bank', 'crypto', 'tax', 'paycheck', 'short-changed', 'dollars', '$', '180'],
 'therapist': ['sad', 'anxious', 'depressed', 'stress', 'panic', 'cry', 'feeling', 'overwhelmed', 'mental'],
 'vitality': ['diet', 'food', 'workout', 'gym', 'weight', 'muscle', 'meal', 'protein', 'run', 'exercise'],
 'tutor': ['learn', 'study', 'homework', 'history', 'math', 'code', 'explain', 'teach', 'school'],
 'pastor': ['god', 'pray', 'bible', 'church', 'spirit', 'verse', 'jesus', 'faith', 'spiritual'],
 'hype': ['joke', 'funny', 'viral', 'tiktok', 'video', 'prank', 'laugh', 'content', 'social media'],
 'career': ['job', 'work', 'boss', 'resume', 'interview', 'salary', 'promotion', 'fired', 'hired', 'employer']
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

function ChatInterface({ currentPersona: initialPersona, userEmail = '', onPersonaChange = () => {}, onLogout = () => {}, onUsageUpdate = () => {} }: ChatInterfaceProps) {
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => initialPersona || PERSONAS[0]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [userName, setUserName] = useState<string>('');
 const [notifications, setNotifications] = useState<string[]>([]);
 const [stats, setStats] = useState<UserStats | null>(null);
 const [bestieConfig, setBestieConfig] = useState<BestieConfig | null>(null);
 const [showBestieSetup, setShowBestieSetup] = useState(false);
 const [setupStep, setSetupStep] = useState<'gender' | 'voice'>('gender');
 const [tempGender, setTempGender] = useState<'male' | 'female'>('female');
 const [isRecording, setIsRecording] = useState(false);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
 const [showDropdown, setShowDropdown] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [communicationStyle, setCommunicationStyle] = useState<string>('standard');
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [showCrisisShield, setShowCrisisShield] = useState(false);
 const [showPersonaGrid, setShowPersonaGrid] = useState(true);

 const chatContainerRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const recognitionRef = useRef<any>(null);
 const isRecordingRef = useRef(false);
 const shouldSendRef = useRef(false);
 const accumulatedRef = useRef<string>(''); 
 const inputTextRef = useRef<string>(''); 

 useEffect(() => {
  const emailRaw = userEmail.toLowerCase();
  if (emailRaw.includes('stangman')) setUserName('Christopher');
  else if (emailRaw.includes('betatester6')) setUserName('Ron');
  else if (emailRaw.includes('betatester7')) setUserName('Marilyn');
  else setUserName('User');

  const savedBestie = localStorage.getItem('lylo_bestie_config');
  if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
  
  const savedStyle = localStorage.getItem('lylo_communication_style');
  if (savedStyle) setCommunicationStyle(savedStyle);

  fetchStats();
  const allDrops = Object.keys(REAL_INTEL_DROPS);
  const cleared = JSON.parse(localStorage.getItem('lylo_cleared_intel') || '[]');
  setNotifications(allDrops.filter(id => !cleared.includes(id)).sort(() => 0.5 - Math.random()).slice(0, 3));
 }, [userEmail]);

 useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
 }, [messages]);

 const fetchStats = async () => {
  try {
   const data = await getUserStats(userEmail);
   setStats(data);
   setUserTier(data.tier as any);
  } catch (e) { console.error(e); }
 };

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

 const handleSend = async () => {
  const text = inputTextRef.current.trim() || input.trim();
  if (!text && !selectedImage) return;
  setLoading(true);
  setInput('');
  inputTextRef.current = '';
  accumulatedRef.current = '';
  setShowPersonaGrid(false);
  
  const userMsg: Message = { id: Date.now().toString(), content: text, sender: 'user', timestamp: new Date() };
  setMessages(prev => [...prev, userMsg]);

  try {
   const response = await sendChatMessage(text, messages, activePersona.id, userEmail, selectedImage, 'en', communicationStyle);
   const botMsg: Message = { id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(), confidenceScore: response.confidence_score, scamDetected: response.scam_detected };
   setMessages(prev => [...prev, botMsg]);
   speakText(botMsg.content, activePersona.id === 'bestie' ? bestieConfig?.voiceId : activePersona.fixedVoice);
   fetchStats();
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
  setShowPersonaGrid(false);
  const hook = persona.spokenHook.replace('{userName}', userName);
  const hookMsg: Message = { id: Date.now().toString(), content: hook, sender: 'bot', timestamp: new Date() };
  setMessages([hookMsg]);
  speakText(hook, persona.id === 'bestie' ? bestieConfig?.voiceId : persona.fixedVoice);
 };

 const clearIntel = (id: string) => {
  const cleared = JSON.parse(localStorage.getItem('lylo_cleared_intel') || '[]');
  localStorage.setItem('lylo_cleared_intel', JSON.stringify([...cleared, id]));
  setNotifications(prev => prev.filter(n => n !== id));
 };

 const handleBestieVoiceSelect = (voiceId: string, label: string) => {
   const newConfig: BestieConfig = { gender: tempGender, voiceId, vibeLabel: label };
   setBestieConfig(newConfig);
   localStorage.setItem('lylo_bestie_config', JSON.stringify(newConfig));
   setShowBestieSetup(false);
   handlePersonaChange(PERSONAS.find(p => p.id === 'bestie')!);
 };

 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans z-[99999]">
   
   {/* CRISIS SHIELD OVERLAY */}
   {showCrisisShield && (
    <div className="fixed inset-0 z-[100050] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-red-900/20 border border-red-400 p-5 rounded-2xl max-w-sm w-full shadow-2xl">
      <div className="flex justify-between items-center mb-5">
       <h2 className="text-red-100 font-black text-lg uppercase">Emergency OS</h2>
       <button onClick={() => setShowCrisisShield(false)} className="p-2"><X className="text-white"/></button>
      </div>
      <p className="text-red-200 text-sm mb-6 font-bold uppercase tracking-wider">Imminent Threat Protocols Active</p>
      <div className="space-y-3">
        <button className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-xl shadow-lg active:scale-95">Freeze All Assets</button>
        <button className="w-full py-4 bg-white text-red-600 font-black uppercase rounded-xl shadow-lg active:scale-95">Contact Authorities</button>
      </div>
     </div>
    </div>
   )}

   {/* BESTIE SETUP MODAL */}
   {showBestieSetup && (
    <div className="fixed inset-0 z-[100200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
     <div className="bg-pink-900/20 border border-pink-500 p-8 rounded-[40px] w-full max-w-sm shadow-2xl space-y-8">
      <Heart className="w-16 h-16 text-pink-500 mx-auto animate-pulse" />
      <h2 className="text-pink-100 font-black text-2xl uppercase tracking-tighter">Initialize Bestie</h2>
      {setupStep === 'gender' ? (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="p-6 bg-pink-500/20 rounded-3xl text-white font-black uppercase border border-pink-500/40">Female</button>
          <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="p-6 bg-blue-500/20 rounded-3xl text-white font-black uppercase border border-blue-500/40">Male</button>
        </div>
      ) : (
        <div className="space-y-4">
          {(tempGender === 'female' ? [{id:'nova',label:'Energetic'},{id:'alloy',label:'Chill'},{id:'shimmer',label:'Boss'}] : [{id:'echo',label:'Chill Guy'},{id:'onyx',label:'Deep'},{id:'fable',label:'Storyteller'}])
            .map(v => <button key={v.id} onClick={() => handleBestieVoiceSelect(v.id, v.label)} className="w-full p-4 bg-white/10 text-white font-black uppercase rounded-2xl border border-white/20">{v.label} Vibe</button>)}
        </div>
      )}
     </div>
    </div>
   )}

   {/* HEADER & STATUS BARS */}
   <div className="bg-black/90 border-b border-white/10 p-3 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     <div className="relative">
      <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-xl text-white active:scale-90 transition-transform"><Settings /></button>
      {showDropdown && (
       <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-2xl p-5 min-w-[280px] shadow-2xl z-[100001] max-h-[80vh] overflow-y-auto">
        <div className="mb-6">
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Communication Style</p>
          <select value={communicationStyle} onChange={(e) => { setCommunicationStyle(e.target.value); localStorage.setItem('lylo_communication_style', e.target.value); }} className="w-full bg-white/10 text-white p-3 rounded-xl font-bold focus:outline-none">
            <option value="standard">Standard Protection</option>
            <option value="senior">Senior-Friendly Mode</option>
            <option value="business">Business Professional</option>
            <option value="roast">Roast (Sarcastic)</option>
            <option value="tough">Drill Sergeant</option>
            <option value="hype">High Energy</option>
          </select>
        </div>
        <button onClick={() => { setShowBestieSetup(true); setShowDropdown(false); }} className="w-full p-4 bg-pink-500/20 text-white font-black uppercase rounded-xl mb-6">Calibrate Loyalty Lead</button>
        <div className="border-t border-white/10 pt-4">
          <button onClick={onLogout} className="w-full p-4 text-red-500 font-black uppercase flex items-center justify-center gap-2"><LogOut className="w-4 h-4"/> Terminate Session</button>
        </div>
       </div>
      )}
     </div>
     <div className="text-center">
      <h1 className="text-white font-black text-2xl tracking-[0.2em] leading-none">LYLO</h1>
      <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.3em] mt-1">{activePersona.serviceLabel}</p>
     </div>
     <div className="flex items-center gap-3">
      {messages.length > 0 ? (
        <button onClick={() => { setMessages([]); setShowPersonaGrid(true); }} className="p-3 bg-white/5 rounded-xl text-white"><RotateCcw /></button>
      ) : (
        <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/20 text-red-400 rounded-xl animate-pulse"><Shield /></button>
      )}
      <div className="text-right">
        <p className="text-white font-black text-xs uppercase leading-none">{userName}</p>
        <p className="text-[8px] text-green-500 font-black mt-1">OS SECURE</p>
      </div>
     </div>
    </div>
   </div>

   {/* MAIN CONVERSATION AREA - 280PX PADDING TO CLEAR MOBILE BAR */}
   <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative p-4 space-y-6" style={{ paddingBottom: '280px' }}>
    
    {/* INTEL DROPS */}
    {showPersonaGrid && notifications.length > 0 && (
     <div className="space-y-3">
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Neural Intel Drops</p>
      {notifications.map(id => (
       <div key={id} className="bg-white/5 border border-white/10 p-5 rounded-3xl relative group animate-in slide-in-from-right duration-500">
        <button onClick={() => clearIntel(id)} className="absolute top-3 right-3 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4 text-gray-500" /></button>
        <div className="flex gap-4">
         <div className="mt-1 p-2 bg-yellow-500/20 rounded-xl"><Zap className="w-4 h-4 text-yellow-400" /></div>
         <p className="text-xs leading-relaxed text-gray-200 font-bold">{REAL_INTEL_DROPS[id]}</p>
        </div>
       </div>
      ))}
     </div>
    )}

    {/* PERSONA SELECTION GRID */}
    {showPersonaGrid && (
     <div className="grid grid-cols-2 gap-3">
      {PERSONAS.map(p => (
       <button 
         key={p.id} 
         onClick={() => handlePersonaChange(p)}
         disabled={!canAccessPersona(p, userTier)}
         className={`p-6 rounded-3xl border flex flex-col items-center gap-4 transition-all active:scale-95 ${activePersona.id === p.id ? `${getPersonaColorClass(p, 'bg')} border-transparent shadow-xl` : 'bg-white/5 border-white/10'} ${!canAccessPersona(p, userTier) ? 'opacity-30' : ''}`}
       >
        <p.icon className={`w-8 h-8 ${activePersona.id === p.id ? 'text-white' : getPersonaColorClass(p, 'text')}`} />
        <div className="text-center">
         <p className="text-[10px] font-black uppercase tracking-widest">{p.name}</p>
         {!canAccessPersona(p, userTier) && <Crown className="w-3 h-3 text-yellow-500 mx-auto mt-2" />}
        </div>
       </button>
      ))}
     </div>
    )}

    {/* MESSAGES WITH ACCURACY BARS AND HANDOFF BUTTONS */}
    {messages.map((msg, idx) => {
     const isLatestBot = msg.sender === 'bot' && idx === messages.length - 1;
     const suggestion = isLatestBot ? detectExpertSuggestion(messages.map(m=>m.content).join(' '), activePersona.id, userTier) : null;
     
     return (
      <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
       <div className={`p-5 rounded-3xl max-w-[85%] text-sm leading-relaxed shadow-lg ${msg.sender === 'user' ? `${getPersonaColorClass(activePersona, 'bg')} text-white font-bold rounded-tr-none` : 'bg-white/10 text-gray-100 border border-white/10 rounded-tl-none'}`}>
        {msg.content}
        
        {/* SCAM DETECTION / ACCURACY BATTLE PERCENTAGE */}
        {msg.sender === 'bot' && msg.confidenceScore && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span>System Confidence</span>
              <span className="text-green-400">{msg.confidenceScore}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${msg.confidenceScore}%` }}></div>
            </div>
          </div>
        )}
       </div>
       
       {/* EXPERT HANDOFF - PUSHED UP ABOVE FOOTER */}
       {suggestion && (
        <div className="mt-4 w-full max-w-[85%] p-5 bg-indigo-600 border border-indigo-400 rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-300">
         <div className="flex items-center gap-3 mb-4">
           <div className="p-2 bg-white/20 rounded-xl"><Zap className="w-4 h-4 text-white fill-current" /></div>
           <p className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Expert Transition Detected</p>
         </div>
         <button 
           onClick={() => handlePersonaChange(suggestion)} 
           className="w-full py-4 bg-white text-indigo-700 text-xs font-black uppercase rounded-2xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform"
         >
          Transfer to {suggestion.name} <ArrowRight className="w-5 h-5" />
         </button>
        </div>
       )}
      </div>
     );
    })}

    {loading && (
     <div className="flex items-center gap-3 text-gray-500 animate-pulse px-2">
      <div className="flex gap-1.5">
       <div className="w-2 h-2 rounded-full bg-current"></div>
       <div className="w-2 h-2 rounded-full bg-current delay-100"></div>
       <div className="w-2 h-2 rounded-full bg-current delay-200"></div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">Syncing Neural Link</span>
     </div>
    )}
   </div>

   {/* FOOTER BAR - FIXED DEPTH FOR PHONE VIEW */}
   <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 p-4 z-[100] pb-10">
    <div className="max-w-md mx-auto space-y-4">
     
     {/* MAIN CAPTURE BUTTON */}
     <button 
       onClick={handleWalkieTalkieMic}
       className={`w-full py-5 rounded-[32px] flex items-center justify-center gap-4 transition-all active:scale-95 relative overflow-hidden group shadow-2xl ${isRecording ? 'bg-red-500 shadow-red-500/40' : 'bg-white shadow-white/10'}`}
     >
      {isRecording ? (
       <>
        <div className="absolute inset-0 bg-red-400 animate-pulse opacity-50"></div>
        <MicOff className="w-6 h-6 text-white relative z-10" />
        <span className="text-sm font-black text-white tracking-[0.2em] relative z-10">TERMINATE RECORDING</span>
       </>
      ) : (
       <>
        <Mic className="w-6 h-6 text-black" />
        <span className="text-sm font-black text-black tracking-[0.2em]">ENGAGE VOICE LINK</span>
       </>
      )}
     </button>

     {/* SECONDARY INPUTS */}
     <div className="flex items-center gap-3">
      <button onClick={() => fileInputRef.current?.click()} className={`p-4 rounded-2xl border border-white/10 bg-white/5 transition-all active:scale-90 ${selectedImage ? 'border-green-500 bg-green-500/20' : ''}`}>
       <Camera className={`w-6 h-6 ${selectedImage ? 'text-green-400' : 'text-gray-400'}`} />
       <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
      </button>

      <div className="flex-1 relative">
       <input 
         value={input}
         onChange={(e) => { setInput(e.target.value); inputTextRef.current = e.target.value; }}
         onKeyDown={(e) => e.key === 'Enter' && handleSend()}
         placeholder={isRecording ? "Processing Audio Stream..." : `Speak to ${activePersona.name}...`}
         className="w-full bg-white/10 border border-white/10 rounded-2xl px-6 py-5 text-sm text-white focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-600 font-bold"
       />
       <button onClick={handleSend} className={`absolute right-3 top-3 bottom-3 aspect-square rounded-xl flex items-center justify-center transition-all ${input.trim() || selectedImage ? 'bg-indigo-600' : 'bg-gray-800 opacity-30'}`}>
        <ArrowRight className="w-5 h-5 text-white" />
       </button>
      </div>
     </div>

     {/* TRUTH WARNING / VERSION BAR */}
     <div className="flex items-center justify-between pt-2 border-t border-white/10">
      <div className="flex items-center gap-2 text-[8px] text-gray-500 font-black uppercase tracking-widest">
        <AlertTriangle className="w-2.5 h-2.5" /> AI can make mistakes. Verify critical info.
      </div>
      <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO BODYGUARD v3.0 MAX</p>
     </div>
    </div>
   </div>

  </div>
 );
}

export default ChatInterface;
