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

const PERSONA_LINKS: Record<string, { label: string; href: string }> = {
  guardian:  { label: 'Report a Threat',        href: 'mailto:mylylo.ai@gmail.com?subject=Guardian%3A%20Security%20Threat' },
  doctor:    { label: 'Request Medical Review',  href: 'mailto:mylylo.ai@gmail.com?subject=Doctor%3A%20Medical%20Review' },
  lawyer:    { label: 'Request Legal Help',      href: 'mailto:mylylo.ai@gmail.com?subject=Lawyer%3A%20Legal%20Help' },
  wealth:    { label: 'Financial Review',        href: 'mailto:mylylo.ai@gmail.com?subject=Wealth%3A%20Financial%20Review' },
  therapist: { label: 'Request Support Session', href: 'mailto:mylylo.ai@gmail.com?subject=Therapist%3A%20Support%20Session' },
  career:    { label: 'Career Consultation',     href: 'mailto:mylylo.ai@gmail.com?subject=Career%3A%20Consultation' },
  tutor:     { label: 'Request a Session',       href: 'mailto:mylylo.ai@gmail.com?subject=Tutor%3A%20Session' },
  vitality:  { label: 'Wellness Check-In',       href: 'mailto:mylylo.ai@gmail.com?subject=Vitality%3A%20Wellness' },
  hype:      { label: 'Get Motivated',           href: 'mailto:mylylo.ai@gmail.com?subject=Hype%3A%20Motivation' },
  bestie:    { label: 'Connect',                 href: 'mailto:mylylo.ai@gmail.com?subject=Bestie%3A%20Connect' },
  pastor:    { label: 'Request Pastoral Care',   href: 'mailto:mylylo.ai@gmail.com?subject=Pastor%3A%20Care' },
  mechanic:  { label: 'Get Auto Help',           href: 'mailto:mylylo.ai@gmail.com?subject=Mechanic%3A%20Auto%20Help' },
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userEmail, userTier = 'free', lang = DEFAULT_LANG, onSignOut, currentPersonaId,
}) => {
  const [isRecording,       setIsRecording]       = useState(false);
  const [emergency,         setEmergency]         = useState<any>(null);
  const [trustVisible,      setTrustVisible]      = useState(false);
  const [currentPersonaLocal, setCurrentPersonaLocal] = useState(currentPersonaId ?? 'guardian');

  const bottomRef      = useRef<HTMLDivElement>(null);
  const lastPersonaRef = useRef<string>('');

  const { enqueue: enqueueAudio, stopAll: stopAudio, isSpeaking } = useAudioQueue({
    userEmail, persona: currentPersonaLocal, lang, onSpeakingChange: () => {},
  });

  const { intakeProfile, loadIntakeProfile } = useIntake({
    userEmail, onIntakeComplete: (_: IntakeProfile) => {},
  });

  const { currentPersona, bestieConfig, switchPersona } = usePersona({
    userEmail, lang, intakeProfile,
    onGreeting: (text) => {
      // APPEND greeting — never wipe existing messages (would kill in-flight responses)
      setMessages(prev => [
        ...prev,
        { role: 'assistant' as const, content: text, persona: currentPersona, timestamp: Date.now() }
      ]);
      enqueueAudio(text);
    },
  });

  const doSwitch = useCallback((personaId: string) => {
    if (personaId === lastPersonaRef.current) return;
    lastPersonaRef.current = personaId;
    setCurrentPersonaLocal(personaId);
    stopAudio();
    setMessages([]); // clear now — greeting will append once it arrives
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

  return (
    <div className="flex flex-col h-full bg-[#080808] text-white overflow-hidden">
      {emergency && <EmergencyOverlay protocol={emergency} onDismiss={() => setEmergency(null)} />}

      {/* ── Thin persona action bar (no hamburger, no persona picker — that's in Layout) ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ borderBottomColor: personaColor + '25', backgroundColor: personaColor + '08' }}>

        {/* Active persona label — compact, just name + color indicator */}
        <div className="flex items-center gap-2">
          <span className="text-base">{personaConfig.emoji}</span>
          <span className="text-sm font-bold" style={{ color: personaColor }}>
            {personaConfig.label}
          </span>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: personaColor }} />
        </div>

        {/* Right: action link + trust toggle */}
        <div className="flex items-center gap-2">
          {personaLink && (
            <a href={personaLink.href}
              className="text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all"
              style={{ borderColor: personaColor + '50', color: personaColor, backgroundColor: personaColor + '10' }}>
              {personaLink.label}
            </a>
          )}
          <button onClick={() => setTrustVisible(v => !v)}
            className="w-8 h-8 rounded-xl border flex items-center justify-center text-sm transition-all"
            style={trustVisible
              ? { borderColor: personaColor + '66', backgroundColor: personaColor + '18' }
              : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
            🛡
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <span className="text-5xl opacity-20">{personaConfig.emoji}</span>
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
              <div className="flex gap-1 items-center">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: personaColor, animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-1 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
            <p className="text-red-400 text-xs leading-relaxed">{error}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Bottom input bar ── */}
      <BottomBar
        input={input} isLoading={isLoading} isRecording={isRecording}
        isSpeaking={isSpeaking} imagePreview={imagePreview}
        onInputChange={setInput}
        onSend={sendMessage}
        onImageSelect={handleImageSelect} onImageClear={clearImage}
        onVoiceStart={startRecording}
        onVoiceStop={() => {
          stopRecording();
          setTimeout(() => {
            const text = inputTextRef.current.trim();
            if (text) { inputTextRef.current = ''; sendMessage(text); }
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
