"""
LYLO OS — main.py (v31.0 Modular)
Entry point only. No business logic lives here.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sentinel_routes import sentinel_router
from vault_routes    import vault_router as tactical_vault_router

from routers.chat_router    import router as chat_router
from routers.vault_router   import router as vault_router
from routers.intake_router  import router as intake_router
from routers.admin_router   import router as admin_router
from routers.session_router import router as session_router
from routers.obd_router     import router as obd_router

app = FastAPI(
    title="LYLO Total Integration Backend",
    version="31.0.0 — KERNEL v31 | MODULAR ARCH",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sentinel_router)
app.include_router(tactical_vault_router)
app.include_router(chat_router)
app.include_router(vault_router)
app.include_router(intake_router)
app.include_router(admin_router)
app.include_router(session_router)
app.include_router(obd_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
