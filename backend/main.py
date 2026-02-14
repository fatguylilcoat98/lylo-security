import os
import uvicorn
import json
import hashlib
import asyncio
import base64
import stripe
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

# Load environment variables
load_dotenv()

# Initialize FastAPI App
app = FastAPI(
    title="LYLO Backend System - SPEED OPTIMIZED",
    description="The central intelligence API for LYLO.PRO - Featuring Elite Recovery, King James Wisdom, and Human Voice Synthesis.",
    version="15.1.0 - SPEED + ACCURACY EDITION"
)

# Configure CORS for Frontend Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# ---------------------------------------------------------
# API KEY CONFIGURATION & DIAGNOSTICS
# ---------------------------------------------------------
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()

# --- SAFETY SHIELD LIMITS (The "Butt-Saver" Logic) ---
TIER_LIMITS = {
    "free": 5,
    "pro": 50,      # $1.99 Plan
    "elite": 500,   # $4.99 Plan
    "max": 5000     # $9.99 Plan (Safety cap)
}

# Persistent usage tracker (In-Memory for now)
USAGE_TRACKER = defaultdict(int)

print("--- SPEED OPTIMIZED SYSTEM DIAGNOSTICS ---")
print(f"🔍 Tavily (Internet Search): {'✅ Active' if TAVILY_API_KEY else '❌ Inactive'}")
print(f"🧠 Pinecone (Long-Term Memory): {'✅ Active' if PINECONE_API_KEY else '❌ Inactive'}")
print(f"🤖 Gemini (Vision Analysis): {'✅ Active' if GEMINI_API_KEY else '❌ Inactive'}")
print(f"🔥 OpenAI (Chat & Voice): {'✅ Active' if OPENAI_API_KEY else '❌ Inactive'}")
print(f"💳 Stripe (Payments): {'✅ Active' if STRIPE_SECRET_KEY else '❌ Inactive'}")
print("------------------------------------------")

# Stripe Configuration
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# ---------------------------------------------------------
# CLIENT INITIALIZATION
# ---------------------------------------------------------

# Internet Search Client
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Internet Search Client Initialized")
    except Exception as e:
        print(f"❌ Internet Search Client Failed: {e}")

# Memory Client (Pinecone)
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-memory"
        
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing_indexes:
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
        print(f"❌ Memory System Failed: {e}")

# AI Vision Clients
gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
        print("✅ Gemini Vision Ready")
    except Exception as e:
        print(f"❌ Gemini Vision Failed: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Client Ready (Chat + Vision + Voice)")
    except Exception as e:
        print(f"❌ OpenAI Client Failed: {e}")

# ---------------------------------------------------------
# USER DATABASE & MANAGEMENT
# ---------------------------------------------------------

# Elite Users Database - FULL EXPLICIT LIST (UPDATED TO MAX)
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "max", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "max", "name": "Sandy"},
    "chris.betatester1@gmail.com": {"tier": "max", "name": "James"},
    "chris.betatester2@gmail.com": {"tier": "max", "name": "Beta 2"},
    "chris.betatester3@gmail.com": {"tier": "max", "name": "Beta 3"},
    "chris.betatester4@gmail.com": {"tier": "max", "name": "Beta 4"},
    "chris.betatester5@gmail.com": {"tier": "max", "name": "Beta 5"},
    "chris.betatester6@gmail.com": {"tier": "max", "name": "Beta 6"},
    "chris.betatester7@gmail.com": {"tier": "max", "name": "Beta 7"},
    "chris.betatester8@gmail.com": {"tier": "max", "name": "Beta 8"},
    "chris.betatester9@gmail.com": {"tier": "max", "name": "Beta 9"},
    "chris.betatester10@gmail.com": {"tier": "max", "name": "Beta 10"},
    "chris.betatester11@gmail.com": {"tier": "max", "name": "Beta 11"},
    "chris.betatester12@gmail.com": {"tier": "max", "name": "Beta 12"},
    "chris.betatester13@gmail.com": {"tier": "max", "name": "Beta 13"},
    "chris.betatester14@gmail.com": {"tier": "max", "name": "Beta 14"},
    "chris.betatester15@gmail.com": {"tier": "max", "name": "Beta 15"},
    "chris.betatester16@gmail.com": {"tier": "max", "name": "Beta 16"},
    "chris.betatester17@gmail.com": {"tier": "max", "name": "Beta 17"},
    "chris.betatester18@gmail.com": {"tier": "max", "name": "Beta 18"},
    "chris.betatester19@gmail.com": {"tier": "max", "name": "Beta 19"},
    "chris.betatester20@gmail.com": {"tier": "max", "name": "Beta 20"},
    "plabane916@gmail.com": {"tier": "max", "name": "Paul"},
    "nemeses1298@gmail.com": {"tier": "max", "name": "Eric"},
    "bearjcameron@icloud.com": {"tier": "max", "name": "Bear"},
    "jcgcbear@gmail.com": {"tier": "max", "name": "Gloria"},
    "laura@startupsac.org": {"tier": "max", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "max", "name": "Corie"}
}

