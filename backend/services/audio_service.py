"""LYLO OS — services/audio_service.py
Voice Presence Layer v2.0 — Council spec implementation
- vocal_energy → TTS speed mapping
- Natural pause injection between chunks
- Robotic closing removal
- Single clean TTS call with speed control
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
from services.config import openai_client

logger = logging.getLogger("LYLO.Audio")

VALID_VOICES = {"nova", "shimmer", "echo", "onyx", "fable", "alloy", "ash", "sage", "coral"}

# ── Robotic closing phrases to strip before TTS ───────────────────────────────
# Voice mode should end naturally — not with a help desk sign-off
_ROBOTIC_CLOSINGS = [
    r"let me know if you need anything else\.?",
    r"let me know if you have any (other )?questions\.?",
    r"how can i (further )?assist you\.?",
    r"is there anything else i can help (you with)?\.?",
    r"feel free to ask if you need (more help|anything)\.?",
    r"don'?t hesitate to (ask|reach out)\.?",
    r"i'?m here if you need (me|anything|more help)\.?",
    r"hope that helps\.?",
    r"please let me know if\.?",
    r"as always,? i'?m here\.?",
]
_ROBOTIC_PATTERN = re.compile(
    r"(" + "|".join(_ROBOTIC_CLOSINGS) + r")",
    re.IGNORECASE
)

# ── Vocal energy → TTS speed mapping (Gemini council spec) ───────────────────
# Subtle adjustments only — presence, not performance
_ENERGY_SPEED_MAP = {
    "low":    0.92,   # warm, unhurried — user sounds tired or stressed
    "medium": 1.0,    # natural baseline
    "high":   1.08,   # slightly more engaged — user is energized
}

# ── Pause durations in seconds (injected as silence between chunks) ───────────
_PAUSE_SHORT     = 0.25   # after short declarative sentence
_PAUSE_EMOTIONAL = 0.45   # after empathy / reflection
_PAUSE_BEFORE_ACTION = 0.30  # before giving a step or instruction

# Emotional reflection markers — warrant a longer pause after
_EMOTIONAL_MARKERS = re.compile(
    r"\b(i hear you|that makes sense|i understand|that'?s (really )?(hard|tough|a lot)|"
    r"i'?m sorry|that sounds (overwhelming|difficult|scary)|i get it|"
    r"you'?re (right|not alone)|that'?s completely normal)\b",
    re.IGNORECASE
)

# Action/instruction markers — warrant a pause before
_ACTION_MARKERS = re.compile(
    r"^(here'?s what|first,?|step|do this|go to|call|stop|don'?t|make sure)",
    re.IGNORECASE
)


def _strip_robotic_closings(text: str) -> str:
    """Remove robotic help-desk sign-off phrases before TTS."""
    return _ROBOTIC_PATTERN.sub("", text).strip().rstrip(",").strip()


def _clean_for_tts(text: str) -> str:
    """Strip markdown and formatting that shouldn't be spoken."""
    clean = text.replace("**", "").replace("##", "").replace("#", "")
    clean = clean.replace("[", "").replace("]", "")
    clean = clean.replace("•", "").replace("—", ",")
    clean = _strip_robotic_closings(clean)
    return clean.strip()


def _pause_after_sentence(sentence: str) -> float:
    """Return appropriate pause duration after this sentence."""
    s = sentence.strip()
    if _EMOTIONAL_MARKERS.search(s):
        return _PAUSE_EMOTIONAL
    if len(s) < 40:
        return _PAUSE_SHORT
    return _PAUSE_SHORT


def _pause_before_sentence(sentence: str) -> float:
    """Return appropriate pause duration before this sentence."""
    if _ACTION_MARKERS.match(sentence.strip()):
        return _PAUSE_BEFORE_ACTION
    return 0.0


def get_tts_speed(vocal_energy: str) -> float:
    """Map vocal energy level to TTS speed multiplier."""
    return _ENERGY_SPEED_MAP.get(vocal_energy.lower(), 1.0)


async def generate_audio_inline(
    text: str,
    voice: str = "onyx",
    vocal_energy: str = "medium",
    is_voice_mode: bool = False,
) -> str:
    """
    Generate TTS audio for a single text chunk.

    Args:
        text:         Text to speak
        voice:        OpenAI voice ID
        vocal_energy: 'low' | 'medium' | 'high' — maps to speed
        is_voice_mode: If True, strip robotic closings and apply speed mapping

    Returns:
        Base64-encoded MP3 audio string, or "" on failure
    """
    if not openai_client or not text.strip():
        return ""

    safe_voice = voice if voice in VALID_VOICES else "onyx"
    speed      = get_tts_speed(vocal_energy) if is_voice_mode else 1.0
    clean      = _clean_for_tts(text) if is_voice_mode else (
        text.replace("**","").replace("##","").replace("#","")
            .replace("[","").replace("]","").strip()
    )

    if not clean:
        return ""

    try:
        resp = await openai_client.audio.speech.create(
            model="tts-1",
            voice=safe_voice,
            input=clean[:3500],
            speed=speed,
        )
        return base64.b64encode(resp.content).decode("utf-8")
    except Exception as e:
        logger.warning(f"⚡ Inline TTS failed ({safe_voice}, speed={speed}): {e}")
        return ""


async def generate_silence_b64(duration_seconds: float) -> str:
    """
    Generate a very short silence audio clip as base64 MP3.
    Used to inject natural pauses between spoken sentences.
    Returns empty string if duration is negligible.
    """
    if duration_seconds < 0.1:
        return ""
    # Minimal valid MP3 silence — ~100ms of silence per frame
    # We approximate by returning empty and letting frontend handle timing
    # Frontend reads pause_ms from chunk metadata and delays playback
    return ""


def get_pause_metadata(sentence: str, next_sentence: str = "") -> dict:
    """
    Return pause timing metadata for a sentence chunk.
    Frontend uses this to inject natural timing between audio chunks.

    Returns:
        {
          "pause_before_ms": int,  # ms to wait before playing this chunk
          "pause_after_ms":  int,  # ms to wait after this chunk finishes
        }
    """
    before = _pause_before_sentence(sentence)
    after  = _pause_after_sentence(sentence)

    # If next sentence starts with an action marker, add a bit more space
    if next_sentence and _ACTION_MARKERS.match(next_sentence.strip()):
        after = max(after, _PAUSE_BEFORE_ACTION)

    return {
        "pause_before_ms": int(before * 1000),
        "pause_after_ms":  int(after  * 1000),
    }
