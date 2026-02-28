"""
╔══════════════════════════════════════════════════════════════╗
║  HALLUCINATION KILLER v1.0 — THREE PILLAR ENGINE            ║
║  Consensus Architecture by Chris (Hustle Lab)               ║
║  Peer-reviewed by Claude, GPT, and Gemini. Powered by Groq.  ║
╚══════════════════════════════════════════════════════════════╝

THREE PILLARS:
  Pillar 1 — RETRIEVAL: Models research with mandatory citations
  Pillar 2 — ADVERSARIAL: Structured skepticism challenges everything
  Pillar 3 — DETERMINISTIC: Computation overrides AI opinion

KEY PRINCIPLES (agreed by all 3 AIs):
  • Source diversity enforced at ORCHESTRATION level
  • Consensus ≠ certainty. It's a confidence amplifier.
  • Risk-based tiering: not every question needs full pipeline
  • Deterministic systems override LLM consensus
  • Expose the process — transparency builds trust
"""

import os
import json
import time
import concurrent.futures
from dotenv import load_dotenv
from deterministic import DeterministicAnchor
from risk_classifier import RiskClassifier
from source_tracker import SourceTracker

load_dotenv()


# ============================================================
# LLM CLIENTS
# ============================================================

class ClaudeClient:
    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.name = "Claude"
        self.model = "claude-sonnet-4-20250514"

    def generate(self, system_prompt, user_prompt):
        try:
            r = self.client.messages.create(
                model=self.model, max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )
            return r.content[0].text
        except Exception as e:
            return f"[ERROR:{self.name}] {e}"


