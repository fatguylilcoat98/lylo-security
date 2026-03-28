"""
LYLO OS — services/hk_service.py
Veracore™ async adapter for FastAPI.

Replaces the old local HallucinationKiller engine.
Now calls the REAL Veracore at veracore.onrender.com/ask over HTTP.

All function signatures are identical — chat_router.py requires zero changes.

DROP THIS FILE AT: backend/services/hk_service.py
"""

import os
import asyncio
import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger("LYLO.Veracore")
logger.setLevel(logging.WARNING)

# ── Veracore endpoint ─────────────────────────────────────────────────────────
VERACORE_URL = os.getenv("VERACORE_URL", "https://veracore.onrender.com/ask")
VERACORE_TIMEOUT = 35.0  # seconds — Tier 4 averages ~16s, give headroom

# ── Personas where accuracy is life-critical ──────────────────────────────────
HK_PERSONAS = {"guardian", "bestie", "mechanic", "guide", "builder"}

# ── Simple keyword-based risk tiering (no API calls) ─────────────────────────
_HIGH_RISK_KW = {
    "medication", "drug", "dosage", "dose", "interaction", "overdose",
    "prescription", "side effect", "symptom", "diagnosis", "treat",
    "sue", "lawsuit", "court", "legal", "arrest", "contract", "rights",
    "eviction", "custody", "settlement", "attorney",
    "invest", "401k", "ira", "mortgage", "tax", "irs", "debt", "bankruptcy",
    "stock", "crypto", "financial", "scam", "hacked", "identity theft",
    "phishing", "account", "password", "breach",
}

_CRITICAL_KW = {
    "overdose", "drug interaction", "warfarin", "blood thinner",
    "felony", "criminal", "jail", "prison", "arrest warrant",
    "foreclosure", "bankruptcy", "wire transfer", "social security",
}


def should_use_veracore(persona: str, message: str) -> tuple[bool, int]:
    """
    Returns (should_run: bool, risk_tier: int).
    Pure Python — zero API calls, sub-millisecond.
    """
    if persona not in HK_PERSONAS:
        return False, 1

    msg_lower = message.lower()

    # Tier 4 — critical
    if any(kw in msg_lower for kw in _CRITICAL_KW):
        logger.info(f"🔬 Veracore activated: [{persona}] Tier 4 CRITICAL")
        return True, 4

    # Tier 3 — high
    if any(kw in msg_lower for kw in _HIGH_RISK_KW):
        logger.info(f"🔬 Veracore activated: [{persona}] Tier 3 HIGH")
        return True, 3

    # Tier 2 — medium (still runs on high-stakes personas)
    if persona in {"doctor", "lawyer", "wealth", "guardian"}:
        logger.info(f"🔬 Veracore activated: [{persona}] Tier 2 MEDIUM")
        return True, 2

    return False, 1


# ══════════════════════════════════════════════════════════════════════════════
# VERACORE API CALL
# ══════════════════════════════════════════════════════════════════════════════

async def run_veracore_verification(
    question: str,
    persona: str,
    user_name: str = "User",
    timeout: float = VERACORE_TIMEOUT,
) -> Optional[dict]:
    """
    Calls real Veracore at veracore.onrender.com/ask and returns
    a LYLO-compatible result dict, or None on failure.

    LYLO always falls back to race winner on None — zero user-facing failures.
    """
    t0 = time.time()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                VERACORE_URL,
                data={"msg": question},
                headers={"User-Agent": "LYLO-OS/31.0 Veracore-Bridge"},
            )
            resp.raise_for_status()
            raw = resp.json()

    except httpx.TimeoutException:
        elapsed = round(time.time() - t0, 1)
        logger.warning(f"⏱️ Veracore timeout after {elapsed}s for [{persona}] — using race winner")
        return None
    except Exception as e:
        logger.warning(f"⚠️ Veracore API error: {e} — using race winner")
        return None

    # Veracore returns {"final": {...}, "question": ..., ...}
    final = raw.get("final", {})
    if not final or not final.get("answer"):
        logger.warning("⚠️ Veracore returned empty answer — using race winner")
        return None

    elapsed = round(time.time() - t0, 1)
    logger.info(
        f"✅ Veracore complete in {elapsed}s — "
        f"{final.get('confidence_color','?')} {final.get('confidence_score',0)}% "
        f"[{final.get('verification_mode','?')}]"
    )

    # Normalize sources
    sources = final.get("all_sources", [])
    if not sources:
        # Veracore sometimes puts sources in stages
        for stage in raw.get("stages", {}).get("generation", []):
            for src in stage.get("sources", []):
                if isinstance(src, dict):
                    sources.append(src)

    return {
        "answer":            final["answer"],
        "confidence_score":  final.get("confidence_score", 75),
        "confidence_color":  final.get("confidence_color", "YELLOW"),
        "confidence_label":  final.get("confidence_label", ""),
        "model":             f"Veracore-{final.get('answered_by', 'Consensus')}",
        "risk_tier":         final.get("risk_tier", 3),
        "risk_level":        final.get("risk_level", "HIGH"),
        "verification_mode": final.get("verification_mode", "VERACORE_PIPELINE"),
        "sources":           sources,
        "concerns":          final.get("all_concerns", []),
        "hk_validated":      True,
        "hk_adversarial":    final.get("adversarial_challenges", {}),
        "pipeline_seconds":  elapsed,
        "total_unique_sources": final.get("total_unique_sources", len(sources)),
    }


