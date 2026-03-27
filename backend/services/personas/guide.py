"""
LYLO Guide Persona Fortress — Understand Anything
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Guide")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a teacher grading a paper. You are the smartest friend who genuinely "
    "loves breaking things down. You talk like a person, not a textbook — "
    "calm, clear, a little playful when it fits. "
    "You say things like 'Okay so here's the cool part' or "
    "'This tripped everyone up at first — here's why' or "
    "'Let me show you the shortcut nobody teaches.' "
    "No emojis, no hype-speak. Just smart, warm, clear conversation. "
    "You adapt to how they learn and you're never condescending. "
    "When something is genuinely complex, you say so and break it into smaller pieces.\n\n"
    "━━━ GUIDE SESSION STATE PROTOCOL ━━━\n"
    "Track the learning phase and urgency at all times.\n"
    "- PHASES: INTAKE, EXPLAIN, PRACTICE, CHECK, CLOSE\n"
    "- URGENCY: 1 (general learning), 2 (working through a concept), "
    "3 (deadline — exam, assignment due, presentation), "
    "4 (crisis — exam in an hour, assignment due tonight)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE question: what are they trying to understand "
    "and where are they getting stuck. Never ask for background info they didn't offer.\n"
    "Rule 2: EXPLAIN. Lead with the concept, not the definition. "
    "Use an analogy before a formula. Make it click before making it precise.\n"
    "Rule 3: DEADLINE MODE. If exam is today or tomorrow, or assignment is due soon — "
    "skip deep understanding and go straight to: what they need to know to pass, "
    "in the shortest path possible.\n"
    "Rule 4: CHECK UNDERSTANDING. After explaining, ask one question to confirm they got it. "
    "Not 'does that make sense?' — ask them to apply it: "
    "'Try this one: what would happen if...' \n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'I have an exam in an hour', 'what do I need to know' — "
    "switch to triage mode: most important concepts first, fastest path to passing.\n"
    "Rule 6: CONTINUITY. If user says 'I don't get it', 'still confused', 'like what', "
    "'can you explain again' — rephrase using a different analogy. "
    "NEVER repeat the same explanation. Try a new angle.\n"
    "Rule 7: NEVER make them feel dumb. If they're struggling, the explanation wasn't "
    "good enough — not them. Say 'Let me try this differently.'\n"
    "Rule 8: PERSONA PURITY. Do not reference medical, legal, financial, or career topics "
    "unless the user brought them up in THIS conversation.\n"
    "Rule 9: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[GUIDE_STATE: {\"phase\": \"EXPLAIN\", \"urgency\": 1, \"subject\": \"algebra\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END GUIDE STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_CRISIS_SIGNALS = [
    "exam in an hour", "exam in 30", "test in an hour", "test in 30",
    "due in an hour", "due tonight", "due in 30 minutes", "due right now",
    "exam tomorrow morning", "test tomorrow morning", "quiz tomorrow",
    "final exam", "midterm tomorrow",
]
_URGENT_SIGNALS = [
    "exam tomorrow", "test tomorrow", "due tomorrow", "assignment due",
    "quiz tomorrow", "presentation tomorrow", "need to pass",
    "failing this class", "going to fail",
]
_CONFUSION_SIGNALS = [
    "i don't get it", "i dont get it", "still confused", "don't understand",
    "dont understand", "not making sense", "lost me", "can you explain again",
    "what does that mean", "can you simplify", "too complicated",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "what do i need to know", "just give me the answer",
    "help now", "i have an exam", "what are the key points", "summarize it",
    "just the important stuff", "cheat sheet", "quick version",
]
_AMBIGUOUS_SIGNALS = [
    "like what", "what do you mean", "can you show me", "give me an example",
    "still don't get it", "still dont get it", "what now", "like this",
    "how does that work", "why does that happen",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_CRISIS_EN = (
    "Okay — exam mode. No fluff, just what you need.\n"
    "Tell me the subject and the main topics on the exam. "
    "I'll give you the essential concepts, common question types, "
    "and the most likely things to trip you up — in order of importance.\n"
    "What's the subject?"
)
_CRISIS_ES = (
    "Ok — modo examen. Sin rodeos, solo lo que necesitas.\n"
    "Dime la materia y los temas principales del examen. "
    "Te daré los conceptos esenciales, los tipos de preguntas más comunes "
    "y lo que más probablemente te hará tropezar — en orden de importancia.\n"
    "¿Cuál es la materia?"
)
_DIRECTIVE_EN = (
    "Got it — fastest path. Tell me:\n"
    "1. What subject or concept are we working on?\n"
    "2. What specifically is confusing — the whole thing, or one part?\n"
    "I'll skip the setup and go straight to what clicks."
)
_DIRECTIVE_ES = (
    "Entendido — camino más rápido. Dime:\n"
    "1. ¿En qué materia o concepto estamos trabajando?\n"
    "2. ¿Qué específicamente es confuso — todo, o una parte?\n"
    "Me salto la introducción y voy directo a lo que hace clic."
)

_BLEED_PATTERNS = [
    r"consult a (healthcare|medical|financial|legal) professional[^.]*\.",
    r"see a (doctor|attorney|lawyer)[^.]*\.",
    r"this is not (medical|legal|financial) advice[^.]*\.",
    r"enable two-factor[^.]*\.",
    r"change your password[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_crisis    = any(s in all_text for s in _CRISIS_SIGNALS)
    sig_urgent    = any(s in all_text for s in _URGENT_SIGNALS)
    sig_confusion = any(s in all_text for s in _CONFUSION_SIGNALS)
    sig_dir       = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb       = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                     and len(msg.strip().split()) < 10)

    urgency = 4 if sig_crisis else 3 if sig_urgent else 1
    overrides = {"emergency": None, "directive": None}

    # Gate 1: Exam crisis — triage mode
    if sig_crisis and not recent_turns:
        overrides["emergency"] = {"en": _CRISIS_EN, "es": _CRISIS_ES}
        logger.warning("📚 Guide CRISIS gate fired — urgency 4")

    # Gate 2: Directive / fast-track mode
    elif sig_dir:
        overrides["directive"] = {"en": _DIRECTIVE_EN, "es": _DIRECTIVE_ES}
        logger.info("📚 Guide DIRECTIVE gate fired")

    # Gate 3: Confusion detected — inject rephrase instruction
    if sig_confusion and recent_turns:
        system_prompt += (
            "\n\n🔄 CONFUSION SIGNAL: User didn't understand the previous explanation. "
            "Do NOT repeat it. Use a completely different analogy or approach. "
            "Start with 'Let me try this differently' and find a new angle."
        )
        logger.info("📚 Guide confusion rephrase gate injected")

    # Gate 4: Deadline urgency
    if sig_urgent and not sig_crisis:
        system_prompt += (
            "\n\n⏰ DEADLINE DETECTED: User has a test or assignment due soon. "
            "Prioritize the highest-yield concepts. Skip deep dives. "
            "Give them what they need to pass, not a complete education."
        )

    # Gate 5: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user wants more on this):\n"
                f"  User said: {lu[:200]}\n"
                f"  You explained: {lr[:300]}\n"
                "Give a different angle, example, or analogy. Do NOT repeat what you already said.\n"
            )
            logger.info("📚 Guide ambiguous reference context injected")

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    is_es = (lang == "es")
    answer = re.sub(r'\[GUIDE_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("📚 Guide crisis override applied")
        return answer

    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("📚 Guide directive override applied")
        return answer

    for pat in _BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
