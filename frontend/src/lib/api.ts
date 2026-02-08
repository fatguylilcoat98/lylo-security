import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { tavily } from '@tavily/core';
import { loadStripe } from '@stripe/stripe-js';

// 1. INITIALIZE ENGINES (Pulling from Render Env)
// Render variables MUST start with VITE_ to be visible in the frontend
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const pc = new Pinecone({ apiKey: import.meta.env.VITE_PINECONE_API_KEY || '' });
const tvly = tavily({ apiKey: import.meta.env.VITE_TAVILY_API_KEY || '' });

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
    // A. TRUTH PROTOCOL: Live Tavily Search
    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 5
    });

    // B. VAULT CONTEXT (Your specific Sacramento/Tech details)
    const vaultContext = `
      User: Christopher Hughes. Location: Sacramento/Roseville area.
      Preferences: Zero-sugar drinks, no mustard/add mayo on burgers.
      Tech: Xbox 360 SSD modding, Custom PC builds, Bitcoin via Cash App.
    `;

    // C. GEMINI 1.5 FLASH (Fastest Free Tier Model)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
      You are LYLO, the Digital Bodyguard. 
      VAULT: ${vaultContext}
      LIVE INTEL: ${search.answer || "No live data available."}
      MESSAGE: ${message}
      
      STRICT TRUTH PROTOCOL: Cross-reference and provide a confidence score.
      RESPONSE FORMAT (JSON): 
      {"answer": "string", "confidence_score": number, "scam_detected": boolean, "scam_indicators": [], "new_memories": []}
    `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

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
      answer: "Neural Link interrupted. Check your Render VITE_ keys.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      new_memories: []
    };
  }
}

/**
 * STRIPE SUBSCRIPTION:
 * Uses the Publishable Key (pk_...) to open the checkout window.
 */
export async function startSubscription(priceId: string) {
  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  if (!stripe) throw new Error("Stripe failed to load. Check VITE_STRIPE_PUBLISHABLE_KEY.");

  // This redirects the user to your Stripe-hosted checkout page
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  const session = await response.json();
  if (session.url) window.location.href = session.url;
}
