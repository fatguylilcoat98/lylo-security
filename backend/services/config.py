"""LYLO OS — services/config.py
All env vars, API clients, global state. Import from here everywhere.
"""
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
from pinecone import Pinecone, ServerlessSpec
from tavily import TavilyClient
from openai import AsyncOpenAI
from google import genai
from google.oauth2 import service_account
from dotenv import load_dotenv
import sys
import os
# ── Render.com path fix ───────────────────────────────────────────────────────
# Ensures Python finds lylo_kernel, tactical_vault, vault_routes, sentinel_routes
# regardless of which directory Render launches uvicorn from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ─────────────────────────────────────────────────────────────────────────────
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
from io import BytesIO
from datetime import datetime
from collections import defaultdict
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, Form, HTTPException, File, UploadFile, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, Response, FileResponse, HTMLResponse
from fastapi.background import BackgroundTasks
from pydantic import BaseModel

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from tavily import TavilyClient
from pinecone import Pinecone, ServerlessSpec

# ── Med-Vault imports ─────────────────────────────────────────────────────────
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
    _MED_VAULT_IMPORT_ERROR = None
except ImportError as e:
    MED_VAULT_ENABLED = False
    _MED_VAULT_IMPORT_ERROR = str(e)
from google import genai
from google.oauth2 import service_account
from openai import AsyncOpenAI
from dotenv import load_dotenv

# ─── LYLO MODULE IMPORTS ──────────────────────────────────────────────────────

# v31.0 — Kernel: Human-First OS brain (replaces static system prompt)
from lylo_kernel import (
    build_system_prompt,
    fetch_memory_pins,
    upsert_memory_pin,
)

# Sentinel push-notification router
from sentinel_routes import sentinel_router

# Elite Tier — Tactical Vault PDF engine + routes
from tactical_vault import (
    TacticalReportData,
    build_incident_prompt,
    generate_tactical_report,
    send_report_to_pro as vault_send_to_pro,
)
from vault_routes import vault_router

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
    ANALOGY_BRIDGE_TRADE_CONTEXT,
    ACCOUNTABILITY_SENTINEL_OVERRIDE,
    build_accountability_sentinel,
    PARTNER_ENERGY_DIRECTIVE,
    # ── SOUL RULES (v10.0) ───────────────────────────────────────────────
    EXIT_FIRST_FILTER,
    SENTINEL_NO_RECITE,
    # ── CONVERSATIONAL DRIFT FIXES (v11.0) ───────────────────────────────
    get_output_schema,
    build_stealth_shield,
)

load_dotenv()

# =============================================================================
# PRODUCTION LOGGING
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("LYLO-CORE-INTEGRATION")

# Log med-vault import result now that logger exists
if MED_VAULT_ENABLED:
    logger.info("✅ Med-Vault loaded")
else:
    logger.warning(f"⚠️ Med-Vault not available: {_MED_VAULT_IMPORT_ERROR}")

# =============================================================================
# FASTAPI APP
# =============================================================================
app = FastAPI(
    title="LYLO Total Integration Backend",
    description="Human-First Digital Bodyguard OS — Kernel v31.0",
    version="31.0.0 — KERNEL v31 | TACTICAL VAULT | OBD-II | AUTO-PIN | SENTINEL"
)

# ── Router mounts ─────────────────────────────────────────────────────────────
app.include_router(sentinel_router)   # Sentinel push notifications
app.include_router(vault_router)      # Elite Tier: /generate-report, /send-report-to-pro

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# API KEY CONFIGURATION
# =============================================================================
TAVILY_API_KEY    = os.getenv("TAVILY_API_KEY",    "").strip()
PINECONE_API_KEY  = os.getenv("PINECONE_API_KEY",  "").strip()
GEMINI_API_KEY           = os.getenv("GEMINI_API_KEY",           "").strip()
VERTEX_PROJECT           = os.getenv("VERTEX_PROJECT",           "").strip()
VERTEX_LOCATION          = os.getenv("VERTEX_LOCATION",          "us-central1").strip()
GOOGLE_CREDENTIALS_FILE  = "/etc/secrets/google_credentials.json"  # Render Secret File
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY",    "").strip()
CLAUDE_API_KEY    = os.getenv("CLAUDE_API_KEY",    "").strip()

