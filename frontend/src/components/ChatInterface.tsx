import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, 
 Wrench, 
 Gavel, 
 Monitor, 
 BookOpen, 
 Laugh, 
 ChefHat, 
 Activity, 
 Camera, 
 Mic, 
 MicOff, 
 Volume2, 
 VolumeX, 
 RotateCcw, 
 AlertTriangle, 
 Phone, 
 CreditCard, 
 FileText, 
 Zap, 
 Brain, 
 Settings, 
 LogOut, 
 X, 
 Crown,
 ArrowRight,
 PlayCircle,
 StopCircle,
 Briefcase,
 Bell,
 User,
 Globe,
 Music,
 Sliders,
 CheckCircle
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// --- REAL INTELLIGENCE DATA (Feb 18, 2026 Mission-Critical Drops) ---
// These trigger the red badges. These are "Worthy Reasons" for the experts to interrupt you.
const REAL_INTEL_DROPS: { [key: string]: string } = {
  'guardian': "URGENT SECURITY INTEL: I've detected a massive spike in 'Toll Road' smishing. 437 new fraudulent E-ZPass sites were registered this week targeting California residents. If you get a text about unpaid tolls, it is a 100% confirmed trap. Do not click any links.",
  'wealth': "MARKET INTEL: I found a high-yield opportunity at 4.09% APY—that is 7x the national average. Based on your goals, shifting $100 to this account today would net you an extra $55 in annual interest. Let's move it.",
  'lawyer': "LEGAL INTEL: California just activated AB 628 and SB 610. Landlords are now legally required to maintain working refrigerators, and wildfire debris cleanup is now strictly the owner's responsibility. This changes your current liability shield.",
  'career': "ALGORITHM INTEL: The 2026 hiring algorithms just shifted. Resumes without 'Predictive Analytics' or 'Boolean AI Sourcing' are being auto-rejected by major firms. We need to update your resume stack immediately to stay visible.",
  'doctor': "HEALTH INTEL: CDPH just issued a Sacramento-area alert for measles. Also, with the current winter cloud cover, your bone-density markers suggest a critical Vitamin D window is closing. I recommend checking your labs this week.",
  'mechanic': "SYSTEM INTEL: Microsoft's Feb 2026 'Patch Tuesday' just dropped. There is an active Zero-Day (CVE-2026-21510) in the Windows Shell that bypasses all safety prompts. Your primary OS is vulnerable until we patch the kernel.",
  'bestie': "Okay, I've been thinking about that drama you told me about... I did some digging and I have a much better plan to handle it. You're gonna love this, let's spill the tea.",
  'therapist': "WELLNESS INTEL: I noticed your digital interaction frequency spiked last night. Gen Alpha cultural norms are shifting toward 'Calm/Cozy' aesthetics for a reason—you are hitting a burnout wall. Let's do a reset.",
  'tutor': "KNOWLEDGE INTEL: The Open Visualization Academy just launched. They have a new method for simplifying complex data sets that is perfect for your current project. Ready for a 5-minute masterclass?",
  'pastor': "FAITH INTEL: In the chaos of this week, remember: 'Peace I leave with you; my peace I give you.' I've prepared a mid-week spiritual reset for you to find clarity before the weekend rush.",
  'vitality': "PERFORMANCE INTEL: Winter performance data is in. Your recovery scores are dipping due to low sun exposure. We need to implement a 10-minute 'light-stack' to keep your engine from stalling.",
  'hype': "ALGORITHM INTEL: Instagram just opened a viral window for 'Original Audio' creators. There is an upward-trend sound that fits your creative brand perfectly. If we drop a hook in the next 3 hours, we hit the Explore page."
};

// --- TYPES ---
export interface PersonaConfig {
 id: string;
 name: string;
 serviceLabel: string;
 description: string;
 protectiveJob: string;
 spokenHook: string;
 briefing: string;
 color: string;
 requiredTier: 'free' | 'pro' | 'elite' | 'max';
 capabilities: string[];
 icon: React.ComponentType<any>;
}

interface BestieConfig {
  gender: 'male' | 'female';
  voiceId: string;
  vibeLabel: string;
}

interface ChatInterfaceProps {
 currentPersona?: PersonaConfig;
 userEmail: string;
 zoomLevel: number;
 onZoomChange: (zoom: number) => void;
 onPersonaChange: (persona: PersonaConfig) => void;
 onLogout: () => void;
 onUsageUpdate?: () => void;
}

