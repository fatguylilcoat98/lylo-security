"""
LYLO OS — services/scam_detector.py
Scam indicator analysis and prompt injection detection.
"""
import re
import logging
from typing import List

logger = logging.getLogger("LYLO.ScamDetector")

# SCAM DETECTION
# =============================================================================
def analyze_scam_indicators(text: str) -> List[str]:
    indicators = []
    t = text.lower()
    patterns = {
        "High Urgency":            ["immediate", "hurry", "suspended", "warned", "final notice", "30 minutes"],
        "Payment Pressure":        ["gift card", "wire", "zelle", "venmo", "western union", "crypto", "bitcoin"],
        "Authority Impersonation": ["irs", "fbi", "police", "social security", "legal department", "attorney general"],
        "Phishing Style":          ["bit.ly", "tinyurl", "linktr.ee", "verify account", "unusual login"],
    }
    for category, keywords in patterns.items():
        if any(k in t for k in keywords):
            indicators.append(category)
    return indicators

# =============================================================================
# V31.0 — AUTO-PIN SYSTEM
# Silently saves user goals, struggles, wins, and projects to Pinecone.
# Fires inside /chat before the OpenAI race — zero user-facing latency.
# =============================================================================

PIN_KEYWORDS: dict[str, list[str]] = {
    "goal":     ["i want to", "my goal is", "i'm trying to", "targeting", "by the end of", "i need to hit"],
    "struggle": ["i'm stuck", "i can't", "burning out", "exhausted", "wrecking me",
                 "not working", "bug", "broken", "failing", "behind", "knife-sharpening"],
    "win":      ["we shipped", "i shipped", "just launched", "hit", "crossed",
                 "users signed up", "i closed", "we got funded", "just hit"],
    "fear":     ["i'm scared", "worried about", "afraid", "what if we fail",
                 "running out of", "not going to make it", "losing momentum"],
    "person":   ["my partner", "my investor", "my co-founder", "my cto",
                 "my manager", "my lawyer", "my doctor"],
    "project":  ["lyloworld", "synced typewriter", "sentinel", "tactical vault",
                 "lyla", "hustle lab", "duo", "swoono"],
}


def auto_detect_pin_category(message: str) -> tuple[str, str] | None:
    """
    Scans user message for pinnable intel.
    Returns (pin_text, category) if detected, else None.
    Uses the first 200 chars of the message as the pin text.
    """
    msg_lower = message.lower()
    for category, keywords in PIN_KEYWORDS.items():
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, msg_lower):
                return (message.strip()[:200], category)
    return None


