/**
 * LYLO OS — chat/useVault.ts
 * All Med-Vault state management and API calls.
 * Import this hook into ChatInterface — never scatter vault logic in the component.
 */
import { useState, useCallback } from 'react';
import type {
  MedVaultSummary, VaultView, VaultSetupStep,
} from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://lylo-backend.onrender.com';

interface UseVaultOptions {
  userEmail: string;
  persona: string;
}

export function useVault({ userEmail, persona }: UseVaultOptions) {
  // ── Vault state ───────────────────────────────────────────────────────────
  const [vaultOpen,      setVaultOpen]      = useState(false);
  const [vaultView,      setVaultView]      = useState<VaultView>('menu');
  const [vaultSetupOpen, setVaultSetupOpen] = useState(false);
  const [vaultSetupStep, setVaultSetupStep] = useState<VaultSetupStep>('intro');
  const [vaultPin,       setVaultPin]       = useState('');
  const [vaultPinConfirm, setVaultPinConfirm] = useState('');
  const [vaultSummary,   setVaultSummary]   = useState<MedVaultSummary | null>(null);
  const [vaultLoading,   setVaultLoading]   = useState(false);
  const [vaultError,     setVaultError]     = useState('');
  const [scanResult,     setScanResult]     = useState<any>(null);
  const [pdfConfirmOpen, setPdfConfirmOpen] = useState(false);
  const [remindersOpen,  setRemindersOpen]  = useState(false);
  const [reminderTimes,  setReminderTimes]  = useState<string[]>([]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const apiPost = useCallback(async (path: string, body: object): Promise<any> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.json();
  }, []);

  // ── Setup vault with PIN ──────────────────────────────────────────────────
  const setupVault = useCallback(async (pin: string) => {
    setVaultLoading(true);
    setVaultError('');
    try {
      await apiPost('/vault/setup', { email: userEmail, pin });
      setVaultPin(pin);
      setVaultSetupStep('complete');
    } catch (e: any) {
      setVaultError(e.message ?? 'Setup failed');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail]);

  // ── Load vault summary ────────────────────────────────────────────────────
  const loadVaultSummary = useCallback(async (pin: string) => {
    setVaultLoading(true);
    setVaultError('');
    try {
      const data = await apiPost('/vault/get-summary', {
        email: userEmail,
        pin,
        persona,
      });
      setVaultSummary(data.summary ?? null);
      setVaultPin(pin);
      setVaultOpen(true);
    } catch (e: any) {
      setVaultError(e.message ?? 'Failed to load vault');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail, persona]);

  // ── Scan medication from image ────────────────────────────────────────────
  const scanMedication = useCallback(async (file: File) => {
    setVaultLoading(true);
    setVaultError('');
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res((reader.result as string).split(',')[1]);
        reader.onerror = () => rej(new Error('Read failed'));
        reader.readAsDataURL(file);
      });
      const data = await apiPost('/vault/scan-medication', {
        email:  userEmail,
        pin:    vaultPin,
        image:  b64,
        persona,
      });
      setScanResult(data.medication ?? null);
    } catch (e: any) {
      setVaultError(e.message ?? 'Scan failed');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail, vaultPin, persona]);

  // ── Add medication ────────────────────────────────────────────────────────
  const addMedication = useCallback(async (med: object) => {
    setVaultLoading(true);
    try {
      await apiPost('/vault/add-medication', {
        email:      userEmail,
        pin:        vaultPin,
        medication: med,
      });
      await loadVaultSummary(vaultPin);
    } catch (e: any) {
      setVaultError(e.message ?? 'Failed to add medication');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail, vaultPin, loadVaultSummary]);

  // ── Add doctor question ───────────────────────────────────────────────────
  const addQuestion = useCallback(async (question: string) => {
    setVaultLoading(true);
    try {
      await apiPost('/vault/add-question', {
        email:    userEmail,
        pin:      vaultPin,
        question,
      });
      await loadVaultSummary(vaultPin);
    } catch (e: any) {
      setVaultError(e.message ?? 'Failed to save question');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail, vaultPin, loadVaultSummary]);

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const generatePdf = useCallback(async () => {
    setVaultLoading(true);
    setPdfConfirmOpen(false);
    try {
      const data = await apiPost('/vault/generate-pdf', {
        email: userEmail,
        pin:   vaultPin,
      });
      if (data.pdf_url) {
        window.open(data.pdf_url, '_blank');
      }
    } catch (e: any) {
      setVaultError(e.message ?? 'PDF generation failed');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail, vaultPin]);

  // ── Save reminder times ───────────────────────────────────────────────────
  const saveReminders = useCallback(async (times: string[]) => {
    setVaultLoading(true);
    try {
      await apiPost('/vault/set-reminders', {
        email:          userEmail,
        pin:            vaultPin,
        reminder_times: times,
      });
      setReminderTimes(times);
      setRemindersOpen(false);
    } catch (e: any) {
      setVaultError(e.message ?? 'Failed to save reminders');
    } finally {
      setVaultLoading(false);
    }
  }, [apiPost, userEmail, vaultPin]);

  return {
    // State
    vaultOpen, setVaultOpen,
    vaultView, setVaultView,
    vaultSetupOpen, setVaultSetupOpen,
    vaultSetupStep, setVaultSetupStep,
    vaultPin, setVaultPin,
    vaultPinConfirm, setVaultPinConfirm,
    vaultSummary,
    vaultLoading,
    vaultError, setVaultError,
    scanResult, setScanResult,
    pdfConfirmOpen, setPdfConfirmOpen,
    remindersOpen, setRemindersOpen,
    reminderTimes,
    // Actions
    setupVault,
    loadVaultSummary,
    scanMedication,
    addMedication,
    addQuestion,
    generatePdf,
    saveReminders,
  };
}
