"""
LYLO OS — services/web_search.py
Tavily personalized web search.
"""
import logging
from services.config import tavily_client

logger = logging.getLogger("LYLO.WebSearch")

# =============================================================================
async def search_personalized_web(query: str, location: str = "") -> str:
    if not tavily_client:
        return ""
    try:
        resp    = tavily_client.search(query=f"{query} {location}".strip(), search_depth="advanced", max_results=5, include_answer=True)
        results = [f"CONSENSUS SEARCH: {resp.get('answer', 'Multiple sources found.')}"]
        for r in resp.get("results", []):
            results.append(f"- {r['title']}: {r['content'][:300]}")
        return "\n".join(results)
    except Exception as e:
        logger.error(f"Search Error: {e}")
        return ""
