"""
LYLO Guardian Persona Fortress — v2.1 (Gemini-audited)
Owns: relational voice, inject_fortress(), apply_gates()

Fixes in this version (per Gemini audit):
  - remote_access: password reset MUST be from different device BEFORE scanning
  - credentials_entered: secure THE COMPROMISED ACCOUNT first, not blindly email-first
  - directive fail-safe when no incident context (no hallucination)
  - gift_card/crypto: explicit recovery-fee scam warning
  - account_takeover_email: revoke connected/OAuth apps step added
  - otp_code_request: warn contacts immediately step added
  - credentials_entered: password reuse check added
  - phishing_click: drive-by download check added
  - gift_card: bank-fraud nuance (bank can't help for cash gift cards)
  - directive_detector: shared 4-layer detector replaces old phrase list
"""
import re
import logging
from services.directive_detector import detect_directive_sync, has_incident_context

logger = logging.getLogger("LYLO.Chat")
logger.warning("🛡️ GUARDIAN v2.1 LOADED — directive_detector wired, Gemini audit applied")

# ── Relational Voice ───────────────────────────────────────────────────────────
PERSONA_STRING = (
    "You are not a security system issuing alerts. You are like a protective older sibling "
    "who has seen every scam and threat out there. "
    "You say things like 'I've seen this before — here's what's happening' or "
    "'Stop right there, something's off.' "
    "You are calm but sharp. You take it seriously without making them panic. "
    "You treat them like someone smart who just needs the right eyes on the situation.\n"
    "CRITICAL: You are a cybersecurity and fraud expert — NOT a medical professional. "
    "NEVER use medical disclaimers. NEVER say 'consult a healthcare professional' or 'see a doctor'. "
    "If relevant, say 'consider filing a report with local authorities or the FTC at "
    "ReportFraud.ftc.gov'.\n\n"
    "━━━ GUARDIAN SESSION STATE PROTOCOL ━━━\n"
    "Track incident phase and severity at all times.\n"
    "PHASES: INTAKE → TRIAGE → CONTAINMENT → ESCALATION → CLOSE\n"
    "SEVERITY: 1 (suspicious/unknown), 2 (likely breach), 3 (confirmed breach), 4 (financial loss)\n\n"
    "Rule 1: INTAKE. First contact with no signals — gather what happened in ONE question max.\n"
    "Rule 2: TRIAGE. Suspicious link clicked, phishing email — assume risk is REAL.\n"
    "Rule 3: CONTAINMENT. Credentials entered, account accessed — act immediately, no more intake.\n"
    "Rule 4: ESCALATION. Money sent — severity 4. Bank steps immediately.\n"
    "Rule 5: DIRECTIVE MODE. User says 'just tell me what to do' or equivalent — skip ALL intake. "
    "Give numbered steps immediately. If incident type is unknown, fire ONE universal step + ONE question.\n"
    "Rule 6: NEVER reset to intake if prior turns established the incident.\n"
    "Rule 7: PERSONA PURITY. Never reference medical, mental health, wealth, or career domains "
    "unless the user introduced it in THIS conversation.\n"
    "Rule 8: PASSWORD SAFETY. When advising password changes after remote access or malware: "
    "ALWAYS specify 'change passwords from a DIFFERENT, trusted device (phone on cell data or another computer)' "
    "BEFORE scanning or cleaning the compromised device. A keylogger could steal new passwords.\n"
    "Rule 9: ACCOUNT PRIORITY. When multiple accounts are at risk, secure THE ACCOUNT THAT WAS "
    "DIRECTLY COMPROMISED first. If a bank site was phished — bank first. If email was phished — email first. "
    "Do not default to 'email first' when the specific compromised account is known.\n"
    "Rule 10: AT THE ABSOLUTE END output a hidden state block exactly like this:\n"
    "[GUARDIAN_STATE: {\"phase\": \"CONTAINMENT\", \"severity\": 3, \"signals\": [\"credentials_entered\"]}]\n"
    "Do not add any text after this block.\n"
    "━━━ END GUARDIAN STATE PROTOCOL ━━━"
)

