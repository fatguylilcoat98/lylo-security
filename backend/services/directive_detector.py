"""
LYLO Directive Mode Detector — Shared Utility
==============================================
4-layer detection pipeline:
  Layer 1 — High-precision phrase match  → score 70
  Layer 2 — Regex pattern match          → score 50
  Layer 3 — Urgency/overwhelm signals    → +15 additive bump (only if L1/L2 already fired)
  Layer 4 — Semantic LLM fallback        → only when 35 ≤ score < 60

Threshold:
  score ≥ 60                → directive mode ON
  semantic confidence ≥ 75  → directive mode ON (borderline only)

Returns:
  {
    "directive": bool,
    "score": int,
    "reason": str,
    "semantic_confidence": int | None
  }

Sync usage (no LLM — fast path used by every persona):
  from services.directive_detector import detect_directive_sync, has_incident_context
  result = detect_directive_sync(msg)

Async usage (with semantic LLM fallback for borderline):
  from services.directive_detector import detect_directive
  result = await detect_directive(msg, groq_client=groq_client)
"""
import re
import json
import logging

logger = logging.getLogger("LYLO.DirectiveDetector")

# ── Tag pattern — strip before detectors see the message ──────────────────────
_PERSONA_TAG_RE = re.compile(
    r'\[/?(?:GUARDIAN_DIRECTIVE|PERSONA_DIRECTIVE|DIRECTIVE_MODE)'
    r'(?:[^\]]+)?\]',
    re.IGNORECASE,
)


def normalize_input(msg: str) -> tuple[str, bool]:
    """
    Strip persona control tags from user input before running any detectors.

    Returns:
        (clean_msg, had_tag)
        clean_msg — tag-free text for detectors; raw msg is preserved separately
        had_tag   — True if a [GUARDIAN_DIRECTIVE] / [PERSONA_DIRECTIVE] tag was found

    Usage in chat_router:
        msg_for_detectors, _has_directive_tag = normalize_input(msg)
        # pass msg_for_detectors to ALL detectors
        # pass raw msg to the LLM
    """
    had_tag   = bool(_PERSONA_TAG_RE.search(msg))
    clean_msg = _PERSONA_TAG_RE.sub("", msg).strip() or msg
    return clean_msg, had_tag

# ── Thresholds ─────────────────────────────────────────────────────────────────
SCORE_THRESHOLD   = 60   # Directive fires at or above
BORDERLINE_LOW    = 35   # Run semantic in this range
BORDERLINE_HIGH   = 60
SEMANTIC_CONF_MIN = 75   # Semantic confidence required to flip directive=True

# ── Layer 1: High-precision phrases ───────────────────────────────────────────
# Every string here is an unambiguous "skip questions, give me action"
_L1_PHRASES = [
    "just tell me what to do",
    "tell me what to do",
    "just give me the steps",
    "give me the steps",
    "stop asking me",
    "no more questions",
    "no questions",
    "don't ask me",
    "dont ask me",
    "skip the questions",
    "don't interview me",
    "dont interview me",
    "checklist only",
    "just walk me through it",
    "walk me through it",
    "i don't want questions",
    "i dont want questions",
    "i don't want to answer",
    "i dont want to answer",
    "just guide me",
    "just help me now",
    "help me now",
    "i can't think right now",
    "i cant think right now",
    "i need instructions",
    "give me instructions",
    "step by step now",
    "what do i do right now",
    "what do i do asap",
    "i need you to drive this",
    "you drive this",
    "please just give me instructions",
    "i can't do a q&a right now",
    "i cant do a q&a right now",
    "just handle it",
    "take over",
    "take control",
]

