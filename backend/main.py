from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import hashlib
import requests
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
import asyncio
from dataclasses import dataclass
from collections import defaultdict

app = FastAPI(title="LYLO Backend", description="AI Security Platform", version="3.0.0")

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

print(f"Web Intelligence: {'✅' if TAVILY_API_KEY else '❌'}")
print(f"Memory System: {'✅' if PINECONE_API_KEY else '❌'}")
print(f"AI Brain: {'✅' if GEMINI_API_KEY else '❌'}")

# Elite Access
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
    # Add more beta testers here
}

# User Memory Storage
USER_PROFILES = {}
USER_CONVERSATIONS = defaultdict(list)

# Pinecone Setup (Simplified for now)
MEMORY_STORE = defaultdict(list)

class UserProfile:
    def __init__(self, email: str):
        self.email = email
        self.name = ""
        self.location = "Sacramento, CA" if "stangman" in email else ""
        self.preferences = {}
        self.interests = []
        self.tech_level = "advanced" if "stangman" in email else "beginner"
        self.communication_style = "direct"
        self.learning_history = []
        self.first_conversation = datetime.now().isoformat()
        self.total_conversations = 0

def get_user_profile(email: str) -> UserProfile:
    if email not in USER_PROFILES:
        USER_PROFILES[email] = UserProfile(email)
        
        # Special setup for Christopher
        if "stangman9898" in email:
            profile = USER_PROFILES[email]
            profile.name = "Christopher"
            profile.location = "Sacramento, CA"
            profile.interests = ["technology", "gaming", "food", "AI", "cybersecurity"]
            profile.preferences = {
                "food": "carne asada, Mexican food, no mustard",
                "tech": "custom PC builds, Xbox modding, Z790 systems",
                "communication": "direct, technical details welcome"
            }
    
    return USER_PROFILES[email]

async def web_search(query: str) -> Dict:
    """Real-time web search using Tavily"""
    if not TAVILY_API_KEY:
        return {"error": "No web access"}
    
    try:
        response = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "advanced",
                "include_answer": True,
                "max_results": 3
            },
            timeout=8
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "answer": data.get("answer", ""),
                "results": data.get("results", []),
                "confidence": 95
            }
        return {"error": "Search failed"}
    except Exception as e:
        return {"error": str(e)}

def learn_from_conversation(email: str, user_msg: str, bot_response: str):
    """Learn and update user profile"""
    profile = get_user_profile(email)
    profile.total_conversations += 1
    
    # Store conversation
    USER_CONVERSATIONS[email].append({
        "timestamp": datetime.now().isoformat(),
        "user": user_msg,
        "bot": bot_response,
        "learned": []
    })
    
    # Learn from message
    msg_lower = user_msg.lower()
    learned = []
    
    # Learn food preferences
    if any(food in msg_lower for food in ["eat", "food", "restaurant", "hungry", "meal"]):
        if "mexican" in msg_lower or "carne asada" in msg_lower:
            profile.preferences["food_preferred"] = "Mexican, carne asada"
            learned.append("food preference")
    
    # Learn tech interests
    if any(tech in msg_lower for tech in ["computer", "pc", "gaming", "xbox", "build"]):
        if "gaming" not in profile.interests:
            profile.interests.append("gaming")
            learned.append("gaming interest")
    
    # Learn communication style
    if any(word in msg_lower for word in ["quick", "fast", "brief"]):
        profile.communication_style = "direct"
        learned.append("direct communication")
    
    # Store what we learned
    if learned:
        profile.learning_history.append({
            "timestamp": datetime.now().isoformat(),
            "learned": learned,
            "from_message": user_msg[:100]
        })

def get_personalized_context(email: str, current_msg: str) -> str:
    """Build personalized context for AI"""
    profile = get_user_profile(email)
    
    context_parts = []
    
    if profile.name:
        context_parts.append(f"User's name is {profile.name}")
    
    if profile.location:
        context_parts.append(f"Location: {profile.location}")
    
    if profile.interests:
        context_parts.append(f"Interests: {', '.join(profile.interests)}")
    
    if profile.preferences:
        prefs = [f"{k}: {v}" for k, v in profile.preferences.items()]
        context_parts.append(f"Preferences: {'; '.join(prefs)}")
    
    # Recent conversations
    recent = USER_CONVERSATIONS[email][-3:] if USER_CONVERSATIONS[email] else []
    if recent:
        context_parts.append("Recent topics: " + "; ".join([conv["user"][:50] for conv in recent]))
    
    return "PERSONAL CONTEXT: " + " | ".join(context_parts) if context_parts else ""

