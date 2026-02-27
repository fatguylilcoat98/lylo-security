#!/usr/bin/env python3
# =============================================================================
# LYLO OS — personality.py
# Mission copy maps (hooks, roadblocks, vibe tones) and the GPT-4o-mini
# push payload generator.
# =============================================================================

import json
import random

from openai import AsyncOpenAI

from .config import log


# =============================================================================
# GOAL → MISSION COPY MAPS
# =============================================================================
# Self-sabotage interrupt templates the AI personalises from.
# Structured as: mission_value → list of interrupt hooks (AI picks + adapts one)

MISSION_INTERRUPT_HOOKS = {
    "build_wealth": [
        "Every day you're not working the plan is a day compounding works against you.",
        "Your future self is watching what you do today with the same money situation.",
        "The wealth gap doesn't close itself. What's the one move you're avoiding?",
    ],
    "protect_family": [
        "The people depending on you don't get a day off. Neither does your preparation.",
        "Protection isn't a feeling — it's a decision made before the crisis hits.",
        "What's one thing you'd regret not having done if something happened tomorrow?",
    ],
    "career_growth": [
        "The competition isn't taking the day off. What are you doing with yours?",
        "Career momentum is either building or decaying. There's no neutral gear.",
        "One hour of focused work today beats ten hours of catching up next week.",
    ],
    "health_wellness": [
        "Your body is either getting stronger or weaker right now. Which is it?",
        "The version of you that skips today makes tomorrow's you work twice as hard.",
        "Consistency is the only variable you actually control. Use it.",
    ],
    "legal_financial": [
        "Ignoring a legal or financial issue never makes it smaller — only more expensive.",
        "The clock is running on your situation. Inaction is a decision with consequences.",
        "What would your advocate tell you to do first thing today?",
    ],
    "personal_growth": [
        "Comfort zones don't expand on their own. What are you avoiding right now?",
        "The gap between who you are and who you want to be is exactly the size of your avoidance.",
        "Growth isn't scheduled. It's chosen — right now, or it isn't.",
    ],
}

ROADBLOCK_CALLOUTS = {
    "money":         "The money situation doesn't improve by ignoring it.",
    "time":          "Time doesn't appear — it's carved out. What's one thing you can cut today?",
    "knowledge":     "You don't need more information. You need to act on what you already know.",
    "stress":        "Burnout is real — but avoidance makes it permanent. What's the smallest next step?",
    "relationships": "Relationship friction doesn't resolve itself. What's unsaid that needs saying?",
    "bureaucracy":   "The system is designed to exhaust you into giving up. Don't give it the win.",
}

VIBE_TONES = {
    "standard":  "Direct, clear, no filler.",
    "chill":     "Warm and conversational — like a trusted friend checking in.",
    "intense":   "Maximum urgency. No softening. Every word is a command.",
    "nurturing": "Gentle but purposeful. Care without enabling avoidance.",
    "blunt":     "Zero filter. Call it exactly what it is.",
    "academic":  "Structured and logical. Appeal to reason and evidence.",
}

SUNDAY_ACCOUNTABILITY_HOOKS = [
    "Sunday is the planning session that determines the week. Use it.",
    "What you set up today is what executes Monday through Friday.",
    "The week doesn't win — you plan it or it plans you.",
    "Sunday reset: what do you need to decide today so the week runs on autopilot?",
    "Most people waste Sunday. The ones ahead of you don't.",
]


# =============================================================================
# NOTIFICATION PAYLOAD GENERATOR (GPT-4o-mini)
# =============================================================================

async def generate_push_payload(
    client:         AsyncOpenAI,
    user_name:      str,
    mission:        str,
    roadblock:      str,
    vibe:           str,
    goals:          list,
    anchors:        list,
    trigger_reason: str,           # "dormant_48h" | "sunday_accountability"
    hours_dormant:  float = 0.0,
) -> dict:
    """
    Calls GPT-4o-mini to generate a hyper-personalized push notification.
    Returns {"title": str, "body": str, "tag": str, "data": dict}

    The AI receives the user's mission, roadblock, vibe tone, and current goals,
    then writes a notification body specific enough to stop a scroll.
    """
    # Build context for the prompt
    mission_hooks = MISSION_INTERRUPT_HOOKS.get(mission, [
        "Your goals don't chase themselves.",
        "Every hour of avoidance is borrowed time.",
    ])
    mission_hook = random.choice(mission_hooks)

    roadblock_callout = ROADBLOCK_CALLOUTS.get(roadblock, "")
    vibe_tone         = VIBE_TONES.get(vibe, VIBE_TONES["standard"])
    goals_str         = ", ".join(goals[:3]) if goals else "No goals on file — ask them to set one."
    anchors_str       = ", ".join(anchors[:3]) if anchors else "None set."

    if trigger_reason == "sunday_accountability":
        sunday_hook = random.choice(SUNDAY_ACCOUNTABILITY_HOOKS)
        trigger_ctx = (
            f"It is Sunday. This is the user's highest-risk day for avoidance and drift. "
            f"Sunday framing: '{sunday_hook}'"
        )
    else:
        trigger_ctx = (
            f"The user has been dormant for {hours_dormant:.0f} hours. "
            f"This is a re-engagement interrupt. Make them feel the gap."
        )

    prompt = f"""You are the LYLO OS Sentinel — a proactive accountability engine.
Generate a personalized push notification to interrupt self-sabotage and re-engage this user.

USER CONTEXT:
  Name:      {user_name}
  Mission:   {mission} → Hook: "{mission_hook}"
  Roadblock: {roadblock} → Callout: "{roadblock_callout}"
  Vibe:      {vibe} → Tone: {vibe_tone}
  Goals:     {goals_str}
  Anchors:   {anchors_str}
  Trigger:   {trigger_ctx}

RULES:
- Title: 4-7 words. Punchy. Not generic. Reference their specific mission or block.
- Body: 1-2 tight sentences. Max 120 characters total.
  Use {user_name}'s name once. Reference ONE specific detail (goal, roadblock, or anchor).
  This must feel personally written — not a template.
- Do NOT use emojis in the title. One emoji in body is allowed, only if tone matches.
- No corporate language. No "Hey there!". No "Don't forget to...".
- Make it feel like a trusted, demanding advisor — not a marketing email.
- Tag: snake_case identifier (e.g. "dormant_wealth_interrupt")

EXAMPLES OF GOOD NOTIFICATIONS:
  Title: "The plan doesn't wait, {user_name}"
  Body:  "48 hours off the mission. Your wealth target isn't closer. What's one move — right now?"

  Title: "Sunday is your leverage window"
  Body:  "{user_name}, the week you plan today beats the week that happens to you. 10 minutes. Now."

OUTPUT: Raw JSON only. No markdown. No preamble.
{{"title": "...", "body": "...", "tag": "...", "data": {{"mission": "{mission}", "trigger": "{trigger_reason}"}}}}
"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=200,
            temperature=0.8,   # Some variation so the same user doesn't see identical copy
        )
        raw = response.choices[0].message.content.strip()
        return json.loads(raw)
    except Exception as e:
        log.warning(f"⚠️  GPT payload generation failed — using template: {e}")
        # Template fallback
        return {
            "title": f"{user_name}, the mission's waiting",
            "body":  f"{mission_hook} One move. Right now.",
            "tag":   f"{trigger_reason}_{mission}",
            "data":  {"mission": mission, "trigger": trigger_reason},
        }
