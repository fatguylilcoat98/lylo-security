/**
 * LYLO OS — chat/ui/MessageBubble.tsx
 * Typewriter effect on assistant messages by default.
 * User bubbles glow in persona color.
 */
import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, TrustSentence } from '../../../types';

const TIER_COLORS = { GREEN: '#39FF14', YELLOW: '#FFD700', RED: '#FF4444', BLUE: '#00CFFF' };
const TIER_LABELS = { GREEN: 'Verified',  YELLOW: 'Caution',  RED: 'Warning',  BLUE: 'Info' };

interface MessageBubbleProps {
  message:       ChatMessage;
  showTrust?:    boolean;
  personaColor?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, showTrust = false, personaColor = '#00CFFF',
}) => {
  const [expanded,    setExpanded]    = useState(false);
  const [displayed,   setDisplayed]   = useState('');
  const [typingDone,  setTypingDone]  = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUser   = message.role === 'user';

  // Typewriter for assistant messages
  useEffect(() => {
    if (isUser) { setDisplayed(message.content); setTypingDone(true); return; }

    // Reset when content changes (new message)
    indexRef.current = 0;
    setDisplayed('');
    setTypingDone(false);

    const full = message.content;
    if (!full) return;

    const tick = () => {
      indexRef.current += 1;
      setDisplayed(full.slice(0, indexRef.current));
      if (indexRef.current < full.length) {
        // Speed: 18ms per char — fast but readable
        timerRef.current = setTimeout(tick, 18);
      } else {
        setTypingDone(true);
      }
    };
    timerRef.current = setTimeout(tick, 18);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [message.content, isUser]);

  const renderTrustBadge = () => {
    if (!message.trust_audit || isUser || !typingDone) return null;
    const tier  = message.trust_audit.overall_tier;
    const color = TIER_COLORS[tier];
    return (
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 mt-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
        style={{ color }}>
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
        {TIER_LABELS[tier]}
        <span className="ml-1 text-white/40">{expanded ? '▲' : '▼'}</span>
      </button>
    );
  };

  const renderTrustDetail = () => {
    if (!expanded || !message.trust_audit) return null;
    return (
      <div className="mt-2 border border-white/10 rounded-xl p-3 text-xs space-y-1">
        {message.trust_audit.sentences.map((s: TrustSentence, i: number) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[s.tier] }} />
            <span className="text-white/70">{s.text}</span>
          </div>
        ))}
        {message.trust_audit.action_required && (
          <div className="mt-2 border-t border-white/10 pt-2 text-yellow-400">
            ⚠️ {message.trust_audit.action_required}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border"
        style={isUser ? {
          backgroundColor: personaColor + '20',
          borderColor:     personaColor + '50',
          borderBottomRightRadius: 4,
          color: '#fff',
        } : {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderColor:     'rgba(255,255,255,0.08)',
          borderBottomLeftRadius: 4,
          color: 'rgba(255,255,255,0.9)',
        }}
      >
        {message.image_url && (
          <img src={message.image_url} alt="attached" className="rounded-xl mb-2 max-h-40 object-cover" />
        )}
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {displayed}
          {/* Blinking cursor while typing */}
          {!typingDone && !isUser && (
            <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle rounded"
              style={{ backgroundColor: personaColor }} />
          )}
        </div>
        {showTrust && renderTrustBadge()}
        {renderTrustDetail()}
      </div>
    </div>
  );
};
