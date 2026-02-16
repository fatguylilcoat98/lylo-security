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
  Crown
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// --- INTERFACES ---
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

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
  onUsageUpdate?: () => void;
}

interface RecoveryGuideData {
  title: string;
  subtitle: string;
  immediate_actions: string[];
  recovery_steps: { step: number; title: string; actions: string[] }[];
  phone_scripts: { bank_script: string; police_script: string };
  prevention_tips: string[];
}

// THE 10-EXPERT PERSONNEL ROSTER
const PERSONAS: PersonaConfig[] = [
  { 
    id: 'guardian', name: 'The Guardian', serviceLabel: 'SECURITY SCAN', description: 'Security Lead', protectiveJob: 'Security Lead',
    spokenHook: 'Security protocols active. How can I protect you today?',
    briefing: 'I provide comprehensive security analysis, scam detection, and digital threat protection.',
    color: 'blue', requiredTier: 'free', icon: Shield,
    capabilities: ['Scam detection', 'Phishing protection', 'Account security', 'Identity theft prevention']
  },
  { 
    id: 'roast', name: 'The Roast Master', serviceLabel: 'MOOD SUPPORT', description: 'Humor Shield', protectiveJob: 'Humor Shield',
    spokenHook: 'Mood support activated. Let me help lighten the situation.',
    briefing: 'I use strategic humor to help you handle difficult situations with confidence.',
    color: 'orange', requiredTier: 'pro', icon: Laugh,
    capabilities: ['Sarcastic scam responses', 'Witty threat deflection', 'Humorous security advice']
  },
  { 
    id: 'disciple', name: 'The Disciple', serviceLabel: 'FAITH GUIDANCE', description: 'Spiritual Armor', protectiveJob: 'Spiritual Armor',
    spokenHook: 'Faith guidance online. How can I provide spiritual support?',
    briefing: 'I offer biblical wisdom and spiritual guidance to protect your moral wellbeing.',
    color: 'gold', requiredTier: 'pro', icon: BookOpen,
    capabilities: ['Biblical wisdom', 'Scripture-based protection', 'Spiritual threat assessment']
  },
  { 
    id: 'mechanic', name: 'The Mechanic', serviceLabel: 'VEHICLE SUPPORT', description: 'Garage Protector', protectiveJob: 'Garage Protector',
    spokenHook: 'Vehicle support ready. What automotive issue can I help with?',
    briefing: 'I provide expert automotive guidance and protect you from vehicle-related scams.',
    color: 'gray', requiredTier: 'pro', icon: Wrench,
    capabilities: ['Car repair diagnostics', 'Engine code analysis', 'Automotive scam protection']
  },
  { 
    id: 'lawyer', name: 'The Lawyer', serviceLabel: 'LEGAL SHIELD', description: 'Legal Shield', protectiveJob: 'Legal Shield',
    spokenHook: 'Legal shield activated. How can I protect your rights today?',
    briefing: 'I provide legal guidance and protect you from legal scams and exploitation.',
    color: 'yellow', requiredTier: 'elite', icon: Gavel,
    capabilities: ['Contract review', 'Legal scam detection', 'Rights protection guidance']
  },
  { 
    id: 'techie', name: 'The Techie', serviceLabel: 'TECH SUPPORT', description: 'Tech Bridge', protectiveJob: 'Tech Bridge',
    spokenHook: 'Technical support online. Ready to solve your tech challenges.',
    briefing: 'I provide technology support and protect you from tech support scams.',
    color: 'purple', requiredTier: 'elite', icon: Monitor,
    capabilities: ['Device troubleshooting', 'Tech support scam protection', 'Network security']
  },
  { 
    id: 'storyteller', name: 'The Storyteller', serviceLabel: 'STORY THERAPY', description: 'Mental Guardian', protectiveJob: 'Mental Guardian',
    spokenHook: 'Story therapy session initiated.',
    briefing: 'I create therapeutic stories to support your mental wellness.',
    color: 'indigo', requiredTier: 'max', icon: BookOpen,
    capabilities: ['Custom story creation', 'Narrative therapy', 'Mental wellness']
  },
  { 
    id: 'comedian', name: 'The Comedian', serviceLabel: 'ENTERTAINMENT', description: 'Mood Protector', protectiveJob: 'Mood Protector',
    spokenHook: 'Entertainment mode activated.',
    briefing: 'I provide professional entertainment to improve your mental state.',
    color: 'pink', requiredTier: 'max', icon: Laugh,
    capabilities: ['Professional comedy', 'Mood enhancement', 'Stress relief']
  },
  { 
    id: 'chef', name: 'The Chef', serviceLabel: 'NUTRITION GUIDE', description: 'Kitchen Safety', protectiveJob: 'Kitchen Safety',
    spokenHook: 'Nutrition guidance active.',
    briefing: 'I provide expert culinary guidance and protect you from food-related risks.',
    color: 'red', requiredTier: 'max', icon: ChefHat,
    capabilities: ['Recipe creation', 'Food safety protocols', 'Nutrition advice']
  },
  { 
    id: 'fitness', name: 'The Fitness Coach', serviceLabel: 'HEALTH SUPPORT', description: 'Mobility Protector', protectiveJob: 'Mobility Protector',
    spokenHook: 'Health support online.',
    briefing: 'I provide safe fitness guidance and protect you from health misinformation.',
    color: 'green', requiredTier: 'max', icon: Activity,
    capabilities: ['Safe exercise routines', 'Fitness scam protection', 'Wellness guidance']
  }
];

