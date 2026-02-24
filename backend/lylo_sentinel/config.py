#!/usr/bin/env python3
# =============================================================================
# LYLO OS — config.py
# Centralised environment variables, global constants, and vector ID suffixes.
# All other modules import from here.
# =============================================================================

import os
import logging
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# LOGGING
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [SENTINEL]  %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("LYLO.Sentinel")

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

PINECONE_API_KEY    = os.getenv("PINECONE_API_KEY", "").strip()
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY", "").strip()
FCM_SERVER_KEY      = os.getenv("FCM_SERVER_KEY", "").strip()
VAPID_PRIVATE_KEY   = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_PUBLIC_KEY    = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_CLAIM_EMAIL   = os.getenv("VAPID_CLAIM_EMAIL", "admin@lylo.ai").strip()
DRY_RUN             = os.getenv("SENTINEL_DRY_RUN", "false").lower() == "true"

# =============================================================================
# PINECONE INDEX
# =============================================================================

PINECONE_INDEX_NAME = "lylo-intelligence-sync"

# =============================================================================
# DORMANT THRESHOLD
# =============================================================================

# How many hours of silence before DORMANT trigger fires
DORMANT_THRESHOLD_HOURS = 48

# =============================================================================
# VECTOR ID SUFFIXES  (must match main.py exactly)
# =============================================================================

PROFILE_VECTOR_ID_SUFFIX  = "_profile"
INTAKE_VECTOR_ID_SUFFIX   = "_intake"
SENTINEL_VECTOR_ID_SUFFIX = "_sentinel_meta"   # Tracks push history

# =============================================================================
# ANTI-SPAM COOLDOWNS
# =============================================================================

PUSH_COOLDOWN_HOURS        = 24    # Standard cooldown between any two pushes
SUNDAY_PUSH_COOLDOWN_HOURS = 18    # Tighter window on Sunday sweeps
BACKOFF_IGNORE_COUNT       = 3     # Ignored pushes before 7-day silence kicks in
BACKOFF_SILENCE_DAYS       = 7

# =============================================================================
# ANCHOR VECTOR  (static dummy used for Sentinel meta upserts)
# These records are only ever fetch()'d by ID — vector content is irrelevant.
# =============================================================================

SENTINEL_ANCHOR_VECTOR = [0.001] * 1024

# =============================================================================
# OPTIONAL LIBRARY AVAILABILITY FLAGS
# =============================================================================

try:
    import requests as _requests          # noqa: F401  — FCM HTTP v1
    FCM_AVAILABLE = True
except ImportError:
    FCM_AVAILABLE = False

try:
    from pywebpush import webpush, WebPushException   # noqa: F401
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False
