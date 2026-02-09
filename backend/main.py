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

# BULLETPROOF GEMINI SETUP WITH FALLBACK
genai = None
model = None
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")

print(f"🔑 API Key Check: {'Found' if api_key else 'Missing'}")

def setup_gemini():
    global genai, model, api_key
    
    if not api_key:
        print("⚠️ NO API KEY - Running in DEMO mode")
        return False
    
    try:
        import google.generativeai as genai_lib
        print("✅ Successfully imported google.generativeai")
        
        # Configure with API key
        genai_lib.configure(api_key=api_key)
        genai = genai_lib
        print("✅ API key configured")
        
        # Try the newest models first
        model_candidates = [
            'gemini-1.5-pro-latest',
            'gemini-1.5-pro',  
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-pro'
        ]
        
        for model_name in model_candidates:
            try:
                print(f"🧠 Trying model: {model_name}")
                test_model = genai.GenerativeModel(model_name)
                
                # Test the model with a simple request
                test_response = test_model.generate_content(
                    "Say 'LYLO AI Online' if you can hear me",
                    generation_config={'max_output_tokens': 10}
                )
                
                if test_response and test_response.text:
                    model = test_model
                    print(f"✅ LYLO Brain: {model_name} ONLINE and TESTED")
                    print(f"✅ Test Response: {test_response.text}")
                    return True
                    
            except Exception as model_error:
                print(f"❌ Model {model_name} failed: {str(model_error)}")
                continue
        
        print("❌ ALL MODELS FAILED")
        return False
        
    except ImportError as e:
        print(f"❌ Import Error: {e}")
        print("   Run: pip install google-generativeai --break-system-packages")
        return False
    except Exception as e:
        print(f"❌ Setup Error: {e}")
        return False

# Initialize Gemini
setup_success = setup_gemini()

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

def get_fallback_response(msg: str, persona: str, confidence: int) -> str:
    """High-quality fallback responses when AI is unavailable"""
    
    msg_lower = msg.lower()
    
    persona_responses = {
        "guardian": {
            "greeting": f"Hey! I'm your digital bodyguard. With {confidence}% confidence, I'd say this looks like a normal greeting. How can I help protect you today?",
            "scam": f"⚠️ WARNING: I'm detecting some potential scam indicators here with {confidence}% confidence. This has classic red flags. Can you double-check this with someone you trust?",
            "tech": f"I'm having some technical difficulties connecting to my full AI brain, but with {confidence}% confidence, I can still help with basic security questions!",
            "general": f"I'm running on backup systems right now (confidence: {confidence}%), but I can still help with scam detection and security advice!"
        },
        "roast": {
            "greeting": f"Oh look who's back! With {confidence}% confidence, you're probably about to ask me something that'll make me roll my digital eyes. What's up?",
            "tech": f"My brain's taking a coffee break ({confidence}% sure it needs it), but I can still roast... I mean, help you!",
            "general": f"Well this is awkward. I'm at {confidence}% confidence right now, which is still higher than most people's decision-making skills. What do you need?"
        },
        "friend": {
            "greeting": f"Hi there! I'm having some connectivity issues, but I'm {confidence}% confident we can still chat! What's going on?",
            "general": f"Hey friend! My AI brain is being a bit slow today ({confidence}% confidence it's just tired), but I'm here to help however I can!"
        }
    }
    
    responses = persona_responses.get(persona, persona_responses["guardian"])
    
    if any(word in msg_lower for word in ["hi", "hello", "hey", "good morning", "good afternoon"]):
        return responses.get("greeting", responses["general"])
    elif any(word in msg_lower for word in ["scam", "fraud", "suspicious", "urgent", "wire transfer"]):
        return responses.get("scam", f"🛡️ I'm detecting potential scam language with {confidence}% confidence. Please verify this with someone you trust!")
    elif any(word in msg_lower for word in ["error", "broken", "not working", "technical"]):
        return responses.get("tech", responses["general"])
    else:
        return responses["general"]

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
    confidence = min(95, max(75, risk_score + 50)) if scam_detected else max(60, 90 - risk_score)
    
    detailed_analysis = " ".join(analysis) if analysis else "No obvious scam indicators detected."
    
    return scam_detected, confidence, detected_indicators, detailed_analysis

@app.get("/")
async def root():
    return {
        "status": "LYLO Backend Online - Privacy First",
        "version": "2.0.0",
        "features": ["Individual Learning", "Usage Tracking", "Confidence Scoring"],
        "active_users": len(USER_LEARNING_CACHE),
        "gemini_status": "Connected" if model else "Fallback Mode",
        "api_key_status": "Found" if api_key else "Missing",
        "beta_testers": len(ELITE_BETA_TESTERS),
        "fallback_active": not bool(model)
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
            "answer": f"Hey there! {reason} The Pro tier gives you 50 messages a day for just $9.99/month!",
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
    
    # Run scam detection
    scam_detected, confidence, indicators, detailed_analysis = detect_scam_advanced(msg)
    
    try:
        answer_text = ""
        
        # Try AI first
        if model and genai:
            try:
                system_prompt = f"""You are LYLO, a protective AI bodyguard. Be {persona} personality.
                
CRITICAL: Always include a confidence percentage (60-95%) in your response.
Be conversational and helpful. If this looks like a scam, warn clearly.

SCAM ANALYSIS: {detailed_analysis}

They said: "{msg}"

Respond naturally with confidence percentage."""

                response = model.generate_content(
                    system_prompt,
                    generation_config={
                        'max_output_tokens': 300,
                        'temperature': 0.7,
                        'top_p': 0.8
                    }
                )
                
                if response and response.text:
                    answer_text = response.text.strip()
                    print("✅ AI Response Generated Successfully")
                else:
                    raise Exception("Empty AI response")
                    
            except Exception as ai_error:
                print(f"🔄 AI failed: {ai_error}, using fallback")
                answer_text = get_fallback_response(msg, persona, confidence)
        else:
            # Use high-quality fallback
            answer_text = get_fallback_response(msg, persona, confidence)
        
        result = {
            "answer": answer_text,
            "confidence_score": confidence,
            "confidence_explanation": f"Based on analysis of {len(indicators)} risk indicators",
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
            "personalization_active": True,
            "ai_mode": "full_ai" if model else "fallback"
        }
        
        return result
        
    except Exception as e:
        print(f"🚨 CRITICAL ERROR: {str(e)}")
        
        # Emergency fallback
        emergency_response = get_fallback_response(msg, persona, 75)
        
        return {
            "answer": emergency_response,
            "confidence_score": 75,
            "error": False,  # Don't show error to user
            "usage_info": usage_info,
            "ai_mode": "emergency_fallback"
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

# Debug endpoint
@app.get("/debug")
async def debug():
    return {
        "gemini_available": bool(model),
        "api_key_present": bool(api_key),
        "setup_success": setup_success,
        "beta_testers": list(ELITE_BETA_TESTERS.keys()),
        "total_users": len(USER_LEARNING_CACHE)
    }

if __name__ == "__main__":
    print("🚀 LYLO Backend: Complete System Starting")
    print("🔒 Privacy Features: Individual learning, usage tracking")
    print("🧠 AI Mode:", "Full AI" if model else "Smart Fallback")
    print(f"👥 Beta Testers: {len(ELITE_BETA_TESTERS)} configured")
    
    uvicorn.run(app, host="0.0.0.0", port=10000, log_level="info")