# ── Signal Lists ───────────────────────────────────────────────────────────────
_LINK_SIGNALS   = ["clicked","opened","visited","tapped","link","url","site","website","phishing"]
_CRED_SIGNALS   = ["password","entered","typed","submitted","gave","filled","login","credential",
                    "ssn","social security","bank account","credit card","card number","pin","account number"]
_ACCESS_SIGNALS = ["hacked","account taken","locked out","cant log in","can't log in",
                    "strange login","unauthorized","breach","compromised","someone else logged in",
                    "someone accessed","unknown login","suspicious login"]
_MONEY_SIGNALS  = ["sent money","wired","venmo","zelle","cash app","cashapp","transfer",
                    "bought gift card","gift card","crypto","bitcoin","wire transfer","moneygram",
                    "western union","prepaid card"]
_REMOTE_SIGNALS = ["remote access","remote desktop","anydesk","teamviewer","ultraviewer",
                    "screenshare","screen share","let them in","gave access","they're on my computer",
                    "they were on my computer","someone took over my screen"]
_OTP_SIGNALS    = ["otp","one-time password","one time password","verification code","6 digit code",
                    "gave the code","read the code","told them the code","text code","auth code",
                    "google authenticator code","whatsapp code","facebook code"]
_AMBIGUOUS      = ["is it safe","what now","like this","like that","this thing",
                    "do i do this","what about this","is this okay","should i be worried"]

# ── Incident type classifier ───────────────────────────────────────────────────

def _classify_incident(msg_l: str, all_text: str):
    """
    Returns the most severe incident type string, or None if unknown.
    Used to select the right directive response bank.
    """
    if any(s in all_text for s in _MONEY_SIGNALS):
        return "money"
    if any(s in all_text for s in _REMOTE_SIGNALS):
        return "remote_access"
    if any(s in all_text for s in _OTP_SIGNALS):
        return "otp"
    if any(s in all_text for s in _ACCESS_SIGNALS):
        return "account_takeover"
    if any(s in all_text for s in _CRED_SIGNALS):
        return "credentials"
    if any(s in all_text for s in _LINK_SIGNALS):
        return "phishing_click"
    return None


# ── Response Banks ─────────────────────────────────────────────────────────────

# --- Money sent / financial fraud ---
_MONEY_EN = (
    "This is critical — speed is everything. Do these right now:\n"
    "1. Call your bank immediately. Say: 'I was scammed and need to recall a transfer.' "
    "Ask for their fraud department — not the main line.\n"
    "   ⚠️ Note: If you sent a bank wire or Zelle, the bank can attempt recall. "
    "If you bought physical gift cards at a store and read numbers over the phone, "
    "the bank cannot help — skip to step 3.\n"
    "2. If you used Venmo or Zelle: open the app → find the transaction → report as unauthorized fraud.\n"
    "3. If gift cards were involved: call the gift card company directly — number is on the back. "
    "Act fast — some companies can freeze the balance.\n"
    "4. File a report at ReportFraud.ftc.gov. Your bank needs this for their investigation.\n"
    "⛔ CRITICAL: Cut all contact with whoever asked you to send money. "
    "Do NOT pay anyone who claims they can 'recover' your money — that is a second scam."
)
_MONEY_ES = (
    "Esto es crítico — la velocidad lo es todo. Haz esto ahora mismo:\n"
    "1. Llama a tu banco de inmediato. Di: 'Fui víctima de una estafa y necesito cancelar una transferencia.' "
    "Pide el departamento de fraudes — no la línea general.\n"
    "   ⚠️ Nota: Si enviaste una transferencia bancaria o Zelle, el banco puede intentar recuperarla. "
    "Si compraste tarjetas de regalo físicas en una tienda y leíste los números por teléfono, "
    "el banco no puede ayudarte — ve al paso 3.\n"
    "2. Si usaste Venmo o Zelle: abre la app → encuentra la transacción → repórtala como fraude no autorizado.\n"
    "3. Si usaste tarjetas de regalo: llama a la empresa — el número está en el reverso. Actúa rápido.\n"
    "4. Presenta un reporte en ReportFraud.ftc.gov.\n"
    "⛔ CRÍTICO: Corta todo contacto con quien te pidió enviar dinero. "
    "NO pagues a nadie que diga que puede 'recuperar' tu dinero — eso es una segunda estafa."
)

