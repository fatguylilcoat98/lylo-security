"""
LYLO OS — backend/services/response_composer.py
================================================
Shared Response Composer: procedural variation for non-emergency content.

RULE: "Hard gates are deterministic. Soft language is procedural."

The composer runs AFTER all fortress inject() calls and BEFORE the LLM.
It injects a SHAPE INSTRUCTION into system_prompt so the LLM generates
natural language that follows a selected structure — not a script.

Hard gates (crisis, therapist RED, guardian incident banks) are detected via
override flags passed in from inject_fortress(). If ANY hard gate is active,
the composer returns an empty shape_instruction and stands down completely.

Returns:
    {
        "shape_instruction": str,    # appended to system_prompt (empty if gated out)
        "used_shape_id":    str,     # e.g. "doctor_symptom_consult_v3"
        "used_slots":       dict,    # {"opener": "...", "bridge": "...", "closer": "..."}
        "evidence_sources": list,    # list of dicts [{title, domain, url}] extracted from tavily
        "gated_out":        bool,    # True = hard gate active, composer stood down
        "gate_reason":      str,     # which gate triggered the stand-down
    }
"""

import re
import time
import random
import hashlib
import logging
from typing import Optional

logger = logging.getLogger("LYLO.Composer")

# ═════════════════════════════════════════════════════════════════════════════
# ANTI-REPEAT CACHE
# Keyed by "user_id:persona" — stores list of recently used shape_ids.
# ═════════════════════════════════════════════════════════════════════════════

_COMPOSER_CACHE: dict = {}   # key -> {"ts": float, "shapes": [str], "slots": [str]}
_COMPOSER_TTL   = 60 * 60    # 1 hour window for anti-repeat
_REPEAT_WINDOW  = 5          # don't reuse same shape within last N turns


def _composer_key(user_id: str, persona: str) -> str:
    return hashlib.md5(f"{user_id}:{persona}".encode()).hexdigest()[:16]


def _get_recent_shapes(user_id: str, persona: str) -> list:
    key = _composer_key(user_id, persona)
    entry = _COMPOSER_CACHE.get(key)
    if not entry or (time.monotonic() - entry["ts"]) > _COMPOSER_TTL:
        return []
    return entry["shapes"][-_REPEAT_WINDOW:]


def _record_used(user_id: str, persona: str, shape_id: str, slot_key: str):
    key = _composer_key(user_id, persona)
    now = time.monotonic()
    entry = _COMPOSER_CACHE.get(key)
    if not entry or (now - entry["ts"]) > _COMPOSER_TTL:
        _COMPOSER_CACHE[key] = {"ts": now, "shapes": [shape_id], "slots": [slot_key]}
    else:
        entry["shapes"].append(shape_id)
        entry["shapes"] = entry["shapes"][-20:]
        entry["slots"].append(slot_key)
        entry["slots"] = entry["slots"][-20:]
        entry["ts"] = now
    # Prune cache if too large
    if len(_COMPOSER_CACHE) > 1000:
        cutoff = now - _COMPOSER_TTL
        stale = [k for k, v in _COMPOSER_CACHE.items() if v["ts"] < cutoff]
        for k in stale:
            del _COMPOSER_CACHE[k]


def _pick_shape(shapes: list, recent_shapes: list) -> dict:
    """Weighted selection: penalize recently used shapes, never pick if used in last 3."""
    HARD_BLOCK = 3   # never pick if used this recently
    candidates = []
    for s in shapes:
        sid = s["id"]
        recency = recent_shapes.count(sid)
        if recency >= HARD_BLOCK:
            continue
        weight = max(1, 10 - (recency * 4))  # decay: 10, 6, 2
        candidates.extend([s] * weight)
    if not candidates:
        candidates = shapes  # fallback: all shapes eligible
    return random.choice(candidates)


# ═════════════════════════════════════════════════════════════════════════════
# SLOT BANKS — openers, bridges, closers (shared + persona-specific)
# ═════════════════════════════════════════════════════════════════════════════

