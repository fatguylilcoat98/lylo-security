"""
LYLO OS — routers/vault_router.py
Endpoints: /vault/setup, /vault/scan-medication, /vault/add-medication,
           /vault/add-question, /vault/get-summary, /vault/generate-pdf,
           /vault/set-reminders, /vault/smart-reminder-message,
           /vault/update-silo, /vault/qr/{token}
"""
import logging
from typing import Optional
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel
from services.config import create_user_id, openai_client, gemini_client, gemini_ready
from services.memory_engine import get_or_create_vault, save_vault, load_vault
from services.llm_clients import call_gemini_vision, call_openai_bodyguard

logger = logging.getLogger("LYLO.Vault")
router = APIRouter()

try:
    from med_vault import (
        encrypt_silo, decrypt_silo, verify_pin,
        empty_medical_vault, new_medication, new_symptom,
        new_reaction, new_doctor_question,
        detect_symptoms_in_message, detect_reaction_mention,
        check_dosage_discrepancy, check_drug_interactions,
        generate_ephemeral_token, retrieve_ephemeral_token,
        persona_can_read, persona_can_write, get_readable_silos,
        SILO_ACCESS,
    )
    from med_vault_pdf import generate_medical_pdf, PERSONA_COLORS
    MED_VAULT_ENABLED = True
except ImportError as e:
    MED_VAULT_ENABLED = False
    logger.warning(f"Med-Vault not available: {e}")

# =============================================================================
# MED-VAULT API ENDPOINTS
# =============================================================================

@router.post("/vault/setup")
async def vault_setup(
    user_email: str  = Form(...),
    pin_enabled: str = Form("false"),
    pin:         str = Form(""),
):
    """
    First-time vault setup. User chooses Simple or PIN protection.
    Returns vault_ready: true on success.
    """
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    use_pin     = pin_enabled.lower() == "true" and len(pin) == 4 and pin.isdigit()
    vault       = empty_medical_vault()
    vault["pin_enabled"] = use_pin
    success = await save_vault(user_id, email_lower, vault, pin if use_pin else "")
    return JSONResponse({"vault_ready": success, "pin_enabled": use_pin})


@router.post("/vault/scan-medication")
async def vault_scan_medication(
    user_email: str        = Form(...),
    pin:        str        = Form(""),
    file:       UploadFile = File(None),
    ocr_text:   str        = Form(""),
):
    """
    OCR pill bottle scan. Reads label via Gemini Vision, checks for
    dosage discrepancies against stored medications, checks FDA interactions.
    Returns: {medication, discrepancy, interactions, message}
    """
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)

    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await get_or_create_vault(user_id, email_lower, pin)

    # ── OCR via Gemini Vision ─────────────────────────────────────────────────
    scanned = {}
    if file:
        try:
            img_bytes = await file.read()
            # Detect mime type from file header
            mime_type = "image/jpeg"
            if img_bytes[:4] == b'\x89PNG': mime_type = "image/png"
            elif img_bytes[:4] == b'GIF8': mime_type = "image/gif"
            img_b64 = base64.b64encode(img_bytes).decode()

            ocr_prompt = """You are reading a prescription pill bottle label.
Extract ONLY these fields and respond with valid JSON:
{"name": "medication name", "dose": "dosage amount and unit",
 "frequency": "how often to take", "prescriber": "doctor name if visible",
 "ndc": "NDC number if visible", "instructions": "any special instructions"}
If a field is not visible, use empty string. Be precise with dosage numbers.
Do NOT include any text outside the JSON object."""

            # call_gemini_vision returns a parsed dict already
            ocr_result = await call_gemini_vision(ocr_prompt, img_b64)
            logger.info(f"OCR result: {str(ocr_result)[:200]}")

            if ocr_result and isinstance(ocr_result, dict):
                # Strip internal model key, keep medication fields
                scanned = {k: v for k, v in ocr_result.items()
                           if k in ("name","dose","frequency","prescriber","ndc","instructions")}
            elif ocr_result and isinstance(ocr_result, str):
                # Fallback: raw string — try to parse
                try:
                    clean  = ocr_result.strip().replace("```json","").replace("```","")
                    scanned = json.loads(clean)
                except Exception:
                    scanned = {"name": ocr_result[:100], "dose": "", "frequency": ""}
            else:
                # Gemini unavailable — fall back to Claude vision
                try:
                    claude_resp = await openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{
                            "role": "user",
                            "content": [
                                {"type": "text", "text": ocr_prompt},
                                {"type": "image_url", "image_url": {
                                    "url": f"data:{mime_type};base64,{img_b64}"
                                }}
                            ]
                        }],
                        max_tokens=300,
                        response_format={"type": "json_object"},
                    )
                    scanned = json.loads(claude_resp.choices[0].message.content)
                    logger.info(f"OCR fallback (GPT-4o-mini): {str(scanned)[:100]}")
                except Exception as fe:
                    logger.warning(f"OCR fallback error: {fe}")
        except Exception as e:
            logger.warning(f"OCR error: {e}")
    elif ocr_text:
        scanned = {"name": ocr_text, "dose": "", "frequency": ""}

    if not scanned.get("name"):
        return JSONResponse({"error": "Could not read medication label"}, status_code=400)

    # ── Dosage discrepancy check ──────────────────────────────────────────────
    discrepancy = check_dosage_discrepancy(scanned, vault.get("medications", []))

    # ── FDA drug interaction check ────────────────────────────────────────────
    interactions = await check_drug_interactions(
        vault.get("medications", []), scanned.get("name", "")
    )

    # ── Build response message ────────────────────────────────────────────────
    msg_parts = []
    if discrepancy:
        msg_parts.append(discrepancy["message"])
    if interactions:
        for ia in interactions[:2]:  # top 2 warnings
            msg_parts.append(
                f"⚡ Heads up: {ia['drug_a']} and {ia['drug_b']} may interact. "
                f"Mention this to your doctor."
            )

    return JSONResponse({
        "scanned":      scanned,
        "discrepancy":  discrepancy,
        "interactions": interactions,
        "message":      " ".join(msg_parts) if msg_parts else None,
        "ready_to_add": not bool(discrepancy),
    })


