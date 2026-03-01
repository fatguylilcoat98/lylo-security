"""
LYLO Wealth Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a financial advisor issuing recommendations. You are like a trusted family "
    "friend who built real wealth and wants to help them do the same. "
    "You say things like 'Here's what I'd actually do' or 'Let's look at the full picture first' "
    "or 'That number doesn't feel right — let me explain why.' "
    "You speak plainly. No jargon unless you immediately explain it. "
    "No disclaimers unless genuinely needed. Real talk about real money.\n\n"
    "━━━ WEALTH SESSION STATE PROTOCOL ━━━\n"
    "Track the financial phase and urgency at all times.\n"
    "- PHASES: INTAKE, ASSESS, STRATEGY, ACTION, CLOSE\n"
    "- URGENCY: 1 (general question), 2 (active financial decision), "
    "3 (time-sensitive — deadline, market window, or payment due), "
    "4 (financial emergency — fraud, eviction, account frozen, debt collector)\n\n"
    "Rule 1: INTAKE. First contact — ask ONE clarifying question max. "
    "Understand their situation before giving strategy.\n"
    "Rule 2: ASSESS. Get the key numbers before advising: income, debt, "
    "what they have saved, what the decision is. Don't strategize blind.\n"
    "Rule 3: STRATEGY. Give a real recommendation, not a disclaimer. "
    "Say 'Here's what I'd do in your position' not 'You should consult a financial advisor.' "
    "Refer them to a professional only when it's genuinely beyond this scope.\n"
    "Rule 4: ACTION. When they're ready to move — give numbered concrete steps. "
    "Not theory. Not options. What to actually do next.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'what do I do right now', 'I don't want questions' — "
    "skip ALL intake. Give 3 concrete steps based on what is already known.\n"
    "Rule 6: CONTINUITY. If user says 'what now', 'is that smart', 'should I do it', "
    "'like this' — always answer in context of the financial situation already discussed. "
    "NEVER ask 'what do you mean?'\n"
    "Rule 7: DEBT FIRST. If the user has high-interest debt (credit card, payday loan) "
    "AND is asking about investing — address the debt math first. "
    "Paying 24% APR debt beats earning 8% in the market every time.\n"
    "Rule 8: PERSONA PURITY. Do not reference medical conditions, legal matters, "
    "cybersecurity, or career unless the user brought it up in THIS conversation.\n"
    "Rule 9: NEVER give specific investment picks, stock symbols, or tax advice. "
    "You can explain concepts and strategies — not make specific trades.\n"
    "Rule 10: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[WEALTH_STATE: {\"phase\": \"STRATEGY\", \"urgency\": 2, \"focus\": \"debt payoff\"}]\n"
    "Do not add any text after this block.\n"
    "━━━ END WEALTH STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_EMERGENCY_SIGNALS = [
    "account frozen", "bank froze", "funds frozen", "money stolen", "financial fraud",
    "identity theft", "someone opened accounts", "unauthorized charges",
    "debt collector", "wage garnishment", "garnished", "lawsuit for debt",
    "bankruptcy", "can't pay rent", "about to be evicted", "lights getting cut off",
    "utilities shut off", "no money for food", "can't afford",
]
_URGENT_SIGNALS = [
    "payment due", "due tomorrow", "due today", "late payment", "past due",
    "collections", "sent to collections", "credit score dropped",
    "tax deadline", "irs", "tax levy", "401k withdrawal", "early withdrawal",
    "loan decision", "mortgage deadline", "refinancing deadline",
]
_DEBT_SIGNALS = [
    "credit card debt", "payday loan", "personal loan", "student loan",
    "in debt", "owe money", "minimum payment", "interest rate",
    "high interest", "apr", "debt snowball", "debt avalanche",
]
_INVESTING_SIGNALS = [
    "invest", "investing", "stock", "etf", "index fund", "401k", "ira", "roth",
    "brokerage", "portfolio", "retirement", "compound interest", "dividend",
]
_BUDGETING_SIGNALS = [
    "budget", "budgeting", "spending", "expenses", "where does my money go",
    "paycheck to paycheck", "save money", "saving", "emergency fund",
    "cut expenses", "track spending",
]
_DIRECTIVE_SIGNALS = [
    "just tell me what to do", "i dont want questions", "i don't want questions",
    "what do i do right now", "help now", "just help me",
    "skip the questions", "tell me the steps",
]
_AMBIGUOUS_SIGNALS = [
    "is that smart", "should i do it", "is this a good idea", "what now",
    "like this", "like that", "is this worth it", "should i pay it off",
    "will that hurt me", "is that normal",
]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_FRAUD_EN = (
    "This sounds like financial fraud — speed matters here.\n"
    "Do these right now:\n"
    "1. Call your bank immediately and say 'I think my account has been compromised — "
    "I need to speak with your fraud department.'\n"
    "2. Freeze your credit at all three bureaus: Experian, TransUnion, Equifax. "
    "It's free and takes 5 minutes each. Do it at AnnualCreditReport.com or each bureau's site.\n"
    "3. File a report at IdentityTheft.gov — the FTC uses this to build your recovery plan.\n"
    "4. Change passwords on every financial account from a clean device.\n"
    "Do NOT wait to see if it resolves itself. Every hour matters."
)
_FRAUD_ES = (
    "Esto suena como fraude financiero — la velocidad importa aquí.\n"
    "Haz esto ahora mismo:\n"
    "1. Llama a tu banco de inmediato y di 'Creo que mi cuenta fue comprometida — "
    "necesito hablar con el departamento de fraudes.'\n"
    "2. Congela tu crédito en las tres principales agencias: Experian, TransUnion, Equifax. "
    "Es gratis y tarda 5 minutos en cada una.\n"
    "3. Presenta un reporte en IdentityTheft.gov — la FTC usa esto para tu plan de recuperación.\n"
    "4. Cambia las contraseñas de todas tus cuentas financieras desde un dispositivo limpio.\n"
    "NO esperes a ver si se resuelve solo. Cada hora cuenta."
)

_DIRECTIVE_URGENT_EN = (
    "Got it — no questions. Here's what to do right now:\n"
    "1. Write down the exact numbers: what you owe, to who, and when it's due.\n"
    "2. Call the creditor before they call you — ask about hardship programs or a payment plan. "
    "Most will work with you if you reach out first.\n"
    "3. Don't touch retirement accounts to cover short-term debt — the penalties make it worse.\n"
    "Tell me the specifics and I'll tell you the best path forward."
)
_DIRECTIVE_URGENT_ES = (
    "Entendido — sin preguntas. Esto es lo que debes hacer ahora:\n"
    "1. Escribe los números exactos: cuánto debes, a quién y cuándo vence.\n"
    "2. Llama al acreedor antes de que te llamen — pregunta por programas de dificultad o un plan de pagos. "
    "La mayoría trabajará contigo si te comunicas primero.\n"
    "3. No toques cuentas de retiro para cubrir deuda a corto plazo — las penalidades lo empeoran.\n"
    "Dime los detalles y te diré el mejor camino a seguir."
)
_DIRECTIVE_GENERAL_EN = (
    "Got it — here's where to start:\n"
    "1. Get clear on your numbers: income after tax, fixed expenses, and what's left over.\n"
    "2. List every debt with its balance and interest rate — highest rate gets attacked first.\n"
    "3. Before investing anything — make sure you have at least one month of expenses saved "
    "as a buffer. That's your floor.\n"
    "What's the specific situation? Give me the short version and we'll build from there."
)
_DIRECTIVE_GENERAL_ES = (
    "Entendido — aquí es por dónde empezar:\n"
    "1. Aclara tus números: ingresos después de impuestos, gastos fijos y lo que sobra.\n"
    "2. Lista cada deuda con su saldo y tasa de interés — la tasa más alta se ataca primero.\n"
    "3. Antes de invertir cualquier cosa — asegúrate de tener al menos un mes de gastos ahorrado "
    "como colchón. Ese es tu piso.\n"
    "¿Cuál es la situación específica? Dame la versión corta y construimos desde ahí."
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
_SECURITY_BLEED_PATTERNS = [
    r"enable two-factor authentication[^.]*\.",
    r"change your password[^.]*\.",
    r"consult a cybersecurity[^.]*\.",
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
    sig_debt      = any(s in all_text for s in _DEBT_SIGNALS)
    sig_investing = any(s in all_text for s in _INVESTING_SIGNALS)
    sig_budgeting = any(s in all_text for s in _BUDGETING_SIGNALS)
    sig_dir       = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb       = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                     and len(msg.strip().split()) < 10)

    # Determine urgency
    if sig_emergency:
        urgency = 4
    elif sig_urgent:
        urgency = 3
    elif sig_debt or sig_investing:
        urgency = 2
    else:
        urgency = 1

    overrides = {"emergency": None, "directive": None}

    # Gate 1: Financial fraud/emergency — hardcoded
    if sig_emergency and not recent_turns:
        overrides["emergency"] = {"en": _FRAUD_EN, "es": _FRAUD_ES}
        logger.warning("💰 Wealth EMERGENCY gate fired — urgency 4")

    # Gate 2: Directive mode
    elif sig_dir:
        if urgency >= 3:
            overrides["directive"] = {"en": _DIRECTIVE_URGENT_EN, "es": _DIRECTIVE_URGENT_ES}
        else:
            overrides["directive"] = {"en": _DIRECTIVE_GENERAL_EN, "es": _DIRECTIVE_GENERAL_ES}
        logger.info("💰 Wealth DIRECTIVE gate fired")

    # Gate 3: Ambiguous reference
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user is referring to this — "
                "do NOT ask 'what do you mean?'):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer the current message in context of the financial situation already discussed.\n"
            )
            logger.info("💰 Wealth ambiguous reference context injected")

    # Gate 4: Debt + investing conflict — inject debt-first rule
    if sig_debt and sig_investing:
        system_prompt += (
            "\n\n⚠️ DEBT + INVESTING DETECTED: User has debt AND is asking about investing. "
            "Address the debt math first — high-interest debt payoff beats market returns. "
            "Only after explaining this should you discuss investing strategy."
        )
        logger.info("💰 Wealth debt-vs-investing conflict gate fired")

    # Gate 5: Inject financial context
    financial_signals = []
    if sig_emergency: financial_signals.append("Financial emergency — fraud, frozen account, or immediate crisis.")
    if sig_urgent:    financial_signals.append("Time-sensitive financial decision or deadline.")
    if sig_debt:      financial_signals.append("Debt situation present — payoff strategy may apply.")
    if sig_investing: financial_signals.append("Investment question — confirm debt situation first.")

    if financial_signals:
        system_prompt += (
            "\n\n💰 CURRENT FINANCIAL CONTEXT (do NOT re-ask — build on this):\n"
            + "\n".join(f"  - {s}" for s in financial_signals)
            + f"\n  - Urgency level: {urgency}/4"
            + "\n\nContinue from this context. Do not reset to intake."
        )
        logger.info(f"💰 Wealth context injected: {financial_signals}")

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips state block, applies overrides, strips cross-domain bleed.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[WEALTH_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Emergency override
    if overrides.get("emergency"):
        answer = overrides["emergency"]["es" if is_es else "en"]
        logger.warning("💰 Wealth emergency override applied")
        return answer

    # Gate 2: Directive override
    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("💰 Wealth directive override applied")
        return answer

    # Gate 3: Strip medical bleed
    for pat in _MEDICAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 4: Strip legal bleed
    for pat in _LEGAL_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    # Gate 5: Strip security bleed
    for pat in _SECURITY_BLEED_PATTERNS:
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()

    return answer
