"""
LYLO OS — main.py  (v31.0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entry point only.  No business logic lives here.

Folder layout:
  services/
    config.py          ← env vars, clients, global state
    memory_engine.py   ← Pinecone read/write, intake/vault
    prompt_builder.py  ← system prompt assembly
    llm_clients.py     ← Gemini, OpenAI, Claude API calls
    emergency_engine.py← emergency detection + responses
    scam_detector.py   ← scam analysis + injection blocking
    audio_service.py   ← TTS generation
    web_search.py      ← Tavily search
    pdf_mailer.py      ← mission report PDF + email

  routers/
    chat_router.py     ← /generate-audio, /persona-hook, /chat
    vault_router.py    ← all /vault/* endpoints
    intake_router.py   ← /user-intake, /get-intake, /intake-questions
    admin_router.py    ← waitlist, beta, /webhook (Stripe)
    session_router.py  ← /send-session-report, /health, /ui-strings, /
    obd_router.py      ← /obd-handshake, /obd2

Adding a new feature?  Add a new file.  Don't touch this one.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
import sys
import os

# Render.com path fix — ensures all local modules are findable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Existing standalone routers (pre-modularisation) ──────────────────────────
from sentinel_routes import sentinel_router
from vault_routes    import vault_router as tactical_vault_router

# ── New modular routers ────────────────────────────────────────────────────────
from routers.chat_router    import router as chat_router
from routers.vault_router   import router as vault_router
from routers.intake_router  import router as intake_router
from routers.admin_router   import router as admin_router
from routers.session_router import router as session_router
from routers.obd_router     import router as obd_router

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="LYLO Total Integration Backend",
    description="Human-First Digital Bodyguard OS — Kernel v31.0",
    version="31.0.0 — KERNEL v31 | MODULAR ARCH | TACTICAL VAULT | OBD-II | SENTINEL",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount all routers ─────────────────────────────────────────────────────────
app.include_router(sentinel_router)          # push notifications
app.include_router(tactical_vault_router)    # /generate-report, /send-report-to-pro
app.include_router(chat_router)              # /chat, /persona-hook, /generate-audio
app.include_router(vault_router)             # /vault/*
app.include_router(intake_router)            # /user-intake, /get-intake, /intake-questions
app.include_router(admin_router)             # /join-waitlist, /webhook, etc.
app.include_router(session_router)           # /health, /ui-strings, /send-session-report, /
app.include_router(obd_router)               # /obd-handshake, /obd2

# ── Dev server ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
