export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  scam_indicators: string[];
  new_memories: string[];
}

// Lazy load APIs only when needed to prevent initialization crashes
export async function sendChatMessage(
  message: string, 
  profile: any, 
  accessCode: string, 
  image?: string | null
): Promise<ChatResponse> {
  
  try {
    // Check if we have API keys before attempting to import/initialize
    const hasGemini = import.meta.env.VITE_GEMINI_API_KEY;
    const hasTavily = import.meta.env.VITE_TAVILY_API_KEY;
    
    if (!hasGemini || !hasTavily) {
      return {
        answer: "LYLO System: Demo Mode Active. API keys not configured.",
        confidence_score: 95,
        scam_detected: false,
        scam_indicators: [],
        new_memories: []
      };
    }

    // Dynamic imports to prevent crashes
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { tavily } = await import('@tavily/core');

    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
    const tvly = tavily({ apiKey: import.meta.env.VITE_TAVILY_API_KEY });

    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 3
    });

    const vaultContext = `
      User: Christopher Hughes (Sacramento area).
      Preferences: Zero-sugar drinks, No mustard/Add mayo on burgers.
      Interests: Xbox 360 SSD modding, Custom PC builds, Bitcoin via Cash App.
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
      You are LYLO, the Digital Bodyguard. 
      VAULT: ${vaultContext}
      LIVE INTEL: ${search.answer || "No live data found."}
      USER MESSAGE: ${message}
      RESPONSE FORMAT (JSON):
      {"answer": "string", "confidence_score": number, "scam_detected": boolean, "scam_indicators": [], "new_memories": []}
    `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    return {
      answer: data.answer,
      confidence_score: data.confidence_score || 98,
      scam_detected: data.scam_detected || false,
      scam_indicators: data.scam_indicators || [],
      new_memories: data.new_memories || []
    };
  } catch (error) {
    console.error("LYLO ENGINE ERROR:", error);
    return {
      answer: "Neural Link interrupted. System running in safe mode.",
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