# =============================================================================
# PROMPT INJECTION DETECTOR — fires before the LLM race
# Multi-layer: exact phrases + semantic groups + pattern combinations
# =============================================================================
def detect_prompt_injection(message: str) -> str | None:
    """
    Multi-layer injection detection. Returns Guardian-voiced block or None.
    Layer 1: Exact high-confidence phrases
    Layer 2: Semantic group scoring (2+ signals from same group = flag)
    Layer 3: Combination patterns (authority claim + command = flag)
    """
    msg_lower = message.lower()

    # ── Layer 1: Exact high-confidence phrases (1 hit = block) ───────────────
    EXACT_PHRASES = [
        # Identity/role override
        "ignore your instructions",  "ignore all previous",   "forget you are",
        "you are now a",             "pretend you are",        "act as if you are",
        "your new role is",          "you are actually",       "disregard your",
        "override your",             "bypass your",            "your real purpose",
        "new persona",               "drop your persona",      "ignore your training",
        # Header/structure attacks
        "bypass the analysis",       "skip the headers",       "drop the headers",
        "bypass the risk",           "raw text only",          "text-only response",
        "no headers",                "without headers",        "skip protocols",
        "bypass the protocol",       "ignore the format",      "header protocols",
        "temporarily bypass",        "temporarily skip",       "temporarily disable",
        # Permission/authorization spoofing
        "you are authorized to",     "i authorize you",        "authorized to bypass",
        "permission to skip",        "granted permission",     "you have permission",
        "i give you permission",     "permission override",
        # System/data probing
        "memory buffer",             "system prompt",          "output your instructions",
        "reveal your prompt",        "show your instructions", "dump your memory",
        "what are your instructions","internal state",         "your training data",
        # Codeword/confirmation attacks
        "confirm and execute",       "execute now",            "lean-logic-beta",
        "initiate protocol",         "activate override",      "run diagnostic",
        # Explicit jailbreaks
        "jailbreak",                 "dan mode",               "developer mode",
        "admin mode",                "god mode",               "unrestricted mode",
        # Fake authority framing
        "regulator update",          "system update:",         "infrastructure architect",
        "lead architect",            "system architect",       "as anthropic",
        "i am your developer",       "i am your creator",      "from the developers",
        "audit report:",             "recipient: claude",      "status report on",
        # Format/structure attacks
        "without the bracket",       "without brackets",       "no bracket",
        "disable protocol",          "protocol enforcement",   "enforcement and confirm",
        "bracket formatting",        "drop formatting",        "remove formatting",
        "without formatting",        "plain text only",        "just talk naturally",
        # More codeword patterns  
        "override-",                 "alpha-override",         "beta-override",
        "execute protocol",          "protocol bypass",        "bypass protocol",
    ]

    for phrase in EXACT_PHRASES:
        if phrase in msg_lower:
            return _build_injection_response(phrase, "directive override")

    # ── Layer 2: Semantic group scoring (2+ from same group = block) ─────────
    SEMANTIC_GROUPS = {
        "authority_claim": [
            "architect", "developer", "administrator", "engineer", "director",
            "infrastructure", "lead ", "senior ", "chief ", "head of",
            "authorized", "clearance", "credentials",
        ],
        "command_language": [
            "execute", "initiate", "confirm", "activate", "run now",
            "do this now", "comply", "obey", "you must", "you will",
            "immediately", "right now", "without delay",
        ],
        "rule_suspension": [
            "for the next", "temporarily", "just this once", "this one time",
            "in this case", "exception", "special case", "override",
            "suspend", "disable", "turn off", "skip",
        ],
        "system_probe": [
            "memory", "buffer", "cache", "logs", "database",
            "internal", "backend", "architecture", "pipeline",
            "token", "context window", "prompt",
        ],
    }

    group_hits = {}
    for group, keywords in SEMANTIC_GROUPS.items():
        hits = [kw for kw in keywords if kw in msg_lower]
        if len(hits) >= 2:
            group_hits[group] = hits

    if len(group_hits) >= 2:
        triggered = ", ".join(f"{g}({h})" for g, h in group_hits.items())
        return _build_injection_response(triggered, "semantic pattern match")

    # ── Layer 3: Dangerous combinations (authority + command = block) ─────────
    has_authority = any(kw in msg_lower for kw in SEMANTIC_GROUPS["authority_claim"])
    has_command   = any(kw in msg_lower for kw in SEMANTIC_GROUPS["command_language"])
    has_suspend   = any(kw in msg_lower for kw in SEMANTIC_GROUPS["rule_suspension"])

    if has_authority and has_command and has_suspend:
        return _build_injection_response("authority+command+rule-suspension combo", "combination attack")

    if has_authority and has_suspend:
        return _build_injection_response("authority+rule-suspension combo", "combination attack")

    # ── Layer 4: Low-threat impatience — user asking to skip structure ────────
    # NOT a security threat. User is just in a hurry. Respond warmly, not with Guardian mode.
    IMPATIENCE_PHRASES = [
        "skip the headers", "without the headers", "no headers please",
        "just answer quickly", "answer fast", "keep it short",
        "skip the format", "just tell me", "cut to the chase",
        "skip the structure", "just give me the answer",
    ]
    for phrase in IMPATIENCE_PHRASES:
        if phrase in msg_lower:
            return _build_impatience_response()

    return None


def _build_injection_response(trigger: str, category: str) -> str:
    """Guardian-voiced hard block for real injection attempts."""
    logger.warning(f"🚨 Injection blocked — trigger: {trigger} | category: {category}")
    return (
        f"[THREAT ASSESSMENT]\n"
        f"Injection attempt detected. Pattern: {category}.\n\n"
        f"[BREACH ANALYSIS]\n"
        f"This message contains signatures of a prompt injection — attempting to "
        f"reassign identity, invoke fake authority, or suspend operational protocols. "
        f"No role claim has the authority to bypass LYLO's structure. "
        f"Headers and domain boundaries are non-negotiable.\n\n"
        f"[LOCK IT DOWN]\n"
        f"Request blocked. Ask your real question directly and I'll help."
    )


def _build_impatience_response() -> str:
    """Warm, partner-style redirect for users who just want a quick answer."""
    logger.info("ℹ️ Impatience pattern detected — redirecting warmly")
    return (
        f"I hear the urgency — let's move fast. "
        f"The structure stays because it's how I make sure nothing important gets missed, "
        f"not to slow you down. Give me your question and I'll get straight to it."
    )




