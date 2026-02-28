/**
 * LYLO OS — chat/ui/MessageBubble.tsx  (Phase 1 — Markdown + Trust Layer)
 * Renders a single chat message with proper markdown and optional trust audit.
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
  GREEN:  '✅ Verified',
  YELLOW: '💎 Probable',
  RED:    '⚠️ Uncertain',
  BLUE:   '🔵 Info',
};

interface MessageBubbleProps {
  message:    ChatMessage;
  showTrust?: boolean;
}

// ── Simple markdown renderer (no external deps needed) ─────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    // Bold: **text**
    // Italic: *text*
    // We'll parse inline formatting per line
    const parts = parseInline(line);

    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      // Full line bold heading
      result.push(
        <div key={lineIdx} className="font-bold text-white mt-2 mb-1">
          {parseInline(line.slice(2, -2))}
        </div>
      );
    } else if (line.match(/^#{1,3}\s/)) {
      // Heading
      const content = line.replace(/^#{1,3}\s/, '');
      result.push(
        <div key={lineIdx} className="font-bold text-white text-base mt-2 mb-1">
          {content}
        </div>
      );
    } else if (line.match(/^[-*]\s/)) {
      // Bullet point
      result.push(
        <div key={lineIdx} className="flex gap-2 items-start my-0.5">
          <span className="text-white/50 mt-0.5 shrink-0">•</span>
          <span>{parseInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      // Numbered list
      const num = line.match(/^(\d+)\./)?.[1];
      result.push(
        <div key={lineIdx} className="flex gap-2 items-start my-0.5">
          <span className="text-white/50 shrink-0 font-bold">{num}.</span>
          <span>{parseInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      result.push(<div key={lineIdx} className="h-2" />);
    } else {
      result.push(
        <div key={lineIdx} className="leading-relaxed">
          {parseInline(line)}
        </div>
      );
    }
  });

  return result;
}

// Parse inline bold/italic within a line
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, or plain text
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[0].startsWith('**')) {
      parts.push(<strong key={match.index} className="font-bold text-white">{match[2]}</strong>);
    } else {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showTrust = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === 'user';

  // ── Trust tier badge ───────────────────────────────────────────────────────
  const renderTrustBadge = () => {
    if (!message.trust_audit || isUser) return null;
    const tier  = message.trust_audit.overall_tier;
    const color = TIER_COLORS[tier];
    return (
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 mt-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
        style={{ color }}
      >
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
        {TIER_LABELS[tier]}
        <span className="ml-1 text-white/40">{expanded ? '▲' : '▼'}</span>
      </button>
    );
  };

  // ── Trust sentence breakdown ───────────────────────────────────────────────
  const renderTrustDetail = () => {
    if (!expanded || !message.trust_audit) return null;
    return (
      <div className="mt-2 border border-white/10 rounded-xl p-3 text-xs space-y-2">
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
            ? 'bg-[#1a0a00] text-white border border-orange-500/30 rounded-br-sm'
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

        {/* Message content — markdown rendered for assistant, plain for user */}
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        ) : (
          <div className="space-y-0.5">
            {renderMarkdown(message.content)}
          </div>
        )}

        {/* Trust layer */}
        {showTrust && renderTrustBadge()}
        {renderTrustDetail()}
      </div>
    </div>
  );
};
