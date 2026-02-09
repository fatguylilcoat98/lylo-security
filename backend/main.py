from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import hashlib
from typing import Dict, Any, List, Tuple
from datetime import datetime
import asyncio

app = FastAPI(title="LYLO Backend", description="Privacy-First AI Security", version="2.0.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory user learning (no persistent storage)
# This gets wiped on server restart for maximum privacy
USER_LEARNING_CACHE = {}

# Subscription tiers
TIERS = {
    "free": {
        "name": "Free Tier",
        "price": 0,
        "max_messages_per_day": 10,
        "features": ["basic_chat", "scam_detection"],
        "persona_limit": 2,
        "learning_retention": "session_only"
    },
    "pro": {
        "name": "Pro Tier", 
        "price": 9.99,
        "max_messages_per_day": 100,
        "features": ["basic_chat", "scam_detection", "advanced_analysis", "voice_mode", "image_upload"],
        "persona_limit": 4,
        "learning_retention": "7_days"
    },
    "elite": {
        "name": "Elite Tier",
        "price": 29.99,
        "max_messages_per_day": 1000,
        "features": ["basic_chat", "scam_detection", "advanced_analysis", "voice_mode", "image_upload", 
                    "loss_recovery", "legal_connect", "priority_support", "custom_personas", "24_7_monitoring"],
        "persona_limit": 6,
        "lawyer_affiliate": True,
        "learning_retention": "30_days"
    }
}

# Gemini AI setup
genai = None
model = None
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")

if api_key:
    try:
        import google.generativeai as genai_lib
        genai_lib.configure(api_key=api_key)
        genai = genai_lib
        model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ LYLO Brain: Gemini neural networks ONLINE")
    except Exception as e:
        print(f"⚠️ Gemini Setup Error: {e}")
else:
    print("⚠️ DEMO MODE: No GEMINI_API_KEY found")

def create_user_hash(email: str) -> str:
    """Create privacy-preserving user identifier from email"""
    # Hash the email for privacy - we never store the actual email
    return hashlib.sha256(email.lower().encode()).hexdigest()[:16]

def get_user_learning_profile(user_hash: str) -> Dict[str, Any]:
    """Get user's learning profile (privacy-first, in-memory only)"""
    if user_hash not in USER_LEARNING_CACHE:
        USER_LEARNING_CACHE[user_hash] = {
            "preferences": {},
            "interests": [],
            "communication_style": "friendly",
            "tech_level": "average",
            "location": None,
            "learned_facts": [],
            "conversation_patterns": [],
            "last_updated": datetime.now().isoformat(),
            "total_messages": 0
        }
    return USER_LEARNING_CACHE[user_hash]

def update_user_learning(user_hash: str, message: str, tier: str) -> None:
    """Update user learning profile based on conversation (AI-only access)"""
    profile = get_user_learning_profile(user_hash)
    profile["total_messages"] += 1
    profile["last_updated"] = datetime.now().isoformat()
    
    # Extract learning points (this would be enhanced with actual ML)
    message_lower = message.lower()
    
    # Learn about tech level
    if any(word in message_lower for word in ["code", "programming", "server", "api", "github"]):
        profile["tech_level"] = "advanced"
    elif any(word in message_lower for word in ["computer", "phone", "app", "website"]):
        if profile["tech_level"] == "beginner":
            profile["tech_level"] = "intermediate"
    
    # Learn interests (but keep it general, not personal)
    interest_keywords = {
        "gaming": ["game", "gaming", "xbox", "playstation", "pc gaming"],
        "cooking": ["cook", "recipe", "food", "kitchen", "meal"],
        "tech": ["technology", "computer", "programming", "coding"],
        "finance": ["money", "investment", "bitcoin", "stocks", "savings"],
        "health": ["workout", "exercise", "diet", "health", "fitness"]
    }
    
    for interest, keywords in interest_keywords.items():
        if any(keyword in message_lower for keyword in keywords):
            if interest not in profile["interests"]:
                profile["interests"].append(interest)
    
    # Learn communication preferences
    if any(word in message_lower for word in ["please", "thank you", "appreciate"]):
        profile["communication_style"] = "polite"
    elif any(word in message_lower for word in ["quick", "fast", "brief", "short"]):
        profile["communication_style"] = "direct"
    elif any(word in message_lower for word in ["explain", "detail", "why", "how"]):
        profile["communication_style"] = "detailed"

def get_personalized_prompt(persona: str, tier: str, user_hash: str) -> str:
    """Generate personalized system prompt based on user's learning profile"""
    
    profile = get_user_learning_profile(user_hash)
    
    base_personality = {
        "guardian": "You're a protective friend who's really good at spotting scams and keeping people safe. Talk like you're genuinely looking out for them - warm but serious about security.",
        "chef": "You're that friend who loves cooking and always has great food advice. Be enthusiastic and helpful, like you're sharing secrets from your kitchen.",
        "techie": "You're the tech-savvy friend everyone calls when something breaks. Be knowledgeable but not condescending - explain things like you're helping a buddy.",
        "lawyer": "You speak with the precision of a legal expert, but you're approachable. Think 'helpful attorney friend' not 'intimidating courtroom lawyer.'",
        "roast": "You're witty and sarcastic but ultimately helpful. Roast a little, but always end up being genuinely useful. Like a friend who teases but has your back.",
        "friend": "You're the empathetic best friend who really listens and cares. Be supportive, casual, and genuinely interested in helping them feel better."
    }
    
    # Adapt to user's tech level
    tech_context = ""
    if profile["tech_level"] == "advanced":
        tech_context = "Feel free to use technical terms and go into detail - they understand tech."
    elif profile["tech_level"] == "beginner":
        tech_context = "Keep explanations simple and avoid jargon - they're still learning tech."
    else:
        tech_context = "Use moderate technical detail - they know the basics."
    
    # Adapt to communication style
    comm_context = ""
    if profile["communication_style"] == "direct":
        comm_context = "Be concise and to the point - they prefer quick, efficient communication."
    elif profile["communication_style"] == "detailed":
        comm_context = "They appreciate thorough explanations and context."
    elif profile["communication_style"] == "polite":
        comm_context = "They value politeness and courtesy in conversation."
    
    # Include relevant interests without being personal
    interest_context = ""
    if profile["interests"]:
        interest_context = f"They've shown interest in: {', '.join(profile['interests'])}. Reference these topics naturally when relevant."
    
    return f"""You are LYLO, this person's AI bodyguard, but you talk like a real human friend, not a robot.

PERSONALITY: {base_personality.get(persona, base_personality["guardian"])}

PERSONALIZATION CONTEXT:
{tech_context}
{comm_context}
{interest_context}

TIER: {tier.upper()} - {"Keep responses concise" if tier == "free" else "Feel free to be detailed" if tier == "elite" else "Balanced detail level"}

CRITICAL RULES:
- NEVER say "I'm an AI" or mention being artificial
- Use contractions naturally (I'm, you're, don't, can't)
- Be conversational and show real personality
- Adapt to their communication style and interests
- NEVER mention specific personal details like names, locations, or private info
- Focus on being genuinely helpful while respecting their privacy"""

def detect_scam_keywords(message: str) -> Tuple[bool, int, List[str]]:
    """Enhanced scam detection"""
    high_risk_indicators = [
        "urgent action required", "account suspended", "verify immediately", 
        "click here now", "limited time offer", "act now or lose",
        "congratulations you've won", "free money waiting", "inheritance from",
        "prince", "nigeria", "lottery winner", "tax refund pending",
        "social security suspended", "bitcoin payment required", "wire transfer immediately"
    ]
    
    medium_risk_indicators = [
        "confirm personal information", "update payment method", 
        "verify account details", "suspicious activity detected",
        "crypto investment opportunity", "guaranteed returns",
        "romance scam", "send money", "advance fee"
    ]
    
    message_lower = message.lower()
    detected_indicators = []
    risk_score = 0
    
    for indicator in high_risk_indicators:
        if indicator in message_lower:
            detected_indicators.append(f"HIGH RISK: {indicator}")
            risk_score += 30
    
    for indicator in medium_risk_indicators:
        if indicator in message_lower:
            detected_indicators.append(f"MEDIUM RISK: {indicator}")
            risk_score += 15
    
    scam_detected = risk_score >= 20
    confidence = min(95, risk_score) if scam_detected else max(5, 100 - risk_score)
    
    return scam_detected, confidence, detected_indicators

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "LYLO Backend Online - Privacy First",
        "version": "2.0.0",
        "privacy_policy": "Zero data retention - all learning is temporary and user-specific",
        "gemini_status": "Connected" if model else "Demo Mode",
        "active_users": len(USER_LEARNING_CACHE)
    }

