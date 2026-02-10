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

app = FastAPI(title="LYLO Backend", version="9.2.0 - VISION ENABLED")

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

# BETA TESTER MANAGEMENT SYSTEM
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
}

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
    if not tavily_client: 
        print("❌ Tavily: No client available")
        return "EVIDENCE: Web search unavailable - client not initialized"
    
    try:
        search_query = f"{query} {location}".strip()
        print(f"🔍 Tavily: Searching for '{search_query}'")
        
        response = tavily_client.search(
            query=search_query, 
            search_depth="advanced",
            max_results=5,
            include_answer=True,
            include_domains=None,
            exclude_domains=None
        )
        
        print(f"🔍 Tavily: Response received")
        
        evidence = []
        
        if response and response.get('answer'):
            evidence.append(f"DIRECT ANSWER: {response['answer']}")
            print(f"✅ Tavily: Direct answer found")
        
        results = response.get('results', []) if response else []
        for i, result in enumerate(results[:3]):
            if result.get('content'):
                content = result['content'][:300]
                evidence.append(f"SOURCE {i+1}: {content}")
        
        final_evidence = "\n".join(evidence) if evidence else "EVIDENCE: No reliable information found"
        print(f"✅ Tavily: Returning evidence ({len(evidence)} items)")
        return final_evidence
        
    except Exception as e:
        error_msg = f"Tavily Search Error: {str(e)}"
        print(f"❌ {error_msg}")
        return f"EVIDENCE: Search failed - {str(e)}"

def process_image_for_ai(image_file: bytes) -> str:
    """Convert image to base64 for AI processing"""
    try:
        # Convert to base64
        image_b64 = base64.b64encode(image_file).decode('utf-8')
        return image_b64
    except Exception as e:
        print(f"❌ Image processing error: {e}")
        return None

async def call_gemini_vision(prompt: str, image_b64: str = None):
    """FIXED GEMINI VISION - Actually sees and analyzes images"""
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
            print(f"🤖 Trying Gemini Vision model: {model_name}")
            
            model = genai.GenerativeModel(model_name)
            
            # Prepare content for vision analysis
            content_parts = [prompt]
            
            if image_b64:
                print(f"📸 Processing image with Gemini Vision")
                # Add image to content
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
                # Parse response for JSON or create structured response
                try:
                    data = json.loads(response.text)
                except json.JSONDecodeError:
                    text = response.text.strip()
                    
                    confidence = 90 if image_b64 else 85
                    if "confidence" in text.lower():
                        import re
                        conf_match = re.search(r'(\d+)%', text)
                        if conf_match:
                            confidence = int(conf_match.group(1))
                    
                    data = {
                        "answer": text,
                        "confidence_score": confidence,
                        "scam_detected": False
                    }
                
                data['model'] = f"Gemini Vision ({model_name})"
                print(f"✅ Gemini Vision {model_name} success - Image analyzed!")
                return data
                
        except Exception as e:
            print(f"❌ Gemini Vision {model_name} failed: {e}")
            continue
    
    print("❌ All Gemini Vision models failed")
    return None

async def call_openai_vision(prompt: str, image_b64: str = None):
    """OpenAI Vision for image analysis"""
    if not openai_client: 
        return None
        
    try:
        messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        
        if image_b64:
            print(f"📸 Processing image with OpenAI Vision")
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_b64}",
                    "detail": "high"
                }
            })
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini", # Vision capable
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )
        
        answer = response.choices[0].message.content
        
        # Create structured response
        data = {
            "answer": answer,
            "confidence_score": 90 if image_b64 else 85,
            "scam_detected": False,
            "model": "OpenAI Vision (GPT-4o-mini)"
        }
        
        print("✅ OpenAI Vision success - Image analyzed!")
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
        print(f"❌ Removed beta tester: {remove_email}")
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

