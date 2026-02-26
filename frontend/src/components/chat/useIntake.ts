/**
 * LYLO OS — chat/useIntake.ts
 * Onboarding intake flow — saves answers to backend, tracks rounds.
 */
import { useState, useCallback } from 'react';
import type { IntakeProfile } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://lylo-backend.onrender.com';

interface UseIntakeOptions {
  userEmail: string;
  onIntakeComplete: (profile: IntakeProfile) => void;
}

export function useIntake({ userEmail, onIntakeComplete }: UseIntakeOptions) {
  const [intakeProfile, setIntakeProfile]   = useState<IntakeProfile | null>(null);
  const [intakeRound,   setIntakeRound]     = useState(1);
  const [intakeStep,    setIntakeStep]      = useState(0);
  const [intakeAnswers, setIntakeAnswers]   = useState<Record<string, string>>({});
  const [intakeLoading, setIntakeLoading]   = useState(false);
  const [intakeError,   setIntakeError]     = useState('');
  const [showIntake,    setShowIntake]      = useState(false);

  // ── Load existing profile from backend ───────────────────────────────────
  const loadIntakeProfile = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/get-intake/${encodeURIComponent(userEmail)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const profile = data.profile ?? null;
      if (profile) {
        setIntakeProfile(profile);
        setIntakeRound(profile.intake_round ?? 1);
      }
      return profile;
    } catch {
      return null;
    }
  }, [userEmail]);

  // ── Save a single answer ──────────────────────────────────────────────────
  const saveAnswer = useCallback((key: string, value: string) => {
    setIntakeAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Submit round to backend ───────────────────────────────────────────────
  const submitRound = useCallback(async (round: number, answers: Record<string, string>) => {
    setIntakeLoading(true);
    setIntakeError('');
    try {
      const res = await fetch(`${API_BASE}/user-intake`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       userEmail,
          round_number: round,
          answers,
        }),
      });
      if (!res.ok) throw new Error('Intake save failed');
      const data = await res.json();
      const updated = data.profile ?? answers;
      setIntakeProfile(updated);

      if (round === 1) {
        // Advance to round 2
        setIntakeRound(2);
        setIntakeStep(0);
        setIntakeAnswers({});
      } else {
        // Intake complete
        setShowIntake(false);
        onIntakeComplete(updated);
      }
      return updated;
    } catch (e: any) {
      setIntakeError(e.message ?? 'Failed to save answers');
      return null;
    } finally {
      setIntakeLoading(false);
    }
  }, [userEmail, onIntakeComplete]);

  // ── Step navigation ───────────────────────────────────────────────────────
  const nextStep = useCallback(() => setIntakeStep(s => s + 1), []);
  const prevStep = useCallback(() => setIntakeStep(s => Math.max(0, s - 1)), []);

  return {
    intakeProfile,
    intakeRound,
    intakeStep,
    intakeAnswers,
    intakeLoading,
    intakeError,
    showIntake, setShowIntake,
    loadIntakeProfile,
    saveAnswer,
    submitRound,
    nextStep,
    prevStep,
  };
}