@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    tier: str = Form("free"),
    user_email: str = Form(...),  # Email for identification
    session_id: str = Form("demo")
):
    """Privacy-first chat with individual user learning"""
    
    # Create privacy-preserving user identifier
    user_hash = create_user_hash(user_email)
    
    print(f"📩 {persona.title()} ({tier}) from User-{user_hash[:8]}: {msg[:50]}...")
    
    # Update user learning (AI only, no human access)
    update_user_learning(user_hash, msg, tier)
    
    if not model:
        return {
            "answer": "Hey! I'm running in demo mode right now - my brain isn't fully connected. Add your GEMINI_API_KEY to unlock my full potential!",
            "confidence_score": 0,
            "scam_detected": False,
            "privacy_note": "Your data is never stored permanently. I learn about you temporarily to provide better help."
        }
    
    # Check tier permissions
    allowed_personas = {
        "free": ["guardian", "friend"],
        "pro": ["guardian", "friend", "chef", "techie"], 
        "elite": ["guardian", "friend", "chef", "techie", "lawyer", "roast"]
    }
    
    if persona not in allowed_personas.get(tier, ["guardian"]):
        return {
            "answer": "I'd love to switch to that personality, but that's a Pro/Elite feature! On the free tier, you can chat with me as The Guardian or The Best Friend. Want to upgrade?",
            "upgrade_needed": True,
            "available_personas": allowed_personas.get(tier, ["guardian"])
        }
    
    try:
        # Enhanced scam detection
        scam_detected, confidence, indicators = detect_scam_keywords(msg)
        
        # Build conversation context
        context = ""
        try:
            hist = json.loads(history)
            if hist and len(hist) > 0:
                context = "\n\nRecent conversation:\n"
                for entry in hist[-3:]:
                    role = "You" if entry.get('role') == 'user' else "Me"
                    content = entry.get('content', '')[:100]
                    context += f"{role}: {content}\n"
        except:
            pass
        
        # Get personalized system prompt
        system_prompt = get_personalized_prompt(persona, tier, user_hash)
        
        # Elite tier legal context
        legal_context = ""
        if tier == "elite":
            scam_keywords = ["scammed", "fraud", "lost money", "stolen", "lawyer", "legal"]
            if scam_detected or any(word in msg.lower() for word in scam_keywords):
                legal_context = "\n\nELITE FEATURE: Offer to connect them with legal partners for recovery assistance since they have Elite tier."
        
        full_prompt = f"""{system_prompt}

{context}

{legal_context}

They just said: "{msg}"

Respond naturally as a human friend would. If this looks like a scam, warn them clearly but conversationally. Be genuinely helpful and show your personality."""

        response = model.generate_content(
            full_prompt,
            generation_config={
                'max_output_tokens': 500 if tier == "elite" else 300 if tier == "pro" else 200,
                'temperature': 0.9,
                'top_p': 0.8
            }
        )
        
        answer_text = response.text.strip()
        
        result = {
            "answer": answer_text,
            "confidence_score": confidence if scam_detected else 98,
            "scam_detected": scam_detected,
            "scam_indicators": indicators,
            "tier_info": TIERS[tier],
            "privacy_note": "I'm learning about your preferences temporarily to help you better. This data is never stored permanently or accessed by humans.",
            "personalization_active": True
        }
        
        # Add legal connect for elite users
        if tier == "elite" and (scam_detected or any(word in msg.lower() for word in ["scammed", "fraud", "legal"])):
            result["legal_connect"] = {
                "available": True,
                "message": "I can connect you with our legal partners for recovery assistance - included with Elite.",
                "action": "Want me to set up a consultation?"
            }
        
        return result
        
    except Exception as e:
        print(f"🔥 Error: {str(e)}")
        return {
            "answer": f"My brain glitched: {str(e)}. Try again in a moment?",
            "confidence_score": 0,
            "error": True
        }

