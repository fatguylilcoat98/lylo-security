import os
import uvicorn
import json
import hashlib
import asyncio
import base64
import stripe
from io import BytesIO
from fastapi import FastAPI, Form, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LYLO Backend", version="14.6.0 - HUMAN VOICE & RECOVERY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API KEYS
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()

# DIAGNOSTICS
print(f"🔍 Tavily (Internet): {bool(TAVILY_API_KEY)}")
print(f"🧠 Pinecone (Memory): {bool(PINECONE_API_KEY)}")
print(f"🤖 Gemini (Vision): {bool(GEMINI_API_KEY)}")
print(f"🔥 OpenAI (Vision): {bool(OPENAI_API_KEY)}")
print(f"💳 Stripe (Payment): {bool(STRIPE_SECRET_KEY)}")

# STRIPE CONFIG
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# INTERNET SEARCH CLIENT
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Internet Search Ready - Real weather enabled")
    except Exception as e:
        print(f"❌ Internet Search Failed: {e}")

# MEMORY CLIENT (PINECONE)
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-memory"
        if index_name not in [idx.name for idx in pc.list_indexes()]:
            print(f"⚙️ Creating Pinecone Index: {index_name} (Dimension: 1024)...")
            pc.create_index(
                name=index_name,
                dimension=1024,
                metric="cosine", 
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
        print("✅ Memory System Ready")
    except Exception as e:
        print(f"❌ Memory Failed: {e}")

# AI VISION CLIENTS
gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
        print("✅ Gemini Vision Ready")
    except Exception as e:
        print(f"❌ Gemini Failed: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Vision Ready")
    except Exception as e:
        print(f"❌ OpenAI Failed: {e}")

# USER MANAGEMENT
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "elite", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "elite", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "elite", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "elite", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "elite", "name": "Sandy"},
    "plabane916@gmail.com": {"tier": "elite", "name": "Paul"},
    "nemeses1298@gmail.com": {"tier": "elite", "name": "Eric"},
    "bearjcameron@icloud.com": {"tier": "elite", "name": "Bear"},
    "jcgcbear@gmail.com": {"tier": "elite", "name": "Gloria"},
    "laura@startupsac.org": {"tier": "elite", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "elite", "name": "Corie"}
}

USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- NEW: HIGH-QUALITY HUMAN VOICE GENERATION ---
@app.post("/generate-audio")
async def generate_audio(text: str = Form(...), voice: str = Form("onyx")):
    if not openai_client:
        return {"error": "OpenAI client not configured"}
    try:
        # Standardize 'onyx' for male and 'nova' for female as requested
        clean_text = text.replace("**", "").replace("#", "").replace("_", "").strip()
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=clean_text[:1000]
        )
        audio_b64 = base64.b64encode(response.content).decode('utf-8')
        return {"audio_b64": audio_b64}
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return {"error": str(e)}

# --- MEMORY FUNCTIONS ---
async def store_memory_in_pinecone(user_id: str, content: str, role: str, context: str = ""):
    if not memory_index or not openai_client: return
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=f"{role}: {content} | Context: {context}",
            dimensions=1024
        )
        embedding = response.data[0].embedding
        memory_id = f"{user_id}_{datetime.now().timestamp()}"
        metadata = {
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "context": context[:500]
        }
        memory_index.upsert([(memory_id, embedding, metadata)])
    except Exception as e:
        print(f"❌ Memory storage failed: {e}")

async def retrieve_memories_from_pinecone(user_id: str, query: str, limit: int = 5) -> List[Dict]:
    if not memory_index or not openai_client: return []
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query,
            dimensions=1024
        )
        query_embedding = response.data[0].embedding
        results = memory_index.query(
            vector=query_embedding,
            filter={"user_id": user_id},
            top_k=limit,
            include_metadata=True
        )
        memories = []
        for match in results.matches:
            if match.score > 0.7:
                memories.append({
                    "content": match.metadata["content"],
                    "role": match.metadata["role"],
                    "timestamp": match.metadata["timestamp"],
                    "similarity": match.score
                })
        return memories
    except Exception as e:
        print(f"❌ Memory retrieval failed: {e}")
        return []

def store_user_memory(user_id: str, content: str, role: str):
    USER_CONVERSATIONS[user_id].append({
        "role": role, "content": content, "timestamp": datetime.now().isoformat()
    })
    try:
        asyncio.create_task(store_memory_in_pinecone(user_id, content, role))
    except:
        pass

