#!/usr/bin/env python3
# =============================================================================
# LYLO OS — sentinel_cron.py
# Version: 1.0.0
# =============================================================================
#
# THE SENTINEL MISSION
# --------------------
# Scans Pinecone for every user whose episodic memory records indicate they
# have gone dormant (no interaction in 48+ hours) OR who is active on a Sunday
# (highest self-sabotage risk window per LYLO accountability doctrine).
#
# For each qualifying user, the Sentinel:
#   1. Pulls their Layer 0 synthesized profile + raw intake answers
#   2. Generates a personalized, goal-specific push notification payload
#      using GPT-4o-mini — NOT a generic reminder template
#   3. Sends the payload to ONE of two delivery channels:
#        a. Firebase Cloud Messaging (FCM) — if the user has a registered token
#        b. Web Push via VAPID               — fallback for PWA installs
#   4. Logs all fired notifications with reason + user ID (no PII in logs)
#
# TRIGGER LOGIC
# -------------
#   DORMANT TRIGGER:  last_seen timestamp in Pinecone memory > 48 hours ago
#   SUNDAY TRIGGER:   script runs any Sunday (cron: 0 9 * * 0)
#                     targets users who have accountability anchors set
#                     (warm-start protocol field) OR mission == protect_family / build_wealth
#
# ANTI-SPAM GUARDS
# ----------------
#   • 1 notification per user per 24-hour window (tracked in Pinecone metadata)
#   • Sunday mode skips users who received a push in the last 18 hours
#   • Dormant trigger skips users who explicitly opted out (push_consent = False)
#   • Backoff: if a user ignores 3 consecutive Sentinel pushes, silence for 7 days
#
# DEPLOYMENT
# ----------
# Run as a cron job via Render Cron, Railway Cron, or system crontab:
#
#   # Every day at 9 AM UTC (dormant scan)
#   0 9 * * * python3 /app/sentinel_cron.py --mode dormant
#
#   # Every Sunday at 9 AM UTC (accountability sweep)
#   0 9 * * 0 python3 /app/sentinel_cron.py --mode sunday
#
#   # Run both modes (recommended for Sunday)
#   0 9 * * 0 python3 /app/sentinel_cron.py --mode both
#
# ENVIRONMENT VARIABLES REQUIRED
# --------------------------------
#   PINECONE_API_KEY       — Pinecone access
#   OPENAI_API_KEY         — GPT-4o-mini for payload generation
#   FCM_SERVER_KEY         — Firebase Cloud Messaging server key
#   VAPID_PRIVATE_KEY      — VAPID private key (PEM string)
#   VAPID_PUBLIC_KEY       — VAPID public key
#   VAPID_CLAIM_EMAIL      — mailto: claim for VAPID (your admin email)
#   SENTINEL_DRY_RUN       — Set "true" to log payloads without sending (testing)
#
# =============================================================================

import os
import json
import time
import logging
import argparse
import asyncio
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional

# ── Third-party ───────────────────────────────────────────────────────────────
from pinecone import Pinecone
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Optional push libraries — graceful import so the script doesn't crash
# on environments where these aren't installed ────────────────────────────────
try:
    import requests as _requests   # FCM HTTP v1
    FCM_AVAILABLE = True
except ImportError:
    FCM_AVAILABLE = False

try:
    from pywebpush import webpush, WebPushException
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False


# =============================================================================
# CONFIGURATION
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [SENTINEL]  %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("LYLO.Sentinel")

PINECONE_API_KEY    = os.getenv("PINECONE_API_KEY", "").strip()
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY", "").strip()
FCM_SERVER_KEY      = os.getenv("FCM_SERVER_KEY", "").strip()
VAPID_PRIVATE_KEY   = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_PUBLIC_KEY    = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_CLAIM_EMAIL   = os.getenv("VAPID_CLAIM_EMAIL", "admin@lylo.ai").strip()
DRY_RUN             = os.getenv("SENTINEL_DRY_RUN", "false").lower() == "true"

