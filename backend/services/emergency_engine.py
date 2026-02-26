"""
LYLO OS — services/emergency_engine.py
Emergency detection, routing, and step-by-step response builder.
"""
import time
import logging
from typing import Any

logger = logging.getLogger("LYLO.Emergency")

# =============================================================================
# EMERGENCY PROTOCOL SYSTEM — v31.0
# Detects active crisis situations and delivers calm, step-by-step protocols.
# PDF auto-dispatches immediately — no user prompt needed.
# =============================================================================

# Maps emergency types to the correct persona regardless of current seat
_EMERGENCY_PERSONA_ROUTER = {
    # Any message containing these keywords → auto-switch to this persona
    "car wreck":          "lawyer",
    "car accident":       "lawyer",
    "just crashed":       "lawyer",
    "i crashed":          "lawyer",
    "was hit":            "lawyer",
    "got hit":            "lawyer",
    "fender bender":      "lawyer",
    "collision":          "lawyer",
    "someone hit me":     "lawyer",
    "hit and run":        "lawyer",
    "totaled my car":     "lawyer",
    "being arrested":     "lawyer",
    "they arrested":      "lawyer",
    "under arrest":       "lawyer",
    "eviction notice":    "lawyer",
    "being evicted":      "lawyer",
    "served papers":      "lawyer",
    "chest pain":         "doctor",
    "heart attack":       "doctor",
    "stroke symptoms":    "doctor",
    "face drooping":      "doctor",
    "slurred speech":     "doctor",
    "overdose":           "doctor",
    "not breathing":      "doctor",
    "unconscious":        "doctor",
    "severe allergic":    "doctor",
    "throat closing":     "doctor",
    "seizure":            "doctor",
    "having a seizure":   "doctor",
    "account hacked":     "guardian",
    "i got hacked":       "guardian",
    "someone hacked":     "guardian",
    "identity stolen":    "guardian",
    "identity theft":     "guardian",
    "credit card stolen": "guardian",
    "unauthorized charges": "guardian",
    "fraud on my account": "guardian",
    "brake failure":      "mechanic",
    "brakes failed":      "mechanic",
    "brakes aren't working": "mechanic",
    "no brakes":          "mechanic",
    "tire blowout":       "mechanic",
    "blew a tire":        "mechanic",
    "engine overheating": "mechanic",
    "car is smoking":     "mechanic",
    "account drained":    "wealth",
    "bank account empty": "wealth",
    "money stolen":       "wealth",
    "wire fraud":         "wealth",
    "heat stroke":        "vitality",
    "heat exhaustion":    "vitality",
    "passed out from heat": "vitality",
}


def detect_emergency_and_route(persona: str, message: str) -> tuple[dict | None, str | None, str | None]:
    """
    Detects emergency in message regardless of current persona.
    Returns (protocol, protocol_key, correct_persona).
    If emergency detected on wrong persona — auto-switches to correct one.
    """
    msg_lower = message.lower()

    # Check global router first — works from ANY persona
    routed_persona = None
    for kw, target_persona in _EMERGENCY_PERSONA_ROUTER.items():
        if kw in msg_lower:
            routed_persona = target_persona
            break

    # Use routed persona if found, otherwise check current persona
    check_persona = routed_persona or persona

    protocol, key = detect_emergency(check_persona, message)
    if protocol:
        return protocol, key, routed_persona  # routed_persona = None means no switch needed
    return None, None, None


