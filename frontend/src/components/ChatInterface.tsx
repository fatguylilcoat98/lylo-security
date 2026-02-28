// ============================================================================
// LYLO OS — ChatInterface.tsx
// Version: 31.6.0 — PHASE 1 VOICE ARCHITECTURE: inputMode + 3-sentence cap + silence detection + emergency auto-shield
// ─────────────────────────────────────────────────────────────────────────────
// V31.2 Changes:
//  [V31.2-1] FONT SIZE BUTTON — Aa button in bottom bar cycles 4 sizes
//  [V31.2-2] BELL TOAST       — Visual feedback toast when bell is tapped
//  [V31.2-3] SPANISH TOGGLE   — Gold highlight + flag emoji when ES active
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { useSentinel } from '../lib/useSentinel';
import { PERSONAS as IMPORTED_PERSONAS } from '../data/personas';
import {
  Shield, Wrench, Gavel, Activity, BookOpen, Laugh,
  Mic, MicOff, Volume2, VolumeX, AlertTriangle, CreditCard,
  Zap, Brain, LogOut, X, ArrowRight, Briefcase, Bell, Info,
  ExternalLink, Menu, Image as ImageIcon, Camera as CameraIcon, Type, Lock,
  Compass, Star, Users, Target, Flame, Heart, Sliders, ChevronLeft, ChevronRight,
  CheckCircle, Globe,
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

const CRISIS_LINKS: { [key: string]: { label: string; url: string; description: string }[] } = {
  guardian:  [{ label: 'FBI IC3 Fraud Reporting', url: 'https://www.ic3.gov/', description: 'Report stolen funds or digital extortion immediately.' }, { label: 'IdentityTheft.gov', url: 'https://www.identitytheft.gov/', description: 'Federal hub to lock down compromised SSNs.' }],
  lawyer:    [{ label: 'Legal Services Corporation', url: 'https://www.lsc.gov/', description: 'Find immediate, free legal aid in your area.' }, { label: 'CFPB Complaint', url: 'https://www.consumerfinance.gov/complaint/', description: 'File against a predatory lender or bank.' }],
  doctor:    [{ label: 'Call 911', url: 'tel:911', description: 'For immediate, life-threatening emergencies.' }, { label: 'WebMD Symptom Checker', url: 'https://symptoms.webmd.com/', description: 'Verify non-emergency symptoms.' }],
  therapist: [{ label: '988 Crisis Lifeline', url: 'tel:988', description: 'Call or text 988 for mental health support.' }, { label: 'Crisis Text Line', url: 'sms:741741', description: 'Text HOME to 741741.' }],
  wealth:    [{ label: 'AnnualCreditReport.com', url: 'https://www.annualcreditreport.com/', description: 'The only federally authorized free credit report.' }, { label: 'NFCC Counseling', url: 'https://www.nfcc.org/', description: 'Non-profit debt relief.' }],
  career:    [{ label: 'Department of Labor', url: 'https://www.dol.gov/agencies/whd', description: 'Report wage theft or unsafe working conditions.' }, { label: 'Glassdoor Salaries', url: 'https://www.glassdoor.com/Salaries/index.htm', description: 'Benchmark salary before negotiations.' }],
  mechanic:  [{ label: 'RepairPal Estimates', url: 'https://repairpal.com/', description: 'Verified fair-price estimates before the shop.' }, { label: 'NHTSA Recalls', url: 'https://www.nhtsa.gov/recalls', description: 'Check active safety recalls.' }],
  tutor:     [{ label: 'Khan Academy', url: 'https://www.khanacademy.org/', description: 'Free, world-class education for anyone.' }, { label: 'Coursera', url: 'https://www.coursera.org/', description: 'Professional certificates and degrees.' }],
  pastor:    [{ label: 'Bible Gateway', url: 'https://www.biblegateway.com/', description: 'Searchable Bible in 200+ versions.' }, { label: 'Focus on the Family', url: 'https://www.focusonthefamily.com/get-help/', description: 'Christian counseling consultations.' }],
  vitality:  [{ label: 'Examine.com', url: 'https://examine.com/', description: 'Independent research on supplements and nutrition.' }, { label: 'CDC Activity Guidelines', url: 'https://www.cdc.gov/physicalactivity/basics/index.htm', description: 'Federal health guidelines.' }],
  hype:      [{ label: 'Google Trends', url: 'https://trends.google.com/trends/', description: 'What the world is searching for right now.' }, { label: 'Answer The Public', url: 'https://answerthepublic.com/', description: 'Questions people are asking.' }],
  bestie:    [{ label: 'Meetup.com', url: 'https://www.meetup.com/', description: 'Find local groups and communities.' }],
};

export interface PersonaConfig {
  id: string; name: string; serviceLabel: string; description: string;
  protectiveJob: string; spokenHook: string; briefing: string; color: string;
  requiredTier: 'free' | 'pro' | 'elite' | 'max'; capabilities: string[];
  icon: React.ComponentType<any>; fixedVoice: string;
}

interface BestieConfig { gender: 'male' | 'female'; voiceId: string; vibeLabel: string; }

interface ChatInterfaceProps {
  currentPersona?: PersonaConfig;
  userEmail: string;
  userTier?: string;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  onPersonaChange?: (persona: PersonaConfig) => void;
  onLogout?: () => void;
  onUsageUpdate?: () => void;
}

interface IntakeProfile { faith: string; occupation: string; mission: string; vibe: string; relationship: string; }

interface AudioQueueEntry { sentence: string; audio: HTMLAudioElement | null; status: 'pending' | 'fetching' | 'ready' | 'played'; }

const INTAKE_QUESTIONS_R1 = [
  {
    id: 'faith',
    question: 'What guides your spirit?',
    subtitle: 'Helps your Pastor speak your language.',
    icon: Star,
    accentColor: 'gold',
    options: [
      { label: 'Christian',            emoji: '✝️',  value: 'christian' },
      { label: 'Muslim',               emoji: '☪️',  value: 'muslim'    },
      { label: 'Jewish',               emoji: '✡️',  value: 'jewish'    },
      { label: 'Hindu',                emoji: '🕉️', value: 'hindu'     },
      { label: 'Buddhist',             emoji: '☸️',  value: 'buddhist'  },
      { label: 'Spiritual / No label', emoji: '🌿',  value: 'spiritual' },
    ],
    allowCustom: true,
    customPlaceholder: 'My faith is…',
  },
  {
    id: 'occupation',
    question: 'What do you do for work?',
    subtitle: 'Calibrates your personal AI Task Force.',
    icon: Briefcase,
    accentColor: 'blue',
    options: [
      { label: 'Professional / Employee',    emoji: '💼', value: 'professional' },
      { label: 'Entrepreneur / Biz Owner',   emoji: '🚀', value: 'entrepreneur' },
      { label: 'Student',                    emoji: '🎓', value: 'student'      },
      { label: 'Parent / Caregiver',         emoji: '🏠', value: 'caregiver'    },
      { label: 'Job Seeker',                 emoji: '🔍', value: 'job_seeker'   },
      { label: 'Retired',                    emoji: '🌅', value: 'retired'      },
    ],
    allowCustom: true,
    customPlaceholder: 'I work as…',
  },
  {
    id: 'mission',
    question: 'Your #1 mission right now?',
    subtitle: 'We route your council around this objective.',
    icon: Target,
    accentColor: 'green',
    options: [
      { label: 'Build Wealth',           emoji: '💰', value: 'build_wealth'    },
      { label: 'Protect My Family',      emoji: '🛡️', value: 'protect_family'  },
      { label: 'Advance My Career',      emoji: '📈', value: 'career_growth'   },
      { label: 'Health & Wellness',      emoji: '💪', value: 'health_wellness' },
      { label: 'Legal / Financial Help', emoji: '⚖️', value: 'legal_financial' },
      { label: 'Personal Growth',        emoji: '🌱', value: 'personal_growth' },
    ],
    allowCustom: true,
    customPlaceholder: 'My mission is…',
  },
  {
    id: 'vibe',
    question: 'How should your council talk to you?',
    subtitle: 'Every advisor adapts to your style.',
    icon: Sliders,
    accentColor: 'purple',
    options: [
      { label: 'Direct & No Fluff',   emoji: '⚡', value: 'standard'  },
      { label: 'Chill & Easy',        emoji: '😎', value: 'chill'     },
      { label: 'Warm & Supportive',   emoji: '🌸', value: 'nurturing' },
      { label: 'Zero Filter',         emoji: '🔥', value: 'blunt'     },
      { label: 'Structured & Cited',  emoji: '📚', value: 'academic'  },
      { label: 'Maximum Urgency',     emoji: '🎯', value: 'intense'   },
    ],
    allowCustom: false,
    customPlaceholder: '',
  },
  {
    id: 'relationship',
    question: 'Relationship status?',
    subtitle: 'Advisors calibrate tone to your situation.',
    icon: Heart,
    accentColor: 'pink',
    options: [
      { label: 'Single',              emoji: '🎯', value: 'single'      },
      { label: 'In a Relationship',   emoji: '💛', value: 'relationship' },
      { label: 'Married',             emoji: '💍', value: 'married'      },
      { label: "It's Complicated",    emoji: '🌀', value: 'complicated'  },
      { label: 'Divorced / Separated',emoji: '🔓', value: 'divorced'     },
      { label: 'Prefer Not to Say',   emoji: '🔒', value: 'private'      },
    ],
    allowCustom: false,
    customPlaceholder: '',
  },
];

const INTAKE_QUESTIONS_R2 = [
  {
    id: 'housing',
    question: 'Do you own or rent?',
    subtitle: 'Helps your Lawyer and Wealth Architect give specific advice.',
    icon: Shield,
    accentColor: 'blue',
    options: [
      { label: 'I Own My Home',           emoji: '🏠', value: 'own'    },
      { label: 'I Rent',                  emoji: '🔑', value: 'rent'   },
      { label: 'Live With Family / Other',emoji: '👨‍👩‍👧', value: 'other' },
    ],
    allowCustom: true, customPlaceholder: 'My situation is…',
  },
  {
    id: 'children',
    question: 'Do you have children?',
    subtitle: '',
    icon: Heart,
    accentColor: 'pink',
    options: [
      { label: 'Yes, young kids (under 12)', emoji: '🧒', value: 'young_kids' },
      { label: 'Yes, teenagers or adults',   emoji: '👦', value: 'older_kids' },
      { label: 'No children',                emoji: '🚫', value: 'none'       },
    ],
    allowCustom: true, customPlaceholder: 'Tell us more…',
  },
  {
    id: 'health_focus',
    question: 'Any ongoing health focus?',
    subtitle: '',
    icon: Activity,
    accentColor: 'green',
    options: [
      { label: 'Fitness & Weight Loss',   emoji: '💪', value: 'fitness'       },
      { label: 'Managing a Condition',    emoji: '🏥', value: 'condition'     },
      { label: 'Mental Health & Stress',  emoji: '🧠', value: 'mental_health' },
    ],
    allowCustom: true, customPlaceholder: 'My health focus is…',
  },
  {
    id: 'finances',
    question: 'Finances right now?',
    subtitle: 'Your Wealth Architect calibrates to your starting point.',
    icon: Target,
    accentColor: 'gold',
    options: [
      { label: 'Stable, looking to grow',  emoji: '📊', value: 'stable'     },
      { label: 'Getting by, want to improve', emoji: '💡', value: 'improving' },
      { label: 'Struggling, need a plan', emoji: '🆘', value: 'struggling'  },
    ],
    allowCustom: true, customPlaceholder: 'My situation is…',
  },
  {
    id: 'location',
    question: 'What state do you live in?',
    subtitle: 'State-specific legal and financial advice.',
    icon: Compass,
    accentColor: 'indigo',
    options: [
      { label: 'California', emoji: '🌴', value: 'CA' },
      { label: 'Texas',      emoji: '⭐', value: 'TX' },
      { label: 'Florida',    emoji: '☀️', value: 'FL' },
    ],
    allowCustom: true, customPlaceholder: 'I live in…',
  },
];

const VIBE_OPTIONS = [
  { value: 'standard', label: 'Standard' }, { value: 'chill', label: 'Chill' },
  { value: 'intense', label: 'Intense' }, { value: 'nurturing', label: 'Nurturing' },
  { value: 'blunt', label: 'Blunt' }, { value: 'academic', label: 'Academic' },
];

const LEGACY_VIBE_MAP: Record<string, string> = { roast: 'blunt', business: 'academic' };

const COLOR_MAP: Record<string, Record<string, string>> = {
  blue:   { border: 'border-blue-400',   glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',  bg: 'bg-blue-500',   text: 'text-blue-400',   selected: 'border-blue-400 bg-blue-500/20',    ring: 'hover:border-blue-400/60 hover:bg-blue-500/10'    },
  orange: { border: 'border-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',  bg: 'bg-orange-500', text: 'text-orange-400', selected: 'border-orange-400 bg-orange-500/20', ring: 'hover:border-orange-400/60 hover:bg-orange-500/10' },
  gold:   { border: 'border-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',   bg: 'bg-yellow-500', text: 'text-yellow-400', selected: 'border-yellow-400 bg-yellow-500/20',  ring: 'hover:border-yellow-400/60 hover:bg-yellow-500/10' },
  gray:   { border: 'border-gray-400',   glow: 'shadow-[0_0_20px_rgba(107,114,128,0.3)]', bg: 'bg-gray-500',   text: 'text-gray-400',   selected: 'border-gray-400 bg-gray-500/20',     ring: 'hover:border-gray-400/60 hover:bg-gray-500/10'    },
  yellow: { border: 'border-yellow-300', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',  bg: 'bg-yellow-400', text: 'text-yellow-300', selected: 'border-yellow-300 bg-yellow-400/20',  ring: 'hover:border-yellow-300/60 hover:bg-yellow-400/10' },
  purple: { border: 'border-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',  bg: 'bg-purple-500', text: 'text-purple-400', selected: 'border-purple-400 bg-purple-500/20',  ring: 'hover:border-purple-400/60 hover:bg-purple-500/10' },
  indigo: { border: 'border-indigo-400', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]',  bg: 'bg-indigo-500', text: 'text-indigo-400', selected: 'border-indigo-400 bg-indigo-500/20',  ring: 'hover:border-indigo-400/60 hover:bg-indigo-500/10' },
  pink:   { border: 'border-pink-400',   glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)]',  bg: 'bg-pink-500',   text: 'text-pink-400',   selected: 'border-pink-400 bg-pink-500/20',     ring: 'hover:border-pink-400/60 hover:bg-pink-500/10'    },
  red:    { border: 'border-red-400',    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',   bg: 'bg-red-500',    text: 'text-red-400',    selected: 'border-red-400 bg-red-500/20',        ring: 'hover:border-red-400/60 hover:bg-red-500/10'      },
  green:  { border: 'border-green-400',  glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',   bg: 'bg-green-500',  text: 'text-green-400',  selected: 'border-green-400 bg-green-500/20',    ring: 'hover:border-green-400/60 hover:bg-green-500/10'  },
};

const getColor = (color: string, key: string) => COLOR_MAP[color]?.[key] ?? COLOR_MAP.blue[key];

const UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    welcome:          'Welcome to LYLO',
    tagline:          'Your Digital Bodyguard',
    login_prompt:     'Enter your email to access your council',
    login_button:     'Access My Council',
    lang_toggle:      'Español',
    end_session:      'End Session',
    send_report:      'Send Session Report',
    report_prompt:    'Would you like this session sent to your email?',
    report_yes:       'Yes, send it',
    report_no:        'No thanks',
    complete_profile: 'Complete Your Profile',
    profile_prompt:   '5 more questions · sharpen your council',
    profile_cta:      "Let's Do It",
    profile_skip:     'Maybe Later',
    emerg_next:       'Done — Next Step',
    emerg_done:       'All Steps Complete ✓',
    step_of:          'of',
    q_round1:         'Quick Start · Question',
    q_round2:         'Profile · Question',
    custom_answer:    'Type your own answer…',
    skip:             'Skip',
    back:             'Back',
  },
  es: {
    welcome:          'Bienvenido a LYLO',
    tagline:          'Tu Guardaespaldas Digital',
    login_prompt:     'Ingresa tu correo para acceder a tu consejo',
    login_button:     'Acceder a Mi Consejo',
    lang_toggle:      'English',
    end_session:      'Terminar Sesión',
    send_report:      'Enviar Reporte de Sesión',
    report_prompt:    '¿Quieres que te enviemos el reporte de esta sesión?',
    report_yes:       'Sí, envíalo',
    report_no:        'No, gracias',
    complete_profile: 'Completa Tu Perfil',
    profile_prompt:   '5 preguntas más · mejora tu consejo',
    profile_cta:      'Vamos',
    profile_skip:     'Quizás Después',
    emerg_next:       'Listo — Siguiente Paso',
    emerg_done:       'Todos los Pasos Completados ✓',
    step_of:          'de',
    q_round1:         'Inicio Rápido · Pregunta',
    q_round2:         'Perfil · Pregunta',
    custom_answer:    'Escribe tu propia respuesta…',
    skip:             'Omitir',
    back:             'Atrás',
  },
};

const getDeviceId = () => {
  let id = localStorage.getItem('lylo_device_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'dev_' + Date.now() + Math.random().toString(36).slice(2);
    localStorage.setItem('lylo_device_id', id);
  }
  return id;
};

const splitIntoSentences = (text: string): string[] => {
  const clean = text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
  const parts = clean.match(/[^.!?\n]+(?:[.!?]+["']?(?:\s|$)|\n|$)/g) ?? [clean];
  return parts.map(s => s.trim()).filter(s => s.length > 3);
};

// ============================================================================
// AUDIO QUEUE MANAGER
// ============================================================================
function useAudioQueueManager(isVoiceEnabled: boolean, onSpeakingChange: (s: boolean) => void) {
  const queueRef        = useRef<AudioQueueEntry[]>([]);
  const isPlayingRef    = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isVoiceRef      = useRef(isVoiceEnabled);
  const speakingCbRef   = useRef(onSpeakingChange);

  useEffect(() => { isVoiceRef.current = isVoiceEnabled; }, [isVoiceEnabled]);
  useEffect(() => { speakingCbRef.current = onSpeakingChange; }, [onSpeakingChange]);

  const fetchSentenceAudio = async (sentence: string, voice: string): Promise<HTMLAudioElement | null> => {
    try {
      const fd = new FormData(); fd.append('text', sentence); fd.append('voice', voice);
      const res = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.audio_b64) { const a = new Audio(`data:audio/mp3;base64,${data.audio_b64}`); a.preload = 'auto'; return a; }
    } catch (e) { console.warn('[AQM] fetch failed:', e); }
    return null;
  };

  const playNext = useCallback(() => {
    if (!isVoiceRef.current) return;
    const nextReady = queueRef.current.find(e => e.status === 'ready');
    if (!nextReady) {
      const stillFetching = queueRef.current.some(e => e.status === 'fetching' || e.status === 'pending');
      if (!stillFetching) { isPlayingRef.current = false; speakingCbRef.current(false); } else setTimeout(playNext, 100);
      return;
    }
    nextReady.status = 'played';
    const audio = nextReady.audio;
    if (!audio) { playNext(); return; }
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; }
    currentAudioRef.current = audio; isPlayingRef.current = true; speakingCbRef.current(true);
    audio.onended = () => playNext();
    audio.play().catch(() => playNext());
  }, []);

  const stop = useCallback(() => {
    queueRef.current = []; isPlayingRef.current = false;
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; currentAudioRef.current = null; }
    speakingCbRef.current(false);
  }, []);

  const enqueue = useCallback(async (fullText: string, voice: string, inlineAudioB64?: string) => {
    if (!isVoiceRef.current) return;
    stop();
    const sentences = splitIntoSentences(fullText);
    if (!sentences.length) return;
    queueRef.current = sentences.map(s => ({ sentence: s, audio: null, status: 'pending' as const }));
    queueRef.current[0].status = 'fetching';
    if (inlineAudioB64) {
      const audio = new Audio(`data:audio/mp3;base64,${inlineAudioB64}`); audio.preload = 'auto';
      queueRef.current[0].audio = audio; queueRef.current[0].status = 'ready'; playNext();
    } else {
      fetchSentenceAudio(sentences[0], voice).then(audio => {
        if (queueRef.current[0]) { queueRef.current[0].audio = audio; queueRef.current[0].status = 'ready'; playNext(); }
      });
    }
    for (let i = 1; i < sentences.length; i++) {
      const idx = i;
      if (!queueRef.current[idx]) break;
      queueRef.current[idx].status = 'fetching';
      fetchSentenceAudio(sentences[idx], voice).then(audio => {
        if (queueRef.current[idx]) { queueRef.current[idx].audio = audio; queueRef.current[idx].status = 'ready'; if (!isPlayingRef.current) playNext(); }
      });
    }
  }, [stop, playNext]);

  const push = useCallback(async (sentence: string, voice: string, inlineAudioB64?: string) => {
    if (!isVoiceRef.current) return;
    const entry: AudioQueueEntry = { sentence, audio: null, status: 'fetching' };
    queueRef.current.push(entry);
    const idx = queueRef.current.length - 1;
    if (inlineAudioB64) {
      const audio = new Audio(`data:audio/mp3;base64,${inlineAudioB64}`);
      audio.preload = 'auto';
      queueRef.current[idx].audio = audio;
      queueRef.current[idx].status = 'ready';
    } else {
      const audio = await fetchSentenceAudio(sentence, voice);
      if (queueRef.current[idx]) {
        queueRef.current[idx].audio = audio;
        queueRef.current[idx].status = 'ready';
      }
    }
    if (!isPlayingRef.current) playNext();
  }, [playNext]);

  return { enqueue, push, stop, currentAudioRef };
}

function scrollIfNearBottom(el: HTMLDivElement, threshold = 150) {
  if (el.scrollHeight - el.scrollTop - el.clientHeight <= threshold) {
    el.scrollTop = el.scrollHeight;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================
function ChatInterface({
  currentPersona: initialPersona,
  userEmail = '',
  userTier: userTierProp,
  onPersonaChange = () => {},
  onLogout = () => {},
  onUsageUpdate = () => {},
}: ChatInterfaceProps) {

  const [intakeProfile, setIntakeProfile]               = useState<Partial<IntakeProfile>>({});
  const PERSONAS = IMPORTED_PERSONAS;

  const getPersonaFromStorage = (): PersonaConfig => {
    const saved = localStorage.getItem('lylo_selected_persona');
    if (saved) { const found = PERSONAS.find(p => p.id === saved); if (found) return found; }
    return initialPersona ?? PERSONAS[0];
  };

  const [activePersona, setActivePersona] = useState<PersonaConfig>(getPersonaFromStorage);

  useEffect(() => {
    const saved = localStorage.getItem('lylo_selected_persona');
    const target = saved ? PERSONAS.find(p => p.id === saved) : null;
    const desired = target ?? initialPersona ?? PERSONAS[0];
    if (desired.id !== activePersona.id) setActivePersona(desired);
  }, [initialPersona?.id]);

  const [lang, setLang] = useState<'en' | 'es'>(() =>
    (localStorage.getItem('lylo_lang') as 'en' | 'es') || 'en'
  );
  const t = (key: string): string => UI_STRINGS[lang]?.[key] ?? UI_STRINGS.en[key] ?? key;
  const toggleLang = () => {
    const next: 'en' | 'es' = lang === 'en' ? 'es' : 'en';
    setLang(next);
    localStorage.setItem('lylo_lang', next);
  };

  const [messages, setMessages]                         = useState<Message[]>([]);
  const [input, setInput]                               = useState('');
  const [loading, setLoading]                           = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // [FIX] auto-reset loading
  const [userName, setUserName]                         = useState('User');
  const [bestieConfig, setBestieConfig]                 = useState<BestieConfig | null>(null);
  const [showBestieSetup, setShowBestieSetup]           = useState(false);
  const [setupStep, setSetupStep]                       = useState<'gender' | 'voice'>('gender');
  const [tempGender, setTempGender]                     = useState<'male' | 'female'>('female');
  const [isRecording, setIsRecording]                   = useState(false);
  const [isSpeaking, setIsSpeaking]                     = useState(false);
  const [showDropdown, setShowDropdown]                 = useState(false);
  const [showCameraMenu, setShowCameraMenu]             = useState(false);
  const [userTier, setUserTier]                         = useState<'free' | 'pro' | 'elite' | 'max'>((userTierProp as any) ?? 'max');
  const [communicationStyle, setCommunicationStyle]     = useState('standard');
  const [fontLevel, setFontLevel]                       = useState(1);
  const [isVoiceEnabled, setIsVoiceEnabled]             = useState(true);
  const [readingMode, setReadingMode]                   = useState<'sync' | 'fast'>('sync');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [bellToast, setBellToast]                       = useState('');          // [V31.2-2] Bell toast
  const [selectedImage, setSelectedImage]               = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]                     = useState<string | null>(null);
  const [showCrisisShield, setShowCrisisShield]         = useState(false);
  const [showPersonaGrid, setShowPersonaGrid]           = useState(true);
  const [showOnboarding, setShowOnboarding]             = useState(false);
  const [onboardingStep, setOnboardingStep]             = useState(0);
  const [onboardingRound, setOnboardingRound]           = useState<1 | 2>(1);
  const [showRound2Prompt, setShowRound2Prompt]         = useState(false);
  const [customAnswer, setCustomAnswer]                 = useState('');
  const [deviceId]                                      = useState(() => getDeviceId());
  const [emailConsent, setEmailConsent]                 = useState(false);
  const [streamingMsgId, setStreamingMsgId]             = useState<string | null>(null);
  const [streamingText, setStreamingText]               = useState('');
  const [deferredPrompt, setDeferredPrompt]             = useState<any>(null);
  const [installMethod, setInstallMethod]               = useState<'prompt' | 'manual_ios' | 'manual_android'>('manual_android');
  const [showInstallModal, setShowInstallModal]         = useState(false);
  const [canInstall, setCanInstall]                     = useState(false);

  const [showEmergency, setShowEmergency]               = useState(false);
  const [emergencySteps, setEmergencySteps]             = useState<string[]>([]);
  const [emergencyStep, setEmergencyStep]               = useState(0);
  const [emergencyTitle, setEmergencyTitle]             = useState('');
  const [emergencyWarning, setEmergencyWarning]         = useState('');

  const [showEndSessionModal, setShowEndSessionModal]   = useState(false);
  const [sessionContent, setSessionContent]             = useState('');
  // ── Phase 1 Voice Architecture ─────────────────────────────────────────
  const [toneAnalysis]                                  = useState(false); // disabled at launch — pipeline ready
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceWarningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSilenceCheck, setShowSilenceCheck]         = useState(false);
  const [emergencyShieldAuto, setEmergencyShieldAuto]   = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const photoInputRef    = useRef<HTMLInputElement>(null);
  const recognitionRef   = useRef<any>(null);
  const isRecordingRef   = useRef(false);
  const accumulatedRef   = useRef('');
  const inputTextRef     = useRef('');
  const typewriterRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamingTextRef = useRef('');
  const pendingAudioRef  = useRef<Promise<HTMLAudioElement | null> | null>(null);
  const hookCacheRef     = useRef<Record<string, string>>({});
  const hooksFetchedRef  = useRef(false);
  const rafScrollRef     = useRef<number | null>(null);
  const msgCountRef      = useRef(0);

  const handleSpeakingChange = useCallback((v: boolean) => setIsSpeaking(v), []);
  const aqm = useAudioQueueManager(isVoiceEnabled, handleSpeakingChange);
  const sentinel = useSentinel({ userEmail, deviceId });

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as any).standalone === true);
    if (isStandalone) return;
    const alreadySeen = localStorage.getItem('lylo_install_modal_seen');
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setInstallMethod('manual_ios'); setCanInstall(true); if (!alreadySeen) setShowInstallModal(true);
    } else {
      const h = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setInstallMethod('prompt'); setCanInstall(true); if (!alreadySeen) setShowInstallModal(true); };
      window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h);
    }
  }, []);

  const dismissInstallModal = () => { localStorage.setItem('lylo_install_modal_seen', 'true'); setShowInstallModal(false); };
  const handleInstallClick = async () => {
    dismissInstallModal();
    if (installMethod === 'prompt' && deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') setCanInstall(false); setDeferredPrompt(null); }
    else if (installMethod === 'manual_ios') alert('APPLE SECURE INSTALL:\n\n1. Tap the Share icon.\n2. Tap "Add to Home Screen".');
    else alert('ANDROID SECURE INSTALL:\n\n1. Tap the 3 dots in Chrome.\n2. Tap "Install app".');
  };

  useEffect(() => {
    const emailRaw = userEmail.toLowerCase();
    const storedName = localStorage.getItem('userName');
    const storedTier = localStorage.getItem('userTier') as any;
    if (storedName) setUserName(storedName); else if (emailRaw.includes('stangman')) setUserName('Christopher');
    if (!userTierProp && storedTier) setUserTier(storedTier);
    const savedBestie = localStorage.getItem('lylo_bestie_config'); if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
    const rawStyle = localStorage.getItem('lylo_communication_style');
    if (rawStyle) { const migrated = LEGACY_VIBE_MAP[rawStyle] ?? rawStyle; if (migrated !== rawStyle) localStorage.setItem('lylo_communication_style', migrated); setCommunicationStyle(migrated); }
    const savedFont = localStorage.getItem('lylo_font_level'); if (savedFont) setFontLevel(parseInt(savedFont, 10));
    const savedVoice = localStorage.getItem('lylo_voice_enabled'); if (savedVoice !== null) setIsVoiceEnabled(savedVoice === 'true');
    const savedMode = localStorage.getItem('lylo_reading_mode'); if (savedMode === 'sync' || savedMode === 'fast') setReadingMode(savedMode as any);
    if ('Notification' in window && Notification.permission === 'granted') setNotificationsEnabled(true);
    const savedIntake = localStorage.getItem(`lylo_intake_${emailRaw}`);
    if (savedIntake) { const parsed: Partial<IntakeProfile> = JSON.parse(savedIntake); setIntakeProfile(parsed); if (parsed.vibe) setCommunicationStyle(parsed.vibe); }
    const hasOnboarded = localStorage.getItem(`lylo_onboarded_${emailRaw}`);
    if (!hasOnboarded) { setShowOnboarding(true); setOnboardingRound(1); }
    else {
      const r2pending = localStorage.getItem(`lylo_round2_pending_${emailRaw}`);
      if (r2pending) setShowRound2Prompt(true);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail || hooksFetchedRef.current) return;
    hooksFetchedRef.current = true;
    const prefetchAll = async () => {
      await Promise.allSettled(PERSONAS.map(async persona => {
        try {
          const fd = new FormData(); fd.append('persona', persona.id); fd.append('user_email', userEmail);
          const res = await Promise.race([fetch(`${API_URL}/persona-hook`, { method: 'POST', body: fd }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]) as Response;
          if (res.ok) { const data = await res.json(); if (data.hook) hookCacheRef.current[persona.id] = data.hook; }
        } catch {}
      }));
    };
    const timer = setTimeout(prefetchAll, 800); return () => clearTimeout(timer);
  }, [userEmail]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; return ''; };
    const lock = () => window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href);
      if (showOnboarding) return;
      if (showDropdown) { setShowDropdown(false); return; }
      if (showCameraMenu) { setShowCameraMenu(false); return; }
      if (showCrisisShield) { setShowCrisisShield(false); return; }
      if (showEmergency) { setShowEmergency(false); return; }
      if (!showPersonaGrid) { handleInternalBack(); return; }
      alert('Use the Logout button to exit securely.');
    };
    window.addEventListener('beforeunload', onUnload); window.addEventListener('popstate', onPop); lock();
    return () => { window.removeEventListener('beforeunload', onUnload); window.removeEventListener('popstate', onPop); };
  }, [showPersonaGrid, showOnboarding, showDropdown, showCameraMenu, showCrisisShield, showEmergency]);

  useEffect(() => {
    const stopOnHide = () => { aqm.stop(); setIsSpeaking(false); };
    const onVisibility = () => { if (document.hidden) stopOnHide(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', stopOnHide);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', stopOnHide); };
  }, []);

  useEffect(() => {
    const newCount = messages.length;
    const isNewMsg = newCount > msgCountRef.current;
    msgCountRef.current = newCount;
    if ((isNewMsg || previewUrl) && chatContainerRef.current) {
      requestAnimationFrame(() => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; });
    }
  }, [messages, previewUrl]);

  useEffect(() => {
    const lastBot = [...messages].reverse().find(m => m.sender === 'bot');
    if (!lastBot || !(lastBot as any).actionTrigger) return;
    requestAnimationFrame(() => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; });
  }, [messages, streamingMsgId]);

  useEffect(() => {
    if (!streamingText || !chatContainerRef.current) return;
    const el = chatContainerRef.current;
    if (rafScrollRef.current !== null) cancelAnimationFrame(rafScrollRef.current);
    rafScrollRef.current = requestAnimationFrame(() => { scrollIfNearBottom(el, 150); rafScrollRef.current = null; });
    return () => { if (rafScrollRef.current !== null) { cancelAnimationFrame(rafScrollRef.current); rafScrollRef.current = null; } };
  }, [streamingText]);

  useEffect(() => {
    if (!selectedImage) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(selectedImage); setPreviewUrl(url); return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  const playAudioSafely = (audio: HTMLAudioElement) => {
    aqm.stop(); aqm.currentAudioRef.current = audio; setIsSpeaking(true);
    audio.onended = () => { aqm.currentAudioRef.current = null; setIsSpeaking(false); };
    audio.play().catch(e => { console.warn('[AUDIO] Blocked:', e); setIsSpeaking(false); });
  };

  const animateSynced = (text: string, msgId: string, audioEl: HTMLAudioElement | null) => {
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
    streamingTextRef.current = ''; setStreamingText(''); setStreamingMsgId(msgId);

    const startTyping = (msPerChar: number) => {
      let i = 0;
      typewriterRef.current = setInterval(() => {
        i++;
        const slice = text.slice(0, i);
        streamingTextRef.current = slice; setStreamingText(slice);
        if (i >= text.length) { clearInterval(typewriterRef.current!); typewriterRef.current = null; setStreamingMsgId(null); setStreamingText(''); }
      }, msPerChar);
    };

    if (audioEl && isVoiceEnabled) {
      const estimatedMs = Math.max(18, Math.min(45, (3500) / Math.max(text.length, 1)));
      startTyping(estimatedMs);
      audioEl.play().catch(() => {});
    } else {
      startTyping(readingMode === 'fast' ? 0 : 28);
    }
  };

  const buildRecognition = (): any => {
    const SR = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;
    if (!SR) return null;
    const rec = new SR(); rec.continuous = false; rec.interimResults = true; rec.lang = lang === 'es' ? 'es-US' : 'en-US';
    rec.onresult = (e: any) => {
      if (isSpeaking) return;
      let interim = '', final = '';
      for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript; }
      if (final) accumulatedRef.current += final + ' ';
      const full = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim(); setInput(full); inputTextRef.current = full;
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') { alert('Microphone blocked.'); isRecordingRef.current = false; setIsRecording(false); }
      else if (e.error === 'network') { isRecordingRef.current = false; setIsRecording(false); }
      else if (isRecordingRef.current) { setTimeout(() => { if (isRecordingRef.current) { recognitionRef.current = buildRecognition(); recognitionRef.current?.start(); } }, 150); }
    };
    rec.onend = () => { if (isRecordingRef.current && !isSpeaking) { recognitionRef.current = buildRecognition(); recognitionRef.current?.start(); } };
    return rec;
  };

  const handleWalkieTalkieMic = () => {
    if (isRecording) {
      isRecordingRef.current = false; setIsRecording(false);
      // ── Phase 1: user spoke — clear silence timers ──
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      if (silenceWarningRef.current) { clearTimeout(silenceWarningRef.current); silenceWarningRef.current = null; }
      setShowSilenceCheck(false); setEmergencyShieldAuto(false);
      try { recognitionRef.current?.stop(); } catch {} recognitionRef.current = null;
      setTimeout(() => { if (inputTextRef.current.trim()) handleSend(); }, 400);
    } else {
      if (isSpeaking) return;
      setIsRecording(true); isRecordingRef.current = true;
      setInput(''); accumulatedRef.current = ''; inputTextRef.current = '';
      recognitionRef.current = buildRecognition();
      if (!recognitionRef.current) { setIsRecording(false); isRecordingRef.current = false; return; }
      try { recognitionRef.current.start(); } catch { setIsRecording(false); isRecordingRef.current = false; recognitionRef.current = null; }
    }
  };

  const handleImageSelect = (file: File | null | undefined) => {
    if (!file) return;
    const MAX_DIM = 1024; const img = new window.Image(); const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
        else { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
      }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setSelectedImage(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { setSelectedImage(file); return; }
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        setSelectedImage(compressed);
      }, 'image/jpeg', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); setSelectedImage(file); }; img.src = objUrl;
  };

  const appendSessionContent = (content: string, sender: 'user' | 'bot') => {
    if (content.trim()) setSessionContent(prev => prev + (prev ? '\n' : '') + `[${sender.toUpperCase()}]: ${content}`);
  };

  const handleSend = async () => {
    const text = inputTextRef.current.trim() || input.trim();
    if (!text && !selectedImage) return;
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; setStreamingMsgId(null); }
    setLoading(true); setInput(''); inputTextRef.current = ''; accumulatedRef.current = ''; setShowPersonaGrid(false);
    // [FIX] Safety net: if loading never resolves, auto-reset after 20s so user isn't frozen
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setStreamingMsgId(null);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'bot' && last.content === '') {
          const errMsg = lang === 'es'
            ? '⚠️ La respuesta tardó demasiado. Por favor intenta de nuevo.'
            : '⚠️ The response took too long. Please try again.';
          return [...prev.slice(0, -1), { ...last, content: errMsg }];
        }
        return prev;
      });
    }, 20000);
    const imgPreview = previewUrl;
    const userMsg: Message = { id: Date.now().toString(), content: text || 'Analyzing image…', sender: 'user', timestamp: new Date(), imageUrl: imgPreview };
    setMessages(prev => [...prev, userMsg]);
    appendSessionContent(text || 'Analyzing image…', 'user');
    try {
      const botMsgId = `bot-${Date.now()}`;
      const voiceToUse = activePersona.id === 'bestie' ? (bestieConfig?.voiceId ?? 'nova') : (activePersona.fixedVoice ?? 'onyx');
      const fd = new FormData();
      fd.append('msg', text); fd.append('history', JSON.stringify(messages.slice(-6)));
      fd.append('persona', activePersona.id); fd.append('user_email', userEmail);
      fd.append('user_location', ''); fd.append('vibe', communicationStyle);
      fd.append('use_long_term_memory', 'true'); fd.append('device_id', deviceId);
      fd.append('email_consent', emailConsent ? 'true' : 'false'); fd.append('voice', voiceToUse);
      fd.append('lang', lang);
      fd.append('input_mode', isRecording ? 'voice' : 'text'); // Phase 1 voice architecture
      if (selectedImage) fd.append('file', selectedImage);
      const apiRes = await fetch(`${API_URL}/chat`, { method: 'POST', body: fd });
      if (!apiRes.ok) throw new Error('API error');
      setMessages(prev => [...prev, { id: botMsgId, content: '', sender: 'bot' as const, timestamp: new Date(), confidenceScore: 0, scamDetected: false, actionTrigger: null }]);
      if (readingMode === 'sync') setStreamingMsgId(botMsgId);
      setStreamingText(''); setLoading(false);
      aqm.stop();
      // ── Phase 1: clear any previous silence timers when new response starts ──
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      if (silenceWarningRef.current) { clearTimeout(silenceWarningRef.current); silenceWarningRef.current = null; }
      setShowSilenceCheck(false); setEmergencyShieldAuto(false);
      const reader = apiRes.body!.getReader(); const decoder = new TextDecoder();
      let buffer = ''; let fullAnswer = ''; let metaData: any = null;
      outer: while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim(); if (!raw) continue;
          let parsed: any; try { parsed = JSON.parse(raw); } catch { continue; }
          if (parsed.type === 'text') {
            fullAnswer += (fullAnswer ? ' ' : '') + parsed.content;
            if (readingMode === 'sync') setStreamingText(fullAnswer);
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: fullAnswer } : m));
            if (isVoiceEnabled) aqm.push(parsed.content, voiceToUse, parsed.audio_b64 ?? undefined);
          } else if (parsed.type === 'meta') { metaData = parsed; if (parsed.full_answer) fullAnswer = parsed.full_answer; break outer; }
        }
      }
      const finalText = fullAnswer.trim();
      appendSessionContent(finalText, 'bot');
      // ── Phase 1 Silence Detection — only in voice mode on emergency personas ──
      const _isVoiceMode = isRecording || isRecordingRef.current;
      const _isEmergencyPersona = ['guardian','doctor','lawyer','wealth','mechanic'].includes(activePersona.id);
      const _isHighStakes = metaData?.threat_level === 'high' || metaData?.emergency;
      if (_isVoiceMode && _isEmergencyPersona && _isHighStakes) {
        // 15 seconds — give them time to physically do the action
        silenceTimerRef.current = setTimeout(() => {
          setShowSilenceCheck(true); // show soft check "I'm still here"
          // 5 more seconds then surface emergency shield
          silenceWarningRef.current = setTimeout(() => {
            setShowSilenceCheck(false);
            setEmergencyShieldAuto(true);
            setShowCrisisShield(true); // surface the shield
          }, 5000);
        }, 15000);
      }
      const isLockout = metaData?.threat_level === 'high' && finalText.includes('DEVICE LIMIT EXCEEDED');
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: finalText, confidenceScore: metaData?.confidence_score ?? 0, scamDetected: metaData?.scam_detected ?? false, actionTrigger: metaData?.action_trigger ?? null } : m));

      if (metaData?.emergency && metaData?.persona_switched && metaData?.switched_persona) {
        const emergencyPersona = PERSONAS.find(p => p.id === metaData.switched_persona);
        if (emergencyPersona) { setActivePersona(emergencyPersona); localStorage.setItem('lylo_selected_persona', emergencyPersona.id); onPersonaChange(emergencyPersona); }
      }

      if (metaData?.emergency && metaData?.emergency_steps?.length) {
        setEmergencySteps(metaData.emergency_steps);
        setEmergencyStep(0);
        setEmergencyTitle(metaData.emergency_title || 'EMERGENCY PROTOCOL');
        setEmergencyWarning(metaData.emergency_warning || '');
        setShowEmergency(true);
      }

      setStreamingMsgId(null); setStreamingText('');
      if (isLockout) { aqm.stop(); return; }
    } catch (e) {
      console.error('[SEND] Error:', e); setStreamingMsgId(null); setLoading(false);
      if (loadingTimeoutRef.current) { clearTimeout(loadingTimeoutRef.current); loadingTimeoutRef.current = null; }
      // [FIX] Show visible error to user instead of silent freeze
      const errText = lang === 'es'
        ? '⚠️ Algo salió mal. Por favor intenta de nuevo.'
        : '⚠️ Something went wrong. Please try again — tap the mic or type your question.';
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'bot' && last.content === '') {
          return [...prev.slice(0, -1), { ...last, content: errText }];
        }
        return [...prev, { id: `err-${Date.now()}`, content: errText, sender: 'bot' as const, timestamp: new Date() }];
      });
    } finally {
      setSelectedImage(null); setEmailConsent(false);
      sentinel.onEngagement();
    }
  };

  const getPersonaHook = async (persona: PersonaConfig): Promise<string> => {
    if (hookCacheRef.current[persona.id]) { const hook = hookCacheRef.current[persona.id]; delete hookCacheRef.current[persona.id]; return hook; }
    try {
      const fd = new FormData(); fd.append('persona', persona.id); fd.append('user_email', userEmail);
      const res = await Promise.race([fetch(`${API_URL}/persona-hook`, { method: 'POST', body: fd }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500))]) as Response;
      if (!res.ok) throw new Error('failed');
      const data = await res.json(); return data.hook || persona.spokenHook;
    } catch { return persona.spokenHook; }
  };

  const handlePersonaChange = async (persona: PersonaConfig) => {
    if (persona.id === 'bestie' && !bestieConfig) { setShowBestieSetup(true); return; }
    aqm.stop();
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; setStreamingMsgId(null); }
    setActivePersona(persona); localStorage.setItem('lylo_selected_persona', persona.id); onPersonaChange(persona); setShowDropdown(false); setShowPersonaGrid(false); setLoading(true);
    const voiceToUse = persona.id === 'bestie' ? (bestieConfig?.voiceId ?? 'nova') : (persona.fixedVoice ?? 'onyx');
    const hookText = await getPersonaHook(persona); const hookMsgId = `hook-${Date.now()}`;
    if (readingMode === 'sync' && isVoiceEnabled) { setStreamingMsgId(hookMsgId); setStreamingText(''); }
    setMessages([{ id: hookMsgId, content: hookText, sender: 'bot' as const, timestamp: new Date() }]); setLoading(false);
    if (isVoiceEnabled) {
      if (readingMode === 'fast') { setStreamingMsgId(null); await aqm.enqueue(hookText, voiceToUse); }
      else {
        try {
          const fd = new FormData(); fd.append('text', hookText); fd.append('voice', voiceToUse);
          const res = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: fd }); const data = await res.json();
          if (data.audio_b64) { const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`); audio.preload = 'auto'; animateSynced(hookText, hookMsgId, audio); }
          else animateSynced(hookText, hookMsgId, null);
        } catch { animateSynced(hookText, hookMsgId, null); }
      }
    }
  };

  const handleBestieSetupComplete = (voiceId: string) => {
    const cfg: BestieConfig = { gender: tempGender, voiceId, vibeLabel: tempGender === 'male' ? 'The Bro' : 'The Bestie' };
    setBestieConfig(cfg); localStorage.setItem('lylo_bestie_config', JSON.stringify(cfg)); setShowBestieSetup(false);
    const bp = PERSONAS.find(p => p.id === 'bestie'); if (bp) handlePersonaChange(bp);
  };

  const handleInternalBack = () => { setMessages([]); setShowPersonaGrid(true); setSessionContent(''); aqm.stop(); setIsSpeaking(false); };
  const cycleFontSize = () => { const next = fontLevel >= 4 ? 1 : fontLevel + 1; setFontLevel(next); localStorage.setItem('lylo_font_level', String(next)); };
  const bailoutTypewriter = () => { if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; } setStreamingMsgId(null); setStreamingText(''); };

  // [V31.2-2] Bell toast helper
  const showBellToastMsg = (msg: string) => {
    setBellToast(msg);
    setTimeout(() => setBellToast(''), 3000);
  };

  const requestMobileAlerts = async () => {
    if (!('Notification' in window)) {
      showBellToastMsg('Notifications not supported on this browser');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      showBellToastMsg('🛡️ Alerts already active!');
      return;
    }
    if (Notification.permission === 'denied') {
      showBellToastMsg('⚠️ Blocked — enable in browser settings');
      return;
    }
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      setNotificationsEnabled(true);
      showBellToastMsg('🔔 Alerts activated!');
      new Notification('LYLO Alerts Active 🛡️', { body: 'Mission reminders enabled.', icon: '/logo.png' });
      sentinel.onPermissionGranted();
    } else {
      setNotificationsEnabled(false);
      showBellToastMsg('Alerts turned off');
    }
  };

  const scheduleMobileReminder = (msg: string, minutes = 30) => {
    if (!notificationsEnabled || Notification.permission !== 'granted') {
      requestMobileAlerts().then(() => { if (Notification.permission === 'granted') setTimeout(() => new Notification('⏰ LYLO Reminder', { body: msg, icon: '/logo.png' }), minutes * 60000); });
      return;
    }
    setTimeout(() => new Notification('⏰ LYLO Reminder', { body: msg, icon: '/logo.png' }), minutes * 60000);
    new Notification(`✅ Reminder Set — ${minutes} min`, { body: `"${msg.slice(0, 80)}..."`, icon: '/logo.png' });
  };

  const handleEndSession = () => { setShowDropdown(false); setShowEndSessionModal(true); };

  const sendSessionReport = async () => {
    setShowEndSessionModal(false);
    if (!sessionContent.trim()) { setSessionContent(''); return; }
    try {
      const fd = new FormData();
      fd.append('user_email', userEmail); fd.append('persona', activePersona.id);
      fd.append('content', sessionContent); fd.append('user_name', userName);
      await fetch(`${API_URL}/send-session-report`, { method: 'POST', body: fd });
    } catch (e) { console.warn('[PDF] send failed:', e); }
    setSessionContent('');
  };

  const handleEmailDispatch = async (content: string) => {
    try {
      const fd = new FormData(); fd.append('user_email', userEmail); fd.append('content', content); fd.append('persona', activePersona.id);
      const res = await fetch(`${API_URL}/dispatch-email`, { method: 'POST', body: fd }); if (res.ok) { alert('🛡️ Tactical Report dispatched.'); return; }
    } catch {}
    window.open(`mailto:${userEmail}?subject=${encodeURIComponent(`LYLO Report — ${activePersona.name}`)}&body=${encodeURIComponent(content)}`, '_blank');
  };

  const toggleVoice = () => { const next = !isVoiceEnabled; setIsVoiceEnabled(next); localStorage.setItem('lylo_voice_enabled', String(next)); if (!next) { aqm.stop(); setIsSpeaking(false); } };
  const handleVibeChange = (v: string) => { setCommunicationStyle(v); localStorage.setItem('lylo_communication_style', v); };

  const saveIntakeAnswer = async (questionId: string, value: string) => {
    const updated = { ...intakeProfile, [questionId]: value }; setIntakeProfile(updated);
    localStorage.setItem(`lylo_intake_${userEmail.toLowerCase()}`, JSON.stringify(updated));
    if (questionId === 'vibe') { setCommunicationStyle(value); localStorage.setItem('lylo_communication_style', value); }
    try {
      const fd = new FormData(); fd.append('user_email', userEmail); fd.append('question_id', questionId); fd.append('value', value); fd.append('full_profile', JSON.stringify(updated));
      fetch(`${API_URL}/user-intake`, { method: 'POST', body: fd }).catch(() => {});
    } catch {}
  };

  const completeRound1 = () => {
    localStorage.setItem(`lylo_onboarded_${userEmail.toLowerCase()}`, 'true');
    localStorage.setItem(`lylo_round2_pending_${userEmail.toLowerCase()}`, 'true');
    setShowOnboarding(false);
  };

  const completeRound2 = () => {
    localStorage.removeItem(`lylo_round2_pending_${userEmail.toLowerCase()}`);
    setShowOnboarding(false); setShowRound2Prompt(false);
  };

  const getDynamicFontSize = () => { switch (fontLevel) { case 2: return 'text-lg leading-relaxed'; case 3: return 'text-2xl leading-relaxed tracking-wide'; case 4: return 'text-4xl leading-loose tracking-wide font-black'; default: return 'text-sm leading-normal'; } };
  const getInputFontSize = () => { switch (fontLevel) { case 2: return 'text-lg'; case 3: return 'text-xl'; case 4: return 'text-2xl'; default: return 'text-sm'; } };

  // ==========================================================================
  // ONBOARDING
  // ==========================================================================
  if (showOnboarding) {
    const questions = onboardingRound === 1 ? INTAKE_QUESTIONS_R1 : INTAKE_QUESTIONS_R2;
    const TOTAL = questions.length;
    const isQ = onboardingStep >= 1 && onboardingStep <= TOTAL;
    const currentQ = isQ ? questions[onboardingStep - 1] : null;
    const progress = onboardingStep === 0 ? 0 : Math.round((onboardingStep / (TOTAL + 1)) * 100);
    const qScheme = currentQ ? (COLOR_MAP[currentQ.accentColor] ?? COLOR_MAP.blue) : COLOR_MAP.blue;
    const qCurrent = currentQ ? intakeProfile[currentQ.id as keyof IntakeProfile] : undefined;
    const roundLabel = onboardingRound === 1 ? t('q_round1') : t('q_round2');

    return (
      <div className="fixed inset-0 bg-[#080808] flex flex-col items-center justify-center p-4 z-[999999] overflow-y-auto">
        <button onClick={toggleLang} className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-xs font-bold hover:bg-white/10 transition-all">
          <Globe className="w-3.5 h-3.5" /> {t('lang_toggle')}
        </button>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/5 blur-[120px]" />
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="w-full h-[2px] bg-white/5 rounded-full mb-7 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out rounded-full" style={{ width: `${progress}%` }} />
          </div>

          {onboardingStep === 0 && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.12)]"><Shield className="w-10 h-10 text-blue-400" /></div>
                <h1 className="text-white font-black text-3xl uppercase tracking-[0.15em] leading-none mb-2">L<span className="text-blue-400">Y</span>LO OS</h1>
                <p className="text-blue-400/60 text-xs font-bold uppercase tracking-[0.3em]">Security Clearance Granted</p>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  { icon: Brain, color: 'text-purple-400', label: 'Triple Engine AI', desc: 'OpenAI + Gemini + Claude race simultaneously. Fastest, most accurate answer wins.' },
                  { icon: CheckCircle, color: 'text-green-400', label: 'Truth Protocol', desc: 'LYLO will not fabricate. Tactical truth or we ask for more intel.' },
                  { icon: Lock, color: 'text-blue-400', label: 'Ironclad Privacy', desc: 'Cryptographically hashed. Never sold. Never used to train public AI.' },
                  { icon: Users, color: 'text-orange-400', label: '12-Seat Council', desc: 'Legal. Medical. Financial. Spiritual. One OS. Auto-switches in emergencies.' },
                ].map(({ icon: Icon, color, label, desc }) => (
                  <div key={label} className="flex items-start gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                    <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                    <div><p className="text-white font-bold text-sm leading-none mb-1">{label}</p><p className="text-gray-500 text-xs leading-relaxed">{desc}</p></div>
                  </div>
                ))}
              </div>
              <button onClick={() => setOnboardingStep(1)} className="w-full py-5 bg-blue-600 text-white font-black uppercase rounded-2xl tracking-[0.15em] flex justify-center items-center gap-3 hover:bg-blue-500 transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(59,130,246,0.25)]">Build My Profile <ArrowRight className="w-5 h-5" /></button>
              <p className="text-center text-gray-600 text-xs mt-4 uppercase tracking-widest font-bold">5 questions · 30 seconds</p>
            </div>
          )}

          {isQ && currentQ && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <span className={`text-xs font-black uppercase tracking-[0.2em] ${qScheme.text}`}>{roundLabel} {onboardingStep} of {TOTAL}</span>
              <h2 className="text-white font-black text-2xl leading-tight mt-1 mb-1">{currentQ.question}</h2>
              {'subtitle' in currentQ && currentQ.subtitle && <p className="text-gray-500 text-xs mb-6 leading-relaxed">{currentQ.subtitle}</p>}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {currentQ.options.map(opt => {
                  const isSelected = qCurrent === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={async () => {
                        await saveIntakeAnswer(currentQ.id, opt.value);
                        setCustomAnswer('');
                        setTimeout(() => {
                          if (onboardingStep < TOTAL) setOnboardingStep(s => s + 1);
                          else if (onboardingRound === 1) completeRound1();
                          else completeRound2();
                        }, 180);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all duration-100 active:scale-[0.96] ${isSelected ? qScheme.selected : `bg-white/[0.03] border-white/[0.08] ${qScheme.ring}`}`}
                    >
                      <div className="text-xl mb-2 leading-none">{opt.emoji}</div>
                      <div className="text-white font-bold text-xs leading-snug">{opt.label}</div>
                    </button>
                  );
                })}
              </div>

              {'allowCustom' in currentQ && currentQ.allowCustom && (
                <div className="flex gap-2 mb-4">
                  <input
                    value={customAnswer}
                    onChange={e => setCustomAnswer(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && customAnswer.trim()) {
                        await saveIntakeAnswer(currentQ.id, customAnswer.trim());
                        setCustomAnswer('');
                        if (onboardingStep < TOTAL) setOnboardingStep(s => s + 1);
                        else if (onboardingRound === 1) completeRound1();
                        else completeRound2();
                      }
                    }}
                    placeholder={'customPlaceholder' in currentQ ? currentQ.customPlaceholder : t('custom_answer')}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-gray-600"
                  />
                  <button
                    onClick={async () => {
                      if (!customAnswer.trim()) return;
                      await saveIntakeAnswer(currentQ.id, customAnswer.trim());
                      setCustomAnswer('');
                      if (onboardingStep < TOTAL) setOnboardingStep(s => s + 1);
                      else if (onboardingRound === 1) completeRound1();
                      else completeRound2();
                    }}
                    className="px-4 py-3 bg-blue-600 rounded-xl text-white font-bold text-sm hover:bg-blue-500 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                {onboardingStep > 1 && (
                  <button onClick={() => { setOnboardingStep(s => s - 1); setCustomAnswer(''); }} className="px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold text-sm flex items-center gap-2 hover:bg-white/10 transition-all"><ChevronLeft className="w-4 h-4" /> {t('back')}</button>
                )}
                <button
                  onClick={() => {
                    setCustomAnswer('');
                    if (onboardingStep < TOTAL) setOnboardingStep(s => s + 1);
                    else if (onboardingRound === 1) completeRound1();
                    else completeRound2();
                  }}
                  className="flex-1 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  {t('skip')} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // INSTALL MODAL
  // ==========================================================================
  const InstallModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999998] flex items-end justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#111] border border-blue-500/40 rounded-3xl w-full max-w-sm p-6 mb-4 shadow-[0_0_60px_rgba(59,130,246,0.2)] animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 mb-5">
          <div className="p-3 bg-blue-600 rounded-2xl"><Shield className="w-7 h-7 text-white" /></div>
          <div><h2 className="text-white font-black text-lg uppercase tracking-widest leading-none">Install LYLO OS</h2><p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mt-1">Add to Home Screen</p></div>
        </div>
        <p className="text-gray-300 text-sm mb-6 leading-relaxed">Install for instant access, offline mode, and the full bodyguard experience — no browser needed.</p>
        <div className="flex gap-3">
          <button onClick={handleInstallClick} className="flex-1 py-4 bg-blue-600 text-white font-black uppercase rounded-xl tracking-widest text-sm hover:bg-blue-500 transition-all">Install Now</button>
          <button onClick={dismissInstallModal} className="py-4 px-5 bg-white/5 text-gray-400 font-bold rounded-xl text-sm hover:bg-white/10 transition-all">Later</button>
        </div>
        <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-widest">Find this again in the menu ☰</p>
      </div>
    </div>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  return (
    <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans z-[99999]">
      {showInstallModal && <InstallModal />}

      {/* SILENCE CHECK — Phase 1 "I'm still here" soft prompt */}
      {showSilenceCheck && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200001] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-[#111] border border-yellow-500/50 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(234,179,8,0.2)]">
            <div className="text-5xl mb-4">🛡️</div>
            <h2 className="text-white font-black text-xl mb-3 leading-tight">
              {lang === 'es' ? 'Aquí sigo contigo.' : "I'm still here."}
            </h2>
            <p className="text-yellow-400 font-bold text-sm mb-6">
              {lang === 'es' ? 'Di cualquier cosa para que sepa que estás bien.' : "Say anything so I know you're okay."}
            </p>
            <button
              onClick={() => {
                setShowSilenceCheck(false);
                if (silenceWarningRef.current) { clearTimeout(silenceWarningRef.current); silenceWarningRef.current = null; }
              }}
              className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl uppercase tracking-widest text-sm hover:bg-yellow-400 transition-all active:scale-95"
            >
              {lang === 'es' ? 'Estoy Bien' : "I'm Okay"}
            </button>
          </div>
        </div>
      )}

      {/* [V31.2-2] BELL TOAST */}
      {bellToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200000] animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none">
          <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-sm shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center gap-2 whitespace-nowrap">
            <Bell className="w-4 h-4" /> {bellToast}
          </div>
        </div>
      )}

      {/* EMERGENCY STEP-BY-STEP OVERLAY */}
      {showEmergency && emergencySteps.length > 0 && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100010] p-4">
          <div className="bg-[#0a0a0a] border border-red-500 rounded-2xl max-w-md w-full p-6 shadow-[0_0_60px_rgba(239,68,68,0.2)]">
            <div className="text-red-400 font-bold text-[10px] tracking-widest uppercase mb-1">🚨 Emergency Protocol</div>
            <h2 className="text-white font-black text-xl mb-4 leading-tight">{emergencyTitle}</h2>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-2">
              <span className="text-[#39FF14]">Step {emergencyStep + 1}</span>
              <span>{t('step_of')} {emergencySteps.length}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 mb-5 overflow-hidden">
              <div className="bg-red-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${((emergencyStep + 1) / emergencySteps.length) * 100}%` }} />
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-5">
              <div className="text-red-400 font-black text-xs uppercase tracking-widest mb-2">STEP {emergencyStep + 1}</div>
              <p className="text-white text-base leading-relaxed font-semibold">{emergencySteps[emergencyStep]}</p>
            </div>
            {emergencyStep === emergencySteps.length - 1 && emergencyWarning && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-5">
                <p className="text-yellow-400 text-sm font-semibold">⚠️ {emergencyWarning}</p>
              </div>
            )}
            {emergencyStep < emergencySteps.length - 1 ? (
              <button onClick={() => setEmergencyStep(s => s + 1)} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-base transition-all active:scale-95">
                ✅ {t('emerg_next')}
              </button>
            ) : (
              <button onClick={() => setShowEmergency(false)} className="w-full py-4 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-black rounded-xl text-base transition-all active:scale-95">
                {t('emerg_done')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* END SESSION PDF MODAL */}
      {showEndSessionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100009] p-4">
          <div className="bg-[#0a0a0a] border border-[#39FF14]/30 rounded-2xl max-w-sm w-full p-6 shadow-[0_0_40px_rgba(57,255,20,0.1)]">
            <h3 className="text-white font-black text-lg mb-2">📄 {t('send_report')}</h3>
            <p className="text-gray-400 text-sm mb-6">{t('report_prompt')}</p>
            <div className="flex gap-3">
              <button onClick={sendSessionReport} className="flex-1 py-3 bg-[#39FF14] text-black font-black rounded-xl text-sm hover:bg-[#39FF14]/90 transition-all active:scale-95">{t('report_yes')}</button>
              <button onClick={() => { setShowEndSessionModal(false); setSessionContent(''); }} className="flex-1 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl text-sm hover:bg-gray-700 transition-all active:scale-95">{t('report_no')}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="bg-black/90 border-b border-white/10 p-3 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="relative flex items-center gap-2 z-10">
            {!showPersonaGrid && (<button onClick={handleInternalBack} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors"><ChevronLeft className="w-5 h-5" /></button>)}
            {showPersonaGrid && (
              <div className="flex flex-col justify-center ml-1">
                <p className="text-white font-black text-[11px] uppercase leading-none truncate max-w-[90px]">{userName}</p>
                <p className="text-[8px] text-green-500 font-black mt-[3px] uppercase tracking-widest">{userTier}</p>
              </div>
            )}
          </div>

          <div className="text-center absolute left-1/2 -translate-x-1/2 w-1/3">
            <h1 className="text-white font-black text-2xl tracking-[0.2em] leading-none">L<span className={getColor(activePersona.color, 'text')}>Y</span>LO</h1>
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.3em] mt-1 truncate">{activePersona.serviceLabel}</p>
          </div>

          <div className="flex items-center gap-2 z-10">
            {/* [V31.2-3] Spanish toggle — gold highlight when ES active */}
            <button
              onClick={toggleLang}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                lang === 'es'
                  ? 'bg-yellow-500 border-yellow-400 text-black shadow-[0_0_12px_rgba(234,179,8,0.4)]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {lang === 'en' ? '🇲🇽 ES' : '🇺🇸 EN'}
            </button>
            <button onClick={requestMobileAlerts} title={notificationsEnabled ? 'Alerts Active' : 'Enable Alerts'} className={`p-3 rounded-xl transition-all ${notificationsEnabled ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500 hover:text-white' : 'bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10 hover:text-white'}`}><Bell className="w-5 h-5" /></button>
            <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse hover:bg-red-500 hover:text-white transition-all"><Shield className="w-5 h-5 fill-current" /></button>
          </div>
        </div>
      </div>

      {/* Round 2 gentle reminder banner */}
      {showRound2Prompt && !showPersonaGrid && (
        <div className="mx-3 mt-2 p-3 bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-xl flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[#39FF14] text-xs font-black">{t('complete_profile')}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{t('profile_prompt')}</p>
          </div>
          <div className="flex gap-2 ml-3">
            <button onClick={() => { setOnboardingRound(2); setOnboardingStep(1); setShowRound2Prompt(false); setShowOnboarding(true); }} className="px-3 py-1.5 bg-[#39FF14] text-black text-[10px] font-black rounded-lg whitespace-nowrap">{t('profile_cta')}</button>
            <button onClick={() => setShowRound2Prompt(false)} className="px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px] font-bold rounded-lg">{t('profile_skip')}</button>
          </div>
        </div>
      )}

      {/* CRISIS SHIELD */}
      {showCrisisShield && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100002] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-red-500/50 rounded-3xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3"><Shield className="w-8 h-8 text-red-500 fill-current" /><div><h2 className="text-white font-black text-xl uppercase tracking-widest">Emergency Hub</h2><p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-1">Direct Federal & Professional Links</p></div></div>
              <button onClick={() => setShowCrisisShield(false)} className="p-2 bg-white/5 rounded-full text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-3 mb-6">
              {(CRISIS_LINKS[activePersona.id] || []).map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="block p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-center mb-1"><span className="text-white font-bold">{link.label}</span><ExternalLink className="w-4 h-4 text-gray-400" /></div>
                  <p className="text-xs text-gray-400">{link.description}</p>
                </a>
              ))}
            </div>
            <button onClick={() => setShowCrisisShield(false)} className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-xl tracking-widest">Return to OS</button>
          </div>
        </div>
      )}

      {/* BESTIE SETUP */}
      {showBestieSetup && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100005] flex items-center justify-center p-4">
          <div className="bg-pink-900/20 border border-pink-500/30 rounded-3xl w-full max-w-sm p-6 shadow-[0_0_50px_rgba(236,72,153,0.15)] text-center">
            <Heart className="w-12 h-12 text-pink-400 mx-auto mb-4 fill-current" />
            <h2 className="text-white font-black text-2xl uppercase tracking-widest mb-2">Build Your Bestie</h2>
            <p className="text-gray-400 text-sm mb-6">Who do you want in your corner?</p>
            {setupStep === 'gender' && (<div className="space-y-4"><button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 hover:border-pink-400 rounded-2xl text-white font-bold transition-all">The Girls (Female)</button><button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 hover:border-blue-400 rounded-2xl text-white font-bold transition-all">The Bros (Male)</button></div>)}
            {setupStep === 'voice' && tempGender === 'female' && (<div className="space-y-3"><p className="text-xs text-pink-300 uppercase tracking-widest font-bold mb-2">Select Her Voice</p><button onClick={() => handleBestieSetupComplete('nova')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Nova (Warm & Upbeat)</button><button onClick={() => handleBestieSetupComplete('shimmer')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Shimmer (Clear & Direct)</button><button onClick={() => handleBestieSetupComplete('alloy')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Alloy (Neutral & Calm)</button></div>)}
            {setupStep === 'voice' && tempGender === 'male' && (<div className="space-y-3"><p className="text-xs text-blue-300 uppercase tracking-widest font-bold mb-2">Select His Voice</p><button onClick={() => handleBestieSetupComplete('onyx')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Onyx (Deep & Serious)</button><button onClick={() => handleBestieSetupComplete('echo')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Echo (Warm & Friendly)</button><button onClick={() => handleBestieSetupComplete('fable')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Fable (Expressive & British)</button></div>)}
            <button onClick={() => { setShowBestieSetup(false); setSetupStep('gender'); }} className="mt-6 text-gray-500 text-xs font-bold uppercase">Cancel</button>
          </div>
        </div>
      )}

      {/* CHAT AREA */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto relative p-4 space-y-6"
        style={{ paddingBottom: previewUrl ? '420px' : '320px', overflowAnchor: 'auto' }}
      >
        {showPersonaGrid && (
          <div className="grid grid-cols-2 gap-3">
            {PERSONAS.map(p => (
              <button key={p.id} onClick={() => handlePersonaChange(p)} className={`p-6 rounded-3xl border flex flex-col items-center gap-3 transition-all ${activePersona.id === p.id ? `${getColor(p.color, 'bg')} border-transparent` : 'bg-white/5 border-white/10 hover:bg-white/8'}`}>
                <p.icon className={`w-8 h-8 ${activePersona.id === p.id ? 'text-white' : getColor(p.color, 'text')}`} />
                <span className="text-[10px] text-white font-black uppercase tracking-widest block leading-tight text-center">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.imageUrl && (
              <div className="mb-2 max-w-[85%] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                <img src={msg.imageUrl} alt="Uploaded" className="w-full h-auto object-cover max-h-[300px]" />
              </div>
            )}
            <div className={`p-5 rounded-3xl max-w-[85%] ${getDynamicFontSize()} shadow-lg ${msg.sender === 'user' ? `${getColor(activePersona.color, 'bg')} text-white font-bold rounded-tr-none` : 'bg-white/10 text-gray-100 border border-white/10 rounded-tl-none'}`}>
              {msg.sender === 'bot' && msg.id === streamingMsgId
                ? <span>{streamingText}<span className="inline-block w-[2px] h-[1em] bg-current ml-[1px] align-middle animate-pulse opacity-70" /></span>
                : msg.content
              }
              {msg.sender === 'bot' && (msg.confidenceScore ?? 0) > 0 && msg.id !== streamingMsgId && (() => {
                const score = msg.confidenceScore ?? 0;
                const tier = score >= 80 ? 'high' : score >= 60 ? 'moderate' : 'low';
                const tierLabel = tier === 'high' ? (lang === 'es' ? 'Alta Confianza' : 'High Confidence') : tier === 'moderate' ? (lang === 'es' ? 'Confianza Moderada' : 'Moderate Confidence') : (lang === 'es' ? 'Baja Confianza' : 'Low Confidence');
                const tierColor = tier === 'high' ? 'text-green-400' : tier === 'moderate' ? 'text-yellow-400' : 'text-red-400';
                const barColor  = tier === 'high' ? 'bg-green-500' : tier === 'moderate' ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-gray-500">Veracore™</span>
                        <span className={tierColor}>· {tierLabel}</span>
                      </span>
                      <span className={tierColor}>{score}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${barColor}`} style={{ width: `${score}%` }} /></div>
                  </div>
                );
              })()}
            </div>
            {msg.sender === 'bot' && (msg as any).actionTrigger && (
              <div className="mt-3 mb-3 w-full max-w-[85%] space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {(msg as any).actionTrigger === 'email_dispatch' && (
                  <button onClick={() => handleEmailDispatch(msg.content)} className="w-full py-4 px-6 bg-gradient-to-r from-indigo-700 to-indigo-600 border border-indigo-400/50 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(99,102,241,0.35)] hover:from-indigo-600 hover:to-indigo-500 transition-all active:scale-[0.98]"><Shield className="w-4 h-4 fill-current flex-shrink-0" /> Dispatch Tactical Report to Email</button>
                )}
                {(msg as any).actionTrigger === 'set_reminder' && (
                  <button onClick={() => scheduleMobileReminder(msg.content.length > 120 ? msg.content.slice(0, 120) + '…' : msg.content)} className="w-full py-4 px-6 bg-gradient-to-r from-violet-700 to-violet-600 border border-violet-400/50 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(139,92,246,0.35)] hover:from-violet-600 hover:to-violet-500 transition-all active:scale-[0.98]"><Bell className="w-4 h-4 flex-shrink-0" /> Set Mobile Reminder — 30 Min</button>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 rounded-tl-none flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest animate-pulse">
                {lang === 'es' ? 'Veracore™ procesando...' : 'Veracore™ processing...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 p-4 z-[100] pb-10">
        {previewUrl && (
          <div className="absolute bottom-[100%] left-0 right-0 flex flex-col items-center pb-4 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-3 w-full max-w-md px-4">
              <div className="flex items-center justify-between bg-indigo-900/90 backdrop-blur-xl border border-indigo-500/50 p-3 rounded-xl w-full shadow-[0_0_30px_rgba(79,70,229,0.3)] animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-400" /><span className="text-[10px] text-white font-black uppercase tracking-widest">Send Copy to Email?</span></div>
                <button onClick={() => setEmailConsent(!emailConsent)} className={`w-10 h-5 rounded-full transition-all relative ${emailConsent ? 'bg-green-500' : 'bg-gray-600'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${emailConsent ? 'right-1' : 'left-1'}`} /></button>
              </div>
              <div className="relative animate-in slide-in-from-bottom-2">
                <img src={previewUrl} className="w-24 h-24 object-cover rounded-2xl border-2 border-indigo-500 shadow-2xl" alt="Preview" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-400 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-md mx-auto space-y-3">
          <div className="flex gap-2">
            <button onClick={handleWalkieTalkieMic} disabled={loading} className={`flex-1 py-5 rounded-[28px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.97] ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-white text-black hover:bg-gray-100'} ${loading ? 'opacity-40 cursor-not-allowed' : ''}`}>
              {isRecording ? <><MicOff className="w-5 h-5" /> Tap to Send</> : <><Mic className="w-5 h-5" /> Hold to Speak</>}
            </button>
            <button
              onClick={async () => {
                if (streamingMsgId) { bailoutTypewriter(); if (pendingAudioRef.current && isVoiceEnabled) { const audio = await pendingAudioRef.current; pendingAudioRef.current = null; if (audio) playAudioSafely(audio); } }
                const next = readingMode === 'sync' ? 'fast' : 'sync'; setReadingMode(next); localStorage.setItem('lylo_reading_mode', next);
              }}
              className="px-4 py-5 rounded-[28px] flex flex-col items-center justify-center gap-0.5 font-black text-[9px] uppercase tracking-widest transition-all active:scale-[0.97] bg-white/10 border border-white/10 hover:bg-white/15 min-w-[56px]"
            >
              {readingMode === 'sync' ? <><Type className="w-4 h-4 text-indigo-400" /><span className="text-indigo-400">Sync</span></> : <><Zap className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400">Fast</span></>}
            </button>
            <button onClick={() => { if (streamingMsgId) bailoutTypewriter(); toggleVoice(); }} className={`px-4 py-5 rounded-[28px] flex flex-col items-center justify-center gap-0.5 font-black text-[9px] uppercase tracking-widest transition-all active:scale-[0.97] min-w-[56px] ${isVoiceEnabled ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-white/10 text-gray-400 border border-white/10'}`}>
              {isVoiceEnabled ? <><Volume2 className="w-4 h-4" /><span>On</span></> : <><VolumeX className="w-4 h-4" /><span>Off</span></>}
            </button>
            {/* [V31.2-1] FONT SIZE BUTTON */}
            <button
              onClick={cycleFontSize}
              className={`px-4 py-5 rounded-[28px] flex flex-col items-center justify-center gap-0.5 font-black text-[9px] uppercase tracking-widest transition-all active:scale-[0.97] min-w-[56px] border ${
                fontLevel === 1 ? 'bg-white/10 border-white/10 text-gray-400'
                : fontLevel === 2 ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                : fontLevel === 3 ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                : 'bg-orange-500/20 border-orange-500/40 text-orange-400'
              }`}
            >
              <span className={`leading-none font-black ${fontLevel === 1 ? 'text-sm' : fontLevel === 2 ? 'text-base' : fontLevel === 3 ? 'text-lg' : 'text-xl'}`}>Aa</span>
              <span>{fontLevel === 1 ? 'Sm' : fontLevel === 2 ? 'Md' : fontLevel === 3 ? 'Lg' : 'XL'}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button onClick={() => setShowCameraMenu(!showCameraMenu)} disabled={loading} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-colors h-full flex items-center disabled:opacity-50"><CameraIcon className="w-6 h-6" /></button>
              {showCameraMenu && (
                <div className="absolute bottom-16 left-0 bg-[#111] border border-white/10 rounded-2xl p-2 min-w-[180px] shadow-2xl z-[100003] animate-in slide-in-from-bottom-2">
                  <button onClick={() => { photoInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full p-4 flex items-center gap-3 text-white font-bold text-sm hover:bg-white/5 rounded-xl transition-colors"><CameraIcon className="w-5 h-5 text-blue-400" /> Take Photo</button>
                  <div className="h-px w-full bg-white/5 my-1" />
                  <button onClick={() => { fileInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full p-4 flex items-center gap-3 text-white font-bold text-sm hover:bg-white/5 rounded-xl transition-colors"><ImageIcon className="w-5 h-5 text-purple-400" /> Upload Image</button>
                </div>
              )}
            </div>
            <input ref={fileInputRef}  type="file" className="hidden" accept="image/*"                       onChange={e => handleImageSelect(e.target.files?.[0])} />
            <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={e => handleImageSelect(e.target.files?.[0])} />
            <input
              value={input} onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }}
              disabled={loading} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder={`Type to ${activePersona.name}…`}
              className={`flex-1 bg-white/10 border border-white/10 rounded-2xl px-5 py-4 ${getInputFontSize()} text-white outline-none font-bold min-w-0 disabled:opacity-50`}
            />
            <button onClick={handleSend} disabled={loading} className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-500 transition-colors flex items-center justify-center disabled:opacity-50"><ArrowRight className="w-6 h-6" /></button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 text-[8px] text-gray-500 font-black uppercase tracking-widest"><AlertTriangle className="w-2.5 h-2.5" /> AI can make mistakes. Verify critical info.</div>
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO OS v31.2</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
