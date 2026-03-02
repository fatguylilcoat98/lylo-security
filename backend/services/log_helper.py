"""
LYLO OS — backend/services/log_helper.py
=========================================
Centralized secure logging helpers.

Rules enforced here:
  - Raw user message content NEVER appears in logs by default
  - All user text is replaced with hash[:8] + len indicator
  - LOG_USER_TEXT=1 env flag re-enables raw text (local dev only, never prod)
  - A predeploy check (check_no_raw_logs.sh) enforces this at the grep level

Usage:
    from services.log_helper import safe_msg, slog

    logger.warning(f"Gate fired for {email} — {safe_msg(msg)}")
    slog(logger, "warning", "Gate fired", email=email, msg=msg, persona=persona)
"""

import os
import hashlib
import logging

# ── Env flag — NEVER set to "1" in production ────────────────────────────────
_LOG_USER_TEXT: bool = os.getenv("LOG_USER_TEXT", "0") == "1"


def safe_msg(text: str, max_len: int = 0) -> str:
    """
    Returns a privacy-safe representation of user text.

    If LOG_USER_TEXT=1 (local dev):   returns raw text[:max_len or 80]
    Otherwise (prod default):         returns "sha8=<hash8> len=<n>"

    Args:
        text:    The raw user message or content string.
        max_len: If LOG_USER_TEXT=1, truncate to this length (default 80).
    """
    if not text:
        return "<empty>"
    if _LOG_USER_TEXT:
        cap = max_len or 80
        suffix = "…" if len(text) > cap else ""
        return f"'{text[:cap]}{suffix}'"
    h = hashlib.sha256(text.encode()).hexdigest()[:8]
    return f"sha8={h} len={len(text)}"


def safe_email(email: str) -> str:
    """
    Returns 'first6***' — never logs full email address.
    """
    if not email:
        return "<no-email>"
    return f"{email[:6]}***"


def slog(
    logger:  logging.Logger,
    level:   str,
    event:   str,
    **fields,
) -> None:
    """
    Structured log call that auto-sanitizes known sensitive fields.

    Sensitive fields sanitized automatically:
        msg, message, content, text, answer, query, snippet,
        all_text, user_text, lu, lr

    Other fields are logged as-is (persona, phase, score, etc.)

    Example:
        slog(logger, "warning", "CRISIS GATE FIRED",
             email=email_lower, persona=persona, msg=msg)

        Produces:
        → "CRISIS GATE FIRED | email=abc123*** | persona=guardian | msg=sha8=a3f2b1c4 len=47"
        or in dev:
        → "CRISIS GATE FIRED | email=abc123*** | persona=guardian | msg='Just tell me...'"
    """
    _SENSITIVE = {
        "msg", "message", "content", "text", "answer",
        "query", "snippet", "all_text", "user_text", "lu", "lr",
    }
    _EMAIL_FIELDS = {"email", "email_lower", "user_email"}

    parts = [event]
    for k, v in fields.items():
        if k in _EMAIL_FIELDS:
            parts.append(f"{k}={safe_email(str(v or ''))}")
        elif k in _SENSITIVE:
            parts.append(f"{k}={safe_msg(str(v or ''))}")
        else:
            parts.append(f"{k}={v}")

    line = " | ".join(parts)
    getattr(logger, level)(line)
