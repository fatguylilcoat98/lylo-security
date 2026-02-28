/**
 * LYLO OS — ChatInterface.tsx  (Phase 1 Final)
 * Changes:
 * - Sidebar REMOVED — persona grid modal only
 * - Persona switch clears chat and starts fresh
 * - Voice 3-click toggle
 * - Dynamic top bar changes with persona
 * - Bestie setup modal (inline)
 * - Crisis 988 modal
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatInterfaceProps, IntakeProfile, BestieConfig } from '../types';
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

type VoiceMode = 0 | 1 | 2;
const VOICE_MODE_LABELS: Record<VoiceMode, string> = { 0: '🔊 Voice', 1: '⚡ Fast', 2: '🔇 Silent' };

const PERSONA_RESOURCES: Record<string, { label: string; url: string; crisis?: boolean }> = {
  guardian:  { label: '🛡️ Report a Scam',              url: 'https://reportfraud.ftc.gov/' },
  doctor:    { label: '🩺 Find a Doctor Near You',      url: 'https://www.zocdoc.com/' },
  lawyer:    { label: '⚖️ Find Free Legal Aid',         url: 'https://www.lawhelp.org/' },
  wealth:    { label: '💰 CFPB Consumer Resources',     url: 'https://www.consumerfinance.gov/' },
  therapist: { label: '💜 Talk to Someone Now',         url: 'https://988lifeline.org/', crisis: true },
  mechanic:  { label: '🔧 Find a Mechanic Near You',    url: 'https://www.repairpal.com/' },
  career:    { label: '💼 Search Jobs Now',             url: 'https://www.indeed.com/' },
  vitality:  { label: '⚡ Find a Gym Near You',         url: 'https://www.google.com/maps/search/gym+near+me' },
  tutor:     { label: '📚 Free Learning — Khan Academy',url: 'https://www.khanacademy.org/' },
  pastor:    { label: '🙏 Find a Church Near You',      url: 'https://www.google.com/maps/search/church+near+me' },
  hype:      { label: '🔥 Daily Motivation',            url: 'https://www.youtube.com/results?search_query=morning+motivation' },
  bestie:    { label: '💜 You\'re Not Alone',           url: 'https://988lifeline.org/', crisis: true },
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userEmail, userName, userTier = 'free', lang = 'en', onSignOut }) => {
  const [showPersonaGrid, setShowPersonaGrid] = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);
  const [emergency,       setEmergency]       = useState<any>(null);
  const [trustVisible,    setTrustVisible]    = useState(false);
  const [voiceMode,       setVoiceMode]       = useState<VoiceMode>(0);
  const [showCrisis,      setShowCrisis]      = useState(false);
  const [showBestieSetup, setShowBestieSetup] = useState(false);
  const [bestieName,      setBestieName]      = useState('');
  const [bestieVibe,      setBestieVibe]      = useState('chill');
  const [bestieEnergy,    setBestieEnergy]    = useState('chill');
  const bottomRef = useRef<HTMLDivElement>(null);

  const cycleVoiceMode = useCallback(() => setVoiceMode(v => ((v + 1) % 3) as VoiceMode), []);

  const { enqueue: enqueueAudio, stopAll: stopAudio, isSpeaking } = useAudioQueue({ userEmail, persona: 'guardian', lang, onSpeakingChange: () => {} });
  const maybeEnqueueAudio = useCallback((text: string) => { if (voiceMode !== 2) enqueueAudio(text); }, [voiceMode, enqueueAudio]);
  useEffect(() => { if (voiceMode === 2) stopAudio(); }, [voiceMode, stopAudio]);

  const { intakeProfile, loadIntakeProfile } = useIntake({ userEmail, onIntakeComplete: () => {} });

  const { currentPersona, bestieConfig, showBestieSetup: hookShowBestie, setShowBestieSetup: hookSetShowBestie, switchPersona, saveBestieConfig } = usePersona({
    userEmail, lang, intakeProfile,
    onGreeting: (text) => {
      setMessages([{ role: 'assistant', content: text, persona: currentPersona, timestamp: Date.now() }]);
      maybeEnqueueAudio(text);
    },
  });

  useEffect(() => { if (hookShowBestie) { setShowBestieSetup(true); hookSetShowBestie(false); } }, [hookShowBestie, hookSetShowBestie]);

  const { messages, setMessages, input, setInput, inputTextRef, isLoading, error, imageFile, imagePreview, handleImageSelect, clearImage, sendMessage } = useChatSend({
    userEmail, persona: currentPersona, lang, intakeProfile, bestieConfig,
    onAudio: maybeEnqueueAudio, onEmergency: setEmergency,
  });

  const { startRecording, stopRecording } = useVoice({
    lang, isSpeaking,
    onTranscript: (text) => { setInput(text); inputTextRef.current = text; },
    onInterim:    (text) => { setInput(text); },
    onRecordingChange: setIsRecording,
  });

  const vault = useVault({ userEmail, persona: currentPersona });
  useEffect(() => { loadIntakeProfile(); }, [loadIntakeProfile]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const personaConfig  = PERSONAS.find(p => p.id === currentPersona) ?? PERSONAS[0];
  const personaColor   = personaConfig.color;
  const resourceConfig = PERSONA_RESOURCES[currentPersona] ?? PERSONA_RESOURCES.guardian;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const handleBestieSubmit = useCallback(() => {
    if (!bestieName.trim()) return;
    saveBestieConfig({ name: bestieName.trim(), relationship: 'bestie', energy: bestieVibe, topics: [] });
    setShowBestieSetup(false);
  }, [bestieName, bestieVibe, saveBestieConfig]);

  return (
    <div className="flex flex-col h-screen bg-[#080808] text-white overflow-hidden">

      {emergency && <EmergencyOverlay protocol={emergency} onDismiss={() => setEmergency(null)} />}

      {/* Crisis Modal */}
      {showCrisis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl border border-purple-500/40 bg-[#0a0010] p-6 text-center">
            <div className="text-4xl mb-3">💜</div>
            <h3 className="text-white font-bold text-lg mb-2">You're not alone</h3>
            <p className="text-white/70 text-sm mb-4 leading-relaxed">Whatever you're going through — real support is here, any time.</p>
            <a href="tel:988" className="block w-full py-3 rounded-2xl bg-purple-600 text-white font-bold text-lg mb-2 hover:bg-purple-500 transition-colors">📞 Call or Text 988</a>
            <p className="text-white/40 text-xs mb-3">Suicide & Crisis Lifeline — free, confidential, 24/7</p>
            <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="block w-full py-2 rounded-2xl border border-purple-500/30 text-purple-300 text-sm mb-4 hover:bg-purple-500/10 transition-colors">💬 Chat Online Instead</a>
            <button onClick={() => setShowCrisis(false)} className="text-white/30 text-sm hover:text-white/60 transition-colors">Close</button>
          </div>
        </div>
      )}

      {/* Bestie Setup Modal */}
      {showBestieSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl border border-pink-500/40 bg-[#0a000a] p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">💜</div>
              <h3 className="text-white font-bold text-lg">Set Up Your Bestie</h3>
              <p className="text-white/50 text-sm mt-1">Make it personal</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-xs mb-1 block">What should your bestie call you?</label>
                <input type="text" value={bestieName} onChange={e => setBestieName(e.target.value)} placeholder="Your nickname..." className="w-full rounded-2xl bg-white/5 border border-white/10 text-white px-4 py-3 text-sm focus:outline-none focus:border-pink-500/50" />
              </div>
              <div>
                <label className="text-white/70 text-xs mb-2 block">What's the vibe?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ id: 'chill', label: '😌 Chill' }, { id: 'real', label: '💯 Real Talk' }, { id: 'hype', label: '🔥 Hype Me' }].map(v => (
                    <button key={v.id} onClick={() => setBestieVibe(v.id)} className={`py-2 rounded-xl text-xs border transition-all ${bestieVibe === v.id ? 'border-pink-500 bg-pink-500/20 text-pink-300' : 'border-white/10 text-white/50 hover:border-white/30'}`}>{v.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={handleBestieSubmit} disabled={!bestieName.trim()} className="w-full mt-5 py-3 rounded-2xl bg-pink-600 text-white font-bold text-sm disabled:opacity-30 hover:bg-pink-500 transition-colors">Let's Go 💜</button>
            <button onClick={() => setShowBestieSetup(false)} className="w-full mt-2 py-2 text-white/30 text-sm hover:text-white/60 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Persona Grid Modal — NO SIDEBAR */}
      {showPersonaGrid && (
        <PersonaGrid current={currentPersona} userTier={userTier}
          onSelect={(id) => { switchPersona(id); setShowPersonaGrid(false); }}
          onClose={() => setShowPersonaGrid(false)}
        />
      )}

      {/* Dynamic Resource Bar */}
      <button
        onClick={() => resourceConfig.crisis ? setShowCrisis(true) : window.open(resourceConfig.url, '_blank')}
        className="w-full py-2.5 px-4 text-xs font-semibold tracking-wide transition-all hover:opacity-80"
        style={{ backgroundColor: personaColor + '12', borderBottom: `1px solid ${personaColor}25`, color: personaColor }}
      >
        {resourceConfig.label}
      </button>

      {/* Top Nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderBottomColor: personaColor + '20' }}>
        <button onClick={() => setShowPersonaGrid(true)} className="flex items-center gap-2 rounded-2xl px-3 py-1.5 bg-white/5 border transition-all hover:bg-white/10" style={{ borderColor: personaColor + '40' }}>
          <span className="text-lg">{personaConfig.emoji}</span>
          <span className="text-sm font-medium" style={{ color: personaColor }}>{personaConfig.label}</span>
          <span className="text-white/30 text-xs">▾</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={cycleVoiceMode} className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${voiceMode === 2 ? 'border-white/10 text-white/25' : 'border-white/20 text-white/60 bg-white/5'}`}>{VOICE_MODE_LABELS[voiceMode]}</button>
          <button onClick={() => setTrustVisible(v => !v)} className={`text-xs px-2 py-1 rounded-lg border transition-all ${trustVisible ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-white/10 text-white/30'}`}>🛡</button>
          {onSignOut && <button onClick={onSignOut} className="text-xs text-white/20 hover:text-white/50 transition-colors">⏻</button>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-30">
            <span className="text-5xl">{personaConfig.emoji}</span>
            <p className="text-white/60 text-sm">Talk to your {personaConfig.label}</p>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={msg.timestamp ?? i} message={msg} showTrust={trustVisible} />)}
        {isLoading && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start mb-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: personaColor, animationDelay: `${i*150}ms`, opacity: 0.7 }} />)}
              </div>
            </div>
          </div>
        )}
        {error && <div className="text-center text-red-400/70 text-xs py-2">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Bottom Bar */}
      <BottomBar
        input={input} isLoading={isLoading} isRecording={isRecording} isSpeaking={isSpeaking && voiceMode !== 2}
        imagePreview={imagePreview} onInputChange={setInput} onSend={sendMessage}
        onImageSelect={handleImageSelect} onImageClear={clearImage}
        onVoiceStart={startRecording}
        onVoiceStop={() => { stopRecording(); setTimeout(() => { if (inputTextRef.current.trim()) sendMessage(); }, 300); }}
        onKeyDown={handleKeyDown} personaColor={personaColor} lang={lang}
      />
    </div>
  );
};

export default ChatInterface;
