import os
import uvicorn
import json
import hashlib
import asyncio
import base64
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

app = FastAPI(title="LYLO Backend", version="9.5.0 - CUSTOM NAMES")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API KEYS
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY") 
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

print(f"🔍 Tavily (Internet): {bool(TAVILY_API_KEY)}")
print(f"🧠 Pinecone (Memory): {bool(PINECONE_API_KEY)}")
print(f"🤖 Gemini (Vision): {bool(GEMINI_API_KEY)}")
print(f"🔥 OpenAI (Vision): {bool(OPENAI_API_KEY)}")

# INTERNET SEARCH CLIENT (REAL WEATHER)
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Internet Search Ready - Real weather enabled")
    except Exception as e:
        print(f"❌ Internet Search Failed: {e}")

# MEMORY CLIENT  
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

# USER MANAGEMENT WITH CUSTOM NAMES
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "elite", "name": "Christopher"},
    "paintonmynails80@gmail.com": {"tier": "elite", "name": "Aubrey"},
    "Tiffani.hughes@yahoo.com": {"tier": "elite", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "elite", "name": "Jeff"},
    "jcgcbear@gmail.com": {"tier": "elite", "name": "Gloria"},
    "Cmlabane@gmail.com": {"tier": "elite", "name": "Corie"}
}

# Build BETA_TESTERS from ELITE_USERS for compatibility
BETA_TESTERS = {}
for email, data in ELITE_USERS.items():
    if isinstance(data, dict):
        BETA_TESTERS[email] = data["tier"]
    else:
        BETA_TESTERS[email] = data  # Backward compatibility

USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# MEMORY FUNCTIONS
async def store_memory_in_pinecone(user_id: str, content: str, role: str, context: str = ""):
    if not memory_index or not openai_client:
        return
    
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=f"{role}: {content} | Context: {context}"
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
        print(f"💾 Memory stored: {role} - {content[:30]}...")
        
    except Exception as e:
        print(f"❌ Memory storage failed: {e}")

async def retrieve_memories_from_pinecone(user_id: str, query: str, limit: int = 5) -> List[Dict]:
    if not memory_index or not openai_client:
        return []
    
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query
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
        
        print(f"🧠 Retrieved {len(memories)} memories")
        return memories
        
    except Exception as e:
        print(f"❌ Memory retrieval failed: {e}")
        return []

def store_user_memory(user_id: str, content: str, role: str):
    USER_CONVERSATIONS[user_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })
    
    try:
        asyncio.create_task(store_memory_in_pinecone(user_id, content, role))
    except:
        pass

# REAL INTERNET SEARCH FOR WEATHER
async def search_web_tavily(query: str, location: str = "") -> str:
    if not tavily_client:
        print("❌ No internet connection available")
        return ""
    
    try:
        # SMART WEATHER QUERIES
        search_terms = query.lower()
        if any(word in search_terms for word in ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'hot', 'cold']):
            search_query = f"current weather forecast today {query}"
        else:
            search_query = f"{query} {location}".strip()
        
        print(f"🌐 REAL INTERNET SEARCH: '{search_query}'")
        
        response = tavily_client.search(
            query=search_query,
            search_depth="advanced", 
            max_results=8,
            include_answer=True,
            include_domains=None,
            exclude_domains=None
        )
        
        if not response:
            print("❌ No internet response")
            return ""
        
        evidence = []
        
        # Get direct answer (usually most accurate)
        if response.get('answer'):
            evidence.append(f"LIVE DATA: {response['answer']}")
            print("✅ Got live internet data")
        
        # Get additional sources
        for i, result in enumerate(response.get('results', [])[:4]):
            if result.get('content'):
                content = result['content'][:350]
                source_url = result.get('url', 'Unknown')
                evidence.append(f"SOURCE {i+1} ({source_url}): {content}")
        
        final_evidence = "\n".join(evidence)
        print(f"✅ Internet search complete - {len(evidence)} sources")
        return final_evidence
        
    except Exception as e:
        print(f"❌ Internet search failed: {e}")
        return ""

