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
  color: string;
  requiredTier: 'free' | 'pro' | 'elite' | 'max';
  keywords: string[];
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

// THE 10-EXPERT PERSONNEL ROSTER WITH EXPANDED KEYWORDS
const PERSONAS: PersonaConfig[] = [
  // FREE TIER (1)
  { 
    id: 'guardian', 
    name: 'The Guardian', 
    description: 'Security Lead', 
    protectiveJob: 'Security Lead',
    spokenHook: 'Guardian here, {userName}. Scanning your perimeter for threats.',
    color: 'blue', 
    requiredTier: 'free',
    keywords: ['scam', 'fraud', 'hack', 'security', 'suspicious', 'password', 'link', 'email', 'bank', 'money', 'safe', 'protect', 'threat']
  },
  
  // PRO TIER (4 total)
  { 
    id: 'roast', 
    name: 'The Roast Master', 
    description: 'Humor Shield', 
    protectiveJob: 'Humor Shield',
    spokenHook: 'Watch out {userName}, I\'m feeling snarky. Ready to roast?',
    color: 'orange', 
    requiredTier: 'pro',
    keywords: ['roast', 'snarky', 'sarcastic', 'insult', 'burn', 'savage', 'mock']
  },
  { 
    id: 'disciple', 
    name: 'The Disciple', 
    description: 'Spiritual Armor', 
    protectiveJob: 'Spiritual Armor',
    spokenHook: 'I am the Disciple, {userName}. I have a word of wisdom for you.',
    color: 'gold', 
    requiredTier: 'pro',
    keywords: ['bible', 'jesus', 'god', 'prayer', 'scripture', 'faith', 'church', 'kjv', 'esv', 'verse', 'christian', 'lord']
  },
  { 
    id: 'mechanic', 
    name: 'The Mechanic', 
    description: 'Garage Protector', 
    protectiveJob: 'Garage Protector',
    spokenHook: 'Mechanic here, {userName}. Is your car acting up today?',
    color: 'gray', 
    requiredTier: 'pro',
    keywords: ['car', 'engine', 'oil', 'repair', 'tire', 'brake', 'battery', 'noise', 'ford', 'toyota', 'vehicle', 'automotive', 'transmission', 'mechanic']
  },
  
  // ELITE TIER (6 total)
  { 
    id: 'lawyer', 
    name: 'The Lawyer', 
    description: 'Legal Shield', 
    protectiveJob: 'Legal Shield',
    spokenHook: 'Lawyer here. Let\'s protect your rights today, {userName}.',
    color: 'yellow', 
    requiredTier: 'elite',
    keywords: ['legal', 'law', 'contract', 'sue', 'divorce', 'will', 'rights', 'court', 'attorney', 'agreement', 'lawsuit', 'judge']
  },
  { 
    id: 'techie', 
    name: 'The Techie', 
    description: 'Tech Bridge', 
    protectiveJob: 'Tech Bridge',
    spokenHook: 'I\'m the Techie! Let\'s get those gadgets working for you, {userName}.',
    color: 'purple', 
    requiredTier: 'elite',
    keywords: ['wifi', 'computer', 'phone', 'app', 'printer', 'screen', 'laptop', 'mac', 'windows', 'update', 'bluetooth', 'internet', 'software', 'tech']
  },
  
  // MAX TIER (10 total)
  { 
    id: 'storyteller', 
    name: 'The Storyteller', 
    description: 'Mental Guardian', 
    protectiveJob: 'Mental Guardian',
    spokenHook: '{userName}, I am the Storyteller. Shall we create a custom story?',
    color: 'indigo', 
    requiredTier: 'max',
    keywords: ['story', 'tale', 'history', 'write', 'poem', 'book', 'narrative', 'creative', 'fiction']
  },
  { 
    id: 'comedian', 
    name: 'The Comedian', 
    description: 'Mood Protector', 
    protectiveJob: 'Mood Protector',
    spokenHook: 'Ready for a laugh, {userName}? Let\'s fix your tech with a smile.',
    color: 'pink', 
    requiredTier: 'max',
    keywords: ['comedy', 'joke', 'standup', 'hilarious', 'funny', 'laugh']
  },
  { 
    id: 'chef', 
    name: 'The Chef', 
    description: 'Kitchen Safety', 
    protectiveJob: 'Kitchen Safety',
    spokenHook: 'Chef in the house! What are we cooking today, {userName}?',
    color: 'red', 
    requiredTier: 'max',
    keywords: ['cook', 'recipe', 'food', 'kitchen', 'eat', 'dinner', 'ingredient', 'bake', 'oven', 'stove', 'meal', 'cooking']
  },
  { 
    id: 'fitness', 
    name: 'The Fitness Coach', 
    description: 'Mobility Protector', 
    protectiveJob: 'Mobility Protector',
    spokenHook: 'Coach here! Let\'s get you moving safely today, {userName}.',
    color: 'green', 
    requiredTier: 'max',
    keywords: ['fitness', 'workout', 'pain', 'health', 'exercise', 'walk', 'gym', 'mobility', 'sore', 'strength', 'training']
  }
];

