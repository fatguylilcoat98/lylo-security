"""LYLO OS — routers/admin_router.py"""
import re
import os
import json
import time
import asyncio
import base64
import hashlib
import logging
import smtplib
import random
import string
from io import BytesIO
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Any, Union

import stripe
from fastapi import APIRouter, Form, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.config import (
    STRIPE_WEBHOOK_SECRET, ELITE_USERS, ADMIN_USERS,
    _save_beta_users, _load_beta_users, create_user_id,
)
logger = logging.getLogger("LYLO.Admin")
router = APIRouter()
class WaitlistRequest(BaseModel):
    email: str

WAITLIST_FILE   = "waitlist.json"
PAID_QUEUE_FILE = "paid_queue.json"
ADMIN_EMAILS    = ["mylylo.ai@gmail.com", "stangman9898@gmail.com"]

try:
    with open(WAITLIST_FILE, "r") as _f:
        WAITLIST_DB = set(json.load(_f))
except Exception:
    WAITLIST_DB = set()

try:
    with open(PAID_QUEUE_FILE, "r") as _f:
        PAID_QUEUE_DB = json.load(_f)
except Exception:
    PAID_QUEUE_DB = {}


def _check_admin(admin_email: str):
    if admin_email.lower().strip() not in ADMIN_EMAILS:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")


@router.post("/join-waitlist")
async def join_waitlist(request: WaitlistRequest):
    email_clean = request.email.lower().strip()
    WAITLIST_DB.add(email_clean)
    try:
        with open(WAITLIST_FILE, "w") as f:
            json.dump(list(WAITLIST_DB), f)
    except Exception as e:
        logger.error(f"Failed to save waitlist: {e}")

    try:
        import smtplib
        from email.mime.text import MIMEText
        smtp_user = os.getenv("SMTP_USERNAME", "")
        smtp_pass = os.getenv("SMTP_PASSWORD", "")
        if smtp_user and smtp_pass:
            msg = MIMEText(
                f"New waitlist signup: {email_clean}\n\n"
                f"Total on waitlist: {len(WAITLIST_DB)}\n\n"
                f"To activate as beta tester reply or use:\n"
                f"POST /activate-beta\n"
                f"  admin_email: stangman9898@gmail.com\n"
                f"  tester_email: {email_clean}\n"
                f"  tester_name: [their name]\n"
                f"  slot_number: [1-20]",
                "plain"
            )
            msg["Subject"] = f"🔔 LYLO Waitlist — New Signup #{len(WAITLIST_DB)}: {email_clean}"
            msg["From"]    = smtp_user
            msg["To"]      = "stangman9898@gmail.com"
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, "stangman9898@gmail.com", msg.as_string())
            logger.info(f"✅ Waitlist notification sent for {email_clean}")
    except Exception as e:
        logger.warning(f"Waitlist notify failed (non-critical): {e}")

    return {"status": "success", "message": "Spot Secured"}


@router.get("/view-waitlist/{admin_email}")
async def view_waitlist(admin_email: str):
    if admin_email.lower().strip() in ADMIN_EMAILS:
        return {"status": "AUTHORIZED", "total_waiting": len(WAITLIST_DB), "emails": list(WAITLIST_DB)}
    return {"error": "UNAUTHORIZED ACCESS"}


@router.get("/beta-status/{admin_email}")
async def beta_status(admin_email: str):
    if admin_email.lower().strip() not in ADMIN_EMAILS:
        return {"error": "UNAUTHORIZED"}
    slots = {
        email: data for email, data in ELITE_USERS.items()
        if data.get("beta") is True
    }
    filled   = {e: d for e, d in slots.items() if "placeholder.com" not in e}
    open_slots = {e: d for e, d in slots.items() if "placeholder.com" in e}
    return {
        "total_slots":  20,
        "filled":       len(filled),
        "open":         len(open_slots),
        "filled_slots": filled,
        "open_slots":   list(open_slots.keys()),
        "waitlist_queue": list(WAITLIST_DB),
    }


@router.post("/activate-beta")
async def activate_beta(
    admin_email: str = Form(...),
    tester_email: str = Form(...),
    tester_name:  str = Form(...),
    slot_number:  int = Form(...),
):
    if admin_email.lower().strip() not in ADMIN_EMAILS:
        return {"error": "UNAUTHORIZED"}
    slot_key = f"beta_slot_{slot_number}@placeholder.com"
    if slot_key not in ELITE_USERS:
        return {"error": f"Slot {slot_number} not found or already filled"}
    del ELITE_USERS[slot_key]
    clean_email = tester_email.lower().strip()
    clean_name  = tester_name.strip()
    beta_db = _load_beta_users()
    beta_db[clean_email] = {"tier": "pro", "name": clean_name, "beta": True, "slot": slot_number}
    _save_beta_users(beta_db)
    ELITE_USERS[clean_email] = {"tier": "pro", "name": clean_name, "beta": True, "slot": slot_number}
    logger.info(f"✅ Beta slot {slot_number} activated → {clean_email} persisted to beta_users.json")
    return {"status": "activated", "slot": slot_number, "email": clean_email, "name": clean_name}


# =============================================================================
# NEW SIMPLE ENDPOINTS — no slot numbers needed
# =============================================================================

class AddUserRequest(BaseModel):
    admin_email: str
    email: str
    name: str
    tier: Optional[str] = "pro"


