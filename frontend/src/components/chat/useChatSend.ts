/**
 * LYLO OS — chat/useChatSend.ts  (Phase 1 — SSE Streaming + Simultaneous Text+Voice)
 *
 * KEY FIXES:
 * - Reads SSE stream properly (was using res.json() on a streaming response)
 * - Text appears AND voice plays at the SAME TIME per sentence
 * - Persona switch clears messages (handled in ChatInterface)
 */
import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, TrustAudit, IntakeProfile, BestieConfig } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://lylo-backend.onrender.com';

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
  // Track the msg id being streamed so we can update it in place
  const streamingIdRef    = useRef<number | null>(null);

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

  // ── Send message ──────────────────────────────────────────────────────────
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

    // Create the assistant message placeholder
    const msgId = Date.now() + 1;
    streamingIdRef.current = msgId;

    const assistantMsg: ChatMessage = {
      role:      'assistant',
      content:   '',
      persona,
      timestamp: msgId,
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const form = new FormData();
      form.append('email',   userEmail);
      form.append('message', content);
      form.append('persona', persona);
      form.append('lang',    lang);

      if (intakeProfile) form.append('intake_profile', JSON.stringify(intakeProfile));
      if (bestieConfig)  form.append('bestie_config',  JSON.stringify(bestieConfig));
      if (vaultPin)      form.append('vault_pin',       vaultPin);
      if (imageFile)     form.append('image',           imageFile);

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        body:   form,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      // ── Read SSE stream ──────────────────────────────────────────────────
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   fullAnswer = '';
      let   trustAudit: TrustAudit | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';   // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          let chunk: any;
          try { chunk = JSON.parse(raw); } catch { continue; }

          if (chunk.type === 'text' && chunk.content) {
            const sentence = chunk.content as string;
            fullAnswer += (fullAnswer ? ' ' : '') + sentence;

            // ── Update text in UI immediately ───────────────────────────
            setMessages(prev => prev.map(m =>
              m.timestamp === msgId
                ? { ...m, content: fullAnswer }
                : m
            ));

            // ── Play audio at the SAME TIME text appears ────────────────
            // audio_b64 comes pre-generated from backend per sentence
            if (chunk.audio_b64) {
              try {
                const audio = new Audio(`data:audio/mpeg;base64,${chunk.audio_b64}`);
                audio.play().catch(() => {
                  // Fallback: use the onAudio queue if inline fails
                  onAudio(sentence);
                });
              } catch {
                onAudio(sentence);
              }
            } else {
              // No inline audio — send to queue
              onAudio(sentence);
            }
          }

          if (chunk.type === 'meta') {
            // Emergency protocol
            if (chunk.action_trigger === 'emergency' && chunk.emergency_protocol && onEmergency) {
              onEmergency(chunk.emergency_protocol);
            }
            // Trust audit
            if (chunk.trust_audit) {
              trustAudit = chunk.trust_audit as TrustAudit;
              setMessages(prev => prev.map(m =>
                m.timestamp === msgId
                  ? { ...m, trust_audit: trustAudit }
                  : m
              ));
            }
          }

          // Handle non-streaming JSON response (fallback)
          if (chunk.type === 'response' || chunk.response) {
            const reply = chunk.response ?? chunk.message ?? '';
            if (reply) {
              fullAnswer = reply;
              setMessages(prev => prev.map(m =>
                m.timestamp === msgId ? { ...m, content: reply } : m
              ));
              onAudio(reply);
            }
          }
        }
      }

      if (fullAnswer) {
        appendSessionContent(`User: ${content}\nLYLO: ${fullAnswer}`);
      }

    } catch (e: any) {
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.timestamp !== msgId));
      setError('Something went wrong. Please try again.');
      console.error('Chat error:', e);
    } finally {
      setIsLoading(false);
      streamingIdRef.current = null;
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
