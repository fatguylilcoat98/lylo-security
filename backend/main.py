import os
import uvicorn
import json
import hashlib
import asyncio
import base64
import stripe
import logging
import requests
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
# This ensures the 12-seat board, hooks, and vibes are all synced
from intelligence_data import (
    VIBE_STYLES, VIBE_LABELS,
    PERSONA_DEFINITIONS, PERSONA_EXTENDED, PERSONA_TIERS,
    get_random_hook, get_all_hooks
)

# Load environment variables
load_dotenv()

# Configure System Logging for Production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("LYLO-TOTAL-INTEGRATION")

# Initialize FastAPI App
app = FastAPI(
    title="LYLO Total Integration Backend",
    description="Proactive Digital Bodyguard & Personalized Search Engine API for LYLO.PRO",
    version="18.8.0 - MASTER FIDELITY EDITION"
)

# Configure CORS for Frontend Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# API KEY CONFIGURATION & DIAGNOSTICS
# ---------------------------------------------------------
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()

# --- TIER LIMITS (Updated for Production) ---
TIER_LIMITS = {
    "free": 15,
    "pro": 150,
    "elite": 1500,
    "max": 999999  # Unlimited for you
}

# Persistent usage tracker (In-Memory for this session)
USAGE_TRACKER = defaultdict(int)

# ---------------------------------------------------------
# CLIENT INITIALIZATION
# ---------------------------------------------------------

# Internet Search Client (Personalized Search Engine)
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        logger.info("✅ Personalized Search Engine Ready")
    except Exception as e:
        logger.error(f"❌ Search Engine Failed: {e}")

# Memory Client (Intelligence Sync / Recursive Memory)
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-intelligence-sync"
        
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing_indexes:
            logger.info(f"⚙️ Creating Intelligence Sync Index: {index_name}")
            pc.create_index(
                name=index_name,
                dimension=1024,
                metric="cosine", 
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
        logger.info("✅ Intelligence Sync Ready")
    except Exception as e:
        logger.error(f"❌ Intelligence Sync Failed: {e}")

# AI Vision Clients (Threat Assessment)
gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
        logger.info("✅ Threat Assessment (Gemini) Ready")
    except Exception as e:
        logger.error(f"❌ Gemini Setup Failed: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ Digital Bodyguard (OpenAI) Ready")
    except Exception as e:
        logger.error(f"❌ OpenAI Setup Failed: {e}")

# ---------------------------------------------------------
# COMPREHENSIVE BETA USER DATABASE
# ---------------------------------------------------------
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "max", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "max", "name": "Sandy"},
    "chris.betatester1@gmail.com": {"tier": "max", "name": "James"},
    "chris.betatester2@gmail.com": {"tier": "max", "name": "Josh"},
    "chris.betatester3@gmail.com": {"tier": "max", "name": "Chrissy Poo"},
    "plabane916@gmail.com": {"tier": "max", "name": "Paul"},
    "nemeses1298@gmail.com": {"tier": "max", "name": "Eric"},
    "bearjcameron@icloud.com": {"tier": "max", "name": "Bear"},
    "jcgcbear@gmail.com": {"tier": "max", "name": "Gloria"},
    "laura@startupsac.org": {"tier": "max", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "max", "name": "Corie"}
}

USER_CONVERSATIONS = defaultdict(list)
USER_PROFILES = defaultdict(dict)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# VISION & INDICATOR LOGIC
# ---------------------------------------------------------
def analyze_scam_indicators(text: str) -> List[str]:
    indicators = []
    low_text = text.lower()
    
    scam_patterns = {
        "High Urgency": ["immediate", "hurry", "suspended", "warned", "final notice"],
        "Payment Pressure": ["gift card", "wire", "zelle", "venmo", "western union", "crypto"],
        "Government Impersonation": ["irs", "fbi", "police", "social security", "legal action"],
        "Suspicious Link": ["bit.ly", "tinyurl", "linktr.ee", "click here", "verify account"]
    }
    
    for category, patterns in scam_patterns.items():
        if any(pattern in low_text for pattern in patterns):
            indicators.append(category)
    return indicators

# ---------------------------------------------------------
# INTELLIGENCE SYNC (RECURSIVE MEMORY)
# ---------------------------------------------------------
async def store_intelligence_sync(user_id: str, content: str, role: str):
    if not memory_index or not openai_client or len(content.strip()) < 10:
        return
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=content[:500],
            dimensions=1024
        )
        embedding = response.data[0].embedding
        memory_id = f"{user_id}_{datetime.now().timestamp()}"
        metadata = {
            "user_id": user_id,
            "role": role,
            "content": content[:400],
            "timestamp": datetime.now().isoformat()
        }
        memory_index.upsert([(memory_id, embedding, metadata)])
    except Exception as e:
        logger.error(f"Sync Storage Error: {e}")

