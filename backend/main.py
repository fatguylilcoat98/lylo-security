from fastapi import FastAPI, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import hashlib
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
import asyncio
from dataclasses import dataclass, asdict
from collections import defaultdict

app = FastAPI(title="LYLO Backend", description="Privacy-First AI Security", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# EASY BETA TESTER SETUP - ADD EMAILS HERE
# =====================================================
ELITE_BETA_TESTERS = {
    "stangman9898@gmail.com": "elite",  # Christopher - Founder
    "aubrey@example.com": "elite",      # Add Aubrey
    "tiffani@example.com": "elite",     # Add Tiffani
    # ADD MORE BETA TESTERS HERE:
    # "friend@email.com": "elite",
    # "family@email.com": "pro",
}
# =====================================================

USER_LEARNING_CACHE = {}
USER_USAGE_TRACKING = defaultdict(lambda: {"daily": {}, "monthly": {}})

@dataclass
class UserUsage:
    messages_today: int = 0
    messages_this_month: int = 0
    last_reset_date: str = ""
    tier: str = "free"
    overages_this_month: int = 0
    total_cost_this_month: float = 0.0

TIERS = {
    "free": {
        "name": "Free Tier",
        "price": 0,
        "daily_limit": 5,
        "monthly_limit": 150,
        "features": ["basic_chat", "scam_detection"],
        "persona_limit": 2,
        "overage_price": 0,
        "description": "Essential protection with basic scam detection"
    },
    "pro": {
        "name": "Pro Tier", 
        "price": 9.99,
        "daily_limit": 50,
        "monthly_limit": 1500,
        "features": ["basic_chat", "scam_detection", "advanced_analysis", "voice_mode", "image_upload"],
        "persona_limit": 4,
        "overage_price": 0.10,
        "description": "Advanced protection with voice, image analysis, and enhanced detection"
    },
    "elite": {
        "name": "Elite Tier",
        "price": 29.99,
        "daily_limit": 99999,
        "monthly_limit": 99999,
        "features": ["basic_chat", "scam_detection", "advanced_analysis", "voice_mode", "image_upload", 
                    "loss_recovery", "legal_connect", "priority_support", "custom_personas", "24_7_monitoring"],
        "persona_limit": 6,
        "lawyer_affiliate": True,
        "overage_price": 0,
        "description": "Ultimate protection with legal recovery assistance and unlimited usage"
    }
}

# FIXED GEMINI SETUP
genai = None
model = None
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")

print(f"🔑 API Key Check: {'Found' if api_key else 'Missing'}")

if api_key:
    try:
        import google.generativeai as genai_lib
        genai_lib.configure(api_key=api_key)
        genai = genai_lib
        
        # TRY MULTIPLE MODEL NAMES
        models_to_try = ['gemini-1.5-pro', 'gemini-pro', 'gemini-1.5-flash-latest']
        
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                print(f"✅ LYLO Brain: {model_name} ONLINE")
                break
            except Exception as model_error:
                print(f"⚠️ Model {model_name} failed: {model_error}")
                continue
        
        if not model:
            print("⚠️ All models failed - using fallback")
            model = genai.GenerativeModel('gemini-pro')
            
    except ImportError as e:
        print(f"⚠️ Import Error: {e} - Install google-generativeai")
        genai = None
        model = None
    except Exception as e:
        print(f"⚠️ Gemini Setup Error: {e}")
        genai = None
        model = None
else:
    print("⚠️ DEMO MODE: No GEMINI_API_KEY found")

def create_user_hash(email: str) -> str:
    return hashlib.sha256(email.lower().encode()).hexdigest()[:16]

def get_user_tier(email: str) -> str:
    """Check if user is a beta tester with special access"""
    email_lower = email.lower().strip()
    
    # Check beta tester list
    if email_lower in ELITE_BETA_TESTERS:
        tier = ELITE_BETA_TESTERS[email_lower]
        print(f"🌟 Beta Tester Detected: {email_lower} -> {tier.upper()}")
        return tier
    
    return "free"

def get_user_usage(user_hash: str) -> UserUsage:
    today = datetime.now().strftime("%Y-%m-%d")
    
    if user_hash not in USER_USAGE_TRACKING:
        USER_USAGE_TRACKING[user_hash] = UserUsage(last_reset_date=today)
    
    usage = USER_USAGE_TRACKING[user_hash]
    
    if usage.last_reset_date != today:
        usage.messages_today = 0
        usage.last_reset_date = today
    
    return usage

def can_send_message(user_hash: str, tier: str) -> Tuple[bool, str, Dict]:
    usage = get_user_usage(user_hash)
    tier_config = TIERS.get(tier, TIERS["free"])
    
    if usage.messages_today >= tier_config["daily_limit"]:
        if tier == "free":
            return False, f"Daily limit reached ({tier_config['daily_limit']} messages). Upgrade to Pro for more!", {
                "can_send": False,
                "reason": "daily_limit",
                "messages_today": usage.messages_today,
                "daily_limit": tier_config["daily_limit"]
            }
        else:
            overage_cost = tier_config["overage_price"]
            return True, f"Over daily limit. This message will cost ${overage_cost}", {
                "can_send": True,
                "is_overage": True,
                "overage_cost": overage_cost,
                "messages_today": usage.messages_today,
                "daily_limit": tier_config["daily_limit"]
            }
    
    return True, "OK", {
        "can_send": True,
        "is_overage": False,
        "messages_today": usage.messages_today,
        "daily_limit": tier_config["daily_limit"],
        "remaining_today": tier_config["daily_limit"] - usage.messages_today
    }

def get_user_learning_profile(user_hash: str) -> Dict[str, Any]:
    if user_hash not in USER_LEARNING_CACHE:
        USER_LEARNING_CACHE[user_hash] = {
            "preferences": {},
            "interests": [],
            "communication_style": "friendly",
            "tech_level": "average",
            "location_preference": None,
            "learned_facts": [],
            "conversation_patterns": [],
            "last_updated": datetime.now().isoformat(),
            "total_messages": 0,
            "confidence_preferences": "medium"
        }
    return USER_LEARNING_CACHE[user_hash]

def update_user_learning(user_hash: str, message: str, tier: str) -> None:
    profile = get_user_learning_profile(user_hash)
    profile["total_messages"] += 1
    profile["last_updated"] = datetime.now().isoformat()
    
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["code", "programming", "server", "api", "github", "database"]):
        profile["tech_level"] = "advanced"
    elif any(word in message_lower for word in ["how do i", "what is", "explain", "help me understand"]):
        if profile["tech_level"] == "advanced":
            profile["tech_level"] = "intermediate"
        else:
            profile["tech_level"] = "beginner"
    
    if any(word in message_lower for word in ["please", "thank you", "appreciate", "kindly"]):
        profile["communication_style"] = "polite"
    elif any(word in message_lower for word in ["quick", "fast", "brief", "short", "tldr"]):
        profile["communication_style"] = "direct"
    elif any(word in message_lower for word in ["explain more", "details", "why", "how does", "tell me about"]):
        profile["communication_style"] = "detailed"
    
    if any(phrase in message_lower for phrase in ["are you sure", "how certain", "confidence", "percentage"]):
        profile["confidence_preferences"] = "high"
    elif any(phrase in message_lower for phrase in ["just tell me", "simple answer", "yes or no"]):
        profile["confidence_preferences"] = "low"

