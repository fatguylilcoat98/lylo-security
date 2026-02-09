export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  scam_indicators: string[];
  new_memories: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

// Lazy load APIs only when needed to prevent initialization crashes
export async function sendChatMessage(
  message: string, 
  history: ChatMessage[] = [],
  profile: any = {}, 
  accessCode: string = "BETA-2026",
  image?: string | null
): Promise<ChatResponse> {
  
  try {
    // Check if we have API keys before attempting to import/initialize
    const hasGemini = import.meta.env.VITE_GEMINI_API_KEY;
    const hasTavily = import.meta.env.VITE_TAVILY_API_KEY;
    
    if (!hasGemini || !hasTavily) {
      return {
        answer: "LYLO System: Demo Mode Active. API keys not configured. Your message was received but I'm running in safe mode.",
        confidence_score: 95,
        scam_detected: false,
        scam_indicators: [],
        new_memories: [`User said: ${message}`]
      };
    }

    // Dynamic imports to prevent crashes
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { tavily } = await import('@tavily/core');

    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
    const tvly = tavily({ apiKey: import.meta.env.VITE_TAVILY_API_KEY });

    // Get live intelligence
    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 3
    });

    // Build vault context from localStorage
    const techLevel = localStorage.getItem('lylo_tech_level') || 'average';
    const personality = localStorage.getItem('lylo_personality') || 'protective';
    const hardware = localStorage.getItem('lylo_calibration_hardware') || 'Unknown devices';
    const finances = localStorage.getItem('lylo_calibration_finances') || 'Unknown accounts';

    const vaultContext = `
      VAULT PROFILE:
      Name: Christopher Hughes
      Location: Sacramento, California
      Tech Level: ${techLevel}
      AI Personality: ${personality}
      Hardware: ${hardware}
      Financial Accounts: ${finances}
      Preferences: Zero-sugar drinks, No mustard/Add mayo on burgers
      Interests: Xbox 360 SSD modding, Custom PC builds, Bitcoin via Cash App
    `;

    // Build conversation history
    const conversationHistory = history.slice(-6).map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
      You are LYLO, Christopher's Digital Bodyguard and AI assistant.
      
      ${vaultContext}
      
      RECENT CONVERSATION:
      ${conversationHistory}
      
      LIVE INTEL: ${search.answer || "No live data found."}
      
      CURRENT MESSAGE: ${message}
      
      INSTRUCTIONS:
      1. Respond as LYLO - protective, intelligent, and personalized to Christopher
      2. Analyze for scams: Check if the message contains phishing, fake offers, suspicious links, or fraud indicators
      3. Use Christopher's vault context to personalize responses
      4. Be concise but helpful
      
      RESPONSE FORMAT (JSON):
      {
        "answer": "Your response as LYLO",
        "confidence_score": 85,
        "scam_detected": false,
        "scam_indicators": [],
        "new_memories": ["Any new facts to remember about Christopher"]
      }
    `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    return {
      answer: data.answer || "LYLO processing complete.",
      confidence_score: data.confidence_score || 98,
      scam_detected: data.scam_detected || false,
      scam_indicators: data.scam_indicators || [],
      new_memories: data.new_memories || []
    };
  } catch (error) {
    console.error("LYLO ENGINE ERROR:", error);
    return {
      answer: "Neural Link interrupted. LYLO system running in safe mode. Please check your connection.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      new_memories: []
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