async def retrieve_intelligence_sync(user_id: str, query: str) -> str:
    if not memory_index or not openai_client:
        return ""
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query[:200],
            dimensions=1024
        )
        query_embedding = response.data[0].embedding
        results = memory_index.query(
            vector=query_embedding,
            filter={"user_id": user_id},
            top_k=5,
            include_metadata=True
        )
        memories = [f"Memory ({m.metadata['role']}): {m.metadata['content']}" for m in results.matches if m.score > 0.82]
        return "\n".join(memories)
    except Exception as e:
        logger.error(f"Sync Retrieval Error: {e}")
        return ""

# ---------------------------------------------------------
# PERSONALIZED SEARCH ENGINE
# ---------------------------------------------------------
async def search_personalized_web(query: str, location: str = "") -> str:
    if not tavily_client:
        return ""
    try:
        response = tavily_client.search(
            query=f"{query} {location}".strip(),
            search_depth="advanced",
            max_results=5,
            include_answer=True
        )
        output = [f"SEARCH ANSWER: {response.get('answer', 'No direct answer found.')}"]
        for res in response.get('results', []):
            output.append(f"- {res['title']}: {res['content'][:250]}")
        return "\n".join(output)
    except Exception as e:
        logger.error(f"Search Execution Error: {e}")
        return ""

# ---------------------------------------------------------
# REALISTIC VOICE GENERATION (OPTIMIZED FOR SPEED)
# ---------------------------------------------------------
@app.post("/generate-audio")
async def generate_audio(text: str = Form(...), voice: str = Form("onyx")):
    if not openai_client:
        return {"error": "Voice system offline"}
    try:
        # SPEED FIX: Use tts-1 for lower latency (HD is too slow)
        clean_text = text.replace("**", "").replace("#", "").replace("_", "").strip()
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=clean_text[:600] 
        )
        audio_b64 = base64.b64encode(response.content).decode('utf-8')
        return {"audio_b64": audio_b64}
    except Exception as e:
        logger.error(f"Voice Error: {e}")
        return {"error": str(e)}

# ---------------------------------------------------------
# THE DUAL-AI CONSENSUS ENGINE
# ---------------------------------------------------------
async def call_gemini_vision(prompt: str, image_b64: str = None):
    if not gemini_ready:
        return None
    try:
        # Faster flash model for standard check
        model = genai.GenerativeModel('gemini-1.5-flash')
        content = [prompt]
        
        if image_b64:
            import PIL.Image
            img_data = base64.b64decode(image_b64)
            img = PIL.Image.open(BytesIO(img_data))
            content.append(img)
            
        response = await asyncio.to_thread(model.generate_content, content)
        
        # Try to extract JSON if Gemini tries to be a smart-aleck
        text = response.text.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(text)
            parsed["model"] = "Gemini-Flash-Consensus"
            return parsed
        except:
            return {"answer": response.text, "confidence_score": 85, "model": "Gemini-Flash-Consensus"}
    except Exception as e:
        logger.error(f"Gemini Engine Error: {e}")
        return None

async def call_openai_bodyguard(prompt: str, image_b64: str = None):
    if not openai_client:
        return None
    try:
        content = [{"type": "text", "text": prompt}]
        if image_b64:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}})
            
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini", # Optimized for prompt speed
            messages=[
                {"role": "system", "content": "You are a Digital Bodyguard. Speak like a trusted family member. Output JSON only."}, 
                {"role": "user", "content": content}
            ],
            response_format={ "type": "json_object" }
        )
        result = json.loads(response.choices[0].message.content)
        result["model"] = "OpenAI-Bodyguard-Consensus"
        return result
    except Exception as e:
        logger.error(f"OpenAI Engine Error: {e}")
        return None

