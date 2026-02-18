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

# Import modular intelligence data system
from intelligence_data import (
    VIBE_STYLES, VIBE_LABELS,
    PERSONA_DEFINITIONS, PERSONA_EXTENDED, PERSONA_TIERS,
    get_random_hook
)

# Load environment variables
load_dotenv()

# Initialize FastAPI App
app = FastAPI(
    title="LYLO Total Integration Backend",
    description="Proactive Digital Bodyguard & Personalized Search Engine API for LYLO.PRO",
    version="17.1.0 - GEMINI FIXED EDITION"
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

# --- TIER LIMITS (Updated for Total Integration) ---
TIER_LIMITS = {
    "free": 10,     # Increased for better UX
    "pro": 100,     # $1.99 Plan
    "elite": 1000,  # $4.99 Plan
    "max": 10000    # $9.99 Plan (Virtually unlimited)
}

# Persistent usage tracker (In-Memory for now)
USAGE_TRACKER = defaultdict(int)

print("--- LYLO MODULAR INTELLIGENCE SYSTEM ---")
print(f"🛡️ Digital Bodyguard: {'✅ Active' if OPENAI_API_KEY else '❌ Inactive'}")
print(f"🔍 Search Engine: {'✅ Active' if TAVILY_API_KEY else '❌ Inactive'}")
print(f"🧠 Intelligence Sync: {'✅ Active' if PINECONE_API_KEY else '❌ Inactive'}")
print(f"👁️ Vision Analysis: {'✅ Active' if GEMINI_API_KEY else '❌ Inactive'}")
print(f"💳 Team Expansion: {'✅ Active' if STRIPE_SECRET_KEY else '❌ Inactive'}")
print(f"🎭 Modular Personas: ✅ {len(PERSONA_DEFINITIONS)} Experts Loaded")
print(f"🎨 Communication Styles: ✅ {len(VIBE_STYLES)} Vibes Available")
print("---------------------------------------")

# Stripe Configuration
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# ---------------------------------------------------------
# CLIENT INITIALIZATION
# ---------------------------------------------------------

# Internet Search Client (Personalized Search Engine)
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Personalized Search Engine Ready")
    except Exception as e:
        print(f"❌ Search Engine Failed: {e}")

# Memory Client (Intelligence Sync)
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-intelligence-sync"
        
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing_indexes:
            print(f"⚙️ Creating Intelligence Sync Index: {index_name}")
            pc.create_index(
                name=index_name,
                dimension=1024,
                metric="cosine", 
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
        print("✅ Intelligence Sync Ready")
    except Exception as e:
        print(f"❌ Intelligence Sync Failed: {e}")

# AI Vision Clients (Threat Assessment) - FIXED GEMINI INTEGRATION
gemini_ready = False
available_gemini_models = []
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        
        # Test Gemini availability with proper model detection
        try:
            models = list(genai.list_models())
            available_gemini_models = [m.name for m in models]
            print(f"📊 Available Gemini Models: {len(available_gemini_models)} found")
            
            # Check for required models with flexible naming
            has_text_model = any('gemini-pro' in model.lower() or 'gemini-1.5' in model.lower() for model in available_gemini_models)
            has_vision_model = any('vision' in model.lower() for model in available_gemini_models)
            
            if has_text_model:
                gemini_ready = True
                print("✅ Threat Assessment (Gemini) Ready")
                if has_vision_model:
                    print("✅ Gemini Vision Support Available")
                else:
                    print("⚠️ Gemini Vision Limited - Text only")
            else:
                print("❌ No suitable Gemini models available")
                print(f"Available models: {available_gemini_models[:3]}...")
                
        except Exception as model_error:
            print(f"⚠️ Gemini model detection failed: {str(model_error)[:100]}")
            # Try basic initialization with fallback
            available_gemini_models = ['gemini-pro']
            gemini_ready = True
            print("✅ Threat Assessment (Gemini) Ready (Fallback Mode)")
            
    except Exception as e:
        print(f"❌ Gemini Threat Assessment Failed: {e}")
        gemini_ready = False

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ Digital Bodyguard (OpenAI) Ready")
    except Exception as e:
        print(f"❌ OpenAI Digital Bodyguard Failed: {e}")

# ---------------------------------------------------------
# USER DATABASE & TEAM MANAGEMENT
# ---------------------------------------------------------

# Elite Users Database - Team Access Levels
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "max", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "max", "name": "Sandy"},
    "chris.betatester1@gmail.com": {"tier": "max", "name": "James"},
    "chris.betatester2@gmail.com": {"tier": "max", "name": "Josh"},
    "chris.betatester3@gmail.com": {"tier": "max", "name": "chrissy poo"},
    "chris.betatester4@gmail.com": {"tier": "pro", "name": "chrissy poo pro"},
    "chris.betatester5@gmail.com": {"tier": "elite", "name": "chrissy poo elite"},
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

# In-Memory Storage for Intelligence Sync
USER_CONVERSATIONS = defaultdict(list)
USER_PROFILES = defaultdict(dict)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    """Creates a secure, hashed user ID from an email address."""
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# REALISTIC VOICE GENERATION (Enhanced for Proactive Speech)
# ---------------------------------------------------------
@app.post("/generate-audio")
async def generate_audio(
    text: str = Form(...), 
    voice: str = Form("onyx")
):
    """
    Generates high-quality human speech for proactive Digital Bodyguard communication.
    """
    if not openai_client:
        return {"error": "Digital Bodyguard voice system not available"}

    try:
        # Clean the text for optimal speech synthesis
        clean_text = text.replace("**", "").replace("#", "").replace("_", "").replace("`", "").strip()
        
        # Enhanced for proactive communication - longer text support
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=clean_text[:800]  # Increased for longer proactive messages
        )
        
        audio_b64 = base64.b64encode(response.content).decode('utf-8')
        return {"audio_b64": audio_b64}
        
    except Exception as e:
        print(f"❌ Digital Bodyguard Voice Error: {e}")
        return {"error": str(e)}

