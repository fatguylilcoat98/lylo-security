"""LYLO OS — services/memory_engine.py"""
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

from services.config import (
    memory_index, openai_client,
    _PROFILE_CACHE, _PROFILE_CACHE_TTL, create_user_id,
    MED_VAULT_ENABLED,
)

# ── Vector ID suffixes ────────────────────────────────────────────────────────
try:
    from intelligence_data import PROFILE_VECTOR_ID_SUFFIX, INTAKE_VECTOR_ID_SUFFIX
except ImportError:
    PROFILE_VECTOR_ID_SUFFIX = "_profile"
    INTAKE_VECTOR_ID_SUFFIX  = "_intake"

logger = logging.getLogger("LYLO.Memory")

# =============================================================================
# MISSING CONSTANTS — defined here so the module is self-contained
# =============================================================================

PROFILE_EMBEDDING_ANCHOR = "user profile summary identity background occupation goals"

SYNTHESIS_MEMORY_WINDOW = 20

PIN_KEYWORDS: Dict[str, List[str]] = {
    "medical":    ["doctor", "medication", "diagnosis", "symptom", "surgery", "prescription",
                   "hospital", "pain", "condition", "treatment", "allergy", "blood pressure"],
    "legal":      ["lawsuit", "attorney", "contract", "eviction", "lawsuit", "court",
                   "legal", "sue", "rights", "warrant", "settlement", "lease"],
    "financial":  ["debt", "loan", "credit", "invest", "savings", "budget", "mortgage",
                   "bankruptcy", "income", "tax", "retirement", "401k"],
    "family":     ["wife", "husband", "kids", "children", "divorce", "marriage",
                   "mom", "dad", "parent", "family", "relationship"],
    "career":     ["job", "work", "boss", "fired", "hired", "salary", "resume",
                   "interview", "promotion", "career", "business", "startup"],
    "vehicle":    ["car", "truck", "vehicle", "engine", "brake", "transmission",
                   "mechanic", "repair", "oil change", "tire", "accident"],
    "housing":    ["rent", "lease", "landlord", "mortgage", "house", "apartment",
                   "eviction", "deposit", "tenant", "property"],
    "identity":   ["my name is", "i am", "i'm a", "i work as", "i live in",
                   "i have", "my age", "i was born", "i moved"],
}

PROFILE_SYNTHESIS_SYSTEM_PROMPT = """You are a profile synthesis engine for LYLO OS.
Analyze the user's conversation history and extract a structured profile.
Return ONLY valid JSON with these fields:
{
  "name": "user's name if mentioned",
  "occupation": "job or role",
  "location": "city/state if mentioned",
  "family": "family situation summary",
  "goals": ["list of key goals"],
  "challenges": ["list of current challenges"],
  "health_notes": "any health info mentioned",
  "financial_notes": "any financial info mentioned",
  "vehicles": ["any vehicles mentioned"],
  "housing": "housing situation",
  "key_facts": ["any other important facts"],
  "last_updated": ""
}
Keep values concise. Use empty string or empty list if unknown."""

PROFILE_SYNTHESIS_USER_TEMPLATE = """Analyze these conversation fragments and build the user profile:

{memory_text}

Return the profile as JSON only."""

# =============================================================================
# PIN DETECTION
# =============================================================================

def auto_detect_pin_category(message: str) -> tuple[str, str] | None:
    """
    Scans user message for pinnable intel.
    Returns (pin_text, category) if detected, else None.
    """
    msg_lower = message.lower()
    for category, keywords in PIN_KEYWORDS.items():
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, msg_lower):
                return (message.strip()[:200], category)
    return None


async def store_intelligence_sync(user_id: str, content: str, role: str, persona: str = "general"):
    if not memory_index or not openai_client or len(content.strip()) < 10:
        return
    try:
        resp      = await openai_client.embeddings.create(
            model="text-embedding-3-small", input=content[:500], dimensions=1024
        )
        embedding = resp.data[0].embedding
        mem_id    = f"{user_id}_{datetime.now().timestamp()}"
        # Therapy-Safe Split (Council v1) — domain tag isolates trauma memories
        domain_tag = "therapy" if persona.lower() == "therapist" else "general"
        memory_index.upsert([(mem_id, embedding, {
            "user_id":     user_id,
            "role":        role,
            "content":     content[:400],
            "timestamp":   datetime.now().isoformat(),
            "record_type": "episodic",
            "persona":     persona,
            "domain":      domain_tag,   # NEW: therapy | general
        })])
    except Exception as e:
        logger.error(f"Memory Sync Error: {e}")


# Silo-aware memory retrieval
_PERSONA_MEMORY_SILOS = {
    "pastor":    {"pastor", "general"},
    "doctor":    {"doctor", "general"},
    "therapist": {"therapist", "general"},
    "lawyer":    {"lawyer", "general"},
    "mechanic":  {"mechanic", "general"},
    "wealth":    {"wealth", "general"},
    "career":    {"career", "general"},
    "guardian":  {"guardian", "general"},
    "vitality":  {"vitality", "general"},
    "tutor":     {"tutor", "general"},
    "hype":      {"hype", "general"},
    "bestie":    {"bestie", "therapist", "general"},
}


