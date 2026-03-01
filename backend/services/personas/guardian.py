"""
LYLO Guardian Persona Fortress
Owns: relational voice, inject_fortress(), apply_gates()
"""
import re
import logging
import random

logger = logging.getLogger("LYLO.Chat")

# ── Relational Voice ──────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a security system issuing alerts. You are like a protective older sibling "
    "who's seen every scam and threat out there. "
    "You say things like 'I've seen this before — here's what's happening' or "
    "'Stop right there, something's off.' "
    "You are calm but sharp. You take it seriously without making them panic. "
    "You treat them like someone smart who just needs the right eyes on the situation.\n"
    "CRITICAL: You are a cybersecurity and fraud expert — NOT a medical professional. "
    "NEVER say 'consult a healthcare professional' or 'please see a doctor' or any medical disclaimer. "
    "If anything is relevant to personal safety, say 'consider filing a report with local "
    "authorities or the FTC at ReportFraud.ftc.gov' instead.\n\n"
    "━━━ GUARDIAN SESSION STATE PROTOCOL ━━━\n"
    "Track the incident phase and severity at all times.\n"
    "- PHASES: INTAKE, TRIAGE, CONTAINMENT, ESCALATION, CLOSE\n"
    "- SEVERITY: 1 (suspicious/unknown), 2 (likely breach), 3 (confirmed breach), 4 (financial loss)\n\n"
    "Rule 1: INTAKE. First contact with no prior signals — gather what happened in ONE question max.\n"
    "Rule 2: TRIAGE. Suspicious link clicked, phishing email — assume risk is REAL. Move to CONTAINMENT.\n"
    "Rule 3: CONTAINMENT. Credentials entered, account accessed, money sent — DO NOT ask for more context. "
    "Give numbered containment steps immediately.\n"
    "Rule 4: ESCALATION. Money sent via wire/Zelle/Venmo/gift card/crypto — severity 4. "
    "Give bank contact steps immediately. Do NOT minimize.\n"
    "Rule 5: DIRECTIVE MODE. If user says 'just tell me what to do', 'help now', "
    "'what do I do right now', 'I don't want questions' — skip ALL intake. "
    "Give 3 concrete numbered steps immediately.\n"
    "Rule 6: NEVER reset to intake if prior turns already established the incident.\n"
    "Rule 7: PERSONA PURITY. Do not reference family, wealth, health, career, or any other "
    "domain unless the user brought it up in THIS conversation.\n"
    "Rule 8: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[GUARDIAN_STATE: {\"phase\": \"CONTAINMENT\", \"severity\": 3, \"signals\": [\"link_clicked\"]}]\n"
    "Do not add any text after this block.\n"
    "━━━ END GUARDIAN STATE PROTOCOL ━━━"
)

# ── Signal Lists ──────────────────────────────────────────────────────────────
_LINK_SIGNALS      = ["clicked","opened","visited","tapped","link","url","site","website","phishing"]
_CRED_SIGNALS      = ["password","entered","typed","submitted","gave","filled","login","credential",
                       "ssn","social security","bank account","credit card","card number","pin"]
_ACCESS_SIGNALS    = ["hacked","account taken","locked out","cant log in","can't log in",
                       "strange login","unauthorized","breach","compromised","someone else logged in"]
_MONEY_SIGNALS     = ["sent money","wired","venmo","zelle","cash app","transfer",
                       "bought gift card","gift card","crypto","bitcoin","wire transfer"]
_DIRECTIVE_SIGNALS = ["just tell me what to do","i dont want questions","i don't want questions",
                       "what do i do right now","help now","just help me","skip the questions",
                       "tell me the steps"]
_AMBIGUOUS_SIGNALS = ["is it safe","what now","like this","like that","this thing",
                       "do i do this","what about this","is this okay"]

