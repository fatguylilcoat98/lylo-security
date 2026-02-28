"""
LYLO OS — services/hk_service.py
HallucinationKiller async adapter for FastAPI.

Slots into chat_router.py AFTER the race winner is found.
For HIGH-risk queries on doctor/lawyer/wealth/guardian personas,
HK runs a multi-model consensus pipeline and either replaces or
supplements the race winner based on confidence comparison.

DROP THIS FILE AT: backend/services/hk_service.py
HK ENGINE FILES AT: backend/hk/ (engine.py, deterministic.py, risk_classifier.py, source_tracker.py)
"""

import os
import sys
import asyncio
import logging
import time
from functools import lru_cache
from typing import Optional

logger = logging.getLogger("LYLO.Veracore")
logger.setLevel(logging.WARNING)  # Production mode

# ── Path injection: HK engine lives in backend/hk/ ──────────────────────────
_HK_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "hk")
if _HK_DIR not in sys.path:
    sys.path.insert(0, _HK_DIR)

# ── Lazy singletons ───────────────────────────────────────────────────────────
_hk_engine   = None
_hk_error    = None
_hk_init_lock = asyncio.Lock()
_risk_classifier = None


def _get_risk_classifier():
    """Instantiates RiskClassifier once. No API calls — pure regex."""
    global _risk_classifier
    if _risk_classifier is None:
        try:
            from risk_classifier import RiskClassifier
            _risk_classifier = RiskClassifier()
            logger.info("✅ HK RiskClassifier ready")
        except Exception as e:
            logger.warning(f"⚠️ HK RiskClassifier init failed: {e}")
    return _risk_classifier


async def _get_hk_engine():
    """
    Lazy-loads HallucinationKiller engine on first HIGH-risk request.
    Thread-safe via asyncio.Lock. Fails silently — LYLO degrades gracefully.
    """
    global _hk_engine, _hk_error
    if _hk_engine is not None or _hk_error is not None:
        return _hk_engine
    async with _hk_init_lock:
        # Double-check inside lock
        if _hk_engine is not None or _hk_error is not None:
            return _hk_engine
        try:
            from engine import HallucinationKiller
            # Init is synchronous and slow — run in executor
            loop = asyncio.get_event_loop()
            _hk_engine = await loop.run_in_executor(None, HallucinationKiller)
            models = list(_hk_engine.clients.keys())
            logger.info(f"✅ HK Engine ready — models: {models}")
        except Exception as e:
            _hk_error = str(e)
            logger.warning(f"⚠️ HK Engine init failed: {e}. LYLO will use standard race.")
    return _hk_engine


# ══════════════════════════════════════════════════════════════════════════════
# ROUTING DECISION
# Fast check — no API calls. Decides whether HK should run at all.
# ══════════════════════════════════════════════════════════════════════════════

# Personas where accuracy is life-critical
HK_PERSONAS = {"doctor", "lawyer", "wealth", "guardian"}

def should_use_hk(persona: str, message: str) -> tuple[bool, int]:
    """
    Returns (should_run: bool, risk_tier: int).
    Pure Python — zero API calls, sub-millisecond.

    HK activates when:
      1. Persona is doctor/lawyer/wealth/guardian
      2. Question is HIGH or CRITICAL risk (tier 3-4)

    For MEDIUM risk on these personas, HK still runs (tier 2 = single model + sources).
    For LOW risk, use standard race — HK is overkill.
    """
    if persona not in HK_PERSONAS:
        return False, 1

    classifier = _get_risk_classifier()
    if classifier is None:
        # Classifier unavailable — be conservative, run HK on these personas
        return True, 3

    try:
        risk = classifier.classify(message)
        tier = risk.get("tier", 2)
        level = risk.get("level", "MEDIUM")

        # Always run HK for HIGH/CRITICAL
        if tier >= 3:
            logger.info(f"🔬 HK activated: [{persona}] Tier {tier} ({level})")
            return True, tier

        # Run HK for MEDIUM on doctor/lawyer/wealth (life-critical advice)
        # Guardian handles scams — MEDIUM is often still dangerous
        if tier == 2 and persona in {"doctor", "lawyer", "wealth", "guardian"}:
            logger.info(f"🔬 HK activated: [{persona}] Tier 2 (MEDIUM — high-stakes persona)")
            return True, tier

        # LOW risk — standard race is fine
        logger.debug(f"⚡ HK skipped: [{persona}] Tier {tier} ({level}) — using standard race")
        return False, tier

    except Exception as e:
        logger.warning(f"⚠️ Risk classifier error: {e} — defaulting to HK")
        return True, 3


# ══════════════════════════════════════════════════════════════════════════════
# HK PIPELINE RUNNER
# ══════════════════════════════════════════════════════════════════════════════

