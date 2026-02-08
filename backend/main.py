from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import anthropic

app = FastAPI()

# Allow the screen to talk to the brain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup AI
client = None
api_key = os.environ.get("ANTHROPIC_API_KEY")

if api_key:
    try:
        client = anthropic.Anthropic(api_key=api_key)
        print("✅ API Key found. Brain is active.")
    except Exception as e:
        print(f"⚠️ API Key Error: {e}")
else:
    print("⚠️ NO API KEY FOUND. Brain is in demo mode.")

@app.post("/chat")
async def chat(msg: str = Form(...), history: str = Form("[]")):
    print(f"📩 Message Received: {msg}")
    
    if not client:
        return {
            "answer": "I am listening, but I have no AI connection. Check the API Key.",
            "confidence_score": 0,
            "scam_detected": False
        }

    try:
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=300,
            messages=[
                {"role": "user", "content": f"You are LYLO, an elite AI security assistant. Keep answers short and helpful. User asks: {msg}"}
            ]
        )
        
        answer_text = response.content[0].text
        print(f"🤖 AI Replied: {answer_text[:50]}...")
        
        return {
            "answer": answer_text,
            "confidence_score": 95,
            "scam_detected": False
        }

    except Exception as e:
        print(f"🔥 ERROR: {str(e)}")
        return {
            "answer": f"Error: {str(e)}",
            "confidence_score": 0,
            "scam_detected": False
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
