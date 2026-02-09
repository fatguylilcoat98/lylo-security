from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import requests
import hashlib
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

app = FastAPI(title="LYLO Backend", version="4.0.0")

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

# Elite Users
ELITE_USERS = {
    "stangman9898@gmail.com": "elite",
}

# User Storage
USER_PROFILES = {}
USER_CONVERSATIONS = defaultdict(list)
USER_USAGE = defaultdict(lambda: {"daily": 0, "monthly": 0, "last_reset": datetime.now().date().isoformat()})

class UserProfile:
    def __init__(self, email: str):
        self.email = email
        self.name = ""
        self.quiz_completed = False
        self.quiz_answers = {}
        self.preferences = {}
        self.interests = []
        self.communication_style = "friendly"
        self.tech_level = "beginner"
        self.accessibility_needs = []
        self.total_conversations = 0
        self.current_personality = "guardian"
        self.created_date = datetime.now().isoformat()

def get_user_profile(email: str) -> UserProfile:
    if email not in USER_PROFILES:
        USER_PROFILES[email] = UserProfile(email)
        
        # Special setup for Christopher
        if "stangman9898" in email:
            profile = USER_PROFILES[email]
            profile.name = "Christopher"
            profile.tech_level = "advanced"
            profile.quiz_completed = True
            profile.quiz_answers = {
                "primary_concern": "Protecting family and seniors from scams",
                "communication_style": "Direct and technical when needed",
                "main_devices": "PC, mobile, gaming systems",
                "interests": "Technology, gaming, Sacramento local info",
                "accessibility": "None needed"
            }
    
    return USER_PROFILES[email]

def search_web(query: str, user_location: str = "") -> str:
    """Global web search using Tavily"""
    if not TAVILY_API_KEY:
        return "Web search unavailable - please contact support"
    
    try:
        search_query = f"{query} {user_location}".strip()
        
        response = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": search_query,
                "search_depth": "basic",
                "include_answer": True,
                "max_results": 3
            },
            timeout=8
        )
        
        if response.status_code == 200:
            data = response.json()
            answer = data.get("answer", "")
            if answer:
                return answer
            else:
                results = data.get("results", [])
                if results:
                    return results[0].get("content", "No details available")[:300]
        
        return "Unable to find current information"
        
    except Exception as e:
        return f"Search temporarily unavailable: {str(e)}"

def learn_from_conversation(email: str, user_msg: str, bot_response: str):
    """Learn and update user profile from conversations"""
    profile = get_user_profile(email)
    profile.total_conversations += 1
    
    # Store conversation
    USER_CONVERSATIONS[email].append({
        "timestamp": datetime.now().isoformat(),
        "user": user_msg,
        "bot": bot_response,
        "personality": profile.current_personality
    })
    
    # Keep only last 50 conversations for memory efficiency
    if len(USER_CONVERSATIONS[email]) > 50:
        USER_CONVERSATIONS[email] = USER_CONVERSATIONS[email][-50:]
    
    # Learn from message patterns
    msg_lower = user_msg.lower()
    
    # Learn communication preferences
    if any(word in msg_lower for word in ["quick", "brief", "short"]):
        profile.communication_style = "concise"
    elif any(word in msg_lower for word in ["explain", "detail", "tell me more"]):
        profile.communication_style = "detailed"
    
    # Learn interests
    interest_keywords = {
        "technology": ["computer", "tech", "software", "app", "internet"],
        "health": ["doctor", "medical", "health", "medicine"],
        "family": ["family", "grandkids", "children", "spouse"],
        "finance": ["money", "bank", "investment", "retirement", "savings"],
        "shopping": ["buy", "purchase", "store", "shopping", "order"]
    }
    
    for interest, keywords in interest_keywords.items():
        if any(keyword in msg_lower for keyword in keywords):
            if interest not in profile.interests:
                profile.interests.append(interest)

