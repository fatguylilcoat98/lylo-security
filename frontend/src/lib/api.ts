/**
 * LYLO DIGITAL BODYGUARD - API CLIENT LIBRARY
 * Version: 17.5.0 (Modular Intelligence & Total Integration)
 */

const API_URL = 'https://lylo-backend.onrender.com';

// ---------------------------------------------------------
// 1. TYPE DEFINITIONS (The "Everything" Interface)
// ---------------------------------------------------------

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  confidenceScore?: number;
  scamDetected?: boolean;
  scamIndicators?: string[];
}

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  threat_level: string;
  bodyguard_model: string;
  persona_hook?: string;
  communication_style?: string;
  scam_indicators?: string[];
  usage_info?: { can_send: boolean };
}

export interface UserStats {
  tier: string;
  display_name: string;
  team_size: number;
  conversations_today: number;
  total_conversations: number;
  usage: {
    current: number;
    limit: number;
    percentage: number;
  };
}

export interface QuizAnswers {
  question1: string;
  question2: string;
  question3: string;
  question4: string;
  question5: string;
}

// ---------------------------------------------------------
// 2. CORE CHAT & INTELLIGENCE FUNCTIONS
// ---------------------------------------------------------

/**
 * SEND CHAT MESSAGE
 * The primary engine for Lylo's modular experts.
 */
export const sendChatMessage = async (
  message: string,
  history: any[],
  personaId: string,
  userEmail: string,
  imageFile?: File | null,
  language: string = 'en',
  vibe: string = 'standard'
): Promise<ChatResponse> => {
  try {
    const formData = new FormData();
    formData.append('msg', message || "Analyze request"); 
    formData.append('history', JSON.stringify(history)); 
    formData.append('persona', personaId);
    formData.append('user_email', userEmail);
    formData.append('language', language);
    formData.append('vibe', vibe); 
    
    if (imageFile) formData.append('file', imageFile);

    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Backend Connection Failed');
    return await response.json();
  } catch (error) {
    console.error('API Chat Error:', error);
    return {
      answer: language === 'es' ? "Error de conexión." : "I'm having trouble reaching the team.",
      confidence_score: 0,
      scam_detected: false,
      threat_level: 'unknown',
      bodyguard_model: 'Offline'
    };
  }
};

// ---------------------------------------------------------
// 3. USER MANAGEMENT & STATS
// ---------------------------------------------------------

export const getUserStats = async (email: string): Promise<UserStats> => {
  const response = await fetch(`${API_URL}/user-stats/${email}`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return await response.json();
};

export const checkBetaAccess = async (email: string) => {
  const response = await fetch(`${API_URL}/check-beta-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return await response.json();
};

export const saveQuiz = async (userEmail: string, answers: QuizAnswers) => {
  const formData = new FormData();
  formData.append('user_email', userEmail);
  formData.append('question1', answers.question1);
  formData.append('question2', answers.question2);
  formData.append('question3', answers.question3);
  formData.append('question4', answers.question4);
  formData.append('question5', answers.question5);

  const response = await fetch(`${API_URL}/quiz`, {
    method: 'POST',
    body: formData,
  });
  return await response.json();
};

// ---------------------------------------------------------
// 4. ELITE SECURITY & RECOVERY
// ---------------------------------------------------------

export const getScamRecoveryGuide = async (email: string) => {
  const response = await fetch(`${API_URL}/scam-recovery/${email}`);
  if (!response.ok) throw new Error('Recovery guide access denied');
  return await response.json();
};

// ---------------------------------------------------------
// 5. AUDIO & MULTIMEDIA
// ---------------------------------------------------------

export const generateAudio = async (text: string, voice: string = 'onyx') => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('voice', voice);
  
  const response = await fetch(`${API_URL}/generate-audio`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) throw new Error('Audio failed');
  return await response.json();
};
