"""
LYLO OS — sentinel_routes.py
Two FastAPI endpoints that complete the Sentinel push pipeline.

Mount into main.py with one line:
    from sentinel_routes import sentinel_router
    app.include_router(sentinel_router)

Endpoints:
    POST /sentinel-reset        — Called by ChatInterface after every successful
                                  chat response. Resets the consecutive_ignored
                                  counter so the Sentinel doesn't backoff an
                                  active user.

    POST /register-push-token   — Called by useSentinel.onPermissionGranted()
                                  after the browser grants notification permission.
                                  Stores the VAPID Web Push subscription endpoint
                                  and keys in Pinecone under {email}_push_tokens.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse

# ── Sentinel modules (built earlier in this session) ─────────────────────────
from lylo_sentinel.database import (
    get_pinecone_index,
    fetch_sentinel_meta,
    upsert_sentinel_meta,
)
from lylo_sentinel.config import SENTINEL_ANCHOR_VECTOR

log = logging.getLogger("LYLO.SentinelRoutes")

sentinel_router = APIRouter()

# ---------------------------------------------------------------------------
# Pinecone index — reuse module-level singleton to avoid reconnecting on
# every request. get_pinecone_index() is safe to call multiple times;
# it returns the same Index object after the first successful connection.
# ---------------------------------------------------------------------------
_index = None

def _get_index():
    global _index
    if _index is None:
        _index = get_pinecone_index()
    return _index


# ===========================================================================
# POST /sentinel-reset
# ===========================================================================
# Called by sentinelService.notifySentinelEngagement() after every successful
# SSE stream in ChatInterface. Fire-and-forget from the frontend — always
# returns 200 so it never blocks or errors the chat flow.
#
# What it does:
#   1. Fetches the user's sentinel_meta vector from Pinecone
#   2. If consecutive_ignored > 0, resets it to 0 and records last_engagement_ts
#   3. Upserts the updated meta back to Pinecone
#   (If consecutive_ignored is already 0, it's a no-op — no upsert needed.)
# ===========================================================================
@sentinel_router.post("/sentinel-reset")
async def sentinel_reset(
    user_email: str = Form(...),
):
    """
    Reset the Sentinel's consecutive_ignored counter for an active user.
    Called transparently after every successful LYLO chat response.
    """
    index = _get_index()
    if not index:
        # Pinecone unavailable — return 200 anyway so the chat isn't affected
        log.warning("sentinel-reset: Pinecone unavailable, skipping reset.")
        return JSONResponse({"status": "skipped", "reason": "pinecone_unavailable"})

    try:
        meta = fetch_sentinel_meta(index, user_email)

        if meta.get("consecutive_ignored", 0) > 0:
            meta["consecutive_ignored"]  = 0
            meta["last_engagement_ts"]   = datetime.now(timezone.utc).isoformat()
            upsert_sentinel_meta(index, user_email, meta, SENTINEL_ANCHOR_VECTOR)
            log.info(f"🔄 Sentinel reset: re-engagement logged for {user_email[:4]}***")
            return JSONResponse({"status": "reset"})

        # Already at 0 — nothing to do
        return JSONResponse({"status": "ok", "note": "counter_already_zero"})

    except Exception as e:
        log.error(f"sentinel-reset error for {user_email[:4]}***: {e}")
        # Still 200 — never surface Sentinel errors to the chat UI
        return JSONResponse({"status": "error", "reason": str(e)})


# ===========================================================================
# POST /register-push-token
# ===========================================================================
# Called by sentinelService.registerSentinelPushToken() after the user grants
# notification permission in the browser.
#
# Stores the VAPID Web Push subscription under the key:
#   {user_email}_push_tokens
#
# Metadata fields match exactly what fetch_user_push_tokens() reads in
# database.py — the sentinel_cron.py delivery pipeline reads these fields
# to know which endpoint and keys to use when dispatching pushes.
#
# Safe to call multiple times — Pinecone upsert is idempotent.
# ===========================================================================
@sentinel_router.post("/register-push-token")
async def register_push_token(
    user_email:           str  = Form(...),
    device_id:            str  = Form(...),
    webpush_endpoint:     str  = Form(...),
    webpush_keys_p256dh:  str  = Form(...),
    webpush_keys_auth:    str  = Form(...),
    push_consent:         str  = Form(default="true"),
    fcm_token:            str  = Form(default=""),   # Optional — sent if FCM is wired later
):
    """
    Store a VAPID Web Push subscription for the Sentinel delivery pipeline.
    Called once per device after the user grants notification permission.
    """
    index = _get_index()
    if not index:
        log.warning("register-push-token: Pinecone unavailable.")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "reason": "pinecone_unavailable"}
        )

    token_id = f"{user_email}_push_tokens"
    consent  = push_consent.lower() not in ("false", "0", "no")

    metadata = {
        "user_id":              user_email,
        "device_id":            device_id,
        "record_type":          "push_tokens",
        "push_consent":         consent,
        "webpush_endpoint":     webpush_endpoint,
        "webpush_keys_p256dh":  webpush_keys_p256dh,
        "webpush_keys_auth":    webpush_keys_auth,
        "registered_at":        datetime.now(timezone.utc).isoformat(),
    }

    # Only store fcm_token if one was provided
    if fcm_token:
        metadata["fcm_token"] = fcm_token

    try:
        index.upsert([(
            token_id,
            SENTINEL_ANCHOR_VECTOR,   # Static dummy vector — record fetched by ID only
            metadata,
        )])
        log.info(f"✅ Push token registered for {user_email[:4]}*** (device: {device_id[:8]})")
        return JSONResponse({"status": "registered"})

    except Exception as e:
        log.error(f"register-push-token error for {user_email[:4]}***: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "reason": str(e)}
        )
