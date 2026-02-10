import os
import uvicorn
import json
import hashlib
import asyncio
import base64
from io import BytesIO
from PIL import Image
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

app = FastAPI(title="LYLO Backend", version="9.3.0 - MEMORY ENABLED")

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
        print("✅ Gemini Vision Configured")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Vision Ready")
    except Exception as e:
        print(f"⚠️ OpenAI Error: {e}")

# BETA TESTER MANAGEMENT
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
}

BETA_TESTERS = ELITE_USERS.copy()
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# FIXED: PINECONE MEMORY FUNCTIONS
async def store_memory_in_pinecone(user_id: str, content: str, role: str, conversation_context: str = ""):
    """Store conversation in Pinecone for long-term memory"""
    if not memory_index:
        print("❌ Pinecone not available for memory storage")
        return
    
    try:
        # Create embedding using OpenAI
        if not openai_client:
            print("❌ OpenAI not available for embeddings")
            return
            
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=f"{role}: {content} | Context: {conversation_context}"
        )
        
        embedding = response.data[0].embedding
        
        # Store in Pinecone with metadata
        memory_id = f"{user_id}_{datetime.now().timestamp()}"
        
        metadata = {
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "context": conversation_context[:500]  # Limit context size
        }
        
        memory_index.upsert([(memory_id, embedding, metadata)])
        print(f"✅ Memory stored in Pinecone: {role} - {content[:50]}...")
        
    except Exception as e:
        print(f"❌ Failed to store memory in Pinecone: {e}")

async def retrieve_memories_from_pinecone(user_id: str, query: str, limit: int = 5) -> List[Dict]:
    """Retrieve relevant memories from Pinecone"""
    if not memory_index or not openai_client:
        print("❌ Pinecone or OpenAI not available for memory retrieval")
        return []
    
    try:
        # Create query embedding
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query
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
            if match.score > 0.7:  # Only high-similarity memories
                memories.append({
                    "content": match.metadata["content"],
                    "role": match.metadata["role"], 
                    "timestamp": match.metadata["timestamp"],
                    "similarity": match.score,
                    "context": match.metadata.get("context", "")
                })
        
        print(f"✅ Retrieved {len(memories)} memories from Pinecone")
        return memories
        
    except Exception as e:
        print(f"❌ Failed to retrieve memories from Pinecone: {e}")
        return []

def store_user_memory(user_id: str, content: str, role: str):
    """Store in local memory + Pinecone"""
    USER_CONVERSATIONS[user_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })
    
    # Also store in Pinecone asynchronously
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(store_memory_in_pinecone(user_id, content, role))
        else:
            loop.run_until_complete(store_memory_in_pinecone(user_id, content, role))
    except Exception as e:
        print(f"⚠️ Could not store in Pinecone immediately: {e}")

async def search_web_tavily(query: str, location: str = "") -> str:
    if not tavily_client: 
        return "EVIDENCE: Web search unavailable"
    
    try:
        search_query = f"{query} {location}".strip()
        print(f"🔍 Tavily: Searching for '{search_query}'")
        
        response = tavily_client.search(
            query=search_query, 
            search_depth="advanced",
            max_results=5,
            include_answer=True
        )
        
        evidence = []
        if response and response.get('answer'):
            evidence.append(f"DIRECT ANSWER: {response['answer']}")
        
        results = response.get('results', []) if response else []
        for i, result in enumerate(results[:3]):
            if result.get('content'):
                content = result['content'][:300]
                evidence.append(f"SOURCE {i+1}: {content}")
        
        return "\n".join(evidence) if evidence else "EVIDENCE: No reliable information found"
        
    except Exception as e:
        return f"EVIDENCE: Search failed - {str(e)}"

def process_image_for_ai(image_file: bytes) -> str:
    try:
        return base64.b64encode(image_file).decode('utf-8')
    except Exception as e:
        print(f"❌ Image processing error: {e}")
        return None