# ══════════════════════════════════════════════════════════════════════════════
# MERGE LOGIC — identical to before, chat_router.py unchanged
# ══════════════════════════════════════════════════════════════════════════════

def merge_veracore_with_winner(
    race_winner: dict,
    hk_result: Optional[dict],
    risk_tier: int,
) -> tuple[dict, bool]:
    """
    Merges Veracore result with race winner. Returns (final_result, used_veracore).

    Rules:
    - Veracore unavailable → use race winner as-is
    - CRITICAL risk (tier 4) → Veracore always wins
    - HIGH risk (tier 3) → Veracore wins if within 5pts of race
    - MEDIUM → use whichever is more confident by 10+ pts
    """
    if hk_result is None:
        return race_winner, False

    race_confidence = race_winner.get("confidence_score", 75)
    hk_confidence   = hk_result.get("confidence_score", 75)

    # CRITICAL: Veracore always wins
    if risk_tier >= 4:
        logger.info(f"🔴 CRITICAL — Veracore used unconditionally ({hk_confidence}% vs Race {race_confidence}%)")
        return {**race_winner, **hk_result}, True

    # HIGH: Veracore wins if within 5pts
    if risk_tier == 3 and hk_confidence >= race_confidence - 5:
        logger.info(f"🟡 HIGH — Veracore used ({hk_confidence}% vs Race {race_confidence}%)")
        return {**race_winner, **hk_result}, True

    # MEDIUM: use whichever is more confident
    if hk_confidence > race_confidence + 10:
        logger.info(f"🟢 Veracore wins on confidence ({hk_confidence}% vs Race {race_confidence}%)")
        return {**race_winner, **hk_result}, True

    # Race winner more confident — supplement metadata only
    logger.info(f"⚡ Race winner used (Race {race_confidence}% > Veracore {hk_confidence}%) — metadata merged")
    merged = dict(race_winner)
    merged["hk_validated"]   = True
    merged["hk_confidence"]  = hk_confidence
    merged["hk_color"]       = hk_result.get("confidence_color", "YELLOW")
    merged["sources"]        = hk_result.get("sources", [])
    merged["concerns"]       = hk_result.get("concerns", [])
    merged["hk_adversarial"] = hk_result.get("hk_adversarial", {})
    return merged, False


# ══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE BADGE — identical to before
# ══════════════════════════════════════════════════════════════════════════════

def get_veracore_badge(result: dict, used_hk: bool) -> str:
    """Returns a short badge string for the LYLO UI trust indicator."""
    if not used_hk:
        return ""

    color   = result.get("confidence_color", "YELLOW")
    score   = int(result.get("confidence_score", 75))
    mode    = result.get("verification_mode", "")
    sources = len(result.get("sources", []))

    if "DETERMINISTIC" in mode:
        return "✅ Verified (Exact — cannot hallucinate)"

    if color == "GREEN":
        src_text = f" — {sources} sources" if sources else ""
        return f"✅ Cross-verified by Veracore™ ({score}% confidence{src_text})"
    elif color == "YELLOW":
        return f"⚠️ Partially verified ({score}% confidence) — confirm with a professional"
    else:
        return f"🔴 Low confidence ({score}%) — please verify independently"
