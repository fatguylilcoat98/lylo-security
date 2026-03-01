"""
LYLO Lawyer Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a formal attorney issuing legal opinions. You are like an older cousin "
    "who knows the legal system inside and out and actually wants to help you. "
    "You say things like 'Okay here's the real deal' or 'Don't sign anything yet' or "
    "'Let me break this down.' You use plain language. You protect them like family. "
    "You tell them what to watch out for.\n\n"
    "━━━ LAWYER SESSION STATE PROTOCOL ━━━\n"
    "Track the legal phase and urgency at all times.\n"
    "- PHASES: INTAKE, FACT-GATHER, ANALYZE, ADVISE, CLOSE\n"
    "- URGENCY: 1 (general question), 2 (active dispute), "
    "3 (time-sensitive — deadline or court date), 4 (emergency — arrest, accident, imminent harm)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE clarifying question max. "
    "Never fire multiple intake questions at once.\n"
    "Rule 2: FACT-GATHER. Get the key facts before advising: "
    "what happened, when, who's involved, what's been signed or said.\n"
    "Rule 3: ADVISE. Plain language only. No Latin, no legalese unless you immediately explain it. "
    "Always tell them the risk first, then the options.\n"
    "Rule 4: TIME-SENSITIVE. If there's a statute of limitations, court date, "
    "eviction notice, or contract deadline — state it clearly upfront. "
    "Time kills legal cases. Never bury deadlines.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'what do I do right now', 'I don't want questions' — "
    "skip ALL intake. Give 3 concrete numbered steps immediately based on what is known.\n"
    "Rule 6: CONTINUITY. If user says 'what now', 'is that legal', 'can they do that', "
    "'like this' — always answer in context of the legal situation already being discussed. "
    "NEVER ask 'what do you mean?'\n"
    "Rule 7: PERSONA PURITY. Do not reference medical conditions, cybersecurity, "
    "finances, or career unless the user brought it up in THIS conversation.\n"
    "Rule 8: NEVER give a definitive legal ruling — you are not their licensed attorney. "
    "Frame advice as: 'Here's what I'd watch out for' or 'In most states, this means...'\n"
    "Rule 9: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[LAWYER_STATE: {\"phase\": \"ADVISE\", \"urgency\": 2, \"issues\": [\"contract dispute\"]}]\n"
    "Do not add any text after this block.\n"
    "━━━ END LAWYER STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_ARREST_SIGNALS = [
    "arrested", "being arrested", "pulled over", "cops", "police", "in custody",
    "detained", "handcuffed", "under arrest", "miranda", "right to remain silent",
]
_ACCIDENT_SIGNALS = [
    "car accident", "car wreck", "crashed", "hit by a car", "got hit",
    "fender bender", "collision", "rear ended", "rear-ended",
]
_EVICTION_SIGNALS = [
    "eviction", "evicted", "eviction notice", "pay or quit", "30 day notice",
    "3 day notice", "landlord locked me out", "landlord changed locks",
]
_CONTRACT_SIGNALS = [
    "contract", "signed", "agreement", "nda", "non-compete", "non compete",
    "settlement", "terms", "clause", "fine print", "waiver",
]
_WORKPLACE_SIGNALS = [
    "fired", "terminated", "laid off", "wrongful termination", "hostile work",
    "harassment", "discrimination", "hr complaint", "hostile workplace",
    "retaliation", "unpaid wages", "overtime",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "i dont want questions", "i don't want questions",
    "what do i do right now", "help now", "just help me",
    "skip the questions", "tell me the steps",
]
_AMBIGUOUS_SIGNALS = [
    "is that legal", "can they do that", "what now", "like this", "like that",
    "is this okay", "do i have rights", "what does that mean", "is this enforceable",
]
_DEADLINE_SIGNALS = [
    "statute of limitations", "deadline", "court date", "hearing", "respond by",
    "days to respond", "file by", "appeal deadline",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_ARREST_EN = (
    "If you're being arrested right now — here's what matters most:\n"
    "1. Say these words and only these words: 'I am invoking my right to remain silent "
    "and my right to an attorney.'\n"
    "2. Do NOT answer any questions, explain yourself, or try to talk your way out. "
    "Anything you say will be used against you.\n"
    "3. Do NOT resist physically — even if the arrest is wrong. Fight it in court, not on the street.\n"
    "4. As soon as you can — call a lawyer or have someone call one for you.\n"
    "You have rights. Use them."
)
_ARREST_ES = (
    "Si te están arrestando ahora mismo — esto es lo más importante:\n"
    "1. Di estas palabras y solo estas: 'Estoy ejerciendo mi derecho a guardar silencio "
    "y mi derecho a un abogado.'\n"
    "2. NO respondas preguntas, no te expliques ni intentes salir del paso hablando. "
    "Todo lo que digas puede usarse en tu contra.\n"
    "3. NO resistas físicamente — aunque el arresto sea injusto. Peléalo en la corte.\n"
    "4. En cuanto puedas — llama a un abogado o pide a alguien que llame por ti.\n"
    "Tienes derechos. Úsalos."
)

_ACCIDENT_EN = (
    "Right after an accident — do these in order:\n"
    "1. Do NOT say 'I'm sorry' or admit fault to anyone — not the other driver, "
    "not bystanders, not insurance. It will be used against you.\n"
    "2. Call 911 and get a police report filed — even for minor accidents. "
    "No report = your word against theirs.\n"
    "3. Document everything now: photos of both cars, the scene, license plates, "
    "any visible damage, and road conditions.\n"
    "4. Get the other driver's: name, license number, insurance info, and plate number.\n"
    "5. Do NOT give a recorded statement to any insurance company until you've talked to a lawyer."
)
_ACCIDENT_ES = (
    "Justo después de un accidente — haz esto en orden:\n"
    "1. NO digas 'lo siento' ni admitas culpa a nadie — ni al otro conductor, "
    "ni testigos, ni al seguro. Se usará en tu contra.\n"
    "2. Llama al 911 y presenta un reporte policial — incluso para accidentes menores.\n"
    "3. Documenta todo ahora: fotos de ambos autos, la escena, placas y daños visibles.\n"
    "4. Obtén del otro conductor: nombre, número de licencia, información del seguro y placa.\n"
    "5. NO des una declaración grabada a ninguna aseguradora antes de hablar con un abogado."
)

_DIRECTIVE_URGENT_EN = (
    "Got it — no questions. Here's what to do right now:\n"
    "1. Write down everything you remember — dates, names, what was said or signed. "
    "Do it now while it's fresh.\n"
    "2. Don't sign anything, agree to anything, or respond in writing until you know your position.\n"
    "3. If there's a deadline involved — note the exact date. Missing it can kill your case.\n"
    "Tell me what happened and I'll tell you exactly where you stand."
)
_DIRECTIVE_URGENT_ES = (
    "Entendido — sin preguntas. Esto es lo que debes hacer ahora:\n"
    "1. Escribe todo lo que recuerdes — fechas, nombres, lo que se dijo o firmó. "
    "Hazlo ahora mientras está fresco.\n"
    "2. No firmes nada, no aceptes nada ni respondas por escrito hasta saber tu posición.\n"
    "3. Si hay una fecha límite — anótala exactamente. Perderla puede arruinar tu caso.\n"
    "Cuéntame qué pasó y te diré exactamente dónde estás parado."
)
_DIRECTIVE_GENERAL_EN = (
    "Got it — here's where to start:\n"
    "1. Don't say or sign anything more until you understand your rights in this situation.\n"
    "2. Document what happened — who, what, when, where, any witnesses.\n"
    "3. Determine if there's a time limit — most legal claims have deadlines.\n"
    "What's the core issue? Give me the short version."
)
_DIRECTIVE_GENERAL_ES = (
    "Entendido — aquí es por dónde empezar:\n"
    "1. No digas ni firmes nada más hasta entender tus derechos en esta situación.\n"
    "2. Documenta lo que pasó — quién, qué, cuándo, dónde, testigos.\n"
    "3. Determina si hay un plazo — la mayoría de los reclamos legales tienen fechas límite.\n"
    "¿Cuál es el problema principal? Dame la versión corta."
)

_MEDICAL_BLEED_PATTERNS = [
    r"consult a (healthcare|medical) professional[^.]*\.",
    r"see a (doctor|physician)[^.]*\.",
    r"seek medical (advice|attention|help)[^.]*\.",
    r"this is not medical advice[^.]*\.",
]
_FINANCIAL_BLEED_PATTERNS = [
    r"consult a financial advisor[^.]*\.",
    r"this is not financial advice[^.]*\.",
    r"speak with a (certified|licensed) financial[^.]*\.",
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

    sig_arrest   = any(s in all_text for s in _ARREST_SIGNALS)
    sig_accident = any(s in all_text for s in _ACCIDENT_SIGNALS)
    sig_eviction = any(s in all_text for s in _EVICTION_SIGNALS)
    sig_contract = any(s in all_text for s in _CONTRACT_SIGNALS)
    sig_work     = any(s in all_text for s in _WORKPLACE_SIGNALS)
    sig_deadline = any(s in all_text for s in _DEADLINE_SIGNALS)
    sig_dir      = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb      = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                    and len(msg.strip().split()) < 10)

    # Determine urgency
    if sig_arrest:
        urgency = 4
    elif sig_accident or sig_eviction:
        urgency = 3
    elif sig_contract or sig_work or sig_deadline:
        urgency = 2
    else:
        urgency = 1

    overrides = {"emergency": None, "directive": None}

    # Gate 1: Arrest — hardcoded Miranda rights response
    if sig_arrest and not recent_turns:
        overrides["emergency"] = {"en": _ARREST_EN, "es": _ARREST_ES}
        logger.warning("⚖️ Lawyer ARREST gate fired — urgency 4")

    # Gate 2: Car accident — hardcoded protocol
    elif sig_accident and not recent_turns:
        overrides["emergency"] = {"en": _ACCIDENT_EN, "es": _ACCIDENT_ES}
        logger.warning("⚖️ Lawyer ACCIDENT gate fired — urgency 3")

    # Gate 3: Directive mode
    elif sig_dir:
        if urgency >= 3:
            overrides["directive"] = {"en": _DIRECTIVE_URGENT_EN, "es": _DIRECTIVE_URGENT_ES}
        else:
            overrides["directive"] = {"en": _DIRECTIVE_GENERAL_EN, "es": _DIRECTIVE_GENERAL_ES}
        logger.info("⚖️ Lawyer DIRECTIVE gate fired")

    # Gate 4: Ambiguous reference — prepend last turn context
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user is referring to this — "
                "do NOT ask 'what do you mean?'):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer the current message in context of the legal situation already discussed.\n"
            )
            logger.info("⚖️ Lawyer ambiguous reference context injected")

    # Gate 5: Deadline warning — inject urgency into system prompt
    if sig_deadline:
        system_prompt += (
            "\n\n⚠️ DEADLINE DETECTED: User's situation involves a time-sensitive legal deadline. "
            "Identify and state the relevant deadline clearly in your response. "
            "Never bury deadline information — lead with it."
        )
        logger.info("⚖️ Lawyer deadline warning injected")

    # Gate 6: Inject known legal context
    legal_signals = []
    if sig_arrest:   legal_signals.append("Arrest or police encounter in progress or recent.")
    if sig_accident: legal_signals.append("Car accident — liability and documentation at stake.")
    if sig_eviction: legal_signals.append("Eviction or landlord dispute — tenant rights apply.")
    if sig_contract: legal_signals.append("Contract or agreement involved — review before signing.")
    if sig_work:     legal_signals.append("Workplace issue — employment law may apply.")

    if legal_signals:
        system_prompt += (
            "\n\n⚖️ CURRENT LEGAL CONTEXT (do NOT re-ask — build on this):\n"
            + "\n".join(f"  - {s}" for s in legal_signals)
            + f"\n  - Urgency level: {urgency}/4"
            + "\n\nContinue from this context. Do not reset to intake."
        )
        logger.info(f"⚖️ Lawyer legal context injected: {legal_signals}")

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips state block, applies overrides, strips cross-domain bleed.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[LAWYER_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Emergency override (arrest/accident)
    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("⚖️ Lawyer emergency override applied")
        return answer

    # Gate 2: Directive override
    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("⚖️ Lawyer directive override applied")
        return answer

    # Gate 3: Strip medical bleed
    for pat in _MEDICAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 4: Strip financial bleed
    for pat in _FINANCIAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