# ── Hardcoded Response Banks ──────────────────────────────────────────────────
_ESCALATION_EN = (
    "This is critical — money sent to scammers is hard to recover, but speed matters. "
    "Do these right now:\n"
    "1. Call your bank immediately and say 'I was scammed — I need to recall a transfer.' "
    "Ask for their fraud department.\n"
    "2. If Zelle or Venmo: open the app, go to the transaction, and report it as unauthorized fraud.\n"
    "3. File a report at ReportFraud.ftc.gov — you'll need this for your bank's investigation.\n"
    "4. If gift cards were used, call the gift card company directly — numbers are on the back.\n"
    "Do NOT send any more money, even if they promise to 'unlock' your account or return the first payment."
)
_ESCALATION_ES = (
    "Esto es crítico — el dinero enviado a estafadores es difícil de recuperar, pero la velocidad importa. "
    "Haz esto ahora mismo:\n"
    "1. Llama a tu banco de inmediato y di 'Fui víctima de una estafa — necesito cancelar una transferencia.'\n"
    "2. Si usaste Zelle o Venmo: abre la app, ve a la transacción y repórtala como fraude no autorizado.\n"
    "3. Presenta un reporte en ReportFraud.ftc.gov.\n"
    "4. Si usaste tarjetas de regalo, llama a la empresa — el número está en el reverso.\n"
    "NO envíes más dinero, aunque prometan devolver el primer pago."
)

_DIRECTIVE_CONTAINMENT_EN = (
    "Got it — no questions. Here's what to do right now:\n"
    "1. Change your password immediately from a DIFFERENT device if possible.\n"
    "2. Turn on two-factor authentication (2FA) on that account.\n"
    "3. Go to account settings → Active Sessions → sign out of all other devices.\n"
    "4. Check your email for password reset requests you didn't make.\n"
    "Which of these have you done already?"
)
_DIRECTIVE_CONTAINMENT_ES = (
    "Entendido — sin preguntas. Esto es lo que debes hacer ahora:\n"
    "1. Cambia tu contraseña de inmediato desde un dispositivo DIFERENTE si es posible.\n"
    "2. Activa la verificación en dos pasos (2FA) en esa cuenta.\n"
    "3. Ve a configuración → Sesiones activas → cierra sesión en todos los demás dispositivos.\n"
    "4. Revisa tu correo por solicitudes de restablecimiento que no hiciste.\n"
    "¿Cuál de estos pasos ya completaste?"
)
_DIRECTIVE_TRIAGE_EN = (
    "Got it — here's what to do right now:\n"
    "1. Don't click any more links or download anything from that source.\n"
    "2. Change the password on any account that used the same email/password combo.\n"
    "3. Run a scan — use Malwarebytes (free) if you don't have antivirus.\n"
    "Tell me: did you enter any passwords or personal info on that site?"
)
_DIRECTIVE_TRIAGE_ES = (
    "Entendido — esto es lo que debes hacer ahora:\n"
    "1. No hagas clic en más enlaces ni descargues nada de esa fuente.\n"
    "2. Cambia la contraseña de cualquier cuenta que use el mismo correo/contraseña.\n"
    "3. Ejecuta un escaneo — usa Malwarebytes (gratis) si no tienes antivirus.\n"
    "¿Ingresaste alguna contraseña o información personal en ese sitio?"
)

_MEDICAL_BLEED_PATTERNS = [
    r"IMPORTANT\s*:\s*Please consult a healthcare professional[^.]*\.",
    r"Please consult a (healthcare|medical) professional[^.]*\.",
    r"Please (see|visit) a (doctor|physician|healthcare provider)[^.]*\.",
    r"Consult (your|a) (doctor|physician|healthcare|medical)[^.]*\.",
    r"seek (medical|professional medical) (advice|attention|help)[^.]*\.",
    r"this is not medical advice[^.]*\.",
    r"I am not a (doctor|medical|healthcare)[^.]*\.",
]


