import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { tavily } from '@tavily/core';
import { loadStripe } from '@stripe/stripe-js';

// INITIALIZE ENGINES
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

export async function sendChatMessage(
  message: string, 
  profile: any, 
  accessCode: string, 
  image?: string | null
): Promise<ChatResponse> {
  
  try {
    // 1. LIVE INTEL: Tavily search for real-time Sacramento data
    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 3
    });

    // 2. MEMORY CONTEXT: Your specific mods and life details
    const vaultContext = `
      User: Christopher Hughes (Sacramento area).
      Preferences: Zero-sugar drinks, No mustard/Add mayo on burgers.
      Interests: Xbox 360 SSD modding, Custom PC builds, Bitcoin via Cash App.
    `;

    // 3. BRAIN: Gemini 1.5 Flash Reasoning
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
      You are LYLO, the Digital Bodyguard. 
      VAULT: ${vaultContext}
      LIVE INTEL: ${search.answer || "No live data found."}
      
      TRUTH PROTOCOL: Cross-reference user input with live intel. 
      Identify scams and provide a confidence score.
      
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
      answer: "Neural Link interrupted. Check Render VITE_ keys.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: ["Connection Error"],
      new_memories: []
    };
  }
}

// 4. STRIPE SUBSCRIPTION
export async function startSubscription(priceId: string) {
  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  if (!stripe) throw new Error("Stripe failed to load.");

  // This redirects users to your secure Stripe checkout
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  const session = await response.json();
  if (session.url) window.location.href = session.url;
}
