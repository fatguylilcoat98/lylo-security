import os
import uvicorn
import json
import hashlib
import asyncio
import base64
import stripe
import logging
from io import BytesIO
from fastapi import FastAPI, Form, HTTPException, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
from openai import AsyncOpenAI
from dotenv import load_dotenv

# --- MODULAR INTELLIGENCE DATA ---
from intelligence_data import (
    VIBE_STYLES, VIBE_LABELS,
    PERSONA_DEFINITIONS, PERSONA_EXTENDED, PERSONA_TIERS,
    get_random_hook, get_all_hooks
)

# Load environment variables
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LYLO-PRO-CORE")

# Initialize FastAPI
app = FastAPI(title="LYLO Total Integration Backend", version="19.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# API KEY CONFIGURATION
# ---------------------------------------------------------
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# Tier Limits
TIER_LIMITS = {"free": 15, "pro": 150, "elite": 1500, "max": 999999}
USAGE_TRACKER = defaultdict(int)

# ---------------------------------------------------------
# CLIENT INITIALIZATION
# ---------------------------------------------------------
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-intelligence-sync"
        if index_name not in [idx.name for idx in pc.list_indexes()]:
            pc.create_index(name=index_name, dimension=1024, metric="cosine", spec=ServerlessSpec(cloud="aws", region="us-east-1"))
        memory_index = pc.Index(index_name)
    except: logger.error("Pinecone offline")

gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
    except: logger.error("Gemini offline")

# ---------------------------------------------------------
# UPDATED BETA USER DATABASE (RON & MARILYN ADDED)
# ---------------------------------------------------------
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "max", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "max", "name": "Sandy"},
    "chris.betatester6@gmail.com": {"tier": "max", "name": "Ron"},
    "chris.betatester7@gmail.com": {"tier": "max", "name": "Marilyn"},
    "plabane916@gmail.com": {"tier": "max", "name": "Paul"},
    "bearjcameron@icloud.com": {"tier": "max", "name": "Bear"},
    "laura@startupsac.org": {"tier": "max", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "max", "name": "Corie"}
}

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# CORE ENGINE: SEARCH & VISION
# ---------------------------------------------------------
async def search_personalized_web(query: str):
    if not tavily_client: return ""
    try:
        res = tavily_client.search(query=query, search_depth="advanced", max_results=3)
        return "\n".join([f"Source: {r['content']}" for r in res.get('results', [])])
    except: return ""

async def call_gemini(prompt: str, image_b64: str = None):
    if not gemini_ready: return None
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        content = [prompt]
        if image_b64:
            import PIL.Image
            img = PIL.Image.open(BytesIO(base64.b64decode(image_b64)))
            content.append(img)
        response = await asyncio.to_thread(model.generate_content, content)
        return {"answer": response.text, "confidence_score": 88, "model": "Gemini"}
    except: return None

async def call_openai(prompt: str, image_b64: str = None):
    if not openai_client: return None
    try:
        msg = [{"type": "text", "text": prompt}]
        if image_b64: msg.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}})
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "Digital Bodyguard. JSON only."}, {"role": "user", "content": msg}],
            response_format={ "type": "json_object" }
        )
        res = json.loads(resp.choices[0].message.content)
        res["model"] = "OpenAI"
        return res
    except: return None

# ---------------------------------------------------------
# MAIN GATEWAY
# ---------------------------------------------------------
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    vibe: str = Form("standard"),
    file: UploadFile = File(None)
):
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {"tier": "free", "name": "User"})
    
    # Bypass for Christopher
    if user_email.lower() != "stangman9898@gmail.com" and USAGE_TRACKER[user_id] >= TIER_LIMITS.get(user_data["tier"], 15):
        return {"answer": "Quota reached.", "usage_info": {"can_send": False}}

    image_b64 = base64.b64encode(await file.read()).decode('utf-8') if file else None
    
    p_def = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS['guardian'])
    hook = get_random_hook(persona)
    
    full_prompt = f"IDENTITY: {p_def}\nHOOK: {hook}\nUSER: {user_data['name']}\nMSG: {msg}\nJSON: {{'answer': '...', 'confidence_score': 95}}"

    results = await asyncio.gather(call_openai(full_prompt, image_b64), call_gemini(full_prompt, image_b64))
    valid = [r for r in results if r and 'answer' in r]
    
    if not valid: return {"answer": "Thinking...", "confidence_score": 0}
    
    winner = max(valid, key=lambda x: x.get('confidence_score', 0))
    USAGE_TRACKER[user_id] += 1

    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 90),
        "scam_detected": winner.get('scam_detected', False),
        "persona_hook": hook,
        "model": winner.get('model', 'LYLO-CORE')
    }

# ---------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------
@app.post("/generate-audio")
async def generate_audio(text: str = Form(...), voice: str = Form("onyx")):
    if not openai_client: return {"error": "Offline"}
    try:
        response = await openai_client.audio.speech.create(model="tts-1", voice=voice, input=text[:600])
        return {"audio_b64": base64.b64encode(response.content).decode('utf-8')}
    except: return {"error": "Failed"}

@app.post("/check-beta-access")
async def check_beta(data: dict):
    email = data.get("email", "").lower().strip()
    user = ELITE_USERS.get(email)
    if user: return {"access": True, "tier": user["tier"], "name": user["name"]}
    return {"access": False, "tier": "free"}

@app.get("/")
async def root(): return {"status": "ONLINE", "version": "19.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
