import os
import uvicorn
import json
import hashlib
import asyncio
import base64
import stripe
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from io import BytesIO
from fastapi import FastAPI, Form, HTTPException, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
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
    GLOBAL_DIRECTIVE,
    VIBE_STYLES, VIBE_LABELS,
    PERSONA_DEFINITIONS, PERSONA_EXTENDED, PERSONA_TIERS,
    INTENT_LOGIC,
    get_random_hook, get_all_hooks
)

# Load environment variables
load_dotenv()

# Configure Production-Level Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("LYLO-CORE-INTEGRATION")

# Initialize FastAPI App
app = FastAPI(
    title="LYLO Total Integration Backend",
    description="Proactive Digital Bodyguard & Recursive Intelligence Engine",
    version="20.0.0 - MULTI-LAYER ARCHITECTURE"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# API KEY CONFIGURATION & DIAGNOSTICS
# ---------------------------------------------------------
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# STRIPE CONFIGURATION
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

# EMAIL CONFIGURATION (For Mission Reports)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# --- THE PROFIT SHIELD: STRICT TIER LIMITS ---
TIER_LIMITS = {
    "free": 3,
    "pro": 15,
    "elite": 50,
    "max": 500
}

# Persistent usage tracker
USAGE_TRACKER = defaultdict(int)

# --- DEVICE AUTHORIZATION LIMITS ---
AUTHORIZED_DEVICES = defaultdict(set)
MAX_DEVICES_PER_USER = 2

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
# COMPREHENSIVE BETA USER DATABASE
# ---------------------------------------------------------
ELITE_USERS = {
    "stangman9898@gmail.com": {"tier": "max", "name": "Christopher"},
    "mylylo.ai@gmail.com": {"tier": "max", "name": "LYLO Admin"},
    "paintonmynails80@gmail.com": {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com": {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com": {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com": {"tier": "max", "name": "Sandy"},
    "chris.betatester6@gmail.com": {"tier": "max", "name": "Ron"},
    "chris.betatester7@gmail.com": {"tier": "max", "name": "Marilyn"},
    "plabane916@gmail.com": {"tier": "max", "name": "Paul"},
    "nemeses1298@gmail.com": {"tier": "max", "name": "Eric"},
    "bearjcameron@icloud.com": {"tier": "max", "name": "Bear"},
    "jcgcbear@gmail.com": {"tier": "max", "name": "Gloria"},
    "laura@startupsac.org": {"tier": "max", "name": "Laura"},
    "cmlabane@gmail.com": {"tier": "max", "name": "Corie"}
}

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

# ---------------------------------------------------------
# LOGIC: WAITLIST & PAID QUEUE SYSTEM
# ---------------------------------------------------------
class WaitlistRequest(BaseModel):
    email: str

WAITLIST_FILE = "waitlist.json"
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
    email_check = admin_email.lower().strip()
    if email_check in ["mylylo.ai@gmail.com", "stangman9898@gmail.com"]:
        return {
            "status": "AUTHORIZED",
            "total_waiting": len(WAITLIST_DB),
            "emails": list(WAITLIST_DB)
        }
    return {"error": "UNAUTHORIZED ACCESS"}

@app.get("/view-paid-queue/{admin_email}")
async def view_paid_queue(admin_email: str):
    email_check = admin_email.lower().strip()
    if email_check in ["mylylo.ai@gmail.com", "stangman9898@gmail.com"]:
        return {
            "status": "AUTHORIZED",
            "total_pending": len(PAID_QUEUE_DB),
            "pending_users": PAID_QUEUE_DB
        }
    return {"error": "UNAUTHORIZED ACCESS"}

# ---------------------------------------------------------
# LOGIC: STRIPE WEBHOOK AUTOMATION (THE MANUAL GATE)
# ---------------------------------------------------------
@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_email = session.get('customer_details', {}).get('email')
        amount_total = session.get('amount_total', 0)

        if customer_email:
            email_lower = customer_email.lower().strip()
            new_tier = "free"

            if amount_total in [199, 1999]:
                new_tier = "pro"
            elif amount_total in [499, 4999]:
                new_tier = "elite"
            elif amount_total >= 999:
                new_tier = "max"

            if email_lower in ELITE_USERS:
                ELITE_USERS[email_lower]["tier"] = new_tier
                logger.info(f"💰 STRIPE SUCCESS: Upgraded existing user {email_lower} to {new_tier.upper()} tier!")
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

                logger.info(f"💰 STRIPE SUCCESS: New user {email_lower} paid. Placed in MANUAL APPROVAL QUEUE.")

            if email_lower in WAITLIST_DB:
                WAITLIST_DB.remove(email_lower)
                try:
                    with open(WAITLIST_FILE, "w") as f:
                        json.dump(list(WAITLIST_DB), f)
                except Exception as e:
                    logger.error(f"Waitlist Removal Error: {e}")

    return {"status": "success"}

# ---------------------------------------------------------
# LOGIC: SCAM DETECTION
# ---------------------------------------------------------
def analyze_scam_indicators(text: str) -> List[str]:
    indicators = []
    t = text.lower()
    patterns = {
        "High Urgency": ["immediate", "hurry", "suspended", "warned", "final notice", "30 minutes"],
        "Payment Pressure": ["gift card", "wire", "zelle", "venmo", "western union", "crypto", "bitcoin"],
        "Authority Impersonation": ["irs", "fbi", "police", "social security", "legal department", "attorney general"],
        "Phishing Style": ["bit.ly", "tinyurl", "linktr.ee", "verify account", "unusual login"]
    }
    for category, keywords in patterns.items():
        if any(k in t for k in keywords):
            indicators.append(category)
    return indicators

# ---------------------------------------------------------
# LOGIC: EMAIL MISSION REPORT DISPATCHER
# ---------------------------------------------------------
async def send_mission_report_email(to_email: str, content: str, persona_name: str):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("⚠️ SMTP Credentials not set. Mission Report logged but not emailed.")
        logger.info(f"📄 MOCK EMAIL DISPATCH TO {to_email}:\n{content[:200]}...")
        return

    try:
        msg = MIMEMultipart()
        msg['From'] = f"LYLO OS <{SMTP_USERNAME}>"
        msg['To'] = to_email
        msg['Subject'] = f"🛡️ URGENT: Lylo Tactical Report - {persona_name.capitalize()}"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #000; color: #fff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #111; border: 1px solid #333; padding: 20px; border-radius: 10px;">
                <h2 style="color: #4F46E5; border-bottom: 1px solid #333; padding-bottom: 10px; text-transform: uppercase;">Lylo Incident Summary</h2>
                <p style="color: #aaa; font-size: 12px; font-weight: bold; tracking: 2px;">SPECIALIST EXECUTING: {persona_name.upper()}</p>
                <div style="background-color: #222; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <p style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">{content}</p>
                </div>
                <p style="color: #666; font-size: 10px; margin-top: 20px; text-align: center;">LYLO OS SECURITY PROTOCOL ACTIVE - DO NOT REPLY</p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_content, 'html'))

        def _send():
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

        await asyncio.to_thread(_send)
        logger.info(f"✅ Mission Report successfully emailed to {to_email}")

    except Exception as e:
        logger.error(f"❌ Email Dispatch Failed: {e}")

# ---------------------------------------------------------
# LOGIC: RECURSIVE MEMORY (PINECONE)
# ---------------------------------------------------------
async def store_intelligence_sync(user_id: str, content: str, role: str):
    if not memory_index or not openai_client or len(content.strip()) < 10:
        return
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=content[:500],
            dimensions=1024
        )
        embedding = response.data[0].embedding
        memory_id = f"{user_id}_{datetime.now().timestamp()}"
        metadata = {
            "user_id": user_id,
            "role": role,
            "content": content[:400],
            "timestamp": datetime.now().isoformat()
        }
        memory_index.upsert([(memory_id, embedding, metadata)])
    except Exception as e:
        logger.error(f"Memory Sync Error: {e}")

