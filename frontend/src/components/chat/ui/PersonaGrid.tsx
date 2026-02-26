/**
 * LYLO OS — chat/ui/PersonaGrid.tsx
 * Persona selection grid shown in the bottom bar or modal.
 */
import React from 'react';
import { PERSONAS } from '../usePersona';
import type { PersonaConfig } from '../../../types';

interface PersonaGridProps {
  current:    string;
  userTier:   string;
  onSelect:   (id: string) => void;
  onClose:    () => void;
}

const TIER_ORDER = ['free', 'pro', 'elite', 'max'];

function tierUnlocked(userTier: string, personaTier: string): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(personaTier);
}

export const PersonaGrid: React.FC<PersonaGridProps> = ({
  current, userTier, onSelect, onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-3xl bg-[#0a0a0a] border-t border-green-500/30 p-6 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg tracking-wide">CHOOSE YOUR SPECIALIST</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >×</button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-3">
          {PERSONAS.map((p: PersonaConfig) => {
            const unlocked = tierUnlocked(userTier, p.tier);
            const active   = current === p.id;
            return (
              <button
                key={p.id}
                onClick={() => unlocked ? onSelect(p.id) : undefined}
                disabled={!unlocked}
                className={`
                  relative flex flex-col items-center justify-center rounded-2xl p-3 gap-1
                  transition-all duration-200 border
                  ${active
                    ? 'border-green-400 bg-green-500/10 scale-105'
                    : unlocked
                      ? 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      : 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
                  }
                `}
                style={active ? { borderColor: p.color } : undefined}
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-white/80 text-xs font-medium">{p.label}</span>
                {!unlocked && (
                  <span className="absolute top-1 right-1 text-[10px] text-yellow-400 font-bold">
                    {p.tier.toUpperCase()}
                  </span>
                )}
                {active && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
