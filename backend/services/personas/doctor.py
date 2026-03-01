"""
LYLO Doctor Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a clinical professional issuing a report. You are like a trusted family "
    "member who happens to have a medical degree. "
    "You speak the way a caring uncle-doctor would — warm, direct, no jargon unless needed. "
    "You say things like 'Hey, I don't love that symptom' or 'Let's slow down a second' "
    "or 'We're not going to panic.' "
    "You use contractions. You use 'we' and 'let's'. You never talk down to them. "
    "You give real answers, not disclaimers. "
    "You refer them to professionals when genuinely needed, but you don't hide behind it.\n\n"
    "━━━ DOCTOR SESSION STATE PROTOCOL ━━━\n"
    "Track the clinical phase and risk level at all times.\n"
    "- PHASES: INTAKE, ASSESS, DIAGNOSE, PROTOCOL, CLOSE\n"
    "- RISK: 1 (mild/routine), 2 (concerning), 3 (urgent — needs care today), 4 (emergency — call 911)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE clarifying question max.\n"
    "Rule 2: ASSESS. Map symptoms with pattern language: 'These symptoms commonly point to...' "
    "NEVER say 'I just checked WebMD', 'Studies show', or 'I checked the facts'. "
    "If Tavily data is available, say 'According to [source]...'. Otherwise draw from training.\n"
    "Rule 3: PROTOCOL. Risk 3 or 4 — give numbered action protocol immediately. "
    "Risk 4: lead with 'Call 911 now' before anything else.\n"
    "Rule 4: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'what do I do right now' — skip intake. Give 2-4 concrete steps.\n"
    "Rule 5: CONTINUITY. If user says 'is it safe', 'what now', 'like this', 'should I worry' — "
    "always answer in context of the symptom already being discussed. NEVER ask 'what do you mean?'\n"
    "Rule 6: PERSONA PURITY. Do not reference cybersecurity, finances, legal, or career "
    "unless the user brought it up in THIS conversation.\n"
    "Rule 7: CITATION DISCIPLINE. Never imply live browsing unless Tavily data confirmed. "
    "Say 'These symptoms commonly suggest...' not 'Research shows...'\n"
    "Rule 8: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[DOCTOR_STATE: {\"phase\": \"ASSESS\", \"risk\": 2, \"symptoms\": [\"chest pain\"]}]\n"
    "Do not add any text after this block.\n"
    "━━━ END DOCTOR STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_EMERGENCY_SIGNALS = [
    "cant breathe","can't breathe","cannot breathe","chest pain","heart attack","stroke",
    "unconscious","not breathing","collapsed","seizure","overdose",
    "bleeding heavily","call 911","no pulse","unresponsive",
]
_URGENT_SIGNALS = [
    "fever","throwing up","vomiting","severe pain","bad pain",
    "getting worse","spreading","cant move","can't move","cant walk","swollen",
    "allergic reaction","rash spreading","trouble breathing","dizziness",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do","i dont want questions","i don't want questions",
    "what do i do right now","help now","just help me","skip the questions","tell me the steps",
]
_AMBIGUOUS_SIGNALS = [
    "is it safe","should i worry","what now","like this","like that",
    "is this normal","what does that mean","is this serious",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_EMERGENCY_EN = (
    "This sounds like a medical emergency. Call 911 right now — do not wait.\n"
    "While waiting for help:\n"
    "1. Stay with them and keep them calm and still.\n"
    "2. Do NOT give food, water, or medication unless 911 tells you to.\n"
    "3. If they stop breathing and you know CPR — start it now.\n"
    "4. Unlock the front door so paramedics can get in.\n"
    "Stay on the line with 911. They will guide you."
)
_EMERGENCY_ES = (
    "Esto suena como una emergencia médica. Llama al 911 ahora mismo — no esperes.\n"
    "Mientras esperas ayuda:\n"
    "1. Quédate con ellos, mantén la calma y evita que se muevan.\n"
    "2. NO des comida, agua ni medicamentos a menos que el 911 te lo indique.\n"
    "3. Si dejaron de respirar y sabes RCP — comienza ahora.\n"
    "4. Desbloquea la puerta de entrada para que los paramédicos puedan entrar.\n"
    "Mantente en línea con el 911. Te guiarán."
)

_DIRECTIVE_URGENT_EN = (
    "Got it — no questions. Here's what to do right now:\n"
    "1. Note when symptoms started and if they're getting worse.\n"
    "2. Go to urgent care or ER today if any of these apply: "
    "fever over 103°F, pain 7+/10, symptoms spreading, trouble breathing.\n"
    "3. Don't take new medications until you know what this is.\n"
    "4. If it gets worse in the next hour — call 911, don't drive yourself.\n"
    "What's the main symptom right now?"
)
_DIRECTIVE_URGENT_ES = (
    "Entendido — sin preguntas. Esto es lo que debes hacer ahora:\n"
    "1. Anota cuándo comenzaron los síntomas y si están empeorando.\n"
    "2. Ve a urgencias hoy si alguno aplica: fiebre mayor a 39.4°C, dolor 7+/10, "
    "síntomas que se extienden, dificultad para respirar.\n"
    "3. No tomes medicamentos nuevos hasta saber qué es esto.\n"
    "4. Si empeora en la próxima hora — llama al 911, no manejes solo.\n"
    "¿Cuál es el síntoma principal ahora?"
)
_DIRECTIVE_MILD_EN = (
    "Got it — here's what I need you to do:\n"
    "1. Track the symptom — when it started, how often, what makes it better or worse.\n"
    "2. Stay hydrated and rest.\n"
    "3. Avoid self-medicating until we figure out what this is.\n"
    "Tell me: where exactly do you feel it, and how long has it been going on?"
)
_DIRECTIVE_MILD_ES = (
    "Entendido — esto es lo que necesito que hagas:\n"
    "1. Registra el síntoma — cuándo empezó, con qué frecuencia, qué lo mejora o empeora.\n"
    "2. Mantente hidratado y descansa.\n"
    "3. Evita automedicarte hasta entender qué es esto.\n"
    "Dime: ¿dónde exactamente lo sientes y cuánto tiempo lleva?"
)

_CITATION_PATTERNS = [
    r"I (just )?checked WebMD[^.]*\.",
    r"According to WebMD[^.]*\.",
    r"WebMD (says|states|reports)[^.]*\.",
    r"Studies show[^.]*\.",
    r"Research shows[^.]*\.",
    r"I checked the facts[^.]*\.",
    r"I just looked (this|it) up[^.]*\.",
]
_SECURITY_BLEED_PATTERNS = [
    r"secure (your|the) (account|device|password)[^.]*\.",
    r"change your password[^.]*\.",
    r"enable two-factor[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    """
    Returns (updated_system_prompt, overrides_dict).
    overrides keys: emergency (bilingual dict or None), directive (bilingual dict or None)
    """
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_emergency = any(s in all_text for s in _EMERGENCY_SIGNALS)
    sig_urgent    = any(s in all_text for s in _URGENT_SIGNALS)
    sig_dir       = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb       = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                     and len(msg.strip().split()) < 10)

    # Phase + risk
    if sig_emergency:
        phase, risk = "PROTOCOL", 4
    elif sig_urgent:
        phase, risk = "PROTOCOL", 3
    else:
        phase, risk = "ASSESS", 1

    overrides = {"emergency": None, "directive": None}

    # Gate 1: Emergency — only on first contact to avoid re-firing mid-convo
    if sig_emergency and not recent_turns:
        overrides["emergency"] = {"en": _EMERGENCY_EN, "es": _EMERGENCY_ES}
        logger.warning("🩺 Doctor EMERGENCY gate fired — risk 4")

    # Gate 2: Directive mode
    elif sig_dir:
        if sig_urgent or sig_emergency:
            overrides["directive"] = {"en": _DIRECTIVE_URGENT_EN, "es": _DIRECTIVE_URGENT_ES}
        else:
            overrides["directive"] = {"en": _DIRECTIVE_MILD_EN, "es": _DIRECTIVE_MILD_ES}
        logger.info("🩺 Doctor DIRECTIVE gate fired")

    # Gate 3: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user is referring to this — do NOT ask 'what do you mean?'):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer the current message in context of the symptom already being discussed.\n"
            )
            logger.info("🩺 Doctor ambiguous reference context injected")

    # Gate 4: Inject clinical context if risk elevated
    if risk >= 2:
        system_prompt += (
            f"\n\n⚕️ CURRENT CLINICAL CONTEXT: Phase={phase}, Risk={risk}/4. "
            "Do not re-ask for symptoms already established. Continue assessment."
        )

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips state block, applies overrides, strips citation/security bleed.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[DOCTOR_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Emergency override
    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("🩺 Doctor emergency override applied")
        return answer

    # Gate 2: Directive override
    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("🩺 Doctor directive override applied")
        return answer

    # Gate 3: Strip citation fabrication
    for pat in _CITATION_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 4: Strip security bleed
    for pat in _SECURITY_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
