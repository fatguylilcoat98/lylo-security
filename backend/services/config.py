"""
LYLO OS — services/config.py
All environment variables, API keys, global state, and client initialization.
Import this everywhere instead of re-reading os.getenv() in each file.
"""
import os
import json
import hashlib
import logging
from collections import defaultdict

import stripe
from pinecone import Pinecone, ServerlessSpec
from tavily import TavilyClient
from openai import AsyncOpenAI
from google import genai
from google.oauth2 import service_account
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# LOGGING
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(name)s]  %(levelname)-8s %(message)s"
)
logger = logging.getLogger("LYLO")

# =============================================================================
# ENV / API KEYS
# =============================================================================
TAVILY_API_KEY           = os.getenv("TAVILY_API_KEY",           "").strip()
PINECONE_API_KEY         = os.getenv("PINECONE_API_KEY",         "").strip()
GEMINI_API_KEY           = os.getenv("GEMINI_API_KEY",           "").strip()
VERTEX_PROJECT           = os.getenv("VERTEX_PROJECT",           "").strip()
VERTEX_LOCATION          = os.getenv("VERTEX_LOCATION",          "us-central1").strip()
GOOGLE_CREDENTIALS_FILE  = "/etc/secrets/google_credentials.json"
OPENAI_API_KEY           = os.getenv("OPENAI_API_KEY",           "").strip()
CLAUDE_API_KEY           = os.getenv("CLAUDE_API_KEY",           "").strip()
ANTHROPIC_API_KEY        = os.getenv("ANTHROPIC_API_KEY",        "").strip()

STRIPE_SECRET_KEY        = os.getenv("STRIPE_SECRET_KEY",        "").strip()
STRIPE_WEBHOOK_SECRET    = os.getenv("STRIPE_WEBHOOK_SECRET",    "").strip()
stripe.api_key           = STRIPE_SECRET_KEY

SMTP_SERVER   = os.getenv("SMTP_SERVER",   "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# =============================================================================
# TIER LIMITS & RUNTIME STATE
# =============================================================================
TIER_LIMITS = {"free": 3, "pro": 15, "elite": 50, "max": 500}
USAGE_TRACKER        = defaultdict(int)
CONVO_CONTEXT: dict  = defaultdict(list)
MAX_CONVO_CONTEXT    = 6
AUTHORIZED_DEVICES   = defaultdict(set)
MAX_DEVICES_PER_USER = 2
_PROFILE_CACHE       = {}
_PROFILE_CACHE_TTL   = 600   # 10 min

# Semantic domain anchors for persona routing
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
_ANCHOR_EMBEDDINGS: dict[str, list[float]] = {}
_ANCHOR_CACHE_LOCK = None   # set to asyncio.Lock() on first use

# =============================================================================
# ELITE USER DATABASE
# =============================================================================
BETA_USERS_FILE = "/etc/secrets/beta_users.json"
if not os.path.exists(BETA_USERS_FILE):
    BETA_USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "beta_users.json")

def _load_beta_users() -> dict:
    try:
        if os.path.exists(BETA_USERS_FILE):
            with open(BETA_USERS_FILE) as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load beta_users.json: {e}")
    return {}

def _save_beta_users(data: dict):
    try:
        os.makedirs(os.path.dirname(BETA_USERS_FILE), exist_ok=True)
        with open(BETA_USERS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Could not save beta_users.json: {e}")

ADMIN_USERS = {
    "stangman9898@gmail.com":     {"tier": "max", "name": "Christopher"},
    "mylylo.ai@gmail.com":        {"tier": "max", "name": "LYLO Admin"},
    "bearjcameron@icloud.com":    {"tier": "pro", "name": "Bear",   "beta": True},
    "paintonmynails80@gmail.com": {"tier": "pro", "name": "Aubrey", "beta": True},
}
_BETA_USERS_DB = _load_beta_users()
ELITE_USERS    = {**ADMIN_USERS, **_BETA_USERS_DB}
ELITE_TIERS    = {"elite", "max"}

def create_user_id(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]

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
                name=index_name, dimension=1024, metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        memory_index = pc.Index(index_name)
        logger.info("✅ Intelligence Sync Ready")
    except Exception as e:
        logger.error(f"❌ Sync Index Failed: {e}")

gemini_ready  = False
gemini_client = None
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
            vertexai=True, project=_project,
            location=VERTEX_LOCATION, credentials=_credentials,
        )
        gemini_ready = True
        logger.info(f"✅ Gemini Ready — Vertex AI (project={_project})")
    except Exception as e:
        logger.error(f"❌ Vertex AI Setup Failed: {e}")

openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ OpenAI Digital Bodyguard Ready")
    except Exception as e:
        logger.error(f"❌ OpenAI Setup Failed: {e}")

claude_client     = None
anthropic_client  = None
try:
    import anthropic as _anthropic
    if CLAUDE_API_KEY:
        claude_client = _anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
        logger.info("✅ Claude Validator Ready")
    if ANTHROPIC_API_KEY:
        anthropic_client = _anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        logger.info("✅ Claude Lane Enforcer Ready")
    elif not ANTHROPIC_API_KEY:
        logger.warning("⚠️ No ANTHROPIC_API_KEY — Lane Enforcer disabled")
except Exception as e:
    logger.error(f"❌ Claude Setup Failed: {e}")
