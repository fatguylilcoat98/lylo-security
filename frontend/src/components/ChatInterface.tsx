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

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userEmail,
  userTier = 'free',
  lang = DEFAULT_LANG,
  onSignOut,
  currentPersonaId,
}) => {
  const [isRecording,  setIsRecording]  = useState(false);
  const [emergency,    setEmergency]    = useState<any>(null);
  const [trustVisible, setTrustVisible] = useState(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const lastPersonaRef = useRef<string>('');

  const { enqueue: enqueueAudio, isSpeaking } = useAudioQueue({
    userEmail, persona: 'guardian', lang, onSpeakingChange: () => {},
  });

  const { intakeProfile, loadIntakeProfile } = useIntake({
    userEmail,
    onIntakeComplete: (_: IntakeProfile) => {},
  });

  const {
    currentPersona, bestieConfig,
    showBestieSetup, setShowBestieSetup,
    switchPersona, saveBestieConfig,
  } = usePersona({
    userEmail, lang, intakeProfile,
    onGreeting: (text) => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: text, persona: currentPersona, timestamp: Date.now() },
      ]);
      enqueueAudio(text);
    },
  });

  // Switch persona when sidebar changes — ref guard prevents double-fire
  useEffect(() => {
    if (currentPersonaId && currentPersonaId !== lastPersonaRef.current) {
      lastPersonaRef.current = currentPersonaId;
      switchPersona(currentPersonaId);
    }
  }, [currentPersonaId]); // eslint-disable-line

  const {
    messages, setMessages,
    input, setInput, inputTextRef,
    isLoading, error,
    imageFile, imagePreview,
    handleImageSelect, clearImage,
    sendMessage,
  } = useChatSend({
    userEmail, persona: currentPersona, lang,
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

  const vault = useVault({ userEmail, persona: currentPersona });

  useEffect(() => { loadIntakeProfile(); }, [loadIntakeProfile]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const personaConfig = PERSONAS.find(p => p.id === currentPersona) ?? PERSONAS[0];
  const personaColor  = personaConfig.color;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full bg-[#080808] text-white overflow-hidden">

      {emergency && <EmergencyOverlay protocol={emergency} onDismiss={() => setEmergency(null)} />}

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderBottomColor: personaColor + '33' }}>

        {/* Persona badge — colored background matching active persona */}
        <div className="flex items-center gap-2 rounded-2xl px-4 py-2 border"
          style={{
            backgroundColor: personaColor + '18',
            borderColor: personaColor + '55',
          }}>
          <span className="text-lg">{personaConfig.emoji}</span>
          <span className="text-sm font-bold" style={{ color: personaColor }}>
            {personaConfig.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setTrustVisible(v => !v)}
            className="text-xs px-3 py-1.5 rounded-xl border transition-all font-semibold"
            style={trustVisible
              ? { borderColor: personaColor + '66', color: personaColor, backgroundColor: personaColor + '15' }
              : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
            🛡 Trust
          </button>
          <button onClick={() => vault.setVaultSetupOpen?.(true)}
            className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-white/30 hover:text-white/60 transition-all font-semibold">
            💊 Vault
          </button>
          {onSignOut && (
            <button onClick={onSignOut} className="text-xs text-white/20 hover:text-white/50 ml-1 transition-colors">⏻</button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <span className="text-6xl opacity-30">{personaConfig.emoji}</span>
            <p className="text-sm opacity-20" style={{ color: personaColor }}>
              {lang === 'es' ? `Habla con tu ${personaConfig.label}` : `Talk to your ${personaConfig.label}`}
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

      {/* ── Bottom Bar — passes personaColor for input border ── */}
      <BottomBar
        input={input} isLoading={isLoading} isRecording={isRecording}
        isSpeaking={isSpeaking} imagePreview={imagePreview}
        onInputChange={setInput} onSend={sendMessage}
        onImageSelect={handleImageSelect} onImageClear={clearImage}
        onVoiceStart={startRecording}
        onVoiceStop={() => {
          stopRecording();
          setTimeout(() => { if (inputTextRef.current.trim()) sendMessage(); }, 300);
        }}
        onKeyDown={handleKeyDown}
        personaColor={personaColor}
        lang={lang}
      />
    </div>
  );
};

export default ChatInterface;