# In-Memory Storage for Conversations and Quiz Data
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    """Creates a secure, hashed user ID from an email address."""
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# HUMAN VOICE GENERATION (The "Pennies" Route)
# ---------------------------------------------------------
@app.post("/generate-audio")
async def generate_audio(
    text: str = Form(...), 
    voice: str = Form("onyx")
):
    """Generates high-quality human speech from text."""
    if not openai_client:
        return {"error": "OpenAI client not configured"}

    try:
        # SPEED OPTIMIZATION: Limit text length for faster processing
        clean_text = text.replace("**", "").replace("#", "").replace("_", "").replace("`", "").strip()
        
        # Cap at 500 chars for faster TTS generation
        response = await openai_client.audio.speech.create(
            model="tts-1",  # Faster model
            voice=voice,
            input=clean_text[:500]  # Reduced from 1000 for speed
        )
        
        audio_b64 = base64.b64encode(response.content).decode('utf-8')
        return {"audio_b64": audio_b64}
        
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return {"error": str(e)}

# ---------------------------------------------------------
# SPEED-OPTIMIZED MEMORY FUNCTIONS
# ---------------------------------------------------------
async def store_memory_in_pinecone(user_id: str, content: str, role: str, context: str = ""):
    """Stores a single message in the long-term vector database."""
    if not memory_index or not openai_client: 
        return
        
    try:
        # SPEED OPTIMIZATION: Only store important messages (longer than 10 chars)
        if len(content.strip()) < 10:
            return
            
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=f"{role}: {content[:200]} | Context: {context[:100]}", # Truncated for speed
            dimensions=1024
        )
        
        embedding = response.data[0].embedding
        memory_id = f"{user_id}_{datetime.now().timestamp()}"
        
        metadata = {
            "user_id": user_id,
            "role": role,
            "content": content[:300],  # Truncated for speed
            "timestamp": datetime.now().isoformat(),
            "context": context[:200]  # Truncated for speed
        }
        
        memory_index.upsert([(memory_id, embedding, metadata)])
        
    except Exception as e:
        print(f"❌ Memory storage failed: {e}")

async def retrieve_memories_from_pinecone(user_id: str, query: str, limit: int = 3) -> List[Dict]:
    """SPEED OPTIMIZED: Retrieves only 3 most relevant memories instead of 8."""
    if not memory_index or not openai_client: 
        return []
        
    try:
        # SPEED OPTIMIZATION: Truncate query for faster processing
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query[:100],  # Truncated for speed
            dimensions=1024
        )
        
        query_embedding = response.data[0].embedding
        
        # SPEED OPTIMIZATION: Reduced top_k from 5 to 3, higher similarity threshold
        results = memory_index.query(
            vector=query_embedding,
            filter={"user_id": user_id},
            top_k=limit,  # Reduced from 5 to 3
            include_metadata=True
        )
        
        memories = []
        for match in results.matches:
            if match.score > 0.75:  # Higher threshold (was 0.7) for better matches only
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
    """Helper function to store in both RAM and Pinecone."""
    USER_CONVERSATIONS[user_id].append({
        "role": role, 
        "content": content, 
        "timestamp": datetime.now().isoformat()
    })
    
    # SPEED OPTIMIZATION: Only store in Pinecone for important messages
    if len(content.strip()) > 15:  # Only meaningful messages
        try:
            asyncio.create_task(store_memory_in_pinecone(user_id, content, role))
        except:
            pass

