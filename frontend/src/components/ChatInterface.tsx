import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatInterfaceProps, IntakeProfile } from '../types';
import { useVoice }      from './chat/useVoice';
import { useAudioQueue } from './chat/useAudioQueue';
import { usePersona, PERSONAS } from './chat/usePersona';
import { useVault }      from './chat/useVault';
import { useIntake }     from './chat/useIntake';
import { useChatSend }   from './chat/useChatSend';
import { MessageBubble }    from './chat/ui/MessageBubble';
import { BottomBar }        from './chat/ui/BottomBar';
import { EmergencyOverlay } from './chat/ui/EmergencyOverlay';

const DEFAULT_LANG: 'en' | 'es' = 'en';

// ── Per-persona header link (email) ──────────────────────────────────────────
const PERSONA_LINKS: Record<string, { label: string; href: string }> = {
  guardian:  { label: 'Report a Threat',       href: 'mailto:mylylo.ai@gmail.com?subject=Guardian%3A%20Security%20Threat%20Report' },
  doctor:    { label: 'Request Medical Review', href: 'mailto:mylylo.ai@gmail.com?subject=Doctor%3A%20Medical%20Review%20Request' },
  lawyer:    { label: 'Request Legal Help',     href: 'mailto:mylylo.ai@gmail.com?subject=Lawyer%3A%20Legal%20Help%20Request' },
  wealth:    { label: 'Schedule Financial Review', href: 'mailto:mylylo.ai@gmail.com?subject=Wealth%3A%20Financial%20Review' },
  therapist: { label: 'Request Support Session', href: 'mailto:mylylo.ai@gmail.com?subject=Therapist%3A%20Support%20Session' },
  career:    { label: 'Career Consultation',    href: 'mailto:mylylo.ai@gmail.com?subject=Career%3A%20Consultation%20Request' },
  tutor:     { label: 'Request a Session',      href: 'mailto:mylylo.ai@gmail.com?subject=Tutor%3A%20Session%20Request' },
  vitality:  { label: 'Wellness Check-In',      href: 'mailto:mylylo.ai@gmail.com?subject=Vitality%3A%20Wellness%20Check-In' },
  hype:      { label: 'Get Motivated',          href: 'mailto:mylylo.ai@gmail.com?subject=Hype%3A%20Motivation%20Request' },
  bestie:    { label: 'Connect with Bestie',    href: 'mailto:mylylo.ai@gmail.com?subject=Bestie%3A%20Connect' },
  pastor:    { label: 'Request Pastoral Care',  href: 'mailto:mylylo.ai@gmail.com?subject=Pastor%3A%20Pastoral%20Care%20Request' },
  mechanic:  { label: 'Get Auto Help',          href: 'mailto:mylylo.ai@gmail.com?subject=Mechanic%3A%20Auto%20Help%20Request' },
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userEmail, userTier = 'free', lang = DEFAULT_LANG, onSignOut, currentPersonaId,
}) => {
  const [isRecording,     setIsRecording]     = useState(false);
  const [emergency,       setEmergency]       = useState<any>(null);
  const [trustVisible,    setTrustVisible]    = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [currentPersonaLocal, setCurrentPersonaLocal] = useState(currentPersonaId ?? 'guardian');

  const bottomRef      = useRef<HTMLDivElement>(null);
  const lastPersonaRef = useRef<string>('');
  const personaMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node))
        setPersonaMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const { enqueue: enqueueAudio, stopAll: stopAudio, isSpeaking } = useAudioQueue({
    userEmail,
    persona: currentPersonaLocal,  // ← always tracks current persona for correct voice
    lang,
    onSpeakingChange: () => {},
  });

  const { intakeProfile, loadIntakeProfile } = useIntake({
    userEmail, onIntakeComplete: (_: IntakeProfile) => {},
  });

  const { currentPersona, bestieConfig, switchPersona } = usePersona({
    userEmail, lang, intakeProfile,
    onGreeting: (text) => {
      setMessages([{ role: 'assistant', content: text, persona: currentPersona, timestamp: Date.now() }]);
      enqueueAudio(text);
    },
  });

  // Switch persona when sidebar or picker changes
  const doSwitch = useCallback((personaId: string) => {
    if (personaId === lastPersonaRef.current) return;
    lastPersonaRef.current = personaId;
    setCurrentPersonaLocal(personaId);
    stopAudio();
    setMessages([]);
    switchPersona(personaId);
  }, [switchPersona, stopAudio]);

  useEffect(() => {
    if (currentPersonaId) doSwitch(currentPersonaId);
  }, [currentPersonaId]); // eslint-disable-line

  const {
    messages, setMessages,
    input, setInput, inputTextRef,
    isLoading, error,
    imageFile, imagePreview,
    handleImageSelect, clearImage,
    sendMessage,
  } = useChatSend({
    userEmail, persona: currentPersonaLocal, lang,
    intakeProfile, bestieConfig,
    onAudio: enqueueAudio,
    onEmergency: setEmergency,
  });

  const { startRecording, stopRecording } = useVoice({
    lang, isSpeaking,
    onTranscript: (text) => { setInput(text); inputTextRef.current = text; },
    onInterim:    (text) => setInput(text),
    onRecordingChange: setIsRecording,
  });

  useVault({ userEmail, persona: currentPersonaLocal });
  useEffect(() => { loadIntakeProfile(); }, [loadIntakeProfile]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const personaConfig = PERSONAS.find(p => p.id === currentPersonaLocal) ?? PERSONAS[0];
  const personaColor  = personaConfig.color;
  const personaLink   = PERSONA_LINKS[currentPersonaLocal];

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const handlePersonaPick = (id: string) => {
    setPersonaMenuOpen(false);
    doSwitch(id);
  };

  return (
    <div className="flex flex-col h-full bg-[#080808] text-white overflow-hidden">
      {emergency && <EmergencyOverlay protocol={emergency} onDismiss={() => setEmergency(null)} />}

      {/* ── Persona header bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderBottomColor: personaColor + '33', backgroundColor: personaColor + '0a' }}>

        {/* Persona picker button */}
        <div className="relative" ref={personaMenuRef}>
          <button
            onClick={() => setPersonaMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-2xl px-4 py-2 border transition-all active:scale-95"
            style={{ backgroundColor: personaColor + '20', borderColor: personaColor + '60' }}>
            <span className="text-lg">{personaConfig.emoji}</span>
            <span className="text-sm font-bold" style={{ color: personaColor }}>{personaConfig.label}</span>
            <span className="text-xs" style={{ color: personaColor + '99' }}>▾</span>
          </button>

          {personaMenuOpen && (
            <div className="absolute left-0 top-12 w-56 rounded-2xl border border-white/15 shadow-2xl z-50 overflow-hidden"
              style={{ backgroundColor: '#111' }}>
              <div className="p-2 max-h-[70vh] overflow-y-auto space-y-0.5">
                {PERSONAS.map(p => (
                  <button key={p.id} onClick={() => handlePersonaPick(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                    style={{
                      backgroundColor: p.id === currentPersonaLocal ? p.color + '20' : 'transparent',
                      border: `1px solid ${p.id === currentPersonaLocal ? p.color + '44' : 'transparent'}`,
                    }}>
                    <span className="text-lg">{p.emoji}</span>
                    <span className="text-sm font-semibold"
                      style={{ color: p.id === currentPersonaLocal ? p.color : 'rgba(255,255,255,0.7)' }}>
                      {p.label}
                    </span>
                    {p.id === currentPersonaLocal && (
                      <span className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Per-persona action link + controls */}
        <div className="flex items-center gap-2">
          {personaLink && (
            <a href={personaLink.href}
              className="text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all hidden sm:flex items-center gap-1"
              style={{ borderColor: personaColor + '55', color: personaColor, backgroundColor: personaColor + '12' }}>
              {personaLink.label}
            </a>
          )}
          <button onClick={() => setTrustVisible(v => !v)}
            className="text-xs px-3 py-1.5 rounded-xl border transition-all font-semibold"
            style={trustVisible
              ? { borderColor: personaColor + '66', color: personaColor, backgroundColor: personaColor + '15' }
              : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
            🛡
          </button>
          {onSignOut && (
            <button onClick={onSignOut} className="text-xs text-white/20 hover:text-white/50 transition-colors">⏻</button>
          )}
        </div>
      </div>

      {/* Mobile-only persona action link */}
      {personaLink && (
        <a href={personaLink.href}
          className="sm:hidden flex items-center justify-center py-2 text-xs font-semibold border-b"
          style={{ borderColor: personaColor + '22', color: personaColor, backgroundColor: personaColor + '08' }}>
          {personaLink.label} →
        </a>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <span className="text-6xl opacity-20">{personaConfig.emoji}</span>
            <p className="text-sm opacity-20" style={{ color: personaColor }}>
              Talk to your {personaConfig.label}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} showTrust={trustVisible} personaColor={personaColor} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 border"
              style={{ backgroundColor: personaColor + '10', borderColor: personaColor + '25' }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: personaColor, animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <BottomBar
        input={input} isLoading={isLoading} isRecording={isRecording}
        isSpeaking={isSpeaking} imagePreview={imagePreview}
        onInputChange={setInput}
        onSend={sendMessage}
        onImageSelect={handleImageSelect} onImageClear={clearImage}
        onVoiceStart={startRecording}
        onVoiceStop={() => {
          stopRecording();
          // Small delay so transcript lands in inputTextRef before send fires
          setTimeout(() => {
            const text = inputTextRef.current.trim();
            if (text) {
              inputTextRef.current = '';
              sendMessage(text);
            }
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        personaColor={personaColor}
        lang={lang}
      />
    </div>
  );
};

export default ChatInterface;