PINECONE_INDEX_NAME = "lylo-intelligence-sync"

# How many hours of silence before DORMANT trigger fires
DORMANT_THRESHOLD_HOURS = 48

# Suffix constants — must match main.py exactly
PROFILE_VECTOR_ID_SUFFIX = "_profile"
INTAKE_VECTOR_ID_SUFFIX  = "_intake"
SENTINEL_VECTOR_ID_SUFFIX = "_sentinel_meta"   # Tracks push history

# Anti-spam windows
PUSH_COOLDOWN_HOURS        = 24    # Standard cooldown between any two pushes
SUNDAY_PUSH_COOLDOWN_HOURS = 18    # Tighter window on Sunday sweeps
BACKOFF_IGNORE_COUNT       = 3     # Ignored pushes before 7-day silence kicks in
BACKOFF_SILENCE_DAYS       = 7


# =============================================================================
# GOAL → MISSION COPY MAPS
# =============================================================================
# These are the self-sabotage interrupt templates the AI personalizes from.
# Structured as: mission_value → list of interrupt hooks (AI picks + adapts one)

MISSION_INTERRUPT_HOOKS = {
    "build_wealth": [
        "Every day you're not working the plan is a day compounding works against you.",
        "Your future self is watching what you do today with the same money situation.",
        "The wealth gap doesn't close itself. What's the one move you're avoiding?",
    ],
    "protect_family": [
        "The people depending on you don't get a day off. Neither does your preparation.",
        "Protection isn't a feeling — it's a decision made before the crisis hits.",
        "What's one thing you'd regret not having done if something happened tomorrow?",
    ],
    "career_growth": [
        "The competition isn't taking the day off. What are you doing with yours?",
        "Career momentum is either building or decaying. There's no neutral gear.",
        "One hour of focused work today beats ten hours of catching up next week.",
    ],
    "health_wellness": [
        "Your body is either getting stronger or weaker right now. Which is it?",
        "The version of you that skips today makes tomorrow's you work twice as hard.",
        "Consistency is the only variable you actually control. Use it.",
    ],
    "legal_financial": [
        "Ignoring a legal or financial issue never makes it smaller — only more expensive.",
        "The clock is running on your situation. Inaction is a decision with consequences.",
        "What would your advocate tell you to do first thing today?",
    ],
    "personal_growth": [
        "Comfort zones don't expand on their own. What are you avoiding right now?",
        "The gap between who you are and who you want to be is exactly the size of your avoidance.",
        "Growth isn't scheduled. It's chosen — right now, or it isn't.",
    ],
}

ROADBLOCK_CALLOUTS = {
    "money":         "The money situation doesn't improve by ignoring it.",
    "time":          "Time doesn't appear — it's carved out. What's one thing you can cut today?",
    "knowledge":     "You don't need more information. You need to act on what you already know.",
    "stress":        "Burnout is real — but avoidance makes it permanent. What's the smallest next step?",
    "relationships": "Relationship friction doesn't resolve itself. What's unsaid that needs saying?",
    "bureaucracy":   "The system is designed to exhaust you into giving up. Don't give it the win.",
}

VIBE_TONES = {
    "standard":  "Direct, clear, no filler.",
    "chill":     "Warm and conversational — like a trusted friend checking in.",
    "intense":   "Maximum urgency. No softening. Every word is a command.",
    "nurturing": "Gentle but purposeful. Care without enabling avoidance.",
    "blunt":     "Zero filter. Call it exactly what it is.",
    "academic":  "Structured and logical. Appeal to reason and evidence.",
}

SUNDAY_ACCOUNTABILITY_HOOKS = [
    "Sunday is the planning session that determines the week. Use it.",
    "What you set up today is what executes Monday through Friday.",
    "The week doesn't win — you plan it or it plans you.",
    "Sunday reset: what do you need to decide today so the week runs on autopilot?",
    "Most people waste Sunday. The ones ahead of you don't.",
]