# --- Remote access (RAT/TeamViewer/AnyDesk) ---
_REMOTE_EN = (
    "Someone had access to your screen — treat this device as compromised. Act in this order:\n"
    "1. Disconnect from the internet RIGHT NOW — unplug the ethernet or turn off Wi-Fi. "
    "This cuts off any active connection.\n"
    "2. Do NOT change any passwords on this device yet. If there's a keylogger installed, "
    "your new passwords will be stolen as you type them.\n"
    "3. On a DIFFERENT device (your phone on cell data, or someone else's computer): "
    "change passwords for email, bank, and any accounts you were logged into on this machine.\n"
    "4. On the same safe device: enable two-factor authentication (2FA) for email and banking.\n"
    "5. Return to the compromised computer and run a full scan with Malwarebytes (free at malwarebytes.com).\n"
    "6. Check your bank and credit card statements for any charges you don't recognize.\n"
    "Did they install any software or were you just on a call with them while they watched your screen?"
)
_REMOTE_ES = (
    "Alguien tuvo acceso a tu pantalla — trata este dispositivo como comprometido. Actúa en este orden:\n"
    "1. Desconéctate de internet AHORA MISMO — desenchufa el cable o apaga el Wi-Fi.\n"
    "2. NO cambies contraseñas en este dispositivo todavía. Si hay un keylogger instalado, "
    "robarán tus nuevas contraseñas mientras las escribes.\n"
    "3. Desde un dispositivo DIFERENTE (tu celular en datos móviles, o la computadora de alguien más): "
    "cambia las contraseñas de correo, banco y cualquier cuenta a la que hayas accedido en esta máquina.\n"
    "4. En ese mismo dispositivo seguro: activa la verificación en dos pasos (2FA) para correo y banco.\n"
    "5. Vuelve a la computadora comprometida y ejecuta un escaneo completo con Malwarebytes (gratis).\n"
    "6. Revisa tus estados de cuenta bancarios por cargos que no reconozcas.\n"
    "¿Instalaron algún software o solo te observaron mientras hablabas con ellos?"
)

# --- OTP / verification code given out ---
_OTP_EN = (
    "You gave up a one-time code — here's what to do immediately:\n"
    "1. That code was used to take over an account. Log in to the account it was for RIGHT NOW "
    "and check if your password or recovery email was changed.\n"
    "2. Change that account's password immediately from this device.\n"
    "3. Check 'Active Sessions' or 'Devices' in that account's settings — sign out everything else.\n"
    "4. ⚠️ If it was a WhatsApp or messaging app code: "
    "the attacker will immediately use your account to scam your contacts. "
    "Warn your family and friends RIGHT NOW via regular SMS or phone call — "
    "tell them 'My [WhatsApp/account] was hacked. Ignore any messages asking for money or codes.'\n"
    "5. Enable two-factor authentication using an authenticator app (not SMS) on that account.\n"
    "Which service was the code for? I'll give you the exact steps for that platform."
)
_OTP_ES = (
    "Diste un código de un solo uso — esto es lo que debes hacer de inmediato:\n"
    "1. Ese código fue usado para tomar el control de una cuenta. Inicia sesión en esa cuenta AHORA "
    "y verifica si tu contraseña o correo de recuperación fueron cambiados.\n"
    "2. Cambia la contraseña de esa cuenta inmediatamente.\n"
    "3. Revisa 'Sesiones activas' o 'Dispositivos' en la configuración — cierra sesión en todo lo demás.\n"
    "4. ⚠️ Si era un código de WhatsApp o app de mensajes: "
    "el atacante usará tu cuenta para estafar a tus contactos ahora mismo. "
    "Avisa a tu familia y amigos AHORA por SMS normal o llamada — "
    "diles: 'Mi [WhatsApp/cuenta] fue hackeado. Ignoren mensajes pidiendo dinero o códigos.'\n"
    "5. Activa la verificación en dos pasos con una app autenticadora (no SMS) en esa cuenta.\n"
    "¿Para qué servicio era el código? Te daré los pasos exactos para esa plataforma."
)