_EMERGENCY_TRIGGERS = {
    "lawyer": {
        "keywords": [
            "car wreck","car accident","just crashed","i crashed","was hit","got hit",
            "fender bender","collision","someone hit me","hit and run","totaled my car",
            "being arrested","they arrested","police arrested","under arrest","in handcuffs",
            "eviction notice","being evicted","they evicted","served papers","got served",
            "cease and desist","restraining order","being sued","lawsuit filed against",
            "terminated wrongfully","fired illegally","wrongful termination",
        ],
        "protocols": {
            "car_accident": {
                "title": "🚨 CAR ACCIDENT PROTOCOL",
                "trigger_words": ["car wreck","car accident","just crashed","i crashed","was hit","got hit","fender bender","collision","someone hit me","hit and run","totaled my car"],
                "steps": [
                    "FIRST: Check yourself and passengers for injuries. If anyone is hurt — call 911 immediately before anything else.",
                    "SECOND: Do NOT admit fault. Do not say 'I'm sorry' or 'it was my fault' — not even casually. Say nothing except 'I need medical help' if injured.",
                    "THIRD: Move vehicles to safety if possible. Turn on hazard lights. Get to the shoulder or a safe area.",
                    "FOURTH: Call 911 and request a police report. Always get a report number — you will need it for insurance and any legal action.",
                    "FIFTH: Document everything before moving anything. Photos of damage, license plates, road positions, street signs, weather conditions, and any visible injuries.",
                    "SIXTH: Get the other driver's full name, license plate, driver's license number, insurance company, and policy number.",
                    "SEVENTH: Get witness information — names and phone numbers of anyone who saw the accident.",
                    "EIGHTH: Call your insurance company before leaving the scene if possible. Report the accident factually — do not speculate about fault.",
                    "NINTH: Do NOT sign anything at the scene. Do not accept any cash offers. Do not post about the accident on social media.",
                    "TENTH: If you are injured — seek medical attention immediately and document everything. A medical record creates your legal paper trail.",
                ],
                "critical_warning": "Do not give a recorded statement to the OTHER driver's insurance without speaking to an attorney first.",
            },
            "arrest": {
                "title": "🚨 ARREST PROTOCOL",
                "trigger_words": ["being arrested","they arrested","police arrested","under arrest","in handcuffs"],
                "steps": [
                    "FIRST: Stay calm. Do not resist, argue, or run — regardless of whether the arrest is lawful.",
                    "SECOND: Invoke your rights immediately. Say clearly: 'I am invoking my right to remain silent and my right to an attorney.'",
                    "THIRD: Do not answer any questions beyond identifying yourself if required by your state.",
                    "FOURTH: Do not consent to any searches. Say: 'I do not consent to a search.'",
                    "FIFTH: Remember everything you can — officer names, badge numbers, patrol car numbers, time, location.",
                    "SIXTH: You have the right to make a phone call. Call an attorney or a trusted person immediately.",
                    "SEVENTH: Do not discuss your case with anyone in custody — conversations may be recorded.",
                ],
                "critical_warning": "Anything you say WILL be used against you. Stay silent until your attorney is present.",
            },
            "eviction": {
                "title": "🚨 EVICTION PROTOCOL",
                "trigger_words": ["eviction notice","being evicted","they evicted","served papers"],
                "steps": [
                    "FIRST: Do not panic and do not move out immediately — you have legal rights and a process must be followed.",
                    "SECOND: Read the notice carefully. Note the reason, the date issued, and the response deadline.",
                    "THIRD: Document the notice — photograph it, note when and how it was delivered.",
                    "FOURTH: Check if proper notice was given per your state's law — most states require 3-30 days depending on the reason.",
                    "FIFTH: Do not withhold rent unless your attorney advises it — this can hurt your case.",
                    "SIXTH: Gather evidence — lease agreement, rent payment records, communication with landlord.",
                    "SEVENTH: Contact a tenant rights attorney or legal aid organization immediately.",
                    "EIGHTH: Attend any court hearing — if you don't show, the landlord wins by default.",
                ],
                "critical_warning": "You cannot be physically removed without a court order. Landlord changing locks or removing belongings without a court order is illegal.",
            },
        },
    },
    "doctor": {
        "keywords": [
            "chest pain","chest tightness","can't breathe","difficulty breathing","heart attack",
            "stroke symptoms","face drooping","arm weakness","slurred speech","sudden numbness",
            "overdose","took too many","drug overdose","unconscious","not breathing","choking",
            "severe allergic","anaphylaxis","epipen","throat closing","severe bleeding",
            "broken bone","bone sticking","deep cut","wound won't stop","head injury",
            "seizure","having a seizure","passed out","fainted","unresponsive",
        ],
        "protocols": {
            "heart_attack": {
                "title": "🚨 CARDIAC EMERGENCY PROTOCOL",
                "trigger_words": ["chest pain","chest tightness","heart attack"],
                "steps": [
                    "FIRST: Call 911 immediately. Do not drive yourself to the hospital.",
                    "SECOND: Chew one regular aspirin (325mg) or four baby aspirin (81mg each) unless allergic — this can reduce heart muscle damage.",
                    "THIRD: Sit or lie down in a comfortable position. Loosen tight clothing.",
                    "FOURTH: Unlock your front door so paramedics can enter.",
                    "FIFTH: Stay on the phone with 911. Follow their instructions exactly.",
                    "SIXTH: If the person loses consciousness and stops breathing — begin CPR if you are trained.",
                    "SEVENTH: Note the time symptoms started — doctors will need this information.",
                ],
                "critical_warning": "Every minute matters. Do NOT wait to see if symptoms improve. Call 911 now.",
            },
            "stroke": {
                "title": "🚨 STROKE PROTOCOL — FAST",
                "trigger_words": ["stroke symptoms","face drooping","arm weakness","slurred speech","sudden numbness"],
                "steps": [
                    "REMEMBER FAST: Face drooping, Arm weakness, Speech difficulty, Time to call 911.",
                    "FIRST: Call 911 immediately. Tell them you suspect a stroke.",
                    "SECOND: Note the exact time symptoms started — this determines treatment options.",
                    "THIRD: Do not give the person food, water, or medication.",
                    "FOURTH: Keep them calm and still. Lay them down with head slightly elevated.",
                    "FIFTH: Do not leave them alone.",
                ],
                "critical_warning": "Stroke treatment is time-critical. There is a 4.5-hour window for the most effective treatment.",
            },
            "overdose": {
                "title": "🚨 OVERDOSE PROTOCOL",
                "trigger_words": ["overdose","took too many","drug overdose","unconscious","not breathing"],
                "steps": [
                    "FIRST: Call 911 immediately. Most states have Good Samaritan laws protecting you from prosecution.",
                    "SECOND: If opioid overdose is suspected and Narcan (naloxone) is available — administer it now.",
                    "THIRD: Place the person in the recovery position — on their side to prevent choking.",
                    "FOURTH: Do not leave them alone.",
                    "FIFTH: If they stop breathing and you are trained — begin CPR.",
                    "SIXTH: Tell paramedics exactly what substances were taken and when if you know.",
                ],
                "critical_warning": "Do not try to make the person vomit. Do not give coffee or water. Stay with them until help arrives.",
            },
        },
    },
    "guardian": {
        "keywords": [
            "account hacked","i got hacked","someone hacked","my account was hacked",
            "identity stolen","identity theft","someone stole my identity","my ssn was stolen",
            "credit card stolen","unauthorized charges","fraud on my account",
            "ransomware","virus on my computer","malware","my computer is locked",
            "someone is in my account","suspicious login","unauthorized access",
            "my phone was stolen","lost my phone","phone stolen",
        ],
        "protocols": {
            "account_hacked": {
                "title": "🚨 ACCOUNT BREACH PROTOCOL",
                "trigger_words": ["account hacked","i got hacked","someone hacked","my account was hacked","someone is in my account","suspicious login","unauthorized access"],
                "steps": [
                    "FIRST: Change your password immediately from a different, trusted device.",
                    "SECOND: Enable two-factor authentication on the compromised account right now.",
                    "THIRD: Check your account's active sessions and log out all unknown devices.",
                    "FOURTH: Change passwords on any accounts using the same password.",
                    "FIFTH: Check your email for any forwarding rules the attacker may have set up.",
                    "SIXTH: Review recent account activity — note any changes to recovery email, phone number, or settings.",
                    "SEVENTH: Report the breach to the platform directly.",
                    "EIGHTH: If financial accounts are involved — call your bank's fraud line immediately.",
                ],
                "critical_warning": "Do not use the compromised device until it has been scanned for malware.",
            },
            "identity_theft": {
                "title": "🚨 IDENTITY THEFT PROTOCOL",
                "trigger_words": ["identity stolen","identity theft","someone stole my identity","my ssn was stolen"],
                "steps": [
                    "FIRST: Place a fraud alert with one of the three credit bureaus — Equifax, Experian, or TransUnion. They are required to notify the other two.",
                    "SECOND: Get your free credit reports at AnnualCreditReport.com and review for unauthorized accounts.",
                    "THIRD: Consider placing a credit freeze at all three bureaus — this prevents new accounts from being opened.",
                    "FOURTH: File a report at IdentityTheft.gov — this creates your official recovery plan.",
                    "FIFTH: File a police report with your local department and get the report number.",
                    "SIXTH: Contact any companies where fraud occurred — provide your FTC report and police report.",
                    "SEVENTH: Document everything — dates, names, reference numbers for every call and report.",
                ],
                "critical_warning": "Act within 24 hours. The faster you freeze credit and report, the less damage occurs.",
            },
            "financial_fraud": {
                "title": "🚨 FINANCIAL FRAUD PROTOCOL",
                "trigger_words": ["credit card stolen","unauthorized charges","fraud on my account"],
                "steps": [
                    "FIRST: Call your bank or credit card company's fraud line immediately — the number is on the back of your card.",
                    "SECOND: Request the card be frozen or cancelled and a new card issued.",
                    "THIRD: Dispute all unauthorized charges — you have zero liability protection under federal law for most fraud.",
                    "FOURTH: Change your online banking password and PIN from a trusted device.",
                    "FIFTH: Enable account alerts for all future transactions.",
                    "SIXTH: Monitor your account daily for the next 30 days.",
                    "SEVENTH: File a report with the FTC at ReportFraud.ftc.gov.",
                ],
                "critical_warning": "Report within 60 days to maintain full zero-liability protection.",
            },
        },
    },
    "mechanic": {
        "keywords": [
            "brake failure","brakes failed","brakes aren't working","can't stop","no brakes",
            "tire blowout","blew a tire","flat tire on highway","tire exploded",
            "car broke down","broke down on highway","stranded on road","engine died",
            "smoke coming from engine","car is smoking","engine overheating","overheated",
            "car won't start","dead battery on highway","out of gas on highway",
            "steering failed","lost steering","power steering gone",
        ],
        "protocols": {
            "brake_failure": {
                "title": "🚨 BRAKE FAILURE PROTOCOL",
                "trigger_words": ["brake failure","brakes failed","brakes aren't working","can't stop","no brakes"],
                "steps": [
                    "FIRST: Stay calm. Do not panic-steer.",
                    "SECOND: Pump the brake pedal rapidly — this can build hydraulic pressure in older brake systems.",
                    "THIRD: Downshift to a lower gear immediately to use engine braking to slow the vehicle.",
                    "FOURTH: Apply the emergency/parking brake slowly and steadily — do not yank it or you will spin.",
                    "FIFTH: Steer toward an uphill grade, gravel, or a guardrail if necessary to slow the vehicle.",
                    "SIXTH: Turn on hazard lights and honk to warn other drivers.",
                    "SEVENTH: Once stopped — do NOT drive the vehicle. Call a tow truck.",
                ],
                "critical_warning": "Never turn off the engine while moving — you will lose power steering and make control harder.",
            },
            "tire_blowout": {
                "title": "🚨 TIRE BLOWOUT PROTOCOL",
                "trigger_words": ["tire blowout","blew a tire","flat tire on highway","tire exploded"],
                "steps": [
                    "FIRST: Do NOT slam the brakes — this is the most dangerous instinct and will cause a spin.",
                    "SECOND: Grip the steering wheel firmly with both hands.",
                    "THIRD: Accelerate slightly for 2-3 seconds to stabilize the vehicle.",
                    "FOURTH: Gradually ease off the accelerator — let the car slow naturally.",
                    "FIFTH: Steer gently to the right shoulder. Do not make sharp turns.",
                    "SIXTH: Once safely off the road — turn on hazard lights.",
                    "SEVENTH: Stay in the vehicle if on a highway. Call roadside assistance.",
                ],
                "critical_warning": "Counter-intuitive but critical: brief acceleration after blowout stabilizes the vehicle before slowing.",
            },
            "overheating": {
                "title": "🚨 ENGINE OVERHEATING PROTOCOL",
                "trigger_words": ["smoke coming from engine","car is smoking","engine overheating","overheated"],
                "steps": [
                    "FIRST: Turn off the AC immediately — reduces engine load.",
                    "SECOND: Turn the heater to MAX heat and full fan — this pulls heat away from the engine.",
                    "THIRD: Pull over safely as soon as possible.",
                    "FOURTH: Turn off the engine. Do NOT open the hood immediately — wait 15 minutes.",
                    "FIFTH: Do NOT open the radiator cap — pressurized coolant will spray and burn you severely.",
                    "SIXTH: After 15-20 minutes, check coolant level only if the engine has cooled.",
                    "SEVENTH: Call a tow truck. Do not drive an overheated engine.",
                ],
                "critical_warning": "Driving an overheated engine can destroy it completely within minutes. Stop immediately.",
            },
        },
    },
    "wealth": {
        "keywords": [
            "account drained","bank account empty","someone drained","money stolen from account",
            "investment scam","lost my savings","ponzi scheme","crypto scam","wire fraud",
            "stock market crashed","portfolio crashed","margin call","lost everything",
            "irs audit","being audited","tax fraud","tax evasion accused",
            "bankruptcy","filing bankruptcy","can't pay debts","debt collector calling",
        ],
        "protocols": {
            "financial_emergency": {
                "title": "🚨 FINANCIAL EMERGENCY PROTOCOL",
                "trigger_words": ["account drained","bank account empty","someone drained","money stolen from account"],
                "steps": [
                    "FIRST: Call your bank's fraud line immediately — 24/7 number on the back of your card.",
                    "SECOND: Freeze all accounts that may be compromised.",
                    "THIRD: Document the unauthorized transactions with screenshots and amounts.",
                    "FOURTH: File a fraud report with your bank in writing — get a case number.",
                    "FIFTH: File a report with the FTC at ReportFraud.ftc.gov.",
                    "SIXTH: If wire transfer — act within 24 hours. Contact your bank to attempt a wire recall.",
                    "SEVENTH: Contact your state's financial regulator if the bank is unresponsive.",
                ],
                "critical_warning": "Wire transfers are very difficult to reverse after 24 hours. Speed is everything.",
            },
        },
    },
    "vitality": {
        "keywords": [
            "heat stroke","heat exhaustion","overheating outside","can't cool down","passed out from heat",
            "hypoglycemia","blood sugar crashed","diabetic emergency","shaking can't stop",
            "severe dehydration","can't keep water down","haven't eaten in days",
            "injured during workout","gym injury","pulled something serious","can't move my",
        ],
        "protocols": {
            "heat_emergency": {
                "title": "🚨 HEAT EMERGENCY PROTOCOL",
                "trigger_words": ["heat stroke","heat exhaustion","overheating outside","can't cool down","passed out from heat"],
                "steps": [
                    "FIRST: If the person is confused, not sweating despite heat, or unconscious — call 911. This is heat stroke, a life-threatening emergency.",
                    "SECOND: Move to a cool environment immediately — air conditioning or shade.",
                    "THIRD: Remove excess clothing.",
                    "FOURTH: Apply cool (not ice cold) water to skin, especially neck, armpits, and groin.",
                    "FIFTH: Fan the person to accelerate cooling.",
                    "SIXTH: If conscious and not nauseous — have them drink cool water slowly.",
                    "SEVENTH: Do not give aspirin or acetaminophen — they do not help heat emergencies.",
                ],
                "critical_warning": "Heat stroke (hot, dry skin, confusion) is a medical emergency. Do not wait. Call 911.",
            },
        },
    },
}


