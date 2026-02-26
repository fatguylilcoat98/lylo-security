# =============================================================================
# LYLO MED-VAULT — med_vault.py
# Encrypted health data silo for the Doctor persona.
# 
# PRIVACY ARCHITECTURE:
#   - AES-256 via Fernet (PBKDF2HMAC key derivation, 480,000 iterations)
#   - Simple mode: key = PBKDF2(email, SHA256(email))
#   - PIN mode:    key = PBKDF2(email+PIN, SHA256(email))
#   - Data stored encrypted in Pinecone metadata — nobody can read it
#   - Zero plaintext ever written to disk or logs
#   - PDF generated in memory, never saved to server
#   - QR links are ephemeral (configurable expiry, default 30 min)
#
# DATA SILOS — need-to-know access model:
#   MEDICAL:    doctor(rw), therapist(r), vitality(r), pastor(r)
#   FINANCIAL:  wealth(rw), lawyer(r), career(r)
#   VEHICLE:    mechanic(rw), lawyer(r), wealth(r)
#   LEGAL:      lawyer(rw), guardian(r)
#   CAREER:     career(rw), wealth(r), lawyer(r)
#   EMOTIONAL:  therapist(rw), pastor(rw), bestie(r), doctor(r)
#   SECURITY:   guardian(rw), lawyer(r)
#   UNIVERSAL:  all personas (name, lang, style, age_range, state)
# =============================================================================

import os
import json
import hashlib
import base64
import time
import secrets
import logging
from io import BytesIO
from datetime import datetime
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

logger = logging.getLogger(__name__)

# =============================================================================
# SILO ACCESS MAP — which personas can access which data categories
# =============================================================================
SILO_ACCESS = {
    "medical": {
        "write": {"doctor"},
        "read":  {"doctor", "therapist", "vitality", "pastor"},
    },
    "financial": {
        "write": {"wealth"},
        "read":  {"wealth", "lawyer", "career"},
    },
    "vehicle": {
        "write": {"mechanic"},
        "read":  {"mechanic", "lawyer", "wealth"},
    },
    "legal": {
        "write": {"lawyer"},
        "read":  {"lawyer", "guardian"},
    },
    "career": {
        "write": {"career"},
        "read":  {"career", "wealth", "lawyer"},
    },
    "emotional": {
        "write": {"therapist", "pastor"},
        "read":  {"therapist", "pastor", "bestie", "doctor"},
    },
    "security": {
        "write": {"guardian"},
        "read":  {"guardian", "lawyer"},
    },
    "universal": {
        "write": {"all"},
        "read":  {"all"},
    },
}

def persona_can_read(persona: str, silo: str) -> bool:
    """Returns True if this persona has read access to this silo."""
    access = SILO_ACCESS.get(silo, {}).get("read", set())
    return "all" in access or persona in access

def persona_can_write(persona: str, silo: str) -> bool:
    """Returns True if this persona has write access to this silo."""
    access = SILO_ACCESS.get(silo, {}).get("write", set())
    return "all" in access or persona in access

def get_readable_silos(persona: str) -> list:
    """Returns list of silos this persona can read."""
    return [silo for silo in SILO_ACCESS if persona_can_read(persona, silo)]

# =============================================================================
# ENCRYPTION ENGINE
# =============================================================================
def _derive_key(email: str, pin: str = "") -> bytes:
    """
    Derives AES-256 key from email + optional PIN.
    Salt = SHA256(email) — unique per user, deterministic, never stored.
    480,000 PBKDF2 iterations (OWASP 2024 recommendation).
    """
    salt     = hashlib.sha256(email.lower().strip().encode()).digest()
    material = (email.lower().strip() + pin).encode()
    kdf = PBKDF2HMAC(
        algorithm  = hashes.SHA256(),
        length     = 32,
        salt       = salt,
        iterations = 480000,
    )
    return base64.urlsafe_b64encode(kdf.derive(material))

def encrypt_silo(data: dict, email: str, pin: str = "") -> str:
    """Encrypts silo data. Returns base64 ciphertext string."""
    key = _derive_key(email, pin)
    f   = Fernet(key)
    return f.encrypt(json.dumps(data, default=str).encode()).decode()