@router.post("/vault/add-medication")
async def vault_add_medication(
    user_email:  str = Form(...),
    pin:         str = Form(""),
    name:        str = Form(...),
    dose:        str = Form(""),
    frequency:   str = Form(""),
    prescriber:  str = Form(""),
    ndc:         str = Form(""),
    start_date:  str = Form(""),
):
    """Adds a confirmed medication to the vault."""
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await get_or_create_vault(user_id, email_lower, pin)
    med         = new_medication(name, dose, frequency, prescriber, ndc, start_date)
    vault["medications"].append(med)
    await save_vault(user_id, email_lower, vault, pin)
    logger.info(f"💊 Medication added: {name} for {user_id[:8]}")
    return JSONResponse({"success": True, "medication_id": med["id"], "medication": med})


@router.post("/vault/add-question")
async def vault_add_question(
    user_email: str = Form(...),
    pin:        str = Form(""),
    question:   str = Form(...),
    context:    str = Form(""),
):
    """Saves a question the user wants to ask their doctor."""
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await get_or_create_vault(user_id, email_lower, pin)
    q           = new_doctor_question(question, context)
    vault["questions"].append(q)
    await save_vault(user_id, email_lower, vault, pin)
    return JSONResponse({"success": True, "question_id": q["id"]})


@router.post("/vault/get-summary")
async def vault_get_summary(
    user_email: str = Form(...),
    pin:        str = Form(""),
    persona:    str = Form("doctor"),
):
    """
    Returns vault summary visible to this persona (respects silo access).
    Used to inject context into persona system prompts.
    """
    if not MED_VAULT_ENABLED:
        return JSONResponse({"summary": None})
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await load_vault(user_id, email_lower, pin)
    if not vault:
        return JSONResponse({"summary": None})

    # Build summary filtered by persona access
    summary = {}
    if persona_can_read(persona, "medical"):
        summary["medications"]  = vault.get("medications", [])
        summary["symptoms"]     = vault.get("symptoms", [])[-10:]  # last 10
        summary["reactions"]    = vault.get("reactions", [])
        summary["allergies"]    = vault.get("allergies", [])
        summary["questions"]    = [q for q in vault.get("questions",[]) if not q.get("answered")]

    return JSONResponse({"summary": summary})


