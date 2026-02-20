import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2,
 Filter, Sparkles, ChevronRight, ChevronLeft, MessageSquare, Heart, Info, ExternalLink,
 Menu, Image as ImageIcon, Camera as CameraIcon
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

const REAL_INTEL_DROPS: { [key: string]: string } = {
  'guardian': "URGENT SECURITY INTEL: I've detected a massive spike in 'Toll Road' smishing. 437 new fraudulent E-ZPass sites were registered this week targeting California residents. If you get a text about unpaid tolls, it is a 100% trap.",
  'wealth': "MARKET INTEL: I found a high-yield opportunity at 4.09% APY—that is 7x the national average. Based on your goals, shifting $100 to this account today would net you an extra $55 in annual interest.",
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
 { id: 'mechanic', name: 'The Tech Specialist', serviceLabel: 'MASTER FIXER', description: 'Technical Lead', protectiveJob: 'Technical Lead', spokenHook: 'Technical manual loaded. Tell me the symptoms and I’ll walk you through the fix.', briefing: 'I provide step-by-step repair guides.', color: 'gray', requiredTier: 'pro', icon: Wrench, capabilities: ['Car repair', 'Tech troubleshooting'], fixedVoice: 'echo' },
 { id: 'tutor', name: 'The Master Tutor', serviceLabel: 'KNOWLEDGE BRIDGE', description: 'Education Lead', protectiveJob: 'Education Lead', spokenHook: 'Class is in session. I can break down any subject until it clicks.', briefing: 'I provide academic tutoring.', color: 'purple', requiredTier: 'pro', icon: Zap, capabilities: ['Skill acquisition', 'Simplification'], fixedVoice: 'fable' },
 { id: 'pastor', name: 'The Pastor', serviceLabel: 'FAITH ANCHOR', description: 'Spiritual Lead', protectiveJob: 'Spiritual Lead', spokenHook: 'Peace be with you. I am here for prayer, scripture, and moral clarity.', briefing: 'I provide spiritual counseling.', color: 'gold', requiredTier: 'pro', icon: BookOpen, capabilities: ['Prayer', 'Scripture guidance'], fixedVoice: 'onyx' },
 { id: 'vitality', name: 'The Vitality Coach', serviceLabel: 'HEALTH OPTIMIZER', description: 'Fitness & Food', protectiveJob: 'Wellness Lead', spokenHook: 'Let’s optimize your engine. Fuel and movement—what’s the goal today?', briefing: 'I provide workout and meal plans.', color: 'green', requiredTier: 'max', icon: Activity, capabilities: ['Meal planning', 'Habit building'], fixedVoice: 'nova' },
 { id: 'hype', name: 'The Hype Strategist', serviceLabel: 'CREATIVE DIRECTOR', description: 'Viral Specialist', protectiveJob: 'Creative Lead', spokenHook: 'Let’s make some noise! I’m here for hooks, jokes, and viral strategy.', briefing: 'I provide viral content strategy.', color: 'orange', requiredTier: 'pro', icon: Laugh, capabilities: ['Viral hooks', 'Humor'], fixedVoice: 'shimmer' },
 { id: 'bestie', name: 'The Bestie', serviceLabel: 'RIDE OR DIE', description: 'Inner Circle', protectiveJob: 'Loyalty Lead', spokenHook: 'I’ve got your back, 100%. No filters, no judgment. What’s actually going on?', briefing: 'I provide blunt life advice.', color: 'pink', requiredTier: 'pro', icon: Heart, capabilities: ['Venting space', 'Secret keeping'], fixedVoice: 'nova' }
];

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
  red: { border: 'border-red-400', glow: 'shadow-[0_0_20_rgba(239,68,68,0.3)]', bg: 'bg-red-500', text: 'text-red-400' },
  green: { border: 'border-green-400', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]', bg: 'bg-green-500', text: 'text-green-400' }
 };
 return colorMap[persona.color]?.[type] || colorMap.blue[type];
};