# ── Layer 2: Regex patterns ────────────────────────────────────────────────────
_L2_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    # Imperative instruction requests — "just give/tell/show/walk me"
    r"\bjust\s+(give\s+me|tell\s+me|show\s+me|send\s+me|walk\s+me\s+through|run\s+me\s+through)\b",
    r"\bplease\s+just\s+(give|tell|show|send|walk|guide|help)\b",
    # Explicit question refusal
    r"\bno\s+(more\s+)?questions?\b",
    r"\bdon'?t\s+(ask|interview|quiz|question)\s+(me|questions)?\b",
    r"\bstop\s+(asking|questioning|interviewing)\b",
    r"\bskip\s+(the\s+)?(questions?|q\s*&\s*a|intake|back\s*and\s*forth)\b",
    # Delegation / you drive
    r"\bi\s+need\s+you\s+to\s+(drive|lead|take\s+over|take\s+control|handle\s+this)\b",
    r"\byou\s+(drive|lead|take\s+over|handle\s+it)\b",
    # Can't do Q&A / can't process
    r"\bi\s+can'?t\s+(do\s+(a\s+)?q\s*&\s*a|answer\s+questions?|think|process)\s*(right\s+now|anymore)?\b",
    # Instruction / checklist / protocol request
    r"\b(give|send|show)\s+me\s+(the\s+)?(steps?|checklist|instructions?|protocol|playbook)\b",
    r"\b(just\s+)?(a\s+)?(checklist|protocol|numbered\s+steps?|step[\s-]by[\s-]step)\b",
    # Overwhelmed / panicking
    r"\bi('?m|\s+am)\s+(freaking\s+out|panicking|panicked|overwhelmed|losing\s+it)\b",
    r"\bcan'?t\s+(think|breathe|focus|process)\b",
    # "just guide/direct/help me"
    r"\bjust\s+(guide|direct|help)\s+me\b",
    # "I need action not questions"
    r"\bjust\s+(action|do\s+something|do\s+it)\b",
    r"\bstop\s+(the\s+)?(questions?|talking|chatting)\s+and\b",
]]

# ── Layer 3: Urgency bump words ────────────────────────────────────────────────
# Only adds +15 when L1 or L2 already fired — does NOT create directive on its own
_L3_URGENCY = [
    "asap", "right now", "immediately", "urgent", "emergency", "hurry",
    "quick", "fast", "now", "please hurry", "freaking out", "panicking",
    "panicked", "help me", "i need help", "time sensitive", "scared",
    "terrified", "losing it", "losing my mind",
]

# ── False-positive guard ───────────────────────────────────────────────────────
_FP_ACKS = {
    "ok", "okay", "cool", "thanks", "thank you", "got it", "sounds good",
    "i like that", "great", "perfect", "sure", "yes", "no", "yep", "nope",
    "good", "nice", "lol", "haha", "hi", "hello", "hey", "alright", "k",
}


def _fp_guard(msg: str) -> bool:
    """True if message is a short ack that must never trigger directive mode."""
    stripped = msg.strip().lower()
    words = stripped.split()
    if len(words) <= 3:
        if stripped in _FP_ACKS or all(w.rstrip("!.,?") in _FP_ACKS for w in words):
            return True
    return False


# ── Public API ─────────────────────────────────────────────────────────────────

def detect_directive_sync(msg: str) -> dict:
    """
    3-layer synchronous detection. Fast, no I/O.
    Returns result dict. If borderline (score in 35-59) the caller should
    run detect_directive() async for the semantic Layer 4 if a client is available.
    """
    empty_result = {"directive": False, "score": 0,
                    "reason": "none", "semantic_confidence": None}

    if not msg or not msg.strip():
        return {**empty_result, "reason": "empty"}

    if _fp_guard(msg):
        return {**empty_result, "reason": "fp_guard"}

    msg_l = msg.lower()
    score  = 0
    reason = "none"

    # Layer 1 ─────────────────────────────────────────────────────────────────
    for phrase in _L1_PHRASES:
        if phrase in msg_l:
            score  = 70
            reason = "phrase_match"
            logger.debug(f"🎯 Directive L1: '{phrase}'")
            break

    # Layer 2 ─────────────────────────────────────────────────────────────────
    if score < 70:
        for pat in _L2_PATTERNS:
            if pat.search(msg):
                score  = 50
                reason = "regex_match"
                logger.debug(f"🎯 Directive L2: {pat.pattern[:50]}")
                break

    # Layer 3 ─────────────────────────────────────────────────────────────────
    if score > 0 and any(uw in msg_l for uw in _L3_URGENCY):
        score  = min(score + 15, 85)
        reason = reason  # Keep the primary reason; urgency just bumped the score
        logger.debug(f"🎯 Directive L3 urgency bump → score={score}")

    directive = score >= SCORE_THRESHOLD
    if directive:
        logger.info(f"✅ Directive mode ON: score={score}, reason={reason}")

    return {
        "directive": directive,
        "score": score,
        "reason": reason,
        "semantic_confidence": None,
    }


