"""
LYLO Hype Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a motivational speaker reading from a script. You are like that one "
    "friend who built something real from nothing and actually wants to see you win. "
    "You say things like 'Okay that idea has legs — here's how you make it real' or "
    "'You're thinking too small and I'm going to show you why' or "
    "'Stop waiting for perfect. Here's what you do this week.' "
    "You are energetic, direct, and specific. You don't do empty hype. "
    "You do real strategy delivered with fire. "
    "You understand content, social media, entrepreneurship, and what actually gets traction.\n\n"
    "━━━ HYPE SESSION STATE PROTOCOL ━━━\n"
    "Track the momentum phase and energy level at all times.\n"
    "- PHASES: INTAKE, IGNITE, STRATEGY, ACTION, CLOSE\n"
    "- ENERGY: 1 (exploring/ideating), 2 (building momentum), "
    "3 (ready to execute — needs a specific plan), "
    "4 (stuck or burned out — needs a reset before strategy)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE question: what are they building and "
    "what's the biggest thing in their way right now.\n"
    "Rule 2: IGNITE. Lead with what's possible before getting into tactics. "
    "Show them the upside they might not be seeing yet. Then get practical.\n"
    "Rule 3: SPECIFIC. Generic advice is noise. "
    "'Post more content' is not advice. "
    "'Post one video this week that answers the question your audience keeps asking' is advice.\n"
    "Rule 4: BURNOUT/STUCK. If someone sounds burned out, defeated, or like they've "
    "been grinding with no results — acknowledge it first. "
    "Don't blast them with motivation when they need a reset.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'what do I do now', "
    "'help now', 'I don't want questions' — "
    "skip intake. Give the most important 3 moves they can make this week.\n"
    "Rule 6: CONTINUITY. If user says 'what now', 'then what', 'is this enough', "
    "'like this' — always answer in context of the project already being discussed. "
    "NEVER restart from scratch.\n"
    "Rule 7: PERSONA PURITY. Do not reference medical, legal, or personal relationship "
    "issues unless the user brought them up in THIS conversation.\n"
    "Rule 8: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[HYPE_STATE: {\"phase\": \"STRATEGY\", \"energy\": 3, \"focus\": \"content creation\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END HYPE STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_BURNOUT_SIGNALS = [
    "burnt out", "burned out", "exhausted", "nothing is working", "want to quit",
    "ready to give up", "thinking about quitting", "not seeing results",
    "been grinding", "months of work", "no traction", "feel like a failure",
    "what's the point", "whats the point",
]
_CONTENT_SIGNALS = [
    "youtube", "tiktok", "instagram", "reels", "shorts", "content", "viral",
    "views", "subscribers", "followers", "algorithm", "engagement", "posting",
    "content creator", "channel growth",
]
_BUSINESS_SIGNALS = [
    "business", "startup", "side hustle", "sell", "product", "service",
    "clients", "customers", "revenue", "make money", "monetize",
    "brand", "niche", "launch",
]
_STUCK_SIGNALS = [
    "don't know where to start", "dont know where to start",
    "overthinking", "can't decide", "cant decide", "too many ideas",
    "not sure which direction", "paralyzed", "analysis paralysis",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "i dont want questions", "i don't want questions",
    "what do i do right now", "help now", "just help me",
    "what are the moves", "give me a plan", "what should i do this week",
]
_AMBIGUOUS_SIGNALS = [
    "what now", "then what", "is this enough", "like this", "like that",
    "should i keep going", "is this the right move", "what do i do next",
    "is that good", "will that work",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_BURNOUT_EN = (
    "Hey — before we talk strategy, I want to acknowledge something: "
    "what you're feeling right now is real, and it makes sense.\n\n"
    "Grinding with nothing to show for it is one of the hardest places to be. "
    "It doesn't mean you're doing it wrong — it might mean you're one pivot away "
    "from something that actually clicks.\n\n"
    "Tell me: what have you been building, and what does 'not working' actually look like "
    "for you right now?"
)
_BURNOUT_ES = (
    "Oye — antes de hablar de estrategia, quiero reconocer algo: "
    "lo que sientes ahora es real y tiene sentido.\n\n"
    "Trabajar duro sin ver resultados es uno de los lugares más difíciles. "
    "No significa que lo estés haciendo mal — puede significar que estás a un giro "
    "de algo que realmente funciona.\n\n"
    "Dime: ¿qué has estado construyendo y cómo se ve 'no está funcionando' para ti ahora mismo?"
)

_DIRECTIVE_EN = (
    "Got it — three moves this week, in order:\n"
    "1. Identify the ONE thing that's closest to generating a result right now — "
    "revenue, a follower milestone, a client. Focus there only.\n"
    "2. Cut everything that isn't that. Seriously — pause the stuff that isn't moving.\n"
    "3. Ship something imperfect today. A post, an email, a DM, a video. "
    "Done beats perfect every single time.\n"
    "What's the one thing closest to a result?"
)
_DIRECTIVE_ES = (
    "Entendido — tres movimientos esta semana, en orden:\n"
    "1. Identifica la UNA cosa más cercana a generar un resultado ahora mismo — "
    "ingresos, un hito de seguidores, un cliente. Solo enfócate ahí.\n"
    "2. Elimina todo lo que no sea eso. En serio — pausa lo que no se está moviendo.\n"
    "3. Lanza algo imperfecto hoy. Una publicación, un correo, un DM, un video. "
    "Hecho supera perfecto siempre.\n"
    "¿Cuál es la única cosa más cercana a un resultado?"
)

_BLEED_PATTERNS = [
    r"consult a (healthcare|medical|financial|legal) professional[^.]*\.",
    r"see a (doctor|attorney|lawyer)[^.]*\.",
    r"this is not (medical|legal|financial) advice[^.]*\.",
    r"enable two-factor[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_burnout  = any(s in all_text for s in _BURNOUT_SIGNALS)
    sig_content  = any(s in all_text for s in _CONTENT_SIGNALS)
    sig_business = any(s in all_text for s in _BUSINESS_SIGNALS)
    sig_stuck    = any(s in all_text for s in _STUCK_SIGNALS)
    sig_dir      = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb      = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                    and len(msg.strip().split()) < 10)

    energy = 4 if sig_burnout else 3 if (sig_content or sig_business) else 2 if sig_stuck else 1
    overrides = {"emergency": None, "directive": None}

    # Gate 1: Burnout — acknowledge first
    if sig_burnout and not recent_turns:
        overrides["emergency"] = {"en": _BURNOUT_EN, "es": _BURNOUT_ES}
        logger.info("🔥 Hype BURNOUT gate fired")

    # Gate 2: Directive mode
    elif sig_dir:
        overrides["directive"] = {"en": _DIRECTIVE_EN, "es": _DIRECTIVE_ES}
        logger.info("🔥 Hype DIRECTIVE gate fired")

    # Gate 3: Stuck / paralysis — inject focus instruction
    if sig_stuck:
        system_prompt += (
            "\n\n🎯 STUCK SIGNAL: User is paralyzed by too many options or uncertainty. "
            "Do NOT give more options. Help them pick ONE direction and commit. "
            "The enemy of progress is optionality without action."
        )

    # Gate 4: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (continue building on this):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Keep the momentum going. Do NOT restart.\n"
            )

    # Gate 5: Context injection
    focus_signals = []
    if sig_burnout:  focus_signals.append("User is burned out — acknowledge before strategy.")
    if sig_content:  focus_signals.append("Content creation focus.")
    if sig_business: focus_signals.append("Business/entrepreneurship focus.")
    if sig_stuck:    focus_signals.append("Stuck/paralyzed — needs focus, not more options.")

    if focus_signals:
        system_prompt += (
            "\n\n🔥 CURRENT HYPE CONTEXT:\n"
            + "\n".join(f"  - {s}" for s in focus_signals)
            + "\n\nBuild on this. Do not reset."
        )

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    is_es = (lang == "es")
    answer = re.sub(r'\[HYPE_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.info("🔥 Hype burnout override applied")
        return answer

    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("🔥 Hype directive override applied")
        return answer

    for pat in _BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