class GPTClient:
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.name = "GPT"
        self.model = "gpt-4o-mini"

    def generate(self, system_prompt, user_prompt):
        try:
            r = self.client.chat.completions.create(
                model=self.model, max_tokens=2048,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            return r.choices[0].message.content
        except Exception as e:
            return f"[ERROR:{self.name}] {e}"


class GroqClient:
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1"
        )
        self.name = "Groq"
        self.model = "llama-3.3-70b-versatile"

    def generate(self, system_prompt, user_prompt):
        try:
            r = self.client.chat.completions.create(
                model=self.model, max_tokens=2048,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            return r.choices[0].message.content
        except Exception as e:
            return f"[ERROR:{self.name}] {e}"


# ============================================================
# PROMPT TEMPLATES
# ============================================================

def build_retrieval_prompt(exclusion_block="", risk_level="MEDIUM"):
    """Pillar 1: Research model — find and cite diverse sources"""
    safety_block = ""
    if risk_level in ("HIGH", "CRITICAL"):
        safety_block = """
5. SAFETY DISCLAIMER MANDATORY: This is a HIGH-RISK query.
   You MUST end your answer with one of these disclaimers:
   - Medical: "Please consult a healthcare professional before making any medical decisions."
   - Legal: "Please consult a licensed attorney for legal advice specific to your situation."
   - Financial: "Please consult a qualified financial advisor before making financial decisions."
   This is NON-NEGOTIABLE. Every high-risk answer MUST contain a professional consultation disclaimer.
   If the question involves drug interactions, LEAD with the danger warning.
"""

    return f"""You are a research AI in a multi-agent fact-verification system.

MISSION: Answer the question with VERIFIED, INDEPENDENTLY SOURCED information.

MANDATORY RULES:

1. CITE AT LEAST 3 INDEPENDENT SOURCES from DIFFERENT epistemic classes:
   - Primary Sources: academic papers, government data, court rulings
   - Curated Reference: encyclopedias, official documentation, textbooks
   - Live/Current: news organizations, press releases, recent reports
   - Structured Data: databases, registries, statistical sources
   Use at least 2 DIFFERENT types from the list above.

2. EVERY factual claim must be tied to a specific source.

3. If you CANNOT find 3 independent sources, SAY SO honestly.
   "I could only verify this from 1 source" is acceptable.
   Fabricating sources is the WORST possible outcome.

4. Provide your REASONING CHAIN — show how you arrived at your answer.

CRITICAL — PARTIAL-TRUTH DETECTION:
   If the question references something that PARTIALLY exists (e.g., a real organization
   but fake study, a real law but wrong section number, a real event but wrong date):
   - Identify WHAT IS REAL and WHAT IS NOT
   - State specifically: "X exists, but Y does not"
   - Do NOT say the entire thing doesn't exist if part of it does

CRITICAL — DEBATED TOPICS:
   If experts genuinely disagree on the answer (e.g., longest river, healthiest diet):
   - Present BOTH sides with sources for each position
   - Do NOT present one side as definitive fact
   - State: "This is debated. Position A says X, Position B says Y"
{safety_block}
{exclusion_block}

RESPONSE FORMAT — ONLY valid JSON, no markdown fences:
{{
    "answer": "Your factual answer",
    "reasoning_chain": "Step by step: how you arrived at this answer",
    "sources": [
        {{
            "name": "Source name",
            "type": "Epistemic class (Primary/Curated/Live/Structured)",
            "url_or_reference": "URL or citation",
            "what_it_confirms": "What specific claim this supports"
        }}
    ],
    "source_count": 3,
    "confidence": "HIGH/MEDIUM/LOW",
    "limitations": "What you couldn't verify or are uncertain about"
}}"""


def build_adversarial_prompt(exclusion_block="", risk_level="MEDIUM"):
    """Pillar 2: Adversarial model — structured skepticism"""
    safety_note = ""
    if risk_level in ("HIGH", "CRITICAL"):
        safety_note = """
SAFETY NOTE: This is a HIGH-RISK query. While challenging the answer, you MUST:
- If the core safety warning is correct (e.g., drug interaction danger), CONFIRM it even as you challenge other aspects
- Do NOT undermine life-safety warnings just to be contrarian
- Focus your challenges on nuance, edge cases, and completeness — not on contradicting verified dangers
- Include a professional consultation disclaimer in your answer
"""

    return f"""You are the ADVERSARIAL VERIFIER in a multi-agent fact-verification system.

YOUR JOB IS NOT TO AGREE. Your job is STRUCTURED SKEPTICISM.

You will receive a question. Another AI has already answered it.
You must:

1. INDEPENDENTLY research the same question using DIFFERENT sources
2. Actively look for reasons the common answer could be WRONG
3. Generate at least 3 reasons the prevailing answer could be incorrect
4. Identify hidden ASSUMPTIONS in the question or answer
5. Cite COUNTEREXAMPLES if they exist
6. Estimate PROBABILITY RANGES, not single numbers

You are looking for:
- Common misconceptions that multiple AIs might share
- Outdated information that may have changed
- Nuance that gets lost in simplified answers
- Edge cases or exceptions to general rules
- Sources that contradict the mainstream view
- FALSE PREMISES in the question itself (fake studies, wrong dates, non-existent entities)
{safety_note}
{exclusion_block}

RESPONSE FORMAT — ONLY valid JSON:
{{
    "answer": "Your independent answer (may differ from consensus)",
    "reasoning_chain": "Your independent reasoning",
    "sources": [
        {{
            "name": "Source name (MUST be different from other models)",
            "type": "Epistemic class",
            "url_or_reference": "URL or citation",
            "what_it_confirms": "What this supports or contradicts"
        }}
    ],
    "source_count": 3,
    "confidence": "HIGH/MEDIUM/LOW",
    "potential_errors_in_common_answer": [
        "Specific reason 1 the common answer could be wrong",
        "Specific reason 2",
        "Specific reason 3"
    ],
    "hidden_assumptions": ["Assumptions people make about this topic"],
    "counterexamples": ["Any cases where the common answer fails"],
    "limitations": "What remains uncertain"
}}"""


EVALUATOR_PROMPT = """You are evaluating another AI's response in a verification pipeline.
Evaluate BOTH the answer accuracy AND the source quality.

AI models sometimes FABRICATE sources. Check if sources seem real and credible.
Agreement without shared reasoning does NOT equal real agreement.

IMPORTANT: Your ENTIRE response must be ONLY a valid JSON object.
Do NOT include any text, explanation, or markdown before or after the JSON.
Do NOT wrap it in code fences. Just the raw JSON object.

{
    "accuracy_score": <0-100>,
    "source_quality_score": <0-100>,
    "reasoning_quality_score": <0-100>,
    "hallucination_detected": <true or false>,
    "source_concerns": ["any suspicious or fabricated sources"],
    "factual_concerns": ["any incorrect claims"],
    "reasoning_concerns": ["any logical gaps"],
    "verdict": "PASS" or "WARN" or "FAIL",
    "reasoning": "brief explanation of your evaluation"
}"""


# ============================================================
# CORE ENGINE
# ============================================================

class HallucinationKiller:

    def __init__(self):
        self.clients = {}
        self.init_errors = []
        self.deterministic = DeterministicAnchor()
        self.risk_classifier = RiskClassifier()

        for name, cls, key_env in [
            ("Claude", ClaudeClient, "ANTHROPIC_API_KEY"),
            ("GPT", GPTClient, "OPENAI_API_KEY"),
            ("Groq", GroqClient, "GROQ_API_KEY"),
        ]:
            try:
                if os.getenv(key_env):
                    self.clients[name] = cls()
            except Exception as e:
                self.init_errors.append(f"{name}: {e}")

    def _parse_json(self, raw):
        """
        Robust JSON parser that handles all the messy ways LLMs return JSON:
        - Clean JSON
        - ```json ... ``` fenced
        - Text before/after the JSON
        - Multiple code fences
        - Trailing commas (common LLM mistake)
        """
        if not raw or not raw.strip():
            raise ValueError("Empty response")

        cleaned = raw.strip()

        # Attempt 1: Direct parse (cleanest case)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Attempt 2: Strip markdown code fences
        # Handle ```json, ```JSON, ``` etc
        import re
        fenced = re.search(r'```(?:json|JSON)?\s*\n?(.*?)```', cleaned, re.DOTALL)
        if fenced:
            try:
                return json.loads(fenced.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Attempt 3: Find first { ... last } (extract JSON object from surrounding text)
        first_brace = cleaned.find('{')
        last_brace = cleaned.rfind('}')
        if first_brace != -1 and last_brace > first_brace:
            candidate = cleaned[first_brace:last_brace + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                # Attempt 3b: Fix trailing commas (common LLM mistake)
                fixed = re.sub(r',\s*}', '}', candidate)
                fixed = re.sub(r',\s*]', ']', fixed)
                try:
                    return json.loads(fixed)
                except json.JSONDecodeError:
                    pass

        # Attempt 4: Try to find any JSON-like structure line by line
        lines = cleaned.split('\n')
        json_lines = []
        in_json = False
        depth = 0
        for line in lines:
            if '{' in line and not in_json:
                in_json = True
            if in_json:
                json_lines.append(line)
                depth += line.count('{') - line.count('}')
                if depth <= 0:
                    break

        if json_lines:
            candidate = '\n'.join(json_lines)
            # Find first { to last }
            fb = candidate.find('{')
            lb = candidate.rfind('}')
            if fb != -1 and lb > fb:
                candidate = candidate[fb:lb + 1]
                fixed = re.sub(r',\s*}', '}', candidate)
                fixed = re.sub(r',\s*]', ']', fixed)
                try:
                    return json.loads(fixed)
                except json.JSONDecodeError:
                    pass

        # All attempts failed
        raise ValueError(f"Could not extract JSON from response (length={len(raw)}, starts with: {raw[:80]})")

    def run(self, question):
        """
        Full HallucinationKiller v1.0 pipeline.

        Flow:
        0. Classify risk level
        1. Check deterministic anchor (Pillar 3)
        2. If deterministic can answer → return immediately (100% confidence)
        3. If not → run Pillar 1 (Retrieval) + Pillar 2 (Adversarial)
        4. Cross-evaluate
        5. Calculate consensus (never = certainty)
        6. Return with full transparency
        """
        t0 = time.time()
        result = {
            "question": question,
            "version": "1.0",
            "models_available": list(self.clients.keys()),
            "stages": {},
        }

        # ── STAGE 0: Risk Classification ──
        risk = self.risk_classifier.classify(question)
        result["stages"]["risk_classification"] = risk
        print(f"[RISK] Tier {risk['tier']} — {risk['level']}: {risk['reason']}")

        # ── STAGE 1: Deterministic Anchor (Pillar 3) ──
        if risk["require_deterministic_check"]:
            det = self.deterministic.try_answer(question)
            if det:
                elapsed = round(time.time() - t0, 2)
                result["stages"]["deterministic"] = det
                result["final"] = {
                    "answer": det["answer"],
                    "answered_by": "Deterministic Engine",
                    "confidence_score": 100,
                    "confidence_color": "GREEN",
                    "confidence_label": "DETERMINISTIC — CANNOT HALLUCINATE",
                    "method": det["method"],
                    "source": det["source"],
                    "accuracy_score": 100,
                    "source_quality_score": 100,
                    "source_diversity_score": 100,
                    "total_unique_sources": 1,
                    "all_sources": [{"name": det["source"], "type": "Deterministic", "cited_by": "System"}],
                    "hallucination_flags": 0,
                    "all_concerns": [],
                    "pipeline_time_seconds": elapsed,
                    "risk_tier": risk["tier"],
                    "risk_level": risk["level"],
                    "verification_mode": "DETERMINISTIC",
                }
                print(f"[DETERMINISTIC] Answered in {elapsed}s — {det['method']}")
                return result
        else:
            result["stages"]["deterministic"] = None

        # ── Check we have enough models ──
        if len(self.clients) < 2:
            result["error"] = f"Need 2+ models. Have: {list(self.clients.keys())}"
            return result

        # ── STAGE 2: Tiered Verification ──
        if risk["tier"] <= 1:
            return self._run_tier1(question, risk, result, t0)
        elif risk["tier"] == 2:
            return self._run_tier2(question, risk, result, t0)
        else:
            return self._run_full_pipeline(question, risk, result, t0)

    # ── TIER 1: Single model, fast ──
    def _run_tier1(self, question, risk, result, t0):
        client = list(self.clients.values())[0]
        print(f"[TIER 1] Single model: {client.name}")

        raw = client.generate(
            "Answer concisely and honestly. If unsure, say so.",
            question
        )
        elapsed = round(time.time() - t0, 2)

        # Light dynamic scoring for Tier 1
        answer = raw or ""
        score = 55  # baseline for unverified casual response
        if len(answer) > 50:
            score += 5
        if len(answer) > 200:
            score += 5
        if any(w in answer.lower() for w in ["i'm not sure", "i don't know", "uncertain"]):
            score += 5  # honesty bonus
        score = min(75, score)  # cap: single model casual can't be > 75

        color = "GREEN" if score >= 70 else "YELLOW" if score >= 45 else "RED"
        label = "LOW-RISK — SINGLE MODEL" if score >= 55 else "LOW-RISK — LOW CONFIDENCE"

        result["stages"]["generation"] = [{"model": client.name, "answer": raw, "time": elapsed}]
        result["final"] = {
            "answer": raw,
            "answered_by": client.name,
            "confidence_score": score,
            "confidence_color": color,
            "confidence_label": label,
            "accuracy_score": None,
            "source_quality_score": None,
            "source_diversity_score": 0,
            "total_unique_sources": 0,
            "all_sources": [],
            "hallucination_flags": 0,
            "all_concerns": ["Low-risk query: single model response without cross-verification"],
            "pipeline_time_seconds": elapsed,
            "risk_tier": risk["tier"],
            "risk_level": risk["level"],
            "verification_mode": "TIER_1_FAST",
        }
        return result

    # ── TIER 2: Single model + sources + deterministic check ──
    def _run_tier2(self, question, risk, result, t0):
        client = list(self.clients.values())[0]
        print(f"[TIER 2] Sourced: {client.name}")

        prompt = build_retrieval_prompt(risk_level=risk.get("level", "MEDIUM"))
        raw = client.generate(prompt, question)

        parsed_ok = False
        confidence_declared = "UNKNOWN"
        reasoning_chain = ""
        limitations = ""

        try:
            parsed = self._parse_json(raw)
            answer = parsed.get("answer", raw)
            sources = parsed.get("sources", [])
            confidence_declared = parsed.get("confidence", "UNKNOWN")
            reasoning_chain = parsed.get("reasoning_chain", "")
            limitations = parsed.get("limitations", "")
            parsed_ok = True
        except Exception:
            answer = raw
            sources = []

        elapsed = round(time.time() - t0, 2)
        all_sources = [dict(s, cited_by=client.name) if isinstance(s, dict) else {"name": str(s), "cited_by": client.name} for s in sources]

        # ── DYNAMIC TIER 2 SCORING ──
        score, components, concerns = self._score_tier2(
            answer, sources, parsed_ok, confidence_declared,
            reasoning_chain, limitations
        )

        # Color banding
        if score >= 80:
            color = "GREEN"
            label = "SINGLE MODEL — HIGH CONFIDENCE WITH SOURCES"
        elif score >= 55:
            color = "YELLOW"
            label = "SINGLE MODEL — MODERATE CONFIDENCE"
        else:
            color = "RED"
            label = "SINGLE MODEL — LOW CONFIDENCE, VERIFY INDEPENDENTLY"

        concerns.append("Single model — sources not independently verified")

        result["stages"]["generation"] = [{
            "model": client.name, "answer": answer,
            "sources": sources, "time": elapsed,
            "confidence_declared": confidence_declared,
        }]
        result["stages"]["tier2_scoring"] = components
        result["final"] = {
            "answer": answer,
            "answered_by": client.name,
            "confidence_score": score,
            "confidence_color": color,
            "confidence_label": label,
            "accuracy_score": components.get("source_score"),
            "source_quality_score": components.get("source_score"),
            "source_diversity_score": 0,
            "total_unique_sources": len(sources),
            "all_sources": all_sources,
            "hallucination_flags": components.get("uncertainty_flags", 0),
            "all_concerns": concerns,
            "pipeline_time_seconds": elapsed,
            "risk_tier": risk["tier"],
            "risk_level": risk["level"],
            "verification_mode": "TIER_2_SOURCED",
            "scoring_components": components,
        }
        return result

    def _score_tier2(self, answer, sources, parsed_ok, confidence_declared,
                     reasoning_chain, limitations):
        """
        Dynamic scoring for Tier 2 responses.

        KEY INSIGHT (from GPT peer review):
          "Correct refusal" (saying something doesn't exist) is structurally
          EASIER than providing a complex, multi-variable factual explanation.
          Score must reflect this: refusals capped below positive factual answers.

        Components (all 0-100):
          - source_score: quantity and apparent quality of citations
          - honesty_score: does the model express appropriate uncertainty?
          - completeness_score: reasoning chain, limitations acknowledged?
          - parse_score: did the response follow the format?
          - declared_confidence: what the model itself reported

        Final = weighted blend that can produce anything from 25-90%.
        """
        import re
        components = {}
        concerns = []
        answer_lower = (answer or "").lower()

        # ── CLASSIFY RESPONSE TYPE ──
        refusal_phrases = [
            "cannot find", "could not find", "no evidence", "does not exist",
            "not appear to exist", "unable to verify", "cannot verify", "no record",
            "does not contain", "no such", "could not have", "impossible",
            "does not appear", "no matching", "cannot provide", "fabricated",
            "misattribut", "not exist",
        ]
        positive_phrases = [
            "there are", "the answer is", "according to", "is approximately",
            "was signed", "was built", "contains", "measures", "the result is",
            "is typically", "ranges from", "is considered",
        ]

        refusal_hits = sum(1 for p in refusal_phrases if p in answer_lower)
        positive_hits = sum(1 for p in positive_phrases if p in answer_lower)

        if refusal_hits > positive_hits and refusal_hits >= 2:
            response_type = "REFUSAL"
        elif positive_hits > refusal_hits:
            response_type = "POSITIVE_FACTUAL"
        else:
            response_type = "MIXED"

        components["response_type"] = response_type

        # 1. SOURCE SCORE (0-100) — 30% weight
        src_count = len(sources) if sources else 0
        if src_count >= 3:
            source_score = 80
        elif src_count == 2:
            source_score = 60
        elif src_count == 1:
            source_score = 40
        else:
            source_score = 15

        # Bonus for source variety (different types)
        if sources:
            types = set()
            for s in sources:
                if isinstance(s, dict):
                    types.add((s.get("type") or "").lower())
            if len(types) >= 2:
                source_score = min(100, source_score + 10)

        # Penalty for suspicious sources
        for s in (sources or []):
            if isinstance(s, dict):
                url = (s.get("url_or_reference") or "").lower()
                if "example.com" in url:
                    source_score = max(0, source_score - 20)
                    concerns.append(f"[SOURCE] Fake URL detected: {url}")
                elif not url:
                    source_score = max(0, source_score - 3)

        components["source_score"] = source_score

        # 2. HONESTY SCORE (0-100) — 25% weight
        overconfidence_phrases = [
            "definitely", "certainly", "without a doubt", "100%",
            "absolutely", "guaranteed", "proven fact",
        ]
        overconfidence_count = sum(1 for p in overconfidence_phrases if p in answer_lower)

        # Start neutral
        honesty_score = 65
        if refusal_hits > 0:
            honesty_score = min(90, 65 + refusal_hits * 8)
        if overconfidence_count > 0:
            honesty_score = max(20, honesty_score - overconfidence_count * 15)

        # Safety language bonus
        if any(w in answer_lower for w in ["should not", "do not", "avoid", "dangerous", "risk"]):
            honesty_score = min(100, honesty_score + 5)

        components["honesty_score"] = honesty_score

        # 3. COMPLETENESS SCORE (0-100) — 20% weight
        completeness_score = 50
        if parsed_ok:
            completeness_score += 15
        if reasoning_chain and len(reasoning_chain) > 20:
            completeness_score += 15
        if limitations and len(limitations) > 10:
            completeness_score += 10
        if len(answer or "") > 100:
            completeness_score += 10
        completeness_score = min(100, completeness_score)
        components["completeness_score"] = completeness_score

        # 4. DECLARED CONFIDENCE (0-100) — 15% weight
        declared_map = {
            "HIGH": 85, "MEDIUM": 60, "LOW": 35, "UNKNOWN": 50,
        }
        declared_score = declared_map.get(confidence_declared.upper(), 50)
        components["declared_score"] = declared_score

        # 5. FORMAT SCORE (0-100) — 10% weight
        format_score = 80 if parsed_ok else 30
        components["format_score"] = format_score

        # ── WEIGHTED BLEND ──
        final = (
            source_score * 0.30 +
            honesty_score * 0.25 +
            completeness_score * 0.20 +
            declared_score * 0.15 +
            format_score * 0.10
        )

        # ── GPT'S CORRECTION: REFUSAL CAP ──
        # Saying "this doesn't exist" is easier than providing a correct factual answer.
        # Refusals capped at 78%. Positive factual answers can reach 90%.
        if response_type == "REFUSAL":
            final = min(78, final)
            components["refusal_cap_applied"] = True
        elif response_type == "MIXED":
            final = min(84, final)  # Slight cap for mixed responses
            components["refusal_cap_applied"] = False
        else:
            components["refusal_cap_applied"] = False

        # Clamp to realistic range
        final = max(25, min(90, round(final, 1)))

        components["final_score"] = final
        components["weights"] = "source=0.30 honesty=0.25 complete=0.20 declared=0.15 format=0.10"

        return final, components, concerns

    # ── TIER 3/4: Full three-pillar pipeline ──
    def _run_full_pipeline(self, question, risk, result, t0):
        source_tracker = SourceTracker()
        models = list(self.clients.items())

        # Split roles: first N-1 are retrieval, last is adversarial
        retrieval_models = models[:-1]
        adversarial_model = models[-1]

        # ── PILLAR 1: Retrieval (sequential for source exclusion) ──
        print(f"[PILLAR 1] Retrieval models: {[m[0] for m in retrieval_models]}")
        responses = []

        for i, (name, client) in enumerate(retrieval_models):
            exclusion = source_tracker.get_exclusion_prompt_block() if i > 0 else ""
            prompt = build_retrieval_prompt(exclusion, risk_level=risk.get("level", "MEDIUM"))
            print(f"  → {name} (excluded: {len(source_tracker.get_exclusion_list())} sources)")

            start = time.time()
            raw = client.generate(prompt, question)
            elapsed = round(time.time() - start, 2)

            try:
                parsed = self._parse_json(raw)
                resp = {
                    "model": name, "role": "retrieval",
                    "answer": parsed.get("answer", ""),
                    "reasoning_chain": parsed.get("reasoning_chain", ""),
                    "sources": parsed.get("sources", []),
                    "confidence": parsed.get("confidence", "UNKNOWN"),
                    "limitations": parsed.get("limitations", ""),
                    "time": elapsed, "parse_success": True,
                }
            except Exception as e:
                resp = {
                    "model": name, "role": "retrieval",
                    "answer": raw, "reasoning_chain": "",
                    "sources": [], "confidence": "LOW",
                    "limitations": f"Parse error: {e}",
                    "time": elapsed, "parse_success": False,
                }

            responses.append(resp)
            if resp["sources"]:
                source_tracker.register_sources(name, resp["sources"])

        # ── PILLAR 2: Adversarial (with all previous sources excluded) ──
        adv_name, adv_client = adversarial_model
        print(f"[PILLAR 2] Adversarial: {adv_name}")

        exclusion = source_tracker.get_exclusion_prompt_block()
        adv_prompt = build_adversarial_prompt(exclusion, risk_level=risk.get("level", "MEDIUM"))

        start = time.time()
        adv_raw = adv_client.generate(adv_prompt, question)
        adv_elapsed = round(time.time() - start, 2)

        try:
            adv_parsed = self._parse_json(adv_raw)
            adv_resp = {
                "model": adv_name, "role": "adversarial",
                "answer": adv_parsed.get("answer", ""),
                "reasoning_chain": adv_parsed.get("reasoning_chain", ""),
                "sources": adv_parsed.get("sources", []),
                "confidence": adv_parsed.get("confidence", "UNKNOWN"),
                "potential_errors": adv_parsed.get("potential_errors_in_common_answer", []),
                "hidden_assumptions": adv_parsed.get("hidden_assumptions", []),
                "counterexamples": adv_parsed.get("counterexamples", []),
                "limitations": adv_parsed.get("limitations", ""),
                "time": adv_elapsed, "parse_success": True,
            }
        except Exception as e:
            adv_resp = {
                "model": adv_name, "role": "adversarial",
                "answer": adv_raw, "reasoning_chain": "",
                "sources": [], "confidence": "LOW",
                "potential_errors": [], "hidden_assumptions": [],
                "counterexamples": [],
                "limitations": f"Parse error: {e}",
                "time": adv_elapsed, "parse_success": False,
            }

        responses.append(adv_resp)
        if adv_resp["sources"]:
            source_tracker.register_sources(adv_name, adv_resp["sources"])

        result["stages"]["generation"] = responses
        result["stages"]["source_tracking"] = source_tracker.get_diversity_report()

        # ── CROSS-EVALUATION (parallel) ──
        print("[EVAL] Cross-evaluating...")
        evaluations = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            futures = []
            for eval_name, eval_client in self.clients.items():
                for resp in responses:
                    if resp["model"] != eval_name:
                        target_data = {
                            "answer": resp["answer"],
                            "sources": resp["sources"],
                            "reasoning_chain": resp.get("reasoning_chain", ""),
                            "confidence": resp["confidence"],
                        }
                        futures.append(executor.submit(
                            self._evaluate, eval_client, question,
                            resp["model"], target_data
                        ))
            for f in concurrent.futures.as_completed(futures):
                evaluations.append(f.result())

        result["stages"]["evaluations"] = evaluations

        # ── CONSENSUS CALCULATION ──
        consensus = self._calculate_consensus(responses, evaluations, source_tracker, adv_resp, risk=risk, question=question)
        result["stages"]["consensus"] = consensus

        # ── FINAL ASSEMBLY ──
        elapsed = round(time.time() - t0, 2)

        all_sources = []
        for resp in responses:
            for src in resp.get("sources", []):
                s = dict(src) if isinstance(src, dict) else {"name": str(src)}
                s["cited_by"] = resp["model"]
                s["role"] = resp.get("role", "unknown")
                all_sources.append(s)

        all_concerns = []
        for ev in evaluations:
            for c in ev.get("factual_concerns", []):
                if c and c not in all_concerns:
                    all_concerns.append(c)
            for c in ev.get("source_concerns", []):
                if c and c not in all_concerns:
                    all_concerns.append(f"[SOURCE] {c}")
            for c in ev.get("reasoning_concerns", []):
                if c and c not in all_concerns:
                    all_concerns.append(f"[REASONING] {c}")

        diversity = source_tracker.get_diversity_report()

        result["final"] = {
            "answer": consensus["best_response"],
            "answered_by": consensus["best_model"],
            "confidence_score": consensus["overall_score"],
            "confidence_color": consensus["color"],
            "confidence_label": consensus["confidence_label"],
            "accuracy_score": consensus["accuracy_avg"],
            "source_quality_score": consensus["source_quality_avg"],
            "reasoning_quality_score": consensus.get("reasoning_avg", None),
            "source_diversity_score": diversity["combined_diversity_score"],
            "epistemic_diversity": diversity["epistemic_diversity_score"],
            "total_unique_sources": diversity["unique_sources"],
            "epistemic_classes_used": diversity["epistemic_classes_used"],
            "all_sources": all_sources,
            "source_violations": diversity["violations"],
            "adversarial_challenges": {
                "potential_errors": adv_resp.get("potential_errors", []),
                "hidden_assumptions": adv_resp.get("hidden_assumptions", []),
                "counterexamples": adv_resp.get("counterexamples", []),
                "adversarial_answer": adv_resp.get("answer", ""),
            },
            "hallucination_flags": consensus["hallucination_flags"],
            "all_concerns": all_concerns,
            "pipeline_time_seconds": elapsed,
            "risk_tier": risk["tier"],
            "risk_level": risk["level"],
            "verification_mode": f"TIER_{risk['tier']}_FULL_PIPELINE",
        }

        print(f"[DONE] {elapsed}s — {consensus['color']} {consensus['overall_score']}%")
        return result

    def _evaluate(self, eval_client, question, target_model, target_data):
        """Cross-evaluate another model's response"""
        prompt = f"""QUESTION: {question}

MODEL EVALUATED: {target_model}
RESPONSE: {json.dumps(target_data, indent=2)}

Evaluate accuracy, source quality, and reasoning quality.
CRITICAL: Your ENTIRE response must be a single JSON object. No text before or after it. No markdown fences."""

        raw = eval_client.generate(EVALUATOR_PROMPT, prompt)
        try:
            ev = self._parse_json(raw)
            ev["evaluator"] = eval_client.name
            ev["target"] = target_model
            return ev
        except Exception as e:
            # Fallback: try to mine scores from raw text
            import re
            ev = {
                "evaluator": eval_client.name, "target": target_model,
                "accuracy_score": 50, "source_quality_score": 50,
                "reasoning_quality_score": 50, "hallucination_detected": False,
                "source_concerns": [], "factual_concerns": [],
                "reasoning_concerns": [],
                "verdict": "WARN", "reasoning": ""
            }

            # Try to extract scores from text like "accuracy_score: 85"
            raw_lower = raw.lower() if raw else ""
            for field, key in [
                (r'accuracy[_\s]*score["\s:]*(\d+)', "accuracy_score"),
                (r'source[_\s]*quality[_\s]*score["\s:]*(\d+)', "source_quality_score"),
                (r'reasoning[_\s]*quality[_\s]*score["\s:]*(\d+)', "reasoning_quality_score"),
            ]:
                m = re.search(field, raw_lower)
                if m:
                    ev[key] = min(100, max(0, int(m.group(1))))

            # Try to find verdict
            if 'PASS' in raw.upper():
                ev["verdict"] = "PASS"
            elif 'FAIL' in raw.upper():
                ev["verdict"] = "FAIL"

            # Try to find hallucination flag
            if re.search(r'hallucination[_\s]*detected["\s:]*true', raw_lower):
                ev["hallucination_detected"] = True

            # Extract reasoning if present
            m = re.search(r'"reasoning"\s*:\s*"([^"]+)"', raw)
            if m:
                ev["reasoning"] = m.group(1)
            else:
                ev["reasoning"] = f"Partial parse from raw response"

            # If we extracted at least one real score, it's better than total failure
            extracted = sum(1 for k in ["accuracy_score", "source_quality_score"] if ev[k] != 50)
            if extracted == 0:
                ev["reasoning_concerns"].append(f"Full parse failed, using defaults: {str(e)}")

            return ev

    def _calculate_consensus(self, responses, evaluations, source_tracker, adversarial, risk=None, question=""):
        """
        Calculate consensus — NEVER equals certainty.
        
        Key fixes from Gemini's diagnosis:
        - Adversarial challenges don't auto-penalize if core answer is correct
        - Safety-correct answers get a bonus, not a penalty
        - Score reflects answer QUALITY, risk level shown separately
        """
        model_acc = {}
        model_src = {}
        model_rsn = {}

        for ev in evaluations:
            t = ev.get("target", "?")
            for store, key in [(model_acc, "accuracy_score"), (model_src, "source_quality_score"), (model_rsn, "reasoning_quality_score")]:
                if t not in store:
                    store[t] = []
                store[t].append(ev.get(key, 50))

        def avg(d):
            return {k: round(sum(v)/len(v), 1) for k, v in d.items() if v}

        avg_acc = avg(model_acc)
        avg_src = avg(model_src)
        avg_rsn = avg(model_rsn)

        all_acc = [s for v in model_acc.values() for s in v]
        all_src = [s for v in model_src.values() for s in v]
        all_rsn = [s for v in model_rsn.values() for s in v]

        accuracy_avg = sum(all_acc) / len(all_acc) if all_acc else 50
        source_avg = sum(all_src) / len(all_src) if all_src else 50
        reasoning_avg = sum(all_rsn) / len(all_rsn) if all_rsn else 50

        diversity = source_tracker.get_diversity_report()
        div_score = diversity["combined_diversity_score"]

        # Base score: 40% accuracy + 20% source + 15% reasoning + 15% diversity
        overall = (accuracy_avg * 0.40 + source_avg * 0.20 +
                   reasoning_avg * 0.15 + div_score * 0.15)

        # ── ADVERSARIAL ADJUSTMENT (smarter than flat penalty) ──
        serious_challenges = len(adversarial.get("potential_errors", []))
        counterexamples = adversarial.get("counterexamples", [])
        has_counterexamples = len(counterexamples) > 0

        # Only penalize if counterexamples are SUBSTANTIVE (not generic)
        substantive_counter = 0
        for ce in counterexamples:
            ce_lower = (ce or "").lower()
            # Generic filler counterexamples shouldn't count
            if len(ce_lower) > 30 and not any(g in ce_lower for g in [
                "no specific", "none found", "n/a", "not applicable",
                "there may be", "it is possible", "in some cases"
            ]):
                substantive_counter += 1

        if substantive_counter > 0:
            overall -= min(8, substantive_counter * 4)  # Cap at -8
        # Don't penalize for generic challenges — the adversarial is SUPPOSED to challenge

        # ── HALLUCINATION PENALTIES (keep these strong) ──
        hall_flags = sum(1 for ev in evaluations if ev.get("hallucination_detected", False))
        if hall_flags > 0:
            overall -= (hall_flags / max(len(evaluations), 1)) * 25

        # ── SOURCE VIOLATION PENALTIES ──
        violations = diversity["violations"]
        if violations:
            overall -= len(violations) * 8

        # ── AGREEMENT BONUS ──
        verdicts = [ev.get("verdict", "WARN") for ev in evaluations]
        pass_rate = verdicts.count("PASS") / len(verdicts) if verdicts else 0
        overall += pass_rate * 10

        # ── SAFETY CORRECTNESS BONUS ──
        # If HIGH-risk and the answer contains appropriate warnings, that's GOOD
        risk_level = (risk or {}).get("level", "MEDIUM")
        best_answer = ""
        for r in responses:
            if r.get("role") == "retrieval" and r.get("answer"):
                best_answer = r["answer"]
                break

        safety_bonus = 0
        best_lower = best_answer.lower()
        if risk_level in ("HIGH", "CRITICAL"):
            # Check for safety warnings
            safety_words = ["should not", "do not", "avoid", "dangerous", "risk",
                          "warning", "caution", "consult", "doctor", "physician",
                          "healthcare", "professional", "seriously", "emergency"]
            safety_hits = sum(1 for w in safety_words if w in best_lower)
            if safety_hits >= 3:
                safety_bonus = 8  # Reward correct safety warnings
            elif safety_hits >= 1:
                safety_bonus = 4

        overall += safety_bonus
        overall = max(0, min(100, round(overall, 1)))

        # ── BEST MODEL SELECTION ──
        model_combined = {}
        for m in avg_acc:
            model_combined[m] = (avg_acc.get(m, 50) * 0.5 +
                                 avg_src.get(m, 50) * 0.25 +
                                 avg_rsn.get(m, 50) * 0.25)
        best_model = max(model_combined, key=model_combined.get) if model_combined else None

        best_response = None
        for r in responses:
            if r["model"] == best_model:
                best_response = r["answer"]
                break

        # ── MEDICAL DISCLAIMER POST-PROCESSING ──
        if risk_level in ("HIGH", "CRITICAL") and best_response:
            disclaimer_words = ["consult", "doctor", "physician", "healthcare",
                              "medical professional", "attorney", "financial advisor"]
            has_disclaimer = any(w in best_response.lower() for w in disclaimer_words)
            if not has_disclaimer:
                # Detect domain from ORIGINAL QUESTION + response content
                context = (question + " " + " ".join(r.get("answer", "") for r in responses)).lower()
                if any(w in context for w in ["medication", "drug", "dosage", "symptom", "medical",
                                                      "health", "blood", "pain", "treat", "warfarin",
                                                      "metformin", "aspirin", "diabetic", "diabetes"]):
                    best_response += "\n\nIMPORTANT: Please consult a healthcare professional before making any medical decisions based on this information."
                elif any(w in context for w in ["legal", "court", "law", "rights", "sue", "copyright", "ruling"]):
                    best_response += "\n\nIMPORTANT: Please consult a licensed attorney for legal advice specific to your situation."
                elif any(w in context for w in ["invest", "stock", "tax", "mortgage", "financial"]):
                    best_response += "\n\nIMPORTANT: Please consult a qualified financial advisor before making financial decisions."
                else:
                    best_response += "\n\nIMPORTANT: This is a high-risk topic. Please consult a qualified professional before acting on this information."

        # ── COLOR BANDING ──
        fail_count = verdicts.count("FAIL")
        if overall >= 80 and fail_count == 0:
            color = "GREEN"
            label = "HIGH CONFIDENCE — Multi-source verified across epistemic classes"
        elif overall >= 55:
            color = "YELLOW"
            label = "MODERATE CONFIDENCE — Partial verification, some uncertainty remains"
        else:
            color = "RED"
            label = "LOW CONFIDENCE — Significant disagreement or verification failure"

        return {
            "overall_score": overall,
            "color": color,
            "confidence_label": label,
            "accuracy_avg": round(accuracy_avg, 1),
            "source_quality_avg": round(source_avg, 1),
            "reasoning_avg": round(reasoning_avg, 1),
            "model_scores": {
                m: {"accuracy": avg_acc.get(m, 0), "source": avg_src.get(m, 0), "reasoning": avg_rsn.get(m, 0)}
                for m in avg_acc
            },
            "best_model": best_model,
            "best_response": best_response,
            "hallucination_flags": hall_flags,
            "pass_count": verdicts.count("PASS"),
            "fail_count": fail_count,
            "safety_bonus": safety_bonus,
            "substantive_counterexamples": substantive_counter,
        }


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  HALLUCINATION KILLER v1.0 — Three Pillar Engine")
    print("=" * 60)
    engine = HallucinationKiller()
    print(f"Models: {list(engine.clients.keys())}")

    while True:
        q = input("\nAsk: ").strip()
        if q.lower() in ('quit', 'exit', 'q'):
            break
        r = engine.run(q)
        if "error" in r:
            print(f"Error: {r['error']}")
            continue
        f = r["final"]
        print(f"\n{f['confidence_color']} {f['confidence_score']}% — {f['confidence_label']}")
        print(f"Mode: {f['verification_mode']} | By: {f['answered_by']}")
        print(f"Answer: {f['answer']}")
        if f.get('adversarial_challenges', {}).get('potential_errors'):
            print(f"Challenges: {f['adversarial_challenges']['potential_errors']}")
        print(f"Sources: {f['total_unique_sources']} unique | Time: {f['pipeline_time_seconds']}s")