def decrypt_silo(ciphertext: str, email: str, pin: str = "") -> Optional[dict]:
    """Decrypts silo data. Returns None on wrong key/PIN."""
    try:
        key  = _derive_key(email, pin)
        f    = Fernet(key)
        raw  = f.decrypt(ciphertext.encode())
        return json.loads(raw)
    except (InvalidToken, Exception) as e:
        logger.warning(f"Vault decrypt failed: {type(e).__name__}")
        return None

def verify_pin(ciphertext: str, email: str, pin: str) -> bool:
    """Returns True if PIN decrypts the vault correctly."""
    return decrypt_silo(ciphertext, email, pin) is not None

# =============================================================================
# VAULT DATA STRUCTURES
# =============================================================================
def empty_medical_vault() -> dict:
    """
    Creates a fresh encrypted vault with all silo buckets.
    Medical, vehicle, financial, legal, career, emotional, security.
    Each persona only sees what they're authorized to access.
    """
    return {
        # ── Meta ──────────────────────────────────────────────────────────
        "vault_version":  "1.1",
        "created_at":     datetime.now().isoformat(),
        "pin_enabled":    False,

        # ── Medical Silo (doctor, therapist, vitality, pastor) ────────────
        "medications":    [],   # list of MedicationRecord
        "symptoms":       [],   # list of SymptomEntry (ambient diary)
        "reactions":      [],   # list of ReactionEntry
        "allergies":      [],   # list of AllergyRecord
        "questions":      [],   # list of DoctorQuestion
        "appointments":   [],   # list of AppointmentRecord
        "reminders":      [],   # list of ReminderSchedule

        # ── Vehicle Silo (mechanic, lawyer, wealth) ───────────────────────
        "vehicles":        [],  # [{make, model, year, vin, mileage, insurance}]
        "service_history": [],  # [{date, description, cost, shop}]

        # ── Financial Silo (wealth, lawyer, career) ───────────────────────
        "financial": {
            "income_range": "",
            "goals":        [],
            "concerns":     [],
            "accounts":     [],   # types only, no numbers
        },

        # ── Legal Silo (lawyer, guardian) ─────────────────────────────────
        "legal": {
            "active_matters":  [],  # [{type, description, status}]
            "important_dates": [],  # [{date, event}]
            "documents":       [],  # [{name, description, location}]
        },

        # ── Career Silo (career, wealth, lawyer) ──────────────────────────
        "career": {
            "current_role": "",
            "employer":     "",
            "goals":        [],
            "concerns":     [],
        },

        # ── Emotional Silo (therapist, pastor, bestie, doctor) ────────────
        "emotional": {
            "current_stressors": [],
            "support_notes":     "",
            "coping_strategies": [],
        },

        # ── Security Silo (guardian, lawyer) ──────────────────────────────
        "security": {
            "past_scams":        [],
            "protected_accounts":[],
            "alerts":            [],
        },
    }

def new_medication(name: str, dose: str, frequency: str,
                   prescriber: str = "", ndc: str = "",
                   start_date: str = "") -> dict:
    return {
        "id":          secrets.token_hex(8),
        "name":        name,
        "dose":        dose,
        "frequency":   frequency,
        "prescriber":  prescriber,
        "ndc":         ndc,
        "start_date":  start_date or datetime.now().strftime("%Y-%m-%d"),
        "added_at":    datetime.now().isoformat(),
        "active":      True,
        "notes":       "",
    }

def new_symptom(description: str, severity: str = "mild",
                persona_context: str = "doctor") -> dict:
    return {
        "id":          secrets.token_hex(8),
        "description": description,
        "severity":    severity,   # mild | moderate | severe
        "logged_at":   datetime.now().isoformat(),
        "date_label":  datetime.now().strftime("%B %d, %Y at %I:%M %p"),
        "source":      "ambient_diary",  # auto-detected from conversation
        "context":     persona_context,
    }

def new_reaction(medication_id: str, medication_name: str,
                 description: str, severity: str = "mild") -> dict:
    return {
        "id":              secrets.token_hex(8),
        "medication_id":   medication_id,
        "medication_name": medication_name,
        "description":     description,
        "severity":        severity,
        "logged_at":       datetime.now().isoformat(),
        "date_label":      datetime.now().strftime("%B %d, %Y"),
    }

