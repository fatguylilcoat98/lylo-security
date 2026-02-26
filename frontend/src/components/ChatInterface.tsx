/**
 * LYLO OS — ChatInterface.tsx  (v31.0 Modular)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * This is the shell. All logic lives in hooks. All UI lives in chat/ui/.
 *
 * Adding a new feature?
 *   - New backend logic    → routers/ or services/
 *   - New React state/API  → chat/use*.ts hook
 *   - New UI element       → chat/ui/*.tsx component
 *   - DON'T add logic here
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

// Types
import type { ChatInterfaceProps, IntakeProfile } from '../types';

// Hooks
import { useVoice }      from './chat/useVoice';
import { useAudioQueue } from './chat/useAudioQueue';
import { usePersona, PERSONAS } from './chat/usePersona';
import { useVault }      from './chat/useVault';
import { useIntake }     from './chat/useIntake';
import { useChatSend }   from './chat/useChatSend';

// UI Components
import { PersonaGrid }      from './chat/ui/PersonaGrid';
import { MessageBubble }    from './chat/ui/MessageBubble';
import { BottomBar }        from './chat/ui/BottomBar';
import { EmergencyOverlay } from './chat/ui/EmergencyOverlay';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_LANG: 'en' | 'es' = 'en';

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userEmail,
  userName,
  userTier = 'free',
  lang = DEFAULT_LANG,
  onSignOut,
}) => {
  // ── UI state ───────────────────────────────────────────────────────────────
  const [showPersonaGrid, setShowPersonaGrid] = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);
  const [emergency,       setEmergency]       = useState<any>(null);
  const [trustVisible,    setTrustVisible]    = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Audio queue ────────────────────────────────────────────────────────────
  const { enqueue: enqueueAudio, stopAll: stopAudio, isSpeaking } = useAudioQueue({
    userEmail,
    persona: 'guardian',   // updated below after persona hook
    lang,
    onSpeakingChange: () => {},
  });

  // ── Intake ─────────────────────────────────────────────────────────────────
  const {
    intakeProfile, showIntake, setShowIntake,
    loadIntakeProfile,
    intakeRound, intakeStep, intakeAnswers, intakeLoading,
    saveAnswer, submitRound, nextStep, prevStep,
  } = useIntake({
    userEmail,
    onIntakeComplete: (profile: IntakeProfile) => {
      // Persona hook will re-fire after intake with real name
    },
  });

  // ── Persona ────────────────────────────────────────────────────────────────
  const {
    currentPersona, bestieConfig,
    showBestieSetup, setShowBestieSetup,
    switchPersona, saveBestieConfig,
  } = usePersona({
    userEmail,
    lang,
    intakeProfile,
    onGreeting: (text) => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: text, persona: currentPersona, timestamp: Date.now() },
      ]);
      enqueueAudio(text);
    },
  });

  // ── Chat send ──────────────────────────────────────────────────────────────
  const {
    messages, setMessages,
    input, setInput,
    inputTextRef,
    isLoading, error,
    imageFile, imagePreview,
    handleImageSelect, clearImage,
    sendMessage,
  } = useChatSend({
    userEmail,
    persona: currentPersona,
    lang,
    intakeProfile,
    bestieConfig,
    onAudio: enqueueAudio,
    onEmergency: setEmergency,
  });

  // ── Voice ──────────────────────────────────────────────────────────────────
  const { startRecording, stopRecording } = useVoice({
    lang,
    isSpeaking,
    onTranscript: (text) => {
      setInput(text);
      inputTextRef.current = text;
    },
    onInterim: (text) => {
      setInput(text);
    },
    onRecordingChange: setIsRecording,
  });

  // ── Vault ──────────────────────────────────────────────────────────────────
  const vault = useVault({ userEmail, persona: currentPersona });

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadIntakeProfile();
  }, [loadIntakeProfile]);

  useEffect(() => {
    // Auto-scroll to bottom on new message
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const personaConfig = PERSONAS.find(p => p.id === currentPersona) ?? PERSONAS[0];
  const personaColor  = personaConfig.color;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#080808] text-white overflow-hidden">

      {/* ── Emergency Overlay ── */}
      {emergency && (
        <EmergencyOverlay
          protocol={emergency}
          onDismiss={() => setEmergency(null)}
        />
      )}

      {/* ── Persona Grid ── */}
      {showPersonaGrid && (
        <PersonaGrid
          current={currentPersona}
          userTier={userTier}
          onSelect={(id) => { switchPersona(id); setShowPersonaGrid(false); }}
          onClose={() => setShowPersonaGrid(false)}
        />
      )}

      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/5"
        style={{ borderBottomColor: personaColor + '22' }}
      >
        {/* Persona badge */}
        <button
          onClick={() => setShowPersonaGrid(true)}
          className="flex items-center gap-2 rounded-2xl px-3 py-1.5 bg-white/5 border border-white/10 hover:border-white/25 transition-all"
        >
          <span className="text-lg">{personaConfig.emoji}</span>
          <span className="text-white/80 text-sm font-medium">{personaConfig.label}</span>
          <span className="text-white/30 text-xs">▾</span>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Trust toggle */}
          <button
            onClick={() => setTrustVisible(v => !v)}
            className={`text-xs px-2 py-1 rounded-lg border transition-all ${
              trustVisible
                ? 'border-green-500/50 text-green-400 bg-green-500/10'
                : 'border-white/10 text-white/30 hover:text-white/60'
            }`}
          >
            🛡 Trust
          </button>

          {/* Med-Vault */}
          <button
            onClick={() => vault.setVaultSetupOpen(true)}
            className="text-xs px-2 py-1 rounded-lg border border-white/10 text-white/30 hover:text-white/60 transition-all"
          >
            💊 Vault
          </button>

          {/* Sign out */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="text-xs text-white/20 hover:text-white/50 transition-colors ml-1"
            >
              ⏻
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-40">
            <span className="text-5xl">{personaConfig.emoji}</span>
            <p className="text-white/60 text-sm">
              {lang === 'es'
                ? `Habla con tu ${personaConfig.label}`
                : `Talk to your ${personaConfig.label}`}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            showTrust={trustVisible}
          />
        ))}

        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-red-400/70 text-xs py-2">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Bottom Bar ── */}
      <BottomBar
        input={input}
        isLoading={isLoading}
        isRecording={isRecording}
        isSpeaking={isSpeaking}
        imagePreview={imagePreview}
        onInputChange={setInput}
        onSend={sendMessage}
        onImageSelect={handleImageSelect}
        onImageClear={clearImage}
        onVoiceStart={startRecording}
        onVoiceStop={() => {
          stopRecording();
          // Auto-send after voice input
          setTimeout(() => {
            if (inputTextRef.current.trim()) sendMessage();
          }, 300);
        }}
        onKeyDown={handleKeyDown}
        personaColor={personaColor}
        lang={lang}
      />

    </div>
  );
};

export default ChatInterface;