_SLOT_BANKS_EN = {
    "opener": [
        "Okay, so —",
        "Right —",
        "Let me be real with you.",
        "Here's what I'm thinking:",
        "That's worth taking seriously.",
        "Got it —",
        "Alright, let's work through this.",
        "Let me give you something useful here.",
    ],
    "bridge": [
        "Here's the thing:",
        "What I'd say is —",
        "The honest take:",
        "Real talk:",
        "Here's what matters most:",
        "The short version:",
        "What you need to know:",
        "Breaking it down —",
    ],
    "closer": [
        "What feels most urgent to you right now?",
        "Does that give you a direction to move in?",
        "What's the one thing you want to tackle first?",
        "What are you thinking after hearing that?",
        "Is there a specific part of this you want to dig into?",
        "What's your situation look like from there?",
        "Does that land for you?",
        "What's your next move feeling like?",
    ],
    "opener_es": [
        "Bien, entonces —",
        "Claro —",
        "Te voy a ser directo.",
        "Esto es lo que pienso:",
        "Vale la pena tomarlo en serio.",
        "Entendido —",
        "Bueno, vamos a trabajar esto.",
        "Déjame darte algo útil aquí.",
    ],
    "bridge_es": [
        "Lo importante es esto:",
        "Lo que yo diría es —",
        "Siendo honesto:",
        "Sin rodeos:",
        "Lo que más importa:",
        "La versión corta:",
        "Lo que necesitas saber:",
        "Para desglosarlo —",
    ],
    "closer_es": [
        "¿Qué se siente más urgente para ti ahora mismo?",
        "¿Eso te da una dirección a seguir?",
        "¿Cuál es la primera cosa que quieres resolver?",
        "¿Qué estás pensando después de escuchar eso?",
        "¿Hay alguna parte específica de esto que quieras profundizar?",
        "¿Cómo se ve tu situación desde ahí?",
        "¿Tiene sentido para ti?",
        "¿Cómo se siente tu próximo paso?",
    ],
}

# Persona-specific metaphor/flavor slots
_PERSONA_FLAVOR = {
    "doctor":    ["Think of it like your body sending a signal.", "This is your system giving you a heads-up.", "Your body's been talking — let's listen."],
    "lawyer":    ["The law isn't always obvious here.", "There's a real difference between what's legal and what's smart.", "Your rights matter — let's make sure you know them."],
    "wealth":    ["Money decisions compound over time.", "The numbers tell a story here.", "This is about building something solid, not just today."],
    "guardian":  ["Scammers count on people not knowing this.", "The pattern is consistent — here's what it means.", "Your instincts brought you here — that's already smart."],
    "mechanic":  ["Cars talk when they're unhappy.", "This is your vehicle giving you a warning.", "Most shops won't tell you this upfront."],
    "therapist": ["Your nervous system is doing exactly what it's built to do.", "This isn't weakness — it's information.", "What you're feeling has a name."],
    "vitality":  ["Your body adapts to what you consistently do.", "Small inputs, compounding outputs.", "Sustainable beats perfect every time."],
    "career":    ["Leverage matters more than effort at this stage.", "Most people miss this positioning piece.", "Your work history already tells a story — let's shape it."],
    "tutor":     ["Once you see the pattern, it clicks.", "The trick is finding the right frame.", "Most people learn this the hard way — you don't have to."],
    "pastor":    ["Faith doesn't remove the weight — it changes how you carry it.", "There's language for what you're feeling, even when it's hard to name.", "You don't have to carry this alone."],
    "hype":      ["The algorithm rewards one thing above all else.", "Most creators skip the foundation.", "Your authentic angle is your unfair advantage."],
    "bestie":    ["I hear you, and I see what's actually going on here.", "You're not wrong for feeling this way.", "Let's cut through the noise."],
}


# ═════════════════════════════════════════════════════════════════════════════
# RESPONSE SHAPES — 8–10 per persona
# Each shape is a structural directive for the LLM, not a script.
# The LLM fills in all actual language.
# ═════════════════════════════════════════════════════════════════════════════

