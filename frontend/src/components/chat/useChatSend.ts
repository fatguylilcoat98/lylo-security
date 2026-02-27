import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, TrustAudit, IntakeProfile, BestieConfig } from '../../types';

// Reads VITE_API_URL or VITE_BACKEND_URL (whichever is set in Render)
const API_BASE = (
  (import.meta.env.VITE_API_URL as string) ||
  (import.meta.env.VITE_BACKEND_URL as string) ||
  'https://lylo-backend.onrender.com'
).replace(/\/$/, '');

interface UseChatSendOptions {
  userEmail:     string;
  persona:       string;
  lang:          'en' | 'es';
  intakeProfile: IntakeProfile | null;
  bestieConfig:  BestieConfig | null;
  vaultPin?:     string;
  onAudio:       (text: string) => void;
  onEmergency?:  (protocol: any) => void;
}

export function useChatSend({
  userEmail, persona, lang,
  intakeProfile, bestieConfig, vaultPin,
  onAudio, onEmergency,
}: UseChatSendOptions) {
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [input,        setInput]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState('');
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const sessionContentRef = useRef<string[]>([]);
  const inputTextRef      = useRef('');

  const appendSessionContent = useCallback((t: string) => {
    sessionContentRef.current.push(t);
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null); setImagePreview(null);
  }, []);

  const handleImageSelect = useCallback((file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content && !imageFile) return;

    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now(), image_url: imagePreview ?? undefined }]);
    setInput('');
    inputTextRef.current = '';
    clearImage();
    setIsLoading(true);
    setError('');

    try {
      const form = new FormData();
      form.append('user_email', userEmail);
      form.append('msg',        content);
      form.append('persona',    persona);
      form.append('lang',       lang);
      form.append('history',    '[]');
      form.append('device_id',  'web');
      if (intakeProfile) form.append('intake_profile', JSON.stringify(intakeProfile));
      if (bestieConfig)  form.append('bestie_config',  JSON.stringify(bestieConfig));
      if (vaultPin)      form.append('vault_pin',      vaultPin);
      if (imageFile)     form.append('file', imageFile);

      console.log(`[LYLO] → ${API_BASE}/chat | persona=${persona}`);

      const res = await fetch(`${API_BASE}/chat`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const contentType = res.headers.get('content-type') ?? '';
      let reply = '';

      if (contentType.includes('text/event-stream')) {
        // SSE streaming — speak each sentence as it arrives
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        const assistantMsg: ChatMessage = { role: 'assistant', content: '', persona, timestamp: Date.now() };
        setMessages(prev => [...prev, assistantMsg]);

        let sentenceBuffer = '';
        const FLUSH_CHARS = 120; // speak every ~120 chars even without punctuation

        const flushSentence = (force = false) => {
          const match = sentenceBuffer.match(/^(.*?[.!?])\s*/s);
          const longEnough = sentenceBuffer.length >= FLUSH_CHARS;
          if (match || force || longEnough) {
            const toSpeak = match ? match[1].trim() : sentenceBuffer.trim();
            if (toSpeak.length > 3) onAudio(toSpeak);
            sentenceBuffer = match ? sentenceBuffer.slice(match[0].length) : '';
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'text' && parsed.content) {
                reply += parsed.content;
                sentenceBuffer += parsed.content;
                flushSentence();
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...assistantMsg, content: reply };
                  return updated;
                });
              }
              if (parsed.type === 'meta') {
                if (parsed.full_answer) reply = parsed.full_answer;
                if (parsed.emergency_protocol && onEmergency) onEmergency(parsed.emergency_protocol);
              }
            } catch { /* skip */ }
          }
        }
        // Flush any remaining buffer
        flushSentence(true);

      } else {
        // JSON fallback
        const data = await res.json();
        if (data.emergency_protocol && onEmergency) onEmergency(data.emergency_protocol);
        reply = data.response ?? data.message ?? data.answer ?? data.full_answer ?? '';
        setMessages(prev => [...prev, {
          role: 'assistant', content: reply,
          trust_audit: data.trust_audit as TrustAudit | undefined,
          persona, timestamp: Date.now(),
        }]);
        if (reply) onAudio(reply);
      }

      appendSessionContent(`User: ${content}\nLYLO: ${reply}`);

    } catch (e: any) {
      console.error('[LYLO] Chat error:', e);
      setError(e.message?.includes('Failed to fetch')
        ? `Can't reach server. URL being used: ${API_BASE}`
        : (e.message ?? 'Connection failed'));
    } finally {
      setIsLoading(false);
    }
  }, [
    input, imageFile, imagePreview, userEmail, persona, lang,
    intakeProfile, bestieConfig, vaultPin,
    clearImage, onAudio, onEmergency, appendSessionContent,
  ]);

  return {
    messages, setMessages,
    input, setInput, inputTextRef,
    isLoading, error,
    imageFile, imagePreview,
    handleImageSelect, clearImage,
    sendMessage,
    sessionContent: sessionContentRef.current,
    appendSessionContent,
  };
}