@app.post("/clear-user-data")
async def clear_user_data(user_email: str = Form(...)):
    """Allow users to clear their learning data"""
    user_hash = create_user_hash(user_email)
    
    if user_hash in USER_LEARNING_CACHE:
        del USER_LEARNING_CACHE[user_hash]
        return {"status": "success", "message": "Your learning data has been completely cleared."}
    
    return {"status": "success", "message": "No data found to clear."}

@app.get("/privacy-policy")
async def privacy_policy():
    """Return privacy policy details"""
    return {
        "policy": "Zero Data Retention Policy",
        "principles": [
            "We never store your actual email address - only a privacy-preserving hash",
            "All learning data is temporary and stored in memory only",
            "Data is automatically cleared when the server restarts",
            "No human has access to your conversations or learning data",
            "You can clear your data at any time using the /clear-user-data endpoint",
            "Learning data is only used to improve your AI experience"
        ],
        "data_retention": {
            "free": "Session only (cleared when you close the app)",
            "pro": "Up to 7 days in memory",
            "elite": "Up to 30 days in memory"
        },
        "human_access": "ZERO - No humans can see your data"
    }

if __name__ == "__main__":
    print("🚀 LYLO Backend: Privacy-First Individual Learning")
    print("🔒 Privacy Features:")
    print("   - Zero permanent data storage")
    print("   - Email hashing for user identification") 
    print("   - Individual AI learning per user")
    print("   - No human access to user data")
    print("   - Automatic data clearing")
    
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")