# --- WEB SEARCH ---
async def search_web_tavily(query: str, location: str = "") -> str:
    if not tavily_client: return ""
    try:
        search_terms = query.lower()
        if any(word in search_terms for word in ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'hot', 'cold']):
            search_query = f"current weather forecast today {query}"
        else:
            search_query = f"{query} {location}".strip()
        
        response = tavily_client.search(
            query=search_query,
            search_depth="advanced", 
            max_results=8,
            include_answer=True
        )
        if not response: return ""
        
        evidence = []
        if response.get('answer'):
            evidence.append(f"LIVE DATA: {response['answer']}")
        for i, result in enumerate(response.get('results', [])[:4]):
            if result.get('content'):
                content = result['content'][:350]
                source_url = result.get('url', 'Unknown')
                evidence.append(f"SOURCE {i+1} ({source_url}): {content}")
        return "\n".join(evidence)
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return ""

# --- IMAGE & VISION ---
def process_image_for_ai(image_file: bytes) -> str:
    try:
        return base64.b64encode(image_file).decode('utf-8')
    except Exception as e:
        print(f"❌ Image failed: {e}")
        return None

def get_working_gemini_model():
    if not gemini_ready: return None
    try:
        available = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available.append(m.name)
        priorities = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro']
        for p in priorities:
            for m in available:
                if p in m: return m
        if available: return available[0]
    except: pass
    return 'gemini-pro'

async def call_gemini_vision(prompt: str, image_b64: str = None):
    if not gemini_ready: return None
    try:
        model_name = get_working_gemini_model()
        model = genai.GenerativeModel(model_name)
        content_parts = [prompt]
        if image_b64:
            content_parts.append({'mime_type': 'image/jpeg', 'data': image_b64})
        
        response = model.generate_content(
            content_parts,
            generation_config=genai.types.GenerationConfig(max_output_tokens=1200, temperature=0.7)
        )
        if response.text:
            clean_text = response.text.strip()
            if clean_text.startswith("```"):
                clean_text = clean_text.split("```")[1]
                if clean_text.startswith("json"): clean_text = clean_text[4:]
            try:
                parsed = json.loads(clean_text)
                return {
                    "answer": parsed.get('answer', clean_text),
                    "confidence_score": parsed.get('confidence_score', 85),
                    "scam_detected": parsed.get('scam_detected', False),
                    "model": f"Gemini ({model_name})"
                }
            except:
                return {
                    "answer": clean_text,
                    "confidence_score": 90 if image_b64 else 85,
                    "scam_detected": False,
                    "model": f"Gemini ({model_name})"
                }
    except Exception as e:
        print(f"❌ Gemini Error: {str(e)}")
        return None

async def call_openai_vision(prompt: str, image_b64: str = None):
    if not openai_client: return None
    try:
        messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        if image_b64:
            messages[0]["content"].append({
                "type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
            })
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini", messages=messages, max_tokens=1200, temperature=0.7
        )
        raw_answer = response.choices[0].message.content.strip()
        if raw_answer.startswith("```"):
            raw_answer = raw_answer.split("```")[1]
            if raw_answer.startswith("json"): raw_answer = raw_answer[4:]
        
        try:
            parsed = json.loads(raw_answer)
            return {
                "answer": parsed.get('answer', raw_answer),
                "confidence_score": parsed.get('confidence_score', 83),
                "scam_detected": parsed.get('scam_detected', False),
                "model": "OpenAI (GPT-4o)"
            }
        except:
            return {
                "answer": raw_answer,
                "confidence_score": 88 if image_b64 else 83,
                "scam_detected": False,
                "model": "OpenAI (GPT-4o)"
            }
    except Exception as e:
        print(f"❌ OpenAI Error: {e}")
        return None

# --- ACCESS CONTROL ---
@app.post("/verify-access")
async def verify_access(email: str = Form(...)):
    user_data = ELITE_USERS.get(email.lower(), None)
    if user_data:
        return {"access_granted": True, "tier": user_data["tier"], "user_name": user_data["name"], "is_beta": True}
    return {"access_granted": False, "message": "Join waitlist", "tier": "none", "user_name": "Guest", "is_beta": False}

