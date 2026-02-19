import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// --- REAL INTELLIGENCE DATA (Feb 18, 2026 Mission-Critical Drops) ---
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

// --- DATA: THE 12-SEAT BOARD OF DIRECTORS (LOCKED VOICES) ---
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

const EXPERT_TRIGGERS = {
 'mechanic': ['car', 'engine', 'repair', 'broken', 'fix', 'leak', 'computer', 'wifi', 'glitch'],
 'lawyer': ['legal', 'sue', 'court', 'contract', 'rights', 'lease', 'divorce', 'ticket'],
 'doctor': ['sick', 'pain', 'symptom', 'hurt', 'fever', 'medicine', 'rash', 'swollen'],
 'wealth': ['money', 'budget', 'invest', 'stock', 'debt', 'credit', 'bank', 'crypto', 'tax'],
 'therapist': ['sad', 'anxious', 'depressed', 'stress', 'panic', 'cry', 'feeling', 'overwhelmed'],
 'vitality': ['diet', 'food', 'workout', 'gym', 'weight', 'muscle', 'meal', 'protein', 'run'],
 'tutor': ['learn', 'study', 'homework', 'history', 'math', 'code', 'explain', 'teach'],
 'pastor': ['god', 'pray', 'bible', 'church', 'spirit', 'verse', 'jesus', 'faith'],
 'hype': ['joke', 'funny', 'viral', 'tiktok', 'video', 'prank', 'laugh', 'content'],
 'bestie': ['lonely', 'friend', 'secret', 'vent', 'annoyed', 'drama', 'date', 'relationship'],
 'career': ['job', 'work', 'boss', 'resume', 'interview', 'salary', 'promotion', 'fired', 'hired']
};

