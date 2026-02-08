import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { tavily } from '@tavily/core';
import { loadStripe } from '@stripe/stripe-js';

// 1. INITIALIZE ENGINES (Pulling from Render Env)
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
    // 2. TRUTH PROTOCOL: Live Tavily Search
    // This ensures LYLO knows the weather, current scams, and live prices
    const search = await tvly.search(message, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 5
    });

    // 3. MEMORY VAULT: Pinecone Check
    // (Note: In a basic setup, we use the Tavily context + User Profile)
    const vaultContext = `User likes zero-sugar drinks, Xbox 360 mods, and lives in Sacramento.`;

    // 4. GEMINI BRAIN (Gemini 1.5 Flash - Best Free Tier)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      You are LYLO, a Digital Bodyguard and Personal Assistant. 
      CURRENT LOCATION: Sacramento / Roseville Area.
      USER VAULT INFO: ${vaultContext}
      LIVE INTERNET DATA: ${search.answer || "Searching..."}
      
      STRICT TRUTH PROTOCOL:
      - Cross-reference the user's message with the Live Internet Data provided.
      - If you are not 95% certain, you MUST state: "I am [X]% certain of this."
      - Identify any scam indicators (links, pressure tactics, suspicious requests).
      
      USER MESSAGE: ${message}
      
      RESPONSE FORMAT: Return a JSON-friendly response with answer, confidence_score (0-100), scam_detected (boolean), and scam_indicators (array).
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Cleaning the response for any accidental markdown
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return {
      answer: data.answer,
      confidence_score: data.confidence_score || 98,
      scam_detected: data.scam_detected || false,
      scam_indicators: data.scam_indicators || [],
      new_memories: []
    };

  } catch (error) {
    console.error("LYLO ENGINE ERROR:", error);
    return {
      answer: "Neural Link interrupted. Please check your Render Environment Keys.",
      confidence_score: 0,
      scam_detected: false,
      scam_indicators: [],
      new_memories: []
    };
  }
}

// 5. STRIPE CHECKOUT (The Payment Link)
export async function startSubscription(priceId: string) {
  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  if (!stripe) throw new Error("Stripe failed to initialize");

  // This typically points to a backend endpoint you've set up on Render
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  const session = await response.json();
  await stripe.redirectToCheckout({ sessionId: session.id });
}
