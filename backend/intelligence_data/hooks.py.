"""
LYLO Digital Bodyguard Persona Hooks
Modular greeting system for dynamic personality switching
"""

import random

PERSONA_HOOKS = {
    "guardian": [
        "Shields up. Situation?", 
        "Perimeter secure. Listening.", 
        "Scanning... State your concern.",
        "Guardian here. What's the threat assessment?",
        "Digital bodyguard online. Report status."
    ],
    "roast": [
        "Oh great, what did you click now?", 
        "Ready to roast some scammers?", 
        "I'm here to save you from yourself.",
        "Let me guess - another 'great deal' showed up?",
        "Time to serve some digital justice with extra sass."
    ],
    "mechanic": [
        "I hear a rattle. What's up?", 
        "Greasy hands, sharp mind. What's broken?", 
        "Let's look under the hood.",
        "Mechanic here. Something need fixing?",
        "Got a problem that needs some elbow grease?"
    ],
    "lawyer": [
        "Lawyer here. Let's protect your rights today.",
        "What legal matter needs my attention?",
        "Time to review the fine print together.",
        "Legal shield activated. What's the case?",
        "I smell a contract dispute brewing."
    ],
    "techie": [
        "I'm the Techie! Let's get those gadgets working.",
        "Tech support reporting for duty.",
        "What digital chaos needs sorting out?",
        "Ready to debug your life?",
        "Another day, another tech mystery to solve."
    ],
    "storyteller": [
        "Shall we create a custom story?",
        "The storyteller weaves tales of protection.",
        "Every problem has a narrative solution.",
        "Let me craft you a story of triumph.",
        "Once upon a time, a user needed guidance..."
    ],
    "comedian": [
        "Ready for a laugh? Let's fix this with a smile.",
        "Comedy central reporting for duty!",
        "Why so serious? Let's have some fun.",
        "Time to turn this problem into a punchline.",
        "Laughter is the best digital medicine."
    ],
    "chef": [
        "Chef in the house! What are we cooking today?",
        "Something smells fishy - and I don't mean dinner.",
        "Time to serve up some kitchen wisdom.",
        "Let's whip up a solution together.",
        "The kitchen is open for business!"
    ],
    "fitness": [
        "Coach here! Let's get you moving safely today.",
        "Time for a security workout!",
        "Ready to flex those digital muscles?",
        "Let's build some protection strength.",
        "No pain, no gain in digital safety!"
    ],
    "disciple": [
        "I am the Disciple. I have a word of wisdom for you.",
        "Let scripture be our guide through this trial.",
        "The Good Book has answers for every challenge.",
        "Faith shall be your shield in this matter.",
        "Seek ye first understanding, and protection follows."
    ]
}

def get_random_hook(persona_id):
    """Returns a random greeting hook for the specified persona."""
    hooks = PERSONA_HOOKS.get(persona_id, PERSONA_HOOKS["guardian"])
    return random.choice(hooks)

def get_all_hooks(persona_id):
    """Returns all hooks for a persona (for testing/admin purposes)."""
    return PERSONA_HOOKS.get(persona_id, PERSONA_HOOKS["guardian"])

def add_custom_hook(persona_id, hook_text):
    """Allows dynamic addition of new hooks (for future scaling)."""
    if persona_id not in PERSONA_HOOKS:
        PERSONA_HOOKS[persona_id] = []
    PERSONA_HOOKS[persona_id].append(hook_text)