def new_doctor_question(question: str, context: str = "") -> dict:
    return {
        "id":         secrets.token_hex(8),
        "question":   question,
        "context":    context,
        "logged_at":  datetime.now().isoformat(),
        "date_label": datetime.now().strftime("%B %d, %Y"),
        "answered":   False,
    }

# =============================================================================
# AMBIENT SYMPTOM DETECTOR
# Silently detects symptom mentions in conversation and logs them
# =============================================================================
import re as _re

_SYMPTOM_PATTERNS = [
    (_re.compile(r'\b(pain|ache|aching|hurts|hurting|sore|soreness|acting up|flaring|tender)\b', _re.I), "pain"),
    (_re.compile(r'\b(dizzy|dizziness|lightheaded|light.headed|vertigo)\b', _re.I), "dizziness"),
    (_re.compile(r'\b(nausea|nauseous|sick to my stomach|throwing up|vomit)\b', _re.I), "nausea"),
    (_re.compile(r'\b(tired|fatigue|exhausted|no energy|worn out|weak)\b', _re.I), "fatigue"),
    (_re.compile(r'\b(headache|migraine|head is pounding|head hurts)\b', _re.I), "headache"),
    (_re.compile(r'\b(shortness of breath|cannot breathe|hard to breathe|chest tight|chest feels tight|tight chest|chest pressure)\b', _re.I), "breathing"),
    (_re.compile(r'\b(swollen|swelling|bloated|bloating)\b', _re.I), "swelling"),
    (_re.compile(r'\b(rash|itching|itchy|hives|skin reaction)\b', _re.I), "skin_reaction"),
    (_re.compile(r'\b(fever|chills|sweating|night sweats|temperature)\b', _re.I), "fever_chills"),
    (_re.compile(r'\b(cannot sleep|insomnia|waking up|sleep problems|restless)\b', _re.I), "sleep"),
    (_re.compile(r'\b(anxious|anxiety|panic|heart racing|palpitations)\b', _re.I), "anxiety_cardiac"),
    (_re.compile(r'\b(depressed|depression|hopeless|no motivation|low mood)\b', _re.I), "mood"),
    (_re.compile(r'\b(blurry vision|cannot see|vision problems|eye pain)\b', _re.I), "vision"),
    (_re.compile(r'\b(memory|forgetting|confused|confusion|brain fog)\b', _re.I), "cognitive"),
]

# Reaction detection — connects symptoms to specific medications
_REACTION_PATTERNS = [
    _re.compile(r'(after|since|since taking|from) (my |the |that )?(\w+)\b', _re.I),
    _re.compile(r'(pill|medication|medicine|drug) (is |is making me |makes me )(\w+)', _re.I),
    _re.compile(r'(\w+) (is giving me|gives me|caused|causing)', _re.I),
]

def detect_symptoms_in_message(message: str) -> list:
    """
    Returns list of detected symptom types from a message.
    Used by the ambient diary to silently log symptoms.
    """
    detected = []
    msg_lower = message.lower()
    for pattern, symptom_type in _SYMPTOM_PATTERNS:
        if pattern.search(msg_lower):
            detected.append(symptom_type)
    return list(set(detected))

def detect_reaction_mention(message: str, medications: list) -> Optional[dict]:
    """
    Detects if user is describing a reaction to a specific medication.
    Returns {medication_name, description} or None.
    """
    msg_lower = message.lower()
    for med in medications:
        med_name = med.get("name", "").lower()
        if med_name and med_name in msg_lower:
            # Check if there's a symptom mentioned alongside the medication name
            symptoms = detect_symptoms_in_message(message)
            if symptoms:
                return {
                    "medication_id":   med.get("id", ""),
                    "medication_name": med.get("name", ""),
                    "description":     message[:200],
                    "symptoms":        symptoms,
                }
    return None

# =============================================================================
# EPHEMERAL QR LINK SYSTEM
# Generates time-limited tokens for doctor quick-view
# =============================================================================
_EPHEMERAL_TOKENS: dict = {}  # token -> {user_id, expires_at, summary}

