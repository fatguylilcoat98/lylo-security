"""
LYLO OS — vault_routes.py
Elite Tier — Tactical Vault FastAPI Routes
Version: 1.0.0

Mount into main.py:
    from vault_routes import vault_router
    app.include_router(vault_router)

Endpoints:
    POST /generate-report     — Generates a Tactical Vault PDF and returns it as a download
    POST /send-report-to-pro  — Emails an existing report to a third-party professional
"""

import json
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, Form, File, UploadFile, BackgroundTasks
from fastapi.responses import JSONResponse, Response

from tactical_vault import (
    TacticalReportData,
    build_incident_prompt,
    generate_tactical_report,
    send_report_to_pro,
)

log = logging.getLogger("LYLO.VaultRoutes")

vault_router = APIRouter()

# =============================================================================
# TIER GUARD
# Only Elite users can access Tactical Vault.
# Swap this for your real tier-check logic.
# =============================================================================

ELITE_TIERS = {"elite", "max"}

def _check_elite_access(user_email: str, user_tier: str) -> bool:
    """Returns True if the user is on an eligible tier."""
    return user_tier.lower() in ELITE_TIERS


# =============================================================================
# POST /generate-report
# =============================================================================
# Accepts a multipart form with all report data and optional image uploads.
# Calls OpenAI for the Bodyguard Summary, then generates and returns the PDF.
# =============================================================================