class RemoveUserRequest(BaseModel):
    admin_email: str
    email: str


@router.post("/admin/add-user")
async def admin_add_user(req: AddUserRequest):
    """Add or update a beta user directly. No slot number needed."""
    _check_admin(req.admin_email)
    clean_email = req.email.lower().strip()
    clean_name  = req.name.strip()
    clean_tier  = (req.tier or "pro").lower().strip()

    beta_db = _load_beta_users()
    beta_db[clean_email] = {
        "tier":     clean_tier,
        "name":     clean_name,
        "beta":     True,
        "added_at": datetime.now().isoformat(),
    }
    _save_beta_users(beta_db)
    ELITE_USERS[clean_email] = beta_db[clean_email]
    logger.info(f"✅ Admin added user: {clean_email} ({clean_tier})")
    return {"status": "success", "message": f"{clean_name} ({clean_email}) added as {clean_tier.upper()}"}


@router.post("/admin/remove-user")
async def admin_remove_user(req: RemoveUserRequest):
    """Remove a beta user from both memory and persistent file."""
    _check_admin(req.admin_email)
    clean_email = req.email.lower().strip()

    beta_db = _load_beta_users()
    in_file = clean_email in beta_db
    in_mem  = clean_email in ELITE_USERS

    if not in_file and not in_mem:
        return {"status": "not_found", "message": f"{clean_email} not found"}

    if in_file:
        del beta_db[clean_email]
        _save_beta_users(beta_db)
    if in_mem:
        del ELITE_USERS[clean_email]

    logger.info(f"🚫 Admin removed user: {clean_email}")
    return {"status": "success", "message": f"{clean_email} removed"}


@router.post("/admin/list-users")
async def admin_list_users(req: dict):
    """List all active beta users from persistent file."""
    _check_admin(req.get("admin_email", ""))
    beta_db = _load_beta_users()
    users = []
    for email, data in beta_db.items():
        if "placeholder.com" in email:
            continue
        users.append({
            "email":    email,
            "name":     data.get("name", ""),
            "tier":     data.get("tier", "pro"),
            "added_at": data.get("added_at", ""),
        })
    users.sort(key=lambda x: x["added_at"], reverse=True)
    return {"status": "success", "count": len(users), "users": users}


@router.get("/admin/check-user/{email}")
async def admin_check_user(email: str, admin_email: str):
    """Quick lookup for a single email."""
    _check_admin(admin_email)
    clean = email.lower().strip()
    if clean in ELITE_USERS:
        data = ELITE_USERS[clean]
        return {"found": True, "name": data.get("name", ""), "tier": data.get("tier", "pro")}
    return {"found": False}


# =============================================================================
# CHECK-BETA-ACCESS — what the website login button calls
# =============================================================================

class BetaAccessRequest(BaseModel):
    email: str

@router.post("/check-beta-access")
async def check_beta_access(req: BetaAccessRequest):
    email = req.email.lower().strip()
    if email in ELITE_USERS:
        data = ELITE_USERS[email]
        logger.info(f"✅ Beta access granted: {email}")
        return {
            "access": True,
            "name":   data.get("name", "Friend"),
            "tier":   data.get("tier", "pro"),
            "email":  email,
        }
    logger.info(f"🚫 Beta access denied: {email}")
    return {"access": False}


@router.get("/view-paid-queue/{admin_email}")
async def view_paid_queue(admin_email: str):
    if admin_email.lower().strip() in ADMIN_EMAILS:
        return {"status": "AUTHORIZED", "total_pending": len(PAID_QUEUE_DB), "pending_users": PAID_QUEUE_DB}
    return {"error": "UNAUTHORIZED ACCESS"}


# =============================================================================
# STRIPE WEBHOOK
# =============================================================================
@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session        = event["data"]["object"]
        customer_email = session.get("customer_details", {}).get("email")
        amount_total   = session.get("amount_total", 0)

        if customer_email:
            email_lower = customer_email.lower().strip()
            new_tier = "free"
            if amount_total in [199, 1999]:    new_tier = "pro"
            elif amount_total in [499, 4999]:  new_tier = "elite"
            elif amount_total >= 999:          new_tier = "max"

            if email_lower in ELITE_USERS:
                ELITE_USERS[email_lower]["tier"] = new_tier
                logger.info(f"💰 STRIPE: Upgraded {email_lower} to {new_tier.upper()}")
            else:
                PAID_QUEUE_DB[email_lower] = {
                    "tier":   new_tier,
                    "name":   email_lower.split("@")[0].capitalize(),
                    "status": "pending_admin_approval",
                }
                try:
                    with open(PAID_QUEUE_FILE, "w") as f:
                        json.dump(PAID_QUEUE_DB, f)
                except Exception as e:
                    logger.error(f"Failed to save paid queue: {e}")
                logger.info(f"💰 STRIPE: New user {email_lower} → MANUAL APPROVAL QUEUE")

            if email_lower in WAITLIST_DB:
                WAITLIST_DB.discard(email_lower)
                try:
                    with open(WAITLIST_FILE, "w") as f:
                        json.dump(list(WAITLIST_DB), f)
                except Exception as e:
                    logger.error(f"Waitlist removal error: {e}")

    return {"status": "success"}

# =============================================================================
# SCAM DETECTION
# =============================================================================