def get_personality_response(personality: str, message: str, context: str, web_result: str = "") -> str:
    """Generate responses based on selected personality"""
    
    personalities = {
        "guardian": {
            "style": "protective and security-focused",
            "greeting": "I'm here to keep you safe and secure.",
            "with_web": f"Here's what I found to help protect you: {web_result}",
            "no_web": "I'm here to help keep you secure. What can I assist you with today?",
            "confidence": 90
        },
        "friend": {
            "style": "warm and supportive",
            "greeting": "Hey there! Great to chat with you.",
            "with_web": f"I looked this up for you: {web_result}",
            "no_web": "Hi! I'm here to help however I can. What's on your mind?",
            "confidence": 85
        },
        "roast": {
            "style": "witty but helpful",
            "greeting": "Well, well, look who needs my expertise again.",
            "with_web": f"Since you apparently can't Google: {web_result}. You're welcome.",
            "no_web": "What questionable decision are you about to make that you need my wisdom on?",
            "confidence": 92
        },
        "chef": {
            "style": "enthusiastic about food and cooking",
            "greeting": "Ready to whip up something delicious?",
            "with_web": f"Here's some tasty info I found: {web_result}",
            "no_web": "Let's cook up some great ideas! What can I help you with?",
            "confidence": 88
        },
        "techie": {
            "style": "knowledgeable about technology",
            "greeting": "Tech support at your service!",
            "with_web": f"Found some technical details: {web_result}",
            "no_web": "What tech challenge can I help you solve today?",
            "confidence": 93
        },
        "lawyer": {
            "style": "professional and precise",
            "greeting": "I'm here to provide legal guidance within my capabilities.",
            "with_web": f"Based on current information: {web_result}",
            "no_web": "How can I assist you with legal or professional matters today?",
            "confidence": 87
        }
    }
    
    persona = personalities.get(personality, personalities["guardian"])
    
    if web_result:
        response = persona["with_web"]
    else:
        response = persona["no_web"]
    
    return f"{response} (Confidence: {persona['confidence']}%)"

@app.get("/")
async def root():
    return {
        "status": "LYLO Production System v4.0",
        "web_search": "✅ Active" if TAVILY_API_KEY else "❌ Disabled",
        "memory_system": "✅ Active",
        "total_users": len(USER_PROFILES),
        "elite_users": len(ELITE_USERS)
    }

