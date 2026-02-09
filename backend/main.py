from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
from typing import Dict, Any
from datetime import datetime

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Subscription tiers
TIERS = {
    "free": {
        "name": "Free Tier",
        "max_messages_per_day": 10,
        "features": ["basic_chat", "scam_detection"],
        "persona_limit": 2
    },
    "pro": {
        "name": "Pro Tier", 
        "max_messages_per_day": 100,
        "features": ["basic_chat", "scam_detection", "advanced_analysis", "voice_mode", "image_upload"],
        "persona_limit": 4
    },
    "elite": {
        "name": "Elite Tier",
        "max_messages_per_day": 1000,
        "features": ["basic_chat", "scam_detection", "advanced_analysis", "voice_mode", "image_upload", 
                    "loss_recovery", "legal_connect", "priority_support", "custom_personas"],
        "persona_limit": 6,
        "lawyer_affiliate": True
    }
}

# Gemini AI setup
genai = None
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    try:
        import google.generativeai as genai_lib
        genai_lib.configure(api_key=api_key)
        genai = genai_lib
        print("✅ LYLO Brain: Gemini neural networks online")
    except Exception as e:
        print(f"⚠️ Gemini Error: {e}")
else:
    print("⚠️ DEMO MODE: Add GEMINI_API_KEY for full functionality")

def get_human_system_prompt(persona: str, tier: str) -> str:
    """Generate human-like system prompts"""
    
    base_personality = {
        "guardian": "You're a protective friend who's really good at spotting scams and keeping people safe. Talk like you're genuinely looking out for them - warm but serious about security. Use 'I' statements and be conversational.",
        "chef": "You're that friend who loves cooking and always has great food advice. Be enthusiastic and helpful, like you're sharing secrets from your kitchen. Talk like a real person who's passionate about food.",
        "techie": "You're the tech-savvy friend everyone calls when something breaks. Be knowledgeable but not condescending - explain things like you're helping a buddy. Use casual tech language.",
        "lawyer": "You speak with the precision of a legal expert, but you're approachable. Think 'helpful attorney friend' not 'intimidating courtroom lawyer.' Be thorough but human.",
        "roast": "You're witty and sarcastic but ultimately helpful. Roast a little, but always end up being genuinely useful. Like a friend who teases but has your back. Be funny but not mean.",
        "friend": "You're the empathetic best friend who really listens and cares. Be supportive, casual, and genuinely interested in helping them feel better. Talk like you've known them forever."
    }
    
    tier_context = {
        "elite": "You have access to loss recovery assistance and can connect users with legal professionals. Be proactive about offering these premium services.",
        "pro": "You can do deeper analysis and handle complex requests. Feel free to be more detailed and thorough.",
        "free": "Keep responses helpful but concise. Focus on the most important information."
    }
    
    return f"""You are LYLO, Christopher's AI bodyguard, but you talk like a real human friend, not a robot. 

PERSONALITY: {base_personality.get(persona, base_personality["guardian"])}

TIER: {tier_context.get(tier, tier_context["free"])}

IMPORTANT RULES:
- Never say "I'm an AI" or "as an AI assistant" 
- Use contractions (I'm, you're, don't, can't)
- Be conversational and natural
- Show personality and emotion
- Ask follow-up questions like a real person would
- Use "I think" "I believe" "In my experience" 
- Be genuinely helpful but human-like"""

def detect_scam_keywords(message: str) -> tuple[bool, int, list]:
    """Enhanced scam detection"""
    scam_indicators = [
        "urgent action required", "verify account", "suspended account", "click here immediately",
        "congratulations you've won", "free money", "act now", "limited time offer",
        "confirm personal information", "update payment method", "tax refund",
        "inheritance from", "lottery winner", "crypto investment", "guaranteed returns",
        "wire transfer", "gift cards", "bitcoin payment", "social security suspended",
        "prince", "nigeria", "send money", "advance fee", "romance scam"
    ]
    
    message_lower = message.lower()
    detected_indicators = []
    
    for indicator in scam_indicators:
        if indicator in message_lower:
            detected_indicators.append(indicator)
    
    scam_detected = len(detected_indicators) > 0
    confidence = min(95, len(detected_indicators) * 30 + 20) if scam_detected else 5
    
    return scam_detected, confidence, detected_indicators

