// TypeScript interfaces
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  confidence_explanation?: string;
  scam_detected: boolean;
  scam_indicators: string[];
  detailed_analysis?: string;
  tier_info?: any;
  usage_info?: {
    can_send: boolean;
    is_overage: boolean;
    messages_today: number;
    daily_limit: number;
    remaining_today: number;
    overage_cost?: number;
  };
  legal_connect?: {
    available: boolean;
    message: string;
    confidence_in_legal_need?: number;
  };
  upgrade_needed?: boolean;
  available_personas?: string[];
  personalization_active?: boolean;
  learned_preferences?: {
    tech_level: string;
    communication_style: string;
    total_conversations: number;
  };
}

export interface UserStats {
  usage: {
    messages_today: number;
    messages_this_month: number;
    overages_this_month: number;
    total_cost_this_month: number;
    tier: string;
  };
  learning_profile: {
    tech_level: string;
    communication_style: string;
    interests: string[];
    total_conversations: number;
    confidence_preferences: string;
  };
}

export async function sendChatMessage(
  message: string, 
  history: ChatMessage[] = [],
  persona: string = "guardian",
  userEmail: string = "",
  sessionId: string = "demo"
): Promise<ChatResponse> {
  
  try {
    const backendUrl = 'https://lylo-backend.onrender.com';
    const tier = localStorage.getItem('lylo_user_tier') || 'free';
    
    // Make sure all required fields are sent
    const formData = new FormData();
    formData.append('msg', message);
    formData.append('history', JSON.stringify(history));
    formData.append('persona', persona);
    formData.append('tier', tier);
    formData.append('user_email', userEmail || 'demo@example.com');
    formData.append('session_id', sessionId);

    console.log('Sending to backend:', {
      msg: message,
      persona,
      tier,
      user_email: userEmail || 'demo@example.com'
    });

    const response = await fetch(`${backendUrl}/chat`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("LYLO Backend Error:", error);
    return {
      answer: "I'm having trouble connecting to my backend. The server is running but there's a communication issue.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      usage_info: {
        can_send: true,
        is_overage: false,
        messages_today: 0,
        daily_limit: 5,
        remaining_today: 5
      }
    };
  }
}

export async function getUserStats(userEmail: string): Promise<UserStats | null> {
  try {
    const backendUrl = 'https://lylo-backend.onrender.com';
    
    const response = await fetch(`${backendUrl}/user-stats/${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Get Stats Error:", error);
    return null;
  }
}

export async function clearUserData(userEmail: string): Promise<boolean> {
  try {
    const backendUrl = 'https://lylo-backend.onrender.com';
    
    const formData = new FormData();
    formData.append('user_email', userEmail);
    
    const response = await fetch(`${backendUrl}/clear-user-data`, {
      method: 'POST',
      body: formData
    });
    
    return response.ok;
  } catch (error) {
    console.error("Clear Data Error:", error);
    return false;
  }
}

export async function connectLegal(
  userId: string,
  caseType: string = "scam_recovery",
  userEmail: string = "",
  description: string = ""
): Promise<any> {
  try {
    const backendUrl = 'https://lylo-backend.onrender.com';
    const tier = localStorage.getItem('lylo_user_tier') || 'free';
    
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('case_type', caseType);
    formData.append('tier', tier);
    formData.append('user_email', userEmail);
    formData.append('description', description);

    const response = await fetch(`${backendUrl}/legal-connect`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Legal connect error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Legal Connect Error:", error);
    throw error;
  }
}

export async function getTiers(): Promise<any> {
  try {
    const backendUrl = 'https://lylo-backend.onrender.com';
    
    const response = await fetch(`${backendUrl}/tiers`);
    
    if (!response.ok) {
      throw new Error(`Tiers error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Get Tiers Error:", error);
    return {
      tiers: {
        free: { name: "Free Tier", daily_limit: 5, price: 0 },
        pro: { name: "Pro Tier", daily_limit: 50, price: 9.99 },
        elite: { name: "Elite Tier", daily_limit: 99999, price: 29.99 }
      }
    };
  }
}