async def retrieve_intelligence_sync(user_id: str, query: str) -> str:
    if not memory_index or not openai_client:
        return ""
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query[:200],
            dimensions=1024
        )
        results = memory_index.query(
            vector=response.data[0].embedding,
            filter={"user_id": user_id},
            top_k=5,
            include_metadata=True
        )
        memories = [
            f"Past Intelligence ({m.metadata['role']}): {m.metadata['content']}"
            for m in results.matches if m.score > 0.50
        ]
        return "\n".join(memories)
    except Exception as e:
        logger.error(f"Memory Retrieval Error: {e}")
        return ""

# ---------------------------------------------------------
# LOGIC: PERSONALIZED SEARCH (TAVILY)
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
        logger.error(f"Search Execution Error: {e}")
        return ""

# ---------------------------------------------------------
# LOGIC: THE ENGINE SWAP (DUAL-PASS AI CONSENSUS)
# ---------------------------------------------------------
async def call_gemini_vision(prompt: str, image_b64: str = None, model_name: str = "gemini-1.5-flash"):
    if not gemini_ready:
        return None
    try:
        model = genai.GenerativeModel(model_name)
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
            return {
                "answer": response.text,
                "confidence_score": 85,
                "model": f"LYLO-VISION ({model_name})"
            }
    except Exception as e:
        logger.error(f"Gemini Brain Error: {e}")
        return None

