"""
LYLO OS — routers/obd_router.py
Endpoints: /obd-handshake, /obd2
"""
import json
import asyncio
import logging
from fastapi import APIRouter, Form
from fastapi.responses import HTMLResponse
from services.config import openai_client, create_user_id, ELITE_USERS

logger = logging.getLogger("LYLO.OBD")
router = APIRouter()

@router.post("/obd-handshake")
async def obd_handshake(
    user_email:   str  = Form(...),
    user_tier:    str  = Form(default="free"),
    obd_codes_json: str = Form(...),     # JSON array of raw OBD code strings, e.g. ["P0420","P0300"]
    vehicle_year:  str  = Form(default=""),
    vehicle_make:  str  = Form(default=""),
    vehicle_model: str  = Form(default=""),
    dealer_quote:  str  = Form(default=""),
):
    """
    OBD-II Bluetooth Handshake Endpoint — Mechanic Persona.

    Receives raw OBD-II fault codes from the frontend Bluetooth scanner,
    enriches them with descriptions + severity ratings, and returns a
    structured object ready to:
      1. Pre-populate the Tactical Vault /generate-report form (Mechanic PDF).
      2. Inject as context into the next /chat call for the Mechanic persona.
      3. Auto-pin the vehicle + fault codes to Pinecone memory.

    Tier requirement: Pro and above (Mechanic seat is Pro+).
    Free users get fault code descriptions but no AI analysis or PDF generation.
    """
    email_lower = user_email.lower().strip()

    try:
        raw_codes = json.loads(obd_codes_json)
        if not isinstance(raw_codes, list):
            return JSONResponse({"error": "obd_codes_json must be a JSON array"}, status_code=400)
    except Exception:
        return JSONResponse({"error": "Invalid obd_codes_json — must be valid JSON array"}, status_code=400)

    # Enrich codes
    enriched = []
    for code in raw_codes:
        code_upper  = code.strip().upper()
        description = OBD_CODE_DESCRIPTIONS.get(code_upper, "Unknown fault code — search obdii.com for details")
        severity    = SEVERITY_MAP.get(code_upper, "UNKNOWN — consult a mechanic for assessment")
        enriched.append({
            "code":        code_upper,
            "description": description,
            "severity":    severity,
            "formatted":   f"{code_upper} — {description}",
        })

    # Build vehicle string for logging/memory
    vehicle_str = " ".join(filter(None, [vehicle_year, vehicle_make, vehicle_model])) or "Unknown vehicle"

    # Auto-pin the diagnostic event to Pinecone memory
    if memory_index and enriched:
        code_list  = ", ".join(c["code"] for c in enriched)
        pin_text   = f"Vehicle: {vehicle_str}. OBD-II codes detected: {code_list}."
        if dealer_quote:
            pin_text += f" Dealer quoted ${dealer_quote} for repair."
        asyncio.create_task(asyncio.to_thread(
            upsert_memory_pin,
            memory_index,
            email_lower,
            pin_text[:200],
            "project",
        ))
        logger.info(f"📌 OBD-II auto-pinned for {email_lower[:6]}***: {code_list}")

    # Build a plain-English diagnostic summary for the chat context injection
    critical_codes  = [c for c in enriched if "CRITICAL" in c["severity"]]
    moderate_codes  = [c for c in enriched if "MODERATE" in c["severity"]]
    low_codes       = [c for c in enriched if "LOW" in c["severity"] or "UNKNOWN" in c["severity"]]

    summary_parts = []
    if critical_codes:
        summary_parts.append(
            f"🔴 CRITICAL ({len(critical_codes)}): "
            + "; ".join(f"{c['code']} ({c['description']})" for c in critical_codes)
        )
    if moderate_codes:
        summary_parts.append(
            f"🟡 MODERATE ({len(moderate_codes)}): "
            + "; ".join(f"{c['code']} ({c['description']})" for c in moderate_codes)
        )
    if low_codes:
        summary_parts.append(
            f"🟢 LOW/UNKNOWN ({len(low_codes)}): "
            + "; ".join(f"{c['code']}" for c in low_codes)
        )

    diagnostic_summary = "\n".join(summary_parts) or "No codes could be classified."

    logger.info(
        f"🔧 OBD-II Handshake — {email_lower[:6]}*** | "
        f"Vehicle: {vehicle_str} | Codes: {[c['code'] for c in enriched]}"
    )

    return {
        "status":              "handshake_complete",
        "vehicle":             vehicle_str,
        "codes_detected":      len(enriched),
        "enriched_codes":      enriched,
        "diagnostic_summary":  diagnostic_summary,
        "critical_count":      len(critical_codes),
        "chat_context_inject": (
            f"OBD-II scan complete on {vehicle_str}. "
            f"Fault codes detected: {', '.join(c['formatted'] for c in enriched)}. "
            f"Dealer quote: {'$' + dealer_quote if dealer_quote else 'not provided'}."
        ),
        # Ready to pass directly to /generate-report as obd_codes_json
        "report_ready": {
            "vehicle_year":        vehicle_year,
            "vehicle_make":        vehicle_make,
            "vehicle_model_name":  vehicle_model,
            "obd_codes_json":      json.dumps([c["formatted"] for c in enriched]),
            "dealer_quote":        dealer_quote,
            "repair_description":  f"Fault codes: {', '.join(c['code'] for c in enriched)}",
        },
    }


# =============================================================================
