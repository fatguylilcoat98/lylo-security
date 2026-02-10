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

# --- DIAGNOSTICS ---
def mask_key(key):
    return f"{key[:4]}...{key[-4:]}" if key and len(key) > 8 else "❌ MISSING"

print("\n--- SYSTEM DIAGNOSTICS ---")
print(f"🔍 Web Intelligence: {mask_key(TAVILY_API_KEY)}")
print(f"🧠 Long-Term Memory: {mask_key(PINECONE_API_KEY)}")
print(f"🔵 Gemini Brain:     {mask_key(GEMINI_API_KEY)}")
print(f"🟢 OpenAI Brain:     {mask_key(OPENAI_API_KEY)}")
print("--------------------------\n")

# --- CLIENT SETUP ---
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

# Pinecone
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-memory"
        if index_name not in pc.list_indexes().names():
            pc.create_index(
                name=index_name,
                dimension=768, 
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
        print("✅ Pinecone Connected")
    except Exception as e:
        print(f"⚠️ Pinecone Warning: {e}")

# Gemini
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("✅ Gemini Connected")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

# OpenAI
openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Connected")
    except Exception as e:
        print(f"⚠️ OpenAI Error: {e}")


# --- DATA STORAGE ---
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
}
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# --- HELPER 1: STORAGE ---
def store_user_memory(user_id: str, content: str, role: str):
    entry = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }
    USER_CONVERSATIONS[user_id].append(entry)

# --- HELPER 2: SEARCH (The Evidence Gatherer) ---
async def search_web_tavily(query: str, location: str = "") -> str:
    if not tavily_client:
        return ""
    try:
        full_query = f"{query} {location}".strip()
        response = tavily_client.search(
            query=full_query,
            search_depth="basic", 
            max_results=3, # Increased to 3 for better evidence
            include_answer=True
        )
        evidence = []
        if response.get("answer"):
            evidence.append(f"DIRECT ANSWER: {response['answer']}")
        
        for r in response.get('results', []):
            evidence.append(f"SOURCE ({r['url']}): {r['content']}")
            
        return "\n".join(evidence)
    except Exception as e:
        print(f"Search Error: {e}")
        return ""

# --- HELPER 3: CONTEXT ---
def get_user_context(user_id: str) -> str:
    context_parts = []
    if user_id in QUIZ_ANSWERS:
        for q, a in QUIZ_ANSWERS[user_id].items():
            context_parts.append(f"{q}: {a}")
    return " | ".join(context_parts)

# --- THE TRIBUNAL (Strict Fact Checking) ---

async def call_gemini(prompt: str):
    """Worker function for Gemini"""
    if not GEMINI_API_KEY: return None
    try:
        # Auto-fallback logic
        for model_name in ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                data = json.loads(response.text)
                data['model_used'] = f"Gemini ({model_name})"
                return data
            except:
                continue
        return None
    except Exception as e:
        print(f"Gemini Fail: {e}")
        return None

async def call_openai(prompt: str):
    """Worker function for OpenAI"""
    if not openai_client: return None
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a backend API. Respond ONLY in JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        data['model_used'] = "OpenAI (GPT-4o)"
        return data
    except Exception as e:
        print(f"OpenAI Fail: {e}")
        return None

