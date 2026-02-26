/**
 * LYLO OS — chat/useChatSend.ts
 * Handles message sending to /chat endpoint, streaming, and session content.
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
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [input,       setInput]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const sessionContentRef = useRef<string[]>([]);
  const inputTextRef      = useRef('');

  // ── Append to session content (for end-of-session report) ────────────────
  const appendSessionContent = useCallback((text: string) => {
    sessionContentRef.current.push(text);
  }, []);

  // ── Clear image ───────────────────────────────────────────────────────────
  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  // ── Handle image selection ────────────────────────────────────────────────
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

    try {
      // Build form data (supports image upload)
      const form = new FormData();
      form.append('email',   userEmail);
      form.append('message', content);
      form.append('persona', persona);
      form.append('lang',    lang);

      if (intakeProfile) {
        form.append('intake_profile', JSON.stringify(intakeProfile));
      }
      if (bestieConfig) {
        form.append('bestie_config', JSON.stringify(bestieConfig));
      }
      if (vaultPin) {
        form.append('vault_pin', vaultPin);
      }
      if (imageFile) {
        form.append('image', imageFile);
      }

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        body:   form,
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = await res.json();

      // Handle emergency routing
      if (data.emergency_protocol && onEmergency) {
        onEmergency(data.emergency_protocol);
      }

      const reply = data.response ?? data.message ?? '';

      const assistantMsg: ChatMessage = {
        role:        'assistant',
        content:     reply,
        trust_audit: data.trust_audit as TrustAudit | undefined,
        persona,
        timestamp:   Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      appendSessionContent(`User: ${content}\nLYLO: ${reply}`);

      // Enqueue audio
      if (reply) {
        onAudio(reply);
      }

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