function ChatInterface({ currentPersona: initialPersona, userEmail = '', onPersonaChange = () => {}, onLogout = () => {}, onUsageUpdate = () => {} }: ChatInterfaceProps) {
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
 const [isRecording, setIsRecording] = useState(false);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [showDropdown, setShowDropdown] = useState(false);
 const [showCameraMenu, setShowCameraMenu] = useState(false);
 const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('max');
 const [communicationStyle, setCommunicationStyle] = useState<string>('standard');
 const [fontLevel, setFontLevel] = useState<number>(1);
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [showCrisisShield, setShowCrisisShield] = useState(false);
 const [showPersonaGrid, setShowPersonaGrid] = useState(true);

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
  const allDrops = Object.keys(REAL_INTEL_DROPS);
  const cleared = JSON.parse(localStorage.getItem('lylo_cleared_intel') || '[]');
  setNotifications(allDrops.filter(id => !cleared.includes(id)).sort(() => 0.5 - Math.random()).slice(0, 3));
 }, [userEmail]);

 useEffect(() => {
  if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
 }, [messages]);

 useEffect(() => {
    if (!selectedImage) { setPreviewUrl(null); return; }
    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);
 }, [selectedImage]);

 // --- ECHO KILLER LOGIC ---
 const playAudioSafely = (audioElement: HTMLAudioElement) => {
   if (currentlyPlayingAudioRef.current) {
     currentlyPlayingAudioRef.current.pause();
     currentlyPlayingAudioRef.current.currentTime = 0;
   }
   
   // FORCE STOP MIC TO PREVENT ECHO
   if (isRecordingRef.current) {
     recognitionRef.current?.stop();
     isRecordingRef.current = false;
     setIsRecording(false);
   }

   currentlyPlayingAudioRef.current = audioElement;
   setIsSpeaking(true);
   
   audioElement.onended = () => {
     setIsSpeaking(false);
   };
   
   audioElement.play();
 };

 useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
   const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
   const recognition = new SpeechRecognition();
   recognition.continuous = true; 
   recognition.interimResults = true; 
   recognition.lang = 'en-US';
   
   recognition.onresult = (event: any) => {
    if (isSpeaking) return; // IGNORE INPUT WHILE AI SPEAKS
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }
    if (final) accumulatedRef.current += final + ' ';
    const fullText = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim();
    setInput(fullText);
    inputTextRef.current = fullText;
   };

   recognition.onend = () => {
    if (isRecordingRef.current && !isSpeaking) {
        recognition.start();
    }
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
   }, 300);
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
  const userMsg: Message = { id: Date.now().toString(), content: text, sender: 'user', timestamp: new Date(), imageUrl: currentImagePreview };
  setMessages(prev => [...prev, userMsg]);
  try {
   const response = await sendChatMessage(text, messages, activePersona.id, userEmail, selectedImage, 'en', communicationStyle);
   const voiceToUse = activePersona.id === 'bestie' ? bestieConfig?.voiceId : activePersona.fixedVoice;
   
   // Fetch audio
   const formData = new FormData();
   formData.append('text', response.answer);
   formData.append('voice', voiceToUse || 'onyx');
   const audioRes = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
   const audioData = await audioRes.json();
   
   const botMsg: Message = { id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(), confidenceScore: response.confidence_score, scamDetected: response.scam_detected };
   setMessages(prev => [...prev, botMsg]);

   if (audioData.audio_b64) {
     const audio = new Audio(`data:audio/mp3;base64,${audioData.audio_b64}`);
     playAudioSafely(audio);
   }
  } catch (e) { console.error(e); } 
  finally { setLoading(false); setSelectedImage(null); }
 };

 const handlePersonaChange = async (persona: PersonaConfig) => {
  if (persona.id === 'bestie' && !bestieConfig) { setShowBestieSetup(true); return; }
  if (currentlyPlayingAudioRef.current) { currentlyPlayingAudioRef.current.pause(); currentlyPlayingAudioRef.current.currentTime = 0; }
  setActivePersona(persona);
  onPersonaChange(persona);
  setShowDropdown(false);
  setShowPersonaGrid(false);
  setLoading(true);
  const hookText = persona.spokenHook.replace('{userName}', userName);
  const voiceToUse = persona.id === 'bestie' ? bestieConfig?.voiceId : persona.fixedVoice;
  
  const formData = new FormData();
  formData.append('text', hookText);
  formData.append('voice', voiceToUse || 'onyx');
  const audioRes = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
  const audioData = await audioRes.json();
  
  const hookMsg: Message = { id: Date.now().toString(), content: hookText, sender: 'bot', timestamp: new Date() };
  setMessages([hookMsg]);

  if (audioData.audio_b64) {
    const audio = new Audio(`data:audio/mp3;base64,${audioData.audio_b64}`);
    playAudioSafely(audio);
  }
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
   if (currentlyPlayingAudioRef.current) { currentlyPlayingAudioRef.current.pause(); currentlyPlayingAudioRef.current.currentTime = 0; }
   setIsSpeaking(false);
 };

 const cycleFontSize = () => {
   const nextLevel = fontLevel >= 4 ? 1 : fontLevel + 1;
   setFontLevel(nextLevel);
   localStorage.setItem('lylo_font_level', nextLevel.toString());
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

 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans z-[99999]">
   {/* HEADER */}
   <div className="bg-black/90 border-b border-white/10 p-3 flex-shrink-0 z-50">
    <div className="flex items-center justify-between">
     <div className="relative flex gap-2 z-10">
      {!showPersonaGrid && (
        <button onClick={handleInternalBack} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
      )}
      <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors"><Menu className="w-5 h-5" /></button>
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
        <button onClick={onLogout} className="w-full p-4 text-red-500 font-black uppercase flex items-center justify-center gap-2 border border-red-500/20 rounded-xl"><LogOut className="w-4 h-4"/> Terminate Session</button>
       </div>
      )}
     </div>
     <div className="text-center absolute left-1/2 -translate-x-1/2 w-1/3">
      <h1 className="text-white font-black text-2xl tracking-[0.2em] leading-none">L<span className={getPersonaColorClass(activePersona, 'text')}>Y</span>LO</h1>
      <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.3em] mt-1 truncate">{activePersona.serviceLabel}</p>
     </div>
     <div className="flex items-center gap-2 z-10">
      <div className="flex flex-col items-end justify-center mr-1">
        <p className="text-white font-black text-[10px] uppercase leading-none max-w-[70px] truncate">{userName}</p>
        <p className="text-[8px] text-green-500 font-black mt-1 uppercase tracking-widest">{userTier}</p>
      </div>
      <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"><Shield className="w-5 h-5 fill-current" /></button>
     </div>
    </div>
   </div>

   {/* EMERGENCY MODAL */}
   {showCrisisShield && (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100002] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-red-500/50 rounded-3xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500 fill-current" />
            <h2 className="text-white font-black text-xl uppercase tracking-widest">Emergency Hub</h2>
          </div>
          <button onClick={() => setShowCrisisShield(false)} className="p-2 bg-white/5 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="space-y-4 mb-6">
          {(CRISIS_LINKS[activePersona.id] || []).map((link, idx) => (
            <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="block p-4 bg-white/5 border border-white/10 rounded-2xl">
              <span className="text-white font-bold">{link.label}</span>
              <p className="text-xs text-gray-400">{link.description}</p>
            </a>
          ))}
        </div>
        <button onClick={() => setShowCrisisShield(false)} className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-xl">Return</button>
      </div>
    </div>
   )}

   {/* BESTIE SETUP */}
   {showBestieSetup && (
    <div className="fixed inset-0 bg-black/95 z-[100005] flex items-center justify-center p-4">
      <div className="bg-pink-900/20 border border-pink-500/30 rounded-3xl w-full max-w-sm p-6 text-center">
        <Heart className="w-12 h-12 text-pink-400 mx-auto mb-4 fill-current" />
        <h2 className="text-white font-black text-2xl uppercase tracking-widest mb-6">Build Your Bestie</h2>
        {setupStep === 'gender' ? (
          <div className="space-y-4">
            <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white font-bold">The Girls (Female)</button>
            <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white font-bold">The Bros (Male)</button>
          </div>
        ) : (
          <div className="space-y-3">
            {tempGender === 'female' ? (
              ['nova', 'shimmer', 'alloy'].map(v => <button key={v} onClick={() => handleBestieSetupComplete(v)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white uppercase font-bold">{v}</button>)
            ) : (
              ['onyx', 'echo', 'fable'].map(v => <button key={v} onClick={() => handleBestieSetupComplete(v)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white uppercase font-bold">{v}</button>)
            )}
          </div>
        )}
        <button onClick={() => setShowBestieSetup(false)} className="mt-6 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancel</button>
      </div>
    </div>
   )}

   {/* CHAT AREA */}
   <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6" style={{ paddingBottom: '300px' }}>
    {showPersonaGrid && (
     <div className="grid grid-cols-2 gap-3">
      {PERSONAS.map(p => (
       <button key={p.id} onClick={() => handlePersonaChange(p)} className={`p-6 rounded-3xl border flex flex-col items-center gap-4 transition-all ${activePersona.id === p.id ? `${getPersonaColorClass(p, 'bg')} border-transparent` : 'bg-white/5 border-white/10'}`}>
        <p.icon className={`w-8 h-8 ${activePersona.id === p.id ? 'text-white' : getPersonaColorClass(p, 'text')}`} />
        <span className="text-[10px] text-white font-black uppercase tracking-widest">{p.name}</span>
       </button>
      ))}
     </div>
    )}

    {messages.map((msg) => (
      <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
       {msg.imageUrl && <img src={msg.imageUrl} className="mb-2 max-w-[85%] rounded-2xl border border-white/10" />}
       <div className={`p-5 rounded-3xl max-w-[85%] ${getDynamicFontSize()} ${msg.sender === 'user' ? `${getPersonaColorClass(activePersona, 'bg')} text-white font-bold` : 'bg-white/10 text-gray-100 border border-white/10'}`}>
        {msg.content}
       </div>
      </div>
    ))}
    {loading && <div className="p-5 rounded-3xl bg-white/5 w-20 flex gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div></div>}
   </div>

   {/* FOOTER */}
   <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 p-4 z-[100] pb-10">
    <div className="max-w-md mx-auto space-y-4">
     {previewUrl && (
       <div className="flex justify-center mb-2">
         <div className="relative"><img src={previewUrl} className="w-24 h-24 object-cover rounded-2xl border-2 border-indigo-500" /><button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-4 h-4" /></button></div>
       </div>
     )}
     <div className="flex gap-2">
       <button onClick={cycleFontSize} className="w-1/3 py-3 bg-white/5 border border-white/10 rounded-[32px] text-white flex flex-col items-center justify-center font-black">A+ <span className="text-[8px] text-gray-400 uppercase">Text</span></button>
       <button onClick={handleWalkieTalkieMic} disabled={loading || isSpeaking} className={`w-2/3 py-5 rounded-[32px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isRecording ? 'bg-red-500 text-white' : 'bg-white text-black'} disabled:opacity-30`}>
        {isRecording ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>} {isRecording ? 'STOP' : 'VOICE'}
       </button>
     </div>
     <div className="flex gap-2">
      <button onClick={() => setShowCameraMenu(!showCameraMenu)} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400"><Camera className="w-6 h-6" /></button>
      <input value={input} onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={`Command...`} className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-5 text-white font-bold outline-none" />
      <button onClick={handleSend} className="bg-indigo-600 text-white p-4 rounded-2xl"><ArrowRight className="w-6 h-6" /></button>
     </div>
    </div>
   </div>
   <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
   <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
  </div>
 );
}

export default ChatInterface;
