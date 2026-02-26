/**
 * LYLO OS — chat/useAudioQueue.ts
 * Manages the TTS audio queue.
 * Sentences are enqueued and played back in order.
 * New audio is only fetched when the previous one finishes.
 */
import { useRef, useCallback, useState } from 'react';
import type { AudioQueueEntry } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://lylo-backend.onrender.com';

interface UseAudioQueueOptions {
  userEmail: string;
  persona: string;
  lang: 'en' | 'es';
  onSpeakingChange: (isSpeaking: boolean) => void;
}

export function useAudioQueue({
  userEmail,
  persona,
  lang,
  onSpeakingChange,
}: UseAudioQueueOptions) {
  const queueRef       = useRef<AudioQueueEntry[]>([]);
  const isPlayingRef   = useRef(false);
  const currentAudio   = useRef<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const setSpeaking = useCallback((val: boolean) => {
    setIsSpeaking(val);
    onSpeakingChange(val);
  }, [onSpeakingChange]);

  // ── Fetch audio for a text chunk ──────────────────────────────────────────
  const fetchAudio = useCallback(async (text: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, email: userEmail, persona, lang }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.audio_base64 ?? null;
    } catch {
      return null;
    }
  }, [userEmail, persona, lang]);

  // ── Play the next item in the queue ───────────────────────────────────────
  const playNext = useCallback(async () => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;

    isPlayingRef.current = true;
    setSpeaking(true);

    const entry = queueRef.current.shift()!;
    const b64   = await fetchAudio(entry.text);

    if (!b64) {
      isPlayingRef.current = false;
      if (queueRef.current.length > 0) {
        playNext();
      } else {
        setSpeaking(false);
      }
      return;
    }

    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    currentAudio.current = audio;

    audio.onended = () => {
      isPlayingRef.current = false;
      currentAudio.current = null;
      if (queueRef.current.length > 0) {
        playNext();
      } else {
        setSpeaking(false);
      }
    };

    audio.onerror = () => {
      isPlayingRef.current = false;
      currentAudio.current = null;
      if (queueRef.current.length > 0) {
        playNext();
      } else {
        setSpeaking(false);
      }
    };

    try {
      await audio.play();
    } catch {
      isPlayingRef.current = false;
      setSpeaking(false);
    }
  }, [fetchAudio, setSpeaking]);

  // ── Enqueue sentences ─────────────────────────────────────────────────────
  const enqueue = useCallback((text: string) => {
    // Split into sentences for more natural playback
    const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed.length > 2) {
        queueRef.current.push({ text: trimmed });
      }
    }
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [playNext]);

  // ── Stop everything ───────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    queueRef.current      = [];
    isPlayingRef.current  = false;
    setSpeaking(false);
    try {
      currentAudio.current?.pause();
      currentAudio.current = null;
    } catch {}
  }, [setSpeaking]);

  return { enqueue, stopAll, isSpeaking };
}
