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
  { 
    id: 'guardian', 
    name: 'The Guardian', 
    description: 'Security Lead', 
    protectiveJob: 'Security Lead',
    spokenHook: 'I am The Guardian, your Security Lead.',
    capabilities: ['Detect scams', 'Analyze suspicious messages', 'Protect identity', 'Check websites', 'Identify phishing', 'Verify bank alerts'],
    color: 'blue', 
    requiredTier: 'free'
  },
  { 
    id: 'roast', 
    name: 'The Roast Master', 
    description: 'Humor Shield', 
    protectiveJob: 'Humor Shield',
    spokenHook: 'I am The Roast Master, your Humor Shield.',
    capabilities: ['Deliver witty comebacks', 'Use sarcasm', 'Make light of stress', 'Comic relief', 'Roast scammers', 'Boost morale'],
    color: 'orange', 
    requiredTier: 'pro'
  },
  { 
    id: 'disciple', 
    name: 'The Disciple', 
    description: 'Spiritual Armor', 
    protectiveJob: 'Spiritual Armor',
    spokenHook: 'I am The Disciple, your Spiritual Armor.',
    capabilities: ['Biblical wisdom', 'Quote scripture', 'Spiritual protection', 'Faith perspectives', 'Prayer help', 'Moral guidance'],
    color: 'gold', 
    requiredTier: 'pro'
  },
  { 
    id: 'mechanic', 
    name: 'The Mechanic', 
    description: 'Garage Protector', 
    protectiveJob: 'Garage Protector',
    spokenHook: 'I am The Mechanic, your Garage Protector.',
    capabilities: ['Diagnose engine codes', 'Explain repairs', 'Identify mechanic scams', 'Car buying help', 'Troubleshoot issues', 'Repair shop fraud protection'],
    color: 'gray', 
    requiredTier: 'pro'
  },
  { 
    id: 'lawyer', 
    name: 'The Lawyer', 
    description: 'Legal Shield', 
    protectiveJob: 'Legal Shield',
    spokenHook: 'I am The Lawyer, your Legal Shield.',
    capabilities: ['Explain legal rights', 'Review contracts', 'Identify legal fraud', 'Guide legal processes', 'Estate planning', 'Legal exploitation protection'],
    color: 'yellow', 
    requiredTier: 'elite'
  },
  { 
    id: 'techie', 
    name: 'The Techie', 
    description: 'Tech Bridge', 
    protectiveJob: 'Tech Bridge',
    spokenHook: 'I am The Techie, your Tech Bridge.',
    capabilities: ['Fix computer issues', 'Troubleshoot devices', 'Tech support scam protection', 'Explain tech simply', 'Help with apps', 'Secure digital devices'],
    color: 'purple', 
    requiredTier: 'elite'
  },
  { 
    id: 'storyteller', 
    name: 'The Storyteller', 
    description: 'Mental Guardian', 
    protectiveJob: 'Mental Guardian',
    spokenHook: 'I am The Storyteller, your Mental Guardian.',
    capabilities: ['Create stories', 'Process experiences', 'Emotional support', 'Therapeutic storytelling', 'Share wisdom', 'Mental wellbeing'],
    color: 'indigo', 
    requiredTier: 'max'
  },
  { 
    id: 'comedian', 
    name: 'The Comedian', 
    description: 'Mood Protector', 
    protectiveJob: 'Mood Protector',
    spokenHook: 'I am The Comedian, your Mood Protector.',
    capabilities: ['Tell jokes', 'Lighten the mood', 'Humor for stress', 'Entertainment', 'Approachable topics', 'Emotional health'],
    color: 'pink', 
    requiredTier: 'max'
  },
  { 
    id: 'chef', 
    name: 'The Chef', 
    description: 'Kitchen Safety', 
    protectiveJob: 'Kitchen Safety',
    spokenHook: 'I am The Chef, your Kitchen Safety specialist.',
    capabilities: ['Create recipes', 'Cooking tips', 'Food safety', 'Dietary help', 'Food scam protection', 'Enjoyable cooking'],
    color: 'red', 
    requiredTier: 'max'
  },
  { 
    id: 'fitness', 
    name: 'The Fitness Coach', 
    description: 'Mobility Protector', 
    protectiveJob: 'Mobility Protector',
    spokenHook: 'I am The Fitness Coach, your Mobility Protector.',
    capabilities: ['Exercise routines', 'Mobility help', 'Nutrition advice', 'Fitness scam protection', 'Adapt workouts', 'Healthy movement'],
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
  const [lastBotResponse, setLastBotResponse] = useState<string>(''); // For Replay Logic
  
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
  
  // *** FIXED: ADDED MISSING STATE VARIABLES HERE ***
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  
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
      blue: { border: 'border-blue-500', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]', bg: 'bg-blue-600', text: 'text-blue-400' },
      orange: { border: 'border-orange-500', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]', bg: 'bg-orange-600', text: 'text-orange-400' },
      gold: { border: 'border-yellow-500', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]', bg: 'bg-yellow-600', text: 'text-yellow-400' },
      gray: { border: 'border-gray-500', glow: 'shadow-[0_0_20px_rgba(107,114,128,0.4)]', bg: 'bg-gray-600', text: 'text-gray-400' },
      yellow: { border: 'border-yellow-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.4)]', bg: 'bg-yellow-500', text: 'text-yellow-300' },
      purple: { border: 'border-purple-500', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]', bg: 'bg-purple-600', text: 'text-purple-400' },
      indigo: { border: 'border-indigo-500', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.4)]', bg: 'bg-indigo-600', text: 'text-indigo-400' },
      pink: { border: 'border-pink-500', glow: 'shadow-[0_0_20px_rgba(236,72,153,0.4)]', bg: 'bg-pink-600', text: 'text-pink-400' },
      red: { border: 'border-red-500', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]', bg: 'bg-red-600', text: 'text-red-400' },
      green: { border: 'border-green-500', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.4)]', bg: 'bg-green-600', text: 'text-green-400' }
    };
    return colorMap[persona.color as keyof typeof colorMap]?.[type] || colorMap.blue[type];
  };

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

  const getPrivacyShieldClass = () => {
    const personaClasses = getPersonaColorClass(currentPersona, 'border') + ' ' + getPersonaColorClass(currentPersona, 'glow');
    
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
      window.speechSynthesis.cancel();
    };
  }, [userEmail]);

  const initializeLylo = async () => {
    await loadUserStats();
    await checkEliteStatus();
    loadSavedPreferences();
    detectUserName();
    
    const savedPersona = localStorage.getItem('lylo_preferred_persona');
    if (savedPersona) {
      const persona = PERSONAS.find(p => p.id === savedPersona);
      if (persona && canAccessPersona(persona)) {
        onPersonaChange(persona);
      }
    }
    
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

  const giveInitialGreeting = async () => {
    if (hasGivenInitialGreeting) return;
    
    const greetingMessage = "Hello, I'm LYLO. Please select a persona.";
    await speakText(greetingMessage);
    setLastBotResponse(greetingMessage);
    
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
      setLastBotResponse(expansionMessage);
      return;
    }
    
    quickStopAllAudio();
    localStorage.setItem('lylo_preferred_persona', persona.id);
    onPersonaChange(persona);
    setShowDropdown(false);
    
    const introMessage = `${persona.spokenHook} Here's what I can do for you: ${persona.capabilities.slice(0, 3).join(', ')}, and much more. How can I protect and assist you today?`;
    
    await speakText(introMessage);
    setLastBotResponse(introMessage);
    
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

  // --- AUDIO FUNCTIONS WITH REPLAY & TIMEOUT FIX ---
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSpeech(null);
  };

  // Robust chunking to prevent browser timeout on long text
  const chunkTextForSpeech = (text: string): string[] => {
    // 1. Split deeply into sentences first
    const rawSentences = text.match(/[^.?!]+[.?!]+[\])'"]*|.+/g) || [text];
    const chunks: string[] = [];

    // 2. Further split any long sentence by commas or clauses
    rawSentences.forEach(sentence => {
      if (sentence.length < 180) {
        chunks.push(sentence.trim());
      } else {
        // Split long sentences by comma to keep browser awake
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

  const speakText = async (text: string, forceGender?: string) => {
    if (!autoTTS && !forceGender) return;
    if (!text) return;
    
    quickStopAllAudio();
    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;

    setIsSpeaking(true);

    // Try OpenAI TTS first (short text only for speed)
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
    
    // Browser Fallback with Anti-Timeout Chunking
    const chunks = chunkTextForSpeech(cleanText);
    speakChunksSequentially(chunks, 0);
  };

  const speakChunksSequentially = (chunks: string[], index: number) => {
    if (index >= chunks.length) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.rate = 0.9;
    utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
    
    utterance.onend = () => {
      speakChunksSequentially(chunks, index + 1);
    };
    
    utterance.onerror = (e) => {
      console.error("Speech error", e);
      // Attempt next chunk even if one fails
      speakChunksSequentially(chunks, index + 1);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleReplayLastMessage = () => {
    if (lastBotResponse) {
      speakText(lastBotResponse);
    }
  };

  // --- FIXED WALKIE-TALKIE SPEECH RECOGNITION ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true; 
      recognition.interimResults = true; 
      recognition.lang = language === 'es' ? 'es-MX' : 'en-US'; 
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setRecordingState('recording');
        console.log('Speech recognition started');
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          }
        }
        
        if (finalTranscript.trim()) {
          // Append final results to state safely
          setInput(prev => prev + finalTranscript);
          transcriptRef.current += finalTranscript;
        }
      };

      recognition.onerror = (event: any) => {
        if (isRecording) {
             // Restart on error if supposed to be recording (prevents stutter stop)
             try { recognition.start(); } catch(e) {}
        }
      };

      recognition.onend = () => {
        // Keep recording until user clicks stop
        if (isRecording) {
             try { recognition.start(); } catch(e) {}
        } else {
            setRecordingState('idle');
        }
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    } else {
      setMicSupported(false);
    }
  }, [language, isRecording]);

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
    
    if (isRecording) {
      // STOP & AUTO SEND
      setIsRecording(false);
      const recognition = recognitionRef.current;
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
      // Give delay for final transcript to process
      setTimeout(() => {
          handleSend();
      }, 200);
    } else {
      // START RECORDING
      quickStopAllAudio(); 
      setIsRecording(true);
      setInput(''); 
      transcriptRef.current = '';
      
      const recognition = recognitionRef.current;
      if (recognition) {
        try { 
          recognition.start(); 
        } catch(e) { 
          setIsRecording(false);
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
      quickStopAllAudio();
    }
  };

  // --- FIXED SEND HANDLER WITH TEXT PARAMETER ---
  const handleSendWithText = async (textToSend: string) => {
    if ((!textToSend && !selectedImage) || loading) return;

    quickStopAllAudio();

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
        setLastBotResponse(searchMessage);
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
      await speakText(response.answer);
      setLastBotResponse(response.answer);
      
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadUserStats();
      
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
    quickStopAllAudio(); 
    if (!isEliteUser) {
      alert('Scam Recovery Center is exclusive to Elite and Max tier members.');
      return;
    }
    setShowScamRecovery(true);
  };

  // --- INTELLIGENCE SYNC MODAL HANDLERS ---
  const handleIntelligenceSyncClick = () => {
    quickStopAllAudio(); 
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
      setLastBotResponse(syncMessage);
    }, 500);
  };

  const cycleFontSize = () => {
    quickStopAllAudio(); 
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

  // --- COMMAND CENTER COMPONENT (SIMPLIFIED: LOGO ONLY) ---
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
        Digital Bodyguard Active
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

      {/* Privacy Shield Status */}
      <div className="mt-8 flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full transition-colors ${getPersonaColorClass(currentPersona, 'bg')}`} />
        <span className="text-gray-400 text-xs font-black uppercase tracking-widest">
          Protected Mode
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
                <span className={`text-xs uppercase font-black ${getPersonaColorClass(currentPersona, 'text')}`}>Sync: {intelligenceSync}%</span>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <div className={`w-1.5 h-1.5 rounded-full ${getPersonaColorClass(currentPersona, 'bg')}`}></div>
                <span className="text-gray-400 text-[10px] uppercase font-black">Protected</span>
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
                      ? `${getPersonaColorClass(currentPersona, 'bg')} border-${getPersonaColorClass(currentPersona, 'border')} text-white shadow-lg shadow-${getPersonaColorClass(currentPersona, 'text')}/10` 
                      : `bg-black/60 text-gray-100 ${getPersonaColorClass(currentPersona, 'border')}/30 border`
                  }`}>
                    <div className="leading-relaxed font-medium">{msg.content}</div>
                    <div className={`text-[10px] mt-2 opacity-70 font-black uppercase tracking-wider ${msg.sender === 'user' ? 'text-right text-white/70' : 'text-left text-gray-400'}`}>
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
                : micSupported 
                  ? 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20' 
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'
            } disabled:opacity-50`} style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>{
              isRecording ? 'STOP & SEND' : 'Record'
            }</button>
            <button onClick={cycleFontSize} className="text-sm px-8 py-3 rounded-lg bg-zinc-800 text-blue-400 font-black border-2 border-blue-500/40 hover:bg-blue-900/20 active:scale-95 transition-all uppercase tracking-widest shadow-lg">Size: {zoomLevel}%</button>
            
            {/* NEW: REPLAY BUTTON */}
            <button onClick={handleReplayLastMessage} className={`px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-[0.1em] transition-all border bg-white/10 text-gray-300 hover:bg-white/20 border-white/20`} title="Replay Last Message" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>
              🔄 Replay
            </button>

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
              <textarea ref={inputRef} value={input} onChange={(e) => !isRecording && setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={isRecording ? "Recording voice..." : selectedImage ? `Vision ready: ${selectedImage.name}...` : `Ask ${currentPersona.name} anything...`} disabled={loading || isRecording} className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium pt-2 ${isRecording ? getPersonaColorClass(currentPersona, 'text') + ' italic cursor-not-allowed' : ''}`} style={{ fontSize: `${zoomLevel / 100}rem` }} rows={1} />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedImage) || isRecording} className={`px-6 py-3 rounded-lg font-black text-sm uppercase tracking-[0.1em] transition-all ${(input.trim() || selectedImage) && !loading && !isRecording ? `bg-gradient-to-r ${getPersonaColorClass(currentPersona, 'bg')} to-blue-800 text-white hover:shadow-lg` : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`} style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}>{loading ? 'Processing' : 'Send'}</button>
          </div>
          <div className="text-center mt-3 pb-1">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] italic">LYLO DIGITAL BODYGUARD: YOUR PERSONAL SECURITY & SEARCH ENGINE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