@vault_router.post("/generate-report")
async def generate_report(
    # ── Auth / Tier ──────────────────────────────────────────────────────────
    user_email:             str  = Form(...),
    user_tier:              str  = Form(default="free"),

    # ── User Context ─────────────────────────────────────────────────────────
    user_name:              str  = Form(default="Unknown"),
    emergency_contact_name: str  = Form(default=""),
    emergency_contact_phone: str = Form(default=""),

    # ── Incident ─────────────────────────────────────────────────────────────
    persona_id:             str  = Form(default="guardian"),
    incident_title:         str  = Form(default="Incident Report"),
    incident_description:   str  = Form(default=""),

    # ── Auto Metadata (sent by frontend) ─────────────────────────────────────
    timestamp:              str  = Form(default=""),
    gps_latitude:           str  = Form(default=""),
    gps_longitude:          str  = Form(default=""),
    gps_address:            str  = Form(default=""),
    weather_condition:      str  = Form(default=""),
    weather_temp_f:         str  = Form(default=""),
    device_model:           str  = Form(default=""),

    # ── Doctor fields ─────────────────────────────────────────────────────────
    pain_scale:             str  = Form(default=""),
    pain_duration:          str  = Form(default=""),
    pain_location:          str  = Form(default=""),
    symptoms_json:          str  = Form(default="[]"),       # JSON array string
    prior_conditions:       str  = Form(default=""),

    # ── Lawyer fields ─────────────────────────────────────────────────────────
    witness_names_json:     str  = Form(default="[]"),       # JSON array string
    opposing_party:         str  = Form(default=""),
    police_report_number:   str  = Form(default=""),
    silence_protocol_used:  str  = Form(default="true"),

    # ── Wealth fields ─────────────────────────────────────────────────────────
    merchant_name:          str  = Form(default=""),
    transaction_amount:     str  = Form(default=""),
    dispute_reason:         str  = Form(default=""),
    consumer_rights_note:   str  = Form(default=""),

    # ── Mechanic fields ───────────────────────────────────────────────────────
    vehicle_year:           str  = Form(default=""),
    vehicle_make:           str  = Form(default=""),
    vehicle_model_name:     str  = Form(default=""),
    obd_codes_json:         str  = Form(default="[]"),       # JSON array string
    dealer_quote:           str  = Form(default=""),
    fair_market_estimate:   str  = Form(default=""),
    repair_description:     str  = Form(default=""),

    # ── Images ────────────────────────────────────────────────────────────────
    images:                 List[UploadFile] = File(default=[]),
    image_captions_json:    str  = Form(default="[]"),       # JSON array of caption strings
):
    """
    Generates a Tactical Vault PDF report.

    Returns the PDF as a binary download (application/pdf).
    Frontend receives it as a blob and can offer download or display.
    """

    # ── Tier check ───────────────────────────────────────────────────────────
    if not _check_elite_access(user_email, user_tier):
        return JSONResponse(
            status_code = 403,
            content     = {
                "error": "Elite tier required",
                "message": "Tactical Vault is an Elite tier feature. Upgrade to unlock.",
            }
        )

    # ── Parse JSON array fields ───────────────────────────────────────────────
    try:
        symptoms      = json.loads(symptoms_json)
    except Exception:
        symptoms      = []
    try:
        witness_names = json.loads(witness_names_json)
    except Exception:
        witness_names = []
    try:
        obd_codes     = json.loads(obd_codes_json)
    except Exception:
        obd_codes     = []
    try:
        image_captions = json.loads(image_captions_json)
    except Exception:
        image_captions = []

    # ── Read image bytes ──────────────────────────────────────────────────────
    image_bytes_list = []
    for upload in images:
        try:
            img_bytes = await upload.read()
            if img_bytes:
                image_bytes_list.append(img_bytes)
        except Exception as e:
            log.warning(f"[Vault] Image read failed: {e}")

    # ── Build metadata dict for prompt ───────────────────────────────────────
    metadata = {
        "timestamp":       timestamp,
        "gps_latitude":    gps_latitude,
        "gps_longitude":   gps_longitude,
        "gps_address":     gps_address,
        "weather_condition": weather_condition,
        "weather_temp_f":  weather_temp_f,
    }

    # ── Generate AI Bodyguard Summary ─────────────────────────────────────────
    bodyguard_summary = ""
    try:
        from openai import AsyncOpenAI
        openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        prompt = build_incident_prompt(
            persona_id           = persona_id,
            incident_description = incident_description,
            metadata             = metadata,
            image_count          = len(image_bytes_list),
        )
        completion = await openai_client.chat.completions.create(
            model       = "gpt-4o",
            messages    = [{"role": "user", "content": prompt}],
            max_tokens  = 300,
            temperature = 0.4,   # Low temp — factual, not creative
        )
        bodyguard_summary = completion.choices[0].message.content.strip()
        log.info(f"[Vault] Bodyguard summary generated — {len(bodyguard_summary)} chars")
    except Exception as e:
        log.warning(f"[Vault] Bodyguard summary generation failed: {e}")
        bodyguard_summary = (
            "Incident documented. All available evidence has been recorded in this report. "
            "Review the sections below and present this document to the appropriate professional."
        )

    # ── Assemble report data ──────────────────────────────────────────────────
    report_data = TacticalReportData(
        user_name               = user_name,
        user_email              = user_email,
        emergency_contact_name  = emergency_contact_name,
        emergency_contact_phone = emergency_contact_phone,
        persona_id              = persona_id,
        incident_title          = incident_title,
        incident_description    = incident_description,
        timestamp               = timestamp,
        gps_latitude            = gps_latitude,
        gps_longitude           = gps_longitude,
        gps_address             = gps_address,
        weather_condition       = weather_condition,
        weather_temp_f          = weather_temp_f,
        device_model            = device_model,
        bodyguard_summary       = bodyguard_summary,

        # Doctor
        pain_scale              = pain_scale,
        pain_duration           = pain_duration,
        pain_location           = pain_location,
        symptoms                = symptoms,
        prior_conditions        = prior_conditions,

        # Lawyer
        witness_names           = witness_names,
        opposing_party          = opposing_party,
        police_report_number    = police_report_number,
        silence_protocol_used   = silence_protocol_used.lower() != "false",

        # Wealth
        merchant_name           = merchant_name,
        transaction_amount      = transaction_amount,
        dispute_reason          = dispute_reason,
        consumer_rights_note    = consumer_rights_note,

        # Mechanic
        vehicle_year            = vehicle_year,
        vehicle_make            = vehicle_make,
        vehicle_model           = vehicle_model_name,
        obd_codes               = obd_codes,
        dealer_quote            = dealer_quote,
        fair_market_estimate    = fair_market_estimate,
        repair_description      = repair_description,

        # Images
        image_bytes_list        = image_bytes_list,
        image_captions          = image_captions,
    )

    # ── Generate PDF ──────────────────────────────────────────────────────────
    try:
        pdf_bytes = generate_tactical_report(report_data)
        log.info(
            f"[Vault] PDF generated — persona={persona_id} "
            f"user={user_email[:4]}*** size={len(pdf_bytes)//1024}KB"
        )
    except Exception as e:
        log.error(f"[Vault] PDF generation failed: {e}")
        return JSONResponse(
            status_code = 500,
            content     = {"error": "PDF generation failed", "detail": str(e)}
        )

    # ── Return PDF as binary download ─────────────────────────────────────────
    safe_title = incident_title.replace(" ", "_").replace("/", "-")[:40]
    filename   = f"LYLO_TacticalVault_{persona_id.upper()}_{safe_title}.pdf"

    return Response(
        content     = pdf_bytes,
        media_type  = "application/pdf",
        headers     = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# POST /send-report-to-pro
# =============================================================================
# Accepts a PDF blob + recipient info and emails it directly.
# Called with a single tap from the "Send to Pro" button in ChatInterface.
# =============================================================================

@vault_router.post("/send-report-to-pro")
async def send_to_pro(
    background_tasks:   BackgroundTasks,
    user_email:         str  = Form(...),
    user_tier:          str  = Form(default="free"),
    user_name:          str  = Form(default="Unknown"),
    recipient_email:    str  = Form(...),
    persona_id:         str  = Form(default="guardian"),
    incident_title:     str  = Form(default="Incident Report"),
    subject_override:   str  = Form(default=""),
    pdf_file:           UploadFile = File(...),
):
    """
    Emails a Tactical Vault PDF to a third-party professional.

    The PDF is sent as a background task so the frontend gets an immediate
    200 response. Use the returned job_status to poll if needed.
    """

    # ── Tier check ───────────────────────────────────────────────────────────
    if not _check_elite_access(user_email, user_tier):
        return JSONResponse(
            status_code = 403,
            content     = {"error": "Elite tier required"}
        )

    # ── Read PDF ──────────────────────────────────────────────────────────────
    try:
        pdf_bytes = await pdf_file.read()
        if not pdf_bytes:
            return JSONResponse(
                status_code = 400,
                content     = {"error": "PDF file is empty"}
            )
    except Exception as e:
        return JSONResponse(
            status_code = 400,
            content     = {"error": f"Could not read PDF: {e}"}
        )

    # ── Dispatch as background task (non-blocking) ────────────────────────────
    def _send():
        success = send_report_to_pro(
            pdf_bytes        = pdf_bytes,
            recipient_email  = recipient_email,
            sender_name      = user_name,
            persona_id       = persona_id,
            subject_override = subject_override or None,
            incident_title   = incident_title,
            user_email       = user_email,
        )
        if success:
            log.info(f"[Vault] Report dispatched to pro: {recipient_email[:4]}***")
        else:
            log.error(f"[Vault] Send-to-pro failed for {user_email[:4]}***")

    background_tasks.add_task(_send)

    return JSONResponse({
        "status":    "dispatching",
        "message":   f"Your report is being sent to {recipient_email}. "
                     f"You'll receive a confirmation when it's delivered.",
        "recipient": recipient_email[:3] + "***" + recipient_email[recipient_email.find("@"):],
    })
