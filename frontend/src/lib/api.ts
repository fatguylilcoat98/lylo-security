// DIRECT CONNECTION TO YOUR RENDER BACKEND
const API_URL = 'https://lylo-backend.onrender.com';


// --- NEW: Added this Missing Interface to fix the Build Error ---
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  confidenceScore?: number;
  scamDetected?: boolean;
  scamIndicators?: string[];
}
// ---------------------------------------------------------------


export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}


export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  confidence_explanation?: string;
  scam_indicators?: string[];
  detailed_analysis?: string;
  web_search_used?: boolean;
  personalization_active?: boolean;
  tier_info?: { name: string };
  usage_info?: { can_send: boolean; current_tier: string };
}


export interface UserStats {
  tier: string;
  conversations_today: number;
  total_conversations: number;
  has_quiz_data: boolean;
  memory_entries: number;
  usage: {
    current: number;
    limit: number;
    percentage: number;
  };
  learning_profile: {
    interests: string[];
    top_concern: string;
  };
}


// NEW: Add access verification function
export const verifyAccess = async (email: string): Promise<{
  access_granted: boolean;
  tier: string;
  user_name: string;
  is_beta: boolean;
  message?: string;
}> => {
  try {
    const formData = new FormData();
    formData.append('email', email);
    
    const response = await fetch(`${API_URL}/verify-access`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to verify access');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Access verification error:', error);
    return {
      access_granted: false,
      tier: 'none',
      user_name: email.split('@')[0],
      is_beta: false,
      message: 'Access verification failed'
    };
  }
};


export const sendChatMessage = async (
  message: string,
  history: any[],
  personaId: string,
  userEmail: string,
  imageFile?: File | null,
  language: string = 'en' // <--- NEW: Defaults to English if not provided
): Promise<ChatResponse> => {
  try {
    const formData = new FormData();
    formData.append('msg', message || "Analyze this image"); 
    formData.append('history', JSON.stringify(history)); 
    formData.append('persona', personaId);
    formData.append('user_email', userEmail);
    formData.append('user_location', ''); 
    formData.append('language', language); // <--- NEW: Sends language to backend

    if (imageFile) {
        formData.append('file', imageFile);
    }

    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Connection Error:', error);
    return {
      answer: language === 'es' ? "Tengo problemas conectando con el servidor. Por favor verifica tu internet." : "I'm having trouble connecting to the server. Please check your internet connection.",
      confidence_score: 0,
      scam_detected: false,
      confidence_explanation: "Connection Failed"
    };
  }
};


export const getUserStats = async (email: string): Promise<UserStats | null> => {
  try {
    const response = await fetch(`${API_URL}/user-stats/${email}`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Stats Error:', error);
    return null;
  }
};


export const saveQuiz = async (
  userEmail: string,
  answers: {
    question1: string;
    question2: string;
    question3: string;
    question4: string;
    question5: string;
  }
): Promise<{ status: string }> => {
  try {
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

    if (!response.ok) throw new Error(`Quiz API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Quiz Save Error:', error);
    return { status: "error" };
  }
};