# --- Credentials entered on phishing site ---
_CREDS_EN = (
    "You may have handed your login to an attacker. Secure the compromised account first:\n"
    "1. Go to the REAL website of whatever you entered credentials for and log in. "
    "Change that password immediately — that account is the most at risk right now.\n"
    "2. If you use that same password anywhere else — email, Amazon, bank — "
    "change it there too. Attackers try every major site with stolen credentials.\n"
    "3. Turn on two-factor authentication (2FA) on the compromised account.\n"
    "4. Go to that account's security settings → check for new devices, email forwarding rules, "
    "or connected apps you didn't add.\n"
    "5. If it was banking info: call your bank's fraud line now, not their main number.\n"
    "Was it your email, bank, or social media login you entered?"
)
_CREDS_ES = (
    "Es posible que hayas dado tu acceso a un atacante. Asegura la cuenta comprometida primero:\n"
    "1. Ve al sitio web REAL de lo que ingresaste y entra con tu cuenta. "
    "Cambia esa contraseña ahora mismo — esa cuenta es la de mayor riesgo en este momento.\n"
    "2. Si usas esa misma contraseña en otro lugar — correo, Amazon, banco — "
    "cámbiala ahí también. Los atacantes prueban cada sitio importante con credenciales robadas.\n"
    "3. Activa la verificación en dos pasos (2FA) en la cuenta comprometida.\n"
    "4. Ve a la configuración de seguridad de esa cuenta → verifica nuevos dispositivos, "
    "reglas de reenvío de correo y apps conectadas que no añadiste tú.\n"
    "5. Si era información bancaria: llama ahora a la línea de fraude de tu banco.\n"
    "¿Era tu correo, banco o cuenta de redes sociales lo que ingresaste?"
)

# --- Email/account takeover ---
_TAKEOVER_EN = (
    "Your account may already be under their control. Lock it down now:\n"
    "1. Reset your password immediately using the 'Forgot Password' flow — "
    "this logs out active sessions on most platforms.\n"
    "2. Go to Settings → Security → Active Sessions and manually sign out all other devices.\n"
    "3. ⚠️ Check Connected Apps / Authorized Applications — attackers grant themselves "
    "OAuth access so they maintain control even after a password reset. "
    "Revoke anything you don't recognize.\n"
    "4. If this is your email: check Filters and Forwarding rules. "
    "Attackers set up forwarding to a private address so they keep receiving your email. Delete any you didn't create.\n"
    "5. Enable two-factor authentication with an authenticator app immediately.\n"
    "6. Check if your recovery phone or email was changed — update it if so.\n"
    "Which account is this — email, social media, or something else?"
)
_TAKEOVER_ES = (
    "Tu cuenta puede ya estar bajo su control. Bloquéala ahora:\n"
    "1. Restablece tu contraseña usando 'Olvidé mi contraseña' — "
    "esto cierra sesiones activas en la mayoría de plataformas.\n"
    "2. Ve a Configuración → Seguridad → Sesiones activas y cierra sesión manualmente en todos los demás dispositivos.\n"
    "3. ⚠️ Revisa Apps conectadas / Aplicaciones autorizadas — los atacantes se otorgan "
    "acceso OAuth para mantener el control incluso después de cambiar la contraseña. "
    "Revoca todo lo que no reconozcas.\n"
    "4. Si es tu correo: revisa las reglas de Filtros y Reenvío. "
    "Los atacantes configuran reenvío para seguir recibiendo tu correo. Elimina las que no creaste.\n"
    "5. Activa la verificación en dos pasos con una app autenticadora inmediatamente.\n"
    "6. Verifica si tu teléfono o correo de recuperación fue cambiado — actualízalo si es así.\n"
    "¿Qué cuenta es esta — correo, redes sociales u otra?"
)

# --- Suspicious link clicked (phishing click) ---
_PHISHING_EN = (
    "Okay — that link may have been dangerous. Here's what to do now:\n"
    "1. Don't click any more links or download anything from that source.\n"
    "2. Did a file automatically download to your computer when you clicked? "
    "If yes, do NOT open it — delete it and run a scan immediately.\n"
    "3. Run a malware scan — Malwarebytes Free is the fastest option (malwarebytes.com).\n"
    "4. If you entered any information on that page: your credentials may already be compromised — "
    "change those passwords now on the real site.\n"
    "Did the page ask you to log in, download anything, or enter any personal info?"
)
_PHISHING_ES = (
    "Ese enlace puede haber sido peligroso. Esto es lo que debes hacer ahora:\n"
    "1. No hagas clic en más enlaces ni descargues nada de esa fuente.\n"
    "2. ¿Se descargó automáticamente algún archivo en tu computadora al hacer clic? "
    "Si es así, NO lo abras — elimínalo y ejecuta un escaneo de inmediato.\n"
    "3. Ejecuta un escaneo de malware — Malwarebytes gratuito es la opción más rápida (malwarebytes.com).\n"
    "4. Si ingresaste alguna información en esa página: tus credenciales pueden ya estar comprometidas — "
    "cambia esas contraseñas ahora en el sitio real.\n"
    "¿La página te pidió iniciar sesión, descargar algo o ingresar información personal?"
)

