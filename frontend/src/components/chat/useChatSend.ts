import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, TrustAudit, IntakeProfile, BestieConfig } from '../../types';

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

    setMessages(prev => [...prev, {
      role: 'user', content, timestamp: Date.now(),
      image_url: imagePreview ?? undefined,
    }]);
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
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text().catch(() => '')}`);

      const contentType = res.headers.get('content-type') ?? '';
      let reply = '';

      if (contentType.includes('text/event-stream')) {
        const reader  = res.body!.getReader();
        const decoder = new TextDecoder();

        // Stable timestamp ID — safe even if greeting appends mid-stream
        const msgId = Date.now();
        setMessages(prev => [...prev, { role: 'assistant', content: '', persona, timestamp: msgId }]);

        let sentenceBuffer = '';

        const flushSentence = (force = false) => {
          const match = sentenceBuffer.match(/^(.*?[.!?])\s*/s);
          const longEnough = sentenceBuffer.length >= 100;
          if (match || force || longEnough) {
            const toSpeak = (match ? match[1] : sentenceBuffer).trim();
            if (toSpeak.length > 3) onAudio(toSpeak);
            sentenceBuffer = match ? sentenceBuffer.slice(match[0].length) : '';
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const p = JSON.parse(line.slice(6));
              if (p.type === 'text' && p.content) {
                reply += p.content;
                sentenceBuffer += p.content;
                flushSentence();
                // Find message by stable ID — never breaks if list grows
                setMessages(prev => prev.map(m =>
                  m.timestamp === msgId ? { ...m, content: reply } : m
                ));
              }
              if (p.type === 'meta') {
                if (p.full_answer) reply = p.full_answer;
                if (p.emergency_protocol && onEmergency) onEmergency(p.emergency_protocol);
              }
            } catch { /* malformed SSE chunk */ }
          }
        }
        flushSentence(true);

        // Ensure final content is committed even if SSE ended abruptly
        if (reply) {
          setMessages(prev => prev.map(m =>
            m.timestamp === msgId ? { ...m, content: reply } : m
          ));
        }

      } else {
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
        ? `Can't reach server (${API_BASE}). Check VITE_BACKEND_URL in Render.`
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
