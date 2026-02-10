import os
import uvicorn
import json
import hashlib
import asyncio
import numpy as np
import stripe
from fastapi import FastAPI, Form, HTTPException, UploadFile, File
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

app = FastAPI(title="LYLO Backend", version="11.1.0 - FINAL STABLE")

# CORS Setup - Critical for Mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API KEYS (FIXED: Added .strip() to clean hidden spaces) ---
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()

# --- DIAGNOSTICS ---
print("\n--- SYSTEM DIAGNOSTICS ---")
print(f"🔍 Tavily Key:   {'OK' if TAVILY_API_KEY else 'MISSING'}")
print(f"🧠 Pinecone Key: {'OK' if PINECONE_API_KEY else 'MISSING'}")
print(f"🤖 Gemini Key:   {'OK' if GEMINI_API_KEY else 'MISSING'}")
print(f"🔥 OpenAI Key:   {'OK' if OPENAI_API_KEY else 'MISSING'}")
print(f"💳 Stripe Key:   {'OK' if STRIPE_SECRET_KEY else 'MISSING'}")
print("--------------------------\n")

# --- STRIPE SETUP ---
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

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
gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
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

# --- DATA STORAGE ---
ELITE_USERS = {"stangman9898@gmail.com": "elite"}
BETA_TESTERS = ELITE_USERS.copy() 
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- HELPER FUNCTIONS ---
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

# --- THE TRIBUNAL ENGINES (FIXED GEMINI LOGIC) ---
async def call_gemini(prompt: str):
    if not gemini_ready: 
        print("❌ Gemini blocked: API Key not configured")
        return None
    
    # Updated Model List for SDK 0.8.0+
    models_to_try = ['gemini-1.5-flash', 'gemini-1.5-pro-latest', 'gemini-pro']
    
    for model_name in models_to_try:
        try:
            print(f"🧠 Attempting connection to {model_name}...")
            model = genai.GenerativeModel(model_name)
            
            # Use safety settings to prevent blocks
            response = model.generate_content(
                prompt, 
                generation_config={"response_mime_type": "application/json"}
            )
            
            if response.text:
                data = json.loads(response.text)
                data['model'] = f"Gemini ({model_name})"
                print(f"✅ SUCCESS: Connected to {model_name}")
                return data
                
        except Exception as e:
            # THIS LOG IS CRITICAL - It prints the exact error (404, 403, etc.)
            print(f"❌ FAILURE on {model_name}: {str(e)}")
            continue
            
    print("❌ CRITICAL: All Gemini models failed to respond.")
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

# --- ADMIN / BETA TESTER ENDPOINTS ---
@app.post("/admin/add-beta-tester")
async def add_beta_tester(admin_email: str = Form(...), new_email: str = Form(...), tier: str = Form("elite")):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403, detail="Unauthorized")
    BETA_TESTERS[new_email.lower()] = tier
    return {"status": "success", "message": f"Added {new_email}", "total": len(BETA_TESTERS)}

@app.get("/admin/list-beta-testers/{admin_email}")
async def list_beta_testers(admin_email: str):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403, detail="Unauthorized")
    return {"beta_testers": BETA_TESTERS, "count": len(BETA_TESTERS)}

@app.delete("/admin/remove-beta-tester")
async def remove_beta_tester(admin_email: str = Form(...), remove_email: str = Form(...)):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403, detail="Unauthorized")
    if remove_email.lower() in BETA_TESTERS:
        del BETA_TESTERS[remove_email.lower()]
        return {"status": "success"}
    return {"status": "error", "message": "Not found"}

@app.post("/check-beta-access")
async def check_beta_access(email: str = Form(...)):
    tier = BETA_TESTERS.get(email.lower(), "free")
    return {"email": email, "tier": tier, "is_beta": tier in ["elite", "pro"]}

