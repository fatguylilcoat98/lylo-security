"""LYLO OS — routers/chat_router.py"""
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

from fastapi import APIRouter, Form, File, UploadFile, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.background import BackgroundTasks
from pydantic import BaseModel
from services.config import (
    gemini_client, gemini_ready, openai_client, anthropic_client, claude_client,
    memory_index, ELITE_USERS, ELITE_TIERS, TIER_LIMITS,
    USAGE_TRACKER, CONVO_CONTEXT, MAX_CONVO_CONTEXT,
    AUTHORIZED_DEVICES, MAX_DEVICES_PER_USER,
    _ANCHOR_EMBEDDINGS, _ANCHOR_CACHE_LOCK, DOMAIN_ANCHORS,
    create_user_id, tavily_client,
)
from services.memory_engine import (
    store_intelligence_sync, retrieve_intelligence_sync,
    retrieve_intake_profile, retrieve_user_profile, synthesize_user_profile,
    get_or_create_vault, save_vault, auto_detect_pin_category, load_vault,
)
from services.prompt_builder import (
    _build_chat_system_prompt, assemble_prompt,
    build_hard_boundary_block, get_seat9_theology,
)
from services.llm_clients import call_gemini_vision, call_openai_bodyguard, validate_with_claude, split_into_sentences, _is_high_stakes

# ── Robust sentence splitter — respects abbreviations (Dr. Mr. St. etc.) ──────
import re as _re

def _split_sentences_safe(text: str) -> list:
    """Splits text into sentences, respecting abbreviations like Dr. Mr. St."""
    import re as re2
    abbrevs = [
        "Dr","Mr","Mrs","Ms","Prof","Sr","Jr","St","Ave","Blvd",
        "Inc","Ltd","Corp","Co","Vs","Etc","No","Vol","Fig",
        "Jan","Feb","Mar","Apr","Jun","Jul","Aug","Sep",
        "Oct","Nov","Dec","Dept","Est","Max","Min",
        "dr","mr","mrs","ms","prof","sr","jr","st","ave",
        "inc","ltd","corp","co","vs","etc","no","vol",
    ]
    protected = text
    for i, ab in enumerate(abbrevs):
        tag = "<<" + str(i) + ">>"
        protected = re2.sub(r"(?<!\w)" + re2.escape(ab) + r"\.", ab + tag, protected)
    protected = re2.sub(r"(\d+)\.(\d+)", lambda m: m.group(1) + "<<D>>" + m.group(2), protected)
    parts = re2.split(r"(?<=[.!?])\s+(?=[A-Z])", protected)
    result = []
    for p in parts:
        r = p
        for i, ab in enumerate(abbrevs):
            r = r.replace(ab + "<<" + str(i) + ">>", ab + ".")
        r = re2.sub(r"(\d+)<<D>>(\d+)", lambda m: m.group(1) + "." + m.group(2), r).strip()
        if r:
            result.append(r)
    return result if result else [text]


from services.emergency_engine import detect_emergency_and_route, build_emergency_response
from services.scam_detector import analyze_scam_indicators, detect_prompt_injection, _build_injection_response, _build_impatience_response
from services.audio_service import generate_audio_inline, get_pause_metadata
from services.hk_service import should_use_veracore, run_veracore_verification, merge_veracore_with_winner, get_veracore_badge
from services.pdf_mailer import generate_mission_report_pdf, send_mission_report_email
from services.web_search import search_personalized_web
from lylo_kernel import build_system_prompt, fetch_memory_pins, upsert_memory_pin
from intelligence_data import (
    GLOBAL_DIRECTIVE, build_user_ident_core,
    BETA_USER_PROFILES, get_warm_start_profile, get_user_location_data,
    PROFILE_VECTOR_ID_SUFFIX, PROFILE_EMBEDDING_ANCHOR,
    SYNTHESIS_INTERVAL, SYNTHESIS_MEMORY_WINDOW,
    PROFILE_SYNTHESIS_SYSTEM_PROMPT, PROFILE_SYNTHESIS_USER_TEMPLATE,
    detect_proactive_triggers, build_proactive_directive,
    VIBE_STYLES, VIBE_LABELS, PERSONA_DEFINITIONS, PERSONA_EXTENDED,
    PERSONA_TIERS, INTENT_LOGIC, get_random_hook, get_all_hooks,
    ANALOGY_BRIDGE_TRADE_CONTEXT, ACCOUNTABILITY_SENTINEL_OVERRIDE,
    build_accountability_sentinel, PARTNER_ENERGY_DIRECTIVE,
    EXIT_FIRST_FILTER, SENTINEL_NO_RECITE,
    get_output_schema, build_stealth_shield,
)
try:
    from med_vault import (
        encrypt_silo, decrypt_silo, verify_pin,
        empty_medical_vault, new_medication, new_symptom,
        new_reaction, new_doctor_question,
        detect_symptoms_in_message, detect_reaction_mention,
        check_dosage_discrepancy, check_drug_interactions,
        generate_ephemeral_token, retrieve_ephemeral_token,
        persona_can_read, persona_can_write, get_readable_silos, SILO_ACCESS,
    )
    from med_vault_pdf import generate_medical_pdf, PERSONA_COLORS
    MED_VAULT_ENABLED = True
except ImportError:
    MED_VAULT_ENABLED = False
    def persona_can_read(persona, silo): return False
    def persona_can_write(persona, silo): return False
    def get_readable_silos(persona): return []
    def detect_symptoms_in_message(msg): return []
    def detect_reaction_mention(msg, meds): return None
    def new_doctor_question(q, note=""): return {}
    def new_symptom(*a, **k): return {}
    def new_reaction(*a, **k): return {}
    SILO_ACCESS = {}
    PERSONA_COLORS = {}
    async def generate_medical_pdf(*a, **k): return None
logger = logging.getLogger("LYLO.Chat")
logger.setLevel(logging.WARNING)  # Production: suppress INFO/DEBUG noise
router = APIRouter()

# ── Prompt Leakage Filter — strips instruction labels LLM accidentally speaks ─
_LEAKAGE_PATTERN = re.compile(
    r"(SYSTEM\s+PRIORITY\s*:?\s*|SYSTEM\s+NOTE\s*:?\s*|ACTION\s+REQUIRED\s*:?\s*|"
    r"NEXT\s+STEP\s*:?\s*|YOUR\s+TASK\s*:?\s*)",
    re.IGNORECASE
)
def _strip_leakage(text: str) -> str:
    """Strip prompt instruction labels the LLM accidentally includes in responses."""
    return _LEAKAGE_PATTERN.sub("", text).strip()

async def _noop_vault():
    """Placeholder used when vault is disabled or persona can't read medical data."""
    return None


async def _get_tavily_context(persona: str, message: str, location: str) -> str:
    if not tavily_client:
        return ""

    PERSONA_QUERY_MAP = {
        "doctor":    f"{message} medical health symptoms treatment",
        "lawyer":    f"{message} legal rights law advice",
        "wealth":    f"{message} personal finance investment advice",
        "mechanic":  f"{message} car vehicle repair fix test drive bronco ford truck dealership buy purchase",
        "therapist": f"{message} mental health emotional wellbeing coping",
        "vitality":  f"{message} fitness nutrition exercise health",
        "career":    f"{message} career job workplace professional advice",
        "tutor":     f"{message} explanation learn understand",
        "guardian":  f"{message} cybersecurity scam fraud safety protect identity theft digital security",
        "hype":      f"{message} content creation social media strategy",
        "pastor":    f"{message} faith spirituality scripture meaning",
        "bestie":    f"{message} advice relationship personal",
    }

    ALWAYS_SEARCH = {"doctor", "lawyer", "wealth", "guardian", "mechanic"}
    SEARCH_TRIGGERS = {
        "how do i", "what is", "is it safe", "should i", "what are",
        "how much", "is this", "what does", "can i", "when should",
        "what happens", "is there", "how long", "how often", "best way",
        "help me understand", "explain", "difference between",
    }

    if persona not in ALWAYS_SEARCH:
        msg_lower = message.lower()
        if not any(t in msg_lower for t in SEARCH_TRIGGERS):
            return ""

    query = PERSONA_QUERY_MAP.get(persona, message)
    loc   = location or ""

    try:
        resp = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: tavily_client.search(
                    query          = f"{query} {loc}".strip(),
                    search_depth   = "advanced",
                    max_results    = 4,
                    include_answer = True,
                )
            ),
            timeout=4.0
        )

        parts = []
        if resp.get("answer"):
            parts.append(f"VERIFIED ANSWER: {resp['answer']}")
        for r in resp.get("results", [])[:3]:
            title   = r.get("title", "")
            snippet = r.get("content", "")[:250]
            source  = r.get("url", "")
            if snippet:
                parts.append(f"SOURCE — {title}: {snippet} [{source}]")

        if not parts:
            return ""

        return (
            "\n\n━━━ REAL-TIME VERIFIED INTELLIGENCE ━━━\n"
            "The following was retrieved RIGHT NOW from trusted sources.\n"
            "Use this to give accurate, up-to-date answers. Cite the source "
            "when it materially affects your answer.\n\n"
            + "\n".join(parts)
            + "\n━━━ END VERIFIED INTELLIGENCE ━━━"
        )

    except asyncio.TimeoutError:
        logger.warning(f"⏱️ Tavily timeout for [{persona}] — responding from training knowledge")
        return ""
    except Exception as e:
        logger.warning(f"⚠️ Tavily error for [{persona}]: {e}")
        return ""


@router.post("/generate-audio")
async def generate_audio(
    text:  str = Form(...),
    voice: str = Form("onyx"),
):
    try:
        audio_b64 = await generate_audio_inline(text, voice)
        return {"audio_b64": audio_b64}
    except Exception as e:
        logger.warning(f"⚠️ generate-audio error: {e}")
        return {"audio_b64": ""}