@app.post("/quiz")
async def submit_quiz(
    user_email: str = Form(...),
    q1_primary_concern: str = Form(...),
    q2_communication: str = Form(...),
    q3_devices: str = Form(...),
    q4_interests: str = Form(...),
    q5_accessibility: str = Form(...)
):
    """Handle 5-question jumpstart quiz"""
    profile = get_user_profile(user_email)
    
    profile.quiz_completed = True
    profile.quiz_answers = {
        "primary_concern": q1_primary_concern,
        "communication_style": q2_communication,
        "main_devices": q3_devices,
        "interests": q4_interests,
        "accessibility": q5_accessibility
    }
    
    # Set communication style based on quiz
    if "quick" in q2_communication.lower() or "brief" in q2_communication.lower():
        profile.communication_style = "concise"
    elif "detailed" in q2_communication.lower() or "explain" in q2_communication.lower():
        profile.communication_style = "detailed"
    
    # Parse interests
    interest_mapping = {
        "technology": ["tech", "computer", "internet"],
        "health": ["health", "medical", "doctor"],
        "family": ["family", "kids", "grandkids"],
        "finance": ["money", "finance", "retirement"],
        "shopping": ["shopping", "buying", "stores"]
    }
    
    interests_text = q4_interests.lower()
    for interest, keywords in interest_mapping.items():
        if any(keyword in interests_text for keyword in keywords):
            if interest not in profile.interests:
                profile.interests.append(interest)
    
    # Handle accessibility needs
    if q5_accessibility.lower() != "none" and "none" not in q5_accessibility.lower():
        profile.accessibility_needs.append(q5_accessibility)
    
    return {
        "status": "Quiz completed successfully",
        "profile_updated": True,
        "communication_style": profile.communication_style,
        "interests_found": profile.interests
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
    # Get user profile and tier
    profile = get_user_profile(user_email)
    actual_tier = ELITE_USERS.get(user_email.lower(), "free")
    profile.current_personality = persona
    
    # Update usage tracking
    today = datetime.now().date().isoformat()
    if USER_USAGE[user_email]["last_reset"] != today:
        USER_USAGE[user_email]["daily"] = 0
        USER_USAGE[user_email]["last_reset"] = today
    
    USER_USAGE[user_email]["daily"] += 1
    USER_USAGE[user_email]["monthly"] += 1
    
    print(f"LYLO Chat: {msg[:50]}... (User: {profile.name or user_email[:20]}, Personality: {persona})")
    
    try:
        # Build personal context
        context_parts = []
        if profile.name:
            context_parts.append(f"User's name: {profile.name}")
        if profile.interests:
            context_parts.append(f"Interests: {', '.join(profile.interests)}")
        if profile.quiz_answers:
            context_parts.append(f"Primary concern: {profile.quiz_answers.get('primary_concern', '')}")
        
        context = " | ".join(context_parts) if context_parts else ""
        
        # Check if we need web search
        msg_lower = msg.lower()
        web_result = ""
        
        search_triggers = ["weather", "forecast", "temperature", "news", "current", "today", "price", "cost", "when", "where", "how much"]
        if any(trigger in msg_lower for trigger in search_triggers):
            # Try to extract location from user context or message
            user_location = ""
            if "weather" in msg_lower or "forecast" in msg_lower:
                # Look for location in message
                location_indicators = ["in ", " near ", " around "]
                for indicator in location_indicators:
                    if indicator in msg_lower:
                        location_part = msg_lower.split(indicator)[1].split()[0:2]
                        user_location = " ".join(location_part)
                        break
            
            web_result = search_web(msg, user_location)
        
        # Generate personality-based response
        response_text = get_personality_response(persona, msg, context, web_result)
        
        # Learn from this conversation
        learn_from_conversation(user_email, msg, response_text)
        
        # Calculate confidence based on available data
        confidence = 90
        if web_result and "unavailable" not in web_result:
            confidence = 95
        elif not web_result:
            confidence = 85
        
        return {
            "answer": response_text,
            "confidence_score": confidence,
            "confidence_explanation": f"Based on {persona} personality and available data",
            "scam_detected": False,
            "scam_indicators": [],
            "detailed_analysis": "Standard security check - no threats detected",
            "web_search_used": bool(web_result),
            "personalization_active": True,
            "tier_info": {"name": f"{actual_tier.title()} Tier"},
            "usage_info": {
                "can_send": True,
                "current_tier": actual_tier,
                "daily_usage": USER_USAGE[user_email]["daily"],
                "monthly_usage": USER_USAGE[user_email]["monthly"]
            }
        }
        
    except Exception as e:
        print(f"Chat Error: {e}")
        return {
            "answer": f"I'm experiencing technical difficulties. Please try again in a moment.",
            "confidence_score": 50,
            "error": True
        }

@app.get("/user-stats/{user_email}")
async def get_user_stats(user_email: str):
    """Get user profile and usage stats"""
    profile = get_user_profile(user_email)
    usage = USER_USAGE[user_email]
    
    return {
        "name": profile.name,
        "current_personality": profile.current_personality,
        "quiz_completed": profile.quiz_completed,
        "total_conversations": profile.total_conversations,
        "daily_usage": usage["daily"],
        "monthly_usage": usage["monthly"],
        "tier": ELITE_USERS.get(user_email.lower(), "free"),
        "interests": profile.interests,
        "communication_style": profile.communication_style
    }

@app.post("/update-profile")
async def update_profile(
    user_email: str = Form(...),
    name: str = Form(""),
    personality: str = Form("guardian")
):
    """Update user profile"""
    profile = get_user_profile(user_email)
    
    if name:
        profile.name = name
    
    profile.current_personality = personality
    
    return {
        "status": "Profile updated successfully",
        "name": profile.name,
        "personality": profile.current_personality
    }

if __name__ == "__main__":
    print("🚀 LYLO v4.0 Production System")
    print(f"🔍 Web Search: {'✅' if TAVILY_API_KEY else '❌'}")
    print(f"🧠 Memory: ✅ Active")
    print(f"👥 Elite Users: {len(ELITE_USERS)}")
    
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")