def detect_emergency(persona: str, message: str) -> tuple[dict | None, str | None]:
    """
    Scans message for emergency trigger keywords.
    Returns (protocol_dict, protocol_key) if emergency detected, else (None, None).
    """
    persona_emergencies = _EMERGENCY_TRIGGERS.get(persona)
    if not persona_emergencies:
        return None, None

    msg_lower = message.lower()

    # Check if any emergency keyword is present
    triggered = any(kw in msg_lower for kw in persona_emergencies["keywords"])
    if not triggered:
        return None, None

    # Find the specific protocol
    for protocol_key, protocol in persona_emergencies["protocols"].items():
        if any(kw in msg_lower for kw in protocol["trigger_words"]):
            return protocol, protocol_key

    # Fallback to first protocol if keyword matched but no specific protocol found
    first_key = list(persona_emergencies["protocols"].keys())[0]
    return persona_emergencies["protocols"][first_key], first_key


def build_emergency_response(protocol: dict, user_name: str, persona: str) -> dict:
    """
    Builds a step-by-step emergency response.
    Returns steps as structured list so frontend can show one step at a time
    with a 'Done — Next Step' button after each one.
    PDF only sends when user taps End Session — NOT auto-dispatched here.
    """
    name_display = _PERSONA_DISPLAY_NAMES.get(persona, persona.title())
    steps        = protocol.get("steps", [])
    warning      = protocol.get("critical_warning", "")

    # Build intro message — calm, clear, direct
    intro = (
        f"{user_name}, I've got you. Stay calm and follow these steps one at a time. "
        f"Tap **Done — Next Step** after you complete each one."
    )

    # Full text version (for PDF and fallback display)
    steps_text = "\n".join(
        f"**Step {i+1}:** {step}" for i, step in enumerate(steps)
    )
    answer = f"""{protocol['title']}

{intro}

{steps_text}

⚠️ {warning}

— {name_display}"""

    return {
        "answer":           answer,
        "confidence_score": 99,
        "scam_detected":    False,
        "threat_level":     "high",
        "action_trigger":   None,          # PDF only on End Session — not auto
        "model":            f"LYLO-EMERGENCY ({name_display})",
        "emergency":        True,
        "protocol_title":   protocol["title"],
        "emergency_steps":  steps,         # Structured list for step-by-step UI
        "emergency_warning": warning,
        "emergency_intro":  intro,
    }
