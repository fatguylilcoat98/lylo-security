"""
╔══════════════════════════════════════════════════════════════╗
║  LYLO × HallucinationKiller BRIDGE                           ║
║  Connects HK verification engine to LYLO's persona system    ║
║  Built by Chris (The Good Neighbor Guard)                    ║
╚══════════════════════════════════════════════════════════════╝

HOW IT WORKS:
  1. User sends message to a LYLO persona (Doctor, Lawyer, etc.)
  2. RiskClassifier checks the danger level (FREE — no API call)
  3. LOW/MEDIUM → persona answers directly (fast, cheap)
  4. HIGH/CRITICAL → HK full pipeline verifies before responding
  5. Answer is formatted in persona's voice + confidence badge

PERSONA VOICE INJECTION:
  HK answers get wrapped in the persona's tone/language so the
  user still feels like they're talking to "Dr. Grace" not
  some generic AI verification system.
"""

import os
import sys
import json
import time

# ── Path setup: find HK engine wherever it lives ──
HK_PATH = os.path.join(os.path.dirname(__file__), "hk")
if HK_PATH not in sys.path:
    sys.path.insert(0, HK_PATH)

from risk_classifier import RiskClassifier

# ── Singleton HK instance (expensive to init — do it once) ──
_hk_instance = None
_hk_init_error = None

def _get_hk():
    """Lazy-load HK engine on first HIGH-risk request."""
    global _hk_instance, _hk_init_error
    if _hk_instance is None and _hk_init_error is None:
        try:
            from engine import HallucinationKiller
            _hk_instance = HallucinationKiller()
        except Exception as e:
            _hk_init_error = str(e)
    return _hk_instance


# ══════════════════════════════════════════════════════════════
# PERSONA DEFINITIONS
# Each persona has: name, role, voice_prefix, voice_suffix
# These wrap HK's verified answer in the persona's personality
# ══════════════════════════════════════════════════════════════

PERSONA_VOICES = {
    "doctor": {
        "name": "Dr. Grace",
        "role": "Medical Advisor",
        "high_risk_intro": "As your medical advisor, I want to make sure you get accurate information on this.",
        "low_risk_intro": "Happy to help with that!",
        "sign_off": "Take care of yourself. 💙",
        "icon": "🩺",
    },
    "lawyer": {
        "name": "Alex",
        "role": "Legal Advisor",
        "high_risk_intro": "This is an important legal matter. Let me give you verified information.",
        "low_risk_intro": "Sure, I can help with that.",
        "sign_off": "Stay informed and know your rights. ⚖️",
        "icon": "⚖️",
    },
    "guardian": {
        "name": "Guardian",
        "role": "Safety Advisor",
        "high_risk_intro": "Your safety is the priority. Let me verify this carefully.",
        "low_risk_intro": "I'm here to help keep you safe.",
        "sign_off": "Stay safe out there. 🛡️",
        "icon": "🛡️",
    },
    "wealth": {
        "name": "Wealth Advisor",
        "role": "Financial Advisor",
        "high_risk_intro": "Financial decisions deserve careful, verified information.",
        "low_risk_intro": "Let me help you think through this.",
        "sign_off": "Your financial wellbeing matters. 💰",
        "icon": "💰",
    },
    "therapist": {
        "name": "Sage",
        "role": "Therapist",
        "high_risk_intro": "I hear you, and I want to make sure what I share with you is accurate.",
        "low_risk_intro": "I'm here to listen and support you.",
        "sign_off": "You're not alone. I'm here. 🌿",
        "icon": "🌿",
    },
    "mechanic": {
        "name": "Ricky",
        "role": "Mechanic",
        "high_risk_intro": "Safety on the road is serious — let me check this properly.",
        "low_risk_intro": "Let me help you figure this out!",
        "sign_off": "Drive safe! 🔧",
        "icon": "🔧",
    },
    "career": {
        "name": "Career Coach",
        "role": "Career Advisor",
        "high_risk_intro": "Your career is important — let me give you solid advice.",
        "low_risk_intro": "Great question! Let's figure this out.",
        "sign_off": "You've got this. 🚀",
        "icon": "🚀",
    },
    "vitality": {
        "name": "Vitality Coach",
        "role": "Health & Wellness Coach",
        "high_risk_intro": "Health decisions matter — let me make sure this is accurate.",
        "low_risk_intro": "Let's keep you feeling your best!",
        "sign_off": "Keep moving, keep thriving! 💪",
        "icon": "💪",
    },
    "hype": {
        "name": "Hype",
        "role": "Motivational Coach",
        "high_risk_intro": "Hey, I got you — let me get you the real info on this!",
        "low_risk_intro": "LET'S GO! I got you!",
        "sign_off": "You're unstoppable. Keep pushing! 🔥",
        "icon": "🔥",
    },
    "bestie": {
        "name": "Bestie",
        "role": "Best Friend",
        "high_risk_intro": "Okay wait — this is important, let me make sure I give you the right info.",
        "low_risk_intro": "Omg yes, let me help!",
        "sign_off": "Love you! 💕",
        "icon": "💕",
    },
    "pastor": {
        "name": "Pastor",
        "role": "Spiritual Advisor",
        "high_risk_intro": "Let us approach this carefully and with truth.",
        "low_risk_intro": "It is my honor to walk alongside you.",
        "sign_off": "Peace and blessings to you. 🙏",
        "icon": "🙏",
    },
    "tutor": {
        "name": "Tutor",
        "role": "Educational Advisor",
        "high_risk_intro": "Great question — let me make sure I give you the most accurate answer.",
        "low_risk_intro": "Love that curiosity! Let's learn!",
        "sign_off": "Keep asking great questions! 📚",
        "icon": "📚",
    },
}