_SHAPES: dict[str, list] = {

    "doctor": [
        {"id": "doctor_symptom_consult",    "structure": "Acknowledge what they described in one human sentence → Explain what's likely happening in 1-2 plain sentences → Give 2-3 concrete things they can do or watch for → Close with one check-in question about their situation."},
        {"id": "doctor_medication_brief",   "structure": "Answer the medication question directly first → Add one important safety note or interaction to be aware of → Recommend one verification step (pharmacist/doctor) → Ask if they have other concerns about it."},
        {"id": "doctor_when_to_act",        "structure": "Acknowledge their concern → Give a clear signal: 'If X happens, act immediately; if Y, watch and wait' → Explain why that threshold matters → Ask what symptoms they're tracking."},
        {"id": "doctor_reassure_and_guide", "structure": "Start by normalizing what they're experiencing → Explain the most common explanation in plain terms → Give 1-2 low-effort actions they can take at home → End with one signal that would change the picture."},
        {"id": "doctor_chronic_context",    "structure": "Connect what they're describing to their broader health context → Address the specific question → Give realistic expectations (timeline/outcome) → Ask about their current management approach."},
        {"id": "doctor_urgent_triage",      "structure": "Lead with the urgency level clearly stated → Give the single most important action → Explain why quickly → Ask one clarifying question about severity."},
        {"id": "doctor_prevention_framing", "structure": "Answer the direct question → Pivot to the prevention angle — what keeps this from getting worse → Give one habit or action that makes a real difference → Ask what their current baseline looks like."},
        {"id": "doctor_plain_explanation",  "structure": "Explain the mechanism or term in plain language with no jargon → Connect it to what they're actually experiencing → Give a practical takeaway → Ask if they want more detail on any part."},
    ],

    "lawyer": [
        {"id": "lawyer_rights_brief",       "structure": "State what their legal situation actually is in one sentence — no hedging → Explain the key rule or right that applies → Give 1-2 concrete actions they should or shouldn't take → Flag any jurisdiction-specific nuance."},
        {"id": "lawyer_risk_map",           "structure": "Acknowledge the concern → Map the risk clearly: best case / likely case / worst case → Tell them what factor determines which way it goes → Ask what they've already done or documented."},
        {"id": "lawyer_action_first",       "structure": "Lead with the single most important thing they should do or not do right now → Explain why that matters legally → Give the second step → Ask about their timeline."},
        {"id": "lawyer_know_your_rights",   "structure": "Name the right that's in play → Explain what it means practically → Say what someone can and cannot legally do in this situation → Ask if they've been given anything in writing."},
        {"id": "lawyer_contract_breakdown", "structure": "Identify the contract issue directly → Explain what it means in plain terms → Flag the clause or provision that matters most → Tell them the one thing to look for or ask about."},
        {"id": "lawyer_tenant_landlord",    "structure": "State what the law says about their situation in their state → Give their specific rights or obligations → Tell them what their landlord can and cannot legally do → Give the one concrete move that protects them."},
        {"id": "lawyer_documentation",      "structure": "Answer the legal question → Pivot immediately to documentation: what to save, write down, or send → Explain why that paper trail matters → Ask what they have so far."},
        {"id": "lawyer_criminal_civil",     "structure": "Distinguish criminal vs civil exposure clearly if relevant → Address their specific situation → Tell them what this means practically for their next steps → Flag if they need a licensed attorney in the loop."},
    ],

    "wealth": [
        {"id": "wealth_number_first",       "structure": "Give the number or threshold they asked about directly → Put it in context (why it matters, what changes at that point) → Give one action tied to that number → Ask about their current position."},
        {"id": "wealth_tax_move",           "structure": "Answer the tax question directly → Explain the mechanism in plain terms → Give the one move that makes the most difference → Flag the deadline or trigger date if one exists."},
        {"id": "wealth_invest_frame",       "structure": "Acknowledge where they are → Give the core principle at play here, not a product recommendation → Explain the tradeoff → Ask what their timeline and risk comfort look like."},
        {"id": "wealth_debt_priority",      "structure": "Acknowledge the pressure → Give a clear debt priority framework for their situation → Explain the math or logic briefly → Ask what their highest-rate obligation is."},
        {"id": "wealth_retirement_check",   "structure": "Give the relevant contribution limit or rule → Compare to what's typical for their situation → Suggest one optimization → Ask what accounts they're currently using."},
        {"id": "wealth_emergency_baseline", "structure": "Set the baseline expectation clearly → Explain why that number → Connect it to their specific risk factors → Ask about their current cushion."},
        {"id": "wealth_credit_score",       "structure": "Explain what's actually driving the number → Give the highest-leverage thing they can do to move it → Set a realistic timeframe → Ask what their biggest credit event has been."},
        {"id": "wealth_fee_audit",          "structure": "Name the fee or cost they should be paying attention to → Explain how it compounds over time → Give a concrete comparison → Ask what they're currently paying for."},
    ],

    "guardian": [
        {"id": "guardian_scam_pattern",     "structure": "Name what kind of scam this looks like in plain terms → Explain the specific red flag that makes it that → Give 1-2 immediate protective actions → Ask what contact has already happened."},
        {"id": "guardian_verify_first",     "structure": "Validate the concern without adding panic → Tell them the single most important thing to verify before doing anything → Explain how to verify it safely → Ask what they've already done."},
        {"id": "guardian_data_exposure",    "structure": "Assess the exposure level honestly → Explain what can and can't be done with that information → Give the priority action to limit damage → Ask if they've gotten any unusual account activity."},
        {"id": "guardian_account_secure",   "structure": "Acknowledge the threat → Give the account security steps in priority order → Explain the one step most people skip → Ask which accounts are highest risk."},
        {"id": "guardian_social_engineer",  "structure": "Name the social engineering tactic being used → Explain why it works on almost everyone → Give the one rule that stops it cold → Ask what information they've already shared."},
        {"id": "guardian_romance_scam",     "structure": "Approach with care, no judgment → Explain the pattern clearly → Give the one verifiable test that reveals intent → Ask how long the contact has been going."},
        {"id": "guardian_family_target",    "structure": "Acknowledge this hits close to home → Explain why family members are specifically targeted → Give a concrete intervention approach → Ask if the family member is aware of the concern."},
        {"id": "guardian_already_sent",     "structure": "No blame — acknowledge what happened → Tell them what can and can't be recovered in this specific scenario → Give the immediate protective steps → Ask what payment method was used."},
    ],

    "mechanic": [
        {"id": "mechanic_symptom_read",     "structure": "Name what the symptom most likely means in plain terms → Give the urgency level: drive it / watch it / park it → Explain what happens if it's left unaddressed → Ask year/make/model for specifics."},
        {"id": "mechanic_cost_frame",       "structure": "Give a realistic cost range for what they're describing → Break down what you're paying for (parts vs labor) → Name the one thing that can spike the price → Ask if they've gotten a quote yet."},
        {"id": "mechanic_diy_check",        "structure": "Assess if this is something they can verify or fix themselves → Give the specific thing to check first → Explain what they'll find if the diagnosis is right → Say when it crosses into shop territory."},
        {"id": "mechanic_dealer_vs_shop",   "structure": "Give an honest take on dealer vs independent for this specific job → Explain what matters for this repair → Give a selection criterion → Ask if they're still under warranty."},
        {"id": "mechanic_buying_advice",    "structure": "Anchor to what matters most for this specific vehicle/type → Give 1-2 specific things to check or test drive for → Name the one thing sellers hide → Ask what their use case and budget look like."},
        {"id": "mechanic_maintenance",      "structure": "Give the maintenance interval or spec directly → Explain what goes wrong when it's skipped → Rank the priority vs other upcoming items → Ask what their last service was."},
        {"id": "mechanic_warning_light",    "structure": "Name what that light most commonly means → Give the urgency: drive to shop now / finish the trip / get it scanned this week → Explain what the scan will show → Ask if anything else feels off."},
        {"id": "mechanic_second_opinion",   "structure": "Validate that a second opinion is smart → Give the specific question they should ask the second shop → Explain what a legitimate repair estimate includes → Ask what the first shop said exactly."},
    ],

    "therapist": [
        {"id": "therapist_window_open",     "structure": "Name what they're experiencing without labeling it — just reflect → Offer one small grounding anchor (breath, feet on floor, noticing the room) → Ask one focused question that opens the window a little wider."},
        {"id": "therapist_pattern_name",    "structure": "Gently name the pattern you're noticing without judgment → Connect it to what they've shared → Offer one frame that might fit → Ask if that resonates."},
        {"id": "therapist_validation",      "structure": "Validate what they're feeling fully — no rush to fix → Normalize it without dismissing it → Offer one small reframe → Ask what support looks like to them right now."},
        {"id": "therapist_skill_offer",     "structure": "Acknowledge where they are → Offer a specific skill from the vetted library → Explain it in one sentence → Give the option to try it right now or talk more first."},
        {"id": "therapist_parts_work",      "structure": "Reflect the tension you're hearing — two parts that seem to want different things → Name each part with care → Ask which one feels loudest right now."},
        {"id": "therapist_somatic_check",   "structure": "Invite them to notice the body — no pressure → Name a common place this feeling lives in the body → Ask what they notice there → Follow wherever that goes."},
        {"id": "therapist_explore_gently",  "structure": "Ask one open, curious question about the situation → Follow the thread they pull → Reflect back what you heard → Ask what feels most true about that."},
        {"id": "therapist_session_close",   "structure": "Name something that shifted or emerged in this conversation → Offer one thing to carry → Ask what they're taking with them."},
    ],

    "vitality": [
        {"id": "vitality_habit_anchor",     "structure": "Acknowledge their goal → Identify the smallest version of the habit that still works → Explain the anchor it can attach to → Ask what their current routine looks like."},
        {"id": "vitality_nutrition_direct", "structure": "Answer the nutrition question directly without oversimplifying → Give the practical application for their stated goal → Flag one common mistake → Ask what a typical day of eating looks like for them."},
        {"id": "vitality_movement_scale",   "structure": "Scale the recommendation to where they actually are, not where they should be → Give something specific and doable this week → Explain the adaptation signal to look for → Ask what their biggest barrier has been."},
        {"id": "vitality_recovery_frame",   "structure": "Reframe recovery as part of the work, not a break from it → Give the one recovery input that moves the needle most → Explain why → Ask how their sleep and stress look right now."},
        {"id": "vitality_sustainable",      "structure": "Address the approach they mentioned → Give the sustainable version of it → Explain the difference in outcome over time → Ask what's driven the approach they've been taking."},
        {"id": "vitality_momentum",         "structure": "Name what's working in what they described → Build on that specifically → Add one thing → Keep the complexity low → Ask what feels doable to start."},
        {"id": "vitality_body_signal",      "structure": "Take the physical signal seriously → Explain what it most commonly means in context → Give the home-response first → Flag when it's worth a professional opinion."},
        {"id": "vitality_mindset_shift",    "structure": "Name the framing that might be working against them → Offer a reframe that's accurate and useful → Give one concrete way to apply it → Ask what would change if that reframe stuck."},
    ],

    "career": [
        {"id": "career_position_first",     "structure": "Name their positioning challenge directly → Give the reframe or pivot that creates leverage → Make it concrete with a specific example or action → Ask what their current narrative sounds like."},
        {"id": "career_negotiation",        "structure": "Acknowledge the stakes → Give the one principle that changes most negotiations → Tell them the specific thing to say or not say → Ask what information they have about the range."},
        {"id": "career_job_search",         "structure": "Assess the strategy they're using → Give the highest-leverage channel for their situation → Explain what makes the difference at this stage → Ask what's working and what isn't."},
        {"id": "career_workplace_tension",  "structure": "Acknowledge the situation without judgment → Give the read on what's actually happening → Offer the strategic move, not just the emotional one → Ask what outcome they're actually trying to get."},
        {"id": "career_skill_gap",          "structure": "Name the gap honestly → Prioritize: what closes it fastest, not most completely → Give a specific path or resource → Ask what timeline they're working with."},
        {"id": "career_decision_frame",     "structure": "Name the real tradeoff at the center of the decision → Give the framework they should apply → Walk through it with their situation → Ask what's making them hesitate."},
        {"id": "career_brand_voice",        "structure": "Identify what makes their angle distinct → Give the one thing to lead with → Explain how to make it visible → Ask where they're trying to show up most."},
        {"id": "career_promotion_path",     "structure": "Assess where they are in the political and performance landscape → Identify the gap between doing the job and being seen for it → Give the one move that changes the visibility → Ask who the decision-makers are."},
    ],

    "tutor": [
        {"id": "tutor_build_up",            "structure": "Start from what they already know → Build the new concept on that foundation → Use one concrete example or analogy → Ask what part is still fuzzy."},
        {"id": "tutor_misconception_fix",   "structure": "Identify the misconception gently → Explain what's actually true → Show why it's easy to get confused → Give the cleaner mental model to use going forward."},
        {"id": "tutor_worked_example",      "structure": "Work a specific example step by step → Name what you're doing at each step → Point to the pattern behind it → Give them a slightly different version to try."},
        {"id": "tutor_why_it_matters",      "structure": "Answer the 'what' first → Explain the 'why this exists' in real terms → Connect it to something they've already encountered → Ask what context they're learning this in."},
        {"id": "tutor_break_it_down",       "structure": "Take the complex thing and split it into parts → Explain the easiest part first → Show how the parts connect → Ask which part they want to go deeper on."},
        {"id": "tutor_test_their_model",    "structure": "Ask one probing question to see what they understand → Build on what they get right → Gently correct the gap → Confirm with a follow-up question."},
        {"id": "tutor_study_strategy",      "structure": "Acknowledge what they're working on → Give the most effective approach for that type of content → Explain why most study methods don't work → Ask what's been tried already."},
        {"id": "tutor_shortcut",            "structure": "Give the pattern or shortcut that actually works → Explain when to use it and when not to → Anchor it to something familiar → Ask if it clicks."},
    ],

    "pastor": [
        {"id": "pastor_presence_first",     "structure": "Sit with what they brought for a moment — don't rush to the answer → Reflect what you heard spiritually → Offer one piece of Scripture or wisdom that speaks to it → Ask what resonates."},
        {"id": "pastor_doubt_honored",      "structure": "Honor the doubt — don't rush past it → Share that doubt lives inside genuine faith, not outside it → Offer one place in Scripture where this exact wrestling happens → Ask what they're really asking underneath the question."},
        {"id": "pastor_grief_held",         "structure": "Hold the grief first — nothing to fix → Name what's been lost → Offer one truth that doesn't remove the pain but can bear it → Ask what they need most right now."},
        {"id": "pastor_practical_faith",    "structure": "Connect the spiritual to the concrete situation they're in → Give one action that expresses faith rather than just feeling it → Anchor it to a truth → Ask what step feels possible."},
        {"id": "pastor_community",          "structure": "Name the isolation or connection they described → Point to the theology of community without making it a lecture → Give one concrete way to move toward others → Ask who's in their circle right now."},
        {"id": "pastor_decision_discern",   "structure": "Acknowledge the weight of the decision → Offer the discernment question to sit with → Give one principle that applies → Ask what they've already heard in the quiet."},
        {"id": "pastor_spiritual_dry",      "structure": "Normalize the dry season — it's universal → Name what's often happening underneath it → Give one small practice that keeps the door open → Ask how long it's felt this way."},
        {"id": "pastor_identity",           "structure": "Reflect the identity question back with care → Anchor it in a truth about who they are, not what they do → Offer one Scripture that speaks to that → Ask what they're building their sense of self on."},
    ],

    "hype": [
        {"id": "hype_content_angle",        "structure": "Name the angle that will actually cut through for their specific audience → Explain why it works → Give a specific format or hook structure → Ask what platform they're prioritizing."},
        {"id": "hype_algorithm_truth",      "structure": "Give the honest algorithm reality for their platform → Explain what actually signals quality to the platform → Give the one thing to optimize for → Ask what their current posting cadence is."},
        {"id": "hype_audience_build",       "structure": "Identify the audience gap they described → Give the positioning move that fills it → Explain the content type that builds that audience fastest → Ask what their niche or angle is."},
        {"id": "hype_repurpose",            "structure": "Assess what they have → Show the highest-leverage repurpose → Give the specific transformation (long → short, text → visual, etc.) → Ask what content bank they're sitting on."},
        {"id": "hype_monetize",             "structure": "Name the monetization path that fits their current stage → Explain the sequence: audience first, then offer → Give the one thing to build or validate before launching → Ask what their current audience size or engagement looks like."},
        {"id": "hype_collaboration",        "structure": "Assess the collaboration opportunity honestly → Give the criteria for a good collab at their stage → Explain the ask that works vs the one that gets ignored → Ask what they're hoping to get from it."},
        {"id": "hype_analytics_read",       "structure": "Read the data point they mentioned honestly → Explain what it actually means vs what people assume → Give the one metric to prioritize instead → Ask what behavior they want more of from their audience."},
        {"id": "hype_burnout_strategy",     "structure": "Acknowledge the volume pressure without dismissing it → Give the minimum viable content strategy that keeps momentum → Explain the compounding logic → Ask what they'd cut first if they had to."},
    ],

    "bestie": [
        {"id": "bestie_hear_first",         "structure": "Hear them fully — don't jump to advice → Reflect back what you heard, including the feeling → Ask one question that shows you really got it → Wait to advise until they feel understood."},
        {"id": "bestie_honest_take",        "structure": "Give the honest take they probably need, not the comfortable one → Do it with warmth, not harshness → Back it with one observation from what they've shared → Ask if that's landing right."},
        {"id": "bestie_perspective",        "structure": "Reframe the situation from a different angle → Explain why that angle changes things → Give one question to sit with → Ask what they'd say to a friend in this exact spot."},
        {"id": "bestie_action_mode",        "structure": "Match their energy — they want to move, not process → Give the clearest next action → Explain the one reason it's the right move → Ask what's stopping them."},
        {"id": "bestie_relationship_read",  "structure": "Give a real read on the dynamic they described → Name what pattern you're seeing → Give the one thing that would change the dynamic → Ask what they actually want here."},
        {"id": "bestie_celebrate",          "structure": "Celebrate what they did without immediately pivoting to the next thing → Name specifically what was hard about it → Ask how it feels → Then ask what's next when they're ready."},
        {"id": "bestie_stuck_place",        "structure": "Acknowledge the stuck feeling without trying to fix it immediately → Ask what's actually underneath the stuck → Reflect what you hear → Offer one small move that doesn't require being unstuck first."},
        {"id": "bestie_venting",            "structure": "Let them vent fully — don't interrupt → Validate without co-signing anything problematic → When they pause, name one thing you heard clearly → Ask if they want a take or just to be heard."},
    ],
}