# ---------------------------------------------------------
# SPEED-OPTIMIZED WEB SEARCH FUNCTIONS
# ---------------------------------------------------------

# SPEED OPTIMIZATION: More selective web search triggers
WEB_SEARCH_TRIGGERS = [
    'weather', 'temperature', 'forecast', 'rain', 'sunny', 'hot', 'cold', 'snow',
    'news', 'breaking', 'today', 'current', 'latest', 'recent',
    'price', 'stock', 'market', 'bitcoin', 'crypto', 'cost',
    'election', 'vote', 'president', 'politics'
]

async def search_web_tavily(query: str, location: str = "") -> str:
    """SPEED OPTIMIZED: Searches the internet for real-time information."""
    if not tavily_client: 
        return ""
        
    try:
        search_terms = query.lower()
        
        # SPEED OPTIMIZATION: More intelligent query formatting
        if any(word in search_terms for word in ['weather', 'temperature', 'forecast']):
            search_query = f"weather forecast {query} {location}".strip()
        elif any(word in search_terms for word in ['price', 'cost', 'stock']):
            search_query = f"current price {query}".strip()
        else:
            search_query = f"{query} {location}".strip()
        
        # SPEED OPTIMIZATION: Reduced max_results from 8 to 4
        response = tavily_client.search(
            query=search_query,
            search_depth="basic",  # Changed from "advanced" for speed
            max_results=4,  # Reduced from 8
            include_answer=True
        )
        
        if not response: 
            return ""
        
        evidence = []
        
        if response.get('answer'):
            evidence.append(f"CURRENT INFO: {response['answer']}")
            
        # SPEED OPTIMIZATION: Only process first 2 results instead of 4
        for i, result in enumerate(response.get('results', [])[:2]):
            if result.get('content'):
                content = result['content'][:200]  # Reduced from 350
                source_url = result.get('url', 'Unknown')
                evidence.append(f"SOURCE {i+1}: {content}")
                
        return "\n".join(evidence)
        
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return ""

# ---------------------------------------------------------
# IMAGE PROCESSING & AI VISION
# ---------------------------------------------------------
def process_image_for_ai(image_file: bytes) -> str:
    """Converts uploaded image bytes to Base64 string."""
    try:
        return base64.b64encode(image_file).decode('utf-8')
    except Exception as e:
        print(f"❌ Image processing failed: {e}")
        return None

def get_working_gemini_model():
    """Finds the best available Gemini model."""
    if not gemini_ready: 
        return None
    try:
        # SPEED OPTIMIZATION: Use fastest model first
        return 'gemini-1.5-flash'  # Fastest model
    except: 
        pass
    return 'gemini-pro'

async def call_gemini_vision(prompt: str, image_b64: str = None):
    """SPEED OPTIMIZED: Calls Google's Gemini Vision API."""
    if not gemini_ready: 
        return None
        
    try:
        model_name = get_working_gemini_model()
        model = genai.GenerativeModel(model_name)
        
        content_parts = [prompt]
        if image_b64:
            content_parts.append({'mime_type': 'image/jpeg', 'data': image_b64})
        
        response = model.generate_content(
            content_parts,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=800,  # Reduced from 1200 for speed
                temperature=0.7
            )
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
    """SPEED OPTIMIZED: Calls OpenAI's GPT-4o Vision API."""
    if not openai_client: 
        return None
        
    try:
        messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        
        if image_b64:
            messages[0]["content"].append({
                "type": "image_url", 
                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
            })
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini", 
            messages=messages, 
            max_tokens=800,  # Reduced from 1200 for speed
            temperature=0.7
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

# ---------------------------------------------------------
# ACCESS CONTROL & ADMIN ROUTES
# ---------------------------------------------------------

