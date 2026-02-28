"""
╔══════════════════════════════════════════════════════════════╗
║  SOURCE TRACKER — Orchestration-Level Enforcement            ║
║  "Models shouldn't self-police. Your system should." — GPT  ║
╚══════════════════════════════════════════════════════════════╝

Tracks sources by epistemic class (not just URL):
  - Primary Sources (papers, government data, transcripts)
  - Curated Reference (encyclopedias, official docs)
  - Live Search (news, press releases, real-time APIs)
  - Structured Databases (PubMed, SEC, weather APIs)
  - Deterministic Engines (math, dates, unit conversion)
"""


EPISTEMIC_CLASSES = {
    "primary": "Primary Sources (academic papers, government data, court rulings, transcripts)",
    "curated": "Curated Reference (encyclopedias, dictionaries, official documentation)",
    "live": "Live Search / Current Reporting (news, press releases, real-time data)",
    "structured": "Structured Databases (PubMed, SEC filings, weather APIs, Wolfram)",
    "deterministic": "Deterministic Engines (math solver, date calculator, unit converter)",
}


class SourceTracker:
    """
    Orchestration-level source diversity enforcement.
    
    Key principle: The SYSTEM controls what sources each model can use.
    Models are not trusted to self-police — exclusion is enforced by the
    orchestration layer via prompt injection of blocked source lists.
    """

    def __init__(self):
        self.used_sources = {}       # model -> [source_ids]
        self.source_details = {}     # source_id -> {model, name, type, class, url, confirms}
        self.epistemic_usage = {}    # model -> set of epistemic classes used
        self.blocked_domains = {}    # model -> set of blocked domains

    def register_sources(self, model_name, sources):
        """Register sources after a model responds. Used to build exclusion for next model."""
        if model_name not in self.used_sources:
            self.used_sources[model_name] = []
            self.epistemic_usage[model_name] = set()

        for src in sources:
            if not isinstance(src, dict):
                continue

            sid = self._source_id(src)
            self.used_sources[model_name].append(sid)
            self.source_details[sid] = {
                "model": model_name,
                "name": src.get("name", "Unknown"),
                "type": src.get("type", "Unknown"),
                "epistemic_class": self._classify_epistemic(src),
                "url": src.get("url_or_reference", ""),
                "confirms": src.get("what_it_confirms", ""),
            }
            self.epistemic_usage[model_name].add(self._classify_epistemic(src))

    def get_exclusion_list(self):
        """
        Get the full exclusion list for the next model.
        This is injected into the model's prompt at the ORCHESTRATION level.
        """
        excluded = []
        for model, sources in self.used_sources.items():
            for sid in sources:
                details = self.source_details.get(sid, {})
                excluded.append({
                    "source": details.get("name", sid),
                    "used_by": model,
                    "type": details.get("type", "Unknown"),
                    "url": details.get("url", ""),
                })
        return excluded

    def get_exclusion_prompt_block(self):
        """
        Generate the prompt block that enforces source exclusion.
        This is inserted into the model's system prompt by the orchestrator.
        """
        excluded = self.get_exclusion_list()
        if not excluded:
            return ""

        lines = ["ORCHESTRATOR-ENFORCED SOURCE EXCLUSION LIST:",
                 "The following sources have been used by other models.",
                 "You MUST NOT cite any of these. Find DIFFERENT sources from DIFFERENT epistemic classes.",
                 ""]

        for item in excluded:
            line = f"  BLOCKED: {item['source']}"
            if item['url']:
                line += f" ({item['url']})"
            line += f" [used by {item['used_by']}]"
            lines.append(line)

        # Also suggest which epistemic classes haven't been used yet
        used_classes = set()
        for classes in self.epistemic_usage.values():
            used_classes.update(classes)

        unused_classes = set(EPISTEMIC_CLASSES.keys()) - used_classes - {"deterministic"}
        if unused_classes:
            lines.append("")
            lines.append("SUGGESTED: Prioritize these under-represented source types:")
            for cls in unused_classes:
                lines.append(f"  → {EPISTEMIC_CLASSES[cls]}")

        return "\n".join(lines)

    def check_violations(self):
        """Check if any models violated source exclusion (shared sources)"""
        violations = []
        models = list(self.used_sources.keys())

        for i in range(len(models)):
            for j in range(i + 1, len(models)):
                set_a = set(self.used_sources[models[i]])
                set_b = set(self.used_sources[models[j]])
                overlap = set_a & set_b
                if overlap:
                    violations.append({
                        "models": [models[i], models[j]],
                        "shared_sources": [
                            self.source_details.get(s, {}).get("name", s) for s in overlap
                        ],
                        "severity": "HIGH" if len(overlap) > 1 else "MEDIUM"
                    })
        return violations

    def get_diversity_report(self):
        """Full diversity analysis"""
        all_sources = []
        for sources in self.used_sources.values():
            all_sources.extend(sources)

        unique = set(all_sources)
        total = len(all_sources)

        # Epistemic class distribution
        class_dist = {}
        for sid in unique:
            ec = self.source_details.get(sid, {}).get("epistemic_class", "unknown")
            class_dist[ec] = class_dist.get(ec, 0) + 1

        # Source diversity score
        url_diversity = round((len(unique) / total) * 100, 1) if total > 0 else 0

        # Epistemic diversity: how many different classes are represented
        total_classes = len(EPISTEMIC_CLASSES) - 1  # exclude deterministic
        classes_used = len(set(class_dist.keys()) - {"deterministic", "unknown"})
        epistemic_diversity = round((classes_used / total_classes) * 100, 1) if total_classes > 0 else 0

        # Combined diversity: weight epistemic higher because it's more meaningful
        combined_diversity = round(url_diversity * 0.4 + epistemic_diversity * 0.6, 1)

        return {
            "total_sources": total,
            "unique_sources": len(unique),
            "url_diversity_score": url_diversity,
            "epistemic_classes_used": classes_used,
            "epistemic_classes_total": total_classes,
            "epistemic_diversity_score": epistemic_diversity,
            "combined_diversity_score": combined_diversity,
            "class_distribution": class_dist,
            "violations": self.check_violations(),
            "by_model": {
                model: {
                    "source_count": len(sources),
                    "epistemic_classes": list(self.epistemic_usage.get(model, set())),
                    "sources": [
                        self.source_details.get(s, {"name": s}) for s in sources
                    ]
                }
                for model, sources in self.used_sources.items()
            }
        }

    def _source_id(self, src):
        """Create a normalized ID for deduplication"""
        name = src.get("name", "").strip().lower()
        url = src.get("url_or_reference", "").strip().lower()

        if url and url.startswith("http"):
            try:
                from urllib.parse import urlparse
                domain = urlparse(url).netloc.replace("www.", "")
                path = urlparse(url).path.rstrip("/")
                return f"{domain}{path}"
            except Exception:
                pass

        return name if name else str(src)

    def _classify_epistemic(self, src):
        """Classify a source into an epistemic class"""
        src_type = (src.get("type", "") or "").lower()
        name = (src.get("name", "") or "").lower()
        url = (src.get("url_or_reference", "") or "").lower()

        combined = f"{src_type} {name} {url}"

        # Primary sources
        if any(kw in combined for kw in [
            "academic", "paper", "journal", "research", "study",
            "government", "gov", ".gov", "court", "ruling", "transcript",
            "pubmed", "arxiv", "doi.org", "ncbi", "nih",
        ]):
            return "primary"

        # Structured databases
        if any(kw in combined for kw in [
            "database", "api", "sec.gov", "data.gov", "statistics",
            "wolfram", "pubmed", "structured", "registry",
        ]):
            return "structured"

        # Live search / current reporting
        if any(kw in combined for kw in [
            "news", "press", "reuters", "associated press", "bbc",
            "cnn", "nyt", "times", "post", "guardian", "current",
            "2024", "2025", "2026", "report", "article",
        ]):
            return "live"

        # Curated reference
        if any(kw in combined for kw in [
            "encyclopedia", "britannica", "wikipedia", "dictionary",
            "documentation", "official", "handbook", "reference",
            "textbook", "guide", "manual",
        ]):
            return "curated"

        return "curated"  # Default to curated if unclear