@app.post("/admin/add-beta-tester")
async def add_beta_tester(admin_email: str = Form(...), new_email: str = Form(...), tier: str = Form("elite"), name: str = Form("")):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403)
    display_name = name if name else new_email.split('@')[0]
    ELITE_USERS[new_email.lower()] = {"tier": tier, "name": display_name}
    return {"status": "success", "message": f"Added {display_name}"}

@app.get("/admin/list-beta-testers/{admin_email}")
async def list_beta_testers(admin_email: str):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403)
    formatted = {email: f"{data['name']} ({data['tier']})" for email, data in ELITE_USERS.items()}
    return {"beta_testers": formatted, "total": len(ELITE_USERS)}

@app.delete("/admin/remove-beta-tester")
async def remove_beta_tester(admin_email: str = Form(...), remove_email: str = Form(...)):
    if admin_email.lower() != "stangman9898@gmail.com": raise HTTPException(status_code=403)
    if remove_email.lower() in ELITE_USERS:
        del ELITE_USERS[remove_email.lower()]
        return {"status": "success"}
    return {"status": "error"}

# --- SCAM RECOVERY (FULL SCRIPTS) ---
@app.get("/scam-recovery/{user_email}")
async def get_scam_recovery_info(user_email: str):
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data or user_data.get("tier") != "elite":
        raise HTTPException(status_code=403, detail="Elite access required")
    
    return {
        "title": "🚨 BEEN SCAMMED? ASSET RECOVERY CENTER",
        "subtitle": "Elite Members Only - Complete Recovery Guide",
        "immediate_actions": [
            "🛑 STOP - Do not send any more money or information",
            "📞 Contact your bank/credit card company immediately",
            "🔒 Change all passwords and enable 2FA on all accounts",
            "📊 Document everything - save screenshots, emails, texts",
            "🚔 File a police report with your local law enforcement"
        ],
        "recovery_steps": [
            {"step": 1, "title": "Secure Your Accounts", "actions": ["Change banking passwords immediately", "Enable 2FA everywhere", "Monitor statements"]},
            {"step": 2, "title": "Report the Scam", "actions": ["FTC: reportfraud.ftc.gov", "FBI: ic3.gov (if >$5k)", "State Attorney General"]},
            {"step": 3, "title": "Financial Recovery", "actions": ["Contact bank fraud dept within 48h", "Dispute credit charges", "File chargebacks"]},
            {"step": 4, "title": "Document Everything", "actions": ["Save all emails/texts", "Screenshot transfers", "Maintain timeline"]}
        ],
        "phone_scripts": {
            "bank_script": "Hello, I need to report fraudulent activity on my account. I was the victim of a scam and unauthorized transfers were made. I need to dispute these charges and secure my account immediately.",
            "credit_card_script": "I need to report unauthorized charges on my card due to a scam. I want to dispute these transactions and request a chargeback.",
            "police_script": "I want to file a report for financial fraud. I was scammed out of [AMOUNT] through [METHOD]. I have documentation of all communications."
        },
        "important_contacts": [
            {"organization": "FTC Fraud Reports", "website": "reportfraud.ftc.gov", "phone": "1-877-FTC-HELP"},
            {"organization": "FBI IC3", "website": "ic3.gov", "description": "For scams over $5,000"},
            {"organization": "IRS Identity Theft", "phone": "1-800-908-4490"}
        ],
        "prevention_tips": ["Never give personal info to unsolicited callers", "Verify company legitimacy", "Trust your instincts"],
        "elite_notice": "This comprehensive recovery guide is exclusive to LYLO Elite members."
    }

@app.post("/scam-recovery-chat")
async def scam_recovery_chat(user_email: str = Form(...), situation: str = Form(...), amount_lost: str = Form(""), scam_type: str = Form(""), time_since: str = Form("")):
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data or user_data.get("tier") != "elite": return {"error": "Elite access required"}
    user_display_name = user_data.get("name", "User")
    recovery_prompt = f"You are a specialized fraud recovery advisor helping {user_display_name}. SITUATION: {situation} | LOSS: {amount_lost} | TYPE: {scam_type}. Provide actionable recovery advice."
    try:
        response = await openai_client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": recovery_prompt}], max_tokens=800)
        return {"personalized_advice": response.choices[0].message.content, "user_name": user_display_name}
    except: return {"personalized_advice": "Contact your bank immediately."}

