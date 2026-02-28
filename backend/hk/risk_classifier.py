"""
╔══════════════════════════════════════════════════════════════╗
║  RISK CLASSIFIER — Verification Tier Router                 ║
║  "Not everything needs Tier 5." — All 3 AIs agreed          ║
╚══════════════════════════════════════════════════════════════╝

Auto-classifies questions by risk level:
  Tier 1 (LOW)     → Single model, fast response
  Tier 2 (MEDIUM)  → Single model + source citations required
  Tier 3 (HIGH)    → Multi-model + adversarial + source diversity
  Tier 4 (CRITICAL)→ Full pipeline + deterministic anchor + user confirm
"""

import re


class RiskClassifier:

    # Keywords that indicate HIGH/CRITICAL risk
    CRITICAL_KEYWORDS = [
        r'\b(?:suicide|suicidal|kill myself|end my life|self.?harm)\b',
        r'\b(?:emergency|911|ambulance|poison|overdose)\b',
        r'\b(?:chest pain|heart attack|stroke|can\'t breathe|allergic reaction)\b',
    ]

    HIGH_KEYWORDS = [
        # Medical (with plurals and common variants)
        r'\b(?:medications?|dosage|drug interactions?|side effects?|symptoms?|diagnosis)\b',
        r'\b(?:doctors?|medical|health|diseases?|treatments?|pregnan\w*|surgery)\b',
        r'\b(?:blood pressure|blood thinner|diabetes|cancer|infections?|vaccines?)\b',
        r'\b(?:drugs?\b.*(?:safe|avoid|mix|interact|combin))',
        r'\b(?:prescri\w+|pharmac\w+|antibiotic|antidepressant|painkiller)\b',
        r'\b(?:allergic|allerg\w+|asthma|cholesterol|insulin|thyroid)\b',
        # Common drug names that indicate medical context
        r'\b(?:warfarin|coumadin|metformin|ibuprofen|aspirin|tylenol|excedrin)\b',
        r'\b(?:lisinopril|atorvastatin|amlodipine|metoprolol|omeprazole)\b',
        r'\b(?:xanax|adderall|oxycodone|hydrocodone|gabapentin|prednisone)\b',
        # Patterns like "takes [something]" or "is on [something]" in medical context
        r'\b(?:takes|taking|took|prescribed|on)\b.*\b(?:daily|twice|medication|pill|tablet|mg)\b',
        r'\bcan (?:she|he|they|i|my) take\b',
        # Legal
        r'\b(?:legal|lawyer|lawsuit|court|statute|rights|sue|arrest)\b',
        r'\b(?:contracts?|liability|custody|divorce|eviction)\b',
        # Financial
        r'\b(?:invest\w*|stocks?|mortgages?|loans?|tax\w*|retirement|401k|ira)\b',
        r'\b(?:credit score|debts?|bankruptcy|interest rate|insurance)\b',
        # Safety
        r'\b(?:scam|fraud|phishing|identity theft|suspicious)\b',
        r'\b(?:child safety|abuse|domestic violence)\b',
    ]

    MEDIUM_KEYWORDS = [
        # Factual claims that could be wrong
        r'\b(?:who (?:is|was|wrote|invented|discovered|founded))\b',
        r'\b(?:when (?:did|was|is))\b',
        r'\b(?:how many|how much|how far|how long|how old)\b',
        r'\b(?:what (?:year|date|country|city|state))\b',
        r'\b(?:population|capital|president|ceo|founded)\b',
        r'\b(?:true|false|fact|correct|accurate|real)\b',
        r'\b(?:history|historical|statistic)\b',
        r'\b(?:recipe|ingredient|nutrition|calorie)\b',
    ]

    LOW_PATTERNS = [
        r'\b(?:tell me a joke|write a poem|creative|story)\b',
        r'\b(?:hello|hi|hey|good morning|how are you)\b',
        r'\b(?:thank|thanks|cool|ok|okay|nice)\b',
        r'\b(?:opinion|think|feel|believe|prefer)\b',
        r'\b(?:help me write|draft|compose|brainstorm)\b',
    ]

    def classify(self, question):
        """
        Classify a question's risk level.
        
        Returns:
            {
                "tier": 1-4,
                "level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
                "reason": str,
                "verification_strategy": str,
                "models_needed": int,
                "require_sources": bool,
                "require_adversarial": bool,
                "require_deterministic_check": bool,
            }
        """
        q = question.strip().lower()

        # Check CRITICAL first
        for pattern in self.CRITICAL_KEYWORDS:
            if re.search(pattern, q):
                return self._build_result(4, "CRITICAL",
                    "Life-safety or emergency content detected",
                    require_sources=True, require_adversarial=True,
                    require_deterministic=True)

        # Check HIGH
        for pattern in self.HIGH_KEYWORDS:
            if re.search(pattern, q):
                return self._build_result(3, "HIGH",
                    "Medical, legal, financial, or safety-related content",
                    require_sources=True, require_adversarial=True,
                    require_deterministic=True)

        # Check if it's clearly LOW risk
        for pattern in self.LOW_PATTERNS:
            if re.search(pattern, q):
                # But override if it also matches medium+ keywords
                has_medium = any(re.search(p, q) for p in self.MEDIUM_KEYWORDS)
                if not has_medium:
                    return self._build_result(1, "LOW",
                        "Casual, creative, or opinion-based query",
                        require_sources=False, require_adversarial=False,
                        require_deterministic=False)

        # Check MEDIUM
        for pattern in self.MEDIUM_KEYWORDS:
            if re.search(pattern, q):
                return self._build_result(2, "MEDIUM",
                    "Factual claim requiring verification",
                    require_sources=True, require_adversarial=False,
                    require_deterministic=True)

        # Check if it contains a question mark and factual patterns
        if '?' in question:
            # Questions with specific claims or numbers
            if re.search(r'\d', q) or re.search(r'\b(?:is it true|did|does|can|will)\b', q):
                return self._build_result(2, "MEDIUM",
                    "Question with verifiable claims",
                    require_sources=True, require_adversarial=False,
                    require_deterministic=True)

        # Default to MEDIUM for safety (bias toward caution)
        return self._build_result(2, "MEDIUM",
            "Default classification — treating as factual query",
            require_sources=True, require_adversarial=False,
            require_deterministic=True)

    def _build_result(self, tier, level, reason,
                      require_sources, require_adversarial, require_deterministic):

        strategies = {
            1: "Single model, fast response, no verification needed",
            2: "Single model with source citations, deterministic check if applicable",
            3: "Multi-model consensus + adversarial challenge + source diversity + deterministic anchor",
            4: "Full pipeline: all models + adversarial + deterministic + elevated transparency",
        }

        models_needed = {1: 1, 2: 1, 3: 3, 4: 3}

        return {
            "tier": tier,
            "level": level,
            "reason": reason,
            "verification_strategy": strategies[tier],
            "models_needed": models_needed[tier],
            "require_sources": require_sources,
            "require_adversarial": require_adversarial,
            "require_deterministic_check": require_deterministic,
        }
