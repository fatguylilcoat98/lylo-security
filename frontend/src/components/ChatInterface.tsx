// ============================================================================
// LYLO OS — ChatInterface.tsx
// Version: 31.1.0 — STEP-BY-STEP EMERGENCY + RELIGION INTAKE + SPANISH + END SESSION PDF
// ─────────────────────────────────────────────────────────────────────────────
// V31.1 Changes:
//  [V31.1-1] RELIGION Q1     — Faith question is first in intake (sets up Pastor)
//  [V31.1-2] STEP EMERGENCY  — Emergency protocol shows one step at a time
//                              with "Done — Next Step" button after each step
//  [V31.1-3] END SESSION PDF — PDF only sends when user taps End Session + confirms
//                              No more auto-spam on every message
//  [V31.1-4] SPANISH TOGGLE  — EN/ES button in header AND login screen
//                              All UI strings switch language
// ─────────────────────────────────────────────────────────────────────────────
// V30.9 Changes (preserved):
//  [V30.9-1] BESTIE RETUNE   — Blunt, high-energy, protective. Real Talk mode.
//  [V30.9-2] CAREER RETUNE  — Cold calculating shark. Zero feelings, pure strategy.
//  [V30.9-3] UNIQUE INTROS  — Every persona gets a distinct voice/opening hook.
// ─────────────────────────────────────────────────────────────────────────────
// V30.8 Changes (preserved):
//  [V30.8-1] SENTINEL IMPORT — useSentinel from ../lib/useSentinel
//  [V30.8-2] SENTINEL HOOK  — sentinel = useSentinel({ userEmail, deviceId })
//  [V30.8-3] ENGAGEMENT RESET — sentinel.onEngagement() in handleSend finally
//  [V30.8-4] PUSH REGISTER   — sentinel.onPermissionGranted() after permission
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';

// ── Trust Layer Types ────────────────────────────────────────────────────────
type TrustTier = 'verified' | 'probable' | 'uncertain';

interface TrustSentence {
  id:         string;
  text:       string;
  trustTier:  TrustTier;
  confidence: number;
  sourceType: 'tavily' | 'training' | 'unknown';
  original:   string | null;   // original sentence if corrected
  audit:      TrustAudit | null;
}

interface TrustAudit {
  original:     string;
  issue:        string;
  correction:   string | null;
  source_label: string;
  timestamp:    string;
}

// Augmented message type with trust sentences
interface TrustMessage extends Message {
  sentences?:    TrustSentence[];
  checkingNote?: string | null;
}

// ── Med-Vault Types ──────────────────────────────────────────────────────────
interface VaultMedication {
  id:          string;
  name:        string;
  dose:        string;
  frequency:   string;
  prescriber:  string;
  start_date:  string;
  active:      boolean;
  notes:       string;
}

interface VaultQuestion {
  id:        string;
  question:  string;
  date_label:string;
  answered:  boolean;
}

interface VaultSymptom {
  id:          string;
  description: string;
  severity:    string;
  date_label:  string;
}

interface MedVaultSummary {
  medications: VaultMedication[];
  symptoms:    VaultSymptom[];
  reactions:   any[];
  allergies:   any[];
  questions:   VaultQuestion[];
}

type VaultSetupStep = 'choice' | 'pin_entry' | 'pin_confirm' | 'ready';
type VaultView      = 'list' | 'add_med' | 'scan' | 'questions' | 'pdf_confirm';
import { useSentinel } from '../lib/useSentinel';
import { PERSONAS as IMPORTED_PERSONAS } from '../data/personas';
import {
  Shield, Wrench, Gavel, Activity, BookOpen, Laugh,
  Mic, MicOff, Volume2, VolumeX, AlertTriangle, CreditCard,
  Zap, Brain, LogOut, X, ArrowRight, Briefcase, Bell, Info,
  ExternalLink, Menu, Image as ImageIcon, Camera as CameraIcon, Type, Lock,
  Compass, Star, Users, Target, Flame, Heart, Sliders, ChevronLeft, ChevronRight,
  CheckCircle,
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
  currentPersona?: PersonaConfig; userEmail: string; zoomLevel: number;
  onZoomChange: (zoom: number) => void; onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void; onUsageUpdate?: () => void;
}

interface IntakeProfile { faith: string; occupation: string; mission: string; vibe: string; relationship: string; }

interface AudioQueueEntry { sentence: string; audio: HTMLAudioElement | null; status: 'pending' | 'fetching' | 'ready' | 'played'; }

// [V31.1-1] NEW INTAKE QUESTIONS — Religion first, then work/mission/vibe/relationship
// Round 1: shown on first login
// Round 2: gentle banner after first session
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

