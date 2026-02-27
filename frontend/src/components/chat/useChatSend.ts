/**
 * LYLO OS — chat/useChatSend.ts
 * Fixed field names to match backend: user_email, msg, file (not email, message, image)
 */
import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, TrustAudit, IntakeProfile, BestieConfig } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://lylo-backend.onrender.com';

interface UseChatSendOptions {
  userEmail: string;
  persona:   string;
  lang:      'en' | 'es';
  intakeProfile: IntakeProfile | null;
  bestieConfig:  BestieConfig | null;
  vaultPin?:     string;
  onAudio:       (text: string) => void;
  onEmergency?:  (protocol: any) => void;
}

export function useChatSend({
  userEmail,
  persona,
  lang,
  intakeProfile,
  bestieConfig,
  vaultPin,
  onAudio,
  onEmergency,
}: UseChatSendOptions) {
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [input,        setInput]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState('');
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const sessionContentRef = useRef<string[]>([]);
  const inputTextRef      = useRef('');

  const appendSessionContent = useCallback((text: string) => {
    sessionContentRef.current.push(text);
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
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

    const userMsg: ChatMessage = {
      role:      'user',
      content,
      timestamp: Date.now(),
      image_url: imagePreview ?? undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    inputTextRef.current = '';
    clearImage();
    setIsLoading(true);
    setError('');

    try {
      const form = new FormData();
      // ── Correct field names matching backend ──────────────────────────────
      form.append('user_email', userEmail);
      form.append('msg',        content);
      form.append('persona',    persona);
      form.append('lang',       lang);
      form.append('history',    '[]');
      form.append('device_id',  'web');

      if (intakeProfile) form.append('intake_profile', JSON.stringify(intakeProfile));
      if (bestieConfig)  form.append('bestie_config',  JSON.stringify(bestieConfig));
      if (vaultPin)      form.append('vault_pin',      vaultPin);
      if (imageFile)     form.append('file', imageFile); // backend expects 'file' not 'image'

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        body:   form,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      // ── Handle SSE streaming response ─────────────────────────────────────
      const contentType = res.headers.get('content-type') ?? '';
      let reply = '';

      if (contentType.includes('text/event-stream')) {
        // SSE streaming
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        const assistantMsg: ChatMessage = {
          role: 'assistant', content: '', persona, timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'text' && parsed.content) {
                reply += parsed.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...assistantMsg, content: reply };
                  return updated;
                });
              }
              if (parsed.type === 'meta') {
                if (parsed.full_answer) reply = parsed.full_answer;
                if (parsed.emergency_protocol && onEmergency) {
                  onEmergency(parsed.emergency_protocol);
                }
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } else {
        // JSON response fallback
        const data = await res.json();
        if (data.emergency_protocol && onEmergency) onEmergency(data.emergency_protocol);
        reply = data.response ?? data.message ?? data.answer ?? '';
        const assistantMsg: ChatMessage = {
          role: 'assistant', content: reply,
          trust_audit: data.trust_audit as TrustAudit | undefined,
          persona, timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }

      appendSessionContent(`User: ${content}\nLYLO: ${reply}`);
      if (reply) onAudio(reply);

    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Try again.');
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
    input, setInput,
    inputTextRef,
    isLoading,
    error,
    imageFile,
    imagePreview,
    handleImageSelect,
    clearImage,
    sendMessage,
    sessionContent: sessionContentRef.current,
    appendSessionContent,
  };
}