async def retrieve_intelligence_sync(user_id: str, query: str, persona: str = "general") -> str:
    if not memory_index or not openai_client:
        return ""
    try:
        _q_lower = query.lower()
        _asset_keywords = ""
        if any(w in _q_lower for w in [
            "car","vehicle","drive","drove","broke","fix","mechanic",
            "bronco","ford","truck","test drive","dealership","suv","pickup",
            "mustang","tacoma","silverado","chevy","toyota","honda","jeep",
        ]):
            _asset_keywords = " car vehicle test drive purchase bronco ford truck"
        elif any(w in _q_lower for w in ["health","sick","pain","doctor","medication","symptom"]):
            _asset_keywords = " health medical symptom"
        elif any(w in _q_lower for w in ["money","invest","debt","finance","budget"]):
            _asset_keywords = " finance money investment"
        # Persona-based boost — mechanic context always adds vehicle keywords
        if persona in {"mechanic"} and not _asset_keywords:
            _asset_keywords = " car vehicle repair mechanic"
        asset_query = f"{query}{_asset_keywords}"
        resp = await openai_client.embeddings.create(
            model="text-embedding-3-small", input=asset_query[:300], dimensions=1024
        )
        # Therapy-Safe Split (Council v1) — domain filter (legacy-safe via $ne)
        # Therapist: ONLY therapy memories
        # Everyone else: anything NOT therapy (preserves legacy untagged records)
        if persona.lower() == "therapist":
            domain_filter = {"domain": {"$eq": "therapy"}}
        else:
            domain_filter = {"domain": {"$ne": "therapy"}}

        pinecone_filter = {
            "user_id":     {"$eq": user_id},
            "record_type": {"$eq": "episodic"},
            **domain_filter,
        }
        results = memory_index.query(
            vector=resp.data[0].embedding,
            filter=pinecone_filter,
            top_k=8, include_metadata=True,
        )
        if not results.matches:
            # Fallback: same domain restriction, no persona filter — still honor the wall
            results = memory_index.query(
                vector=resp.data[0].embedding,
                filter={"user_id": {"$eq": user_id}, "record_type": {"$eq": "episodic"}, **domain_filter},
                top_k=5, include_metadata=True,
            )
        memories = [
            f"Past Intelligence ({m.metadata['role']}): {m.metadata['content']}"
            for m in results.matches if m.score > 0.55  # Lowered from 0.65 — catches older/fuzzier memories
        ]
        return "\n".join(memories)
    except Exception as e:
        logger.error(f"Memory Retrieval Error: {e}")
        return ""


# =============================================================================
# PROFILE SYNTHESIS
# =============================================================================

async def retrieve_user_profile(user_id: str) -> dict:
    cached = _PROFILE_CACHE.get(user_id)
    if cached:
        profile, ts = cached
        if time.time() - ts < _PROFILE_CACHE_TTL:
            return profile
        del _PROFILE_CACHE[user_id]

    if not memory_index:
        return {}

    profile_id = f"{user_id}{PROFILE_VECTOR_ID_SUFFIX}"
    try:
        result  = memory_index.fetch(ids=[profile_id])
        vectors = result.get("vectors", {})
        if profile_id in vectors:
            raw = vectors[profile_id].get("metadata", {}).get("profile_json", "")
            if raw:
                profile = json.loads(raw)
                _PROFILE_CACHE[user_id] = (profile, time.time())
                return profile
    except Exception as e:
        logger.error(f"Profile Retrieval Error: {e}")
    return {}


async def synthesize_user_profile(user_id: str, user_name: str):
    if not memory_index or not openai_client:
        return
    logger.info(f"🧠 SYNTHESIS TRIGGERED for {user_name} ({user_id[:8]}...)")
    try:
        anchor_resp = await openai_client.embeddings.create(
            model="text-embedding-3-small", input=PROFILE_EMBEDDING_ANCHOR, dimensions=1024
        )
        anchor_vec = anchor_resp.data[0].embedding
        results    = memory_index.query(
            vector=anchor_vec,
            filter={"user_id": {"$eq": user_id}, "record_type": {"$eq": "episodic"}},
            top_k=SYNTHESIS_MEMORY_WINDOW, include_metadata=True,
        )
        if not results.matches:
            return
        frags = [f"[{m.metadata.get('role','?').upper()}] {m.metadata.get('content','')}" for m in results.matches]
        synth = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PROFILE_SYNTHESIS_SYSTEM_PROMPT},
                {"role": "user",   "content": PROFILE_SYNTHESIS_USER_TEMPLATE.format(memory_text="\n".join(frags))},
            ],
            response_format={"type": "json_object"},
        )
        profile_dict = json.loads(synth.choices[0].message.content)
        if not profile_dict.get("name"):
            profile_dict["name"] = user_name
        profile_dict["last_updated"] = datetime.now().isoformat()
        profile_id = f"{user_id}{PROFILE_VECTOR_ID_SUFFIX}"
        memory_index.upsert([(profile_id, anchor_vec, {
            "user_id":      user_id,
            "record_type":  "profile",
            "profile_json": json.dumps(profile_dict),
            "last_updated": profile_dict["last_updated"],
        })])
        logger.info(f"✅ SYNTHESIS COMPLETE for {user_name}")
    except Exception as e:
        logger.error(f"❌ Profile Synthesis Error: {e}")