// Intent words that override mission guards
const INTENT_WORDS = ['help', 'broken', 'fix', 'seriously', 'need', 'problem', 'issue', 'trouble'];

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
  const [hasGivenVerbalHandshake, setHasGivenVerbalHandshake] = useState(false);
  const [intelligenceSync, setIntelligenceSync] = useState(0);
  
  // --- VOICE & MIC (Privacy Shield) - FIXED TAP-TO-TALK ---
  const [isListening, setIsListening] = useState(false); // DEFAULT: OFF
  const [micActive, setMicActive] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true); // INDEPENDENT AI VOICE TOGGLE
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [instantVoice, setInstantVoice] = useState(false);
  
  // --- TIMEOUT LOOP FIX: USE REFS ---
  const lastInteractionTimeRef = useRef(Date.now());
  const isInStandbyModeRef = useRef(false);
  const isListeningRef = useRef(false); 
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
  
  // --- ONBOARDING QUIZ ---
  const [showQuizOverlay, setShowQuizOverlay] = useState(false);
  const [quizStep, setQuizStep] = useState(1);
  const [quizAnswers, setQuizAnswers] = useState({
    deviceType: '',
    primaryWorry: '',
    drivingStatus: ''
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
    
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const getTierDisplayName = (tier: string): string => {
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
    
    return 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!localStorage.getItem('lylo_quiz_complete')) {
        setShowQuizOverlay(true);
    } else {
        initializeLylo();
    }
    return () => {
      if (standbyTimerRef.current) clearInterval(standbyTimerRef.current);
    };
  }, [userEmail]);

  // Keep refs in sync with state for timer
  useEffect(() => {
      isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
      isInStandbyModeRef.current = isInStandbyMode;
  }, [isInStandbyMode]);

  const initializeLylo = async () => {
    await loadUserStats();
    await checkEliteStatus();
    loadSavedPreferences();
    detectUserName();
    startPrivacyShieldMonitoring();
    
    // PROACTIVE INITIATION: AI speaks first even though mic starts OFF
    if (!hasGivenVerbalHandshake) {
      setTimeout(() => giveVerbalHandshake(), 1000);
    }
  };

  const loadSavedPreferences = () => {
    const savedVoice = localStorage.getItem('lylo_voice_gender');
    if (savedVoice === 'female') setVoiceGender('female');
    
    const savedBibleVersion = localStorage.getItem('lylo_bible_version');
    if (savedBibleVersion === 'esv') setBibleVersion('esv');
    
    const savedInstantVoice = localStorage.getItem('lylo_instant_voice');
    if (savedInstantVoice === 'true') setInstantVoice(true);
    
    const savedHandshake = localStorage.getItem('lylo_verbal_handshake');
    if (savedHandshake === 'true') setHasGivenVerbalHandshake(true);
    
    const savedSync = localStorage.getItem('lylo_intelligence_sync');
    if (savedSync) setIntelligenceSync(parseInt(savedSync) || 0);
    
    const savedUserName = localStorage.getItem('lylo_user_name');
    if (savedUserName) setUserName(savedUserName);
    
    const savedAutoTTS = localStorage.getItem('lylo_auto_tts');
    if (savedAutoTTS === 'false') setAutoTTS(false);
  };

  // --- ONBOARDING QUIZ HANDLERS ---
  const handleQuizAnswer = (answer: string) => {
    if (quizStep === 1) {
      setQuizAnswers({...quizAnswers, deviceType: answer});
      setQuizStep(2);
    } else if (quizStep === 2) {
      setQuizAnswers({...quizAnswers, primaryWorry: answer});
      setQuizStep(3);
    } else if (quizStep === 3) {
      const finalAnswers = {...quizAnswers, drivingStatus: answer};
      setQuizAnswers(finalAnswers);
      completeQuiz(finalAnswers);
    }
  };

  const completeQuiz = async (finalAnswers: any) => {
    localStorage.setItem('lylo_quiz_complete', 'true');
    localStorage.setItem('lylo_quiz_answers', JSON.stringify(finalAnswers));
    localStorage.setItem('lylo_intelligence_sync', '15'); 
    setIntelligenceSync(15);
    setShowQuizOverlay(false);
    
    setTimeout(async () => {
      await initializeLylo();
      await speakText("Thank you. I have calibrated your security profile. I am now active and ready to protect you.");
    }, 500);
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
    } else {
      setTimeout(() => {
        askForUserName();
      }, 2000);
    }
  };

  const askForUserName = async () => {
    const askNameMessage = "I don't have your name in my records yet. What should I call you?";
    await speakText(askNameMessage);
    
    const botMsg: Message = { 
      id: Date.now().toString(), 
      content: askNameMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
  };

  // --- VERBAL HANDSHAKE (PROACTIVE INITIATION) ---
  const giveVerbalHandshake = async () => {
    if (hasGivenVerbalHandshake) return;
    
    const handshakeMessage = getVerbalHandshakeMessage();
    await speakText(handshakeMessage); // AI speaks first regardless of mic state
    
    const botMsg: Message = { 
      id: Date.now().toString(), 
      content: handshakeMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    setHasGivenVerbalHandshake(true);
    localStorage.setItem('lylo_verbal_handshake', 'true');
  };

  const getVerbalHandshakeMessage = (): string => {
    const displayName = userName || 'there';
    const accessibleCount = getAccessiblePersonas().length;
    
    switch (userTier) {
      case 'max':
        return `Hello ${displayName}, I am LYLO. As a Max member, you have my full team of 10 experts standing by. I am your Digital Bodyguard, but I am also your personal search engine. You can ask me absolutely anything—from deep research to car repairs—and I will find the answer specifically for you. Click the microphone when you're ready to speak. What can I find for you today?`;
      
      case 'elite':
        return `Hello ${displayName}, I am LYLO. As an Elite member, you have access to ${accessibleCount} of my expert team members. I am your Digital Bodyguard and personalized search engine. You can ask me anything and I will find answers specifically for you. Click the microphone to speak. How can I help you today?`;
      
      case 'pro':
        return `Hello ${displayName}, I am LYLO. As a Pro member, you have ${accessibleCount} expert team members at your service. I am your Digital Bodyguard and custom search engine. Ask me anything and I'll find the answer for you. Click the microphone to get started. What do you need?`;
      
      default: // free
        return `Hello ${displayName}, I am LYLO, your Digital Bodyguard. I'm also your personal search engine—ask me anything and I'll find the answer specifically for you. Click the microphone when you're ready to speak. What can I help you find today?`;
    }
  };

  // --- INTELLIGENT AUTO-SWITCH LOGIC WITH CONTEXT GUARDS ---
  const handlePersonaChange = async (persona: PersonaConfig) => {
    if (!canAccessPersona(persona)) {
      const expansionMessage = `I can help with the security side of that, ${userName || 'friend'}, but for ${persona.description.toLowerCase()}, we need to bring in ${persona.name}. Would you like me to expand your team and deploy them to your side now?`;
      
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
    
    onPersonaChange(persona);
    setShowDropdown(false);
    
    const spokenHook = persona.spokenHook.replace('{userName}', userName || 'friend');
    await speakText(spokenHook);
    
    const botMsg: Message = { 
      id: Date.now().toString(), 
      content: spokenHook, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
    
    incrementIntelligenceSync();
  };

  const shouldAutoSwitch = (userMessage: string, currentPersonaId: string): boolean => {
    const lowerMsg = userMessage.toLowerCase();
    
    // SOURCE GUARD: Only auto-switch based on USER messages (this function is only called for user messages)
    
    // MISSION OVERRIDE: If current persona is entertainment-focused, require intent words
    const entertainmentPersonas = ['comedian', 'storyteller', 'roast'];
    if (entertainmentPersonas.includes(currentPersonaId)) {
      const hasIntentWord = INTENT_WORDS.some(word => lowerMsg.includes(word));
      if (!hasIntentWord) {
        return false; // Stay in entertainment mode unless user shows clear intent to switch
      }
    }
    
    return true; // Allow switching for all other cases
  };

  const findBestPersonaMatch = (userMessage: string, currentPersonaId: string): PersonaConfig | null => {
    if (!shouldAutoSwitch(userMessage, currentPersonaId)) {
      return null;
    }
    
    const lowerMsg = userMessage.toLowerCase();
    let bestMatch: PersonaConfig | null = null;
    let maxMatches = 0;
    
    // Find persona with most keyword matches
    for (const persona of PERSONAS) {
      // Don't switch if already using this persona
      if (persona.id === currentPersonaId) continue;
      
      const matches = persona.keywords.filter(keyword => lowerMsg.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = persona;
      }
    }
    
    // Only switch if we found at least one matching keyword
    return maxMatches > 0 ? bestMatch : null;
  };

  const incrementIntelligenceSync = () => {
    const newSync = Math.min(intelligenceSync + 5, 100);
    setIntelligenceSync(newSync);
    localStorage.setItem('lylo_intelligence_sync', newSync.toString());
  };

  // --- PRIVACY SHIELD (Auto-Standby) - FIXED TIMEOUT LOOP ---
  const startPrivacyShieldMonitoring = () => {
    if (standbyTimerRef.current) {
      clearInterval(standbyTimerRef.current);
    }
    
    standbyTimerRef.current = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteractionTimeRef.current;
      
      // Check refs to ensure we have the latest state
      // ONLY trigger standby if mic is currently ON
      if (timeSinceLastInteraction > 120000 && 
          !isInStandbyModeRef.current && 
          isListeningRef.current) {
        goToStandbyMode();
      }
    }, 10000); // Check every 10 seconds
  };

  const goToStandbyMode = async () => {
    if (isInStandbyModeRef.current) return;
    
    isInStandbyModeRef.current = true;
    setIsInStandbyMode(true);
    setIsListening(false);
    
    const displayName = userName || getUserDisplayName() || 'Friend';
    const standbyMessage = `${displayName}, I am going on standby to protect your privacy. Click the mic when you need me.`;
    
    // Only speak the standby message if the mic was actually ON
    if (isListeningRef.current) {
      await speakText(standbyMessage);
    }
    
    const botMsg: Message = { 
      id: Date.now().toString(), 
      content: standbyMessage, 
      sender: 'bot', 
      timestamp: new Date(),
      confidenceScore: 100
    };
    setMessages(prev => [...prev, botMsg]);
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

  // --- AUDIO FUNCTIONS (INDEPENDENT AI VOICE TOGGLE) ---
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speakText = async (text: string, forceGender?: string) => {
    if (!autoTTS && !forceGender) return; // Respect the AI Voice toggle
    if (!text) return;
    
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
    
    // Fallback to browser speech synthesis
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // --- TAP-TO-TALK SPEECH RECOGNITION ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'es' ? 'es-MX' : 'en-US'; 
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setMicActive(true);
      };
      
      recognition.onresult = (event: any) => {
        updateInteractionTime();
        
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setInput((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setMicActive(false);
      };

      recognition.onend = () => {
        setMicActive(false);
        // TAP-TO-TALK: Don't restart automatically
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    } else {
      setMicSupported(false);
    }
  }, [language]);

  // Start recognition when listening is enabled (TAP-TO-TALK)
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    
    if (isListening && !micActive && !isInStandbyModeRef.current) {
      try { 
        recognition.start(); 
      } catch(e) { 
        setIsListening(false); 
      }
    }
  }, [isListening]);

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

  const toggleListening = () => {
    if (!micSupported) {
      alert('Microphone not supported');
      return;
    }
    
    updateInteractionTime();
    
    if (isListening || micActive) {
      // Turn OFF: Stop recognition and turn off listening
      const recognition = recognitionRef.current;
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
      setIsListening(false);
      setMicActive(false);
    } else {
      // Turn ON: Start listening (tap-to-talk)
      quickStopAllAudio();
      setIsListening(true);
      if (isInStandbyModeRef.current) {
        wakeFromStandby();
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
    }
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if ((!textToSend && !selectedImage) || loading) return;

    updateInteractionTime();

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

    // --- INTELLIGENT AUTO-SWITCH LOGIC WITH CONTEXT GUARDS ---
    let finalPersonaId = currentPersona.id;
    let switched = false;

    if (textToSend) {
        const bestMatch = findBestPersonaMatch(textToSend, currentPersona.id);
        
        if (bestMatch) {
            // TIER VALIDATION: Check if user can access this persona
            if (canAccessPersona(bestMatch)) {
                // SWITCH!
                onPersonaChange(bestMatch);
                finalPersonaId = bestMatch.id;
                switched = true;
                
                const switchMsg = `[Auto-Switch] Bringing in ${bestMatch.name}...`;
                setMessages(prev => [...prev, { 
                  id: Date.now().toString(), 
                  content: switchMsg, 
                  sender: 'bot', 
                  timestamp: new Date(),
                  confidenceScore: 100
                }]);
            } else {
                // TEAM EXPANSION UPSELL - Stop processing
                const expansionMessage = `I see you need help with ${bestMatch.description.toLowerCase()}, but for that, we need to bring in ${bestMatch.name}. Would you like me to expand your team and deploy them to your side now?`;
                setMessages(prev => [...prev, { 
                  id: Date.now().toString(), 
                  content: expansionMessage, 
                  sender: 'bot', 
                  timestamp: new Date(),
                  confidenceScore: 90
                }]);
                await speakText(expansionMessage);
                setInput(''); // Clear input
                
                // Turn off mic after sending (TAP-TO-TALK behavior)
                setIsListening(false);
                setMicActive(false);
                return; // EXIT
            }
        }
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

    // Turn off mic after sending (TAP-TO-TALK behavior)
    setIsListening(false);
    setMicActive(false);

    try {
      // Add search verbalization for general questions
      if (!switched && isGeneralSearchQuery(textToSend)) {
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

      const conversationHistory = messages.slice(-2).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      let personaWithBible = finalPersonaId;
      if (finalPersonaId === 'disciple') {
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
    if (!isEliteUser) {
      alert('Scam Recovery Center is exclusive to Elite and Max tier members.');
      return;
    }
    setShowScamRecovery(true);
  };

  // --- ACTION HUB HANDLERS ---
  const handleSearchEverything = async () => {
    updateInteractionTime();
    const searchMessage = `What can you help me find?`;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: searchMessage, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Trigger LYLO's proactive response
    const proactiveMessage = `I can help you find anything, ${userName || 'Christopher'}! I'm your personalized search engine. Ask me about current events, research topics, local businesses, how-to guides, or anything else. What would you like me to search for?`;
    
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
    const shieldMessage = `Is this message a scam?`;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: shieldMessage, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    
    // LYLO's scam protection response
    const protectionMessage = `I'm activating scam detection mode, ${userName || 'Christopher'}. Share any suspicious message, email, text, or phone call with me and I'll analyze it for fraud indicators. I can detect phishing attempts, romance scams, tech support scams, and more. What message do you want me to check?`;
    
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
    const visionMessage = `I want to show you something`;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: visionMessage, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    
    // LYLO's vision response
    const visionResponse = `I'm ready to analyze any image, ${userName || 'Christopher'}! I can examine photos for scams, read text in images, analyze documents, check if something looks suspicious, or answer questions about what I see. Take a photo or select one from your gallery.`;
    
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

  const cycleFontSize = () => {
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

  // --- ACTION HUB COMPONENT ---
  const ActionHub = () => (
    <div className="flex flex-col items-center justify-center h-full text-center py-10">
      <div className={`w-20 h-20 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 ${getPrivacyShieldClass()}`}>
        <span className="text-white font-black text-2xl">L</span>
      </div>
      
      <h1 className="text-2xl font-black text-white uppercase tracking-[0.1em] mb-2">
        {currentPersona.name}
      </h1>
      <p className="text-blue-400 text-sm font-bold uppercase tracking-[0.1em] mb-1">
        {currentPersona.protectiveJob}
      </p>
      <p className="text-gray-400 text-xs uppercase tracking-[0.2em] font-medium mb-8">
        {isInStandbyMode ? 'Privacy Mode - Click Mic to Activate' : 'Digital Bodyguard Active'}
      </p>
      
      {/* Intelligence Sync Progress */}
      <div className="mb-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-bold text-xs uppercase tracking-wider">Bodyguard Intelligence Sync</span>
          <span className="text-blue-400 font-black text-sm">{intelligenceSync}%</span>
        </div>
        <div className="bg-gray-800 rounded-full h-3 overflow-hidden border border-blue-500/20">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 rounded-full" 
            style={{ width: `${intelligenceSync}%` }}
          />
        </div>
      </div>

      {/* Action Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full px-4">
        <button
          onClick={handleSearchEverything}
          className="bg-gray-900/60 backdrop-blur-xl border border-blue-500/30 rounded-xl p-6 text-left hover:bg-gray-800/80 transition-all duration-300 group"
        >
          <h3 className="text-blue-400 font-black text-lg mb-2 uppercase tracking-wider group-hover:text-blue-300">
            Search Everything
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Ask me anything. I am your personalized search engine.
          </p>
        </button>

        <button
          onClick={handleShieldMe}
          className="bg-gray-900/60 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 text-left hover:bg-gray-800/80 transition-all duration-300 group"
        >
          <h3 className="text-red-400 font-black text-lg mb-2 uppercase tracking-wider group-hover:text-red-300">
            Shield Me
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Say: Is this message a scam?
          </p>
        </button>

        <button
          onClick={handleVisionLink}
          className="bg-gray-900/60 backdrop-blur-xl border border-green-500/30 rounded-xl p-6 text-left hover:bg-gray-800/80 transition-all duration-300 group"
        >
          <h3 className="text-green-400 font-black text-lg mb-2 uppercase tracking-wider group-hover:text-green-300">
            Vision Link
          </h3>
          <p className="text-gray-300 text-sm font-medium">
            Say: I want to show you something.
          </p>
        </button>

        {/* ELITE/MAX EXCLUSIVE: Scam Recovery Center */}
        {isEliteUser ? (
          <button
            onClick={openScamRecovery}
            className="bg-gray-900/60 backdrop-blur-xl border border-red-500/50 rounded-xl p-6 text-left hover:bg-gray-800/80 transition-all duration-300 group animate-pulse"
          >
            <h3 className="text-red-400 font-black text-lg mb-2 uppercase tracking-wider group-hover:text-red-300">
              🛡️ Been Scammed?
            </h3>
            <p className="text-gray-300 text-sm font-medium">
              Elite Recovery Center - Get Help Now
            </p>
          </button>
        ) : (
          <button
            onClick={() => setShowDropdown(true)}
            className="bg-gray-900/60 backdrop-blur-xl border border-purple-500/30 rounded-xl p-6 text-left hover:bg-gray-800/80 transition-all duration-300 group"
          >
            <h3 className="text-purple-400 font-black text-lg mb-2 uppercase tracking-wider group-hover:text-purple-300">
              Expert Access
            </h3>
            <p className="text-gray-300 text-sm font-medium">
              Access: {getAccessiblePersonas().length}/10 specialists
            </p>
          </button>
        )}
      </div>

      {/* Privacy Shield Status */}
      <div className="mt-8 flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full transition-colors ${isInStandbyMode ? 'bg-gray-500' : 'bg-blue-500'}`} />
        <span className="text-gray-400 text-xs font-black uppercase tracking-widest">
          {isInStandbyMode ? 'Privacy Mode' : 'Protected Mode'}
        </span>
      </div>
    </div>
  );

  // --- ONBOARDING QUIZ OVERLAY COMPONENT ---
  const QuizOverlay = () => (
    <div className="fixed inset-0 z-[100100] bg-black/95 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-4xl mb-4">🛡️</div>
        <h2 className="text-white font-black text-xl uppercase tracking-wider mb-4">Welcome to LYLO</h2>
        <p className="text-gray-300 text-sm mb-6">Quick setup - 3 questions to personalize your protection</p>
        
        {quizStep === 1 && (
          <div>
            <h3 className="text-white font-bold mb-4">What device do you use most?</h3>
            <div className="space-y-2">
              {['Smartphone', 'Computer', 'Tablet', 'All devices'].map(option => (
                <button key={option} onClick={() => handleQuizAnswer(option)} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {quizStep === 2 && (
          <div>
            <h3 className="text-white font-bold mb-4">What's your biggest worry online?</h3>
            <div className="space-y-2">
              {['Scams & Fraud', 'Identity Theft', 'Malware', 'Privacy'].map(option => (
                <button key={option} onClick={() => handleQuizAnswer(option)} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {quizStep === 3 && (
          <div>
            <h3 className="text-white font-bold mb-4">Do you drive regularly?</h3>
            <div className="space-y-2">
              {['Yes, daily', 'Sometimes', 'No', 'I don\'t drive'].map(option => (
                <button key={option} onClick={() => handleQuizAnswer(option)} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-center mt-6 space-x-2">
          {[1, 2, 3].map(step => (
            <div key={step} className={`w-2 h-2 rounded-full ${step <= quizStep ? 'bg-blue-500' : 'bg-gray-600'}`} />
          ))}
        </div>
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
      
      {showQuizOverlay && <QuizOverlay />}
      
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

      {/* FIXED: Protection Limit Modal appears exactly ONCE */}
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

      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-3 flex-shrink-0 relative z-[100002]">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
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
                      return (
                        <button key={persona.id} onClick={() => canAccess ? handlePersonaChange(persona) : null} disabled={!canAccess} className={`w-full text-left p-3 rounded-lg transition-colors ${currentPersona.id === persona.id ? 'bg-blue-700 text-white' : canAccess ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'}`}>
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
                      <button onClick={() => setLanguage('en')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>ENG</button>
                      <button onClick={() => setLanguage('es')} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${language === 'es' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400'}`}>ESP</button>
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
                      <button onClick={() => { setBibleVersion('kjv'); localStorage.setItem('lylo_bible_version', 'kjv'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${bibleVersion === 'kjv' ? 'bg-gold-600 text-white' : 'bg-white/5 text-gray-400'}`}>KJV</button>
                      <button onClick={() => { setBibleVersion('esv'); localStorage.setItem('lylo_bible_version', 'esv'); }} className={`flex-1 py-2 rounded text-xs font-bold uppercase ${bibleVersion === 'esv' ? 'bg-gold-600 text-white' : 'bg-white/5 text-gray-400'}`}>ESV</button>
                    </div>
                  </div>
                </div>
                <button onClick={onLogout} className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">Exit Protection</button>
              </div>
            )}
          </div>
          
          <div className="text-center flex-1 px-2">
            <div className={`inline-flex items-center gap-3 px-4 py-1 rounded-full border-2 transition-all duration-700 ${getPrivacyShieldClass()}`}>
              <h1 className="text-white font-black text-lg uppercase tracking-[0.2em]" style={{ fontSize: `${zoomLevel / 100}rem` }}>L<span className="text-[#3b82f6]">Y</span>LO</h1>
            </div>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-black mt-1">Digital Bodyguard</p>
          </div>
          
          <div className="flex items-center gap-2 relative">
            <div className="text-right cursor-pointer hover:bg-white/10 rounded p-2 transition-colors" onClick={(e) => { e.stopPropagation(); setShowUserDetails(!showUserDetails); }}>
              <div className="text-white font-bold text-xs" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>
                {getUserDisplayName()}
                {isEliteUser && <span className="text-yellow-400 ml-1">★</span>}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <div className={`w-1.5 h-1.5 rounded-full ${isInStandbyMode ? 'bg-gray-500' : 'bg-blue-500'}`}></div>
                <span className="text-gray-400 text-[10px] uppercase font-black">{isInStandbyMode ? 'Standby' : 'Protected'}</span>
              </div>
            </div>
            
            {showUserDetails && userStats && (
              <div className="absolute top-16 right-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[280px] z-[100003] shadow-2xl">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Protection Status</h3>
                <div className="space-y-3 text-xs text-gray-300">
                  <div className="flex justify-between"><span>Tier:</span><span className="font-bold text-blue-400">{getTierDisplayName(userStats.tier)}</span></div>
                  <div className="flex justify-between"><span>Intelligence Sync:</span><span className="font-bold text-green-400">{intelligenceSync}%</span></div>
                  <div className="flex justify-between"><span>Expert Access:</span><span className="font-bold text-purple-400">{getAccessiblePersonas().length}/10</span></div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs mb-1"><span>Daily Usage:</span><span>{userStats.usage.current}/{userStats.usage.limit}</span></div>
                    <div className="bg-gray-800 rounded-full h-2"><div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, userStats.usage.percentage)}%` }} /></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-4 relative z-[100000]" style={{ paddingBottom: '240px', minHeight: 0, fontSize: `${zoomLevel / 100}rem` }}>
        {messages.length === 0 ? <ActionHub /> : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border transition-all ${msg.sender === 'user' ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white shadow-lg shadow-blue-500/10' : 'bg-black/60 border-white/10 text-gray-100'}`}>
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
                        <span className={`font-black text-sm ${msg.scamDetected && msg.confidenceScore === 100 ? 'text-red-500' : 'text-[#3b82f6]'}`}>{msg.confidenceScore}%</span>
                      </div>
                      <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${msg.scamDetected && msg.confidenceScore === 100 ? 'bg-red-500' : 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8]'}`} style={{ width: `${msg.confidenceScore}%` }} />
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
                    <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
                    <span className="text-gray-300 font-black uppercase tracking-widest text-[10px] italic">{currentPersona.name} investigating...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-[100002]">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3">
          {/* TAP-TO-TALK Status */}
          {(isListening || micActive) && !isInStandbyMode && (
            <div className="mb-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-blue-400 text-[10px] font-black uppercase text-center animate-pulse tracking-widest">
              🛡️ TAP-TO-TALK ACTIVE - RECORDING
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            {/* TAP-TO-TALK Microphone Button */}
            <button onClick={toggleListening} disabled={loading || !micSupported} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all border ${(isListening || micActive) && !isInStandbyMode ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : isInStandbyMode ? 'bg-gray-700 text-gray-300 border-gray-500' : micSupported ? 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20' : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'} disabled:opacity-50`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>{isInStandbyMode ? 'Wake' : (isListening || micActive) ? 'Recording' : 'Mic'}</button>
            <button onClick={cycleFontSize} className="text-sm px-8 py-3 rounded-lg bg-zinc-800 text-blue-400 font-black border-2 border-blue-500/40 hover:bg-blue-900/20 active:scale-95 transition-all uppercase tracking-widest shadow-lg">Size: {zoomLevel}%</button>
            {/* INDEPENDENT AI VOICE TOGGLE */}
            <button onClick={toggleTTS} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all relative border ${autoTTS ? 'bg-[#3b82f6] text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'}`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>AI Voice {autoTTS ? 'ON' : 'OFF'}{isSpeaking && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}</button>
          </div>
          <div className="flex items-end gap-3">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <button onClick={() => fileInputRef.current?.click()} className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-all ${selectedImage ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`} title="Vision Link">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <div className="flex-1">
              <textarea ref={inputRef} value={input} onChange={(e) => !(isListening || micActive) && setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={isInStandbyMode ? "Wake LYLO to continue..." : (isListening || micActive) ? "Listening for voice commands..." : selectedImage ? `Vision ready: ${selectedImage.name}...` : `Ask ${currentPersona.name} anything...`} disabled={loading || (isListening || micActive) || isInStandbyMode} className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium pt-2 ${isInStandbyMode ? 'text-gray-500 cursor-not-allowed' : (isListening || micActive) ? 'text-blue-300 italic cursor-not-allowed' : ''}`} style={{ fontSize: `${zoomLevel / 100}rem` }} rows={1} />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedImage) || (isListening || micActive) || isInStandbyMode} className={`px-6 py-3 rounded-lg font-black text-sm uppercase tracking-[0.1em] transition-all ${(input.trim() || selectedImage) && !loading && !(isListening || micActive) && !isInStandbyMode ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg hover:shadow-blue-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`} style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}>{loading ? 'Processing' : 'Send'}</button>
          </div>
          <div className="text-center mt-3 pb-1">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] italic">LYLO DIGITAL BODYGUARD: YOUR PERSONAL SECURITY & SEARCH ENGINE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