async def call_gemini_vision(prompt: str, image_b64: str = None):
    if not gemini_ready: 
        return None
    
    models_to_try = [
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash-latest', 
        'gemini-pro-vision',
        'gemini-1.5-flash'
    ]
    
    for model_name in models_to_try:
        try:
            print(f"🤖 Trying Gemini Vision: {model_name}")
            
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
                    max_output_tokens=1000,
                    temperature=0.7
                )
            )
            
            if response and response.text:
                try:
                    data = json.loads(response.text)
                except json.JSONDecodeError:
                    text = response.text.strip()
                    confidence = 90 if image_b64 else 85
                    
                    data = {
                        "answer": text,
                        "confidence_score": confidence,
                        "scam_detected": False
                    }
                
                data['model'] = f"Gemini Vision ({model_name})"
                print(f"✅ Gemini Vision success")
                return data
                
        except Exception as e:
            print(f"❌ Gemini Vision {model_name} failed: {e}")
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
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_b64}",
                    "detail": "high"
                }
            })
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )
        
        answer = response.choices[0].message.content
        
        data = {
            "answer": answer,
            "confidence_score": 90 if image_b64 else 85,
            "scam_detected": False,
            "model": "OpenAI Vision (GPT-4o-mini)"
        }
        
        print("✅ OpenAI Vision success")
        return data
        
    except Exception as e:
        print(f"❌ OpenAI Vision failed: {e}")
        return None

# ACCESS CONTROL ENDPOINTS
@app.post("/verify-access")
async def verify_access(email: str = Form(...)):
    user_email = email.lower()
    tier = BETA_TESTERS.get(user_email, None)
    
    if tier:
        return {
            "access_granted": True,
            "tier": tier,
            "user_name": "Christopher" if "stangman" in user_email else user_email.split('@')[0],
            "is_beta": True
        }
    else:
        return {
            "access_granted": False,
            "message": "You're not on the approved list yet. Please join the waitlist at mylylo.pro",
            "tier": "none",
            "user_name": user_email.split('@')[0],
            "is_beta": False
        }

@app.post("/admin/add-beta-tester")
async def add_beta_tester(
    admin_email: str = Form(...),
    new_email: str = Form(...),
    tier: str = Form("elite")
):
    if admin_email.lower() != "stangman9898@gmail.com":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    BETA_TESTERS[new_email.lower()] = tier
    print(f"✅ Added beta tester: {new_email} -> {tier}")
    
    return {
        "status": "success",
        "message": f"Added {new_email} as {tier} beta tester",
        "total_beta_testers": len(BETA_TESTERS)
    }

@app.get("/admin/list-beta-testers/{admin_email}")
async def list_beta_testers(admin_email: str):
    if admin_email.lower() != "stangman9898@gmail.com":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    return {
        "beta_testers": BETA_TESTERS,
        "total": len(BETA_TESTERS)
    }

@app.delete("/admin/remove-beta-tester")
async def remove_beta_tester(
    admin_email: str = Form(...),
    remove_email: str = Form(...)
):
    if admin_email.lower() != "stangman9898@gmail.com":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if remove_email.lower() in BETA_TESTERS:
        del BETA_TESTERS[remove_email.lower()]
        return {"status": "success", "message": f"Removed {remove_email}"}
    else:
        return {"status": "error", "message": "Beta tester not found"}

@app.post("/check-beta-access")
async def check_beta_access(email: str = Form(...)):
    tier = BETA_TESTERS.get(email.lower(), "free")
    is_beta = tier in ["elite", "pro"]
    
    return {
        "email": email,
        "tier": tier,
        "is_beta_tester": is_beta,
        "has_elite_access": tier == "elite"
    }