# ---------------------------------------------------------
# INTELLIGENCE SYNC SYSTEM (Enhanced Memory)
# ---------------------------------------------------------
async def store_intelligence_sync(user_id: str, content: str, role: str, context: str = ""):
    """Stores intelligence data for personalized learning."""
    if not memory_index or not openai_client: 
        return
        
    try:
        # Enhanced intelligence categorization
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=f"{role}: {content[:300]} | Context: {context[:200]}",
            dimensions=1024
        )
        
        embedding = response.data[0].embedding
        memory_id = f"{user_id}_{datetime.now().timestamp()}"
        
        metadata = {
            "user_id": user_id,
            "role": role,
            "content": content[:400],
            "timestamp": datetime.now().isoformat(),
            "context": context[:300],
            "intelligence_category": categorize_intelligence(content)
        }
        
        memory_index.upsert([(memory_id, embedding, metadata)])
        
    except Exception as e:
        print(f"❌ Intelligence Sync Storage Failed: {e}")

def categorize_intelligence(content: str) -> str:
    """Categorizes intelligence for better personalization."""
    content_lower = content.lower()
    
    if any(word in content_lower for word in ['car', 'engine', 'mechanic', 'repair']):
        return 'automotive'
    elif any(word in content_lower for word in ['cook', 'recipe', 'food', 'kitchen']):
        return 'culinary'
    elif any(word in content_lower for word in ['tech', 'computer', 'software', 'gadget']):
        return 'technical'
    elif any(word in content_lower for word in ['legal', 'law', 'rights', 'contract']):
        return 'legal'
    elif any(word in content_lower for word in ['fitness', 'exercise', 'health', 'workout']):
        return 'fitness'
    elif any(word in content_lower for word in ['story', 'tale', 'creative', 'writing']):
        return 'creative'
    elif any(word in content_lower for word in ['funny', 'joke', 'laugh', 'comedy']):
        return 'entertainment'
    elif any(word in content_lower for word in ['bible', 'scripture', 'spiritual', 'faith']):
        return 'spiritual'
    else:
        return 'general'

async def retrieve_intelligence_sync(user_id: str, query: str, category: str = "", limit: int = 3) -> List[Dict]:
    """Retrieves personalized intelligence for better responses."""
    if not memory_index or not openai_client: 
        return []
        
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query[:200],
            dimensions=1024
        )
        
        query_embedding = response.data[0].embedding
        
        # Enhanced filtering with category
        filter_dict = {"user_id": user_id}
        if category:
            filter_dict["intelligence_category"] = category
        
        results = memory_index.query(
            vector=query_embedding,
            filter=filter_dict,
            top_k=limit,
            include_metadata=True
        )
        
        intelligence = []
        for match in results.matches:
            if match.score > 0.75:
                intelligence.append({
                    "content": match.metadata["content"],
                    "role": match.metadata["role"],
                    "category": match.metadata.get("intelligence_category", "general"),
                    "timestamp": match.metadata["timestamp"],
                    "relevance": match.score
                })
        return intelligence
        
    except Exception as e:
        print(f"❌ Intelligence Sync Retrieval Failed: {e}")
        return []

