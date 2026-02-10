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

load_dotenv()

app = FastAPI(title="LYLO Backend", version="9.1.0 - FIXED TRIBUNAL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API KEYS (FIXED: Added .strip() to clean your keys)
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

print(f"🔍 DEBUG: Tavily Key loaded? {bool(TAVILY_API_KEY)}")
print(f"🧠 DEBUG: Pinecone Key loaded? {bool(PINECONE_API_KEY)}")
print(f"🤖 DEBUG: Gemini Key loaded? {bool(GEMINI_API_KEY)}")
print(f"🔥 DEBUG: OpenAI Key loaded? {bool(OPENAI_API_KEY)}")

# CLIENT SETUP
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Tavily Client Initialized")
    except Exception as e:
        print(f"⚠️ Tavily Init Error: {e}")

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
        print("✅ Pinecone Memory Online")
    except Exception as e:
        print(f"⚠️ Pinecone Warning: {e}")

gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
        print("✅ Gemini Configured")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Client Ready")
    except Exception as e:
        print(f"⚠️ OpenAI Error: {e}")

# DATA STORAGE
ELITE_USERS = {"stangman9898@gmail.com": "elite"}
BETA_TESTERS = ELITE_USERS.copy()
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

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

async def call_gemini(prompt: str):
    if not gemini_ready: return None
    
    # FIXED: Added 'gemini-pro' as final fallback for maximum reliability
    models_to_try = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
    
    for model_name in models_to_try:
        try:
            print(f"🧠 Trying Gemini model: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                prompt, 
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            data['model'] = f"Gemini ({model_name})"
            print(f"✅ Gemini {model_name} success")
            return data
        except Exception as e:
            print(f"❌ Gemini {model_name} failed: {e}")
            continue
    
    print("❌ All Gemini models failed")
    return None

async def call_openai(prompt: str):
    if not openai_client: return None
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        data['model'] = "OpenAI (GPT-4o-mini)"
        print("✅ OpenAI success")
        return data
    except Exception as e:
        print(f"❌ OpenAI failed: {e}")
        return None

# BETA ENDPOINTS
@app.post("/admin/add-beta-tester")
async def add_beta_tester(admin_email: str = Form(...), new_email: str = Form(...), tier: str = Form("elite")):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403)
    BETA_TESTERS[new_email.lower()] = tier
    return {"status": "success"}

@app.get("/admin/list-beta-testers/{admin_email}")
async def list_beta_testers(admin_email: str):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403)
    return {"beta_testers": BETA_TESTERS}

@app.post("/chat")
async def chat(msg: str = Form(...), history: str = Form("[]"), persona: str = Form("guardian"), user_email: str = Form(...), user_location: str = Form("")):
    user_id = create_user_id(user_email)
    actual_tier = BETA_TESTERS.get(user_email.lower(), "free")
    print(f"🎯 TRIBUNAL: Processing '{msg[:50]}...' for {user_email[:20]} (Tier: {actual_tier})")
    
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in json.loads(history)[-4:]])
    web_evidence = await search_web_tavily(msg, user_location) if len(msg.split()) > 2 else ""
    
    p_prompts = {
        "guardian": "You are The Guardian. Protective, vigilant, serious.",
        "roast": "You are The Roast Master. Sarcastic, funny, witty.",
        "chef": "You are The Chef. Warm, food-focused metaphors.",
        "techie": "You are The Techie. Nerdy, detailed, precise.",
        "lawyer": "You are The Lawyer. Formal, cautious, legal tone.",
        "friend": "You are The Best Friend. Empathetic, casual, chill."
    }
    
    quiz_context = QUIZ_ANSWERS.get(user_id, {})
    
    tribunal_prompt = f"""
    {p_prompts.get(persona, p_prompts['guardian'])}
    CONTEXT: {quiz_context}
    EVIDENCE: {web_evidence}
    HISTORY: {history_text}
    MESSAGE: "{msg}"
    INSTRUCTIONS: Answer accurately. If EVIDENCE exists, use it. Provide 'confidence_score' (0-100).
    OUTPUT JSON: {{ "answer": "text", "confidence_score": 90, "scam_detected": false }}
    """

    print("⚔️ TRIBUNAL: Launching battle...")
    results = await asyncio.gather(call_gemini(tribunal_prompt), call_openai(tribunal_prompt))
    valid = [r for r in results if r and r.get('answer')]
    
    if valid:
        winner = max(valid, key=lambda x: x.get('confidence_score', 0))
        print(f"🏆 WINNER: {winner.get('model', 'Unknown')} ({winner.get('confidence_score')}%)")
    else:
        winner = {"answer": "I'm having trouble connecting right now.", "confidence_score": 0, "model": "Emergency Fallback"}
        print("🚨 TRIBUNAL: All Failed")

    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner.get('answer', ''), "bot")
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 0),
        "scam_detected": winner.get('scam_detected', False),
        "tier_info": {"name": f"{actual_tier.title()} Tier"},
        "usage_info": {"can_send": True}
    }

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