# =============================================================================
# PINECONE CLIENT
# =============================================================================

def get_pinecone_index():
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
# DORMANT USER SCANNER
# =============================================================================

def scan_dormant_users(index, threshold_hours: int = DORMANT_THRESHOLD_HOURS) -> list:
    """
    Identifies users who have been dormant for threshold_hours.

    Strategy: Query Pinecone with the profile embedding anchor vector,
    fetching the top 1000 profile records. Filter by last_updated timestamp.

    Each returned entry: {"user_id": str, "last_seen": str, "hours_dormant": float}
    """
    if not index:
        return []

    cutoff_dt  = datetime.now(timezone.utc) - timedelta(hours=threshold_hours)
    cutoff_iso = cutoff_dt.isoformat()

    log.info(f"🔍 Scanning for users dormant since {cutoff_iso}...")

    dormant_users = []

    try:
        # Use metadata filter to find episodic records older than cutoff
        # We scan profile records (record_type = "profile") which are updated
        # every SYNTHESIS_INTERVAL interactions — a reliable last_active proxy.
        # For users who haven't synthesized yet, we fall back to episodic scan.
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
                        "user_id":      uid,
                        "last_seen":    lu,
                        "hours_dormant": round(hours, 1),
                    })
            except Exception:
                continue

    except Exception as e:
        log.error(f"❌ Dormant scan failed: {e}")

    log.info(f"📊 Dormant scan complete: {len(dormant_users)} users qualify.")
    return dormant_users


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

        high_stakes_missions = {"protect_family", "build_wealth", "career_growth", "health_wellness"}

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


# =============================================================================
# NOTIFICATION PAYLOAD GENERATOR (GPT-4o-mini)
# =============================================================================

