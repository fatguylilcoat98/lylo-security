/**
 * LYLO OS — chat/ui/MessageBubble.tsx
 * Renders a single chat message with optional Trust Layer audit display.
 */
import React, { useState } from 'react';
import type { ChatMessage, TrustSentence } from '../../../types';

const TIER_COLORS = {
  GREEN:  '#39FF14',
  YELLOW: '#FFD700',
  RED:    '#FF4444',
  BLUE:   '#00CFFF',
};

const TIER_LABELS = {
  GREEN:  'Verified',
  YELLOW: 'Caution',
  RED:    'Warning',
  BLUE:   'Info',
};

interface MessageBubbleProps {
  message:    ChatMessage;
  showTrust?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showTrust = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === 'user';

  // ── Trust tier badge ──────────────────────────────────────────────────────
  const renderTrustBadge = () => {
    if (!message.trust_audit || isUser) return null;
    const tier  = message.trust_audit.overall_tier;
    const color = TIER_COLORS[tier];
    return (
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 mt-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
        style={{ color }}
      >
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
        {TIER_LABELS[tier]}
        <span className="ml-1 text-white/40">{expanded ? '▲' : '▼'}</span>
      </button>
    );
  };

  // ── Trust sentence breakdown ──────────────────────────────────────────────
  const renderTrustDetail = () => {
    if (!expanded || !message.trust_audit) return null;
    return (
      <div className="mt-2 border border-white/10 rounded-xl p-3 text-xs space-y-1">
        {message.trust_audit.sentences.map((s: TrustSentence, i: number) => (
          <div key={i} className="flex gap-2 items-start">
            <span
              className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: TIER_COLORS[s.tier] }}
            />
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
        className={`
          max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-green-500/20 text-white border border-green-500/30 rounded-br-sm'
            : 'bg-white/5 text-white/90 border border-white/10 rounded-bl-sm'
          }
        `}
      >
        {/* Image preview */}
        {message.image_url && (
          <img
            src={message.image_url}
            alt="attached"
            className="rounded-xl mb-2 max-h-40 object-cover"
          />
        )}

        {/* Message content */}
        <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>

        {/* Trust layer */}
        {showTrust && renderTrustBadge()}
        {renderTrustDetail()}
      </div>
    </div>
  );
};
