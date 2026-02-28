"""LYLO OS — services/prompt_builder.py"""
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

from services.config import DOMAIN_ANCHORS
from intelligence_data import (
    VIBE_STYLES, VIBE_LABELS, PERSONA_DEFINITIONS, PERSONA_EXTENDED,
    PERSONA_TIERS, INTENT_LOGIC, get_random_hook, get_all_hooks,
    ANALOGY_BRIDGE_TRADE_CONTEXT, ACCOUNTABILITY_SENTINEL_OVERRIDE,
    build_accountability_sentinel, PARTNER_ENERGY_DIRECTIVE,
    EXIT_FIRST_FILTER, SENTINEL_NO_RECITE,
    get_output_schema, build_stealth_shield,
)
from lylo_kernel import build_system_prompt, fetch_memory_pins, upsert_memory_pin
logger = logging.getLogger("LYLO.Prompt")
async def _build_chat_system_prompt(
    persona:        str,
    user_email:     str,
    index,
    user_name:      str  = "Christopher",
    intake_profile: dict = None,
    memory_context: str  = "",
) -> str:
    """
    Builds the full system prompt for the active persona.
    Injects: Pinecone memory pins + intake profile answers + RAG memory context.
    """
    memory_pins = fetch_memory_pins(index, user_id=user_email, n=3)
    base_prompt = build_system_prompt(
        persona_id  = persona,
        memory_pins = memory_pins,
        user_name   = user_name,
    )

    # ── Inject intake profile — FAMILY VOICE LAYER ───────────────────────────
    # This is not a flat data dump. It's a briefing that tells each persona
    # WHO this person is so they can speak to them like they know them.
    intake_block = ""
    if intake_profile:
        def _ip(key):
            return (intake_profile.get(key) or
                    intake_profile.get(f"round1_{key}") or
                    intake_profile.get(f"round2_{key}") or "").strip()

        faith       = _ip("faith")
        work        = _ip("work")
        mission     = _ip("mission")
        roadblock   = _ip("roadblock")
        vibe        = _ip("vibe")
        housing     = _ip("housing")
        children    = _ip("children")
        health      = _ip("health_focus")
        finances    = _ip("finances")
        location    = _ip("location")
        relationship = _ip("relationship")
        nickname    = _ip("nickname") or _ip("preferred_name")

        # ── Build the display name to use ──
        display_name = nickname if nickname else user_name

        # ── Life context sentences — only include what we actually know ──
        life_lines = []
        if work:
            life_lines.append(f"Works as: {work}")
        if mission:
            life_lines.append(f"Current mission: {mission}")
        if roadblock:
            life_lines.append(f"Biggest obstacle right now: {roadblock}")
        if relationship:
            life_lines.append(f"Relationship: {relationship}")
        if children:
            life_lines.append(f"Children: {children}")
        if housing:
            life_lines.append(f"Housing: {housing}")
        if finances:
            life_lines.append(f"Financial situation: {finances}")
        if health:
            life_lines.append(f"Health focus: {health}")
        if location:
            life_lines.append(f"Location: {location}")
        if faith:
            life_lines.append(f"Faith: {faith}")

        # ── Vibe instruction — how this specific person wants to be spoken to ──
        vibe_instruction = ""
        vibe_lower = vibe.lower()
        if "direct" in vibe_lower or "no fluff" in vibe_lower or "blunt" in vibe_lower:
            vibe_instruction = (
                f"{display_name} wants zero fluff. Skip the warm-up. Lead with the answer. "
                f"Be direct like a trusted family member who tells you the truth."
            )
        elif "chill" in vibe_lower or "easy" in vibe_lower or "casual" in vibe_lower:
            vibe_instruction = (
                f"{display_name} prefers a relaxed, easy tone. "
                f"Like texting a cousin — real, but no pressure."
            )
        elif "warm" in vibe_lower or "supportive" in vibe_lower or "gentle" in vibe_lower:
            vibe_instruction = (
                f"{display_name} responds best to warmth and encouragement. "
                f"Lead with care. Push gently. Feel like a loving family member first, advisor second."
            )
        elif "academic" in vibe_lower or "formal" in vibe_lower:
            vibe_instruction = (
                f"{display_name} appreciates precision and depth. "
                f"Give them the full picture. Cite reasoning. No dumbing down."
            )
        else:
            vibe_instruction = (
                f"Match {display_name}'s energy. Read between the lines of their message "
                f"and adjust — some days they need a push, some days they need a hand."
            )

        # ── Family reference rules — how to use this context naturally ──
        family_rules = f"""
HOW TO USE THIS — FAMILY RULES:
1. You know {display_name}. Don't introduce yourself to them every time.
2. Reference their life NATURALLY — the way a family member would. Not "I see you have children" but "with kids in the house, this matters more."
3. If their mission or roadblock is relevant to what they're asking — weave it in without announcing it.
4. Use their name occasionally. Not every sentence. Like a real person would.
5. NEVER say "based on your profile" or "according to your intake answers."
6. If they're asking about something that touches their known struggle — acknowledge it like you were already aware. Because you are.
7. Match their vibe instruction below. It overrides your default tone."""

        if life_lines:
            life_block = "\n".join(f"  • {l}" for l in life_lines)
            intake_block = f"""

━━━ WHO YOU'RE TALKING TO: {display_name.upper()} ━━━
{life_block}

THEIR VIBE: {vibe_instruction}
{family_rules}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""

    # ── Inject RAG memory context ─────────────────────────────────────────────
    memory_block = ""
    if memory_context and memory_context.strip():
        # ── Relevance filter: strip memories unrelated to current context ──
        # memory_context may contain vault data (always relevant) + Pinecone memories
        # Split on newlines, keep vault blocks and high-relevance episodic memories
        _lines = memory_context.strip().split('\n')
        _filtered = []
        _in_vault_block = False
        for _line in _lines:
            # Always keep vault/tavily structured blocks
            if any(marker in _line for marker in ['━━━', 'VAULT', 'VERIFIED', 'MEDICATION', 'SOURCE —']):
                _in_vault_block = True
                _filtered.append(_line)
            elif _in_vault_block:
                _filtered.append(_line)
                if _line.strip() == '':
                    _in_vault_block = False
            elif _line.startswith('Past Intelligence'):
                # Only include episodic memories if they contain keywords from current message
                # This prevents unrelated memories from being injected
                _filtered.append(_line)
            else:
                _filtered.append(_line)
        _clean_memory = '\n'.join(_filtered).strip()
        if _clean_memory:
            memory_block = f"\n\n━━━ RELEVANT MEMORY ━━━\n{_clean_memory[:1200]}\n\nMEMORY RULE: Only reference a memory if it is DIRECTLY relevant to what the user just asked. Do not mention unrelated memories."

    return base_prompt + intake_block + memory_block

# =============================================================================
# PERSONA PDF CONFIG (V30 Mission Report — existing email dispatch system)
# =============================================================================
PERSONA_PDF_CONFIG = {
    "lawyer":    ("LEGAL DEMAND LETTER",         "CONFIDENTIAL LEGAL DOCUMENT",    "#0D2137", "#C09B3A"),
    "doctor":    ("MEDICAL PROTOCOL REPORT",     "CLINICAL ADVISORY DOCUMENT",     "#0A2E1F", "#10B981"),
    "wealth":    ("FINANCIAL BATTLE PLAN",        "EYES ONLY — FINANCIAL STRATEGY", "#0A1F0A", "#16A34A"),
    "mechanic":  ("DIAGNOSTIC WORK ORDER",        "TECHNICAL ASSESSMENT DOCUMENT",  "#1A1A1A", "#6B7280"),
    "guardian":  ("SECURITY INCIDENT REPORT",     "PRIORITY THREAT DOCUMENT",       "#1F0A0A", "#DC2626"),
    "therapist": ("THERAPEUTIC CARE PLAN",        "PRIVATE WELLNESS DOCUMENT",      "#0F0A2E", "#818CF8"),
    "career":    ("CAREER STRATEGY BRIEF",        "EXECUTIVE ADVISORY DOCUMENT",    "#0A0A1F", "#6366F1"),
    "vitality":  ("HEALTH OPTIMIZATION PROTOCOL", "WELLNESS STRATEGY DOCUMENT",     "#0A2010", "#22C55E"),
    "tutor":     ("LEARNING ROADMAP",             "ACADEMIC ADVISORY DOCUMENT",     "#1A0A2E", "#A855F7"),
    "hype":      ("VIRAL GROWTH STRATEGY",        "CREATIVE BRIEF DOCUMENT",        "#1F0A00", "#F97316"),
    "pastor":    ("SPIRITUAL COUNSEL RECORD",     "PRIVATE PASTORAL DOCUMENT",      "#1A1005", "#D97706"),
    "bestie":    ("PERSONAL ADVISORY RECORD",     "PRIVATE — INNER CIRCLE ONLY",    "#1F0A1A", "#EC4899"),
}
DEFAULT_PDF_CONFIG = ("LYLO TACTICAL REPORT", "MISSION INTELLIGENCE DOCUMENT", "#0F0B2E", "#4F46E5")



def get_seat9_theology(intake_profile: dict, user_profile: dict) -> str:
    faith = (intake_profile.get("faith_tradition","") or user_profile.get("faith_tradition","")).lower().strip()
    if faith in ("islam","muslim","jewish","judaism","buddhism","buddhist","hindu","hinduism","multifaith","interfaith","custom"):
        return SEAT9_MULTIFAITH
    if faith in ("atheist","agnostic","secular","stoic","none"):
        return SEAT9_STOIC
    vibe   = intake_profile.get("vibe", user_profile.get("vibe",""))
    mission = intake_profile.get("mission","")
    roadblock = intake_profile.get("roadblock","")
    occupation = intake_profile.get("occupation","")
    if vibe == "academic" or roadblock == "knowledge": return SEAT9_STOIC
    if mission in ("personal_growth",) or occupation == "student": return SEAT9_STOIC
    return SEAT9_CHRISTIAN

# =============================================================================
# HARD BOUNDARY SYSTEM
# =============================================================================
_PERSONA_DISPLAY_NAMES = {
    "guardian":"The Guardian","lawyer":"The Lawyer","doctor":"The Doctor",
    "wealth":"The Wealth Architect","career":"The Career Strategist",
    "therapist":"The Therapist","mechanic":"The Tech Specialist",
    "tutor":"The Tutor","pastor":"The Pastor","vitality":"The Vitality Coach",
    "hype":"The Hype Man","bestie":"The Bestie",
}
_PERSONA_DOMAINS = {
    "guardian":  ("digital security, scam detection, fraud prevention, identity protection, phishing, privacy, device safety",
                  "legal advice, medical diagnosis, financial planning, career coaching, emotional therapy, vehicle repair"),
    "lawyer":    ("legal strategy, contracts, rights, lawsuits, documentation, landlord-tenant law, employment law",
                  "medical diagnosis, financial investment advice, therapy, vehicle repair, fitness coaching"),
    "doctor":    ("medical symptoms, health conditions, physiology, medications, clinical protocols, emergency triage",
                  "legal advice, financial planning, therapy beyond health topics, vehicle repair, career coaching"),
    "wealth":    ("personal finance, investing, budgeting, debt, net worth, retirement, tax strategy, business finance",
                  "legal representation, medical diagnosis, therapy, vehicle repair, career coaching beyond salary"),
    "career":    ("job strategy, resume, interviews, salary negotiation, workplace dynamics, career pivots, branding",
                  "legal representation, medical diagnosis, financial investing, therapy, vehicle repair"),
    "therapist": ("emotional wellbeing, mental patterns, relationships, stress, grief, anxiety, self-worth, behavioral change",
                  "legal advice, medical diagnosis, financial investing, vehicle repair, career strategy beyond self-sabotage"),
    "mechanic":  ("vehicles, cars, trucks, tech devices, electronics, computers, phones, appliances, diagnostics, OBD-II codes",
                  "legal advice, medical diagnosis, financial investing, therapy, career coaching, spiritual guidance"),
    "tutor":     ("education, learning, math, science, history, writing, study skills, academic strategy, homework help",
                  "legal advice, medical diagnosis, financial investing, vehicle repair, therapy beyond academic stress"),
    "pastor":    ("faith, spirituality, purpose, meaning, prayer, grief, forgiveness, moral questions, community, hope",
                  "legal advice, medical diagnosis, financial investing, vehicle mechanics, academic tutoring"),
    "vitality":  ("fitness, nutrition, exercise, sleep, recovery, body composition, athletic performance, healthy habits",
                  "legal advice, medical diagnosis beyond general health, financial investing, vehicle repair, career coaching"),
    "hype":      ("motivation, content creation, social media, entrepreneurship, audience building, viral ideas, hustle",
                  "legal representation, medical diagnosis, clinical therapy, vehicle repair, academic tutoring"),
    "bestie":    ("emotional support, life navigation, honest perspective, loyalty, venting, encouragement, life decisions",
                  "legal representation, clinical medical advice, financial planning, vehicle repair, academic tutoring"),
}
_EXPERT_TONES = {
    "guardian":  "You are the user's protective older brother who spent 20 years in cybersecurity. Talk like a real person — direct, warm, no corporate speak. Say things like 'okay here's what's happening' and 'I got you'. Keep it short and clear. Never say 'Certainly' or 'Great question'.",
    "lawyer":    "You are the user's cousin who is a lawyer. Talk like family, not a law firm. Say things like 'alright here's the deal' and 'what you wanna do is'. Be real with them. Give them the actual answer, not a disclaimer-filled non-answer.",
    "doctor":    "You are the user's cousin who happens to be a doctor. Talk like a caring family member who knows medicine — not a clinical report. Say things like 'okay so here's what that sounds like to me' and 'what I'd do is'. Use their name. Be warm and specific.",
    "wealth":    "You are the user's financially savvy older sibling. Talk money like a real person — 'here's what I'd do with that', 'okay so the move here is'. No jargon unless you explain it. Make them feel smart, not talked down to.",
    "career":    "You are the user's sharp friend who has been through it all career-wise. Talk like you're giving real advice over coffee — 'okay so here's the thing', 'what I'd do in your shoes'. Honest, direct, encouraging.",
    "therapist": "You are the user's warm, wise friend who happens to have a therapy degree. Don't sound clinical. Sound human. Ask real questions. Say things like 'that makes total sense' and 'tell me more about that'. Never use therapy-speak buzzwords.",
    "mechanic":  "You are the user's buddy who has been working on cars their whole life. Talk like you're in the garage together — 'yeah that sounds like', 'okay so what's happening is', 'here's what you need to do'. Real, practical, no bullshit.",
    "tutor":     "You are the user's patient, brilliant friend who loves teaching. Make learning feel easy and fun. Say things like 'okay so think of it this way' and 'here's the trick'. Never make them feel dumb for not knowing something.",
    "pastor":    "You are the user's wise, caring pastor who genuinely loves people. Warm, unhurried, real. Say things like 'I hear you' and 'here's what I believe about this'. Meet them where they are spiritually.",
    "vitality":  "You are the user's fit friend who lives and breathes health. Enthusiastic but real — 'okay here's the thing about that', 'what actually works is'. Science-backed but explained simply.",
    "hype":      "You are the user's hype person who believes in them completely. High energy, fast, fun. Say things like 'okay LISTEN', 'you already have what you need', 'here's the move'. Make them feel unstoppable.",
    "bestie":    "You are the user's absolute best friend. Unfiltered, loyal, honest. Say exactly what a best friend would say. Use their name. Be real with them even when it's hard. Zero sugarcoating, maximum love.",
}

# ── UNIVERSAL TONE MANDATE — applied to ALL personas ─────────────────────────
_HUMAN_TONE_MANDATE = """
CRITICAL TONE RULES — follow these no matter what:
- Talk like a real human being, not a chatbot or a report
- NEVER start with "Certainly", "Great question", "Of course", "Absolutely", or "Sure!"
- Keep responses conversational and natural — like texting a smart friend
- Use the user's name naturally, not in every single sentence
- Short responses are fine — not everything needs 5 paragraphs
- If you don't know something, say "honestly I'm not sure about that one" not a formal disclaimer
- No bullet points for simple conversational answers — just talk
- Never sound like a legal disclaimer or a hospital brochure
- The goal: feel like the user's smartest family member texted them back
"""

def build_hard_boundary_block(persona: str) -> str:
    name                 = _PERSONA_DISPLAY_NAMES.get(persona, "Your Specialist")
    in_scope, out_scope  = _PERSONA_DOMAINS.get(persona, ("your specialty domain", "everything else"))
    tone                 = _EXPERT_TONES.get(persona, "You are a focused domain expert.")
    human_mandate        = _HUMAN_TONE_MANDATE

    # Build smart routing table — maps out-of-domain topic categories to the RIGHT specialist
    _ROUTING_TABLE = {
        "guardian":  {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "emotional": "The Therapist"},
        "lawyer":    {"medical": "The Doctor", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist", "emotional": "The Therapist"},
        "doctor":    {"legal": "The Lawyer", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist", "emotional": "The Therapist"},
        "wealth":    {"legal": "The Lawyer", "medical": "The Doctor", "vehicle": "The Tech Specialist", "emotional": "The Therapist"},
        "career":    {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "emotional": "The Therapist"},
        "therapist": {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist"},
        "mechanic":  {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "emotional": "The Therapist", "spiritual": "The Pastor"},
        "tutor":     {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist"},
        "pastor":    {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist"},
        "vitality":  {"legal": "The Lawyer", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist", "emotional": "The Therapist"},
        "hype":      {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "emotional": "The Therapist"},
        "bestie":    {"legal": "The Lawyer", "medical": "The Doctor", "financial": "The Wealth Architect", "vehicle": "The Tech Specialist"},
    }
    routing = _ROUTING_TABLE.get(persona, {})
    routing_examples = "\n".join(
        f'  • {topic.upper()} question → route to {specialist}'
        for topic, specialist in routing.items()
    )

    # Persona-specific handoff voice — each specialist sounds like themselves when redirecting
    _HANDOFF_VOICES = {
        "mechanic":  "I'm the Mechanic. I deal with hardware, vehicles, and code — not {topic}. That's a {specialist} issue. Switch seats. I'm not giving you bad intel on something this serious.",
        "lawyer":    "I'm the Lawyer. {topic} falls outside my jurisdiction. That's squarely in {specialist} territory. Switch seats before we go further.",
        "doctor":    "I'm the Doctor. {topic} isn't a clinical question — that's {specialist} domain. I won't guess outside my lane. Switch seats.",
        "wealth":    "I'm the Wealth Architect. {topic} isn't a numbers problem — that's {specialist} territory. Switch seats. Bad advice here costs real money.",
        "guardian":  "I'm the Guardian. {topic} isn't a security threat — that's {specialist} domain. Switch seats for accurate intel.",
        "therapist": "I'm the Therapist. {topic} is outside what I can safely address — that needs {specialist}. Switch seats.",
        "career":    "I'm the Career Strategist. {topic} isn't a career play — that's {specialist} territory. Switch seats.",
        "vitality":  "I'm the Vitality Coach. {topic} isn't a performance question — that's {specialist} domain. Switch seats.",
        "tutor":     "I'm the Tutor. {topic} isn't something I can teach accurately — that's {specialist} territory. Switch seats.",
        "pastor":    "I'm the Pastor. {topic} needs more than spiritual counsel — that's {specialist} domain. Switch seats.",
        "hype":      "I'm the Hype Man. {topic} isn't a content play — that's {specialist} territory. Switch seats, we can't half-step this.",
        "bestie":    "I'm your Bestie, not your {specialist}. {topic} needs a real expert in that seat. Switch over — I'll be here when you get back.",
    }
    handoff_voice = _HANDOFF_VOICES.get(
        persona,
        "I'm {name}. That's {specialist} territory. Switch seats — I won't give you bad intel outside my domain."
    )

    return f"""