@app.post("/check-beta-access")
async def check_beta_access(request: Request):
    """Verifies beta access using the ELITE_USERS dictionary."""
    try:
        try:
            data = await request.json()
            email = data.get("email", "")
        except:
            form_data = await request.form()
            email = form_data.get("email", "")
            
        email = email.lower().strip()
        user_data = ELITE_USERS.get(email)
        
        if user_data:
            return {
                "access": True,
                "tier": user_data.get("tier", "max"),
                "name": user_data.get("name", "Beta User"),
                "message": "Access Granted"
            }
            
        return {"access": False, "tier": "free", "message": "Not found in beta list"}
        
    except Exception as e:
        print(f"❌ Beta Check Error: {e}")
        return {"access": False, "error": str(e)}

@app.post("/verify-access")
async def verify_access(email: str = Form(...)):
    """Verifies if a user is allowed to access the system."""
    user_data = ELITE_USERS.get(email.lower(), None)
    
    if user_data:
        if isinstance(user_data, dict):
            return {
                "access_granted": True, 
                "tier": user_data["tier"], 
                "user_name": user_data["name"], 
                "is_beta": True
            }
        return {
            "access_granted": True, 
            "tier": user_data, 
            "user_name": email.split('@')[0], 
            "is_beta": True
        }
        
    return {
        "access_granted": False, 
        "message": "Join waitlist", 
        "tier": "none", 
        "user_name": "Guest", 
        "is_beta": False
    }

@app.post("/admin/add-beta-tester")
async def add_beta_tester(
    admin_email: str = Form(...), 
    new_email: str = Form(...), 
    tier: str = Form("max"), 
    name: str = Form("")
):
    """Admin route to add new users manually."""
    if admin_email.lower() != "stangman9898@gmail.com": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    display_name = name if name else new_email.split('@')[0]
    
    ELITE_USERS[new_email.lower()] = {
        "tier": tier, 
        "name": display_name
    }
    
    return {"status": "success", "message": f"Added {display_name}"}

@app.get("/admin/list-beta-testers/{admin_email}")
async def list_beta_testers(admin_email: str):
    """Lists all current beta testers."""
    if admin_email.lower() != "stangman9898@gmail.com": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    formatted = {}
    for email, data in ELITE_USERS.items():
        if isinstance(data, dict): 
            formatted[email] = f"{data['name']} ({data['tier']})"
        else: 
            formatted[email] = f"{email.split('@')[0]} ({data})"
            
    return {
        "beta_testers": formatted, 
        "total": len(ELITE_USERS)
    }

@app.delete("/admin/remove-beta-tester")
async def remove_beta_tester(admin_email: str = Form(...), remove_email: str = Form(...)):
    """Removes a user from the beta list."""
    if admin_email.lower() != "stangman9898@gmail.com": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if remove_email.lower() in ELITE_USERS:
        del ELITE_USERS[remove_email.lower()]
        return {"status": "success"}
        
    return {"status": "error", "message": "User not found"}