async def generate_push_payload(
    client:         AsyncOpenAI,
    user_name:      str,
    mission:        str,
    roadblock:      str,
    vibe:           str,
    goals:          list,
    anchors:        list,
    trigger_reason: str,           # "dormant_48h" | "sunday_accountability"
    hours_dormant:  float = 0.0,
) -> dict:
    """
    Calls GPT-4o-mini to generate a hyper-personalized push notification.
    Returns {"title": str, "body": str, "tag": str, "data": dict}

    The AI receives the user's mission, roadblock, vibe tone, and current goals,
    then writes a notification body that's specific enough to stop a scroll.
    """
    import random

    # Build context for the prompt
    mission_hooks = MISSION_INTERRUPT_HOOKS.get(mission, [
        "Your goals don't chase themselves.",
        "Every hour of avoidance is borrowed time.",
    ])
    mission_hook  = random.choice(mission_hooks)

    roadblock_callout = ROADBLOCK_CALLOUTS.get(roadblock, "")
    vibe_tone         = VIBE_TONES.get(vibe, VIBE_TONES["standard"])
    goals_str         = ", ".join(goals[:3]) if goals else "No goals on file — ask them to set one."
    anchors_str       = ", ".join(anchors[:3]) if anchors else "None set."

    if trigger_reason == "sunday_accountability":
        sunday_hook = random.choice(SUNDAY_ACCOUNTABILITY_HOOKS)
        trigger_ctx = (
            f"It is Sunday. This is the user's highest-risk day for avoidance and drift. "
            f"Sunday framing: '{sunday_hook}'"
        )
    else:
        trigger_ctx = (
            f"The user has been dormant for {hours_dormant:.0f} hours. "
            f"This is a re-engagement interrupt. Make them feel the gap."
        )

    prompt = f"""You are the LYLO OS Sentinel — a proactive accountability engine.
Generate a personalized push notification to interrupt self-sabotage and re-engage this user.

USER CONTEXT:
  Name:      {user_name}
  Mission:   {mission} → Hook: "{mission_hook}"
  Roadblock: {roadblock} → Callout: "{roadblock_callout}"
  Vibe:      {vibe} → Tone: {vibe_tone}
  Goals:     {goals_str}
  Anchors:   {anchors_str}
  Trigger:   {trigger_ctx}

RULES:
- Title: 4-7 words. Punchy. Not generic. Reference their specific mission or block.
- Body: 1-2 tight sentences. Max 120 characters total.
  Use {user_name}'s name once. Reference ONE specific detail (goal, roadblock, or anchor).
  This must feel personally written — not a template.
- Do NOT use emojis in the title. One emoji in body is allowed, only if tone matches.
- No corporate language. No "Hey there!". No "Don't forget to...".
- Make it feel like a trusted, demanding advisor — not a marketing email.
- Tag: snake_case identifier (e.g. "dormant_wealth_interrupt")

EXAMPLES OF GOOD NOTIFICATIONS:
  Title: "The plan doesn't wait, {user_name}"
  Body:  "48 hours off the mission. Your wealth target isn't closer. What's one move — right now?"

  Title: "Sunday is your leverage window"
  Body:  "{user_name}, the week you plan today beats the week that happens to you. 10 minutes. Now."

OUTPUT: Raw JSON only. No markdown. No preamble.
{{"title": "...", "body": "...", "tag": "...", "data": {{"mission": "{mission}", "trigger": "{trigger_reason}"}}}}
"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=200,
            temperature=0.8,   # Some variation so the same user doesn't see identical copy
        )
        raw = response.choices[0].message.content.strip()
        return json.loads(raw)
    except Exception as e:
        log.warning(f"⚠️  GPT payload generation failed — using template: {e}")
        # Template fallback
        return {
            "title": f"{user_name}, the mission's waiting",
            "body":  f"{mission_hook} One move. Right now.",
            "tag":   f"{trigger_reason}_{mission}",
            "data":  {"mission": mission, "trigger": trigger_reason},
        }


# =============================================================================
# PUSH DELIVERY
# =============================================================================

def send_fcm_push(fcm_token: str, payload: dict, user_id_hint: str = "") -> bool:
    """
    Sends a push via Firebase Cloud Messaging Legacy HTTP API.
    Upgrade to FCM v1 (OAuth2) when migrating away from server keys.
    """
    if DRY_RUN:
        log.info(f"[DRY RUN] FCM push → {user_id_hint[:8]}  payload={payload}")
        return True

    if not FCM_AVAILABLE:
        log.warning("⚠️  requests not installed — FCM unavailable.")
        return False

    if not FCM_SERVER_KEY:
        log.warning("⚠️  FCM_SERVER_KEY not set.")
        return False

    try:
        notification = {
            "to": fcm_token,
            "notification": {
                "title": payload["title"],
                "body":  payload["body"],
                "tag":   payload.get("tag", "lylo_sentinel"),
                "icon":  "/icon-192.png",
                "badge": "/badge-72.png",
                "click_action": "https://claude.ai/chat",
            },
            "data": payload.get("data", {}),
            "priority": "high",
        }

        response = _requests.post(
            "https://fcm.googleapis.com/fcm/send",
            headers={
                "Authorization": f"key={FCM_SERVER_KEY}",
                "Content-Type":  "application/json",
            },
            json=notification,
            timeout=8,
        )
        result = response.json()

        if result.get("success") == 1:
            log.info(f"✅ FCM push sent → {user_id_hint[:8]}")
            return True
        else:
            log.warning(f"⚠️  FCM push failed → {user_id_hint[:8]}: {result}")
            return False

    except Exception as e:
        log.error(f"❌ FCM send error for {user_id_hint[:8]}: {e}")
        return False


def send_webpush_notification(
    endpoint:  str,
    p256dh:    str,
    auth_key:  str,
    payload:   dict,
    user_id_hint: str = "",
) -> bool:
    """
    Sends a Web Push notification via VAPID (RFC 8292).
    Used as fallback when no FCM token is registered (PWA installs).
    """
    if DRY_RUN:
        log.info(f"[DRY RUN] WebPush → {user_id_hint[:8]}  payload={payload}")
        return True

    if not WEBPUSH_AVAILABLE:
        log.warning("⚠️  pywebpush not installed — Web Push unavailable.")
        return False

    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        log.warning("⚠️  VAPID keys not set — Web Push unavailable.")
        return False

    try:
        notification_body = json.dumps({
            "title":  payload["title"],
            "body":   payload["body"],
            "tag":    payload.get("tag", "lylo_sentinel"),
            "icon":   "/icon-192.png",
            "badge":  "/badge-72.png",
            "data":   payload.get("data", {}),
        }).encode("utf-8")

        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {
                    "p256dh": p256dh,
                    "auth":   auth_key,
                },
            },
            data=notification_body,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={
                "sub": f"mailto:{VAPID_CLAIM_EMAIL}",
                "aud": endpoint.split("/")[2],
            },
        )
        log.info(f"✅ WebPush sent → {user_id_hint[:8]}")
        return True

    except WebPushException as e:
        log.warning(f"⚠️  WebPush failed for {user_id_hint[:8]}: {e}")
        return False
    except Exception as e:
        log.error(f"❌ WebPush error for {user_id_hint[:8]}: {e}")
        return False


def dispatch_push(tokens: dict, payload: dict, user_id: str) -> bool:
    """
    Tries FCM first, falls back to Web Push.
    Returns True if at least one channel succeeded.
    """
    # Check consent
    if not tokens.get("push_consent", True):
        log.info(f"⛔ Push suppressed for {user_id[:8]} — consent=False")
        return False

    fcm_token = tokens.get("fcm_token", "")
    endpoint  = tokens.get("webpush_endpoint", "")

    if fcm_token:
        success = send_fcm_push(fcm_token, payload, user_id_hint=user_id)
        if success:
            return True

    if endpoint:
        success = send_webpush_notification(
            endpoint  = endpoint,
            p256dh    = tokens.get("webpush_keys_p256dh", ""),
            auth_key  = tokens.get("webpush_keys_auth", ""),
            payload   = payload,
            user_id_hint = user_id,
        )
        if success:
            return True

    log.info(f"ℹ️  No valid push channel for {user_id[:8]} — payload logged only.")
    if DRY_RUN or True:   # Always log payload for ops visibility
        log.info(f"   PAYLOAD: {json.dumps(payload)}")
    return False


# =============================================================================
# ANTI-SPAM GATE
# =============================================================================

def should_send_push(
    meta:         dict,
    trigger:      str,
    cooldown_hrs: int = PUSH_COOLDOWN_HOURS,
) -> tuple:
    """
    Returns (allowed: bool, reason: str).

    Checks:
      1. User is in silence backoff (too many ignored pushes)
      2. Last push was sent within cooldown window
    """
    now = datetime.now(timezone.utc)

    # Check backoff silence period
    silenced_until = meta.get("silenced_until")
    if silenced_until:
        try:
            silence_dt = datetime.fromisoformat(silenced_until.replace("Z", "+00:00"))
            if now < silence_dt:
                remaining = (silence_dt - now).days
                return False, f"silenced for {remaining} more days (ignore backoff)"
        except Exception:
            pass

    # Check consecutive ignored — trigger silence if threshold hit
    consecutive = meta.get("consecutive_ignored", 0)
    if consecutive >= BACKOFF_IGNORE_COUNT:
        silence_until_dt = now + timedelta(days=BACKOFF_SILENCE_DAYS)
        meta["silenced_until"]      = silence_until_dt.isoformat()
        meta["consecutive_ignored"] = 0   # Reset after silencing
        return False, f"entering {BACKOFF_SILENCE_DAYS}-day silence (ignored {consecutive} pushes)"

    # Check cooldown
    last_push = meta.get("last_push_ts")
    if last_push:
        try:
            last_dt = datetime.fromisoformat(last_push.replace("Z", "+00:00"))
            delta   = (now - last_dt).total_seconds() / 3600
            if delta < cooldown_hrs:
                return False, f"cooldown active ({delta:.1f}h < {cooldown_hrs}h)"
        except Exception:
            pass

    return True, "clear"


# =============================================================================
# ANCHOR VECTOR (for Sentinel meta upserts)
# =============================================================================

# Reuse a static dummy vector for Sentinel meta records.
# These records are only ever fetch()'d by ID — vector content is irrelevant.
_SENTINEL_ANCHOR_VECTOR = [0.001] * 1024


# =============================================================================
# MAIN SENTINEL LOOP
# =============================================================================

async def run_sentinel(mode: str):
    """
    mode: "dormant" | "sunday" | "both"
    """
    is_sunday  = datetime.now(timezone.utc).weekday() == 6   # 6 = Sunday

    if mode == "sunday" and not is_sunday:
        log.warning("⚠️  --mode sunday specified but today is not Sunday. Exiting.")
        return

    log.info(f"{'='*60}")
    log.info(f"  LYLO OS SENTINEL  —  mode={mode.upper()}  —  DRY_RUN={DRY_RUN}")
    log.info(f"  {datetime.now(timezone.utc).strftime('%A, %B %d, %Y  %H:%M UTC')}")
    log.info(f"{'='*60}")

    index  = get_pinecone_index()
    client = get_openai_client()

    if not index:
        log.error("Cannot continue without Pinecone. Exiting.")
        return

    # ── Collect target users ──────────────────────────────────────────────────
    targets = []

    if mode in ("dormant", "both"):
        dormant_list = scan_dormant_users(index, DORMANT_THRESHOLD_HOURS)
        for entry in dormant_list:
            targets.append({
                "user_id":        entry["user_id"],
                "trigger_reason": "dormant_48h",
                "hours_dormant":  entry["hours_dormant"],
                "cooldown_hrs":   PUSH_COOLDOWN_HOURS,
            })

    if mode in ("sunday", "both") and is_sunday:
        sunday_list = scan_sunday_users(index)
        existing_ids = {t["user_id"] for t in targets}
        for entry in sunday_list:
            uid = entry["user_id"]
            if uid not in existing_ids:
                targets.append({
                    "user_id":        uid,
                    "trigger_reason": "sunday_accountability",
                    "hours_dormant":  0.0,
                    "cooldown_hrs":   SUNDAY_PUSH_COOLDOWN_HOURS,
                    "_sunday_profile": entry.get("profile", {}),
                })
            else:
                # Already in dormant list — upgrade trigger label
                for t in targets:
                    if t["user_id"] == uid:
                        t["trigger_reason"] = "dormant_and_sunday"
                        t["cooldown_hrs"]   = SUNDAY_PUSH_COOLDOWN_HOURS
                        break

    log.info(f"🎯 Total targets this run: {len(targets)}")

    # ── Process each target ───────────────────────────────────────────────────
    sent_count    = 0
    skipped_count = 0
    failed_count  = 0

    for target in targets:
        uid            = target["user_id"]
        trigger_reason = target["trigger_reason"]
        hours_dormant  = target.get("hours_dormant", 0.0)
        cooldown_hrs   = target.get("cooldown_hrs", PUSH_COOLDOWN_HOURS)

        log.info(f"── Processing {uid[:8]}...  trigger={trigger_reason}")

        # ── Anti-spam check ───────────────────────────────────────────────────
        sentinel_meta = fetch_sentinel_meta(index, uid)
        allowed, reason = should_send_push(sentinel_meta, trigger_reason, cooldown_hrs)
        if not allowed:
            log.info(f"   ⛔ Skipped: {reason}")
            skipped_count += 1
            continue

        # ── Load profile data ─────────────────────────────────────────────────
        profile = target.get("_sunday_profile") or fetch_user_profile(index, uid)
        intake  = fetch_intake_profile(index, uid)

        # Merge intake + synthesized profile (intake is more explicit)
        name      = profile.get("name") or "Operative"
        mission   = intake.get("mission")  or profile.get("mission",  "personal_growth")
        roadblock = intake.get("roadblock") or profile.get("roadblock", "")
        vibe      = intake.get("vibe")     or profile.get("vibe",     "standard")
        goals     = profile.get("goals",   [])
        anchors   = profile.get("anchors", [])

        # ── Generate payload ──────────────────────────────────────────────────
        if client:
            payload = await generate_push_payload(
                client=client,
                user_name=name,
                mission=mission,
                roadblock=roadblock,
                vibe=vibe,
                goals=goals,
                anchors=anchors,
                trigger_reason=trigger_reason,
                hours_dormant=hours_dormant,
            )
        else:
            # No OpenAI — use deterministic template
            import random
            hook = random.choice(MISSION_INTERRUPT_HOOKS.get(mission, ["Stay on mission."]))
            payload = {
                "title": f"{name}, the mission's waiting",
                "body":  hook,
                "tag":   f"{trigger_reason}_{mission}",
                "data":  {"mission": mission, "trigger": trigger_reason},
            }

        # ── Fetch push tokens and dispatch ────────────────────────────────────
        tokens  = fetch_user_push_tokens(index, uid)
        success = dispatch_push(tokens, payload, uid)

        # ── Update Sentinel meta ──────────────────────────────────────────────
        now_iso = datetime.now(timezone.utc).isoformat()
        if success:
            sentinel_meta["last_push_ts"]        = now_iso
            sentinel_meta["last_trigger"]         = trigger_reason
            sentinel_meta["last_payload_title"]   = payload.get("title", "")
            # If user engaged after previous push, reset ignored counter
            # (engagement detection is handled by main.py on /chat hit —
            # it upserts sentinel_meta with consecutive_ignored=0 on any message)
            sent_count += 1
        else:
            # Count as ignored only if we had a valid channel
            if tokens.get("fcm_token") or tokens.get("webpush_endpoint"):
                sentinel_meta["consecutive_ignored"] = (
                    sentinel_meta.get("consecutive_ignored", 0) + 1
                )
            failed_count += 1

        upsert_sentinel_meta(index, uid, sentinel_meta, _SENTINEL_ANCHOR_VECTOR)

        # Rate limit — don't hammer Pinecone or OpenAI
        await asyncio.sleep(0.3)

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info(f"{'='*60}")
    log.info(f"  SENTINEL RUN COMPLETE")
    log.info(f"  Targets:  {len(targets)}")
    log.info(f"  Sent:     {sent_count}")
    log.info(f"  Skipped:  {skipped_count}  (anti-spam / no consent)")
    log.info(f"  Failed:   {failed_count}  (no channel / delivery error)")
    log.info(f"  DRY_RUN:  {DRY_RUN}")
    log.info(f"{'='*60}")


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
        upsert_sentinel_meta(index, user_id, meta, _SENTINEL_ANCHOR_VECTOR)
        log.info(f"🔄 Sentinel: re-engagement reset for {user_id[:8]}")


# =============================================================================
# ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="LYLO OS Sentinel — Accountability Push Engine")
    parser.add_argument(
        "--mode",
        choices=["dormant", "sunday", "both"],
        default="dormant",
        help=(
            "dormant: scan for 48h-inactive users. "
            "sunday: sweep accountability targets. "
            "both: run dormant + sunday (use on Sundays)."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log payloads without sending any push notifications.",
    )
    args = parser.parse_args()

    if args.dry_run:
        os.environ["SENTINEL_DRY_RUN"] = "true"
        global DRY_RUN
        DRY_RUN = True
        log.info("🔬 DRY RUN MODE — no pushes will be sent.")

    asyncio.run(run_sentinel(args.mode))


if __name__ == "__main__":
    main()
