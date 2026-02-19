import { PersonaConfig } from '../data/personas';

export const getPersonaColorClass = (
  persona: PersonaConfig, 
  type: 'border' | 'glow' | 'bg' | 'text' = 'border'
) => {
  const colorMap: Record<string, Record<'border' | 'glow' | 'bg' | 'text', string>> = {
    blue: { 
      border: 'border-blue-400', 
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]', 
      bg: 'bg-blue-500', 
      text: 'text-blue-400' 
    },
    orange: { 
      border: 'border-orange-400', 
      glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]', 
      bg: 'bg-orange-500', 
      text: 'text-orange-400' 
    },
    gold: { 
      border: 'border-yellow-400', 
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]', 
      bg: 'bg-yellow-500', 
      text: 'text-yellow-400' 
    },
    gray: { 
      border: 'border-gray-400', 
      glow: 'shadow-[0_0_20px_rgba(107,114,128,0.3)]', 
      bg: 'bg-gray-500', 
      text: 'text-gray-400' 
    },
    yellow: { 
      border: 'border-yellow-300', 
      glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]', 
      bg: 'bg-yellow-400', 
      text: 'text-yellow-300' 
    },
    purple: { 
      border: 'border-purple-400', 
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]', 
      bg: 'bg-purple-500', 
      text: 'text-purple-400' 
    },
    indigo: { 
      border: 'border-indigo-400', 
      glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]', 
      bg: 'bg-indigo-500', 
      text: 'text-indigo-400' 
    },
    pink: { 
      border: 'border-pink-400', 
      glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)]', 
      bg: 'bg-pink-500', 
      text: 'text-pink-400' 
    },
    red: { 
      border: 'border-red-400', 
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]', 
      bg: 'bg-red-500', 
      text: 'text-red-400' 
    },
    green: { 
      border: 'border-green-400', 
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]', 
      bg: 'bg-green-500', 
      text: 'text-green-400' 
    }
  };

  return colorMap[persona.color]?.[type] || colorMap.blue[type];
};
