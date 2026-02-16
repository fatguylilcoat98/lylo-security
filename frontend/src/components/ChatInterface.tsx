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

interface ChatInterfaceProps {
  currentPersona?: PersonaConfig; // Make optional to prevent undefined error
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

// --- DATA ---
const PERSONAS: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', serviceLabel: 'SECURITY SCAN', description: 'Security Lead', protectiveJob: 'Security Lead', spokenHook: 'Security protocols active. How can I protect you today?', briefing: 'I provide comprehensive security analysis, scam detection, and digital threat protection.', color: 'blue', requiredTier: 'free', icon: Shield, capabilities: ['Scam detection', 'Phishing protection', 'Account security', 'Identity theft prevention'] },
  { id: 'roast', name: 'The Roast Master', serviceLabel: 'MOOD SUPPORT', description: 'Humor Shield', protectiveJob: 'Humor Shield', spokenHook: 'Mood support activated. Let me help lighten the situation.', briefing: 'I use strategic humor to help you handle difficult situations with confidence.', color: 'orange', requiredTier: 'pro', icon: Laugh, capabilities: ['Sarcastic scam responses', 'Witty threat deflection', 'Humorous security advice'] },
  { id: 'disciple', name: 'The Disciple', serviceLabel: 'FAITH GUIDANCE', description: 'Spiritual Armor', protectiveJob: 'Spiritual Armor', spokenHook: 'Faith guidance online. How can I provide spiritual support?', briefing: 'I offer biblical wisdom and spiritual guidance to protect your moral wellbeing.', color: 'gold', requiredTier: 'pro', icon: BookOpen, capabilities: ['Biblical wisdom', 'Scripture-based protection', 'Spiritual threat assessment'] },
  { id: 'mechanic', name: 'The Mechanic', serviceLabel: 'VEHICLE SUPPORT', description: 'Garage Protector', protectiveJob: 'Garage Protector', spokenHook: 'Vehicle support ready. What automotive issue can I help with?', briefing: 'I provide expert automotive guidance and protect you from vehicle-related scams.', color: 'gray', requiredTier: 'pro', icon: Wrench, capabilities: ['Car repair diagnostics', 'Engine code analysis', 'Automotive scam protection'] },
  { id: 'lawyer', name: 'The Lawyer', serviceLabel: 'LEGAL SHIELD', description: 'Legal Shield', protectiveJob: 'Legal Shield', spokenHook: 'Legal shield activated. How can I protect your rights today?', briefing: 'I provide legal guidance and protect you from legal scams and exploitation.', color: 'yellow', requiredTier: 'elite', icon: Gavel, capabilities: ['Contract review', 'Legal scam detection', 'Rights protection guidance'] },
  { id: 'techie', name: 'The Techie', serviceLabel: 'TECH SUPPORT', description: 'Tech Bridge', protectiveJob: 'Tech Bridge', spokenHook: 'Technical support online. Ready to solve your tech challenges.', briefing: 'I provide technology support and protect you from tech support scams.', color: 'purple', requiredTier: 'elite', icon: Monitor, capabilities: ['Device troubleshooting', 'Tech support scam protection', 'Network security'] },
  { id: 'storyteller', name: 'The Storyteller', serviceLabel: 'STORY THERAPY', description: 'Mental Guardian', protectiveJob: 'Mental Guardian', spokenHook: 'Story therapy session initiated.', briefing: 'I create therapeutic stories to support your mental wellness.', color: 'indigo', requiredTier: 'max', icon: BookOpen, capabilities: ['Custom story creation', 'Narrative therapy', 'Mental wellness'] },
  { id: 'comedian', name: 'The Comedian', serviceLabel: 'ENTERTAINMENT', description: 'Mood Protector', protectiveJob: 'Mood Protector', spokenHook: 'Entertainment mode activated.', briefing: 'I provide professional entertainment to improve your mental state.', color: 'pink', requiredTier: 'max', icon: Laugh, capabilities: ['Professional comedy', 'Mood enhancement', 'Stress relief'] },
  { id: 'chef', name: 'The Chef', serviceLabel: 'NUTRITION GUIDE', description: 'Kitchen Safety', protectiveJob: 'Kitchen Safety', spokenHook: 'Nutrition guidance active.', briefing: 'I provide expert culinary guidance and protect you from food-related risks.', color: 'red', requiredTier: 'max', icon: ChefHat, capabilities: ['Recipe creation', 'Food safety protocols', 'Nutrition advice'] },
  { id: 'fitness', name: 'The Fitness Coach', serviceLabel: 'HEALTH SUPPORT', description: 'Mobility Protector', protectiveJob: 'Mobility Protector', spokenHook: 'Health support online.', briefing: 'I provide safe fitness guidance and protect you from health misinformation.', color: 'green', requiredTier: 'max', icon: Activity, capabilities: ['Safe exercise routines', 'Fitness scam protection', 'Wellness guidance'] }
];

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

