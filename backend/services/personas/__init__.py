"""
LYLO Persona Fortress Registry
Each persona owns: relational voice string, inject_fortress(), apply_gates()
chat_router.py calls these — never owns persona logic directly.
"""
from .guardian  import PERSONA_STRING as GUARDIAN_STRING,  inject_fortress as guardian_inject,  apply_gates as guardian_gates
from .doctor    import PERSONA_STRING as DOCTOR_STRING,    inject_fortress as doctor_inject,    apply_gates as doctor_gates
from .lawyer    import PERSONA_STRING as LAWYER_STRING,    inject_fortress as lawyer_inject,    apply_gates as lawyer_gates
from .mechanic  import PERSONA_STRING as MECHANIC_STRING,  inject_fortress as mechanic_inject,  apply_gates as mechanic_gates
from .wealth    import PERSONA_STRING as WEALTH_STRING,    inject_fortress as wealth_inject,    apply_gates as wealth_gates
from .career    import PERSONA_STRING as CAREER_STRING,    inject_fortress as career_inject,    apply_gates as career_gates
from .vitality  import PERSONA_STRING as VITALITY_STRING,  inject_fortress as vitality_inject,  apply_gates as vitality_gates
from .tutor     import PERSONA_STRING as TUTOR_STRING,     inject_fortress as tutor_inject,     apply_gates as tutor_gates
from .pastor    import PERSONA_STRING as PASTOR_STRING,    inject_fortress as pastor_inject,    apply_gates as pastor_gates
from .hype      import PERSONA_STRING as HYPE_STRING,      inject_fortress as hype_inject,      apply_gates as hype_gates
from .bestie    import PERSONA_STRING as BESTIE_STRING,    inject_fortress as bestie_inject,    apply_gates as bestie_gates

__all__ = [
    "GUARDIAN_STRING",  "guardian_inject",  "guardian_gates",
    "DOCTOR_STRING",    "doctor_inject",    "doctor_gates",
    "LAWYER_STRING",    "lawyer_inject",    "lawyer_gates",
    "MECHANIC_STRING",  "mechanic_inject",  "mechanic_gates",
    "WEALTH_STRING",    "wealth_inject",    "wealth_gates",
    "CAREER_STRING",    "career_inject",    "career_gates",
    "VITALITY_STRING",  "vitality_inject",  "vitality_gates",
    "TUTOR_STRING",     "tutor_inject",     "tutor_gates",
    "PASTOR_STRING",    "pastor_inject",    "pastor_gates",
    "HYPE_STRING",      "hype_inject",      "hype_gates",
    "BESTIE_STRING",    "bestie_inject",    "bestie_gates",
]
