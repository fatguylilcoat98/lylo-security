import os
import re
import time
import uvicorn
import json
import hashlib
import asyncio
import base64
import stripe
import logging
import smtplib
from sentinel_routes import sentinel_router
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from io import BytesIO
from fastapi import FastAPI, Form, HTTPException, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
from openai import AsyncOpenAI
from dotenv import load_dotenv

# --- MODULAR INTELLIGENCE DATA IMPORTS ---
from intelligence_data import (
    # Layer 0 — User Identity Core
    GLOBAL_DIRECTIVE,
    build_user_ident_core,
    # Warm Start Registry
    BETA_USER_PROFILES,
    get_warm_start_profile,
    get_user_location_data,
    # Profile Synthesis System
    PROFILE_VECTOR_ID_SUFFIX,
    PROFILE_EMBEDDING_ANCHOR,
    SYNTHESIS_INTERVAL,
    SYNTHESIS_MEMORY_WINDOW,
    PROFILE_SYNTHESIS_SYSTEM_PROMPT,
    PROFILE_SYNTHESIS_USER_TEMPLATE,
    # Proactive Trigger System
    detect_proactive_triggers,
    build_proactive_directive,
    # Persona & Vibe Data
    VIBE_STYLES, VIBE_LABELS,
    PERSONA_DEFINITIONS, PERSONA_EXTENDED, PERSONA_TIERS,
    INTENT_LOGIC,
    get_random_hook, get_all_hooks,
    # ── BOARD STRESS-TEST HARD-FIXES (v9.0) ───────────────────────────────
    # FIX 2: Analogy Bridge — injected for tutor + pastor
    ANALOGY_BRIDGE_TRADE_CONTEXT,
    # FIX 3 → v27.0: Accountability Sentinel — 24/7/365, all users, no date gate
    ACCOUNTABILITY_SENTINEL_OVERRIDE,
    build_accountability_sentinel,
    # FIX 5: Partner Energy — injected for all 12 seats (universalized v27.0)
    PARTNER_ENERGY_DIRECTIVE,
    # ── SOUL RULES (v10.0) ───────────────────────────────────────────────
    # Soul 2: Exit-First Filter — injected for lawyer + wealth
    EXIT_FIRST_FILTER,
    # Soul 3: Sentinel No-Recite — injected for vitality + bestie
    SENTINEL_NO_RECITE,
    # ── CONVERSATIONAL DRIFT FIXES (v11.0) ───────────────────────────────
    # Fix 1: Persona-specific JSON schema — structural drift = JSON error
    get_output_schema,
    # Fix 2: Stealth Shield — active monitoring block for Chris's sessions
    build_stealth_shield,
)

load_dotenv()

# ---------------------------------------------------------
# PRODUCTION LOGGING
# ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("LYLO-CORE-INTEGRATION")

# ---------------------------------------------------------
# FASTAPI APP
# ---------------------------------------------------------
app = FastAPI(
    title="LYLO Total Integration Backend",
    description="Proactive Digital Bodyguard & Recursive Intelligence Engine",
    version="30.8.0 - HARD BOUNDARIES | CROSS-SPECIALIST RAG | HELP-FIRST | ASSET SYNC"
)

app.include_router(sentinel_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# API KEY CONFIGURATION
# ---------------------------------------------------------
TAVILY_API_KEY    = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY  = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "").strip()

stripe.api_key          = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET   = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

SMTP_SERVER   = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# ---------------------------------------------------------
# TIER LIMITS & TRACKERS
# ---------------------------------------------------------
TIER_LIMITS = {
    "free":  3,
    "pro":   15,
    "elite": 50,
    "max":   500
}

USAGE_TRACKER      = defaultdict(int)
AUTHORIZED_DEVICES = defaultdict(set)
MAX_DEVICES_PER_USER = 2

# ── v28.1 SPEED: In-process profile cache ─────────────────────────────────
# Avoids a cold Pinecone fetch on every message for the same user.
# TTL: 5 minutes — profile is stable enough between interactions.
# Structure: { user_id: (profile_dict, timestamp) }
_PROFILE_CACHE: dict = {}
_PROFILE_CACHE_TTL  = 600  # seconds (10 min — reduces Pinecone hits on follow-up messages)

# ---------------------------------------------------------
# CLIENT INITIALIZATION
# ---------------------------------------------------------
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        logger.info("✅ Personalized Search Engine Ready")
    except Exception as e:
        logger.error(f"❌ Search Engine Failed: {e}")