# MAIN CHAT ENDPOINT WITH WORKING MEMORY
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form(""),
    file: UploadFile = File(None)
):
    # VERIFY ACCESS
    tier = BETA_TESTERS.get(user_email.lower(), None)
    if not tier:
        return {
            "answer": "Access denied. Please join our waitlist at mylylo.pro for access to LYLO.",
            "confidence_score": 100,
            "confidence_explanation": "Access control active",
            "scam_detected": False,
            "scam_indicators": [],
            "detailed_analysis": "User not authorized",
            "web_search_used": False,
            "personalization_active": False,
            "tier_info": {"name": "No Access"},
            "usage_info": {"can_send": False, "current_tier": "none"}
        }
    
    user_id = create_user_id(user_email)
    actual_tier = BETA_TESTERS.get(user_email.lower(), "free")
    
    print(f"🧠 MEMORY CHAT: Processing '{msg[:50]}...' for {user_email[:20]} (Tier: {actual_tier})")
    
    # PROCESS IMAGE IF PROVIDED
    image_b64 = None
    if file and file.filename:
        try:
            print(f"📸 Processing uploaded image: {file.filename}")
            image_data = await file.read()
            image_b64 = process_image_for_ai(image_data)
            print(f"✅ Image ready for AI analysis")
        except Exception as e:
            print(f"❌ Image processing failed: {e}")
    
    # RETRIEVE MEMORIES FROM PINECONE
    print("🧠 Retrieving memories from Pinecone...")
    relevant_memories = await retrieve_memories_from_pinecone(user_id, msg, limit=10)
    
    # COMBINE RECENT HISTORY + RETRIEVED MEMORIES
    try:
        recent_history = json.loads(history)
    except:
        recent_history = []
    
    # Build memory context
    memory_context = ""
    if relevant_memories:
        memory_context = "PREVIOUS CONVERSATIONS:\n"
        for memory in relevant_memories[:5]:  # Top 5 most relevant
            memory_context += f"- {memory['role'].upper()}: {memory['content']}\n"
        print(f"✅ Found {len(relevant_memories)} relevant memories")
    else:
        print("ℹ️ No relevant memories found")
    
    # RECENT CONVERSATION HISTORY  
    history_text = ""
    if recent_history:
        history_text = "RECENT CONVERSATION:\n"
        for h in recent_history[-4:]:  # Last 4 exchanges
            history_text += f"{h['role'].upper()}: {h['content']}\n"
    
    # WEB SEARCH
    web_search_triggers = ["weather", "temperature", "forecast", "news", "current", "today", "price", "stock", "what's", "who is", "where is", "when is"]
    should_search = len(msg.split()) > 2 and any(trigger in msg.lower() for trigger in web_search_triggers)
    web_evidence = await search_web_tavily(msg, user_location) if should_search else ""
    
    persona_prompts = {
        "guardian": "You are The Guardian. Protective, vigilant, serious about security.",
        "roast": "You are The Roast Master. Sarcastic, funny, witty but ultimately helpful.",
        "chef": "You are The Chef. Warm, food-focused, use cooking metaphors.",
        "techie": "You are The Techie. Nerdy, detailed, precise technical explanations.",
        "lawyer": "You are The Lawyer. Formal, cautious, legal precision in language.",
        "friend": "You are The Best Friend. Empathetic, casual, supportive and chill."
    }
    
    quiz_context = QUIZ_ANSWERS.get(user_id, {})
    
    # ENHANCED PROMPT WITH MEMORY
    if image_b64:
        tribunal_prompt = f"""
{persona_prompts.get(persona, persona_prompts['guardian'])}

🧠 MEMORY ACTIVE: You remember our previous conversations and can reference them naturally. You learn about the user over time.

{memory_context}

{history_text}

USER PROFILE: {quiz_context}
REAL-TIME WEB DATA: {web_evidence}

🔍 VISION MODE: Analyze the image provided and describe what you see.

USER MESSAGE: "{msg}"

INSTRUCTIONS:
1. Reference relevant memories naturally if applicable
2. Show that you remember the user and learn from past conversations  
3. Analyze the image carefully and provide detailed insights
4. Maintain your persona while being informative
5. If it's a potential scam image, warn the user

REQUIRED JSON OUTPUT:
{{
    "answer": "your response including image analysis and memory references",
    "confidence_score": 60-95,
    "scam_detected": false
}}
"""
    else:
        tribunal_prompt = f"""
{persona_prompts.get(persona, persona_prompts['guardian'])}

🧠 MEMORY ACTIVE: You remember our previous conversations and can reference them naturally. You learn about the user over time and build on past interactions.

{memory_context}

{history_text}

USER PROFILE: {quiz_context}
REAL-TIME WEB DATA: {web_evidence}

USER MESSAGE: "{msg}"

INSTRUCTIONS:
1. Reference relevant memories naturally when appropriate
2. Show continuity with past conversations
3. Learn from the user's preferences and history
4. Maintain your persona while being helpful
5. Build on previous interactions to provide better assistance

REQUIRED JSON OUTPUT:
{{
    "answer": "your response with natural memory integration",
    "confidence_score": 60-95,
    "scam_detected": false
}}
"""

    print("⚔️ TRIBUNAL: Launching Memory-Enhanced AI battle...")
    
    # Use vision models if image provided
    if image_b64:
        gemini_task = call_gemini_vision(tribunal_prompt, image_b64)
        openai_task = call_openai_vision(tribunal_prompt, image_b64)
    else:
        gemini_task = call_gemini_vision(tribunal_prompt)
        openai_task = call_openai_vision(tribunal_prompt)
    
    results = await asyncio.gather(gemini_task, openai_task, return_exceptions=True)
    
    valid_results = []
    for i, result in enumerate(results):
        model_name = "Gemini Memory" if i == 0 else "OpenAI Memory"
        if isinstance(result, dict) and result.get('answer'):
            valid_results.append(result)
            print(f"✅ {model_name}: Confidence {result.get('confidence_score', 0)}%")
        else:
            print(f"❌ {model_name}: Failed")
    
    if valid_results:
        winner = max(valid_results, key=lambda x: x.get('confidence_score', 0))
        print(f"🏆 WINNER: {winner.get('model', 'Unknown')} with {winner.get('confidence_score', 0)}% confidence")
    else:
        winner = {
            "answer": f"I'm having technical difficulties {'analyzing the image' if image_b64 else 'processing your message'} right now, but I'm here to help!",
            "confidence_score": 60,
            "scam_detected": False,
            "model": "Emergency Fallback"
        }
        print("🚨 TRIBUNAL: All models failed, using emergency fallback")
    
    # STORE MEMORIES (both local and Pinecone)
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    
    # STORE IN PINECONE WITH CONTEXT
    context_summary = f"Persona: {persona}, Topic: {msg[:100]}, Response: {winner['answer'][:100]}"
    await store_memory_in_pinecone(user_id, msg, "user", context_summary)
    await store_memory_in_pinecone(user_id, winner['answer'], "bot", context_summary)
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 60),
        "confidence_explanation": f"Memory-enhanced analysis using {winner.get('model', 'AI system')}",
        "scam_detected": winner.get('scam_detected', False),
        "scam_indicators": [],
        "detailed_analysis": "Memory system active - learning from conversations",
        "web_search_used": bool(web_evidence),
        "personalization_active": bool(quiz_context or relevant_memories),
        "tier_info": {"name": f"{actual_tier.title()} Tier"},
        "usage_info": {"can_send": True, "current_tier": actual_tier}
    }