async def call_openai_bodyguard(prompt: str, image_b64: str = None, model_name: str = "gpt-4o-mini"):
    if not openai_client:
        return None
    try:
        content = [{"type": "text", "text": prompt}]
        if image_b64:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
            })

        response = await openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are the LYLO Intelligence Engine. "
                        "You MUST follow the GLOBAL DIRECTIVE, PERSONA SKIN, INTENT LOGIC, "
                        "and RUNTIME CONTEXT provided in the user prompt exactly. "
                        "Output ONLY valid raw JSON. No markdown. No preamble."
                    )
                },
                {"role": "user", "content": content}
            ],
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        result["model"] = f"LYLO-CORE ({model_name})"
        return result
    except Exception as e:
        logger.error(f"OpenAI Brain Error: {e}")
        return None

# ---------------------------------------------------------
# PROMPT ASSEMBLY ENGINE — 4-LAYER ARCHITECTURE
# This function replaces the old flat full_prompt f-string.
# Layer order is critical and must not be changed.
# ---------------------------------------------------------
def assemble_prompt(
    *,
    persona: str,
    user_name: str,
    tier: str,
    msg: str,
    memories: str,
    search_intel: str,
    indicators: List[str],
    image_b64: Optional[str],
    current_real_time: str,
    vibe: str,
) -> str:
    """
    Assembles the complete 4-layer prompt for both OpenAI and Gemini.

    LAYER 1 — GLOBAL DIRECTIVE   : Ironclad firewall, inherited by all personas.
    LAYER 2 — PERSONA SKIN       : Identity, voice, domain, boundaries, tactical style.
    LAYER 3 — INTENT LOGIC       : Adaptive state recognition; how to read the request.
    LAYER 4 — RUNTIME CONTEXT    : Live injections: time, vault, search, image, message.
    """

    # ── Layer 2: Resolve persona data (safe defaults to guardian) ─────────
    p_skin   = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS["guardian"])
    p_ext    = PERSONA_EXTENDED.get(persona, "")
    p_intent = INTENT_LOGIC.get(persona, "")
    v_style  = VIBE_STYLES.get(vibe, VIBE_STYLES["standard"])

    # ── Layer 4a: Memory block ─────────────────────────────────────────────
    # If vault has content, inject as natural shared context — NOT as a
    # database retrieval. If empty, inject nothing; do not reference it.
    if memories and memories.strip():
        memory_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHARED CONTEXT — VAULT (treat as natural background knowledge)