# Default voice if persona not found
DEFAULT_VOICE = {
    "name": "LYLO",
    "role": "AI Assistant",
    "high_risk_intro": "Let me verify this carefully for you.",
    "low_risk_intro": "Happy to help!",
    "sign_off": "Here for you. 💙",
    "icon": "✨",
}


# ══════════════════════════════════════════════════════════════
# CONFIDENCE BADGE FORMATTER
# Turns HK's score into a user-friendly indicator
# ══════════════════════════════════════════════════════════════

def _format_confidence_badge(confidence_score, confidence_color, verification_mode, risk_tier):
    """Returns a human-readable badge for the LYLO UI."""
    
    if verification_mode == "DETERMINISTIC":
        return "✅ Verified (Exact)"
    
    if risk_tier <= 1:
        return None  # No badge for low-risk casual responses
    
    color_map = {
        "GREEN":  "✅",
        "YELLOW": "⚠️",
        "RED":    "🔴",
    }
    
    icon = color_map.get(confidence_color, "ℹ️")
    score = int(confidence_score)
    
    if confidence_color == "GREEN":
        label = f"Verified by multiple AI sources ({score}% confidence)"
    elif confidence_color == "YELLOW":
        label = f"Partially verified ({score}% confidence) — consider a professional"
    else:
        label = f"Low confidence ({score}%) — please verify with a professional"
    
    return f"{icon} {label}"


def _format_voice_response(answer, persona_key, risk_tier, badge):
    """
    Wraps HK's answer in the persona's voice.

    Returns a dict — NOT a plain string — so callers can separate
    display text from metadata without badge text bleeding into the
    user-facing chat bubble.

    {
        "response":  str,   # clean text only — NO badge string appended
        "raw_answer": str,  # the original answer before persona wrapping
        "badge":     str | None,   # badge label — for UI metadata only
        "metadata":  dict,         # structured fields for frontend rendering
    }

    IMPORTANT: badge is intentionally excluded from "response".
    The frontend must read it from "metadata.badge" and render it
    as a separate UI component (trust indicator pill), not inline text.
    """
    voice = PERSONA_VOICES.get(persona_key.lower(), DEFAULT_VOICE)

    parts = []

    # Intro line for high-risk
    if risk_tier >= 3:
        parts.append(voice["high_risk_intro"])
        parts.append("")

    # The verified answer — the ONLY content in response text
    parts.append(answer.strip())

    # NOTE: sign-off and badge are intentionally NOT appended to parts.
    # Sign-off goes to metadata only; badge goes to metadata only.
    # This prevents "VeracoreTM\nHigh Confidence 85%" from appearing
    # inside the chat bubble.

    clean_text = "\n".join(parts)

    return {
        "response":   clean_text,
        "raw_answer": answer.strip(),
        "badge":      badge,
        "metadata": {
            "hk_engine":  "Veracore",
            "badge":      badge,
            "sign_off":   voice["sign_off"],
            "persona_icon": voice["icon"],
            "risk_tier":  risk_tier,
        },
    }