export default function ChatInterface({ 
  currentPersona: initialPersona, 
  userEmail, 
  zoomLevel, 
  onZoomChange, 
  onPersonaChange, 
  onLogout, 
  onUsageUpdate
}: ChatInterfaceProps) {
  
  // --- STATE ---
  const [activePersona, setActivePersona] = useState<PersonaConfig>(initialPersona || PERSONAS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [userName, setUserName] = useState<string>('');
  const [intelligenceSync, setIntelligenceSync] = useState(0);
  
  // Mic & Audio
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false); 
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [instantVoice, setInstantVoice] = useState(false);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
  
  // UI
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showCrisisShield, setShowCrisisShield] = useState(false);
  
  // Modals & Briefings
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('free');
  const [isEliteUser, setIsEliteUser] = useState(false);
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null);
  const [showScamRecovery, setShowScamRecovery] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [personaBriefingsShown, setPersonaBriefingsShown] = useState<string[]>([]);
  const [showKnowMore, setShowKnowMore] = useState<string | null>(null);
  
  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<string>(''); 

  useEffect(() => {
    if (initialPersona) {
      setActivePersona(initialPersona);
    }
  }, [initialPersona]);

  // --- HELPERS ---
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

  const getPrivacyShieldClass = () => {
    if (loading) return 'border-yellow-400 shadow-[0_0_15px_rgba(255,191,0,0.4)] animate-pulse';
    const lastBotMsg = [...messages].reverse().find(m => m.sender === 'bot');
    if (lastBotMsg?.scamDetected && lastBotMsg?.confidenceScore === 100) {
      return 'border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse';
    }
    return getPersonaColorClass(activePersona, 'border') + ' ' + getPersonaColorClass(activePersona, 'glow');
  };

  const canAccessPersona = (persona: PersonaConfig) => {
    const tiers = { free: 0, pro: 1, elite: 2, max: 3 };
    return tiers[userTier] >= tiers[persona.requiredTier];
  };

  const getAccessiblePersonas = () => PERSONAS.filter(persona => canAccessPersona(persona));

  const getTierName = (tier: string) => {
    switch(tier) {
      case 'free': return 'Basic Shield';
      case 'pro': return 'Pro Guardian';
      case 'elite': return 'Elite Justice';  
      case 'max': return 'Max Unlimited';
      default: return 'Unknown';
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      await loadUserStats();
      await checkEliteStatus();
      
      const savedName = localStorage.getItem('lylo_user_name');
      if (savedName) setUserName(savedName);
      
      const savedSync = localStorage.getItem('lylo_intelligence_sync');
      if (savedSync) setIntelligenceSync(parseInt(savedSync));
      
      const savedVoice = localStorage.getItem('lylo_voice_gender');
      if (savedVoice) setVoiceGender(savedVoice as any);

      const savedPersonaId = localStorage.getItem('lylo_preferred_persona');
      if (savedPersonaId) {
        const p = PERSONAS.find(p => p.id === savedPersonaId);
        if (p && canAccessPersona(p)) setActivePersona(p);
      }
    };
    init();
    return () => { window.speechSynthesis.cancel(); };
  }, [userEmail]);

  const checkEliteStatus = async () => {
    try {
      if (userEmail.toLowerCase().includes("stangman")) {
           setIsEliteUser(true);
           setUserTier('max');
      } else {
        const response = await fetch(`${API_URL}/check-beta-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail })
        });
        const data = await response.json();
        setUserTier(data.tier || 'free');
        setIsEliteUser(data.tier === 'elite' || data.tier === 'max');
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

  // --- AUDIO LOGIC ---
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSpeech(null);
  };

  const chunkTextForSpeech = (text: string): string[] => {
    const rawSentences = text.match(/[^.?!]+[.?!]+[\])'"]*|.+/g) || [text];
    const chunks: string[] = [];
    rawSentences.forEach(sentence => {
      if (sentence.length < 180) {
        chunks.push(sentence.trim());
      } else {
        const subParts = sentence.split(/([,;:]+)/g);
        let tempStr = '';
        subParts.forEach(part => {
          if (tempStr.length + part.length > 180) {
            chunks.push(tempStr.trim());
            tempStr = part;
          } else {
            tempStr += part;
          }
        });
        if (tempStr) chunks.push(tempStr.trim());
      }
    });
    return chunks.filter(c => c.length > 0);
  };

  const speakText = async (text: string, messageId?: string) => {
    if (!autoTTS) return;
    quickStopAllAudio();
    setIsSpeaking(true);
    if (messageId) {
      setShowReplayButton(messageId);
      setTimeout(() => setShowReplayButton(null), 5000);
    }

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('voice', voiceGender === 'male' ? 'onyx' : 'nova');
      const response = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.audio_b64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
    } catch (e) { console.log('Using fallback voice'); }

    const chunks = chunkTextForSpeech(text);
    speakChunksSequentially(chunks, 0);
  };

  const speakChunksSequentially = (chunks: string[], index: number) => {
    if (index >= chunks.length) {
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.rate = 0.9;
    utterance.onend = () => speakChunksSequentially(chunks, index + 1);
    window.speechSynthesis.speak(utterance);
  };

  const handleReplay = (content: string) => {
    quickStopAllAudio();
    speakText(content);
  };

  // --- MIC LOGIC ---
  const handleWalkieTalkieMic = () => {
    if (!micSupported) return alert('Mic not supported');
    
    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
      setTimeout(() => handleSend(), 200);
    } else {
      quickStopAllAudio();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingState('recording');
      setInput('');
      transcriptRef.current = '';
      if (recognitionRef.current) try { recognitionRef.current.start(); } catch(e){}
    }
  };

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
        }
        if (final.trim()) {
          transcriptRef.current += final;
          setInput(prev => prev + final);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) try { recognition.start(); } catch(e){}
        else setRecordingState('idle');
      };

      recognitionRef.current = recognition;
      setMicSupported(true);
    }
  }, []);

  // --- ACTIONS ---
  const handlePersonaChange = async (persona: PersonaConfig) => {
    if (!canAccessPersona(persona)) {
      speakText('Upgrade required.');
      return;
    }
    quickStopAllAudio();
    setActivePersona(persona);
    onPersonaChange(persona);
    localStorage.setItem('lylo_preferred_persona', persona.id);
    const hook = persona.spokenHook.replace('{userName}', userName || 'user');
    await speakText(hook);
  };

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
      const response = await sendChatMessage(text, history, activePersona.id, userEmail, selectedImage, 'en');
      
      const botMsg: Message = { 
        id: Date.now().toString(), 
        content: response.answer, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: response.scam_indicators
      };
      
      setMessages(prev => [...prev, botMsg]);
      speakText(response.answer, botMsg.id);
      
      if (text.length > 10) {
        const newSync = Math.min(intelligenceSync + 5, 100);
        setIntelligenceSync(newSync);
        localStorage.setItem('lylo_intelligence_sync', newSync.toString());
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); setSelectedImage
