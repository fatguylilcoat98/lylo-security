"""LYLO OS — services/audio_service.py"""
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

from services.config import openai_client
logger = logging.getLogger("LYLO.Audio")
VALID_VOICES = {"nova", "shimmer", "echo", "onyx", "fable", "alloy", "ash", "sage", "coral"}

async def generate_audio_inline(text: str, voice: str = "onyx") -> str:
    if not openai_client or not text.strip():
        return ""
    safe_voice = voice if voice in VALID_VOICES else "onyx"
    try:
        clean = text.replace("**","").replace("##","").replace("#","").replace("[","").replace("]","").strip()
        resp  = await openai_client.audio.speech.create(model="tts-1", voice=safe_voice, input=clean[:3500])
        return base64.b64encode(resp.content).decode("utf-8")
    except Exception as e:
        logger.warning(f"⚡ Inline TTS failed ({safe_voice}): {e}")
        return ""
