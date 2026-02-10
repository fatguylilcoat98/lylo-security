import os
import uvicorn
import json
import hashlib
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
from datetime import datetime
from collections import defaultdict
from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()

app = FastAPI(title="LYLO Backend", version="6.0.0 - RESTORED")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API KEYS ---
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- INITIALIZATION STATUS ---
print(f"🔍 Web Intelligence: {'✅ Online' if TAVILY_API_KEY else '❌ Offline'}")
print(f"🧠 Long-Term Memory: {'✅ Online' if PINECONE_API_KEY else '❌ Offline'}")
print(f"🤖 Gemini Brain:     {'✅ Online' if GEMINI_API_KEY else '❌ Offline'}")

# --- CLIENT SETUP ---
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

# Pinecone
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-memory"
        if index_name not in pc.list_indexes().names():
            pc.create_index(
                name=index_name,
                dimension=768, 
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
        print("✅ Pinecone Connected")
    except Exception as e:
        print(f"⚠️ Pinecone Warning: {e}")

# Gemini
model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ Gemini Connected")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

# --- DATA STORAGE (Your Original Logic) ---
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
}
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- HELPER 1: MEMORY STORAGE (Restored) ---
def store_user_memory(user_id: str, content: str, role: str):
    """Stores conversation in local memory (and Pinecone if available)"""
    entry = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }
    # 1. Local Storage
    USER_CONVERSATIONS[user_id].append(entry)
    
    # 2. Pinecone Storage (Optional Future feature)
    # We keep the structure here so you can enable vectors later
    if memory_index:
        pass # Add embedding logic here when ready

# --- HELPER 2: SMART SEARCH (Upgraded to God Mode) ---
async def search_web_tavily(query: str, location: str = "") -> str:
    """
    Searches for ANYTHING. 
    Now includes your Location logic!
    """
    if not tavily_client:
        return ""
    try:
        # Combine Query + Location for better results
        full_query = f"{query} {location}".strip()
        
        response = tavily_client.search(
            query=full_query,
            search_depth="basic", 
            max_results=2,
            include_answer=True
        )
        if response.get("answer"):
            return f"LIVE FACT: {response['answer']}"
        
        snippets = [r['content'] for r in response.get('results', [])]
        return f"LIVE CONTEXT: {' | '.join(snippets[:2])}"
    except Exception as e:
        print(f"Search Error: {e}")
        return ""

# --- HELPER 3: CONTEXT RETRIEVAL (Restored) ---
def get_user_context(user_id: str) -> str:
    """Retrives Quiz Data to personalize the chat"""
    context_parts = []
    if user_id in QUIZ_ANSWERS:
        for q, a in QUIZ_ANSWERS[user_id].items():
            context_parts.append(f"{q}: {a}")
    return " | ".join(context_parts)

# --- HELPER 4: AI GENERATION (Restored & Upgraded) ---
async def generate_ai_response(msg: str, persona: str, user_context: str, web_data: str, history_text: str):
    """
    The Brain. Moved back into its own function as requested.
    """
    # Persona Definitions
    personas = {
        "guardian": "You are The Guardian. Protective, vigilant, and serious. Focus on safety.",
        "roast": "You are The Roast Master. Witty, sarcastic, and funny. Roast the user gently.",
        "chef": "You are The Chef. Warm, encouraging, and food-obsessed.",
        "techie": "You are The Techie. Detailed, nerdy, and precise.",
        "lawyer": "You are The Lawyer. Formal, cautious, and professional.",
        "friend": "You are The Best Friend. Casual, empathetic, and chill."
    }
    system_instruction = personas.get(persona, personas["guardian"])

    prompt = f"""
    {system_instruction}
    
    USER PROFILE: {user_context}
    LIVE WEB DATA: {web_data}
    
    CONVERSATION HISTORY:
    {history_text}
    
    CURRENT MESSAGE: "{msg}"
    
    INSTRUCTIONS:
    1. Answer naturally as your persona.
    2. Use the Web Data if relevant.
    3. If the user mentions a known Scam, warn them.
    4. Provide a 'confidence_score' (0-100).
    
    OUTPUT FORMAT (JSON):
    {{
        "answer": "Your response...",
        "confidence_score": 95,
        "scam_detected": false
    }}
    """
    
    try:
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        return json.loads(response.text)
    except Exception as e:
        print(f"GenAI Error: {e}")
        return {"answer": "I'm having trouble thinking right now.", "confidence_score": 0, "scam_detected": False}


# --- MAIN CHAT ENDPOINT ---
@app.post("/chat")
async def chat(
    msg: str = Form(...),
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    user_email: str = Form(...),
    user_location: str = Form("") # RESTORED: Location parameter
):
    user_id = create_user_id(user_email)
    actual_tier = ELITE_USERS.get(user_email.lower(), "free")
    
    print(f"📨 {user_email} ({actual_tier}): {msg}")

    # 1. PARSE HISTORY (The Amnesia Fix)
    try:
        history_list = json.loads(history)
        # Convert to text format for Gemini
        history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in history_list[-6:]])
    except:
        history_text = ""

    # 2. SMART SEARCH (God Mode)
    # Search if message > 2 words. Now includes location!
    web_data = ""
    if len(msg.split()) > 2:
        web_data = await search_web_tavily(msg, user_location)

    # 3. GET CONTEXT
    user_context = get_user_context(user_id)

    # 4. GENERATE RESPONSE (Using Helper Function)
    data = await generate_ai_response(msg, persona, user_context, web_data, history_text)

    # 5. SAVE MEMORY (Using Helper Function)
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, data['answer'], "bot")
    
    return data

# --- STATS ENDPOINT (Restored) ---
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    return {
        "tier": ELITE_USERS.get(user_email.lower(), "free"),
        "total_conversations": len(USER_CONVERSATIONS.get(user_id, [])),
        "has_quiz_data": user_id in QUIZ_ANSWERS
    }

# --- QUIZ ENDPOINT (Restored) ---
@app.post("/quiz")
async def save_quiz(
    user_email: str = Form(...),
    question1: str = Form(...),
    question2: str = Form(...),
    question3: str = Form(...),
    question4: str = Form(...),
    question5: str = Form(...)
):
    user_id = create_user_id(user_email)
    QUIZ_ANSWERS[user_id] = {
        "concern": question1,
        "style": question2,
        "device": question3,
        "interest": question4,
        "access": question5
    }
    return {"status": "Quiz Saved"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
