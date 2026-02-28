/**
 * LYLO OS — ChatInterface.tsx  (Phase 1)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Phase 1 additions:
 * - Dynamic top bar per persona (real-world resources)
 * - Voice 3-click toggle (typewriter+voice / instant+voice / text only)
 * - Crisis resources with warm 988 wording
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

import type { ChatInterfaceProps, IntakeProfile } from '../types';

import { useVoice }      from './chat/useVoice';
import { useAudioQueue } from './chat/useAudioQueue';
import { usePersona, PERSONAS } from './chat/usePersona';
import { useVault }      from './chat/useVault';
import { useIntake }     from './chat/useIntake';
import { useChatSend }   from './chat/useChatSend';

import { PersonaGrid }      from './chat/ui/PersonaGrid';
import { MessageBubble }    from './chat/ui/MessageBubble';
import { BottomBar }        from './chat/ui/BottomBar';
import { EmergencyOverlay } from './chat/ui/EmergencyOverlay';

// ── Voice mode: 0 = typewriter+voice, 1 = instant+voice, 2 = text only ──────
type VoiceMode = 0 | 1 | 2;

const VOICE_MODE_LABELS: Record<VoiceMode, string> = {
  0: '🔊 Voice',
  1: '⚡ Fast',
  2: '🔇 Silent',
};

const VOICE_MODE_TIPS: Record<VoiceMode, string> = {
  0: 'Typewriter text + voice',
  1: 'Instant text + voice',
  2: 'Text only, no audio',
};

// ── Per-persona resource button config ───────────────────────────────────────
const PERSONA_RESOURCES: Record<string, { label: string; url: string; crisis?: boolean }> = {
  guardian:  { label: '🛡 Report a Scam',        url: 'https://reportfraud.ftc.gov/' },
  doctor:    { label: '🩺 Find a Doctor',         url: 'https://www.zocdoc.com/' },
  lawyer:    { label: '⚖️ Free Legal Aid',        url: 'https://www.lawhelp.org/' },
  wealth:    { label: '💰 CFPB Resources',        url: 'https://www.consumerfinance.gov/' },
  therapist: { label: '💜 Talk to Someone Now',   url: 'https://988lifeline.org/', crisis: true },
  mechanic:  { label: '🔧 Find a Mechanic',       url: 'https://www.repairpal.com/' },
  career:    { label: '💼 Job Search',            url: 'https://www.indeed.com/' },
  vitality:  { label: '⚡ Find a Gym Near You',   url: 'https://www.google.com/maps/search/gym+near+me' },
  tutor:     { label: '📚 Khan Academy',          url: 'https://www.khanacademy.org/' },
  pastor:    { label: '🙏 Find a Church Near You',url: 'https://www.google.com/maps/search/church+near+me' },
  hype:      { label: '🔥 Daily Motivation',      url: 'https://www.youtube.com/results?search_query=morning+motivation' },
  bestie:    { label: '💜 You\'re Not Alone',     url: 'https://988lifeline.org/', crisis: true },
};

const DEFAULT_LANG: 'en' | 'es' = 'en';

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userEmail,
  userName,
  userTier = 'free',
  lang = DEFAULT_LANG,
  onSignOut,
}) => {
  const [showPersonaGrid, setShowPersonaGrid] = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);
  const [emergency,       setEmergency]       = useState<any>(null);
  const [trustVisible,    setTrustVisible]    = useState(false);
  const [voiceMode,       setVoiceMode]       = useState<VoiceMode>(0);
  const [showCrisis,      setShowCrisis]      = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Cycle voice mode: 0 → 1 → 2 → 0
  const cycleVoiceMode = useCallback(() => {
    setVoiceMode(v => ((v + 1) % 3) as VoiceMode);
  }, []);

  const { enqueue: enqueueAudio, stopAll: stopAudio, isSpeaking } = useAudioQueue({
    userEmail,
    persona: 'guardian',
    lang,
    onSpeakingChange: () => {},
  });

  // Wrap enqueueAudio to respect voice mode
  const maybeEnqueueAudio = useCallback((text: string) => {
    if (voiceMode === 0 || voiceMode === 1) {
      enqueueAudio(text);
    }
  }, [voiceMode, enqueueAudio]);

  const {
    intakeProfile, showIntake, setShowIntake,
    loadIntakeProfile,
    intakeRound, intakeStep, intakeAnswers, intakeLoading,
    saveAnswer, submitRound, nextStep, prevStep,
  } = useIntake({
    userEmail,
    onIntakeComplete: (profile: IntakeProfile) => {},
  });

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
      maybeEnqueueAudio(text);
    },
  });

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
    onAudio: maybeEnqueueAudio,
    onEmergency: setEmergency,
  });

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

  const vault = useVault({ userEmail, persona: currentPersona });

  useEffect(() => {
    loadIntakeProfile();
  }, [loadIntakeProfile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Stop audio when switching to silent mode
  useEffect(() => {
    if (voiceMode === 2) stopAudio();
  }, [voiceMode, stopAudio]);

  const personaConfig  = PERSONAS.find(p => p.id === currentPersona) ?? PERSONAS[0];
  const personaColor   = personaConfig.color;
  const resourceConfig = PERSONA_RESOURCES[currentPersona] ?? PERSONA_RESOURCES.guardian;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-screen bg-[#080808] text-white overflow-hidden">

      {/* ── Emergency Overlay ── */}
      {emergency && (
        <EmergencyOverlay
          protocol={emergency}
          onDismiss={() => setEmergency(null)}
        />
      )}

      {/* ── Crisis Modal ── */}
      {showCrisis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl border border-purple-500/40 bg-[#0a0010] p-6 text-center">
            <div className="text-4xl mb-3">💜</div>
            <h3 className="text-white font-bold text-lg mb-2">You're not alone</h3>
            <p className="text-white/70 text-sm mb-4">
              If you're going through something hard right now, real support is available — 
              any time, day or night. You deserve to feel better.
            </p>
            <a
              href="tel:988"
              className="block w-full py-3 rounded-2xl bg-purple-600 text-white font-bold text-lg mb-2 hover:bg-purple-500 transition-colors"
            >
              📞 Call or Text 988
            </a>
            <p className="text-white/40 text-xs mb-4">Suicide & Crisis Lifeline — free, confidential, 24/7</p>
            <a
              href="https://988lifeline.org/chat/"
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2 rounded-2xl border border-purple-500/30 text-purple-300 text-sm mb-3 hover:bg-purple-500/10 transition-colors"
            >
              💬 Chat Online Instead
            </a>
            <button
              onClick={() => setShowCrisis(false)}
              className="text-white/30 text-sm hover:text-white/60 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
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

      {/* ── Dynamic Resource Top Bar ── */}
      <button
        onClick={() => {
          if (resourceConfig.crisis) {
            setShowCrisis(true);
          } else {
            window.open(resourceConfig.url, '_blank');
          }
        }}
        className="w-full py-2.5 px-4 text-xs font-semibold tracking-wide transition-all hover:opacity-80 active:scale-[0.99]"
        style={{
          backgroundColor: personaColor + '15',
          borderBottom: `1px solid ${personaColor}30`,
          color: personaColor,
        }}
      >
        {resourceConfig.label}
        {resourceConfig.crisis && <span className="ml-2 opacity-60">— tap for immediate support</span>}
      </button>

      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-white/5"
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

          {/* Voice mode toggle — 3 clicks */}
          <button
            onClick={cycleVoiceMode}
            title={VOICE_MODE_TIPS[voiceMode]}
            className={`text-xs px-2 py-1 rounded-lg border transition-all ${
              voiceMode === 2
                ? 'border-white/10 text-white/30'
                : 'border-white/20 text-white/70 bg-white/5'
            }`}
          >
            {VOICE_MODE_LABELS[voiceMode]}
          </button>

          {/* Trust toggle */}
          <button
            onClick={() => setTrustVisible(v => !v)}
            className={`text-xs px-2 py-1 rounded-lg border transition-all ${
              trustVisible
                ? 'border-green-500/50 text-green-400 bg-green-500/10'
                : 'border-white/10 text-white/30 hover:text-white/60'
            }`}
          >
            🛡
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
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{
                      backgroundColor: personaColor,
                      animationDelay: `${i * 150}ms`,
                      opacity: 0.7,
                    }}
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
        isSpeaking={isSpeaking && voiceMode !== 2}
        imagePreview={imagePreview}
        onInputChange={setInput}
        onSend={sendMessage}
        onImageSelect={handleImageSelect}
        onImageClear={clearImage}
        onVoiceStart={startRecording}
        onVoiceStop={() => {
          stopRecording();
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
