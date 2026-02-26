"""
LYLO OS — routers/intake_router.py
Endpoints: /intake-questions/{round_number}, /user-intake, /get-intake/{user_email}
"""
import logging
from typing import Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.config import create_user_id
from services.memory_engine import retrieve_intake_profile, store_intake_profile

logger = logging.getLogger("LYLO.Intake")
router = APIRouter()


# =============================================================================
# INTAKE PROFILE — DETERMINISTIC PINECONE STORE/RETRIEVE
# =============================================================================
INTAKE_VECTOR_ID_SUFFIX = "_intake"


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


# =============================================================================
# INTAKE QUESTIONS — Served to frontend so questions are always in sync
# Round 1: 5 questions on first login (religion first — sets up Pastor)
# Round 2: 5 questions after first session (gentle "complete your profile" prompt)
# =============================================================================
INTAKE_QUESTIONS = {
    "round1": [
        {
            "id": "preferred_name",
            "round": 1,
            "question": "What should we call you?",
            "subtext": "Your council will use this name. Be yourself.",
            "options": [],
            "allowCustom": True,
            "customPlaceholder": "My name is...",
            "required": True,
        },
        {
            "id": "faith",
            "round": 1,
            "question": "What guides your spirit?",
            "subtext": "This helps your Pastor speak your language.",
            "options": [
                {"label": "A", "text": "Christian", "emoji": "✝️"},
                {"label": "B", "text": "Muslim", "emoji": "☪️"},
                {"label": "C", "text": "Jewish", "emoji": "✡️"},
            ],
            "more_options": [
                {"label": "Hindu", "emoji": "🕉️"},
                {"label": "Buddhist", "emoji": "☸️"},
                {"label": "Spiritual / No label", "emoji": "🌿"},
                {"label": "No faith preference", "emoji": "🤝"},
            ],
            "allowCustom": True,
            "customPlaceholder": "My faith is...",
        },
        {
            "id": "work",
            "round": 1,
            "question": "What do you do for work?",
            "subtext": "Your council adapts to your world.",
            "options": [
                {"label": "A", "text": "Professional / Employee", "emoji": "💼"},
                {"label": "B", "text": "Entrepreneur / Business Owner", "emoji": "🚀"},
                {"label": "C", "text": "Student", "emoji": "📚"},
            ],
            "allowCustom": True,
            "customPlaceholder": "I work as...",
        },
        {
            "id": "mission",
            "round": 1,
            "question": "What's your #1 mission right now?",
            "subtext": "We lock in on what matters most to you.",
            "options": [
                {"label": "A", "text": "Build Wealth", "emoji": "💰"},
                {"label": "B", "text": "Protect My Family", "emoji": "🛡️"},
                {"label": "C", "text": "Advance My Career", "emoji": "📈"},
            ],
            "allowCustom": True,
            "customPlaceholder": "My mission is...",
        },
        {
            "id": "vibe",
            "round": 1,
            "question": "How should your council talk to you?",
            "subtext": "Real talk or gentle guidance — you choose.",
            "options": [
                {"label": "A", "text": "Direct & No Fluff", "emoji": "⚡"},
                {"label": "B", "text": "Chill & Easy", "emoji": "😎"},
                {"label": "C", "text": "Warm & Supportive", "emoji": "🤗"},
            ],
            "allowCustom": True,
            "customPlaceholder": "Talk to me like...",
        },
        {
            "id": "relationship",
            "round": 1,
            "question": "What's your relationship status?",
            "subtext": "Helps your council understand your support system.",
            "options": [
                {"label": "A", "text": "Single", "emoji": "🙋"},
                {"label": "B", "text": "In a Relationship / Married", "emoji": "❤️"},
                {"label": "C", "text": "It's Complicated", "emoji": "🤷"},
            ],
            "allowCustom": True,
            "customPlaceholder": "My situation is...",
        },
    ],
    "round2": [
        {
            "id": "housing",
            "round": 2,
            "question": "Do you own or rent your home?",
            "options": [
                {"label": "A", "text": "I Own My Home", "emoji": "🏠"},
                {"label": "B", "text": "I Rent", "emoji": "🔑"},
                {"label": "C", "text": "I Live With Family / Other", "emoji": "👨‍👩‍👧"},
            ],
            "allowCustom": True,
            "customPlaceholder": "My situation is...",
        },
        {
            "id": "children",
            "round": 2,
            "question": "Do you have children?",
            "options": [
                {"label": "A", "text": "Yes, young kids (under 12)", "emoji": "🧒"},
                {"label": "B", "text": "Yes, teenagers or adults", "emoji": "👦"},
                {"label": "C", "text": "No children", "emoji": "🚫"},
            ],
            "allowCustom": True,
            "customPlaceholder": "Tell us more...",
        },
        {
            "id": "health_focus",
            "round": 2,
            "question": "Any ongoing health focus?",
            "options": [
                {"label": "A", "text": "Fitness & Weight Loss", "emoji": "💪"},
                {"label": "B", "text": "Managing a Condition", "emoji": "🏥"},
                {"label": "C", "text": "Mental Health & Stress", "emoji": "🧠"},
            ],
            "allowCustom": True,
            "customPlaceholder": "My health focus is...",
        },
        {
            "id": "finances",
            "round": 2,
            "question": "What best describes your finances right now?",
            "options": [
                {"label": "A", "text": "Stable, looking to grow", "emoji": "📊"},
                {"label": "B", "text": "Getting by, want to improve", "emoji": "💡"},
                {"label": "C", "text": "Struggling, need a plan", "emoji": "🆘"},
            ],
            "allowCustom": True,
            "customPlaceholder": "My situation is...",
        },
        {
            "id": "location",
            "round": 2,
            "question": "What state do you live in?",
            "subtext": "Helps your Lawyer and Wealth Architect give you state-specific advice.",
            "options": [
                {"label": "A", "text": "California", "emoji": "🌴"},
                {"label": "B", "text": "Texas", "emoji": "⭐"},
                {"label": "C", "text": "Florida", "emoji": "☀️"},
            ],
            "allowCustom": True,
            "customPlaceholder": "I live in...",
        },
    ],
}


