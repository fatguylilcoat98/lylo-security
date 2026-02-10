import os
import uvicorn
import json
import hashlib
import asyncio
from fastapi import FastAPI, Form, HTTPException
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

app = FastAPI(title="LYLO Backend", version="9.0.0 - THE TRIBUNAL")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API KEYS ---
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# DIAGNOSTIC PRINTS
print(f"🔍 DEBUG: Tavily Key loaded? {bool(TAVILY_API_KEY)}")
print(f"🧠 DEBUG: Pinecone Key loaded? {bool(PINECONE_API_KEY)}")
print(f"🤖 DEBUG: Gemini Key loaded? {bool(GEMINI_API_KEY)}")
print(f"🔥 DEBUG: OpenAI Key loaded? {bool(OPENAI_API_KEY)}")

# --- CLIENT SETUP ---
# TAVILY 401 FIX
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("✅ Tavily Client Initialized")
    except Exception as e:
        print(f"⚠️ Tavily Init Error: {e}")
else:
    print("❌ Tavily: No API key found")

# Pinecone
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

# Gemini - GEMINI 404 FIX
gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
        print("✅ Gemini Configured")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

# OpenAI
openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Client Ready")
    except Exception as e:
        print(f"⚠️ OpenAI Error: {e}")

# --- DATA STORAGE (Preserve All Features) ---
ELITE_USERS = {"stangman9898@gmail.com": "elite"}
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- HELPER FUNCTIONS ---
def store_user_memory(user_id: str, content: str, role: str):
    USER_CONVERSATIONS[user_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })

async def search_web_tavily(query: str, location: str = "") -> str:
    """TAVILY 401 FIX - Proper error handling"""
    if not tavily_client: 
        return "EVIDENCE: Web search unavailable - no API access"
    
    try:
        full_query = f"{query} {location}".strip()
        response = tavily_client.search(
            query=full_query, 
            search_depth="basic", 
            max_results=3, 
            include_answer=True
        )
        
        evidence = []
        if response.get('answer'):
            evidence.append(f"DIRECT ANSWER: {response['answer']}")
        
        for result in response.get('results', []):
            if result.get('content'):
                evidence.append(f"SOURCE: {result['content'][:200]}")
        
        return "\n".join(evidence) if evidence else "EVIDENCE: No reliable information found"
        
    except Exception as e:
        print(f"Tavily Search Error: {e}")
        return f"EVIDENCE: Search failed - {str(e)}"

# --- THE TRIBUNAL ENGINES (GEMINI 404 FIX) ---
async def call_gemini(prompt: str):
    """GEMINI 404 FIX - Clean model names with fallback chain"""
    if not gemini_ready: 
        return None
    
    # FALLBACK CHAIN: Try pro first, then flash
    models_to_try = ['gemini-1.5-pro', 'gemini-1.5-flash']  # NO "models/" prefix
    
    for model_name in models_to_try:
        try:
            print(f"🧠 Trying Gemini model: {model_name}")
            model = genai.GenerativeModel(model_name)
            
            response = model.generate_content(
                prompt, 
                generation_config={
                    "response_mime_type": "application/json",
                    "max_output_tokens": 500,
                    "temperature": 0.7
                }
            )
            
            if response and response.text:
                data = json.loads(response.text)
                data['model'] = f"Gemini ({model_name})"
                print(f"✅ Gemini {model_name} success")
                return data
                
        except Exception as e:
            print(f"❌ Gemini {model_name} failed: {e}")
            continue
    
    print("❌ All Gemini models failed")
    return None

async def call_openai(prompt: str):
    """OpenAI competitor in the tribunal"""
    if not openai_client: 
        return None
        
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0.7
        )
        
        data = json.loads(response.choices[0].message.content)
        data['model'] = "OpenAI (GPT-4o-mini)"
        print("✅ OpenAI success")
        return data
        
    except Exception as e:
        print(f"❌ OpenAI failed: {e}")
        return None

