"""
LYLO Security Backend v32.0 - Fixed Version
FastAPI application with secure CORS configuration and improved error handling
"""

import os
import sys
import logging
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

# Import routers - using try/except for graceful degradation
try:
    # Core routers
    from routers.chat_router import router as chat_router
    from routers.vault_router import router as vault_router
    from routers.intake_router import router as intake_router
    from routers.admin_router import router as admin_router
    from routers.session_router import router as session_router
    from routers.obd_router import router as obd_router

    # Sentinel routes (importing from root level)
    from sentinel_routes import router as sentinel_router
    from vault_routes import router as tactical_vault_router

except ImportError as e:
    logging.error(f"Failed to import routers: {e}")
    # Could implement fallback behavior here if needed

# ═══════════════════════════════════════════════════════════════════════════════
#                               CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Environment configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = ENVIRONMENT == "development"

# CORS configuration - secure by default
def get_allowed_origins() -> List[str]:
    """Get allowed CORS origins based on environment."""
    if ENVIRONMENT == "production":
        # Production origins - restrict to actual domains
        return [
            "https://mylylo.pro",
            "https://www.mylylo.pro",
            "https://app.mylylo.pro",
        ]
    elif ENVIRONMENT == "staging":
        # Staging origins
        return [
            "https://staging.mylylo.pro",
            "https://test.mylylo.pro",
            "https://mylylo.pro",
        ]
    else:
        # Development origins
        return [
            "http://localhost:3000",
            "http://localhost:5173",  # Vite dev server
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "https://localhost:3000",  # HTTPS dev
        ]

# Trusted host configuration
def get_trusted_hosts() -> List[str]:
    """Get trusted hosts based on environment."""
    if ENVIRONMENT == "production":
        return ["mylylo.pro", "www.mylylo.pro", "api.mylylo.pro"]
    else:
        return ["localhost", "127.0.0.1", "0.0.0.0"]

# ═══════════════════════════════════════════════════════════════════════════════
#                               APPLICATION SETUP
# ═══════════════════════════════════════════════════════════════════════════════

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('lylo_security.log') if not DEBUG else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)

# Initialize FastAPI application
app = FastAPI(
    title="LYLO Security API",
    description="Secure AI assistant backend with multi-persona architecture",
    version="32.0",
    debug=DEBUG,
    docs_url="/docs" if DEBUG else None,  # Hide docs in production
    redoc_url="/redoc" if DEBUG else None,
)

# ═══════════════════════════════════════════════════════════════════════════════
#                               MIDDLEWARE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Security: Trusted Host middleware (prevents Host header attacks)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=get_trusted_hosts()
)

# CORS middleware with secure configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,  # Required for authenticated requests
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-User-ID",
        "X-Request-ID",
        "Accept",
        "Origin",
        "User-Agent",
        "DNT",
        "Cache-Control",
    ],
    expose_headers=["X-Total-Count", "X-Page-Count", "X-Rate-Limit"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Custom middleware for request logging
@app.middleware("http")
async def log_requests(request, call_next):
    """Log all requests for monitoring and debugging."""
    start_time = time.time()

    # Log request
    logger.info(f"Request: {request.method} {request.url}")

    try:
        response = await call_next(request)

        # Log response
        process_time = time.time() - start_time
        logger.info(f"Response: {response.status_code} in {process_time:.4f}s")

        # Add timing header
        response.headers["X-Process-Time"] = str(process_time)

        return response

    except Exception as e:
        # Log errors
        logger.error(f"Request failed: {str(e)}")
        raise

# ═══════════════════════════════════════════════════════════════════════════════
#                               EXCEPTION HANDLERS
# ═══════════════════════════════════════════════════════════════════════════════

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions with consistent error format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": "http_exception",
                "message": exc.detail,
                "status_code": exc.status_code,
                "timestamp": time.time(),
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle unexpected exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "type": "internal_server_error",
                "message": "An unexpected error occurred" if not DEBUG else str(exc),
                "status_code": 500,
                "timestamp": time.time(),
            }
        }
    )

# ═══════════════════════════════════════════════════════════════════════════════
#                               HEALTH AND MONITORING
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "version": "32.0",
        "environment": ENVIRONMENT,
        "timestamp": time.time(),
    }

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with system information."""
    import psutil

    return {
        "status": "healthy",
        "version": "32.0",
        "environment": ENVIRONMENT,
        "system": {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent,
        },
        "timestamp": time.time(),
    }

# ═══════════════════════════════════════════════════════════════════════════════
#                               ROUTER REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════════

# Register all routers with proper error handling
routers_to_register = [
    (chat_router, "/api/chat", ["chat"]),
    (vault_router, "/api/vault", ["vault"]),
    (intake_router, "/api/intake", ["intake"]),
    (admin_router, "/api/admin", ["admin"]),
    (session_router, "/api/session", ["session"]),
    (obd_router, "/api/obd", ["obd"]),
    (sentinel_router, "/api/sentinel", ["sentinel"]),
    (tactical_vault_router, "/api/tactical", ["tactical"]),
]

for router, prefix, tags in routers_to_register:
    try:
        app.include_router(router, prefix=prefix, tags=tags)
        logger.info(f"Registered router: {prefix}")
    except Exception as e:
        logger.error(f"Failed to register router {prefix}: {e}")
        if ENVIRONMENT == "production":
            # In production, continue without the failed router
            continue
        else:
            # In development, raise the error for debugging
            raise

# ═══════════════════════════════════════════════════════════════════════════════
#                               STARTUP/SHUTDOWN EVENTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info(f"LYLO Security Backend v32.0 starting up in {ENVIRONMENT} mode")

    # Initialize any required services here
    # e.g., database connections, external service clients, etc.

    logger.info("LYLO Security Backend startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    logger.info("LYLO Security Backend shutting down")

    # Cleanup any resources here
    # e.g., close database connections, cleanup temp files, etc.

    logger.info("LYLO Security Backend shutdown complete")

# ═══════════════════════════════════════════════════════════════════════════════
#                               APPLICATION ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import time
    import uvicorn

    # Development server configuration
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=DEBUG,
        log_level="debug" if DEBUG else "info",
        access_log=DEBUG,
    )