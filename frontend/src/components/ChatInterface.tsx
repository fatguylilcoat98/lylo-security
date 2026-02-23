// ============================================================================
// LYLO OS — ChatInterface.tsx
// Version: 30.0.1 — ZERO-LATENCY ARCHITECTURE (STREAMING PARSER FIXED)
// ─────────────────────────────────────────────────────────────────────────────
// V30 Systems:
//
//  [1] AUDIO QUEUE MANAGER (useAudioQueueManager)
//      splitIntoSentences() → sentence[0] TTS fires the instant text arrives
//      Sentences 1-N prefetched in parallel → gapless playback via onended chain
//      Inline audio_b64 from backend used for sentence[0] when available (v29.7)
//
//  [2] BACKGROUND HOOK PREFETCHER
//      All 12 persona hooks fetched silently 800ms after mount
//      Stored in hookCacheRef — persona switch is zero-latency (cache hit)
//      Cache entry invalidated after use → next load fetches fresh
//
//  [3] TAP-TO-BUILD ONBOARDING (5 questions)
//      Occupation → Mission → Roadblock → Relationship → Vibe
//      Auto-advances on tap, skip available, saves to localStorage instantly
//      Non-blocking POST to /user-intake for Pinecone storage
//
//  [4] ADAPTIVE SEAT 9 — The Pastor
//      getPastor(intakeProfile) → Philosopher | Faith Scholar | Base Pastor
//      Driven by mission + roadblock + vibe intake answers
//      "Adapted" badge shown in persona grid when morphed
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import {
  Shield, Wrench, Gavel, Activity, BookOpen, Laugh,
  Mic, MicOff, Volume2, VolumeX, AlertTriangle, CreditCard,
  Zap, Brain, LogOut, X, ArrowRight, Briefcase, Bell, Info,
  ExternalLink, Menu, Image as ImageIcon, Camera as CameraIcon, Type, Lock,
  Compass, Star, Users, Target, Flame, Heart, Sliders, ChevronLeft, ChevronRight,
  CheckCircle,
} from 'lucide-react';

const API_URL = 'https://lylo-backend.onrender.com';

// ============================================================================
// CRISIS LINKS
// ============================================================================
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

// ============================================================================
// TYPES
// ============================================================================
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
  fixedVoice: string;
}

interface BestieConfig {
  gender: 'male' | 'female';
  voiceId: string;
  vibeLabel: string;
}

interface ChatInterfaceProps {
  currentPersona?: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
  onUsageUpdate?: () => void;
}

// V30: User intake profile
interface IntakeProfile {
  occupation: string;
  mission: string;
  roadblock: string;
  relationship: string;
  vibe: string;
}

// V30: Audio queue entry
interface AudioQueueEntry {
  sentence: string;
  audio: HTMLAudioElement | null;
  status: 'pending' | 'fetching' | 'ready' | 'played';
}

// ============================================================================
// BASE PERSONAS
// ============================================================================
const BASE_PERSONAS: PersonaConfig[] = [
  { id: 'guardian',  name: 'The Guardian',         serviceLabel: 'SECURITY LEAD',     description: 'Digital Bodyguard',   protectiveJob: 'Security Lead',  spokenHook: 'Security protocols active. I am monitoring your digital perimeter.',                         briefing: 'Frontline cybersecurity.',         color: 'blue',   requiredTier: 'free',  icon: Shield,    capabilities: ['Scam detection', 'Identity protection'],    fixedVoice: 'onyx'    },
  { id: 'lawyer',    name: 'The Lawyer',            serviceLabel: 'LEGAL SHIELD',      description: 'Justice Partner',     protectiveJob: 'Legal Lead',     spokenHook: 'Legal shield activated. Before you sign anything, let me review the fine print.',          briefing: 'Contract review.',                 color: 'yellow', requiredTier: 'elite', icon: Gavel,     capabilities: ['Contract review', 'Tenant rights'],         fixedVoice: 'fable'   },
  { id: 'doctor',    name: 'The Doctor',            serviceLabel: 'MEDICAL GUIDE',     description: 'Symptom Analyst',     protectiveJob: 'Medical Lead',   spokenHook: 'Digital MD online. I can translate medical jargon or analyze symptoms.',                  briefing: 'Medical explanation.',             color: 'red',    requiredTier: 'pro',   icon: Activity,  capabilities: ['Symptom check', 'Triage'],                  fixedVoice: 'nova'    },
  { id: 'wealth',    name: 'The Wealth Architect',  serviceLabel: 'FINANCE CHIEF',     description: 'Money Strategist',    protectiveJob: 'Finance Lead',   spokenHook: "Let's get your money working. ROI is the only metric that matters.",                     briefing: 'Financial planning.',              color: 'green',  requiredTier: 'elite', icon: CreditCard,capabilities: ['Budgeting', 'Debt destruction'],             fixedVoice: 'onyx'    },
  { id: 'career',    name: 'The Career Strategist', serviceLabel: 'CAREER COACH',      description: 'Professional Growth', protectiveJob: 'Career Lead',    spokenHook: "Let's level up your career. Resume, salary, or politics—I'm here to help you win.",     briefing: 'Career growth strategy.',          color: 'indigo', requiredTier: 'pro',   icon: Briefcase, capabilities: ['Resume optimization', 'Salary negotiation'], fixedVoice: 'shimmer' },
  { id: 'therapist', name: 'The Therapist',         serviceLabel: 'MENTAL WELLNESS',   description: 'Emotional Anchor',    protectiveJob: 'Clinical Lead',  spokenHook: "I'm here to listen. No judgment, just a safe space to process.",                        briefing: 'CBT support.',                     color: 'indigo', requiredTier: 'pro',   icon: Brain,     capabilities: ['Anxiety relief', 'Mood tracking'],          fixedVoice: 'alloy'   },
  { id: 'mechanic',  name: 'The Tech Specialist',   serviceLabel: 'MASTER FIXER',      description: 'Technical Lead',      protectiveJob: 'Technical Lead', spokenHook: "Technical manual loaded. Tell me the issue and I'll walk you through the fix.",          briefing: 'Step-by-step repair guides.',      color: 'gray',   requiredTier: 'pro',   icon: Wrench,    capabilities: ['Car repair', 'Tech troubleshooting'],        fixedVoice: 'echo'    },
  { id: 'tutor',     name: 'The Master Tutor',      serviceLabel: 'KNOWLEDGE BRIDGE',  description: 'Education Lead',      protectiveJob: 'Education Lead', spokenHook: 'Class is in session. I can break down any subject until it clicks.',                     briefing: 'Academic tutoring.',               color: 'purple', requiredTier: 'pro',   icon: Zap,       capabilities: ['Skill acquisition', 'Simplification'],      fixedVoice: 'fable'   },
  { id: 'pastor',    name: 'The Pastor',            serviceLabel: 'FAITH ANCHOR',      description: 'Spiritual Lead',      protectiveJob: 'Spiritual Lead', spokenHook: 'Peace be with you. I am here for prayer, scripture, and moral clarity.',                 briefing: 'Spiritual counseling.',            color: 'gold',   requiredTier: 'pro',   icon: BookOpen,  capabilities: ['Prayer', 'Scripture guidance'],              fixedVoice: 'onyx'    },
  { id: 'vitality',  name: 'The Vitality Coach',    serviceLabel: 'HEALTH OPTIMIZER',  description: 'Fitness & Food',      protectiveJob: 'Wellness Lead',  spokenHook: "Let's optimize your engine. Fuel and movement—what's the goal today?",                 briefing: 'Workout and meal plans.',          color: 'green',  requiredTier: 'max',   icon: Activity,  capabilities: ['Meal planning', 'Habit building'],          fixedVoice: 'nova'    },
  { id: 'hype',      name: 'The Hype Strategist',   serviceLabel: 'CREATIVE DIRECTOR', description: 'Viral Specialist',    protectiveJob: 'Creative Lead',  spokenHook: "Let's make some noise! I'm here for hooks, jokes, and viral strategy.",                briefing: 'Viral content strategy.',          color: 'orange', requiredTier: 'pro',   icon: Laugh,     capabilities: ['Viral hooks', 'Humor'],                      fixedVoice: 'shimmer' },
  { id: 'bestie',    name: 'The Bestie',            serviceLabel: 'RIDE OR DIE',       description: 'Inner Circle',        protectiveJob: 'Loyalty Lead',   spokenHook: "I've got your back, 100%. No filters, no judgment. What's actually going on?",          briefing: 'Blunt life advice.',               color: 'pink',   requiredTier: 'pro',   icon: Heart,     capabilities: ['Venting space', 'Secret keeping'],          fixedVoice: 'nova'    },
];