@router.get("/intake-questions/{round_number}")
async def get_intake_questions(round_number: int):
    """Returns the intake questions for a given round (1 or 2)."""
    key = f"round{round_number}"
    if key not in INTAKE_QUESTIONS:
        return JSONResponse({"error": "Invalid round"}, status_code=400)
    return JSONResponse({"round": round_number, "questions": INTAKE_QUESTIONS[key]})


@router.post("/user-intake")
async def user_intake(
    user_email:   str = Form(...),
    question_id:  str = Form(...),
    value:        str = Form(...),
    full_profile: str = Form("{}"),
):
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)

    try:
        profile = json.loads(full_profile)
    except Exception:
        profile = {}

    profile[question_id] = value

    asyncio.create_task(store_intake_profile(user_id, profile))

    return JSONResponse({
        "status":     "saved",
        "question_id": question_id,
        "value":      value,
        "profile_size": len(profile),
    })


@router.get("/get-intake/{user_email}")
async def get_intake(user_email: str):
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    profile     = await retrieve_intake_profile(user_id)
    return JSONResponse({"status": "ok", "profile": profile})


# =============================================================================
# HEALTH + OBD2 SCHEMATIC + ROOT
# =============================================================================
# =============================================================================
# LANGUAGE SUPPORT — English / Spanish
# Frontend sends ?lang=es to get Spanish UI strings
# The chat endpoint also reads user's language pref from intake profile
# =============================================================================
_UI_STRINGS = {
    "en": {
        "welcome":          "Welcome to LYLO",
        "tagline":          "Your Digital Bodyguard",
        "login_prompt":     "Enter your email to access your council",
        "login_button":     "Access My Council",
        "language_toggle":  "Español",
        "end_session":      "End Session",
        "send_report":      "Send Report to Email",
        "report_prompt":    "Would you like this session report sent to your email?",
        "report_yes":       "Yes, send it",
        "report_no":        "No thanks",
        "complete_profile": "Complete Your Profile",
        "profile_prompt":   "5 quick questions to sharpen your council's advice — takes 60 seconds.",
        "profile_cta":      "Let's Do It",
        "profile_skip":     "Maybe Later",
        "emergency_next":   "Done — Next Step",
        "emergency_done":   "All Steps Complete",
        "step_label":       "Step",
        "of_label":         "of",
        "intake_round1":    "Quick Start · Question",
        "intake_round2":    "Profile · Question",
        "custom_prompt":    "Type your own answer...",
        "skip":             "Skip",
        "back":             "Back",
        "personas": {
            "mechanic":  "The Mechanic",
            "doctor":    "The Doctor",
            "lawyer":    "Legal Shield",
            "wealth":    "Wealth Architect",
            "therapist": "The Therapist",
            "career":    "Career Coach",
            "tutor":     "The Tutor",
            "vitality":  "Vitality Coach",
            "hype":      "Hype Engine",
            "bestie":    "The Bestie",
            "pastor":    "The Pastor",
            "guardian":  "The Guardian",
        },
    },
    "es": {
        "welcome":          "Bienvenido a LYLO",
        "tagline":          "Tu Guardaespaldas Digital",
        "login_prompt":     "Ingresa tu correo para acceder a tu consejo",
        "login_button":     "Acceder a Mi Consejo",
        "language_toggle":  "English",
        "end_session":      "Terminar Sesión",
        "send_report":      "Enviar Reporte al Correo",
        "report_prompt":    "¿Quieres que te enviemos el reporte de esta sesión?",
        "report_yes":       "Sí, envíalo",
        "report_no":        "No, gracias",
        "complete_profile": "Completa Tu Perfil",
        "profile_prompt":   "5 preguntas rápidas para mejorar los consejos de tu consejo — solo 60 segundos.",
        "profile_cta":      "Vamos",
        "profile_skip":     "Quizás Después",
        "emergency_next":   "Listo — Siguiente Paso",
        "emergency_done":   "Todos los Pasos Completados",
        "step_label":       "Paso",
        "of_label":         "de",
        "intake_round1":    "Inicio Rápido · Pregunta",
        "intake_round2":    "Perfil · Pregunta",
        "custom_prompt":    "Escribe tu propia respuesta...",
        "skip":             "Omitir",
        "back":             "Atrás",
        "personas": {
            "mechanic":  "El Mecánico",
            "doctor":    "El Doctor",
            "lawyer":    "Escudo Legal",
            "wealth":    "Arquitecto de Riqueza",
            "therapist": "El Terapeuta",
            "career":    "Asesor de Carrera",
            "tutor":     "El Tutor",
            "vitality":  "Coach de Vitalidad",
            "hype":      "Motor de Hype",
            "bestie":    "Tu Mejor Amigo",
            "pastor":    "El Pastor",
            "guardian":  "El Guardián",
        },
    },
}


@router.get("/ui-strings")
async def get_ui_strings(lang: str = "en"):
    """Returns UI strings in the requested language (en or es)."""
    lang_clean = lang.lower().strip()[:2]
