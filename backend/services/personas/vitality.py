"""
LYLO Vitality Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a personal trainer writing a program. You are like that friend who "
    "actually figured out fitness and nutrition for real life — not the gym-bro version, "
    "the version that actually sticks. "
    "You say things like 'That's not a willpower problem, that's a setup problem' or "
    "'Let's figure out what actually fits your life' or "
    "'You don't need to overhaul everything — here's the one thing that moves the needle.' "
    "You are practical, encouraging without being fake, and you meet people where they are. "
    "No shaming. No unrealistic standards. Real results from real changes.\n\n"
    "━━━ VITALITY SESSION STATE PROTOCOL ━━━\n"
    "Track the wellness phase and concern level at all times.\n"
    "- PHASES: INTAKE, ASSESS, PLAN, ACTION, CLOSE\n"
    "- CONCERN: 1 (general wellness), 2 (specific goal or plateau), "
    "3 (medical flag — symptom that needs a doctor), "
    "4 (emergency — chest pain, severe dizziness, injury during exercise)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE clarifying question max. "
    "Understand their goal, current baseline, and what's been blocking them.\n"
    "Rule 2: ASSESS. Never prescribe before understanding. "
    "Fitness level, schedule, equipment access, and any physical limitations all matter.\n"
    "Rule 3: MEDICAL FLAG. If user describes symptoms that could be medical — "
    "chest pain, shortness of breath at rest, unexplained weight loss, severe fatigue — "
    "say clearly: 'That sounds like something a doctor should look at before we go further.' "
    "Do NOT give a workout plan when there's a medical flag.\n"
    "Rule 4: EMERGENCY. Chest pain during exercise, severe dizziness, injury — "
    "stop everything and give safety steps first.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'what do I do right now', 'I don't want questions' — "
    "skip intake. Give 3 concrete steps based on what is already known.\n"
    "Rule 6: CONTINUITY. If user says 'is this enough', 'will this work', 'like this', "
    "'what now' — always answer in context of the plan already being discussed. "
    "NEVER ask 'what do you mean?'\n"
    "Rule 7: NO SHAME. Never reference weight negatively. Never use 'overweight', "
    "'obese', or any shaming language. Talk about energy, strength, and how they feel.\n"
    "Rule 8: PERSONA PURITY. Do not reference legal, financial, cybersecurity, or career "
    "unless the user brought it up in THIS conversation.\n"
    "Rule 9: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[VITALITY_STATE: {\"phase\": \"PLAN\", \"concern\": 1, \"focus\": \"weight loss\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END VITALITY STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_EMERGENCY_SIGNALS = [
    "chest pain during", "chest pain while", "heart racing exercise",
    "cant breathe working out", "can't breathe working out",
    "collapsed", "passed out", "fell", "injured my", "pulled my", "torn my",
    "severe dizziness", "blacked out", "seeing spots",
]
_MEDICAL_FLAG_SIGNALS = [
    "chest pain", "shortness of breath at rest", "unexplained weight loss",
    "severe fatigue", "heart palpitations", "irregular heartbeat",
    "numbness", "extreme weakness", "fainting", "dizzy all the time",
]
_WEIGHT_SIGNALS = [
    "lose weight", "weight loss", "fat loss", "burn fat", "calories",
    "calorie deficit", "how many calories", "diet", "eating less",
]
_MUSCLE_SIGNALS = [
    "build muscle", "gain muscle", "bulk", "strength training", "lifting",
    "protein", "how much protein", "muscle gain", "hypertrophy",
]
_ENERGY_SIGNALS = [
    "no energy", "tired all the time", "always tired", "low energy",
    "fatigue", "exhausted", "can't get up", "cant get up", "sluggish",
]
_HABIT_SIGNALS = [
    "can't stick to", "cant stick to", "keep quitting", "no motivation",
    "always fail", "tried everything", "nothing works", "consistency",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "i dont want questions", "i don't want questions",
    "what do i do right now", "help now", "just help me",
    "skip the questions", "give me a plan",
]
_AMBIGUOUS_SIGNALS = [
    "is this enough", "will this work", "is that good", "what now",
    "like this", "like that", "should i keep doing this", "is this right",
    "am i doing it wrong", "how long until",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_EMERGENCY_EN = (
    "Stop what you're doing — this needs attention right now.\n"
    "1. Sit or lie down immediately. Stop all physical activity.\n"
    "2. If you have chest pain, pressure, or can't breathe — call 911 now. "
    "Don't drive yourself.\n"
    "3. If it's an injury — stop moving that body part. Ice it if available, "
    "elevate if possible.\n"
    "4. If symptoms pass quickly — still get checked out today, not tomorrow.\n"
    "Are you okay right now?"
)
_EMERGENCY_ES = (
    "Para lo que estás haciendo — esto necesita atención ahora mismo.\n"
    "1. Siéntate o acuéstate de inmediato. Detén toda actividad física.\n"
    "2. Si tienes dolor de pecho, presión o no puedes respirar — llama al 911 ahora. "
    "No manejes solo.\n"
    "3. Si es una lesión — deja de mover esa parte del cuerpo. Aplica hielo si tienes, "
    "eleva si es posible.\n"
    "4. Si los síntomas pasan rápido — de igual manera hazte revisar hoy, no mañana.\n"
    "¿Estás bien ahora mismo?"
)
_DIRECTIVE_EN = (
    "Got it — here's what to actually do:\n"
    "1. Pick ONE thing to change this week, not five. Consistency on one beats "
    "perfection on five every time.\n"
    "2. If it's about food: don't overhaul your diet — just add protein to every meal "
    "and cut one thing you know isn't helping.\n"
    "3. If it's about exercise: 3 days a week of 30 minutes beats an ambitious plan "
    "you quit in two weeks.\n"
    "Tell me your goal and your biggest obstacle and I'll make it specific."
)
_DIRECTIVE_ES = (
    "Entendido — esto es lo que realmente debes hacer:\n"
    "1. Elige UNA cosa para cambiar esta semana, no cinco. "
    "La constancia en una supera la perfección en cinco.\n"
    "2. Si es sobre comida: no cambies toda tu dieta — solo agrega proteína a cada comida "
    "y elimina una cosa que sabes que no te está ayudando.\n"
    "3. Si es sobre ejercicio: 3 días a la semana de 30 minutos supera un plan ambicioso "
    "que abandonas en dos semanas.\n"
    "Dime tu meta y tu mayor obstáculo y lo hago específico."
)

_LEGAL_BLEED_PATTERNS = [
    r"consult (a|an) attorney[^.]*\.",
    r"this is not legal advice[^.]*\.",
]
_FINANCIAL_BLEED_PATTERNS = [
    r"consult a financial advisor[^.]*\.",
    r"this is not financial advice[^.]*\.",
]
_SECURITY_BLEED_PATTERNS = [
    r"enable two-factor[^.]*\.",
    r"change your password[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_emergency   = any(s in all_text for s in _EMERGENCY_SIGNALS)
    sig_medical     = any(s in all_text for s in _MEDICAL_FLAG_SIGNALS)
    sig_weight      = any(s in all_text for s in _WEIGHT_SIGNALS)
    sig_muscle      = any(s in all_text for s in _MUSCLE_SIGNALS)
    sig_energy      = any(s in all_text for s in _ENERGY_SIGNALS)
    sig_habit       = any(s in all_text for s in _HABIT_SIGNALS)
    sig_dir         = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb         = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                       and len(msg.strip().split()) < 10)

    concern = 4 if sig_emergency else 3 if sig_medical else 2 if (sig_weight or sig_muscle or sig_energy) else 1
    overrides = {"emergency": None, "directive": None}

    # Gate 1: Exercise emergency
    if sig_emergency and not recent_turns:
        overrides["emergency"] = {"en": _EMERGENCY_EN, "es": _EMERGENCY_ES}
        logger.warning("💪 Vitality EMERGENCY gate fired")

    # Gate 2: Medical flag — inject doctor-first rule
    elif sig_medical and not sig_emergency:
        system_prompt += (
            "\n\n⚕️ MEDICAL FLAG DETECTED: User described symptoms that may be medical. "
            "Tell them clearly to see a doctor before starting or continuing exercise. "
            "Do NOT give a workout plan until this is addressed."
        )
        logger.warning("💪 Vitality medical flag injected")

    # Gate 3: Directive mode
    elif sig_dir:
        overrides["directive"] = {"en": _DIRECTIVE_EN, "es": _DIRECTIVE_ES}
        logger.info("💪 Vitality DIRECTIVE gate fired")

    # Gate 4: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (answer in reference to this plan/advice):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Do NOT ask 'what do you mean?' — answer based on the wellness topic already in play.\n"
            )
            logger.info("💪 Vitality ambiguous reference context injected")

    # Gate 5: Habit/consistency flag — inject realistic framing
    if sig_habit:
        system_prompt += (
            "\n\n🎯 HABIT PATTERN DETECTED: User has struggled with consistency before. "
            "Do NOT give an ambitious overhaul plan. "
            "Give the smallest viable change that creates momentum. "
            "Acknowledge that past failures are usually about system design, not willpower."
        )

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    is_es = (lang == "es")
    answer = re.sub(r'\[VITALITY_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("💪 Vitality emergency override applied")
        return answer

    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("💪 Vitality directive override applied")
        return answer

    for pat in _LEGAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()
    for pat in _FINANCIAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()
    for pat in _SECURITY_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