def store_user_intelligence(user_id: str, content: str, role: str):
    """Stores user intelligence in both RAM and vector database."""
    USER_CONVERSATIONS[user_id].append({
        "role": role, 
        "content": content, 
        "timestamp": datetime.now().isoformat(),
        "category": categorize_intelligence(content)
    })
    
    # Store in intelligence sync asynchronously
    if len(content.strip()) > 20:
        try:
            asyncio.create_task(store_intelligence_sync(user_id, content, role))
        except:
            pass

# ---------------------------------------------------------
# PERSONALIZED SEARCH ENGINE
# ---------------------------------------------------------

# Expanded search triggers for personalized search
PERSONALIZED_SEARCH_TRIGGERS = [
    'weather', 'temperature', 'forecast', 'climate',
    'news', 'breaking', 'current', 'latest', 'recent', 'today',
    'price', 'cost', 'stock', 'market', 'bitcoin', 'crypto',
    'restaurant', 'food', 'dining', 'delivery',
    'local', 'nearby', 'around me', 'in my area',
    'store', 'shop', 'buy', 'purchase',
    'doctor', 'hospital', 'medical', 'health',
    'repair', 'service', 'fix', 'maintenance',
    'what is', 'how to', 'where can', 'tell me about',
    'find me', 'search for', 'look up', 'who is',
    'best', 'recommended', 'top rated', 'review'
]

async def search_personalized_web(query: str, user_location: str = "", user_preferences: dict = {}) -> str:
    """Enhanced personalized search engine for LYLO users."""
    if not tavily_client: 
        return ""
        
    try:
        search_terms = query.lower()
        
        # Intelligent personalized query formatting
        if any(word in search_terms for word in ['weather', 'temperature', 'forecast']):
            search_query = f"current weather forecast {query} {user_location}"
        elif any(word in search_terms for word in ['restaurant', 'food', 'dining']):
            cuisine_pref = user_preferences.get('cuisine', '')
            search_query = f"{query} {cuisine_pref} restaurant {user_location}"
        elif any(word in search_terms for word in ['doctor', 'hospital', 'medical']):
            search_query = f"{query} {user_location} healthcare provider"
        elif any(word in search_terms for word in ['repair', 'service', 'maintenance']):
            search_query = f"{query} service provider {user_location}"
        elif 'local' in search_terms or 'nearby' in search_terms:
            search_query = f"{query} near {user_location}"
        else:
            search_query = f"{query} {user_location}".strip()
        
        # Execute personalized search
        response = tavily_client.search(
            query=search_query,
            search_depth="advanced",
            max_results=6,  # Increased for better personalization
            include_answer=True
        )
        
        if not response: 
            return ""
        
        evidence = []
        
        if response.get('answer'):
            evidence.append(f"PERSONALIZED SEARCH RESULT: {response['answer']}")
            
        # Enhanced result processing
        for i, result in enumerate(response.get('results', [])[:3]):
            if result.get('content'):
                content = result['content'][:300]
                source_url = result.get('url', 'Unknown')
                evidence.append(f"SOURCE {i+1}: {content}")
                
        return "\n".join(evidence)
        
    except Exception as e:
        print(f"❌ Personalized Search Failed: {e}")
        return ""

# ---------------------------------------------------------
# ENHANCED VISION ANALYSIS (Threat Assessment) - GEMINI FIXED
# ---------------------------------------------------------
def process_image_for_bodyguard(image_file: bytes) -> str:
    """Enhanced image processing for threat assessment."""
    try:
        return base64.b64encode(image_file).decode('utf-8')
    except Exception as e:
        print(f"❌ Image processing failed: {e}")
        return None