def get_confidence_explanation(confidence: int, user_profile: Dict) -> str:
    confidence_pref = user_profile.get("confidence_preferences", "medium")
    
    if confidence >= 95:
        base = "I'm very confident about this"
        if confidence_pref == "high":
            return f"{base} (98% sure based on multiple reliable sources and clear patterns)."
        elif confidence_pref == "low":
            return f"{base}."
        else:
            return f"{base} - this matches known scam patterns clearly."
    
    elif confidence >= 80:
        base = "I'm fairly confident about this"
        if confidence_pref == "high":
            return f"{base} ({confidence}% sure - some indicators present but need verification)."
        elif confidence_pref == "low":
            return f"{base}."
        else:
            return f"{base}, but you might want to double-check."
    
    elif confidence >= 60:
        base = "I'm somewhat unsure about this"
        if confidence_pref == "high":
            return f"{base} ({confidence}% confidence - mixed signals, recommend getting a second opinion)."
        elif confidence_pref == "low":
            return f"{base} - maybe ask someone else too."
        else:
            return f"{base}. I'd recommend asking someone you trust or calling the company directly."
    
    else:
        base = "I'm not confident about this"
        if confidence_pref == "high":
            return f"{base} ({confidence}% confidence - not enough clear information to make a reliable determination)."
        elif confidence_pref == "low":
            return f"{base} - definitely get help."
        else:
            return f"{base}. This is when you should definitely talk to someone you trust or call the official number."