async def run_hk_verification(
    question: str,
    persona: str,
    user_name: str = "User",
    timeout: float = 35.0,
) -> Optional[dict]:
    """
    Runs HK verification pipeline asynchronously.

    Returns LYLO-compatible dict on success, None on failure/timeout.
    LYLO always falls back to race winner on None — zero user-facing failures.

    Returns:
    {
        "answer":           str,    # Verified answer text
        "confidence_score": float,  # 0-100
        "confidence_color": str,    # GREEN / YELLOW / RED
        "model":            str,    # Which model gave best answer
        "risk_tier":        int,    # 1-4
        "risk_level":       str,    # LOW / MEDIUM / HIGH / CRITICAL
        "verification_mode": str,   # TIER_3_FULL_PIPELINE etc.
        "sources":          list,   # Cited sources
        "concerns":         list,   # Any flags raised
        "hk_validated":     bool,   # Always True if we got here
        "pipeline_seconds": float,  # Wall clock time
    }
    """
    engine = await _get_hk_engine()
    if engine is None:
        logger.warning(f"⚠️ HK engine unavailable — LYLO using race winner")
        return None

    t0 = time.time()
    loop = asyncio.get_event_loop()

    try:
        raw = await asyncio.wait_for(
            loop.run_in_executor(None, engine.run, question),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        elapsed = round(time.time() - t0, 1)
        logger.warning(f"⏱️ HK timeout after {elapsed}s for [{persona}] — using race winner")
        return None
    except Exception as e:
        logger.warning(f"⚠️ HK pipeline error: {e} — using race winner")
        return None

    if "error" in raw:
        logger.warning(f"⚠️ HK pipeline returned error: {raw['error']}")
        return None

    final = raw.get("final", {})
    if not final or not final.get("answer"):
        logger.warning("⚠️ HK returned empty answer — using race winner")
        return None

    elapsed = round(time.time() - t0, 1)
    logger.info(
        f"✅ HK complete in {elapsed}s — "
        f"{final.get('confidence_color','?')} {final.get('confidence_score',0)}% "
        f"[{final.get('verification_mode','?')}]"
    )

    return {
        "answer":            final["answer"],
        "confidence_score":  final.get("confidence_score", 75),
        "confidence_color":  final.get("confidence_color", "YELLOW"),
        "model":             f"HK-{final.get('answered_by', 'Consensus')}",
        "risk_tier":         final.get("risk_tier", 3),
        "risk_level":        final.get("risk_level", "HIGH"),
        "verification_mode": final.get("verification_mode", "HK_PIPELINE"),
        "sources":           final.get("all_sources", []),
        "concerns":          final.get("all_concerns", []),
        "hk_validated":      True,
        "hk_adversarial":    final.get("adversarial_challenges", {}),
        "pipeline_seconds":  elapsed,
    }


# ══════════════════════════════════════════════════════════════════════════════
# MERGE LOGIC
# Decides whether to use HK result or race winner
# ══════════════════════════════════════════════════════════════════════════════

def merge_hk_with_winner(
    race_winner: dict,
    hk_result: Optional[dict],
    risk_tier: int,
) -> tuple[dict, bool]:
    """
    Merges HK result with race winner. Returns (final_result, used_hk).

    Rules:
    - HK unavailable → use race winner as-is
    - HK confidence > race confidence → HK wins (use its answer)
    - HK confidence ≤ race confidence → HK metadata supplements race winner
    - CRITICAL risk (tier 4) → HK always wins regardless of scores
    """
    if hk_result is None:
        return race_winner, False

    race_confidence = race_winner.get("confidence_score", 75)
    hk_confidence   = hk_result.get("confidence_score", 75)

    # CRITICAL: HK always wins
    if risk_tier >= 4:
        logger.info(f"🔴 CRITICAL risk — HK answer used unconditionally (HK: {hk_confidence}% vs Race: {race_confidence}%)")
        return {**race_winner, **hk_result}, True

    # HIGH: HK wins if meaningfully more confident
    if risk_tier == 3 and hk_confidence >= race_confidence - 5:
        logger.info(f"🟡 HIGH risk — HK answer used (HK: {hk_confidence}% vs Race: {race_confidence}%)")
        return {**race_winner, **hk_result}, True

    # MEDIUM on high-stakes persona: use whichever is more confident
    if hk_confidence > race_confidence + 10:
        logger.info(f"🟢 HK wins on confidence (HK: {hk_confidence}% vs Race: {race_confidence}%)")
        return {**race_winner, **hk_result}, True

    # Race winner is more confident — supplement meta only
    logger.info(f"⚡ Race winner used (Race: {race_confidence}% > HK: {hk_confidence}%) — HK metadata merged")
    merged = dict(race_winner)
    merged["hk_validated"]   = True
    merged["hk_confidence"]  = hk_confidence
    merged["hk_color"]       = hk_result.get("confidence_color", "YELLOW")
    merged["sources"]        = hk_result.get("sources", [])
    merged["concerns"]       = hk_result.get("concerns", [])
    merged["hk_adversarial"] = hk_result.get("hk_adversarial", {})
    return merged, False


# ══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE BADGE
# Returns human-readable badge for frontend display
# ══════════════════════════════════════════════════════════════════════════════

def get_hk_badge(result: dict, used_hk: bool) -> str:
    """Returns a short badge string for the LYLO UI trust indicator."""
    if not used_hk:
        return ""

    color = result.get("confidence_color", "YELLOW")
    score = int(result.get("confidence_score", 75))
    mode  = result.get("verification_mode", "")
    sources = len(result.get("sources", []))

    if "DETERMINISTIC" in mode:
        return "✅ Verified (Exact — cannot hallucinate)"

    if color == "GREEN":
        src_text = f" — {sources} sources" if sources else ""
        return f"✅ Cross-verified by 3 AI models ({score}% confidence{src_text})"
    elif color == "YELLOW":
        return f"⚠️ Partially verified ({score}% confidence) — confirm with a professional"
    else:
        return f"🔴 Low confidence ({score}%) — please verify independently"
