import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { 
 Shield, Wrench, Gavel, Monitor, BookOpen, Laugh, ChefHat, Activity, Camera, 
 Mic, MicOff, Volume2, VolumeX, RotateCcw, AlertTriangle, Phone, CreditCard, 
 FileText, Zap, Brain, Settings, LogOut, X, Crown, ArrowRight, PlayCircle, 
 StopCircle, Briefcase, Bell, User, Globe, Music, Sliders, CheckCircle, Trash2
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

const REAL_INTEL_DROPS: { [key: string]: string } = {
  'guardian': "URGENT SECURITY INTEL: I've detected a massive spike in 'Toll Road' smishing. 437 new fraudulent E-ZPass sites were registered this week targeting California residents.",
  'wealth': "MARKET INTEL: I found a high-yield opportunity at 4.09% APY—that is 7x the national average. Let's move some funds.",
  'lawyer': "LEGAL INTEL: California just activated AB 628. Landlords are now legally required to maintain working refrigerators.",
  'career': "ATS ALERT: The 2026 hiring algorithms just shifted. Resumes without 'Predictive Analytics' are being auto-rejected.",
  'doctor': "HEALTH INTEL: CDPH issued a Sacramento-area alert for measles. Check your records.",
  'mechanic': "SYSTEM INTEL: Microsoft's Feb 2026 'Patch Tuesday' just dropped. There is an active Zero-Day exploit.",
  'bestie': "I've been thinking about that drama you told me about... I did some digging and I have a better plan.",
  'therapist': "WELLNESS INTEL: I noticed your digital interaction frequency spiked last night. You're hitting a wall.",
  'tutor': "KNOWLEDGE INTEL: The Open Visualization Academy just launched a new simplified data method.",
  'pastor': "FAITH INTEL: I've prepared a mid-week spiritual reset for you to find clarity.",
  'vitality': "PERFORMANCE INTEL: Winter performance data is in. Your recovery scores are dipping.",
  'hype': "ALGORITHM INTEL: Instagram just opened a viral window for 'Original Audio' creators. Move now."
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
 { id: 'guardian', name: 'The Guardian', serviceLabel: 'SECURITY LEAD', description: 'Digital Bodyguard', protectiveJob: 'Security Lead', spokenHook: 'Security protocols active. Monitoring your digital perimeter.', briefing: 'I provide frontline cybersecurity.', color: 'blue', requiredTier: 'free', icon: Shield, capabilities: ['Scam detection'], fixedVoice: 'onyx' },
 { id: 'lawyer', name: 'The Lawyer', serviceLabel: 'LEGAL SHIELD', description: 'Justice Partner', protectiveJob: 'Legal Lead', spokenHook: 'Legal shield activated. Before you sign anything, let me review it.', briefing: 'I provide contract review.', color: 'yellow', requiredTier: 'elite', icon: Gavel, capabilities: ['Contract review'], fixedVoice: 'fable' },
 { id: 'doctor', name: 'The Doctor', serviceLabel: 'MEDICAL GUIDE', description: 'Symptom Analyst', protectiveJob: 'Medical Lead', spokenHook: 'Digital MD online. What are your symptoms?', briefing: 'I provide medical explanation.', color: 'red', requiredTier: 'pro', icon: Activity, capabilities: ['Triage'], fixedVoice: 'nova' },
 { id: 'wealth', name: 'The Wealth Architect', serviceLabel: 'FINANCE CHIEF', description: 'Money Strategist', protectiveJob: 'Finance Lead', spokenHook: 'Let’s get your money working for you.', briefing: 'I provide financial planning.', color: 'green', requiredTier: 'elite', icon: CreditCard, capabilities: ['Budgeting'], fixedVoice: 'onyx' },
 { id: 'career', name: 'The Career Strategist', serviceLabel: 'CAREER COACH', description: 'Professional Growth', protectiveJob: 'Career Lead', spokenHook: 'Let’s level up your career. Resume or salary?', briefing: 'I provide career growth strategy.', color: 'indigo', requiredTier: 'pro', icon: Briefcase, capabilities: ['Negotiation'], fixedVoice: 'shimmer' },
 { id: 'therapist', name: 'The Therapist', serviceLabel: 'MENTAL WELLNESS', description: 'Emotional Anchor', protectiveJob: 'Clinical Lead', spokenHook: 'I’m here to listen. This is a safe space.', briefing: 'I provide CBT support.', color: 'indigo', requiredTier: 'pro', icon: Brain, capabilities: ['Anxiety relief'], fixedVoice: 'alloy' },
 { id: 'mechanic', name: 'The Tech Specialist', serviceLabel: 'MASTER FIXER', description: 'Technical Lead', protectiveJob: 'Technical Lead', spokenHook: 'Technical manual loaded. Tell me the symptoms.', briefing: 'I provide repair guides.', color: 'gray', requiredTier: 'pro', icon: Wrench, capabilities: ['Tech repair'], fixedVoice: 'echo' },
 { id: 'tutor', name: 'The Master Tutor', serviceLabel: 'KNOWLEDGE BRIDGE', description: 'Education Lead', protectiveJob: 'Education Lead', spokenHook: 'Class is in session. What are we learning?', briefing: 'I provide academic tutoring.', color: 'purple', requiredTier: 'pro', icon: Zap, capabilities: ['Simplification'], fixedVoice: 'fable' },
 { id: 'pastor', name: 'The Pastor', serviceLabel: 'FAITH ANCHOR', description: 'Spiritual Lead', protectiveJob: 'Spiritual Lead', spokenHook: 'Peace be with you. I am here for prayer.', briefing: 'I provide spiritual counseling.', color: 'gold', requiredTier: 'pro', icon: BookOpen, capabilities: ['Scripture guidance'], fixedVoice: 'onyx' },
 { id: 'vitality', name: 'The Vitality Coach', serviceLabel: 'HEALTH OPTIMIZER', description: 'Fitness & Food', protectiveJob: 'Wellness Lead', spokenHook: 'Let’s optimize your engine. Fuel and movement.', briefing: 'I provide workout plans.', color: 'green', requiredTier: 'max', icon: Activity, capabilities: ['Meal planning'], fixedVoice: 'nova' },
 { id: 'hype', name: 'The Hype Strategist', serviceLabel: 'CREATIVE DIRECTOR', description: 'Viral Specialist', protectiveJob: 'Creative Lead', spokenHook: 'Let’s make some noise! Hooks or jokes?', briefing: 'I provide viral strategy.', color: 'orange', requiredTier: 'pro', icon: Laugh, capabilities: ['Viral hooks'], fixedVoice: 'shimmer' },
 { id: 'bestie', name: 'The Bestie', serviceLabel: 'RIDE OR DIE', description: 'Inner Circle', protectiveJob: 'Loyalty Lead', spokenHook: 'I’ve got your back, 100%. What’s actually going on?', briefing: 'I provide blunt life advice.', color: 'pink', requiredTier: 'pro', icon: Shield, capabilities: ['Venting'], fixedVoice: 'nova' }
];

const EXPERT_TRIGGERS: { [key: string]: string[] } = {
 'lawyer': ['legal', 'sue', 'court', 'contract', 'rights', 'lease', 'ticket', 'lawsuit', 'paycheck', 'short-changed'],
 'wealth': ['money', 'budget', 'invest', 'stock', 'debt', 'bank', 'tax', 'paycheck', 'short-changed', '180', '$'],
 'doctor': ['sick', 'pain', 'symptom', 'hurt', 'medicine', 'health'],
 'mechanic': ['car', 'repair', 'broken', 'fix', 'wifi', 'glitch', 'tech'],
 'career': ['job', 'work', 'boss', 'resume', 'salary', 'employer']
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

function ChatInterface({ currentPersona: initialPersona, userEmail = '', onPersonaChange = () => {}, onLogout = () => {} }: ChatInterfaceProps) {
 const [activePersona, setActivePersona] = useState<PersonaConfig>(() => initialPersona || PERSONAS[0]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [userName, setUserName] = useState<string>('User');
 const [isRecording, setIsRecording] = useState(false);
 const [isSpeaking, setIsSpeaking] = useState(false);
 const [bestieConfig, setBestieConfig] = useState<BestieConfig | null>(null);
 const [showBestieSetup, setShowBestieSetup] = useState(false);

 const chatContainerRef = useRef<HTMLDivElement>(null);
 const recognitionRef = useRef<any>(null);
 const isRecordingRef = useRef(false);
 const accumulatedRef = useRef<string>(''); 
 const inputTextRef = useRef<string>(''); 

 useEffect(() => {
  const savedBestie = localStorage.getItem('lylo_bestie_config');
  if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
 }, []);

 const detectExpertSuggestion = (text: string, currentId: string): PersonaConfig | null => {
  const lower = text.toLowerCase();
  for (const [id, keywords] of Object.entries(EXPERT_TRIGGERS)) {
   if (id === currentId) continue;
   if (keywords.some(k => lower.includes(k))) {
    return PERSONAS.find(p => p.id === id) || null;
   }
  }
  return null;
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
   
   recognition.onresult = (event: any) => {
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

   recognition.onend = () => { if (isRecordingRef.current) recognition.start(); };
   recognitionRef.current = recognition;
  }
 }, []);

 const handleWalkieTalkieMic = () => {
  if (isRecording) {
   isRecordingRef.current = false;
   setIsRecording(false);
   recognitionRef.current?.stop();
   if (inputTextRef.current.trim()) handleSend();
  } else {
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
  if (!text) return;
  setLoading(true);
  setInput('');
  inputTextRef.current = '';
  accumulatedRef.current = '';
  
  const userMsg: Message = { id: Date.now().toString(), content: text, sender: 'user', timestamp: new Date() };
  setMessages(prev => [...prev, userMsg]);

  try {
   const response = await sendChatMessage(text, [], activePersona.id, userEmail);
   const botMsg: Message = { id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date() };
   setMessages(prev => [...prev, botMsg]);
   speakText(botMsg.content);
  } catch (e) { console.error(e); } 
  finally { setLoading(false); }
 };

 const handlePersonaChange = (persona: PersonaConfig) => {
  window.speechSynthesis.cancel();
  setActivePersona(persona);
  onPersonaChange(persona);
  const hookMsg: Message = { id: Date.now().toString(), content: persona.spokenHook, sender: 'bot', timestamp: new Date() };
  setMessages([hookMsg]);
  speakText(hookMsg.content, persona.id === 'bestie' ? bestieConfig?.voiceId : persona.fixedVoice);
 };

 return (
  <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden">
   {/* HEADER */}
   <div className="bg-black border-b border-white/10 p-3 flex justify-between items-center z-50">
    <button className="p-2 text-white"><Settings /></button>
    <div className="text-center">
     <h1 className="text-white font-black tracking-widest">LYLO</h1>
     <p className="text-[10px] text-gray-500 uppercase font-bold">{activePersona.serviceLabel}</p>
    </div>
    <button onClick={() => setMessages([])} className="p-2 text-white"><RotateCcw /></button>
   </div>

   {/* CHAT AREA */}
   <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-44">
    {messages.length === 0 ? (
     <div className="grid grid-cols-2 gap-3">
      {PERSONAS.map(p => (
       <button key={p.id} onClick={() => handlePersonaChange(p)} className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-2">
        <p.icon className={getPersonaColorClass(p, 'text')} />
        <span className="text-[9px] text-white font-black uppercase">{p.name}</span>
       </button>
      ))}
     </div>
    ) : (
     messages.map((msg, idx) => {
      // Logic to show suggestion box ONLY on latest bot message
      const isLatestBot = msg.sender === 'bot' && idx === messages.length - 1;
      const suggestion = isLatestBot ? detectExpertSuggestion(messages.map(m => m.content).join(' '), activePersona.id) : null;

      return (
       <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
        <div className={`p-4 rounded-2xl max-w-[85%] ${msg.sender === 'user' ? 'bg-blue-600 text-white font-bold' : 'bg-white/10 text-gray-100 border border-white/10'}`}>
         {msg.content}
        </div>
        
        {suggestion && (
         <div className="mt-4 w-full max-w-[85%] p-4 bg-indigo-600 border border-indigo-400 rounded-2xl shadow-2xl animate-bounce">
          <p className="text-[10px] font-black text-white uppercase mb-2 flex items-center gap-2">
            <Zap className="w-3 h-3 fill-current" /> Expert Handoff Found
          </p>
          <button 
            onClick={() => handlePersonaChange(suggestion)} 
            className="w-full py-3 bg-white text-indigo-700 text-[11px] font-black uppercase rounded-xl flex items-center justify-center gap-2"
          >
           Switch to {suggestion.name} <ArrowRight className="w-4 h-4" />
          </button>
         </div>
        )}
       </div>
      )
     })
    )}
   </div>

   {/* FOOTER */}
   <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-xl border-t border-white/10">
    <div className="max-w-md mx-auto space-y-3">
     <button onClick={handleWalkieTalkieMic} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-black active:scale-95'}`}>
      {isRecording ? <><MicOff className="w-6 h-6"/> STOP & SEND</> : <><Mic className="w-6 h-6"/> START TALKING</>}
     </button>
     <div className="flex gap-2">
      <input 
        value={input} 
        onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }}
        placeholder="Type a message..."
        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base focus:outline-none"
      />
      <button onClick={handleSend} className="bg-blue-600 text-white p-3 rounded-xl active:scale-95"><ArrowRight /></button>
     </div>
    </div>
   </div>
  </div>
 );
}

export default ChatInterface;