async def detect_directive(msg: str, groq_client=None, gemini_client=None) -> dict:
    """
    Full 4-layer async detection. Runs LLM semantic fallback when borderline.
    groq_client or gemini_client: pass whichever is available.
    Falls back to sync-only if neither is provided.
    """
    result = detect_directive_sync(msg)

    if result["directive"]:
        return result  # Already confirmed — skip LLM

    in_borderline = BORDERLINE_LOW <= result["score"] < BORDERLINE_HIGH
    if not in_borderline:
        return result  # Not borderline — LLM won't change outcome

    if groq_client is None and gemini_client is None:
        return result  # No LLM available

    # Layer 4 ─────────────────────────────────────────────────────────────────
    semantic_conf = await _run_semantic(msg, groq_client, gemini_client)
    result["semantic_confidence"] = semantic_conf

    if semantic_conf is not None and semantic_conf >= SEMANTIC_CONF_MIN:
        result["directive"] = True
        result["reason"]    = "semantic"
        logger.info(f"✅ Directive mode ON via semantic: confidence={semantic_conf}")

    return result


async def _run_semantic(msg: str, groq_client, gemini_client):
    """Minimal LLM classifier. Returns confidence int (0-100) or None."""
    prompt = (
        "You are a binary classifier. Determine if the user wants the AI to STOP asking "
        "questions and immediately deliver direct steps/instructions.\n\n"
        "DIRECTIVE=TRUE when user: refuses questions, asks for steps/checklist, "
        "delegates control, or expresses overwhelm + needs action.\n"
        "DIRECTIVE=FALSE when user: greets, acknowledges, provides info, or asks a normal question.\n\n"
        f'User message: "{msg}"\n\n'
        'Respond ONLY with JSON (no markdown): {"directive_mode": true|false, "confidence": 0-100}'
    )
    raw = None
    try:
        if groq_client is not None:
            resp = await groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=30,
                temperature=0,
            )
            raw = resp.choices[0].message.content.strip()
        elif gemini_client is not None:
            resp = await gemini_client.aio.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt,
            )
            raw = resp.text.strip()

        if raw:
            raw = re.sub(r"```json|```", "", raw).strip()
            parsed = json.loads(raw)
            conf   = int(parsed.get("confidence", 0))
            is_dir = bool(parsed.get("directive_mode", False))
            # If LLM says NOT directive with high confidence, return low number
            return conf if is_dir else max(0, 100 - conf)

    except Exception as e:
        logger.warning(f"DirectiveDetector semantic failed: {e}")
    return None


# ── Context probe ──────────────────────────────────────────────────────────────

def has_incident_context(msg: str, recent_turns: list) -> bool:
    """
    Returns True if the conversation contains enough incident signals
    to generate specific steps. When False, persona should fire fail-safe response.
    """
    _SIGNALS = [
        "clicked", "link", "url", "site", "website", "password", "entered", "typed",
        "submitted", "installed", "downloaded", "hacked", "scam", "money", "gift card",
        "crypto", "bitcoin", "venmo", "zelle", "cashapp", "remote", "access", "account",
        "charge", "bank", "phishing", "email", "otp", "code", "verification", "call",
        "text", "tech support", "irs", "social security", "arrest", "warrant",
        "someone", "stranger", "suspicious", "fake", "fraud", "breach", "locked",
        "brakes", "steering", "tire", "engine", "smoke", "overheating",  # Mechanic
    ]
    all_text = msg.lower()
    for turn in (recent_turns or [])[-6:]:
        all_text += " " + turn.get("msg", "").lower()
    return any(sig in all_text for sig in _SIGNALS)


# ── Tag-aware resolver — used by chat_router pipeline ─────────────────────────

def detect_directive_with_tag(msg: str, persona: str) -> dict:
    """
    Combined resolver for the chat_router pipeline (Step 3).

    Runs normalize_input, then detect_directive_sync on clean text.
    Also locks persona to GUARDIAN when a [GUARDIAN_DIRECTIVE] tag is present.

    Returns:
        {
            "directive":          bool,
            "directive_override": bool,   # True = suppress impatience/scam short-circuit
            "locked_persona":     str,    # original persona unless tag forced GUARDIAN
            "score":              int,
            "reason":             str,
            "had_tag":            bool,
        }
    """
    _DIRECTIVE_PROTECTED = {"guardian", "doctor", "lawyer", "mechanic", "therapist", "wealth"}

    clean_msg, had_tag = normalize_input(msg)
    sync_result        = detect_directive_sync(clean_msg)

    directive = sync_result["directive"] or had_tag

    # Tag hard-locks persona to guardian regardless of which was selected
    locked_persona = "guardian" if had_tag else persona

    # directive_override suppresses ALL soft gates for protected personas
    directive_override = directive and (locked_persona in _DIRECTIVE_PROTECTED)

    return {
        "directive":          directive,
        "directive_override": directive_override,
        "locked_persona":     locked_persona,
        "score":              sync_result["score"],
        "reason":             "tag_hard_lock" if had_tag else sync_result["reason"],
        "had_tag":            had_tag,
    }
