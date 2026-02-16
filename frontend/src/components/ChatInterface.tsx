import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';

// DIRECT CONNECTION TO YOUR BACKEND
const API_URL = 'https://lylo-backend.onrender.com';

// --- INTERFACES ---
export interface PersonaConfig {
  id: string;
  name: string;
  description: string;
  protectiveJob: string;
  spokenHook: string;
  capabilities: string[];
  color: string;
  requiredTier: 'free' | 'pro' | 'elite' | 'max';
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

// THE 10-EXPERT PERSONNEL ROSTER WITH CAPABILITIES
const PERSONAS: PersonaConfig[] = [
  // FREE TIER (1)
  { 
    id: 'guardian', 
    name: 'The Guardian', 
    description: 'Security Lead', 
    protectiveJob: 'Security Lead',
    spokenHook: 'I am The Guardian, your Security Lead.',
    capabilities: [
      'Detect scams and fraud attempts',
      'Analyze suspicious messages and emails',
      'Protect against identity theft',
      'Check website safety and legitimacy',
      'Identify phishing attempts',
      'Verify bank and financial communications'
    ],
    color: 'blue', 
    requiredTier: 'free'
  },
  
  // PRO TIER (4 total)
  { 
    id: 'roast', 
    name: 'The Roast Master', 
    description: 'Humor Shield', 
    protectiveJob: 'Humor Shield',
    spokenHook: 'I am The Roast Master, your Humor Shield.',
    capabilities: [
      'Deliver witty comebacks and roasts',
      'Use sarcasm to deflect threats',
      'Make light of stressful situations',
      'Provide comic relief during problems',
      'Turn scammer interactions into jokes',
      'Boost morale with humor'
    ],
    color: 'orange', 
    requiredTier: 'pro'
  },
  { 
    id: 'disciple', 
    name: 'The Disciple', 
    description: 'Spiritual Armor', 
    protectiveJob: 'Spiritual Armor',
    spokenHook: 'I am The Disciple, your Spiritual Armor.',
    capabilities: [
      'Provide biblical wisdom and guidance',
      'Quote relevant scriptures for situations',
      'Offer spiritual protection advice',
      'Share faith-based perspectives',
      'Help with prayer and meditation',
      'Give moral and ethical guidance'
    ],
    color: 'gold', 
    requiredTier: 'pro'
  },
  { 
    id: 'mechanic', 
    name: 'The Mechanic', 
    description: 'Garage Protector', 
    protectiveJob: 'Garage Protector',
    spokenHook: 'I am The Mechanic, your Garage Protector.',
    capabilities: [
      'Diagnose car problems and engine codes',
      'Explain automotive repairs and maintenance',
      'Identify automotive scam tactics',
      'Help with vehicle purchasing decisions',
      'Troubleshoot mechanical issues',
      'Protect against repair shop fraud'
    ],
    color: 'gray', 
    requiredTier: 'pro'
  },
  
  // ELITE TIER (6 total)
  { 
    id: 'lawyer', 
    name: 'The Lawyer', 
    description: 'Legal Shield', 
    protectiveJob: 'Legal Shield',
    spokenHook: 'I am The Lawyer, your Legal Shield.',
    capabilities: [
      'Explain legal rights and protections',
      'Review contracts and agreements',
      'Identify legal scams and fraud',
      'Guide through legal processes',
      'Help with estate planning basics',
      'Protect against legal exploitation'
    ],
    color: 'yellow', 
    requiredTier: 'elite'
  },
  { 
    id: 'techie', 
    name: 'The Techie', 
    description: 'Tech Bridge', 
    protectiveJob: 'Tech Bridge',
    spokenHook: 'I am The Techie, your Tech Bridge.',
    capabilities: [
      'Fix computer and smartphone issues',
      'Set up and troubleshoot devices',
      'Protect against tech support scams',
      'Explain technology in simple terms',
      'Help with apps and software',
      'Secure your digital devices'
    ],
    color: 'purple', 
    requiredTier: 'elite'
  },
  
  // MAX TIER (10 total)
  { 
    id: 'storyteller', 
    name: 'The Storyteller', 
    description: 'Mental Guardian', 
    protectiveJob: 'Mental Guardian',
    spokenHook: 'I am The Storyteller, your Mental Guardian.',
    capabilities: [
      'Create custom stories and narratives',
      'Help process difficult experiences',
      'Provide mental and emotional support',
      'Use storytelling for therapy and healing',
      'Share wisdom through tales',
      'Protect your mental wellbeing'
    ],
    color: 'indigo', 
    requiredTier: 'max'
  },
  { 
    id: 'comedian', 
    name: 'The Comedian', 
    description: 'Mood Protector', 
    protectiveJob: 'Mood Protector',
    spokenHook: 'I am The Comedian, your Mood Protector.',
    capabilities: [
      'Tell jokes and funny stories',
      'Lighten the mood in any situation',
      'Use humor to cope with stress',
      'Provide entertainment and laughter',
      'Make serious topics more approachable',
      'Protect your emotional health with comedy'
    ],
    color: 'pink', 
    requiredTier: 'max'
  },
  { 
    id: 'chef', 
    name: 'The Chef', 
    description: 'Kitchen Safety', 
    protectiveJob: 'Kitchen Safety',
    spokenHook: 'I am The Chef, your Kitchen Safety specialist.',
    capabilities: [
      'Create recipes and meal plans',
      'Provide cooking tips and techniques',
      'Ensure food safety and nutrition',
      'Help with dietary restrictions',
      'Protect against food-related scams',
      'Make cooking enjoyable and safe'
    ],
    color: 'red', 
    requiredTier: 'max'
  },
  { 
    id: 'fitness', 
    name: 'The Fitness Coach', 
    description: 'Mobility Protector', 
    protectiveJob: 'Mobility Protector',
    spokenHook: 'I am The Fitness Coach, your Mobility Protector.',
    capabilities: [
      'Design safe exercise routines',
      'Help with mobility and physical therapy',
      'Provide nutrition and wellness advice',
      'Protect against fitness scams',
      'Adapt workouts for any ability level',
      'Keep you moving safely and healthily'
    ],
    color: 'green', 
    requiredTier: 'max'
  }
];

export default function ChatInterface({ 
  currentPersona, 
  userEmail, 
  zoomLevel, 
  onZoomChange, 
  onPersonaChange, 
  onLogout, 
  onUsageUpdate
}: ChatInterfaceProps) {
  
  // --- CORE STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- IDENTITY & PERSONALIZATION ---
  const [userName, setUserName] = useState<string>('');
  const [hasGivenInitialGreeting, setHasGivenInitialGreeting] = useState(false);
  const [intelligenceSync, setIntelligenceSync] = useState(0);
  
  // --- VOICE & MIC (FIXED TAP-TO-RECORD-TO-SEND) ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [instantVoice, setInstantVoice] = useState(false);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  
  // --- TIMEOUT LOOP FIX: USE REFS ---
  const lastInteractionTimeRef = useRef(Date.now());
  const isInStandbyModeRef = useRef(false);
  const standbyTimerRef = useRef<any>(null);
  
  // State for UI render
  const [isInStandbyMode, setIsInStandbyMode] = useState(false); 
  
  // --- UI STATE ---
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  
  // --- FEATURES ---
  const [language, setLanguage] = useState<'en' | 'es'>('en'); 
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [bibleVersion, setBibleVersion] = useState<'kjv' | 'esv'>('kjv');
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>(
    (localStorage.getItem('userTier') as any) || 'free'
  );
  
  // --- INTELLIGENCE SYNC MODAL ---
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [calibrationAnswers, setCalibrationAnswers] = useState({
    primaryConcern: '',
    deviceType: '',
    communicationStyle: ''
  });
  
  // --- SCAM RECOVERY ---
  const [showScamRecovery, setShowScamRecovery] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false); 
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null);
  const [isEliteUser, setIsEliteUser] = useState(
    userEmail.toLowerCase().includes('stangman') || 
    userEmail.toLowerCase().includes('elite') ||
    localStorage.getItem('userTier') === 'max'
  );
    
  // --- STATE REFS ---
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<string>(''); // Store transcript for immediate sending

  // --- PERSONA COLOR MAPPING ---
  const getPersonaColorClass = (persona: PersonaConfig, type: 'border' | 'glow' | 'bg' | 'text' = 'border') => {
    const colorMap = {
      blue: {
        border: 'border-blue-500',
        glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
        bg: 'bg-blue-600',
        text: 'text-blue-400'
      },
      orange: {
        border: 'border-orange-500',
        glow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]',
        bg: 'bg-orange-600',
        text: 'text-orange-400'
      },
      gold: {
        border: 'border-yellow-500',
        glow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]',
        bg: 'bg-yellow-600',
        text: 'text-yellow-400'
      },
      gray: {
        border: 'border-gray-500',
        glow: 'shadow-[0_0_20px_rgba(107,114,128,0.4)]',
        bg: 'bg-gray-600',
        text: 'text-gray-400'
      },
      yellow: {
        border: 'border-yellow-400',
        glow: 'shadow-[0_0_20px_rgba(251,191,36,0.4)]',
        bg: 'bg-yellow-500',
        text: 'text-yellow-300'
      },
      purple: {
        border: 'border-purple-500',
        glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
        bg: 'bg-purple-600',
        text: 'text-purple-400'
      },
      indigo: {
        border: 'border-indigo-500',
        glow: 'shadow-[0_0_20px_rgba(99,102,241,0.4)]',
        bg: 'bg-indigo-600',
        text: 'text-indigo-400'
      },
      pink: {
        border: 'border-pink-500',
        glow: 'shadow-[0_0_20px_rgba(236,72,153,0.4)]',
        bg: 'bg-pink-600',
        text: 'text-pink-400'
      },
      red: {
        border: 'border-red-500',
        glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
        bg: 'bg-red-600',
        text: 'text-red-400'
      },
      green: {
        border: 'border-green-500',
        glow: 'shadow-[0_0_20px_rgba(34,197,94,0.4)]',
        bg: 'bg-green-600',
        text: 'text-green-400'
      }
    };
    
    return colorMap[persona.color as keyof typeof colorMap]?.[type] || colorMap.blue[type];
  };

  // --- TIER LOGIC ---
  const canAccessPersona = (persona: PersonaConfig): boolean => {
    const tierHierarchy = { free: 0, pro: 1, elite: 2, max: 3 };
    return tierHierarchy[userTier] >= tierHierarchy[persona.requiredTier];
  };

  const getAccessiblePersonas = () => {
    return PERSONAS.filter(persona => canAccessPersona(persona));
  };

  const getTierName = (tier: string): string => {
    switch(tier) {
      case 'free': return 'Basic Shield';
      case 'pro': return 'Pro Guardian';
      case 'elite': return 'Elite Justice';  
      case 'max': return 'Max Unlimited';
      default: return 'Unknown';
    }
  };

  // --- PRIVACY SHIELD VISUAL ---
  const getPrivacyShieldClass = () => {
    const personaClasses = getPersonaColorClass(currentPersona, 'border') + ' ' + getPersonaColorClass(currentPersona, 'glow');
    
    if (isInStandbyMode) {
      return 'border-gray-500 shadow-[0_0_10px_rgba(107,114,128,0.3)]';
    }
    
    if (loading) {
      return 'border-yellow-500 shadow-[0_0_15px_rgba(255,191,0,0.4)] animate-pulse';
    }
    
    const lastBotMsg = [...messages].reverse().find(m => m.sender === 'bot');
    if (lastBotMsg?.scamDetected && lastBotMsg?.confidenceScore === 100) {
      return 'border-red-500 shadow-[0_0_20px_rgba(255,77,77,0.8)] animate-bounce';
    }
    
    return personaClasses;
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    initializeLylo();
    return () => {
      if (standbyTimerRef.current) clearInterval(standbyTimerRef.current);
      // Cleanup speech synthesis
      window.speechSynthesis.cancel();
    };
  }, [userEmail]);

  const initializeLylo = async () => {
    await loadUserStats();
    await checkEliteStatus();
    loadSavedPreferences();
    detectUserName();
    startPrivacyShieldMonitoring();
    
    // Load saved persona preference
    const savedPersona = localStorage.getItem('lylo_preferred_persona');
    if (savedPersona) {
      const persona = PERSONAS.find(p => p.id === savedPersona);
      if (persona && canAccessPersona(persona)) {
        onPersonaChange(persona);
      }
    }
    
    // MINIMAL INITIAL GREETING
    if (!hasGivenInitialGreeting) {
      setTimeout(() => giveInitialGreeting(), 1000);
    }
  };

  const loadSavedPreferences = () => {
    const savedVoice = localStorage.getItem('lylo_voice_gender');
    if (savedVoice === 'female') setVoiceGender('female');
    
    const savedBibleVersion = localStorage.getItem('lylo_bible_version');
    if (savedBibleVersion === 'esv') setBibleVersion('esv');
    
    const savedInstantVoice = localStorage.getItem('lylo_instant_voice');
    if (savedInstantVoice === 'true') setInstantVoice(true);
    
    const savedGreeting = localStorage.getItem('lylo_initial_greeting');
    if (savedGreeting === 'true') setHasGivenInitialGreeting(true);
    
    const savedSync = localStorage.getItem('lylo_intelligence_sync');
    if (savedSync) setIntelligenceSync(parseInt(savedSync) || 0);
    
    const savedUserName = localStorage.getItem('lylo_user_name');
    if (savedUserName) setUserName(savedUserName);
    
    const savedAutoTTS = localStorage.getItem('lylo_auto_tts');
    if (savedAutoTTS === 'false') setAutoTTS(false);

    const savedLanguage = localStorage.getItem('lylo_language');
    if (savedLanguage === 'es') setLanguage('es');
  };

  // --- DYNAMIC NAME DETECTION ---
  const detectUserName = () => {
    let detectedName = '';
    
    if (userEmail && !detectedName) {
      const emailPart = userEmail.split('@')[0];
      if (emailPart.toLowerCase().includes('stangman')) detectedName = 'Christopher';
      else if (emailPart.toLowerCase().includes('paul')) detectedName = 'Paul';
      else if (emailPart.toLowerCase().includes('eric')) detectedName = 'Eric';
    }
    
    const savedUserName = localStorage.getItem('lylo_user_name');
    if (savedUserName && !detectedName) {
      detectedName = savedUserName;
    }
    
    if (detectedName) {
      setUserName(detectedName);
    }
  };

  // --- MINIMAL INITIAL GREETING ---
  const giveInitialGreeting = async () => {
    if (hasGivenInitialGreeting) return;
    
    const greetingMessage = "Hello, I'm LYLO. Please select a persona.";
    await speakText(greetingMessage);
    
    const botMsg: Message = { 
      id: Date.now().toString(), 
      content: greetingMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    setHasGivenInitialGreeting(true);
    localStorage.setItem('lylo_initial_greeting', 'true');
  };

  // --- PERSONA CHANGE WITH INTRODUCTION ---
  const handlePersonaChange = async (persona: PersonaConfig) => {
    if (!canAccessPersona(persona)) {
      const expansionMessage = `I can help with basic protection, but for ${persona.description.toLowerCase()}, we need to bring in ${persona.name}. Would you like to expand your team and deploy them to your side now?`;
      
      const botMsg: Message = { 
        id: Date.now().toString(), 
        content: expansionMessage, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: 90
      };
      setMessages(prev => [...prev, botMsg]);
      await speakText(expansionMessage);
      return;
    }
    
    // FULL STOP - SILENCE ANY CURRENT SPEECH
    quickStopAllAudio();
    
    // Save persona preference
    localStorage.setItem('lylo_preferred_persona', persona.id);
    
    onPersonaChange(persona);
    setShowDropdown(false);
    
    // PERSONA INTRODUCTION WITH CAPABILITIES
    const introMessage = `${persona.spokenHook} Here's what I can do for you: ${persona.capabilities.slice(0, 3).join(', ')}, and much more. How can I protect and assist you today?`;
    
    await speakText(introMessage);
    
    const botMsg: Message = { 
      id: Date.now().toString(), 
      content: introMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    incrementIntelligenceSync();
  };

  const incrementIntelligenceSync = () => {
    const newSync = Math.min(intelligenceSync + 5, 100);
    setIntelligenceSync(newSync);
    localStorage.setItem('lylo_intelligence_sync', newSync.toString());
  };

  // --- PRIVACY SHIELD (Auto-Standby) ---
  const startPrivacyShieldMonitoring = () => {
    if (standbyTimerRef.current) {
      clearInterval(standbyTimerRef.current);
    }
    
    standbyTimerRef.current = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteractionTimeRef.current;
      
      if (timeSinceLastInteraction > 120000 && !isInStandbyModeRef.current) {
        goToStandbyMode();
      }
    }, 10000); // Check every 10 seconds
  };

  const goToStandbyMode = async () => {
    if (isInStandbyModeRef.current) return;
    
    isInStandbyModeRef.current = true;
    setIsInStandbyMode(true);
    
    // SILENT STANDBY: No intrusive speech or messages, just visual indicator change
    // The UI will show "Privacy Mode" status instead of speaking
  };

  const wakeFromStandby = () => {
    isInStandbyModeRef.current = false;
    setIsInStandbyMode(false);
    lastInteractionTimeRef.current = Date.now();
  };

  const updateInteractionTime = () => {
    lastInteractionTimeRef.current = Date.now();
    if (isInStandbyModeRef.current) {
      wakeFromStandby();
    }
  };

  // --- ENHANCED AUDIO FUNCTIONS WITH QUEUE ---
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeechQueue([]);
    setCurrentSpeech(null);
  };

  const splitIntoSentences = (text: string): string[] => {
    // Split by sentence-ending punctuation, keeping reasonable chunks
    const sentences = text.match(/[^\.!?]*[\.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  };

  const speakText = async (text: string, forceGender?: string) => {
    if (!autoTTS && !forceGender) return;
    if (!text) return;
    
    // FULL STOP: Stop any current speech immediately
    quickStopAllAudio();
    
    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;

    setIsSpeaking(true);

    // Try OpenAI TTS first if realistic voice is enabled
    if (!instantVoice && cleanText.length < 800) {
      try {
        const formData = new FormData();
        formData.append('text', cleanText.substring(0, 600));
        formData.append('voice', forceGender === 'male' || voiceGender === 'male' ? 'onyx' : 'nova');

        const response = await fetch(`${API_URL}/generate-audio`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.audio_b64) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      } catch (error) {
        console.log('OpenAI TTS failed, using browser fallback');
      }
    }
    
    // Fallback to browser speech synthesis with sentence queuing
    const sentences = splitIntoSentences(cleanText);
    setSpeechQueue(sentences);
    speakNextSentence(sentences, 0);
  };

  const speakNextSentence = (sentences: string[], index: number) => {
    if (index >= sentences.length) {
      setIsSpeaking(false);
      setSpeechQueue([]);
      setCurrentSpeech(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    utterance.rate = 0.9;
    utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
    
    utterance.onend = () => {
      speakNextSentence(sentences, index + 1);
    };
    
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechQueue([]);
      setCurrentSpeech(null);
    };

    setCurrentSpeech(utterance);
    window.speechSynthesis.speak(utterance);
  };

  // --- FIXED WALKIE-TALKIE SPEECH RECOGNITION ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false; // Only final results
      recognition.lang = language === 'es' ? 'es-MX' : 'en-US'; 
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setRecordingState('recording');
        transcriptRef.current = ''; // Clear previous transcript
        console.log('Speech recognition started');
      };
      
      recognition.onresult = (event: any) => {
        updateInteractionTime();
        console.log('Speech recognition result received');
        
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          }
        }
        
        if (finalTranscript.trim()) {
          console.log('Final transcript:', finalTranscript.trim());
          transcriptRef.current = finalTranscript.trim();
          setInput(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        setRecordingState('idle');
        transcriptRef.current = '';
      };

      recognition.onend = () => {
        console.log('Speech recognition ended, transcript:', transcriptRef.current);
        setRecordingState('processing');
        
        // FIXED: Immediate send with transcript
        const transcript = transcriptRef.current.trim();
        if (transcript) {
          console.log('Sending transcript:', transcript);
          // Update input and send immediately
          setInput(transcript);
          handleSendWithText(transcript);
        } else {
          console.log('No transcript to send');
        }
        
        // Reset states
        setIsRecording(false);
        setRecordingState('idle');
        transcriptRef.current = '';
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    } else {
      setMicSupported(false);
    }
  }, [language]);

  // --- USER INTERFACE HANDLERS ---
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const checkEliteStatus = async () => {
    try {
      const cleanEmail = userEmail.toLowerCase().trim();
      if (cleanEmail.includes("stangman")) {
           setIsEliteUser(true);
           setUserTier('max');
      }
      const response = await fetch(`${API_URL}/check-beta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await response.json();
      
      if (data.tier === 'max') {
        setUserTier('max');
        setIsEliteUser(true);
      } else if (data.tier === 'elite') {
        setUserTier('elite');
        setIsEliteUser(true);
      } else if (data.tier === 'pro') {
        setUserTier('pro');
      } else {
        setUserTier('free');
      }
      
      localStorage.setItem('userTier', data.tier || 'free');
    } catch (error) {
      console.error('Failed to check elite status:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
      if (onUsageUpdate) onUsageUpdate();
    } catch (error) { console.error(error); }
  };

  // --- FIXED WALKIE-TALKIE MIC HANDLER ---
  const handleWalkieTalkieMic = () => {
    if (!micSupported) {
      alert('Microphone not supported');
      return;
    }
    
    updateInteractionTime();
    
    if (isRecording) {
      // STOP RECORDING: This will trigger onend which auto-sends
      const recognition = recognitionRef.current;
      if (recognition) {
        try { 
          recognition.stop(); 
        } catch (e) {}
      }
      setIsRecording(false);
    } else {
      // START RECORDING: Begin tap-to-record
      quickStopAllAudio(); // FULL STOP RULE
      setIsRecording(true);
      setRecordingState('recording');
      
      if (isInStandbyModeRef.current) {
        wakeFromStandby();
      }
      
      // Start recognition
      const recognition = recognitionRef.current;
      if (recognition) {
        try { 
          recognition.start(); 
        } catch(e) { 
          setIsRecording(false);
          setRecordingState('idle'); 
        }
      }
    }
  };

  const toggleTTS = () => {
    quickStopAllAudio();
    const newAutoTTS = !autoTTS;
    setAutoTTS(newAutoTTS);
    localStorage.setItem('lylo_auto_tts', newAutoTTS.toString());
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      updateInteractionTime();
      quickStopAllAudio(); // FULL STOP RULE
    }
  };

  // --- FIXED SEND HANDLER WITH TEXT PARAMETER ---
  const handleSendWithText = async (textToSend: string) => {
    if ((!textToSend && !selectedImage) || loading) return;

    updateInteractionTime();
    quickStopAllAudio(); // FULL STOP RULE

    // Check for name in user input
    if (!userName && textToSend) {
      const possibleName = extractNameFromMessage(textToSend);
      if (possibleName) {
        setUserName(possibleName);
        localStorage.setItem('lylo_user_name', possibleName);
        incrementIntelligenceSync();
      }
    }

    if (userStats && userStats.usage.current >= userStats.usage.limit) {
      setShowLimitModal(true); 
      return; 
    }

    let previewContent = textToSend;
    if (selectedImage) previewContent = textToSend ? `${textToSend} [Image: ${selectedImage.name}]` : `[Image: ${selectedImage.name}]`;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: previewContent, 
      sender: 'user', 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setIsRecording(false);
    setRecordingState('idle');

    try {
      // Add search verbalization for general questions
      if (isGeneralSearchQuery(textToSend)) {
        const searchMessage = `I'm searching the web for ${textToSend.toLowerCase()} specifically for you now, ${userName || 'friend'}.`;
        const searchMsg: Message = { 
          id: (Date.now() + 0.5).toString(), 
          content: searchMessage, 
          sender: 'bot', 
          timestamp: new Date(),
          confidenceScore: 95
        };
        setMessages(prev => [...prev, searchMsg]);
        await speakText(searchMessage);
      }

      const conversationHistory = messages.slice(-4).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      let personaWithBible = currentPersona.id;
      if (currentPersona.id === 'disciple') {
        personaWithBible = `disciple_${bibleVersion}`;
      }

      const response = await sendChatMessage(
        textToSend || "Analyze this image", 
        conversationHistory,
        personaWithBible,
        userEmail,
        selectedImage,
        language 
      );
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        content: response.answer, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: response.scam_indicators || [] 
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      // Speak the response if AI voice is enabled
      await speakText(response.answer);
      
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadUserStats();
      
      // Update profile based on conversation
      if (textToSend.length > 10) {
        incrementIntelligenceSync();
      }
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        content: language === 'es' ? "Error de conexión. Por favor intente de nuevo." : "Connection error. Please try again.", 
        sender: 'bot', 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if ((!textToSend && !selectedImage) || loading) return;
    await handleSendWithText(textToSend);
  };
    setLoading(true);
    setIsRecording(false);
    setRecordingState('idle');

    try {
      // Add search verbalization for general questions
      if (isGeneralSearchQuery(textToSend)) {
        const searchMessage = `I'm searching for ${textToSend.toLowerCase()} specifically for you now, ${userName || 'friend'}.`;
        const searchMsg: Message = { 
          id: (Date.now() + 0.5).toString(), 
          content: searchMessage, 
          sender: 'bot', 
          timestamp: new Date(),
          confidenceScore: 95
        };
        setMessages(prev => [...prev, searchMsg]);
        await speakText(searchMessage);
      }

      const conversationHistory = messages.slice(-2).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      let personaWithBible = currentPersona.id;
      if (currentPersona.id === 'disciple') {
        personaWithBible = `disciple_${bibleVersion}`;
      }

      const response = await sendChatMessage(
        textToSend || "Analyze this image", 
        conversationHistory,
        personaWithBible,
        userEmail,
        selectedImage,
        language 
      );
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        content: response.answer, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: response.scam_indicators || [] 
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      // Speak the response if AI voice is enabled
      await speakText(response.answer);
      
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadUserStats();
      
      // Update profile based on conversation
      if (textToSend.length > 10) {
        incrementIntelligenceSync();
      }
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        content: language === 'es' ? "Error de conexión. Por favor intente de nuevo." : "Connection error. Please try again.", 
        sender: 'bot', 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // --- UTILITY FUNCTIONS ---
  const extractNameFromMessage = (message: string): string => {
    const namePatterns = [
      /my name is (\w+)/i,
      /call me (\w+)/i,
      /i'm (\w+)/i,
      /i am (\w+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      }
    }
    return '';
  };

  const isGeneralSearchQuery = (query: string): boolean => {
    const searchIndicators = [
      'what is', 'how to', 'where can i', 'tell me about', 'find me', 'search for',
      'look up', 'who is', 'when did', 'why does', 'best', 'recommended'
    ];
    
    const lowerQuery = query.toLowerCase();
    return searchIndicators.some(indicator => lowerQuery.includes(indicator));
  };

  const handleGetFullGuide = async () => {
    if (!isEliteUser) {
      alert('Scam Recovery Center requires Elite team access.');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/scam-recovery/${userEmail}`);
      if (!response.ok) {
        throw new Error('Failed to load recovery guide');
      }
      const data = await response.json();
      setGuideData(data);
      setShowFullGuide(true); 
    } catch (error) {
      console.error('Recovery guide error:', error);
      alert("Could not load the recovery guide. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openScamRecovery = () => {
    quickStopAllAudio(); // FULL STOP RULE
    if (!isEliteUser) {
      alert('Scam Recovery Center is exclusive to Elite and Max tier members.');
      return;
    }
    setShowScamRecovery(true);
  };

  // --- COMMAND CENTER ACTION HUB HANDLERS ---
  const handleSearchEverything = async () => {
    updateInteractionTime();
    quickStopAllAudio(); // FULL STOP RULE
    
    const searchMessage = `What can you help me find?`;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: searchMessage, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Trigger LYLO's proactive response
    const proactiveMessage = `I can help you find anything! I'm your personalized search engine. Ask me about current events, research topics, local businesses, how-to guides, or anything else. What would you like me to search for?`;
    
    const botMsg: Message = { 
      id: (Date.now() + 1).toString(), 
      content: proactiveMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    await speakText(proactiveMessage);
  };

  const handleShieldMe = async () => {
    updateInteractionTime();
    quickStopAllAudio(); // FULL STOP RULE
    
    const shieldMessage = `Is this message a scam?`;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: shieldMessage, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    
    // LYLO's scam protection response
    const protectionMessage = `I'm activating scam detection mode. Share any suspicious message, email, text, or phone call with me and I'll analyze it for fraud indicators. I can detect phishing attempts, romance scams, tech support scams, and more. What message do you want me to check?`;
    
    const botMsg: Message = { 
      id: (Date.now() + 1).toString(), 
      content: protectionMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    await speakText(protectionMessage);
  };

  const handleVisionLink = async () => {
    updateInteractionTime();
    quickStopAllAudio(); // FULL STOP RULE
    
    const visionMessage = `I want to show you something`;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: visionMessage, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    
    // LYLO's vision response
    const visionResponse = `I'm ready to analyze any image! I can examine photos for scams, read text in images, analyze documents, check if something looks suspicious, or answer questions about what I see. Take a photo or select one from your gallery.`;
    
    const botMsg: Message = { 
      id: (Date.now() + 1).toString(), 
      content: visionResponse, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    await speakText(visionResponse);
    
    // Open photo picker
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleTalkToExpert = () => {
    updateInteractionTime();
    quickStopAllAudio(); // FULL STOP RULE
    setShowDropdown(true);
  };

  // --- INTELLIGENCE SYNC MODAL HANDLERS ---
  const handleIntelligenceSyncClick = () => {
    quickStopAllAudio(); // FULL STOP RULE
    setShowIntelligenceModal(true);
    setCalibrationStep(1);
  };

  const handleCalibrationAnswer = (answer: string) => {
    if (calibrationStep === 1) {
      setCalibrationAnswers({...calibrationAnswers, primaryConcern: answer});
      setCalibrationStep(2);
    } else if (calibrationStep === 2) {
      setCalibrationAnswers({...calibrationAnswers, deviceType: answer});
      setCalibrationStep(3);
    } else if (calibrationStep === 3) {
      const finalAnswers = {...calibrationAnswers, communicationStyle: answer};
      setCalibrationAnswers(finalAnswers);
      completeCalibration(finalAnswers);
    }
  };

  const completeCalibration = async (finalAnswers: any) => {
    const newSync = Math.min(intelligenceSync + 25, 100);
    setIntelligenceSync(newSync);
    localStorage.setItem('lylo_intelligence_sync', newSync.toString());
    localStorage.setItem('lylo_calibration_answers', JSON.stringify(finalAnswers));
    
    setShowIntelligenceModal(false);
    
    setTimeout(async () => {
      const syncMessage = `Intelligence sync updated to ${newSync}%. I'm learning your preferences and will provide more personalized protection.`;
      const botMsg: Message = { 
        id: Date.now().toString(), 
        content: syncMessage, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: 100
      };
      setMessages(prev => [...prev, botMsg]);
      await speakText(syncMessage);
    }, 500);
  };

  const cycleFontSize = () => {
    quickStopAllAudio(); // FULL STOP RULE
    if (zoomLevel < 100) onZoomChange(100);
    else if (zoomLevel < 125) onZoomChange(125);
    else onZoomChange(85);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getUserDisplayName = () => {
    if (userName) return userName;
    if (userEmail.toLowerCase().includes('stangman')) return 'Christopher';
    return userEmail.split('@')[0];
  };

  // --- COMMAND CENTER LANDING (NO CHATGPT BLANK PAGE) ---
  const CommandCenter = () => (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      {/* LYLO Logo with Persona-Specific Glow */}
      <div className={`w-24 h-24 bg-gradient-to-br from-gray-800 to-black rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-all duration-700 ${getPersonaColorClass(currentPersona, 'border')} ${getPersonaColorClass(currentPersona, 'glow')} border-2`}>
        <span className="text-white font-black text-3xl tracking-wider">LYLO</span>
      </div>
      
      <h1 className={`text-3xl font-black uppercase tracking-[0.1em] mb-2 ${getPersonaColorClass(currentPersona, 'text')}`}>
        {currentPersona.name}
      </h1>
      <p className="text-gray-400 text-sm font-bold uppercase tracking-[0.1em] mb-1">
        {currentPersona.protectiveJob}
      </p>
      <p className="text-gray-500 text-xs uppercase tracking-[0.2em] font-medium mb-8">
        {isInStandbyMode ? 'Privacy Mode - Touch Any Button to Activate' : 'Digital Bodyguard Active'}
      </p>
      
      {/* Intelligence Sync Progress - Clickable */}
      <div className="mb-8 w-full max-w-md cursor-pointer" onClick={handleIntelligenceSyncClick}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-bold text-xs uppercase tracking-wider">Intelligence Sync</span>
          <span className={`font-black text-sm ${getPersonaColorClass(currentPersona, 'text')}`}>{intelligenceSync}%</span>
        </div>
        <div className={`bg-gray-800 rounded-full h-3 overflow-hidden border transition-all duration-300 hover:scale-105 ${getPersonaColorClass(currentPersona, 'border')}`}>
          <div 
            className={`h-full transition-all duration-500 rounded-full ${getPersonaColorClass(currentPersona, 'bg')}`}
            style={{ width: `${intelligenceSync}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs mt-1 hover:text-gray-300 transition-colors">Click to sync faster</p>
      </div>

      {/* 4 Large Action Hub Tiles */}
      <div className="grid grid-cols-2 gap-6 max-w-2xl w-full px-4">
        <button
          onClick={handleSearchEverything}
          className="bg-gray-900/60 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-8 text-center hover:bg-gray-800/80 transition-all duration-300 group transform hover:scale-105"
        >
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-blue-400 font-black text-xl mb-3 uppercase tracking-wider group-hover:text-blue-300">
            Search Everything
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Ask me to find anything on the web.
          </p>
        </button>

        <button
          onClick={handleShieldMe}
          className="bg-gray-900/60 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center hover:bg-gray-800/80 transition-all duration-300 group transform hover:scale-105"
        >
          <div className="text-5xl mb-4">🛡️</div>
          <h3 className="text-red-400 font-black text-xl mb-3 uppercase tracking-wider group-hover:text-red-300">
            Shield Me
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Paste a message here to check for scams.
          </p>
        </button>

        <button
          onClick={handleVisionLink}
          className="bg-gray-900/60 backdrop-blur-xl border border-green-500/30 rounded-2xl p-8 text-center hover:bg-gray-800/80 transition-all duration-300 group transform hover:scale-105"
        >
          <div className="text-5xl mb-4">📸</div>
          <h3 className="text-green-400 font-black text-xl mb-3 uppercase tracking-wider group-hover:text-green-300">
            Vision Link
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Show me a photo of a problem to solve it.
          </p>
        </button>

        <button
          onClick={handleTalkToExpert}
          className="bg-gray-900/60 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-8 text-center hover:bg-gray-800/80 transition-all duration-300 group transform hover:scale-105"
        >
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-purple-400 font-black text-xl mb-3 uppercase tracking-wider group-hover:text-purple-300">
            Talk to Expert
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Access: {getAccessiblePersonas().length}/10 specialists
          </p>
        </button>
      </div>

      {/* Privacy Shield Status */}
      <div className="mt-8 flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full transition-colors ${isInStandbyMode ? 'bg-gray-500' : getPersonaColorClass(currentPersona, 'bg')}`} />
        <span className="text-gray-400 text-xs font-black uppercase tracking-widest">
          {isInStandbyMode ? 'Privacy Mode' : 'Protected Mode'}
        </span>
      </div>
    </div>
  );

  // --- INTELLIGENCE SYNC MODAL COMPONENT ---
  const IntelligenceSyncModal = () => (
    <div className="fixed inset-0 z-[100100] bg-black/95 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-4xl mb-4">🧠</div>
        <h2 className="text-white font-black text-xl uppercase tracking-wider mb-4">Intelligence Sync</h2>
        <p className="text-gray-300 text-sm mb-6">Answer 3 questions to calibrate your Digital Bodyguard</p>
        
        {calibrationStep === 1 && (
          <div>
            <h3 className="text-white font-bold mb-4">What's your primary security concern?</h3>
            <div className="space-y-2">
              {['Scams & Fraud', 'Identity Theft', 'Tech Support', 'Privacy'].map(option => (
                <button key={option} onClick={() => handleCalibrationAnswer(option)} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {calibrationStep === 2 && (
          <div>
            <h3 className="text-white font-bold mb-4">What device do you use most?</h3>
            <div className="space-y-2">
              {['Smartphone', 'Computer', 'Tablet', 'All devices'].map(option => (
                <button key={option} onClick={() => handleCalibrationAnswer(option)} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {calibrationStep === 3 && (
          <div>
            <h3 className="text-white font-bold mb-4">How do you prefer communication?</h3>
            <div className="space-y-2">
              {['Direct & Brief', 'Detailed Explanations', 'Friendly & Casual', 'Professional'].map(option => (
                <button key={option} onClick={() => handleCalibrationAnswer(option)} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-center mt-6 space-x-2">
          {[1, 2, 3].map(step => (
            <div key={step} className={`w-2 h-2 rounded-full ${step <= calibrationStep ? 'bg-blue-500' : 'bg-gray-600'}`} />
          ))}
        </div>
        
        <button 
          onClick={() => setShowIntelligenceModal(false)} 
          className="mt-4 text-gray-500 text-xs hover:text-gray-300"
        >
          Skip calibration
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
        backgroundColor: '#050505', display: 'flex', flexDirection: 'column',
        height: '100dvh', width: '100vw', overflow: 'hidden',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont'
    }}>
      
      {showIntelligenceModal && <IntelligenceSyncModal />}
      
      {showScamRecovery && (
        <div className="fixed inset-0 z-[100020] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-black/95 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-red-400 font-black text-lg uppercase tracking-wider">🛡️ SCAM RECOVERY CENTER</h2>
              <button onClick={() => setShowScamRecovery(false)} className="text-white text-xl font-bold px-3 py-1 bg-red-600 rounded-lg">X</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                <p className="text-red-300 font-bold mb-2">IMMEDIATE ACTIONS:</p>
                <ul className="text-gray-300 space-y-1 text-xs">
                  <li>• STOP sending any more money immediately</li>
                  <li>• Call your bank fraud department right now</li>
                  <li>• Change all passwords and enable 2FA</li>
                  <li>• Screenshot everything for evidence</li>
                  <li>• File police report with documentation</li>
                </ul>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                <p className="text-yellow-300 font-bold mb-2">PHONE SCRIPT FOR BANK:</p>
                <p className="text-gray-300 text-xs italic">"This is a fraud emergency. I need to report unauthorized access to my account and fraudulent transfers. Connect me to your fraud specialist immediately."</p>
              </div>
              <button
                className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${loading ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                onClick={handleGetFullGuide}
                disabled={loading}
              >
                {loading ? <span>GENERATING GUIDE...</span> : <span>🛡️ GET FULL RECOVERY GUIDE</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFullGuide && guideData && (
        <div className="fixed inset-0 z-[100030] bg-black/95 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 bg-red-900/20 flex justify-between items-start flex-shrink-0">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wider">{guideData.title}</h2>
                <p className="text-red-300 text-xs mt-1 font-bold">{guideData.subtitle}</p>
              </div>
              <button onClick={() => setShowFullGuide(false)} className="p-2 bg-black/40 hover:bg-white/10 rounded-lg text-white transition-colors">✕</button>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              <section>
                <h3 className="text-red-500 font-black mb-2 uppercase tracking-widest text-xs border-b border-red-500/30 pb-1">Phase 1: Stop the Bleeding</h3>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <ul className="space-y-2">
                    {guideData.immediate_actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-200 text-sm">
                        <span className="text-red-500 font-bold mt-0.5">●</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-blue-500 font-black mb-2 uppercase tracking-widest text-xs border-b border-blue-500/30 pb-1">Phase 2: Recovery Protocol</h3>
                {guideData.recovery_steps.map((step) => (
                  <div key={step.step} className="bg-gray-800/40 rounded-lg p-3 border border-white/5">
                    <h4 className="font-bold text-white text-sm mb-1">Step {step.step}: {step.title}</h4>
                    <ul className="space-y-1 pl-4 border-l-2 border-blue-500/30">
                      {step.actions.map((act, i) => <li key={i} className="text-gray-400 text-xs">{act}</li>)}
                    </ul>
                  </div>
                ))}
              </section>
              <section>
                <h3 className="text-green-500 font-black mb-2 uppercase tracking-widest text-xs border-b border-green-500/30 pb-1">Phase 3: Future Prevention</h3>
                <ul className="grid grid-cols-1 gap-2">
                  {guideData.prevention_tips.map((tip, i) => (
                    <li key={i} className="bg-green-900/10 text-green-200 p-2 rounded border border-green-500/20 text-xs font-medium">{tip}</li>
                  ))}
                </ul>
              </section>
            </div>
            <div className="p-3 border-t border-gray-800 bg-gray-900 flex-shrink-0">
              <button onClick={() => setShowFullGuide(false)} className="bg-white text-black w-full py-3 rounded-lg font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors">Close Recovery Guide</button>
            </div>
          </div>
        </div>
      )}

      {/* Protection Limit Modal - Appears exactly ONCE */}
      {showLimitModal && userStats && (
        <div className="fixed inset-0 z-[100050] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
             <div className="text-4xl mb-3">🛡️</div>
             <h2 className="text-white font-black text-lg uppercase tracking-wider mb-2">Protection Limit Reached</h2>
             <p className="text-gray-300 text-sm mb-6">You have used all {userStats.usage.limit} daily protections. Upgrade to expand your digital bodyguard team.</p>
             <button onClick={() => { setShowLimitModal(false); onLogout(); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg uppercase tracking-wider transition-all">Expand Team</button>
             <button onClick={() => setShowLimitModal(false)} className="mt-3 text-gray-500 text-xs font-bold hover:text-gray-300">Continue Reading</button>
          </div>
        </div>
      )}

      {/* HEADER WITH PERSONA-SPECIFIC GLOW */}
      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-3 flex-shrink-0 relative z-[100002]">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); quickStopAllAudio(); setShowDropdown(!showDropdown); }} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
              <div className="space-y-1">
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
              </div>
            </button>
            
            {showDropdown && (
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[300px] z-[100003] max-h-[70vh] overflow-y-auto shadow-2xl">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-black text-xs uppercase tracking-wider">Expert Team</h3>
                    <span className="text-blue-400 font-bold text-xs">{getAccessiblePersonas().length}/10</span>
                  </div>
                  <div className="space-y-2">
                    {PERSONAS.map(persona => {
                      const canAccess = canAccessPersona(persona);
                      const isActive = currentPersona.id === persona.id;
                      return (
                        <button key={persona.id} onClick={() => canAccess ? handlePersonaChange(persona) : null} disabled={!canAccess} className={`w-full text-left p-3 rounded-lg transition-colors ${isActive ? `${getPersonaColorClass(persona, 'bg')} text-white` : canAccess ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm">{persona.name}</span>
                            {!canAccess && <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-gray-700 text-gray-400">{persona.requiredTier}</span>}
                          </div>
                          <div className="text-xs opacity-80">{persona.protectiveJob}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Settings</h3>
                  <div className="mb-3">
                    <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Language</label>
                    <div className="flex gap-2">
                      <button onClick={() => { setLanguage('en'); localStorage.setItem('lylo_language', 'en'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>ENG</button>
                      <button onClick={() => { setLanguage('es'); localStorage.setItem('lylo_language', 'es'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'es' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400'}`}>ESP</button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Voice</label>
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => { setVoiceGender('male'); localStorage.setItem('lylo_voice_gender', 'male'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${voiceGender === 'male' ? 'bg-slate-700 text-white' : 'bg-white/5 text-gray-400'}`}>Male</button>
                      <button onClick={() => { setVoiceGender('female'); localStorage.setItem('lylo_voice_gender', 'female'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${voiceGender === 'female' ? 'bg-pink-900/60 text-pink-200' : 'bg-white/5 text-gray-400'}`}>Female</button>
                    </div>
                    <button onClick={() => { const newInstant = !instantVoice; setInstantVoice(newInstant); localStorage.setItem('lylo_instant_voice', newInstant.toString()); }} className={`w-full py-2 rounded text-xs font-bold uppercase ${instantVoice ? 'bg-orange-700 text-orange-200' : 'bg-green-700 text-green-200'}`}>
                      {instantVoice ? 'Instant Voice' : 'Realistic Voice'}
                    </button>
                  </div>
                  <div className="mb-3">
                    <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Bible Version (Disciple)</label>
                    <div className="flex gap-2">
                      <button onClick={() => { setBibleVersion('kjv'); localStorage.setItem('lylo_bible_version', 'kjv'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${bibleVersion === 'kjv' ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-400'}`}>KJV</button>
                      <button onClick={() => { setBibleVersion('esv'); localStorage.setItem('lylo_bible_version', 'esv'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${bibleVersion === 'esv' ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-400'}`}>ESV</button>
                    </div>
                  </div>
                </div>
                <button onClick={onLogout} className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">Exit Protection</button>
              </div>
            )}
          </div>
          
          {/* LYLO LOGO WITH PERSONA-SPECIFIC GLOW */}
          <div className="text-center flex-1 px-2">
            <div className={`inline-flex items-center gap-3 px-4 py-1 rounded-full border-2 transition-all duration-700 ${getPrivacyShieldClass()}`}>
              <h1 className="text-white font-black text-lg uppercase tracking-[0.2em]" style={{ fontSize: `${zoomLevel / 100}rem` }}>L<span className={getPersonaColorClass(currentPersona, 'text')}>Y</span>LO</h1>
            </div>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-black mt-1">Digital Bodyguard</p>
          </div>
          
          <div className="flex items-center gap-2 relative">
            <div className="text-right cursor-pointer hover:bg-white/10 rounded p-2 transition-colors" onClick={(e) => { e.stopPropagation(); quickStopAllAudio(); setShowUserDetails(!showUserDetails); }}>
              <div className="text-white font-bold text-xs" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>
                {getUserDisplayName()}
                {isEliteUser && <span className="text-yellow-400 ml-1">★</span>}
              </div>
              {/* Intelligence Sync Display - Clickable */}
              <div className="flex items-center gap-1 justify-end cursor-pointer" onClick={(e) => { e.stopPropagation(); handleIntelligenceSyncClick(); }}>
                <span className={`text-xs uppercase font-black ${getPersonaColorClass(currentPersona, 'text')}`}>Intelligence Sync: {intelligenceSync}%</span>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <div className={`w-1.5 h-1.5 rounded-full ${isInStandbyMode ? 'bg-gray-500' : getPersonaColorClass(currentPersona, 'bg')}`}></div>
                <span className="text-gray-400 text-[10px] uppercase font-black">{isInStandbyMode ? 'Standby' : 'Protected'}</span>
              </div>
            </div>
            
            {showUserDetails && userStats && (
              <div className="absolute top-16 right-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[280px] z-[100003] shadow-2xl">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Protection Status</h3>
                <div className="space-y-3 text-xs text-gray-300">
                  <div className="flex justify-between"><span>Tier:</span><span className="font-bold text-blue-400">{getTierName(userStats.tier)}</span></div>
                  <div className="flex justify-between"><span>Intelligence Sync:</span><span className={`font-bold ${getPersonaColorClass(currentPersona, 'text')}`}>{intelligenceSync}%</span></div>
                  <div className="flex justify-between"><span>Expert Access:</span><span className="font-bold text-purple-400">{getAccessiblePersonas().length}/10</span></div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs mb-1"><span>Daily Usage:</span><span>{userStats.usage.current}/{userStats.usage.limit}</span></div>
                    <div className="bg-gray-800 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${getPersonaColorClass(currentPersona, 'bg')}`} style={{ width: `${Math.min(100, userStats.usage.percentage)}%` }} /></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-4 relative z-[100000]" style={{ paddingBottom: '240px', minHeight: 0, fontSize: `${zoomLevel / 100}rem` }}>
        {messages.length === 0 ? <CommandCenter /> : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border transition-all ${
                    msg.sender === 'user' 
                      ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white shadow-lg shadow-blue-500/10' 
                      : `bg-black/60 text-gray-100 ${getPersonaColorClass(currentPersona, 'border')}/30 border`
                  }`}>
                    <div className="leading-relaxed font-medium">{msg.content}</div>
                    <div className={`text-[10px] mt-2 opacity-70 font-black uppercase tracking-wider ${msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                {msg.sender === 'bot' && msg.confidenceScore && (
                  <div className="max-w-[85%]">
                    <div className={`bg-black/40 backdrop-blur-xl border rounded-xl p-3 shadow-lg transition-all duration-1000 ${msg.scamDetected && msg.confidenceScore === 100 ? 'border-red-500' : 'border-white/10'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-black uppercase text-[10px] tracking-[0.1em]">Threat Assessment</span>
                        <span className={`font-black text-sm ${msg.scamDetected && msg.confidenceScore === 100 ? 'text-red-500' : getPersonaColorClass(currentPersona, 'text')}`}>{msg.confidenceScore}%</span>
                      </div>
                      <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${msg.scamDetected && msg.confidenceScore === 100 ? 'bg-red-500' : getPersonaColorClass(currentPersona, 'bg')}`} style={{ width: `${msg.confidenceScore}%` }} />
                      </div>
                      {msg.scamDetected && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-[10px] font-black uppercase">
                          🛡️ THREAT DETECTED
                          {msg.scamIndicators && msg.scamIndicators.length > 0 && <div className="mt-1 text-[9px] opacity-80 font-normal normal-case">{msg.scamIndicators.join(', ')}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full animate-bounce ${getPersonaColorClass(currentPersona, 'bg')}`} style={{ animationDelay: `${i * 150}ms` }} />)}</div>
                    <span className="text-gray-300 font-black uppercase tracking-widest text-[10px] italic">{currentPersona.name} investigating...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* BOTTOM INPUT AREA */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-[100002]">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3">
          {/* FIXED WALKIE-TALKIE Status */}
          {isRecording && (
            <div className={`mb-2 p-2 border rounded text-center animate-pulse tracking-widest ${getPersonaColorClass(currentPersona, 'bg')}/20 ${getPersonaColorClass(currentPersona, 'border')}/30 ${getPersonaColorClass(currentPersona, 'text')} text-[10px] font-black uppercase`}>
              🎙️ RECORDING - TAP AGAIN TO SEND
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            {/* FIXED WALKIE-TALKIE MIC BUTTON */}
            <button onClick={handleWalkieTalkieMic} disabled={loading || !micSupported} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all border ${
              isRecording 
                ? `${getPersonaColorClass(currentPersona, 'bg')} text-white ${getPersonaColorClass(currentPersona, 'border')} shadow-lg animate-pulse` 
                : isInStandbyMode 
                  ? 'bg-gray-700 text-gray-300 border-gray-500' 
                  : micSupported 
                    ? 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'
              } disabled:opacity-50`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>{
                isInStandbyMode ? 'Wake' : isRecording ? 'STOP & SEND' : 'Record'
              }</button>
            <button onClick={cycleFontSize} className="text-sm px-8 py-3 rounded-lg bg-zinc-800 text-blue-400 font-black border-2 border-blue-500/40 hover:bg-blue-900/20 active:scale-95 transition-all uppercase tracking-widest shadow-lg">Size: {zoomLevel}%</button>
            {/* AI VOICE TOGGLE */}
            <button onClick={toggleTTS} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all relative border ${
              autoTTS 
                ? `${getPersonaColorClass(currentPersona, 'bg')} text-white ${getPersonaColorClass(currentPersona, 'border')} shadow-lg` 
                : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'
              }`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>AI Voice {autoTTS ? 'ON' : 'OFF'}{isSpeaking && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}</button>
          </div>
          <div className="flex items-end gap-3">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <button onClick={() => {quickStopAllAudio(); fileInputRef.current?.click();}} className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-all ${selectedImage ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`} title="Vision Link">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <div className="flex-1">
              <textarea ref={inputRef} value={input} onChange={(e) => !isRecording && setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={isInStandbyMode ? "Wake LYLO to continue..." : isRecording ? "Recording voice..." : selectedImage ? `Vision ready: ${selectedImage.name}...` : `Ask ${currentPersona.name} anything...`} disabled={loading || isRecording || isInStandbyMode} className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium pt-2 ${isInStandbyMode ? 'text-gray-500 cursor-not-allowed' : isRecording ? getPersonaColorClass(currentPersona, 'text') + ' italic cursor-not-allowed' : ''}`} style={{ fontSize: `${zoomLevel / 100}rem` }} rows={1} />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedImage) || isRecording || isInStandbyMode} className={`px-6 py-3 rounded-lg font-black text-sm uppercase tracking-[0.1em] transition-all ${(input.trim() || selectedImage) && !loading && !isRecording && !isInStandbyMode ? `bg-gradient-to-r ${getPersonaColorClass(currentPersona, 'bg')} to-blue-800 text-white hover:shadow-lg` : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`} style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}>{loading ? 'Processing' : 'Send'}</button>
          </div>
          <div className="text-center mt-3 pb-1">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] italic">LYLO DIGITAL BODYGUARD: YOUR PERSONAL SECURITY & SEARCH ENGINE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
