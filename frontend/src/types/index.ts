export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  imageUrl?: string;
  scamDetected?: boolean;
  confidenceScore?: number;
  scamIndicators?: string[];
}
export interface UserProfile {
  name: string;
  access_code: string;
  style: string;
  vibe: string;
  memory_bank: string[];
  is_elite: boolean;
  fontsize: number;
}
export interface ScamAlert {
  isActive: boolean;
  confidence: number;
  indicators: string[];
}
export const QUICK_ACTIONS = [
  { id: 'safe', label: 'Check Safety', icon: 'Shield' },
  { id: 'weather', label: 'Weather', icon: 'Cloud' },
  { id: 'recipe', label: 'Recipes', icon: 'ChefHat' }
];