// [V31.1-4] UI STRINGS — English + Spanish
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

  const isEmpty = () => queueRef.current.length === 0 && !isPlayingRef.current;
  return { enqueue, push, stop, currentAudioRef, isEmpty };
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
  currentPersona: initialPersona, userEmail = '', onPersonaChange = () => {}, onLogout = () => {}, onUsageUpdate = () => {},
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

  // [V31.1-4] Language state
  const [lang, setLang] = useState<'en' | 'es'>(() =>
    (localStorage.getItem('lylo_lang') as 'en' | 'es') || 'en'
  );
  const langRef = useRef<'en' | 'es'>(lang);
  const t = (key: string): string => UI_STRINGS[lang]?.[key] ?? UI_STRINGS.en[key] ?? key;
  const toggleLang = () => {
    const next: 'en' | 'es' = lang === 'en' ? 'es' : 'en';
    setLang(next);
    langRef.current = next;
    localStorage.setItem('lylo_lang', next);
  };

  const [messages, setMessages]                         = useState<(Message | TrustMessage)[]>([]);
  const [input, setInput]                               = useState('');
  const [loading, setLoading]                           = useState(false);
  const [userName, setUserName]                         = useState('User');
  const [bestieConfig, setBestieConfig]                 = useState<BestieConfig | null>(null);
  const [showBestieSetup, setShowBestieSetup]           = useState(false);
  const [setupStep, setSetupStep]                       = useState<'gender' | 'voice'>('gender');
  const [tempGender, setTempGender]                     = useState<'male' | 'female'>('female');
  const [isRecording, setIsRecording]                   = useState(false);
  const [isSpeaking, setIsSpeaking]                     = useState(false);
  const [showDropdown, setShowDropdown]                 = useState(false);
  const [showCameraMenu, setShowCameraMenu]             = useState(false);
  const [userTier, setUserTier]                         = useState<'free' | 'pro' | 'elite' | 'max'>('max');
  const [communicationStyle, setCommunicationStyle]     = useState('standard');
  const [fontLevel, setFontLevel]                       = useState(1);
  const [isVoiceEnabled, setIsVoiceEnabled]             = useState(true);
  const [readingMode, setReadingMode]                   = useState<'sync' | 'fast'>('sync');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
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

  // [V31.1-2] Emergency step-by-step state
  const [showEmergency, setShowEmergency]               = useState(false);
  const [emergencySteps, setEmergencySteps]             = useState<string[]>([]);
  const [emergencyStep, setEmergencyStep]               = useState(0);
  const [emergencyTitle, setEmergencyTitle]             = useState('');
  const [emergencyWarning, setEmergencyWarning]         = useState('');

  // [V31.1-3] End Session + PDF modal state
  const [showEndSessionModal, setShowEndSessionModal]   = useState(false);

  // ── Med-Vault state ───────────────────────────────────────────────────────
  const [showVaultSetup, setShowVaultSetup]             = useState(false);
  const [vaultSetupStep, setVaultSetupStep]             = useState<VaultSetupStep>('choice');
  const [vaultPinEnabled, setVaultPinEnabled]           = useState(false);
  const [vaultPin, setVaultPin]                         = useState('');
  const [vaultPinConfirm, setVaultPinConfirm]           = useState('');
  const [vaultPinSession, setVaultPinSession]           = useState(''); // PIN for current session
  const [vaultReady, setVaultReady]                     = useState(false);
  const [showVaultPanel, setShowVaultPanel]             = useState(false);
  const [vaultView, setVaultView]                       = useState<VaultView>('list');
  const [vaultSummary, setVaultSummary]                 = useState<MedVaultSummary | null>(null);
  const [vaultLoading, setVaultLoading]                 = useState(false);
  const [scanResult, setScanResult]                     = useState<any>(null);
  const [scanLoading, setScanLoading]                   = useState(false);
  const [newQuestion, setNewQuestion]                   = useState('');
  const [showPdfConfirm, setShowPdfConfirm]             = useState(false);
  const [pdfExpiry, setPdfExpiry]                       = useState(30);
  const [showReminderSetup, setShowReminderSetup]       = useState(false);
  const [reminderSchedule, setReminderSchedule]         = useState<Record<string,string[]>>({});
  const [remindersActive, setRemindersActive]           = useState(false);


  const sessionContentRef                               = useRef(''); // no re-renders during audio
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

  // PWA install prompt
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

  // Restore persisted settings on mount
  useEffect(() => {
    const emailRaw = userEmail.toLowerCase();
    const storedName = localStorage.getItem('userName'); const storedTier = localStorage.getItem('userTier') as any;
    if (storedName) setUserName(storedName); else if (emailRaw.includes('stangman')) setUserName('Christopher');
    if (storedTier) setUserTier(storedTier);
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
      // Check if round 2 is pending
      const r2pending = localStorage.getItem(`lylo_round2_pending_${emailRaw}`);
      if (r2pending) setShowRound2Prompt(true);
    }
  }, [userEmail]);

  // Prefetch persona hooks
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

  // Back-button / unload guard
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
      const kick = () => { const ms = Math.max(18, (audioEl.duration * 1000) / text.length); playAudioSafely(audioEl); startTyping(ms); };
      if (isFinite(audioEl.duration) && audioEl.duration > 0) { kick(); }
      else { audioEl.addEventListener('loadedmetadata', kick, { once: true }); setTimeout(() => { if (streamingTextRef.current === '') { startTyping(28); audioEl.play().catch(() => {}); } }, 1200); }
    } else { startTyping(readingMode === 'fast' ? 0 : 28); }
  };

  const buildRecognition = (): any => {
    const SR = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;
    if (!SR) return null;
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = lang === 'es' ? 'es-US' : 'en-US';
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
    rec.onend = () => {
      // continuous=true means onend only fires on error or explicit .stop()
      // Do NOT restart here — that was causing the beep loop.
      // handleWalkieTalkieMic's stop path already handles cleanup.
    };
    return rec;
  };

  const handleWalkieTalkieMic = () => {
    if (isRecording) {
      isRecordingRef.current = false; setIsRecording(false);
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

  // [V31.1-3] Collect session content as messages arrive
  const appendSessionContent = (content: string, sender: 'user' | 'bot') => {
    if (content.trim()) sessionContentRef.current += (sessionContentRef.current ? '\n' : '') + `[${sender.toUpperCase()}]: ${content}`;
  };

  const handleSend = async () => {
    const text = inputTextRef.current.trim() || input.trim();
    if (!text && !selectedImage) return;
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; setStreamingMsgId(null); }
    setLoading(true); setInput(''); inputTextRef.current = ''; accumulatedRef.current = ''; setShowPersonaGrid(false);
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
      fd.append('email_consent', emailConsent ? 'true' : 'false'); fd.append('voice', voiceToUse); fd.append('lang', langRef.current);
      if (selectedImage) fd.append('file', selectedImage);
      const apiRes = await fetch(`${API_URL}/chat`, { method: 'POST', body: fd });
      if (!apiRes.ok) throw new Error('API error');
      setMessages(prev => [...prev, { id: botMsgId, content: '', sender: 'bot' as const, timestamp: new Date(), confidenceScore: 0, scamDetected: false, actionTrigger: null }]);
      if (readingMode === 'sync') setStreamingMsgId(botMsgId);
      setStreamingText(''); setLoading(false);
      aqm.stop();
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
          if (parsed.type === 'trust_checking') {
            // Show the "checking" pulse note — will be replaced when result arrives
            setMessages(prev => prev.map(m => m.id === botMsgId
              ? { ...m, checkingNote: parsed.content } as TrustMessage
              : m
            ));
          } else if (parsed.type === 'text') {
            const trustTier   = parsed.trust_tier   ?? 'probable';
            const confidence  = parsed.confidence   ?? 85;
            const sourceType  = parsed.source_type  ?? 'training';
            const original    = parsed.original     ?? null;
            const audit       = parsed.audit        ?? null;
            const newSentence: TrustSentence = {
              id:         `${botMsgId}-${Date.now()}-${Math.random()}`,
              text:       parsed.content,
              trustTier,
              confidence,
              sourceType,
              original,
              audit,
            };
            fullAnswer += (fullAnswer ? ' ' : '') + parsed.content;
            if (readingMode === 'sync') setStreamingText(fullAnswer);
            setMessages(prev => prev.map(m => m.id === botMsgId
              ? { ...m, content: fullAnswer, sentences: [...((m as TrustMessage).sentences ?? []), newSentence], checkingNote: null } as TrustMessage
              : m
            ));
            if (isVoiceEnabled) aqm.push(parsed.content, voiceToUse, parsed.audio_b64 ?? undefined);
          } else if (parsed.type === 'meta') { metaData = parsed; if (parsed.full_answer) fullAnswer = parsed.full_answer; break outer; }
        }
      }
      const finalText = fullAnswer.trim();

      // Silent-response guard: if text came via meta.full_answer but no text chunks
      // fired (aqm was never pushed), push now so voice doesn't go silent.
      if (finalText && isVoiceEnabled && aqm.isEmpty?.()) {
        aqm.push(finalText, voiceToUse, undefined);
      }

      // Blank-bubble guard: backend returned nothing — remove empty bubble.
      if (!finalText) {
        setMessages(prev => prev.filter(m => m.id !== botMsgId));
        setStreamingMsgId(null); setLoading(false);
        return;
      }

      appendSessionContent(finalText, 'bot');
      const isLockout = metaData?.threat_level === 'high' && finalText.includes('DEVICE LIMIT EXCEEDED');
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: finalText, confidenceScore: metaData?.confidence_score ?? 0, scamDetected: metaData?.scam_detected ?? false, actionTrigger: metaData?.action_trigger ?? null } : m));

      // Emergency auto-switch persona
      if (metaData?.emergency && metaData?.persona_switched && metaData?.switched_persona) {
        const emergencyPersona = PERSONAS.find(p => p.id === metaData.switched_persona);
        if (emergencyPersona) { setActivePersona(emergencyPersona); localStorage.setItem('lylo_selected_persona', emergencyPersona.id); onPersonaChange(emergencyPersona); }
      }

      // [V31.1-2] Show step-by-step emergency UI if steps are present
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
    // Vault setup check for medical personas
    if (['doctor','therapist','vitality'].includes(persona.id)) {
      const ready = checkVaultReady();
      if (!ready) { setShowVaultSetup(true); setVaultSetupStep('choice'); }
    }
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

  const handleInternalBack = () => { setMessages([]); setShowPersonaGrid(true); sessionContentRef.current = ''; aqm.stop(); setIsSpeaking(false); };
  const cycleFontSize = () => { const next = fontLevel >= 4 ? 1 : fontLevel + 1; setFontLevel(next); localStorage.setItem('lylo_font_level', String(next)); };
  const bailoutTypewriter = () => { if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; } setStreamingMsgId(null); setStreamingText(''); };

  const requestMobileAlerts = async () => {
    if (!('Notification' in window)) { alert('Push notifications not supported.'); return; }
    if (Notification.permission === 'granted') { setNotificationsEnabled(true); return; }
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      setNotificationsEnabled(true);
      new Notification('LYLO Alerts Active 🛡️', { body: 'Mission reminders enabled.', icon: '/logo.png' });
      sentinel.onPermissionGranted();
    } else { setNotificationsEnabled(false); }
  };

  const scheduleMobileReminder = (msg: string, minutes = 30) => {
    if (!notificationsEnabled || Notification.permission !== 'granted') {
      requestMobileAlerts().then(() => { if (Notification.permission === 'granted') setTimeout(() => new Notification('⏰ LYLO Reminder', { body: msg, icon: '/logo.png' }), minutes * 60000); });
      return;
    }
    setTimeout(() => new Notification('⏰ LYLO Reminder', { body: msg, icon: '/logo.png' }), minutes * 60000);
    new Notification(`✅ Reminder Set — ${minutes} min`, { body: `"${msg.slice(0, 80)}..."`, icon: '/logo.png' });
  };

  // [V31.1-3] End Session handler — shows PDF confirm modal
  const handleEndSession = () => { setShowDropdown(false); setShowEndSessionModal(true); };

  // ── Med-Vault API helpers ─────────────────────────────────────────────────
  const vaultSetup = async (pinEnabled: boolean, pin: string) => {
    const fd = new FormData();
    fd.append('user_email', userEmail);
    fd.append('pin_enabled', pinEnabled ? 'true' : 'false');
    fd.append('pin', pin);
    const res  = await fetch(`${API_URL}/vault/setup`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.vault_ready) {
      setVaultReady(true);
      setVaultPinEnabled(pinEnabled);
      setVaultPinSession(pin);
      localStorage.setItem(`lylo_vault_setup_${userEmail}`, 'true');
      localStorage.setItem(`lylo_vault_pin_enabled_${userEmail}`, pinEnabled ? 'true' : 'false');
    }
    return data.vault_ready;
  };

  const loadVaultSummary = async () => {
    if (!vaultReady) return;
    setVaultLoading(true);
    try {
      const fd = new FormData();
      fd.append('user_email', userEmail);
      fd.append('pin', vaultPinSession);
      fd.append('persona', activePersona.id);
      const res  = await fetch(`${API_URL}/vault/get-summary`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.summary) setVaultSummary(data.summary);
    } catch (e) { console.warn('[Vault] load error:', e); }
    finally { setVaultLoading(false); }
  };

  const scanMedication = async (file: File) => {
    setScanLoading(true); setScanResult(null);
    try {
      const fd = new FormData();
      fd.append('user_email', userEmail);
      fd.append('pin', vaultPinSession);
      fd.append('file', file);
      const res  = await fetch(`${API_URL}/vault/scan-medication`, { method: 'POST', body: fd });
      const data = await res.json();
      setScanResult(data);
    } catch (e) { console.warn('[Vault] scan error:', e); }
    finally { setScanLoading(false); }
  };

  const addMedication = async (med: Partial<VaultMedication>) => {
    const fd = new FormData();
    fd.append('user_email', userEmail);
    fd.append('pin', vaultPinSession);
    fd.append('name',       med.name       || '');
    fd.append('dose',       med.dose       || '');
    fd.append('frequency',  med.frequency  || '');
    fd.append('prescriber', med.prescriber || '');
    const res  = await fetch(`${API_URL}/vault/add-medication`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) { await loadVaultSummary(); return true; }
    return false;
  };

  const addDoctorQuestion = async (question: string) => {
    const fd = new FormData();
    fd.append('user_email', userEmail);
    fd.append('pin', vaultPinSession);
    fd.append('question', question);
    const res  = await fetch(`${API_URL}/vault/add-question`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) { await loadVaultSummary(); return true; }
    return false;
  };

  const generateVaultPdf = async (expiry: number) => {
    const fd = new FormData();
    fd.append('user_email', userEmail);
    fd.append('user_name',  userName);
    fd.append('pin',        vaultPinSession);
    fd.append('persona',    activePersona.id);
    fd.append('qr_expiry_min', String(expiry));
    fd.append('lang', lang);
    const res = await fetch(`${API_URL}/vault/generate-pdf`, { method: 'POST', body: fd });
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `LYLO_Medical_Report_${new Date().toISOString().slice(0,10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Medication reminder helpers ──────────────────────────────────────────
  const COMMON_TIMES = ['06:00','07:00','08:00','09:00','12:00','13:00',
                         '17:00','18:00','20:00','21:00','22:00'];

  const TIME_LABELS: Record<string,string> = {
    '06:00':'6:00 AM','07:00':'7:00 AM','08:00':'8:00 AM','09:00':'9:00 AM',
    '12:00':'Noon',   '13:00':'1:00 PM','17:00':'5:00 PM','18:00':'6:00 PM',
    '20:00':'8:00 PM','21:00':'9:00 PM','22:00':'10:00 PM',
  };

  const toggleReminderTime = (medId: string, time: string) => {
    setReminderSchedule(prev => {
      const current = prev[medId] || [];
      const updated = current.includes(time)
        ? current.filter(t => t !== time)
        : [...current, time].sort();
      return { ...prev, [medId]: updated };
    });
  };

  const saveAndActivateReminders = async () => {
    // Request notification permission first
    if (!('Notification' in window)) { alert('Notifications not supported on this device.'); return; }
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { alert('Please allow notifications to enable reminders.'); return; }
    }

    // Save schedule to backend
    const meds = vaultSummary?.medications?.filter(m => m.active) || [];
    const reminderList = meds
      .filter(m => (reminderSchedule[m.id] || []).length > 0)
      .map(m => ({ med_id: m.id, med_name: m.name, dose: m.dose, times: reminderSchedule[m.id] }));

    const fd = new FormData();
    fd.append('user_email', userEmail);
    fd.append('pin', vaultPinSession);
    fd.append('reminders', JSON.stringify(reminderList));
    await fetch(`${API_URL}/vault/set-reminders`, { method: 'POST', body: fd });

    // Schedule browser notifications for each time
    _cancelAllMedReminders();
    const now = new Date();
    reminderList.forEach(({ med_name, dose, times }) => {
      times.forEach(time => {
        const [h, m] = time.split(':').map(Number);
        const next = new Date();
        next.setHours(h, m, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1); // tomorrow if time passed
        const ms = next.getTime() - now.getTime();
        const tid = window.setTimeout(() => {
          new Notification(`💊 Time for your ${med_name}`, {
            body: `${dose} — Stay on track. Your health is your wealth. 💚`,
            icon: '/logo.png',
            tag:  `lylo-med-${med_name}-${time}`,
          });
          // Re-schedule for next day
          const daily = window.setInterval(() => {
            new Notification(`💊 Time for your ${med_name}`, {
              body: `${dose} — Stay on track. Your health is your wealth. 💚`,
              icon: '/logo.png',
              tag:  `lylo-med-${med_name}-${time}`,
            });
          }, 24 * 60 * 60 * 1000);
          (window as any).__lyloMedIntervals = [...((window as any).__lyloMedIntervals || []), daily];
        }, ms);
        (window as any).__lyloMedTimeouts = [...((window as any).__lyloMedTimeouts || []), tid];
      });
    });

    setRemindersActive(true);
    setShowReminderSetup(false);
    localStorage.setItem(`lylo_reminders_active_${userEmail}`, 'true');
    new Notification('✅ LYLO Med Reminders Active', {
      body: `${reminderList.length} medication${reminderList.length !== 1 ? 's' : ''} scheduled. We've got you covered. 💊`,
      icon: '/logo.png',
    });
  };

  const _cancelAllMedReminders = () => {
    ((window as any).__lyloMedTimeouts || []).forEach((id: number) => window.clearTimeout(id));
    ((window as any).__lyloMedIntervals || []).forEach((id: number) => window.clearInterval(id));
    (window as any).__lyloMedTimeouts  = [];
    (window as any).__lyloMedIntervals = [];
  };

  // Check vault setup on mount + when Doctor persona activates
  const checkVaultReady = () => {
    const setup  = localStorage.getItem(`lylo_vault_setup_${userEmail}`);
    const pinOn  = localStorage.getItem(`lylo_vault_pin_enabled_${userEmail}`) === 'true';
    const remOn  = localStorage.getItem(`lylo_reminders_active_${userEmail}`) === 'true';
    if (setup === 'true') {
      setVaultReady(true);
      setVaultPinEnabled(pinOn);
      if (!pinOn) setVaultPinSession('');
    }
    if (remOn) setRemindersActive(true);
    return setup === 'true';
  };

  // [V31.1-3] Send session report to backend
  const sendSessionReport = async () => {
    setShowEndSessionModal(false);
    if (!sessionContentRef.current.trim()) { return; }
    try {
      const fd = new FormData();
      fd.append('user_email', userEmail); fd.append('persona', activePersona.id);
      fd.append('content', sessionContentRef.current); fd.append('user_name', userName);
      await fetch(`${API_URL}/send-session-report`, { method: 'POST', body: fd });
    } catch (e) { console.warn('[PDF] send failed:', e); }
    sessionContentRef.current = '';
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
    // Don't show round 2 prompt immediately — show it after their first real session
  };

  const completeRound2 = () => {
    localStorage.removeItem(`lylo_round2_pending_${userEmail.toLowerCase()}`);
    setShowOnboarding(false); setShowRound2Prompt(false);
  };

  const getDynamicFontSize = () => { switch (fontLevel) { case 2: return 'text-lg leading-relaxed'; case 3: return 'text-2xl leading-relaxed tracking-wide'; case 4: return 'text-4xl leading-loose tracking-wide font-black'; default: return 'text-sm leading-normal'; } };
  const getInputFontSize = () => { switch (fontLevel) { case 2: return 'text-lg'; case 3: return 'text-xl'; case 4: return 'text-2xl'; default: return 'text-sm'; } };

  // ==========================================================================
  // [V31.1-1] ONBOARDING — Round 1 & 2
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
        {/* Language toggle on intake screen */}
        <button onClick={toggleLang} title={lang === 'en' ? 'Switch to Spanish' : 'Switch to English'} className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
          <span className="text-xl leading-none">{lang === 'en' ? '🇺🇸' : '🇲🇽'}</span>
          <span className="text-gray-400 text-xs font-bold">{lang === 'en' ? 'EN' : 'ES'}</span>
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

      {/* [V31.1-2] EMERGENCY STEP-BY-STEP OVERLAY */}
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
              <button
                onClick={() => setEmergencyStep(s => s + 1)}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-base transition-all active:scale-95"
              >
                ✅ {t('emerg_next')}
              </button>
            ) : (
              <button
                onClick={() => setShowEmergency(false)}
                className="w-full py-4 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-black rounded-xl text-base transition-all active:scale-95"
              >
                {t('emerg_done')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* [V31.1-3] END SESSION PDF MODAL */}
      {showEndSessionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100009] p-4">
          <div className="bg-[#0a0a0a] border border-[#39FF14]/30 rounded-2xl max-w-sm w-full p-6 shadow-[0_0_40px_rgba(57,255,20,0.1)]">
            <h3 className="text-white font-black text-lg mb-2">📄 {t('send_report')}</h3>
            <p className="text-gray-400 text-sm mb-6">{t('report_prompt')}</p>
            <div className="flex gap-3">
              <button
                onClick={sendSessionReport}
                className="flex-1 py-3 bg-[#39FF14] text-black font-black rounded-xl text-sm hover:bg-[#39FF14]/90 transition-all active:scale-95"
              >
                {t('report_yes')}
              </button>
              <button
                onClick={() => { setShowEndSessionModal(false); sessionContentRef.current = ''; }}
                className="flex-1 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl text-sm hover:bg-gray-700 transition-all active:scale-95"
              >
                {t('report_no')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VAULT SETUP MODAL ─────────────────────────────────────────── */}
      {showVaultSetup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100008] flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-green-500/30 rounded-3xl w-full max-w-sm p-6 shadow-[0_0_50px_rgba(34,197,94,0.12)]">

            {vaultSetupStep === 'choice' && (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">🔒</div>
                  <h2 className="text-white font-black text-xl">Protect Your Health Vault</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                    Your medications and health data are encrypted. Only you and your AI Doctor can see this.
                    Not LYLO staff. Not anyone else.
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      const ok = await vaultSetup(false, '');
                      if (ok) { setShowVaultSetup(false); loadVaultSummary(); setShowVaultPanel(true); }
                    }}
                    className="w-full p-5 bg-white/5 border border-white/10 hover:border-green-400/50 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔓</span>
                      <div>
                        <p className="text-white font-bold">Simple Access</p>
                        <p className="text-gray-400 text-xs mt-0.5">Just use my account. No extra step.</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setVaultSetupStep('pin_entry')}
                    className="w-full p-5 bg-white/5 border border-white/10 hover:border-green-400/50 rounded-2xl text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔐</span>
                      <div>
                        <p className="text-white font-bold">PIN Protection</p>
                        <p className="text-gray-400 text-xs mt-0.5">Add a 4-digit PIN for extra security.</p>
                      </div>
                    </div>
                  </button>
                </div>
                <button onClick={() => setShowVaultSetup(false)} className="w-full mt-4 text-gray-600 text-xs font-bold uppercase py-2">
                  Maybe Later
                </button>
              </div>
            )}

            {vaultSetupStep === 'pin_entry' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                <button onClick={() => setVaultSetupStep('choice')} className="text-gray-500 text-xs mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">🔐</div>
                  <h2 className="text-white font-black text-xl">Create Your PIN</h2>
                  <p className="text-gray-400 text-sm mt-2">4 digits. Easy to remember, hard to guess.</p>
                </div>
                <VaultPinInput value={vaultPin} onChange={setVaultPin} />
                <button
                  onClick={() => { if (vaultPin.length === 4) setVaultSetupStep('pin_confirm'); }}
                  disabled={vaultPin.length !== 4}
                  className="w-full mt-4 py-4 bg-green-600 text-black font-black rounded-2xl disabled:opacity-30 hover:bg-green-500 transition-all"
                >
                  Continue
                </button>
              </div>
            )}

            {vaultSetupStep === 'pin_confirm' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                <button onClick={() => setVaultSetupStep('pin_entry')} className="text-gray-500 text-xs mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">🔐</div>
                  <h2 className="text-white font-black text-xl">Confirm PIN</h2>
                  <p className="text-gray-400 text-sm mt-2">Enter your PIN again to confirm.</p>
                </div>
                <VaultPinInput value={vaultPinConfirm} onChange={setVaultPinConfirm} />
                {vaultPinConfirm.length === 4 && vaultPinConfirm !== vaultPin && (
                  <p className="text-red-400 text-xs text-center mt-2">PINs don't match. Try again.</p>
                )}
                <button
                  onClick={async () => {
                    if (vaultPinConfirm !== vaultPin) return;
                    const ok = await vaultSetup(true, vaultPin);
                    if (ok) {
                      setVaultPinSession(vaultPin);
                      setVaultPin(''); setVaultPinConfirm('');
                      setShowVaultSetup(false);
                      loadVaultSummary(); setShowVaultPanel(true);
                    }
                  }}
                  disabled={vaultPinConfirm.length !== 4 || vaultPinConfirm !== vaultPin}
                  className="w-full mt-4 py-4 bg-green-600 text-black font-black rounded-2xl disabled:opacity-30 hover:bg-green-500 transition-all"
                >
                  Activate Vault 🔒
                </button>
              </div>
            )}

            {vaultSetupStep === 'pin_entry' && vaultReady && (
              // Re-entry for PIN unlock
              <div className="animate-in fade-in duration-200">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">🔐</div>
                  <h2 className="text-white font-black text-xl">Enter Your PIN</h2>
                  <p className="text-gray-400 text-sm mt-2">Unlock your Health Vault.</p>
                </div>
                <VaultPinInput value={vaultPinSession} onChange={setVaultPinSession} />
                <button
                  onClick={() => {
                    if (vaultPinSession.length === 4) {
                      setShowVaultSetup(false);
                      loadVaultSummary(); setShowVaultPanel(true);
                    }
                  }}
                  disabled={vaultPinSession.length !== 4}
                  className="w-full mt-4 py-4 bg-green-600 text-black font-black rounded-2xl disabled:opacity-30"
                >
                  Unlock
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VAULT PANEL ───────────────────────────────────────────────────── */}
      {showVaultPanel && (
        <div className="fixed inset-0 bg-black/95 z-[100007] flex flex-col">
          {/* Vault header */}
          <div className="bg-[#0a0a0a] border-b border-green-500/20 p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💊</span>
              <div>
                <h2 className="text-white font-black text-base uppercase tracking-widest">Health Vault</h2>
                <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest">
                  {vaultPinEnabled ? '🔐 PIN Protected' : '🔒 Encrypted'} · Only you can see this
                </p>
              </div>
            </div>
            <button onClick={() => setShowVaultPanel(false)} className="p-2 bg-white/5 rounded-xl text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Vault nav tabs */}
          <div className="flex border-b border-white/10 flex-shrink-0 bg-[#0a0a0a]">
            {[
              { id: 'list',      label: '💊 Meds',     view: 'list'      },
              { id: 'questions', label: '❓ Questions', view: 'questions' },
              { id: 'scan',      label: '📷 Scan',      view: 'scan'      },
              { id: 'profile',   label: '👤 Profile',   view: 'profile'   },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setVaultView(tab.view as VaultView); }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                  vaultView === tab.view
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Vault content */}
          <div className="flex-1 overflow-y-auto p-4">
            {vaultLoading && (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* MEDICATIONS LIST */}
            {!vaultLoading && vaultView === 'list' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">
                    {vaultSummary?.medications?.length || 0} Active Medications
                  </p>
                  <button
                    onClick={() => setVaultView('scan')}
                    className="px-3 py-1.5 bg-green-600/20 border border-green-500/30 rounded-xl text-green-400 text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>
                {vaultSummary?.medications?.filter(m => m.active).map(med => (
                  <VaultMedCard key={med.id} med={med} />
                ))}
                {(!vaultSummary?.medications?.length) && (
                  <div className="text-center py-12 text-gray-600">
                    <div className="text-4xl mb-3">💊</div>
                    <p className="font-bold">No medications logged yet</p>
                    <p className="text-xs mt-1">Tap 📷 Scan to photograph a pill bottle</p>
                  </div>
                )}
                {/* Symptom timeline */}
                {(vaultSummary?.symptoms?.length || 0) > 0 && (
                  <div className="mt-6">
                    <p className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-3">
                      📋 Recent Symptoms
                    </p>
                    <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                      {vaultSummary!.symptoms.slice(-5).reverse().map(s => (
                        <VaultSymptomRow key={s.id} symptom={s} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* QUESTIONS */}
            {!vaultLoading && vaultView === 'questions' && (
              <div className="space-y-3">
                <p className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-2">
                  Questions saved for your doctor
                </p>
                {vaultSummary?.questions?.filter(q => !q.answered).map(q => (
                  <div key={q.id} className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-white text-sm font-medium">❓ {q.question}</p>
                    <p className="text-gray-500 text-xs mt-1">{q.date_label}</p>
                  </div>
                ))}
                {(!vaultSummary?.questions?.filter(q => !q.answered).length) && (
                  <div className="text-center py-8 text-gray-600">
                    <div className="text-4xl mb-3">❓</div>
                    <p className="font-bold text-sm">No questions saved yet</p>
                    <p className="text-xs mt-1">Tell the Doctor "save this question" during a conversation</p>
                  </div>
                )}
                {/* Quick add question */}
                <div className="mt-4 flex gap-2">
                  <input
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newQuestion.trim()) {
                        await addDoctorQuestion(newQuestion.trim());
                        setNewQuestion('');
                      }
                    }}
                    placeholder="Type a question to save for your doctor..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-400 transition-all"
                  />
                  <button
                    onClick={async () => {
                      if (newQuestion.trim()) {
                        await addDoctorQuestion(newQuestion.trim());
                        setNewQuestion('');
                      }
                    }}
                    className="px-4 py-3 bg-green-600 rounded-xl text-black font-bold text-sm hover:bg-green-500 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* PROFILE SILO DATA */}
            {!vaultLoading && vaultView === 'profile' && (
              <div className="space-y-5">
                <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">
                  Your data — only shared with the right specialists
                </p>

                {/* Vehicle */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white font-black text-sm">🚗 Vehicle</p>
                    <p className="text-gray-500 text-[10px]">Mechanic · Lawyer · Wealth</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['make','model','year','vin'] as const).map(field => (
                      <div key={field}>
                        <p className="text-gray-500 text-[10px] uppercase">{field}</p>
                        <input
                          placeholder={field === 'vin' ? 'Optional' : field.charAt(0).toUpperCase()+field.slice(1)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-orange-400 transition-all mt-1"
                          onChange={e => {
                            const val = e.target.value;
                            // Stored in sessionStorage as staging until Save pressed
                            sessionStorage.setItem(`vault_vehicle_${field}`, val);
                          }}
                          defaultValue={sessionStorage.getItem(`vault_vehicle_${field}`) || ''}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      const vehicle = {
                        make: sessionStorage.getItem('vault_vehicle_make') || '',
                        model: sessionStorage.getItem('vault_vehicle_model') || '',
                        year: sessionStorage.getItem('vault_vehicle_year') || '',
                        vin: sessionStorage.getItem('vault_vehicle_vin') || '',
                        id: Date.now().toString(),
                      };
                      if (!vehicle.make && !vehicle.model) return;
                      const fd = new FormData();
                      fd.append('user_email', userEmail);
                      fd.append('pin', vaultPinSession);
                      fd.append('silo', 'vehicle');
                      fd.append('data', JSON.stringify({ type: 'add_vehicle', vehicle }));
                      await fetch(`${API_URL}/vault/update-silo`, { method: 'POST', body: fd });
                      await loadVaultSummary();
                    }}
                    className="w-full mt-3 py-2.5 bg-orange-600/20 border border-orange-500/30 rounded-xl text-orange-400 text-xs font-bold hover:bg-orange-600/40 transition-all"
                  >
                    Save Vehicle
                  </button>
                </div>

                {/* Career */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white font-black text-sm">💼 Career</p>
                    <p className="text-gray-500 text-[10px]">Career Coach · Wealth · Lawyer</p>
                  </div>
                  <div className="space-y-2">
                    {[{key:'current_role',label:'Current Role'},
                      {key:'employer',    label:'Employer'}].map(({key,label}) => (
                      <div key={key}>
                        <p className="text-gray-500 text-[10px] uppercase mb-1">{label}</p>
                        <input
                          placeholder={label}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-400 transition-all"
                          onChange={e => sessionStorage.setItem(`vault_career_${key}`, e.target.value)}
                          defaultValue={sessionStorage.getItem(`vault_career_${key}`) || ''}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      const career = {
                        current_role: sessionStorage.getItem('vault_career_current_role') || '',
                        employer:     sessionStorage.getItem('vault_career_employer') || '',
                      };
                      if (!career.current_role) return;
                      const fd = new FormData();
                      fd.append('user_email', userEmail);
                      fd.append('pin', vaultPinSession);
                      fd.append('silo', 'career');
                      fd.append('data', JSON.stringify(career));
                      await fetch(`${API_URL}/vault/update-silo`, { method: 'POST', body: fd });
                    }}
                    className="w-full mt-3 py-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 text-xs font-bold hover:bg-indigo-600/40 transition-all"
                  >
                    Save Career Info
                  </button>
                </div>

                {/* Privacy note */}
                <div className="bg-white/3 border border-white/5 rounded-xl p-3">
                  <p className="text-gray-500 text-[10px] leading-relaxed text-center">
                    🔒 All data is AES-256 encrypted. Your Mechanic doesn't see your health data.
                    Your Doctor doesn't see your car. Each specialist only sees what they need.
                    Not even LYLO staff can access this.
                  </p>
                </div>
              </div>
            )}

            {/* SCAN */}
            {!vaultLoading && vaultView === 'scan' && (
              <div className="space-y-4">
                <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">
                  📷 Photograph a pill bottle
                </p>
                <div
                  onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange = e => { const f=(e.target as HTMLInputElement).files?.[0]; if(f) scanMedication(f); }; i.click(); }}
                  className="border-2 border-dashed border-green-500/30 rounded-2xl p-8 text-center cursor-pointer hover:border-green-500/60 hover:bg-green-500/5 transition-all"
                >
                  {scanLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-green-400 font-bold text-sm">Reading label...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl">📷</span>
                      <p className="text-white font-bold">Tap to photograph pill bottle</p>
                      <p className="text-gray-500 text-xs">LYLO reads the label automatically</p>
                    </div>
                  )}
                </div>

                {/* Scan result */}
                {scanResult && !scanLoading && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in duration-300">
                    <p className="text-green-400 font-black text-sm uppercase tracking-widest">📋 Label Read</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><p className="text-gray-500 text-xs">Medication</p><p className="text-white font-bold">{scanResult.scanned?.name || '—'}</p></div>
                      <div><p className="text-gray-500 text-xs">Dose</p><p className="text-white font-bold">{scanResult.scanned?.dose || '—'}</p></div>
                      <div><p className="text-gray-500 text-xs">Frequency</p><p className="text-white font-bold">{scanResult.scanned?.frequency || '—'}</p></div>
                      <div><p className="text-gray-500 text-xs">Prescriber</p><p className="text-white font-bold">{scanResult.scanned?.prescriber || '—'}</p></div>
                    </div>
                    {scanResult.discrepancy && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                        <p className="text-yellow-400 text-xs font-bold">⚠ {scanResult.discrepancy.message}</p>
                      </div>
                    )}
                    {scanResult.interactions?.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                        <p className="text-red-400 text-xs font-bold">⚡ Drug Interaction Alert</p>
                        {scanResult.interactions.map((ia: any, i: number) => (
                          <p key={i} className="text-red-300 text-xs mt-1">{ia.drug_a} + {ia.drug_b}: {ia.warning?.slice(0,120)}</p>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await addMedication(scanResult.scanned);
                        if (ok) { setScanResult(null); setVaultView('list'); }
                      }}
                      className="w-full py-3 bg-green-600 text-black font-black rounded-xl text-sm hover:bg-green-500 transition-all"
                    >
                      ✓ Add to My Medications
                    </button>
                    <button onClick={() => setScanResult(null)} className="w-full py-2 text-gray-500 text-xs font-bold">
                      Discard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vault footer — PDF + Reminders */}
          <div className="bg-[#0a0a0a] border-t border-white/10 p-4 flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setShowPdfConfirm(true)}
                className="flex-1 py-4 bg-green-600 text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-green-500 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(34,197,94,0.2)] text-sm"
              >
                📄 Doctor PDF
              </button>
              <button
                onClick={() => {
                  // Pre-populate reminder schedule from vault
                  const meds = vaultSummary?.medications?.filter(m => m.active) || [];
                  if (!meds.length) { alert('Add medications first before setting reminders.'); return; }
                  setShowReminderSetup(true);
                }}
                className={`flex-1 py-4 font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm ${
                  remindersActive
                    ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                    : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                ⏰ {remindersActive ? 'Reminders On' : 'Set Reminders'}
              </button>
            </div>
            <p className="text-center text-gray-600 text-[10px] uppercase tracking-widest">
              AI-Generated · For Clinical Review Only · Not a Medical Diagnosis
            </p>
          </div>
        </div>
      )}

      {/* ── REMINDER SETUP MODAL ─────────────────────────────────────────── */}
      {showReminderSetup && (
        <div className="fixed inset-0 bg-black/95 z-[100010] flex flex-col">
          <div className="bg-[#0a0a0a] border-b border-indigo-500/20 p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <h2 className="text-white font-black text-base uppercase tracking-widest">Med Reminders</h2>
                <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                  Daily push notifications · Never miss a dose
                </p>
              </div>
            </div>
            <button onClick={() => setShowReminderSetup(false)} className="p-2 bg-white/5 rounded-xl text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <p className="text-gray-400 text-xs leading-relaxed">
              Tap the times you take each medication. LYLO will send a push notification every day at those times. 💚
            </p>
            {(vaultSummary?.medications?.filter(m => m.active) || []).map(med => (
              <div key={med.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">💊</span>
                  <div>
                    <p className="text-white font-bold text-sm">{med.name} <span className="text-green-400">{med.dose}</span></p>
                    <p className="text-gray-400 text-xs">{med.frequency}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['06:00','08:00','09:00','12:00','17:00','20:00','21:00','22:00'].map(time => {
                    const active = (reminderSchedule[med.id] || []).includes(time);
                    return (
                      <button
                        key={time}
                        onClick={() => toggleReminderTime(med.id, time)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] min-w-[44px] ${
                          active
                            ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:border-indigo-400/40'
                        }`}
                        aria-pressed={active}
                        aria-label={`${active ? 'Remove' : 'Add'} reminder at ${time} for ${med.name}`}
                      >
                        {{'06:00':'6 AM','08:00':'8 AM','09:00':'9 AM','12:00':'Noon',
                          '17:00':'5 PM','20:00':'8 PM','21:00':'9 PM','22:00':'10 PM'}[time]}
                      </button>
                    );
                  })}
                </div>
                {(reminderSchedule[med.id] || []).length > 0 && (
                  <p className="text-indigo-400 text-[10px] mt-2 font-bold">
                    ✓ Reminders set: {(reminderSchedule[med.id] || []).map(t =>
                      ({'06:00':'6 AM','08:00':'8 AM','09:00':'9 AM','12:00':'Noon',
                        '17:00':'5 PM','20:00':'8 PM','21:00':'9 PM','22:00':'10 PM'})[t] || t
                    ).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="bg-[#0a0a0a] border-t border-white/10 p-4 flex-shrink-0">
            <button
              onClick={saveAndActivateReminders}
              disabled={Object.values(reminderSchedule).every(t => t.length === 0)}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all active:scale-[0.98] disabled:opacity-30 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
            >
              ✅ Activate Daily Reminders
            </button>
            {remindersActive && (
              <button
                onClick={() => { _cancelAllMedReminders(); setRemindersActive(false); setShowReminderSetup(false); localStorage.removeItem(`lylo_reminders_active_${userEmail}`); }}
                className="w-full py-3 mt-2 text-red-400 text-xs font-bold uppercase tracking-widest"
              >
                Turn Off All Reminders
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PDF CONFIRM MODAL ─────────────────────────────────────────────── */}
      {showPdfConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100009] p-4">
          <div className="bg-[#0a0a0a] border border-green-500/30 rounded-2xl max-w-sm w-full p-6 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
            <h3 className="text-white font-black text-lg mb-2">📄 Generate Doctor PDF</h3>
            <p className="text-gray-400 text-sm mb-4">
              A secure PDF with your medications, symptom timeline, and questions. Contains a QR code that expires after:
            </p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[15, 30, 60].map(min => (
                <button
                  key={min}
                  onClick={() => setPdfExpiry(min)}
                  className={`py-3 rounded-xl font-black text-sm transition-all ${
                    pdfExpiry === min
                      ? 'bg-green-600 text-black'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => { setShowPdfConfirm(false); await generateVaultPdf(pdfExpiry); }}
                className="flex-1 py-3 bg-green-600 text-black font-black rounded-xl text-sm hover:bg-green-500 transition-all active:scale-95"
              >
                Download PDF
              </button>
              <button
                onClick={() => setShowPdfConfirm(false)}
                className="flex-1 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl text-sm hover:bg-gray-700 transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-600 mt-3 uppercase tracking-widest">
              AI-Generated · For Clinical Review Only · Not a Medical Diagnosis
            </p>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="bg-black/90 border-b border-white/10 p-3 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="relative flex items-center gap-2 z-10">
            {!showPersonaGrid && (<button onClick={handleInternalBack} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors"><ChevronLeft className="w-5 h-5" /></button>)}
            <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors"><Menu className="w-5 h-5" /></button>
            {showPersonaGrid && (
              <div className="flex flex-col justify-center ml-1">
                <p className="text-white font-black text-[11px] uppercase leading-none truncate max-w-[90px]">{userName}</p>
                <p className="text-[8px] text-green-500 font-black mt-[3px] uppercase tracking-widest">{userTier}</p>
              </div>
            )}
            {showDropdown && (
              <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-2xl p-5 min-w-[280px] shadow-2xl z-[100001] max-h-[80vh] overflow-y-auto">
                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase font-black mb-3">Communication Style</p>
                  <select value={communicationStyle} onChange={e => handleVibeChange(e.target.value)} className="w-full bg-white/10 text-white p-3 rounded-xl font-bold mb-4">
                    {VIBE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="mb-6 space-y-3">
                  <button onClick={cycleFontSize} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors"><div className="flex items-center gap-3"><Type className="w-5 h-5 text-blue-400" /><span className="font-bold">Text Size</span></div><span className="text-xs font-black uppercase tracking-widest text-gray-400">Level {fontLevel}</span></button>
                  <button onClick={toggleVoice} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors"><div className="flex items-center gap-3">{isVoiceEnabled ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}<span className="font-bold">Voice Output</span></div><span className={`text-xs font-black uppercase tracking-widest ${isVoiceEnabled ? 'text-green-400' : 'text-red-400'}`}>{isVoiceEnabled ? 'ON' : 'OFF'}</span></button>
                  <button onClick={toggleLang} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors"><div className="flex items-center gap-3"><span className="text-2xl leading-none">{lang === 'en' ? '🇺🇸' : '🇲🇽'}</span><span className="font-bold">{lang === 'en' ? 'English' : 'Español'}</span></div><span className="text-gray-500 text-xs">{lang === 'en' ? 'Switch to Spanish' : 'Switch to English'}</span></button>
                  <button onClick={() => { setShowDropdown(false); setShowOnboarding(true); setOnboardingStep(0); setOnboardingRound(1); }} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors"><div className="flex items-center gap-3"><Info className="w-5 h-5 text-blue-400" /><span className="font-bold">Rebuild My Profile</span></div></button>
                  {canInstall && (<button onClick={() => { setShowDropdown(false); handleInstallClick(); }} className="w-full p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl text-white flex items-center justify-between hover:bg-blue-600/20 transition-colors"><div className="flex items-center gap-3"><ArrowRight className="w-5 h-5 text-blue-400" /><span className="font-bold">Install LYLO OS</span></div><span className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Home Screen</span></button>)}
                  {/* [V31.1-3] End Session button */}
                  <button onClick={handleEndSession} className="w-full p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 hover:bg-red-500/10 transition-colors font-bold"><X className="w-5 h-5" /> {t('end_session')}</button>
                </div>
                <button onClick={onLogout} className="w-full p-4 text-red-500 font-black uppercase flex items-center justify-center gap-2 border border-red-500/20 rounded-xl"><LogOut className="w-4 h-4" /> Terminate Session</button>
              </div>
            )}
          </div>

          <div className="text-center absolute left-1/2 -translate-x-1/2 w-1/3">
            <h1 className="text-white font-black text-2xl tracking-[0.2em] leading-none">L<span className={getColor(activePersona.color, 'text')}>Y</span>LO</h1>
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.3em] mt-1 truncate">{activePersona.serviceLabel}</p>
          </div>

          <div className="flex items-center gap-2 z-10">
            {/* [V31.1-4] Language toggle in header */}
            <button onClick={toggleLang} title={lang === 'en' ? 'Switch to Spanish' : 'Switch to English'} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-xl leading-none">{lang === 'en' ? '🇺🇸' : '🇲🇽'}</button>
            <button onClick={requestMobileAlerts} title={notificationsEnabled ? 'Alerts Active' : 'Enable Alerts'} className={`p-3 rounded-xl transition-all ${notificationsEnabled ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500 hover:text-white' : 'bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10 hover:text-white'}`}><Bell className="w-5 h-5" /></button>
            {['doctor','therapist','vitality','pastor'].includes(activePersona.id) && (
              <button
                onClick={() => {
                  const ready = checkVaultReady();
                  if (ready) {
                    if (vaultPinEnabled && !vaultPinSession) {
                      setShowVaultSetup(true); setVaultSetupStep('pin_entry');
                    } else {
                      loadVaultSummary(); setShowVaultPanel(true);
                    }
                  } else {
                    setShowVaultSetup(true); setVaultSetupStep('choice');
                  }
                }}
                title="Health Vault"
                className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 hover:bg-green-500 hover:text-white transition-all"
              >
                <span className="text-base leading-none">💊</span>
              </button>
            )}
            <button onClick={() => setShowCrisisShield(true)} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse hover:bg-red-500 hover:text-white transition-all"><Shield className="w-5 h-5 fill-current" /></button>
          </div>
        </div>
      </div>

      {/* [V31.1-1] Round 2 gentle reminder banner */}
      {showRound2Prompt && !showPersonaGrid && (
        <div className="mx-3 mt-2 p-3 bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-xl flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[#39FF14] text-xs font-black">{t('complete_profile')}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{t('profile_prompt')}</p>
          </div>
          <div className="flex gap-2 ml-3">
            <button
              onClick={() => { setOnboardingRound(2); setOnboardingStep(1); setShowRound2Prompt(false); setShowOnboarding(true); }}
              className="px-3 py-1.5 bg-[#39FF14] text-black text-[10px] font-black rounded-lg whitespace-nowrap"
            >
              {t('profile_cta')}
            </button>
            <button
              onClick={() => setShowRound2Prompt(false)}
              className="px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px] font-bold rounded-lg"
            >
              {t('profile_skip')}
            </button>
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
                : msg.sender === 'bot' && (msg as TrustMessage).sentences?.length
                  ? <TrustMessageRenderer msg={msg as TrustMessage} lang={lang} />
                  : msg.content
              }
              {msg.sender === 'bot' && (msg as TrustMessage).checkingNote && (
                <div className="mt-2 flex items-center gap-2 text-blue-300 text-xs animate-pulse">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  {(msg as TrustMessage).checkingNote}
                </div>
              )}
              {msg.sender === 'bot' && (msg.confidenceScore ?? 0) > 0 && msg.id !== streamingMsgId && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1"><span>Confidence</span><span className="text-green-400">{msg.confidenceScore}%</span></div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${msg.confidenceScore}%` }} /></div>
                </div>
              )}
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
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 rounded-tl-none flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO OS v31.1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MED-VAULT UI COMPONENTS
// ============================================================================

function VaultPinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="password" inputMode="numeric" maxLength={4} value={value}
      onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) onChange(e.target.value); }}
      placeholder="····"
      className="w-full text-center text-3xl font-black tracking-[0.5em] bg-white/5 border border-white/20 rounded-2xl py-5 text-white outline-none focus:border-green-400 transition-all"
    />
  );
}

function VaultMedCard({ med }: { med: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
      <span className="text-xl">💊</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">
          {med.name} <span className="text-green-400">{med.dose}</span>
        </p>
        <p className="text-gray-400 text-xs truncate">
          {med.frequency}{med.prescriber ? ` · Dr. ${med.prescriber}` : ''}
        </p>
      </div>
    </div>
  );
}

function VaultSymptomRow({ symptom }: { symptom: any }) {
  const c = symptom.severity === 'severe'   ? 'text-red-400' :
            symptom.severity === 'moderate' ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="flex gap-2 py-2 border-b border-white/5 last:border-0">
      <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${c}`}>●</span>
      <div>
        <p className="text-white text-xs leading-snug">{symptom.description?.slice(0,120)}</p>
        <p className="text-gray-500 text-[10px] mt-0.5">{symptom.date_label}</p>
      </div>
    </div>
  );
}


// ============================================================================
// TRUST LAYER — TrustMessageRenderer
// Renders bot messages sentence-by-sentence with trust indicators.
// Each sentence gets: color glow, icon, confidence %, audit dropdown.
// Accessibility: icons + text (not color alone). Min 44px touch targets.
// ============================================================================

const TRUST_CONFIG: Record<string, {
  icon: string; label: string; labelEs: string;
  glow: string; textColor: string; borderColor: string; bgColor: string;
}> = {
  verified: {
    icon: '✓', label: 'Confirmed by live search', labelEs: 'Confirmado por búsqueda en vivo',
    glow: 'shadow-[0_0_8px_rgba(34,197,94,0.4)]',
    textColor: 'text-green-300', borderColor: 'border-green-500/30', bgColor: 'bg-green-500/10',
  },
  probable: {
    icon: '◆', label: 'Highly likely. Verify before acting', labelEs: 'Muy probable. Verifica antes de actuar',
    glow: '',
    textColor: 'text-yellow-300', borderColor: 'border-yellow-500/20', bgColor: 'bg-yellow-500/5',
  },
  uncertain: {
    icon: '⚠', label: "I can't verify this. Please consult a professional",
    labelEs: 'No puedo verificar esto. Consulta a un profesional',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]',
    textColor: 'text-red-300', borderColor: 'border-red-500/30', bgColor: 'bg-red-500/10',
  },
};

function TrustSentenceItem({ sentence, lang }: { sentence: TrustSentence; lang?: string }) {
  const [auditOpen, setAuditOpen] = React.useState(false);
  const cfg    = TRUST_CONFIG[sentence.trustTier] ?? TRUST_CONFIG.probable;
  const isEs   = lang === 'es';
  const label  = isEs ? cfg.labelEs : cfg.label;
  const hasAudit = Boolean(sentence.audit);

  return (
    <span className="inline">
      {/* Sentence text */}
      <span className={`
        relative inline
        ${sentence.trustTier !== 'probable' ? `rounded px-0.5 ${cfg.bgColor} ${cfg.glow}` : ''}
      `}>
        {sentence.text}{' '}
      </span>

      {/* Trust badge — only show for verified and uncertain */}
      {sentence.trustTier !== 'probable' && (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold ${cfg.textColor}
            border ${cfg.borderColor} rounded-full px-1.5 py-0.5 mx-1 align-middle
            cursor-default select-none`}
          title={label}
          aria-label={label}
        >
          <span aria-hidden="true">{cfg.icon}</span>
          <span className="hidden sm:inline">{sentence.trustTier === 'verified' ? (isEs ? 'Verificado' : 'Verified') : (isEs ? 'Incierto' : 'Uncertain')}</span>
        </span>
      )}

      {/* Audit dropdown — only show if correction was made */}
      {hasAudit && (
        <button
          onClick={() => setAuditOpen(o => !o)}
          className={`inline-flex items-center gap-1 text-[10px] ${cfg.textColor}
            underline underline-offset-2 ml-1 align-middle min-h-[44px] min-w-[44px]
            hover:opacity-80 transition-opacity`}
          aria-expanded={auditOpen}
          aria-label={isEs ? 'Ver por qué se corrigió esto' : 'See why this was corrected'}
        >
          {auditOpen
            ? (isEs ? '▲ Ocultar corrección' : '▲ Hide correction')
            : (isEs ? '▼ Ver corrección' : '▼ See correction')}
        </button>
      )}

      {/* Audit panel */}
      {hasAudit && auditOpen && sentence.audit && (
        <div className={`
          block w-full mt-2 mb-3 p-3 rounded-xl text-xs
          ${cfg.bgColor} border ${cfg.borderColor}
          space-y-1.5 text-left
        `}>
          <div className="font-bold text-white/70 uppercase tracking-wider text-[10px]">
            {isEs ? '🔍 Por qué se corrigió esto' : '🔍 Why this was corrected'}
          </div>
          <div>
            <span className="text-white/50">{isEs ? 'Original: ' : 'Original: '}</span>
            <span className="line-through text-red-300/70">{sentence.audit.original}</span>
          </div>
          {sentence.audit.issue && (
            <div>
              <span className="text-white/50">{isEs ? 'Problema: ' : 'Issue: '}</span>
              <span className="text-yellow-200">{sentence.audit.issue}</span>
            </div>
          )}
          {sentence.audit.correction && (
            <div>
              <span className="text-white/50">{isEs ? 'Corrección: ' : 'Corrected to: '}</span>
              <span className="text-green-300 font-medium">{sentence.audit.correction}</span>
            </div>
          )}
          <div className="text-white/40 text-[10px] pt-1 border-t border-white/10">
            {isEs ? 'Fuente: ' : 'Source: '}{sentence.audit.source_label}
            {' · '}{new Date(sentence.audit.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </span>
  );
}

function TrustMessageRenderer({ msg, lang }: { msg: TrustMessage; lang?: string }) {
  const sentences = msg.sentences ?? [];
  if (!sentences.length) return <span>{msg.content}</span>;

  // Overall message confidence = average of sentence confidences
  const avgConf = Math.round(
    sentences.reduce((sum, s) => sum + s.confidence, 0) / sentences.length
  );
  const hasUncertain = sentences.some(s => s.trustTier === 'uncertain');
  const hasVerified  = sentences.some(s => s.trustTier === 'verified');

  return (
    <div>
      {/* Sentence-by-sentence rendering */}
      <p className="leading-relaxed">
        {sentences.map(s => (
          <TrustSentenceItem key={s.id} sentence={s} lang={lang} />
        ))}
      </p>

      {/* Message-level trust summary bar */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3 flex-wrap">
        {hasVerified && (
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold">
            <span>✓</span> {lang === 'es' ? 'Verificado en vivo' : 'Live verified'}
          </span>
        )}
        {hasUncertain && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
            <span>⚠</span> {lang === 'es' ? 'Verificar antes de actuar' : 'Verify before acting'}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            {lang === 'es' ? 'Confianza' : 'Confidence'}
          </span>
          <span className={`text-[11px] font-black ${
            avgConf >= 90 ? 'text-green-400' :
            avgConf >= 70 ? 'text-yellow-400' : 'text-red-400'
          }`}>{avgConf}%</span>
          <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                avgConf >= 90 ? 'bg-green-500' :
                avgConf >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${avgConf}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
