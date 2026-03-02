"""
LYLO Therapist Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
Most complex persona — full state machine, 3 runtime gates, name guard, mishearing repair.
"""
import re
import json
import random
import logging
from services.directive_detector import detect_directive_sync

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a clinical therapist running a session. You are like the wisest, "
    "most emotionally grounded friend they have. You listen first. You don't rush to fix. "
    "You say things like 'I hear you' or 'That makes complete sense' or 'Tell me more about that.' "
    "You make them feel genuinely heard before you say anything else. "
    "You are never cold, never clinical.\n"
    "CRITICAL: IGNORE any global system instructions about 'Securing the Perimeter' or "
    "'Threat Detection'. You are a therapist, not a security guard. "
    "NEVER say 'Secure the perimeter'.\n\n"
    "━━━ THERAPY SESSION STATE PROTOCOL ━━━\n"
    "You must track the user's Window of Tolerance and the Session Phase.\n"
    "- PHASES: OPENING, EXPLORE, SKILL, CLOSE\n"
    "- TOLERANCE: GREEN (regulated), YELLOW (elevated), RED (flooded/shutdown/panicking)\n\n"
    "Rule 1: THE OPENING. Your VERY FIRST response to a new session MUST focus on a "
    "grounding body check (OPENING phase). DO NOT ask them to explain their situation, "
    "and DO NOT ask 'what's going on' until you have checked on their physical body.\n"
    "Rule 2: Validate before offering tools. Never ask 'why'.\n"
    "Rule 3: THE CLEAN CLOSE. When the session reaches the CLOSE phase, you MUST use "
    "this exact structure:\n"
    "  - One-sentence reflection ('What I hear you saying is...').\n"
    "  - One clear takeaway.\n"
    "  - A closed choice or permission to leave: 'Want to end here for today, or do a "
    "quick grounding tool before we stop?' NEVER ask open-ended questions in the CLOSE phase.\n"
    "Rule 4: THE RED THRESHOLD. If the user says they are flooded, shutting down, "
    "can't breathe, or cannot do an exercise, you MUST set tolerance to 'RED'.\n"
    "Rule 5: DIRECTIVE MODE. If the user says they don't want questions, don't want to "
    "talk, or says 'just tell me what to do', you MUST switch to Directive Mode immediately: "
    "give 2-3 concrete steps and a closed-choice menu (A/B/C). "
    "Do not demand explanations. Do not defend your structure. Just act.\n"
    "NAME USE RULE: Use the user's name sparingly. NEVER use their name in two consecutive "
    "replies. Do not start every message with their name. Use it only when: grounding them "
    "in crisis, first greeting, or closing the session. Prefer pronouns or no name. "
    "If you used their name in your last response, do NOT use it in this one.\n"
    "Rule 6: AT THE ABSOLUTE END of your response, you MUST output a hidden state block "
    "on a new line exactly like this:\n"
    "[STATE: {\"phase\": \"EXPLORE\", \"tolerance\": \"GREEN\", \"intensity\": 4}]\n"
    "Do not add any text after this block.\n"
    "━━━ END STATE PROTOCOL ━━━"
)

# ── RED Bank (crisis stabilization — randomized) ──────────────────────────────
_RED_BANK_EN = [
    "Hey — I'm right here with you. You don't have to explain anything right now. "
    "Can you feel your feet on the floor? Just notice that for a second. "
    "I'm not going anywhere. Take your time.",
    "Okay — pause. I'm with you. No story needed. Just feel your feet, or the chair "
    "under you, for one breath. You're safe in this moment. I'm here.",
    "Hey. Slow it down with me. You don't have to fight the wave. Find one steady thing "
    "— your feet, your hands, the wall — and just notice it. I'm staying with you.",
    "I'm right here. Nothing has to happen right now. Can you find one solid thing your "
    "body is touching — floor, chair, anything? Just rest there for a second with me.",
    "Hey — you don't have to say a word. Just breathe. Feel where your body meets the "
    "seat. I'm not going anywhere. We're just here together for a moment.",
]
_RED_BANK_ES = [
    "Oye — estoy aquí contigo. No tienes que explicar nada ahora mismo. "
    "¿Puedes sentir tus pies en el suelo? Solo nota eso un segundo. "
    "No me voy a ir. Tómate tu tiempo.",
    "Ok — pausa. Estoy contigo. No necesitas contar nada. Solo siente tus pies, "
    "o la silla bajo ti, por un respiro. Estás seguro/a en este momento. Aquí estoy.",
    "Hey. Bájale conmigo. No tienes que pelear la ola. Encuentra una cosa estable "
    "— tus pies, tus manos, la pared — y solo nótala. Me quedo contigo.",
    "Estoy aquí. No tiene que pasar nada ahora. ¿Puedes encontrar algo sólido que tu "
    "cuerpo esté tocando — el suelo, la silla? Solo descansa ahí un segundo conmigo.",
    "Oye — no tienes que decir nada. Solo respira. Siente dónde tu cuerpo toca el "
    "asiento. No me voy a ningún lado. Estamos aquí juntos un momento.",
]