@router.post("/vault/generate-pdf")
async def vault_generate_pdf(
    user_email:    str = Form(...),
    user_name:     str = Form(""),
    pin:           str = Form(""),
    persona:       str = Form("doctor"),
    qr_expiry_min: int = Form(30),
    lang:          str = Form("en"),
):
    """
    Generates and streams the Medical Vault PDF.
    Never saved to disk — streamed directly to user.
    Includes QR ephemeral token (expires in qr_expiry_min minutes).
    """
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)

    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await load_vault(user_id, email_lower, pin)

    if vault is None:
        return JSONResponse({"error": "Vault not found or wrong PIN"}, status_code=403)

    # Drug interaction check
    interactions = await check_drug_interactions(vault.get("medications", []))

    # Generate ephemeral QR token
    summary_for_qr = {
        "medications": len(vault.get("medications",[])),
        "questions":   len([q for q in vault.get("questions",[]) if not q.get("answered")]),
        "interactions": len(interactions),
        "patient":     user_name or "Patient",
    }
    qr_token = generate_ephemeral_token(user_id, summary_for_qr, qr_expiry_min)

    # Generate PDF in memory
    display_name = user_name or email_lower.split("@")[0].capitalize()
    pdf_bytes    = generate_medical_pdf(
        vault         = vault,
        user_name     = display_name,
        persona       = persona,
        interactions  = interactions,
        qr_token      = qr_token,
        qr_expiry_min = qr_expiry_min,
        lang          = lang,
    )

    filename = f"LYLO_Medical_Report_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content      = pdf_bytes,
        media_type   = "application/pdf",
        headers      = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/vault/set-reminders")
async def vault_set_reminders(
    user_email:  str = Form(...),
    pin:         str = Form(""),
    reminders:   str = Form("[]"),  # JSON: [{med_id, med_name, times: ["09:00","21:00"]}]
):
    """
    Saves medication reminder schedule to vault.
    Frontend uses Web Notifications API to fire these — backend stores the schedule.
    Returns saved reminder list.
    """
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await get_or_create_vault(user_id, email_lower, pin)
    try:
        reminder_list = json.loads(reminders)
    except Exception:
        return JSONResponse({"error": "Invalid reminders JSON"}, status_code=400)
    vault["reminders"] = reminder_list
    await save_vault(user_id, email_lower, vault, pin)
    logger.info(f"⏰ Reminders saved: {len(reminder_list)} meds for {user_id[:8]}")
    return JSONResponse({"success": True, "reminders": reminder_list})


@router.post("/vault/smart-reminder-message")
async def vault_smart_reminder(
    user_email: str = Form(...),
    pin:        str = Form(""),
    med_name:   str = Form(...),
    time_label: str = Form(""),
):
    """
    Generates a warm, persona-specific reminder message for a medication.
    Used to make push notifications feel human not robotic.
    """
    messages = [
        f"Time for your {med_name}! 💊 Stay on track — your health is your wealth.",
        f"Hey — don't forget your {med_name}. {time_label or 'Take it now'} and get on with your day. 💪",
        f"Quick check-in: your {med_name} is ready. One step at a time. ✅",
        f"Your {med_name} is waiting. You've got this. 💚",
        f"Reminder: {med_name}. {time_label or 'Now'} is the right time. 🕐",
    ]
    import random
    msg = random.choice(messages)
    return JSONResponse({"message": msg, "med_name": med_name})


