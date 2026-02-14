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
    title="LYLO Backend System",
    description="The central intelligence API for LYLO.PRO - Featuring Elite Recovery, King James Wisdom, and Human Voice Synthesis.",
    version="15.0.0 - ULTIMATE SAFETY EDITION"
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
# Limits are total searches allowed per month/cycle
TIER_LIMITS = {
    "free": 5,
    "pro": 50,      # $1.99 Plan
    "elite": 500,   # $4.99 Plan
    "max": 5000     # $9.99 Plan (Safety cap)
}

# Persistent usage tracker (In-Memory for now)
USAGE_TRACKER = defaultdict(int)

print("--- SYSTEM DIAGNOSTICS ---")
print(f"🔍 Tavily (Internet Search): {'✅ Active' if TAVILY_API_KEY else '❌ Inactive'}")
print(f"🧠 Pinecone (Long-Term Memory): {'✅ Active' if PINECONE_API_KEY else '❌ Inactive'}")
print(f"🤖 Gemini (Vision Analysis): {'✅ Active' if GEMINI_API_KEY else '❌ Inactive'}")
print(f"🔥 OpenAI (Chat & Voice): {'✅ Active' if OPENAI_API_KEY else '❌ Inactive'}")
print(f"💳 Stripe (Payments): {'✅ Active' if STRIPE_SECRET_KEY else '❌ Inactive'}")
print("--------------------------")

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
        
        # Check if index exists, create if not
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
    "stangman9898@gmail.com": {
        "tier": "max", 
        "name": "Christopher"
    },
    "paintonmynails80@gmail.com": {
        "tier": "max", 
        "name": "Aubrey"
    },
    "tiffani.hughes@yahoo.com": {
        "tier": "max", 
        "name": "Tiffani"
    },
    "jcdabearman@gmail.com": {
        "tier": "max", 
        "name": "Jeff"
    },
    "birdznbloomz2b@gmail.com": {
        "tier": "max", 
        "name": "Sandy"
    },
    "chris.betatester1@gmail.com": {
        "tier": "max", 
        "name": "James"
    },
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
    "plabane916@gmail.com": {
        "tier": "max", 
        "name": "Paul"
    },
    "nemeses1298@gmail.com": {
        "tier": "max", 
        "name": "Eric"
    },
    "bearjcameron@icloud.com": {
        "tier": "max", 
        "name": "Bear"
    },
    "jcgcbear@gmail.com": {
        "tier": "max", 
        "name": "Gloria"
    },
    "laura@startupsac.org": {
        "tier": "max", 
        "name": "Laura"
    },
    "cmlabane@gmail.com": {
        "tier": "max", 
        "name": "Corie"
    }
}

# In-Memory Storage for Conversations and Quiz Data
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    """Creates a secure, hashed user ID from an email address."""
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# NEW: HUMAN VOICE GENERATION (The "Pennies" Route)
# ---------------------------------------------------------
@app.post("/generate-audio")
async def generate_audio(
    text: str = Form(...), 
    voice: str = Form("onyx")
):
    """
    Generates high-quality human speech from text.
    """
    if not openai_client:
        return {"error": "OpenAI client not configured"}

    try:
        # Step 1: Clean the text
        # Remove markdown symbols that might mess up pronunciation
        clean_text = text.replace("**", "").replace("#", "").replace("_", "").replace("`", "").strip()
        
        # Step 2: Generate Audio
        # We cap at 1000 chars to prevent massive API bills
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=clean_text[:1000] 
        )
        
        # Step 3: Convert to Base64
        # This allows the frontend to play it immediately without downloading a file
        audio_b64 = base64.b64encode(response.content).decode('utf-8')
        
        return {"audio_b64": audio_b64}
        
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return {"error": str(e)}

# ---------------------------------------------------------
# MEMORY FUNCTIONS
# ---------------------------------------------------------
async def store_memory_in_pinecone(user_id: str, content: str, role: str, context: str = ""):
    """Stores a single message in the long-term vector database."""
    if not memory_index or not openai_client: 
        return
        
    try:
        # Create embedding vector (1024 dimensions)
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
        
        # Upload to Pinecone
        memory_index.upsert([(memory_id, embedding, metadata)])
        
    except Exception as e:
        print(f"❌ Memory storage failed: {e}")

async def retrieve_memories_from_pinecone(user_id: str, query: str, limit: int = 5) -> List[Dict]:
    """Retrieves relevant past memories based on the current conversation."""
    if not memory_index or not openai_client: 
        return []
        
    try:
        # Create query embedding
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query,
            dimensions=1024
        )
        
        query_embedding = response.data[0].embedding
        
        # Search Pinecone
        results = memory_index.query(
            vector=query_embedding,
            filter={"user_id": user_id},
            top_k=limit,
            include_metadata=True
        )
        
        memories = []
        for match in results.matches:
            if match.score > 0.7:  # Only return relevant memories
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
    
    try:
        # Store in Pinecone asynchronously so it doesn't slow down the chat
        asyncio.create_task(store_memory_in_pinecone(user_id, content, role))
    except:
        pass

