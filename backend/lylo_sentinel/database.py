#!/usr/bin/env python3
# =============================================================================
# LYLO OS — database.py
# Pinecone client initialisation, all fetch/upsert helpers, and user scanners.
# =============================================================================

import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from pinecone import Pinecone
from openai import AsyncOpenAI

from .config import (
    PINECONE_API_KEY,
    OPENAI_API_KEY,
    PINECONE_INDEX_NAME,
    DORMANT_THRESHOLD_HOURS,
    PROFILE_VECTOR_ID_SUFFIX,
    INTAKE_VECTOR_ID_SUFFIX,
    SENTINEL_VECTOR_ID_SUFFIX,
    SENTINEL_ANCHOR_VECTOR,
    log,
)


# =============================================================================
# CLIENT FACTORIES
# =============================================================================

def get_pinecone_index():
    """Initialise and return the Pinecone Index, or None on failure."""
    if not PINECONE_API_KEY:
        log.error("❌ PINECONE_API_KEY not set — cannot run Sentinel.")
        return None
    try:
        pc    = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX_NAME)
        log.info(f"✅ Pinecone connected → {PINECONE_INDEX_NAME}")
        return index
    except Exception as e:
        log.error(f"❌ Pinecone connection failed: {e}")
        return None


def get_openai_client() -> Optional[AsyncOpenAI]:
    """Return an async OpenAI client, or None if the key is absent."""
    if not OPENAI_API_KEY:
        log.warning("⚠️  OPENAI_API_KEY not set — using template payloads only.")
        return None
    return AsyncOpenAI(api_key=OPENAI_API_KEY)


# =============================================================================
# USER RECORD RETRIEVAL
# =============================================================================

def fetch_user_profile(index, user_id: str) -> dict:
    """Fetch synthesized Layer 0 profile from Pinecone (deterministic ID)."""
    profile_id = f"{user_id}{PROFILE_VECTOR_ID_SUFFIX}"
    try:
        result  = index.fetch(ids=[profile_id])
        vectors = result.get("vectors", {})
        if profile_id in vectors:
            raw = vectors[profile_id].get("metadata", {}).get("profile_json", "")
            if raw:
                return json.loads(raw)
    except Exception as e:
        log.warning(f"Profile fetch failed for {user_id[:8]}: {e}")
    return {}


def fetch_intake_profile(index, user_id: str) -> dict:
    """Fetch raw onboarding intake answers from Pinecone."""
    intake_id = f"{user_id}{INTAKE_VECTOR_ID_SUFFIX}"
    try:
        result  = index.fetch(ids=[intake_id])
        vectors = result.get("vectors", {})
        if intake_id in vectors:
            raw = vectors[intake_id].get("metadata", {}).get("intake_json", "")
            if raw:
                return json.loads(raw)
    except Exception as e:
        log.warning(f"Intake fetch failed for {user_id[:8]}: {e}")
    return {}


def fetch_sentinel_meta(index, user_id: str) -> dict:
    """
    Fetch Sentinel push history for anti-spam logic.
    Returns dict with: last_push_ts, consecutive_ignored, silenced_until
    """
    meta_id = f"{user_id}{SENTINEL_VECTOR_ID_SUFFIX}"
    try:
        result  = index.fetch(ids=[meta_id])
        vectors = result.get("vectors", {})
        if meta_id in vectors:
            raw = vectors[meta_id].get("metadata", {}).get("sentinel_json", "")
            if raw:
                return json.loads(raw)
    except Exception as e:
        log.warning(f"Sentinel meta fetch failed for {user_id[:8]}: {e}")
    return {"last_push_ts": None, "consecutive_ignored": 0, "silenced_until": None}


def upsert_sentinel_meta(index, user_id: str, meta: dict, anchor_vector: list):
    """Write updated Sentinel metadata back to Pinecone."""
    meta_id = f"{user_id}{SENTINEL_VECTOR_ID_SUFFIX}"
    meta["last_updated"] = datetime.now(timezone.utc).isoformat()
    try:
        index.upsert([(meta_id, anchor_vector, {
            "user_id":       user_id,
            "record_type":   "sentinel_meta",
            "sentinel_json": json.dumps(meta),
        })])
    except Exception as e:
        log.warning(f"Sentinel meta upsert failed for {user_id[:8]}: {e}")


def fetch_user_push_tokens(index, user_id: str) -> dict:
    """
    Fetch FCM token and/or Web Push subscription for the user.
    These are stored by the frontend when the user grants notification permission.
    Expected metadata keys: fcm_token, webpush_endpoint, webpush_keys_auth,
                             webpush_keys_p256dh, push_consent
    """
    token_id = f"{user_id}_push_tokens"
    try:
        result  = index.fetch(ids=[token_id])
        vectors = result.get("vectors", {})
        if token_id in vectors:
            return vectors[token_id].get("metadata", {})
    except Exception as e:
        log.warning(f"Push token fetch failed for {user_id[:8]}: {e}")
    return {}