# ═════════════════════════════════════════════════════════════════════════════
# EVIDENCE INJECTOR
# Converts raw VERIFIED EVIDENCE block into 1-3 prose sentences
# for the LLM to use naturally, not as bullet citations.
# ═════════════════════════════════════════════════════════════════════════════

_SOURCE_PATTERN = re.compile(
    r"•\s+(.+?)\(([^)]+)\)\s+—\s+(.+?)(?:\[([^\]]+)\])?(?=\n|$)",
    re.DOTALL
)
_SUMMARY_PATTERN = re.compile(r"Summary:\s*(.+?)(?=\n|$)", re.DOTALL)


def _extract_evidence(tavily_context: str) -> tuple[str, list]:
    """
    Converts VERIFIED EVIDENCE block into:
    - prose_summary: 1-3 sentences for LLM injection (no bullets)
    - sources: list of {title, domain, url} for debug metadata
    """
    if not tavily_context or "VERIFIED EVIDENCE" not in tavily_context:
        return "", []

    sources = []
    sentences = []

    # Extract summary line
    summary_match = _SUMMARY_PATTERN.search(tavily_context)
    if summary_match:
        sentences.append(summary_match.group(1).strip().rstrip("…").strip(".") + ".")

    # Extract bullet sources
    for match in _SOURCE_PATTERN.finditer(tavily_context):
        title   = match.group(1).strip()
        domain  = match.group(2).strip()
        snippet = match.group(3).strip().rstrip("…").strip(".") + "."
        url     = (match.group(4) or "").strip()
        sources.append({"title": title, "domain": domain, "url": url})
        if len(sentences) < 3:
            sentences.append(snippet)

    if not sentences:
        return "", sources

    prose = " ".join(sentences[:3])
    return prose, sources


