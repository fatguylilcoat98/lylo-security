// src/lib/api.ts

// The URL for your Render backend (port 10000)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000'; 

export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  confidence_explanation?: string;
}

// THE MISSING PIECE: This interface is what UsageDisplay.tsx is looking for
export interface UserStats {
  tier: string;
  conversations_today: number;
  total_conversations: number;
  has_quiz_data: boolean;
  memory_entries: number;
}

export const sendChatMessage = async (
  message: string, 
  history: any[], 
  personaId: string,
  userEmail: string
): Promise<ChatResponse> => {
  try {
    const formData = new FormData();
    formData.append('msg', message);
    formData.append('history', JSON.stringify(history)); 
    formData.append('persona', personaId);
    formData.append('user_email', userEmail);
    formData.append('tier', 'elite'); 

    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      body: formData, // Sending as FormData for your Python backend
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend Error:", errorText);
      throw new Error(`Server Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Connection Error:', error);
    return {
      answer: "I'm having trouble connecting to the LYLO mainframe. Is the backend running?",
      confidence_score: 0,
      scam_detected: false,
      confidence_explanation: "System Offline"
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