def get_best_gemini_model(for_vision: bool = False) -> str:
    """Dynamically select the best available Gemini model."""
    global available_gemini_models
    
    if for_vision:
        # Try vision models first
        vision_models = [m for m in available_gemini_models if 'vision' in m.lower()]
        if vision_models:
            return vision_models[0]
        # Fallback to newest general model
        text_models = [m for m in available_gemini_models if 'gemini' in m.lower()]
        return text_models[0] if text_models else 'gemini-pro'
    else:
        # For text, prefer newer models
        if 'models/gemini-1.5-pro' in available_gemini_models:
            return 'models/gemini-1.5-pro'
        elif 'models/gemini-pro' in available_gemini_models:
            return 'models/gemini-pro'
        else:
            # Use first available model
            return available_gemini_models[0] if available_gemini_models else 'gemini-pro'

async def call_gemini_threat_assessment(prompt: str, image_b64: str = None):
    """Enhanced Gemini threat assessment with robust model selection."""
    if not gemini_ready: 
        return None
        
    try:
        # Select the best available model
        model_name = get_best_gemini_model(for_vision=bool(image_b64))
        model = genai.GenerativeModel(model_name)
        
        content_parts = [prompt]
        
        # Handle image processing with graceful fallback
        if image_b64:
            try:
                # Try PIL import conditionally
                try:
                    import PIL.Image
                    import io
                    
                    # Convert base64 to PIL Image for Gemini
                    image_data = base64.b64decode(image_b64)
                    image = PIL.Image.open(io.BytesIO(image_data))
                    content_parts.append(image)
                except ImportError:
                    print("⚠️ PIL not available for Gemini vision, using text-only analysis")
                    # Fall back to text-only analysis with image description
                    model_name = get_best_gemini_model(for_vision=False)
                    model = genai.GenerativeModel(model_name)
                    content_parts = [f"{prompt}\n\n[Note: Image was provided but cannot be processed - please analyze based on text description if available]"]
                    
            except Exception as img_error:
                print(f"⚠️ Image processing failed, using text-only: {str(img_error)[:50]}")
                model_name = get_best_gemini_model(for_vision=False)
                model = genai.GenerativeModel(model_name)
                content_parts = [prompt]
        
        # Generate response with error handling
        response = model.generate_content(
            content_parts,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1000,
                temperature=0.6
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
                    "confidence_score": parsed.get('confidence_score', 87),
                    "scam_detected": parsed.get('scam_detected', False),
                    "threat_level": parsed.get('threat_level', 'low'),
                    "model": f"Gemini Threat Assessment ({model_name})"
                }
            except:
                return {
                    "answer": clean_text,
                    "confidence_score": 89,
                    "scam_detected": False,
                    "threat_level": 'low',
                    "model": f"Gemini Threat Assessment ({model_name})"
                }
        else:
            print("⚠️ Gemini returned empty response")
            return None
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Gemini Threat Assessment Error: {error_msg}")
        
        # Log specific model errors for debugging
        if "404" in error_msg or "not found" in error_msg.lower():
            print(f"📋 Available models: {available_gemini_models[:3]}...")
        
        return None

async def call_openai_bodyguard(prompt: str, image_b64: str = None):
    """Enhanced OpenAI Digital Bodyguard analysis."""
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
            max_tokens=1000,  # Increased for more comprehensive responses
            temperature=0.6
        )
        
        raw_answer = response.choices[0].message.content.strip()
        
        if raw_answer.startswith("```"):
            raw_answer = raw_answer.split("```")[1]
            if raw_answer.startswith("json"): raw_answer = raw_answer[4:]
        
        try:
            parsed = json.loads(raw_answer)
            return {
                "answer": parsed.get('answer', raw_answer),
                "confidence_score": parsed.get('confidence_score', 85),
                "scam_detected": parsed.get('scam_detected', False),
                "threat_level": parsed.get('threat_level', 'low'),
                "model": "OpenAI Digital Bodyguard"
            }
        except:
            return {
                "answer": raw_answer,
                "confidence_score": 86,
                "scam_detected": False,
                "threat_level": 'low',
                "model": "OpenAI Digital Bodyguard"
            }
    except Exception as e:
        print(f"❌ OpenAI Digital Bodyguard Error: {e}")
        return None

# ---------------------------------------------------------
# ACCESS CONTROL & TEAM MANAGEMENT
# ---------------------------------------------------------

@app.post("/check-beta-access")
async def check_beta_access(request: Request):
    """Enhanced team access verification."""
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
                "name": user_data.get("name", "Team Member"),
                "message": "Digital Bodyguard Team Access Granted"
            }
            
        return {"access": False, "tier": "free", "message": "Basic protection available"}
        
    except Exception as e:
        print(f"❌ Team Access Check Error: {e}")
        return {"access": False, "error": str(e)}