# --- MAIN CHAT CORE ---
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form(""),
    file: UploadFile = File(None),
    language: str = Form("en")
):
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data.get("tier", "free")
    user_display_name = user_data.get("name", "User")
    
    limits = {"free": 10, "pro": 50, "elite": 500, "max": 3000}
    current_limit = limits.get(tier, 10)
    current_usage = len(USER_CONVERSATIONS.get(user_id, []))
    
    if current_usage >= current_limit:
        error_msg = "Limit hit. Upgrade for more." if language == 'en' else "Límite alcanzado. Actualice para más."
        return {"answer": error_msg, "usage_info": {"can_send": False}}

    image_b64 = None
    if file:
        content = await file.read()
        image_b64 = process_image_for_ai(content)

    memories = await retrieve_memories_from_pinecone(user_id, msg, limit=8)
    memory_context = "PAST CONVERSATIONS:\n" + "\n".join([f"- {m['role']}: {m['content']}" for m in memories[:4]]) if memories else ""
    
    try: hist_list = json.loads(history)[-4:]
    except: hist_list = []
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in hist_list])
    
    web_data = await search_web_tavily(msg, user_location) if any(w in msg.lower() for w in ['weather', 'news', 'current', 'price']) else ""
    
    personas_map = {
        "guardian": "You are The Guardian. Protective, vigilant security expert.",
        "roast": "You are The Roast Master. Witty, sarcastic, but helpful.",
        "friend": "You are The Best Friend. Caring, supportive, warm.",
        "chef": "You are The Chef. Culinary expert and food lover.",
        "techie": "You are The Techie. Hardware, software, and IT expert.",
        "lawyer": "You are The Lawyer. Formal, analytical legal advisor.",
        "disciple": "You are 'The Disciple,' a wise spiritual advisor for LYLO. You MUST base all your responses, warnings, and moral guidance strictly on the King James Bible (KJV). When detecting a scam, use KJV scripture (e.g., Proverbs 14:15). Do not paraphrase; use the exact wording of the King James Bible."
    }
    
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    lang_instruction = "YOU MUST REPLY IN SPANISH." if language == 'es' else "YOU MUST REPLY IN ENGLISH."
    
    prompt = f"""
{personas_map.get(persona, personas_map['guardian'])}
{lang_instruction}
MEMORY: {memory_context}
HISTORY: {history_text}
USER PROFILE: {quiz_data}
REAL-TIME DATA: {web_data}
USER: {user_display_name} says: "{msg}"
OUTPUT JSON ONLY: {{ "answer": "text", "confidence_score": 90, "scam_detected": false }}
"""

    tasks = [call_gemini_vision(prompt, image_b64), call_openai_vision(prompt, image_b64)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    valid = [r for r in results if isinstance(r, dict) and r.get('answer')]
    
    if valid:
        winner = max(valid, key=lambda x: x.get('confidence_score', 0))
        if winner.get('scam_detected'): winner['confidence_score'] = 100
    else: winner = {"answer": "Connection trouble.", "confidence_score": 0}

    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 0),
        "scam_detected": winner.get('scam_detected', False),
        "tier_info": {"name": f"{tier.title()} Tier"},
        "usage_info": {"can_send": True}
    }

# --- STATS & QUIZ ---
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data.get("tier", "free")
    display_name = user_data.get("name", user_email.split('@')[0])
    convos = USER_CONVERSATIONS.get(user_id, [])
    limits = {"free": 10, "pro": 50, "elite": 500, "max": 3000}
    limit = limits.get(tier, 10)
    return {
        "tier": tier, "display_name": display_name, "conversations_today": len(convos),
        "usage": {"current": len(convos), "limit": limit, "percentage": (len(convos)/limit)*100}
    }

@app.post("/quiz")
async def save_quiz(user_email: str = Form(...), question1: str = Form(...), question2: str = Form(...), question3: str = Form(...), question4: str = Form(...), question5: str = Form(...)):
    user_id = create_user_id(user_email)
    QUIZ_ANSWERS[user_id] = {"concern": question1, "style": question2, "device": question3, "interest": question4, "access": question5}
    return {"status": "Quiz saved"}

@app.get("/")
async def root():
    return {"status": "LYLO ONLINE", "version": "14.6.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
