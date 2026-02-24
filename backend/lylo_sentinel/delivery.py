#!/usr/bin/env python3
# =============================================================================
# LYLO OS — delivery.py
# Push notification delivery: FCM (Firebase Cloud Messaging) and
# Web Push via VAPID, with a unified dispatch_push router.
# =============================================================================

import json

from .config import (
    DRY_RUN,
    FCM_AVAILABLE,
    FCM_SERVER_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_CLAIM_EMAIL,
    WEBPUSH_AVAILABLE,
    log,
)


# =============================================================================
# FCM DELIVERY
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
        import requests as _requests

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
            "data":     payload.get("data", {}),
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


# =============================================================================
# WEB PUSH (VAPID) DELIVERY
# =============================================================================

def send_webpush_notification(
    endpoint:     str,
    p256dh:       str,
    auth_key:     str,
    payload:      dict,
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
        from pywebpush import webpush, WebPushException

        notification_body = json.dumps({
            "title": payload["title"],
            "body":  payload["body"],
            "tag":   payload.get("tag", "lylo_sentinel"),
            "icon":  "/icon-192.png",
            "badge": "/badge-72.png",
            "data":  payload.get("data", {}),
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


# =============================================================================
# UNIFIED DISPATCH ROUTER
# =============================================================================

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
            endpoint     = endpoint,
            p256dh       = tokens.get("webpush_keys_p256dh", ""),
            auth_key     = tokens.get("webpush_keys_auth", ""),
            payload      = payload,
            user_id_hint = user_id,
        )
        if success:
            return True

    log.info(f"ℹ️  No valid push channel for {user_id[:8]} — payload logged only.")
    # Always log payload for ops visibility
    log.info(f"   PAYLOAD: {json.dumps(payload)}")
    return False
