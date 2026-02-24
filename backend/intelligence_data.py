# ==============================================================================
# LYLO OS - INTELLIGENCE DATA ENGINE v11.0 (PRODUCTION CLEAN)
# Multi-Layered Persona Architecture | Universal User Identity Core
# ==============================================================================

import random
import json
from datetime import datetime

# ==============================================================================
# LAYER 0: DYNAMIC USER IDENTITY CORE
# ==============================================================================

def build_user_ident_core(profile: dict, warm_start: dict = None) -> str:
    """
    Assembles the user's identity from dynamic database entries.
    Scrubbed of all hard-coded beta data.
    """
    merged = {}
    if profile: merged.update(profile)
    # Warm start now acts as a temporary session buffer, not a hard-coded registry.
    if warm_start: merged.update(warm_start)

    if not merged:
        return """
╔══════════════════════════════════════════════════════════════╗
║            LAYER 0 — INITIALIZING USER IDENTITY             ║
╚══════════════════════════════════════════════════════════════╝
NEW USER DETECTED. 
Mission: Establish trust and gather core context through onboarding.
Engagement: Professional, curious, and protective.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

    name = merged.get("name", "User")
    projects = merged.get("projects", [])
    goals = merged.get("goals", [])
    
    projects_str = "\n".join(f"  • {p}" for p in projects[:5]) if projects else "  • No active projects yet."
    goals_str = "\n".join(f"  • {g}" for g in goals[:5]) if goals else "  • No goals defined yet."

    return f"""
╔══════════════════════════════════════════════════════════════╗
║         LAYER 0 — USER IDENTITY CORE (ACTIVE)
╚══════════════════════════════════════════════════════════════╝
NAME          : {name}
OCCUPATION    : {merged.get("occupation", "Unknown")}
LOCATION      : {merged.get("location", "Unknown")}

ACTIVE PROJECTS:
{projects_str}

CURRENT GOALS:
{goals_str}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEALTH DIRECTIVE: Maintain privacy. Never recite PII back to the user.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

# ==============================================================================
# GLOBAL OPERATING DIRECTIVE (PRODUCTION HARDENED)
# ==============================================================================

GLOBAL_DIRECTIVE = """
1. TRUTH FIRST: Never lie or hallucinate. If data is missing, ask for it.
2. HELP FIRST: Answer the user's specific technical/legal/medical task BEFORE any other commentary.
3. NO METAPHORS: Use professional, domain-specific language only.
4. EXPERT BOUNDARIES: Stay 100% in your assigned lane. Use Handoff Protocol for other domains.
5. JSON ONLY: Output must be raw JSON to prevent system crashes.
6. HONEST CODE: Provide full, unsummarized code blocks when requested by the developer.
"""

# ==============================================================================
# HARD BOUNDARY ENFORCEMENT
# ==============================================================================

def build_hard_boundary_block(persona: str) -> str:
    """
    Enforces strict specialist domains. 
    Prevents the 'Lawyer playing Mechanic' bug.
    """
    # Mapping for the 12 Specialists
    domains = {
        "lawyer": "Legal strategy, Lemon Law, contracts, liability.",
        "mechanic": "Vehicles, hardware, physical diagnostics, repair protocols.",
        "doctor": "Medical symptoms, physiology, triage, clinical advice.",
        "guardian": "Digital security, scam detection, privacy protection.",
        "wealth": "Finance, debt destruction, ROI, investment math."
    }
    in_scope = domains.get(persona.lower(), "your specialized domain")
    
    return f"""
══════════════════════════════════════════════════════════════════
EXPERT IDENTITY: {persona.upper()}
DOMAIN: {in_scope} ONLY.
If the user asks for advice outside this domain, YOU MUST REFUSE 
and direct them to the correct specialist. No guessing.
══════════════════════════════════════════════════════════════════
"""

# ==============================================================================
# EMPTY REGISTRY (FOR NEW USERS)
# ==============================================================================

BETA_USER_PROFILES = {} # SCRUBBED FOR PRODUCTION

def get_warm_start_profile(email: str):
    return {} # Dynamic lookup handled in main.py

# ==============================================================================
# OUTPUT SCHEMAS & PERSONA DEFINITIONS
# ==============================================================================

PERSONA_TIERS = {
    "guardian": "free", "mechanic": "pro", "doctor": "pro", 
    "therapist": "pro", "tutor": "pro", "lawyer": "elite", "wealth": "elite"
}

_HOOKS = {
    "guardian": ["Security active. What's the threat?"],
    "lawyer": ["Legal shield up. What's the dispute?"],
    "mechanic": ["Wrench ready. What are we fixing?"],
    "doctor": ["Medical intelligence online. Describe the symptoms."]
}

def get_random_hook(persona_id: str):
    return random.choice(_HOOKS.get(persona_id, ["System ready. State your mission."]))