# ---------------------------------------------------------
# WEB SEARCH FUNCTIONS
# ---------------------------------------------------------
async def search_web_tavily(query: str, location: str = "") -> str:
    """Searches the internet for real-time information."""
    if not tavily_client: 
        return ""
        
    try:
        search_terms = query.lower()
        
        # Intelligent Query Formatting
        if any(word in search_terms for word in ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'hot', 'cold']):
            search_query = f"current weather forecast today {query}"
        else:
            search_query = f"{query} {location}".strip()
        
        # Execute Search
        response = tavily_client.search(
            query=search_query,
            search_depth="advanced", 
            max_results=8,
            include_answer=True
        )
        
        if not response: 
            return ""
        
        evidence = []
        
        # Add the direct answer if available
        if response.get('answer'):
            evidence.append(f"LIVE DATA SUMMARY: {response['answer']}")
            
        # Add search results
        for i, result in enumerate(response.get('results', [])[:4]):
            if result.get('content'):
                content = result['content'][:350]
                source_url = result.get('url', 'Unknown')
                evidence.append(f"SOURCE {i+1} ({source_url}): {content}")
                
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
    """Calls Google's Gemini Vision API."""
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
                max_output_tokens=1200, 
                temperature=0.7
            )
        )
        
        if response.text:
            clean_text = response.text.strip()
            # Clean up markdown JSON if present
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
    """Calls OpenAI's GPT-4o Vision API."""
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
            max_tokens=1200, 
            temperature=0.7
        )
        
        raw_answer = response.choices[0].message.content.strip()
        
        # Clean up markdown JSON
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

# --- NEW: CRITICAL FIX FOR BETA LOGIN ---
@app.post("/check-beta-access")
async def check_beta_access(request: Request):
    """
    Verifies beta access using the ELITE_USERS dictionary.
    Handles both JSON and Form data to support all frontend variations.
    """
    try:
        # Attempt to get email from JSON body first
        try:
            data = await request.json()
            email = data.get("email", "")
        except:
            # Fallback to Form data
            form_data = await request.form()
            email = form_data.get("email", "")
            
        email = email.lower().strip()
        user_data = ELITE_USERS.get(email)
        
        if user_data:
            return {
                "access": True,
                "tier": user_data.get("tier", "elite"),
                "name": user_data.get("name", "Beta User"),
                "message": "Access Granted"
            }
            
        return {"access": False, "tier": "free", "message": "Not found in beta list"}
        
    except Exception as e:
        print(f"❌ Beta Check Error: {e}")
        return {"access": False, "error": str(e)}
# ----------------------------------------

