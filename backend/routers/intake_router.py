"""LYLO OS — routers/intake_router.py
Endpoints: /intake-questions/{round_number}, /user-intake, /get-intake/{user_email}
"""
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

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from services.config import create_user_id
from services.memory_engine import retrieve_intake_profile, store_intake_profile
logger = logging.getLogger("LYLO.Intake")
router = APIRouter()

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