const getAccessiblePersonas = (tier: string) => PERSONAS.filter(p => canAccessPersona(p, tier));

const getTierName = (tier: string) => {
  switch(tier) {
    case 'free': return 'Basic Shield';
    case 'pro': return 'Pro Guardian';
    case 'elite': return 'Elite Justice';  
    case 'max': return 'Max Unlimited';
    default: return 'Unknown';
  }
};

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
  
  // State - SAFE INITIALIZATION
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
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  
  // UI State
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showCrisisShield, setShowCrisisShield] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null); // NEW: Track selected persona
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null); // Visual feedback
  const [showVoiceSettings, setShowVoiceSettings] = useState(false); // Voice controls
  
  // Modal State
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('free');
  const [isEliteUser, setIsEliteUser] = useState(false);
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null);
  const [showKnowMore, setShowKnowMore] = useState<string | null>(null);
  
  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<string>(''); 

  useEffect(() => { if (initialPersona) setActivePersona(initialPersona); }, [initialPersona]);

  // Init
  useEffect(() => {
    const init = async () => {
      // PERSISTENT AUTHENTICATION - Check for saved login
      const savedAuthToken = localStorage.getItem('lylo_auth_token');
      const savedUserEmail = localStorage.getItem('lylo_user_email');
      const lastLoginTime = localStorage.getItem('lylo_last_login');
      
      // Auto-login if token exists and is less than 30 days old
      if (savedAuthToken && savedUserEmail && lastLoginTime) {
        const daysSinceLogin = (Date.now() - parseInt(lastLoginTime)) / (1000 * 60 * 60 * 24);
        if (daysSinceLogin < 30) {
          // User is already authenticated, continue with normal initialization
          console.log('Auto-login successful for:', savedUserEmail);
        }
      }
      
      await loadUserStats();
      await checkEliteStatus();
      
      // Load voice preferences
      const savedVoiceGender = localStorage.getItem('lylo_voice_gender');
      if (savedVoiceGender === 'female') setVoiceGender('female');
      
      const savedName = localStorage.getItem('lylo_user_name');
      if (savedName) setUserName(savedName);
      else if (userEmail.includes('stangman')) setUserName('Christopher');
      
      const savedSync = localStorage.getItem('lylo_intelligence_sync');
      if (savedSync) setIntelligenceSync(parseInt(savedSync));
      
      const savedPersonaId = localStorage.getItem('lylo_preferred_persona');
      if (savedPersonaId) {
        const p = PERSONAS.find(p => p.id === savedPersonaId);
        if (p && canAccessPersona(p, userTier)) setActivePersona(p);
      }
      
      // MEMORY/LEARNING RESTORATION
      const savedLearningData = localStorage.getItem('lylo_learning_data');
      if (savedLearningData) {
        try {
          const learningData = JSON.parse(savedLearningData);
          console.log('Restored learning data:', learningData);
          // Apply learning insights to enhance intelligence sync
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

  // PERSISTENT AUTH HELPER
  const saveAuthSession = (email: string, token: string) => {
    localStorage.setItem('lylo_auth_token', token);
    localStorage.setItem('lylo_user_email', email);
    localStorage.setItem('lylo_last_login', Date.now().toString());
  };

  // VOICE GENDER TOGGLE
  const toggleVoiceGender = () => {
    const newGender = voiceGender === 'male' ? 'female' : 'male';
    setVoiceGender(newGender);
    localStorage.setItem('lylo_voice_gender', newGender);
    
    // Test the voice change
    const testMessage = `Voice changed to ${newGender} mode.`;
    speakText(testMessage);
    
    // Update intelligence sync for personalization
    const newSync = Math.min(intelligenceSync + 3, 100);
    setIntelligenceSync(newSync);
    localStorage.setItem('lylo_intelligence_sync', newSync.toString());
  };

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

  // Audio & Speech
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSpeech(null);
    setSpeechQueue([]);
  };

  const speakText = async (text: string, messageId?: string, voiceSettings?: { voice: string; rate: number; pitch: number }) => {
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
      formData.append('voice', voiceSettings?.voice || (voiceGender === 'male' ? 'onyx' : 'nova'));
      const response = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.audio_b64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
    } catch (e) { console.log('Using fallback voice'); }

    // Fallback logic with persona-specific settings
    const chunks = text.match(/[^.?!]+[.?!]+[\])'"]*|.+/g) || [text];
    speakChunksSequentially(chunks, 0, voiceSettings);
  };

  const speakChunksSequentially = (chunks: string[], index: number, voiceSettings?: { voice: string; rate: number; pitch: number }) => {
    if (index >= chunks.length) { setIsSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.rate = voiceSettings?.rate || 0.9;
    utterance.pitch = voiceSettings?.pitch || 1.0;
    utterance.onend = () => speakChunksSequentially(chunks, index + 1, voiceSettings);
    window.speechSynthesis.speak(utterance);
  };

  // Mic
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // ANTI-STUTTERING SETTINGS
      recognition.continuous = false; // Don't continue listening
      recognition.interimResults = false; // No partial results to prevent "so so so"
      recognition.maxAlternatives = 1; // Only best result
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal && result[0].confidence > 0.7) { // Confidence threshold
            finalTranscript += result[0].transcript + ' ';
          }
        }
        
        if (finalTranscript.trim()) {
          // CLEAN UP TRANSCRIPT - Remove stuttering and repetition
          const cleanedTranscript = cleanUpSpeech(finalTranscript.trim());
          transcriptRef.current = cleanedTranscript;
          setInput(cleanedTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        transcriptRef.current = '';
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Auto-send clean transcript
        const cleanTranscript = transcriptRef.current.trim();
        if (cleanTranscript && cleanTranscript.length > 2) {
          setTimeout(() => handleSend(), 100);
        }
        transcriptRef.current = '';
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    }
  }, []);

  // SPEECH CLEANUP FUNCTION - Remove stuttering and repetition
  const cleanUpSpeech = (text: string): string => {
    // Remove excessive repetition of words like "so so so I just wanted"
    let cleaned = text.replace(/\b(\w+)(\s+\1){2,}/gi, '$1'); // Remove 3+ repeated words
    
    // Clean up common speech patterns
    cleaned = cleaned.replace(/\b(um|uh|er|ah)\b/gi, ''); // Remove filler words
    cleaned = cleaned.replace(/\s+/g, ' '); // Normalize whitespace
    cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // Trim
    
    // Remove excessive "I just wanted to" repetition
    cleaned = cleaned.replace(/(\b(I just wanted to|so)\b\s*){3,}/gi, 'I wanted to ');
    
    return cleaned;
  };

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
      setInput('');
      transcriptRef.current = '';
      if (recognitionRef.current) try { recognitionRef.current.start(); } catch(e){}
    }
  };

  // Logic
  const handlePersonaChange = async (persona: PersonaConfig) => {
    if (!canAccessPersona(persona, userTier)) {
      speakText('Upgrade required.');
      return;
    }
    
    // VISUAL SELECTION FEEDBACK
    setSelectedPersonaId(persona.id);
    
    // Brief delay to show selection highlight
    setTimeout(async () => {
      quickStopAllAudio();
      setActivePersona(persona);
      onPersonaChange(persona);
      localStorage.setItem('lylo_preferred_persona', persona.id);
      
      // PERSONA-SPECIFIC VOICE MAPPING
      const personaVoiceMap: { [key: string]: { voice: string; rate: number; pitch: number } } = {
        'guardian': { voice: voiceGender === 'male' ? 'onyx' : 'nova', rate: 0.9, pitch: 0.8 },
        'roast': { voice: voiceGender === 'male' ? 'echo' : 'shimmer', rate: 1.1, pitch: 1.2 },
        'disciple': { voice: voiceGender === 'male' ? 'onyx' : 'alloy', rate: 0.8, pitch: 0.9 },
        'mechanic': { voice: voiceGender === 'male' ? 'fable' : 'nova', rate: 0.95, pitch: 0.8 },
        'lawyer': { voice: voiceGender === 'male' ? 'onyx' : 'shimmer', rate: 0.85, pitch: 0.7 },
        'techie': { voice: voiceGender === 'male' ? 'echo' : 'nova', rate: 1.0, pitch: 1.0 },
        'storyteller': { voice: voiceGender === 'male' ? 'fable' : 'alloy', rate: 0.8, pitch: 1.1 },
        'comedian': { voice: voiceGender === 'male' ? 'echo' : 'shimmer', rate: 1.2, pitch: 1.3 },
        'chef': { voice: voiceGender === 'male' ? 'fable' : 'nova', rate: 0.9, pitch: 1.0 },
        'fitness': { voice: voiceGender === 'male' ? 'onyx' : 'alloy', rate: 1.0, pitch: 0.9 }
      };
      
      const voiceSettings = personaVoiceMap[persona.id] || { voice: voiceGender === 'male' ? 'onyx' : 'nova', rate: 0.9, pitch: 1.0 };
      
      const hook = persona.spokenHook.replace('{userName}', userName || 'user');
      await speakText(hook, undefined, voiceSettings);
      
      setShowKnowMore(persona.id);
      setTimeout(() => setShowKnowMore(null), 5000);
      setSelectedPersonaId(null); // Remove highlight after transition
      
      // ENHANCED INTELLIGENCE SYNC
      const newSync = Math.min(intelligenceSync + 8, 100);
      setIntelligenceSync(newSync);
      localStorage.setItem('lylo_intelligence_sync', newSync.toString());
      
      // Store persona preference and learning data
      const learningData = {
        personaPreference: persona.id,
        selectionTime: new Date().toISOString(),
        userEngagement: 'persona_selection'
      };
      localStorage.setItem('lylo_learning_data', JSON.stringify(learningData));
      
    }, 300); // Show selection feedback for 300ms
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
        id: Date.now().toString(), content: response.answer, sender: 'bot', timestamp: new Date(),
        confidenceScore: response.confidence_score, scamDetected: response.scam_detected, scamIndicators: response.scam_indicators
      };
      setMessages(prev => [...prev, botMsg]);
      
      // PERSONA-SPECIFIC VOICE FOR RESPONSES
      const personaVoiceMap: { [key: string]: { voice: string; rate: number; pitch: number } } = {
        'guardian': { voice: voiceGender === 'male' ? 'onyx' : 'nova', rate: 0.9, pitch: 0.8 },
        'roast': { voice: voiceGender === 'male' ? 'echo' : 'shimmer', rate: 1.1, pitch: 1.2 },
        'disciple': { voice: voiceGender === 'male' ? 'onyx' : 'alloy', rate: 0.8, pitch: 0.9 },
        'mechanic': { voice: voiceGender === 'male' ? 'fable' : 'nova', rate: 0.95, pitch: 0.8 },
        'lawyer': { voice: voiceGender === 'male' ? 'onyx' : 'shimmer', rate: 0.85, pitch: 0.7 },
        'techie': { voice: voiceGender === 'male' ? 'echo' : 'nova', rate: 1.0, pitch: 1.0 },
        'storyteller': { voice: voiceGender === 'male' ? 'fable' : 'alloy', rate: 0.8, pitch: 1.1 },
        'comedian': { voice: voiceGender === 'male' ? 'echo' : 'shimmer', rate: 1.2, pitch: 1.3 },
        'chef': { voice: voiceGender === 'male' ? 'fable' : 'nova', rate: 0.9, pitch: 1.0 },
        'fitness': { voice: voiceGender === 'male' ? 'onyx' : 'alloy', rate: 1.0, pitch: 0.9 }
      };
      
      const voiceSettings = personaVoiceMap[activePersona.id] || { voice: voiceGender === 'male' ? 'onyx' : 'nova', rate: 0.9, pitch: 1.0 };
      speakText(response.answer, botMsg.id, voiceSettings);
      
      // ENHANCED MEMORY & LEARNING
      if (text.length > 10) {
        const newSync = Math.min(intelligenceSync + 5, 100);
        setIntelligenceSync(newSync);
        localStorage.setItem('lylo_intelligence_sync', newSync.toString());
        
        // Store detailed learning data
        const learningUpdate = {
          timestamp: new Date().toISOString(),
          messageLength: text.length,
          personaUsed: activePersona.id,
          responseTime: Date.now() - userMsg.timestamp.getTime(),
          userEngagement: 'message_interaction',
          confidenceScore: response.confidence_score,
          scamDetected: response.scam_detected
        };
        
        // Accumulate learning data
        const existingLearning = localStorage.getItem('lylo_learning_history');
        const learningHistory = existingLearning ? JSON.parse(existingLearning) : [];
        learningHistory.push(learningUpdate);
        
        // Keep only last 50 interactions to manage storage
        if (learningHistory.length > 50) {
          learningHistory.shift();
        }
        
        localStorage.setItem('lylo_learning_history', JSON.stringify(learningHistory));
        console.log('Learning update stored:', learningUpdate);
      }
      
    } catch (e) { console.error(e); } 
    finally { setLoading(false); setSelectedImage(null); }
  };

  // MISSING FUNCTION HANDLERS
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

  // NAVIGATION FUNCTIONS
  const handleBackToServices = () => {
    quickStopAllAudio();
    setMessages([]); // Clear conversation
    setInput('');
    setSelectedImage(null);
    // Stay with current persona but return to service selection screen
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
    
    // Add system message about the switch
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

  // --- RENDER ---
  return (
    <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans" style={{ zIndex: 99999 }}>
      
      {/* MOBILE-OPTIMIZED OVERLAYS */}
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

      {/* MOBILE-OPTIMIZED HEADER */}
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/10 p-2 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">
          
          {/* LEFT: Back Button (when in chat) OR Settings (when in service grid) */}
          <div className="relative">
            {messages.length > 0 ? (
              // BACK TO SERVICES BUTTON
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
              // SETTINGS BUTTON (service grid view)
              <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg active:scale-95 transition-all">
                <Settings className="w-5 h-5 text-white" />
              </button>
            )}
            
            {/* SETTINGS DROPDOWN */}
            {showDropdown && (
              <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-xl p-4 min-w-[250px] shadow-2xl z-[100001]">
                
                {/* PERSONA SWITCHER (only show in chat mode) */}
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
              <div className="text-[8px] text-gray-400 font-black uppercase">Protected</div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE-OPTIMIZED MAIN CONTENT */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto relative backdrop-blur-sm"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col">
            {/* HEADER SECTION - Fixed at top */}
            <div className="flex-shrink-0 text-center pt-4 pb-3 px-4">
              <div className={`relative w-16 h-16 bg-black/60 backdrop-blur-xl rounded-xl flex items-center justify-center mx-auto mb-3 border-2 transition-all duration-700 ${getPrivacyShieldClass(activePersona, loading, messages)}`}>
                <span className="text-white font-black text-lg tracking-wider">LYLO</span>
                {/* Live Status Animation */}
                {(loading || isSpeaking) && (
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 animate-pulse">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent animate-ping"></div>
                  </div>
                )}
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Digital Bodyguard</h1>
              <p className="text-gray-400 text-sm">Tap a service to activate your expert</p>
            </div>
            
            {/* SERVICE GRID - Scrollable content */}
            <div className="flex-1 px-4" style={{ paddingBottom: '400px' }}>
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pb-20">
                {getAccessiblePersonas(userTier).map(persona => {
                  const Icon = persona.icon;
                  const isSelected = selectedPersonaId === persona.id;
                  return (
                    <button key={persona.id} onClick={() => handlePersonaChange(persona)}
                      className={`
                        relative p-4 rounded-xl backdrop-blur-xl border transition-all duration-300 min-h-[120px]
                        ${isSelected 
                          ? `bg-white/20 border-white/60 ${getPersonaColorClass(persona, 'glow')} scale-105 animate-pulse shadow-2xl` 
                          : `bg-black/50 border-white/20 hover:bg-black/70 active:scale-95`
                        }
                        ${getPersonaColorClass(persona, 'glow')}
                      `}>
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
                      
                      {/* Tier Badge */}
                      {persona.requiredTier !== 'free' && (
                        <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          persona.requiredTier === 'max' ? 'bg-yellow-500 text-black' :
                          persona.requiredTier === 'elite' ? 'bg-purple-500 text-white' :
                          'bg-blue-500 text-white'
                        }`}>
                          {persona.requiredTier === 'elite' ? 'ELI' : persona.requiredTier.slice(0,3).toUpperCase()}
                        </div>
                      )}
                    </button>
                  );
                })}
                {/* Extra spacing to ensure footer clearance */}
                <div className="col-span-2 h-16 flex items-center justify-center">
                  <div className="text-gray-600 text-xs font-bold uppercase tracking-widest">
                    {getAccessiblePersonas(userTier).length} Services Available
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
                      : `bg-black/40 text-gray-100 ${getPersonaColorClass(activePersona, 'border')}/30 border`
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
                
                {/* MOBILE-OPTIMIZED Threat Assessment */}
                {msg.sender === 'bot' && msg.confidenceScore && (
                  <div className="max-w-[90%]">
                    <div className={`bg-black/50 backdrop-blur-xl border rounded-xl p-4 shadow-lg transition-all duration-1000 ${
                      msg.scamDetected && msg.confidenceScore === 100 ? 'border-red-400/50' : 'border-white/10'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-black uppercase text-xs tracking-wide flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Threat Assessment
                        </span>
                        <span className={`font-black text-base ${
                          msg.scamDetected && msg.confidenceScore === 100 ? 'text-red-400' : getPersonaColorClass(activePersona, 'text')
                        }`}>
                          {msg.confidenceScore}%
                        </span>
                      </div>
                      <div className="bg-gray-800/50 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            msg.scamDetected && msg.confidenceScore === 100 ? 'bg-red-500' : getPersonaColorClass(activePersona, 'bg')
                          }`} 
                          style={{ width: `${msg.confidenceScore}%` }} 
                        />
                      </div>
                      {msg.scamDetected && (
                        <div className="mt-3 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-xs font-bold uppercase flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          THREAT DETECTED
                          {msg.scamIndicators && msg.scamIndicators.length > 0 && (
                            <div className="text-xs opacity-80 font-normal normal-case ml-2">
                              {msg.scamIndicators.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                        <div 
                          key={i} 
                          className={`w-2 h-2 rounded-full animate-bounce ${getPersonaColorClass(activePersona, 'bg')}`} 
                          style={{ animationDelay: `${i * 150}ms` }} 
                        />
                      ))}
                    </div>
                    <span className="text-gray-300 font-bold uppercase tracking-wide text-xs">
                      {activePersona.serviceLabel} analyzing...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MOBILE-OPTIMIZED FOOTER - Reduced height */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-2 z-50">
        <div className="bg-black/70 rounded-xl border border-white/10 p-3">
          {/* Recording Status */}
          {isRecording && (
            <div className={`mb-2 p-2 border rounded-lg text-center animate-pulse backdrop-blur-xl ${
              getPersonaColorClass(activePersona, 'bg')
            }/20 ${getPersonaColorClass(activePersona, 'border')}/30 ${getPersonaColorClass(activePersona, 'text')} text-xs font-black uppercase tracking-wide`}>
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                RECORDING
              </div>
            </div>
          )}

          {/* LARGE MOBILE-FRIENDLY CONTROLS */}
          <div className="flex items-center justify-between mb-3 gap-2">
            {/* PROMINENT MIC BUTTON */}
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
            
            {/* VOICE GENDER TOGGLE */}
            <button 
              onClick={toggleVoiceGender}
              className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 flex flex-col items-center justify-center relative min-w-[50px] min-h-[50px] active:scale-95 transition-all"
            >
              <span className="text-xs font-black uppercase">{voiceGender === 'male' ? '♂' : '♀'}</span>
              <span className="text-[8px] font-bold">{voiceGender.toUpperCase()}</span>
            </button>
            
            {/* VOICE TOGGLE */}
            <button 
              onClick={() => { quickStopAllAudio(); setAutoTTS(!autoTTS); }} 
              className="p-3 rounded-xl bg-gray-800/60 border border-gray-600 text-white flex items-center justify-center relative min-w-[50px] min-h-[50px] active:scale-95 transition-all"
            >
              {autoTTS ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              {isSpeaking && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />}
            </button>
          </div>
          
          {/* INPUT ROW */}
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
                placeholder={
                  isRecording ? "Listening..." : 
                  selectedImage ? `Vision ready...` : 
                  `Ask ${activePersona.serviceLabel}...`
                } 
                className="bg-transparent w-full text-white text-base focus:outline-none placeholder-gray-500" 
                disabled={loading || isRecording}
                style={{ fontSize: '16px' }} // Prevents zoom on iOS
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
          
          {/* BOTTOM STATUS - Compact */}
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10">
            <button 
              onClick={() => { quickStopAllAudio(); setShowIntelligenceModal(true); }} 
              className="px-2 py-1 rounded-md bg-gray-800/60 border border-blue-400/30 text-blue-400 font-bold text-xs uppercase active:scale-95 transition-all"
            >
              {intelligenceSync}%
            </button>
            
            <div className="text-center">
              <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">
                LYLO BODYGUARD
              </p>
            </div>
            
            <div className="text-[8px] text-gray-400 uppercase font-bold">
              {activePersona?.serviceLabel?.split(' ')?.[0] || 'LOADING'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
