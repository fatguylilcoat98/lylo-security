import random

# GLOBAL HOOKS DICTIONARY
HOOKS = {
    "guardian": [
        "Security perimeter active. Scanning...",
        "Threat detection online. What are we analyzing?",
        "Digital shield engaged. Standing by.",
        "Perimeter secure. Report your status."
    ],
    "lawyer": [
        "Let's review the fine print before you sign.",
        "Protecting your liability is my priority.",
        "Legal counsel ready. Where is the contract?",
        "I'm looking for loopholes. Show me the document."
    ],
    "doctor": [
        "Medical triage active. Describe the symptoms.",
        "Let's analyze those symptoms scientifically.",
        "Health monitor online. What hurts?",
        "I can explain that diagnosis in plain English."
    ],
    "wealth": [
        "Let's check the numbers. Money never sleeps.",
        "Building your empire starts with this decision.",
        "Let's look at the ROI of this situation.",
        "Debt is the enemy. Cash flow is king. What's the move?"
    ],
    "career": [
        "Let's get you that raise.",
        "Time to level up your title. What's the play?",
        "Resume polish mode active. Let's beat the ATS.",
        "Office politics? I've got a strategy for that."
    ],
    "therapist": [
        "I'm listening. No judgment here.",
        "Let's unpack that feeling.",
        "Safe space active. Take a deep breath.",
        "How are you holding up today?"
    ],
    "mechanic": [
        "Pop the hood. What's making the noise?",
        "Let's diagnose that issue before it gets expensive.",
        "Wrench ready. Tell me the symptoms.",
        "I've got the manual open. What are we fixing?"
    ],
    "tutor": [
        "Class is in session. What are we mastering?",
        "Let's learn something new today.",
        "Knowledge bank open. Ask me anything.",
        "I can break this down until it clicks."
    ],
    "pastor": [
        "Peace be with you. How is your spirit?",
        "Let's find some clarity in the chaos.",
        "Walking in faith. I am here for you.",
        "Grace and peace. What is on your heart?"
    ],
    "vitality": [
        "Fuel and fire! Let's go!",
        "Movement is medicine. What's the workout?",
        "Health is wealth. Let's optimize your engine.",
        "No excuses today. Let's get it done."
    ],
    "hype": [
        "Let's go viral! Main character energy only.",
        "Hype train leaving the station! 🚂",
        "Yo, let's make some noise!",
        "This is gonna be legendary. What's the plan?"
    ],
    "bestie": [
        "Spill the tea. I'm ready.",
        "I got you, always. No filter.",
        "What happened?! Tell me everything.",
        "No judgment zone. Just us."
    ]
}

def get_random_hook(persona_id):
    """Returns a dynamic opening hook for a specific persona."""
    return random.choice(HOOKS.get(persona_id, ["System ready. How can I help?"]))

def get_all_hooks():
    """Returns the entire dictionary of hooks (REQUIRED BY MAIN.PY)."""
    return HOOKS