def generate_ai_response(user_msg: str, persona: str, context: str, web_data: Dict = None) -> str:
    """Generate intelligent AI response"""
    
    # Handle weather queries with web data
    if any(word in user_msg.lower() for word in ["weather", "temperature", "forecast"]):
        if web_data and web_data.get("answer"):
            return f"Based on current data: {web_data['answer']} (Confidence: 95%)"
        else:
            return "I can't access live weather data right now. Try checking Weather.com for Sacramento conditions. (Confidence: 60%)"
    
    # Handle location-based queries
    if "sacramento" in user_msg.lower():
        return "Since you're in Sacramento, I can help with local recommendations. What specifically are you looking for? (Confidence: 90%)"
    
    # Persona-based responses
    persona_responses = {
        "guardian": f"I'm here to protect you and keep you safe. {context} How can I help secure your digital life today? (Confidence: 88%)",
        "roast": f"Well well, look who's back for more of my wisdom. {context} What questionable decision are you about to make that you need my input on? (Confidence: 92%)",
        "friend": f"Hey there! {context} What's on your mind today? (Confidence: 85%)"
    }
    
    return persona_responses.get(persona, persona_responses["guardian"])

def detect_scam_signals(message: str) -> Tuple[bool, int, List[str], str]:
    """Enhanced scam detection"""
    indicators = []
    risk_score = 0
    
    high_risk = ["urgent action", "verify immediately", "account suspended", "wire transfer", "gift cards only"]
    medium_risk = ["click here", "confirm information", "update payment"]
    
    for pattern in high_risk:
        if pattern in message.lower():
            indicators.append(f"HIGH RISK: {pattern}")
            risk_score += 30
    
    for pattern in medium_risk:
        if pattern in message.lower():
            indicators.append(f"MEDIUM RISK: {pattern}")
            risk_score += 15
    
    scam_detected = risk_score >= 40
    confidence = min(98, risk_score + 50) if scam_detected else max(75, 95 - risk_score//2)
    
    analysis = f"Analyzed {len(indicators)} risk indicators. " + (
        "Strong scam signals detected." if scam_detected else "No major threats identified."
    )
    
    return scam_detected, confidence, indicators, analysis

@app.get("/")
async def root():
    return {
        "status": "LYLO Production System",
        "version": "3.0.0",
        "web_intelligence": bool(TAVILY_API_KEY),
        "memory_system": True,
        "elite_users": len(ELITE_USERS),
        "total_conversations": sum(len(convs) for convs in USER_CONVERSATIONS.values())
    }

@app.post("/chat")
async def chat(
    msg: str = Form(...),
    history: str = Form("[]"), 
    persona: str = Form("guardian"),
    tier: str = Form("free"),
    user_email: str = Form(...),
    session_id: str = Form("demo")
):
    # Check elite access
    actual_tier = ELITE_USERS.get(user_email.lower(), "free")
    
    print(f"LYLO Processing: {msg[:50]}... (User: {user_email}, Tier: {actual_tier})")
    
    try:
        # 1. Get user context
        personal_context = get_personalized_context(user_email, msg)
        
        # 2. Search web for current info
        web_data = None
        if any(word in msg.lower() for word in ["weather", "current", "today", "news", "price", "bitcoin"]):
            web_data = await web_search(msg)
        
        # 3. Detect scams
        scam_detected, confidence, indicators, analysis = detect_scam_signals(msg)
        
        # 4. Generate response
        response_text = generate_ai_response(msg, persona, personal_context, web_data)
        
        # 5. Learn from this conversation
        learn_from_conversation(user_email, msg, response_text)
        
        return {
            "answer": response_text,
            "confidence_score": confidence,
            "confidence_explanation": f"Based on {analysis.lower()} and personal context",
            "scam_detected": scam_detected,
            "scam_indicators": indicators,
            "detailed_analysis": analysis,
            "web_search_used": bool(web_data),
            "personalization_active": True,
            "tier_info": {"name": f"{actual_tier.title()} Tier", "features": ["unlimited"]},
            "usage_info": {
                "can_send": True,
                "current_tier": actual_tier,
                "conversations_today": len([c for c in USER_CONVERSATIONS[user_email] 
                                          if c["timestamp"].startswith(datetime.now().strftime("%Y-%m-%d"))])
            }
        }
        
    except Exception as e:
        print(f"Error: {e}")
        return {
            "answer": f"System error: {str(e)}. Please try again.",
            "confidence_score": 50,
            "error": True
        }

if __name__ == "__main__":
    print("🚀 LYLO Production System Starting")
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")
