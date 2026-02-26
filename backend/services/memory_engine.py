"""
LYLO OS — services/memory_engine.py
All Pinecone read/write operations:
  - auto_detect_pin_category
  - store/retrieve intelligence_sync (episodic RAG)
  - retrieve/synthesize user_profile
  - retrieve/store intake_profile
  - vault core (encrypted load/save)
"""
import re
import json
import time
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional

from services.config import (
    memory_index, openai_client, _PROFILE_CACHE, _PROFILE_CACHE_TTL,
    create_user_id,
)

logger = logging.getLogger("LYLO.Memory")

def auto_detect_pin_category(message: str) -> tuple[str, str] | None:
    """
    Scans user message for pinnable intel.
    Returns (pin_text, category) if detected, else None.
    Uses the first 200 chars of the message as the pin text.
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
        memory_index.upsert([(mem_id, embedding, {
            "user_id":     user_id,
            "role":        role,
            "content":     content[:400],
            "timestamp":   datetime.now().isoformat(),
            "record_type": "episodic",
            "persona":     persona,   # tag which persona stored this memory
        })])
    except Exception as e:
        logger.error(f"Memory Sync Error: {e}")


# Silo-aware memory retrieval — each persona only pulls its own memories
# plus "general" memories. Prevents lawyer memories bleeding into pastor, etc.
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
    "bestie":    {"bestie", "therapist", "general"},  # bestie can see emotional context
}


async def retrieve_intelligence_sync(user_id: str, query: str, persona: str = "general") -> str:
    if not memory_index or not openai_client:
        return ""
    try:
        _q_lower = query.lower()
        _asset_keywords = ""
        if any(w in _q_lower for w in ["car","vehicle","drive","broke","fix","mechanic"]):
            _asset_keywords = " car vehicle repair"
        elif any(w in _q_lower for w in ["health","sick","pain","doctor","medication","symptom"]):
            _asset_keywords = " health medical symptom"
        elif any(w in _q_lower for w in ["money","invest","debt","finance","budget"]):
            _asset_keywords = " finance money investment"
        asset_query = f"{query}{_asset_keywords}"
        resp = await openai_client.embeddings.create(
            model="text-embedding-3-small", input=asset_query[:300], dimensions=1024
        )
        # Build persona-aware filter — only pull memories from this persona's allowed silos
        allowed_personas = list(_PERSONA_MEMORY_SILOS.get(persona, {"general"}))
        pinecone_filter = {
            "user_id":     {"$eq": user_id},
            "record_type": {"$eq": "episodic"},
            "persona":     {"$in": allowed_personas},
        }
        results = memory_index.query(
            vector=resp.data[0].embedding,
            filter=pinecone_filter,
            top_k=5, include_metadata=True,
        )
        # Fall back to unfiltered if no persona-tagged memories exist yet
        if not results.matches:
            results = memory_index.query(
                vector=resp.data[0].embedding,
                filter={"user_id": {"$eq": user_id}, "record_type": {"$eq": "episodic"}},
                top_k=3, include_metadata=True,
            )
        memories = [
            f"Past Intelligence ({m.metadata['role']}): {m.metadata['content']}"
            for m in results.matches if m.score > 0.65
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

async def _load_vault_encrypted(user_id: str) -> Optional[str]:
    """Loads raw encrypted vault string from Pinecone. Returns None if not found."""
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
    """Saves encrypted vault blob to Pinecone. Returns True on success."""
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
    """Loads and decrypts the medical vault for a user."""
    if not MED_VAULT_ENABLED:
        return None
    blob = await _load_vault_encrypted(user_id)
    if not blob:
        return None
    return decrypt_silo(blob, email, pin)

async def save_vault(user_id: str, email: str, vault: dict, pin: str = "") -> bool:
    """Encrypts and saves the medical vault."""
    if not MED_VAULT_ENABLED:
        return False
    blob = encrypt_silo(vault, email, pin)
    return await _save_vault_encrypted(user_id, blob)

async def get_or_create_vault(user_id: str, email: str, pin: str = "") -> dict:
    """Loads vault or creates a fresh one if none exists."""
    vault = await load_vault(user_id, email, pin)
    if vault is None:
        vault = empty_medical_vault()
        await save_vault(user_id, email, vault, pin)
    return vault
async def _noop_vault(): return None



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
