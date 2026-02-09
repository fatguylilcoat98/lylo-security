import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { tavily } from '@tavily/core';
import { loadStripe } from '@stripe/stripe-js';

// SAFE INITIALIZATION: This prevents the "Class extends value undefined" crash
const genAI = import.meta.env.VITE_GEMINI_API_KEY 
  ? new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
  : null;

const pc = import.meta.env.VITE_PINECONE_API_KEY 
  ? new Pinecone({ apiKey: import.meta.env.VITE_PINECONE_API_KEY })
  : null;

const tvly = import.meta.env.VITE_TAVILY_API_KEY 
  ? tavily({ apiKey: import.meta.env.VITE_TAVILY_API_KEY })
  : null;

export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  scam_indicators: string[];
  new_memories: string[];
}

export async function sendChatMessage(
  message: string, 
  profile: any, 
  accessCode: string, 
  image?: string | null
): Promise<ChatResponse> {
    try {
    // Check if APIs are available
    if (!tvly || !genAI) {
      console.warn("LYLO WARNING: API Keys missing. Running in SAFE MODE.");
      return {
        answer: "⚠️ LYLO SYSTEM: API Keys are missing in Render. I cannot search the web or think yet, but the app is online. Please add VITE_GEMINI_API_KEY and VITE_TAVILY_API_KEY to your Render Environment Variables.",
        confidence_score: 0,
        scam_detected: false,
        scam_indicators: [],
        new_memories: []
      };
    }

    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 3
    });

    // Christopher's Personal Vault Context
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
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

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
      answer: "Neural Link interrupted. Please check the Render logs.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      new_memories: []
    };
  }
}

export async function startSubscription(priceId: string) {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  if (!stripeKey) {
    console.error("Stripe key not found");
    return;
  }
  const stripe = await loadStripe(stripeKey);
  if (!stripe) throw new Error("Stripe failed to load.");
  
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });
  
  const session = await response.json();
  if (session.url) window.location.href = session.url;
}
