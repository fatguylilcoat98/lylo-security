/**
 * LYLO OS — chat/useVoice.ts
 * Hold-to-speak voice input hook.
 *
 * ECHO BUG FIXED (Session 8):
 *   - rec.continuous = false  → stops after one utterance, no infinite accumulation
 *   - loop starts at e.resultIndex → only processes NEW results, not all previous ones
 */
import { useRef, useCallback } from 'react';

interface UseVoiceOptions {
  lang: 'en' | 'es';
  isSpeaking: boolean;
  onTranscript: (text: string) => void;
  onInterim: (text: string) => void;
  onRecordingChange: (isRecording: boolean) => void;
}

export function useVoice({
  lang,
  isSpeaking,
  onTranscript,
  onInterim,
  onRecordingChange,
}: UseVoiceOptions) {
  const recognitionRef    = useRef<any>(null);
  const isRecordingRef    = useRef(false);
  const accumulatedRef    = useRef('');

  // ── Build a fresh SpeechRecognition instance ─────────────────────────────
  const buildRecognition = useCallback((): any => {
    const SR =
      (window as any).webkitSpeechRecognition ??
      (window as any).SpeechRecognition;
    if (!SR) return null;

    const rec = new SR();

    // FIX 1: continuous=false stops after one utterance — no infinite accumulation
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = lang === 'es' ? 'es-US' : 'en-US';

    rec.onresult = (e: any) => {
      if (isSpeaking) return;

      let interim = '';
      let final   = '';

      // FIX 2: start at e.resultIndex — only process NEW results, not all previous
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }

      if (final) {
        accumulatedRef.current += final + ' ';
      }

      const full = (accumulatedRef.current + interim)
        .replace(/\s+/g, ' ')
        .trim();

      onInterim(full);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        alert('Microphone access blocked. Please allow microphone in browser settings.');
        isRecordingRef.current = false;
        onRecordingChange(false);
      } else if (e.error === 'network') {
        isRecordingRef.current = false;
        onRecordingChange(false);
      }
      // 'no-speech' and 'aborted' are normal — don't do anything
    };

    rec.onend = () => {
      // continuous=false: onend fires naturally after silence
      // Restart only if user is still holding the button
      if (isRecordingRef.current) {
        setTimeout(() => {
          if (isRecordingRef.current) {
            try {
              recognitionRef.current = buildRecognition();
              recognitionRef.current?.start();
            } catch {}
          }
        }, 100);
      }
    };

    return rec;
  }, [lang, isSpeaking, onInterim, onRecordingChange]);

  // ── Start recording (button press) ────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;

    accumulatedRef.current    = '';
    isRecordingRef.current    = true;
    onRecordingChange(true);

    recognitionRef.current = buildRecognition();
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn('Voice start error:', e);
    }
  }, [buildRecognition, onRecordingChange]);

  // ── Stop recording (button release) ───────────────────────────────────────
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    onRecordingChange(false);

    try {
      recognitionRef.current?.stop();
    } catch {}

    // Return whatever was accumulated
    const final = accumulatedRef.current.trim();
    accumulatedRef.current = '';
    if (final) {
      onTranscript(final);
    }
  }, [onTranscript, onRecordingChange]);

  return { startRecording, stopRecording, isRecordingRef };
}