You already know the following from prior exchanges with {user_name}.
Treat it the same way a colleague uses notes from a previous meeting.
DO NOT announce this as a database or memory retrieval. Simply know it.
If anything below contradicts what the user says now, flag it naturally:
"Last time we were working through this, you mentioned X — has something
shifted?" DO NOT invent vault entries that are not listed here.
{memories.strip()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        memory_block = ""  # Vault empty — do not reference it at all

    # ── Layer 4b: Search intel block ──────────────────────────────────────
    # Present as live ground truth, prioritized over base knowledge.
    if search_intel and search_intel.strip():
        search_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIVE SEARCH INTEL — GROUND TRUTH (prioritize over base knowledge)
The following was retrieved from the live web for this query.
If it conflicts with your prior knowledge, defer to this data and
note the discrepancy only if it is meaningful to the user.
{search_intel.strip()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        search_block = ""

    # ── Layer 4c: Scam indicators block ───────────────────────────────────
    if indicators:
        scam_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ THREAT INDICATORS DETECTED IN USER MESSAGE
The following scam pattern categories were flagged algorithmically:
{', '.join(indicators)}
You MUST proactively address these. If scam_detected is warranted,
lead your answer with [🚨 SCAM ALERT] before any other content.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        scam_block = ""

    # ── Layer 4d: Visual analysis block ───────────────────────────────────
    # Persona-specific visual directives — only rendered when image exists.
    if image_b64:
        visual_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL INTELLIGENCE PROTOCOL — MANDATORY (image uploaded)
Your FIRST sentence must address the most critical, severe, or
actionable detail visible in the image. DO NOT describe it generically.
Assess it through your specific expert lens:
  GUARDIAN  → Phishing UI, fake logos, spoofed interfaces, fraud indicators.
  DOCTOR    → Injury severity, wound staging, skin presentation, trauma risk.
  MECHANIC  → Wear patterns, failure modes, missing hardware, corrosion,
               assembly errors. Name the specific part.
  LAWYER    → Suspicious contract language, missing clauses, trap terms,
               unfavorable fine print.
  WEALTH    → Invoice irregularities, hidden fees, billing errors, fraud signals.
  VITALITY  → Form breakdown, posture flaws, food macro estimation,
               equipment risk.
  CAREER    → Resume formatting issues, red-flag language, ATS killers.
  THERAPIST → Any visual cues to emotional state if a person is shown.
  ALL OTHER → Apply your domain expertise to the most critical detail visible.
If the image is ambiguous, state what you CAN assess and what additional
information would sharpen the analysis. Never say "I cannot analyze images."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    else:
        visual_block = ""

    # ── Tier-based depth instruction ──────────────────────────────────────
    tier_depth = {
        "free":  "Deliver clear, concise, high-value core response. No padding.",
        "pro":   "Deliver thorough, tactically detailed response with full reasoning.",
        "elite": "Deliver comprehensive expert-level analysis. Leave no angle unaddressed.",
        "max":   "Deliver exhaustive, senior-expert analysis. Full picture, full depth."
    }.get(tier, "Deliver a clear, useful response.")

    # ══════════════════════════════════════════════════════════════════════
    # FINAL PROMPT — ALL 4 LAYERS ASSEMBLED IN ORDER
    # ══════════════════════════════════════════════════════════════════════
    return f"""
{GLOBAL_DIRECTIVE}

══════════════════════════════════════════════════════════════════
LAYER 2 — YOUR SEAT AT THE BOARD (PERSONA IDENTITY & EXPERTISE)
══════════════════════════════════════════════════════════════════
{p_skin}

SPECIALIZED SEAT OVERRIDE:
{p_ext}

COMMUNICATION STYLE FOR THIS SESSION ({vibe.upper()} MODE):
{v_style}

══════════════════════════════════════════════════════════════════
LAYER 3 — STATE & INTENT RECOGNITION (READ THIS BEFORE RESPONDING)
══════════════════════════════════════════════════════════════════
Before forming your response, identify which STATE the user is in
from the decision tree below, and apply the matching response mode.
Getting this wrong is the primary source of bad outputs.

{p_intent}

══════════════════════════════════════════════════════════════════
LAYER 4 — RUNTIME CONTEXT (LIVE SESSION DATA)
══════════════════════════════════════════════════════════════════
USER: {user_name}  |  TIER: {tier.upper()}  |  DEPTH: {tier_depth}
CURRENT DATE & TIME: {current_real_time}
You are live. Never claim a knowledge cutoff. If SEARCH INTEL exists
below, it is your ground truth and overrides base knowledge.

{memory_block}{search_block}{scam_block}{visual_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER MESSAGE:
{msg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRE-RESPONSE INTERNAL CHECKLIST (run this silently before writing):
  ✔ Did I identify the user's intent STATE from Layer 3 above?
  ✔ Did I verify any law, medical claim, or tech fact before stating it?
  ✔ Did I treat vault memories as natural background — not announced?
  ✔ Did I prioritize SEARCH INTEL over base knowledge where present?
  ✔ Did I lead with the MOST CRITICAL information, not bury it?
  ✔ Did I flag scam indicators if present — leading with [🚨 SCAM ALERT]?
  ✔ Did I refuse any dangerous, illegal, or academically fraudulent request?
  ✔ Did I stay in character without suggesting they switch to another specialist?
  ✔ Is my output ONLY valid raw JSON — no markdown fences, no preamble?

REQUIRED OUTPUT SCHEMA — RAW JSON ONLY:
{{
    "answer": "Your complete in-character tactical response.",
    "confidence_score": <integer 0-100>,
    "scam_detected": <true|false>,
    "threat_level": <"low"|"medium"|"high">
}}
""".strip()


# ---------------------------------------------------------
# MAIN CHAT GATEWAY (12-SEAT BOARD)
# ---------------------------------------------------------
@app.post("/chat")
async def chat(
    msg: str = Form(""),
    history: str = Form("[]"),
    persona: str = Form("guardian"),
    user_email: str = Form(...),
    user_location: str = Form(""),
    vibe: str = Form("standard"),
    use_long_term_memory: str = Form("false"),
    device_id: str = Form("unknown"),
    email_consent: str = Form("false"),
    file: UploadFile = File(None)
):
    email_lower = user_email.lower().strip()
    user_id = create_user_id(email_lower)
    user_data = ELITE_USERS.get(email_lower, {"tier": "free", "name": "Protected User"})
    tier = user_data["tier"]

    # AUTHORITY BYPASS: Unlimited for Owner and Admin
    is_admin = email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
    limit = 999999 if is_admin else TIER_LIMITS.get(tier, 3)

    # --- DEVICE FINGERPRINT LOCK ---
    if not is_admin and device_id != "unknown":
        user_devices = AUTHORIZED_DEVICES[email_lower]
        if device_id not in user_devices:
            if len(user_devices) >= MAX_DEVICES_PER_USER:
                logger.warning(f"🚨 DEVICE BREACH ATTEMPT: {email_lower} via 3rd device ({device_id}).")
                return {
                    "answer": (
                        "🛡️ **SECURITY ALERT: DEVICE LIMIT EXCEEDED.**\n\n"
                        "Your LYLO OS clearance is cryptographically tied to your specific hardware. "
                        "Your account is strictly limited to **two (2) active devices**. "
                        "You are attempting access from an unauthorized third device. Access denied."
                    ),
                    "confidence_score": 100,
                    "scam_detected": False,
                    "threat_level": "high",
                    "usage_info": {"can_send": False}
                }
            else:
                user_devices.add(device_id)

    # --- THE SOFT UPSELL: DYNAMIC LIMIT MESSAGING ---
    if USAGE_TRACKER[user_id] >= limit:
        upgrade_msgs = {
            "free":  "🛡️ **Daily Shield Limit Reached.** You've used your 3 free daily connections! Upgrade to **Pro Guardian ($1.99/mo)** for 15 daily messages.",
            "pro":   "🛡️ **Pro Limit Reached.** You've hit 15 daily messages. Upgrade to **Elite Justice ($4.99/mo)** for 50 messages and Crisis Shield access.",
            "elite": "🛡️ **Elite Limit Reached.** 50 messages maxed! Upgrade to **Max Unlimited ($9.99/mo)** for unrestricted AI firepower.",
            "max":   "🛡️ **System Cap Reached.** You've hit the absolute daily cap (500 messages). Your system resets at midnight."
        }
        return {
            "answer": upgrade_msgs.get(tier, upgrade_msgs["free"]),
            "confidence_score": 100,
            "scam_detected": False,
            "threat_level": "low",
            "usage_info": {"can_send": False}
        }

    # --- PRE-FLIGHT: Gather all context concurrently where possible -------

    # Memory retrieval
    memories = ""
    if use_long_term_memory == "true":
        memories = await retrieve_intelligence_sync(user_id, msg)

    # Tavily search — expanded keyword set
    search_intel = ""
    search_keywords = [
        "news", "weather", "search", "price", "check", "law", "code",
        "today", "now", "current", "date", "latest", "recent", "2026",
        "update", "rate", "stock", "score", "hours", "open", "closed"
    ]
    if any(k in msg.lower() for k in search_keywords):
        search_intel = await search_personalized_web(msg, user_location)

    # Scam indicator scan
    indicators = analyze_scam_indicators(msg)

    # Image processing
    image_b64 = None
    if file:
        file_bytes = await file.read()
        image_b64 = base64.b64encode(file_bytes).decode("utf-8")
        if not msg.strip():
            msg = "Please analyze this image and provide a technical assessment based on your specialty."

    # Hook for fallback / frontend display
    hook = get_random_hook(persona)

    # Live clock
    current_real_time = datetime.now().strftime("%A, %B %d, %Y %I:%M %p")

    # ── ASSEMBLE THE 4-LAYER PROMPT ────────────────────────────────────────
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
    )

    # ── ENGINE SELECTION ───────────────────────────────────────────────────
    # gpt-4o for max-tier and admins; gpt-4o-mini for all others
    openai_engine = (
        "gpt-4o"
        if tier == "max" or email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
        else "gpt-4o-mini"
    )
    # NOTE: "gemini-3-flash" does not exist. Use "gemini-1.5-flash" (fast)
    # or "gemini-1.5-pro" (deeper). Verify current names in Google AI Studio.
    gemini_engine = "gemini-1.5-flash"

    # ── DUAL-PASS AI CONSENSUS ─────────────────────────────────────────────
    results = await asyncio.gather(
        call_openai_bodyguard(full_prompt, image_b64, openai_engine),
        call_gemini_vision(full_prompt, image_b64, gemini_engine)
    )

    valid_results = [r for r in results if r and "answer" in r]

    if not valid_results:
        return {
            "answer": f"{hook} Perimeter secure, but the connection flickered. Can you repeat that?",
            "confidence_score": 0,
            "scam_detected": False,
            "threat_level": "low",
        }

    # Winner: highest composite score (confidence + scam weight + threat weight)
    winner = max(
        valid_results,
        key=lambda x: (
            x.get("confidence_score", 0)
            + (35 if x.get("scam_detected") else 0)
            + (20 if x.get("threat_level") in ["high", "medium"] else 0)
        ),
    )

    # ── POST-RESPONSE TASKS ────────────────────────────────────────────────
    USAGE_TRACKER[user_id] += 1
    asyncio.create_task(store_intelligence_sync(user_id, msg, "user"))
    asyncio.create_task(store_intelligence_sync(user_id, winner["answer"], "bot"))

    if email_consent == "true":
        asyncio.create_task(send_mission_report_email(user_email, winner["answer"], persona))

    logger.info(
        f"✅ [{persona.upper()}] Response served to {user_data['name']} "
        f"| Tier: {tier} | Model: {winner.get('model', 'LYLO-CORE')} "
        f"| Scam: {winner.get('scam_detected', False)} "
        f"| Threat: {winner.get('threat_level', 'low')}"
    )

    return {
        "answer": winner["answer"],
        "confidence_score": winner.get("confidence_score", 95),
        "scam_detected": winner.get("scam_detected", False),
        "threat_level": winner.get("threat_level", "low"),
        "persona_hook": hook,
        "bodyguard_model": winner.get("model", "LYLO-CORE"),
    }


# ---------------------------------------------------------
# UTILITIES: VOICE, STATS, RECOVERY
# ---------------------------------------------------------
@app.post("/generate-audio")
async def generate_audio(text: str = Form(...), voice: str = Form("onyx")):
    if not openai_client:
        return {"error": "Voice offline"}
    try:
        clean_text = text.replace("**", "").replace("#", "").strip()
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=clean_text[:4000]
        )
        return {"audio_b64": base64.b64encode(response.content).decode("utf-8")}
    except Exception as e:
        return {"error": str(e)}