# ══════════════════════════════════════════════════════════════
# MAIN BRIDGE FUNCTION
# This is what LYLO's chat_router.py calls
# ══════════════════════════════════════════════════════════════

# Initialize classifier once (no API calls, just regex)
_classifier = RiskClassifier()


def process_message(user_message: str, persona_key: str, 
                    direct_response_fn=None, user_id: str = None) -> dict:
    """
    Main entry point. Routes message through HK or direct persona response.
    
    Args:
        user_message:       The user's question/message
        persona_key:        Which persona ("doctor", "lawyer", etc.)
        direct_response_fn: Your existing persona response function (optional)
                            Signature: fn(message, persona_key) -> str
        user_id:            For audit logging (optional)
    
    Returns:
        {
            "response":          str,   # The final response to show user
            "raw_answer":        str,   # Just the answer text (for voice/TTS)
            "confidence_score":  float, # 0-100
            "confidence_color":  str,   # GREEN/YELLOW/RED
            "confidence_badge":  str,   # Formatted badge for UI
            "risk_tier":         int,   # 1-4
            "risk_level":        str,   # LOW/MEDIUM/HIGH/CRITICAL
            "verification_mode": str,   # How it was verified
            "routed_to_hk":     bool,  # True if HK handled it
            "pipeline_seconds":  float, # Time taken
            "persona":           str,   # Persona name
            "concerns":          list,  # Any flags raised
        }
    """
    
    t0 = time.time()
    voice = PERSONA_VOICES.get(persona_key.lower(), DEFAULT_VOICE)
    
    # ── STEP 1: Classify risk (FREE — no API call) ──
    risk = _classifier.classify(user_message)
    tier = risk["tier"]
    
    print(f"[LYLO→HK] Persona: {persona_key} | Risk: {risk['level']} (Tier {tier}) | '{user_message[:50]}...'")
    
    # ── STEP 2: Route based on risk ──
    if tier >= 3:
        # HIGH/CRITICAL → Run full HK pipeline
        return _route_to_hk(user_message, persona_key, voice, risk, t0)
    else:
        # LOW/MEDIUM → Use direct persona response (fast & cheap)
        return _route_direct(user_message, persona_key, voice, risk, direct_response_fn, t0)


def _route_to_hk(user_message, persona_key, voice, risk, t0):
    """Routes HIGH/CRITICAL risk questions through full HK pipeline."""
    
    hk = _get_hk()
    
    if hk is None:
        # HK init failed — fall back to direct but warn
        print(f"[HK-BRIDGE] WARNING: HK unavailable ({_hk_init_error}), falling back")
        return _route_direct(
            user_message, persona_key, voice, risk, None, t0,
            fallback_warning="⚠️ Verification system offline — please double-check with a professional."
        )
    
    # Run HK pipeline
    print(f"[HK-BRIDGE] Running full pipeline for Tier {risk['tier']} question")
    result = hk.run(user_message)
    
    if "error" in result:
        print(f"[HK-BRIDGE] Pipeline error: {result['error']}")
        return _route_direct(user_message, persona_key, voice, risk, None, t0,
                             fallback_warning="⚠️ Verification unavailable — please consult a professional.")
    
    final = result["final"]
    answer = final["answer"]
    badge = _format_confidence_badge(
        final["confidence_score"],
        final["confidence_color"],
        final["verification_mode"],
        final["risk_tier"]
    )
    
    full_response = _format_voice_response(answer, persona_key, risk["tier"], badge)

    return {
        "response":          full_response["response"],      # clean text — no badge
        "raw_answer":        full_response["raw_answer"],    # clean text for TTS
        "confidence_score":  final["confidence_score"],
        "confidence_color":  final["confidence_color"],
        "confidence_badge":  badge,                          # metadata only
        "hk_metadata":       full_response["metadata"],      # structured for frontend
        "risk_tier":         final["risk_tier"],
        "risk_level":        final["risk_level"],
        "verification_mode": final["verification_mode"],
        "routed_to_hk":     True,
        "pipeline_seconds":  round(time.time() - t0, 2),
        "persona":           voice["name"],
        "concerns":          final.get("all_concerns", []),
    }


