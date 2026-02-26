"""
LYLO OS — routers/session_router.py
Endpoints: /send-session-report, /health, /ui-strings, /obd2, /
"""
import logging
from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse, HTMLResponse
from services.config import create_user_id, ELITE_USERS
from services.pdf_mailer import send_mission_report_email

logger = logging.getLogger("LYLO.Session")
router = APIRouter()

@router.get("/ui-strings")
async def get_ui_strings(lang: str = "en"):
    """Returns UI strings in the requested language (en or es)."""
    lang_clean = lang.lower().strip()[:2]
    strings    = _UI_STRINGS.get(lang_clean, _UI_STRINGS["en"])
    return JSONResponse({"lang": lang_clean, "strings": strings})


@router.post("/send-session-report")
async def send_session_report(
    user_email: str = Form(...),
    persona:    str = Form("guardian"),
    content:    str = Form(...),
    user_name:  str = Form("Protected User"),
):
    """
    Called when user taps 'End Session' and confirms they want the PDF.
    This is the ONLY place PDFs are dispatched for regular chat sessions.
    Emergency protocols do NOT auto-send — they wait for this too.
    """
    if not content.strip():
        return JSONResponse({"status": "skipped", "reason": "no content"})
    try:
        await send_mission_report_email(
            to_email     = user_email.lower().strip(),
            content      = content,
            persona_name = persona,
            user_name    = user_name,
        )
        logger.info(f"📄 Session report sent → {user_email} [{persona}]")
        return JSONResponse({"status": "sent"})
    except Exception as e:
        logger.error(f"Session report send failed: {e}")
        return JSONResponse({"status": "error", "reason": str(e)}, status_code=500)


@router.get("/health")
async def health_check():
    """Render uptime monitoring + quick system status."""
    return {
        "status":   "healthy",
        "version":  "31.0.0",
        "engines": {
            "openai":  bool(openai_client),
            "gemini":  bool(gemini_client),
            "claude":  bool(claude_client),
        },
        "beta_slots_filled": sum(1 for e, d in ELITE_USERS.items() if d.get("beta") and "placeholder.com" not in e),
        "waitlist_count":    len(WAITLIST_DB),
    }


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



# =============================================================================
