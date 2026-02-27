/**
 * LYLO OS — chat/useAudioQueue.ts
 * Fixed: FormData (not JSON), audio_b64 (not audio_base64), typewriter default
 */
import { useRef, useCallback, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, '')
  ?? 'https://lylo-backend.onrender.com';

// Per-persona OpenAI voice assignments
const PERSONA_VOICES: Record<string, string> = {
  guardian:  'onyx',
  doctor:    'nova',
  lawyer:    'alloy',
  wealth:    'echo',
  therapist: 'shimmer',
  career:    'alloy',
  tutor:     'nova',
  vitality:  'echo',
  hype:      'onyx',
  bestie:    'shimmer',
  pastor:    'fable',
  mechanic:  'onyx',
};

interface UseAudioQueueOptions {
  userEmail: string;
  persona:   string;
  lang:      'en' | 'es';
  onSpeakingChange: (isSpeaking: boolean) => void;
}

export function useAudioQueue({ userEmail, persona, lang, onSpeakingChange }: UseAudioQueueOptions) {
  const queueRef     = useRef<{ text: string }[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const personaRef   = useRef(persona);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Keep personaRef in sync so audio always uses current persona voice
  personaRef.current = persona;

  const setSpeaking = useCallback((val: boolean) => {
    setIsSpeaking(val);
    onSpeakingChange(val);
  }, [onSpeakingChange]);

  const fetchAudio = useCallback(async (text: string): Promise<string | null> => {
    try {
      const voice = PERSONA_VOICES[personaRef.current] ?? 'onyx';
      const form = new FormData();
      form.append('text',  text);
      form.append('voice', voice);

      const res = await fetch(`${API_BASE}/generate-audio`, { method: 'POST', body: form });
      if (!res.ok) return null;
      const data = await res.json();
      // Backend returns audio_b64
      return data.audio_b64 ?? data.audio_base64 ?? null;
    } catch {
      return null;
    }
  }, []);

  const playNext = useCallback(async () => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setSpeaking(true);

    const entry = queueRef.current.shift()!;
    const b64   = await fetchAudio(entry.text);

    const advance = () => {
      isPlayingRef.current  = false;
      currentAudio.current  = null;
      if (queueRef.current.length > 0) playNext();
      else setSpeaking(false);
    };

    if (!b64) { advance(); return; }

    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    currentAudio.current = audio;
    audio.onended = advance;
    audio.onerror = advance;
    try { await audio.play(); } catch { advance(); }
  }, [fetchAudio, setSpeaking]);

  const enqueue = useCallback((text: string) => {
    const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    for (const s of sentences) {
      if (s.trim().length > 2) queueRef.current.push({ text: s.trim() });
    }
    if (!isPlayingRef.current) playNext();
  }, [playNext]);

  const stopAll = useCallback(() => {
    queueRef.current     = [];
    isPlayingRef.current = false;
    setSpeaking(false);
    try { currentAudio.current?.pause(); currentAudio.current = null; } catch {}
  }, [setSpeaking]);

  return { enqueue, stopAll, isSpeaking };
}