// V30: Adaptive Seat 9 — alternate identities for The Pastor
const PHILOSOPHER_PERSONA: PersonaConfig = {
  id: 'pastor', name: 'The Philosopher', serviceLabel: 'WISDOM ARCHITECT',
  description: 'Socratic Guide', protectiveJob: 'Philosophy Lead',
  spokenHook: 'Every great decision starts with the right question. Let us reason together.',
  briefing: 'Socratic dialogue and philosophical frameworks.',
  color: 'gold', requiredTier: 'pro', icon: Compass,
  capabilities: ['Critical thinking', 'Ethical frameworks'], fixedVoice: 'onyx',
};
const SCHOLAR_PERSONA: PersonaConfig = {
  id: 'pastor', name: 'The Faith Scholar', serviceLabel: 'MULTI-FAITH ANCHOR',
  description: 'Interfaith Guide', protectiveJob: 'Spiritual Lead',
  spokenHook: 'Faith takes many forms. I honor yours. What truth are you seeking today?',
  briefing: 'Multiple faith traditions with depth and respect.',
  color: 'gold', requiredTier: 'pro', icon: Star,
  capabilities: ['Interfaith dialogue', 'Sacred texts'], fixedVoice: 'onyx',
};

// V30: Resolve which Seat 9 identity to use based on intake answers
const getPastor = (intake: Partial<IntakeProfile>): PersonaConfig => {
  if (intake.vibe === 'academic') return SCHOLAR_PERSONA;
  if (
    intake.mission === 'personal_growth' ||
    intake.roadblock === 'knowledge' ||
    intake.occupation === 'student'
  ) return PHILOSOPHER_PERSONA;
  return BASE_PERSONAS.find(p => p.id === 'pastor')!;
};

// ============================================================================
// VIBE OPTIONS
// ============================================================================
const VIBE_OPTIONS = [
  { value: 'standard',  label: 'Standard',  sublabel: 'Direct & Helpful'        },
  { value: 'chill',     label: 'Chill',     sublabel: 'Conversational & Easy'   },
  { value: 'intense',   label: 'Intense',   sublabel: 'Maximum Urgency'         },
  { value: 'nurturing', label: 'Nurturing', sublabel: 'Warm & Supportive'       },
  { value: 'blunt',     label: 'Blunt',     sublabel: 'Zero Filter, No Padding' },
  { value: 'academic',  label: 'Academic',  sublabel: 'Structured & Cited'      },
];

const LEGACY_VIBE_MAP: Record<string, string> = { roast: 'blunt', business: 'academic' };

// ============================================================================
// V30: TAP-TO-BUILD — 5 Intake Questions
// ============================================================================
const INTAKE_QUESTIONS = [
  {
    id: 'occupation',
    question: 'What do you do for work?',
    subtitle: 'Calibrates your personal AI Task Force.',
    icon: Briefcase,
    accentColor: 'blue',
    options: [
      { label: 'Professional',        emoji: '💼', value: 'professional' },
      { label: 'Entrepreneur',        emoji: '🚀', value: 'entrepreneur' },
      { label: 'Student',             emoji: '🎓', value: 'student'      },
      { label: 'Parent / Caregiver',  emoji: '🏠', value: 'caregiver'    },
      { label: 'Job Seeker',          emoji: '🔍', value: 'job_seeker'   },
      { label: 'Retired',             emoji: '🌅', value: 'retired'      },
    ],
  },
  {
    id: 'mission',
    question: 'Your #1 mission right now?',
    subtitle: 'We route your council around this objective.',
    icon: Target,
    accentColor: 'green',
    options: [
      { label: 'Build Wealth',            emoji: '💰', value: 'build_wealth'    },
      { label: 'Protect My Family',       emoji: '🛡️', value: 'protect_family' },
      { label: 'Advance My Career',       emoji: '📈', value: 'career_growth'   },
      { label: 'Health & Wellness',       emoji: '💪', value: 'health_wellness' },
      { label: 'Legal or Financial Help', emoji: '⚖️', value: 'legal_financial' },
      { label: 'Personal Growth',         emoji: '🌱', value: 'personal_growth' },
    ],
  },
  {
    id: 'roadblock',
    question: "What's standing in your way?",
    subtitle: 'Your council focuses firepower here.',
    icon: Flame,
    accentColor: 'red',
    options: [
      { label: 'Money',              emoji: '💸', value: 'money'        },
      { label: 'Time',               emoji: '⏰', value: 'time'         },
      { label: 'Knowledge',          emoji: '🧠', value: 'knowledge'    },
      { label: 'Stress / Burnout',   emoji: '🔥', value: 'stress'       },
      { label: 'Relationships',      emoji: '💔', value: 'relationships' },
      { label: 'Systems / Red Tape', emoji: '🏛️', value: 'bureaucracy' },
    ],
  },
  {
    id: 'relationship',
    question: 'Relationship status?',
    subtitle: 'Advisors calibrate tone to your situation.',
    icon: Heart,
    accentColor: 'pink',
    options: [
      { label: 'Single',               emoji: '🎯', value: 'single'       },
      { label: 'In a Relationship',    emoji: '💛', value: 'relationship'  },
      { label: 'Married',              emoji: '💍', value: 'married'       },
      { label: 'Divorced / Separated', emoji: '🔓', value: 'divorced'      },
      { label: "It's Complicated",     emoji: '🌀', value: 'complicated'   },
      { label: 'Prefer Not to Say',    emoji: '🔒', value: 'private'       },
    ],
  },
  {
    id: 'vibe',
    question: 'How should your council talk to you?',
    subtitle: 'Every advisor adapts to your style.',
    icon: Sliders,
    accentColor: 'purple',
    options: [
      { label: 'Direct & Helpful',   emoji: '🎯', value: 'standard'  },
      { label: 'Chill & Easy',       emoji: '😎', value: 'chill'     },
      { label: 'Maximum Urgency',    emoji: '⚡', value: 'intense'   },
      { label: 'Warm & Supportive',  emoji: '🌸', value: 'nurturing' },
      { label: 'Zero Filter',        emoji: '🔥', value: 'blunt'     },
      { label: 'Structured & Cited', emoji: '📚', value: 'academic'  },
    ],
  },
];