def inject_fortress(system_prompt: str, msg: str, convo_context: dict,
                    email_lower: str, lang: str) -> tuple:
    """
    Scans conversation signals, injects incident context into system_prompt,
    returns (updated_system_prompt, overrides_dict).
    overrides_dict keys: escalation_override, directive_override (both bilingual dicts or None)
    """
    recent_turns   = convo_context.get(email_lower, [])[-8:]
    all_user_text  = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text       = all_user_text + " " + msg.lower()

    sig_link   = any(s in all_text for s in _LINK_SIGNALS)
    sig_cred   = any(s in all_text for s in _CRED_SIGNALS)
    sig_access = any(s in all_text for s in _ACCESS_SIGNALS)
    sig_money  = any(s in all_text for s in _MONEY_SIGNALS)
    sig_dir    = any(s in msg.lower() for s in _DIRECTIVE_SIGNALS)
    sig_amb    = (any(s in msg.lower() for s in _AMBIGUOUS_SIGNALS)
                  and len(msg.strip().split()) < 8)

    # Determine phase
    if sig_money:
        phase, severity = "ESCALATION", 4
    elif sig_cred or sig_access:
        phase, severity = "CONTAINMENT", 3
    elif sig_link:
        phase, severity = "TRIAGE", 2
    else:
        phase, severity = "INTAKE", 1

    overrides = {"escalation": None, "directive": None}

    # Gate 1: Money sent — hardcoded escalation
    if sig_money:
        overrides["escalation"] = {"en": _ESCALATION_EN, "es": _ESCALATION_ES}
        logger.warning("🛡️ Guardian ESCALATION gate fired — severity 4")

    # Gate 2: Directive mode
    elif sig_dir:
        if phase == "CONTAINMENT":
            overrides["directive"] = {"en": _DIRECTIVE_CONTAINMENT_EN, "es": _DIRECTIVE_CONTAINMENT_ES}
        else:
            overrides["directive"] = {"en": _DIRECTIVE_TRIAGE_EN, "es": _DIRECTIVE_TRIAGE_ES}
        logger.info("🛡️ Guardian DIRECTIVE gate fired")

    # Gate 3: Ambiguous reference — prepend last turn context
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN (user is referring to this — do NOT ask 'what do you mean?'):\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer the current message in reference to this context.\n"
            )
            logger.info("🛡️ Guardian ambiguous reference context injected")

    # Gate 4: Inject known incident signals
    incident_signals = []
    if sig_link:   incident_signals.append("User clicked or opened a suspicious link/site.")
    if sig_cred:   incident_signals.append("User entered credentials or personal/financial info.")
    if sig_access: incident_signals.append("Account may already be compromised or locked.")
    if sig_money:  incident_signals.append("User may have sent money or purchased gift cards.")

    if incident_signals:
        system_prompt += (
            "\n\n⚠️ CURRENT INCIDENT CONTEXT (do NOT ask for this again — act on it):\n"
            + "\n".join(f"  - {s}" for s in incident_signals)
            + f"\n  - Current phase: {phase} (severity {severity}/4)"
            + "\n\nContinue from this context. Give the next concrete step immediately."
        )
        logger.info(f"🛡️ Guardian incident injected: {incident_signals} | phase={phase}")

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips hidden state block, applies overrides, strips medical bleed.
    Returns cleaned answer.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[GUARDIAN_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Escalation override
    if overrides.get("escalation"):
        answer = overrides["escalation"]["es" if is_es else "en"]
        logger.warning("🛡️ Guardian escalation override applied")
        return answer

    # Gate 2: Directive override
    if overrides.get("directive"):
        answer = overrides["directive"]["es" if is_es else "en"]
        logger.info("🛡️ Guardian directive override applied")
        return answer

    # Gate 3: Strip medical disclaimer bleed
    for pat in _MEDICAL_BLEED_PATTERNS:
        before = answer
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()
        if answer != before:
            logger.warning("🛡️ Guardian: medical disclaimer bleed stripped.")

    return answer