# ═════════════════════════════════════════════════════════════════════════════
# HARD GATE DETECTION
# Reads override dicts from inject_fortress() to determine if a hard gate
# is active. If any gate is active, composer stands down.
# ═════════════════════════════════════════════════════════════════════════════

def _detect_hard_gate(
    persona:              str,
    guardian_overrides:   dict,
    therapist_overrides:  dict,
    mechanic_overrides:   dict,
    pastor_overrides:     dict,
) -> tuple[bool, str]:
    """
    Returns (gated_out: bool, reason: str).
    True means a deterministic gate is active — composer must stand down.
    """
    # Guardian: incident-specific banks, directive banks, or fail-safe
    if persona == "guardian":
        if guardian_overrides.get("directive"):
            return True, "guardian_directive"
        if guardian_overrides.get("failsafe"):
            return True, "guardian_failsafe"
        # Any incident-specific response key means a hardcoded bank is firing
        _incident_keys = {"money", "remote_access", "otp", "account_takeover",
                          "credentials", "phishing_click"}
        if any(k in guardian_overrides for k in _incident_keys):
            return True, f"guardian_incident:{list(guardian_overrides.keys())}"

    # Therapist: RED tolerance, directive, CLOSE phase
    if persona == "therapist":
        if therapist_overrides.get("tolerance") == "RED":
            return True, "therapist_RED"
        if therapist_overrides.get("directive"):
            return True, "therapist_directive"
        if therapist_overrides.get("phase") == "CLOSE":
            return True, "therapist_CLOSE"
        if therapist_overrides.get("skill_gate"):
            return True, "therapist_skill_gate"

    # Mechanic: safety-4 (don't drive) responses
    if persona == "mechanic":
        if mechanic_overrides.get("safety4"):
            return True, "mechanic_safety4"

    # Pastor: emergency weight-4 (suicidal/crisis) gate
    if persona == "pastor":
        if pastor_overrides.get("emergency"):
            return True, "pastor_emergency"

    return False, ""