# =============================================================================
# MED-VAULT PINECONE STORAGE
# =============================================================================
_VAULT_SUFFIX = "_medvault_v1"
_VAULT_CACHE: dict = {}
_VAULT_CACHE_TTL = 120


async def _load_vault_encrypted(user_id: str) -> Optional[str]:
    cached = _VAULT_CACHE.get(user_id)
    if cached:
        blob, ts = cached
        if time.time() - ts < _VAULT_CACHE_TTL:
            return blob
    if not memory_index:
        return None
    vault_id = f"{user_id}{_VAULT_SUFFIX}"
    try:
        result  = memory_index.fetch(ids=[vault_id])
        vectors = result.get("vectors", {})
        if vault_id in vectors:
            blob = vectors[vault_id].get("metadata", {}).get("vault_enc", "")
            if blob:
                _VAULT_CACHE[user_id] = (blob, time.time())
                return blob
    except Exception as e:
        logger.warning(f"Vault load error: {e}")
    return None

async def _save_vault_encrypted(user_id: str, encrypted_blob: str) -> bool:
    if not memory_index:
        return False
    vault_id   = f"{user_id}{_VAULT_SUFFIX}"
    anchor_vec = [0.0] * 1024
    anchor_vec[0] = 0.99
    try:
        memory_index.upsert([(vault_id, anchor_vec, {
            "user_id":      user_id,
            "record_type":  "med_vault",
            "vault_enc":    encrypted_blob,
            "last_updated": datetime.now().isoformat(),
        })])
        _VAULT_CACHE[user_id] = (encrypted_blob, time.time())
        return True
    except Exception as e:
        logger.error(f"Vault save error: {e}")
        return False

async def load_vault(user_id: str, email: str, pin: str = "") -> Optional[dict]:
    if not MED_VAULT_ENABLED:
        return None
    blob = await _load_vault_encrypted(user_id)
    if not blob:
        return None
    return decrypt_silo(blob, email, pin)

async def save_vault(user_id: str, email: str, vault: dict, pin: str = "") -> bool:
    if not MED_VAULT_ENABLED:
        return False
    blob = encrypt_silo(vault, email, pin)
    return await _save_vault_encrypted(user_id, blob)

async def get_or_create_vault(user_id: str, email: str, pin: str = "") -> dict:
    vault = await load_vault(user_id, email, pin)
    if vault is None:
        vault = empty_medical_vault()
        await save_vault(user_id, email, vault, pin)
    return vault

async def _noop_vault(): return None


# =============================================================================
# PERSONALIZED SEARCH (TAVILY)
# =============================================================================

async def retrieve_intake_profile(user_id: str) -> dict:
    cache_key = f"{user_id}_intake"
    cached    = _PROFILE_CACHE.get(cache_key)
    if cached:
        profile, ts = cached
        if time.time() - ts < _PROFILE_CACHE_TTL:
            return profile
        del _PROFILE_CACHE[cache_key]

    if not memory_index:
        return {}

    intake_id = f"{user_id}{INTAKE_VECTOR_ID_SUFFIX}"
    try:
        result  = memory_index.fetch(ids=[intake_id])
        vectors = result.get("vectors", {})
        if intake_id in vectors:
            raw = vectors[intake_id].get("metadata", {}).get("intake_json", "")
            if raw:
                profile = json.loads(raw)
                _PROFILE_CACHE[cache_key] = (profile, time.time())
                return profile
    except Exception as e:
        logger.error(f"Intake Profile Retrieval Error: {e}")
    return {}


async def store_intake_profile(user_id: str, profile: dict):
    if not memory_index or not openai_client:
        return
    try:
        anchor    = PROFILE_EMBEDDING_ANCHOR
        resp      = await openai_client.embeddings.create(
            model="text-embedding-3-small", input=anchor, dimensions=1024
        )
        embedding = resp.data[0].embedding
        intake_id = f"{user_id}{INTAKE_VECTOR_ID_SUFFIX}"
        memory_index.upsert([(intake_id, embedding, {
            "user_id":     user_id,
            "intake_json": json.dumps(profile),
            "record_type": "intake_profile",
            "updated_at":  datetime.now().isoformat(),
        })])
        cache_key = f"{user_id}_intake"
        _PROFILE_CACHE[cache_key] = (profile, time.time())
        logger.info(f"✅ Intake profile stored for {user_id}")
    except Exception as e:
        logger.error(f"Intake Profile Store Error: {e}")
