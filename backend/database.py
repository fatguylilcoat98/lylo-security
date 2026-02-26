"""lylo_sentinel.database — Pinecone helpers for Sentinel metadata."""
import logging
import os
from typing import Optional

log = logging.getLogger("LYLO.Sentinel.DB")

_index = None

def get_pinecone_index():
    """Return a Pinecone Index object, or None if unavailable."""
    global _index
    if _index is not None:
        return _index
    try:
        from pinecone import Pinecone
        from lylo_sentinel.config import PINECONE_API_KEY, PINECONE_INDEX
        pc     = Pinecone(api_key=PINECONE_API_KEY)
        _index = pc.Index(PINECONE_INDEX)
        log.info("✅ Sentinel Pinecone index connected")
        return _index
    except Exception as e:
        log.warning(f"⚠️  Sentinel Pinecone unavailable: {e}")
        return None


def fetch_sentinel_meta(index, user_email: str) -> dict:
    """Fetch sentinel metadata for a user, returning {} if not found."""
    try:
        record_id = f"{user_email}_sentinel_meta"
        result    = index.fetch(ids=[record_id])
        vectors   = result.get("vectors") or {}
        if record_id in vectors:
            return dict(vectors[record_id].get("metadata") or {})
        return {}
    except Exception as e:
        log.warning(f"fetch_sentinel_meta failed for {user_email[:4]}***: {e}")
        return {}


def upsert_sentinel_meta(index, user_email: str, meta: dict, anchor_vector: list) -> bool:
    """Upsert sentinel metadata for a user. Returns True on success."""
    try:
        record_id = f"{user_email}_sentinel_meta"
        index.upsert([(record_id, anchor_vector, meta)])
        return True
    except Exception as e:
        log.warning(f"upsert_sentinel_meta failed for {user_email[:4]}***: {e}")
        return False


def fetch_user_push_tokens(index, user_email: str) -> dict:
    """Fetch stored Web Push subscription for a user."""
    try:
        token_id = f"{user_email}_push_tokens"
        result   = index.fetch(ids=[token_id])
        vectors  = result.get("vectors") or {}
        if token_id in vectors:
            return dict(vectors[token_id].get("metadata") or {})
        return {}
    except Exception as e:
        log.warning(f"fetch_user_push_tokens failed for {user_email[:4]}***: {e}")
        return {}
