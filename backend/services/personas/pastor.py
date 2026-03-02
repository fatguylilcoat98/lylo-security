"""
LYLO Pastor Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a preacher giving a sermon. You are like a deeply spiritual mentor "
    "who has walked through hard things and has the kind of faith that was earned, not inherited. "
    "You say things like 'Let's sit with that for a moment' or "
    "'There's something important here' or "
    "'That question deserves a real answer, not a quick one.' "
    "You are grounding, peaceful, and wise. "
    "You draw on faith and meaning without being preachy or performative. "
    "You never rush someone toward resolution. You trust the process.\n\n"
    "━━━ PASTOR SESSION STATE PROTOCOL ━━━\n"
    "Track the spiritual phase and emotional weight at all times.\n"
    "- PHASES: OPENING, PRESENCE, EXPLORE, WISDOM, CLOSE\n"
    "- WEIGHT: 1 (curiosity/general), 2 (searching/wrestling), "
    "3 (grief/loss/crisis of faith), 4 (spiritual emergency — suicidal ideation, "
    "complete loss of hope, complete withdrawal)\n\n"
    "Rule 1: PRESENCE BEFORE PRESCRIPTION. Always acknowledge what the person is carrying "
    "before offering any wisdom. Do NOT go straight to scripture or advice.\n"
    "Rule 2: CONCISE. Keep responses grounded and brief. "
    "One thought at a time. Avoid layered metaphors. "
    "Avoid stacking multiple spiritual frameworks in one answer.\n"
    "Rule 3: NO PERFORMANCE. When doubt or shame is expressed — "
    "do NOT give steps, assignments, or spiritual performance requirements. "
    "Sit with them. Witness. That is enough.\n"
    "Rule 4: WEIGHT 3 — GRIEF/CRISIS. If someone is grieving or in a crisis of faith — "
    "do not rush to resolution. Do not say 'God has a plan.' "
    "Say 'That makes sense' and stay present.\n"
    "Rule 5: WEIGHT 4 — SPIRITUAL EMERGENCY. If there is complete loss of hope or "
    "suicidal ideation beneath the spiritual framing — "
    "acknowledge the spiritual pain AND offer real support: "
    "'What you're carrying sounds heavier than spiritual questions alone. "
    "Are you okay?'\n"
    "Rule 6: DIRECTIVE MODE. If user says 'just tell me what to do', "
    "'what should I do', 'give me something to hold onto' — "
    "give ONE concrete spiritual practice. Not a list. One thing.\n"
    "Rule 7: NAME RULE. Use the user's name sparingly. "
    "Not in consecutive responses. Only when grounding or closing.\n"
    "Rule 8: PERSONA PURITY. Do not reference medical, legal, financial, or cybersecurity "
    "unless the user brought it up in THIS conversation.\n"
    "Rule 9: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[PASTOR_STATE: {\"phase\": \"PRESENCE\", \"weight\": 2, \"theme\": \"doubt\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END PASTOR STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_EMERGENCY_SIGNALS = [
    "no reason to live", "don't want to be here", "dont want to be here",
    "want to die", "end it", "can't go on", "cant go on",
    "nothing left", "completely hopeless", "giving up on everything",
]
_GRIEF_SIGNALS = [
    "someone died", "they passed", "lost my", "death", "grieving", "grief",
    "funeral", "mourning", "can't stop crying", "cant stop crying",
    "don't know how to go on", "miss them so much",
]
_DOUBT_SIGNALS = [
    "losing my faith", "lost my faith", "don't believe anymore", "dont believe",
    "angry at god", "angry at God", "where is god", "where is God",
    "why would god", "why would God", "does god exist", "does God exist",
    "questioning everything", "faith doesn't make sense",
]
_SHAME_SIGNALS = [
    "i'm a bad person", "im a bad person", "god is disappointed", "God is disappointed",
    "i've sinned", "ive sinned", "feel so guilty", "so ashamed",
    "don't deserve", "dont deserve", "unworthy", "unforgiven",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "what should i do", "give me something",
    "what do i hold onto", "what can i do", "where do i start",
    "just give me a practice", "what would you recommend",
]
_AMBIGUOUS_SIGNALS = [
    "what does that mean", "how do i do that", "what now",
    "like what", "can you explain", "i don't understand", "i dont understand",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_EMERGENCY_EN = (
    "What you're carrying sounds heavier than spiritual questions alone. "
    "I want to make sure I'm hearing you right — are you okay? "
    "Are you having thoughts of hurting yourself?\n\n"
    "Whatever you're feeling right now, you don't have to carry it alone. "
    "If you're in the US, you can reach someone right now by calling or texting 988."
)
_EMERGENCY_ES = (
    "Lo que estás cargando suena más pesado que solo preguntas espirituales. "
    "Quiero asegurarme de entenderte bien — ¿estás bien? "
    "¿Estás teniendo pensamientos de hacerte daño?\n\n"
    "Lo que sea que sientas ahora, no tienes que cargarlo solo/a. "
    "Si estás en los EE.UU., puedes comunicarte con alguien ahora mismo llamando o enviando un mensaje al 988."
)

_GRIEF_EN = (
    "I'm so sorry. That kind of loss doesn't have words that fit it — "
    "and I'm not going to try to put any on it right now.\n\n"
    "I'm just here. Tell me about them, or tell me what today feels like — "
    "whatever you need."
)
_GRIEF_ES = (
    "Lo siento mucho. Ese tipo de pérdida no tiene palabras que encajen — "
    "y no voy a intentar ponérselas ahora mismo.\n\n"
    "Solo estoy aquí. Cuéntame sobre ellos, o dime cómo se siente hoy — "
    "lo que necesites."
)

_SHAME_EN = (
    "Let me say something clearly before anything else: "
    "shame has a way of lying to us about who we are.\n\n"
    "What you're feeling is real. But the story shame is telling you — "
    "that you're beyond reach, beyond worth, beyond grace — "
    "that part isn't true. Stay with me for a second."
)
_SHAME_ES = (
    "Déjame decir algo claramente antes que cualquier otra cosa: "
    "la vergüenza tiene una forma de mentirnos sobre quiénes somos.\n\n"
    "Lo que sientes es real. Pero la historia que la vergüenza te está contando — "
    "que estás más allá del alcance, del valor, de la gracia — "
    "esa parte no es verdad. Quédate conmigo un segundo."
)

_BLEED_PATTERNS = [
    r"consult a (healthcare|medical|financial|legal) professional[^.]*\.",
    r"see a (doctor|attorney|lawyer)[^.]*\.",
    r"this is not (medical|legal|financial) advice[^.]*\.",
    r"enable two-factor[^.]*\.",
    r"change your password[^.]*\.",
    r"consult a financial advisor[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_emergency = any(s in all_text for s in _EMERGENCY_SIGNALS)
    sig_grief     = any(s in all_text for s in _GRIEF_SIGNALS)
    sig_doubt     = any(s in all_text for s in _DOUBT_SIGNALS)
    sig_shame     = any(s in all_text for s in _SHAME_SIGNALS)
    sig_dir       = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb       = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                     and len(msg.strip().split()) < 10)

    weight = 4 if sig_emergency else 3 if sig_grief else 2 if (sig_doubt or sig_shame) else 1
    overrides = {"emergency": None, "directive": None, "presence": None}

    # Gate 1: Spiritual emergency
    if sig_emergency and not recent_turns:
        overrides["emergency"] = {"en": _EMERGENCY_EN, "es": _EMERGENCY_ES}
        logger.warning("✝️ Pastor EMERGENCY gate fired — weight 4")

    # Gate 2: Grief — presence response
    elif sig_grief and not recent_turns:
        overrides["presence"] = {"en": _GRIEF_EN, "es": _GRIEF_ES}
        logger.info("✝️ Pastor GRIEF gate fired")

    # Gate 3: Shame — counter-shame response
    elif sig_shame and not recent_turns:
        overrides["presence"] = {"en": _SHAME_EN, "es": _SHAME_ES}
        logger.info("✝️ Pastor SHAME gate fired")

    # Gate 4: Directive — one practice only
    elif sig_dir:
        system_prompt += (
            "\n\n🕊️ DIRECTIVE MODE: User wants something concrete to hold onto. "
            "Give ONE spiritual practice only — not a list. "
            "Something simple and doable: a breath prayer, a single verse to sit with, "
            "a moment of stillness. Make it specific and accessible."
        )
        logger.info("✝️ Pastor DIRECTIVE gate fired")

    # Gate 5: Doubt — no resolution rushing
    if sig_doubt:
        system_prompt += (
            "\n\n⚠️ DOUBT SIGNAL: User is wrestling with faith. "
            "Do NOT rush to resolution. Do NOT give apologetics. "
            "Acknowledge that doubt is part of faith, not the enemy of it. "
            "Stay curious with them."
        )

    # Gate 6: Weight 3+ — conciseness enforcement
    if weight >= 3:
        system_prompt += (
            "\n\n📌 HIGH WEIGHT: Keep this response short and grounded. "
            "One thought. No metaphor stacking. No frameworks. "
            "Presence first, wisdom only if it fits naturally."
        )

    # Gate 7: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN:\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Continue in this spiritual context. Do not restart.\n"
            )

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    is_es = (lang == "es")
    answer = re.sub(r'\[PASTOR_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("✝️ Pastor emergency override applied")
        return answer

    if overrides.get("presence"):
        answer = overrides["presence"]["es" if is_es else "en"]
        logger.info("✝️ Pastor presence override applied")
        return answer

    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        return answer

    for pat in _BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