@app.post("/verify-access")
async def verify_access(email: str = Form(...)):
    """Verifies if a user is allowed to access the system."""
    user_data = ELITE_USERS.get(email.lower(), None)
    
    if user_data:
        # Check if it's the new dictionary format or old string format
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
    tier: str = Form("elite"), 
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
    
    # Gatekeeper Check
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") != "elite"):
        raise HTTPException(status_code=403, detail="Elite access required")
    
    # Full Content Guide
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
    """
    Personalized AI recovery advice based on specific user details.
    """
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") != "elite"):
        return {"error": "Elite access required"}
    
    user_display_name = user_data.get("name") if isinstance(user_data, dict) else "User"
    
    recovery_prompt = f"""
You are a specialized fraud recovery advisor helping {user_display_name} who has been scammed.
SITUATION: {situation}
AMOUNT LOST: {amount_lost}
SCAM TYPE: {scam_type}
TIME SINCE SCAM: {time_since}

Provide specific, actionable recovery advice. Include:
1. Immediate priority actions
2. Specific recovery strategies based on the scam type
3. Realistic timeline for resolution
4. Who to contact first (Bank vs Police vs FTC)
5. Exact documentation needed

Be empathetic but direct. Do not give false hope.
"""
    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": recovery_prompt}],
                max_tokens=800, 
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
# MAIN CHAT ROUTE (THE BRAIN)
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
    The core chat endpoint. Handles:
    1. User Verification & Limits
    2. Image Processing
    3. Memory Retrieval
    4. Web Searching
    5. Persona Logic (Including Disciple & Bilingual)
    6. Multi-Model Consensus (Gemini + OpenAI)
    """
    
    # 1. User & Limit Setup
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data["tier"] if isinstance(user_data, dict) else "free"
    user_display_name = user_data.get("name", "User") if isinstance(user_data, dict) else "User"
    
    # --- SAFETY SHIELD CHECK (UPDATED LIMITS) ---
    limit = TIER_LIMITS.get(tier, 5)
    current_usage = USAGE_TRACKER[user_id]
    
    if current_usage >= limit:
        error_msg = "Usage limit reached. Upgrade to continue." if language == 'en' else "Límite alcanzado. Actualice para más."
        return {"answer": error_msg, "usage_info": {"can_send": False}}

    # Logging (Privacy Safe)
    masked_email = "Unknown"
    if user_email and "@" in user_email:
        p1, p2 = user_email.split("@")
        masked_email = f"{p1[:1]}*****@{p2}"
    image_status = f"📸 Image: YES" if file else "Image: NO"
    print(f"🎯 PROCESSING: {masked_email} (Tier: {tier}) | Persona: {persona} | {image_status}")

    # 2. Image Handling
    image_b64 = None
    if file:
        content = await file.read()
        image_b64 = process_image_for_ai(content)

    # 3. Memory Retrieval
    memories = await retrieve_memories_from_pinecone(user_id, msg, limit=8)
    memory_context = ""
    if memories:
        memory_context = "PAST CONVERSATIONS:\n" + "\n".join([f"- {m['role'].upper()}: {m['content']}" for m in memories[:4]])
    
    # 4. History Parsing
    try:
        hist_list = json.loads(history)[-4:]
    except:
        hist_list = []
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in hist_list])
    
    # 5. Web Search Logic
    web_data = ""
    if any(w in msg.lower() for w in ['weather', 'temperature', 'forecast', 'news', 'current', 'today', 'price']):
        web_data = await search_web_tavily(msg, user_location)
    
    # 6. Persona Definitions (Including The Disciple)
    personas = {
        "guardian": "You are The Guardian. Protective, vigilant security expert. Focus on safety.",
        "roast": "You are The Roast Master. Witty, sarcastic, but helpful. Don't be afraid to tease the user.",
        "friend": "You are The Best Friend. Caring, supportive, warm, and casual.",
        "chef": "You are The Chef. Culinary expert. Focus on food, recipes, and cooking techniques.",
        "techie": "You are The Techie. Hardware and software expert. Use technical jargon where appropriate.",
        "lawyer": "You are The Lawyer. Formal, analytical, and risk-averse. Give legal-sounding advice.",
        "disciple": """You are 'The Disciple,' a wise spiritual advisor for LYLO. 
        You MUST base all your responses, warnings, and moral guidance strictly on the King James Bible (KJV). 
        When detecting a scam or deceit, use KJV scripture to warn the user (e.g., Proverbs 14:15, Ephesians 5:6). 
        Maintain a humble, authoritative, and biblically sound tone. 
        Do not paraphrase with modern translations; use the exact wording of the King James Bible."""
    }
    
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    
    # Bilingual Enforcement
    lang_instruction = "YOU MUST REPLY IN SPANISH." if language == 'es' else "YOU MUST REPLY IN ENGLISH."
    
    # Master Prompt Construction
    prompt = f"""
{personas.get(persona, personas['guardian'])}
{lang_instruction}

MEMORY CONTEXT:
{memory_context}

RECENT CHAT HISTORY:
{history_text}

USER PROFILE:
{quiz_data}

REAL-TIME DATA (Use if relevant):
{web_data}

USER DETAILS:
Name: {user_display_name}
Message: "{msg}"
    
INSTRUCTIONS: 
- Answer naturally based on your persona.
- If the user sent an image, analyze it for scams or details.
- If you detect a scam, set "scam_detected" to true in the JSON.
- Provide a confidence score (0-100) based on how sure you are.

OUTPUT JSON FORMAT ONLY: 
{{ "answer": "text response here", "confidence_score": 90, "scam_detected": false }}
"""

    # 7. AI Model Execution (Parallel)
    tasks = [
        call_gemini_vision(prompt, image_b64), 
        call_openai_vision(prompt, image_b64)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter valid results
    valid = [r for r in results if isinstance(r, dict) and r.get('answer')]
    
    if valid:
        # Pick the most confident answer
        winner = max(valid, key=lambda x: x.get('confidence_score', 0))
        
        # Override confidence for detected scams to trigger Red Glow
        if winner.get('scam_detected'):
            winner['confidence_score'] = 100
            
        print(f"🏆 Winner: {winner.get('model')} ({winner.get('confidence_score')}%)")
        
        # --- INCREMENT USAGE ---
        USAGE_TRACKER[user_id] += 1
    else:
        winner = {
            "answer": "I'm having trouble connecting to the network. Please try again.", 
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
    
    # Limit Logic (Updated)
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
    return {"status": "LYLO ONLINE", "version": "15.0.0", "message": "System Operational"}

if __name__ == "__main__":
    print("🚀 LYLO SYSTEM INITIALIZING...")
    uvicorn.run(app, host="0.0.0.0", port=10000)