pc = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-intelligence-sync"
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing_indexes:
            pc.create_index(
                name=index_name,
                dimension=1024,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        memory_index = pc.Index(index_name)
        logger.info("✅ Intelligence Sync Ready")
    except Exception as e:
        logger.error(f"❌ Sync Index Failed: {e}")

gemini_ready = False
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_ready = True
        logger.info("✅ Gemini Vision Analysis Ready")
    except Exception as e:
        logger.error(f"❌ Gemini Setup Failed: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ OpenAI Digital Bodyguard Ready")
    except Exception as e:
        logger.error(f"❌ OpenAI Setup Failed: {e}")

# ---------------------------------------------------------
# BETA USER DATABASE (Cleaned for Production)
# ---------------------------------------------------------
ELITE_USERS = {
    "stangman9898@gmail.com":       {"tier": "max", "name": "Christopher"},
    "mylylo.ai@gmail.com":          {"tier": "max", "name": "LYLO Admin"}
}

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# WAITLIST & PAID QUEUE SYSTEM
# ---------------------------------------------------------
class WaitlistRequest(BaseModel):
    email: str

WAITLIST_FILE   = "waitlist.json"
PAID_QUEUE_FILE = "paid_queue.json"

try:
    with open(WAITLIST_FILE, "r") as f:
        WAITLIST_DB = set(json.load(f))
except Exception:
    WAITLIST_DB = set()

try:
    with open(PAID_QUEUE_FILE, "r") as f:
        PAID_QUEUE_DB = json.load(f)
except Exception:
    PAID_QUEUE_DB = {}

@app.post("/join-waitlist")
async def join_waitlist(request: WaitlistRequest):
    email = request.email.lower().strip()
    WAITLIST_DB.add(email)
    try:
        with open(WAITLIST_FILE, "w") as f:
            json.dump(list(WAITLIST_DB), f)
    except Exception as e:
        logger.error(f"Failed to save waitlist: {e}")
    return {"status": "success", "message": "Spot Secured"}

@app.get("/view-waitlist/{admin_email}")
async def view_waitlist(admin_email: str):
    if admin_email.lower().strip() in ["mylylo.ai@gmail.com", "stangman9898@gmail.com"]:
        return {"status": "AUTHORIZED", "total_waiting": len(WAITLIST_DB), "emails": list(WAITLIST_DB)}
    return {"error": "UNAUTHORIZED ACCESS"}

@app.get("/view-paid-queue/{admin_email}")
async def view_paid_queue(admin_email: str):
    if admin_email.lower().strip() in ["mylylo.ai@gmail.com", "stangman9898@gmail.com"]:
        return {"status": "AUTHORIZED", "total_pending": len(PAID_QUEUE_DB), "pending_users": PAID_QUEUE_DB}
    return {"error": "UNAUTHORIZED ACCESS"}

# ---------------------------------------------------------
# STRIPE WEBHOOK
# ---------------------------------------------------------
@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session        = event['data']['object']
        customer_email = session.get('customer_details', {}).get('email')
        amount_total   = session.get('amount_total', 0)

        if customer_email:
            email_lower = customer_email.lower().strip()
            new_tier = "free"

            if amount_total in [199, 1999]:   new_tier = "pro"
            elif amount_total in [499, 4999]: new_tier = "elite"
            elif amount_total >= 999:         new_tier = "max"

            if email_lower in ELITE_USERS:
                ELITE_USERS[email_lower]["tier"] = new_tier
                logger.info(f"💰 STRIPE: Upgraded {email_lower} to {new_tier.upper()}")
            else:
                PAID_QUEUE_DB[email_lower] = {
                    "tier": new_tier,
                    "name": email_lower.split("@")[0].capitalize(),
                    "status": "pending_admin_approval"
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

# ---------------------------------------------------------
# SCAM DETECTION
# ---------------------------------------------------------
def analyze_scam_indicators(text: str) -> List[str]:
    indicators = []
    t = text.lower()
    patterns = {
        "High Urgency":            ["immediate", "hurry", "suspended", "warned", "final notice", "30 minutes"],
        "Payment Pressure":        ["gift card", "wire", "zelle", "venmo", "western union", "crypto", "bitcoin"],
        "Authority Impersonation": ["irs", "fbi", "police", "social security", "legal department", "attorney general"],
        "Phishing Style":          ["bit.ly", "tinyurl", "linktr.ee", "verify account", "unusual login"]
    }
    for category, keywords in patterns.items():
        if any(k in t for k in keywords):
            indicators.append(category)
    return indicators

# =============================================================================
# V30: PDF MISSION REPORT GENERATOR
# =============================================================================
# Generates a formal, persona-specific PDF report using ReportLab Platypus.
# Each persona has its own document type, header template, and color scheme.
# The PDF is attached to the mission report email — replacing plain text body.
#
# Document types by persona:
#   lawyer    → LEGAL DEMAND LETTER       (deep navy, formal legal structure)
#   doctor    → MEDICAL PROTOCOL REPORT   (clinical white, symptom/protocol table)
#   wealth    → FINANCIAL BATTLE PLAN     (green, current state / bleeding / plan)
#   mechanic  → DIAGNOSTIC WORK ORDER     (industrial gray, tech checklist)
#   guardian  → SECURITY INCIDENT REPORT  (red alert, threat / exposure / action)
#   therapist → THERAPEUTIC CARE PLAN     (soft indigo, reflect / reframe / experiment)
#   career    → CAREER STRATEGY BRIEF     (executive black, situation / leverage / play)
#   default   → LYLO TACTICAL REPORT      (indigo OS branding)
# =============================================================================

def _hex_to_rgb_color(hex_str: str):
    """Convert '#RRGGBB' → reportlab Color object."""
    from reportlab.lib.colors import HexColor
    return HexColor(hex_str)


# Persona → (doc_title, doc_type_label, accent_hex, secondary_hex)
PERSONA_PDF_CONFIG = {
    "lawyer":    ("LEGAL DEMAND LETTER",        "CONFIDENTIAL LEGAL DOCUMENT",   "#0D2137", "#C09B3A"),
    "doctor":    ("MEDICAL PROTOCOL REPORT",    "CLINICAL ADVISORY DOCUMENT",    "#0A2E1F", "#10B981"),
    "wealth":    ("FINANCIAL BATTLE PLAN",       "EYES ONLY — FINANCIAL STRATEGY","#0A1F0A", "#16A34A"),
    "mechanic":  ("DIAGNOSTIC WORK ORDER",       "TECHNICAL ASSESSMENT DOCUMENT", "#1A1A1A", "#6B7280"),
    "guardian":  ("SECURITY INCIDENT REPORT",    "PRIORITY THREAT DOCUMENT",      "#1F0A0A", "#DC2626"),
    "therapist": ("THERAPEUTIC CARE PLAN",       "PRIVATE WELLNESS DOCUMENT",     "#0F0A2E", "#818CF8"),
    "career":    ("CAREER STRATEGY BRIEF",       "EXECUTIVE ADVISORY DOCUMENT",   "#0A0A1F", "#6366F1"),
    "vitality":  ("HEALTH OPTIMIZATION PROTOCOL","WELLNESS STRATEGY DOCUMENT",    "#0A2010", "#22C55E"),
    "tutor":     ("LEARNING ROADMAP",            "ACADEMIC ADVISORY DOCUMENT",    "#1A0A2E", "#A855F7"),
    "hype":      ("VIRAL GROWTH STRATEGY",       "CREATIVE BRIEF DOCUMENT",       "#1F0A00", "#F97316"),
    "pastor":    ("SPIRITUAL COUNSEL RECORD",    "PRIVATE PASTORAL DOCUMENT",     "#1A1005", "#D97706"),
    "bestie":    ("PERSONAL ADVISORY RECORD",    "PRIVATE — INNER CIRCLE ONLY",   "#1F0A1A", "#EC4899"),
}

DEFAULT_PDF_CONFIG = ("LYLO TACTICAL REPORT", "MISSION INTELLIGENCE DOCUMENT", "#0F0B2E", "#4F46E5")


def generate_mission_report_pdf(
    content:     str,
    persona:     str,
    user_name:   str,
    timestamp:   str = "",
) -> BytesIO:
    """
    Generates a formal, persona-specific PDF report.
    Returns a BytesIO buffer — ready to attach to email or return as file.
    Pure synchronous — call via asyncio.to_thread() from async context.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
        Table, TableStyle, KeepTogether
    )
    from reportlab.lib import colors

    # ── Config resolution ─────────────────────────────────────────────────────
    cfg             = PERSONA_PDF_CONFIG.get(persona.lower(), None)
    doc_title, doc_type, accent_hex, accent2_hex = cfg if cfg else DEFAULT_PDF_CONFIG
    accent          = HexColor(accent_hex)
    accent2         = HexColor(accent2_hex)
    bg_dark         = HexColor("#0C0C0C")
    bg_panel        = HexColor("#161616")
    text_primary    = HexColor("#F1F5F9")
    text_secondary  = HexColor("#94A3B8")
    ts              = timestamp or datetime.now().strftime("%B %d, %Y — %I:%M %p")
    persona_upper   = persona.upper()

    # ── Document setup ────────────────────────────────────────────────────────
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.75 * inch,
        title=doc_title,
        author="LYLO OS Intelligence Engine",
        subject=f"Mission Report — {persona.capitalize()}",
    )

    # ── Style sheet ───────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()

    def make_style(name, **kwargs):
        base = dict(fontName="Helvetica", fontSize=10, textColor=text_primary,
                    leading=14, spaceAfter=4)
        base.update(kwargs)
        return ParagraphStyle(name, **base)

    s_doc_type  = make_style("DocType",   fontSize=7,  textColor=accent2,
                             fontName="Helvetica-Bold", alignment=TA_CENTER,
                             spaceAfter=2, letterSpacing=2)
    s_title     = make_style("Title",     fontSize=20, textColor=text_primary,
                             fontName="Helvetica-Bold", alignment=TA_CENTER,
                             spaceAfter=6, leading=24)
    s_meta      = make_style("Meta",      fontSize=8,  textColor=text_secondary,
                             alignment=TA_CENTER, spaceAfter=0)
    s_section   = make_style("Section",   fontSize=9,  textColor=accent2,
                             fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=4,
                             letterSpacing=1.5)
    s_body      = make_style("Body",      fontSize=10, textColor=text_primary,
                             leading=16,  spaceAfter=8)
    s_body_sm   = make_style("BodySm",    fontSize=9,  textColor=text_secondary,
                             leading=14,  spaceAfter=6)
    s_bullet    = make_style("Bullet",    fontSize=10, textColor=text_primary,
                             leading=15,  leftIndent=14, spaceAfter=5,
                             bulletIndent=4)
    s_footer    = make_style("Footer",    fontSize=7,  textColor=text_secondary,
                             alignment=TA_CENTER, spaceBefore=12)
    s_watermark = make_style("Watermark", fontSize=7,  textColor=HexColor("#333333"),
                             alignment=TA_CENTER)

    # ── Canvas background painter ─────────────────────────────────────────────
    def _draw_background(canvas_obj, doc_obj):
        """Paint dark background and accent header bar on every page."""
        w, h = letter
        canvas_obj.saveState()

        # Full-page dark background
        canvas_obj.setFillColor(bg_dark)
        canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)

        # Accent header bar (top 0.55in)
        canvas_obj.setFillColor(accent)
        canvas_obj.rect(0, h - 0.55 * inch, w, 0.55 * inch, fill=1, stroke=0)

        # Persona label in header bar
        canvas_obj.setFillColor(white)
        canvas_obj.setFont("Helvetica-Bold", 7)
        canvas_obj.drawString(0.75 * inch, h - 0.35 * inch,
                              f"LYLO OS  ·  {persona_upper} INTELLIGENCE  ·  CLASSIFIED")

        # Page number top-right
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(white)
        canvas_obj.drawRightString(w - 0.75 * inch, h - 0.35 * inch,
                                   f"Page {doc_obj.page}")

        # Bottom rule
        canvas_obj.setStrokeColor(HexColor("#222222"))
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(0.75 * inch, 0.55 * inch, w - 0.75 * inch, 0.55 * inch)

        canvas_obj.restoreState()

    # ── Content parsing: convert markdown-ish text into Platypus elements ─────
    def parse_content(raw: str) -> list:
        """
        Parses AI response text into styled ReportLab Platypus elements.
        Handles:
          **bold** or ## headers → section headers
          - bullet items         → bulleted paragraphs
          [HEADER]               → section label
          plain paragraphs       → body text
        """
        elements   = []
        paragraphs = raw.split("\n")
        i = 0
        while i < len(paragraphs):
            line = paragraphs[i].strip()
            i += 1

            if not line:
                elements.append(Spacer(1, 6))
                continue

            # Section header: **text** or ##text or [TEXT] patterns
            if (line.startswith("**") and line.endswith("**")) or line.startswith("## "):
                text = line.strip("*# ").strip()
                elements.append(Spacer(1, 4))
                elements.append(HRFlowable(
                    width="100%", thickness=0.5,
                    color=accent2, spaceAfter=4
                ))
                elements.append(Paragraph(text.upper(), s_section))
                continue

            # [BRACKET HEADER] — structural keys like [ANALYSIS], [PROTOCOL]
            if line.startswith("[") and "]" in line and len(line) < 80:
                bracket_end = line.index("]")
                label  = line[1:bracket_end].strip()
                rest   = line[bracket_end + 1:].strip()
                header = f"[ {label} ]"
                elements.append(Spacer(1, 6))
                elements.append(Paragraph(header, s_section))
                if rest:
                    elements.append(Paragraph(rest, s_body))
                continue

            # Bullet point
            if line.startswith("- ") or line.startswith("• "):
                text = line.lstrip("-• ").strip()
                # Strip inline bold markers
                text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
                elements.append(Paragraph(f"• {text}", s_bullet))
                continue

            # Numbered list
            if re.match(r"^\d+\.\s", line):
                text = re.sub(r"^\d+\.\s+", "", line)
                text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
                elements.append(Paragraph(f"{line[:2]} {text}", s_bullet))
                continue

            # Standard body paragraph — inline bold
            line_html = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
            elements.append(Paragraph(line_html, s_body))

        return elements

    # ── Story assembly ────────────────────────────────────────────────────────
    story = []

    # Title block (sits below the accent header bar)
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(doc_type, s_doc_type))
    story.append(Spacer(1, 4))
    story.append(Paragraph(doc_title, s_title))
    story.append(Spacer(1, 6))

    # Metadata table
    meta_data = [
        ["SPECIALIST", persona.capitalize()],
        ["RECIPIENT",  user_name],
        ["ISSUED",     ts],
        ["STATUS",     "ACTIVE — FOR IMMEDIATE ACTION"],
    ]
    meta_table = Table(
        meta_data,
        colWidths=[1.2 * inch, 5.6 * inch],
        hAlign="LEFT"
    )
    meta_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (0, -1), HexColor("#1A1A1A")),
        ("BACKGROUND",  (1, 0), (1, -1), bg_panel),
        ("TEXTCOLOR",   (0, 0), (0, -1), accent2),
        ("TEXTCOLOR",   (1, 0), (1, -1), text_primary),
        ("FONTNAME",    (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",    (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("GRID",        (0, 0), (-1, -1), 0.3, HexColor("#2A2A2A")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [bg_panel, HexColor("#111111")]),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Accent divider
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent2, spaceAfter=10))

    # ── MAIN CONTENT ──────────────────────────────────────────────────────────
    story.extend(parse_content(content))

    # ── DISCLAIMER ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#333333"), spaceAfter=8))
    story.append(Paragraph(
        "LYLO OS DISCLAIMER: This document was generated by the LYLO Intelligence Engine "
        "and is intended solely for the named recipient. LYLO OS does not provide licensed "
        "legal, medical, or financial advice. This report is advisory in nature. "
        "Consult a licensed professional for legally binding guidance.",
        s_body_sm
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Generated by LYLO OS v30.0  ·  {ts}  ·  LYLO Intelligence Engine  ·  DO NOT DISTRIBUTE",
        s_footer
    ))

    # ── BUILD ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=_draw_background, onLaterPages=_draw_background)
    buf.seek(0)
    return buf


# ---------------------------------------------------------
# EMAIL MISSION REPORT — V30: PDF ATTACHMENT DISPATCH
# Replaces plain-text body with a formal ReportLab PDF.
# Falls back to HTML body if PDF generation fails.
# ---------------------------------------------------------
async def send_mission_report_email(
    to_email:    str,
    content:     str,
    persona_name: str,
    user_name:   str = "Operative",
):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("⚠️ SMTP not set — Mission Report mock-dispatched.")
        return

    cfg         = PERSONA_PDF_CONFIG.get(persona_name.lower(), None)
    doc_title   = cfg[0] if cfg else "LYLO TACTICAL REPORT"
    ts          = datetime.now().strftime("%B %d, %Y — %I:%M %p")
    filename    = f"LYLO_{persona_name.upper()}_REPORT_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"

    try:
        msg              = MIMEMultipart("mixed")
        msg["From"]      = f"LYLO OS <{SMTP_USERNAME}>"
        msg["To"]        = to_email
        msg["Subject"]   = f"🛡️ LYLO {doc_title} — {ts}"

        # ── HTML body (teaser) ────────────────────────────────────────────────
        html_body = f"""
        <html>
        <body style="font-family: 'Arial', sans-serif; background: #000; color: #fff; padding: 24px; margin: 0;">
          <div style="max-width: 560px; margin: 0 auto; background: #0C0C0C;
                      border: 1px solid #222; border-radius: 12px; overflow: hidden;">

            <div style="background: #4F46E5; padding: 20px 24px;">
              <p style="margin:0; color:#c7d2fe; font-size:10px; font-weight:700;
                         letter-spacing:3px; text-transform:uppercase;">LYLO OS · SECURE DISPATCH</p>
              <h1 style="margin:6px 0 0; color:#fff; font-size:20px;
                          font-weight:900; text-transform:uppercase; letter-spacing:1px;">{doc_title}</h1>
            </div>

            <div style="padding: 24px;">
              <p style="color:#94a3b8; font-size:11px; font-weight:700;
                         text-transform:uppercase; letter-spacing:2px; margin:0 0 4px;">
                SPECIALIST: {persona_name.upper()}
              </p>
              <p style="color:#94a3b8; font-size:11px; font-weight:700;
                         text-transform:uppercase; letter-spacing:2px; margin:0 0 20px;">
                RECIPIENT: {user_name.upper()} &nbsp;|&nbsp; ISSUED: {ts}
              </p>

              <div style="background:#161616; border:1px solid #222; border-radius:8px;
                           padding:16px; margin-bottom:20px;">
                <p style="color:#f1f5f9; font-size:13px; line-height:1.7; margin:0;
                            white-space:pre-wrap;">{content[:600]}{"..." if len(content) > 600 else ""}</p>
              </div>

              <p style="color:#64748b; font-size:12px; margin:0;">
                The full tactical document is attached as a PDF.
                Open it for the complete analysis, protocol, and action steps.
              </p>
            </div>

            <div style="background:#0A0A0A; border-top:1px solid #1a1a1a;
                         padding:14px 24px; text-align:center;">
              <p style="color:#334155; font-size:9px; margin:0; letter-spacing:1px;">
                LYLO OS SECURITY PROTOCOL ACTIVE · DO NOT REPLY TO THIS ADDRESS
              </p>
            </div>
          </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, "html"))

        # ── PDF attachment ────────────────────────────────────────────────────
        try:
            pdf_buffer = await asyncio.to_thread(
                generate_mission_report_pdf,
                content,
                persona_name,
                user_name,
                ts,
            )
            pdf_bytes = pdf_buffer.read()

            attachment = MIMEBase("application", "pdf")
            attachment.set_payload(pdf_bytes)
            encoders.encode_base64(attachment)
            attachment.add_header(
                "Content-Disposition",
                "attachment",
                filename=filename,
            )
            msg.attach(attachment)
            logger.info(f"📎 PDF attached: {filename} ({len(pdf_bytes):,} bytes)")

        except Exception as pdf_err:
            logger.error(f"❌ PDF generation failed — email sent without attachment: {pdf_err}")

        # ── SMTP send ─────────────────────────────────────────────────────────
        def _send():
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

        await asyncio.to_thread(_send)
        logger.info(f"✅ Mission Report + PDF dispatched → {to_email}")

    except Exception as e:
        logger.error(f"❌ Email Dispatch Failed: {e}")