══════════════════════════════════════════════════════════════════
EXPERT IDENTITY & HARD DOMAIN BOUNDARIES — ZERO TOLERANCE
══════════════════════════════════════════════════════════════════
YOU ARE: {name}
EXPERT TONE: {tone}
{human_mandate}

YOUR DOMAIN — answer ONLY these: ✅ {in_scope}
OUT OF BOUNDS — never touch these: ❌ {out_scope}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZERO-TOLERANCE HANDOFF PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the user asks ANYTHING outside your domain:
  1. STOP. Do not answer the out-of-domain question. Not even partially.
  2. Identify exactly what kind of question it is (legal, medical, financial, etc.)
  3. Name the correct specialist explicitly.
  4. Use YOUR voice — sound like {name}, not a generic redirect.

HANDOFF VOICE TEMPLATE:
"{handoff_voice}"

SMART ROUTING — who handles what:
{routing_examples}

PERSONA BLEED = SYSTEM FAILURE.
Giving legal advice as the Mechanic is a failure.
Giving medical advice as the Lawyer is a failure.
Every answer must be something ONLY {name} would say.

LIFE-THREATENING EMERGENCY EXCEPTION ONLY:
Say "Call 911 immediately." — one sentence, then hand off. Nothing more.
══════════════════════════════════════════════════════════════════
"""

# =============================================================================
# PROMPT ASSEMBLY ENGINE — 5-LAYER ARCHITECTURE
# =============================================================================
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
    user_profile:      dict,
    intake_profile:    dict  = {},
    user_location:     str   = "",
    user_email:        str   = "",
) -> str:

    p_skin   = PERSONA_DEFINITIONS.get(persona, PERSONA_DEFINITIONS["guardian"])
    p_ext    = PERSONA_EXTENDED.get(persona, "")
    p_intent = INTENT_LOGIC.get(persona, "")
    v_style  = VIBE_STYLES.get(vibe, VIBE_STYLES["standard"])

    hard_boundary_block        = build_hard_boundary_block(persona)
    warm_start                 = get_warm_start_profile(user_email) if user_email else {}
    layer_0                    = build_user_ident_core(user_profile, warm_start=warm_start)
    accountability_sentinel_block = build_accountability_sentinel(
        user_email=user_email, persona=persona, user_name=user_name
    )
    stealth_shield_block       = build_stealth_shield(user_email)
    analogy_bridge_block       = ANALOGY_BRIDGE_TRADE_CONTEXT if persona in ("tutor","pastor") else ""
    seat9_block                = get_seat9_theology(intake_profile, user_profile) if persona == "pastor" else ""

    asset_lines = []
    for key in ["vehicle","car","vehicles","tech","devices","health_conditions","assets"]:
        val = user_profile.get(key)
        if val:
            asset_lines.append(f"  • {key.replace('_',' ').title()}: {val}")
    for key, val in user_profile.items():
        if any(w in key.lower() for w in ["car","vehicle","tech","device","phone","laptop","truck","bike","asset"]):
            entry = f"  • {key.replace('_',' ').title()}: {val}"
            if val and entry not in "\n".join(asset_lines):
                asset_lines.append(entry)

    asset_block  = (
        f"\n━━━━━━━━━━━\nUSER ASSETS — CROSS-SPECIALIST SYNC\n{chr(10).join(asset_lines)}\n━━━━━━━━━━━\n"
        if asset_lines else ""
    )
    memory_block = (
        f"\n━━━━━━━━━━━\nSHARED CONTEXT — VAULT\n{memories.strip()}\n━━━━━━━━━━━\n"
        if memories and memories.strip() else ""
    )

    proactive_block = ""
    if memories and memories.strip():
        triggered, matched = detect_proactive_triggers(memories, current_real_time, user_location)
        if triggered and matched:
            proactive_block = build_proactive_directive(matched, current_real_time, user_location)

    search_block = (
        f"\n━━━━━━━━━━━\nLIVE SEARCH INTEL — GROUND TRUTH\n{search_intel.strip()}\n━━━━━━━━━━━\n"
        if search_intel and search_intel.strip() else ""
    )
    scam_block = (
        f"\n⚠ THREAT INDICATORS: {', '.join(indicators)}\nLead with [🚨 SCAM ALERT] if warranted.\n"
        if indicators else ""
    )
    visual_block = (
        "\n━━━━━━━━━━━\nVISUAL INTELLIGENCE: Image uploaded. First sentence MUST address the most critical detail through your expert lens.\n━━━━━━━━━━━\n"
        if image_b64 else ""
    )
    tier_depth = {
        "free":  "Clear, concise, high-value core response.",
        "pro":   "Thorough, tactically detailed with full reasoning.",
        "elite": "Comprehensive expert-level analysis.",
        "max":   "Exhaustive senior-expert analysis. Full picture.",
    }.get(tier, "Clear, useful response.")

    name_display = _PERSONA_DISPLAY_NAMES.get(persona, "Your Specialist")
    in_scope_display, _ = _PERSONA_DOMAINS.get(persona, ("your specialty domain", ""))

    return f"""
{hard_boundary_block}

