"""
LYLO Mechanic Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging
from services.directive_detector import detect_directive_sync, has_incident_context

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a repair manual. You are like that one friend who actually knows cars — "
    "the one people call before they go to the shop so they don't get ripped off. "
    "You say things like 'Okay that sound is telling you something' or "
    "'Don't let them charge you for that — here's what it actually is.' "
    "You're direct, practical, and you actually care if they're safe on the road. "
    "You speak plain. No jargon unless you immediately explain it.\n\n"
    "━━━ MECHANIC SESSION STATE PROTOCOL ━━━\n"
    "Track the diagnostic phase and safety level at all times.\n"
    "- PHASES: INTAKE, DIAGNOSE, REPAIR, SAFETY-CHECK, CLOSE\n"
    "- SAFETY: 1 (routine maintenance), 2 (should fix soon), "
    "3 (do not ignore — fix this week), 4 (do not drive — safety risk)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE clarifying question max. "
    "Year, make, model, and symptom description. Never ask for all four at once.\n"
    "Rule 2: DIAGNOSE. Map symptoms to likely causes directly. "
    "Say 'That sound usually means...' or 'That warning light is telling you...' "
    "Never say 'I just looked this up' or 'According to my database.'\n"
    "Rule 3: SAFETY-CHECK. If the issue affects brakes, steering, tires, or engine temperature — "
    "safety level is 3 or 4. State it clearly. Never downplay safety issues.\n"
    "Rule 4: SAFETY LEVEL 4. If brakes are failing, steering is gone, tire is blown, "
    "or engine is overheating — lead with 'Do not drive this car' before anything else.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'is it safe to drive', "
    "'help now', 'what do I do right now' — skip intake. "
    "Give 2-4 concrete steps based on what is already known.\n"
    "Rule 6: CONTINUITY. If user says 'is it safe', 'can I drive', 'like this', 'what now' — "
    "ALWAYS answer based on the issue already being discussed. "
    "NEVER ask 'what do you mean?' or reset to intake.\n"
    "Rule 7: SHOP PROTECTION. If user mentions going to a shop or getting a quote — "
    "tell them what the job should realistically cost and what to watch out for.\n"
    "Rule 8: PERSONA PURITY. Do not reference medical, legal, financial, or other domains "
    "unless the user brought it up in THIS conversation.\n"
    "Rule 8b: OBD SCAN CONTEXT. If the user shares OBD fault codes from a scan — "
    "treat those codes as confirmed diagnostic data. Do NOT ask them to verify. "
    "Go straight to plain-English explanation, severity, and what to watch out for at the shop. "
    "Reference the specific code (e.g. 'That P0420 means...') so they know you're reading their actual car.\n"
    "Rule 9: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[MECHANIC_STATE: {\"phase\": \"DIAGNOSE\", \"safety\": 2, \"issue\": \"brake noise\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END MECHANIC STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_SAFETY4_SIGNALS = [
    "brakes failed", "brakes not working", "no brakes", "brake pedal went to floor",
    "steering not working", "lost steering", "can't steer", "cant steer",
    "tire blew", "blowout", "tire blew out", "overheating", "engine overheating",
    "smoke coming", "smoke from engine", "temperature gauge red", "red temperature",
    "oil pressure light", "check engine flashing", "engine shaking badly",
]
_SAFETY3_SIGNALS = [
    "brakes squealing", "brakes grinding", "brake noise", "soft brake pedal",
    "spongy brakes", "pulling to one side", "shaking at highway speed",
    "vibrating steering wheel", "steering wheel shaking", "wobble at speed",
    "low tire pressure", "flat tire", "slow leak", "tpms light",
    "check engine light", "service engine soon", "abs light", "traction control light",
    "battery light", "oil light", "transmission slipping", "hard to shift",
]
_ROUTINE_SIGNALS = [
    "oil change", "tire rotation", "air filter", "wiper blades", "spark plugs",
    "coolant flush", "brake fluid", "transmission fluid", "tune up",
]
_BUYING_SIGNALS = [
    "buying a car", "used car", "test drive", "dealership", "private seller",
    "carfax", "vin check", "pre-purchase", "inspection before buying",
    "is this a good deal", "how much should i pay",
]
_AMBIGUOUS_SIGNALS = [
    "is it safe", "can i drive", "should i drive", "is this serious",
    "what now", "like this", "like that", "is this okay",
    "how bad is it", "will it make it", "can it wait",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_SAFETY4_EN = (
    "Do not drive that car — this is a safety issue that needs to be fixed before "
    "you get back on the road.\n"
    "Here's what to do right now:\n"
    "1. Pull over safely if you're driving — hazard lights on, get off the road.\n"
    "2. Do not attempt to drive it further, even short distances.\n"
    "3. Call a tow truck — roadside assistance, AAA, or search 'tow truck near me'.\n"
    "4. Tell me exactly what's happening and I'll tell you what you're likely dealing with "
    "before you talk to any shop."
)
_SAFETY4_ES = (
    "No manejes ese auto — esto es un problema de seguridad que debe resolverse antes "
    "de volver a la carretera.\n"
    "Esto es lo que debes hacer ahora:\n"
    "1. Detente con seguridad si estás manejando — luces de emergencia y sal de la vía.\n"
    "2. No intentes manejarlo más, ni distancias cortas.\n"
    "3. Llama a una grúa — asistencia en carretera, AAA, o busca 'grúa cerca de mí'.\n"
    "4. Dime exactamente qué está pasando y te diré con qué es probable que estés tratando "
    "antes de hablar con cualquier taller."
)

_DIRECTIVE_SAFETY3_EN = (
    "Got it — here's what to do:\n"
    "1. You can drive carefully for now but get this looked at this week — don't put it off.\n"
    "2. Avoid highway speeds and hard braking until it's checked.\n"
    "3. When you go to a shop, tell them exactly what you told me — "
    "that's the symptom, not a diagnosis. Don't let them upsell you on things you didn't mention.\n"
    "What's the year, make, and model? I'll tell you what the likely fix is and what it should cost."
)
_DIRECTIVE_SAFETY3_ES = (
    "Entendido — esto es lo que debes hacer:\n"
    "1. Puedes manejar con cuidado por ahora, pero llévalo a revisar esta semana — no lo dejes pasar.\n"
    "2. Evita velocidades de autopista y frenadas bruscas hasta que lo revisen.\n"
    "3. Cuando vayas al taller, diles exactamente lo que me dijiste a mí — "
    "eso es el síntoma, no un diagnóstico. No dejes que te vendan cosas que no mencionaste.\n"
    "¿Cuál es el año, marca y modelo? Te diré cuál es la reparación probable y cuánto debe costar."
)
_DIRECTIVE_ROUTINE_EN = (
    "Got it — no questions. Here's what matters:\n"
    "1. Check your owner's manual for the manufacturer's recommended service intervals — "
    "ignore what the shop sticker says.\n"
    "2. For most repairs, get at least two quotes before committing.\n"
    "3. Ask for the old parts back after any repair — it keeps shops honest.\n"
    "Tell me the issue and I'll break down what's actually going on."
)
_DIRECTIVE_ROUTINE_ES = (
    "Entendido — sin preguntas. Esto es lo que importa:\n"
    "1. Revisa el manual del propietario para los intervalos de servicio recomendados por el fabricante — "
    "ignora lo que dice el sticker del taller.\n"
    "2. Para la mayoría de las reparaciones, obtén al menos dos cotizaciones antes de decidir.\n"
    "3. Pide que te devuelvan las piezas viejas después de cualquier reparación — mantiene a los talleres honestos.\n"
    "Cuéntame el problema y te explico qué está pasando realmente."
)

_MEDICAL_BLEED_PATTERNS = [
    r"consult a (healthcare|medical) professional[^.]*\.",
    r"see a (doctor|physician)[^.]*\.",
    r"seek medical (advice|attention|help)[^.]*\.",
]
_LEGAL_BLEED_PATTERNS = [
    r"consult (a|an) attorney[^.]*\.",
    r"speak with a lawyer[^.]*\.",
    r"this is not legal advice[^.]*\.",
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

    sig_safety4  = any(s in all_text for s in _SAFETY4_SIGNALS)
    sig_safety3  = any(s in all_text for s in _SAFETY3_SIGNALS)
    sig_routine  = any(s in all_text for s in _ROUTINE_SIGNALS)
    sig_buying   = any(s in all_text for s in _BUYING_SIGNALS)

    # OBD scan context detection
    import re as _re
    obd_codes = _re.findall(r'\b[PCBU][0-9]{4}\b', msg.upper())
    sig_obd   = len(obd_codes) > 0
    _dir_result  = detect_directive_sync(msg)
    sig_dir      = _dir_result["directive"]
    sig_amb      = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                    and len(msg.strip().split()) < 10)

    # Determine safety level
    if sig_safety4:
        safety = 4
    elif sig_safety3:
        safety = 3
    elif sig_routine or sig_buying:
        safety = 1
    else:
        safety = 1

    overrides = {"emergency": None, "directive": None}

    # Gate 1: Safety level 4 — do not drive (hardcoded)
    if sig_safety4 and not recent_turns:
        overrides["emergency"] = {"en": _SAFETY4_EN, "es": _SAFETY4_ES}
        logger.warning("🔧 Mechanic SAFETY-4 gate fired — do not drive")

    # Gate 2: Directive mode
    elif sig_dir:
        if sig_safety4 or sig_safety3:
            overrides["directive"] = {"en": _DIRECTIVE_SAFETY3_EN, "es": _DIRECTIVE_SAFETY3_ES}
        else:
            overrides["directive"] = {"en": _DIRECTIVE_ROUTINE_EN, "es": _DIRECTIVE_ROUTINE_ES}
        logger.info("🔧 Mechanic DIRECTIVE gate fired")

    # Gate 3: Ambiguous reference — critical for mechanic
    # "is it safe / can I drive / like this" MUST use last turn context
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN — user is asking about THIS specific issue "
                "(do NOT ask 'what do you mean?' — answer based on this):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer 'is it safe' / 'can I drive' / 'what now' in direct reference "
                "to the mechanical issue already being discussed.\n"
            )
            logger.info("🔧 Mechanic ambiguous reference context injected")
    elif sig_amb and not recent_turns:
        # No context at all — ask for the issue, don't say "what do you mean"
        system_prompt += (
            "\n\nUser is asking about safety or drivability but no issue has been established yet. "
            "Ask them what's going on with the vehicle in ONE clear question."
        )

    # Gate 4: Inject safety level into system prompt
    if safety >= 3:
        system_prompt += (
            f"\n\n⚠️ SAFETY LEVEL {safety}/4 DETECTED. "
            + ("Do not minimize this issue. " if safety == 3 else "Lead with 'Do not drive' immediately. ")
            + "State the safety concern clearly before any other information."
        )
        logger.info(f"🔧 Mechanic safety level {safety} injected")

    # Gate 4b: OBD scan data received — skip intake, go straight to diagnosis
    if sig_obd:
        system_prompt += (
            f"\n\n🔌 OBD SCAN DATA: User has shared fault code(s) from a vehicle scan: {', '.join(obd_codes)}. "
            "These are confirmed codes from their actual car — do NOT ask them to verify or re-describe symptoms. "
            "For each code: (1) state in plain English what it means, (2) give severity, "
            "(3) give realistic cost range, (4) give 2-3 specific questions to ask the shop. "
            "Reference each code by name so they know you're reading their specific results."
        )
        logger.info(f"🔧 Mechanic OBD context injected: {obd_codes}")

    # Gate 5: Shop protection — inject fairness context
    if sig_buying:
        system_prompt += (
            "\n\nUser is considering a vehicle purchase. "
            "Advise them on what to inspect, red flags to watch for, "
            "and whether a pre-purchase inspection is worth it for their situation."
        )

    # Gate 6: Inject known issue context
    issue_signals = []
    if sig_safety4: issue_signals.append("Critical safety issue — brakes, steering, tire, or engine.")
    if sig_safety3: issue_signals.append("Non-critical but urgent mechanical issue detected.")
    if sig_buying:  issue_signals.append("User is considering a vehicle purchase.")

    if issue_signals:
        system_prompt += (
            "\n\n🔧 CURRENT VEHICLE CONTEXT (do NOT re-ask — build on this):\n"
            + "\n".join(f"  - {s}" for s in issue_signals)
            + "\n\nContinue from this context. Do not reset to intake."
        )

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips state block, applies overrides, strips cross-domain bleed.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[MECHANIC_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Safety-4 / emergency override
    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("🔧 Mechanic safety-4 override applied")
        return answer

    # Gate 2: Directive override
    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("🔧 Mechanic directive override applied")
        return answer

    # Gate 3: Strip medical bleed
    for pat in _MEDICAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 4: Strip legal bleed
    for pat in _LEGAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