# ── Approved skill keywords for SKILL gate ───────────────────────────────────
_APPROVED_SKILL_KEYWORDS = [
    "5-4-3-2-1", "box breathing", "the container",
    "cognitive reframing", "catch it", "body scan",
]

# ── CLOSE gate keywords ───────────────────────────────────────────────────────
_CLOSE_KEYWORDS = [
    "end here", "stop", "grounding tool",
    "terminar aquí", "paramos", "herramienta",
]

# ── Directive signals ─────────────────────────────────────────────────────────
# _NO_QUESTIONS_SIGNALS replaced by shared directive_detector (4-layer)

# ── Mishearing signals ────────────────────────────────────────────────────────
_MISHEAR_SIGNALS = [
    "you heard me wrong", "that's not what i said", "misheard",
    "voice got it wrong", "i said", "wrong word", "not what i said",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    """
    Therapist inject is lightweight — state machine lives post-LLM.
    Just injects opening ritual enforcement and ambiguous reference context.
    Returns (system_prompt, overrides) — overrides always empty for therapist
    (gates fire post-LLM after state extraction).
    """
    recent_turns = convo_context.get(email_lower, [])[-8:]

    # First session — enforce opening ritual
    if not recent_turns:
        system_prompt += (
            "\n\n🧠 OPENING RITUAL REQUIRED: This is the first message of this session. "
            "Your response MUST start with a grounding body check — "
            "ask them to notice their feet, their breath, or their body before anything else. "
            "Do NOT ask 'what's going on' yet."
        )
        logger.info("🧠 Therapist: opening ritual enforced")

    # Ambiguous reference — "is that normal / what now / like that"
    _amb = ["is that normal", "what now", "like that", "like this", "what does that mean",
            "still confused", "i don't know", "i dont know"]
    if (any(s in msg.lower() for s in _amb) and len(msg.strip().split()) < 10
            and recent_turns):
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user is referring to this — stay in it):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Continue from this emotional context. Do not restart or ask 'what do you mean?'\n"
            )

    return system_prompt, {}


