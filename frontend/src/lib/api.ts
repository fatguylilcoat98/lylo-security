export interface ChatResponse {
  answer: string;
  confidence_score: number;
  scam_detected: boolean;
  scam_indicators: string[];
  new_memories: string[];
}
export async function sendChatMessage(message: string, profile: any, accessCode: string, image?: string | null): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append('msg', message);
  formData.append('history', JSON.stringify([]));
  if (image) formData.append('image', image);
  try {
      const response = await fetch('http://localhost:10000/chat', { 
        method: 'POST', body: formData 
      });
      if (!response.ok) throw new Error('Backend connection failed');
      return await response.json();
  } catch (e) {
      console.error(e);
      return { answer: "Error: Backend not reachable on Port 10000.", confidence_score: 0, scam_detected: false, scam_indicators: [], new_memories: [] };
  }
}