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

app = FastAPI(title="LYLO Backend", version="9.0.0 - THE TRIBUNAL")

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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# --- CLIENT SETUP ---
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

# Pinecone
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-memory"
        if index_name not in [idx.name for idx in pc.list_indexes()]:
            pc.create_index(
                name=index_name,
                dimension=768, 
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
    except Exception as e:
        print(f"⚠️ Pinecone Warning: {e}")

# Gemini
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

# OpenAI
openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    except Exception as e:
        print(f"⚠️ OpenAI Error: {e}")

# --- DATA STORAGE (Your Original Features) ---
ELITE_USERS = {"stangman9898@gmail.com": "elite"}
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- HELPER FUNCTIONS ---
def store_user_memory(user_id: str, content: str, role: str):
    USER_CONVERSATIONS[user_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })

async def search_web_tavily(query: str, location: str = "") -> str:
    if not tavily_client: return ""
    try:
        full_query = f"{query} {location}".strip()
        response = tavily_client.search(query=full_query, search_depth="basic", max_results=3, include_answer=True)
        evidence = [f"DIRECT: {response.get('answer', '')}"]
        evidence.extend([f"SOURCE: {r['content']}" for r in response.get('results', [])])
        return "\n".join(evidence)
    except Exception: return ""

# --- THE TRIBUNAL ENGINES ---
async def call_gemini(prompt: str):
    if not GEMINI_API_KEY: return None
    for model_name in ['gemini-1.5-flash', 'gemini-1.5-pro']:
        try:
            m = genai.GenerativeModel(model_name)
            res = m.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            data = json.loads(res.text)
            data['model'] = f"Gemini ({model_name})"
            return data
        except: continue
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
    except: return None

# --- MAIN ENDPOINTS ---
@app.post("/chat")
async def chat(msg: str = Form(...), history: str = Form("[]"), persona: str = Form("guardian"), user_email: str = Form(...), user_location: str = Form("")):
    user_id = create_user_id(user_email)
    
    # 1. Parse History & Gather Evidence
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in json.loads(history)[-4:]])
    web_data = await search_web_tavily(msg, user_location) if len(msg.split()) > 2 else ""
    
    # 2. Preparation
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
    QUIZ CONTEXT: {QUIZ_ANSWERS.get(user_id, {})}
    EVIDENCE: {web_data}
    HISTORY: {history_text}
    MESSAGE: "{msg}"
    
    OUTPUT JSON:
    {{ "answer": "text", "confidence_score": 0-100, "scam_detected": bool }}
    """

    # 3. The Battle
    results = await asyncio.gather(call_gemini(prompt), call_openai(prompt))
    valid = [r for r in results if r]
    winner = max(valid, key=lambda x: x['confidence_score']) if valid else {"answer": "Error", "confidence_score": 0}
    
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    return winner

@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    tier = ELITE_USERS.get(user_email.lower(), "free")
    convos = USER_CONVERSATIONS.get(user_id, [])
    quiz = QUIZ_ANSWERS.get(user_id, {})
    limit = 100 if tier == "elite" else 10
    
    return {
        "tier": tier, "conversations_today": len(convos), "total_conversations": len(convos), "has_quiz_data": user_id in QUIZ_ANSWERS,
        "memory_entries": len(convos),
        "usage": {"current": len(convos), "limit": limit, "percentage": (len(convos)/limit)*100},
        "learning_profile": {"interests": quiz.get("style", "General").split(","), "top_concern": quiz.get("concern", "None")}
    }

@app.post("/quiz")
async def save_quiz(user_email: str = Form(...), question1: str = Form(...), question2: str = Form(...), question3: str = Form(...), question4: str = Form(...), question5: str = Form(...)):
    user_id = create_user_id(user_email)
    QUIZ_ANSWERS[user_id] = {"concern": question1, "style": question2, "device": question3, "interest": question4, "access": question5}
    return {"status": "Quiz Saved"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