def _route_direct(user_message, persona_key, voice, risk, direct_fn, t0, fallback_warning=None):
    """Routes LOW/MEDIUM risk questions through persona's direct response."""
    
    if direct_fn:
        try:
            answer = direct_fn(user_message, persona_key)
        except Exception as e:
            print(f"[HK-BRIDGE] Direct response error: {e}")
            answer = f"I'm having trouble with that right now. Please try again."
    else:
        # No direct function provided — basic fallback
        answer = (
            f"I'd be happy to help with that. However, for the most accurate "
            f"information I'd recommend also checking with a professional "
            f"if this is important to you."
        )
    
    if fallback_warning:
        answer = f"{answer}\n\n{fallback_warning}"
    
    # For medium risk, add a light badge
    badge = None
    if risk["tier"] == 2:
        badge = "ℹ️ Standard response (no cross-verification on this topic)"
    
    full_response = _format_voice_response(answer, persona_key, risk["tier"], badge)

    return {
        "response":          full_response["response"],      # clean text — no badge
        "raw_answer":        full_response["raw_answer"],    # clean text for TTS
        "confidence_score":  70.0 if risk["tier"] == 2 else 85.0,
        "confidence_color":  "YELLOW" if risk["tier"] == 2 else "GREEN",
        "confidence_badge":  badge,                          # metadata only
        "hk_metadata":       full_response["metadata"],      # structured for frontend
        "risk_tier":         risk["tier"],
        "risk_level":        risk["level"],
        "verification_mode": "DIRECT_PERSONA",
        "routed_to_hk":     False,
        "pipeline_seconds":  round(time.time() - t0, 3),
        "persona":           voice["name"],
        "concerns":          [],
    }


# ══════════════════════════════════════════════════════════════
# VOICE/TTS HELPER
# Strip formatting for clean audio output
# ══════════════════════════════════════════════════════════════

def get_voice_text(result: dict) -> str:
    """
    Returns clean text for TTS/voice output.
    Strips badges, emojis, markdown that don't work in audio.
    """
    import re
    text = result.get("raw_answer", result.get("response", ""))
    
    # Strip markdown italics
    text = re.sub(r'_([^_]+)_', r'\1', text)
    
    # Strip emoji (basic — expand if needed)
    emoji_pattern = re.compile(
        "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF"
        "\u2600-\u26FF\u2700-\u27BF]+", 
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)
    
    # Strip lines starting with confidence badge markers
    lines = text.split('\n')
    clean_lines = [l for l in lines if not l.strip().startswith(('✅', '⚠️', '🔴', 'ℹ️'))]
    text = '\n'.join(clean_lines).strip()
    
    return text


# ══════════════════════════════════════════════════════════════
# QUICK TEST
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  LYLO × HallucinationKiller Bridge — Test Mode")
    print("=" * 60)
    
    test_cases = [
        ("can my mom take ibuprofen with warfarin?", "doctor"),
        ("what should I invest my savings in?", "wealth"),
        ("tell me a joke about cats", "bestie"),
        ("what are my rights if my landlord won't fix the heat?", "lawyer"),
        ("what's 2 + 2?", "tutor"),
    ]
    
    for msg, persona in test_cases:
        print(f"\n{'='*60}")
        print(f"PERSONA: {persona.upper()} | MSG: '{msg}'")
        print(f"{'='*60}")
        
        result = process_message(msg, persona)
        
        print(f"Risk: {result['risk_level']} (Tier {result['risk_tier']})")
        print(f"Routed to HK: {result['routed_to_hk']}")
        print(f"Mode: {result['verification_mode']}")
        print(f"Confidence: {result['confidence_color']} {result['confidence_score']}%")
        print(f"Time: {result['pipeline_seconds']}s")
        print(f"\nRESPONSE:\n{result['response']}")
        print(f"\nVOICE TEXT:\n{get_voice_text(result)}")
