"""LYLO OS — routers/session_router.py
Endpoints: /ui-strings, /send-session-report, /health, /
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

from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse, HTMLResponse
from services.config import (
    create_user_id, ELITE_USERS, openai_client,
    gemini_client, claude_client, WAITLIST_DB,
)
from services.pdf_mailer import send_mission_report_email
logger = logging.getLogger("LYLO.Session")
router = APIRouter()

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
    strings    = _UI_STRINGS.get(lang_clean, _UI_STRINGS["en"])
    return JSONResponse({"lang": lang_clean, "strings": strings})


@router.post("/send-session-report")
async def send_session_report(
    user_email: str = Form(...),
    persona:    str = Form("guardian"),
    content:    str = Form(...),
    user_name:  str = Form("Protected User"),
):
    """
    Called when user taps 'End Session' and confirms they want the PDF.
    This is the ONLY place PDFs are dispatched for regular chat sessions.
    Emergency protocols do NOT auto-send — they wait for this too.
    """
    if not content.strip():
        return JSONResponse({"status": "skipped", "reason": "no content"})
    try:
        await send_mission_report_email(
            to_email     = user_email.lower().strip(),
            content      = content,
            persona_name = persona,
            user_name    = user_name,
        )
        logger.info(f"📄 Session report sent → {user_email} [{persona}]")
        return JSONResponse({"status": "sent"})
    except Exception as e:
        logger.error(f"Session report send failed: {e}")
        return JSONResponse({"status": "error", "reason": str(e)}, status_code=500)


@router.get("/health")
async def health_check():
    """Render uptime monitoring + quick system status."""
    return {
        "status":   "healthy",
        "version":  "31.0.0",
        "engines": {
            "openai":  bool(openai_client),
            "gemini":  bool(gemini_client),
            "claude":  bool(claude_client),
        },
        "beta_slots_filled": sum(1 for e, d in ELITE_USERS.items() if d.get("beta") and "placeholder.com" not in e),
        "waitlist_count":    len(WAITLIST_DB),
    }


@router.get("/obd2")
async def serve_obd2_schematic():
    """Serve the OBDLink integration schematic — shareable link for partners."""
    schematic_path = os.path.join(os.path.dirname(__file__), "lylo_obd2_schematic.html")
    if os.path.exists(schematic_path):
        with open(schematic_path, "r") as f:
            html = f.read()
        return HTMLResponse(content=html)
    return HTMLResponse(content="<h1>Schematic not found</h1>", status_code=404)


@router.get("/")
async def root():
    return {
        "status":  "LYLO OS Active",
        "version": "31.0.0 — KERNEL v31 | TRIPLE ENGINE | CLAUDE VALIDATOR | OBD-II",
        "message": "Digital Bodyguard OS — Protecting lives through intelligence.",
    }

