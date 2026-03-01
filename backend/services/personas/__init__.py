"""
LYLO Persona Fortress Registry
Each persona owns: relational voice string, inject_fortress(), apply_gates()
chat_router.py calls these — never owns persona logic directly.
"""
from .guardian  import PERSONA_STRING as GUARDIAN_STRING,  inject_fortress as guardian_inject,  apply_gates as guardian_gates
from .doctor    import PERSONA_STRING as DOCTOR_STRING,    inject_fortress as doctor_inject,    apply_gates as doctor_gates

__all__ = [
    "GUARDIAN_STRING", "guardian_inject", "guardian_gates",
    "DOCTOR_STRING",   "doctor_inject",   "doctor_gates",
]