# IMAGE PROCESSING (NO PIL NEEDED)
def process_image_for_ai(image_file: bytes) -> str:
    try:
        return base64.b64encode(image_file).decode('utf-8')
    except Exception as e:
        print(f"❌ Image processing failed: {e}")
        return None

# CLEAN AI RESPONSES (NO RAW JSON)
async def call_gemini_vision(prompt: str, image_b64: str = None):
    if not gemini_ready:
        return None
    
    models = ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest']
    
    for model_name in models:
        try:
            print(f"🤖 Trying Gemini: {model_name}")
            
            model = genai.GenerativeModel(model_name)
            content_parts = [prompt]
            
            if image_b64:
                content_parts.append({
                    'mime_type': 'image/jpeg',
                    'data': image_b64
                })
            
            response = model.generate_content(
                content_parts,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=1200,
                    temperature=0.7
                )
            )
            
            if response and response.text:
                raw_text = response.text.strip()
                
                # CLEAN RESPONSE - NO JSON FORMATTING
                clean_answer = raw_text
                if raw_text.startswith('{') and raw_text.endswith('}'):
                    try:
                        parsed = json.loads(raw_text)
                        if parsed.get('answer'):
                            clean_answer = parsed['answer']
                    except:
                        pass
                
                return {
                    "answer": clean_answer,
                    "confidence_score": 90 if image_b64 else 85,
                    "scam_detected": False,
                    "model": f"Gemini ({model_name})"
                }
                
        except Exception as e:
            print(f"❌ Gemini {model_name} failed: {e}")
            continue
    
    return None

async def call_openai_vision(prompt: str, image_b64: str = None):
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
        
        # CLEAN RESPONSE - NO JSON FORMATTING
        clean_answer = raw_answer
        if raw_answer.startswith('{') and raw_answer.endswith('}'):
            try:
                parsed = json.loads(raw_answer)
                if parsed.get('answer'):
                    clean_answer = parsed['answer']
            except:
                pass
        
        return {
            "answer": clean_answer,
            "confidence_score": 88 if image_b64 else 83,
            "scam_detected": False,
            "model": "OpenAI (GPT-4o-mini)"
        }
        
    except Exception as e:
        print(f"❌ OpenAI failed: {e}")
        return None

# ACCESS CONTROL WITH CUSTOM NAMES
@app.post("/verify-access")
async def verify_access(email: str = Form(...)):
    user_email = email.lower()
    user_data = ELITE_USERS.get(user_email, None)
    
    if user_data:
        # Handle both old format (string) and new format (dict)
        if isinstance(user_data, dict):
            tier = user_data["tier"]
            display_name = user_data["name"]
        else:
            tier = user_data
            display_name = "Christopher" if "stangman" in user_email else user_email.split('@')[0]
        
        return {
            "access_granted": True,
            "tier": tier,
            "user_name": display_name,
            "is_beta": True
        }
    else:
        return {
            "access_granted": False,
            "message": "Join our beta waitlist at mylylo.pro",
            "tier": "none",
            "user_name": user_email.split('@')[0],
            "is_beta": False
        }

@app.post("/admin/add-beta-tester")
async def add_beta_tester(
    admin_email: str = Form(...), 
    new_email: str = Form(...), 
    tier: str = Form("elite"),
    name: str = Form("")
):
    if admin_email.lower() != "stangman9898@gmail.com":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Determine display name
    if name:
        display_name = name
    else:
        display_name = new_email.split('@')[0]
    
    # Add to ELITE_USERS with name
    ELITE_USERS[new_email.lower()] = {"tier": tier, "name": display_name}
    BETA_TESTERS[new_email.lower()] = tier
    
    print(f"✅ Beta tester added: {new_email} -> {display_name} ({tier})")
    
    return {
        "status": "success", 
        "message": f"Added {display_name} ({new_email}) as {tier} beta tester"
    }