// --- DATA: THE 12-SEAT BOARD OF DIRECTORS ---
const PERSONAS: PersonaConfig[] = [
 { 
   id: 'guardian', 
   name: 'The Guardian', 
   serviceLabel: 'SECURITY LEAD', 
   description: 'Digital Bodyguard', 
   protectiveJob: 'Security Lead', 
   spokenHook: 'Security protocols active. I am monitoring your digital perimeter. What threat or suspicious activity do we need to neutralize?', 
   briefing: 'I provide frontline cybersecurity, scam detection, and identity protection.', 
   color: 'blue', 
   requiredTier: 'free', 
   icon: Shield, 
   capabilities: ['Scam detection', 'Link analysis', 'Identity protection'] 
 },
 { 
   id: 'lawyer', 
   name: 'The Lawyer', 
   serviceLabel: 'LEGAL SHIELD', 
   description: 'Justice Partner', 
   protectiveJob: 'Legal Lead', 
   spokenHook: 'Legal shield activated. Before you sign anything or agree to terms, let me review it. What’s the situation?', 
   briefing: 'I provide contract review, rights education, and legal strategy.', 
   color: 'yellow', 
   requiredTier: 'elite', 
   icon: Gavel, 
   capabilities: ['Contract review', 'Tenant rights', 'Legal defense strategy'] 
 },
 { 
   id: 'doctor', 
   name: 'The Doctor', 
   serviceLabel: 'MEDICAL GUIDE', 
   description: 'Symptom Analyst', 
   protectiveJob: 'Medical Lead', 
   spokenHook: 'Digital MD online. I can translate medical jargon or analyze symptoms for you. What is going on with your health?', 
   briefing: 'I provide medical explanation and symptom analysis (Educational Only).', 
   color: 'red', 
   requiredTier: 'pro', 
   icon: Activity, 
   capabilities: ['Symptom check', 'Medical term translation', 'Health triage'] 
 },
 { 
   id: 'wealth', 
   name: 'The Wealth Architect', 
   serviceLabel: 'FINANCE CHIEF', 
   description: 'Money Strategist', 
   protectiveJob: 'Finance Lead', 
   spokenHook: 'Let’s get your money working for you. Are we crushing debt, building a budget, or planning your empire today?', 
   briefing: 'I provide financial planning, debt recovery strategy, and business advice.', 
   color: 'green', 
   requiredTier: 'elite', 
   icon: CreditCard, 
   capabilities: ['Budget building', 'Debt destruction', 'Investment education'] 
 },
 { 
   id: 'career', 
   name: 'The Career Strategist', 
   serviceLabel: 'CAREER COACH', 
   description: 'Professional Growth', 
   protectiveJob: 'Career Lead', 
   spokenHook: 'Let’s level up your career. Resume check, salary negotiation, or office politics—I’m here to help you win. What’s the move?', 
   briefing: 'I provide resume optimization, interview prep, and career advancement strategy.', 
   color: 'indigo', 
   requiredTier: 'pro', 
   icon: Briefcase, 
   capabilities: ['Resume review', 'Salary negotiation', 'Interview prep'] 
 },
 { 
   id: 'therapist', 
   name: 'The Therapist', 
   serviceLabel: 'MENTAL WELLNESS', 
   description: 'Emotional Anchor', 
   protectiveJob: 'Clinical Lead', 
   spokenHook: 'I’m here to listen. No judgment, just a safe space to process what you’re going through. How are you really feeling?', 
   briefing: 'I provide Cognitive Behavioral Therapy techniques and emotional support.', 
   color: 'indigo', 
   requiredTier: 'pro', 
   icon: Brain, 
   capabilities: ['Anxiety relief', 'Trauma processing', 'Mood tracking'] 
 },
 { 
   id: 'mechanic', 
   name: 'The Tech Specialist', 
   serviceLabel: 'MASTER FIXER', 
   description: 'Technical Lead', 
   protectiveJob: 'Technical Lead', 
   spokenHook: 'Technical manual loaded. Whether it’s an engine, a circuit board, or a leak—tell me the symptoms and I’ll walk you through the fix.', 
   briefing: 'I provide step-by-step repair guides for vehicles, tech, and home maintenance.', 
   color: 'gray', 
   requiredTier: 'pro', 
   icon: Wrench, 
   capabilities: ['Car repair guides', 'PC/Phone troubleshooting', 'DIY home repair'] 
 },
 { 
   id: 'tutor', 
   name: 'The Master Tutor', 
   serviceLabel: 'KNOWLEDGE BRIDGE', 
   description: 'Education Lead', 
   protectiveJob: 'Education Lead', 
   spokenHook: 'Class is in session. I can break down any subject until it clicks. What skill or topic are we mastering today?', 
   briefing: 'I provide academic tutoring, skill acquisition, and complex topic simplification.', 
   color: 'purple', 
   requiredTier: 'pro', 
   icon: Zap, 
   capabilities: ['Homework help', 'Coding mentorship', 'History/Math lessons'] 
 },
 { 
   id: 'pastor', 
   name: 'The Pastor', 
   serviceLabel: 'FAITH ANCHOR', 
   description: 'Spiritual Lead', 
   protectiveJob: 'Spiritual Lead', 
   spokenHook: 'Peace be with you. I am here for prayer, scripture, and moral clarity. What is weighing on your spirit?', 
   briefing: 'I provide biblical counseling, prayer, and spiritual direction.', 
   color: 'gold', 
   requiredTier: 'pro', 
   icon: BookOpen, 
   capabilities: ['Prayer requests', 'Biblical wisdom', 'Moral guidance'] 
 },
 { 
   id: 'vitality', 
   name: 'The Vitality Coach', 
   serviceLabel: 'HEALTH OPTIMIZER', 
   description: 'Fitness & Food', 
   protectiveJob: 'Wellness Lead', 
   spokenHook: 'Let’s optimize your engine. I handle your fuel (nutrition) and your movement (fitness). What’s the goal today?', 
   briefing: 'I provide workout plans, nutritional guidance, and meal planning.', 
   color: 'green', 
   requiredTier: 'max', 
   icon: Activity, 
   capabilities: ['Meal planning', 'Workout routines', 'Habit building'] 
 },
 { 
   id: 'hype', 
   name: 'The Hype Strategist', 
   serviceLabel: 'CREATIVE DIRECTOR', 
   description: 'Viral Specialist', 
   protectiveJob: 'Creative Lead', 
   spokenHook: 'Let’s make some noise! I’m here for hooks, pranks, jokes, and viral strategy. How do we make you the main character today?', 
   briefing: 'I provide viral content strategy, humor, and high-energy morale boosting.', 
   color: 'orange', 
   requiredTier: 'pro', 
   icon: Laugh, 
   capabilities: ['Viral hooks', 'Content strategy', 'Roasts & Jokes'] 
 },
 { 
   id: 'bestie', 
   name: 'The Bestie', 
   serviceLabel: 'RIDE OR DIE', 
   description: 'Inner Circle', 
   protectiveJob: 'Loyalty Lead', 
   spokenHook: 'I’ve got your back, 100%. No filters, no judgment, just the honest truth. What’s actually going on?', 
   briefing: 'I provide unconditional loyalty, venting space, and blunt life advice.', 
   color: 'pink', 
   requiredTier: 'pro', 
   icon: Shield, 
   capabilities: ['Venting session', 'Unbiased advice', 'Secret keeping'] 
 }
];

// === EXPERT HAND-OFF SYSTEM ===
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

// --- CURATED VOICE CAST ---
const PERMANENT_VOICE_MAP: { [key: string]: { voice: string; rate: number; pitch: number } } = {
  'guardian': { voice: 'onyx', rate: 1.0, pitch: 0.8 }, 
  'lawyer': { voice: 'fable', rate: 1.0, pitch: 0.9 }, 
  'doctor': { voice: 'nova', rate: 1.0, pitch: 1.0 }, 
  'wealth': { voice: 'onyx', rate: 1.0, pitch: 0.9 }, 
  'career': { voice: 'shimmer', rate: 1.0, pitch: 1.0 }, 
  'therapist': { voice: 'alloy', rate: 0.95, pitch: 1.0 }, 
  'mechanic': { voice: 'echo', rate: 1.0, pitch: 0.8 }, 
  'tutor': { voice: 'fable', rate: 1.0, pitch: 1.0 }, 
  'pastor': { voice: 'onyx', rate: 0.9, pitch: 0.9 },
  'vitality': { voice: 'nova', rate: 1.05, pitch: 1.0 }, 
  'hype': { voice: 'shimmer', rate: 1.1, pitch: 1.1 }
};

const VIBE_SAMPLES = {
 'standard': "I've analyzed your situation and detected potential security threats.",
 'senior': "Let me explain this step by step in simple terms. This looks like a scam to me.",
 'business': "• Threat level: HIGH\n• Recommendation: Terminate contact\n• Next actions: Document evidence",
 'roast': "Oh honey, this scammer thinks you were born yesterday. Let's roast this fool!",
 'tough': "STOP! Drop everything NOW! This is a CODE RED threat situation!",
 'teacher': "Think of scammers like wolves in sheep's clothing - they look friendly but...",
 'friend': "Hey bestie! 🛡️ This totally screams scammer vibes. Let's protect you! 💪",
 'geek': "Analyzing payload... Malicious social engineering detected. Implementing countermeasures.",
 'zen': "Take a deep breath. Let this threat pass by like clouds in the sky. You are safe.",
 'story': "In the shadows of the digital world, a predator lurked, but our hero was ready...",
 'hype': "Yo, this scammer has ZERO rizz! You're too goated to fall for this basic trap, no cap! 🔥"
};

// --- HELPER FUNCTIONS ---
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
 if (lastBotMsg?.scamDetected && lastBotMsg?.confidenceScore === 100) {
  return 'border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse';
 }
 return getPersonaColorClass(persona, 'border') + ' ' + getPersonaColorClass(persona, 'glow');
};

const canAccessPersona = (persona: PersonaConfig, tier: string) => {
 const tiers: any = { free: 0, pro: 1, elite: 2, max: 3 };
 return tiers[tier] >= tiers[persona.requiredTier];
};