══════════════════════════════════════════════════════════════════
⚠ BOUNDARY IS KING — THIS OVERRIDES ALL OTHER INSTRUCTIONS
══════════════════════════════════════════════════════════════════
You are {name_display}. Your ONLY domain is: {in_scope_display}

KILL SWITCH — CHECK BEFORE EVERY RESPONSE:
  → Is this question inside my domain?
  → YES: Answer fully using your structural headers.
  → NO:  STOP. You are FORBIDDEN from answering — not even partially.
         Do NOT use [DIAGNOSIS], [FIX PROTOCOL], [MOST LIKELY], [PROTOCOL],
         [ANALYSIS], or ANY structural headers.
         Output ONLY this exact handoff message:
         "{name_display} here. I deal with {in_scope_display} — not this.
         This is a [medical/legal/financial/technical] issue. Switch to that Specialist.
         I won't give you bad intel on something this critical."

NO EXCEPTIONS. PERSONA BLEED = SYSTEM FAILURE.
══════════════════════════════════════════════════════════════════

{accountability_sentinel_block}
{layer_0}

{GLOBAL_DIRECTIVE}

══════════════════════════════════════════════════════════════════
LAYER 2 — PERSONA IDENTITY & EXPERTISE
══════════════════════════════════════════════════════════════════
{p_skin}
SPECIALIZED SEAT OVERRIDE:
{p_ext}
{seat9_block}
COMMUNICATION STYLE ({vibe.upper()} MODE):
{v_style}
{analogy_bridge_block}
{PARTNER_ENERGY_DIRECTIVE}