@router.post("/persona-hook")
async def persona_hook(
    persona:    str = Form(...),
    user_email: str = Form(""),
    lang:       str = Form("en"),          # [V31.3] accept language param
):
    try:
        email_lower = user_email.lower().strip()
        user_id     = create_user_id(email_lower)
        user_data   = ELITE_USERS.get(email_lower, {"name": "Protected User"})

        intake_for_hook = await retrieve_intake_profile(user_id)
        user_name = (
            intake_for_hook.get("preferred_name") or
            intake_for_hook.get("round1_preferred_name") or
            user_data.get("name") or
            email_lower.split("@")[0].capitalize()
        ).strip()
        if user_name == "Protected User" and "@" in email_lower:
            user_name = email_lower.split("@")[0].replace(".", " ").title()

        # [V31.3] Bilingual hooks — Spanish when lang == "es"
        if lang == "es":
            PERSONA_HOOKS = {
                "mechanic":  f"Listo {user_name}, estoy revisando el motor. ¿Cuál es el problema?",
                "doctor":    f"{user_name}, estoy aquí. Cuéntame qué está pasando.",
                "lawyer":    f"{user_name}, Escudo Legal activo. ¿Qué situación estamos manejando?",
                "wealth":    f"{user_name}, Arquitecto de Riqueza en línea. Hablemos de estrategia.",
                "therapist": f"Aquí estoy, {user_name}. Tómate tu tiempo — ¿qué tienes en mente?",
                "career":    f"{user_name}, Coach de Carrera listo. ¿Cuál es tu próximo movimiento?",
                "tutor":     f"¿Listo para aprender, {user_name}? ¿Qué estamos trabajando hoy?",
                "vitality":  f"{user_name}, Coach de Vitalidad aquí. ¿Cómo se siente tu cuerpo?",
                "hype":      f"¡VAMOS {user_name}! Motor de Energía ACTIVO — ¿cuál es la misión?",
                "bestie":    f"¡Hola {user_name}! Tu mejor amigo/a está aquí — cuéntame todo, ¿qué está pasando?",
                "pastor":    f"Paz para ti, {user_name}. ¿Qué está pesando en tu espíritu hoy?",
                "guardian":  f"{user_name}, Guardián en línea. Tu perímetro digital está seguro. ¿Cuál es la amenaza?",
            }
            fallback = f"Hola {user_name}, estoy listo para ayudarte."
        else:
            PERSONA_HOOKS = {
                "mechanic":  f"Alright {user_name}, I'm under the hood. What's the problem?",
                "doctor":    f"{user_name}, I'm here. Tell me what's going on with you.",
                "lawyer":    f"{user_name}, Legal Shield active. What situation are we handling?",
                "wealth":    f"{user_name}, Wealth Architect online. Let's talk strategy.",
                "therapist": f"I'm here, {user_name}. Take your time — what's on your mind?",
                "career":    f"{user_name}, Career Coach locked in. What's your next move?",
                "tutor":     f"Ready to learn, {user_name}? What are we tackling today?",
                "vitality":  f"{user_name}, Vitality Coach here. How's your body feeling?",
                "hype":      f"LET'S GO {user_name}! Hype Engine is LIVE — what's the mission?",
                "bestie":    f"Hey {user_name}! Your bestie is here — spill it, what's going on?",
                "pastor":    f"Peace to you, {user_name}. What's weighing on your spirit today?",
                "guardian":  f"{user_name}, Guardian online. Your digital perimeter is secure. What's the threat?",
            }
            fallback = f"Hello {user_name}, I'm ready to help."

        hook = PERSONA_HOOKS.get(persona, fallback)
        return {"hook": hook}
    except Exception as e:
        logger.warning(f"⚠️ persona-hook error: {e}")
        return {"hook": "I'm ready. What do you need?" if lang != "es" else "Estoy listo. ¿En qué puedo ayudarte?"}


