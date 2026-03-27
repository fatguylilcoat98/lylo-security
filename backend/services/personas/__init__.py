"""
LYLO Persona Fortress Registry — The Good Neighbor Guard
Built by Christopher Hughes · Sacramento, CA
Created with the help of AI collaborators (Claude · GPT · Gemini · Groq)
Truth · Safety · We Got Your Back

Each persona owns: relational voice string, inject_fortress(), apply_gates()
chat_router.py calls these — never owns persona logic directly.
"""
from .guardian import PERSONA_STRING as GUARDIAN_STRING, inject_fortress as guardian_inject, apply_gates as guardian_gates
from .bestie   import PERSONA_STRING as BESTIE_STRING,   inject_fortress as bestie_inject,   apply_gates as bestie_gates
from .mechanic import PERSONA_STRING as MECHANIC_STRING, inject_fortress as mechanic_inject, apply_gates as mechanic_gates
from .guide    import PERSONA_STRING as GUIDE_STRING,    inject_fortress as guide_inject,    apply_gates as guide_gates
from .builder  import PERSONA_STRING as BUILDER_STRING,  inject_fortress as builder_inject,  apply_gates as builder_gates

__all__ = [
    "GUARDIAN_STRING", "guardian_inject", "guardian_gates",
    "BESTIE_STRING",   "bestie_inject",   "bestie_gates",
    "MECHANIC_STRING", "mechanic_inject", "mechanic_gates",
    "GUIDE_STRING",    "guide_inject",    "guide_gates",
    "BUILDER_STRING",  "builder_inject",  "builder_gates",
]