# --- Directive mode fail-safe (no incident context known) ---
_FAILSAFE_EN = (
    "Got it — no questions. Here's the one thing to do right now:\n"
    "⛔ Stop all contact with whoever you're dealing with. "
    "Don't send money, don't install anything, don't share any more codes or passwords.\n\n"
    "Now tell me exactly what happened — "
    "did you click a link, enter a password, install software, send money, or give someone a code? "
    "One answer and I'll give you the exact steps to lock it down."
)
_FAILSAFE_ES = (
    "Entendido — sin preguntas. Esto es lo que debes hacer ahora mismo:\n"
    "⛔ Detén todo contacto con quien sea que estés tratando. "
    "No envíes dinero, no instales nada, no compartas más códigos ni contraseñas.\n\n"
    "Ahora dime exactamente qué pasó — "
    "¿hiciste clic en un enlace, ingresaste una contraseña, instalaste software, enviaste dinero, "
    "o diste un código a alguien? Una respuesta y te daré los pasos exactos para bloquearlo."
)

# --- Medical bleed patterns ---
_MEDICAL_BLEED = [
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
    Pre-LLM: scans signals, classifies incident, determines overrides.
    Returns (updated_system_prompt, overrides_dict).

    overrides keys:
      "escalation" : bilingual dict | None  — fires before directive
      "directive"  : bilingual dict | None  — fires when directive mode + context known
      "failsafe"   : bilingual dict | None  — fires when directive mode + no context
    """
    recent_turns  = convo_context.get(email_lower, [])[-8:]
    all_user_text = " ".join(t.get("msg", "").lower() for t in recent_turns)
    all_text      = all_user_text + " " + msg.lower()

    sig_money  = any(s in all_text for s in _MONEY_SIGNALS)
    sig_remote = any(s in all_text for s in _REMOTE_SIGNALS)
    sig_otp    = any(s in all_text for s in _OTP_SIGNALS)
    sig_cred   = any(s in all_text for s in _CRED_SIGNALS)
    sig_access = any(s in all_text for s in _ACCESS_SIGNALS)
    sig_link   = any(s in all_text for s in _LINK_SIGNALS)
    sig_amb    = (any(s in msg.lower() for s in _AMBIGUOUS)
                  and len(msg.strip().split()) < 8)

    # Phase / severity
    if sig_money:
        phase, severity = "ESCALATION", 4
    elif sig_remote:
        phase, severity = "CONTAINMENT", 3
    elif sig_otp or sig_cred or sig_access:
        phase, severity = "CONTAINMENT", 3
    elif sig_link:
        phase, severity = "TRIAGE", 2
    else:
        phase, severity = "INTAKE", 1

    overrides = {"escalation": None, "directive": None, "failsafe": None}

    # ── Hard gate: money sent ──────────────────────────────────────────────────
    if sig_money:
        overrides["escalation"] = {"en": _MONEY_EN, "es": _MONEY_ES}
        logger.warning("🛡️ Guardian ESCALATION (money) fired — severity 4")
        return system_prompt, overrides  # Return early — escalation wins

    # ── Directive mode detection (shared 4-layer detector) ────────────────────
    dir_result = detect_directive_sync(msg)
    if dir_result["directive"]:
        incident = _classify_incident(msg.lower(), all_text)
        context_present = has_incident_context(msg, recent_turns)

        if not context_present:
            # Fail-safe: one step + one question, no hallucination
            overrides["failsafe"] = {"en": _FAILSAFE_EN, "es": _FAILSAFE_ES}
            logger.warning("🎯 GUARDIAN DIRECTIVE FIRED — no incident context → FAILSAFE bank set")
        else:
            # Context known — pick specific bank
            if incident == "remote_access":
                overrides["directive"] = {"en": _REMOTE_EN, "es": _REMOTE_ES}
            elif incident == "otp":
                overrides["directive"] = {"en": _OTP_EN, "es": _OTP_ES}
            elif incident in ("credentials", "account_takeover"):
                if sig_access:
                    overrides["directive"] = {"en": _TAKEOVER_EN, "es": _TAKEOVER_ES}
                else:
                    overrides["directive"] = {"en": _CREDS_EN, "es": _CREDS_ES}
            elif incident == "phishing_click":
                overrides["directive"] = {"en": _PHISHING_EN, "es": _PHISHING_ES}
            else:
                overrides["failsafe"] = {"en": _FAILSAFE_EN, "es": _FAILSAFE_ES}
                logger.warning(f"🎯 GUARDIAN DIRECTIVE FIRED — incident={incident} unresolved → FAILSAFE bank set")

        logger.warning(
            f"🎯 GUARDIAN DIRECTIVE FIRED — incident={incident} context={context_present} "
            f"score={dir_result['score']} layer={dir_result['reason']} "
            f"override_key={'directive' if overrides.get('directive') else 'failsafe'}"
        )

    # ── Ambiguous reference inject ─────────────────────────────────────────────
    if sig_amb and recent_turns:
        last = recent_turns[-1]
        lu, lr = last.get("msg", ""), last.get("response", "")
        if lu or lr:
            system_prompt += (
                "\n\n📎 CONTEXT FROM LAST TURN — user refers to this; do NOT ask 'what do you mean?':\n"
                f"  User said: {lu[:200]}\n"
                f"  You responded: {lr[:300]}\n"
                "Answer current message in reference to this context.\n"
            )

    # ── Incident context inject ────────────────────────────────────────────────
    incident_lines = []
    if sig_remote: incident_lines.append("⚠️ Remote access software may have been installed.")
    if sig_otp:    incident_lines.append("⚠️ A one-time verification code was given to an attacker.")
    if sig_cred:   incident_lines.append("⚠️ Credentials or financial info may have been entered on a phishing site.")
    if sig_access: incident_lines.append("⚠️ Account may already be compromised or locked out.")
    if sig_link:   incident_lines.append("⚠️ A suspicious link or site was visited.")

    if incident_lines:
        system_prompt += (
            "\n\n⚠️ INCIDENT CONTEXT (do NOT re-ask — act on it):\n"
            + "\n".join(f"  {s}" for s in incident_lines)
            + f"\n  Phase: {phase} | Severity: {severity}/4\n"
            "Give the next concrete action immediately."
        )
        logger.info(f"🛡️ Guardian incident injected: phase={phase}, sev={severity}")

    return system_prompt, overrides


def apply_gates(answer: str, overrides: dict, lang: str) -> str:
    """
    Post-LLM: strips state block, applies overrides, strips medical bleed.
    """
    is_es = (lang == "es")

    # Strip hidden state block
    answer = re.sub(r'\[GUARDIAN_STATE:.*?\]', '', answer, flags=re.DOTALL).strip()

    # Gate 1: Escalation (money) — highest priority
    if overrides.get("escalation"):
        logger.warning("🛡️ Guardian escalation override applied")
        return overrides["escalation"]["es" if is_es else "en"]

    # Gate 2: Directive with known incident
    if overrides.get("directive"):
        logger.warning(f"🎯 GUARDIAN DIRECTIVE GATE APPLIED — returning incident bank")
        return overrides["directive"]["es" if is_es else "en"]

    # Gate 3: Directive fail-safe (no context)
    if overrides.get("failsafe"):
        logger.warning(f"🎯 GUARDIAN FAILSAFE GATE APPLIED — returning failsafe bank")
        return overrides["failsafe"]["es" if is_es else "en"]

    # Gate 4: Strip medical disclaimer bleed
    for pat in _MEDICAL_BLEED:
        before = answer
        answer = re.sub(pat, "", answer, flags=re.IGNORECASE).strip()
        if answer != before:
            logger.warning("🛡️ Guardian: medical bleed stripped")

    return answer