async def generate_ai_response(msg: str, persona: str, user_context: str, web_data: str, history_text: str):
    
    # 1. THE STRICT PROMPT (The "Courtroom" Instructions)
    personas = {
        "guardian": "You are The Guardian. Protective, vigilant, and serious.",
        "roast": "You are The Roast Master. Witty, sarcastic, and funny.",
        "chef": "You are The Chef. Warm, encouraging, and food-obsessed.",
        "techie": "You are The Techie. Detailed, nerdy, and precise.",
        "lawyer": "You are The Lawyer. Formal, cautious, and professional.",
        "friend": "You are The Best Friend. Casual, empathetic, and chill."
    }
    system_instruction = personas.get(persona, personas["guardian"])

    prompt = f"""
    {system_instruction}
    
    *** EVIDENCE (LIVE WEB DATA) ***
    {web_data}
    ********************************
    
    USER PROFILE: {user_context}
    HISTORY: {history_text}
    MESSAGE: "{msg}"
    
    STRICT INSTRUCTIONS:
    1. Answer the user's question.
    2. GROUNDING RULE: If 'EVIDENCE' is provided, you MUST use it. 
       - Do not make up facts not present in the evidence.
       - If the evidence contradicts your internal knowledge, trust the evidence.
       - If the evidence is empty, rely on internal knowledge but lower confidence.
    3. SCAM CHECK: If the user message looks like a scam/phishing, flag it.
    4. CONFIDENCE SCORE (0-100):
       - 90-100: Fact is explicitly in the EVIDENCE.
       - 70-89: Fact is common knowledge but not in evidence.
       - 0-50: You are guessing or hallucinating.
    
    OUTPUT FORMAT (JSON):
    {{
        "answer": "response...",
        "confidence_score": 90,
        "scam_detected": false
    }}
    """

    # 2. THE BATTLE: Run both models in parallel
    print("⚖️  THE TRIBUNAL IS IN SESSION...")
    
    results = await asyncio.gather(
        call_gemini(prompt),
        call_openai(prompt)
    )
    
    gemini_result = results[0]
    openai_result = results[1]

    # 3. JUDGEMENT DAY
    
    # Fallback if both fail
    if not gemini_result and not openai_result:
        return {"answer": "System Failure: Both AI cores unresponsive.", "confidence_score": 0, "scam_detected": False}

    # If only one survives, they win by default
    if gemini_result and not openai_result:
        print(f"🏆 Default Winner: {gemini_result['model_used']}")
        return gemini_result
    if openai_result and not gemini_result:
        print(f"🏆 Default Winner: {openai_result['model_used']}")
        return openai_result

    # 4. CROSS-EXAMINATION (Compare Scores)
    gemini_conf = gemini_result.get('confidence_score', 0)
    openai_conf = openai_result.get('confidence_score', 0)
    
    print(f"📊 Evidence Check -> Gemini: {gemini_conf}% | OpenAI: {openai_conf}%")
    
    # The Penalty Logic: If one model is super confident (95+) and the other is low (<50), 
    # the low one likely found contradictory evidence or no evidence.
    # However, for now, we trust the HIGH score because we instructed them to lower it if unsure.
    
    if gemini_conf >= openai_conf:
        print(f"🏆 Verdict: {gemini_result['model_used']} is more accurate.")
        return gemini_result
    else:
        print(f"🏆 Verdict: {openai_result['model_used']} is more accurate.")
        return openai_result


# --- MAIN CHAT ENDPOINT ---
@app.post("/chat")
async def chat(
    msg: str = Form(...),
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    user_email: str = Form(...),
    user_location: str = Form("")
):
    user_id = create_user_id(user_email)
    print(f"📨 {user_email}: {msg}")

    # 1. PARSE HISTORY
    try:
        history_list = json.loads(history)
        history_text = "\n".join([f"{h['role'].upper()}: {h['content']}" for h in history_list[-4:]])
    except:
        history_text = ""

    # 2. EVIDENCE GATHERING (Always search for context)
    web_data = ""
    # We search if message is > 2 words OR if it contains "fact" keywords
    if tavily_client and (len(msg.split()) > 2 or "?" in msg):
        web_data = await search_web_tavily(msg, user_location)
        print("🔎 Evidence Gathered from Web")

    # 3. GET CONTEXT
    user_context = get_user_context(user_id)

    # 4. TRIBUNAL JUDGEMENT
    data = await generate_ai_response(msg, persona, user_context, web_data, history_text)

    # 5. SAVE MEMORY
    store_user_memory(user_id, msg, "user")
    store_user_memory(user_id, data.get('answer', ''), "bot")
    
    return data

# --- STATS & QUIZ (Unchanged) ---
@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    return {
        "tier": ELITE_USERS.get(user_email.lower(), "free"),
        "total_conversations": len(USER_CONVERSATIONS.get(user_id, [])),
        "has_quiz_data": user_id in QUIZ_ANSWERS
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
    return {"status": "Quiz Saved"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