# --- STRIPE PAYMENT ENDPOINT ---
@app.post("/create-checkout-session")
async def create_checkout(user_email: str = Form(...)):
    if not STRIPE_SECRET_KEY: 
        raise HTTPException(status_code=500, detail="Stripe not configured")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': 'Elite Tier Upgrade'},
                    'unit_amount': 2000, # $20.00
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url='https://lylo.ai/success',
            cancel_url='https://lylo.ai/cancel',
        )
        return {"id": session.id, "url": session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- MAIN CHAT ENDPOINT (WITH VISION) ---
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form(""),
    file: UploadFile = File(None) 
):
    user_id = create_user_id(user_email)
    actual_tier = BETA_TESTERS.get(user_email.lower(), "free")
    
    # 1. Log Request
    print(f"🎯 PROCESSING: {user_email} (Tier: {actual_tier})")
    image_status = f"📸 Image: {file.filename}" if file else "No Image"
    print(f"   Message: {msg[:50]}... | {image_status}")

    # 2. Evidence Gathering
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in json.loads(history)[-4:]])
    web_data = await search_web_tavily(msg, user_location) if len(msg.split()) > 2 else ""
    
    # 3. Prompt Construction
    p_prompts = {
        "guardian": "You are The Guardian. Protective, vigilant, serious.",
        "roast": "You are The Roast Master. Sarcastic, funny, witty.",
        "chef": "You are The Chef. Warm, food-focused metaphors.",
        "techie": "You are The Techie. Nerdy, detailed, precise.",
        "lawyer": "You are The Lawyer. Formal, cautious, legal tone.",
        "friend": "You are The Best Friend. Empathetic, casual, chill."
    }
    
    image_instruction = ""
    if file:
        image_instruction = "[SYSTEM: The user has uploaded an image. Acknowledge it. If you cannot see it yet, ask them to describe it.]"

    prompt = f"""
    {p_prompts.get(persona, p_prompts['guardian'])}
    CONTEXT: {QUIZ_ANSWERS.get(user_id, {})}
    EVIDENCE: {web_data}
    HISTORY: {history_text}
    IMAGE_CONTEXT: {image_instruction}
    MESSAGE: "{msg}"
    
    INSTRUCTIONS:
    1. Answer accurately. If EVIDENCE is present, use it.
    2. Provide a 'confidence_score' (0-100).
    3. If EVIDENCE contradicts your knowledge, lower confidence.
    
    OUTPUT JSON:
    {{ "answer": "text", "confidence_score": 90, "scam_detected": false }}
    """

    # 4. The Tribunal Battle
    print("⚔️ TRIBUNAL: Launching Battle...")
    results = await asyncio.gather(call_gemini(prompt), call_openai(prompt))
    valid = [r for r in results if r and r.get('answer')]
    
    if valid:
        winner = max(valid, key=lambda x: x.get('confidence_score', 0))
        print(f"🏆 WINNER: {winner.get('model', 'Unknown')} ({winner.get('confidence_score')}%)")
    else:
        winner = {
            "answer": "I'm having trouble connecting to my neural network right now. Please try again in a moment.", 
            "confidence_score": 0, 
            "model": "Offline"
        }
        print("🚨 TRIBUNAL: All Failed")

    # 5. Save & Return
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner.get('answer', ''), "bot")
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 0),
        "scam_detected": winner.get('scam_detected', False),
        "tier_info": {"name": f"{actual_tier.title()} Tier"},
        "usage_info": {"can_send": True}
    }

# --- STATS & QUIZ ---
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

# --- ROOT STATUS ---
@app.get("/")
async def root():
    return {
        "status": "LYLO TRIBUNAL SYSTEM ONLINE",
        "version": "11.1.0",
        "beta_testers": len(BETA_TESTERS),
        "engines": {
            "gemini": "Ready" if gemini_ready else "Offline",
            "openai": "Ready" if openai_client else "Offline",
            "tavily": "Ready" if tavily_client else "Offline",
            "pinecone": "Ready" if memory_index else "Offline",
            "stripe": "Ready" if 'stripe' in globals() and stripe.api_key else "Offline"
        }
    }

if __name__ == "__main__":
    print("🚀 LYLO SYSTEM STARTING...")
    uvicorn.run(app, host="0.0.0.0", port=10000)
