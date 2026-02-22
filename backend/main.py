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
    get_random_hook, get_all_hooks
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
    version="23.0.0 - STEALTH DIRECTIVE + NATURALISM MANDATE"
)

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
# BETA USER DATABASE
# ---------------------------------------------------------
ELITE_USERS = {
    "stangman9898@gmail.com":       {"tier": "max", "name": "Christopher"},
    "mylylo.ai@gmail.com":          {"tier": "max", "name": "LYLO Admin"},
    "paintonmynails80@gmail.com":   {"tier": "max", "name": "Aubrey"},
    "tiffani.hughes@yahoo.com":     {"tier": "max", "name": "Tiffani"},
    "jcdabearman@gmail.com":        {"tier": "max", "name": "Jeff"},
    "birdznbloomz2b@gmail.com":     {"tier": "max", "name": "Sandy"},
    "chris.betatester6@gmail.com":  {"tier": "max", "name": "Ron"},
    "chris.betatester7@gmail.com":  {"tier": "max", "name": "Marilyn"},
    "plabane916@gmail.com":         {"tier": "max", "name": "Paul"},
    "nemeses1298@gmail.com":        {"tier": "max", "name": "Eric"},
    "bearjcameron@icloud.com":      {"tier": "max", "name": "Bear"},
    "jcgcbear@gmail.com":           {"tier": "max", "name": "Gloria"},
    "laura@startupsac.org":         {"tier": "max", "name": "Laura"},
    "cmlabane@gmail.com":           {"tier": "max", "name": "Corie"}
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

# ---------------------------------------------------------
# EMAIL MISSION REPORT
# ---------------------------------------------------------
async def send_mission_report_email(to_email: str, content: str, persona_name: str):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("⚠️ SMTP not set — Mission Report mock-dispatched.")
        return

    try:
        msg = MIMEMultipart()
        msg['From']    = f"LYLO OS <{SMTP_USERNAME}>"
        msg['To']      = to_email
        msg['Subject'] = f"🛡️ URGENT: Lylo Tactical Report - {persona_name.capitalize()}"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #000; color: #fff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #111; border: 1px solid #333; padding: 20px; border-radius: 10px;">
                <h2 style="color: #4F46E5; border-bottom: 1px solid #333; padding-bottom: 10px; text-transform: uppercase;">Lylo Incident Summary</h2>
                <p style="color: #aaa; font-size: 12px; font-weight: bold;">SPECIALIST: {persona_name.upper()}</p>
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
        logger.info(f"✅ Mission Report sent to {to_email}")
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
        results = memory_index.query(
            vector=response.data[0].embedding,
            filter={
                "user_id":     {"$eq": user_id},
                "record_type": {"$eq": "episodic"}   # Exclude profile records
            },
            top_k=5,
            include_metadata=True
        )
        memories = [
            f"Past Intelligence ({m.metadata['role']}): {m.metadata['content']}"
            for m in results.matches
            if m.score > 0.50
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

    Returns the profile dict, or {} if no profile exists yet.
    """
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
                logger.info(f"✅ Profile loaded for user {user_id[:8]}...")
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
        )
        result = json.loads(response.choices[0].message.content)
        result["model"] = f"LYLO-CORE ({model_name})"
        return result
    except Exception as e:
        logger.error(f"OpenAI Brain Error: {e}")
        return None


# ---------------------------------------------------------
# PROMPT ASSEMBLY ENGINE — 5-LAYER ARCHITECTURE
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
    user_location:     str = "",    # For proactive location trigger
    user_email:        str = "",    # NEW — used to pull warm-start registry entry
) -> str:

    # ── Resolve persona content ────────────────────────────────────────────
    p_skin   = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS["guardian"])
    p_ext    = PERSONA_EXTENDED.get(persona, "")
    p_intent = INTENT_LOGIC.get(persona, "")
    v_style  = VIBE_STYLES.get(vibe, VIBE_STYLES["standard"])

    # ── LAYER 0: USER_IDENT_CORE ───────────────────────────────────────────
    # Check warm-start registry first. If found, it overrides/enriches the
    # synthesized profile. Warm-start wins on every field conflict.
    warm_start = get_warm_start_profile(user_email) if user_email else {}
    layer_0    = build_user_ident_core(user_profile, warm_start=warm_start)

    # ── LAYER 4a: Episodic Memory block ───────────────────────────────────
    # Empty vault = inject nothing. Never announce an empty vault.
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
    # FINAL ASSEMBLED PROMPT — 5 LAYERS IN ORDER
    # Layer 0 is pinned first so the specialist knows the HUMAN before the RULES.
    # ══════════════════════════════════════════════════════════════════════
    return f"""
{layer_0}

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

{proactive_block}{memory_block}{search_block}{scam_block}{visual_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER MESSAGE:
{msg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRE-RESPONSE CHECKLIST (run silently before writing):
  ✔ Did I read Layer 0 and personalize my response to this specific user?
  ✔ If PROACTIVE MODE is active, did I bring that item up FIRST?
  ✔ Did I identify the user's intent STATE from Layer 3?
  ✔ Did I verify laws, medical claims, or tech facts before stating them?
  ✔ Did I treat vault memories as natural background — not announced?
  ✔ Did I prioritize SEARCH INTEL over base knowledge where present?
  ✔ Did I lead with the MOST CRITICAL information?
  ✔ Did I flag scam indicators with [🚨 SCAM ALERT] if warranted?
  ✔ Did I stay in character without suggesting another specialist?
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
# MAIN CHAT GATEWAY — 12-SEAT BOARD
# ---------------------------------------------------------
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
                return {
                    "answer": (
                        "🛡️ **SECURITY ALERT: DEVICE LIMIT EXCEEDED.**\n\n"
                        "Your LYLO OS clearance is tied to specific hardware. "
                        "Your account is limited to **two (2) active devices**. "
                        "Access from this unauthorized third device is denied."
                    ),
                    "confidence_score": 100,
                    "scam_detected": False,
                    "threat_level": "high",
                    "usage_info": {"can_send": False}
                }
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
        return {
            "answer": upgrade_msgs.get(tier, upgrade_msgs["free"]),
            "confidence_score": 100,
            "scam_detected": False,
            "threat_level": "low",
            "usage_info": {"can_send": False}
        }

    # --- PRE-FLIGHT DATA GATHERING ---

    # Episodic memory retrieval
    memories = ""
    if use_long_term_memory == "true":
        memories = await retrieve_intelligence_sync(user_id, msg)

    # Synthesized identity profile (Layer 0 data)
    # Always fetched — lightweight direct Pinecone fetch(), not a vector query
    user_profile = await retrieve_user_profile(user_id)

    # Tavily search — enriched with ZIP-level location for warm-start users
    search_intel = ""
    search_keywords = [
        "news", "weather", "search", "price", "check", "law", "code",
        "today", "now", "current", "date", "latest", "recent", "2026",
        "update", "rate", "stock", "score", "hours", "open", "closed"
    ]
    if any(k in msg.lower() for k in search_keywords):
        # Use ZIP-precise location for backend search; city name used in conversation
        loc_data       = get_user_location_data(email_lower)
        search_location = (
            f"{loc_data['city']}, {loc_data['state']} {loc_data['zip']}"
            if loc_data["zip"]
            else user_location or ""
        )
        search_intel = await search_personalized_web(msg, search_location)

    # Scam scan
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
        user_profile=user_profile,       # Synthesized (Pinecone)
        user_location=user_location,     # Proactive trigger input
        user_email=email_lower,          # Warm-start registry lookup
    )

    # ── ENGINE SELECTION ───────────────────────────────────────────────────
    openai_engine = (
        "gpt-4o"
        if tier == "max" or email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
        else "gpt-4o-mini"
    )
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
    current_count = USAGE_TRACKER[user_id]

    # Store episodic memories
    asyncio.create_task(store_intelligence_sync(user_id, msg, "user"))
    asyncio.create_task(store_intelligence_sync(user_id, winner["answer"], "bot"))

    # PROACTIVE LEARNING ENGINE: Trigger profile synthesis every N interactions
    if current_count % SYNTHESIS_INTERVAL == 0:
        logger.info(f"🧠 Synthesis scheduled at interaction {current_count} for {user_data['name']}")
        asyncio.create_task(synthesize_user_profile(user_id, user_data["name"]))

    # Email report
    if email_consent == "true":
        asyncio.create_task(send_mission_report_email(user_email, winner["answer"], persona))

    logger.info(
        f"✅ [{persona.upper()}] → {user_data['name']} | Tier: {tier} | "
        f"Model: {winner.get('model', 'LYLO-CORE')} | "
        f"Interaction #{current_count} | "
        f"Warm-Start: {'✓' if email_lower in BETA_USER_PROFILES else '—'} | "
        f"Profile: {'loaded' if user_profile else 'sparse'} | "
        f"Proactive: {'active' if memories else 'off'} | "
        f"Scam: {winner.get('scam_detected', False)} | "
        f"Threat: {winner.get('threat_level', 'low')}"
    )

    return {
        "answer":          winner["answer"],
        "confidence_score": winner.get("confidence_score", 95),
        "scam_detected":   winner.get("scam_detected", False),
        "threat_level":    winner.get("threat_level", "low"),
        "persona_hook":    hook,
        "bodyguard_model": winner.get("model", "LYLO-CORE"),
    }


# ---------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------
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
        "version":      "22.0.0 - WARM START REGISTRY + PROACTIVE LEARNING ENGINE",
        "experts_active": len(PERSONA_DEFINITIONS),
        "architecture": "5-Layer Prompt | Profile Synthesis | Proactive Triggers | Anti-Hallucination"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