@app.post("/verify-access")
async def verify_access(email: str = Form(...)):
    """Verifies team access levels."""
    user_data = ELITE_USERS.get(email.lower(), None)
    
    if user_data:
        if isinstance(user_data, dict):
            return {
                "access_granted": True, 
                "tier": user_data["tier"], 
                "user_name": user_data["name"], 
                "is_beta": True,
                "team_size": get_team_size(user_data["tier"])
            }
        return {
            "access_granted": True, 
            "tier": user_data, 
            "user_name": email.split('@')[0], 
            "is_beta": True,
            "team_size": get_team_size(user_data)
        }
        
    return {
        "access_granted": False, 
        "message": "Basic protection available", 
        "tier": "free", 
        "user_name": "Protected User", 
        "is_beta": False,
        "team_size": 1
    }

def get_team_size(tier: str) -> int:
    """Returns the number of experts available for each tier."""
    team_sizes = {
        "free": 1,    # Guardian only
        "pro": 4,     # Guardian + 3 specialists
        "elite": 6,   # Guardian + 5 specialists  
        "max": 10     # Full expert team
    }
    return team_sizes.get(tier, 1)

# ---------------------------------------------------------
# MODULAR COMMUNICATION STYLES ENDPOINT
# ---------------------------------------------------------
@app.get("/communication-styles")
async def get_communication_styles():
    """Returns available communication styles for frontend."""
    return {
        "styles": [
            {"id": vibe_id, "label": VIBE_LABELS[vibe_id]} 
            for vibe_id in VIBE_STYLES.keys()
        ]
    }

# ---------------------------------------------------------
# ENHANCED SCAM RECOVERY SYSTEM
# ---------------------------------------------------------
@app.get("/scam-recovery/{user_email}")
async def get_scam_recovery_info(user_email: str):
    """Enhanced scam recovery with proactive guidance."""
    user_data = ELITE_USERS.get(user_email.lower(), None)
    
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") not in ["elite", "max"]):
        raise HTTPException(status_code=403, detail="Elite team access required")
    
    return {
        "title": "🛡️ DIGITAL BODYGUARD RECOVERY CENTER",
        "subtitle": "Elite Team Protection - Complete Recovery Protocol",
        "immediate_actions": [
            "STOP - Cease all financial transactions immediately",
            "Contact your bank's fraud department within 30 minutes",
            "Change all passwords and enable 2FA everywhere",
            "Document everything - screenshots, emails, call logs",
            "File police report with all evidence collected"
        ],
        "recovery_steps": [
            {
                "step": 1,
                "title": "Secure Digital Perimeter",
                "actions": [
                    "Change banking passwords and PINs immediately",
                    "Enable two-factor authentication on all accounts",
                    "Run credit report check for unauthorized accounts",
                    "Monitor all bank and credit card statements hourly"
                ]
            },
            {
                "step": 2,
                "title": "Deploy Legal Shield", 
                "actions": [
                    "File complaint with FTC at reportfraud.ftc.gov",
                    "Report to FBI's IC3.gov if losses exceed $5,000",
                    "Contact your state attorney general's consumer protection division",
                    "Submit report to Better Business Bureau with full documentation"
                ]
            },
            {
                "step": 3,
                "title": "Financial Recovery Protocol",
                "actions": [
                    "Contact bank fraud department within 24 hours maximum",
                    "Dispute all fraudulent charges with credit card companies",
                    "File chargeback requests for unauthorized transactions",
                    "Consider hiring asset recovery specialist for large losses"
                ]
            },
            {
                "step": 4,
                "title": "Intelligence Documentation",
                "actions": [
                    "Preserve all communication evidence (emails, texts, recordings)",
                    "Screenshot all fraudulent transactions and transfers", 
                    "Maintain detailed records of all reports filed",
                    "Create comprehensive timeline of all scam events"
                ]
            }
        ],
        "phone_scripts": {
            "bank_script": "This is a fraud emergency. I need to report unauthorized access to my account. A scammer has compromised my security and made fraudulent transfers. I need immediate account freeze and fraud investigation. Can you connect me to your fraud specialist now?",
            "credit_card_script": "I'm reporting credit card fraud immediately. Unauthorized charges have been made due to a scammer's actions. I need to dispute these transactions, request chargebacks, and get a replacement card with new numbers issued today.",
            "police_script": "I need to file a fraud report for financial crimes. I've been targeted by scammers who stole $[AMOUNT] through [METHOD]. I have complete documentation including communications, transaction records, and evidence. What's your case number and detective assignment?"
        },
        "enhanced_contacts": [
            {
                "organization": "FTC Consumer Sentinel",
                "website": "reportfraud.ftc.gov",
                "phone": "1-877-FTC-HELP (1-877-382-4357)",
                "description": "Primary federal fraud reporting - file within 24 hours"
            },
            {
                "organization": "FBI Internet Crime Complaint Center",
                "website": "ic3.gov",
                "phone": "Contact your local FBI field office immediately",
                "description": "Required for internet-based scams over $5,000"
            },
            {
                "organization": "AARP Fraud Watch Network",
                "website": "aarp.org/fraudwatch",
                "phone": "1-877-908-3360",
                "description": "Specialized support for seniors and vulnerable adults"
            },
            {
                "organization": "Identity Theft Resource Center",
                "website": "idtheftcenter.org",
                "phone": "1-888-400-5530",
                "description": "Free identity theft recovery services"
            }
        ],
        "recovery_timeline": {
            "immediate": "0-1 hour: Stop payments, secure accounts, contact bank",
            "urgent": "1-24 hours: File all reports, dispute charges, gather evidence",
            "short_term": "1-7 days: Follow up on disputes, work with investigators",
            "medium_term": "1-4 weeks: Asset recovery process, legal documentation",
            "long_term": "1-6 months: Final resolution, preventive measures implementation"
        },
        "prevention_protocol": [
            "Never provide personal information to unsolicited contacts",
            "Independently verify company legitimacy through official channels",
            "Be immediately suspicious of any urgent payment requests",
            "Use only secure, traceable payment methods - never wire transfers",
            "Trust your Digital Bodyguard instincts - if LYLO flags it, stop immediately"
        ],
        "elite_notice": "This enhanced recovery protocol is exclusive to LYLO Elite team members. Your Digital Bodyguard team is standing by for additional support."
    }