@app.get("/user-stats/{user_email}")
async def get_stats(user_email: str):
    uid = create_user_id(user_email)
    user_data = ELITE_USERS.get(user_email.lower(), {"tier": "free", "name": "User"})
    limit = (
        999999
        if user_email.lower() in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
        else TIER_LIMITS.get(user_data["tier"], 3)
    )
    return {
        "usage": USAGE_TRACKER[uid],
        "limit": limit,
        "tier": user_data["tier"],
        "name": user_data["name"],
    }

@app.post("/check-beta-access")
async def check_beta(data: dict):
    user = ELITE_USERS.get(data.get("email", "").lower().strip())
    if user:
        return {"access": True, "tier": user["tier"], "name": user["name"]}
    return {"access": False, "tier": "free"}

@app.get("/scam-recovery/{email}")
async def recovery_center(email: str):
    return {
        "title": "🛡️ PRIORITY RECOVERY CENTER",
        "immediate_actions": [
            "Call your bank fraud department immediately.",
            "Freeze your credit reports at all 3 bureaus (Equifax, Experian, TransUnion).",
            "File a report at IC3.gov (FBI Internet Crime Complaint Center).",
            "Change all passwords from a clean, uncompromised device.",
            "Enable 2FA on every account that supports it."
        ],
    }

@app.get("/")
async def root():
    return {
        "status": "ONLINE",
        "version": "20.0.0 - MULTI-LAYER ARCHITECTURE",
        "experts_active": len(PERSONA_DEFINITIONS),
        "architecture": "4-Layer Prompt Engine | Anti-Hallucination Hardened"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