@app.get("/admin/list-beta-testers/{admin_email}")
async def list_beta_testers(admin_email: str):
    if admin_email.lower() != "stangman9898@gmail.com":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    formatted_testers = {}
    for email, data in ELITE_USERS.items():
        if isinstance(data, dict):
            formatted_testers[email] = f"{data['name']} ({data['tier']})"
        else:
            formatted_testers[email] = f"{email.split('@')[0]} ({data})"
    
    return {
        "beta_testers": formatted_testers, 
        "total": len(ELITE_USERS)
    }

@app.delete("/admin/remove-beta-tester")
async def remove_beta_tester(admin_email: str = Form(...), remove_email: str = Form(...)):
    if admin_email.lower() != "stangman9898@gmail.com":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if remove_email.lower() in ELITE_USERS:
        user_info = ELITE_USERS[remove_email.lower()]
        del ELITE_USERS[remove_email.lower()]
        del BETA_TESTERS[remove_email.lower()]
        
        display_name = user_info["name"] if isinstance(user_info, dict) else remove_email.split('@')[0]
        return {"status": "success", "message": f"Removed {display_name} ({remove_email})"}
    
    return {"status": "error", "message": "Beta tester not found"}

@app.post("/check-beta-access")
async def check_beta_access(email: str = Form(...)):
    user_data = ELITE_USERS.get(email.lower(), None)
    
    if user_data:
        if isinstance(user_data, dict):
            tier = user_data["tier"]
            display_name = user_data["name"]
        else:
            tier = user_data
            display_name = email.split('@')[0]
        
        return {
            "email": email,
            "tier": tier,
            "display_name": display_name,
            "is_beta_tester": True,
            "has_elite_access": tier == "elite"
        }
    
    return {
        "email": email,
        "tier": "free",
        "display_name": email.split('@')[0],
        "is_beta_tester": False,
        "has_elite_access": False
    }

