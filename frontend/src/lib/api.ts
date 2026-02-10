// src/lib/api.ts

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'; // Change this to your Render URL when deployed

export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  sources?: string[];
}

export const sendChatMessage = async (
  message: string, 
  history: ChatMessage[], 
  personaId: string,
  userEmail: string
): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history, // <--- This sends the conversation memory
        persona_id: personaId,
        user_email: userEmail
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    // Fallback if backend is offline so the app doesn't crash
    return {
      answer: "I'm having trouble reaching my secure server. Please check your internet connection.",
      confidence_score: 0,
      scam_detected: false
    };
  }
};

export const getUserStats = async (email: string) => {
  try {
    const response = await fetch(`${API_URL}/user-stats/${email}`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Stats Error:', error);
    return null;
  }
};