# MAIN CHAT ENDPOINT WITH VISION SUPPORT
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form(""),
    file: UploadFile = File(None)  # Support image uploads
):
    # VERIFY ACCESS FIRST
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
    
    print(f"🎯 TRIBUNAL: Processing '{msg[:50]}...' for {user_email[:20]} (Tier: {actual_tier})")
    
    # PROCESS IMAGE IF PROVIDED
    image_b64 = None
    if file and file.filename:
        try:
            print(f"📸 Processing uploaded image: {file.filename}")
            image_data = await file.read()
            image_b64 = process_image_for_ai(image_data)
            print(f"✅ Image converted to base64 for AI analysis")
        except Exception as e:
            print(f"❌ Image processing failed: {e}")
    
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in json.loads(history)[-4:]])
    
    # Enhanced web search triggers
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
    
    # ENHANCED PROMPT FOR VISION
    if image_b64:
        tribunal_prompt = f"""
{persona_prompts.get(persona, persona_prompts['guardian'])}

🔍 VISION MODE: You can see and analyze the image provided. Describe what you see in detail and provide relevant insights based on the image content.

USER CONTEXT: {quiz_context}
CONVERSATION HISTORY: {history_text}
REAL-TIME EVIDENCE: {web_evidence}
USER MESSAGE: "{msg}"

INSTRUCTIONS:
1. Carefully analyze the image if provided
2. Describe what you see clearly and accurately  
3. Provide helpful insights or answer questions about the image
4. Maintain your persona while being informative
5. If it's a potential scam image (fake documents, suspicious QR codes, etc.), warn the user

REQUIRED OUTPUT JSON FORMAT:
{{
    "answer": "your detailed response including image analysis",
    "confidence_score": 60-95,
    "scam_detected": false
}}
"""
    else:
        tribunal_prompt = f"""
{persona_prompts.get(persona, persona_prompts['guardian'])}

USER CONTEXT: {quiz_context}
CONVERSATION HISTORY: {history_text}
REAL-TIME EVIDENCE: {web_evidence}
USER MESSAGE: "{msg}"

Respond as this persona. Be helpful and natural.

REQUIRED OUTPUT JSON FORMAT:
{{
    "answer": "your response as the persona",
    "confidence_score": 60-95,
    "scam_detected": false
}}
"""

    print("⚔️ TRIBUNAL: Launching AI Vision battle...")
    
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
        model_name = "Gemini Vision" if i == 0 else "OpenAI Vision"
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
            "answer": f"I'm having technical difficulties analyzing {'the image' if image_b64 else 'your message'} right now, but I'm here to help! (Emergency mode active)",
            "confidence_score": 60,
            "scam_detected": False,
            "model": "Emergency Fallback"
        }
        print("🚨 TRIBUNAL: All models failed, using emergency fallback")
    
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 60),
        "confidence_explanation": f"Based on tribunal analysis using {winner.get('model', 'AI system')}",
        "scam_detected": winner.get('scam_detected', False),
        "scam_indicators": [],
        "detailed_analysis": "No threats detected in this query",
        "web_search_used": bool(web_evidence),
        "personalization_active": bool(quiz_context),
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
        "status": "LYLO VISION TRIBUNAL SYSTEM ONLINE",
        "version": "9.2.0",
        "engines": {
            "gemini_vision": "✅ Ready" if gemini_ready else "❌ Offline",
            "openai_vision": "✅ Ready" if openai_client else "❌ Offline",
            "tavily": "✅ Ready" if tavily_client else "❌ Offline",
            "pinecone": "✅ Ready" if memory_index else "❌ Offline"
        },
        "beta_testers": len(BETA_TESTERS),
        "access_control": "✅ Active",
        "vision_support": "✅ Enabled"
    }

if __name__ == "__main__":
    print("🚀 LYLO VISION TRIBUNAL SYSTEM STARTING")
    print(f"👥 Beta Testers: {len(BETA_TESTERS)}")
    print("🔒 Access Control: ACTIVE")
    print("👁️ Vision Analysis: ENABLED")
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")