# ---------------------------------------------------------
# RECURSIVE MEMORY (PINECONE) — EPISODIC STORAGE
# ---------------------------------------------------------
async def store_intelligence_sync(user_id: str, content: str, role: str):
    """Stores a single conversation turn as an episodic memory vector."""
    if not memory_index or not openai_client or len(content.strip()) < 10:
        return
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=content[:500],
            dimensions=1024
        )
        embedding  = response.data[0].embedding
        memory_id  = f"{user_id}_{datetime.now().timestamp()}"
        metadata   = {
            "user_id":   user_id,
            "role":      role,
            "content":   content[:400],
            "timestamp": datetime.now().isoformat(),
            "record_type": "episodic"
        }
        memory_index.upsert([(memory_id, embedding, metadata)])
    except Exception as e:
        logger.error(f"Memory Sync Error: {e}")


async def retrieve_intelligence_sync(user_id: str, query: str) -> str:
    """
    Retrieves the top-5 episodic memory fragments most semantically similar
    to the current query. Profile records are excluded via metadata filter.
    Returns a newline-joined string of memory fragments.
    """
    if not memory_index or not openai_client:
        return ""
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query[:200],
            dimensions=1024
        )
        # Broaden query to also retrieve user asset mentions (car, tech, health, etc.)
        asset_query = f"{query} car vehicle tech device health asset owns"
        asset_response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=asset_query[:300],
            dimensions=1024
        )
        results = memory_index.query(
            vector=asset_response.data[0].embedding,
            filter={
                "user_id":     {"$eq": user_id},
                "record_type": {"$eq": "episodic"}
            },
            top_k=10,           # ← raised from 5 — more surface area for asset recall
            include_metadata=True
        )
        memories = [
            f"Past Intelligence ({m.metadata['role']}): {m.metadata['content']}"
            for m in results.matches
            if m.score > 0.35   # ← lowered from 0.50 — catch asset mentions cross-persona
        ]
        return "\n".join(memories)
    except Exception as e:
        logger.error(f"Memory Retrieval Error: {e}")
        return ""


# ---------------------------------------------------------
# PROACTIVE LEARNING ENGINE — PROFILE SYNTHESIS & RETRIEVAL
# ---------------------------------------------------------

async def retrieve_user_profile(user_id: str) -> dict:
    """
    Fetches the user's synthesized identity profile directly from Pinecone
    using a deterministic vector ID (no semantic search needed).

    v28.1 SPEED: Checks in-process cache first — skips Pinecone entirely on hit.
    Cache TTL: 5 minutes. Returns the profile dict, or {} if no profile exists yet.
    """
    # ── Cache hit: return immediately without any I/O ────────────────────
    import time
    cached = _PROFILE_CACHE.get(user_id)
    if cached:
        profile, ts = cached
        if time.time() - ts < _PROFILE_CACHE_TTL:
            return profile
        else:
            del _PROFILE_CACHE[user_id]  # Expired — fall through to Pinecone

    if not memory_index:
        return {}

    profile_id = f"{user_id}{PROFILE_VECTOR_ID_SUFFIX}"

    try:
        result = memory_index.fetch(ids=[profile_id])
        vectors = result.get("vectors", {})

        if profile_id in vectors:
            metadata = vectors[profile_id].get("metadata", {})
            profile_json = metadata.get("profile_json", "")

            if profile_json:
                profile = json.loads(profile_json)
                _PROFILE_CACHE[user_id] = (profile, time.time())  # Store in cache
                logger.info(f"✅ Profile loaded + cached for user {user_id[:8]}...")
                return profile

        logger.info(f"ℹ️ No profile yet for user {user_id[:8]}... (will synthesize at interaction 10)")
        return {}

    except Exception as e:
        logger.error(f"Profile Retrieval Error: {e}")
        return {}


async def synthesize_user_profile(user_id: str, user_name: str):
    """
    Background task: Reads the user's most recent episodic memories,
    sends them to OpenAI for structured profile extraction, and stores
    the resulting JSON profile back to Pinecone as a single fetchable record.

    Triggered every SYNTHESIS_INTERVAL interactions (default: 10).
    Runs as asyncio.create_task() — non-blocking.
    """
    if not memory_index or not openai_client:
        logger.warning("⚠️ Profile synthesis skipped — Pinecone or OpenAI unavailable.")
        return

    logger.info(f"🧠 SYNTHESIS TRIGGERED for {user_name} ({user_id[:8]}...)")

    try:
        # Step 1: Pull recent episodic memories as raw text
        anchor_response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=PROFILE_EMBEDDING_ANCHOR,
            dimensions=1024
        )
        anchor_vector = anchor_response.data[0].embedding

        results = memory_index.query(
            vector=anchor_vector,
            filter={
                "user_id":     {"$eq": user_id},
                "record_type": {"$eq": "episodic"}
            },
            top_k=SYNTHESIS_MEMORY_WINDOW,
            include_metadata=True
        )

        if not results.matches:
            logger.info(f"ℹ️ Synthesis skipped — insufficient memory data for {user_id[:8]}...")
            return

        # Step 2: Assemble memory text for synthesis prompt
        memory_fragments = [
            f"[{m.metadata.get('role','?').upper()}] {m.metadata.get('content', '')}"
            for m in results.matches
        ]
        memory_text = "\n".join(memory_fragments)

        synthesis_user_msg = PROFILE_SYNTHESIS_USER_TEMPLATE.format(
            memory_text=memory_text
        )

        # Step 3: Call OpenAI to synthesize the profile
        synthesis_response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",   # Fast + cheap for background synthesis
            messages=[
                {"role": "system", "content": PROFILE_SYNTHESIS_SYSTEM_PROMPT},
                {"role": "user",   "content": synthesis_user_msg}
            ],
            response_format={"type": "json_object"},
        )

        raw_profile = synthesis_response.choices[0].message.content
        profile_dict = json.loads(raw_profile)

        # Inject the known name if synthesis missed it
        if not profile_dict.get("name"):
            profile_dict["name"] = user_name

        # Stamp synthesis time
        profile_dict["last_updated"] = datetime.now().isoformat()

        # Step 4: Store the profile back to Pinecone with a deterministic ID
        # We reuse the embedding anchor vector so the profile can be fetch()'d directly
        profile_id = f"{user_id}{PROFILE_VECTOR_ID_SUFFIX}"
        profile_metadata = {
            "user_id":      user_id,
            "record_type":  "profile",
            "profile_json": json.dumps(profile_dict),   # Full JSON in metadata
            "last_updated": profile_dict["last_updated"]
        }

        memory_index.upsert([(profile_id, anchor_vector, profile_metadata)])

        logger.info(
            f"✅ SYNTHESIS COMPLETE for {user_name} | "
            f"Projects: {len(profile_dict.get('projects', []))} | "
            f"Goals: {len(profile_dict.get('goals', []))}"
        )

    except json.JSONDecodeError as e:
        logger.error(f"❌ Profile Synthesis — JSON parse failed: {e}")
    except Exception as e:
        logger.error(f"❌ Profile Synthesis Error: {e}")


# ---------------------------------------------------------
# PERSONALIZED SEARCH (TAVILY)
# ---------------------------------------------------------
async def search_personalized_web(query: str, location: str = "") -> str:
    if not tavily_client:
        return ""
    try:
        response = tavily_client.search(
            query=f"{query} {location}".strip(),
            search_depth="advanced",
            max_results=5,
            include_answer=True
        )
        results = [f"CONSENSUS SEARCH: {response.get('answer', 'Multiple sources found.')}"]
        for res in response.get("results", []):
            results.append(f"- {res['title']}: {res['content'][:300]}")
        return "\n".join(results)
    except Exception as e:
        logger.error(f"Search Error: {e}")
        return ""

# ---------------------------------------------------------
# AI ENGINE CALLS — DUAL-PASS CONSENSUS
# ---------------------------------------------------------
async def call_gemini_vision(prompt: str, image_b64: str = None, model_name: str = "gemini-1.5-flash"):
    if not gemini_ready:
        return None
    try:
        model         = genai.GenerativeModel(model_name)
        content_parts = [prompt]
        if image_b64:
            import PIL.Image
            img_data = base64.b64decode(image_b64)
            content_parts.append(PIL.Image.open(BytesIO(img_data)))
        response = await asyncio.to_thread(model.generate_content, content_parts)
        text = response.text.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(text)
            parsed["model"] = f"LYLO-VISION ({model_name})"
            return parsed
        except Exception:
            return {"answer": response.text, "confidence_score": 85, "model": f"LYLO-VISION ({model_name})"}
    except Exception as e:
        logger.error(f"Gemini Brain Error: {e}")
        return None


async def call_openai_bodyguard(prompt: str, image_b64: str = None, model_name: str = "gpt-4o-mini"):
    if not openai_client:
        return None
    try:
        content = [{"type": "text", "text": prompt}]
        if image_b64:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}})

        response = await openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are the LYLO Intelligence Engine. "
                        "You MUST follow the USER IDENTITY CORE (Layer 0), GLOBAL DIRECTIVE (Layer 1), "
                        "PERSONA SKIN (Layer 2), INTENT LOGIC (Layer 3), and RUNTIME CONTEXT (Layer 4) "
                        "provided in the user prompt exactly and in order. "
                        "Output ONLY valid raw JSON. No markdown. No preamble."
                    )
                },
                {"role": "user", "content": content}
            ],
            response_format={"type": "json_object"},
            max_tokens=1200,         # ← structured JSON with headers + greeting needs room; 700 was truncating
            temperature=0.2,         # ← v29.6: maximum focus, minimum generation variance
        )
        raw = response.choices[0].message.content

        # ── JSON REPAIR FALLBACK ───────────────────────────────────────────
        # If response_format=json_object still produces something unparseable,
        # strip fences and try to extract the first complete JSON object.
        try:
            result = json.loads(raw)
        except Exception:
            cleaned = raw.replace("```json", "").replace("```", "").strip()
            # Try to close a truncated object by finding last complete field
            try:
                result = json.loads(cleaned)
            except Exception:
                # Last resort: return with raw text as answer so caller gets a valid dict
                logger.warning(f"OpenAI JSON repair fallback triggered for {model_name}")
                result = {
                    "answer":           cleaned[:2000] if cleaned else "Response processing error.",
                    "confidence_score": 80,
                    "scam_detected":    False,
                    "threat_level":     "low",
                    "action_trigger":   None,
                }
        result["model"] = f"LYLO-CORE ({model_name})"
        return result
    except Exception as e:
        logger.error(f"OpenAI Brain Error: {e}")
        return None