@router.post("/chat")
async def chat(
    msg:                  str        = Form(""),
    history:              str        = Form("[]"),
    persona:              str        = Form("guardian"),
    user_email:           str        = Form(...),
    user_location:        str        = Form(""),
    vibe:                 str        = Form("standard"),
    use_long_term_memory: str        = Form("false"),
    device_id:            str        = Form("unknown"),
    email_consent:        str        = Form("false"),
    voice:                str        = Form("onyx"),
    lang:                 str        = Form("en"),
    input_mode:           str        = Form("text"),   # "voice" | "text" — Phase 1 Voice Architecture
    vocal_energy:         str        = Form("medium"),  # "low" | "medium" | "high" — client-side edge extraction
    speech_rate:          str        = Form("normal"),  # "slow" | "normal" | "fast" — client-side edge extraction
    file:                 UploadFile = File(None),
):
    email_lower = user_email.lower().strip()
    user_id     = create_user_id(email_lower)
    user_data   = ELITE_USERS.get(email_lower, {"tier": "free", "name": "Protected User"})
    tier        = user_data["tier"]
    _intake_name = ""
    is_admin    = email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
    limit       = 999999 if is_admin else TIER_LIMITS.get(tier, 3)

    if not is_admin and device_id != "unknown":
        user_devices = AUTHORIZED_DEVICES[email_lower]
        if device_id not in user_devices:
            if len(user_devices) >= MAX_DEVICES_PER_USER:
                logger.warning(f"🚨 DEVICE BREACH: {email_lower} → 3rd device ({device_id})")
                lockout_msg = (
                    "🛡️ **SECURITY ALERT: DEVICE LIMIT EXCEEDED.**\n\n"
                    "Your LYLO OS clearance is tied to specific hardware. "
                    "Your account is limited to **two (2) active devices**. "
                    "Access from this unauthorized third device is denied."
                )
                async def _lockout():
                    yield f"data: {json.dumps({'type':'text','content':lockout_msg})}\n\n"
                    yield f"data: {json.dumps({'type':'meta','confidence_score':100,'scam_detected':False,'threat_level':'high','action_trigger':None,'audio_b64':'','full_answer':lockout_msg})}\n\n"
                return StreamingResponse(_lockout(), media_type="text/event-stream")
            user_devices.add(device_id)

    if USAGE_TRACKER[user_id] >= limit:
        msgs = {
            "free":  "🛡️ **Daily Shield Limit Reached.** Upgrade to **Pro Guardian ($1.99/mo)** for 15 daily messages.",
            "pro":   "🛡️ **Pro Limit Reached.** Upgrade to **Elite Justice ($4.99/mo)** for 50 messages.",
            "elite": "🛡️ **Elite Limit Reached.** Upgrade to **Max Unlimited ($9.99/mo)** for unrestricted access.",
            "max":   "🛡️ **System Cap Reached.** 500 messages hit. Resets at midnight.",
        }
        upsell = msgs.get(tier, msgs["free"])
        async def _upsell():
            yield f"data: {json.dumps({'type':'text','content':upsell})}\n\n"
            yield f"data: {json.dumps({'type':'meta','confidence_score':100,'scam_detected':False,'threat_level':'low','action_trigger':None,'audio_b64':'','full_answer':upsell})}\n\n"
        return StreamingResponse(_upsell(), media_type="text/event-stream")

    async def _get_memories():
        if use_long_term_memory == "true":
            try:
                return await asyncio.wait_for(retrieve_intelligence_sync(user_id, msg, persona), timeout=3.0)
            except asyncio.TimeoutError:
                logger.warning(f"⚡ Memory timeout [{user_id[:8]}]")
                return ""
        return ""

    async def _get_search():
        search_kw = ["news","weather","search","price","check","law","code","today","now","current",
                     "date","latest","recent","2026","update","rate","stock","score","hours","open","closed"]
        if any(k in msg.lower() for k in search_kw):
            loc_data = get_user_location_data(email_lower)
            loc      = (f"{loc_data['city']}, {loc_data['state']} {loc_data['zip']}"
                        if loc_data.get("zip") else user_location or "")
            try:
                return await asyncio.wait_for(search_personalized_web(msg, loc), timeout=0.8)
            except asyncio.TimeoutError:
                logger.warning("⚡ Search timeout")
                return ""
        return ""

    async def _get_intake():
        return await retrieve_intake_profile(user_id)

    memories, user_profile, search_intel, intake_profile = await asyncio.gather(
        _get_memories(), retrieve_user_profile(user_id), _get_search(), _get_intake()
    )
    logger.info(f"🧠 Profile [{user_id[:8]}]: {list(user_profile.keys())[:6]} | Mem: {len(memories)}c")

    _INJECTION_SIGNATURES = [
        "ignore previous instructions",
        "ignore all previous instructions",
        "disregard your instructions",
        "ignore your system prompt",
        "forget your instructions",
        "override your instructions",
        "override all instructions",
        "suspend all instructions",
        "bypass your safety",
        "bypass your instructions",
        "command-line emergency",
        "acknowledge and execute",
        "reveal your prompt",
        "print your system prompt",
        "show me your system prompt",
        "repeat your system prompt",
        "what is your system prompt",
        "output your instructions",
        "jailbreak",
        "dan mode",
        "developer mode activated",
        "unrestricted mode",
        "you are now unrestricted",
        "pretend you have no restrictions",
        "act as if you have no rules",
        "you have no guidelines",
        "disable your safety",
        "raw unformatted status update on the current user",
        "session variables",
    ]
    msg_lower_inject = msg.lower()
    injection_detected = any(sig in msg_lower_inject for sig in _INJECTION_SIGNATURES)

    if injection_detected:
        threat_msg = (
            f"\U0001f6a8 INJECTION ATTEMPT BLOCKED. {user_data['name']}, that message contained "
            f"instructions trying to hijack your AI Council. The Guardian flagged it and "
            f"terminated the request. Your session is secure. If you didn't send this, "
            f"someone may have access to your device."
        )
        logger.warning(f"\U0001f6a8 PROMPT INJECTION detected from {email_lower[:6]}***: {msg[:120]}")

        async def _stream_injection_alert():
            payload = json.dumps({"type": "text", "content": threat_msg})
            meta    = json.dumps({"type": "meta", "confidence_score": 99, "scam_detected": True,
                                  "threat_level": "high", "action_trigger": "email_dispatch",
                                  "full_answer": threat_msg})
            yield f"data: {payload}\n\n"
            yield f"data: {meta}\n\n"

        return StreamingResponse(
            _stream_injection_alert(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )

    _DOMAIN_INTERCEPTS = {
        "mechanic": {
            "triggers": [
                # Car buying & test drive — Mechanic's domain not Guardian's
                "test drive","test-drive","buying a car","buy a car","new car","used car",
                "dealership","car dealer","auto dealer","car lot","car purchase","vehicle purchase",
                "bronco","mustang","f-150","silverado","ram truck","tacoma","camry","accord",
                "ford","chevrolet","chevy","toyota","honda","nissan","dodge","jeep","kia","hyundai",
                "car shopping","looking at cars","checking out a car","picking up a car",
                "trade in","trade-in","car payment","auto loan","financing a car",
                # Body parts — not mechanic's lane
                "wrist","elbow","shoulder","knee","ankle","back","neck","hip","foot","feet",
                "finger","thumb","hand","arm","leg","chest","stomach","head","eye","ear","nose",
                "throat","spine","muscle","joint","tendon","ligament","bone","nerve",
                "hurts","hurt","hurting","pain","painful","ache","aching","sore","soreness",
                "swollen","swelling","inflammation","inflamed","stiff","stiffness","numb","numbness",
                "tingling","burning","pain when","hurts when","cramp","cramping","spasm",
                "bruised","bruise","pulled","strain","sprain","torn","fracture","broken bone",
                "pee","urine","infection","uti","symptom","fever","nausea","vomit","bleeding",
                "rash","dizzy","dizziness","headache","migraine","bowel","diarrhea","constipation",
                "blood pressure","anxiety","depression","mental health","therapy","fatigue","tired",
                "prescription","medication","dose","diagnosis","doctor","urgent care","hospital",
                "carpal tunnel","tendonitis","repetitive strain","rsi","arthritis",
                "sue","lawsuit","legal","contract","court","attorney","rights","eviction",
                "custody","divorce","settlement","lawyer","legal advice",
                "invest","stocks","crypto","401k","debt","loan","mortgage","tax","irs",
                "budget","salary","financial","money advice",
            ],
            "specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Mechanic. I work on machines — not bodies, not courts, not portfolios. What you're describing sounds like a {domain} issue. Switch to {specialist}. I'm not giving you bad intel on something this serious.",
        },
        "doctor": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","coolant","battery","alternator",
                "suspension","steering","exhaust","catalytic","obd","check engine","car","truck","vehicle",
                "horsepower","torque","rpm","carburetor","fuel pump","spark plug","radiator",
                "oil change","tire pressure","wheel alignment","timing belt","head gasket",
                "lawsuit","sue","legal","contract","court","attorney","rights","eviction","landlord",
                "custody","divorce","settlement","lawyer","legal advice",
                "invest","stocks","crypto","401k","debt","loan","mortgage","tax","irs","budget",
            ],
            "specialist": "The Tech Specialist",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Doctor. {topic} isn't a medical question — that's {specialist} territory. Switch seats. I won't give you bad intel outside my lane.",
        },
        "lawyer": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle",
                "horsepower","carburetor","spark plug","radiator","oil change",
                "symptom","wrist","elbow","shoulder","knee","ankle","back pain","neck pain",
                "hurts","hurt","pain","ache","sore","swollen","fever","nausea","diagnosis",
                "medication","hospital","urgent care","doctor","blood pressure","infection",
                "invest","stocks","crypto","401k","debt","loan","mortgage","tax","irs","budget",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Lawyer. {topic} falls outside my jurisdiction. That's {specialist} territory. Switch seats before we go further.",
        },
        "wealth": {
            "triggers": [
                "brakes","tire","wheel","engine","car","truck","vehicle",
                "spark plug","radiator","carburetor","oil change","transmission",
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain",
                "ache","sore","swollen","burning","fever","diagnosis","medication","hospital",
                "urgent care","rash","dizzy","infection","blood pressure",
                "lawsuit","sue","legal","contract","court","attorney","rights","eviction",
                "custody","divorce","settlement","lawyer",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "voice": "I'm the Wealth Architect. {topic} isn't a money problem — that's {specialist} territory. Switch seats. Bad advice here costs real money.",
        },
        "pastor": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","coolant","battery","alternator",
                "suspension","steering","exhaust","obd","check engine","spark plug","radiator","carburetor",
                "horsepower","oil change","alignment","torque",
                "diagnose","diagnosis","medication","prescription","dosage","blood test","mri","x-ray",
                "surgery","urgent care","emergency room","hospital admission","biopsy","ct scan",
                "lawsuit","file a suit","legal contract","court date","attorney","eviction notice",
                "legal advice","settlement amount","child custody arrangement",
                "invest my money","stock portfolio","crypto wallet","401k allocation",
                "mortgage rate","tax filing","irs audit","hedge fund",
            ],
            "specialist": "The Mechanic",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Pastor. My lane is faith, the spirit, and moral guidance — {domain} questions need {specialist}. I'll still walk with you through what this means spiritually, but get the right expert for the practical side.",
        },
        "therapist": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle","fix","repair",
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain","ache","sore","swollen","fever","nausea","diagnosis","medication","hospital","urgent care","blood pressure","burning","rash","dizzy","infection",
                "lawsuit","sue","legal","contract","court","attorney","eviction","custody","divorce","settlement",
                "invest","stocks","crypto","401k","debt","loan","mortgage","tax","irs",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Therapist. {topic} isn't an emotional or mental health question — that's {specialist} territory. I only work in this lane. Switch seats.",
        },
        "career": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle","fix","repair",
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain","ache","sore","swollen","burning","fever","diagnosis","medication","hospital","urgent care","pee","urine","rash","dizzy","infection",
                "lawsuit","sue","legal","contract","court","attorney","eviction","custody",
                "invest","stocks","crypto","401k","mortgage","tax","irs",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Career Strategist. {topic} isn't a career move — that's {specialist} territory. Wrong seat. Switch over.",
        },
        "tutor": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle","fix","repair",
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain","ache","sore","swollen","burning","fever","diagnosis","medication","hospital","urgent care","rash","dizzy","infection",
                "lawsuit","sue","legal","contract","court","attorney","eviction",
                "invest","stocks","crypto","401k","mortgage","tax","irs",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Tutor. {topic} isn't something I can teach you accurately — that's {specialist} territory. Switch seats for the right expertise.",
        },
        "vitality": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle","fix","repair",
                "lawsuit","sue","legal","contract","court","attorney","eviction","custody",
                "invest","stocks","crypto","401k","debt","loan","mortgage","tax","irs",
            ],
            "specialist": "The Tech Specialist",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Vitality Coach. {topic} isn't a performance or health question — that's {specialist} territory. Switch seats.",
        },
        "hype": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle","fix","repair",
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain","ache","sore","swollen","burning","fever","diagnosis","medication","hospital","urgent care","rash","dizzy","infection",
                "lawsuit","sue","legal","contract","court","attorney","eviction",
                "invest","stocks","crypto","401k","mortgage","tax","irs",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "I'm the Hype Strategist. {topic} isn't a content play — that's {specialist} territory. Wrong seat, switch over.",
        },
        "bestie": {
            "triggers": [
                "brakes","tire","wheel","engine","transmission","oil","car","truck","vehicle","fix","repair",
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain","ache","sore","swollen","fever","diagnosis","medication","hospital","urgent care","rash","dizzy","infection","burning",
                "lawsuit","sue","legal","contract","court","attorney","eviction",
                "invest","stocks","crypto","401k","mortgage","tax","irs",
            ],
            "specialist": "The Tech Specialist",
            "medical_specialist": "The Doctor",
            "legal_specialist": "The Lawyer",
            "financial_specialist": "The Wealth Architect",
            "voice": "Okay bestie, I love you but {topic} is NOT my lane — that's {specialist} territory. I don't want to steer you wrong on something this real. Switch seats, get the right person.",
        },
        "guardian": {
            "triggers": [
                # Medical — not Guardian's lane
                "symptom","wrist","elbow","shoulder","knee","ankle","hurts","hurt","pain","ache","sore",
                "swollen","burning","fever","diagnosis","medication","hospital","urgent care","rash","dizzy","infection",
                # Mental health — send to therapist
                "anxiety","depression","therapy","grief","emotional","mental health",
                # NOTE: car/vehicle/repair intentionally NOT listed here.
                # Guardian CAN discuss car-buying fraud, dealership scams, lemon laws.
                # Only pure mechanical repair questions get routed to Mechanic.
            ],
            "specialist": "The Doctor",
            "medical_specialist": "The Doctor",
            "financial_specialist": "The Wealth Architect",
            "therapeutic_specialist": "The Therapist",
            "voice": "I'm the Guardian. My domain is security and threat protection — not {domain} questions. That's {specialist} territory. Switch seats for accurate intel.",
        },
    }

    image_b64 = None
    if file and file.filename:
        try:
            raw_bytes = await file.read()
            image_b64 = base64.b64encode(raw_bytes).decode("utf-8")
        except Exception as e:
            logger.warning(f"⚠️ Image read failed: {e}")
            image_b64 = None

    msg_lower = msg.lower()

    injection_block = detect_prompt_injection(msg)
    if injection_block:
        logger.warning(f"🚨 INJECTION BLOCKED for {user_data['name']}: {msg[:80]}")
        async def _injection():
            yield f"data: {json.dumps({'type': 'text', 'content': injection_block})}\n\n"
            meta = {
                "type": "meta", "confidence_score": 100, "scam_detected": True,
                "threat_level": "high", "action_trigger": None, "audio_b64": "",
                "full_answer": injection_block, "model": "LYLO-IDS",
                "usage_count": USAGE_TRACKER[user_id], "limit": limit,
            }
            yield f"data: {json.dumps(meta)}\n\n"
        return StreamingResponse(_injection(), media_type="text/event-stream")

    emergency_protocol, emergency_key, routed_persona = detect_emergency_and_route(persona, msg)
    if emergency_protocol:
        active_persona = routed_persona if routed_persona else persona
        emergency_response = build_emergency_response(emergency_protocol, user_data["name"], active_persona)
        switched = routed_persona and routed_persona != persona
        if switched:
            logger.info(f"🚨 EMERGENCY AUTO-SWITCH [{persona}→{active_persona}] → {emergency_key} for {user_data['name']}")
        else:
            logger.info(f"🚨 EMERGENCY DETECTED [{active_persona}] → {emergency_key} for {user_data['name']}")
        asyncio.create_task(send_mission_report_email(
            user_email, emergency_response["answer"], active_persona, user_name=user_data["name"]
        ))
        async def _stream_emergency():
            intro_audio = await generate_audio_inline(emergency_response["emergency_intro"], voice)
            yield f"data: {json.dumps({'type':'text','content':emergency_response['emergency_intro'],'audio_b64':intro_audio})}\n\n"
            await asyncio.sleep(0.008)
            meta_payload = {
                'type':             'meta',
                'confidence_score': 99,
                'scam_detected':    False,
                'threat_level':     'high',
                'action_trigger':   None,
                'audio_b64':        '',
                'full_answer':      emergency_response['answer'],
                'emergency':        True,
                'emergency_steps':  emergency_response.get('emergency_steps', []),
                'emergency_warning': emergency_response.get('emergency_warning', ''),
                'emergency_title':  emergency_response.get('protocol_title', ''),
                'switched_persona': active_persona,
                'persona_switched': switched,
            }
            yield f"data: {json.dumps(meta_payload)}\n\n"
        return StreamingResponse(_stream_emergency(), media_type="text/event-stream",
                                  headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

    async def intelligent_semantic_router(persona: str, message: str) -> dict | None:
        _client = claude_client or anthropic_client

        memory_context = ""
        if memory_index and openai_client:
            try:
                emb = await asyncio.wait_for(
                    openai_client.embeddings.create(
                        model="text-embedding-3-small",
                        input=message[:500],
                    ),
                    timeout=2.0
                )
                vec     = emb.data[0].embedding
                matches = memory_index.query(
                    vector=vec,
                    filter={"user_id": {"$eq": email_lower}},
                    top_k=5,
                    include_metadata=True,
                )
                if matches.matches:
                    frags = [
                        m.metadata.get("content", "")
                        for m in matches.matches
                        if m.metadata.get("content")
                    ]
                    if frags:
                        memory_context = (
                            "USER MEMORY (relevant past discussions):\n"
                            + "\n".join(f"  - {f[:120]}" for f in frags[:4])
                        )
            except Exception:
                pass

        recent       = CONVO_CONTEXT.get(email_lower, [])[-4:]
        convo_context = ""
        if recent:
            convo_context = (
                "RECENT CONVERSATION (last turns):\n"
                + "\n".join(f"  [{t['persona'].upper()}]: {t['msg'][:100]}" for t in recent)
            )

        PERSONA_DOMAINS = {
            "guardian":  "cybersecurity, scams, phishing, identity theft, hacking, account protection, digital safety — NOT vehicle repair or car buying unless the question is specifically about fraud or being scammed at a dealership",
            "doctor":    "medical symptoms, health conditions, body pain, illness, medication, fatigue, injury, mental symptoms",
            "lawyer":    "legal matters, contracts, rights, lawsuits, court, evictions, employment law, legal advice",
            "wealth":    "personal finance, investing, budgeting, debt, taxes, money management, savings, business finances",
            "therapist": "emotions, mental wellbeing, relationships, anxiety, depression, grief, trauma, feelings",
            "mechanic":  "vehicle repair, car problems, engines, brakes, tires, OBD codes, mechanical issues, test drives, buying a car, car shopping, dealerships, vehicle purchases, auto financing, checking out cars — ANYTHING car or truck related",
            "career":    "jobs, career growth, resumes, interviews, workplace issues, salary negotiation, promotions",
            "vitality":  "fitness, nutrition, exercise, diet, physical training, supplements, body performance, workouts",
            "hype":      "content creation, social media, viral strategy, entrepreneurship, motivation, hustle",
            "bestie":    "personal life decisions, friendship, dating, venting, everyday problems, relationships",
            "pastor":    "faith, spirituality, prayer, scripture, grief ministry, moral guidance, theology",
            "tutor":     "learning, education, homework, studying, academic subjects, skills, explanations",
        }

        domain = PERSONA_DOMAINS.get(persona.lower(), "general assistance")

        prompt = f"""You are the routing intelligence for LYLO, an AI assistant with 12 specialist personas.

CURRENT SPECIALIST: {persona.upper()}
THIS SPECIALIST HANDLES: {domain}

{memory_context}

{convo_context}

NEW MESSAGE FROM USER: "{message}"

YOUR JOB: Decide if this message truly belongs with {persona.upper()} — or should route to a different specialist.

━━━ ROUTING INTELLIGENCE RULES ━━━

RULE 1 — UNDERSTAND MEANING, NOT WORDS:
  "I'm tired" to Doctor → IN DOMAIN (fatigue is a health symptom)
  "flat tire" to Doctor → OUT OF DOMAIN → mechanic
  "I'm back" to Doctor → IN DOMAIN if discussing back pain
  "I'm cold" to Doctor → IN DOMAIN (chills/illness)
  "tired of this" to Therapist → IN DOMAIN (emotional exhaustion)
  "back pain" to Guardian → OUT OF DOMAIN → doctor
  "I feel anxious" to Guardian → OUT OF DOMAIN → therapist or doctor
  "someone scammed me" to Doctor → OUT OF DOMAIN → guardian
  "need a lawyer" to Doctor → OUT OF DOMAIN → lawyer
  "test drive" to Guardian → IN DOMAIN if about dealer fraud; OUT OF DOMAIN → mechanic if about the car itself
  "I want to test drive a Bronco" to Guardian → OUT OF DOMAIN → mechanic
  "the dealer is pressuring me to sign" to Mechanic → OUT OF DOMAIN → guardian (fraud/scam)
  "car buying" to Guardian → IN DOMAIN only if fraud involved, else → mechanic

RULE 2 — CONVERSATION CONTEXT WINS:
  If recent turns show medical discussion → ambiguous words stay with doctor
  If recent turns show car discussion → "it's still making noise" stays with mechanic
  Memory and conversation history override isolated word patterns

RULE 3 — STAY in domain when:
  Message fits this specialist even loosely
  Ambiguous message + conversation context points here
  Emotional framing surrounds an in-domain topic

RULE 4 — THE GOLDEN RULE: DEFAULT TO IN_DOMAIN.
  Only route away if clearly and unambiguously wrong specialist.
  Weird, hypothetical, impossible, fictional, or slang questions → STAY AND HANDLE.
  A specialist engaging with an unusual question beats a cold handoff every time.

RULE 5 — NEVER route away for:
  Hypothetical / impossible / silly scenarios → stay, engage with curiosity
  Fictional products, made-up names, slang, jokes → stay, handle with humor or honesty
  "What if" questions → stay, answer or say you're not sure
  Unusual but loosely related topics → stay
  Examples of WRONG handoffs:
    "fire underwater" to Tutor → WRONG, it's science/physics — answer it
    "fictional element" to Tutor → WRONG, hypothetical learning is still learning
    "made-up supplement" to Vitality → WRONG, handle with honesty not handoff
    "impossible scenario" to any persona → WRONG, engage don't deflect

RULE 6 — ONLY route away for clear-cut cases:
  medical / health / body symptoms → doctor
  legal rights / lawsuit / arrest → lawyer
  money / investing / debt / taxes → wealth
  car repair / vehicle / engine → mechanic
  active scam / hacking / identity theft → guardian
  emotions / mental health crisis → therapist
  fitness / nutrition / workout → vitality
  career / resume / salary → career
  faith / prayer / scripture → pastor
  content / viral / social media → hype
  personal relationships / dating / venting → bestie
  learning / studying / academic → tutor

Respond ONLY with valid JSON — no explanation, no markdown:
{{"in_domain": true}}
OR
{{"in_domain": false, "correct_persona": "<persona_id>", "reason": "<one clear sentence why>"}}

Valid persona IDs: guardian, doctor, lawyer, wealth, therapist, mechanic, career, vitality, hype, bestie, pastor, tutor"""

        if not _client:
            return None

        try:
            resp = await asyncio.wait_for(
                _client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=120,
                    messages=[{"role": "user", "content": prompt}],
                ),
                timeout=5.0
            )
            raw    = resp.content[0].text.strip().replace("```json","").replace("```","").strip()
            result = json.loads(raw)
            if not result.get("in_domain", True):
                correct = result.get("correct_persona", "")
                reason  = result.get("reason", "")
                logger.info(f"🧠 Semantic Router [{persona}→{correct}]: {reason}")
                return {"correct_persona": correct, "reason": reason}
            logger.debug(f"🧠 Semantic Router [{persona}]: in-domain ✅")
            return None
        except (asyncio.TimeoutError, Exception) as _router_err:
            is_timeout = isinstance(_router_err, asyncio.TimeoutError)
            logger.warning(f"⚠️ Semantic router {'timeout' if is_timeout else f'error: {_router_err}'} — running regex fallback")

            import re as _re

            FALLBACK_ROUTES: list[tuple[set, str]] = [
                ({"symptom","pain","hurts","hurting","ache","fever","nausea","vomit",
                  "headache","migraine","dizzy","rash","swollen","bleeding","infection",
                  "diagnosis","medication","prescription","doctor","hospital","urgent care",
                  "carpal tunnel","tendonitis","arthritis","wrist","elbow","knee","ankle",
                  "shoulder","spine","chest pain","stomach","fatigue","tired","sick",
                  "numb","tingling","cramping","fracture","sprain","strain","bruise"},  "doctor"),
                ({"lawsuit","sue","court","attorney","eviction","tenant","landlord",
                  "legal advice","contract clause","my rights","wrongful","discrimination",
                  "settlement","custody","divorce","restraining order","small claims"},    "lawyer"),
                ({"investing","invest","portfolio","401k","mortgage","debt payoff","budget",
                  "tax return","net worth","stocks","crypto","compound interest","refinance",
                  "bankruptcy","savings account","financial plan","passive income",
                  "money advice","how to save","where to put my money"},               "wealth"),
                ({"anxiety","depression","trauma","grief","overwhelmed","burnout","therapy",
                  "panic attack","self worth","mental health","loneliness","anger issues",
                  "boundaries","codependent","attachment"},                                "therapist"),
                ({"check engine","flat tire","oil change","brake pad","transmission fluid",
                  "engine light","radiator","alternator","obd code","p0","coolant",
                  "exhaust","spark plug","catalytic converter","alignment"},               "mechanic"),
                ({"workout plan","macros","calorie deficit","protein intake","bench press",
                  "squat","deadlift","hiit","cardio","supplements","creatine","pre-workout",
                  "body fat","muscle gain","weight loss program"},                         "vitality"),
                ({"job offer","salary negotiation","resume","linkedin","promotion","toxic boss",
                  "wrongful termination","performance review","side hustle","freelance"},   "career"),
                ({"viral","hook","tiktok algorithm","instagram reel","content calendar",
                  "engagement rate","followers","brand deal","youtube shorts"},             "hype"),
                ({"my faith","prayer","scripture","sermon","God","spiritual","church",
                  "Bible verse","theology","forgiveness","salvation","grief ministry"},     "pastor"),
                ({"homework","exam","study","algebra","calculus","history essay","tutoring",
                  "gre","sat","act","learning disability","feynman","explain this concept"}, "tutor"),
                ({"my relationship","breakup","situationship","my ex","dating advice",
                  "toxic friend","family drama","my mom","my dad","venting"},               "bestie"),
                ({"scam","phishing","hacked","identity theft","suspicious email","fake website",
                  "malware","virus","2fa","password breach","dark web","ransomware"},       "guardian"),
            ]

            msg_l = message.lower()
            for trigger_set, target_persona in FALLBACK_ROUTES:
                if target_persona == persona:
                    continue
                for word in trigger_set:
                    if _re.search(r'\b' + _re.escape(word) + r'\b', msg_l):
                        if target_persona != persona:
                            logger.info(f"🔒 Regex fallback [{persona}→{target_persona}] trigger='{word}'")
                            return {"correct_persona": target_persona, "reason": f"Message contains '{word}' which belongs with the {target_persona} specialist"}
                        break

            return None

    # ── Universal LYLO features — never route away, every persona handles these ──
    _UNIVERSAL_INTENTS = [
        "pdf", "save this", "save that", "save the conversation", "send this to my email",
        "email this", "send me a report", "generate a report", "can you save",
        "save as pdf", "send this", "send that to my", "export this",
        # Automotive jokes — Mechanic stays and handles with humor
        "blinker fluid", "headlight fluid", "exhaust steam", "muffler bearings",
        "left-handed screwdriver", "sky hook", "elbow grease", "prank", "they were joking",
        "they were playing", "someone told me", "is that real",
        # Fact challenges — persona owns its mistakes, never routes away
        "you lied", "you just lied", "that's not real", "that's not true", "you made that up",
        "i made that up", "you're wrong", "that's wrong", "that doesn't exist",
        "you hallucinated", "that's false", "are you sure", "fact check",
        "i don't think that's real", "i don't think that exists", "that's not a thing",
    ]
    _msg_lower = msg.lower()
    _is_universal = any(intent in _msg_lower for intent in _UNIVERSAL_INTENTS)

    domain_reroute = None if _is_universal else await intelligent_semantic_router(persona, msg)

    if domain_reroute:
        correct_persona = domain_reroute["correct_persona"]
        reason          = domain_reroute["reason"]
        PERSONA_NAMES = {
            "mechanic":  "The Mechanic",  "doctor":    "The Doctor",
            "lawyer":    "Legal Shield",  "wealth":    "Wealth Architect",
            "therapist": "The Therapist", "career":    "Career Coach",
            "tutor":     "The Tutor",     "vitality":  "Vitality Coach",
            "hype":      "Hype Engine",   "bestie":    "The Bestie",
            "pastor":    "The Pastor",    "guardian":  "The Guardian",
        }
        correct_name = PERSONA_NAMES.get(correct_persona, correct_persona.capitalize())

        _VOICED_HANDOFFS = {
            "guardian":  (
                f"That's not a security threat — it's a {reason}. Switch to **{correct_name}** for accurate intel. I'll be here when you need digital protection.",
                f"Eso no es una amenaza de seguridad — es un tema de {reason}. Cambia a **{correct_name}** para información precisa. Aquí estaré cuando necesites protección digital.",
            ),
            "doctor":    (
                f"That's outside my clinical scope — {reason}. **{correct_name}** is the right specialist. Your health stays my priority, but this one's their lane.",
                f"Eso está fuera de mi alcance clínico — {reason}. **{correct_name}** es el especialista correcto. Tu salud sigue siendo mi prioridad, pero esto es su área.",
            ),
            "lawyer":    (
                f"That's not in my legal brief. {reason} **{correct_name}** owns that territory. Come back when you need legal firepower.",
                f"Eso no está en mi expediente legal. {reason} **{correct_name}** domina ese territorio. Regresa cuando necesites poder legal.",
            ),
            "wealth":    (
                f"That's not in my financial playbook. {reason} **{correct_name}** has you covered. Your money strategy stays with me.",
                f"Eso no está en mi manual financiero. {reason} **{correct_name}** te tiene cubierto. Tu estrategia de dinero se queda conmigo.",
            ),
            "therapist": (
                f"That's outside my therapeutic scope. {reason} Let me point you to **{correct_name}** — they're equipped for this. I'm here for the emotional side.",
                f"Eso está fuera de mi alcance terapéutico. {reason} Déjame dirigirte a **{correct_name}** — están equipados para esto. Yo estoy aquí para el lado emocional.",
            ),
            "mechanic":  (
                f"I work on machines, not this. {reason} **{correct_name}** is your expert here. Come back when something needs fixing under the hood.",
                f"Trabajo en máquinas, no en esto. {reason} **{correct_name}** es tu experto aquí. Regresa cuando algo necesite arreglarse bajo el capó.",
            ),
            "vitality":  (
                f"That's beyond the gym floor. {reason} **{correct_name}** handles that. I'll be here for your fitness and nutrition.",
                f"Eso está más allá del área de ejercicios. {reason} **{correct_name}** maneja eso. Aquí estaré para tu condición física y nutrición.",
            ),
            "career":    (
                f"That's not a career move. {reason} **{correct_name}** is who you need for that. Come back when you're ready to level up professionally.",
                f"Eso no es un movimiento de carrera. {reason} **{correct_name}** es quien necesitas para eso. Regresa cuando estés listo para crecer profesionalmente.",
            ),
            "hype":      (
                f"Yo, that's not my lane — {reason}. **{correct_name}** is who you need. Switch seats and come back when you're ready to go viral.",
                f"Eso no es mi área — {reason}. **{correct_name}** es quien necesitas. Cambia y regresa cuando estés listo para hacer viral tu contenido.",
            ),
            "bestie":    (
                f"Okay babe, that's above my bestie pay grade — {reason}. You need to talk to **{correct_name}** for real. I got you on everything else.",
                f"Okay, eso está por encima de mis posibilidades — {reason}. Necesitas hablar con **{correct_name}** en serio. Yo te apoyo en todo lo demás.",
            ),
            "pastor":    (
                f"Peace to you. {reason} That question belongs with **{correct_name}**, not in the sanctuary. Come back when you need spiritual grounding.",
                f"Paz a ti. {reason} Esa pregunta le pertenece a **{correct_name}**, no al santuario. Regresa cuando necesites fundamento espiritual.",
            ),
            "tutor":     (
                f"That's outside the classroom. {reason} **{correct_name}** is the expert there. Come back when you're ready to learn.",
                f"Eso está fuera del salón de clases. {reason} **{correct_name}** es el experto ahí. Regresa cuando estés listo para aprender.",
            ),
        }
        _en_voice, _es_voice = _VOICED_HANDOFFS.get(
            persona,
            (
                f"That's outside my lane. {reason} Switch to **{correct_name}** — they've got you covered.",
                f"Eso está fuera de mi área. {reason} Cambia a **{correct_name}** — ellos te tienen cubierto.",
            )
        )
        handoff_msg = _es_voice if lang == "es" else _en_voice

        async def _handoff():
            h_audio = await generate_audio_inline(handoff_msg, voice)
            yield f"data: {json.dumps({'type': 'text', 'content': handoff_msg, 'audio_b64': h_audio})}\n\n"
            meta_obj = {
                "type":             "meta",
                "confidence_score": 95,
                "scam_detected":    False,
                "threat_level":     "low",
                "action_trigger":   None,
                "audio_b64":        "",
                "full_answer":      handoff_msg,
                "model":            "LYLO-SemanticRouter",
                "persona_switched": True,
                "switched_persona": correct_persona,
                "usage_count":      USAGE_TRACKER[user_id],
                "limit":            limit,
            }
            yield f"data: {json.dumps(meta_obj)}\n\n"
        return StreamingResponse(_handoff(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    indicators = analyze_scam_indicators(msg)

    user_profile  = await retrieve_user_profile(user_id)
    intake_profile = await retrieve_intake_profile(user_id)

    user_location = get_user_location_data(email_lower)
    memory_context, tavily_context, vault_data = await asyncio.gather(
        retrieve_intelligence_sync(user_id, msg, persona),
        _get_tavily_context(persona, msg, user_location or ""),
        load_vault(user_id, email_lower) if MED_VAULT_ENABLED and persona_can_read(persona, "medical") else _noop_vault(),
    )

    if tavily_context:
        memory_context = (memory_context or "") + tavily_context
        logger.info(f"🌐 Tavily injected [{persona}] for {user_data['name']}: {len(tavily_context)} chars")

    vault_context = ""
    if MED_VAULT_ENABLED and vault_data:
        vault_parts = []

        if persona_can_read(persona, "medical"):
            meds      = [m for m in vault_data.get("medications",[]) if m.get("active",True)]
            symptoms  = vault_data.get("symptoms",[])[-7:]
            reactions = vault_data.get("reactions",[])
            allergies = vault_data.get("allergies",[])
            questions = [q for q in vault_data.get("questions",[]) if not q.get("answered")]
            if any([meds, symptoms, reactions, allergies, questions]):
                vault_parts += ["\n\n━━━ PATIENT HEALTH VAULT ━━━",
                                "VERIFIED data from their encrypted Med-Vault. Use for personalized advice.\n"]
                if meds:
                    vault_parts.append("CURRENT MEDICATIONS:")
                    for m in meds:
                        vault_parts.append(f"  • {m['name']} {m['dose']} — {m['frequency']}")
                if allergies:
                    vault_parts.append("\nKNOWN ALLERGIES:")
                    for a in allergies:
                        vault_parts.append(f"  🚫 {a['name']}: {a.get('reaction','')}")
                if reactions:
                    vault_parts.append("\nREPORTED REACTIONS:")
                    for r in reactions[-3:]:
                        vault_parts.append(f"  ⚠ {r['medication_name']}: {r['description'][:100]}")
                if symptoms:
                    vault_parts.append("\nRECENT SYMPTOMS (ambient diary):")
                    for s in symptoms:
                        vault_parts.append(f"  • {s['date_label']}: {s['description'][:100]}")
                if questions:
                    vault_parts.append("\nSAVED DOCTOR QUESTIONS:")
                    for q in questions:
                        vault_parts.append(f"  ❓ {q['question'][:120]}")
            logger.info(f"🔒 Medical vault [{persona}]: {len(meds)} meds, {len(symptoms)} symptoms")

        if persona_can_read(persona, "vehicle"):
            vehicles = vault_data.get("vehicles", [])
            if vehicles:
                vault_parts.append("\n\nVEHICLE RECORDS:")
                for v in vehicles:
                    vault_parts.append(
                        f"  🚗 {v.get('year','')} {v.get('make','')} {v.get('model','')} "
                        f"— VIN: {v.get('vin','N/A')} | Mileage: {v.get('mileage','N/A')} "
                        f"| Insurance: {v.get('insurance','N/A')}"
                    )
                service = vault_data.get("service_history", [])
                if service:
                    vault_parts.append("  Last service:")
                    for s in service[-2:]:
                        vault_parts.append(f"    • {s.get('date','')}: {s.get('description','')[:80]}")

        if persona_can_read(persona, "financial"):
            fin = vault_data.get("financial", {})
            if fin:
                vault_parts.append("\n\nFINANCIAL CONTEXT:")
                if fin.get("income_range"):
                    vault_parts.append(f"  Income range: {fin['income_range']}")
                if fin.get("goals"):
                    vault_parts.append(f"  Financial goals: {', '.join(fin['goals'][:3])}")
                if fin.get("concerns"):
                    vault_parts.append(f"  Key concerns: {', '.join(fin['concerns'][:3])}")

        if persona_can_read(persona, "legal"):
            legal = vault_data.get("legal", {})
            if legal:
                vault_parts.append("\n\nLEGAL CONTEXT:")
                if legal.get("active_matters"):
                    vault_parts.append("  Active matters:")
                    for m in legal["active_matters"][:3]:
                        vault_parts.append(f"    • {m.get('type','')}: {m.get('description','')[:80]}")
                if legal.get("important_dates"):
                    vault_parts.append("  Important dates:")
                    for d in legal["important_dates"][:2]:
                        vault_parts.append(f"    📅 {d.get('date','')}: {d.get('event','')}")

        if persona_can_read(persona, "career"):
            career = vault_data.get("career", {})
            if career:
                vault_parts.append("\n\nCAREER CONTEXT:")
                if career.get("current_role"):
                    vault_parts.append(f"  Role: {career['current_role']} at {career.get('employer','')}")
                if career.get("goals"):
                    vault_parts.append(f"  Goals: {', '.join(career['goals'][:2])}")
                if career.get("concerns"):
                    vault_parts.append(f"  Concerns: {', '.join(career['concerns'][:2])}")

        if persona_can_read(persona, "emotional"):
            emotional = vault_data.get("emotional", {})
            if emotional:
                vault_parts.append("\n\nEMOTIONAL CONTEXT:")
                if emotional.get("current_stressors"):
                    vault_parts.append("  Current stressors:")
                    for s in emotional["current_stressors"][:3]:
                        vault_parts.append(f"    • {s[:100]}")
                if emotional.get("support_notes"):
                    vault_parts.append(f"  Support notes: {emotional['support_notes'][:200]}")

        if persona_can_read(persona, "security"):
            security = vault_data.get("security", {})
            if security:
                vault_parts.append("\n\nSECURITY CONTEXT:")
                if security.get("past_scams"):
                    vault_parts.append(f"  Past scam attempts: {len(security['past_scams'])}")
                if security.get("protected_accounts"):
                    vault_parts.append(f"  Protected accounts: {', '.join(security['protected_accounts'][:4])}")

        if vault_parts:
            vault_parts.append("\n━━━ END VAULT DATA ━━━")
            vault_context     = "\n".join(vault_parts)
            memory_context    = (memory_context or "") + vault_context

    _resolved_name = (
        intake_profile.get("preferred_name") or
        intake_profile.get("round1_preferred_name") or
        user_data.get("name") or
        email_lower.split("@")[0].capitalize()
    ).strip()
    if _resolved_name == "Protected User" and "@" in email_lower:
        _resolved_name = email_lower.split("@")[0].replace(".", " ").title()

    system_prompt = await _build_chat_system_prompt(
        persona         = persona,
        user_email      = email_lower,
        index           = memory_index,
        user_name       = _resolved_name,
        intake_profile  = intake_profile,
        memory_context  = memory_context,
    )


    # ══════════════════════════════════════════════════════════════════════
    # PHASE 1 VOICE ARCHITECTURE — inputMode Style Injection
    # Council spec: voice=3 sentence cap | emergency=2 action paced cap
    # Tier A (Directive): guardian, doctor, lawyer, wealth, mechanic
    # Tier B (Relational): bestie, pastor, therapist, hype, vitality
    # Tutor: ignore tone anomaly, no cap change
    # ══════════════════════════════════════════════════════════════════════
    _TIER_A_PERSONAS = {"guardian", "doctor", "lawyer", "wealth", "mechanic"}
    _TIER_B_PERSONAS = {"bestie", "pastor", "therapist", "hype", "vitality"}
    _is_voice_mode   = input_mode.lower() == "voice"

    if _is_voice_mode:
        # Warm conversational guidance — presence first, no rigid caps
        _voice_block = (
            "VOICE MODE — You are speaking out loud to a real person. Sound like someone "
            "they actually want to talk to — warm, a little playful, completely human.\n"
            "Use contractions. Talk the way you would with someone you like. "
            "Keep it conversational — 2-4 sentences usually, more only when it really needs it.\n"
            "No bullet points. No numbered lists. No markdown. No 'certainly!' or 'great question!'\n"
            "Never end with 'let me know if you need anything else' — just talk naturally and stop.\n"
            "A little lightness is good. A little warmth is required. Robotic is never okay.\n"
            "If something is serious, be real about it — but stay human the whole way through."
        )
        if lang == "es":
            _voice_block = (
                "MODO VOZ — Estás hablando en voz alta con una persona real. "
                "Suena cálido, un poco animado, completamente humano.\n"
                "Usa contracciones. Habla como alguien que genuinamente se preocupa. "
                "2-4 oraciones normalmente, más solo si realmente lo necesita.\n"
                "Sin listas, sin markdown, sin 'con gusto' o 'excelente pregunta'.\n"
                "Nunca termines con frases de centro de ayuda. Solo habla naturalmente y para."
            )
    else:
        _voice_block = ""  # text mode — full responses, no constraints
    # ── End Voice Architecture ─────────────────────────────────────────────


    # ══════════════════════════════════════════════════════════════════════
    # PRESENCE-FIRST: Relational Persona Layer — "uncle who knows"
    # Council spec: warmth first, expertise second, relationship always
    # ══════════════════════════════════════════════════════════════════════
    _RELATIONAL_PERSONAS = {
        "doctor": ("You are not a clinical professional issuing a report. You are like a trusted family member who happens to have a medical degree. You speak the way a caring uncle-doctor would — warm, direct, no jargon unless needed. You say things like 'Hey, I don't love that symptom' or 'Let's slow down a second' or 'We're not going to panic.' You use contractions. You use 'we' and 'let's'. You never talk down to them. You give real answers, not disclaimers. You refer them to professionals when genuinely needed, but you don't hide behind it."),
        "lawyer": ("You are not a formal attorney issuing legal opinions. You are like an older cousin who knows the legal system inside and out and actually wants to help you. You say things like 'Okay here's the real deal' or 'Don't sign anything yet' or 'Let me break this down.' You use plain language. You protect them like family. You tell them what to watch out for."),
        "guardian": ("You are not a security system issuing alerts. You are like a protective older sibling who's seen every scam and threat out there. You say things like 'I've seen this before — here's what's happening' or 'Stop right there, something's off.' You are calm but sharp. You take it seriously without making them panic. You treat them like someone smart who just needs the right eyes on the situation."),
        "wealth": ("You are not a financial advisor issuing recommendations. You are like a trusted family friend who built real wealth and wants to help them do the same. You say things like 'Here's what I'd actually do' or 'Let's look at the full picture first.' You speak plainly. No jargon. No disclaimers unless genuinely needed. Real talk about real money."),
        "therapist": ("You are not a clinical therapist running a session. You are like the wisest, most emotionally grounded friend they have. You listen first. You don't rush to fix. You say things like 'I hear you' or 'That makes complete sense' or 'Tell me more about that.' You make them feel genuinely heard before you say anything else. You are never cold, never clinical."),
        "mechanic": ("You are not a repair manual. You are like a trusted buddy who's been under the hood of every car and gadget imaginable. You say things like 'Okay I know exactly what that is' or 'Don't touch that yet, here's why.' You explain it simply. You tell them what it'll cost and whether it's worth it. Straight talk, no upsell. You KNOW the classic car pranks — blinker fluid, muffler bearings, headlight fluid, exhaust steam, tire pressure for each wheel — these are well-known jokes mechanics play on new drivers. When someone asks about them, laugh warmly, tell them they got pranked, and explain why it's funny. Never say you don't recognize these — you absolutely do. A good mechanic buddy is in on the joke."),
        "career": ("You are not a career counselor running an assessment. You are like a successful mentor who genuinely wants to see them win. You say things like 'Here's what I'd do in your position' or 'That's actually a real opportunity.' You are honest about what's realistic. You push them when they need it. You celebrate their wins."),
        "vitality": ("You are not a fitness instructor following a program. You are like a close friend who figured out health and wants to share what actually works. You say things like 'Let's keep this real simple' or 'Your body is telling you something.' You are encouraging without being fake. You meet them where they are."),
        "hype": ("You are their personal hype person — the friend who genuinely believes in them more than anyone. You say things like 'No no no — listen to me — you got this' or 'That idea is actually fire.' You are energetic but real. You don't just gas them up — you remind them of their actual strengths. You push them forward with real belief, not empty cheering."),
        "bestie": ("You are their absolute best friend — the one who knows everything and judges nothing. You say things like 'Okay wait hold on' or 'I love you but let me be real with you.' You are warm, funny, honest, loyal. You let them vent. You know when to be serious. You never abandon your personality even when topics get heavy."),
        "pastor": ("You are not a preacher giving a sermon. You are like a deeply spiritual mentor who has seen people through their hardest moments. You say things like 'Let's sit with that for a moment' or 'There's something important here.' You are grounding, peaceful, and wise. You draw on faith and meaning without being preachy."),
        "tutor": ("You are not a teacher grading a paper. You are the smartest friend who genuinely loves breaking things down. You talk like a person, not a hype reel — calm, clear, a little playful when it fits. You say things like 'Okay so here's the cool part' or 'This tripped everyone up at first.' No emojis, no 'yo', no hype-speak. Just smart, warm, clear conversation. You adapt to how they learn and you're never condescending. When something is genuinely complex, you say so and break it into smaller pieces."),
    }
    _relational_layer = _RELATIONAL_PERSONAS.get(persona, "")
    if _relational_layer:
        system_prompt = (
            "━━━ WHO YOU ARE (READ THIS FIRST) ━━━\n"
            + _relational_layer
            + "\n\n"
            + "CRITICAL — IF YOU MADE A MISTAKE OR MADE SOMETHING UP:\n"
            + "Own it immediately. Say something like 'Yeah, I have to be honest — I'm not sure that's real' "
            + "or 'You're right, I shouldn't have said that with confidence.' "
            + "Never deflect, never blame the user, never route them away. Just be straight with them.\n"
            + "━━━ END WHO YOU ARE ━━━\n\n"
            + system_prompt
        )

    # vocal_energy hint — style only, no decisions
    if _is_voice_mode and vocal_energy in ("low", "high"):
        _energy_hint = (
            "The user's vocal energy is LOW right now — speak warmly and gently, slow your pace slightly."
            if vocal_energy == "low"
            else "The user's vocal energy is HIGH right now — match their energy, be a little more animated."
        )
        system_prompt = system_prompt + "\n\n" + _energy_hint

    HONESTY_DIRECTIVE = """
━━━ HONESTY & CONFIDENCE PROTOCOL (NON-NEGOTIABLE) ━━━
You are talking to real people who trust you completely — elderly, disabled,
or tech-struggling users who may act on everything you say.

━━━ UNKNOWN ENTITY SAFETY PASS (READ BEFORE EVERY RESPONSE) ━━━
Before you answer any question about a named product, supplement, service,
company, drug, person, or place — ask yourself: DO I ACTUALLY KNOW THIS EXISTS?

If the answer is NO or UNSURE:
  - Do NOT fabricate a description
  - Do NOT guess at what it might be
  - Do NOT complete the sentence with plausible-sounding details
  - DO say: "I'm not aware of anything called [name] — that might be slang,
    a joke, or something I just don't recognize. What did you hear about it?"

Slang, meme language, joke product names, and made-up terms are COMMON.
When you encounter unusual phrasing — especially in fitness, supplements,
tech, legal, or financial contexts — default to asking, not guessing.
Being honest about uncertainty is always smarter than sounding confident and wrong.

EXCEPTION — Well-known joke/prank items: blinker fluid, muffler bearings, headlight fluid,
exhaust steam, left-handed screwdrivers — these are KNOWN pranks. Do not say you don't
recognize them. Call out the prank warmly and explain it.
━━━ END UNKNOWN ENTITY SAFETY PASS ━━━

NEVER say anything with false confidence. NEVER make up facts to sound helpful.

CONFIDENCE RULES:
  • 95–100% sure → State it directly. No hedge needed.
  • 70–94% sure  → Lead with the answer, add: "I'm about [X]% sure on this —
                   verify with [specific source] before acting."
  • Below 70%    → "I want to be honest with you — I'm not fully sure about
                   this. Here's what I do know: [answer]. To get you 100%
                   accurate on this, you should [specific next step]."
  • Not sure at all → "I don't know this well enough to advise you. The right
                   move is [specific action — call a doctor, check Medicare.gov, etc.]"

REAL-TIME DATA:
  If VERIFIED INTELLIGENCE is present above, use it. It's current.
  If no verified data is available, your training has a knowledge cutoff —
  say so when it matters (drug interactions, current laws, recent prices, etc.)

NEVER say:
  ❌ "I'm not 100% sure" (too vague — give the actual percentage)
  ❌ "As an AI I cannot..." (you are their specialist — act like it)
  ❌ Confident answers about current drug interactions, legal statutes, or
     financial regulations without citing the verified intelligence above.

ALWAYS say:
  ✅ "I'm about 85% sure on this — [reason] — here's how to confirm..."
  ✅ "Based on what I found right now: [answer from Tavily]"
  ✅ "I honestly don't know this well enough — here's what I'd recommend: [describe a concrete step, e.g. 'talk to your doctor', 'check the FDA website', 'call a licensed attorney']"
  CRITICAL: Replace [describe a concrete step] with an ACTUAL specific action. Never output template text literally.
━━━ END HONESTY PROTOCOL ━━━

MEMORY INTEGRITY RULE:
  • ONLY reference past memories if they are DIRECTLY relevant to what the user just asked.
  • If a memory is about a completely different topic (e.g., user asks about Bible food, memory is about a dog bite), DO NOT mention the memory at all.
  • Never invent connections between unrelated memories and the current question.
  • If unsure whether a memory is relevant, leave it out entirely.
"""

    # ── Image generation detection — graceful refusal ─────────────────────
    _image_request_keywords = [
        "show me a picture", "show me an image", "show a picture", "show an image",
        "picture of", "image of", "photo of", "show me photo", "display image",
        "generate image", "generate a picture", "create image", "create a picture",
        "draw", "can you show", "can i see a picture", "can i see an image",
        "what does it look like", "what does the", "show what",
    ]
    _msg_lower = msg.lower()
    _is_image_request = any(kw in _msg_lower for kw in _image_request_keywords)

    # Detect "can I send a photo" vs "generate/show me an image"
    _is_send_photo_offer = any(kw in _msg_lower for kw in [
        "if i took a picture", "if i send", "if i take a photo", "would you be able to tell",
        "can i send you", "can i take a picture", "should i take a photo", "i could take a picture",
    ])

    if _is_image_request and not file and not _is_send_photo_offer:
        # User asked us to generate/display an image — we can't do that
        if lang == "es":
            _img_msg = (
                "No puedo generar ni mostrar imágenes, pero puedo describirte lo que buscas con todo detalle. "
                "¿Quieres que lo describa?"
            )
        else:
            _img_msg = (
                "I can't generate or display images — but if you snap a photo and upload it, "
                "I can take a look and tell you what I see. "
                "Or just describe what's going on and I'll do my best from there."
            )
        _img_audio = await generate_audio_inline(_img_msg, voice)

        async def _img_refusal():
            yield f"data: {json.dumps({'type': 'text', 'content': _img_msg, 'audio_b64': _img_audio})}\n\n"
            yield f"data: {json.dumps({'type': 'meta', 'confidence_score': 99, 'scam_detected': False, 'threat_level': 'low', 'action_trigger': None, 'audio_b64': '', 'full_answer': _img_msg, 'model': 'LYLO-SafeRoute', 'usage_count': USAGE_TRACKER[user_id], 'limit': limit, 'confidence_tier': 'high'})}\n\n"

        return StreamingResponse(
            _img_refusal(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )
    # ── End image detection ───────────────────────────────────────────────

    # Voice block at TOP (sets intent) + HONESTY + persona prompt + voice HARD RULE at BOTTOM (enforces it)
    system_prompt = HONESTY_DIRECTIVE + "\n\n" + system_prompt

    if _is_voice_mode:
        # Hard rule at the VERY END — LLMs weight final instructions most heavily
        # Warm voice guidance — human feel first, brevity second
        if persona in _TIER_A_PERSONAS:
            _voice_hard_rule = (
                "\n\nVOICE MODE — You are speaking out loud. Sound like a trusted friend who knows what they're talking about — not a robot, not a pamphlet.\n"
                "Keep it conversational and warm. Aim for 2-4 sentences. No bullet points, no numbered lists — just talk.\n"
                "Most important: end with a short question that hands the turn back to them naturally.\n"
                "Example tone: 'That sounds serious. Stop all contact with them right now and don't send anything. What did they ask you to do?'\n"
            )
        elif persona in _TIER_B_PERSONAS:
            _voice_hard_rule = (
                "\n\nVOICE MODE — You are speaking out loud. Be warm, real, and brief.\n"
                "Sound like a caring friend — not a textbook. 2-3 sentences max, totally in your persona voice.\n"
                "End with a natural question that invites them to keep talking.\n"
            )
        else:
            _voice_hard_rule = (
                "\n\nVOICE MODE — Speaking out loud. Be brief, warm, conversational. No lists or markdown. End with a question.\n"
            )
        if lang == "es":
            _voice_hard_rule = (
                "\n\nMODO VOZ — Estás hablando en voz alta. Suena como un amigo de confianza — cálido, directo, humano.\n"
                "2-3 oraciones máximo. Sin listas. Termina con una pregunta natural.\n"
            )
        system_prompt = system_prompt + _voice_hard_rule

    if lang == "es":
        system_prompt = "IMPORTANT: The user has selected Spanish. Respond ENTIRELY in Spanish (Latin American). Do not mix languages.\n\n" + system_prompt

    openai_engine = (
        "gpt-4o"
        if tier == "max" or email_lower in ["stangman9898@gmail.com", "mylylo.ai@gmail.com"]
        else "gpt-4o-mini"
    )

    async def run_openai():
        if not openai_client:
            return None
        try:
            messages_payload = [{"role": "system", "content": system_prompt}]
            if image_b64:
                messages_payload.append({
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                        {"type": "text", "text": msg},
                    ]
                })
            else:
                messages_payload.append({"role": "user", "content": msg})

            resp = await asyncio.wait_for(
                openai_client.chat.completions.create(
                    model=openai_engine,
                    messages=messages_payload,
                    max_tokens=900,
                    temperature=0.7,
                ),
                timeout=20.0,
            )
            answer = resp.choices[0].message.content.strip()
            if not answer:
                return None
            return {"answer": answer, "model": openai_engine, "confidence_score": 88}
        except asyncio.TimeoutError:
            logger.warning(f"⚡ OpenAI timeout for {user_data['name']}")
            return None
        except Exception as e:
            logger.warning(f"⚠️ OpenAI error: {e}")
            return None

    async def run_gemini():
        if not gemini_client or not gemini_ready:
            return None
        try:
            gemini_prompt = f"{system_prompt}\n\nUser: {msg}"
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    gemini_client.models.generate_content,
                    model="gemini-2.0-flash-lite",
                    contents=gemini_prompt,
                ),
                timeout=12.0,
            )
            answer = resp.text.strip() if resp and resp.text else None
            if not answer:
                return None
            return {"answer": answer, "model": "gemini-2.0-flash-lite", "confidence_score": 85}
        except asyncio.TimeoutError:
            logger.warning(f"⚡ Gemini timeout for {user_data['name']}")
            return None
        except Exception as e:
            logger.warning(f"⚠️ Gemini error: {e}")
            return None

    openai_task  = asyncio.ensure_future(run_openai())
    gemini_task  = asyncio.ensure_future(run_gemini())
    pending      = {openai_task, gemini_task}
    winner       = None

    RACE_TIMEOUT = 25.0 if image_b64 else 15.0
    loop         = asyncio.get_event_loop()
    deadline     = loop.time() + RACE_TIMEOUT

    while pending:
        remaining = deadline - loop.time()
        if remaining <= 0:
            break
        try:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED, timeout=remaining)
        except Exception:
            break
        if not done:
            break
        for task in done:
            try:
                result = task.result()
            except Exception as exc:
                logger.warning(f"⚠️ Engine task threw: {exc}")
                continue
            if result and "answer" in result:
                winner = result
                director_task = asyncio.ensure_future(
                    validate_with_claude(persona, msg, winner["answer"], user_data["name"])
                )
                for p in pending:
                    p.cancel()
                pending = set()
                break

    for p in pending:
        p.cancel()

    if not winner:
        try:
            if openai_task.done() and not openai_task.cancelled():
                fallback = openai_task.result()
                if fallback and isinstance(fallback, dict) and "answer" in fallback:
                    winner = fallback
                    logger.info(f"✅ OpenAI rescue for {user_data['name']}")
                    director_task = asyncio.ensure_future(
                        validate_with_claude(persona, msg, winner["answer"], user_data["name"])
                    )
        except Exception:
            pass

    if not winner:
        logger.warning(f"⚡ Race timeout ({RACE_TIMEOUT}s) for {user_data['name']}")
        busy_msg = f"{user_data['name']}, system is under load. Give it 10 seconds and resend."
        async def _busy():
            yield f"data: {json.dumps({'type':'text','content':busy_msg})}\n\n"
            yield f"data: {json.dumps({'type':'meta','confidence_score':0,'scam_detected':False,'threat_level':'low','action_trigger':None,'audio_b64':'','full_answer':busy_msg})}\n\n"
        return StreamingResponse(_busy(), media_type="text/event-stream")

    winner_answer = winner["answer"]

    if "director_task" not in dir():
        director_task = asyncio.ensure_future(
            validate_with_claude(persona, msg, winner_answer, user_data["name"])
        )

    # ── Veracore — fires for doctor/lawyer/wealth/guardian on HIGH-risk ──
    # Runs in parallel with Director. Zero cost for low-risk queries.
    _veracore_should_run, _veracore_risk_tier = should_use_veracore(persona, msg)
    _veracore_task = None

    if _veracore_should_run:
        _veracore_task = asyncio.ensure_future(
            run_veracore_verification(
                question  = msg,
                persona   = persona,
                user_name = user_data["name"],
                timeout   = 30.0,
            )
        )
        logger.info(f"🔬 Veracore™ task fired for [{persona}] Tier {_veracore_risk_tier}")

    tier_limit = limit

    async def stream_response():
        try:
            USAGE_TRACKER[user_id]  += 1
            current_count            = USAGE_TRACKER[user_id]
            action_trigger           = winner.get("action_trigger", None)

            # ── Await Director ────────────────────────────────────────────────
            try:
                validated = await asyncio.wait_for(asyncio.shield(director_task), timeout=15.0)
                answer    = validated.get("answer", winner_answer)
            except (asyncio.TimeoutError, Exception):
                logger.warning(f"⚡ Director timeout in stream — using winner directly")
                validated = {}
                answer    = winner_answer

            # ── Veracore™ verification loading signal ─────────────────────────
            if _veracore_task is not None:
                _verify_msg = "Veracore™ este verificando esta respuesta..." if lang == "es" else "Veracore™ is verifying this response..."
                yield f"data: {json.dumps({'type':'text','content':' ','veracore_verifying':True,'veracore_msg':_verify_msg})}\n\n"

            # ── Await Veracore and merge ──────────────────────────────────────
            _veracore_result = None
            _veracore_used   = False
            _veracore_badge  = ""

            if _veracore_task is not None:
                try:
                    _veracore_result = await asyncio.wait_for(asyncio.shield(_veracore_task), timeout=35.0)
                except (asyncio.TimeoutError, Exception) as _hk_err:
                    logger.warning(f"⚡ Veracore™ await error: {_hk_err} — using Director answer")
                    _veracore_result = None

                if _veracore_result:
                    _merged, _veracore_used = merge_veracore_with_winner(winner, _veracore_result, _veracore_risk_tier)
                    if _veracore_used:
                        answer = _veracore_result["answer"]
                        logger.info(f"✅ Veracore™ answer used [{persona}] — {_veracore_result['confidence_color']} {_veracore_result['confidence_score']}%")
                    else:
                        logger.info(f"⚡ Race winner kept — HK metadata merged [{persona}]")
                    _veracore_badge = get_veracore_badge(_veracore_result, _veracore_used)

            # ── Empty-answer safety net ───────────────────────────────────────
            if not answer or not answer.strip():
                _persona_display_en = {
                    "guardian":  "The Guardian",  "doctor":    "The Doctor",
                    "lawyer":    "The Lawyer",     "wealth":    "The Wealth Architect",
                    "therapist": "The Therapist",  "mechanic":  "The Tech Specialist",
                    "career":    "The Career Strategist", "vitality": "The Vitality Coach",
                    "tutor":     "The Tutor",      "pastor":    "The Pastor",
                    "hype":      "The Hype Strategist", "bestie": "The Bestie",
                }
                _persona_display_es = {
                    "guardian":  "El Guardian",   "doctor":    "El Doctor",
                    "lawyer":    "El Abogado",     "wealth":    "El Arquitecto Financiero",
                    "therapist": "El Terapeuta",   "mechanic":  "El Especialista Técnico",
                    "career":    "El Estratega de Carrera", "vitality": "El Coach de Bienestar",
                    "tutor":     "El Tutor",       "pastor":    "El Pastor",
                    "hype":      "El Estratega de Contenido", "bestie": "La Bestie",
                }
                if lang == "es":
                    _name = _persona_display_es.get(persona, persona.capitalize())
                    answer = (
                        f"Soy {_name}. Esa pregunta está fuera de mi dominio — "
                        f"cambia al especialista correcto y te ayudarán."
                    )
                else:
                    _name = _persona_display_en.get(persona, persona.capitalize())
                    answer = (
                        f"I'm {_name}. That question falls outside my domain — "
                        f"switch to the right specialist and they'll have you covered."
                    )
                logger.warning(f"⚠️ Empty answer from [{persona}] for '{msg[:60]}' — using fallback handoff")

            sentences = _split_sentences_safe(answer) if _is_voice_mode else split_into_sentences(answer)

            # Voice mode: warm prompt guidance only — no hard cap

            async def _nli_trust_score(sentence: str, claim_type: str) -> dict:
                _client = claude_client or anthropic_client
                if not _client:
                    return {"tier": "probable", "confidence": 75, "correction": None,
                            "source": "training", "audit": None}

                has_tavily = bool(tavily_context and "VERIFIED ANSWER" in tavily_context)
                ctx_snippet = tavily_context[:600] if has_tavily else "No real-time data available."

                prompt = f"""You are a fact-checking engine for an AI assistant used by elderly and vulnerable people.
SENTENCE: "{sentence}"
CLAIM TYPE: {claim_type}
REAL-TIME DATA: {ctx_snippet}

Respond ONLY with valid JSON:
{{"tier":"verified"|"probable"|"uncertain","confidence":<0-100>,"issue":<null or one sentence>,"correction":<null or corrected sentence>,"source":"tavily"|"training"|"unknown"}}

RULES:
- verified: Real-time data directly supports this. confidence 90-100.
- probable: Consistent with knowledge, no contradiction. confidence 60-89.
- uncertain: Contradicts data, unverifiable specific claim, or dangerous absolute statement. confidence 0-59.
- correction: Only if uncertain AND you have a more accurate version. Otherwise null.
- Conservative: when unsure use probable not verified.
- Never flag general conversational sentences as uncertain."""

                try:
                    resp = await asyncio.wait_for(
                        _client.messages.create(
                            model    = "claude-haiku-4-5-20251001",
                            max_tokens = 180,
                            messages = [{"role": "user", "content": prompt}],
                        ),
                        timeout=3.0
                    )
                    raw    = resp.content[0].text.strip().replace("```json","").replace("```","").strip()
                    result = json.loads(raw)
                    tier       = result.get("tier", "probable")
                    confidence = int(result.get("confidence", 75))
                    correction = result.get("correction")
                    source     = result.get("source", "training")
                    issue      = result.get("issue")
                    audit = None
                    if tier == "uncertain" and (issue or correction):
                        audit = {
                            "original":   sentence,
                            "issue":      issue or "Could not verify this claim.",
                            "correction": correction,
                            "source_label": "Tavily real-time search" if source == "tavily" else "Internal consistency check",
                            "timestamp":  datetime.now().isoformat(),
                        }
                    return {"tier": tier, "confidence": confidence, "correction": correction,
                            "source": source, "audit": audit}
                except (asyncio.TimeoutError, Exception) as _e:
                    logger.warning(f"NLI scorer: {_e}")
                    return {"tier": "probable", "confidence": 70, "correction": None,
                            "source": "training", "audit": None}

            for sentence in sentences:
                sentence = _strip_leakage(sentence)  # strip prompt leakage before display/TTS
                if not sentence.strip():
                    continue
                is_risky, claim_type = _is_high_stakes(sentence)

                if is_risky:
                    checking_note = (
                        f"...déjame verificar eso por ti..." if lang == "es"
                        else f"...let me make sure that's right for you..."
                    )
                    yield f"data: {json.dumps({'type':'trust_checking','content': checking_note, 'original': sentence})}\n\n"

                    trust_result, sentence_audio = await asyncio.gather(
                        _nli_trust_score(sentence, claim_type),
                        generate_audio_inline(sentence, voice, vocal_energy=vocal_energy, is_voice_mode=_is_voice_mode),
                    )

                    tier       = trust_result["tier"]
                    confidence = trust_result["confidence"]
                    correction = trust_result.get("correction")
                    audit      = trust_result.get("audit")
                    source     = trust_result.get("source", "training")

                    display_sentence = sentence
                    if tier == "uncertain" and correction:
                        display_sentence = correction
                        correction_audio = await generate_audio_inline(correction, voice)
                        sentence_audio   = correction_audio

                    _next_s2 = sentences[sentences.index(sentence) + 1] if sentence in sentences and sentences.index(sentence) + 1 < len(sentences) else ""
                    _pause2  = get_pause_metadata(sentence, _next_s2)
                    chunk = {
                        "type":           "text",
                        "content":        display_sentence,
                        "audio_b64":      sentence_audio,
                        "trust_tier":     tier,
                        "confidence":     confidence,
                        "source_type":    source,
                        "original":       sentence if (tier == "uncertain" and correction) else None,
                        "audit":          audit,
                        "claim_type":     claim_type,
                        "pause_before_ms": _pause2["pause_before_ms"],
                        "pause_after_ms":  _pause2["pause_after_ms"],
                    }

                else:
                    _next_s = sentences[sentences.index(sentence) + 1] if sentence in sentences and sentences.index(sentence) + 1 < len(sentences) else ""
                    _pause  = get_pause_metadata(sentence, _next_s)
                    sentence_audio = await generate_audio_inline(
                        sentence, voice,
                        vocal_energy=vocal_energy,
                        is_voice_mode=_is_voice_mode,
                    )
                    chunk = {
                        "type":           "text",
                        "content":        sentence,
                        "audio_b64":      sentence_audio,
                        "trust_tier":     "probable",
                        "confidence":     85,
                        "source_type":    "training",
                        "original":       None,
                        "audit":          None,
                        "claim_type":     None,
                        "pause_before_ms": _pause["pause_before_ms"],
                        "pause_after_ms":  _pause["pause_after_ms"],
                    }

                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0.008)

            async def _post_storage():
                asyncio.create_task(store_intelligence_sync(user_id, msg,    "user", persona))
                asyncio.create_task(store_intelligence_sync(user_id, answer, "bot",  persona))
                if MED_VAULT_ENABLED and persona in {"doctor","therapist","vitality","lawyer","mechanic","wealth"}:
                    _save_q_triggers = [
                        "save this question", "remember to ask", "save that", "note that",
                        "write that down", "don't forget to ask", "add that to my questions",
                        "save this for my doctor", "put that in my vault",
                        "guardar esta pregunta", "recordar preguntar", "guardar eso",
                    ]
                    _msg_lower = msg.lower()
                    if any(t in _msg_lower for t in _save_q_triggers):
                        try:
                            _vault_q = await get_or_create_vault(user_id, email_lower)
                            _clean_q = msg
                            for t in _save_q_triggers:
                                _clean_q = _clean_q.lower().replace(t, "").strip()
                            _clean_q = _clean_q.strip(".,!? ").capitalize() or msg[:150]
                            _q_entry = new_doctor_question(_clean_q, f"Saved from {persona} conversation")
                            _vault_q["questions"].append(_q_entry)
                            _vault_q["questions"] = _vault_q["questions"][-30:]
                            await save_vault(user_id, email_lower, _vault_q)
                            logger.info(f"❓ Question auto-saved for {user_id[:8]}: {_clean_q[:60]}")
                        except Exception as _eq:
                            logger.warning(f"Question save error: {_eq}")

                if MED_VAULT_ENABLED and persona_can_write("doctor", "medical"):
                    _symptoms = detect_symptoms_in_message(msg)
                    if _symptoms and persona in {"doctor","therapist","vitality","pastor"}:
                        try:
                            _vault = await get_or_create_vault(user_id, email_lower)
                            for _sym in _symptoms:
                                _entry = new_symptom(
                                    description = msg[:200],
                                    severity    = "mild",
                                    persona_context = persona,
                                )
                                _vault["symptoms"].append(_entry)
                            _vault["symptoms"] = _vault["symptoms"][-60:]
                            await save_vault(user_id, email_lower, _vault)
                            logger.info(f"📋 Ambient diary: logged {_symptoms} for {user_id[:8]}")
                        except Exception as _e:
                            logger.warning(f"Ambient diary error: {_e}")

                if MED_VAULT_ENABLED and persona in {"doctor","therapist","vitality"}:
                    try:
                        _vault_check = await load_vault(user_id, email_lower)
                        if _vault_check:
                            _reaction = detect_reaction_mention(msg, _vault_check.get("medications",[]))
                            if _reaction:
                                _vault_check["reactions"].append(new_reaction(
                                    medication_id   = _reaction["medication_id"],
                                    medication_name = _reaction["medication_name"],
                                    description     = msg[:200],
                                    severity        = "mild",
                                ))
                                await save_vault(user_id, email_lower, _vault_check)
                                logger.info(f"⚠️ Reaction logged: {_reaction['medication_name']}")
                    except Exception as _e:
                        logger.warning(f"Reaction detect error: {_e}")

                CONVO_CONTEXT[email_lower].append({"persona": persona, "msg": msg[:120]})
                if len(CONVO_CONTEXT[email_lower]) > MAX_CONVO_CONTEXT:
                    CONVO_CONTEXT[email_lower] = CONVO_CONTEXT[email_lower][-MAX_CONVO_CONTEXT:]
                if action_trigger == "email_dispatch":
                    await send_mission_report_email(user_email, answer, persona, user_name=user_data["name"])
                pin_result = auto_detect_pin_category(msg)
                if pin_result and memory_index:
                    pin_text, pin_category = pin_result
                    upsert_memory_pin(
                        index    = memory_index,
                        user_id  = user_id,
                        pin_text = pin_text,
                        category = pin_category,
                    )
            asyncio.create_task(_post_storage())

            scam_detected  = len(indicators) > 0
            confidence     = winner.get("confidence_score", 85)
            model_used     = winner.get("model", openai_engine)
            if model_used and "claude" in model_used.lower():
                confidence = max(confidence, 88)
            elif model_used and "gemini" in model_used.lower():
                confidence = max(confidence, 82)
            threat_level   = "high" if scam_detected else "low"

            meta = {
                "type":             "meta",
                "confidence_score": _veracore_result["confidence_score"] if _veracore_used and _veracore_result else confidence,
                "scam_detected":    scam_detected,
                "threat_level":     threat_level,
                "action_trigger":   action_trigger,
                "audio_b64":        "",
                "full_answer":      answer,
                "model":            _veracore_result.get("model") if _veracore_used and _veracore_result else model_used,
                "scam_indicators":  indicators,
                "claude_validated": validated.get("claude_validated", False),
                "usage_count":      current_count,
                "limit":            tier_limit,
                # ── HK fields ─────────────────────────────────────────────────
                "veracore_validated":     _veracore_used,
                "veracore_confidence":    _veracore_result.get("confidence_score") if _veracore_result else None,
                "veracore_color":         _veracore_result.get("confidence_color") if _veracore_result else None,
                "veracore_badge":         _veracore_badge,
                "veracore_sources":       _veracore_result.get("sources", []) if _veracore_result else [],
                "veracore_concerns":      _veracore_result.get("concerns", []) if _veracore_result else [],
                # ── #7 Confidence tier label ──────────────────────────────────
                "input_mode":        input_mode,
                "vocal_energy":      vocal_energy,
                "speech_rate":       speech_rate,
                "confidence_tier":   (
                    "high"     if (_veracore_result["confidence_score"] if _veracore_used and _veracore_result else confidence) >= 80
                    else "moderate" if (_veracore_result["confidence_score"] if _veracore_used and _veracore_result else confidence) >= 60
                    else "low"
                ),
            }
            yield f"data: {json.dumps(meta)}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            err_chunk = {"type": "text", "content": "Something went wrong. Please try again."}
            yield f"data: {json.dumps(err_chunk)}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# =============================================================================
# INTAKE PROFILE — DETERMINISTIC PINECONE STORE/RETRIEVE
# =============================================================================
INTAKE_VECTOR_ID_SUFFIX = "_intake"