# ---------------------------------------------------------
# MAIN DIGITAL BODYGUARD CHAT SYSTEM - MODULAR REFACTOR
# ---------------------------------------------------------
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form(""),
    vibe: str = Form("standard"),  # Communication style parameter
    file: UploadFile = File(None),
    language: str = Form("en")
):
    """
    Enhanced Digital Bodyguard Chat System with Modular Intelligence
    """
    
    # 1. User & Team Setup
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data["tier"] if isinstance(user_data, dict) else "free"
    user_display_name = user_data.get("name", "User") if isinstance(user_data, dict) else "User"
    
    # Usage tracking
    limit = TIER_LIMITS.get(tier, 10)
    current_usage = USAGE_TRACKER[user_id]
    
    if current_usage >= limit:
        error_msg = "Daily protection limit reached. Expand your team to continue." if language == 'en' else "Límite de protección alcanzado. Expande tu equipo."
        return {"answer": error_msg, "usage_info": {"can_send": False}}

    # Logging
    masked_email = "Unknown"
    if user_email and "@" in user_email:
        p1, p2 = user_email.split("@")
        masked_email = f"{p1[:1]}***@{p2}"
    
    print(f"🛡️ MODULAR BODYGUARD: {masked_email} | Expert: {persona.upper()} | Style: {vibe.upper()}")

    # 2. Image Processing
    image_b64 = None
    if file:
        content = await file.read()
        image_b64 = process_image_for_bodyguard(content)

    # 3. Intelligence Sync Retrieval
    intelligence_category = categorize_intelligence(msg)
    intelligence = await retrieve_intelligence_sync(user_id, msg, intelligence_category, limit=3)
    
    intelligence_context = ""
    if intelligence:
        intelligence_context = f"USER INTELLIGENCE (Past Memories):\n" + "\n".join([
            f"- {intel['role'].upper()}: {intel['content'][:150]}" 
            for intel in intelligence[:2]
        ])
    
    # 4. History Processing  
    try:
        hist_list = json.loads(history)[-3:]
    except:
        hist_list = []
    history_text = "\n".join([f"{h['role'].upper()}: {h['content'][:200]}" for h in hist_list])
    
    # 5. Personalized Search
    search_data = ""
    if any(trigger in msg.lower() for trigger in PERSONALIZED_SEARCH_TRIGGERS):
        user_preferences = USER_PROFILES.get(user_id, {})
        search_data = await search_personalized_web(msg, user_location, user_preferences)
    
    # 6. MODULAR PERSONA & VIBE SYSTEM (FIXED: Personality Overlap Removed)
    persona_definition = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS['guardian'])
    persona_extended = PERSONA_EXTENDED.get(persona, PERSONA_EXTENDED['guardian'])
    vibe_instruction = VIBE_STYLES.get(vibe, "")
    random_hook = get_random_hook(persona)
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    lang_instruction = f"YOU MUST REPLY IN SPANISH to {user_display_name}." if language == 'es' else f"YOU MUST REPLY IN ENGLISH to {user_display_name}."
    
    # MODULAR MASTER PROMPT CONSTRUCTION - Pure personality vessel
    prompt = f"""
{persona_definition} 
{persona_extended}

{lang_instruction}

STYLE OVERRIDE:
{vibe_instruction}

START YOUR RESPONSE WITH THIS UNIQUE HOOK:
"{random_hook}"

INTELLIGENCE SYNC (Past Memories):
{intelligence_context}

USER PROFILE:
{quiz_data}

CURRENT SITUATION:
USER: {user_display_name}
MESSAGE: "{msg}"
SEARCH_DATA: {search_data}
    
STRICT OPERATING DIRECTIVE:
- Speak ONLY as the identity defined above. 
- Use the provided Hook once at the very beginning.
- DO NOT mention being a 'Digital Bodyguard' or 'Security Team' unless it is part of your specific persona definition.
- If you detect a scam, handle it naturally in your own voice, do not switch to a generic security script.
- Address {user_display_name} by name naturally.

OUTPUT JSON FORMAT ONLY: 
{{ "answer": "your unique response", "confidence_score": 90, "scam_detected": false, "threat_level": "low" }}
"""

    # 7. AI Threat Assessment
    tasks = [
        call_gemini_threat_assessment(prompt, image_b64), 
        call_openai_bodyguard(prompt, image_b64)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    valid = []
    for result in results:
        if isinstance(result, dict) and result.get('answer'):
            valid.append(result)
    
    if valid:
        winner = max(valid, key=lambda x: (
            x.get('confidence_score', 0) + 
            (20 if x.get('scam_detected', False) else 0) +
            (10 if x.get('threat_level', 'low') == 'high' else 0)
        ))
        if winner.get('scam_detected') or winner.get('threat_level') == 'high':
            winner['confidence_score'] = 100
        USAGE_TRACKER[user_id] += 1
    else:
        winner = {
            "answer": f"{random_hook} I'm having trouble with my voice today, {user_display_name}. What was that again?", 
            "confidence_score": 50,
            "threat_level": "unknown",
            "model": "Fallback Mode",
            "scam_detected": False
        }

    store_user_intelligence(user_id, msg, "user")
    store_user_intelligence(user_id, winner['answer'], "bot")
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 0),
        "scam_detected": winner.get('scam_detected', False),
        "threat_level": winner.get('threat_level', 'low'),
        "bodyguard_model": winner.get('model', 'Unknown'),
        "persona_hook": random_hook,
        "communication_style": vibe,
        "usage_info": {"can_send": True}
    }

# ---------------------------------------------------------
# STATS & INTELLIGENCE TRACKING
# ---------------------------------------------------------
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {})
    tier = user_data["tier"] if isinstance(user_data, dict) else "free"
    display_name = user_data["name"] if isinstance(user_data, dict) else user_email.split('@')[0]
    convos = USER_CONVERSATIONS.get(user_id, [])
    limit = TIER_LIMITS.get(tier, 10)
    current_usage = USAGE_TRACKER[user_id]
    
    return {
        "tier": tier,
        "display_name": display_name,
        "team_size": get_team_size(tier),
        "total_conversations": len(convos),
        "usage": {"current": current_usage, "limit": limit}
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
    user_id = create_user_id(user_email)
    QUIZ_ANSWERS[user_id] = {"concern": question1, "style": question2, "device": question3, "interest": question4, "access": question5}
    USER_PROFILES[user_id].update({"primary_concern": question1, "communication_style": question2})
    return {"status": "Updated"}

@app.get("/")
async def root():
    return {"status": "LYLO MODULAR INTELLIGENCE SYSTEM ONLINE", "version": "17.1.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
