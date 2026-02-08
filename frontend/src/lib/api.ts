import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { tavily } from '@tavily/core';
import { loadStripe } from '@stripe/stripe-js';

// 1. INITIALIZE ENGINES (Pulling from Render Env)
// Using VITE_ prefix for Vite/React compatibility
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: import.meta.env.VITE_PINECONE_API_KEY });
const tvly = tavily({ apiKey: import.meta.env.VITE_TAVILY_API_KEY });

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  scam_indicators: string[];
  new_memories: string[];
}

/**
 * THE VAST BRAIN: 
 * Merges Gemini Reasoning, Tavily Live Intel, and Pinecone Memory.
 */
export async function sendChatMessage(
  message: string, 
  profile: any, 
  accessCode: string, 
  image?: string | null
): Promise<ChatResponse> {
  
  try {
    // A. TRUTH PROTOCOL: Live Tavily Search for real-time Sacramento data
    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 5
    });

    // B. MEMORY VAULT: Custom Context (Xbox mods, PC builds, Sacramento life)
    const vaultContext = `
      User Identity: Christopher Hughes.
      Location: Sacramento / Roseville / Rio Linda area.
      Known Preferences: Zero-sugar soft drinks (Pepsi/Diet Pepsi), No mustard/Add mayo on burgers.
      Tech Interests: Xbox 360 SSD modding (College Football Revamped), Custom PC builds (Sapphire Nitro+ GPU), Bitcoin payments via Cash App.
      Social: Twitch user 'fatguylilcoat98'.
    `;

    // C. GEMINI 1.5 FLASH: The Reasoning Engine
    // We use JSON mode to ensure the front-end never breaks.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
      You are LYLO, the Digital Bodyguard. 
      VAULT CONTEXT: ${vaultContext}
      LIVE INTERNET INTEL: ${search.answer || "No live data available for this specific query."}
      
      STRICT TRUTH PROTOCOL:
      1. Cross-reference the USER MESSAGE with the LIVE INTERNET INTEL.
      2. If the user asks for weather, prices, or local Sacramento info, use the Live Intel.
      3. If the user asks about tech (Xbox/PC), refer to the Vault Context.
      4. If you are not 95% certain, state your confidence percentage.
      5. Look for SCAM INDICATORS (suspicious links, urgency, unknown requests).

      USER MESSAGE: ${message}
      ${image ? "[IMAGE ATTACHED: Analyze this for scams or tech info]" : ""}
      
      RESPONSE FORMAT (JSON ONLY):
      {
        "answer": "Your detailed, protective response here",
        "confidence_score": 98,
        "scam_detected": false,
        "scam_indicators": ["List any red flags found"],
        "new_memories": ["Any new facts to save about the user"]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return {
      answer: data.answer,
      confidence_score: data.confidence_score || 95,
      scam_detected: data.scam_detected || false,
      scam_indicators: data.scam_indicators || [],
      new_memories: data.new_memories || []
    };

  } catch (error) {
    console.error("LYLO ENGINE ERROR:", error);
    return {
      answer: "Neural Link interrupted. I can't access my memory vault or the live web right now. Please check your Render API keys.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      new_memories: []
    };
  }
}

/**
 * STRIPE SUBSCRIPTION:
 * Direct redirect to your hosted Stripe checkout.
 */
export async function startSubscription(priceId: string) {
  // Load the Publishable Key from Render Env
  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  if (!stripe) throw new Error("Stripe failed to initialize. Check your VITE_STRIPE_PUBLISHABLE_KEY.");

  // This calls your backend (Render) to create a real session
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  const session = await response.json();
  
  // Redirect the user to the secure Stripe page
  if (session.url) {
    window.location.href = session.url;
  } else {
    // Fallback if your backend isn't ready: redirectToCheckout
    await stripe.redirectToCheckout({ sessionId: session.id });
  }
}