stripe.api_key        = os.getenv("STRIPE_SECRET_KEY",    "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

SMTP_SERVER   = os.getenv("SMTP_SERVER",   "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# =============================================================================
# TIER LIMITS & TRACKERS
# =============================================================================
TIER_LIMITS = {
    "free":  3,
    "pro":   15,
    "elite": 50,
    "max":   500,
}

USAGE_TRACKER        = defaultdict(int)
# ── Conversation persona context — remembers last 3 messages per user ─────────
# Prevents re-routing the same message if it was already handled correctly
CONVO_CONTEXT: dict[str, list[dict]] = defaultdict(list)
MAX_CONVO_CONTEXT = 6  # last 6 turns per user
AUTHORIZED_DEVICES   = defaultdict(set)
MAX_DEVICES_PER_USER = 2

# v28.1 SPEED — In-process profile cache
# Structure: { cache_key: (data_dict, timestamp_float) }
_PROFILE_CACHE     = {}
_PROFILE_CACHE_TTL = 600  # 10 minutes

# =============================================================================
# CLIENT INITIALIZATION
# =============================================================================
tavily_client = None
if TAVILY_API_KEY:
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        logger.info("✅ Personalized Search Engine Ready")
    except Exception as e:
        logger.error(f"❌ Search Engine Failed: {e}")

pc           = None
memory_index = None
if PINECONE_API_KEY:
    try:
        pc         = Pinecone(api_key=PINECONE_API_KEY)
        index_name = "lylo-intelligence-sync"
        existing   = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing:
            pc.create_index(
                name=index_name,
                dimension=1024,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        memory_index = pc.Index(index_name)
        logger.info("✅ Intelligence Sync Ready")
    except Exception as e:
        logger.error(f"❌ Sync Index Failed: {e}")


# ==============================================================================
# SEMANTIC DOMAIN ROUTER — Anchor Cache
# Embeddings for each persona's domain. Cached at first use.
# These are the "north stars" for routing decisions.
# ==============================================================================
DOMAIN_ANCHORS: dict[str, str] = {
    "guardian":  "cybersecurity scam phishing identity theft digital safety account protection hacking fraud suspicious email virus malware",
    "doctor":    "medical symptom health illness body pain diagnosis medication treatment disease injury recovery fatigue tired sick headache fever",
    "lawyer":    "legal law lawsuit court attorney rights contract dispute eviction tenant employment discrimination sue settlement",
    "wealth":    "money finance investing debt budget savings income expenses taxes retirement stocks crypto portfolio financial",
    "therapist": "emotions feelings mental health anxiety depression grief trauma stress relationships therapy counseling burnout overwhelmed",
    "mechanic":  "car vehicle engine transmission oil brake tire wheel repair maintenance OBD fault code automotive truck check engine",
    "career":    "job career resume interview promotion salary negotiation workplace boss employment professional growth",
    "vitality":  "fitness workout exercise nutrition diet weight training recovery supplement performance body composition gym",
    "tutor":     "learning education math science homework study skill knowledge teaching academic test exam understand",
    "pastor":    "faith religion God prayer scripture Bible spiritual church worship belief spirituality purpose meaning",
    "hype":      "content viral social media marketing brand audience followers TikTok Instagram YouTube engagement creator",
    "bestie":    "relationship friendship dating personal life venting drama situationship family boyfriend girlfriend",
}
# Cache: persona → embedding vector (populated lazily on first request)
_ANCHOR_EMBEDDINGS: dict[str, list[float]] = {}
_ANCHOR_CACHE_LOCK = None  # set to asyncio.Lock() on first use

gemini_ready = False
gemini_client = None

# ── Vertex AI via Secret File — google.genai SDK ──────────────────────────────
if os.path.exists(GOOGLE_CREDENTIALS_FILE):
    try:
        import json as _json
        _credentials = service_account.Credentials.from_service_account_file(
            GOOGLE_CREDENTIALS_FILE,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        with open(GOOGLE_CREDENTIALS_FILE) as _f:
            _creds_dict = _json.load(_f)
        _project = VERTEX_PROJECT or _creds_dict.get("project_id", "")
        gemini_client = genai.Client(
            vertexai=True,
            project=_project,
            location=VERTEX_LOCATION,
            credentials=_credentials,
        )
        gemini_ready = True
        logger.info(f"✅ Gemini Ready — Vertex AI google.genai SDK (project={_project})")
    except Exception as e:
        logger.error(f"❌ Vertex AI Setup Failed: {e}")
else:
    logger.warning("⚠️ No credentials at /etc/secrets/google_credentials.json")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ OpenAI Digital Bodyguard Ready")
    except Exception as e:
        logger.error(f"❌ OpenAI Setup Failed: {e}")

# ── Claude Validator — Anthropic API ─────────────────────────────────────────
claude_client = None
if CLAUDE_API_KEY:
    try:
        import anthropic
        claude_client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
        logger.info("✅ Claude Validator Ready — Persona Lane Enforcement Active")
    except Exception as e:
        logger.error(f"❌ Claude Validator Setup Failed: {e}")

# ── Claude Lane Enforcer (Anthropic) ─────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
anthropic_client  = None
if ANTHROPIC_API_KEY:
    try:
        import anthropic as _anthropic
        anthropic_client = _anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        logger.info("✅ Claude Lane Enforcer Ready")
    except Exception as e:
        logger.error(f"❌ Claude Lane Enforcer Setup Failed: {e}")
else:
    logger.warning("⚠️ No ANTHROPIC_API_KEY — Lane Enforcer disabled")

# =============================================================================
# ELITE USER DATABASE
# =============================================================================
# ── BETA USERS — loaded from persistent file, never from code ────────────────
BETA_USERS_FILE = "/etc/secrets/beta_users.json"  # Render persistent disk
# Fallback path if secrets not mounted
if not os.path.exists(BETA_USERS_FILE):
    BETA_USERS_FILE = os.path.join(os.path.dirname(__file__), "beta_users.json")

def _load_beta_users() -> dict:
    """Load beta users from persistent JSON file. Never wiped by redeploy."""
    try:
        if os.path.exists(BETA_USERS_FILE):
            with open(BETA_USERS_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load beta_users.json: {e}")
    return {}

def _save_beta_users(data: dict):
    """Save beta users back to persistent file."""
    try:
        os.makedirs(os.path.dirname(BETA_USERS_FILE), exist_ok=True)
        with open(BETA_USERS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Could not save beta_users.json: {e}")

# ADMIN accounts — always in code, never wiped
ADMIN_USERS = {
    "stangman9898@gmail.com":    {"tier": "max", "name": "Christopher"},
    "mylylo.ai@gmail.com":       {"tier": "max", "name": "LYLO Admin"},
    # ── Real beta testers (hardcoded so they always have access) ───────────
    "bearjcameron@icloud.com":   {"tier": "max", "name": "Bear",   "beta": True},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey", "beta": True},
    "jcdabearman@gmail.com":      {"tier": "max", "name": "Jeff",     "beta": True},
}}

# Beta testers — loaded from file, survives all redeploys
_BETA_USERS_DB = _load_beta_users()

# ELITE_USERS merges admin + beta at runtime
ELITE_USERS = {**ADMIN_USERS, **_BETA_USERS_DB}


ELITE_TIERS = {"elite", "max"}

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]


# ── Waitlist / Paid Queue ─────────────────────────────────────────────────────
WAITLIST_FILE   = "waitlist.json"
PAID_QUEUE_FILE = "paid_queue.json"

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