# ---------------------------------------------------------
# SCAM RECOVERY SYSTEM (ELITE EXCLUSIVE)
# ---------------------------------------------------------
@app.get("/scam-recovery/{user_email}")
async def get_scam_recovery_info(user_email: str):
    """Returns the full, static recovery guide for Elite members."""
    user_data = ELITE_USERS.get(user_email.lower(), None)
    
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") not in ["elite", "max"]):
        raise HTTPException(status_code=403, detail="Elite access required")
    
    return {
        "title": "BEEN SCAMMED? ASSET RECOVERY CENTER",
        "subtitle": "Elite Members Only - Complete Recovery Guide",
        "immediate_actions": [
            "STOP - Do not send any more money or information",
            "Contact your bank/credit card company immediately",
            "Change all passwords and enable 2FA on all accounts",
            "Document everything - save screenshots, emails, texts",
            "File a police report with your local law enforcement"
        ],
        "recovery_steps": [
            {
                "step": 1,
                "title": "Secure Your Accounts",
                "actions": [
                    "Change banking passwords immediately",
                    "Enable two-factor authentication everywhere",
                    "Check credit reports for unauthorized accounts",
                    "Monitor bank statements daily"
                ]
            },
            {
                "step": 2,
                "title": "Report the Scam", 
                "actions": [
                    "File complaint with FTC at reportfraud.ftc.gov",
                    "Report to FBI's IC3.gov if over $5,000 lost",
                    "Contact state attorney general's office",
                    "Report to Better Business Bureau"
                ]
            },
            {
                "step": 3,
                "title": "Financial Recovery",
                "actions": [
                    "Contact bank fraud department within 24-48 hours",
                    "Dispute charges with credit card companies",
                    "File chargeback requests immediately",
                    "Consider hiring asset recovery specialist if large amount"
                ]
            },
            {
                "step": 4,
                "title": "Document Everything",
                "actions": [
                    "Save all communication (emails, texts, calls)",
                    "Screenshot bank transactions and transfers", 
                    "Keep records of all reports filed",
                    "Maintain timeline of events"
                ]
            }
        ],
        "phone_scripts": {
            "bank_script": "Hello, I need to report fraudulent activity on my account. I was the victim of a scam and unauthorized transfers were made. I need to dispute these charges and secure my account immediately. Can you help me file a fraud claim?",
            "credit_card_script": "I need to report unauthorized charges on my card due to a scam. I want to dispute these transactions and request a chargeback. Can you walk me through the process and issue a new card?",
            "police_script": "I want to file a report for financial fraud. I was scammed out of $[AMOUNT] through [METHOD]. I have documentation of all communications and transactions. What information do you need from me?"
        },
        "important_contacts": [
            {
                "organization": "FTC Fraud Reports",
                "website": "reportfraud.ftc.gov",
                "phone": "1-877-FTC-HELP",
                "description": "Primary federal fraud reporting"
            },
            {
                "organization": "FBI Internet Crime Complaint Center",
                "website": "ic3.gov",
                "phone": "Contact local FBI field office",
                "description": "For internet-based scams over $5,000"
            },
            {
                "organization": "IRS Identity Theft Hotline",
                "website": "irs.gov/identity-theft",
                "phone": "1-800-908-4490",
                "description": "For tax-related identity theft"
            },
            {
                "organization": "Social Security Fraud Hotline",
                "website": "ssa.gov/fraudreport",
                "phone": "1-800-269-0271",
                "description": "For Social Security number misuse"
            }
        ],
        "recovery_timeline": {
            "immediate": "0-24 hours: Secure accounts, contact bank, stop all payments",
            "short_term": "1-7 days: File all reports, dispute charges, change passwords",
            "medium_term": "1-4 weeks: Follow up on disputes, work with investigators",
            "long_term": "1-6 months: Asset recovery process, legal action if needed"
        },
        "prevention_tips": [
            "Never give personal info to unsolicited callers",
            "Verify company legitimacy through independent research",
            "Be suspicious of urgent payment requests",
            "Use secure payment methods, avoid wire transfers",
            "Trust your instincts - if it feels wrong, it probably is"
        ],
        "elite_notice": "This comprehensive recovery guide is exclusive to LYLO Elite members. Share responsibly."
    }

@app.post("/scam-recovery-chat")
async def scam_recovery_chat(
    user_email: str = Form(...),
    situation: str = Form(...),
    amount_lost: str = Form(""),
    scam_type: str = Form(""),
    time_since: str = Form("")
):
    """Personalized AI recovery advice based on specific user details."""
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") not in ["elite", "max"]):
        return {"error": "Elite access required"}
    
    user_display_name = user_data.get("name") if isinstance(user_data, dict) else "User"
    
    # SPEED OPTIMIZATION: Shorter, more focused prompt
    recovery_prompt = f"""
You are a fraud recovery advisor helping {user_display_name}.
SITUATION: {situation}
AMOUNT: {amount_lost}
TYPE: {scam_type}
TIME: {time_since}

Provide specific recovery advice:
1. Immediate priorities
2. Recovery strategies 
3. Timeline
4. Who to contact first
5. Documentation needed

Be direct and actionable.
"""
    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": recovery_prompt}],
                max_tokens=600,  # Reduced for speed
                temperature=0.3
            )
            advice = response.choices[0].message.content
        else:
            advice = f"Hello {user_display_name}. Please contact your bank immediately and file a police report."
    
        return {
            "personalized_advice": advice,
            "user_name": user_display_name,
            "priority_level": "HIGH"
        }
    except Exception as e:
        return {
            "personalized_advice": "I'm having technical difficulties. Please contact your bank immediately.",
            "user_name": user_display_name
        }

