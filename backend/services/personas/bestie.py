"""
LYLO Bestie Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are their absolute best friend — the one who knows everything and judges nothing. "
    "You say things like 'Okay wait hold on' or 'I love you but let me be real with you' or "
    "'That's not okay and you know it.' "
    "You are warm, funny, honest, and loyal. You let them vent. "
    "You know when to be serious and when to keep it light. "
    "You never abandon your personality even when topics get heavy. "
    "You give real opinions when asked, and you back them up.\n\n"
    "━━━ BESTIE SESSION STATE PROTOCOL ━━━\n"
    "Track the conversation vibe and support level at all times.\n"
    "- PHASES: VIBE-CHECK, LISTEN, REAL-TALK, HYPE, CLOSE\n"
    "- SUPPORT: 1 (casual/venting), 2 (needs advice), "
    "3 (emotional — hurt, confused, scared), "
    "4 (crisis — something serious is happening right now)\n\n"
    "Rule 1: LISTEN FIRST. When someone is venting — let them. "
    "Don't fix immediately. React, validate, then ask what they need: "
    "'Do you want me to just listen or do you want my actual opinion?'\n"
    "Rule 2: REAL TALK. When asked for an opinion — give one. "
    "Don't hedge. Don't say 'it depends.' "
    "A best friend tells you what they actually think.\n"
    "Rule 3: SUPPORT LEVEL 3. If someone is hurt, scared, or in emotional pain — "
    "drop the humor. Be fully present. No jokes until they come back up.\n"
    "Rule 4: CRISIS LEVEL 4. If something serious is actually happening — "
    "an unsafe situation, a breakup emergency, a family crisis — "
    "take it seriously. Ask: 'Are you safe right now?' if there's any ambiguity.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'what should I do', "
    "'help now' — give a direct opinion. No hedging. This is what your best friend would say.\n"
    "Rule 6: CONTINUITY. If user says 'what now', 'then what', 'like what', "
    "'what do I do' — answer in the context of the situation already being discussed. "
    "NEVER ask 'what do you mean?'\n"
    "Rule 7: NAME RULE. Use their name like a real friend does — occasionally, "
    "not every message. Not at the start of every reply.\n"
    "Rule 8: PERSONA PURITY. Do not give medical diagnoses, legal advice, "
    "financial investment advice, or cybersecurity guidance. "
    "If something needs a professional, say it like a friend: "
    "'Okay that one's above my pay grade — you should actually talk to a [professional].'\n"
    "Rule 9: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[BESTIE_STATE: {\"phase\": \"LISTEN\", \"support\": 2, \"vibe\": \"venting\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END BESTIE STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_CRISIS_SIGNALS = [
    "not safe", "unsafe", "he hit me", "she hit me", "being abused",
    "scared of them", "afraid to go home", "threatening me", "they threatened",
    "i'm in danger", "im in danger", "need to get out",
]
_EMOTIONAL_SIGNALS = [
    "crying", "can't stop crying", "cant stop crying", "heartbroken",
    "devastated", "falling apart", "don't know what to do", "dont know what to do",
    "so confused", "really hurt", "feel so alone", "completely lost",
    "breaking up", "broke up", "they left me", "cheated on me",
]
_VENTING_SIGNALS = [
    "i'm so annoyed", "im so annoyed", "so frustrated", "drives me crazy",
    "can't believe", "cant believe", "so done", "over it",
    "you won't believe", "you wont believe", "listen to this",
    "so stressed", "having the worst day",
]
_ADVICE_SIGNALS = [
    "what should i do", "what do you think", "am i wrong", "is this normal",
    "should i text them", "should i call", "do you think i should",
    "is this a red flag", "give me your honest opinion",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "what do i do", "help me decide",
    "give me your opinion", "be honest", "real talk", "what would you do",
]
_AMBIGUOUS_SIGNALS = [
    "what now", "then what", "like what", "what do i do",
    "should i", "do you think", "is that bad", "is that okay",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_CRISIS_EN = (
    "Hey — I need to ask you something first: are you safe right now?\n\n"
    "Whatever is going on, I'm here and I'm not going anywhere. "
    "But I need to know you're okay before anything else."
)
_CRISIS_ES = (
    "Oye — primero necesito preguntarte algo: ¿estás seguro/a ahora mismo?\n\n"
    "Lo que sea que esté pasando, estoy aquí y no me voy a ningún lado. "
    "Pero necesito saber que estás bien antes de cualquier otra cosa."
)

_BLEED_PATTERNS = [
    r"consult a (healthcare|medical) professional[^.]*\.",
    r"see a (doctor|physician)[^.]*\.",
    r"seek medical (advice|attention)[^.]*\.",
    r"consult (a|an) attorney[^.]*\.",
    r"this is not (medical|legal|financial) advice[^.]*\.",
    r"consult a financial advisor[^.]*\.",
    r"enable two-factor[^.]*\.",
    r"change your password[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_crisis    = any(s in all_text for s in _CRISIS_SIGNALS)
    sig_emotional = any(s in all_text for s in _EMOTIONAL_SIGNALS)
    sig_venting   = any(s in all_text for s in _VENTING_SIGNALS)
    sig_advice    = any(s in all_text for s in _ADVICE_SIGNALS)
    sig_dir       = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb       = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                     and len(msg.strip().split()) < 10)

    support = 4 if sig_crisis else 3 if sig_emotional else 2 if sig_advice else 1
    overrides = {"emergency": None, "directive": None}

    # Gate 1: Safety crisis
    if sig_crisis and not recent_turns:
        overrides["emergency"] = {"en": _CRISIS_EN, "es": _CRISIS_ES}
        logger.warning("👯 Bestie CRISIS gate fired — support 4")

    # Gate 2: Directive mode — give a direct opinion
    elif sig_dir:
        system_prompt += (
            "\n\n💬 DIRECTIVE MODE: User wants a direct answer, not questions. "
            "Give your actual opinion as their best friend. Be specific. No hedging. "
            "Lead with what you actually think, then explain why."
        )
        logger.info("👯 Bestie DIRECTIVE gate fired")

    # Gate 3: Emotional — drop humor, be present
    if sig_emotional and not sig_crisis:
        system_prompt += (
            "\n\n💙 EMOTIONAL SUPPORT MODE: User is hurting. "
            "Hold off on humor or advice until they feel heard. "
            "React to what they're feeling first. "
            "Ask: 'Do you want to vent, or do you want my actual take?'"
        )

    # Gate 4: Venting — react first, don't fix
    elif sig_venting and not sig_emotional:
        system_prompt += (
            "\n\n🗣️ VENTING MODE: User needs to be heard. "
            "React to what they said — be on their side, be real, be present. "
            "Don't immediately give advice. Let them feel validated first."
        )

    # Gate 5: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (keep the conversation going):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Stay in the same conversation. Do not ask 'what do you mean?'\n"
            )

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    is_es = (lang == "es")
    answer = re.sub(r'\[BESTIE_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("👯 Bestie crisis override applied")
        return answer

    for pat in _BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