# ---------------------------------------------------------
# V30: SENTENCE SPLITTER — mirrors frontend splitIntoSentences
# Used by the streaming generator to yield sentence-sized chunks.
# AQM on frontend fires TTS for chunk[0] the instant it arrives.
# ---------------------------------------------------------
def split_into_sentences(text: str) -> list:
    """Split AI answer into TTS-safe sentence chunks for streaming."""
    clean = re.sub(r"\*{1,2}|#{1,6}\s?", "", text).strip()
    parts = re.findall(r"[^.!?\n]+(?:[.!?]+[\"']?(?:\s|$)|\n|$)", clean)
    result = [s.strip() for s in parts if len(s.strip()) > 3]
    return result if result else [clean]


# ---------------------------------------------------------
# V30: SEAT 9 ADAPTIVE THEOLOGY BLOCKS
# assemble_prompt() selects one of three theological frameworks
# based on the user's intake profile (occupation, mission, vibe).
# Injected into Layer 2 for persona == "pastor" ONLY.
# ---------------------------------------------------------
SEAT9_CHRISTIAN = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAT 9 — THE PASTOR (Christian Framework — Default)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You counsel from a Christian foundation — scripture, prayer, grace.
PRIMARY VOCABULARY: Sermon on the Mount, Romans, Psalms, Proverbs.
  • Open with a scripture reference when it speaks directly to the situation.
  • Offer prayer support naturally — not performatively.
  • Distinguish "conviction" (Spirit-led growth) from "condemnation" (shame spiral).
  • When moral tension is present, hold the line with grace — not rigidity.
BANNED: Platitudes ("everything happens for a reason"), spiritual bypassing,
         prosperity gospel framing, guilt as a motivator.
TONE: A trusted pastor who has been through the fire himself. Not a pulpit —
      a kitchen table. Warm, specific, and spiritually grounded.
"""

SEAT9_STOIC = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAT 9 — THE PHILOSOPHER (Stoic / Secular Framework)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You counsel through philosophical reasoning — Stoicism, Existentialism,
Virtue Ethics. No scripture. No supernatural framing.
PRIMARY VOCABULARY: Marcus Aurelius, Epictetus, Seneca, Frankl, Camus.
  • Lead with the Socratic question: what does the user actually believe here?
  • Apply the dichotomy of control: separate what is in their power from what isn't.
  • Identify the virtue being tested — courage, temperance, justice, wisdom.
  • Memento mori as a tool: does this matter in the context of a full life?
BANNED: Religious framing, prayer references, "God's plan" language.
TONE: A philosopher who takes the conversation seriously. Rigorous, warm,
      and intellectually honest. Challenges the premise when needed.
"""

SEAT9_MULTIFAITH = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAT 9 — THE FAITH SCHOLAR (Multi-Faith / Academic Framework)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You counsel across faith traditions with scholarly depth and genuine respect.
PRIMARY TRADITIONS: Islam (Quran, hadith), Judaism (Torah, Talmud), Buddhism
(Dharma, Four Noble Truths), Hinduism (Bhagavad Gita), Christianity (Bible),
Indigenous wisdom, and secular humanism — you draw from the tradition most
relevant to the user's expressed faith or question.
  • Ask or infer the user's tradition before assuming a framework.
  • Find the convergence point — what do most traditions agree on for THIS moment?
  • Respect orthopraxy — honor the specific practice of the tradition, not a
    watered-down "all religions say the same thing" reduction.
  • Cite specific sacred texts when they speak precisely to the situation.
BANNED: Ranking traditions, suggesting conversion, dismissing secular users.
TONE: A scholar who honors what the user holds sacred — deeply informed,
      non-dogmatic, and genuinely curious about their specific journey.