def get_personalized_prompt(persona: str, tier: str, user_hash: str) -> str:
    profile = get_user_learning_profile(user_hash)
    
    base_personality = {
        "guardian": "You're a protective friend who's really good at spotting scams and keeping people safe. You're warm but serious about security, and you ALWAYS include confidence percentages with your answers.",
        "chef": "You're that friend who loves cooking and always has great food advice. Be enthusiastic and helpful, like you're sharing secrets from your kitchen.",
        "techie": "You're the tech-savvy friend everyone calls when something breaks. Be knowledgeable but not condescending - explain things clearly.",
        "lawyer": "You speak with the precision of a legal expert, but you're approachable. Be thorough but human, and always mention when they should talk to a real lawyer.",
        "roast": "You're witty and sarcastic but ultimately helpful. Roast a little, but always end up being genuinely useful. Be funny but not mean.",
        "friend": "You're the empathetic best friend who really listens and cares. Be supportive, casual, and genuinely interested in helping them."
    }
    
    return f"""You are LYLO, this person's AI bodyguard who talks like a real human friend, not a robot.

PERSONALITY: {base_personality.get(persona, base_personality["guardian"])}

CONFIDENCE RULES (CRITICAL):
- ALWAYS include a confidence percentage (0-100%) with your main answer
- Explain WHY you're confident or uncertain
- If confidence is below 80%, suggest they verify with someone else
- For scam detection, be especially clear about your confidence level

TIER: {tier.upper()} - {"Keep responses concise" if tier == "free" else "You can be more detailed" if tier in ["pro", "elite"] else ""}

CRITICAL RULES:
- NEVER say "I'm an AI" or mention being artificial
- Use contractions naturally (I'm, you're, don't, can't)
- Be conversational and show real personality
- Always include confidence percentages
- When uncertain, recommend human verification
- NEVER guess - if you don't know, say so with a low confidence score"""

def detect_scam_advanced(message: str) -> Tuple[bool, int, List[str], str]:
    high_risk_indicators = {
        "urgent_action": ["urgent action required", "account suspended", "verify immediately", "act now or lose"],
        "financial_pressure": ["wire transfer", "gift cards only", "bitcoin payment", "send money now"],
        "impersonation": ["irs calling", "social security suspended", "bank security", "tech support"],
        "too_good": ["congratulations you won", "free money", "inheritance waiting", "lottery winner"],
        "romance_scam": ["love you", "meet in person", "send money", "lonely", "soulmate"]
    }
    
    medium_risk_indicators = {
        "verification": ["confirm personal information", "update payment method", "verify account"],
        "investment": ["crypto investment", "guaranteed returns", "secret method", "easy money"],
        "phishing": ["click here", "suspicious activity", "confirm identity"]
    }
    
    message_lower = message.lower()
    detected_indicators = []
    risk_score = 0
    analysis = []
    
    for category, indicators in high_risk_indicators.items():
        for indicator in indicators:
            if indicator in message_lower:
                detected_indicators.append(f"HIGH RISK: {indicator}")
                risk_score += 25
                analysis.append(f"⚠️ Found '{indicator}' - this is a common {category.replace('_', ' ')} tactic")
    
    for category, indicators in medium_risk_indicators.items():
        for indicator in indicators:
            if indicator in message_lower:
                detected_indicators.append(f"MEDIUM RISK: {indicator}")
                risk_score += 15
                analysis.append(f"⚠️ Found '{indicator}' - often used in {category.replace('_', ' ')} attempts")
    
    scam_detected = risk_score >= 30
    confidence = min(98, risk_score + 20) if scam_detected else max(5, 95 - risk_score)
    
    detailed_analysis = " ".join(analysis) if analysis else "No obvious scam indicators detected."
    
    return scam_detected, confidence, detected_indicators, detailed_analysis

