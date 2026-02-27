#!/usr/bin/env python3
# =============================================================================
# LYLO OS — sentinel_cron.py  (Entry Point)
# Version: 2.0.0  —  Service-Oriented Architecture
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
#                     (warm-start protocol field) OR mission == protect_family /
#                     build_wealth
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
#   0 9 * * * python3 -m lylo_sentinel.sentinel_cron --mode dormant
#
#   # Every Sunday at 9 AM UTC (accountability sweep)
#   0 9 * * 0 python3 -m lylo_sentinel.sentinel_cron --mode sunday
#
#   # Run both modes (recommended for Sunday)
#   0 9 * * 0 python3 -m lylo_sentinel.sentinel_cron --mode both
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
import asyncio
import argparse
from datetime import datetime, timezone, timedelta

# ── Internal modules ──────────────────────────────────────────────────────────
from .config import (
    DRY_RUN,
    DORMANT_THRESHOLD_HOURS,
    PUSH_COOLDOWN_HOURS,
    SUNDAY_PUSH_COOLDOWN_HOURS,
    BACKOFF_IGNORE_COUNT,
    BACKOFF_SILENCE_DAYS,
    SENTINEL_ANCHOR_VECTOR,
    log,
)
from .database import (
    get_pinecone_index,
    get_openai_client,
    fetch_user_profile,
    fetch_intake_profile,
    fetch_sentinel_meta,
    upsert_sentinel_meta,
    fetch_user_push_tokens,
    scan_dormant_users,
    scan_sunday_users,
)
from .personality import (
    MISSION_INTERRUPT_HOOKS,
    generate_push_payload,
)
from .delivery import dispatch_push


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
# MAIN SENTINEL ORCHESTRATOR
# =============================================================================

async def run_sentinel(mode: str):
    """
    mode: "dormant" | "sunday" | "both"

    Orchestrates the full Sentinel run:
      1. Resolve target user lists from Pinecone
      2. Gate each user through anti-spam checks
      3. Load profile + intake data
      4. Generate personalised push payload via GPT-4o-mini
      5. Dispatch via FCM or Web Push
      6. Persist updated Sentinel metadata
    """
    is_sunday = datetime.now(timezone.utc).weekday() == 6   # 6 = Sunday

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
        sunday_list  = scan_sunday_users(index)
        existing_ids = {t["user_id"] for t in targets}
        for entry in sunday_list:
            uid = entry["user_id"]
            if uid not in existing_ids:
                targets.append({
                    "user_id":         uid,
                    "trigger_reason":  "sunday_accountability",
                    "hours_dormant":   0.0,
                    "cooldown_hrs":    SUNDAY_PUSH_COOLDOWN_HOURS,
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
        mission   = intake.get("mission")   or profile.get("mission",   "personal_growth")
        roadblock = intake.get("roadblock") or profile.get("roadblock", "")
        vibe      = intake.get("vibe")      or profile.get("vibe",      "standard")
        goals     = profile.get("goals",    [])
        anchors   = profile.get("anchors",  [])

        # ── Generate payload ──────────────────────────────────────────────────
        if client:
            payload = await generate_push_payload(
                client         = client,
                user_name      = name,
                mission        = mission,
                roadblock      = roadblock,
                vibe           = vibe,
                goals          = goals,
                anchors        = anchors,
                trigger_reason = trigger_reason,
                hours_dormant  = hours_dormant,
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
            sentinel_meta["last_push_ts"]      = now_iso
            sentinel_meta["last_trigger"]       = trigger_reason
            sentinel_meta["last_payload_title"] = payload.get("title", "")
            # NOTE: engagement reset (consecutive_ignored → 0) is handled by
            # main.py on every /chat hit — see database.sentinel_reset_on_engagement
            sent_count += 1
        else:
            # Count as ignored only if we had a valid channel
            if tokens.get("fcm_token") or tokens.get("webpush_endpoint"):
                sentinel_meta["consecutive_ignored"] = (
                    sentinel_meta.get("consecutive_ignored", 0) + 1
                )
            failed_count += 1

        upsert_sentinel_meta(index, uid, sentinel_meta, SENTINEL_ANCHOR_VECTOR)

        # Rate-limit — don't hammer Pinecone or OpenAI
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
# ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="LYLO OS Sentinel — Accountability Push Engine"
    )
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
        # Re-import DRY_RUN after env override so config reflects the flag
        import lylo_sentinel.config as _cfg
        _cfg.DRY_RUN = True
        log.info("🔬 DRY RUN MODE — no pushes will be sent.")

    asyncio.run(run_sentinel(args.mode))


if __name__ == "__main__":
    main()