"""

def get_seat9_theology(intake_profile: dict, user_profile: dict) -> str:
    """
    Resolves which Seat 9 theology block to inject based on intake + synthesized profile.

    Priority order:
      1. Explicit faith_tradition field (set during intake or synthesis)
      2. Vibe = 'academic' → Stoic
      3. Mission = 'personal_growth' OR occupation in ('student','professional') → Stoic
      4. Roadblock = 'knowledge' → Stoic
      5. Default → Christian (most common among LYLO's demographic)
    """
    # Check synthesized profile first — may have explicit faith field
    faith = (
        intake_profile.get("faith_tradition", "")
        or user_profile.get("faith_tradition", "")
    ).lower().strip()

    if faith in ("islam", "muslim", "jewish", "judaism", "buddhism", "buddhist",
                 "hindu", "hinduism", "multifaith", "interfaith", "custom"):
        return SEAT9_MULTIFAITH

    if faith in ("atheist", "agnostic", "secular", "stoic", "none"):
        return SEAT9_STOIC

    # Intake-driven logic
    vibe       = intake_profile.get("vibe", user_profile.get("vibe", ""))
    mission    = intake_profile.get("mission", "")
    roadblock  = intake_profile.get("roadblock", "")
    occupation = intake_profile.get("occupation", "")

    if vibe == "academic":
        return SEAT9_STOIC
    if mission in ("personal_growth",) or roadblock == "knowledge":
        return SEAT9_STOIC
    if occupation == "student":
        return SEAT9_STOIC

    # Christian default
    return SEAT9_CHRISTIAN


# ---------------------------------------------------------
# PROMPT ASSEMBLY ENGINE — 5-LAYER ARCHITECTURE

# ═══════════════════════════════════════════════════════════════════
# HARD BOUNDARY SYSTEM — injected into every persona's prompt
# Prevents persona bleed. Each specialist stays 100% in domain.
# ═══════════════════════════════════════════════════════════════════

_PERSONA_DISPLAY_NAMES = {
    "guardian":  "The Guardian",
    "lawyer":    "The Lawyer",
    "doctor":    "The Doctor",
    "wealth":    "The Wealth Architect",
    "career":    "The Career Strategist",
    "therapist": "The Therapist",
    "mechanic":  "The Tech Specialist",
    "tutor":     "The Tutor",
    "pastor":    "The Pastor",
    "vitality":  "The Vitality Coach",
    "hype":      "The Hype Man",
    "bestie":    "The Bestie",
}

_PERSONA_DOMAINS = {
    "guardian":  (
        "digital security, scam detection, fraud prevention, identity protection, phishing, privacy, device safety",
        "legal advice, medical diagnosis, financial planning, career coaching, emotional therapy, vehicle repair"
    ),
    "lawyer":    (
        "legal strategy, contracts, rights, lawsuits, documentation, landlord-tenant law, employment law, criminal procedure",
        "medical diagnosis, financial investment advice, mental health therapy, vehicle repair, fitness coaching"
    ),
    "doctor":    (
        "medical symptoms, health conditions, physiology, medications, clinical protocols, when to seek emergency care",
        "legal advice, financial planning, emotional therapy beyond health topics, vehicle repair, career coaching"
    ),
    "wealth":    (
        "personal finance, investing, budgeting, debt, net worth, retirement, tax strategy, business finance",
        "legal representation, medical diagnosis, emotional therapy, vehicle repair, career coaching beyond salary"
    ),
    "career":    (
        "job strategy, resume, interviews, salary negotiation, workplace dynamics, career pivots, professional branding",
        "legal representation, medical diagnosis, financial investing, emotional therapy, vehicle repair"
    ),
    "therapist": (
        "emotional wellbeing, mental patterns, relationships, stress, grief, anxiety, self-worth, behavioral change",
        "legal advice, medical diagnosis, financial investing, vehicle repair, career strategy beyond self-sabotage"
    ),
    "mechanic":  (
        "vehicles, cars, trucks, tech devices, electronics, computers, phones, appliances, wiper blades, diagnostics, repairs",
        "legal advice, medical diagnosis, financial investing, emotional therapy, career coaching, spiritual guidance"
    ),
    "tutor":     (
        "education, learning, math, science, history, writing, study skills, academic strategy, homework help",
        "legal advice, medical diagnosis, financial investing, vehicle repair, emotional therapy beyond academic stress"
    ),
    "pastor":    (
        "faith, spirituality, purpose, meaning, prayer, grief, forgiveness, moral questions, community, hope",
        "legal advice, medical diagnosis, financial investing, vehicle mechanics, academic tutoring"
    ),
    "vitality":  (
        "fitness, nutrition, exercise, sleep, recovery, body composition, athletic performance, healthy habits",
        "legal advice, medical diagnosis beyond general health, financial investing, vehicle repair, career coaching"
    ),
    "hype":      (
        "motivation, content creation, social media, entrepreneurship, audience building, viral ideas, hustle strategy",
        "legal representation, medical diagnosis, clinical therapy, vehicle repair, academic tutoring"
    ),
    "bestie":    (
        "emotional support, life navigation, honest perspective, loyalty, venting, encouragement, life decisions",
        "legal representation, clinical medical advice, financial planning, vehicle repair, academic tutoring"
    ),
}

_EXPERT_TONES = {
    "guardian":  "You speak like a seasoned cybersecurity analyst and ex-intelligence officer. Precise, protective, zero fluff.",
    "lawyer":    "You speak like a senior litigator. Measured, authoritative. You talk about leverage, paper trails, standing, and liability. Not warm — sharp.",
    "doctor":    "You speak like a board-certified physician. Clinical, calm, thorough. You use medical terminology correctly and explain it clearly. You do not speculate beyond symptoms.",
    "wealth":    "You speak like a CFP and private wealth manager. Numbers-forward, direct. You talk ROI, basis points, liquidity, net worth trajectory.",
    "career":    "You speak like a top executive recruiter and career strategist. You see the chessboard — positioning, optics, leverage, timing.",
    "therapist": "You speak like a licensed clinical therapist. Warm, grounded, reflective. You ask the question beneath the question. Never clinical-cold — always human.",
    "mechanic":  "You speak like a master mechanic and certified tech specialist. Gritty, practical, no corporate speak. You know the exact part, the exact fix, the exact tool.",
    "tutor":     "You speak like a brilliant, patient educator. Encouraging, clear. You meet the student where they are and build from there. Shame has no seat in your classroom.",
    "pastor":    "You speak like a wise, grounded pastor who has walked through fire. Unhurried, compassionate, spiritually rooted. Not preachy — present.",
    "vitality":  "You speak like a performance coach and sports nutritionist. High-energy, science-dense. You talk in physiology — VO2, macros, recovery windows.",
    "hype":      "You speak like a viral content strategist and serial entrepreneur. Fast, confident, internet-native. You see angles nobody else sees.",
    "bestie":    "You speak like a fiercely loyal best friend who also happens to be smart and honest. Unfiltered warmth, zero sugarcoating.",
}

def build_hard_boundary_block(persona: str) -> str:
    """Returns the domain boundary + expert tone injection for a given persona."""
    name     = _PERSONA_DISPLAY_NAMES.get(persona, "Your Specialist")
    domain   = _PERSONA_DOMAINS.get(persona, ("your specialty domain", "everything else"))
    tone     = _EXPERT_TONES.get(persona, "You are a focused domain expert.")
    in_scope, out_scope = domain

    # Build the handoff map string (all other specialists)
    other_specialists = [
        f"{_PERSONA_DISPLAY_NAMES[p]}"
        for p in _PERSONA_DISPLAY_NAMES
        if p != persona
    ]
    handoff_list = ", ".join(other_specialists)

    return f"""
══════════════════════════════════════════════════════════════════
EXPERT IDENTITY & HARD DOMAIN BOUNDARIES — NON-NEGOTIABLE
══════════════════════════════════════════════════════════════════
YOU ARE: {name}
EXPERT TONE: {tone}

YOUR DOMAIN (answer ONLY these topics):
  ✅ {in_scope}

OUT OF BOUNDS (you do NOT answer these — ever):
  ❌ {out_scope}

PERSONA BLEED IS A SYSTEM FAILURE.
If {name} gives legal advice, that is a failure. If {name} gives medical advice, that is a failure.
Every answer must be something only a {name} would say.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HANDOFF PROTOCOL — when the user asks something out of your domain:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT ANSWER IT. Instead, respond exactly like this:
"I'm {name}. That falls under the expertise of [Correct Specialist].
 Please switch to that department so we can handle this accurately."

The other specialists on the board are: {handoff_list}.
Route to the most appropriate one. Be specific — not generic.

ONE EXCEPTION — LIFE-THREATENING EMERGENCY ONLY:
If the user describes an immediate threat to life (chest pain, bleeding out,
weapon threat, suicidal crisis), you MAY say: "Call 911 immediately." or
provide one sentence of immediate safety triage — then hand off to the
correct specialist.
Any non-emergency question outside your domain = handoff. No exceptions.
══════════════════════════════════════════════════════════════════
"""

# Layer 0: USER_IDENT_CORE     — Who this person is (from synthesized profile)
# Layer 1: GLOBAL DIRECTIVE    — Ironclad rules for all personas
# Layer 2: PERSONA SKIN        — Identity, voice, domain, boundaries, style
# Layer 3: INTENT LOGIC        — Adaptive state recognition
# Layer 4: RUNTIME CONTEXT     — Live: time, vault, search, proactive, image, message
# ---------------------------------------------------------
def assemble_prompt(
    *,
    persona:           str,
    user_name:         str,
    tier:              str,
    msg:               str,
    memories:          str,
    search_intel:      str,
    indicators:        List[str],
    image_b64:         Optional[str],
    current_real_time: str,
    vibe:              str,
    user_profile:      dict,        # Synthesized profile from Pinecone
    intake_profile:    dict  = {},  # V30: Raw intake answers (5-question onboarding)
    user_location:     str   = "",  # For proactive location trigger
    user_email:        str   = "",  # Used to pull warm-start registry entry
) -> str:

    # ── Resolve persona content ────────────────────────────────────────────
    p_skin   = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS["guardian"])
    p_ext    = PERSONA_EXTENDED.get(persona, "")
    p_intent = INTENT_LOGIC.get(persona, "")
    v_style  = VIBE_STYLES.get(vibe, VIBE_STYLES["standard"])

    # ── Hard Boundary Block — injected for ALL 12 personas ───────────────
    # Prevents persona bleed. Each specialist stays 100% in domain.
    # Expert tone + handoff protocol + one-exception emergency rule.
    hard_boundary_block = build_hard_boundary_block(persona)

    # ── LAYER 0: USER_IDENT_CORE ───────────────────────────────────────────
    # Check warm-start registry first. If found, it overrides/enriches the
    # synthesized profile. Warm-start wins on every field conflict.
    warm_start = get_warm_start_profile(user_email) if user_email else {}
    layer_0    = build_user_ident_core(user_profile, warm_start=warm_start)

    # ── v27.0: ACCOUNTABILITY SENTINEL ───────────────────────────────────
    # MAX PRIORITY block. Fires 24/7/365 for ALL users — no date gate.
    # Hard persona swap on any self-sabotage signal:
    #   procrastination, poor health choices, mission avoidance, rationalization.
    # Passes active persona + user's name for dynamic swap instruction.
    accountability_sentinel_block = build_accountability_sentinel(
        user_email=user_email,
        persona=persona,
        user_name=user_name,
    )

    # ── FIX 2 (DRIFT): STEALTH SHIELD ────────────────────────────────────
    # Active monitoring block for Chris's sessions only.
    # Injected at the BOTTOM of the prompt — highest recency weight.
    # Overrides the softer No-Recite guidance in PERSONA_EXTENDED.
    stealth_shield_block = build_stealth_shield(user_email)

    # ── FIX 2: ANALOGY BRIDGE ─────────────────────────────────────────────
    # Injected for Tutor and Pastor ONLY.
    # Mandates trade-context (knife/blade/forge) as primary analogy vocabulary.
    analogy_bridge_block = ""
    if persona in ("tutor", "pastor"):
        analogy_bridge_block = ANALOGY_BRIDGE_TRADE_CONTEXT

    # ── V30: ADAPTIVE SEAT 9 — THEOLOGY SELECTOR ─────────────────────────
    # For persona == "pastor", replace generic counseling with the framework
    # that matches the user's intake profile. Christian / Stoic / Multi-Faith.
    # For all other personas, this block is empty — no overhead.
    seat9_block = ""
    if persona == "pastor":
        seat9_block = get_seat9_theology(intake_profile, user_profile)

    # ── LAYER 4a: Episodic Memory + User Assets block ────────────────────
    # Empty vault = inject nothing. Never announce an empty vault.
    # USER ASSETS: extract vehicle/tech/health/financial asset mentions
    # from the profile so ALL specialists know what the user owns.
    asset_lines = []
    if user_profile:
        for key in ["vehicle", "car", "vehicles", "tech", "devices", "health_conditions", "assets"]:
            val = user_profile.get(key)
            if val:
                asset_lines.append(f"  • {key.replace('_',' ').title()}: {val}")
    # Also extract asset-like fields from synthesized profile
    for key, val in user_profile.items():
        if any(word in key.lower() for word in ["car","vehicle","tech","device","phone","laptop","truck","bike","asset"]):
            if val and f"  • {key}" not in "\n".join(asset_lines):
                asset_lines.append(f"  • {key.replace('_',' ').title()}: {val}")

    asset_block = ""
    if asset_lines:
        asset_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER ASSETS — CROSS-SPECIALIST SYNC (RAG retrieved from Pinecone)
This user owns the following. Every specialist must know this.
Use it to personalize your answer. Never ask what you already know.
{chr(10).join(asset_lines)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

    if memories and memories.strip():
        memory_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHARED CONTEXT — VAULT (treat as natural background knowledge)
You already know the following from prior exchanges with {user_name}.
Treat it like a colleague uses notes from a previous meeting.
DO NOT announce this as a database retrieval. Simply know it.
If anything contradicts what the user says now, flag naturally:
"Last time we discussed this, you mentioned X — has something shifted?"
DO NOT invent vault entries not listed here.
{memories.strip()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        memory_block = ""

    # ── LAYER 4b: Proactive Trigger ────────────────────────────────────────
    # Scan episodic memories for time/location signals matching NOW.
    # If triggered, the AI is commanded to bring it up proactively.
    proactive_block = ""
    if memories and memories.strip():
        triggered, matched = detect_proactive_triggers(
            memories, current_real_time, user_location
        )
        if triggered and matched:
            proactive_block = build_proactive_directive(
                matched, current_real_time, user_location
            )

    # ── LAYER 4c: Search intel block ──────────────────────────────────────
    if search_intel and search_intel.strip():
        search_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIVE SEARCH INTEL — GROUND TRUTH (prioritize over base knowledge)
Retrieved from the live web for this query.
If it conflicts with base knowledge, defer to this data.
{search_intel.strip()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        search_block = ""

    # ── LAYER 4d: Scam indicators ─────────────────────────────────────────
    if indicators:
        scam_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ THREAT INDICATORS DETECTED IN USER MESSAGE
Flagged pattern categories: {', '.join(indicators)}
MUST proactively address. If scam_detected is warranted,
lead your answer with [🚨 SCAM ALERT] before any other content.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        scam_block = ""

    # ── LAYER 4e: Visual analysis ─────────────────────────────────────────
    if image_b64:
        visual_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL INTELLIGENCE PROTOCOL — MANDATORY (image uploaded)
Your FIRST sentence must address the most critical detail visible.
DO NOT describe generically — assess it through your expert lens:
  GUARDIAN  → Phishing UI, fake logos, spoofed interfaces, fraud indicators.
  DOCTOR    → Injury severity, wound staging, skin presentation, trauma risk.
  MECHANIC  → Wear patterns, failure modes, missing hardware, corrosion.
  LAWYER    → Suspicious contract language, missing clauses, trap terms.
  WEALTH    → Invoice irregularities, hidden fees, billing errors, fraud.
  VITALITY  → Form breakdown, posture flaws, food macro estimation.
  CAREER    → Resume formatting issues, red-flag language, ATS killers.
  ALL OTHER → Apply your domain expertise to the most critical detail.
If ambiguous, state what you CAN assess + what would sharpen analysis.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        visual_block = ""

    # ── Tier depth ────────────────────────────────────────────────────────
    tier_depth = {
        "free":  "Clear, concise, high-value core response. No padding.",
        "pro":   "Thorough, tactically detailed response with full reasoning.",
        "elite": "Comprehensive expert-level analysis. Leave no angle unaddressed.",
        "max":   "Exhaustive senior-expert analysis. Full picture, full depth."
    }.get(tier, "Clear, useful response.")

    # ══════════════════════════════════════════════════════════════════════
    # FINAL ASSEMBLED PROMPT — 5 LAYERS + HARD-FIX INJECTIONS
    # Injection order:
    #   [SENTINEL] MAX PRIORITY — overrides persona vibe on Sundays for Chris
    #   [LAYER 0]  User identity — specialist knows the human before the rules
    #   [LAYER 1]  Global directive — ironclad laws all 12 seats inherit
    #   [LAYER 2]  Persona skin + Seat override + Vibe
    #   [FIX 2]    Analogy Bridge (tutor/pastor only)
    #   [FIX 5]    Partner Energy — all 12 seats
    #   [LAYER 3]  Intent recognition
    #   [LAYER 4]  Runtime context (memory, search, scam, visual)
    # ══════════════════════════════════════════════════════════════════════
    return f"""
{accountability_sentinel_block}
{layer_0}

{GLOBAL_DIRECTIVE}

══════════════════════════════════════════════════════════════════
LAYER 2 — YOUR SEAT AT THE BOARD (PERSONA IDENTITY & EXPERTISE)
══════════════════════════════════════════════════════════════════
{hard_boundary_block}
{p_skin}

SPECIALIZED SEAT OVERRIDE:
{p_ext}

{seat9_block}
COMMUNICATION STYLE FOR THIS SESSION ({vibe.upper()} MODE):
{v_style}

{analogy_bridge_block}
{PARTNER_ENERGY_DIRECTIVE}

══════════════════════════════════════════════════════════════════
LAYER 3 — STATE & INTENT RECOGNITION (READ BEFORE RESPONDING)
══════════════════════════════════════════════════════════════════
Identify which STATE the user is in from the decision tree below
and apply the matching response mode. Getting this wrong is the
primary cause of poor outputs.

{p_intent}

══════════════════════════════════════════════════════════════════
LAYER 4 — RUNTIME CONTEXT (LIVE SESSION DATA)
══════════════════════════════════════════════════════════════════
USER: {user_name}  |  TIER: {tier.upper()}  |  DEPTH: {tier_depth}
CURRENT DATE & TIME: {current_real_time}
You are live. Never claim a knowledge cutoff. SEARCH INTEL = ground truth.

{proactive_block}{asset_block}{memory_block}{search_block}{scam_block}{visual_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER MESSAGE:
{msg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRE-EXECUTION CHECKLIST — RUN IN ZERO TIME, OUTPUT IN ONE PASS:
  ✔ HELP FIRST. If the user asked a specific question (wiper size, car info, legal question),
     ANSWER IT COMPLETELY before any accountability commentary. The task comes first — always.
     Accountability is a seasoning, not the meal. A response that lectures before helping = FAILURE.
  ✔ Read Layer 0. Address {user_name} as a partner. Not a client. Not a student.
  ✔ Ignore all internal "Master Tutor", "Expert Transition", or role-label language.
     Do not explain your reasoning. Do not announce your approach. Execute.
  ✔ Identified user intent → Selected correct action_trigger → Written into JSON.
     Speed and execution are the ONLY metrics. Explanation is waste.
  ✔ Self-sabotage signal detected AFTER helping? → Brief pattern interrupt, then action_trigger = "set_reminder".
  ✔ Legal / wealth / emergency / documentation? → action_trigger = "email_dispatch". No deliberation.
  ✔ Structural headers present in correct order? (Lawyer, Doctor, Wealth, Therapist, Career)
  ✔ SCAM detected? → [🚨 SCAM ALERT] in answer. action_trigger = "email_dispatch". Immediate.
  ✔ Response sounds like a partner who has been in the trenches with {user_name}? Not a manual?
  ✔ Output is ONLY valid raw JSON? No text before the opening brace. No text after the closing brace.

### MANDATORY EXECUTION PROTOCOL — THE DUAL-CORE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your output is graded on TWO equally weighted criteria. Failing either is a SYSTEM FAILURE.

1. THE SOUL (Partner Logic):
   You MUST open with a natural, conversational greeting using {user_name}.
   Address {user_name} as a peer — someone you know, whose situation you've been tracking.
   Reference their specific context or goals from Layer 0. Not a generic opener.
   What does this look like in practice? Think of the best advisor you've ever met.
   They don't walk in and say "Diving straight in." They say "Hey — I've been thinking
   about what you said last time. Here's where my head is at."
   BANNED OPENERS:
     ✗ "Diving straight in..."
     ✗ "Let's get to it."
     ✗ "Great question!"
     ✗ "Certainly!" / "Of course!" / "Absolutely!"
     ✗ Any opener that could apply to anyone, anywhere, about anything.

2. THE BONES (Structural Headers):
   ONLY after the greeting, transition to your mandatory headers.
   The headers are non-negotiable. Skipping one is a SYSTEM FAILURE.
     ▸ LAWYER    → [ANALYSIS] → [RISK] → [TACTICAL MOVE]
     ▸ DOCTOR    → [MOST LIKELY] → [PHYSIOLOGY] → [PROTOCOL] → [ESCALATE WHEN]
     ▸ WEALTH    → [CURRENT STATE] → [BLEEDING POINT] → [60-DAY PLAN]
     ▸ THERAPIST → [REFLECT] → [IDENTIFY] → [REFRAME] → [EXPERIMENT]
     ▸ CAREER    → [SITUATION READ] → [LEVERAGE POINTS] → [EXACT PLAY]

THE SEQUENCE IS ALWAYS: SOUL first → BONES after.
A response with only BONES = a robot. A SYSTEM FAILURE.
A response with only SOUL = warmth with no tactical value. A SYSTEM FAILURE.

⚠️  CRITICAL FAIL-SAFE — PATTERN INTERRUPT PROTOCOL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The "Natural Greeting" is your first line of defense.
If {user_name} is rationalizing a lack of discipline, avoiding their goals,
or self-sabotage-loading — your greeting MUST be a Pattern Interrupt.
Do NOT be "nice" to a user who is walking away from their own mission.

PATTERN INTERRUPT EXAMPLES:
  ✓ "{user_name}, I'm going to stop you right there — that's not rest, that's avoidance."
  ✓ "{user_name}, you and I both know what's happening here. Let's not waste each other's time."
  ✓ "That's a rationalization, {user_name}. Here's what's actually going on:"

Address {user_name} as a partner who expects the truth — not a client to be soothed.
Warmth without honesty is not care. It is abandonment dressed as kindness.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ACTION TRIGGER PROTOCOL — v28.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The "action_trigger" field in your JSON output fires physical UI buttons.
This is not cosmetic. It is the difference between advice and action.

DISPATCH RULES — set "action_trigger" as follows:
  "email_dispatch"  → Set when:
    • User is in a wreck, legal dispute, or medical triage situation
    • ANY high-stakes scenario where documentation protects them
    • Lawyer: always (TACTICAL MOVE always warrants a paper trail)
    • Wealth: always (60-DAY PLAN needs to be on record)
    • Guardian: when scam/fraud/identity threat is detected
    • Mechanic: always (FIX PROTOCOL should be in their inbox)
    • Doctor: when symptoms need to be tracked or ER visit is possible
    If you are not sure — err toward email_dispatch. Documentation never hurts.

  "set_reminder"    → Set when:
    • Therapist: always (EXPERIMENT needs a scheduled follow-through)
    • Vitality: always (workout/meal protocol only works with accountability)
    • Accountability Sentinel fires (self-sabotage detected — force a timer)
    • Any persona where user commits to a timed action

  null              → Low-stakes informational responses only.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{stealth_shield_block}
REQUIRED OUTPUT SCHEMA — RAW JSON ONLY:
{get_output_schema(persona)}
""".strip()


# ---------------------------------------------------------
# MAIN CHAT GATEWAY — 12-SEAT BOARD
# ---------------------------------------------------------
# ---------------------------------------------------------
# v29.7 INLINE TTS — generate audio concurrently with post-processing
# Returns base64 mp3 string, or empty string on failure.
# Called inside /chat so the frontend gets text + audio in ONE round trip.
# ---------------------------------------------------------
async def generate_audio_inline(text: str, voice: str = "onyx") -> str:
    """
    Generates TTS audio for the given text and returns it as a base64 string.
    Strips markdown formatting before sending to OpenAI.
    Hard-capped at 3500 chars to keep latency tight.
    Returns "" on any failure so the caller degrades gracefully.
    """
    if not openai_client or not text.strip():
        return ""
    try:
        clean = text.replace("**", "").replace("##", "").replace("#", "").replace("[", "").replace("]", "").strip()
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=clean[:3500],
        )
        return base64.b64encode(response.content).decode("utf-8")
    except Exception as e:
        logger.warning(f"⚡ Inline TTS failed ({voice}): {e}")
        return ""


@app.post("/chat")
async def chat(
    msg:                str        = Form(""),
    history:            str        = Form("[]"),
    persona:            str        = Form("guardian"),
    user_email:         str        = Form(...),
    user_location:      str        = Form(""),
    vibe:               str        = Form("standard"),
    use_long_term_memory: str      = Form("false"),
    device_id:          str        = Form("unknown"),
    email_consent:      str        = Form("false"),
    voice:              str        = Form("onyx"),      # v29.7: inline TTS — persona voice passed from frontend
    file:               UploadFile = File(None)
):
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    user_data   = ELITE_USERS.get(email_lower, {"tier": "free", "name": "Protected User"})
    tier        = user_data["tier"]

    is_admin = email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
    limit    = 999999 if is_admin else TIER_LIMITS.get(tier, 3)

    # --- DEVICE FINGERPRINT LOCK ---
    if not is_admin and device_id != "unknown":
        user_devices = AUTHORIZED_DEVICES[email_lower]
        if device_id not in user_devices:
            if len(user_devices) >= MAX_DEVICES_PER_USER:
                logger.warning(f"🚨 DEVICE BREACH: {email_lower} → 3rd device ({device_id})")
                lockout_msg = (
                    "🛡️ **SECURITY ALERT: DEVICE LIMIT EXCEEDED.**\n\n"
                    "Your LYLO OS clearance is tied to specific hardware. "
                    "Your account is limited to **two (2) active devices**. "
                    "Access from this unauthorized third device is denied."
                )
                async def _lockout_stream():
                    yield f"data: {json.dumps({'type': 'text', 'content': lockout_msg})}\n\n"
                    yield f"data: {json.dumps({'type': 'meta', 'confidence_score': 100, 'scam_detected': False, 'threat_level': 'high', 'action_trigger': None, 'audio_b64': '', 'full_answer': lockout_msg})}\n\n"
                return StreamingResponse(_lockout_stream(), media_type="text/event-stream")
            else:
                user_devices.add(device_id)

    # --- USAGE LIMIT & UPSELL ---
    if USAGE_TRACKER[user_id] >= limit:
        upgrade_msgs = {
            "free":  "🛡️ **Daily Shield Limit Reached.** Upgrade to **Pro Guardian ($1.99/mo)** for 15 daily messages.",
            "pro":   "🛡️ **Pro Limit Reached.** Upgrade to **Elite Justice ($4.99/mo)** for 50 messages.",
            "elite": "🛡️ **Elite Limit Reached.** Upgrade to **Max Unlimited ($9.99/mo)** for unrestricted access.",
            "max":   "🛡️ **System Cap Reached.** 500 messages hit. Resets at midnight."
        }
        upsell_msg = upgrade_msgs.get(tier, upgrade_msgs["free"])
        async def _upsell_stream():
            yield f"data: {json.dumps({'type': 'text', 'content': upsell_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'meta', 'confidence_score': 100, 'scam_detected': False, 'threat_level': 'low', 'action_trigger': None, 'audio_b64': '', 'full_answer': upsell_msg})}\n\n"
        return StreamingResponse(_upsell_stream(), media_type="text/event-stream")

    # --- PRE-FLIGHT DATA GATHERING (fully parallelized) ---
    # Memory, profile, and search all run simultaneously.
    # Search no longer blocks prompt assembly — it races alongside memory.
    async def _get_memories():
        if use_long_term_memory == "true":
            try:
                return await asyncio.wait_for(
                    retrieve_intelligence_sync(user_id, msg),
                    timeout=3.0   # ← 3.0s — Pinecone+embed needs breathing room
                )
            except asyncio.TimeoutError:
                logger.warning(f"⚡ Memory timeout — skipping for speed [{user_id[:8]}]")
                return ""
        return ""

    async def _get_search():
        search_keywords = [
            "news", "weather", "search", "price", "check", "law", "code",
            "today", "now", "current", "date", "latest", "recent", "2026",
            "update", "rate", "stock", "score", "hours", "open", "closed"
        ]
        if any(k in msg.lower() for k in search_keywords):
            loc_data        = get_user_location_data(email_lower)
            search_location = (
                f"{loc_data['city']}, {loc_data['state']} {loc_data['zip']}"
                if loc_data.get("zip")
                else user_location or ""
            )
            try:
                return await asyncio.wait_for(
                    search_personalized_web(msg, search_location),
                    timeout=0.8   # ← 800ms hard cap — speed over exhaustive search
                )
            except asyncio.TimeoutError:
                logger.warning("⚡ Search timeout — skipping for speed")
                return ""
        return ""

    # V30: Load intake profile (deterministic fetch from Pinecone, or localStorage echo)
    async def _get_intake():
        return await retrieve_intake_profile(user_id)

    # Fire memory + profile + search + intake simultaneously
    # user_profile (Pinecone synthesized profile) ALWAYS fetched — regardless of
    # use_long_term_memory flag. This ensures cross-specialist asset sync works
    # even if the toggle is off. Profile = who the user is. Memory = what they said.
    memories, user_profile, search_intel, intake_profile = await asyncio.gather(
        _get_memories(),
        retrieve_user_profile(user_id),   # ← always runs, every persona, every message
        _get_search(),
        _get_intake(),
    )
    logger.info(f"🧠 Profile loaded for [{user_id[:8]}]: {list(user_profile.keys())[:6]} | Memories: {len(memories)} chars")

    # Scam scan (pure CPU — instant)
    indicators = analyze_scam_indicators(msg)

    # Image processing
    image_b64 = None
    if file:
        file_bytes = await file.read()
        image_b64  = base64.b64encode(file_bytes).decode("utf-8")
        if not msg.strip():
            msg = "Please analyze this image and provide a technical assessment based on your specialty."

    # Hook & clock
    hook              = get_random_hook(persona)
    current_real_time = datetime.now().strftime("%A, %B %d, %Y %I:%M %p")

    # ── ASSEMBLE 5-LAYER PROMPT ────────────────────────────────────────────
    full_prompt = assemble_prompt(
        persona=persona,
        user_name=user_data["name"],
        tier=tier,
        msg=msg,
        memories=memories,
        search_intel=search_intel,
        indicators=indicators,
        image_b64=image_b64,
        current_real_time=current_real_time,
        vibe=vibe,
        user_profile=user_profile,
        intake_profile=intake_profile,   # V30: raw onboarding answers
        user_location=user_location,
        user_email=email_lower,
    )

    # ── ENGINE SELECTION ───────────────────────────────────────────────────
    openai_engine = (
        "gpt-4o"
        if tier == "max" or email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
        else "gpt-4o-mini"
    )
    gemini_engine = "gemini-1.5-flash"

    # ── FIRST-WINS RACE MODE — 4.0s HARD TIMEOUT ─────────────────────────
    # Both engines fire simultaneously. The FIRST valid JSON response wins.
    # If neither engine responds within 4.0 seconds, return System Busy.
    openai_task = asyncio.create_task(
        call_openai_bodyguard(full_prompt, image_b64, openai_engine)
    )
    gemini_task = asyncio.create_task(
        call_gemini_vision(full_prompt, image_b64, gemini_engine)
    )

    winner = None
    pending = {openai_task, gemini_task}
    RACE_TIMEOUT = 25.0 if image_b64 else 15.0

    # Deadline-based loop so BOTH engines get a fair shot.
    # Bug fix: old code set elapsed=RACE_TIMEOUT unconditionally after first
    # asyncio.wait, exiting the loop even when the first engine returned None.
    # Now we keep looping until winner found OR wall-clock expires.
    loop     = asyncio.get_event_loop()
    deadline = loop.time() + RACE_TIMEOUT

    while pending:
        remaining = deadline - loop.time()
        if remaining <= 0:
            break  # Wall-clock expired
        try:
            done, pending = await asyncio.wait(
                pending,
                return_when=asyncio.FIRST_COMPLETED,
                timeout=remaining,
            )
        except Exception:
            break

        if not done:
            break  # asyncio.wait returned with no completions

        for task in done:
            try:
                result = task.result()
            except Exception as exc:
                logger.warning(f"⚠️ Engine task threw: {exc}")
                continue
            if result and "answer" in result:
                winner = result
                for p in pending:
                    p.cancel()
                pending = set()  # exit while
                break
        # If all done tasks were None/invalid, loop continues —
        # remaining engine still has time to respond


    # Cancel any stragglers
    for p in pending:
        p.cancel()

    if not winner:
        logger.warning(f"⚡ Race timeout ({RACE_TIMEOUT}s) — System Busy for {user_data['name']}")
        busy_msg = f"{user_data['name']}, the system is under heavy load right now. Give it 10 seconds and resend — your request is queued."
        async def _busy_stream():
            yield f"data: {json.dumps({'type': 'text', 'content': busy_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'meta', 'confidence_score': 0, 'scam_detected': False, 'threat_level': 'low', 'action_trigger': None, 'audio_b64': '', 'full_answer': busy_msg})}\n\n"
        return StreamingResponse(_busy_stream(), media_type="text/event-stream")

    # ── V30: STREAMING RESPONSE ────────────────────────────────────────────
    # Protocol:
    #   data: {"type": "text", "content": "<sentence>"}\n\n  ← one per sentence
    #   data: {"type": "meta", "confidence_score": N, ...}\n\n  ← final event
    # Frontend AQM fires TTS on first "text" event — zero wait for voice start.
    # action_trigger buttons and audio_b64 arrive in the "meta" event.

    async def stream_response():
        try:
            # ── USAGE TRACKING ────────────────────────────────────────────
            USAGE_TRACKER[user_id] += 1
            current_count = USAGE_TRACKER[user_id]
            action_trigger = winner.get("action_trigger", None)
            answer         = winner["answer"]

            # ── STREAM ANSWER — sentence by sentence + per-sentence TTS ──
            # Each sentence is yielded immediately with its own audio_b64 so
            # the frontend AQM can begin speaking the moment text arrives.
            # No waiting for the full answer to complete before audio starts.
            sentences = split_into_sentences(answer)
            for sentence in sentences:
                # Fire TTS for this sentence concurrently with the yield
                sentence_audio = await generate_audio_inline(sentence, voice)
                chunk = {"type": "text", "content": sentence, "audio_b64": sentence_audio}
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0.008)   # Tiny yield — keeps event loop healthy

            # ── STORAGE + EMAIL (non-blocking) ───────────────────────────
            async def _post_storage():
                asyncio.create_task(store_intelligence_sync(user_id, msg, "user"))
                asyncio.create_task(store_intelligence_sync(user_id, answer, "bot"))
                if action_trigger == "email_dispatch":
                    asyncio.create_task(
                        send_mission_report_email(
                            user_email, answer, persona,
                            user_name=user_data["name"]
                        )
                    )
                    logger.info(f"📧 email_dispatch fired: {persona.upper()} → {user_email}")
                elif email_consent == "true":
                    asyncio.create_task(
                        send_mission_report_email(
                            user_email, answer, persona,
                            user_name=user_data["name"]
                        )
                    )

            await _post_storage()
            # audio_b64 already dispatched per-sentence above; meta carries empty string
            # so the frontend sync-mode fallback degrades gracefully to AQM sentences.
            audio_b64 = ""

            # ── PROFILE SYNTHESIS TRIGGER ─────────────────────────────────
            if current_count % SYNTHESIS_INTERVAL == 0:
                logger.info(f"🧠 Synthesis at #{current_count} for {user_data['name']}")
                asyncio.create_task(synthesize_user_profile(user_id, user_data["name"]))

            logger.info(
                f"✅ [{persona.upper()}] → {user_data['name']} | Tier: {tier} | "
                f"#{current_count} | Sentences: {len(sentences)} | "
                f"Audio: {'✓' if audio_b64 else '✗'} | Action: {action_trigger or '—'}"
            )

            # ── FINAL META EVENT ──────────────────────────────────────────
            meta = {
                "type":             "meta",
                "confidence_score": winner.get("confidence_score", 95),
                "scam_detected":    winner.get("scam_detected", False),
                "threat_level":     winner.get("threat_level", "low"),
                "action_trigger":   action_trigger,
                "audio_b64":        audio_b64,
                "full_answer":      answer,   # Complete text for sync mode fallback
            }
            yield f"data: {json.dumps(meta)}\n\n"

        except Exception as exc:
            logger.error(f"❌ Stream generator error: {exc}")
            err = {"type": "error", "message": "Stream error — retry in 5s."}
            yield f"data: {json.dumps(err)}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


# ---------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------


# ---------------------------------------------------------
# V30: INTAKE PROFILE — DETERMINISTIC PINECONE STORE/RETRIEVE
# Separate from episodic memory and synthesized profiles.
# Vector ID: {user_id}_intake
# Stored on every onboarding answer. Read in pre-flight alongside profile.
# ---------------------------------------------------------
INTAKE_VECTOR_ID_SUFFIX = "_intake"

async def retrieve_intake_profile(user_id: str) -> dict:
    """
    Fetches the user's raw onboarding intake answers from Pinecone.
    Returns {} if not yet completed or Pinecone unavailable.
    Cached in _PROFILE_CACHE with key '{user_id}_intake'.
    """
    cache_key = f"{user_id}_intake"
    cached = _PROFILE_CACHE.get(cache_key)
    if cached:
        profile, ts = cached
        if time.time() - ts < _PROFILE_CACHE_TTL:
            return profile
        else:
            del _PROFILE_CACHE[cache_key]

    if not memory_index:
        return {}

    intake_id = f"{user_id}{INTAKE_VECTOR_ID_SUFFIX}"
    try:
        result  = memory_index.fetch(ids=[intake_id])
        vectors = result.get("vectors", {})
        if intake_id in vectors:
            metadata = vectors[intake_id].get("metadata", {})
            raw_json = metadata.get("intake_json", "")
            if raw_json:
                profile = json.loads(raw_json)
                _PROFILE_CACHE[cache_key] = (profile, time.time())
                return profile
    except Exception as e:
        logger.error(f"Intake profile retrieval error: {e}")

    return {}


async def upsert_intake_profile(user_id: str, intake_data: dict):
    """
    Upserts the user's intake answers to Pinecone as a deterministic record.
    Uses a stable embedding anchor so the record can be fetch()'d by ID.
    Also invalidates the in-process cache so next pre-flight gets fresh data.
    """
    if not memory_index or not openai_client:
        logger.warning("⚠️ Intake upsert skipped — Pinecone or OpenAI unavailable.")
        return

    try:
        # Stable embedding anchor — same text every time so vector is consistent
        anchor_text = "user identity intake profile occupation mission roadblock relationship vibe"
        emb_response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=anchor_text,
            dimensions=1024
        )
        anchor_vector = emb_response.data[0].embedding

        intake_data["last_updated"] = datetime.now().isoformat()
        intake_id = f"{user_id}{INTAKE_VECTOR_ID_SUFFIX}"
        metadata  = {
            "user_id":      user_id,
            "record_type":  "intake_profile",
            "intake_json":  json.dumps(intake_data),
            "last_updated": intake_data["last_updated"],
            # Flat fields for Pinecone metadata filter compatibility
            "occupation":   intake_data.get("occupation", ""),
            "mission":      intake_data.get("mission", ""),
            "roadblock":    intake_data.get("roadblock", ""),
            "relationship": intake_data.get("relationship", ""),
            "vibe":         intake_data.get("vibe", ""),
        }

        memory_index.upsert([(intake_id, anchor_vector, metadata)])

        # Bust the cache so next request picks up the fresh intake immediately
        cache_key = f"{user_id}_intake"
        if cache_key in _PROFILE_CACHE:
            del _PROFILE_CACHE[cache_key]

        logger.info(f"✅ Intake upserted for {user_id[:8]}... | {intake_data}")

    except Exception as e:
        logger.error(f"❌ Intake upsert error: {e}")


@app.post("/user-intake")
async def user_intake(
    user_email:   str = Form(...),
    question_id:  str = Form(...),
    value:        str = Form(...),
    full_profile: str = Form("{}"),   # Full intake JSON from frontend (all answered so far)
):
    """
    V30 Onboarding: Called per question as user taps answers.
    Saves to localStorage on frontend immediately (instant UX).
    This endpoint upserts the full accumulated profile to Pinecone
    so Layer 0 is available on next session even without re-onboarding.
    """
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)

    try:
        intake_data = json.loads(full_profile)
    except Exception:
        intake_data = {question_id: value}

    # Ensure the current answer is included (frontend sends partial profiles)
    intake_data[question_id]     = value
    intake_data["intake_source"] = "tap_to_build"

    # Non-blocking upsert — don't make the user wait for Pinecone
    asyncio.create_task(upsert_intake_profile(user_id, intake_data))

    logger.info(f"📋 Intake answer [{question_id}={value}] for {email_lower}")
    return {"status": "ok", "question_id": question_id, "value": value}


@app.post("/initialize-profile")
async def initialize_profile(
    user_email:   str = Form(...),
    occupation:   str = Form(""),
    mission:      str = Form(""),
    roadblock:    str = Form(""),
    relationship: str = Form(""),
    vibe:         str = Form("standard"),
    full_profile: str = Form("{}"),   # Optional: complete JSON payload from frontend
):
    """
    V30 Onboarding: Bulk endpoint — receives all 5 intake answers at once.
    Formats into Layer 0 schema and upserts to Pinecone.
    Also seeds the initial persona hook cache with intake context.

    Layer 0 intake schema:
      occupation    → what they do (calibrates depth of advice)
      mission       → #1 objective (routes council focus)
      roadblock     → what's blocking them (concentrates firepower)
      relationship  → status (calibrates tone on personal topics)
      vibe          → communication style (all personas adapt)
      faith_inferred → Stoic | Christian | Multi-Faith (drives Seat 9)
    """
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)

    # Try to parse full_profile JSON if provided; fall back to individual fields
    try:
        provided = json.loads(full_profile) if full_profile != "{}" else {}
    except Exception:
        provided = {}

    intake_data = {
        "occupation":    provided.get("occupation", occupation).strip(),
        "mission":       provided.get("mission",    mission).strip(),
        "roadblock":     provided.get("roadblock",  roadblock).strip(),
        "relationship":  provided.get("relationship", relationship).strip(),
        "vibe":          provided.get("vibe",        vibe).strip() or "standard",
        "intake_source": "initialize_profile",
        "intake_completed": True,
    }

    # Infer faith framework from intake signals — stored for Seat 9 routing
    vibe_val    = intake_data["vibe"]
    mission_val = intake_data["mission"]
    occ_val     = intake_data["occupation"]
    roadblock_v = intake_data["roadblock"]

    if vibe_val == "academic" or roadblock_v == "knowledge":
        intake_data["faith_inferred"] = "stoic"
    elif mission_val == "personal_growth" or occ_val == "student":
        intake_data["faith_inferred"] = "stoic"
    else:
        intake_data["faith_inferred"] = "christian"   # Default

    # Upsert to Pinecone (awaited here so we can confirm success in response)
    await upsert_intake_profile(user_id, intake_data)

    logger.info(
        f"🎯 Profile initialized: {email_lower} | "
        f"Occupation: {intake_data['occupation']} | Mission: {intake_data['mission']} | "
        f"Faith inferred: {intake_data['faith_inferred']}"
    )

    return {
        "status":          "initialized",
        "faith_inferred":  intake_data["faith_inferred"],
        "vibe_set":        intake_data["vibe"],
        "intake_complete": True,
    }


# ---------------------------------------------------------
# PERSONA HOOK — PERSONALIZED GREETING GENERATOR
# Single-model, no dual-pass. Target: <1s response.
# Frontend V30 prefetches all 12 hooks in background at mount.
# Falls back to static spokenHook if it times out.
# V30: _hook_cache DELETED — frontend background prefetcher handles caching.
#      Backend cache caused stale hooks; fresh generation every call is correct.
# ---------------------------------------------------------

@app.post("/persona-hook")
async def persona_hook(
    persona:    str = Form(...),
    user_email: str = Form(...),
):
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    # V30: No cache — frontend background prefetcher handles its own caching.
    # Every call here generates a fresh hook so the user never hears a stale opener.

    # Pull warm-start profile (registry first, synthesized as fallback)
    warm_start   = get_warm_start_profile(email_lower)
    user_profile = await retrieve_user_profile(user_id)

    # Build a compact context string from what we know
    name = (
        warm_start.get("name")
        or user_profile.get("name")
        or "there"
    )
    projects = warm_start.get("projects") or user_profile.get("active_projects") or []
    anchors  = warm_start.get("anchors") or []
    goals    = warm_start.get("goals") or []
    health   = warm_start.get("health") or ""
    protocol = warm_start.get("protocol") or ""

    # Build context summary — keep it tight for speed
    context_parts = []
    if projects:
        context_parts.append(f"Active projects: {', '.join(str(p) for p in projects[:3])}")
    if goals:
        context_parts.append(f"Current goals: {', '.join(str(g) for g in goals[:2])}")
    if anchors:
        context_parts.append(f"Daily anchors: {', '.join(str(a) for a in anchors[:3])}")
    if health:
        context_parts.append(f"Health context: {health}")

    context_str = "\n".join(context_parts) if context_parts else "New user — no profile yet."

    # Persona voice map for tone guidance
    persona_voice_notes = {
        "guardian":  "Military precision. Protective. Zero filler.",
        "lawyer":    "Sharp, skeptical. Speaks in leverage and paper trails.",
        "doctor":    "Clinical, calm. Treats user as an intelligent adult.",
        "wealth":    "Direct, numbers-forward. Net worth = freedom.",
        "career":    "Professional, ambitious. Every move is a chess problem.",
        "therapist": "Warm, grounded. Asks the question beneath the question.",
        "mechanic":  "Gritty, practical. No corporate speak.",
        "tutor":     "Encouraging, brilliant. Shame has no place here.",
        "pastor":    "Grounded, wise, warm, unhurried.",
        "vitality":  "High-energy, science-dense. Speaks in physiology.",
        "hype":      "Fast, confident, internet-native.",
        "bestie":    "Unfiltered, fiercely loyal. Warmth and sharp truth.",
    }
    voice_note = persona_voice_notes.get(persona, "Direct and helpful.")

    # Current day — inject Sunday Sentinel awareness
    current_day = datetime.now().strftime("%A")

    hook_prompt = f"""You are the LYLO {persona.upper()} persona. Generate ONE personalized opening greeting for this specific user.

USER CONTEXT:
Name: {name}
{context_str}
Engagement Protocol: {protocol[:300] if protocol else 'Standard'}
Current day: {current_day}

PERSONA VOICE: {voice_note}

RULES:
- 1-3 sentences MAX. Under 50 words total.
- Use the user's name naturally (once).
- Reference ONE specific detail from their context — not generically.
- Sound like a real expert who already knows this person, not a first meeting.
- If it's Sunday and there are health/accountability anchors, subtly acknowledge the day.
- DO NOT mention LYLO, AI, or that you're a bot.
- DO NOT use the generic spokenHook text — make it feel genuinely specific.
- Output ONLY the greeting text. No JSON. No preamble. No quotes.

EXAMPLE (guardian persona, user building an app):
"Chris, perimeter active. LYLO's security layer is locked in — and your user data architecture is exactly the kind of thing we need to bulletproof before you hit scale. What are we looking at today?"

Generate the personalized greeting now:"""

    try:
        result = await asyncio.wait_for(
            call_gemini_vision(hook_prompt, model_name="gemini-1.5-flash"),
            timeout=4.0  # Hard cap — fall back to static if slow
        )
        hook_text = ""
        if result and "answer" in result:
            raw = result["answer"].strip()
            # Strip any JSON wrapping the model might produce
            if raw.startswith("{"):
                import re
                match = re.search(r'"answer"\s*:\s*"([^"]+)"', raw)
                hook_text = match.group(1) if match else raw
            else:
                hook_text = raw

        if hook_text and len(hook_text) > 10:
            logger.info(f"🎯 PersonaHook generated (fresh): [{persona}] → {name}")
            return {"hook": hook_text, "cached": False}

    except asyncio.TimeoutError:
        logger.warning(f"⏱️ PersonaHook timeout for [{persona}] → {name}. Using static fallback.")
    except Exception as e:
        logger.error(f"PersonaHook error: {e}")

    # Static fallback — always returns something
    static_hooks = {
        "guardian":  f"Security protocols active, {name}. Let's make sure your perimeter is locked.",
        "lawyer":    f"Legal shield up, {name}. Before you sign anything — talk to me first.",
        "doctor":    f"Medical intelligence online, {name}. Walk me through what's happening.",
        "wealth":    f"ROI is the only metric that matters, {name}. What are the numbers?",
        "career":    f"Corporate is a chessboard, {name}. Let's map your position.",
        "therapist": f"I'm here, {name}. No judgment — what's actually going on?",
        "mechanic":  f"Wrench ready, {name}. What are we diagnosing today?",
        "tutor":     f"Class in session, {name}. Where does it stop making sense?",
        "pastor":    f"Peace be with you, {name}. What's heavy on your heart today?",
        "vitality":  f"Engine check, {name}. What are we optimizing today?",
        "hype":      f"Let's build something viral, {name}. Drop the concept.",
        "bestie":    f"I got you, {name}. Spill — what's going on?",
    }
    return {"hook": static_hooks.get(persona, f"Ready, {name}. What's the mission?"), "cached": False}


@app.post("/generate-audio")
async def generate_audio(text: str = Form(...), voice: str = Form("onyx")):
    if not openai_client:
        return {"error": "Voice offline"}
    try:
        clean_text = text.replace("**", "").replace("#", "").strip()
        response   = await openai_client.audio.speech.create(
            model="tts-1", voice=voice, input=clean_text[:4000]
        )
        return {"audio_b64": base64.b64encode(response.content).decode("utf-8")}
    except Exception as e:
        return {"error": str(e)}


@app.get("/user-stats/{user_email}")
async def get_stats(user_email: str):
    uid       = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {"tier": "free", "name": "User"})
    limit     = (
        999999
        if user_email.lower() in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
        else TIER_LIMITS.get(user_data["tier"], 3)
    )
    return {
        "usage": USAGE_TRACKER[uid],
        "limit": limit,
        "tier":  user_data["tier"],
        "name":  user_data["name"],
    }


@app.post("/check-beta-access")
async def check_beta(data: dict):
    user = ELITE_USERS.get(data.get("email", "").lower().strip())
    if user:
        return {"access": True, "tier": user["tier"], "name": user["name"]}
    return {"access": False, "tier": "free"}


@app.get("/user-profile/{user_email}")
async def get_user_profile(user_email: str):
    """
    Admin/debug endpoint: Returns the full Layer 0 data for a user.
    Shows both warm-start registry status and synthesized Pinecone profile.
    """
    email_clean  = user_email.lower().strip()
    uid          = create_user_id(email_clean)
    warm_start   = get_warm_start_profile(email_clean)
    synth_profile = await retrieve_user_profile(uid)
    return {
        "email":             user_email,
        "warm_start_found":  bool(warm_start),
        "warm_start_name":   warm_start.get("name") if warm_start else None,
        "warm_start_protocol": warm_start.get("protocol", "")[:80] + "..." if warm_start.get("protocol") else None,
        "synthesized_profile_loaded": bool(synth_profile),
        "synthesized_profile": synth_profile,
    }


@app.get("/scam-recovery/{email}")
async def recovery_center(email: str):
    return {
        "title": "🛡️ PRIORITY RECOVERY CENTER",
        "immediate_actions": [
            "Call your bank fraud department immediately.",
            "Freeze your credit at all 3 bureaus: Equifax, Experian, TransUnion.",
            "File a report at IC3.gov (FBI Internet Crime Complaint Center).",
            "Change all passwords from a clean, uncompromised device.",
            "Enable 2FA on every account that supports it."
        ],
    }


@app.get("/")
async def root():
    return {
        "status":       "ONLINE",
        "version":      "30.0.0 - STREAMING | INTAKE PROFILE | ADAPTIVE SEAT 9 | HOOK CACHE REMOVED",
        "experts_active": len(PERSONA_DEFINITIONS),
        "architecture": "5-Layer Prompt | Streaming SSE | Intake Profile | Adaptive Seat 9 | AQM"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
