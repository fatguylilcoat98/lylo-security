import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2,
 Filter, Sparkles, ChevronRight, ChevronLeft, MessageSquare, Heart, Info, ExternalLink,
 Menu, Image as ImageIcon, Camera as CameraIcon, Type, Lock
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

const CRISIS_LINKS: { [key: string]: { label: string, url: string, description: string }[] } = {
  'guardian': [
    { label: "FBI IC3 Fraud Reporting", url: "https://www.ic3.gov/", description: "Report stolen funds or digital extortion immediately." },
    { label: "IdentityTheft.gov", url: "https://www.identitytheft.gov/", description: "Federal hub to lock down compromised SSNs." }
  ],
  'lawyer': [
    { label: "Legal Services Corporation", url: "https://www.lsc.gov/", description: "Find immediate, free legal aid in your area." },
    { label: "Consumer Financial Protection Bureau", url: "https://www.consumerfinance.gov/complaint/", description: "File a complaint against a predatory lender or bank." }
  ],
  'doctor': [
    { label: "Call 911", url: "tel:911", description: "For immediate, life-threatening medical emergencies." },
    { label: "WebMD Symptom Checker", url: "https://symptoms.webmd.com/", description: "Verify non-emergency symptoms." }
  ],
  'therapist': [
    { label: "988 Suicide & Crisis Lifeline", url: "tel:988", description: "Call or text 988 for immediate mental health support." },
    { label: "Crisis Text Line", url: "sms:741741", description: "Text HOME to 741741 to connect with a crisis counselor." }
  ],
  'wealth': [
    { label: "AnnualCreditReport.com", url: "https://www.annualcreditreport.com/", description: "The only federally authorized free credit report site." },
    { label: "National Foundation for Credit Counseling", url: "https://www.nfcc.org/", description: "Find legitimate, non-profit debt relief." }
  ],
  'career': [
    { label: "Department of Labor (Worker Rights)", url: "https://www.dol.gov/agencies/whd", description: "Report wage theft or unsafe working conditions." },
    { label: "Glassdoor Salaries", url: "https://www.glassdoor.com/Salaries/index.htm", description: "Benchmark your salary before negotiations." }
  ],
  'mechanic': [
    { label: "RepairPal Estimates", url: "https://repairpal.com/", description: "Get a verified, fair-price estimate before going to a shop." },
    { label: "NHTSA Recalls", url: "https://www.nhtsa.gov/recalls", description: "Check if your vehicle has an active safety recall." }
  ],
  'tutor': [
    { label: "Khan Academy", url: "https://www.khanacademy.org/", description: "Free, world-class education for anyone, anywhere." },
    { label: "Coursera", url: "https://www.coursera.org/", description: "Professional certificates and degrees." }
  ],
  'pastor': [
    { label: "Bible Gateway", url: "https://www.biblegateway.com/", description: "Searchable online Bible in over 200 versions." },
    { label: "Focus on the Family Counseling", url: "https://www.focusonthefamily.com/get-help/", description: "Christian counseling consultations." }
  ],
  'vitality': [
    { label: "Examine.com", url: "https://examine.com/", description: "Independent clinical research on supplements and nutrition." },
    { label: "CDC Physical Activity Guidelines", url: "https://www.cdc.gov/physicalactivity/basics/index.htm", description: "Federal guidelines for health and fitness." }
  ],
  'hype': [
    { label: "Google Trends", url: "https://trends.google.com/trends/", description: "See what the world is searching for right now." },
    { label: "Answer The Public", url: "https://answerthepublic.com/", description: "Discover what questions people are asking." }
  ],
  'bestie': [
    { label: "Meetup.com", url: "https://www.meetup.com/", description: "Find local groups and communities based on your interests." }
  ]
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
 { id: 'mechanic', name: 'The Tech Specialist', serviceLabel: 'MASTER FIXER', description: 'Technical Lead', protectiveJob: 'Technical Lead', spokenHook: 'Technical manual loaded. Tell me the issues and I’ll walk you through the fix.', briefing: 'I provide step-by-step repair guides.', color: 'gray', requiredTier: 'pro', icon: Wrench, capabilities: ['Car repair', 'Tech troubleshooting'], fixedVoice: 'echo' },
 { id: 'tutor', name: 'The Master Tutor', serviceLabel: 'KNOWLEDGE BRIDGE', description: 'Education Lead', protectiveJob: 'Education Lead', spokenHook: 'Class is in session. I can break down any subject until it clicks.', briefing: 'I provide academic tutoring.', color: 'purple', requiredTier: 'pro', icon: Zap, capabilities: ['Skill acquisition', 'Simplification'], fixedVoice: 'fable' },
 { id: 'pastor', name: 'The Pastor', serviceLabel: 'FAITH ANCHOR', description: 'Spiritual Lead', protectiveJob: 'Spiritual Lead', spokenHook: 'Peace be with you. I am here for prayer, scripture, and moral clarity.', briefing: 'I provide spiritual counseling.', color: 'gold', requiredTier: 'pro', icon: BookOpen, capabilities: ['Prayer', 'Scripture guidance'], fixedVoice: 'onyx' },
 { id: 'vitality', name: 'The Vitality Coach', serviceLabel: 'HEALTH OPTIMIZER', description: 'Fitness & Food', protectiveJob: 'Wellness Lead', spokenHook: 'Let’s optimize your engine. Fuel and movement—what’s the goal today?', briefing: 'I provide workout and meal plans.', color: 'green', requiredTier: 'max', icon: Activity, capabilities: ['Meal planning', 'Habit building'], fixedVoice: 'nova' },
 { id: 'hype', name: 'The Hype Strategist', serviceLabel: 'CREATIVE DIRECTOR', description: 'Viral Specialist', protectiveJob: 'Creative Lead', spokenHook: 'Let’s make some noise! I’m here for hooks, jokes, and viral strategy.', briefing: 'I provide viral content strategy.', color: 'orange', requiredTier: 'pro', icon: Laugh, capabilities: ['Viral hooks', 'Humor'], fixedVoice: 'shimmer' },
 { id: 'bestie', name: 'The Bestie', serviceLabel: 'RIDE OR DIE', description: 'Inner Circle', protectiveJob: 'Loyalty Lead', spokenHook: 'I’ve got your back, 100%. No filters, no judgment. What’s actually going on?', briefing: 'I provide blunt life advice.', color: 'pink', requiredTier: 'pro', icon: Heart, capabilities: ['Venting space', 'Secret keeping'], fixedVoice: 'nova' }
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

const detectExpertSuggestion = (messages: Message[], currentId: string, userTier: string): PersonaConfig | null => {
  const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
  if (!lastUserMsg) return null;
  
  const lower = lastUserMsg.content.toLowerCase();
  for (const [id, keywords] of Object.entries(EXPERT_TRIGGERS)) {
    if (id === currentId) continue;
    if (keywords.some(k => lower.includes(k))) {
      const expert = PERSONAS.find(p => p.id === id);
      if (expert && canAccessPersona(expert, userTier)) return expert;
    }
  }
  return null;
};

const getDeviceId = () => {
  let deviceId = localStorage.getItem('lylo_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : 'dev_' + Date.now() + Math.random().toString(36).substring(2);
    localStorage.setItem('lylo_device_id', deviceId);
  }
  return deviceId;
};

function ChatInterface({ currentPersona: initialPersona, userEmail = '', onPersonaChange = () => {}, onLogout = () => {}, onUsageUpdate = () => {} }: ChatInterfaceProps) {
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => initialPersona || PERSONAS[0]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [userName, setUserName] = useState<string>('User');
 const [bestieConfig, setBestieConfig] = useState<BestieConfig | null>(null);
 const [showBestieSetup, setShowBestieSetup] = useState(false);
 const [setupStep, setSetupStep] = useState<'gender' | 'voice'>('gender');
 const [tempGender, setTempGender] = useState<'male' | 'female'>('female');
 const [isRecording, setIsRecording] = useState(false);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [showDropdown, setShowDropdown] = useState(false);
 const [showCameraMenu, setShowCameraMenu] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [communicationStyle, setCommunicationStyle] = useState<string>('standard');
 
 const [fontLevel, setFontLevel] = useState<number>(1);
 const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [showCrisisShield, setShowCrisisShield] = useState(false);
 const [showPersonaGrid, setShowPersonaGrid] = useState(true);
 
 const [showOnboarding, setShowOnboarding] = useState(false);
 const [onboardingStep, setOnboardingStep] = useState(1);
 const [deviceId] = useState(() => getDeviceId());

 const chatContainerRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const photoInputRef = useRef<HTMLInputElement>(null);
 const recognitionRef = useRef<any>(null);
 const isRecordingRef = useRef(false);
 const accumulatedRef = useRef<string>(''); 
 const inputTextRef = useRef<string>(''); 
 const currentlyPlayingAudioRef = useRef<HTMLAudioElement | null>(null);

 useEffect(() => {
  const emailRaw = userEmail.toLowerCase();
  const storedName = localStorage.getItem('userName');
  const storedTier = localStorage.getItem('userTier') as any;
  
  if (storedName) setUserName(storedName);
  else if (emailRaw.includes('stangman')) setUserName('Christopher');
  
  if (storedTier) setUserTier(storedTier);

  const savedBestie = localStorage.getItem('lylo_bestie_config');
  if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
  
  const savedStyle = localStorage.getItem('lylo_communication_style');
  if (savedStyle) setCommunicationStyle(savedStyle);

  const savedFont = localStorage.getItem('lylo_font_level');
  if (savedFont) setFontLevel(parseInt(savedFont, 10));

  const savedVoiceToggle = localStorage.getItem('lylo_voice_enabled');
  if (savedVoiceToggle !== null) setIsVoiceEnabled(savedVoiceToggle === 'true');

  const hasOnboarded = localStorage.getItem(`lylo_onboarded_${emailRaw}`);
  if (!hasOnboarded) {
    setShowOnboarding(true);
  }
 }, [userEmail]);

 useEffect(() => {
   const handleBeforeUnload = (e: BeforeUnloadEvent) => {
     e.preventDefault();
     e.returnValue = 'Are you sure you want to leave the LYLO OS? You will need to re-authenticate.';
     return e.returnValue;
   };

   const lockHistory = () => {
     window.history.pushState(null, "", window.location.href);
   };

   const handlePopState = (e: PopStateEvent) => {
     window.history.pushState(null, "", window.location.href);
     
     if (showOnboarding) {
        return;
     } else if (showDropdown) {
       setShowDropdown(false);
     } else if (showCameraMenu) {
       setShowCameraMenu(false);
     } else if (showCrisisShield) {
       setShowCrisisShield(false);
     } else if (!showPersonaGrid) {
       handleInternalBack();
     } else {
       alert("Use the Logout button in the menu to exit securely.");
     }
   };

   window.addEventListener('beforeunload', handleBeforeUnload);
   window.addEventListener('popstate', handlePopState);
   
   lockHistory();

   return () => {
     window.removeEventListener('beforeunload', handleBeforeUnload);
     window.removeEventListener('popstate', handlePopState);
   };
 }, [showPersonaGrid, showOnboarding, showDropdown, showCameraMenu, showCrisisShield]);

 useEffect(() => {
  if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
 }, [messages]);

 useEffect(() => {
    if (!selectedImage) {
        setPreviewUrl(null);
        return;
    }
    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);
 }, [selectedImage]);

 const fetchAudioSilently = async (text: string, voice?: string): Promise<HTMLAudioElement | null> => {
   if (!isVoiceEnabled) return null;
   try {
     const formData = new FormData();
     formData.append('text', text);
     formData.append('voice', voice || 'onyx');
     const response = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
     const data = await response.json();
     if (data.audio_b64) {
       return new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
     }
   } catch (e) { console.error("Audio fetch failed", e); }
   return null;
 };

 const playAudioSafely = (audioElement: HTMLAudioElement) => {
   if (currentlyPlayingAudioRef.current) {
     currentlyPlayingAudioRef.current.pause();
     currentlyPlayingAudioRef.current.currentTime = 0;
   }
   
   if (isRecordingRef.current) {
     isRecordingRef.current = false;
     setIsRecording(false);
     recognitionRef.current?.stop();
   }

   currentlyPlayingAudioRef.current = audioElement;
   setIsSpeaking(true);
   audioElement.onended = () => setIsSpeaking(false);
   audioElement.play();
 };

 useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
   const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
   const recognition = new SpeechRecognition();
   recognition.continuous = false; 
   recognition.interimResults = true; 
   recognition.lang = 'en-US';
   
   recognition.onresult = (event: any) => {
    if (isSpeaking) return;
    let interim = '', final = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }
    if (final) accumulatedRef.current += final + ' ';
    const fullText = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim();
    setInput(fullText);
    inputTextRef.current = fullText;
   };
   
   recognition.onend = () => { 
       if (isRecordingRef.current && !isSpeaking) recognition.start(); 
   };
   recognitionRef.current = recognition;
  }
 }, [isSpeaking]);

 const handleWalkieTalkieMic = () => {
  if (isRecording) {
   isRecordingRef.current = false;
   setIsRecording(false);
   recognitionRef.current?.stop();
   setTimeout(() => {
       if (inputTextRef.current.trim()) handleSend();
   }, 400);
  } else {
   if (isSpeaking) return;
   setIsRecording(true);
   isRecordingRef.current = true;
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
  
  const currentImagePreview = previewUrl;

  const userMsg: Message = { 
    id: Date.now().toString(), 
    content: text, 
    sender: 'user', 
    timestamp: new Date(),
    imageUrl: currentImagePreview 
  };
  setMessages(prev => [...prev, userMsg]);
  
  try {
   const formData = new FormData();
   formData.append('msg', text);
   formData.append('history', JSON.stringify(messages.slice(-6)));
   formData.append('persona', activePersona.id);
   formData.append('user_email', userEmail);
   formData.append('vibe', communicationStyle);
   formData.append('use_long_term_memory', 'true');
   formData.append('device_id', deviceId);
   
   if (selectedImage) {
     formData.append('file', selectedImage);
   }

   const apiResponse = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      body: formData,
   });

   if (!apiResponse.ok) throw new Error("API Network Error");
   const response = await apiResponse.json();

   const isLockout = response.threat_level === "high" && response.answer.includes("DEVICE LIMIT EXCEEDED");
   const voiceToUse = activePersona.id === 'bestie' ? bestieConfig?.voiceId : activePersona.fixedVoice;
   const audioToPlay = isLockout ? null : await fetchAudioSilently(response.answer, voiceToUse);

   const botMsg: Message = { 
     id: Date.now().toString(), 
     content: response.answer, 
     sender: 'bot', 
     timestamp: new Date(), 
     confidenceScore: response.confidence_score, 
     scamDetected: response.scam_detected 
   };
   
   setMessages(prev => [...prev, botMsg]);
   if (audioToPlay) playAudioSafely(audioToPlay);

  } catch (e) { console.error(e); } 
  finally { setLoading(false); setSelectedImage(null); }
 };

 const handlePersonaChange = async (persona: PersonaConfig) => {
  if (persona.id === 'bestie' && !bestieConfig) { setShowBestieSetup(true); return; }
  if (currentlyPlayingAudioRef.current) {
    currentlyPlayingAudioRef.current.pause();
    currentlyPlayingAudioRef.current.currentTime = 0;
  }
  setActivePersona(persona);
  onPersonaChange(persona);
  setShowDropdown(false);
  setShowPersonaGrid(false);
  setLoading(true);
  const hookText = persona.spokenHook.replace('{userName}', userName);
  const voiceToUse = persona.id === 'bestie' ? bestieConfig?.voiceId : persona.fixedVoice;
  const audioToPlay = await fetchAudioSilently(hookText, voiceToUse);
  const hookMsg: Message = { id: Date.now().toString(), content: hookText, sender: 'bot', timestamp: new Date() };
  setMessages([hookMsg]);
  if (audioToPlay) playAudioSafely(audioToPlay);
  setLoading(false);
 };

 const handleBestieSetupComplete = (voiceId: string) => {
   const config: BestieConfig = { gender: tempGender, voiceId, vibeLabel: tempGender === 'male' ? 'The Bro' : 'The Bestie' };
   setBestieConfig(config);
   localStorage.setItem('lylo_bestie_config', JSON.stringify(config));
   setShowBestieSetup(false);
   const bestiePersona = PERSONAS.find(p => p.id === 'bestie');
   if (bestiePersona) handlePersonaChange(bestiePersona);
 };

 const handleInternalBack = () => {
   setMessages([]);
   setShowPersonaGrid(true);
   if (currentlyPlayingAudioRef.current) {
     currentlyPlayingAudioRef.current.pause();
     currentlyPlayingAudioRef.current.currentTime = 0;
   }
   setIsSpeaking(false);
 };

 const cycleFontSize = () => {
   const nextLevel = fontLevel >= 4 ? 1 : fontLevel + 1;
   setFontLevel(nextLevel);
   localStorage.setItem('lylo_font_level', nextLevel.toString());
 };

 const toggleVoice = () => {
   const newState = !isVoiceEnabled;
   setIsVoiceEnabled(newState);
   localStorage.setItem('lylo_voice_enabled', newState.toString());
   if (!newState && currentlyPlayingAudioRef.current) {
     currentlyPlayingAudioRef.current.pause();
     currentlyPlayingAudioRef.current.currentTime = 0;
     setIsSpeaking(false);
   }
 };

 const completeOnboarding = () => {
   localStorage.setItem(`lylo_onboarded_${userEmail.toLowerCase()}`, 'true');
   setShowOnboarding(false);
 };

 const getDynamicFontSize = () => {
   switch(fontLevel) {
     case 1: return 'text-sm leading-normal';
     case 2: return 'text-lg leading-relaxed';
     case 3: return 'text-2xl leading-relaxed tracking-wide';
     case 4: return 'text-4xl leading-loose tracking-wide font-black';
     default: return 'text-sm leading-normal';
   }
 };

 const getInputFontSize = () => {
   switch(fontLevel) {
     case 1: return 'text-sm';
     case 2: return 'text-lg';
     case 3: return 'text-xl';
     case 4: return 'text-2xl'; 
     default: return 'text-sm';
   }
 };

 if (showOnboarding) {
   return (
     <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-4 z-[999999] overflow-y-auto">
       <div className="bg-[#111] border border-blue-500/30 rounded-3xl w-full max-w-lg p-6 shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
           <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(onboardingStep / 3) * 100}%` }}></div>
         </div>
         {onboardingStep === 1 && (
           <div className="animate-in fade-in zoom-in-95 duration-300">
             <div className="flex items-center gap-4 mb-6">
               <Shield className="w-10 h-10 text-blue-500 fill-current" />
               <div>
                 <h2 className="text-white font-black text-2xl uppercase tracking-widest leading-none">System Briefing</h2>
                 <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1">Security Clearance Granted</p>
               </div>
             </div>
             <div className="space-y-4 mb-8 text-gray-300 text-sm leading-relaxed max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
               <p><strong className="text-white">Read this entirely.</strong> You are no longer just searching the web. You are now backed by a proactive Digital Task Force. Here is the telemetry under the hood:</p>
               <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                 <strong className="text-white flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-purple-400" /> 1. THE WAR ROOM (Dual-Brain)</strong>
                 <p className="text-xs text-gray-400">Your prompt is injected into both GPT-4o and Gemini 1.5 Pro. They battle it out, verify the data, and deliver the highest-confidence consensus.</p>
               </div>
               <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                 <strong className="text-white flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-green-400" /> 2. THE TRUTH PROTOCOL</strong>
                 <p className="text-xs text-gray-400">Most AIs "hallucinate". Lylo will not make up an answer. You will get 100% honest, tactical truth, or we will ask for more intel.</p>
               </div>
               <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                 <strong className="text-white flex items-center gap-2 mb-1"><Lock className="w-4 h-4 text-blue-400" /> 3. IRONCLAD PRIVACY</strong>
                 <p className="text-xs text-gray-400">Your identity is cryptographically hashed. We never sell your data, and your private conversations are never used to train public AI models.</p>
               </div>
               <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                 <strong className="text-white flex items-center gap-2 mb-1"><CameraIcon className="w-4 h-4 text-pink-400" /> 4. VISUAL SENSORS</strong>
                 <p className="text-xs text-gray-400">Upload photos. Have the Mechanic scan your engine. Have the Lawyer read a lease. We do not just describe the photo—we analyze the consequences.</p>
               </div>
             </div>
             <button onClick={() => setOnboardingStep(2)} className="w-full py-4 bg-blue-600 text-white font-black uppercase rounded-xl tracking-widest flex justify-center items-center gap-2 hover:bg-blue-500 transition-all">
               Acknowledge & Continue <ArrowRight className="w-5 h-5" />
             </button>
           </div>
         )}
         {onboardingStep === 2 && (
           <div className="animate-in fade-in slide-in-from-right-8 duration-300">
             <div className="flex items-center gap-4 mb-6">
               <Sliders className="w-10 h-10 text-purple-500" />
               <div>
                 <h2 className="text-white font-black text-2xl uppercase tracking-widest leading-none">Calibrate HUD</h2>
                 <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mt-1">Interface Setup</p>
               </div>
             </div>
             <div className="space-y-6 mb-8">
               <div>
                 <p className="text-xs text-gray-400 uppercase font-black tracking-widest mb-3">Communication Style</p>
                 <select value={communicationStyle} onChange={(e) => { setCommunicationStyle(e.target.value); localStorage.setItem('lylo_communication_style', e.target.value); }} className="w-full bg-white/10 text-white p-4 rounded-xl font-bold border border-white/10">
                   <option value="standard">Standard Tone (Direct & Helpful)</option>
                   <option value="business">Business Professional (Formal)</option>
                   <option value="roast">Roast Mode (Brutally Straight)</option>
                 </select>
               </div>
               <div>
                 <p className="text-xs text-gray-400 uppercase font-black tracking-widest mb-3">Text Display Size</p>
                 <button onClick={cycleFontSize} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
                   <div className="flex items-center gap-3">
                     <Type className="w-5 h-5 text-blue-400" />
                     <span className="font-bold">Text Size</span>
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-blue-400">Level {fontLevel}</span>
                 </button>
               </div>
               <div>
                 <p className="text-xs text-gray-400 uppercase font-black tracking-widest mb-3">Voice Output</p>
                 <button onClick={toggleVoice} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
                   <div className="flex items-center gap-3">
                     {isVoiceEnabled ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                     <span className="font-bold">Voice System</span>
                   </div>
                   <span className={`text-xs font-black uppercase tracking-widest ${isVoiceEnabled ? 'text-green-400' : 'text-red-400'}`}>{isVoiceEnabled ? 'ON' : 'MUTED'}</span>
                 </button>
               </div>
             </div>
             <button onClick={() => setOnboardingStep(3)} className="w-full py-4 bg-purple-600 text-white font-black uppercase rounded-xl tracking-widest flex justify-center items-center gap-2 hover:bg-purple-500 transition-all">
               Confirm Settings <ArrowRight className="w-5 h-5" />
             </button>
           </div>
         )}
         {onboardingStep === 3 && (
           <div className="animate-in fade-in slide-in-from-right-8 duration-300">
             <div className="flex items-center gap-4 mb-6">
               <Lock className="w-10 h-10 text-red-500" />
               <div>
                 <h2 className="text-white font-black text-2xl uppercase tracking-widest leading-none">Security Lock</h2>
                 <p className="text-red-400 text-xs font-bold uppercase tracking-widest mt-1">Device Authorization</p>
               </div>
             </div>
             <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl mb-8">
               <h3 className="text-red-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> DEVICE LIMIT DETECTED</h3>
               <p className="text-gray-300 text-sm leading-relaxed">
                 Your Lylo OS clearance is cryptographically tied to your specific hardware. To ensure peak server performance and ironclad privacy, your account is strictly limited to <strong>two (2) active devices</strong>.
                 <br/><br/>
                 Any unauthorized attempt to breach this limit from a third device will result in an immediate access denial. Do not share your clearance credentials.
               </p>
             </div>
             <button onClick={completeOnboarding} className="w-full py-4 bg-green-600 text-white font-black uppercase rounded-xl tracking-widest flex justify-center items-center gap-2 hover:bg-green-500 transition-all">
               Initialize System <CheckCircle className="w-5 h-5" />
             </button>
           </div>
         )}
       </div>
     </div>
   );
 }

 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans z-[99999]">
   <div className="bg-black/90 border-b border-white/10 p-3 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     <div className="relative flex gap-2 z-10">
      {!showPersonaGrid && (
        <button onClick={handleInternalBack} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors">
        <Menu className="w-5 h-5" />
      </button>
      {showDropdown && (
       <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-2xl p-5 min-w-[280px] shadow-2xl z-[100001] max-h-[80vh] overflow-y-auto">
        <div className="mb-6">
          <p className="text-[10px] text-gray-500 uppercase font-black mb-3">Communication Style</p>
          <select value={communicationStyle} onChange={(e) => { setCommunicationStyle(e.target.value); localStorage.setItem('lylo_communication_style', e.target.value); }} className="w-full bg-white/10 text-white p-3 rounded-xl font-bold mb-4">
            <option value="standard">Standard Tone</option>
            <option value="business">Business Professional</option>
            <option value="roast">Roast Mode</option>
          </select>
        </div>
        
        <div className="mb-6 space-y-3">
          <button onClick={cycleFontSize} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <Type className="w-5 h-5 text-blue-400" />
              <span className="font-bold">Text Size</span>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Level {fontLevel}</span>
          </button>
          
          <button onClick={toggleVoice} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              {isVoiceEnabled ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
              <span className="font-bold">Voice Output</span>
            </div>
            <span className={`text-xs font-black uppercase tracking-widest ${isVoiceEnabled ? 'text-green-400' : 'text-red-400'}`}>{isVoiceEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button onClick={() => { setShowDropdown(false); setShowOnboarding(true); setOnboardingStep(1); }} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-400" />
              <span className="font-bold">System Briefing</span>
            </div>
          </button>
        </div>

        <button onClick={onLogout} className="w-full p-4 text-red-500 font-black uppercase flex items-center justify-center gap-2 border border-red-500/20 rounded-xl"><LogOut className="w-4 h-4"/> Terminate Session</button>
       </div>
      )}
     </div>
     
     <div className="text-center absolute left-1/2 -translate-x-1/2 w-1/3">
      <h1 className="text-white font-black text-2xl tracking-[0.2em] leading-none">
        L<span className={getPersonaColorClass(activePersona, 'text')}>Y</span>LO
      </h1>
      <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.3em] mt-1 truncate">{activePersona.serviceLabel}</p>
     </div>

     <div className="flex items-center gap-2 z-10">
      <div className="flex flex-col items-end justify-center mr-1">
        <p className="text-white font-black text-[10px] uppercase leading-none max-w-[70px] truncate">{userName}</p>
        <p className="text-[8px] text-green-500 font-black mt-1 uppercase tracking-widest">{userTier}</p>
      </div>
      <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse hover:bg-red-500 hover:text-white transition-all">
        <Shield className="w-5 h-5 fill-current" />
      </button>
     </div>
    </div>
   </div>

   {showCrisisShield && (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100002] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-red-500/50 rounded-3xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500 fill-current" />
            <div>
              <h2 className="text-white font-black text-xl uppercase tracking-widest">Emergency Hub</h2>
              <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-1">Direct Federal & Professional Links</p>
            </div>
          </div>
          <button onClick={() => setShowCrisisShield(false)} className="p-2 bg-white/5 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-300">Direct resources for <strong>{activePersona.name}</strong>:</p>
          <div className="space-y-3">
            {(CRISIS_LINKS[activePersona.id] || []).map((link, idx) => (
              <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="block p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white font-bold">{link.label}</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400">{link.description}</p>
              </a>
            ))}
          </div>
        </div>
        <button onClick={() => setShowCrisisShield(false)} className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-xl tracking-widest">Return to OS</button>
      </div>
    </div>
   )}

   {showBestieSetup && (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100005] flex items-center justify-center p-4">
      <div className="bg-pink-900/20 border border-pink-500/30 rounded-3xl w-full max-w-sm p-6 shadow-[0_0_50px_rgba(236,72,153,0.15)] text-center">
        <Heart className="w-12 h-12 text-pink-400 mx-auto mb-4 fill-current" />
        <h2 className="text-white font-black text-2xl uppercase tracking-widest mb-2">Build Your Bestie</h2>
        <p className="text-gray-400 text-sm mb-6">Who do you want in your corner?</p>
        
        {setupStep === 'gender' && (
          <div className="space-y-4">
            <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 hover:border-pink-400 rounded-2xl text-white font-bold transition-all">
              The Girls (Female)
            </button>
            <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 hover:border-blue-400 rounded-2xl text-white font-bold transition-all">
              The Bros (Male)
            </button>
          </div>
        )}

        {setupStep === 'voice' && tempGender === 'female' && (
          <div className="space-y-3">
            <p className="text-xs text-pink-300 uppercase tracking-widest font-bold mb-2">Select Her Voice</p>
            <button onClick={() => handleBestieSetupComplete('nova')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Nova (Warm & Upbeat)</button>
            <button onClick={() => handleBestieSetupComplete('shimmer')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Shimmer (Clear & Direct)</button>
            <button onClick={() => handleBestieSetupComplete('alloy')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Alloy (Neutral & Calm)</button>
          </div>
        )}

        {setupStep === 'voice' && tempGender === 'male' && (
          <div className="space-y-3">
            <p className="text-xs text-blue-300 uppercase tracking-widest font-bold mb-2">Select His Voice</p>
            <button onClick={() => handleBestieSetupComplete('onyx')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Onyx (Deep & Serious)</button>
            <button onClick={() => handleBestieSetupComplete('echo')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Echo (Warm & Friendly)</button>
            <button onClick={() => handleBestieSetupComplete('fable')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Fable (Expressive & British)</button>
          </div>
        )}

        <button onClick={() => { setShowBestieSetup(false); setSetupStep('gender'); }} className="mt-6 text-gray-500 text-xs font-bold uppercase">Cancel Setup</button>
      </div>
    </div>
   )}

   <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative p-4 space-y-6" style={{ paddingBottom: '300px' }}>
    
    {showPersonaGrid && (
     <div className="grid grid-cols-2 gap-3">
      {PERSONAS.map(p => (
       <button key={p.id} onClick={() => handlePersonaChange(p)} className={`p-6 rounded-3xl border flex flex-col items-center gap-4 transition-all ${activePersona.id === p.id ? `${getPersonaColorClass(p, 'bg')} border-transparent` : 'bg-white/5 border-white/10'}`}>
        <p.icon className={`w-8 h-8 ${activePersona.id === p.id ? 'text-white' : getPersonaColorClass(p, 'text')}`} />
        <span className="text-[10px] text-white font-black uppercase tracking-widest text-center">{p.name}</span>
       </button>
      ))}
     </div>
    )}

    {messages.map((msg, idx) => {
     const isLatestBot = msg.sender === 'bot' && idx === messages.length - 1;
     const suggestion = isLatestBot && !msg.imageUrl ? detectExpertSuggestion(messages, activePersona.id, userTier) : null;
     return (
      <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
       
       {msg.imageUrl && (
         <div className="mb-2 max-w-[85%] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
           <img src={msg.imageUrl} alt="Uploaded" className="w-full h-auto object-cover max-h-[300px]" />
         </div>
       )}

       <div className={`p-5 rounded-3xl max-w-[85%] ${getDynamicFontSize()} shadow-lg ${msg.sender === 'user' ? `${getPersonaColorClass(activePersona, 'bg')} text-white font-bold rounded-tr-none` : 'bg-white/10 text-gray-100 border border-white/10 rounded-tl-none'}`}>
        {msg.content}
        {msg.sender === 'bot' && msg.confidenceScore && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1">
              <span>System Confidence</span>
              <span className="text-green-400">{msg.confidenceScore}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${msg.confidenceScore}%` }}></div>
            </div>
          </div>
        )}
       </div>
       
       {suggestion && (
        <div className="mt-4 w-full max-w-[85%] p-5 bg-indigo-600 border border-indigo-400 rounded-[32px] shadow-2xl animate-in zoom-in-95">
         <div className="flex items-center gap-3 mb-4 text-white">
           <Zap className="w-4 h-4 fill-current" />
           <p className="text-[11px] font-black uppercase tracking-widest">Expert Transition Found</p>
         </div>
         <button onClick={() => handlePersonaChange(suggestion)} className="w-full py-4 bg-white text-indigo-700 text-xs font-black uppercase rounded-2xl flex items-center justify-center gap-3">
          Transfer to {suggestion.name} <ArrowRight className="w-5 h-5" />
         </button>
        </div>
       )}
      </div>
     );
    })}

    {loading && (
      <div className="flex justify-start">
        <div className="p-5 rounded-3xl bg-white/5 border border-white/10 rounded-tl-none flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    )}
   </div>

   <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 p-4 z-[100] pb-10">
    <div className="max-w-md mx-auto space-y-4">
     
     {previewUrl && (
       <div className="flex justify-center mb-2 animate-in slide-in-from-bottom-2">
         <div className="relative group">
           <img src={previewUrl} className="w-24 h-24 object-cover rounded-2xl border-2 border-indigo-500 shadow-2xl" alt="Preview" />
           <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg">
             <X className="w-4 h-4" />
           </button>
         </div>
       </div>
     )}

     <div className="flex gap-2 mb-2">
       <button onClick={handleWalkieTalkieMic} disabled={loading} className={`w-full py-5 rounded-[32px] font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-black'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {isRecording ? <><MicOff className="w-5 h-5"/> STOP & SEND</> : <><Mic className="w-5 h-5"/> ENGAGE VOICE</>}
       </button>
     </div>
     
     <div className="flex gap-2">
      <div className="relative">
        <button onClick={() => setShowCameraMenu(!showCameraMenu)} disabled={loading} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-colors h-full flex items-center disabled:opacity-50">
          <Camera className="w-6 h-6" />
        </button>
        {showCameraMenu && (
          <div className="absolute bottom-16 left-0 bg-[#111] border border-white/10 rounded-2xl p-2 min-w-[180px] shadow-2xl z-[100003] animate-in slide-in-from-bottom-2">
            <button onClick={() => { photoInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full p-4 flex items-center gap-3 text-white font-bold text-sm hover:bg-white/5 rounded-xl transition-colors">
              <CameraIcon className="w-5 h-5 text-blue-400" /> Take Photo
            </button>
            <div className="h-px w-full bg-white/5 my-1"></div>
            <button onClick={() => { fileInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full p-4 flex items-center gap-3 text-white font-bold text-sm hover:bg-white/5 rounded-xl transition-colors">
              <ImageIcon className="w-5 h-5 text-purple-400" /> Upload Image
            </button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
      <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
      
      <input value={input} onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }} disabled={loading} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} placeholder={`Command ${activePersona.name}...`} className={`flex-1 bg-white/10 border border-white/10 rounded-2xl px-5 py-4 ${getInputFontSize()} text-white outline-none font-bold min-w-0 disabled:opacity-50`} />
      
      <button onClick={handleSend} disabled={loading} className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-500 transition-colors flex items-center justify-center disabled:opacity-50">
        <ArrowRight className="w-6 h-6" />
      </button>
     </div>
     
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