// ============================================================================
// HELPERS
// ============================================================================
const COLOR_MAP: Record<string, Record<string, string>> = {
  blue:   { border: 'border-blue-400',   glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',  bg: 'bg-blue-500',   text: 'text-blue-400',   selected: 'border-blue-400 bg-blue-500/20',   ring: 'hover:border-blue-400/60 hover:bg-blue-500/10'   },
  orange: { border: 'border-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',  bg: 'bg-orange-500', text: 'text-orange-400', selected: 'border-orange-400 bg-orange-500/20',ring: 'hover:border-orange-400/60 hover:bg-orange-500/10'},
  gold:   { border: 'border-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',   bg: 'bg-yellow-500', text: 'text-yellow-400', selected: 'border-yellow-400 bg-yellow-500/20', ring: 'hover:border-yellow-400/60 hover:bg-yellow-500/10'},
  gray:   { border: 'border-gray-400',   glow: 'shadow-[0_0_20px_rgba(107,114,128,0.3)]', bg: 'bg-gray-500',   text: 'text-gray-400',   selected: 'border-gray-400 bg-gray-500/20',    ring: 'hover:border-gray-400/60 hover:bg-gray-500/10'   },
  yellow: { border: 'border-yellow-300', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',  bg: 'bg-yellow-400', text: 'text-yellow-300', selected: 'border-yellow-300 bg-yellow-400/20', ring: 'hover:border-yellow-300/60 hover:bg-yellow-400/10'},
  purple: { border: 'border-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',  bg: 'bg-purple-500', text: 'text-purple-400', selected: 'border-purple-400 bg-purple-500/20', ring: 'hover:border-purple-400/60 hover:bg-purple-500/10'},
  indigo: { border: 'border-indigo-400', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]',  bg: 'bg-indigo-500', text: 'text-indigo-400', selected: 'border-indigo-400 bg-indigo-500/20', ring: 'hover:border-indigo-400/60 hover:bg-indigo-500/10'},
  pink:   { border: 'border-pink-400',   glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)]',  bg: 'bg-pink-500',   text: 'text-pink-400',   selected: 'border-pink-400 bg-pink-500/20',    ring: 'hover:border-pink-400/60 hover:bg-pink-500/10'   },
  red:    { border: 'border-red-400',    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',   bg: 'bg-red-500',    text: 'text-red-400',    selected: 'border-red-400 bg-red-500/20',       ring: 'hover:border-red-400/60 hover:bg-red-500/10'     },
  green:  { border: 'border-green-400',  glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',   bg: 'bg-green-500',  text: 'text-green-400',  selected: 'border-green-400 bg-green-500/20',   ring: 'hover:border-green-400/60 hover:bg-green-500/10' },
};

const getColor = (color: string, key: string) => COLOR_MAP[color]?.[key] ?? COLOR_MAP.blue[key];

const getDeviceId = () => {
  let id = localStorage.getItem('lylo_device_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'dev_' + Date.now() + Math.random().toString(36).slice(2);
    localStorage.setItem('lylo_device_id', id);
  }
  return id;
};

// V30: Split AI response into TTS-safe sentences
const splitIntoSentences = (text: string): string[] => {
  const clean = text
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
  const parts = clean.match(/[^.!?\n]+(?:[.!?]+["']?(?:\s|$)|\n|$)/g) ?? [clean];
  return parts.map(s => s.trim()).filter(s => s.length > 3);
};

// ============================================================================
// V30 SYSTEM [1]: AUDIO QUEUE MANAGER HOOK
// ============================================================================
// Architecture:
//   enqueue(fullText, voice, inlineAudioB64?)
//     → splitIntoSentences → mark all 'pending'
//     → sentence[0]: if inlineAudioB64 present, construct instantly (zero fetch)
//                    else fire /generate-audio immediately (shortest text = fastest TTS)
//     → sentences[1..N]: prefetch in parallel background tasks
//     → playNext(): find next 'ready' entry → play → on onended → playNext()
//     → if next not ready yet → poll every 100ms until it is (gapless wait)
//   stop(): drain queue, kill current audio, reset speaking state
// ============================================================================
function useAudioQueueManager(
  isVoiceEnabled: boolean,
  onSpeakingChange: (speaking: boolean) => void
) {
  const queueRef        = useRef<AudioQueueEntry[]>([]);
  const isPlayingRef    = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isVoiceRef      = useRef(isVoiceEnabled);
  const speakingCbRef   = useRef(onSpeakingChange);

  useEffect(() => { isVoiceRef.current = isVoiceEnabled; },     [isVoiceEnabled]);
  useEffect(() => { speakingCbRef.current = onSpeakingChange; }, [onSpeakingChange]);

  const fetchSentenceAudio = async (sentence: string, voice: string): Promise<HTMLAudioElement | null> => {
    try {
      const fd = new FormData();
      fd.append('text', sentence);
      fd.append('voice', voice);
      const res  = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.audio_b64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
        audio.preload = 'auto';
        return audio;
      }
    } catch (e) {
      console.warn('[AQM] Sentence fetch failed:', e);
    }
    return null;
  };

  const playNext = useCallback(() => {
    if (!isVoiceRef.current) return;

    const nextReady = queueRef.current.find(e => e.status === 'ready');

    if (!nextReady) {
      const stillFetching = queueRef.current.some(e => e.status === 'fetching' || e.status === 'pending');
      if (!stillFetching) {
        // Queue fully drained
        isPlayingRef.current = false;
        speakingCbRef.current(false);
        console.log('[AQM] Queue exhausted.');
      } else {
        // Wait for background fetch to complete
        setTimeout(playNext, 100);
      }
      return;
    }

    nextReady.status = 'played';
    const audio = nextReady.audio;
    if (!audio) { playNext(); return; }  // null audio → skip silently

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    currentAudioRef.current = audio;
    isPlayingRef.current    = true;
    speakingCbRef.current(true);

    audio.onended = () => playNext();
    audio.play().catch(err => {
      console.warn('[AQM] Play blocked:', err);
      playNext();
    });
  }, []);

  const stop = useCallback(() => {
    queueRef.current = [];
    isPlayingRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    speakingCbRef.current(false);
    console.log('[AQM] Stopped and drained.');
  }, []);

  const enqueue = useCallback(async (
    fullText:       string,
    voice:          string,
    inlineAudioB64?: string
  ) => {
    if (!isVoiceRef.current) return;
    stop();

    const sentences = splitIntoSentences(fullText);
    if (!sentences.length) return;

    console.log(`[AQM] Enqueuing ${sentences.length} sentence(s) → voice: ${voice}`);

    queueRef.current = sentences.map(s => ({
      sentence: s, audio: null, status: 'pending' as const,
    }));

    // ── Sentence 0: instant or fast-fire ─────────────────────────────────────
    queueRef.current[0].status = 'fetching';

    if (inlineAudioB64) {
      // v29.7 inline: backend already generated full audio → use it for first sentence
      const audio = new Audio(`data:audio/mp3;base64,${inlineAudioB64}`);
      audio.preload = 'auto';
      queueRef.current[0].audio  = audio;
      queueRef.current[0].status = 'ready';
      console.log('[AQM] Sentence 0: inline audio_b64 — zero fetch.');
      playNext();
    } else {
      // Fire TTS for just the first sentence (short text = ~300ms latency)
      fetchSentenceAudio(sentences[0], voice).then(audio => {
        if (queueRef.current[0]) {
          queueRef.current[0].audio  = audio;
          queueRef.current[0].status = 'ready';
          console.log('[AQM] Sentence 0: ready — starting playback.');
          playNext();
        }
      });
    }

    // ── Sentences 1..N: prefetch in parallel ──────────────────────────────────
    for (let i = 1; i < sentences.length; i++) {
      const idx = i;
      if (!queueRef.current[idx]) break;
      queueRef.current[idx].status = 'fetching';

      fetchSentenceAudio(sentences[idx], voice).then(audio => {
        if (queueRef.current[idx]) {
          queueRef.current[idx].audio  = audio;
          queueRef.current[idx].status = 'ready';
          console.log(`[AQM] Sentence ${idx} ready.`);
          if (!isPlayingRef.current) playNext();
        }
      });
    }
  }, [stop, playNext]);

  return { enqueue, stop, currentAudioRef };
}

// ============================================================================
// COMPONENT
// ============================================================================
function ChatInterface({
  currentPersona: initialPersona,
  userEmail    = '',
  onPersonaChange = () => {},
  onLogout       = () => {},
  onUsageUpdate  = () => {},
}: ChatInterfaceProps) {

  // ── V30: Intake-aware PERSONAS list ──────────────────────────────────────
  const [intakeProfile, setIntakeProfile] = useState<Partial<IntakeProfile>>({});
  const PERSONAS = BASE_PERSONAS.map(p => p.id === 'pastor' ? getPastor(intakeProfile) : p);

  // Core state
  const [activePersona, setActivePersona]           = useState<PersonaConfig>(() => initialPersona ?? PERSONAS[0]);
  const [messages, setMessages]                     = useState<Message[]>([]);
  const [input, setInput]                           = useState('');
  const [loading, setLoading]                       = useState(false);
  const [userName, setUserName]                     = useState('User');
  const [bestieConfig, setBestieConfig]             = useState<BestieConfig | null>(null);
  const [showBestieSetup, setShowBestieSetup]       = useState(false);
  const [setupStep, setSetupStep]                   = useState<'gender' | 'voice'>('gender');
  const [tempGender, setTempGender]                 = useState<'male' | 'female'>('female');
  const [isRecording, setIsRecording]               = useState(false);
  const [isSpeaking, setIsSpeaking]                 = useState(false);
  const [showDropdown, setShowDropdown]             = useState(false);
  const [showCameraMenu, setShowCameraMenu]         = useState(false);
  const [userTier, setUserTier]                     = useState<'free' | 'pro' | 'elite' | 'max'>('max');
  const [communicationStyle, setCommunicationStyle] = useState('standard');
  const [fontLevel, setFontLevel]                   = useState(1);
  const [isVoiceEnabled, setIsVoiceEnabled]         = useState(true);
  const [readingMode, setReadingMode]               = useState<'sync' | 'instant'>('sync');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedImage, setSelectedImage]           = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]                 = useState<string | null>(null);
  const [showCrisisShield, setShowCrisisShield]     = useState(false);
  const [showPersonaGrid, setShowPersonaGrid]       = useState(true);
  const [showOnboarding, setShowOnboarding]         = useState(false);
  const [onboardingStep, setOnboardingStep]         = useState(0);  // 0 = briefing, 1-5 = questions
  const [deviceId]                                  = useState(() => getDeviceId());
  const [emailConsent, setEmailConsent]             = useState(false);
  const [streamingMsgId, setStreamingMsgId]         = useState<string | null>(null);
  const [streamingText, setStreamingText]           = useState('');

  // PWA
  const [deferredPrompt, setDeferredPrompt]     = useState<any>(null);
  const [installMethod, setInstallMethod]       = useState<'prompt' | 'manual_ios' | 'manual_android'>('manual_android');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [canInstall, setCanInstall]             = useState(false);

  // Refs
  const chatContainerRef   = useRef<HTMLDivElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const photoInputRef      = useRef<HTMLInputElement>(null);
  const recognitionRef     = useRef<any>(null);
  const isRecordingRef     = useRef(false);
  const accumulatedRef     = useRef('');
  const inputTextRef       = useRef('');
  const typewriterRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamingTextRef   = useRef('');
  const pendingAudioRef    = useRef<Promise<HTMLAudioElement | null> | null>(null);

  // V30 System [2]: Hook prefetch cache
  const hookCacheRef      = useRef<Record<string, string>>({});
  const hooksFetchedRef   = useRef(false);

  // V30 System [1]: Audio Queue Manager
  const handleSpeakingChange = useCallback((v: boolean) => setIsSpeaking(v), []);
  const aqm = useAudioQueueManager(isVoiceEnabled, handleSpeakingChange);

  // ── PWA ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as any).standalone === true);
    if (isStandalone) return;
    const alreadySeen = localStorage.getItem('lylo_install_modal_seen');
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setInstallMethod('manual_ios'); setCanInstall(true);
      if (!alreadySeen) setShowInstallModal(true);
    } else {
      const h = (e: any) => {
        e.preventDefault(); setDeferredPrompt(e);
        setInstallMethod('prompt'); setCanInstall(true);
        if (!alreadySeen) setShowInstallModal(true);
      };
      window.addEventListener('beforeinstallprompt', h);
      return () => window.removeEventListener('beforeinstallprompt', h);
    }
  }, []);

  const dismissInstallModal = () => { localStorage.setItem('lylo_install_modal_seen', 'true'); setShowInstallModal(false); };
  const handleInstallClick  = async () => {
    dismissInstallModal();
    if (installMethod === 'prompt' && deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setCanInstall(false);
      setDeferredPrompt(null);
    } else if (installMethod === 'manual_ios') {
      alert('APPLE SECURE INSTALL:\n\n1. Tap the Share icon (square with up arrow).\n2. Tap "Add to Home Screen".');
    } else {
      alert('ANDROID SECURE INSTALL:\n\n1. Tap the 3 dots in Chrome.\n2. Tap "Install app" or "Add to Home screen".');
    }
  };

  // ── Hydrate preferences ───────────────────────────────────────────────────
  useEffect(() => {
    const emailRaw   = userEmail.toLowerCase();
    const storedName = localStorage.getItem('userName');
    const storedTier = localStorage.getItem('userTier') as any;
    if (storedName) setUserName(storedName);
    else if (emailRaw.includes('stangman')) setUserName('Christopher');
    if (storedTier) setUserTier(storedTier);
    const savedBestie = localStorage.getItem('lylo_bestie_config');
    if (savedBestie) setBestieConfig(JSON.parse(savedBestie));
    const rawStyle = localStorage.getItem('lylo_communication_style');
    if (rawStyle) {
      const migrated = LEGACY_VIBE_MAP[rawStyle] ?? rawStyle;
      if (migrated !== rawStyle) localStorage.setItem('lylo_communication_style', migrated);
      setCommunicationStyle(migrated);
    }
    const savedFont = localStorage.getItem('lylo_font_level');
    if (savedFont) setFontLevel(parseInt(savedFont, 10));
    const savedVoice = localStorage.getItem('lylo_voice_enabled');
    if (savedVoice !== null) setIsVoiceEnabled(savedVoice === 'true');
    const savedMode = localStorage.getItem('lylo_reading_mode');
    if (savedMode === 'sync' || savedMode === 'instant') setReadingMode(savedMode as any);
    if ('Notification' in window && Notification.permission === 'granted') setNotificationsEnabled(true);

    // Load saved intake
    const savedIntake = localStorage.getItem(`lylo_intake_${emailRaw}`);
    if (savedIntake) {
      const parsed: Partial<IntakeProfile> = JSON.parse(savedIntake);
      setIntakeProfile(parsed);
      if (parsed.vibe) setCommunicationStyle(parsed.vibe);
    }

    const hasOnboarded = localStorage.getItem(`lylo_onboarded_${emailRaw}`);
    if (!hasOnboarded) setShowOnboarding(true);
  }, [userEmail]);

  // ── V30 System [2]: Background Hook Prefetcher ────────────────────────────
  // Fires 800ms after mount. Fetches all 12 persona hooks in parallel.
  // On persona switch → cache hit = instant; cache miss = live fetch (rare).
  // Cache entry deleted after use so each press gets a fresh hook next time.
  useEffect(() => {
    if (!userEmail || hooksFetchedRef.current) return;
    hooksFetchedRef.current = true;

    const prefetchAll = async () => {
      console.log('[HOOKS] Starting background prefetch for all personas...');
      await Promise.allSettled(
        BASE_PERSONAS.map(async persona => {
          try {
            const fd = new FormData();
            fd.append('persona',    persona.id);
            fd.append('user_email', userEmail);
            const res = await Promise.race([
              fetch(`${API_URL}/persona-hook`, { method: 'POST', body: fd }),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
            ]) as Response;
            if (res.ok) {
              const data = await res.json();
              if (data.hook) {
                hookCacheRef.current[persona.id] = data.hook;
                console.log(`[HOOKS] ✓ ${persona.id}`);
              }
            }
          } catch {
            console.log(`[HOOKS] ${persona.id} — static fallback.`);
          }
        })
      );
      console.log('[HOOKS] Prefetch complete.');
    };

    const timer = setTimeout(prefetchAll, 800);
    return () => clearTimeout(timer);
  }, [userEmail]);

  // ── Hardware back-button lock ─────────────────────────────────────────────
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; return ''; };
    const lock     = () => window.history.pushState(null, '', window.location.href);
    const onPop    = () => {
      window.history.pushState(null, '', window.location.href);
      if (showOnboarding)        return;
      if (showDropdown)          { setShowDropdown(false); return; }
      if (showCameraMenu)        { setShowCameraMenu(false); return; }
      if (showCrisisShield)      { setShowCrisisShield(false); return; }
      if (!showPersonaGrid)      { handleInternalBack(); return; }
      alert('Use the Logout button to exit securely.');
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('popstate', onPop);
    lock();
    return () => { window.removeEventListener('beforeunload', onUnload); window.removeEventListener('popstate', onPop); };
  }, [showPersonaGrid, showOnboarding, showDropdown, showCameraMenu, showCrisisShield]);

  useEffect(() => {
    if (chatContainerRef.current)
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages, previewUrl]);

  useEffect(() => {
    const lastBot = [...messages].reverse().find(m => m.sender === 'bot');
    if (!lastBot || !(lastBot as any).actionTrigger) return;
    requestAnimationFrame(() => {
      if (chatContainerRef.current)
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    });
  }, [messages, streamingMsgId]);

  useEffect(() => {
    if (!selectedImage) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  // ── Legacy single-audio play (sync mode typewriter) ───────────────────────
  const playAudioSafely = (audio: HTMLAudioElement) => {
    aqm.stop();
    setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.play().catch(e => console.warn('[AUDIO] Blocked:', e));
  };

  // ── Typewriter (sync mode) ────────────────────────────────────────────────
  const animateSynced = (text: string, msgId: string, audioEl: HTMLAudioElement | null) => {
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
    streamingTextRef.current = '';
    setStreamingText('');

    if (readingMode === 'instant') {
      setStreamingMsgId(null);
      if (audioEl && isVoiceEnabled) playAudioSafely(audioEl);
      return;
    }

    const startTyping = (msPerChar: number) => {
      let i = 0;
      typewriterRef.current = setInterval(() => {
        i++;
        const slice = text.slice(0, i);
        streamingTextRef.current = slice;
        setStreamingText(slice);
        if (i >= text.length) {
          clearInterval(typewriterRef.current!);
          typewriterRef.current = null;
          setStreamingMsgId(null);
          setStreamingText('');
        }
      }, msPerChar);
    };

    if (audioEl && isVoiceEnabled) {
      const kick = () => {
        const ms = Math.max(18, (audioEl.duration * 1000) / text.length);
        playAudioSafely(audioEl);
        startTyping(ms);
      };
      if (isFinite(audioEl.duration) && audioEl.duration > 0) { kick(); }
      else {
        audioEl.addEventListener('loadedmetadata', kick, { once: true });
        setTimeout(() => { if (streamingTextRef.current === '') { startTyping(28); audioEl.play().catch(() => {}); } }, 1200);
      }
    } else {
      startTyping(28);
    }
  };

  // ── V29.6: Mic Hard-Reset ─────────────────────────────────────────────────
  const buildRecognition = (): any => {
    const SR = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;
    if (!SR) { console.warn('[MIC] API unavailable.'); return null; }
    console.log('[MIC] Building fresh instance...');
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US';
    rec.onstart  = () => console.log('[MIC] Hardware mic active.');
    rec.onresult = (e: any) => {
      if (isSpeaking) return;
      let interim = '', final = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript;
        else                      interim += e.results[i][0].transcript;
      }
      if (final) accumulatedRef.current += final + ' ';
      const full = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim();
      setInput(full); inputTextRef.current = full;
    };
    rec.onerror = (e: any) => {
      console.error(`[MIC] Error: ${e.error}`);
      if (e.error === 'not-allowed') {
        alert('Microphone blocked. Check browser site settings.'); isRecordingRef.current = false; setIsRecording(false);
      } else if (e.error === 'network') {
        isRecordingRef.current = false; setIsRecording(false);
      } else if (isRecordingRef.current) {
        setTimeout(() => { if (isRecordingRef.current) { recognitionRef.current = buildRecognition(); recognitionRef.current?.start(); } }, 150);
      }
    };
    rec.onend = () => {
      if (isRecordingRef.current && !isSpeaking) { recognitionRef.current = buildRecognition(); recognitionRef.current?.start(); }
    };
    return rec;
  };

  const handleWalkieTalkieMic = () => {
    if (isRecording) {
      isRecordingRef.current = false; setIsRecording(false);
      try { recognitionRef.current?.stop(); } catch {}
      recognitionRef.current = null;
      setTimeout(() => { if (inputTextRef.current.trim()) handleSend(); }, 400);
    } else {
      if (isSpeaking) return;
      setIsRecording(true); isRecordingRef.current = true;
      setInput(''); accumulatedRef.current = ''; inputTextRef.current = '';
      recognitionRef.current = buildRecognition();
      if (!recognitionRef.current) { setIsRecording(false); isRecordingRef.current = false; return; }
      try { recognitionRef.current.start(); }
      catch { setIsRecording(false); isRecordingRef.current = false; recognitionRef.current = null; }
    }
  };

  // ── HANDLE SEND (V30 STREAMING PARSER) ────────────────────────────────────
  const handleSend = async () => {
    const text = (inputTextRef.current.trim() || input.trim());
    if (!text && !selectedImage) return;
    
    if (typewriterRef.current) { 
      clearInterval(typewriterRef.current); 
      typewriterRef.current = null; 
      setStreamingMsgId(null); 
    }

    setLoading(true); 
    setInput(''); 
    inputTextRef.current = ''; 
    accumulatedRef.current = '';
    setShowPersonaGrid(false);

    const imgPreview = previewUrl;
    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: text || 'Analyzing image…', 
      sender: 'user', 
      timestamp: new Date(), 
      imageUrl: imgPreview 
    };
    setMessages(prev => [...prev, userMsg]);

    const botMsgId = `bot-${Date.now()}`;
    const voiceToUse = activePersona.id === 'bestie' ? (bestieConfig?.voiceId ?? 'nova') : activePersona.fixedVoice;

    try {
      const fd = new FormData();
      fd.append('msg',                  text);
      fd.append('history',              JSON.stringify(messages.slice(-6)));
      fd.append('persona',              activePersona.id);
      fd.append('user_email',           userEmail);
      fd.append('user_location',        '');
      fd.append('vibe',                 communicationStyle);
      fd.append('use_long_term_memory', 'true');
      fd.append('device_id',            deviceId);
      fd.append('email_consent',        emailConsent ? 'true' : 'false');
      fd.append('voice',                voiceToUse);
      if (selectedImage) fd.append('file', selectedImage);

      // 1. Create the empty bot message instantly on screen
      setMessages(prev => [...prev, {
        id: botMsgId, content: '', sender: 'bot' as const, timestamp: new Date()
      }]);

      setStreamingMsgId(botMsgId);
      setStreamingText('');

      // 2. Fetch the stream
      const apiRes = await fetch(`${API_URL}/chat`, { method: 'POST', body: fd });
      if (!apiRes.ok) throw new Error('API error');
      if (!apiRes.body) throw new Error('No readable stream');

      setLoading(false); // Stop the loading dots, stream is starting

      // 3. Setup the Stream Reader
      const reader = apiRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let fullAnswer = '';
      let metaData: any = null;

      // 4. Read the firehose chunk by chunk
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'text') {
                  // Accumulate text and type it on screen instantly
                  fullAnswer += (fullAnswer ? ' ' : '') + data.content;
                  setStreamingText(fullAnswer);
                } else if (data.type === 'meta') {
                  // Catch the final metadata (buttons, audio, confidence)
                  metaData = data;
                }
              } catch (err) {
                // Safely ignore incomplete JSON chunks from buffer splits
              }
            }
          }
        }
      }

      // 5. Stream Complete - Finalize UI
      setStreamingMsgId(null);
      setStreamingText('');

      const isLockout = metaData?.threat_level === 'high' && fullAnswer.includes('DEVICE LIMIT EXCEEDED');

      // Lock in the final message with action buttons and confidence score
      setMessages(prev => prev.map(m => m.id === botMsgId ? {
        ...m,
        content: fullAnswer,
        confidenceScore: metaData?.confidence_score,
        scamDetected: metaData?.scam_detected,
        actionTrigger: metaData?.action_trigger ?? null,
      } : m));

      if (isLockout) return;

      // 6. Trigger Audio
      if (isVoiceEnabled) {
        if (readingMode === 'instant') {
           // Fire the Audio Queue Manager using the inline audio generated by backend
           await aqm.enqueue(fullAnswer, voiceToUse, metaData?.audio_b64 ?? undefined);
        } else {
           let audioEl: HTMLAudioElement | null = null;
           if (metaData?.audio_b64) {
             audioEl = new Audio(`data:audio/mp3;base64,${metaData.audio_b64}`);
             audioEl.preload = 'auto';
           }
           animateSynced(fullAnswer, botMsgId, audioEl);
        }
      }

    } catch (e) {
      console.error('Stream failed:', e);
      setStreamingMsgId(null);
      setLoading(false);
    } finally {
      setSelectedImage(null);
      setEmailConsent(false);
    }
  };

  // ── V30: Persona hook — cache hit = instant, miss = live fetch ────────────
  const getPersonaHook = async (persona: PersonaConfig): Promise<string> => {
    if (hookCacheRef.current[persona.id]) {
      console.log(`[HOOKS] Cache hit — ${persona.id}`);
      const hook = hookCacheRef.current[persona.id];
      delete hookCacheRef.current[persona.id];  // invalidate: fresh next time
      return hook;
    }
    console.log(`[HOOKS] Cache miss — fetching ${persona.id}...`);
    try {
      const fd = new FormData();
      fd.append('persona', persona.id); fd.append('user_email', userEmail);
      const res = await Promise.race([
        fetch(`${API_URL}/persona-hook`, { method: 'POST', body: fd }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500)),
      ]) as Response;
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      return data.hook || persona.spokenHook;
    } catch {
      return persona.spokenHook;
    }
  };

  // ── Persona change ────────────────────────────────────────────────────────
  const handlePersonaChange = async (persona: PersonaConfig) => {
    if (persona.id === 'bestie' && !bestieConfig) { setShowBestieSetup(true); return; }
    aqm.stop();
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; setStreamingMsgId(null); }
    setActivePersona(persona); onPersonaChange(persona);
    setShowDropdown(false); setShowPersonaGrid(false); setLoading(true);

    const voiceToUse = persona.id === 'bestie' ? (bestieConfig?.voiceId ?? 'nova') : persona.fixedVoice;
    const hookText   = await getPersonaHook(persona);
    const hookMsgId  = `hook-${Date.now()}`;

    if (readingMode === 'sync' && isVoiceEnabled) { setStreamingMsgId(hookMsgId); setStreamingText(''); }
    setMessages([{ id: hookMsgId, content: hookText, sender: 'bot' as const, timestamp: new Date() }]);
    setLoading(false);

    if (isVoiceEnabled) {
      if (readingMode === 'instant') {
        setStreamingMsgId(null);
        await aqm.enqueue(hookText, voiceToUse);
      } else {
        try {
          const fd = new FormData();
          fd.append('text', hookText); fd.append('voice', voiceToUse);
          const res  = await fetch(`${API_URL}/generate-audio`, { method: 'POST', body: fd });
          const data = await res.json();
          if (data.audio_b64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
            audio.preload = 'auto';
            animateSynced(hookText, hookMsgId, audio);
          } else { animateSynced(hookText, hookMsgId, null); }
        } catch { animateSynced(hookText, hookMsgId, null); }
      }
    }
  };

  const handleBestieSetupComplete = (voiceId: string) => {
    const cfg: BestieConfig = { gender: tempGender, voiceId, vibeLabel: tempGender === 'male' ? 'The Bro' : 'The Bestie' };
    setBestieConfig(cfg);
    localStorage.setItem('lylo_bestie_config', JSON.stringify(cfg));
    setShowBestieSetup(false);
    const bp = PERSONAS.find(p => p.id === 'bestie');
    if (bp) handlePersonaChange(bp);
  };

  const handleInternalBack = () => { setMessages([]); setShowPersonaGrid(true); aqm.stop(); setIsSpeaking(false); };

  const cycleFontSize = () => {
    const next = fontLevel >= 4 ? 1 : fontLevel + 1;
    setFontLevel(next); localStorage.setItem('lylo_font_level', String(next));
  };

  const bailoutTypewriter = () => {
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
    setStreamingMsgId(null); setStreamingText('');
  };

  const requestMobileAlerts = async () => {
    if (!('Notification' in window)) { alert('Push notifications not supported.'); return; }
    if (Notification.permission === 'granted') { setNotificationsEnabled(true); return; }
    const p = await Notification.requestPermission();
    if (p === 'granted') { setNotificationsEnabled(true); new Notification('LYLO Alerts Active 🛡️', { body: 'Mission reminders enabled.', icon: '/icon-192.png' }); }
    else setNotificationsEnabled(false);
  };

  const scheduleMobileReminder = (msg: string, minutes = 30) => {
    if (!notificationsEnabled || Notification.permission !== 'granted') {
      requestMobileAlerts().then(() => {
        if (Notification.permission === 'granted')
          setTimeout(() => new Notification('⏰ LYLO Reminder', { body: msg, icon: '/icon-192.png' }), minutes * 60000);
      });
      return;
    }
    setTimeout(() => new Notification('⏰ LYLO Reminder', { body: msg, icon: '/icon-192.png' }), minutes * 60000);
    new Notification(`✅ Reminder Set — ${minutes} min`, { body: `"${msg.slice(0, 80)}..."`, icon: '/icon-192.png' });
  };

  const handleEmailDispatch = async (content: string) => {
    try {
      const fd = new FormData();
      fd.append('user_email', userEmail); fd.append('content', content); fd.append('persona', activePersona.id);
      const res = await fetch(`${API_URL}/dispatch-email`, { method: 'POST', body: fd });
      if (res.ok) { alert('🛡️ Tactical Report dispatched.'); return; }
    } catch {}
    window.open(`mailto:${userEmail}?subject=${encodeURIComponent(`LYLO Report — ${activePersona.name}`)}&body=${encodeURIComponent(content)}`, '_blank');
  };

  const toggleVoice = () => {
    const next = !isVoiceEnabled;
    setIsVoiceEnabled(next); localStorage.setItem('lylo_voice_enabled', String(next));
    if (!next) { aqm.stop(); setIsSpeaking(false); }
  };

  const handleVibeChange = (v: string) => { setCommunicationStyle(v); localStorage.setItem('lylo_communication_style', v); };

  // ── V30: Save intake answer → localStorage + Pinecone ────────────────────
  const saveIntakeAnswer = async (questionId: string, value: string) => {
    const updated = { ...intakeProfile, [questionId]: value };
    setIntakeProfile(updated);
    localStorage.setItem(`lylo_intake_${userEmail.toLowerCase()}`, JSON.stringify(updated));
    if (questionId === 'vibe') { setCommunicationStyle(value); localStorage.setItem('lylo_communication_style', value); }
    // Non-blocking POST to backend for Pinecone storage
    try {
      const fd = new FormData();
      fd.append('user_email',   userEmail);
      fd.append('question_id',  questionId);
      fd.append('value',        value);
      fd.append('full_profile', JSON.stringify(updated));
      fetch(`${API_URL}/user-intake`, { method: 'POST', body: fd }).catch(() => {});
    } catch {}
  };

  const completeOnboarding = () => {
    localStorage.setItem(`lylo_onboarded_${userEmail.toLowerCase()}`, 'true');
    setShowOnboarding(false);
  };

  const getDynamicFontSize = () => {
    switch (fontLevel) {
      case 2: return 'text-lg leading-relaxed';
      case 3: return 'text-2xl leading-relaxed tracking-wide';
      case 4: return 'text-4xl leading-loose tracking-wide font-black';
      default: return 'text-sm leading-normal';
    }
  };

  const getInputFontSize = () => {
    switch (fontLevel) { case 2: return 'text-lg'; case 3: return 'text-xl'; case 4: return 'text-2xl'; default: return 'text-sm'; }
  };

  // ===========================================================================
  // V30 SYSTEM [3]: TAP-TO-BUILD ONBOARDING
  // 5 Questions: Occupation → Mission → Roadblock → Relationship → Vibe
  // Auto-advances 200ms after tap. Skip always available. Progress bar animated.
  // ===========================================================================
  if (showOnboarding) {
    const TOTAL   = INTAKE_QUESTIONS.length;  // 5
    const isQ     = onboardingStep >= 1 && onboardingStep <= TOTAL;
    const currentQ = isQ ? INTAKE_QUESTIONS[onboardingStep - 1] : null;
    const progress = onboardingStep === 0 ? 0 : Math.round((onboardingStep / (TOTAL + 1)) * 100);

    return (
      <div className="fixed inset-0 bg-[#080808] flex flex-col items-center justify-center p-4 z-[999999] overflow-y-auto">

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/5 blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[250px] h-[250px] rounded-full bg-indigo-600/4 blur-[80px]" />
        </div>

        <div className="w-full max-w-md relative z-10">

          {/* Progress bar */}
          <div className="w-full h-[2px] bg-white/5 rounded-full mb-7 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── Step 0: System Briefing ──────────────────────────────────── */}
          {onboardingStep === 0 && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.12)]">
                  <Shield className="w-10 h-10 text-blue-400" />
                </div>
                <h1 className="text-white font-black text-3xl uppercase tracking-[0.15em] leading-none mb-2">
                  L<span className="text-blue-400">Y</span>LO OS
                </h1>
                <p className="text-blue-400/60 text-xs font-bold uppercase tracking-[0.3em]">Security Clearance Granted</p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  { icon: Brain,       color: 'text-purple-400', label: 'Dual-Brain AI',    desc: 'GPT-4o + Gemini race. You get the fastest, highest-confidence answer.' },
                  { icon: CheckCircle, color: 'text-green-400',  label: 'Truth Protocol',   desc: 'LYLO will not fabricate. Tactical truth or we ask for more intel.'      },
                  { icon: Lock,        color: 'text-blue-400',   label: 'Ironclad Privacy', desc: 'Cryptographically hashed. Never sold. Never used to train public AI.'    },
                  { icon: Users,       color: 'text-orange-400', label: '12-Seat Council',  desc: 'Legal. Medical. Financial. Spiritual. One OS. No subscriptions per seat.'},
                ].map(({ icon: Icon, color, label, desc }) => (
                  <div key={label} className="flex items-start gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                    <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                    <div>
                      <p className="text-white font-bold text-sm leading-none mb-1">{label}</p>
                      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setOnboardingStep(1)}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase rounded-2xl tracking-[0.15em] flex justify-center items-center gap-3 hover:bg-blue-500 transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(59,130,246,0.25)]"
              >
                Build My Profile <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-gray-600 text-xs mt-4 uppercase tracking-widest font-bold">5 questions · 30 seconds</p>
            </div>
          )}

          {/* ── Steps 1–5: Tap-to-Build Questions ───────────────────────── */}
          {isQ && currentQ && (() => {
            const Icon    = currentQ.icon;
            const scheme  = COLOR_MAP[currentQ.accentColor] ?? COLOR_MAP.blue;
            const current = intakeProfile[currentQ.id as keyof IntakeProfile];

            return (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <span className={`text-xs font-black uppercase tracking-[0.2em] ${scheme.text}`}>
                  Question {onboardingStep} of {TOTAL}
                </span>
                <h2 className="text-white font-black text-2xl leading-tight mt-1 mb-1">{currentQ.question}</h2>
                <p className="text-gray-500 text-xs mb-6 leading-relaxed">{currentQ.subtitle}</p>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  {currentQ.options.map(opt => {
                    const isSelected = current === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={async () => {
                          await saveIntakeAnswer(currentQ.id, opt.value);
                          setTimeout(() => {
                            if (onboardingStep < TOTAL) setOnboardingStep(s => s + 1);
                            else setTimeout(completeOnboarding, 400);
                          }, 180);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all duration-100 active:scale-[0.96] ${
                          isSelected
                            ? scheme.selected
                            : `bg-white/[0.03] border-white/[0.08] ${scheme.ring}`
                        }`}
                      >
                        <div className="text-xl mb-2 leading-none">{opt.emoji}</div>
                        <div className="text-white font-bold text-xs leading-snug">{opt.label}</div>
                      </button>
                    );
                  })()}
                </div>

                <div className="flex gap-3">
                  {onboardingStep > 1 && (
                    <button
                      onClick={() => setOnboardingStep(s => s - 1)}
                      className="px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold text-sm flex items-center gap-2 hover:bg-white/10 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                  )}
                  <button
                    onClick={() => { if (onboardingStep < TOTAL) setOnboardingStep(s => s + 1); else completeOnboarding(); }}
                    className="flex-1 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                  >
                    Skip <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // INSTALL MODAL
  // ===========================================================================
  const InstallModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999998] flex items-end justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#111] border border-blue-500/40 rounded-3xl w-full max-w-sm p-6 mb-4 shadow-[0_0_60px_rgba(59,130,246,0.2)] animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 mb-5">
          <div className="p-3 bg-blue-600 rounded-2xl"><Shield className="w-7 h-7 text-white" /></div>
          <div>
            <h2 className="text-white font-black text-lg uppercase tracking-widest leading-none">Install LYLO OS</h2>
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mt-1">Add to Home Screen</p>
          </div>
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

  // ===========================================================================
  // MAIN OS SHELL
  // ===========================================================================
  return (
    <div className="fixed inset-0 bg-black flex flex-col h-screen w-screen overflow-hidden font-sans z-[99999]">

      {showInstallModal && <InstallModal />}

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="bg-black/90 border-b border-white/10 p-3 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">

          {/* Left */}
          <div className="relative flex gap-2 z-10">
            {!showPersonaGrid && (
              <button onClick={handleInternalBack} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors">
              <Menu className="w-5 h-5" />
            </button>

            {showDropdown && (
              <div className="absolute top-14 left-0 bg-black/95 border border-white/10 rounded-2xl p-5 min-w-[280px] shadow-2xl z-[100001] max-h-[80vh] overflow-y-auto">
                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase font-black mb-3">Communication Style</p>
                  <select value={communicationStyle} onChange={e => handleVibeChange(e.target.value)} className="w-full bg-white/10 text-white p-3 rounded-xl font-bold mb-4">
                    {VIBE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="mb-6 space-y-3">
                  <button onClick={cycleFontSize} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3"><Type className="w-5 h-5 text-blue-400" /><span className="font-bold">Text Size</span></div>
                    <span className="text-xs font-black uppercase tracking-widest text-gray-400">Level {fontLevel}</span>
                  </button>
                  <button onClick={toggleVoice} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">{isVoiceEnabled ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}<span className="font-bold">Voice Output</span></div>
                    <span className={`text-xs font-black uppercase tracking-widest ${isVoiceEnabled ? 'text-green-400' : 'text-red-400'}`}>{isVoiceEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                  <button onClick={() => { setShowDropdown(false); setShowOnboarding(true); setOnboardingStep(0); }} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3"><Info className="w-5 h-5 text-blue-400" /><span className="font-bold">Rebuild My Profile</span></div>
                  </button>
                  {canInstall && (
                    <button onClick={() => { setShowDropdown(false); handleInstallClick(); }} className="w-full p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl text-white flex items-center justify-between hover:bg-blue-600/20 transition-colors">
                      <div className="flex items-center gap-3"><ArrowRight className="w-5 h-5 text-blue-400" /><span className="font-bold">Install LYLO OS</span></div>
                      <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Home Screen</span>
                    </button>
                  )}
                </div>
                <button onClick={onLogout} className="w-full p-4 text-red-500 font-black uppercase flex items-center justify-center gap-2 border border-red-500/20 rounded-xl">
                  <LogOut className="w-4 h-4" /> Terminate Session
                </button>
              </div>
            )}
          </div>

          {/* Center: Logo */}
          <div className="text-center absolute left-1/2 -translate-x-1/2 w-1/3">
            <h1 className="text-white font-black text-2xl tracking-[0.2em] leading-none">
              L<span className={getColor(activePersona.color, 'text')}>Y</span>LO
            </h1>
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.3em] mt-1 truncate">{activePersona.serviceLabel}</p>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 z-10">
            <div className="flex flex-col items-end justify-center mr-1">
              <p className="text-white font-black text-[10px] uppercase leading-none max-w-[70px] truncate">{userName}</p>
              <p className="text-[8px] text-green-500 font-black mt-1 uppercase tracking-widest">{userTier}</p>
            </div>
            <button onClick={requestMobileAlerts} title={notificationsEnabled ? 'Alerts Active' : 'Enable Alerts'}
              className={`p-3 rounded-xl transition-all ${notificationsEnabled ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500 hover:text-white' : 'bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10 hover:text-white'}`}>
              <Bell className="w-5 h-5" />
            </button>
            <button onClick={() => setShowCrisisShield(true)}
              className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse hover:bg-red-500 hover:text-white transition-all">
              <Shield className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CRISIS SHIELD ────────────────────────────────────────────────────── */}
      {showCrisisShield && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100002] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-red-500/50 rounded-3xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-red-500 fill-current" />
                <div><h2 className="text-white font-black text-xl uppercase tracking-widest">Emergency Hub</h2>
                  <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-1">Direct Federal & Professional Links</p></div>
              </div>
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

      {/* ── BESTIE SETUP MODAL ───────────────────────────────────────────────── */}
      {showBestieSetup && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100005] flex items-center justify-center p-4">
          <div className="bg-pink-900/20 border border-pink-500/30 rounded-3xl w-full max-w-sm p-6 shadow-[0_0_50px_rgba(236,72,153,0.15)] text-center">
            <Heart className="w-12 h-12 text-pink-400 mx-auto mb-4 fill-current" />
            <h2 className="text-white font-black text-2xl uppercase tracking-widest mb-2">Build Your Bestie</h2>
            <p className="text-gray-400 text-sm mb-6">Who do you want in your corner?</p>
            {setupStep === 'gender' && (
              <div className="space-y-4">
                <button onClick={() => { setTempGender('female'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 hover:border-pink-400 rounded-2xl text-white font-bold transition-all">The Girls (Female)</button>
                <button onClick={() => { setTempGender('male'); setSetupStep('voice'); }} className="w-full p-5 bg-white/5 border border-white/10 hover:border-blue-400 rounded-2xl text-white font-bold transition-all">The Bros (Male)</button>
              </div>
            )}
            {setupStep === 'voice' && tempGender === 'female' && (
              <div className="space-y-3">
                <p className="text-xs text-pink-300 uppercase tracking-widest font-bold mb-2">Select Her Voice</p>
                <button onClick={() => handleBestieSetupComplete('nova')}    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Nova (Warm & Upbeat)</button>
                <button onClick={() => handleBestieSetupComplete('shimmer')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Shimmer (Clear & Direct)</button>
                <button onClick={() => handleBestieSetupComplete('alloy')}   className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Alloy (Neutral & Calm)</button>
              </div>
            )}
            {setupStep === 'voice' && tempGender === 'male' && (
              <div className="space-y-3">
                <p className="text-xs text-blue-300 uppercase tracking-widest font-bold mb-2">Select His Voice</p>
                <button onClick={() => handleBestieSetupComplete('onyx')}  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Onyx (Deep & Serious)</button>
                <button onClick={() => handleBestieSetupComplete('echo')}  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Echo (Warm & Friendly)</button>
                <button onClick={() => handleBestieSetupComplete('fable')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white">Fable (Expressive & British)</button>
              </div>
            )}
            <button onClick={() => { setShowBestieSetup(false); setSetupStep('gender'); }} className="mt-6 text-gray-500 text-xs font-bold uppercase">Cancel</button>
          </div>
        </div>
      )}

      {/* ── CHAT AREA ────────────────────────────────────────────────────────── */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative p-4 space-y-6" style={{ paddingBottom: previewUrl ? '420px' : '320px' }}>

        {/* V30 System [4]: Persona grid — Seat 9 shows "Adapted" badge when morphed */}
        {showPersonaGrid && (
          <div className="grid grid-cols-2 gap-3">
            {PERSONAS.map(p => {
              const isBase    = BASE_PERSONAS.find(b => b.id === p.id)?.name === p.name;
              const isAdapted = p.id === 'pastor' && !isBase;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePersonaChange(p)}
                  className={`p-6 rounded-3xl border flex flex-col items-center gap-3 transition-all ${
                    activePersona.id === p.id
                      ? `${getColor(p.color, 'bg')} border-transparent`
                      : 'bg-white/5 border-white/10 hover:bg-white/8'
                  }`}
                >
                  <p.icon className={`w-8 h-8 ${activePersona.id === p.id ? 'text-white' : getColor(p.color, 'text')}`} />
                  <div className="text-center">
                    <span className="text-[10px] text-white font-black uppercase tracking-widest block leading-tight">{p.name}</span>
                    {isAdapted && (
                      <span className="text-[8px] text-yellow-400/80 font-bold uppercase tracking-widest mt-1 block">Adapted ✦</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.imageUrl && (
              <div className="mb-2 max-w-[85%] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                <img src={msg.imageUrl} alt="Uploaded" className="w-full h-auto object-cover max-h-[300px]" />
              </div>
            )}
            <div className={`p-5 rounded-3xl max-w-[85%] ${getDynamicFontSize()} shadow-lg ${
              msg.sender === 'user'
                ? `${getColor(activePersona.color, 'bg')} text-white font-bold rounded-tr-none`
                : 'bg-white/10 text-gray-100 border border-white/10 rounded-tl-none'
            }`}>
              {msg.sender === 'bot' && msg.id === streamingMsgId
                ? <span>{streamingText}<span className="inline-block w-[2px] h-[1em] bg-current ml-[1px] align-middle animate-pulse opacity-70" /></span>
                : msg.content
              }
              {msg.sender === 'bot' && msg.confidenceScore && msg.id !== streamingMsgId && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1">
                    <span>Confidence</span><span className="text-green-400">{msg.confidenceScore}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${msg.confidenceScore}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {msg.sender === 'bot' && (msg as any).actionTrigger && (
              <div className="mt-3 mb-3 w-full max-w-[85%] space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {(msg as any).actionTrigger === 'email_dispatch' && (
                  <button onClick={() => handleEmailDispatch(msg.content)}
                    className="w-full py-4 px-6 bg-gradient-to-r from-indigo-700 to-indigo-600 border border-indigo-400/50 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(99,102,241,0.35)] hover:from-indigo-600 hover:to-indigo-500 transition-all active:scale-[0.98]">
                    <Shield className="w-4 h-4 fill-current flex-shrink-0" /> Dispatch Tactical Report to Email
                  </button>
                )}
                {(msg as any).actionTrigger === 'set_reminder' && (
                  <button onClick={() => scheduleMobileReminder(msg.content.length > 120 ? msg.content.slice(0, 120) + '…' : msg.content)}
                    className="w-full py-4 px-6 bg-gradient-to-r from-violet-700 to-violet-600 border border-violet-400/50 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(139,92,246,0.35)] hover:from-violet-600 hover:to-violet-500 transition-all active:scale-[0.98]">
                    <Bell className="w-4 h-4 flex-shrink-0" /> Set Mobile Reminder — 30 Min
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 rounded-tl-none flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms'   }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM INPUT BAR ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 p-4 z-[100] pb-10">

        {previewUrl && (
          <div className="absolute bottom-[100%] left-0 right-0 flex flex-col items-center pb-4 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-3 w-full max-w-md px-4">
              <div className="flex items-center justify-between bg-indigo-900/90 backdrop-blur-xl border border-indigo-500/50 p-3 rounded-xl w-full shadow-[0_0_30px_rgba(79,70,229,0.3)] animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-400" /><span className="text-[10px] text-white font-black uppercase tracking-widest">Send Copy to Email?</span></div>
                <button onClick={() => setEmailConsent(!emailConsent)} className={`w-10 h-5 rounded-full transition-all relative ${emailConsent ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${emailConsent ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="relative animate-in slide-in-from-bottom-2">
                <img src={previewUrl} className="w-24 h-24 object-cover rounded-2xl border-2 border-indigo-500 shadow-2xl" alt="Preview" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-400 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-md mx-auto space-y-3">

          {/* Row 1: Mic + Mode + Voice */}
          <div className="flex gap-2">
            <button onClick={handleWalkieTalkieMic} disabled={loading}
              className={`flex-1 py-5 rounded-[28px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.97] ${
                isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-white text-black hover:bg-gray-100'
              } ${loading ? 'opacity-40 cursor-not-allowed' : ''}`}>
              {isRecording ? <><MicOff className="w-5 h-5" /> Tap to Send</> : <><Mic className="w-5 h-5" /> Hold to Speak</>}
            </button>

            {/* Reading mode */}
            <button
              onClick={async () => {
                if (streamingMsgId) {
                  bailoutTypewriter();
                  if (pendingAudioRef.current && isVoiceEnabled) {
                    const audio = await pendingAudioRef.current;
                    pendingAudioRef.current = null;
                    if (audio) playAudioSafely(audio);
                  }
                }
                const next = readingMode === 'sync' ? 'instant' : 'sync';
                setReadingMode(next); localStorage.setItem('lylo_reading_mode', next);
              }}
              className="px-4 py-5 rounded-[28px] flex flex-col items-center justify-center gap-0.5 font-black text-[9px] uppercase tracking-widest transition-all active:scale-[0.97] bg-white/10 border border-white/10 hover:bg-white/15 min-w-[56px]"
              title={readingMode === 'sync' ? 'Sync mode — tap for Fast' : 'Fast mode — tap for Sync'}
            >
              {readingMode === 'sync'
                ? <><Type className="w-4 h-4 text-indigo-400" /><span className="text-indigo-400">Sync</span></>
                : <><Zap className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400">Fast</span></>
              }
            </button>

            {/* Speaker */}
            <button
              onClick={() => { if (streamingMsgId) bailoutTypewriter(); toggleVoice(); }}
              className={`px-4 py-5 rounded-[28px] flex flex-col items-center justify-center gap-0.5 font-black text-[9px] uppercase tracking-widest transition-all active:scale-[0.97] min-w-[56px] ${
                isVoiceEnabled ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-white/10 text-gray-400 border border-white/10'
              }`}
            >
              {isVoiceEnabled ? <><Volume2 className="w-4 h-4" /><span>On</span></> : <><VolumeX className="w-4 h-4" /><span>Off</span></>}
            </button>
          </div>

          {/* Row 2: Camera + Input + Send */}
          <div className="flex gap-2">
            <div className="relative">
              <button onClick={() => setShowCameraMenu(!showCameraMenu)} disabled={loading}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-colors h-full flex items-center disabled:opacity-50">
                <CameraIcon className="w-6 h-6" />
              </button>
              {showCameraMenu && (
                <div className="absolute bottom-16 left-0 bg-[#111] border border-white/10 rounded-2xl p-2 min-w-[180px] shadow-2xl z-[100003] animate-in slide-in-from-bottom-2">
                  <button onClick={() => { photoInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full p-4 flex items-center gap-3 text-white font-bold text-sm hover:bg-white/5 rounded-xl transition-colors">
                    <CameraIcon className="w-5 h-5 text-blue-400" /> Take Photo
                  </button>
                  <div className="h-px w-full bg-white/5 my-1" />
                  <button onClick={() => { fileInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full p-4 flex items-center gap-3 text-white font-bold text-sm hover:bg-white/5 rounded-xl transition-colors">
                    <ImageIcon className="w-5 h-5 text-purple-400" /> Upload Image
                  </button>
                </div>
              )}
            </div>

            <input ref={fileInputRef}  type="file" className="hidden" accept="image/*"                       onChange={e => setSelectedImage(e.target.files?.[0] ?? null)} />
            <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={e => setSelectedImage(e.target.files?.[0] ?? null)} />

            <input
              value={input}
              onChange={e => { setInput(e.target.value); inputTextRef.current = e.target.value; }}
              disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder={`Type to ${activePersona.name}…`}
              className={`flex-1 bg-white/10 border border-white/10 rounded-2xl px-5 py-4 ${getInputFontSize()} text-white outline-none font-bold min-w-0 disabled:opacity-50`}
            />

            <button onClick={handleSend} disabled={loading}
              className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-500 transition-colors flex items-center justify-center disabled:opacity-50">
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 text-[8px] text-gray-500 font-black uppercase tracking-widest">
              <AlertTriangle className="w-2.5 h-2.5" /> AI can make mistakes. Verify critical info.
            </div>
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">LYLO OS v30.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
