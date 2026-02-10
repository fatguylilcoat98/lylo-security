import os
import uvicorn
import json
import hashlib
import asyncio
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
from datetime import datetime
from collections import defaultdict
from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()

app = FastAPI(title="LYLO Backend", version="9.1.0 - FIXED TRIBUNAL")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API KEYS (FIXED: Added .strip() to remove hidden spaces) ---
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# --- DIAGNOSTICS ---
def mask_key(key):
    return f"{key[:4]}...{key[-4:]}" if key and len(key) > 8 else "❌ MISSING"

print(f"🔍 Tavily Key:   {mask_key(TAVILY_API_KEY)}")
print(f"🧠 Pinecone Key: {mask_key(PINECONE_API_KEY)}")
print(f"🤖 Gemini Key:   {mask_key(GEMINI_API_KEY)}")
print(f"🔥 OpenAI Key:   {mask_key(OPENAI_API_KEY)}")

# --- CLIENT SETUP ---
# Tavily
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Tavily Client Initialized")
    except Exception as e:
        print(f"⚠️ Tavily Init Error: {e}")

# Pinecone
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-memory"
        # Check index existence safely
        existing_indexes = [idx.name for idx in pc.list_indexes()] if pc else []
        if index_name not in existing_indexes:
            try:
                pc.create_index(
                    name=index_name,
                    dimension=768, 
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1")
                )
            except Exception as e:
                print(f"⚠️ Index creation skipped: {e}")
        
        memory_index = pc.Index(index_name)
        print("✅ Pinecone Memory Online")
    except Exception as e:
        print(f"⚠️ Pinecone Warning: {e}")

# Gemini (FIXED: Configure with specific version if needed)
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("✅ Gemini Configured")
    except Exception as e:
        print(f"⚠️ Gemini Config Error: {e}")

# OpenAI
openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Connected")
    except Exception as e:
        print(f"⚠️ OpenAI Error: {e}")

# --- DATA STORAGE (Preserved) ---
ELITE_USERS = {"stangman9898@gmail.com": "elite"}
BETA_TESTERS = ELITE_USERS.copy()
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- HELPERS ---
def store_user_memory(user_id: str, content: str, role: str):
    USER_CONVERSATIONS[user_id].append({
        "role": role, "content": content, "timestamp": datetime.now().isoformat()
    })

async def search_web_tavily(query: str, location: str = "") -> str:
    if not tavily_client: return ""
    try:
        full_query = f"{query} {location}".strip()
        response = tavily_client.search(
            query=full_query, 
            search_depth="basic", 
            max_results=3, 
            include_answer=True
        )
        evidence = [f"DIRECT: {response.get('answer', '')}"]
        evidence.extend([f"SOURCE: {r['content'][:300]}" for r in response.get('results', [])])
        return "\n".join(evidence)
    except Exception as e:
        print(f"❌ Tavily Error: {e}")
        return ""

# --- THE TRIBUNAL ENGINES (FIXED) ---
async def call_gemini(prompt: str):
    if not GEMINI_API_KEY: return None
    
    # FIX: Tries Flash first (fastest), then Pro, then Legacy 1.0 (Most Stable)
    models_to_try = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
    
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                prompt, 
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            data['model'] = f"Gemini ({model_name})"
            return data
        except Exception as e:
            print(f"⚠️ {model_name} failed: {e}")
            continue
            
    print("❌ All Gemini models failed.")
    return None

async def call_openai(prompt: str):
    if not openai_client: return None
    try:
        res = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(res.choices[0].message.content)
        data['model'] = "OpenAI (GPT-4o)"
        return data
    except Exception as e:
        print(f"❌ OpenAI Error: {e}")
        return None

# --- MAIN ENDPOINTS ---
@app.post("/chat")
async def chat(msg: str = Form(...), history: str = Form("[]"), persona: str = Form("guardian"), user_email: str = Form(...), user_location: str = Form("")):
    user_id = create_user_id(user_email)
    
    # 1. Evidence
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in json.loads(history)[-4:]])
    web_data = await search_web_tavily(msg, user_location) if len(msg.split()) > 2 else ""
    
    # 2. Prompt
    p_prompts = {
        "guardian": "You are The Guardian. Protective, vigilant, serious.",
        "roast": "You are The Roast Master. Sarcastic, funny, witty.",
        "chef": "You are The Chef. Warm, food-focused metaphors.",
        "techie": "You are The Techie. Nerdy, detailed, precise.",
        "lawyer": "You are The Lawyer. Formal, cautious, legal tone.",
        "friend": "You are The Best Friend. Empathetic, casual, chill."
    }
    
    prompt = f"""
    {p_prompts.get(persona, p_prompts['guardian'])}
    CONTEXT: {QUIZ_ANSWERS.get(user_id, {})}
    EVIDENCE: {web_data}
    HISTORY: {history_text}
    MESSAGE: "{msg}"
    
    INSTRUCTIONS:
    1. Answer accurately. If EVIDENCE is present, use it.
    2. Provide a 'confidence_score' (0-100).
    
    OUTPUT JSON:
    {{ "answer": "text", "confidence_score": 90, "scam_detected": false }}
    """

    # 3. Battle
    results = await asyncio.gather(call_gemini(prompt), call_openai(prompt))
    valid = [r for r in results if r and r.get('answer')]
    
    if valid:
        winner = max(valid, key=lambda x: x.get('confidence_score', 0))
    else:
        winner = {"answer": "I'm having trouble connecting to the network right now.", "confidence_score": 0, "model": "Offline"}

    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner.get('answer', ''), "bot")
    return winner

# --- STATS & QUIZ (Preserved) ---
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    tier = BETA_TESTERS.get(user_email.lower(), "free")
    convos = USER_CONVERSATIONS.get(user_id, [])
    limit = 100 if tier == "elite" else 10
    
    return {
        "tier": tier, "conversations_today": len(convos), "total_conversations": len(convos), "has_quiz_data": user_id in QUIZ_ANSWERS,
        "memory_entries": len(convos),
        "usage": {"current": len(convos), "limit": limit, "percentage": (len(convos)/limit)*100},
        "learning_profile": {"interests": [], "top_concern": ""}
    }

@app.post("/quiz")
async def save_quiz(user_email: str = Form(...), question1: str = Form(...), question2: str = Form(...), question3: str = Form(...), question4: str = Form(...), question5: str = Form(...)):
    user_id = create_user_id(user_email)
    QUIZ_ANSWERS[user_id] = {"concern": question1, "style": question2, "device": question3, "interest": question4, "access": question5}
    return {"status": "Quiz Saved"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
