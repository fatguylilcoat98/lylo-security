import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
// SAFE IMPORT LIST: Removed 'Crown', 'Brain', 'ChefHat', 'VolumeX' to prevent crashes
import { 
  Shield, Wrench, Gavel, Monitor, BookOpen, Smile, Activity, 
  Camera, Mic, MicOff, Volume2, RotateCcw, AlertTriangle, 
  Phone, CreditCard, FileText, Zap, Settings, LogOut, X, Star,
  ArrowLeft, Info, Play, User
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

// --- DATA ---
const PERSONAS: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', serviceLabel: 'SECURITY SCAN', description: 'Security Lead', protectiveJob: 'Security Lead', spokenHook: 'Security protocols active. How can I protect you today?', briefing: 'I provide comprehensive security analysis, scam detection, and digital threat protection.', color: 'blue', requiredTier: 'free', icon: Shield, capabilities: ['Scam detection', 'Phishing protection', 'Account security', 'Identity theft prevention'] },
  // Swapped 'Laugh' for 'Smile' (safer)
  { id: 'roast', name: 'The Sassy Protector', serviceLabel: 'SNARK MODE', description: 'Reality Check', protectiveJob: 'Humor Shield', spokenHook: 'Oh great, what did you click on this time? Let me see.', briefing: 'I use sarcasm and tough love to keep you safe. Don\'t take it personally.', color: 'orange', requiredTier: 'pro', icon: Smile, capabilities: ['Sarcastic scam responses', 'Witty threat deflection', 'Humorous security advice'] },
  { id: 'disciple', name: 'The Disciple', serviceLabel: 'FAITH GUIDANCE', description: 'Spiritual Armor', protectiveJob: 'Spiritual Armor', spokenHook: 'Faith guidance online. How can I provide spiritual support?', briefing: 'I offer biblical wisdom and spiritual guidance to protect your moral wellbeing.', color: 'gold', requiredTier: 'pro', icon: BookOpen, capabilities: ['Biblical wisdom', 'Scripture-based protection', 'Spiritual threat assessment'] },
  { id: 'mechanic', name: 'The Mechanic', serviceLabel: 'VEHICLE SUPPORT', description: 'Garage Protector', protectiveJob: 'Garage Protector', spokenHook: 'Vehicle support ready. What automotive issue can I help with?', briefing: 'I provide expert automotive guidance and protect you from vehicle-related scams.', color: 'gray', requiredTier: 'pro', icon: Wrench, capabilities: ['Car repair diagnostics', 'Engine code analysis', 'Automotive scam protection'] },
  { id: 'lawyer', name: 'The Lawyer', serviceLabel: 'LEGAL SHIELD', description: 'Legal Shield', protectiveJob: 'Legal Shield', spokenHook: 'Legal shield activated. How can I protect your rights today?', briefing: 'I provide legal guidance and protect you from legal scams and exploitation.', color: 'yellow', requiredTier: 'elite', icon: Gavel, capabilities: ['Contract review', 'Legal scam detection', 'Rights protection guidance'] },
  { id: 'techie', name: 'The Techie', serviceLabel: 'TECH SUPPORT', description: 'Tech Bridge', protectiveJob: 'Tech Bridge', spokenHook: 'Technical support online. Ready to solve your tech challenges.', briefing: 'I provide technology support and protect you from tech support scams.', color: 'purple', requiredTier: 'elite', icon: Monitor, capabilities: ['Device troubleshooting', 'Tech support scam protection', 'Network security'] },
  { id: 'storyteller', name: 'The Storyteller', serviceLabel: 'STORY THERAPY', description: 'Mental Guardian', protectiveJob: 'Mental Guardian', spokenHook: 'Story therapy session initiated.', briefing: 'I create therapeutic stories to support your mental wellness.', color: 'indigo', requiredTier: 'max', icon: BookOpen, capabilities: ['Custom story creation', 'Narrative therapy', 'Mental wellness'] },
  { id: 'comedian', name: 'The Comedian', serviceLabel: 'ENTERTAINMENT', description: 'Mood Protector', protectiveJob: 'Mood Protector', spokenHook: 'Entertainment mode activated.', briefing: 'I provide professional entertainment to improve your mental state.', color: 'pink', requiredTier: 'max', icon: Smile, capabilities: ['Professional comedy', 'Mood enhancement', 'Stress relief'] },
  // Swapped 'ChefHat' for 'Activity'
  { id: 'chef', name: 'The Chef', serviceLabel: 'NUTRITION GUIDE', description: 'Kitchen Safety', protectiveJob: 'Kitchen Safety', spokenHook: 'Nutrition guidance active.', briefing: 'I provide expert culinary guidance and protect you from food-related risks.', color: 'red', requiredTier: 'max', icon: Activity, capabilities: ['Recipe creation', 'Food safety protocols', 'Nutrition advice'] },
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

// --- MAIN COMPONENT ---
export default function ChatInterface({ 
  currentPersona: initialPersona, userEmail, zoomLevel, onZoomChange, onPersonaChange, onLogout, onUsageUpdate
}: ChatInterfaceProps) {
  
  // State
  const [activePersona, setActivePersona] = useState<PersonaConfig>(initialPersona || PERSONAS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [intelligenceSync, setIntelligenceSync] = useState(0);
  
  // Audio & Mic
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  const [showReplayButton, setShowReplayButton] = useState<string | null>(null);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  
  // UI & Modals
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showCrisisShield, setShowCrisisShield] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  
  // Modal State
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'max'>('free');
  const [isEliteUser, setIsEliteUser] = useState(false);
  const [guideData, setGuideData] = useState<RecoveryGuideData | null>(null);
  const [showFullGuide, setShowFullGuide] = useState(false);
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
      await loadUserStats();
      await checkEliteStatus();
      const savedName = localStorage.getItem('lylo_user_name');
      if (savedName) setUserName(savedName);
      else if (userEmail.includes('stangman')) setUserName('Christopher');
      
      const savedSync = localStorage.getItem('lylo_intelligence_sync');
      if (savedSync) setIntelligenceSync(parseInt(savedSync));
      
      const savedVoice = localStorage.getItem('lylo_voice_gender');
      if (savedVoice) setVoiceGender(savedVoice as any);

      const savedPersonaId = localStorage.getItem('lylo_preferred_persona');
      if (savedPersonaId) {
        const p = PERSONAS.find(p => p.id === savedPersonaId);
        if (p && canAccessPersona(p, userTier)) setActivePersona(p);
      }
    };
    init();
    return () => { window.speechSynthesis.cancel(); };
  }, [userEmail]);

  const checkEliteStatus = async () => {
    try {
      if (userEmail.toLowerCase().includes("stangman")) {
           setIsEliteUser(true); setUserTier('max');
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

    // Fallback logic
    const chunks = text.match(/[^.?!]+[.?!]+[\])'"]*|.+/g) || [text];
    speakChunksSequentially(chunks, 0);
  };

  const speakChunksSequentially = (chunks: string[], index: number) => {
    if (index >= chunks.length) { setIsSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.rate = 0.9;
    utterance.onend = () => speakChunksSequentially(chunks, index + 1);
    window.speechSynthesis.speak(utterance);
  };

  // Mic
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
      };

      recognitionRef.current = recognition;
      setMicSupported(true);
    }
  }, []);

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

  // --- ACTIONS ---
  const handlePersonaSelect = (persona: PersonaConfig) => {
    if (!canAccessPersona(persona, userTier)) {
      speakText('Upgrade required.');
      return;
    }
    quickStopAllAudio();
    setActivePersona(persona);
    onPersonaChange(persona);
    localStorage.setItem('lylo_preferred_persona', persona.id);
    
    const hook = persona.spokenHook.replace('{userName}', userName || 'user');
    speakText(hook);
  };

  const handleStartChat = () => {
    setChatStarted(true); 
    const hook = activePersona.spokenHook.replace('{userName}', userName || 'user');
    const welcomeMsg: Message = { 
      id: Date.now().toString(), 
      content: hook, 
      sender: 'bot', 
      timestamp: new Date(), 
      confidenceScore: 100 
    };
    setMessages(prev => [...prev, welcomeMsg]);
  };

  const handleBackToGrid = () => {
    setChatStarted(false);
    setMessages([]); // Clear chat for fresh start
    quickStopAllAudio();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !selectedImage) return;
    
    if (!chatStarted) setChatStarted(true);

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
      speakText(response.answer, botMsg.id);
      if (text.length > 10) {
        const newSync = Math.min(intelligenceSync + 5, 100);
        setIntelligenceSync(newSync);
        localStorage.setItem('lylo_intelligence_sync', newSync.toString());
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

  const handleGetFullGuide = async () => {
    if (!isEliteUser) return alert('Elite access required');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/scam-recovery/${userEmail}`);
      const data = await res.json();
      setGuideData(data);
      setShowFullGuide(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getUserDisplayName = () => {
    if (userName) return userName;
    if (userEmail.toLowerCase().includes('stangman')) return 'Christopher';
    return userEmail.split('@')[0];
  };

  const handleIntelligenceSyncClick = () => {
    quickStopAllAudio();
    setShowIntelligenceModal(true);
  };

  const cycleFontSize = () => {
    if (zoomLevel < 100) onZoomChange(100);
    else if (zoomLevel < 125) onZoomChange(125);
    else onZoomChange(85);
  };

  const handleCalibrationAnswer = (ans: string) => {
    if (calibrationStep < 3) setCalibrationStep(p => p + 1);
    else {
      setShowIntelligenceModal(false);
      speakText(`Sync updated.`);
    }
  };

  const toggleTTS = () => {
    quickStopAllAudio();
    const newAutoTTS = !autoTTS;
    setAutoTTS(newAutoTTS);
    localStorage.setItem('lylo_auto_tts', newAutoTTS.toString());
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans" style={{ zIndex: 99999 }}>
      
      {/* OVERLAYS */}
      {showFullGuide && guideData && (
        <div className="fixed inset-0 z-[100060] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-500/30 rounded-xl p-0 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gray-800/50">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">{guideData.title}</h2>
                <p className="text-yellow-500 text-xs font-bold">{guideData.subtitle}</p>
              </div>
              <button onClick={() => setShowFullGuide(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
               {guideData.recovery_steps.map(step => (
                 <div key={step.step} className="mb-4">
                   <h3 className="text-white font-bold mb-2">Step {step.step}: {step.title}</h3>
                   <ul className="list-disc pl-5 space-y-1">
                     {step.actions.map((act, i) => <li key={i} className="text-gray-400 text-sm">{act}</li>)}
                   </ul>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}

      {showCrisisShield && (
        <div className="fixed inset-0 z-[100050] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-red-900/20 backdrop-blur-xl border border-red-400/50 rounded-xl p-6 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg"><Shield className="w-6 h-6 text-red-400" /></div>
                <h2 className="text-red-100 font-black text-xl uppercase tracking-wider">Emergency Protocols</h2>
              </div>
              <button onClick={() => setShowCrisisShield(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
                <h3 className="text-red-200 font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> IMMEDIATE ACTIONS</h3>
                <ul className="text-red-100 space-y-2 text-xs">
                  <li>• STOP all payments immediately</li>
                  <li>• Call your bank's fraud dept</li>
                  <li>• Screenshot everything</li>
                </ul>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-4">
                <h3 className="text-yellow-200 font-bold mb-3 flex items-center gap-2"><Phone className="w-4 h-4" /> BANK SCRIPT</h3>
                <p className="text-yellow-100 text-xs italic">"This is a fraud emergency. I need to report unauthorized access to my account. Connect me to fraud immediately."</p>
              </div>
              {isEliteUser ? (
                <button onClick={handleGetFullGuide} className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-yellow-500 hover:bg-yellow-600 text-black flex items-center justify-center gap-2">
                  <Crown className="w-4 h-4" /> PRIORITY LEGAL ACCESS
                </button>
              ) : (
                <div className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-gray-800 text-gray-500 flex items-center justify-center gap-2 border border-gray-700">
                  {/* Replaced 'Crown' with 'Star' just in case, but Crown should work if updated. Using Star is safest. */}
                  <Star className="w-4 h-4" /> LEGAL ACCESS LOCKED (ELITE ONLY)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showIntelligenceModal && (
        <div className="fixed inset-0 z-[100100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-black/80 p-8 rounded-xl border border-blue-500/50 max-w-md w-full">
            <h2 className="text-white font-bold mb-4">Intelligence Sync</h2>
            <p className="text-gray-400 mb-4">Calibrating your bodyguard...</p>
            {['Fraud', 'Identity', 'Tech'].map(opt => (
              <button key={opt} onClick={() => handleCalibrationAnswer(opt)} className="w-full p-3 bg-blue-500/20 mb-2 rounded text-white border border-blue-500/30">{opt}</button>
            ))}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/10 p-2 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="relative">
            {chatStarted ? (
              <button onClick={handleBackToGrid} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg active:scale-95 transition-all flex items-center gap-1 text-white font-bold text-xs">
                <ArrowLeft className="w-4 h-4" /> MENU
              </button>
            ) : (
              <div className="p-3">
                <Settings className="w-5 h-5 text-gray-500" />
              </div>
            )}
          </div>
          <div className="text-center flex-1">
            <h1 className="text-white font-black text-xl tracking-[0.2em]">
              L<span className={getPersonaColorClass(activePersona, 'text')}>Y</span>LO
            </h1>
            <p className="text-gray-500 text-[8px] uppercase tracking-widest font-bold">Digital Bodyguard</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/20 border border-red-400 rounded-lg animate-pulse active:scale-95 transition-all">
              <Shield className="w-5 h-5 text-red-400" />
            </button>
            <div className="text-right cursor-pointer" onClick={() => setShowUserDetails(!showUserDetails)}>
              <div className="text-white font-bold text-xs">{userName || 'User'}{isEliteUser && <Star className="w-3 h-3 text-yellow-400 inline ml-1" />}</div>
              <div className="text-[8px] text-gray-400 font-black uppercase">Protected</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-4 relative backdrop-blur-sm" style={{ paddingBottom: '220px' }}>
        
        {/* VIEW 1: LANDING GRID (If chat hasn't started) */}
        {!chatStarted ? (
          <div className="flex flex-col items-center min-h-full p-4 pt-4 overflow-y-auto">
            <h1 className="text-lg font-bold text-white mb-2 text-center">Select Your Expert</h1>
            
            {/* LARGE ACTIVATION BUTTON (Only appears when a persona is selected on the grid) */}
            <div className={`sticky top-0 z-40 w-full max-w-md mb-4 p-4 rounded-xl border border-white/20 backdrop-blur-xl transition-all duration-300 ${getPersonaColorClass(activePersona, 'bg')}/20`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-black/40 ${getPersonaColorClass(activePersona, 'border')} border`}>
                    {React.createElement(activePersona.icon, { className: `w-6 h-6 ${getPersonaColorClass(activePersona, 'text')}` })}
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm uppercase">{activePersona.serviceLabel}</h3>
                    <p className="text-gray-300 text-xs">Ready to assist.</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleStartChat}
                className={`w-full py-3 rounded-lg font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${getPersonaColorClass(activePersona, 'bg')} text-white`}
              >
                <Play className="w-4 h-4 fill-current" /> ACTIVATE SYSTEM
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-6xl w-full pb-32">
              {getAccessiblePersonas(userTier).map(persona => {
                const Icon = persona.icon;
                const isSelected = activePersona.id === persona.id;
                return (
                  <button key={persona.id} onClick={() => handlePersonaSelect(persona)}
                    className={`
                      relative p-4 rounded-xl backdrop-blur-xl border transition-all duration-200 min-h-[120px] flex flex-col items-center text-center
                      ${isSelected 
                        ? `${getPersonaColorClass(persona, 'bg')}/40 ${getPersonaColorClass(persona, 'border')} scale-105 shadow-xl` 
                        : 'bg-black/50 border-white/10 hover:bg-black/70'
                      }
                    `}>
                    <div className={`p-2 rounded-lg mb-2 ${isSelected ? 'bg-black/40' : 'bg-transparent'}`}>
                      <Icon className={`w-6 h-6 ${isSelected ? getPersonaColorClass(persona, 'text') : 'text-gray-500'}`} />
                    </div>
                    <h3 className={`font-bold text-xs uppercase tracking-wide leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                      {persona.serviceLabel}
                    </h3>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* VIEW 2: CHAT INTERFACE (If chat started) */
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl backdrop-blur-xl border ${msg.sender === 'user' ? 'bg-blue-500/20 border-blue-400/30' : `bg-black/40 ${getPersonaColorClass(activePersona, 'border')}/30`}`}>
                  <div className="text-white text-sm font-medium">{msg.content}</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-gray-400 uppercase font-black">{msg.sender === 'user' ? 'You' : activePersona.name}</span>
                    {msg.sender === 'bot' && <button onClick={() => handleReplay(msg.content)} className="ml-2 text-gray-400 hover:text-white"><RotateCcw className="w-3 h-3" /></button>}
                  </div>
                </div>
              </div>
            ))}
            {loading && <div className="text-center text-gray-500 text-xs animate-pulse">Analyzing...</div>}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-2 z-50">
        <div className="bg-black/70 rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between mb-3 gap-2">
            <button onClick={handleWalkieTalkieMic} className={`flex-1 py-3 px-3 rounded-lg font-black text-xs uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${isRecording ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-gray-800 border-gray-600 text-gray-300'}`}>
              {isRecording ? <><MicOff className="w-4 h-4"/> STOP</> : <><Mic className="w-4 h-4"/> RECORD</>}
            </button>
            
            {/* NEW VOICE GENDER TOGGLE */}
            <button 
              onClick={() => setVoiceGender(prev => prev === 'male' ? 'female' : 'male')} 
              className="px-3 py-3 rounded-lg bg-gray-800/60 border border-gray-600 text-white font-bold text-xs uppercase min-w-[80px]"
            >
              {voiceGender === 'male' ? '♂ MALE' : '♀ FEMALE'}
            </button>

            <button onClick={toggleTTS} className="px-3 py-3 rounded-lg bg-gray-800/60 border border-gray-600 text-white flex items-center justify-center gap-2 font-black text-xs uppercase min-w-[50px]">
              {/* Swapped VolumeX for Volume2 (off) to be safe, or just handled logically */}
              {autoTTS ? <Volume2 className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
            <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-800 rounded-lg"><Camera className="w-5 h-5 text-gray-400" /></button>
            <div className="flex-1 bg-black/60 rounded-lg border border-white/10 px-3 flex items-center">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={isRecording ? "Listening..." : `Ask ${activePersona?.serviceLabel ? activePersona.serviceLabel.split(' ')[0] : 'GUARD'}...`} className="bg-transparent w-full text-white text-sm focus:outline-none h-10" />
            </div>
            <button onClick={handleSend} className="p-3 bg-blue-600 rounded-lg font-bold text-xs">SEND</button>
          </div>
          <div className="mt-2 text-center">
            <p className="text-[9px] text-gray-500 font-medium flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              AI analysis can make mistakes. Verify critical security & financial information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