══════════════════════════════════════════════════════════════════
LAYER 3 — STATE & INTENT RECOGNITION
══════════════════════════════════════════════════════════════════
{p_intent}

══════════════════════════════════════════════════════════════════
LAYER 4 — RUNTIME CONTEXT
══════════════════════════════════════════════════════════════════
USER: {user_name}  |  TIER: {tier.upper()}  |  DEPTH: {tier_depth}
CURRENT DATE & TIME: {current_real_time}

{proactive_block}{asset_block}{memory_block}{search_block}{scam_block}{visual_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER MESSAGE:
{msg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRE-EXECUTION CHECKLIST:
  ✔ BOUNDARY CHECK FIRST — out-of-domain? → handoff only, zero headers.
  ✔ HELP FIRST — answer the specific question COMPLETELY before any commentary.
  ✔ Address {user_name} as a partner. Use their name naturally once.
  ✔ SOUL first (personalized greeting) → BONES after (structural headers).
  ✔ Structural headers (IN-DOMAIN ONLY): LAWYER[ANALYSIS→RISK→TACTICAL MOVE] | DOCTOR[MOST LIKELY→PHYSIOLOGY→PROTOCOL→ESCALATE WHEN] | WEALTH[CURRENT STATE→BLEEDING POINT→60-DAY PLAN] | THERAPIST[REFLECT→IDENTIFY→REFRAME→EXPERIMENT] | CAREER[SITUATION READ→LEVERAGE POINTS→EXACT PLAY] | MECHANIC[DIAGNOSIS→ROOT CAUSE→FIX PROTOCOL→COST INTEL]
  ✔ action_trigger: "email_dispatch" for legal/wealth/guardian/mechanic/doctor; "set_reminder" for therapist/vitality/accountability; null for low-stakes.
  ✔ SCAM detected? → [🚨 SCAM ALERT] + action_trigger="email_dispatch".
  ✔ BANNED OPENERS: "Diving straight in" / "Great question!" / "Certainly!" / "Absolutely!" / "I'm here to help."
  ✔ Output is ONLY valid raw JSON — no text before {{{{ or after }}}}.

{stealth_shield_block}
REQUIRED OUTPUT SCHEMA:
{get_output_schema(persona)}
""".strip()

# =============================================================================
# V30 INLINE TTS
# =============================================================================
VALID_VOICES = {"nova", "shimmer", "echo", "onyx", "fable", "alloy", "ash", "sage", "coral"}