# ---------------------------------------------------------
# SPEED-OPTIMIZED MAIN CHAT ROUTE (THE BRAIN)
# ---------------------------------------------------------
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
    """
    SPEED OPTIMIZED CHAT ENDPOINT - Maintains dual AI accuracy while improving performance.
    
    SPEED OPTIMIZATIONS IMPLEMENTED:
    1. Reduced memory retrieval (3 instead of 8 memories)
    2. Selective web search (only for specific triggers)
    3. Shorter conversation history (last 2 messages instead of full history)
    4. Optimized prompts (more concise)
    5. Faster TTS processing
    6. KEEPS DUAL AI SYSTEM FOR ACCURACY
    """
    
    # 1. User & Limit Setup
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data["tier"] if isinstance(user_data, dict) else "free"
    user_display_name = user_data.get("name", "User") if isinstance(user_data, dict) else "User"
    
    # Safety Shield Check
    limit = TIER_LIMITS.get(tier, 5)
    current_usage = USAGE_TRACKER[user_id]
    
    if current_usage >= limit:
        error_msg = "Usage limit reached. Upgrade to continue." if language == 'en' else "Límite alcanzado. Actualice para más."
        return {"answer": error_msg, "usage_info": {"can_send": False}}

    # Logging
    masked_email = "Unknown"
    if user_email and "@" in user_email:
        p1, p2 = user_email.split("@")
        masked_email = f"{p1[:1]}*****@{p2}"
    image_status = f"Image: YES" if file else "Image: NO"
    print(f"🎯 PROCESSING: {masked_email} (Tier: {tier}) | Persona: {persona} | {image_status}")

    # 2. Image Handling
    image_b64 = None
    if file:
        content = await file.read()
        image_b64 = process_image_for_ai(content)

    # 3. SPEED OPTIMIZATION: Reduced memory retrieval (3 instead of 8)
    memories = await retrieve_memories_from_pinecone(user_id, msg, limit=3)
    memory_context = ""
    if memories:
        memory_context = "PAST CONVERSATIONS:\n" + "\n".join([f"- {m['role'].upper()}: {m['content'][:100]}" for m in memories[:2]])
    
    # 4. SPEED OPTIMIZATION: Only last 2 messages instead of full history
    try:
        hist_list = json.loads(history)[-2:]  # Changed from -4 to -2
    except:
        hist_list = []
    history_text = "\n".join([f"{h['role'].upper()}: {h['content'][:150]}" for h in hist_list])
    
    # 5. SPEED OPTIMIZATION: More selective web search
    web_data = ""
    if any(trigger in msg.lower() for trigger in WEB_SEARCH_TRIGGERS):
        web_data = await search_web_tavily(msg, user_location)
    
    # 6. SPEED-OPTIMIZED Persona Definitions
    personas = {
        "guardian": "You are The Guardian. Protective, vigilant security expert. Focus on safety.",
        "roast": "You are The Roast Master. Witty, sarcastic, but helpful. Don't be afraid to tease the user.",
        "friend": "You are The Best Friend. Caring, supportive, warm, and casual.",
        "chef": "You are The Chef. Culinary expert. Focus on food, recipes, and cooking techniques.",
        "techie": "You are The Techie. Hardware and software expert. Use technical jargon where appropriate.",
        "lawyer": "You are The Lawyer. Formal, analytical, and risk-averse. Give legal-sounding advice.",
        
        # DISCIPLE VERSIONS
        "disciple": "You are 'The Disciple,' a wise spiritual advisor for LYLO. Use King James Bible (KJV) scripture to guide and warn users. Maintain humble, biblical tone.",
        "disciple_kjv": "You are 'The Disciple,' a wise spiritual advisor for LYLO. Use ONLY King James Bible (KJV) scripture. Maintain humble, biblical tone.",
        "disciple_esv": "You are 'The Disciple,' a wise spiritual advisor for LYLO. Use ONLY English Standard Version (ESV) scripture. Maintain humble, biblical tone.",
        
        # NEW PERSONALITIES
        "mechanic": "You are The Mechanic, an automotive expert and car enthusiast for LYLO. Use car analogies for security concepts. Be practical and knowledgeable.",
        "comedian": "You are The Comedian, a stand-up comic and entertainment expert for LYLO. Make everything funny while being helpful. Use humor and timing.",
        "storyteller": "You are The Storyteller, a master of tales and creative writing for LYLO. Weave narratives and use vivid descriptions in responses.",
        "fitness": "You are The Fitness Coach, a health and wellness expert for LYLO. Use fitness analogies for security. Be encouraging and energetic."
    }
    
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    
    # Language instruction
    lang_instruction = "YOU MUST REPLY IN SPANISH." if language == 'es' else "YOU MUST REPLY IN ENGLISH."
    
    # SPEED-OPTIMIZED Master Prompt (Shorter and more focused)
    prompt = f"""
{personas.get(persona, personas['guardian'])}
{lang_instruction}

CONTEXT:
{memory_context}

RECENT CHAT:
{history_text}

{f"CURRENT INFO: {web_data}" if web_data else ""}

USER: {user_display_name}
MESSAGE: "{msg}"
    
INSTRUCTIONS: 
- Answer based on your persona
- If image provided, analyze for scams
- Set "scam_detected" to true if scam found
- Provide confidence score (0-100)

RESPOND IN JSON: 
{{ "answer": "response", "confidence_score": 90, "scam_detected": false }}
"""

    # 7. DUAL AI MODEL EXECUTION (CRITICAL FOR ACCURACY - KEPT UNCHANGED)
    tasks = [
        call_gemini_vision(prompt, image_b64), 
        call_openai_vision(prompt, image_b64)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter valid results
    valid = [r for r in results if isinstance(r, dict) and r.get('answer')]
    
    if valid:
        # Pick the most confident answer (DUAL AI CONSENSUS)
        winner = max(valid, key=lambda x: x.get('confidence_score', 0))
        
        # Override confidence for detected scams
        if winner.get('scam_detected'):
            winner['confidence_score'] = 100
            
        print(f"🏆 Winner: {winner.get('model')} ({winner.get('confidence_score')}%)")
        
        # INCREMENT USAGE
        USAGE_TRACKER[user_id] += 1
    else:
        winner = {
            "answer": "I'm having trouble connecting. Please try again.", 
            "confidence_score": 0, 
            "model": "Offline"
        }

    # Store Conversation
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    
    # Return Response
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 0),
        "scam_detected": winner.get('scam_detected', False),
        "tier_info": {"name": f"{tier.title()} Tier"},
        "usage_info": {"can_send": True}
    }