@router.post("/vault/update-silo")
async def vault_update_silo(
    user_email: str = Form(...),
    pin:        str = Form(""),
    silo:       str = Form(...),   # "vehicle" | "career" | "financial" | "legal" | "emotional" | "security"
    data:       str = Form("{}"),  # JSON payload
):
    """
    Generic silo updater. Merges data into the specified silo bucket.
    Frontend passes pre-structured JSON — backend merges and saves.
    """
    if not MED_VAULT_ENABLED:
        return JSONResponse({"error": "Vault not available"}, status_code=503)
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    vault       = await get_or_create_vault(user_id, email_lower, pin)

    try:
        payload = json.loads(data)
    except Exception:
        return JSONResponse({"error": "Invalid data JSON"}, status_code=400)

    # Merge based on silo type
    if silo == "vehicle":
        if payload.get("type") == "add_vehicle":
            vault.setdefault("vehicles", []).append(payload["vehicle"])
        else:
            vault.setdefault("vehicles", [])
            if vault["vehicles"]:
                vault["vehicles"][-1].update(payload)
            else:
                vault["vehicles"].append(payload)

    elif silo == "service_history":
        vault.setdefault("service_history", []).append(payload)

    elif silo in ("financial", "career", "legal", "emotional", "security"):
        # Deep merge dict silos
        existing = vault.get(silo, {})
        if isinstance(existing, dict) and isinstance(payload, dict):
            for k, v in payload.items():
                if isinstance(v, list) and isinstance(existing.get(k), list):
                    existing[k] = (existing[k] + v)[-20:]  # cap at 20 entries
                else:
                    existing[k] = v
            vault[silo] = existing
        else:
            vault[silo] = payload

    else:
        return JSONResponse({"error": f"Unknown silo: {silo}"}, status_code=400)

    await save_vault(user_id, email_lower, vault, pin)
    logger.info(f"📦 Silo updated: {silo} for {user_id[:8]}")
    return JSONResponse({"success": True, "silo": silo})


@router.get("/vault/qr/{token}")
async def vault_qr_view(token: str):
    """
    Ephemeral quick-view endpoint for doctor's tablet.
    Single-use, auto-expires. Returns clean HTML dashboard.
    """
    summary = retrieve_ephemeral_token(token)
    if not summary:
        return HTMLResponse(
            "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>"
            "<h2>⏱ This link has expired.</h2>"
            "<p>Links expire after 30 minutes for your security.</p>"
            "<p>Ask your patient to generate a new PDF from the LYLO app.</p>"
            "</body></html>",
            status_code=410
        )

    meds_count    = summary.get("medications", 0)
    q_count       = summary.get("questions", 0)
    interact_count= summary.get("interactions", 0)
    patient       = summary.get("patient", "Patient")

    alert_html = (
        f'<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;'
        f'padding:16px;margin:12px 0">'
        f'<b style="color:#dc2626">⚡ {interact_count} Drug Interaction Alert(s)</b><br>'
        f'<span style="color:#666">Review full PDF for details.</span></div>'
    ) if interact_count else ""

    return HTMLResponse(f"""
    <html>
    <head><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>LYLO Quick View</title></head>
    <body style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb">
      <div style="background:#22c55e;color:white;padding:20px;border-radius:12px;margin-bottom:20px">
        <div style="font-size:11px;letter-spacing:2px;opacity:0.8">LYLO OS — QUICK VIEW</div>
        <div style="font-size:22px;font-weight:900;margin-top:4px">{patient}</div>
        <div style="font-size:11px;opacity:0.7;margin-top:2px">Verified Medical Summary</div>
      </div>
      {alert_html}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0">
        <div style="background:white;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
          <div style="font-size:28px;font-weight:900;color:#22c55e">{meds_count}</div>
          <div style="font-size:11px;color:#666;margin-top:4px">💊 Medications</div>
        </div>
        <div style="background:white;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
          <div style="font-size:28px;font-weight:900;color:#3b82f6">{q_count}</div>
          <div style="font-size:11px;color:#666;margin-top:4px">❓ Questions</div>
        </div>
        <div style="background:white;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
          <div style="font-size:28px;font-weight:900;color:#{'dc2626' if interact_count else '6b7280'}">{interact_count}</div>
          <div style="font-size:11px;color:#666;margin-top:4px">⚡ Alerts</div>
        </div>
      </div>
      <div style="background:#fef9c3;border:1px solid #eab308;border-radius:8px;padding:14px;font-size:12px;color:#78350f;margin-top:16px">
        <b>AI-Generated Summary.</b> For clinical review only. Not a medical diagnosis.
        Always consult the patient directly before making clinical decisions.
      </div>
      <div style="text-align:center;color:#9ca3af;font-size:11px;margin-top:20px">
        Generated by LYLO OS · This link has now expired for security.
      </div>
    </body></html>
    """)
