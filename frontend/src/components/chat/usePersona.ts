/**
 * LYLO OS — chat/usePersona.ts
 * Handles persona switching, persona-hook greeting fetch, and bestie config.
 */
import { useState, useCallback } from 'react';
import type { PersonaConfig, BestieConfig, IntakeProfile } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://lylo-backend.onrender.com';

export const PERSONAS: PersonaConfig[] = [
  { id: 'guardian',  label: 'Guardian',       emoji: '🛡️',  color: '#00CFFF', tier: 'free'  },
  { id: 'doctor',    label: 'Doctor',          emoji: '🩺',  color: '#39FF14', tier: 'free'  },
  { id: 'lawyer',    label: 'Lawyer',          emoji: '⚖️',  color: '#FFD700', tier: 'pro'   },
  { id: 'wealth',    label: 'Wealth',          emoji: '💰',  color: '#FFD700', tier: 'pro'   },
  { id: 'therapist', label: 'Therapist',       emoji: '🧠',  color: '#FF69B4', tier: 'free'  },
  { id: 'mechanic',  label: 'Mechanic',        emoji: '🔧',  color: '#FF6B35', tier: 'pro'   },
  { id: 'career',    label: 'Career Coach',    emoji: '💼',  color: '#9B59B6', tier: 'pro'   },
  { id: 'vitality',  label: 'Vitality Coach',  emoji: '⚡',  color: '#00FF87', tier: 'pro'   },
  { id: 'tutor',     label: 'Tutor',           emoji: '📚',  color: '#4FC3F7', tier: 'free'  },
  { id: 'pastor',    label: 'Pastor',          emoji: '✝️',  color: '#F9A825', tier: 'pro'   },
  { id: 'hype',      label: 'Hype Engine',     emoji: '🔥',  color: '#FF1744', tier: 'pro'   },
  { id: 'bestie',    label: 'Bestie',          emoji: '💜',  color: '#CE93D8', tier: 'elite' },
];

interface UsePersonaOptions {
  userEmail: string;
  lang: 'en' | 'es';
  intakeProfile: IntakeProfile | null;
  onGreeting: (text: string) => void;
}

export function usePersona({
  userEmail,
  lang,
  intakeProfile,
  onGreeting,
}: UsePersonaOptions) {
  const [currentPersona, setCurrentPersona] = useState('guardian');
  const [bestieConfig, setBestieConfig]     = useState<BestieConfig | null>(null);
  const [showBestieSetup, setShowBestieSetup] = useState(false);

  // ── Fetch persona greeting from backend ───────────────────────────────────
  const fetchGreeting = useCallback(async (personaId: string) => {
    try {
      const body = new FormData();
      body.append('persona',    personaId);
      body.append('user_email', userEmail);

      const res = await fetch(`${API_BASE}/persona-hook`, {
        method: 'POST',
        body,
      });

      if (!res.ok) return;
      const data = await res.json();

      // Backend returns { hook: "..." }
      const greeting = data.hook || data.greeting;
      if (greeting) {
        onGreeting(greeting);
      }
    } catch (e) {
      console.warn('Persona hook error:', e);
    }
  }, [userEmail, onGreeting]);

  // ── Switch persona ────────────────────────────────────────────────────────
  const switchPersona = useCallback(async (personaId: string) => {
    if (personaId === 'bestie' && !bestieConfig) {
      setShowBestieSetup(true);
      return;
    }
    setCurrentPersona(personaId);
    await fetchGreeting(personaId);
  }, [bestieConfig, fetchGreeting]);

  // ── Save bestie config and switch ─────────────────────────────────────────
  const saveBestieConfig = useCallback(async (config: BestieConfig) => {
    setBestieConfig(config);
    setShowBestieSetup(false);
    setCurrentPersona('bestie');
    await fetchGreeting('bestie');
  }, [fetchGreeting]);

  return {
    currentPersona,
    bestieConfig,
    showBestieSetup,
    setShowBestieSetup,
    switchPersona,
    saveBestieConfig,
  };
}
