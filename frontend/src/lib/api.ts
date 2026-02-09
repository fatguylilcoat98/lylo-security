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
      new_memories: data.new_memories || []
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