# =============================================================================
# ENGAGEMENT RESET HELPER
# (call this from main.py on every /chat hit to reset the ignore counter)
# =============================================================================

def sentinel_reset_on_engagement(index, user_id: str):
    """
    Called from main.py whenever a user sends a message.
    Resets consecutive_ignored counter — signals they re-engaged.
    Should be called as asyncio.to_thread() from async context.
    """
    meta = fetch_sentinel_meta(index, user_id)
    if meta.get("consecutive_ignored", 0) > 0:
        meta["consecutive_ignored"] = 0
        meta["last_engagement_ts"]  = datetime.now(timezone.utc).isoformat()
        upsert_sentinel_meta(index, user_id, meta, SENTINEL_ANCHOR_VECTOR)
        log.info(f"🔄 Sentinel: re-engagement reset for {user_id[:8]}")


# =============================================================================
# DORMANT USER SCANNER
# =============================================================================

def scan_dormant_users(index, threshold_hours: int = DORMANT_THRESHOLD_HOURS) -> list:
    """
    Identifies users who have been dormant for threshold_hours.

    Strategy: Query Pinecone with the profile embedding anchor vector,
    fetching the top 500 profile records. Filter by last_updated timestamp.

    Each returned entry: {"user_id": str, "last_seen": str, "hours_dormant": float}
    """
    if not index:
        return []

    cutoff_dt  = datetime.now(timezone.utc) - timedelta(hours=threshold_hours)
    cutoff_iso = cutoff_dt.isoformat()

    log.info(f"🔍 Scanning for users dormant since {cutoff_iso}...")

    dormant_users = []

    try:
        # Use metadata filter to find episodic records older than cutoff.
        # We scan profile records (record_type = "profile") which are updated
        # every SYNTHESIS_INTERVAL interactions — a reliable last_active proxy.
        results = index.query(
            vector=[0.0] * 1024,   # Dummy vector — metadata filter does the work
            filter={
                "record_type": {"$eq": "profile"},
                "last_updated": {"$lt": cutoff_iso},
            },
            top_k=500,
            include_metadata=True,
        )

        for match in results.matches:
            uid = match.metadata.get("user_id")
            lu  = match.metadata.get("last_updated", "")
            if not uid:
                continue
            try:
                last_dt = datetime.fromisoformat(lu.replace("Z", "+00:00"))
                delta   = datetime.now(timezone.utc) - last_dt
                hours   = delta.total_seconds() / 3600
                if hours >= threshold_hours:
                    dormant_users.append({
                        "user_id":       uid,
                        "last_seen":     lu,
                        "hours_dormant": round(hours, 1),
                    })
            except Exception:
                continue

    except Exception as e:
        log.error(f"❌ Dormant scan failed: {e}")

    log.info(f"📊 Dormant scan complete: {len(dormant_users)} users qualify.")
    return dormant_users


# =============================================================================
# SUNDAY USER SCANNER
# =============================================================================

def scan_sunday_users(index) -> list:
    """
    Returns all users who have an accountability anchor or a high-stakes
    mission (protect_family, build_wealth) — Sunday interrupt targets.
    """
    if not index:
        return []

    log.info("☀️  Sunday sweep: scanning users with accountability anchors...")

    sunday_targets = []

    try:
        # Pull all profiles (broad query)
        results = index.query(
            vector=[0.0] * 1024,
            filter={"record_type": {"$eq": "profile"}},
            top_k=500,
            include_metadata=True,
        )

        high_stakes_missions = {
            "protect_family",
            "build_wealth",
            "career_growth",
            "health_wellness",
        }

        for match in results.matches:
            uid      = match.metadata.get("user_id")
            if not uid:
                continue
            raw_json = match.metadata.get("profile_json", "")
            if not raw_json:
                continue
            try:
                profile = json.loads(raw_json)
            except Exception:
                continue

            mission  = profile.get("mission", "")
            anchors  = profile.get("anchors", [])
            protocol = profile.get("protocol", "")

            # Target if: high-stakes mission OR has accountability anchors
            if mission in high_stakes_missions or anchors or "accountability" in protocol.lower():
                sunday_targets.append({"user_id": uid, "profile": profile})

    except Exception as e:
        log.error(f"❌ Sunday scan failed: {e}")

    log.info(f"📊 Sunday sweep: {len(sunday_targets)} users targeted.")
    return sunday_targets