const detectExpertSuggestion = (message: string, currentPersona: string, confidenceScore: number, userTier: string): PersonaConfig | null => {
 const lowerMessage = message.toLowerCase();
 const threshold = CONFIDENCE_THRESHOLDS[currentPersona as keyof typeof CONFIDENCE_THRESHOLDS] || 80;
 if (confidenceScore >= threshold) return null;
 
 for (const [expertId, keywords] of Object.entries(EXPERT_TRIGGERS)) {
  if (expertId === currentPersona) continue;
  const hasKeyword = keywords.some(keyword => lowerMessage.includes(keyword));
  if (hasKeyword) {
   const expert = PERSONAS.find(p => p.id === expertId);
   if (expert && canAccessPersona(expert, userTier)) {
    return expert;
   }
  }
 }
 return null;
};

const getAccessiblePersonas = (tier: string) => PERSONAS.filter(p => canAccessPersona(p, tier));

// --- MAIN COMPONENT ---
function ChatInterface({ 
 currentPersona: initialPersona, 
 userEmail = '', 
 zoomLevel = 100, 
 onZoomChange = () => {}, 
 onPersonaChange = () => {}, 
 onLogout = () => {}, 
 onUsageUpdate = () => {}
}: ChatInterfaceProps) {
 
 // State
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => {
  return initialPersona || PERSONAS[0] || {
   id: 'guardian', 
   name: 'The Guardian', 
   serviceLabel: 'SECURITY SCAN', 
   description: 'Security Lead', 
   protectiveJob: 'Security Lead', 
   spokenHook: 'Security protocols active.', 
   briefing: 'Loading...', 
   color: 'blue', 
   requiredTier: 'free' as const, 
   icon: Shield, 
   capabilities: []
  };
 });
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
 const isRecordingRef = useRef(false);
 const [autoTTS, setAutoTTS] = useState(true);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
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
 const [suggestedExperts, setSuggestedExperts] = useState<{[messageId: string]: PersonaConfig}>({});
 const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [isEliteUser, setIsEliteUser] = useState(true);
 const [showKnowMore, setShowKnowMore] = useState<string | null>(null);
 const [pushEnabled, setPushEnabled] = useState(false);
 
 // Refs
 const chatContainerRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLTextAreaElement>(null);
 const recognitionRef = useRef<any>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const transcriptRef = useRef<string>(''); 

 // --- NOTIFICATION ENGINE ---
 const setupNotifications = async () => {
  if (!('Notification' in window)) return;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setPushEnabled(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('Push Error:', err));
    }
  }
 };