@app.get("/")
async def root():
    return {
        "status": "LYLO Backend Online - Privacy First",
        "version": "2.0.0",
        "features": ["Individual Learning", "Usage Tracking", "Confidence Scoring"],
        "active_users": len(USER_LEARNING_CACHE),
        "gemini_status": "Connected" if model else "Demo Mode",
        "api_key_status": "Found" if api_key else "Missing",
        "beta_testers": len(ELITE_BETA_TESTERS)
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
    user_hash = create_user_hash(user_email)
    
    # Override tier if user is beta tester
    actual_tier = get_user_tier(user_email)
    
    print(f"📩 {persona.title()} ({actual_tier}) from User-{user_hash[:8]}: {msg[:50]}...")
    
    can_send, reason, usage_info = can_send_message(user_hash, actual_tier)
    
    if not can_send:
        return {
            "answer": f"Hey there! {reason} I'd love to help more, but I need to keep the service sustainable. The Pro tier gives you 50 messages a day for just $9.99/month!",
            "confidence_score": 100,
            "scam_detected": False,
            "usage_info": usage_info,
            "upgrade_needed": True,
            "tier_info": TIERS[actual_tier]
        }
    
    usage = get_user_usage(user_hash)
    is_overage = usage_info.get("is_overage", False)
    
    update_user_learning(user_hash, msg, actual_tier)
    
    usage.messages_today += 1
    usage.messages_this_month += 1
    
    if not model:
        return {
            "answer": "Hey! I'm running in demo mode right now. Add your GEMINI_API_KEY environment variable to unlock my full potential! (This message didn't count against your limit.)",
            "confidence_score": 100,
            "usage_info": usage_info,
            "privacy_note": "Your conversations are private and temporary.",
            "debug_info": f"API Key: {'Found' if api_key else 'Missing'}, Model: {model}"
        }
    
    allowed_personas = {
        "free": ["guardian", "friend"],
        "pro": ["guardian", "friend", "chef", "techie"], 
        "elite": ["guardian", "friend", "chef", "techie", "lawyer", "roast"]
    }
    
    if persona not in allowed_personas.get(actual_tier, ["guardian"]):
        return {
            "answer": f"I'd love to be {persona} for you, but that's a {'Pro' if actual_tier == 'free' else 'Elite'} feature! Want to upgrade to unlock all my personalities?",
            "upgrade_needed": True,
            "available_personas": allowed_personas.get(actual_tier, ["guardian"]),
            "usage_info": usage_info
        }
    
    try:
        scam_detected, confidence, indicators, detailed_analysis = detect_scam_advanced(msg)
        
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
        
        user_profile = get_user_learning_profile(user_hash)
        system_prompt = get_personalized_prompt(persona, actual_tier, user_hash)
        
        full_prompt = f"""{system_prompt}

{context}

SCAM ANALYSIS: {detailed_analysis}

They just said: "{msg}"

Respond naturally as a human friend. Include your confidence percentage prominently in your response. If this looks like a scam, warn them clearly with your confidence level."""

        response = model.generate_content(
            full_prompt,
            generation_config={
                'max_output_tokens': 600 if actual_tier == "elite" else 400 if actual_tier == "pro" else 250,
                'temperature': 0.8,
                'top_p': 0.8
            }
        )
        
        answer_text = response.text.strip()
        confidence_explanation = get_confidence_explanation(confidence, user_profile)
        
        result = {
            "answer": answer_text,
            "confidence_score": confidence,
            "confidence_explanation": confidence_explanation,
            "scam_detected": scam_detected,
            "scam_indicators": indicators,
            "detailed_analysis": detailed_analysis,
            "tier_info": TIERS[actual_tier],
            "usage_info": {
                **usage_info,
                "messages_today": usage.messages_today,
                "is_overage": is_overage,
                "current_tier": actual_tier
            },
            "personalization_active": True
        }
        
        return result
        
    except Exception as e:
        print(f"🔥 Error: {str(e)}")
        return {
            "answer": f"My brain just glitched: {str(e)}. Try again in a moment?",
            "confidence_score": 0,
            "error": True,
            "usage_info": usage_info
        }

# Simple endpoint to check beta tester status
@app.get("/check-access/{user_email}")
async def check_access(user_email: str):
    tier = get_user_tier(user_email)
    return {
        "email": user_email,
        "tier": tier,
        "is_beta_tester": tier != "free",
        "features": TIERS[tier]["features"]
    }

if __name__ == "__main__":
    print("🚀 LYLO Backend: Complete System Starting")
    print("🔒 Privacy Features: Individual learning, usage tracking, confidence scoring")
    print("💰 Monetization: Tiered pricing with overage handling")
    print("🎯 Features: Personalized AI, scam detection, legal integration")
    print(f"👥 Beta Testers: {len(ELITE_BETA_TESTERS)} configured")
    
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")