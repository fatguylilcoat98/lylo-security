"""LYLO OS — routers/obd_router.py"""
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

from fastapi import APIRouter, Form
from fastapi.responses import HTMLResponse, JSONResponse
from services.config import openai_client, create_user_id, ELITE_USERS
logger = logging.getLogger("LYLO.OBD")
router = APIRouter()

OBD_CODE_DESCRIPTIONS: dict[str, str] = {
    # Powertrain
    "P0100": "Mass Air Flow Circuit Malfunction",
    "P0101": "MAF Circuit Range/Performance",
    "P0102": "MAF Circuit Low Input",
    "P0103": "MAF Circuit High Input",
    "P0110": "Intake Air Temperature Circuit Malfunction",
    "P0113": "Intake Air Temperature Circuit High Input",
    "P0120": "Throttle/Pedal Position Sensor A Circuit Malfunction",
    "P0171": "System Too Lean (Bank 1)",
    "P0172": "System Too Rich (Bank 1)",
    "P0174": "System Too Lean (Bank 2)",
    "P0175": "System Too Rich (Bank 2)",
    "P0200": "Injector Circuit Malfunction",
    "P0300": "Random/Multiple Cylinder Misfire Detected",
    "P0301": "Cylinder 1 Misfire Detected",
    "P0302": "Cylinder 2 Misfire Detected",
    "P0303": "Cylinder 3 Misfire Detected",
    "P0304": "Cylinder 4 Misfire Detected",
    "P0305": "Cylinder 5 Misfire Detected",
    "P0306": "Cylinder 6 Misfire Detected",
    "P0325": "Knock Sensor 1 Circuit Malfunction (Bank 1)",
    "P0340": "Camshaft Position Sensor A Circuit Malfunction",
    "P0400": "Exhaust Gas Recirculation Flow Malfunction",
    "P0401": "EGR Flow Insufficient",
    "P0402": "EGR Flow Excessive",
    "P0420": "Catalyst System Efficiency Below Threshold (Bank 1)",
    "P0430": "Catalyst System Efficiency Below Threshold (Bank 2)",
    "P0440": "Evaporative Emission Control System Malfunction",
    "P0441": "EVAP Control System Incorrect Purge Flow",
    "P0442": "EVAP Control System Leak Detected (small leak)",
    "P0455": "EVAP Control System Leak Detected (large leak)",
    "P0456": "EVAP Control System Leak Detected (very small leak)",
    "P0500": "Vehicle Speed Sensor Malfunction",
    "P0505": "Idle Control System Malfunction",
    "P0562": "System Voltage Low",
    "P0600": "Serial Communication Link Malfunction",
    "P0700": "Transmission Control System Malfunction",
    # ABS / Body
    "C0035": "Left Front Wheel Speed Sensor Circuit",
    "C0040": "Right Front Wheel Speed Sensor Circuit",
    "C0045": "Left Rear Wheel Speed Sensor Circuit",
    "C0050": "Right Rear Wheel Speed Sensor Circuit",
    "B0001": "Airbag Deployment Loop Resistance Low",
    "B0002": "Driver Airbag Circuit Malfunction",
    # Transmission
    "P0715": "Input/Turbine Speed Sensor Circuit Malfunction",
    "P0730": "Incorrect Gear Ratio",
    "P0740": "Torque Converter Clutch Circuit Malfunction",
    "P0750": "Shift Solenoid A Malfunction",
    "P0755": "Shift Solenoid B Malfunction",
}

SEVERITY_MAP: dict[str, str] = {
    "P0300": "CRITICAL — drive to shop immediately, misfires damage catalytic converter",
    "P0301": "CRITICAL — single cylinder misfire, check ignition and fuel injector",
    "P0302": "CRITICAL — single cylinder misfire, check ignition and fuel injector",
    "P0303": "CRITICAL — single cylinder misfire, check ignition and fuel injector",
    "P0304": "CRITICAL — single cylinder misfire, check ignition and fuel injector",
    "P0420": "MODERATE — catalytic converter efficiency loss, get second opinion before replacement",
    "P0430": "MODERATE — catalytic converter efficiency loss, get second opinion before replacement",
    "P0171": "MODERATE — lean condition, check MAF sensor and vacuum leaks first",
    "P0172": "MODERATE — rich condition, check O2 sensors and fuel pressure",
    "P0440": "LOW — EVAP leak, often a loose gas cap — check that first",
    "P0442": "LOW — small EVAP leak, smoke test recommended",
    "P0455": "MODERATE — large EVAP leak, inspect fuel cap and lines",
    "P0700": "HIGH — transmission fault, do not ignore — shift quality will degrade",
    "P0562": "HIGH — low system voltage, check alternator and battery immediately",
}


@router.post("/obd-handshake")

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
# CLAUDE VALIDATOR — PERSONA LANE ENFORCEMENT
# Only fires when the winner response contains structural headers.
# Lightweight check: does NOT rewrite simple greetings or short answers.
# =============================================================================

_STRUCTURAL_HEADERS = [
    "[DIAGNOSIS]", "[FIX PROTOCOL]", "[ANALYSIS]", "[RISK]",
    "[MOST LIKELY]", "[PROTOCOL]", "[ESCALATE WHEN]", "[TACTICAL MOVE]",
    "[CURRENT STATE]", "[BLEEDING POINT]", "[60-DAY PLAN]", "[REFLECT]",
    "[IDENTIFY]", "[REFRAME]", "[EXPERIMENT]", "[SITUATION READ]",
    "[LEVERAGE POINTS]", "[EXACT PLAY]", "[ROOT CAUSE]", "[COST INTEL]",
]


@router.get("/obd2")
async def serve_obd2_schematic():
    """Serve the OBDLink integration schematic — shareable link for partners."""
    schematic_path = os.path.join(os.path.dirname(__file__), "lylo_obd2_schematic.html")
    if os.path.exists(schematic_path):
        with open(schematic_path, "r") as f:
            html = f.read()
        return HTMLResponse(content=html)
    return HTMLResponse(content="<h1>Schematic not found</h1>", status_code=404)


@router.get("/")
async def root():
    return {
        "status":  "LYLO OS Active",
        "version": "31.0.0 — KERNEL v31 | TRIPLE ENGINE | CLAUDE VALIDATOR | OBD-II",
        "message": "Digital Bodyguard OS — Protecting lives through intelligence.",
    }