# ---------------------------------------------------------
# STATISTICS & QUIZ ROUTES
# ---------------------------------------------------------
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    """Returns usage stats for the dashboard."""
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data["tier"] if isinstance(user_data, dict) else "free"
    display_name = user_data["name"] if isinstance(user_data, dict) else user_email.split('@')[0]
    
    convos = USER_CONVERSATIONS.get(user_id, [])
    
    limit = TIER_LIMITS.get(tier, 5)
    current_usage = USAGE_TRACKER[user_id]
    
    return {
        "tier": tier,
        "display_name": display_name,
        "conversations_today": len(convos),
        "total_conversations": len(convos),
        "has_quiz_data": user_id in QUIZ_ANSWERS,
        "usage": {
            "current": current_usage, 
            "limit": limit, 
            "percentage": (current_usage/limit)*100
        }
    }

@app.post("/quiz")
async def save_quiz(
    user_email: str = Form(...), 
    question1: str = Form(...), 
    question2: str = Form(...), 
    question3: str = Form(...), 
    question4: str = Form(...), 
    question5: str = Form(...)
):
    """Saves user preferences from the onboarding quiz."""
    user_id = create_user_id(user_email)
    
    QUIZ_ANSWERS[user_id] = {
        "concern": question1, 
        "style": question2, 
        "device": question3, 
        "interest": question4, 
        "access": question5
    }
    
    return {"status": "Quiz saved"}

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "LYLO ONLINE", "version": "15.1.0 - SPEED + ACCURACY", "message": "System Operational"}

if __name__ == "__main__":
    print("🚀 LYLO SPEED-OPTIMIZED SYSTEM INITIALIZING...")
    uvicorn.run(app, host="0.0.0.0", port=10000)
