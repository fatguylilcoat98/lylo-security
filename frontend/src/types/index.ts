export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  imageUrl?: string;
  scamDetected?: boolean;
  confidenceScore?: number;
  scamIndicators?: string[];
  // Added to ensure compatibility with your ChatInterface state
  role?: 'user' | 'assistant'; 
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

export interface PersonaConfig {
  id: string;
  name: string;
  description: string;
  // Changed from string to a specific list to support 'gold' and your Glow Logic
  color: 'blue' | 'orange' | 'green' | 'red' | 'purple' | 'yellow' | 'gold' | string;
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
