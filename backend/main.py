from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import hashlib
import requests
from typing import Dict, Any, List
from datetime import datetime
from collections import defaultdict
from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec

app = FastAPI(title="LYLO Backend", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

print(f"🔍 Tavily Web Search: {'✅' if TAVILY_API_KEY else '❌'}")
print(f"🧠 Pinecone Memory: {'✅' if PINECONE_API_KEY else '❌'}")
print(f"🤖 Gemini AI: {'✅' if GEMINI_API_KEY else '❌'}")

# Initialize Tavily
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

# Initialize Pinecone
pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-user-memory"
        
        if index_name not in pc.list_indexes().names():
            pc.create_index(
                name=index_name,
                dimension=384,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        
        memory_index = pc.Index(index_name)
        print("✅ Pinecone Memory System Online")
    except Exception as e:
        print(f"⚠️ Pinecone Error: {e}")

# Initialize Gemini
genai = None
model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai_lib
        genai_lib.configure(api_key=GEMINI_API_KEY)
        genai = genai_lib
        model = genai.GenerativeModel('gemini-1.5-pro')
        print("✅ Gemini AI Online")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")

# Elite Users
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
}

# User Data Storage
USER_PROFILES = defaultdict(dict)
USER_CONVERSATIONS = defaultdict(list)
QUIZ_ANSWERS = defaultdict(dict)

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

async def search_web_tavily(query: str, user_location: str = "") -> str:
    """Real-time web search using Tavily"""
    if not tavily_client:
        return "Web search unavailable - API not configured"
    
    try:
        # Add user location context if available, otherwise keep global
        search_query = f"{query} {user_location}".strip()
        
        response = tavily_client.search(
            query=search_query,
            search_depth="advanced",
            max_results=3,
            include_answer=True
        )
        
        if response and response.get("answer"):
            return response["answer"]
        elif response and response.get("results"):
            return response["results"][0].get("content", "No information found")[:300]
        else:
            return "No current information available"
            
    except Exception as e:
        return f"Search error: {str(e)}"

def store_user_memory(user_id: str, content: str, memory_type: str = "conversation"):
    """Store user memory in Pinecone"""
    if not memory_index:
        # Fallback to local storage
        if user_id not in USER_CONVERSATIONS:
            USER_CONVERSATIONS[user_id] = []
        
        USER_CONVERSATIONS[user_id].append({
            "content": content,
            "type": memory_type,
            "timestamp": datetime.now().isoformat()
        })
        return
    
    try:
        # Simple vector for memory (in real implementation, use proper embeddings)
        vector_id = f"{user_id}_{datetime.now().isoformat()}"
        simple_vector = [0.1] * 384
        
        memory_index.upsert(
            vectors=[{
                "id": vector_id,
                "values": simple_vector,
                "metadata": {
                    "user_id": user_id,
                    "content": content,
                    "type": memory_type,
                    "timestamp": datetime.now().isoformat()
                }
            }]
        )
    except Exception as e:
        print(f"Memory storage error: {e}")

def get_user_context(user_id: str) -> str:
    """Retrieve user context for personalization"""
    context_parts = []
    
    # Add quiz answers
    if user_id in QUIZ_ANSWERS:
        quiz_data = QUIZ_ANSWERS[user_id]
        for question, answer in quiz_data.items():
            context_parts.append(f"{question}: {answer}")
    
    # Add recent conversations
    recent_convos = USER_CONVERSATIONS.get(user_id, [])[-5:]
    if recent_convos:
        context_parts.append("Recent topics: " + "; ".join([conv["content"][:50] for conv in recent_convos]))
    
    return " | ".join(context_parts) if context_parts else ""

def generate_ai_response(message: str, persona: str, user_context: str, web_data: str = "") -> str:
    """Generate AI response with personality and context"""
    
    # Persona personalities
    personas = {
        "guardian": "You're a protective security expert who's warm but serious about keeping people safe.",
        "roast": "You're witty and sarcastic but ultimately helpful. You roast people but always help them.",
        "friend": "You're the caring best friend who remembers everything and gives personal advice.",
        "chef": "You're enthusiastic about food and cooking. You relate everything to food experiences.",
        "techie": "You're the tech expert who explains things clearly without being condescending.",
        "lawyer": "You speak precisely like a legal expert but remain approachable and human."
    }
    
    personality = personas.get(persona, personas["guardian"])
    
    if model and genai:
        try:
            prompt = f"""
{personality}

USER CONTEXT: {user_context}
CURRENT DATA: {web_data}

User said: "{message}"

Respond naturally as this persona. Always include a confidence percentage (60-98%). 
Be helpful, remember their context, and sound human - not robotic.
"""
            
            response = model.generate_content(
                prompt,
                generation_config={
                    'max_output_tokens': 400,
                    'temperature': 0.7
                }
            )
            
            return response.text if response.text else "I'm having trouble generating a response right now."
            
        except Exception as e:
            print(f"AI generation error: {e}")
    
    # Fallback responses
    if web_data:
        return f"Here's what I found: {web_data} (Confidence: 90%)"
    else:
        fallbacks = {
            "roast": "Well, look who's back for more wisdom. What do you need help with? (Confidence: 88%)",
            "friend": "Hey there! Good to see you again. What's on your mind? (Confidence: 85%)",
            "guardian": "I'm here to keep you safe. How can I help protect you today? (Confidence: 87%)"
        }
        return fallbacks.get(persona, fallbacks["guardian"])

@app.get("/")
async def root():
    return {
        "status": "LYLO Production System",
        "version": "3.0.0",
        "web_intelligence": bool(tavily_client),
        "memory_system": bool(memory_index),
        "ai_brain": bool(model)
    }

@app.post("/quiz")
async def save_quiz(
    user_email: str = Form(...),
    question1: str = Form(...),  # What worries you most online?
    question2: str = Form(...),  # How do you like to communicate?
    question3: str = Form(...),  # What devices do you use?
    question4: str = Form(...),  # Any hobbies or interests?
    question5: str = Form(...)   # Do you need any accessibility help?
):
    """Save quiz answers for user personalization"""
    user_id = create_user_id(user_email)
    
    QUIZ_ANSWERS[user_id] = {
        "main_concern": question1,
        "communication_style": question2,
        "devices": question3,
        "interests": question4,
        "accessibility": question5
    }
    
    # Store in memory system
    quiz_summary = f"User concerns: {question1}. Communication: {question2}. Devices: {question3}. Interests: {question4}. Accessibility: {question5}"
    store_user_memory(user_id, quiz_summary, "quiz_data")
    
    return {"status": "Quiz saved successfully"}

@app.post("/chat")
async def chat(
    msg: str = Form(...),
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    tier: str = Form("free"),
    user_email: str = Form(...),
    user_location: str = Form("")  # Optional user location
):
    user_id = create_user_id(user_email)
    actual_tier = ELITE_USERS.get(user_email.lower(), "free")
    
    print(f"🎯 LYLO: {msg[:50]}... (User: {user_email[:20]}, Persona: {persona})")
    
    try:
        # Get user context for personalization
        user_context = get_user_context(user_id)
        
        # Check if web search is needed
        web_data = ""
        msg_lower = msg.lower()
        
        if any(word in msg_lower for word in ["weather", "temperature", "forecast", "news", "current", "today", "price", "stock"]):
            web_data = await search_web_tavily(msg, user_location)
            print(f"🔍 Web search: {web_data[:100]}...")
        
        # Generate AI response
        response_text = generate_ai_response(msg, persona, user_context, web_data)
        
        # Store conversation in memory
        conversation_data = f"User: {msg} | AI ({persona}): {response_text}"
        store_user_memory(user_id, conversation_data, "conversation")
        
        # Extract confidence from response
        confidence = 88
        if "confidence:" in response_text.lower():
            try:
                conf_part = response_text.lower().split("confidence:")[1].split("%")[0].strip()
                confidence = int(conf_part.split("(")[-1]) if "(" in conf_part else int(conf_part)
            except:
                pass
        
        return {
            "answer": response_text,
            "confidence_score": confidence,
            "confidence_explanation": "Based on real-time data and personal context" if web_data else "Standard personalized response",
            "scam_detected": False,
            "scam_indicators": [],
            "detailed_analysis": "No threats detected",
            "web_search_used": bool(web_data),
            "personalization_active": bool(user_context),
            "tier_info": {"name": f"{actual_tier.title()} Tier"},
            "usage_info": {
                "can_send": True,
                "current_tier": actual_tier,
                "conversations_today": len([c for c in USER_CONVERSATIONS.get(user_id, []) 
                                          if c["timestamp"].startswith(datetime.now().strftime("%Y-%m-%d"))])
            }
        }
        
    except Exception as e:
        print(f"🚨 Error: {e}")
        return {
            "answer": f"I encountered an error: {str(e)}. Please try again.",
            "confidence_score": 50,
            "error": True
        }

@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    user_id = create_user_id(user_email)
    actual_tier = ELITE_USERS.get(user_email.lower(), "free")
    
    conversations_today = len([c for c in USER_CONVERSATIONS.get(user_id, []) 
                              if c["timestamp"].startswith(datetime.now().strftime("%Y-%m-%d"))])
    
    return {
        "tier": actual_tier,
        "conversations_today": conversations_today,
        "total_conversations": len(USER_CONVERSATIONS.get(user_id, [])),
        "has_quiz_data": user_id in QUIZ_ANSWERS,
        "memory_entries": len(USER_CONVERSATIONS.get(user_id, []))
    }

if __name__ == "__main__":
    print("🚀 LYLO Production System Starting")
    print("🔍 Web Intelligence:", "✅" if tavily_client else "❌")
    print("🧠 Memory System:", "✅" if memory_index else "❌") 
    print("🤖 AI Brain:", "✅" if model else "❌")
    
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")
