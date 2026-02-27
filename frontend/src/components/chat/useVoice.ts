/**
 * LYLO OS — chat/useVoice.ts
 * Fixed: single send on stop, no double-fire
 */
import { useRef, useCallback } from 'react';

interface UseVoiceOptions {
  lang:              'en' | 'es';
  isSpeaking:        boolean;
  onTranscript:      (text: string) => void;
  onInterim:         (text: string) => void;
  onRecordingChange: (isRecording: boolean) => void;
}

export function useVoice({ lang, isSpeaking, onTranscript, onInterim, onRecordingChange }: UseVoiceOptions) {
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const accumulatedRef = useRef('');
  const sentRef        = useRef(false); // guard against double-send

  const buildRecognition = useCallback((): any => {
    const SR = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = lang === 'es' ? 'es-US' : 'en-US';

    rec.onresult = (e: any) => {
      if (isSpeaking) return;
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript;
        else                      interim += e.results[i][0].transcript;
      }
      if (final) accumulatedRef.current += final + ' ';
      const full = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim();
      onInterim(full);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        alert('Microphone access blocked. Please allow microphone in browser settings.');
      }
      isRecordingRef.current = false;
      onRecordingChange(false);
    };

    rec.onend = () => {
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

  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    accumulatedRef.current = '';
    sentRef.current        = false;
    isRecordingRef.current = true;
    onRecordingChange(true);
    recognitionRef.current = buildRecognition();
    try { recognitionRef.current?.start(); } catch (e) { console.warn('Voice start error:', e); }
  }, [buildRecognition, onRecordingChange]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    onRecordingChange(false);
    try { recognitionRef.current?.stop(); } catch {}

    // Only fire transcript ONCE using the sent guard
    if (!sentRef.current) {
      sentRef.current = true;
      const final = accumulatedRef.current.trim();
      accumulatedRef.current = '';
      if (final) onTranscript(final);
    }
  }, [onTranscript, onRecordingChange]);

  return { startRecording, stopRecording, isRecordingRef };
}