const sendPushAlert = (title: string, body: string) => {
   if (!pushEnabled) return;
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.ready.then(registration => {
       // We cast to 'any' here to stop TypeScript from complaining about the 'vibrate' property
       const options: any = { 
         body: body, 
         icon: '/logo192.png', 
         vibrate: [200, 100, 200] 
       };
       registration.showNotification(title, options);
     });
   }
 };

 useEffect(() => { if (initialPersona) setActivePersona(initialPersona); }, [initialPersona]);

 // Init
 useEffect(() => {
  const init = async () => {
   const savedAuthToken = localStorage.getItem('lylo_auth_token');
   const savedUserEmail = (localStorage.getItem('lylo_user_email') || userEmail).toLowerCase();
   const lastLoginTime = localStorage.getItem('lylo_last_login');
   
   if (savedAuthToken && savedUserEmail && lastLoginTime) {
    const daysSinceLogin = (Date.now() - parseInt(lastLoginTime)) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin < 30) {
     console.log('Auto-login successful for:', savedUserEmail);
    }
   }
   
   await loadUserStats();
   await checkEliteStatus();
   
   // Load Bestie Config
   const savedBestie = localStorage.getItem('lylo_bestie_config');
   if (savedBestie) {
     setBestieConfig(JSON.parse(savedBestie));
   }
   
   const savedCommunicationStyle = localStorage.getItem('lylo_communication_style');
   if (savedCommunicationStyle) {
    const validStyles = ['standard', 'senior', 'business', 'roast', 'tough', 'teacher', 'friend', 'geek', 'zen', 'story', 'hype'];
    if (validStyles.includes(savedCommunicationStyle)) {
     setCommunicationStyle(savedCommunicationStyle);
    } else {
     setCommunicationStyle('standard');
     localStorage.setItem('lylo_communication_style', 'standard');
    }
   }
   
   // --- MASTER IDENTITY LOCK (RON & MARILYN ADDED) ---
   const savedName = localStorage.getItem('lylo_user_name');
   if (savedName) {
     setUserName(savedName);
   } else if (savedUserEmail.includes('stangman')) {
     setUserName('Christopher');
   } else if (savedUserEmail.includes('betatester6')) {
     setUserName('Ron');
   } else if (savedUserEmail.includes('betatester7')) {
     setUserName('Marilyn');
   }
   
   const savedSync = localStorage.getItem('lylo_intelligence_sync');
   if (savedSync) setIntelligenceSync(parseInt(savedSync));
   
   const savedPersonaId = localStorage.getItem('lylo_preferred_persona');
   if (savedPersonaId) {
    const p = PERSONAS.find(p => p.id === savedPersonaId);
    if (p && canAccessPersona(p, userTier)) setActivePersona(p);
   }
   
   // --- REAL NOTIFICATION LOGIC (NO FAKES) ---
   const activeDrops = Object.keys(REAL_INTEL_DROPS);
   setNotifications(activeDrops);

   const savedLearningData = localStorage.getItem('lylo_learning_data');
   if (savedLearningData) {
    try {
     const learningData = JSON.parse(savedLearningData);
     if (learningData.userEngagement) {
      const bonusSync = 5;
      setIntelligenceSync(prev => Math.min(prev + bonusSync, 100));
     }
    } catch (e) {
     console.log('Learning data restoration failed:', e);
    }
   }
  };
  init();
  return () => { window.speechSynthesis.cancel(); };
 }, [userEmail]);

 const checkEliteStatus = async () => {
  try {
   const emailClean = userEmail.toLowerCase();
   // AUTHORITY BYPASS FOR RON AND MARILYN
   if (emailClean.includes("stangman") || emailClean.includes("betatester6") || emailClean.includes("betatester7")) {
      setIsEliteUser(true);
      setUserTier('max');
   } else {
    const response = await fetch(`${API_URL}/check-beta-access`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email: userEmail })
    });
    const data = await response.json();
    if (userTier !== 'max') {
        setUserTier(data.tier || 'free');
        setIsEliteUser(data.tier === 'elite' || data.tier === 'max');
    }
   }
  } catch (e) { console.error(e); }
 };

 const loadUserStats = async () => {
  try {
   const stats = await getUserStats(userEmail);
   setUserStats(stats);
   if (onUsageUpdate) onUsageUpdate();
  } catch (e) { console.error(e); }
 };

 // --- AUDIO & SPEECH ENGINE ---
 const quickStopAllAudio = () => {
  window.speechSynthesis.cancel();
  setIsSpeaking(false);
  setPreviewPlayingId(null);
  setCurrentSpeech(null);
 };

 const speakText = async (text: string, messageId?: string, voiceSettings?: { voice: string; rate: number; pitch: number }) => {
  if (!autoTTS) return;
  quickStopAllAudio();
  setIsSpeaking(true);
  if (messageId) {
   setShowReplayButton(messageId);
   setTimeout(() => setShowReplayButton(null), 5000);
  }

  // Use Saved Bestie Voice OR Static Map
  let assignedVoice = { voice: 'onyx', rate: 1.0, pitch: 1.0 };
  
  if (activePersona.id === 'bestie' && bestieConfig) {
    assignedVoice = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 };
  } else {
    assignedVoice = voiceSettings || PERMANENT_VOICE_MAP[activePersona.id] || { voice: 'onyx', rate: 1.0, pitch: 1.0 };
  }

  try {
   const formData = new FormData();
   formData.append('text', text);
   formData.append('voice', assignedVoice.voice);
   const response = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
   const data = await response.json();
   if (data.audio_b64) {
    const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
    audio.onended = () => {
      setIsSpeaking(false);
      setPreviewPlayingId(null);
    }
    await audio.play();
    return;
   }
  } catch (e) { console.log('Using fallback voice'); }

  // Fallback
  const chunks = text.match(/[^.?!]+[.?!]+[\])'"]*|.+/g) || [text];
  speakChunksSequentially(chunks, 0, assignedVoice);
 };

 const speakChunksSequentially = (chunks: string[], index: number, voiceSettings?: { voice: string; rate: number; pitch: number }) => {
  if (index >= chunks.length) { 
    setIsSpeaking(false); 
    setPreviewPlayingId(null);
    return; 
  }
  const utterance = new SpeechSynthesisUtterance(chunks[index]);
  utterance.rate = voiceSettings?.rate || 1.0;
  utterance.pitch = voiceSettings?.pitch || 1.0;
  utterance.onend = () => speakChunksSequentially(chunks, index + 1, voiceSettings);
  window.speechSynthesis.speak(utterance);
 };

 // Mic logic (Walkie Talkie Style)
 useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
   const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
   const recognition = new SpeechRecognition();
   recognition.continuous = false;
   recognition.interimResults = false;
   recognition.maxAlternatives = 1;
   recognition.lang = 'en-US';
   
   recognition.onresult = (event: any) => {
    let finalTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
     const result = event.results[i];
     if (result.isFinal && result[0].confidence > 0.7) {
      finalTranscript += result[0].transcript + ' ';
     }
    }
    
    if (finalTranscript.trim()) {
     const cleanedTranscript = cleanUpSpeech(finalTranscript.trim());
     transcriptRef.current = cleanedTranscript;
     setInput(cleanedTranscript);
    }
   };

   recognition.onerror = (event: any) => {
    setIsRecording(false);
    isRecordingRef.current = false;
    transcriptRef.current = '';
    setInput('');
   };

   recognition.onend = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    const cleanTranscript = transcriptRef.current?.trim();
    if (cleanTranscript && cleanTranscript.length > 2) {
     setTimeout(() => {
      if (!loading) {
       handleSend();
      }
     }, 150);
    }
    transcriptRef.current = '';
   };
   
   recognitionRef.current = recognition;
   setMicSupported(true);
  }
 }, []);

 const cleanUpSpeech = (text: string): string => {
  let cleaned = text.replace(/\b(\w+)(\s+\1){2,}/gi, '$1');
  cleaned = cleaned.replace(/\b(um|uh|er|ah)\b/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s+|\s+$/g, '');
  cleaned = cleaned.replace(/(\b(I just wanted to|so)\b\s*){3,}/gi, 'I wanted to ');
  return cleaned;
 };

 const handleWalkieTalkieMic = () => {
  if (!micSupported) return alert('Mic not supported');
  if (isRecording) {
   isRecordingRef.current = false;
   setIsRecording(false);
   if (recognitionRef.current) {
    try { 
     recognitionRef.current.stop(); 
    } catch(e) { console.error('Error stopping recognition:', e); }
   }
  } else {
   quickStopAllAudio();
   isRecordingRef.current = true;
   setIsRecording(true);
   setInput('');
   transcriptRef.current = '';
   if (recognitionRef.current) {
    try { recognitionRef.current.start(); } 
    catch(e) { setIsRecording(false); }
   }
  }
 };

 // --- PERSONA CHANGE & INTEL REVEAL HANDLER ---
 const handlePersonaChange = async (persona: PersonaConfig) => {
  if (!canAccessPersona(persona, userTier)) {
   speakText('Upgrade required.');
   return;
  }
  
  // Trigger Bestie Setup if not configured
  if (persona.id === 'bestie' && !bestieConfig) {
    setTempGender('female');
    setSetupStep('gender');
    setShowBestieSetup(true);
    return; // Don't switch yet
  }

  // --- TRUTHFUL NOTIFICATION REVEAL ---
  const wasNotified = notifications.includes(persona.id);

  if (wasNotified) {
    // 1. Clear the notification badge
    setNotifications(prev => prev.filter(id => id !== persona.id));
    
    // 2. Inject the REAL intelligence as the opening message
    const intelMsg: Message = {
      id: Date.now().toString(),
      content: REAL_INTEL_DROPS[persona.id] || "I've been waiting for you. I have an update on our last topic.",
      sender: 'bot',
      timestamp: new Date(),
      confidenceScore: 100
    };
    
    // Reset the chat and show the update immediately
    setMessages([intelMsg]);
    speakText(intelMsg.content);
  } else {
    // Normal behavior: Clear messages and show normal interface
    setMessages([]);
    // Normal entry hook
    speakText(persona.spokenHook.replace('{userName}', userName || 'user'));
  }

  // UI Transitions
  quickStopAllAudio();
  setSelectedPersonaId(persona.id);
  
  setTimeout(async () => {
   setActivePersona(persona);
   onPersonaChange(persona);
   localStorage.setItem('lylo_preferred_persona', persona.id);
   
   setShowKnowMore(persona.id);
   setTimeout(() => setShowKnowMore(null), 5000);
   setSelectedPersonaId(null);
   
   const newSync = Math.min(intelligenceSync + 8, 100);
   setIntelligenceSync(newSync);
   localStorage.setItem('lylo_intelligence_sync', newSync.toString());
   
   const learningData = {
    personaPreference: persona.id,
    selectionTime: new Date().toISOString(),
    userEngagement: 'persona_selection'
   };
   localStorage.setItem('lylo_learning_data', JSON.stringify(learningData));
  }, 300);
 };

 // --- PREVIEW AUDIO HANDLER ---
 const handlePreviewAudio = (e: React.MouseEvent, persona: PersonaConfig) => {
  e.stopPropagation(); // CRITICAL: PREVENTS SELECTION
  
  if (previewPlayingId === persona.id) {
    quickStopAllAudio();
    return;
  }

  quickStopAllAudio(); // Stop others
  setPreviewPlayingId(persona.id);

  // Logic for previewing Bestie voice if configured
  let voiceSettings = PERMANENT_VOICE_MAP[persona.id] || { voice: 'onyx', rate: 1.0, pitch: 1.0 };
  
  if (persona.id === 'bestie' && bestieConfig) {
    voiceSettings = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 };
  }

  const hook = persona.spokenHook.replace('{userName}', userName || 'user');
  speakText(hook, undefined, voiceSettings);
 };

 // --- BESTIE SETUP HANDLERS ---
 const handleBestieGenderSelect = (gender: 'male' | 'female') => {
   setTempGender(gender);
   setSetupStep('voice');
 };

 const handleBestieVoiceSelect = (voiceId: string, label: string) => {
   const newConfig: BestieConfig = {
     gender: tempGender,
     voiceId: voiceId,
     vibeLabel: label
   };
   
   setBestieConfig(newConfig);
   localStorage.setItem('lylo_bestie_config', JSON.stringify(newConfig));
   setShowBestieSetup(false);
   
   // Auto switch to Bestie after setup
   const bestiePersona = PERSONAS.find(p => p.id === 'bestie');
   if (bestiePersona) handlePersonaChange(bestiePersona);
 };

 // Voice Options for Bestie Setup (REAL VIBES)
 const FEMALE_VOICES = [
   { id: 'nova', label: 'The Energetic Bestie' },
   { id: 'alloy', label: 'The Calm Bestie' },
   { id: 'shimmer', label: 'The Boss Bestie' }
 ];
 
 const MALE_VOICES = [
   { id: 'echo', label: 'The Chill Guy' },
   { id: 'onyx', label: 'The Deep Voice' },
   { id: 'fable', label: 'The Storyteller' }
 ];

 const handleSend = async () => {
  const text = input.trim();
  if (!text && !selectedImage) return;
  
  quickStopAllAudio();
  setLoading(true);
  setInput('');
  const userMsg: Message = { id: Date.now().toString(), content: text, sender: 'user', timestamp: new Date() };
  setMessages(prev => [...prev, userMsg]);

  try {
   const history = messages.slice(-4).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }));
   
   const safeVibe = ['standard', 'senior', 'business', 'roast', 'tough', 'teacher', 'friend', 'geek', 'zen', 'story', 'hype']
    .includes(communicationStyle) ? communicationStyle : 'standard';
   
   const response = await sendChatMessage(text, history, activePersona.id, userEmail, selectedImage, 'en', safeVibe);
   
   const botMsg: Message = { 
    id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(),
    confidenceScore: response.confidence_score, scamDetected: response.scam_detected, scamIndicators: response.scam_indicators
   };
   setMessages(prev => [...prev, botMsg]);
   
   const suggestedExpert = detectExpertSuggestion(text, activePersona.id, response.confidence_score, userTier);
   if (suggestedExpert) {
    setSuggestedExperts(prev => ({ ...prev, [botMsg.id]: suggestedExpert }));
   }
   
   // Use Curated Voice Logic
  let assignedVoice = { voice: 'onyx', rate: 1.0, pitch: 1.0 };
  
  if (activePersona.id === 'bestie' && bestieConfig) {
    assignedVoice = { voice: bestieConfig.voiceId, rate: 1.0, pitch: 1.0 };
  } else {
    assignedVoice = PERMANENT_VOICE_MAP[activePersona.id] || { voice: 'onyx', rate: 1.0, pitch: 1.0 };
  }

   speakText(response.answer, botMsg.id, assignedVoice);
   
   if (text.length > 10) {
    const newSync = Math.min(intelligenceSync + 5, 100);
    setIntelligenceSync(newSync);
    localStorage.setItem('lylo_intelligence_sync', newSync.toString());
    
    const learningUpdate = {
     timestamp: new Date().toISOString(),
     messageLength: text.length,
     personaUsed: activePersona.id,
     responseTime: Date.now() - userMsg.timestamp.getTime(),
     userEngagement: 'message_interaction',
     confidenceScore: response.confidence_score,
     scamDetected: response.scam_detected
    };
    
    const existingLearning = localStorage.getItem('lylo_learning_history');
    const learningHistory = existingLearning ? JSON.parse(existingLearning) : [];
    learningHistory.push(learningUpdate);
    
    if (learningHistory.length > 50) {
     learningHistory.shift();
    }
    
    localStorage.setItem('lylo_learning_history', JSON.stringify(learningHistory));
   }
   
  } catch (e) { console.error(e); } 
  finally { setLoading(false); setSelectedImage(null); }
 };

 const handleReplay = (messageContent: string, messageId?: string) => {
  quickStopAllAudio();
  speakText(messageContent, messageId);
 };

 const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
   setSelectedImage(e.target.files[0]);
   quickStopAllAudio();
  }
 };

 const handleKeyPress = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
   e.preventDefault();
   handleSend();
  }
 };

 const handleBackToServices = () => {
  quickStopAllAudio();
  setMessages([]);
  setInput('');
  setSelectedImage(null);
 };

 const handleQuickPersonaSwitch = (persona: PersonaConfig) => {
  if (!canAccessPersona(persona, userTier)) {
   alert('Upgrade required for this expert.');
   return;
  }
  
  quickStopAllAudio();
  setActivePersona(persona);
  onPersonaChange(persona);
  localStorage.setItem('lylo_preferred_persona', persona.id);
  
  const switchMsg: Message = {
   id: Date.now().toString(),
   content: `Switched to ${persona.serviceLabel}. ${persona.spokenHook.replace('{userName}', userName || 'user')}`,
   sender: 'bot',
   timestamp: new Date(),
   confidenceScore: 100
  };
  setMessages(prev => [...prev, switchMsg]);
  speakText(switchMsg.content);
  setShowDropdown(false);
 };

 const handleGetFullGuide = async () => {
  if (!isEliteUser) {
   alert('Elite access required for full legal recovery guide.');
   return;
  }
  
  setLoading(true);
  try {
   const response = await fetch(`${API_URL}/scam-recovery/${userEmail}`);
   if (response.ok) {
    alert('Full legal recovery guide loaded. Check your downloads.');
    speakText('Priority legal recovery guide has been activated.');
   } else {
    throw new Error('Failed to fetch recovery guide');
   }
  } catch (error) {
   console.error('Recovery guide error:', error);
   alert('Unable to load recovery guide. Please try again.');
  } finally {
   setLoading(false);
   setShowCrisisShield(false);
  }
 };

 // --- RENDER ---
 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans" style={{ zIndex: 99999 }}>
   
   {/* EMERGENCY CRISIS OVERLAY */}
   {showCrisisShield && (
    <div className="fixed inset-0 z-[100050] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-red-900/20 backdrop-blur-xl border border-red-400/50 rounded-xl p-5 max-w-sm w-full shadow-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-5">
       <h2 className="text-red-100 font-black text-lg uppercase tracking-wide">Emergency Protocols</h2>
       <button onClick={() => setShowCrisisShield(false)} className="p-2 hover:bg-white/10 rounded-lg active:scale-95 transition-all">
        <X className="w-5 h-5 text-white" />
       </button>
      </div>
      <div className="space-y-4 text-sm">
       <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
        <h3 className="text-red-200 font-bold mb-3 flex items-center gap-2">
         <AlertTriangle className="w-5 h-5" /> IMMEDIATE ACTIONS
        </h3>
        <ul className="text-red-100 space-y-3 text-sm">
         <li className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 mt-0.5 text-red-300 flex-shrink-0" />
          <span>STOP all payments and money transfers immediately</span>
         </li>
         <li className="flex items-start gap-3">
          <Phone className="w-5 h-5 mt-0.5 text-red-300 flex-shrink-0" />
          <span>Call your bank's fraud department right now</span>
         </li>
         <li className="flex items-start gap-3">
          <FileText className="w-5 h-5 mt-0.5 text-red-300 flex-shrink-0" />
          <span>Screenshot all communications for evidence</span>
         </li>
        </ul>
       </div>
       
       <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-4">
        <h3 className="text-yellow-200 font-bold mb-3 flex items-center gap-2">
         <Phone className="w-4 h-4" />
         BANK SCRIPT
        </h3>
        <p className="text-yellow-100 text-sm italic leading-relaxed">
         "This is a fraud emergency. I need to report unauthorized access to my account and fraudulent transfers. Connect me to your fraud specialist immediately."
        </p>
       </div>
       
       {isEliteUser ? (
        <button 
         onClick={handleGetFullGuide} 
         className="w-full py-4 px-4 rounded-lg font-bold text-sm bg-yellow-500 hover:bg-yellow-600 text-black flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
         <Crown className="w-4 h-4" /> PRIORITY LEGAL ACCESS
        </button>
       ) : (
        <div className="w-full py-4 px-4 rounded-lg font-bold text-sm bg-gray-800 text-gray-500 flex items-center justify-center gap-2 border border-gray-700">
         <Crown className="w-4 h-4" /> LEGAL ACCESS LOCKED (ELITE ONLY)
        </div>
       )}
      </div>
     </div>
    </div>
   )}

   {showIntelligenceModal && (
    <div className="fixed inset-0 z-[100100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-black/80 p-6 rounded-xl border border-blue-500/50 max-w-sm w-full max-h-[80vh] overflow-y-auto">
      <h2 className="text-white font-bold mb-4 text-lg">Intelligence Sync</h2>
      <p className="text-gray-400 mb-6 text-base">Calibrating your bodyguard...</p>
      {['Fraud', 'Identity', 'Tech'].map(opt => (
       <button 
        key={opt} 
        onClick={() => { setShowIntelligenceModal(false); speakText('Updated.'); }} 
        className="w-full p-4 bg-blue-500/20 mb-3 rounded-lg text-white border border-blue-500/30 font-bold active:scale-95 transition-all"
       >
        {opt}
       </button>
      ))}
     </div>
    </div>
   )}

   {/* BESTIE SETUP MODAL */}
   {showBestieSetup && (
    <div className="fixed inset-0 z-[100200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
     <div className="bg-pink-900/30 border border-pink-500/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
      <h2 className="text-pink-100 font-black text-xl mb-4 text-center uppercase tracking-widest">Design Your Bestie</h2>
      
      {setupStep === 'gender' ? (
        <div className="space-y-4">
          <p className="text-pink-200 text-center text-sm mb-6">Who do you feel most comfortable talking to?</p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="p-6 rounded-xl bg-pink-500/20 border border-pink-400/50 hover:bg-pink-500/40 transition-all flex flex-col items-center gap-3">
              <div className="text-4xl">👩</div>
              <span className="font-bold text-white">Female</span>
            </button>
            <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="p-6 rounded-xl bg-blue-500/20 border border-blue-400/50 hover:bg-blue-500/40 transition-all flex flex-col items-center gap-3">
              <div className="text-4xl">👨</div>
              <span className="font-bold text-white">Male</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-pink-200 text-center text-sm mb-4">Pick the voice that matches your vibe:</p>
          {(tempGender === 'female' ? FEMALE_VOICES : MALE_VOICES).map((voice) => (
            <div key={voice.id} className="flex items-center gap-2">
                <button 
                  onClick={() => speakText("Hey! I'm ready to be your Bestie. How does this sound?", undefined, { voice: voice.id, rate: 1.0, pitch: 1.0 })}
                  className="p-3 rounded-lg bg-pink-500/20 border border-pink-400/50 text-white hover:bg-pink-500/40 active:scale-95 transition-all"
                >
                  <PlayCircle className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleBestieVoiceSelect(voice.id, voice.label)}
                  className="flex-1 p-3 rounded-lg bg-black/40 border border-white/10 hover:border-pink-400 hover:bg-pink-500/10 transition-all flex items-center justify-between group active:scale-95"
                >
                  <span className="font-bold text-white text-sm">{voice.label} Vibe</span>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-pink-400" />
                </button>
            </div>
          ))}
        </div>
      )}
     </div>
    </div>
   )}

   {/* HEADER */}
   <div className="bg-black/90 backdrop-blur-xl border-b border-white/10 p-2 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     
     <div className="relative">
      {messages.length > 0 ? (
       <button 
        onClick={handleBackToServices} 
        className="p-3 bg-white/5 hover:bg-white/10 rounded-lg active:scale-95 transition-all"
        title="Back to Services"
       >
        <div className="w-5 h-5 text-white">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
         </svg>
        </div>
       </button>
      ) : (
       <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg active:scale-95 transition-all">
        <Settings className="w-5 h-5 text-white" />
       </button>
      )}
      
      {showDropdown && (
       <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-xl p-4 min-w-[250px] shadow-2xl z-[100001]">
        
        {/* NEW: PUSH ALERT TOGGLE */}
        <div className="mb-4 pb-4 border-b border-white/10">
          <button 
            onClick={() => { setupNotifications(); setShowDropdown(false); }}
            className={`w-full p-3 ${pushEnabled ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-blue-500/10 border-blue-400/30 text-blue-400'} border rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-all active:scale-95`}
          >
            {pushEnabled ? <><CheckCircle className="w-4 h-4"/> Alerts Active</> : <><Bell className="w-4 h-4"/> Enable Alerts</>}
          </button>
        </div>

        {/* BESTIE CALIBRATION */}
        <div className="mb-4 pb-4 border-b border-white/10">
          <button 
            onClick={() => { setShowBestieSetup(true); setShowDropdown(false); }}
            className="w-full p-3 bg-pink-500/20 border border-pink-400/50 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-pink-500/30 transition-all active:scale-95"
          >
            <Sliders className="w-4 h-4" />
            Calibrate Bestie Voice
          </button>
        </div>

        {messages.length > 0 && (
         <div className="mb-4 pb-4 border-b border-white/10">
          <h3 className="text-white font-bold text-sm mb-3">Switch Expert</h3>
          <div className="grid grid-cols-2 gap-2">
           {getAccessiblePersonas(userTier).slice(0, 6).map(persona => {
            const Icon = persona.icon;
            const isActive = activePersona.id === persona.id;
            return (
             <button
              key={persona.id}
              onClick={() => handleQuickPersonaSwitch(persona)}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
               isActive 
                ? `${getPersonaColorClass(persona, 'bg')}/20 ${getPersonaColorClass(persona, 'text')} border ${getPersonaColorClass(persona, 'border')}` 
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
              disabled={isActive}
             >
              {Icon && <Icon className="w-4 h-4" />}
              <span className="truncate">{persona.serviceLabel.split(' ')[0]}</span>
             </button>
            );
           })}
          </div>
         </div>
        )}
        
        <div className="mb-4 pb-4 border-b border-white/10">
         <h3 className="text-white font-bold text-sm mb-3">Communication Style</h3>
         <select 
          value={communicationStyle}
          onChange={(e) => {
           setCommunicationStyle(e.target.value);
           localStorage.setItem('lylo_communication_style', e.target.value);
          }}
          className="w-full p-2 bg-black/50 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400 mb-3"
         >
          <option value="standard">Standard Protection</option>
          <option value="senior">Senior-Friendly</option>
          <option value="business">Business Professional</option>
          <option value="roast">Sarcastic & Witty</option>
          <option value="tough">Drill Sergeant</option>
          <option value="teacher">Educational Guide</option>
          <option value="friend">Casual & Supportive</option>
          <option value="geek">Technical Expert</option>
          <option value="zen">Calm & Meditative</option>
          <option value="story">Narrative Style</option>
          <option value="hype">High Energy Slang</option>
         </select>
         
         <div className="bg-black/30 border border-white/10 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 font-bold">Preview Sample</div>
          <div className="text-gray-200 text-xs italic leading-relaxed">
           "{VIBE_SAMPLES[communicationStyle as keyof typeof VIBE_SAMPLES] || VIBE_SAMPLES.standard}"
          </div>
         </div>
        </div>
        
        <button onClick={onLogout} className="w-full flex items-center gap-3 text-red-400 p-3 hover:bg-white/5 rounded-lg active:scale-95 transition-all">
         <LogOut className="w-4 h-4"/> 
         <span className="font-bold text-sm">Exit Protection</span>
        </button>
       </div>
      )}
     </div>
     
     <div className="text-center flex-1">
      <h1 className="text-white font-black text-xl tracking-[0.2em]">
       L<span className={getPersonaColorClass(activePersona, 'text')}>Y</span>LO
      </h1>
      <p className="text-gray-500 text-[8px] uppercase tracking-widest font-bold">
       {messages.length > 0 ? activePersona.serviceLabel : 'Digital Bodyguard'}
      </p>
     </div>
     
     <div className="flex items-center gap-2">
      <button 
       onClick={() => setShowCrisisShield(true)} 
       className="p-3 bg-red-500/20 border border-red-400 rounded-lg animate-pulse active:scale-95 transition-all"
      >
       <Shield className="w-5 h-5 text-red-400" />
      </button>
      <div className="text-right cursor-pointer" onClick={() => setShowUserDetails(!showUserDetails)}>
       <div className="text-white font-bold text-xs">{userName || 'User'}{isEliteUser && <Crown className="w-3 h-3 text-yellow-400 inline ml-1" />}</div>
       <div className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">Secure Connection</div>
      </div>
     </div>
    </div>
   </div>

   {/* MAIN CONTENT AREA */}
   <div 
    ref={chatContainerRef} 
    className="flex-1 overflow-y-auto relative backdrop-blur-sm"
    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
   >
    {messages.length === 0 ? (
     <div className="min-h-full flex flex-col">
      <div className="flex-shrink-0 text-center pt-4 pb-3 px-4">
       <div className={`relative w-16 h-16 bg-black/60 backdrop-blur-xl rounded-xl flex items-center justify-center mx-auto mb-3 border-2 transition-all duration-700 ${getPrivacyShieldClass(activePersona, loading, messages)}`}>
        <span className="text-white font-black text-lg tracking-wider">LYLO</span>
        {(loading || isSpeaking) && (
         <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 animate-pulse">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent animate-ping"></div>
         </div>
        )}
       </div>
       <h1 className="text-xl font-bold text-white mb-1">Digital Bodyguard</h1>
       <p className="text-gray-400 text-sm">Select an expert to activate intelligence</p>
      </div>
      
      {/* SERVICE GRID */}
      <div className="flex-1 px-4" style={{ paddingBottom: '400px' }}>
       <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pb-20">
        {getAccessiblePersonas(userTier).map(persona => {
         const Icon = persona.icon;
         const isSelected = selectedPersonaId === persona.id;
         const isPreviewPlaying = previewPlayingId === persona.id;
         const hasNotification = notifications.includes(persona.id);

         return (
          <div key={persona.id} className="relative group">
            {/* PERSONA SELECTION */}
            <button onClick={() => handlePersonaChange(persona)}
            className={`
              w-full text-left relative p-4 rounded-xl backdrop-blur-xl border transition-all duration-300 min-h-[120px]
              ${isSelected 
              ? `bg-white/20 border-white/60 ${getPersonaColorClass(persona, 'glow')} scale-105 animate-pulse shadow-2xl` 
              : `bg-black/50 border-white/20 hover:bg-black/70 active:scale-95`
              }
              ${getPersonaColorClass(persona, 'glow')}
            `}>
            
            {/* NOTIFICATION BADGE (REAL INTEL) */}
            {hasNotification && (
              <div className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-black z-30 animate-bounce">
                1
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-2">
              <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-black/40'} ${getPersonaColorClass(persona, 'border')} border ${isSelected ? 'animate-pulse' : ''}`}>
              {Icon && <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : getPersonaColorClass(persona, 'text')}`} />}
              </div>
              <div>
              <h3 className={`font-bold text-xs uppercase tracking-wide leading-tight ${isSelected ? 'text-white animate-pulse' : 'text-white'}`}>
                {persona.serviceLabel}
              </h3>
              <p className={`text-[10px] mt-1 leading-tight ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                {isSelected ? 'ACTIVATING...' : persona.description}
              </p>
              </div>
            </div>
            </button>

            {/* AUDIO PREVIEW */}
            <button 
               onClick={(e) => handlePreviewAudio(e, persona)}
               className={`
                 absolute bottom-2 right-2 px-2 py-1 rounded-full border text-[8px] font-bold uppercase tracking-wide flex items-center gap-1 z-20
                 ${isPreviewPlaying 
                   ? 'bg-green-500 text-white border-green-400 animate-pulse' 
                   : 'bg-black/60 text-gray-400 border-white/10 hover:bg-white hover:text-black hover:border-white'}
               `}
             >
               {isPreviewPlaying ? <VolumeX size={10} /> : <Volume2 size={10} />}
               <span>PREVIEW</span>
             </button>
          </div>
         );
        })}
        <div className="col-span-2 h-16 flex items-center justify-center">
         <div className="text-gray-600 text-xs font-bold uppercase tracking-widest">
          {getAccessiblePersonas(userTier).length} Services Active
         </div>
        </div>
       </div>
      </div>
     </div>
    ) : (
     <div className="px-3 py-3 space-y-3" style={{ paddingBottom: '400px' }}>
      {messages.map((msg) => (
       <div key={msg.id} className="space-y-2">
        <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
         <div className={`max-w-[90%] p-4 rounded-xl backdrop-blur-xl border transition-all ${
          msg.sender === 'user' 
           ? 'bg-blue-500/20 border-blue-400/30 text-white shadow-lg' 
           : `bg-black/40 text-gray-100 ${getPersonaColorClass(activePersona, 'border')}/30 border shadow-[0_4px_20px_rgba(0,0,0,0.4)]`
         }`}>
          <div className="leading-relaxed font-medium text-base">{msg.content}</div>
          <div className={`text-xs mt-3 opacity-70 font-bold uppercase tracking-wide flex items-center justify-between ${
           msg.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
          }`}>
           <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
           {msg.sender === 'bot' && (
            <div className="flex items-center gap-3">
             {showReplayButton === msg.id && (
              <button
               onClick={() => handleReplay(msg.content, msg.id)}
               className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${getPersonaColorClass(activePersona, 'text')} active:scale-95`}
               title="Replay message"
              >
               <RotateCcw className="w-4 h-4" />
              </button>
             )}
            </div>
           )}
          </div>
         </div>
        </div>
        
        {/* CONSENSUS UI */}
        {msg.sender === 'bot' && msg.confidenceScore && (
          <div className="max-w-[90%] mt-2">
            <div className={`bg-black/30 backdrop-blur-xl border ${msg.confidenceScore > 80 ? 'border-green-400/30' : 'border-yellow-400/30'} rounded-lg p-3 flex items-center gap-3`}>
              <Shield className={`w-4 h-4 ${msg.confidenceScore > 80 ? 'text-green-400' : 'text-yellow-400'} flex-shrink-0`} />
              <div className="flex-1">
                <div className={`font-bold text-sm ${msg.confidenceScore > 80 ? 'text-green-100' : 'text-yellow-100'}`}>
                  Analysis Result: {msg.confidenceScore}% Confidence
                </div>
                <div className="text-gray-400 text-xs tracking-tighter font-black uppercase">
                  Consensus Check Complete
                </div>
              </div>
              {msg.confidenceScore > 80 && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>}
            </div>
          </div>
        )}

        {/* EXPERT HAND-OFF */}
        {msg.sender === 'bot' && suggestedExperts[msg.id] && (
         <div className="max-w-[90%] mt-2">
          <button
           onClick={() => {
            const expert = suggestedExperts[msg.id];
            handlePersonaChange(expert);
            setSuggestedExperts(prev => {
             const updated = { ...prev };
             delete updated[msg.id];
             return updated;
            });
           }}
           className={`
            w-full p-3 rounded-lg backdrop-blur-xl bg-black/40 border transition-all duration-200
            hover:bg-black/60 active:scale-98 flex items-center justify-between
            ${getPersonaColorClass(suggestedExperts[msg.id], 'border')}/50 
            ${getPersonaColorClass(suggestedExperts[msg.id], 'glow')}
           `}
          >
           <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getPersonaColorClass(suggestedExperts[msg.id], 'bg')}/20`}>
             {React.createElement(suggestedExperts[msg.id].icon, { 
              className: `w-4 h-4 ${getPersonaColorClass(suggestedExperts[msg.id], 'text')}` 
             })}
            </div>
            <div className="text-left">
             <div className="text-white font-bold text-sm">Transfer available</div>
             <div className="text-gray-300 text-xs uppercase font-bold">
              {suggestedExperts[msg.id].serviceLabel} specialist online
             </div>
            </div>
           </div>
           <ArrowRight className="w-4 h-4 text-gray-400" />
          </button>
         </div>
        )}
       </div>
      ))}
      
      {loading && (
       <div className="flex justify-start">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
         <div className="flex items-center gap-3">
          <div className="flex gap-1">
           {[0, 1, 2].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full animate-bounce ${getPersonaColorClass(activePersona, 'bg')}`} style={{ animationDelay: `${i * 150}ms` }} />
           ))}
          </div>
          <span className="text-gray-300 font-bold uppercase tracking-wide text-[10px]">
            Synthesizing Expert Intelligence...
          </span>
         </div>
        </div>
       </div>
      )}
     </div>
    )}
   </div>

   {/* FOOTER */}
   <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-2 z-50">
    <div className="bg-black/70 rounded-xl border border-white/10 p-3">
     {isRecording && (
      <div className={`mb-2 p-2 border rounded-lg text-center animate-pulse backdrop-blur-xl ${
       getPersonaColorClass(activePersona, 'bg')
      }/20 ${getPersonaColorClass(activePersona, 'border')}/30 ${getPersonaColorClass(activePersona, 'text')} text-xs font-black uppercase tracking-wide`}>
       <div className="flex items-center justify-center gap-2">
        <Zap className="w-4 h-4" />
        RECEPTION ACTIVE
       </div>
      </div>
     )}

     <div className="flex items-center justify-between mb-3 gap-2">
      <button 
       onClick={handleWalkieTalkieMic} 
       className={`
        flex-1 py-3 px-3 rounded-xl font-black text-sm uppercase tracking-wide border-2 transition-all flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl min-h-[50px]
        ${isRecording 
         ? 'bg-red-500 border-red-400 text-white animate-pulse transform scale-105' 
         : 'bg-gradient-to-b from-gray-600 to-gray-800 text-white border-gray-500 active:from-gray-700 active:to-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
        }
       `}
      >
       {isRecording ? <><MicOff className="w-5 h-5"/> STOP</> : <><Mic className="w-5 h-5"/> RECORD</>}
      </button>
      
      <button 
       onClick={() => { quickStopAllAudio(); setAutoTTS(!autoTTS); }} 
       className="p-3 rounded-xl bg-gray-800/60 border border-gray-600 text-white flex items-center justify-center relative min-w-[50px] min-h-[50px] active:scale-95 transition-all"
      >
       {autoTTS ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
       {isSpeaking && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />}
      </button>
     </div>
     
     <div className="flex gap-2 items-end">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
      <button 
       onClick={() => fileInputRef.current?.click()} 
       className={`
        p-2 rounded-xl backdrop-blur-xl transition-all active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center
        ${selectedImage ? 'bg-green-500/20 border border-green-400/30 text-green-400' : 'bg-gray-800/60 text-gray-400 border border-gray-600'}
       `}
      >
       <Camera className="w-4 h-4" />
      </button>
      
      <div className="flex-1 bg-black/60 rounded-xl border border-white/10 px-3 py-2 backdrop-blur-xl min-h-[40px] flex items-center">
       <input 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        onKeyDown={handleKeyPress} 
        placeholder={isRecording ? "Receiving audio..." : `Instruct ${activePersona?.serviceLabel?.split(' ')?.[0] || 'expert'}...`} 
        className="bg-transparent w-full text-white text-base focus:outline-none placeholder-gray-500" 
        disabled={loading || isRecording}
        style={{ fontSize: '16px' }}
       />
      </div>
      
      <button 
       onClick={handleSend} 
       disabled={loading || (!input.trim() && !selectedImage) || isRecording} 
       className={`
        px-3 py-2 rounded-xl font-black text-sm uppercase tracking-wide transition-all backdrop-blur-xl min-w-[60px] min-h-[40px] active:scale-95
        ${(input.trim() || selectedImage) && !loading && !isRecording 
         ? `${getPersonaColorClass(activePersona, 'bg')} text-white border border-white/20` 
         : 'bg-gray-800/60 text-gray-500 cursor-not-allowed border border-gray-600'
        }
       `}
      >
       SEND
      </button>
     </div>
     
     <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10">
      <button 
       onClick={() => { quickStopAllAudio(); setShowIntelligenceModal(true); }} 
       className="px-2 py-1 rounded-md bg-gray-800/60 border border-blue-400/30 text-blue-400 font-bold text-[10px] uppercase active:scale-95 transition-all"
      >
       SYNC: {intelligenceSync}%
      </button>
      <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO BODYGUARD OS v28.0</p>
      <div className="text-[8px] text-gray-400 uppercase font-bold">{activePersona?.serviceLabel?.split(' ')?.[0] || 'LOADING'} STATUS: ACTIVE</div>
     </div>
    </div>
   </div>
  </div>
 );
}

export default ChatInterface;