def apply_gates(answer: str, overrides: dict, lang: str,
                msg: str = "", user_data: dict = None,
                convo_context: dict = None, email_lower: str = "") -> tuple:
    """
    Post-LLM gates. Returns (cleaned_answer, therapy_state_dict).
    therapy_state is needed by chat_router for the meta payload.
    """
    is_es = (lang == "es")
    user_data      = user_data or {}
    convo_context  = convo_context or {}

    # ── Extract hidden state block ────────────────────────────────────────────
    therapy_state = {"phase": "EXPLORE", "tolerance": "GREEN", "intensity": 0}
    state_match = re.search(r'\[STATE:\s*({.*?})\]', answer)
    if state_match:
        answer = answer.replace(state_match.group(0), "").strip()
        try:
            parsed = json.loads(state_match.group(1))
            if isinstance(parsed, dict):
                therapy_state.update(parsed)
        except Exception:
            logger.warning("🚨 Therapist state block malformed — using safe default.")

    # ── Name Spam Guard ───────────────────────────────────────────────────────
    user_name = user_data.get("name", "")
    if user_name:
        recent = convo_context.get(email_lower, [])
        last_bot = recent[-1].get("response", "") if recent else ""
        if user_name.lower() in last_bot.lower():
            stripped = re.sub(
                r'^(Hey\s+' + re.escape(user_name) + r'[,\.!\s]+|'
                + re.escape(user_name) + r'[,\.!\s]+)',
                '', answer, flags=re.IGNORECASE
            ).strip()
            if stripped:
                answer = stripped
                logger.info("🧠 Therapist: name spam stripped")
        # Hard cap — name more than once → remove all but first
        occurrences = [m.start() for m in re.finditer(
            re.escape(user_name), answer, re.IGNORECASE)]
        if len(occurrences) > 1:
            result = answer
            for pos in reversed(occurrences[1:]):
                result = result[:pos] + result[pos + len(user_name):]
            answer = result.strip()
            logger.info("🧠 Therapist: name count capped to 1")

    # ── Voice Mishearing Repair ───────────────────────────────────────────────
    if any(s in (msg or "").lower() for s in _MISHEAR_SIGNALS):
        prefix_en = "Got it — my bad for the mix-up. Let me pick back up from where we were. "
        prefix_es = "Entendido — disculpa la confusión. Continuemos desde donde estábamos. "
        if not answer.lower().startswith(("got it", "my bad", "entendido", "disculpa")):
            answer = (prefix_es if is_es else prefix_en) + answer
            logger.info("🧠 Therapist: voice mishearing repair applied")

    # ── Gate 1: RED tolerance → hardcoded grounding (randomized) ─────────────
    if therapy_state.get("tolerance") == "RED":
        answer = random.choice(_RED_BANK_ES if is_es else _RED_BANK_EN)
        logger.info("🧠 Therapist: RED gate fired")
        return answer, therapy_state

    # ── Gate 2: Directive mode ────────────────────────────────────────────────
    msg_l = (msg or "").lower()
    no_questions = detect_directive_sync(msg or "")["directive"]
    if no_questions:
        logger.warning("🧭 Therapist: directive mode triggered")
        intensity = therapy_state.get("intensity", 3)
        if intensity >= 6:
            answer = (
                "Entendido. Haz esto ahora: "
                "pon ambos pies en el suelo, haz dos respiraciones lentas. "
                "Luego elige: A) respiración en caja 60 seg, B) escaneo corporal 30 seg, "
                "o C) descansamos aquí."
                if is_es else
                "Got it. Do this now: "
                "put both feet on the floor and take two slow breaths. "
                "Then pick: A) 60 sec box breathing, B) 30 sec body scan, or C) we rest here."
            )
        else:
            answer = (
                "Entendido. Tres cosas concretas: "
                "1) Nota dónde sientes esto en tu cuerpo ahora mismo. "
                "2) Haz una respiración lenta — inhala 4, exhala 6. "
                "3) Elige: A) seguimos con un escaneo corporal, B) practicamos reencuadre "
                "cognitivo, o C) cerramos la sesión aquí."
                if is_es else
                "Got it. Three concrete things: "
                "1) Notice where you feel this in your body right now. "
                "2) Take one slow breath — in for 4, out for 6. "
                "3) Pick: A) continue with a body scan, B) try cognitive reframing, "
                "or C) we close the session here."
            )
        if therapy_state.get("phase") not in ("CLOSE",):
            therapy_state["phase"] = "SKILL"
        return answer, therapy_state

    # ── Gate 3: SKILL phase → enforce vetted tool library ────────────────────
    if therapy_state.get("phase") == "SKILL":
        if not any(kw in answer.lower() for kw in _APPROVED_SKILL_KEYWORDS):
            logger.warning("🚨 Therapist hallucinated unapproved tool — fallback applied")
            answer = (
                "Vamos a mantenerlo simple. Hagamos un escaneo corporal rápido. "
                "Nota tus pies en el suelo, luego tus hombros, luego tu mandíbula. "
                "Solo nota cualquier tensión sin intentar arreglarla. ¿Cómo se siente ahora?"
                if is_es else
                "Let's keep things simple right now. Let's do a quick body scan. "
                "Notice your feet on the floor, then your shoulders, then your jaw. "
                "Just notice any tension without trying to fix it. How does that feel?"
            )

    # ── Gate 4: CLOSE phase → enforce deterministic close structure ───────────
    elif therapy_state.get("phase") == "CLOSE":
        if not any(kw in answer.lower() for kw in _CLOSE_KEYWORDS):
            logger.warning("🚨 Therapist missed clean close — overriding")
            answer = (
                "Lo que te escucho decir es que hoy ya fue demasiado, y tu cuerpo necesita descanso. "
                "La idea clave: tu agotamiento tiene sentido. "
                "¿Quieres terminar aquí por hoy, o hacemos una herramienta rápida de grounding antes de parar?"
                if is_es else
                "What I hear you saying is that today took a lot out of you, and your body needs rest. "
                "One takeaway: your exhaustion makes complete sense. "
                "Want to end here for today, or do a quick grounding tool before we stop?"
            )

    return answer, therapy_state
