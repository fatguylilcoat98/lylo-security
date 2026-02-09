// TypeScript interfaces
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  scam_indicators: string[];
  new_memories: string[];
  tier_info?: any;
  legal_connect?: {
    available: boolean;
    message: string;
    action: string;
  };
  upgrade_needed?: boolean;
}

export async function sendChatMessage(
  message: string, 
  history: ChatMessage[] = [],
  profile: any = {}, 
  accessCode: string = "ELITE-2026",
  image?: string | null
): Promise<ChatResponse> {
  
  try {
    // Check if we have a backend URL
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';
    
    // Get user's tier and persona
    const tier = localStorage.getItem('lylo_user_tier') || 'free';
    const persona = localStorage.getItem('lylo_selected_persona') || 'guardian';
    
    // Prepare form data
    const formData = new FormData();
    formData.append('msg', message);
    formData.append('history', JSON.stringify(history));
    formData.append('persona', persona);
    formData.append('tier', tier);
    formData.append('user_id', localStorage.getItem('lylo_user_id') || 'demo');

    const response = await fetch(`${backendUrl}/chat`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      answer: data.answer,
      confidence_score: data.confidence_score || 98,
      scam_detected: data.scam_detected || false,
      scam_indicators: data.scam_indicators || [],
      new_memories: data.new_memories || [],
      tier_info: data.tier_info,
      legal_connect: data.legal_connect,
      upgrade_needed: data.upgrade_needed
    };

  } catch (error) {
    console.error("LYLO Backend Error:", error);
    return {
      answer: "I'm having trouble connecting to my backend brain. Is the FastAPI server running on port 10000?",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      new_memories: []
    };
  }
}

export async function connectLegal(caseType: string = "scam_recovery"): Promise<any> {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';
    const tier = localStorage.getItem('lylo_user_tier') || 'free';
    const userId = localStorage.getItem('lylo_user_id') || 'demo';
    
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('case_type', caseType);
    formData.append('tier', tier);

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
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';
    
    const response = await fetch(`${backendUrl}/tiers`);
    
    if (!response.ok) {
      throw new Error(`Tiers error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Get Tiers Error:", error);
    return {
      free: { name: "Free Tier", max_messages_per_day: 10 },
      pro: { name: "Pro Tier", max_messages_per_day: 100 },
      elite: { name: "Elite Tier", max_messages_per_day: 1000 }
    };
  }
}

export async function startSubscription(priceId: string) {
  try {
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripeKey) {
      console.error("Stripe key not found");
      return;
    }

    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(stripeKey);
    
    if (!stripe) throw new Error("Stripe failed to load.");
    
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    
    const session = await response.json();
    if (session.url) window.location.href = session.url;
  } catch (error) {
    console.error("Stripe error:", error);
  }
}
