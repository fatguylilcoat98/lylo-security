/**
 * LYLO OS — types/index.ts
 * All shared TypeScript interfaces and types.
 * Add new types here. Never scatter them across component files.
 */

// ── Trust Layer ───────────────────────────────────────────────────────────────
export type TrustTier = 'GREEN' | 'YELLOW' | 'RED' | 'BLUE';

export interface TrustSentence {
  text: string;
  tier: TrustTier;
  flags: string[];
  confidence: number;
  source?: string;
  verified_claim?: boolean;
}

export interface TrustAudit {
  overall_tier: TrustTier;
  sentences: TrustSentence[];
  summary: string;
  action_required?: string;
}

export interface TrustMessage {
  role: 'user' | 'assistant';
  content: string;
  trust_audit?: TrustAudit;
  persona?: string;
  timestamp?: number;
}

// ── Med-Vault ─────────────────────────────────────────────────────────────────
export interface VaultMedication {
  name: string;
  dose: string;
  frequency: string;
  prescriber?: string;
  condition?: string;
  start_date?: string;
  notes?: string;
  interactions?: string[];
}

export interface VaultQuestion {
  question: string;
  for_doctor?: string;
  category?: string;
  created_at?: string;
  answered?: boolean;
}

export interface VaultSymptom {
  symptom: string;
  severity?: number;
  duration?: string;
  triggers?: string;
  logged_at?: string;
}

export interface MedVaultSummary {
  medications: VaultMedication[];
  questions: VaultQuestion[];
  symptoms: VaultSymptom[];
  reactions: string[];
  silo_label?: string;
  last_updated?: string;
}

export type VaultSetupStep = 'intro' | 'pin' | 'confirm' | 'complete';
export type VaultView = 'menu' | 'medications' | 'questions' | 'symptoms' | 'pdf' | 'reminders' | 'scan';

// ── Persona / Bestie ──────────────────────────────────────────────────────────
export interface PersonaConfig {
  id: string;
  label: string;
  emoji: string;
  color: string;
  tier: 'free' | 'pro' | 'elite' | 'max';
  description?: string;
}

export interface BestieConfig {
  name: string;
  relationship: string;
  energy: string;
  topics: string[];
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  trust_audit?: TrustAudit;
  persona?: string;
  timestamp: number;
  image_url?: string;
}

export interface AudioQueueEntry {
  text: string;
  voice?: string;
  priority?: number;
}

// ── Intake / Onboarding ───────────────────────────────────────────────────────
export interface IntakeProfile {
  // Round 1 — identity
  round1_preferred_name?: string;
  preferred_name?: string;
  round1_age_range?: string;
  round1_primary_concern?: string;
  round1_living_situation?: string;
  round1_tech_comfort?: string;
  // Round 2 — depth
  round2_health_conditions?: string;
  round2_medications?: string;
  round2_faith?: string;
  round2_top_goals?: string;
  round2_trusted_contacts?: string;
  round2_language_pref?: string;
  // Meta
  intake_complete?: boolean;
  intake_round?: number;
  completed_at?: string;
}

// ── Component Props ───────────────────────────────────────────────────────────
export interface ChatInterfaceProps {
  userEmail: string;
  userName?: string;
  userTier?: string;
  lang?: 'en' | 'es';
  onSignOut?: () => void;
}