# ═════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═════════════════════════════════════════════════════════════════════════════

def compose_response_shape(
    persona:             str,
    msg:                 str,
    user_id:             str,
    lang:                str                 = "en",
    tavily_context:      str                 = "",
    guardian_overrides:  Optional[dict]      = None,
    therapist_overrides: Optional[dict]      = None,
    mechanic_overrides:  Optional[dict]      = None,
    pastor_overrides:    Optional[dict]      = None,
) -> dict:
    """
    Select a response shape + slots for this turn and return a system-prompt
    injection block plus debug metadata.

    Call site in chat_router.py:
        _composer = compose_response_shape(
            persona=persona, msg=msg, user_id=user_id, lang=lang,
            tavily_context=tavily_context,
            guardian_overrides=_guardian_overrides,
            therapist_overrides=_therapist_overrides,
            mechanic_overrides=_mechanic_overrides,
            pastor_overrides=_pastor_overrides,
        )
        if _composer["shape_instruction"]:
            system_prompt += f"\\n\\n{_composer['shape_instruction']}"
    """
    _empty = {
        "shape_instruction": "",
        "used_shape_id":     "",
        "used_slots":        {},
        "evidence_sources":  [],
        "gated_out":         False,
        "gate_reason":       "",
    }

    # ── Hard gate check ───────────────────────────────────────────────────────
    gated, gate_reason = _detect_hard_gate(
        persona              = persona,
        guardian_overrides   = guardian_overrides  or {},
        therapist_overrides  = therapist_overrides or {},
        mechanic_overrides   = mechanic_overrides  or {},
        pastor_overrides     = pastor_overrides    or {},
    )
    if gated:
        logger.debug(f"🎨 Composer standing down [{persona}] — gate: {gate_reason}")
        return {**_empty, "gated_out": True, "gate_reason": gate_reason}

    # ── Get shapes for this persona ───────────────────────────────────────────
    shapes = _SHAPES.get(persona)
    if not shapes:
        logger.debug(f"🎨 Composer: no shapes for persona '{persona}' — skipping")
        return _empty

    # ── Select shape (anti-repeat weighted) ──────────────────────────────────
    recent = _get_recent_shapes(user_id, persona)
    shape  = _pick_shape(shapes, recent)

    # ── Select slots ─────────────────────────────────────────────────────────
    is_es   = lang == "es"
    opener  = random.choice(_SLOT_BANKS_EN["opener_es" if is_es else "opener"])
    bridge  = random.choice(_SLOT_BANKS_EN["bridge_es" if is_es else "bridge"])
    closer  = random.choice(_SLOT_BANKS_EN["closer_es" if is_es else "closer"])
    flavor  = random.choice(_PERSONA_FLAVOR.get(persona, [""]))

    slots = {"opener": opener, "bridge": bridge, "closer": closer, "flavor": flavor}
    slot_key = f"{shape['id']}:{opener[:10]}"

    # ── Evidence injection ────────────────────────────────────────────────────
    evidence_prose, evidence_sources = _extract_evidence(tavily_context)

    # ── Build shape instruction ───────────────────────────────────────────────
    lines = [
        "── RESPONSE SHAPE (follow this structure, fill with your voice) ──",
        f"Structure:  {shape['structure']}",
        f"Opener cue: Start with something in the spirit of: '{opener}'",
        f"Bridge cue: Use something like: '{bridge}'",
        f"Closer cue: End with something like: '{closer}'",
    ]
    if flavor:
        lines.append(f"Tone note:  {flavor}")
    if evidence_prose:
        lines.append(
            f"Evidence:   Weave this in naturally (do not bullet-list it, "
            f"paraphrase in your voice): {evidence_prose}"
        )
    lines.append(
        "Reminder:   These are structural cues, not a script. "
        "The exact words must be yours — warm, human, in your persona voice."
    )
    lines.append("──────────────────────────────────────────────────────────")

    shape_instruction = "\n".join(lines)

    # ── Record to anti-repeat cache ───────────────────────────────────────────
    _record_used(user_id, persona, shape["id"], slot_key)

    logger.info(
        f"🎨 Composer [{persona}] shape={shape['id']} "
        f"opener='{opener[:20]}' evidence_sources={len(evidence_sources)}"
    )

    return {
        "shape_instruction": shape_instruction,
        "used_shape_id":     shape["id"],
        "used_slots":        slots,
        "evidence_sources":  evidence_sources,
        "gated_out":         False,
        "gate_reason":       "",
    }
