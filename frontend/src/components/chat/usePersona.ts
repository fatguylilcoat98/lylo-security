/**
 * LYLO OS — chat/usePersona.ts
 * Fixed: FormData (not JSON), reads 'hook' not 'greeting',
 * onGreeting APPENDS instead of replacing messages.
 */
import { useState, useCallback } from 'react';
import type { BestieConfig, IntakeProfile } from '../../types';

const API_BASE = (
  (import.meta.env.VITE_API_URL as string) ||
  (import.meta.env.VITE_BACKEND_URL as string) ||
  'https://lylo-backend.onrender.com'
).replace(/\/$/, '');

export interface PersonaConfig {
  id: string; label: string; emoji: string; color: string; tier: string;
}

export const PERSONAS: PersonaConfig[] = [
  { id: 'guardian',  label: 'Guardian',  emoji: '🛡️', color: '#00CFFF', tier: 'free'  },
  { id: 'doctor',    label: 'Doctor',    emoji: '🩺',  color: '#39FF14', tier: 'free'  },
  { id: 'lawyer',    label: 'Lawyer',    emoji: '⚖️', color: '#FFD700', tier: 'pro'   },
  { id: 'wealth',    label: 'Wealth',    emoji: '💰',  color: '#FFD700', tier: 'pro'   },
  { id: 'therapist', label: 'Therapist', emoji: '🧠',  color: '#FF69B4', tier: 'free'  },
  { id: 'mechanic',  label: 'Mechanic',  emoji: '🔧',  color: '#FF6B35', tier: 'pro'   },
  { id: 'career',    label: 'Career',    emoji: '💼',  color: '#9B59B6', tier: 'pro'   },
  { id: 'vitality',  label: 'Vitality',  emoji: '⚡',  color: '#00FF87', tier: 'pro'   },
  { id: 'tutor',     label: 'Tutor',     emoji: '📚',  color: '#4FC3F7', tier: 'free'  },
  { id: 'pastor',    label: 'Pastor',    emoji: '✝️', color: '#F9A825', tier: 'pro'   },
  { id: 'hype',      label: 'Hype',      emoji: '🔥',  color: '#FF1744', tier: 'pro'   },
  { id: 'bestie',    label: 'Bestie',    emoji: '💜',  color: '#CE93D8', tier: 'elite' },
];

interface UsePersonaOptions {
  userEmail:     string;
  lang:          'en' | 'es';
  intakeProfile: IntakeProfile | null;
  onGreeting:    (text: string) => void;
}

export function usePersona({ userEmail, lang, intakeProfile, onGreeting }: UsePersonaOptions) {
  const [currentPersona,  setCurrentPersona]  = useState('guardian');
  const [bestieConfig,    setBestieConfig]     = useState<BestieConfig | null>(null);
  const [showBestieSetup, setShowBestieSetup]  = useState(false);

  const fetchGreeting = useCallback(async (personaId: string) => {
    try {
      // Use FormData — backend expects Form(...)
      const form = new FormData();
      form.append('persona',    personaId);
      form.append('user_email', userEmail);

      const res = await fetch(`${API_BASE}/persona-hook`, { method: 'POST', body: form });
      if (!res.ok) return;

      const data = await res.json();
      // Backend returns 'hook', fallback to 'greeting' for compatibility
      const text = data.hook ?? data.greeting ?? '';
      if (text) onGreeting(text);
    } catch (e) {
      console.warn('[LYLO] Persona hook error:', e);
    }
  }, [userEmail, onGreeting]);

  const switchPersona = useCallback(async (personaId: string) => {
    if (personaId === 'bestie' && !bestieConfig) {
      setShowBestieSetup(true);
      return;
    }
    setCurrentPersona(personaId);
    await fetchGreeting(personaId);
  }, [bestieConfig, fetchGreeting]);

  const saveBestieConfig = useCallback(async (config: BestieConfig) => {
    setBestieConfig(config);
    setShowBestieSetup(false);
    setCurrentPersona('bestie');
    await fetchGreeting('bestie');
  }, [fetchGreeting]);

  return {
    currentPersona, bestieConfig,
    showBestieSetup, setShowBestieSetup,
    switchPersona, saveBestieConfig,
  };
}