const CONFIDENCE_THRESHOLDS = {
 'guardian': 70, 'lawyer': 85, 'doctor': 85, 'wealth': 85, 'therapist': 85, 'mechanic': 85, 'tutor': 85, 'pastor': 85, 'vitality': 85, 'hype': 75, 'bestie': 70, 'career': 85
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

const getPrivacyShieldClass = (persona: PersonaConfig, loading: boolean, messages: Message[]) => {
 if (loading) return 'border-yellow-400 shadow-[0_0_15px_rgba(255,191,0,0.4)] animate-pulse';
 const lastBotMsg = [...messages].reverse().find(m => m.sender === 'bot');
 if (lastBotMsg?.scamDetected) return 'border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse';
 return getPersonaColorClass(persona, 'border') + ' ' + getPersonaColorClass(persona, 'glow');
};

const canAccessPersona = (persona: PersonaConfig, tier: string) => {
 const tiers: any = { free: 0, pro: 1, elite: 2, max: 3 };
 return tiers[tier] >= tiers[persona.requiredTier];
};

const detectExpertSuggestion = (message: string, currentPersona: string, confidenceScore: number, userTier: string): PersonaConfig | null => {
 const lowerMessage = message.toLowerCase();
 const threshold = 80;
 if (confidenceScore >= threshold) return null;
 
 for (const [expertId, keywords] of Object.entries(EXPERT_TRIGGERS)) {
  if (expertId === currentPersona) continue;
  const hasKeyword = keywords.some(keyword => lowerMessage.includes(keyword));
  if (hasKeyword) {
   const expert = PERSONAS.find(p => p.id === expertId);
   if (expert && canAccessPersona(expert, userTier)) return expert;
  }
 }
 return null;
};

const getAccessiblePersonas = (tier: string) => PERSONAS.filter(p => canAccessPersona(p, tier));

function ChatInterface({ currentPersona: initialPersona, userEmail = '', zoomLevel = 100, onZoomChange = () => {}, onPersonaChange = () => {}, onLogout = () => {}, onUsageUpdate = () => {} }: ChatInterfaceProps) {
 
 // State
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => initialPersona || PERSONAS[0]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [userName, setUserName] = useState<string>('');
 const [intelligenceSync, setIntelligenceSync] = useState(0);
 const [notifications, setNotifications] = useState<string[]>([]);
 const [bestieConfig, setBestieConfig] = useState<BestieConfig | null>(null);
 const [showBestieSetup, setShowBestieSetup] = useState(false);
 const [setupStep, setSetupStep] = useState<'gender' | 'voice'>('gender');
 const [tempGender, setTempGender] = useState<'male' | 'female'>('female');
 const [isRecording, setIsRecording] = useState(false);
 const [autoTTS, setAutoTTS] = useState(true);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
 const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
 const [showDropdown, setShowDropdown] = useState(false);
 const [showUserDetails, setShowUserDetails] = useState(false);
 const [userStats, setUserStats] = useState<UserStats | null>(null);
 const [micSupported, setMicSupported] = useState(false);
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [showCrisisShield, setShowCrisisShield] = useState(false);
 const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
 const [communicationStyle, setCommunicationStyle] = useState<string>('standard');
 const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
 const [pushEnabled, setPushEnabled] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [isEliteUser, setIsEliteUser] = useState(true);
 const [showKnowMore, setShowKnowMore] = useState<string | null>(null);
 const [suggestedExperts, setSuggestedExperts] = useState<{[messageId: string]: PersonaConfig}>({});
 
 // Refs
 const chatContainerRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLTextAreaElement>(null);
 const recognitionRef = useRef<any>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 
 // STUTTER-FREE MIC REFS
 const isRecordingRef = useRef(false);
 const transcriptRef = useRef<string>(''); 
 const accumulatedRef = useRef<string>(''); 
 const inputTextRef = useRef<string>(''); // Absolute Truth for sending

 // --- NOTIFICATION ENGINE ---
 const setupNotifications = async () => {
  if (!('Notification' in window)) return;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setPushEnabled(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error(err));
    }
  }
 };

 const sendPushAlert = (title: string, body: string) => {
   if (!pushEnabled) return;
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.ready.then(registration => {
       const options: any = { body, icon: '/logo192.png', vibrate: [200, 100, 200] };
       registration.showNotification(title, options);
     });
   }
 };

 const clearAllNotifications = () => {
   setNotifications([]);
   localStorage.setItem('lylo_cleared_intel', JSON.stringify(Object.keys(REAL_INTEL_DROPS)));
 };

 useEffect(() => { if (initialPersona) setActivePersona(initialPersona); }, [initialPersona]);

 // --- RANDOMIZER INIT ---
 useEffect(() => {
  const init = async () => {
   const emailRaw = (localStorage.getItem('lylo_user_email') || userEmail).toLowerCase();
   
   if (emailRaw.includes('stangman')) setUserName('Christopher');
   else if (emailRaw.includes('betatester6')) setUserName('Ron');
   else if (emailRaw.includes('betatester7')) setUserName('Marilyn');
   else setUserName(localStorage.getItem('lylo_user_name') || 'User');

   const savedBestie = localStorage.getItem('lylo_bestie_config');
   if (savedBestie) setBestieConfig(JSON.parse(savedBestie));

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
  return () => { window.speechSynthesis.cancel(); };
 }, [userEmail]);

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

 // Audio
 const quickStopAllAudio = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); setPreviewPlayingId(null); };

 const speakText = async (text: string, messageId?: string, voiceSettings?: { voice: string; rate: number; pitch: number }) => {
  if (!autoTTS) return;
  quickStopAllAudio();
  setIsSpeaking(true);
  if (messageId) { setShowReplayButton(messageId); setTimeout(() => setShowReplayButton(null), 5000); }
  
  let assignedVoice = { voice: activePersona.fixedVoice || 'onyx', rate: 1.0, pitch: 1.0 };
  if (activePersona.id === 'bestie' && bestieConfig) { assignedVoice = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 }; } 
  else if (voiceSettings) { assignedVoice = voiceSettings; }

  try {
   const formData = new FormData();
   formData.append('text', text);
   formData.append('voice', assignedVoice.voice);
   const response = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
   const data = await response.json();
   if (data.audio_b64) {
    const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
    audio.onended = () => { setIsSpeaking(false); setPreviewPlayingId(null); }
    await audio.play();
    return;
   }
  } catch (e) { 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = assignedVoice.rate;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }
 };

 const speakChunksSequentially = (chunks: string[], index: number, voiceSettings?: { voice: string; rate: number; pitch: number }) => {
  if (index >= chunks.length) { setIsSpeaking(false); setPreviewPlayingId(null); return; }
  const utterance = new SpeechSynthesisUtterance(chunks[index]);
  utterance.rate = voiceSettings?.rate || 1.0;
  utterance.pitch = voiceSettings?.pitch || 1.0;
  utterance.onend = () => speakChunksSequentially(chunks, index + 1, voiceSettings);
  window.speechSynthesis.speak(utterance);
 };

 // --- STUTTER-FREE INFINITE RECORDING ENGINE ---
 useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
   const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
   const recognition = new SpeechRecognition();
   recognition.continuous = true; 
   recognition.interimResults = true; 
   recognition.lang = 'en-US';
   
   recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    
    // Master Buffer: Lock in completed sentences immediately
    if (final) { accumulatedRef.current += final + ' '; }
    
    const fullText = (accumulatedRef.current + interim).replace(/\s+/g, ' ');
    setInput(fullText); // For UI
    inputTextRef.current = fullText; // Absolute Truth for Sending
   };

   // If the OS tries to kill it, ignore errors that aren't hard failures
   recognition.onerror = (event: any) => {
     if (event.error === 'not-allowed' || event.error === 'audio-capture') {
       setIsRecording(false);
       isRecordingRef.current = false;
     }
   };

   recognition.onend = () => {
    // If the user DID NOT click stop, force the mic back on seamlessly
    if (isRecordingRef.current) {
      setTimeout(() => {
        try { recognition.start(); } catch(e) {}
      }, 10);
    }
   };
   
   recognitionRef.current = recognition;
   setMicSupported(true);
  }
 }, []);

 const handleWalkieTalkieMic = () => {
  if (!micSupported) return alert('Mic not supported');
  
  if (isRecording) {
   // 1. STOP COMMAND
   isRecordingRef.current = false; // Kills the auto-restart loop
   setIsRecording(false);
   if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} }
   
   // 2. SEND COMMAND (Reads from absolute truth ref to prevent dropped words)
   if (inputTextRef.current.trim().length > 0) {
     handleSend(); 
   }
   
  } else {
   // START COMMAND
   quickStopAllAudio();
   setIsRecording(true);
   isRecordingRef.current = true;
   setInput('');
   accumulatedRef.current = '';
   inputTextRef.current = '';
   if (recognitionRef.current) { try { recognitionRef.current.start(); } catch(e) {} }
  }
 };

 // --- PERSONA CHANGE ---
 const handlePersonaChange = async (persona: PersonaConfig) => {
  if (!canAccessPersona(persona, userTier)) { speakText('Upgrade required.'); return; }
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
    let voiceToUse = { voice: persona.fixedVoice || 'onyx', rate: 1.0, pitch: 1.0 };
    if (persona.id === 'bestie' && bestieConfig) voiceToUse = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 };
    speakText(hookContent, undefined, voiceToUse);
  }
  
  setTimeout(() => { setActivePersona(persona); onPersonaChange(persona); setSelectedPersonaId(null); }, 300);
 };

 const handlePreviewAudio = (e: React.MouseEvent, persona: PersonaConfig) => {
  e.stopPropagation();
  if (previewPlayingId === persona.id) { quickStopAllAudio(); return; }
  quickStopAllAudio();
  setPreviewPlayingId(persona.id);
  let voiceSettings = { voice: persona.fixedVoice || 'onyx', rate: 1.0, pitch: 1.0 };
  if (persona.id === 'bestie' && bestieConfig) voiceSettings = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 };
  speakText(persona.spokenHook.replace('{userName}', userName || 'user'), undefined, voiceSettings);
 };

 const handleBestieVoiceSelect = (voiceId: string, label: string) => {
   const newConfig: BestieConfig = { gender: tempGender, voiceId, vibeLabel: label };
   setBestieConfig(newConfig);
   localStorage.setItem('lylo_bestie_config', JSON.stringify(newConfig));
   setShowBestieSetup(false);
   const bestiePersona = PERSONAS.find(p => p.id === 'bestie');
   if (bestiePersona) handlePersonaChange(bestiePersona);
 };

 const FEMALE_VOICES = [{ id: 'nova', label: 'Energetic' }, { id: 'alloy', label: 'Chill' }, { id: 'shimmer', label: 'Boss' }];
 const MALE_VOICES = [{ id: 'echo', label: 'Chill Guy' }, { id: 'onyx', label: 'Deep Voice' }, { id: 'fable', label: 'Storyteller' }];

 // Message Send
 const handleSend = async () => {
  const text = inputTextRef.current.trim() || input.trim();
  if (!text && !selectedImage) return;
  quickStopAllAudio(); 
  setLoading(true); 
  
  // Wipe inputs
  setInput('');
  inputTextRef.current = '';
  accumulatedRef.current = '';
  
  const userMsg: Message = { id: Date.now().toString(), content: text, sender: 'user', timestamp: new Date() };
  setMessages(prev => [...prev, userMsg]);
  try {
   const response = await sendChatMessage(text, [], activePersona.id, userEmail, selectedImage, 'en', communicationStyle);
   const botMsg: Message = { id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(), confidenceScore: response.confidence_score, scamDetected: response.scam_detected };
   setMessages(prev => [...prev, botMsg]);
   
   let voiceToUse = { voice: activePersona.fixedVoice || 'onyx', rate: 1.0, pitch: 1.0 };
   if (activePersona.id === 'bestie' && bestieConfig) voiceToUse = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 };
   speakText(botMsg.content, botMsg.id, voiceToUse);
   
  } catch (e) { console.error(e); } 
  finally { setLoading(false); setSelectedImage(null); }
 };

 const handleBackToServices = () => { quickStopAllAudio(); setMessages([]); setInput(''); inputTextRef.current = ''; accumulatedRef.current = ''; setSelectedImage(null); };
 const handleReplay = (messageContent: string, messageId?: string) => { quickStopAllAudio(); speakText(messageContent, messageId); };
 const handleQuickPersonaSwitch = (persona: PersonaConfig) => { if (canAccessPersona(persona, userTier)) { quickStopAllAudio(); setActivePersona(persona); onPersonaChange(persona); setShowDropdown(false); } };

 const handleGetFullGuide = async () => {
  if (!isEliteUser) return alert('Elite access required.');
  setLoading(true);
  try {
   const response = await fetch(`${API_URL}/scam-recovery/${userEmail}`);
   if (response.ok) { alert('Guide loaded.'); speakText('Guide activated.'); }
  } catch (e) { console.error(e); } finally { setLoading(false); setShowCrisisShield(false); }
 };

 // --- RENDER UI ---
 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans" style={{ zIndex: 99999 }}>
   
   {/* CRISIS OVERLAY */}
   {showCrisisShield && (
    <div className="fixed inset-0 z-[100050] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-red-900/20 border border-red-400/50 rounded-xl p-5 max-w-sm w-full shadow-2xl">
      <div className="flex justify-between items-center mb-5">
       <h2 className="text-red-100 font-black text-lg uppercase">Emergency OS</h2>
       <button onClick={() => setShowCrisisShield(false)} className="p-2"><X className="text-white" /></button>
      </div>
      <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4 text-center">
       <h3 className="text-red-200 font-bold mb-3 flex items-center gap-2"><AlertTriangle /> STOP PAYMENTS</h3>
       <p className="text-red-100 text-sm">Call your bank immediately. Report unauthorized access.</p>
       {isEliteUser && <button onClick={handleGetFullGuide} className="w-full mt-4 py-3 bg-yellow-500 rounded-lg text-black font-black uppercase">Activate Legal Shield</button>}
      </div>
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
          {(tempGender === 'female' ? FEMALE_VOICES : MALE_VOICES).map((voice) => (
            <div key={voice.id} className="flex items-center gap-2">
                <button onClick={() => speakText("Vibe check.", undefined, { voice: voice.id, rate: 1.0, pitch: 1.0 })} className="p-3 bg-pink-500/20 border border-pink-400/50 text-white"><PlayCircle className="w-5 h-5" /></button>
                <button onClick={() => handleBestieVoiceSelect(voice.id, voice.label)} className="flex-1 p-3 bg-black/40 border border-white/10 hover:border-pink-400 font-bold text-white">{voice.label} Vibe</button>
            </div>
          ))}
        </div>
      )}
     </div>
    </div>
   )}

   {/* HEADER */}
   <div className="bg-black/90 border-b border-white/10 p-2 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     <div className="relative">
      <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-lg active:scale-95 transition-all"><Settings className="w-5 h-5 text-white" /></button>
      {showDropdown && (
       <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-xl p-4 min-w-[250px] shadow-2xl z-[100001]">
        <button onClick={() => { setupNotifications(); setShowDropdown(false); }} className={`w-full p-3 ${pushEnabled ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-blue-500/10 border-blue-400/30 text-blue-400'} border rounded-lg font-bold flex items-center justify-center gap-2 mb-4 active:scale-95`}>
          {pushEnabled ? <><CheckCircle className="w-4 h-4"/> Alerts Active</> : <><Bell className="w-4 h-4"/> Enable Alerts</>}
        </button>
        <button onClick={() => { clearAllNotifications(); setShowDropdown(false); }} className="w-full p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-bold flex items-center justify-center gap-2 mb-4 active:scale-95">
          <Trash2 className="w-4 h-4" /> Clear Intelligence
        </button>
        <button onClick={() => { setShowBestieSetup(true); setShowDropdown(false); }} className="w-full p-3 bg-pink-500/20 border border-pink-400/50 rounded-lg text-white font-bold flex items-center justify-center gap-2 mb-4 active:scale-95"><Sliders className="w-4 h-4" /> Calibrate Bestie</button>
        {messages.length > 0 && <div className="mb-4 pb-4 border-b border-white/10"><h3 className="text-white font-bold text-sm mb-3">Switch Expert</h3><div className="grid grid-cols-2 gap-2">{getAccessiblePersonas(userTier).slice(0, 6).map(persona => (<button key={persona.id} onClick={() => handleQuickPersonaSwitch(persona)} className="p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-xs font-bold flex items-center gap-2"><span className="truncate">{persona.serviceLabel.split(' ')[0]}</span></button>))}</div></div>}
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
   <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative p-4" style={{ paddingBottom: '350px' }}>
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
            <button onClick={(e) => handlePreviewAudio(e, persona)} className="absolute bottom-2 right-2 px-2 py-1 rounded-full border border-white/10 text-[8px] font-bold text-gray-400 hover:bg-white hover:text-black">PREVIEW</button>
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
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-xl border 
              ${msg.sender === 'user' 
                ? `${getPersonaColorClass(activePersona, 'bg')}/20 ${getPersonaColorClass(activePersona, 'border')}/50 text-white shadow-lg` 
                : 'bg-black/40 border-white/10 text-gray-100 shadow-lg'
              }
            `}>
              <div className="text-base leading-relaxed">{msg.content}</div>
              {msg.sender === 'bot' && (
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => speakText(msg.content)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 ${getPersonaColorClass(activePersona, 'bg')} text-white border-white/20 shadow-lg`}>
                    <Volume2 className="w-3 h-3" /> Play Audio
                  </button>
                  {msg.confidenceScore && <div className="text-[10px] font-black uppercase text-green-400 flex items-center gap-1"><Shield className="w-3 h-3"/> {msg.confidenceScore}%</div>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
   </div>

   {/* FOOTER */}
   <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-3 z-50">
    <div className="max-w-md mx-auto space-y-3">
     <div className="flex items-center justify-between mb-3 gap-2">
      <button onClick={handleWalkieTalkieMic} className={`flex-1 py-3 px-3 rounded-xl font-black text-sm uppercase tracking-wide border-2 transition-all flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl min-h-[50px] ${isRecording ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-gradient-to-b from-gray-600 to-gray-800 text-white border-gray-500 active:scale-95'}`}>{isRecording ? <><MicOff className="w-5 h-5"/> STOP & SEND</> : <><Mic className="w-5 h-5"/> START TALKING</>}</button>
     </div>
     <div className="flex gap-2 items-end">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) setSelectedImage(e.target.files[0]); }} />
      <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-xl backdrop-blur-xl transition-all active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center ${selectedImage ? 'bg-green-500/20 border border-green-400/30 text-green-400' : 'bg-gray-800/60 text-gray-400 border border-gray-600'}`}><Camera className="w-4 h-4" /></button>
      <div className="flex-1 bg-black/60 rounded-xl border border-white/10 px-3 py-2 backdrop-blur-xl min-h-[40px] flex items-center">
       <input 
        value={input} 
        onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }} 
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
        placeholder={isRecording ? "Listening..." : `Command ${activePersona?.serviceLabel?.split(' ')?.[0] || 'expert'}...`} 
        className="bg-transparent w-full text-white text-base focus:outline-none placeholder-gray-500" 
        style={{ fontSize: '16px' }} 
       />
      </div>
      <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedImage) || isRecording} className={`px-3 py-2 rounded-xl font-black text-sm uppercase tracking-wide transition-all min-w-[60px] min-h-[40px] active:scale-95 ${input.trim() || selectedImage ? `${getPersonaColorClass(activePersona, 'bg')} text-white` : 'bg-gray-800 text-gray-500'}`}>SEND</button>
     </div>
     <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10"><p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO BODYGUARD OS v28.0</p><div className="text-[8px] text-gray-400 uppercase font-bold">{activePersona?.serviceLabel?.split(' ')?.[0] || 'LOADING'} STATUS: ACTIVE</div></div>
    </div>
   </div>
  </div>
 );
}

export default ChatInterface;