# MAIN CHAT WITH INTERNET & MEMORY
@app.post("/chat")
async def chat(
    msg: str = Form(...),
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    user_email: str = Form(...),
    user_location: str = Form(""),
    file: UploadFile = File(None)
):
    # CHECK ACCESS WITH CUSTOM NAMES
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data:
        return {
            "answer": "Beta access required. Join waitlist at mylylo.pro",
            "confidence_score": 100,
            "scam_detected": False,
            "confidence_explanation": "Access control active",
            "scam_indicators": [],
            "detailed_analysis": "User not authorized",
            "web_search_used": False,
            "personalization_active": False,
            "tier_info": {"name": "No Access"},
            "usage_info": {"can_send": False, "current_tier": "none"}
        }

    # Get tier from user data
    if isinstance(user_data, dict):
        tier = user_data["tier"]
        user_display_name = user_data["name"]
    else:
        tier = user_data
        user_display_name = "Christopher" if "stangman" in user_email else user_email.split('@')[0]
    
    user_id = create_user_id(user_email)
    print(f"🚀 CHAT: {msg[:50]}... from {user_display_name} ({tier})")
    
    # PROCESS IMAGE
    image_b64 = None
    if file and file.filename:
        try:
            image_data = await file.read()
            image_b64 = process_image_for_ai(image_data)
            print("📸 Image ready for AI analysis")
        except Exception as e:
            print(f"❌ Image failed: {e}")
    
    # GET MEMORIES
    memories = await retrieve_memories_from_pinecone(user_id, msg, limit=8)
    memory_context = ""
    if memories:
        memory_context = "PAST CONVERSATIONS:\n"
        for mem in memories[:4]:
            memory_context += f"- {mem['role'].upper()}: {mem['content']}\n"
    
    # GET RECENT HISTORY
    try:
        recent_history = json.loads(history)[-4:]
    except:
        recent_history = []
    
    history_text = ""
    if recent_history:
        history_text = "RECENT CHAT:\n"
        for h in recent_history:
            history_text += f"{h['role'].upper()}: {h['content']}\n"
    
    # REAL INTERNET SEARCH
    web_data = ""
    if any(word in msg.lower() for word in ['weather', 'temperature', 'forecast', 'news', 'current', 'today', 'price', 'what is', 'who is']):
        print("🌐 Triggering internet search...")
        web_data = await search_web_tavily(msg, user_location)
        if web_data:
            print("✅ Got real-time internet data")
    
    # PERSONALITY PROMPTS
    personas = {
        "guardian": "You are The Guardian. Protective, vigilant, security-focused.",
        "roast": "You are The Roast Master. Witty, sarcastic, but helpful.",
        "friend": "You are The Best Friend. Caring, supportive, casual.",
        "chef": "You are The Chef. Food-focused, warm, use cooking metaphors.",
        "techie": "You are The Techie. Technical, detailed, nerdy explanations.",
        "lawyer": "You are The Lawyer. Formal, cautious, legally precise."
    }
    
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    
    # CLEAN PROMPT - NO JSON REQUESTED
    prompt = f"""
{personas.get(persona, personas['guardian'])}

🧠 MEMORY: You remember past conversations with {user_display_name} and learn from them.
🌐 INTERNET: You have access to real-time internet data.

{memory_context}
{history_text}

USER PROFILE: {quiz_data}
REAL-TIME DATA: {web_data}

{user_display_name}: "{msg}"

RESPOND NATURALLY as the persona. Use memories and internet data to give accurate, helpful answers. Speak conversationally - no technical formatting.
"""
    
    # BATTLE OF AIS
    print("⚔️ AI Battle starting...")
    
    if image_b64:
        tasks = [call_gemini_vision(prompt, image_b64), call_openai_vision(prompt, image_b64)]
    else:
        tasks = [call_gemini_vision(prompt), call_openai_vision(prompt)]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # FIND WINNER
    valid_results = [r for r in results if isinstance(r, dict) and r.get('answer')]
    
    if valid_results:
        winner = max(valid_results, key=lambda x: x.get('confidence_score', 0))
        print(f"🏆 Winner: {winner.get('model')} ({winner.get('confidence_score')}%)")
    else:
        winner = {
            "answer": f"I'm having technical difficulties, but I'm here to help you {user_display_name}!",
            "confidence_score": 60,
            "scam_detected": False,
            "model": "Emergency Backup"
        }
        print("🚨 All AIs failed - emergency backup")
    
    # STORE MEMORIES
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 60),
        "confidence_explanation": f"AI analysis using {winner.get('model', 'AI system')}",
        "scam_detected": winner.get('scam_detected', False),
        "scam_indicators": [],
        "detailed_analysis": "Memory and internet systems active",
        "web_search_used": bool(web_data),
        "personalization_active": bool(quiz_data or memories),
        "tier_info": {"name": f"{tier.title()} Tier"},
        "usage_info": {"can_send": True, "current_tier": tier}
    }

# USER STATS WITH CUSTOM NAMES
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), None)
    
    if user_data and isinstance(user_data, dict):
        tier = user_data["tier"]
        display_name = user_data["name"]
    elif user_data:
        tier = user_data
        display_name = "Christopher" if "stangman" in user_email.lower() else user_email.split('@')[0]
    else:
        tier = "free"
        display_name = user_email.split('@')[0]
    
    conversations = USER_CONVERSATIONS.get(user_id, [])
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    
    limit = 100 if tier == "elite" else 10
    current_usage = len(conversations)
    usage_percentage = min(100, (current_usage / limit) * 100) if limit > 0 else 0
    
    today = datetime.now().strftime("%Y-%m-%d")
    conversations_today = len([c for c in conversations if c.get('timestamp', '').startswith(today)])
    
    return {
        "tier": tier,
        "display_name": display_name,
        "conversations_today": conversations_today,
        "total_conversations": len(conversations),
        "has_quiz_data": user_id in QUIZ_ANSWERS,
        "memory_entries": len(conversations),
        "usage": {"current": current_usage, "limit": limit, "percentage": usage_percentage},
        "learning_profile": {
            "interests": quiz_data.get("interest", "General").split(",") if quiz_data.get("interest") else ["General"],
            "top_concern": quiz_data.get("concern", "None")
        }
    }