@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    tier = BETA_TESTERS.get(user_email.lower(), "free")
    conversations = USER_CONVERSATIONS.get(user_id, [])
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    
    limit = 100 if tier == "elite" else 10
    current_usage = len(conversations)
    usage_percentage = min(100, (current_usage / limit) * 100) if limit > 0 else 0
    
    today = datetime.now().strftime("%Y-%m-%d")
    conversations_today = len([c for c in conversations if c.get('timestamp', '').startswith(today)])
    
    return {
        "tier": tier,
        "conversations_today": conversations_today,
        "total_conversations": len(conversations),
        "has_quiz_data": user_id in QUIZ_ANSWERS,
        "memory_entries": len(conversations),
        "usage": {
            "current": current_usage,
            "limit": limit,
            "percentage": usage_percentage
        },
        "learning_profile": {
            "interests": quiz_data.get("interest", "General").split(",") if quiz_data.get("interest") else ["General"],
            "top_concern": quiz_data.get("concern", "None")
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
    user_id = create_user_id(user_email)
    
    QUIZ_ANSWERS[user_id] = {
        "concern": question1,
        "style": question2,
        "device": question3,
        "interest": question4,
        "access": question5
    }
    
    print(f"📝 Quiz saved for user {user_email[:20]}")
    return {"status": "Quiz saved successfully"}

@app.get("/")
async def root():
    return {
        "status": "LYLO MEMORY SYSTEM ONLINE",
        "version": "9.3.0",
        "engines": {
            "gemini_vision": "✅ Ready" if gemini_ready else "❌ Offline",
            "openai_vision": "✅ Ready" if openai_client else "❌ Offline",
            "tavily": "✅ Ready" if tavily_client else "❌ Offline",
            "pinecone_memory": "✅ Ready" if memory_index else "❌ Offline"
        },
        "beta_testers": len(BETA_TESTERS),
        "access_control": "✅ Active",
        "vision_support": "✅ Enabled",
        "memory_system": "✅ Enabled"
    }

if __name__ == "__main__":
    print("🚀 LYLO MEMORY SYSTEM STARTING")
    print(f"👥 Beta Testers: {len(BETA_TESTERS)}")
    print("🔒 Access Control: ACTIVE")
    print("👁️ Vision Analysis: ENABLED") 
    print("🧠 Memory System: ENABLED")
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")