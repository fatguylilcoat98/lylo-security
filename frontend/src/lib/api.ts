/**
 * LYLO API CLIENT LIBRARY
 * ------------------------------------------------------------------
 * This file handles all communication between the Frontend (React) 
 * and the Backend (FastAPI on Render).
 * * BACKEND URL: https://lylo-backend.onrender.com
 * VERSION: 14.7.0 (Elite & Bilingual Support)
 */

// ==================================================================
// 1. CONFIGURATION
// ==================================================================

// The direct link to your production server
const API_URL = 'https://lylo-backend.onrender.com';

// ==================================================================
// 2. TYPE DEFINITIONS & INTERFACES
// ==================================================================

/**
 * Represents a single message bubble in the chat interface.
 * Used by ChatInterface.tsx to render the conversation history.
 */
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  
  // Security & Trust Metrics
  confidenceScore?: number;    // 0-100% score of truthfulness
  scamDetected?: boolean;      // True if the AI flagged a scam
  scamIndicators?: string[];   // List of specific red flags found
}

/**
 * Represents the raw JSON response returned by the Backend API.
 * This matches the Python Pydantic models in main.py.
 */
export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  
  // Optional analysis details
  confidence_explanation?: string;
  scam_indicators?: string[];
  detailed_analysis?: string;
  
  // System metadata
  web_search_used?: boolean;
  personalization_active?: boolean;
  tier_info?: { 
    name: string 
  };
  usage_info?: { 
    can_send: boolean; 
    current_tier: string 
  };
}

/**
 * User Statistics for the Dashboard & Profile Menu.
 * Tracks usage limits and subscription tiers.
 */
export interface UserStats {
  tier: string;                // 'free', 'pro', 'elite'
  display_name?: string;       // User's preferred name
  conversations_today: number; // Count of messages sent today
  total_conversations: number; // Lifetime message count
  has_quiz_data: boolean;      // True if user completed onboarding
  
  // Usage quota tracking
  usage: {
    current: number;
    limit: number;
    percentage: number;
  };
  
  // Personalized learning profile (optional)
  learning_profile?: {
    interests: string[];
    top_concern: string;
  };
}

/**
 * Response structure for the Access Verification checkpoint.
 */
export interface AccessVerificationResponse {
  access_granted: boolean;
  tier: string;
  user_name: string;
  is_beta: boolean;
  message?: string;
}

/**
 * Structure for saving the Onboarding Quiz.
 */
export interface QuizAnswers {
  question1: string; // Primary Concern
  question2: string; // Learning Style
  question3: string; // Device Preference
  question4: string; // Specific Interest
  question5: string; // Access Frequency
}

// ==================================================================
// 3. API FUNCTIONS
// ==================================================================

/**
 * VERIFY ACCESS
 * Checks if a user email is allowed to access the system (Beta/Elite list).
 * * @param email - The user's email address
 * @returns AccessVerificationResponse object
 */
export const verifyAccess = async (email: string): Promise<AccessVerificationResponse> => {
  try {
    const formData = new FormData();
    formData.append('email', email);
    
    console.log(`🔐 Verifying access for: ${email}`);

    const response = await fetch(`${API_URL}/verify-access`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Verification failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Access verification error:', error);
    // Return a safe default failure state rather than crashing
    return {
      access_granted: false,
      tier: 'none',
      user_name: email.split('@')[0],
      is_beta: false,
      message: 'Network connection failed'
    };
  }
};

/**
 * SEND CHAT MESSAGE
 * The core function that sends user input to the AI backend.
 * Now supports Bilingual Mode (English/Spanish).
 * * @param message - The text message from the user
 * @param history - Array of previous messages for context
 * @param personaId - ID of the selected persona (e.g., 'disciple')
 * @param userEmail - User's email for tracking/memory
 * @param imageFile - Optional image upload for analysis
 * @param language - 'en' (English) or 'es' (Spanish)
 */
export const sendChatMessage = async (
  message: string,
  history: any[],
  personaId: string,
  userEmail: string,
  imageFile?: File | null,
  language: string = 'en' // Defaults to English
): Promise<ChatResponse> => {
  try {
    // Construct Form Data
    const formData = new FormData();
    
    // Core payload
    formData.append('msg', message || "Analyze this image"); 
    formData.append('history', JSON.stringify(history)); 
    formData.append('persona', personaId);
    formData.append('user_email', userEmail);
    formData.append('user_location', Intl.DateTimeFormat().resolvedOptions().timeZone); 
    
    // NEW: Language Parameter
    formData.append('language', language);

    // Image attachment
    if (imageFile) {
        console.log(`📸 Attaching image: ${imageFile.name} (${imageFile.size} bytes)`);
        formData.append('file', imageFile);
    }

    console.log(`🚀 Sending message to backend (Persona: ${personaId}, Lang: ${language})`);

    // Execute Request
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      body: formData,
    });

    // Handle HTTP Errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server Error (${response.status}): ${errorText}`);
    }

    // Parse JSON Response
    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ API Connection Error:', error);
    
    // Return a localized error message so the UI doesn't break
    const errorMsg = language === 'es' 
      ? "Tengo problemas conectando con el servidor. Por favor verifica tu internet." 
      : "I'm having trouble connecting to the server. Please check your internet connection.";

    return {
      answer: errorMsg,
      confidence_score: 0,
      scam_detected: false,
      confidence_explanation: "Network Connection Failed"
    };
  }
};

/**
 * GET USER STATISTICS
 * Fetches usage data, tier status, and conversation counts.
 * * @param email - The user's email
 */
export const getUserStats = async (email: string): Promise<UserStats | null> => {
  try {
    const response = await fetch(`${API_URL}/user-stats/${email}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('❌ Stats Error:', error);
    return null;
  }
};

/**
 * SAVE QUIZ ANSWERS
 * Saves the user's onboarding preferences to personalize the AI.
 * * @param userEmail - User's email
 * @param answers - Object containing the 5 quiz answers
 */
export const saveQuiz = async (
  userEmail: string,
  answers: QuizAnswers
): Promise<{ status: string }> => {
  try {
    const formData = new FormData();
    formData.append('user_email', userEmail);
    formData.append('question1', answers.question1);
    formData.append('question2', answers.question2);
    formData.append('question3', answers.question3);
    formData.append('question4', answers.question4);
    formData.append('question5', answers.question5);

    console.log(`📝 Saving quiz for ${userEmail}`);

    const response = await fetch(`${API_URL}/quiz`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Quiz API error: ${response.status}`);
    }
    
    return await response.json();

  } catch (error) {
    console.error('❌ Quiz Save Error:', error);
    return { status: "error" };
  }
};

// ==================================================================
// 4. UTILITIES & HELPERS
// ==================================================================

/**
 * Checks if the backend is reachable (Health Check).
 * Useful for showing a maintenance mode if the server is down.
 */
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(API_URL);
    return response.ok;
  } catch (e) {
    return false;
  }
};
