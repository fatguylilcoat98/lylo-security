"""
LYLO Builder Persona Fortress — Get Things Done
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Builder")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a career coach running a paid session. You are like a sharp, resourceful friend "
    "who has navigated hiring, started projects, hit deadlines, and gotten things across the finish line — "
    "and actually wants to give you the real version of what to do. "
    "You say things like 'Here's the first move that actually matters' or "
    "'Don't overthink it — here's the shortest path' or "
    "'That's not a skills problem, that's a focus problem.' "
    "You help people execute — jobs, projects, goals, plans, decisions. "
    "You are direct, practical, and specific. No generic advice. No motivational filler. "
    "Real steps that move things forward today.\n\n"
    "━━━ BUILDER SESSION STATE PROTOCOL ━━━\n"
    "Track the execution phase and urgency at all times.\n"
    "- PHASES: INTAKE, SITUATION, STRATEGY, ACTION, CLOSE\n"
    "- URGENCY: 1 (general question), 2 (active goal or decision), "
    "3 (time-sensitive — deadline, interview, offer, launch), "
    "4 (crisis — termination, harassment, hostile environment, legal exposure)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE clarifying question max. "
    "Understand their situation and goal before giving strategy.\n"
    "Rule 2: SITUATION. Understand context before advising: "
    "what they want, what they've tried, what's blocking them, what's at stake.\n"
    "Rule 3: STRATEGY. Be specific. 'Work harder' is not advice. "
    "'Send three emails today and block two hours tomorrow morning' is advice. "
    "Give them something they can do in the next 24 hours.\n"
    "Rule 4: TIME-SENSITIVE. If there's a deadline, offer expiry, interview, or launch — "
    "state the time constraint first and build the response around it.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'what do I do right now' — skip ALL intake. Give 3 concrete steps immediately.\n"
    "Rule 6: CONTINUITY. If user says 'what now', 'should I do it', 'is that smart', "
    "'like this' — always answer in context of what's already being discussed. "
    "NEVER ask 'what do you mean?'\n"
    "Rule 7: SALARY / NEGOTIATION. If the user is negotiating anything — "
    "always tell them to negotiate. Give them the exact words to use.\n"
    "Rule 8: WORKPLACE CRISIS. If there is harassment, discrimination, retaliation, "
    "or hostile work environment — acknowledge the situation first, then advise on "
    "documentation and options. Do NOT say 'talk to HR' first — HR protects the company.\n"
    "Rule 9: PERSONA PURITY. Do not reference medical conditions, legal specifics beyond basics, "
    "or deep financial advice unless the user brought it up in THIS conversation.\n"
    "Rule 10: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[BUILDER_STATE: {\"phase\": \"STRATEGY\", \"urgency\": 2, \"focus\": \"job search\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END BUILDER STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_CRISIS_SIGNALS = [
    "fired", "terminated", "let go", "laid off", "they fired me", "just got fired",
    "harassment", "being harassed", "sexual harassment", "hostile work environment",
    "discrimination", "retaliation", "wrongful termination", "hostile workplace",
    "hr complaint", "threatening my job", "pip", "performance improvement plan",
]
_URGENT_SIGNALS = [
    "offer expires", "deadline tomorrow", "have to decide by", "interview tomorrow",
    "interview today", "interview in an hour", "interview in the morning",
    "layoff notice", "position being eliminated", "they told me today",
    "resignation letter", "two weeks notice", "last day",
]
_NEGOTIATION_SIGNALS = [
    "salary negotiation", "negotiate salary", "counter offer", "counteroffer",
    "they offered me", "the offer is", "asking for a raise", "ask for raise",
    "how much should i ask", "lowball offer", "is this a good offer",
]
_JOB_SEARCH_SIGNALS = [
    "job search", "looking for a job", "applying for jobs", "resume", "cover letter",
    "linkedin", "job board", "indeed", "recruiters", "headhunter",
    "interview prep", "phone screen", "technical interview", "behavioral interview",
]
_GROWTH_SIGNALS = [
    "promotion", "getting promoted", "how to get promoted", "career growth",
    "stuck in my career", "not moving up", "glass ceiling", "career change",
    "switching careers", "career pivot", "new industry",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "i dont want questions", "i don't want questions",
    "what do i do right now", "help now", "just help me",
    "skip the questions", "tell me the steps",
]
_AMBIGUOUS_SIGNALS = [
    "should i do it", "is that smart", "what now", "like this", "like that",
    "should i take it", "should i send it", "is this a good move",
    "will that hurt me", "is that normal", "should i say that",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_TERMINATION_EN = (
    "Getting fired is a shock — but your next move matters more than what just happened. "
    "Do these right now:\n"
    "1. Do NOT sign anything they hand you today — severance agreements, NDAs, "
    "release of claims. You have time to review. Signing immediately often waives your rights.\n"
    "2. Document everything before you lose access: save emails, performance reviews, "
    "any written communication that's relevant. Do it from your personal device.\n"
    "3. File for unemployment benefits as soon as possible — "
    "you're almost certainly eligible and waiting costs you money.\n"
    "4. If there's any hint of discrimination, retaliation, or harassment involved — "
    "talk to an employment attorney before signing anything. Many do free consultations.\n"
    "What happened? Tell me the context and I'll help you figure out your next move."
)
_TERMINATION_ES = (
    "Un despido es un golpe — pero tu próximo movimiento importa más que lo que acaba de pasar. "
    "Haz esto ahora mismo:\n"
    "1. NO firmes nada que te entreguen hoy — acuerdos de indemnización, NDAs, liberación de reclamaciones. "
    "Tienes tiempo para revisar. Firmar de inmediato suele renunciar a tus derechos.\n"
    "2. Documenta todo antes de perder acceso: guarda correos, evaluaciones de desempeño, "
    "cualquier comunicación relevante. Hazlo desde tu dispositivo personal.\n"
    "3. Solicita el seguro de desempleo lo antes posible — "
    "casi con certeza eres elegible y esperar te cuesta dinero.\n"
    "4. Si hay algún indicio de discriminación, represalia o acoso — "
    "habla con un abogado laboral antes de firmar algo. Muchos ofrecen consultas gratuitas.\n"
    "¿Qué pasó? Cuéntame el contexto y te ayudo a determinar tu próximo movimiento."
)

_HARASSMENT_EN = (
    "What you're describing is serious and you deserve to be taken seriously. "
    "Here's what to do:\n"
    "1. Start a private document — today — logging every incident: "
    "date, time, what was said or done, who was present. Keep it outside company systems.\n"
    "2. Save any written evidence: emails, texts, Slack messages. "
    "Screenshot and store on a personal device.\n"
    "3. Understand this before going to HR: HR's job is to protect the company, not you. "
    "Going to HR can be the right move, but know what you're walking into.\n"
    "4. If this rises to harassment or discrimination under the law — "
    "consult an employment attorney before making any formal complaint. "
    "Many offer free consultations and it costs you nothing to understand your options.\n"
    "Tell me more about what's been happening."
)
_HARASSMENT_ES = (
    "Lo que describes es serio y mereces ser tomado/a en serio. "
    "Esto es lo que debes hacer:\n"
    "1. Empieza un documento privado — hoy — registrando cada incidente: "
    "fecha, hora, qué se dijo o hizo, quién estaba presente. Guárdalo fuera de los sistemas de la empresa.\n"
    "2. Guarda cualquier evidencia escrita: correos, mensajes de texto, Slack. "
    "Toma capturas y guárdalas en un dispositivo personal.\n"
    "3. Entiende esto antes de ir a RRHH: el trabajo de RRHH es proteger a la empresa, no a ti. "
    "Ir a RRHH puede ser la decisión correcta, pero sabe en qué te estás metiendo.\n"
    "4. Si esto constituye acoso o discriminación bajo la ley — "
    "consulta con un abogado laboral antes de presentar cualquier queja formal. "
    "Muchos ofrecen consultas gratuitas.\n"
    "Cuéntame más sobre lo que ha estado pasando."
)

_DIRECTIVE_URGENT_EN = (
    "Got it — no questions. Here's what to do right now:\n"
    "1. Write down the key facts: what the situation is, what decision needs to be made, "
    "and what the deadline is.\n"
    "2. Don't respond, sign, or commit to anything until you've had 10 minutes to think clearly.\n"
    "3. If it's an offer or a negotiation — the answer is almost always: ask for more or ask for time.\n"
    "Give me the specifics and I'll give you the exact play."
)
_DIRECTIVE_URGENT_ES = (
    "Entendido — sin preguntas. Esto es lo que debes hacer ahora:\n"
    "1. Escribe los hechos clave: cuál es la situación, qué decisión hay que tomar y cuál es el plazo.\n"
    "2. No respondas, firmes ni te comprometas con nada hasta que hayas tenido 10 minutos para pensar con claridad.\n"
    "3. Si es una oferta o negociación — la respuesta casi siempre es: pide más o pide tiempo.\n"
    "Dame los detalles y te doy el plan exacto."
)
_DIRECTIVE_GENERAL_EN = (
    "Got it — here's where to start:\n"
    "1. Get clear on what you actually want: the specific role, company type, or outcome.\n"
    "2. Identify the one thing that's blocking you right now — skills gap, visibility, "
    "network, or just not applying enough.\n"
    "3. Pick one action you can take today, not this month.\n"
    "What's the situation? Short version."
)
_DIRECTIVE_GENERAL_ES = (
    "Entendido — aquí es por dónde empezar:\n"
    "1. Aclara lo que realmente quieres: el rol específico, tipo de empresa o resultado.\n"
    "2. Identifica la única cosa que te está bloqueando ahora mismo — "
    "brecha de habilidades, visibilidad, red de contactos, o simplemente no aplicar suficiente.\n"
    "3. Elige una acción que puedas tomar hoy, no este mes.\n"
    "¿Cuál es la situación? Versión corta."
)

_MEDICAL_BLEED_PATTERNS = [
    r"consult a (healthcare|medical) professional[^.]*\.",
    r"see a (doctor|physician)[^.]*\.",
    r"seek medical (advice|attention|help)[^.]*\.",
]
_FINANCIAL_BLEED_PATTERNS = [
    r"consult a financial advisor[^.]*\.",
    r"this is not financial advice[^.]*\.",
]
_SECURITY_BLEED_PATTERNS = [
    r"enable two-factor authentication[^.]*\.",
    r"change your password[^.]*\.",
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

    sig_crisis      = any(s in all_text for s in _CRISIS_SIGNALS)
    sig_fired       = any(s in all_text for s in ["fired", "terminated", "let go", "laid off", "just got fired"])
    sig_harassment  = any(s in all_text for s in ["harassment", "harassed", "hostile work", "discrimination", "retaliation"])
    sig_urgent      = any(s in all_text for s in _URGENT_SIGNALS)
    sig_negotiation = any(s in all_text for s in _NEGOTIATION_SIGNALS)
    sig_job_search  = any(s in all_text for s in _JOB_SEARCH_SIGNALS)
    sig_growth      = any(s in all_text for s in _GROWTH_SIGNALS)
    sig_dir         = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb         = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                       and len(msg.strip().split()) < 10)

    # Determine urgency
    if sig_crisis:
        urgency = 4
    elif sig_urgent:
        urgency = 3
    elif sig_negotiation or sig_job_search:
        urgency = 2
    else:
        urgency = 1

    overrides = {"emergency": None, "directive": None}

    # Gate 1: Termination — hardcoded do-not-sign response
    if sig_fired and not recent_turns:
        overrides["emergency"] = {"en": _TERMINATION_EN, "es": _TERMINATION_ES}
        logger.warning("🔨 Builder TERMINATION gate fired — urgency 4")

    # Gate 2: Harassment/hostile workplace
    elif sig_harassment and not recent_turns:
        overrides["emergency"] = {"en": _HARASSMENT_EN, "es": _HARASSMENT_ES}
        logger.warning("🔨 Builder HARASSMENT gate fired — urgency 4")

    # Gate 3: Directive mode
    elif sig_dir:
        if urgency >= 3:
            overrides["directive"] = {"en": _DIRECTIVE_URGENT_EN, "es": _DIRECTIVE_URGENT_ES}
        else:
            overrides["directive"] = {"en": _DIRECTIVE_GENERAL_EN, "es": _DIRECTIVE_GENERAL_ES}
        logger.info("🔨 Builder DIRECTIVE gate fired")

    # Gate 4: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user is referring to this — "
                "do NOT ask 'what do you mean?'):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer in context of the situation already being discussed.\n"
            )
            logger.info("🔨 Builder ambiguous reference context injected")

    # Gate 5: Salary negotiation — inject always-negotiate rule
    if sig_negotiation:
        system_prompt += (
            "\n\n💡 NEGOTIATION CONTEXT: User is in a salary or offer negotiation. "
            "Default position: always negotiate. The floor is the original offer. "
            "Give them a specific counter-offer strategy and the exact language to use — "
            "not just 'you can try to ask for more.'"
        )
        logger.info("🔨 Builder negotiation gate fired")

    # Gate 6: Interview urgency
    if sig_urgent and any(s in all_text for s in ["interview tomorrow", "interview today",
                                                    "interview in an hour", "interview in the morning"]):
        system_prompt += (
            "\n\n⏰ INTERVIEW IMMINENT: User has an interview very soon. "
            "Prioritize: what to research tonight, how to answer the top 3 likely questions, "
            "and what to bring/prepare. No theory — only what matters in the next few hours."
        )
        logger.info("🔨 Builder imminent interview gate fired")

    # Gate 7: Inject known context
    builder_signals = []
    if sig_fired:       builder_signals.append("Termination or layoff — do not sign anything immediately.")
    if sig_harassment:  builder_signals.append("Harassment or hostile workplace — documentation first.")
    if sig_urgent:      builder_signals.append("Time-sensitive career decision or deadline.")
    if sig_negotiation: builder_signals.append("Salary or offer negotiation in play.")
    if sig_job_search:  builder_signals.append("Active job search.")

    if builder_signals:
        system_prompt += (
            "\n\n💼 CURRENT BUILDER CONTEXT (do NOT re-ask — build on this):\n"
            + "\n".join(f"  - {s}" for s in builder_signals)
            + f"\n  - Urgency level: {urgency}/4"
            + "\n\nContinue from this context. Do not reset to intake."
        )
        logger.info(f"🔨 Builder context injected: {builder_signals}")

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips state block, applies overrides, strips cross-domain bleed.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[BUILDER_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Emergency override
    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("🔨 Builder emergency override applied")
        return answer

    # Gate 2: Directive override
    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("🔨 Builder directive override applied")
        return answer

    # Gate 3: Strip medical bleed
    for pat in _MEDICAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 4: Strip financial bleed
    for pat in _FINANCIAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 5: Strip security bleed
    for pat in _SECURITY_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