# QUIZ SAVE
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
    QUIZ_ANSWERS[user_id] = {
        "concern": question1,
        "style": question2,
        "device": question3,
        "interest": question4,
        "access": question5
    }
    return {"status": "Quiz saved successfully"}

# ELITE SCAM RECOVERY CENTER
@app.get("/scam-recovery/{user_email}")
async def get_scam_recovery_info(user_email: str):
    # Check if user is elite
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") != "elite"):
        raise HTTPException(status_code=403, detail="Elite access required")
    
    recovery_guide = {
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
    
    return recovery_guide

@app.post("/scam-recovery-chat")
async def scam_recovery_chat(
    user_email: str = Form(...),
    situation: str = Form(...),
    amount_lost: str = Form(""),
    scam_type: str = Form(""),
    time_since: str = Form("")
):
    # Check if user is elite
    user_data = ELITE_USERS.get(user_email.lower(), None)
    if not user_data or (isinstance(user_data, dict) and user_data.get("tier") != "elite"):
        return {"error": "Elite access required for personalized recovery assistance"}
    
    # Get personalized recovery advice
    user_display_name = user_data.get("name") if isinstance(user_data, dict) else "User"
    
    recovery_prompt = f"""
You are a specialized fraud recovery advisor helping {user_display_name} who has been scammed.

SITUATION: {situation}
AMOUNT LOST: {amount_lost}
SCAM TYPE: {scam_type}
TIME SINCE SCAM: {time_since}

Provide specific, actionable recovery advice based on their situation. Include:
1. Immediate priority actions
2. Specific recovery strategies for this scam type
3. Realistic timeline expectations
4. Who to contact first
5. Documentation needed

Be empathetic but direct. Focus on practical steps they can take TODAY.
"""
    
    # Use AI to generate personalized advice
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
            advice = f"Hello {user_display_name}, I understand you've been through a difficult situation. Based on what you've shared, here are your immediate next steps: 1) Contact your financial institution within 24 hours, 2) File reports with FTC and local police, 3) Document all evidence, 4) Consider professional asset recovery if the amount is substantial."
    
        return {
            "personalized_advice": advice,
            "user_name": user_display_name,
            "priority_level": "HIGH" if any(keyword in scam_type.lower() for keyword in ["wire", "crypto", "investment"]) else "MEDIUM"
        }
    
    except Exception as e:
        return {
            "personalized_advice": f"I'm having technical difficulties, but {user_display_name}, your situation is important. Please immediately contact your bank and file a police report. Use the recovery guide for detailed steps.",
            "user_name": user_display_name,
            "priority_level": "HIGH"
        }

# STATUS CHECK
@app.get("/")
async def root():
    return {
        "status": "LYLO BETA READY - SCAM RECOVERY",
        "version": "9.6.0",
        "systems": {
            "internet_search": "✅ Ready" if tavily_client else "❌ Offline",
            "memory_system": "✅ Ready" if memory_index else "❌ Offline",
            "gemini_vision": "✅ Ready" if gemini_ready else "❌ Offline",
            "openai_vision": "✅ Ready" if openai_client else "❌ Offline",
            "scam_recovery": "✅ Elite Only"
        },
        "beta_testers": len(ELITE_USERS),
        "features": ["🌐 Real Internet", "🧠 Memory", "👁️ Vision", "🔒 Access Control", "👤 Custom Names", "🚨 Scam Recovery"]
    }

if __name__ == "__main__":
    print("🚀 LYLO BETA SYSTEM STARTING")
    print("🌐 Real internet weather: ENABLED")
    print("🧠 Memory system: ENABLED") 
    print("👁️ Vision analysis: ENABLED")
    print("🔒 Access control: ENABLED")
    print("👤 Custom names: ENABLED")
    print("✅ BETA READY!")
    uvicorn.run(app, host="0.0.0.0", port=10000)