# ---------------------------------------------------------
# MAIN CHAT GATEWAY (12-SEAT RECURSIVE ENGINE)
# ---------------------------------------------------------
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form(""),
    vibe: str = Form("standard"),
    file: UploadFile = File(None)
):
    user_id = create_user_id(user_email)
    email_lower = user_email.lower().strip()
    user_data = ELITE_USERS.get(email_lower, {"tier": "free", "name": "Protected User"})
    
    # --- UNLIMITED MASTER BYPASS ---
    if email_lower == "stangman9898@gmail.com":
        limit = 999999
    else:
        limit = TIER_LIMITS.get(user_data["tier"], 15)
        
    if USAGE_TRACKER[user_id] >= limit:
        return {"answer": "Daily protection limit reached. Secure your team to continue.", "usage_info": {"can_send": False}}

    # Pre-chat Analysis
    memories = await retrieve_intelligence_sync(user_id, msg)
    search_intel = ""
    if any(k in msg.lower() for k in ['news', 'weather', 'search', 'today', 'latest', 'cost']):
        search_intel = await search_personalized_web(msg, user_location)
    
    scam_flags = analyze_scam_indicators(msg)

    # Modular Prompt Building
    p_def = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS['guardian'])
    p_ext = PERSONA_EXTENDED.get(persona, "")
    v_inst = VIBE_STYLES.get(vibe, "")
    hook = get_random_hook(persona)
    
    image_b64 = None
    if file:
        file_bytes = await file.read()
        image_b64 = base64.b64encode(file_bytes).decode('utf-8')

    master_prompt = f"""
    IDENTITY: {p_def}
    EXTENDED INTELLIGENCE: {p_ext}
    VIBE STYLE: {v_inst}
    START WITH: "{hook}"
    
    RECURSIVE MEMORIES: {memories}
    LIVE WEB INTEL: {search_intel}
    HEURISTIC FLAGS: {scam_flags}
    
    USER: {user_data['name']}
    MESSAGE: {msg}
    
    LYLO SYSTEM PROTOCOLS:
    1. TRUTH FIRST: Be blunt and direct. No corporate AI fluff.
    2. FAMILY PROTECTION: If the message or search data shows a scam or danger, call it out with a confidence score of 100.
    3. RECURSIVE AWARENESS: Mention past details if 'RECURSIVE MEMORIES' has relevant info.
    
    JSON RESPONSE FORMAT:
    {{ "answer": "your family-style response", "confidence_score": 0-100, "scam_detected": boolean, "threat_level": "low/high" }}
    """

    # Parallel Brain Fight
    tasks = [
        call_openai_bodyguard(master_prompt, image_b64),
        call_gemini_vision(master_prompt, image_b64)
    ]
    results = await asyncio.gather(*tasks)
    valid_results = [r for r in results if r and 'answer' in r]
    
    if not valid_results:
        return {"answer": f"{hook} I'm checking my connections... let me try again.", "confidence_score": 0}
    
    # Picking the safest/best brain
    winner = max(valid_results, key=lambda x: (
        x.get('confidence_score', 0) + 
        (30 if x.get('scam_detected') else 0) +
        (15 if x.get('threat_level') == 'high' else 0)
    ))
    
    # Usage Tracking & Long-term Sync
    USAGE_TRACKER[user_id] += 1
    asyncio.create_task(store_intelligence_sync(user_id, msg, "user"))
    asyncio.create_task(store_intelligence_sync(user_id, winner['answer'], "bot"))

    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 95) if not winner.get('scam_detected') else 100,
        "scam_detected": winner.get('scam_detected', False),
        "threat_level": winner.get('threat_level', 'low'),
        "persona_hook": hook,
        "bodyguard_model": winner.get('model', 'LYLO-CORE')
    }

# ---------------------------------------------------------
# ACCESS, STATS & RECOVERY
# ---------------------------------------------------------
@app.post("/check-beta-access")
async def check_beta(data: dict):
    email = data.get("email", "").lower().strip()
    user = ELITE_USERS.get(email)
    if user:
        return {"access": True, "tier": user["tier"], "name": user["name"]}
    return {"access": False, "tier": "free"}

@app.get("/user-stats/{user_email}")
async def get_stats(user_email: str):
    uid = create_user_id(user_email)
    email_lower = user_email.lower().strip()
    user_data = ELITE_USERS.get(email_lower, {"tier": "free", "name": "User"})
    
    limit = 999999 if email_lower == "stangman9898@gmail.com" else TIER_LIMITS.get(user_data["tier"], 15)
    
    return {
        "usage": USAGE_TRACKER[uid],
        "limit": limit,
        "tier": user_data["tier"],
        "display_name": user_data["name"]
    }

@app.get("/scam-recovery/{email}")
async def recovery_center(email: str):
    user = ELITE_USERS.get(email.lower().strip())
    if not user or user["tier"] not in ["elite", "max"]:
        raise HTTPException(status_code=403, detail="Elite Access Required")
        
    return {
        "title": "🛡️ ELITE RECOVERY PROTOCOL",
        "immediate_actions": [
            "SHUTDOWN: Call bank fraud department now.",
            "CREDIT LOCK: Contact Equifax, Experian, and TransUnion to freeze your reports.",
            "GOVERNMENT FILING: Report incident at IC3.gov and FTC.gov.",
            "EVIDENCE LOG: Screenshot all suspicious interactions immediately."
        ]
    }

@app.get("/")
async def root():
    return {
        "status": "LYLO MODULAR INTELLIGENCE SYSTEM ONLINE",
        "version": "18.8.0",
        "philosophy": "Recursive Truth & Proactive Protection"
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