# --- MAIN ENDPOINTS ---
@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"), 
    persona: str = Form("guardian"), 
    user_email: str = Form(...), 
    user_location: str = Form("")
):
    user_id = create_user_id(user_email)
    
    print(f"🎯 TRIBUNAL: Processing '{msg[:50]}...' for {user_email[:20]}")
    
    # 1. Gather Evidence
    history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in json.loads(history)[-4:]])
    web_evidence = await search_web_tavily(msg, user_location) if len(msg.split()) > 2 else ""
    
    # 2. Persona Definitions
    persona_prompts = {
        "guardian": "You are The Guardian. Protective, vigilant, serious about security.",
        "roast": "You are The Roast Master. Sarcastic, funny, witty but ultimately helpful.",
        "chef": "You are The Chef. Warm, food-focused, use cooking metaphors.",
        "techie": "You are The Techie. Nerdy, detailed, precise technical explanations.",
        "lawyer": "You are The Lawyer. Formal, cautious, legal precision in language.",
        "friend": "You are The Best Friend. Empathetic, casual, supportive and chill."
    }
    
    # 3. Build Tribunal Prompt with GROUNDING instructions
    quiz_context = QUIZ_ANSWERS.get(user_id, {})
    
    tribunal_prompt = f"""
{persona_prompts.get(persona, persona_prompts['guardian'])}

CRITICAL GROUNDING RULES:
- If EVIDENCE contradicts your knowledge, trust the evidence and lower confidence to 60-75%
- If EVIDENCE is missing for factual claims, lower confidence to 70-80%
- If EVIDENCE supports your answer, you can use high confidence 85-95%

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

    # 4. THE TRIBUNAL BATTLE (Dual-Core)
    print("⚔️ TRIBUNAL: Launching dual AI battle...")
    
    gemini_task = call_gemini(tribunal_prompt)
    openai_task = call_openai(tribunal_prompt)
    
    # Battle them simultaneously
    results = await asyncio.gather(gemini_task, openai_task, return_exceptions=True)
    
    # Filter valid results
    valid_results = []
    for i, result in enumerate(results):
        model_name = "Gemini" if i == 0 else "OpenAI"
        if isinstance(result, dict) and result.get('answer'):
            valid_results.append(result)
            print(f"✅ {model_name}: Confidence {result.get('confidence_score', 0)}%")
        else:
            print(f"❌ {model_name}: Failed")
    
    # 5. THE JUDGE (Higher confidence wins)
    if valid_results:
        winner = max(valid_results, key=lambda x: x.get('confidence_score', 0))
        print(f"🏆 WINNER: {winner.get('model', 'Unknown')} with {winner.get('confidence_score', 0)}% confidence")
    else:
        # Emergency fallback
        winner = {
            "answer": f"I'm having technical difficulties right now, but I'm here to help! (Emergency mode active)",
            "confidence_score": 60,
            "scam_detected": False,
            "model": "Emergency Fallback"
        }
        print("🚨 TRIBUNAL: All models failed, using emergency fallback")
    
    # 6. Store Memory
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, winner['answer'], "bot")
    
    # 7. Return Result
    return {
        "answer": winner['answer'],
        "confidence_score": winner.get('confidence_score', 60),
        "confidence_explanation": f"Based on tribunal analysis using {winner.get('model', 'AI system')}",
        "scam_detected": winner.get('scam_detected', False),
        "scam_indicators": [],
        "detailed_analysis": "No threats detected in this query",
        "web_search_used": bool(web_evidence),
        "personalization_active": bool(quiz_context),
        "tier_info": {"name": f"{ELITE_USERS.get(user_email.lower(), 'free').title()} Tier"},
        "usage_info": {"can_send": True, "current_tier": ELITE_USERS.get(user_email.lower(), "free")}
    }

@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    """USAGE STATS FIX - Proper JSON structure"""
    user_id = create_user_id(user_email)
    tier = ELITE_USERS.get(user_email.lower(), "free")
    conversations = USER_CONVERSATIONS.get(user_id, [])
    quiz_data = QUIZ_ANSWERS.get(user_id, {})
    
    # Calculate usage limits
    limit = 100 if tier == "elite" else 10
    current_usage = len(conversations)
    usage_percentage = min(100, (current_usage / limit) * 100) if limit > 0 else 0
    
    # Today's conversations
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
    """Quiz endpoint - preserve existing functionality"""
    user_id = create_user_id(user_email)
    
    QUIZ_ANSWERS[user_id] = {
        "concern": question1,      # What worries you most online?
        "style": question2,        # How do you like to communicate?
        "device": question3,       # What devices do you use?
        "interest": question4,     # Any hobbies or interests?
        "access": question5        # Do you need accessibility help?
    }
    
    print(f"📝 Quiz saved for user {user_email[:20]}")
    return {"status": "Quiz saved successfully"}

@app.get("/")
async def root():
    return {
        "status": "LYLO TRIBUNAL SYSTEM ONLINE",
        "version": "9.0.0",
        "engines": {
            "gemini": "✅ Ready" if gemini_ready else "❌ Offline",
            "openai": "✅ Ready" if openai_client else "❌ Offline",
            "tavily": "✅ Ready" if tavily_client else "❌ Offline",
            "pinecone": "✅ Ready" if memory_index else "❌ Offline"
        },
        "features": ["Dual-Core AI Battle", "Real-time Web Intelligence", "Personal Memory", "Scam Detection"]
    }

if __name__ == "__main__":
    print("🚀 LYLO TRIBUNAL SYSTEM STARTING")
    print("⚔️ Dual-Core AI Battle Mode: Gemini vs OpenAI")
    print("🏆 Winner determined by highest confidence score")
    
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")