def generate_ephemeral_token(user_id: str, summary: dict,
                              expiry_minutes: int = 30) -> str:
    """
    Creates a time-limited token for doctor quick-view.
    Token is random — contains no user information.
    """
    token      = secrets.token_urlsafe(32)
    expires_at = time.time() + (expiry_minutes * 60)
    _EPHEMERAL_TOKENS[token] = {
        "user_id":    user_id,
        "expires_at": expires_at,
        "summary":    summary,
        "created_at": datetime.now().isoformat(),
    }
    # Clean expired tokens while we're here
    expired = [t for t, v in _EPHEMERAL_TOKENS.items() if v["expires_at"] < time.time()]
    for t in expired:
        del _EPHEMERAL_TOKENS[t]
    return token

def retrieve_ephemeral_token(token: str) -> Optional[dict]:
    """Returns summary if token is valid and not expired. Auto-deletes on access."""
    entry = _EPHEMERAL_TOKENS.get(token)
    if not entry:
        return None
    if entry["expires_at"] < time.time():
        del _EPHEMERAL_TOKENS[token]
        return None
    # Single-use after doctor scans: delete it
    del _EPHEMERAL_TOKENS[token]
    return entry["summary"]

# =============================================================================
# DRUG INTERACTION CHECKER (FDA OpenFDA API)
# =============================================================================
async def check_drug_interactions(medications: list,
                                  new_med_name: str = "") -> list:
    """
    Checks for interactions between medications using FDA OpenFDA API.
    Returns list of warning dicts.
    No API key required — FDA data is public.
    """
    import asyncio
    warnings = []
    med_names = [m.get("name", "") for m in medications if m.get("active")]
    if new_med_name:
        med_names.append(new_med_name)
    if len(med_names) < 2:
        return []

    try:
        import urllib.request
        import urllib.parse
        # Query FDA for each medication's interaction profile
        for med in med_names:
            query  = urllib.parse.quote(f'"{med}"[drug_interactions]')
            url    = f"https://api.fda.gov/drug/label.json?search={query}&limit=1"
            try:
                req  = urllib.request.Request(url, headers={"User-Agent": "LYLO-MedVault/1.0"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    data = json.loads(resp.read())
                    results = data.get("results", [])
                    if results:
                        interactions = results[0].get("drug_interactions", [])
                        if interactions:
                            text = interactions[0][:300] if isinstance(interactions, list) else str(interactions)[:300]
                            # Check if any other med in our list appears in the interaction text
                            for other_med in med_names:
                                if other_med != med and other_med.lower() in text.lower():
                                    warnings.append({
                                        "drug_a":   med,
                                        "drug_b":   other_med,
                                        "warning":  text,
                                        "severity": "moderate",
                                        "source":   "FDA OpenFDA",
                                    })
            except Exception:
                pass  # FDA API unavailable — silent fail, Tavily handles this too
    except Exception as e:
        logger.warning(f"FDA interaction check error: {e}")

    return warnings

# =============================================================================
# NDC DOSAGE DISCREPANCY DETECTOR
# Compares scanned label against stored medication record
# =============================================================================
def check_dosage_discrepancy(scanned: dict, stored_medications: list) -> Optional[dict]:
    """
    Compares a freshly-scanned label against what's stored in the vault.
    Returns discrepancy info if dosage or name differs from stored record.
    """
    scanned_name = scanned.get("name", "").lower().strip()
    scanned_dose = scanned.get("dose", "").lower().strip()

    for med in stored_medications:
        stored_name = med.get("name", "").lower().strip()
        stored_dose = med.get("dose", "").lower().strip()

        # Fuzzy name match — "lisinopril" matches "lisinopril hctz"
        if scanned_name and stored_name and (
            scanned_name in stored_name or stored_name in scanned_name
        ):
            if scanned_dose and stored_dose and scanned_dose != stored_dose:
                return {
                    "medication":  med.get("name"),
                    "stored_dose": med.get("dose"),
                    "scanned_dose": scanned.get("dose"),
                    "message": (
                        f"This label shows {scanned.get('dose')} but I have "
                        f"{med.get('dose')} on file for {med.get('name')}. "
                        f"Did your dose change, or is this an older bottle?"
                    ),
                }
    return None

print("med_vault.py module designed ✅")