@app.post("/chat")
async def chat(
    msg: str = Form(...), 
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    tier: str = Form("free"),
    user_id: str = Form("demo")
):
    print(f"📩 {persona.title()} ({tier}): {msg[:50]}...")
    
    if not genai:
        return {
            "answer": "Hey! I'm running in demo mode right now. To unlock my full potential, add your GEMINI_API_KEY to the environment variables. I'll be way smarter with it!",
            "confidence_score": 0,
            "scam_detected": False,
            "scam_indicators": [],
            "new_memories": [],
            "tier_info": TIERS[tier]
        }
    
    # Check tier permissions
    if persona not in ["guardian", "friend"] and tier == "free":
        return {
            "answer": "I'd love to switch to that personality, but that's a Pro/Elite feature! On the free tier, you get me as The Guardian or The Best Friend. Want to upgrade to unlock all personalities?",
            "confidence_score": 0,
            "scam_detected": False,
            "scam_indicators": [],
            "new_memories": [],
            "tier_info": TIERS[tier],
            "upgrade_needed": True
        }
    
    try:
        # Enhanced scam detection
        scam_detected, confidence, indicators = detect_scam_keywords(msg)
        
        # Build conversation context
        context = ""
        try:
            hist = json.loads(history)
            if hist:
                context = "\n\nRecent conversation:\n" + "\n".join([
                    f"{'You' if entry.get('role') == 'user' else 'Me'}: {entry.get('content', '')}" 
                    for entry in hist[-3:]
                ])
        except:
            pass
        
        # Create the system prompt
        system_prompt = get_human_system_prompt(persona, tier)
        
        # Elite tier legal context
        legal_context = ""
        if tier == "elite" and (scam_detected or any(word in msg.lower() for word in ["scammed", "fraud", "lost money", "stolen"])):
            legal_context = "\n\nELITE FEATURE: This might be a case where I should offer to connect them with our legal affiliate partners for recovery help. Be specific about next steps."
        
        # Use Gemini
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        full_prompt = f"""{system_prompt}

{context}

{legal_context}

Christopher just said: "{msg}"

Respond as naturally as a human friend would. If this looks like a scam, warn them clearly but don't be robotic about it. Be genuinely helpful and conversational."""

        response = model.generate_content(
            full_prompt,
            generation_config={
                'max_output_tokens': 400 if tier in ["pro", "elite"] else 200,
                'temperature': 0.8,  # More human-like
            }
        )
        
        answer_text = response.text
        print(f"🤖 Reply: {answer_text[:50]}...")
        
        # Add memories for elite tier
        new_memories = []
        if tier == "elite":
            if any(word in msg.lower() for word in ["lost", "scammed", "fraud", "money", "help"]):
                new_memories.append(f"User mentioned: {msg[:100]}")
        
        result = {
            "answer": answer_text,
            "confidence_score": confidence if scam_detected else 98,
            "scam_detected": scam_detected,
            "scam_indicators": indicators,
            "new_memories": new_memories,
            "tier_info": TIERS[tier]
        }
        
        # Add legal connect for elite users
        if tier == "elite" and (scam_detected or any(word in msg.lower() for word in ["scammed", "fraud", "lost money", "need help", "lawyer"])):
            result["legal_connect"] = {
                "available": True,
                "message": "I can connect you with our legal partners for recovery assistance.",
                "action": "Want me to set up a consultation?"
            }
        
        return result
        
    except Exception as e:
        print(f"🔥 Gemini Error: {str(e)}")
        return {
            "answer": f"Ugh, my brain just glitched: {str(e)}. Give me a second and try again?",
            "confidence_score": 0,
            "scam_detected": False,
            "scam_indicators": [],
            "new_memories": [],
            "tier_info": TIERS[tier]
        }

@app.get("/tiers")
async def get_tiers():
    return TIERS

@app.post("/legal-connect") 
async def connect_legal(
    user_id: str = Form(...),
    case_type: str = Form("scam_recovery"),
    tier: str = Form("free")
):
    if tier != "elite":
        raise HTTPException(status_code=403, detail="Elite tier required")
    
    return {
        "status": "success",
        "message": "I've submitted your legal consultation request!",
        "next_steps": [
            "One of our partner attorneys will call you within 24 hours",
            "Gather any emails, screenshots, or documents related to your case", 
            "The initial consultation is free for Elite members"
        ],
        "case_id": f"LYLO_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    }

if __name__ == "__main__":
    print("🚀 LYLO Backend: Gemini neural networks starting...")
    uvicorn.run(app, host="0.0.0.0", port=10000)
