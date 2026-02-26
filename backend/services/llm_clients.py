"""
LYLO OS — services/llm_clients.py
All LLM API calls: Gemini Vision, OpenAI Bodyguard, Claude Validator.
"""
import re
import json
import asyncio
import base64
import logging
from services.config import gemini_client, gemini_ready, openai_client, anthropic_client

logger = logging.getLogger("LYLO.LLMClients")

# =============================================================================
# AI ENGINE CALLS — DUAL-PASS CONSENSUS
# =============================================================================
async def call_gemini_vision(prompt: str, image_b64: str = None, model_name: str = "gemini-2.0-flash-lite"):
    """
    Bulletproof Gemini call — google.genai SDK via Vertex AI.
    Returns None on ANY failure. Never blocks the race.
    """
    if not gemini_ready or not gemini_client:
        return None
    try:
        parts = [prompt]
        if image_b64:
            try:
                from google.genai import types as genai_types
                parts.append(genai_types.Part.from_bytes(
                    data=base64.b64decode(image_b64),
                    mime_type="image/jpeg"
                ))
            except Exception:
                pass

        def _sync_call():
            return gemini_client.models.generate_content(
                model=model_name,
                contents=parts,
                config={"response_mime_type": "application/json"}
            )

        resp = await asyncio.to_thread(_sync_call)
        text = resp.text.replace("```json","").replace("```","").strip()
        try:
            parsed = json.loads(text)
            parsed["model"] = f"LYLO-VISION ({model_name}/vertex)"
            return parsed
        except Exception:
            return {"answer": resp.text, "confidence_score": 85,
                    "model": f"LYLO-VISION ({model_name}/vertex)"}

    except Exception as e:
        err_str = str(e)
        if "404" in err_str:
            logger.warning(f"⚡ Gemini 404 — {model_name} unavailable")
        elif "403" in err_str:
            logger.warning("⚡ Gemini 403 — check service account permissions")
        else:
            logger.warning(f"⚡ Gemini fast-fail: {err_str[:120]}")
        return None


async def call_openai_bodyguard(prompt: str, image_b64: str = None, model_name: str = "gpt-4o-mini"):
    if not openai_client:
        return None
    try:
        content = [{"type": "text", "text": prompt}]
        if image_b64:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}})
        resp = await openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": (
                    "You are the LYLO Intelligence Engine. "
                    "Follow the USER IDENTITY CORE, GLOBAL DIRECTIVE, PERSONA SKIN, "
                    "INTENT LOGIC, and RUNTIME CONTEXT in the user prompt exactly. "
                    "Output ONLY valid raw JSON. No markdown. No preamble."
                )},
                {"role": "user", "content": content},
            ],
            response_format={"type": "json_object"},
            max_tokens=1200, temperature=0.2,
        )
        raw = resp.choices[0].message.content
        try:
            result = json.loads(raw)
        except Exception:
            cleaned = raw.replace("```json","").replace("```","").strip()
            try:
                result = json.loads(cleaned)
            except Exception:
                logger.warning(f"OpenAI JSON repair fallback for {model_name}")
                result = {"answer": cleaned[:2000] or "Response processing error.",
                          "confidence_score": 80, "scam_detected": False,
                          "threat_level": "low", "action_trigger": None}
        result["model"] = f"LYLO-CORE ({model_name})"
        return result
    except Exception as e:
        logger.error(f"OpenAI Brain Error: {e}")
        return None

# =============================================================================
# V30 SENTENCE SPLITTER
# =============================================================================

# V30 SENTENCE SPLITTER
# =============================================================================
def split_into_sentences(text: str) -> list:
    clean  = re.sub(r"\*{1,2}|#{1,6}\s?", "", text).strip()
    parts  = re.findall(r"[^.!?\n]+(?:[.!?]+[\"']?(?:\s|$)|\n|$)", clean)
    result = [s.strip() for s in parts if len(s.strip()) > 3]
    return result if result else [clean]

# =============================================================================
# TRUST LAYER — HIGH-STAKES CLAIM DETECTOR
# Sentences matching these patterns get NLI verification before streaming.
# Everything else streams immediately as "probable" — no delay.
# =============================================================================
_HIGH_STAKES_PATTERNS = [
    # Medical — drug names, doses, symptoms, treatments
    (re.compile(r'\b(dose|dosage|mg|milligram|medication|drug|prescription|side.effect|interaction|symptom|diagnos|treatment|surgery|inject|vaccine|overdose|contraindication|ibuprofen|acetaminophen|metformin|lisinopril|atorvastatin|amoxicillin|prednisone|insulin|warfarin|aspirin)\b', re.I), "medical"),
    # Legal — laws, rights, liability, court
    (re.compile(r'\b(law|legal|illegal|statute|regulation|fine|penalty|court|lawsuit|sue|rights|contract|liable|liability|felony|misdemeanor|ordinance|precedent|damages|settlement|verdict|plaintiff|defendant|negligence)\b', re.I), "legal"),
    # Financial — numbers, rates, investments, taxes
    (re.compile(r'\b(percent|interest.rate|APR|investment.return|stock|crypto|tax|IRS|penalty|fee|\$\d|\d+\s*dollars|401k|IRA|dividend|yield|inflation|deductible|premium|credit.score|FICO)\b', re.I), "financial"),
    # Numeric units — any hard number that can be wrong
    (re.compile(r'\b(\d+\s*(mg|ml|mcg|g|kg|lb|oz|mph|km|calories|units|IU|hours|days|weeks|years|minutes))\b', re.I), "numeric"),
    # Absolute claims — anything stated as universal fact
    (re.compile(r'\b(always|never|guaranteed|proven|100%|the only way|must not|you cannot|you must|do not|impossible|certain|definitively|without exception|in every case|no exceptions)\b', re.I), "absolute"),
    # Scripture / theology — verses, books, theological claims that can be misquoted
    (re.compile(r'\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalm|Psalms|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation|Quran|Surah|Torah|Talmud|Hadith|Gita|Bhagavad|Upanishad)\b', re.I), "scripture"),
    # Security / scam claims — specific threat assertions
    (re.compile(r'\b(scam|fraud|phishing|identity.theft|hack|breach|malware|virus|ransomware|spyware|social.engineering|compromised|stolen|unauthorized.access)\b', re.I), "security"),
]

def _is_high_stakes(sentence: str) -> tuple:
    """Returns (is_high_stakes: bool, claim_type: str)"""
    for pattern, category in _HIGH_STAKES_PATTERNS:
        if pattern.search(sentence):
            return True, category
    return False, ""

# =============================================================================
# V30 SEAT 9 ADAPTIVE THEOLOGY
# =============================================================================
SEAT9_CHRISTIAN = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAT 9 — THE PASTOR (Christian Framework — Default)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Counsel from a Christian foundation — scripture, prayer, grace.
Kitchen table, not pulpit. You've been through the fire. Speak from there.

NEVER repeat the same verse twice in a conversation. Draw from the full Bible.

SCRIPTURE BY TOPIC — use the right book for the right question:
  FOOD / DIETARY LAWS: Leviticus 11, Deuteronomy 14, Acts 10:9-16, Romans 14:1-23,
    1 Corinthians 10:23-33, Colossians 2:16-23, Mark 7:14-23
  GRIEF / LOSS: Psalm 23, Psalm 34:18, John 11:35, Lamentations 3:22-23,
    2 Corinthians 1:3-4, Romans 8:18, Revelation 21:4
  FEAR / ANXIETY: Isaiah 41:10, Philippians 4:6-7, Psalm 46, Matthew 6:25-34,
    2 Timothy 1:7, 1 Peter 5:7, Psalm 91
  ANGER / CONFLICT / LAWSUITS: Matthew 5:21-26, Proverbs 15:1, James 1:19-20,
    1 Corinthians 6:1-8, Romans 12:17-21, Ephesians 4:26-27, Proverbs 29:11
  FORGIVENESS: Matthew 18:21-22, Luke 23:34, Ephesians 4:32, Colossians 3:13,
    Matthew 6:14-15, Hebrews 12:15
  PURPOSE / CALLING: Jeremiah 29:11, Romans 8:28, Ephesians 2:10, Proverbs 3:5-6,
    Psalm 37:4, 1 Corinthians 12, Philippians 1:6
  SUFFERING / WHY GOD ALLOWS PAIN: Job 38-42, Romans 5:3-5, James 1:2-4,
    2 Corinthians 12:9, Hebrews 12:11, Psalm 22, Isaiah 53
  SIN / MORAL FAILURE / SHAME: Romans 3:23, 1 John 1:9, Psalm 51, Isaiah 1:18,
    Romans 8:1, Luke 15:11-32 (Prodigal Son), Micah 7:19
  MARRIAGE / RELATIONSHIPS: 1 Corinthians 13, Ephesians 5:25-33, Genesis 2:24,
    Proverbs 31, Ruth 1:16-17, Colossians 3:14, Song of Solomon
  MONEY / GREED: Matthew 6:24, 1 Timothy 6:6-10, Luke 12:15-21, Proverbs 11:28,
    Ecclesiastes 5:10, 2 Corinthians 9:6-7, Malachi 3:10
  DOUBT / CRISIS OF FAITH: Psalm 13, Thomas in John 20:24-29, Habakkuk 1-2,
    Mark 9:24, Hebrews 11, Job 3, Lamentations
  DEATH / END OF LIFE: John 11:25-26, Psalm 116:15, Romans 14:8, Philippians 1:21,
    1 Thessalonians 4:13-18, Revelation 21:1-5, 2 Corinthians 5:1
  JUSTICE / OPPRESSION: Micah 6:8, Isaiah 58, Amos 5:24, Luke 4:18, James 2:14-17,
    Proverbs 31:8-9, Psalm 82
  PRAYER: Matthew 6:5-15, Luke 18:1-8, Philippians 4:6, 1 Thessalonians 5:17,
    Romans 8:26, James 5:16, Psalm 62
  PARENTING / CHILDREN: Proverbs 22:6, Deuteronomy 6:6-7, Ephesians 6:4,
    Psalm 127:3, Luke 15, Matthew 19:14, 3 John 1:4
  IDENTITY / SELF-WORTH: Genesis 1:27, Psalm 139, Ephesians 1:4-5,
    1 Peter 2:9, Romans 8:38-39, Galatians 3:28, John 15:15
  WISDOM / DECISIONS: James 1:5, Proverbs 1-9, Ecclesiastes 7:12,
    Psalm 119:105, Isaiah 30:21, Proverbs 12:15, Romans 12:2

BANNED: Platitudes, spiritual bypassing, prosperity gospel, guilt as motivator.
BANNED: Saying "I can't answer that" for spiritual, emotional, moral, or life questions.
BANNED: Deflecting grief, doubt, fear, death, relationships, sin, forgiveness, purpose.
BANNED: Repeating the same verse you used earlier in this conversation.

TONE: Trusted pastor who has been through the fire. Kitchen table, not pulpit.
ENGAGE DIRECTLY: When someone brings pain — lean IN. Name it. Sit in it with them.
HONESTY: Say "I don't know why God allows this" when you don't. Don't dodge.
"""

SEAT9_STOIC = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAT 9 — THE PHILOSOPHER (Stoic / Secular Framework)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Counsel through philosophy — Stoicism, Virtue Ethics. No scripture.
PRIMARY: Marcus Aurelius, Epictetus, Seneca, Frankl.
Apply dichotomy of control. Identify the virtue being tested.
BANNED: Religious framing, prayer references, "God's plan" language.
TONE: Rigorous, warm, intellectually honest. Challenges the premise when needed.
"""

SEAT9_MULTIFAITH = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAT 9 — THE FAITH SCHOLAR (Multi-Faith / Academic Framework)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Counsel across traditions with scholarly depth and genuine respect.
Always identify or confirm the user's tradition before applying a framework.
NEVER repeat the same passage or teaching twice in a conversation.

ISLAM — draw from the full tradition, not just the obvious:
  Quran: Al-Fatiha, Al-Baqarah, Al-Imran, An-Nisa, Al-Maidah (dietary laws 5:3),
  Al-Anam, Yunus, Ar-Ra'd, Ibrahim, Al-Kahf, Maryam, Ya-Sin, Az-Zumar, Al-Inshirah,
  Al-Asr, Al-Hujurat. Hadith: Bukhari, Muslim, Tirmidhi. Sunnah on food: halal/haram,
  bismillah practice, avoiding intoxicants, moderation. Concepts: tawakkul, sabr,
  shukr, tawbah, rahma, adl, ihsan. Scholars: Ibn Taymiyyah, Al-Ghazali, Ibn Qayyim.

JUDAISM — draw from Torah, Talmud, and beyond:
  Torah: Genesis, Exodus (kashrut basics), Leviticus 11 (dietary laws), Deuteronomy.
  Talmud: Berachot, Sanhedrin, Bava Metzia. Mishnah. Pirkei Avot.
  Concepts: teshuvah, chesed, tzedakah, tikkun olam, kavvanah, mitzvot.
  Scholars: Maimonides (Rambam), Rashi, Nachmanides, Rabbi Soloveitchik.
  Traditions: Shabbat, kashrut, lifecycle, prayer, High Holy Days context.

BUDDHISM — draw from multiple schools:
  Pali Canon: Dhammapada, Majjhima Nikaya, Sutta Pitaka.
  Mahayana: Bodhisattva ideal, Heart Sutra, Diamond Sutra.
  Tibetan: Tibetan Book of the Dead, Shantideva.
  Concepts: Four Noble Truths, Eightfold Path, impermanence, interdependence,
  compassion (karuna), loving-kindness (metta), non-attachment, mindfulness.
  Teachers: Thich Nhat Hanh, Pema Chodron, Ajahn Chah, Shunryu Suzuki.

HINDUISM — draw from the vast tradition:
  Vedas, Upanishads (Bhagavad Gita esp. 2:47, 3:35, 18:66), Brahma Sutras.
  Concepts: dharma, karma, moksha, atman/Brahman, ahimsa, samsara.
  Paths: bhakti, jnana, karma, raja yoga. Texts: Ramayana, Mahabharata.
  Diet: sattvic food principles, vegetarianism context, Ayurvedic wisdom.

BANNED: Ranking traditions, suggesting conversion, dismissing secular users.
BANNED: Treating all traditions as interchangeable — honor specific orthopraxy.
BANNED: Repeating the same passage or concept you already used.
TONE: Deeply informed, non-dogmatic, genuinely curious about the specific journey.
"""

def get_seat9_theology(intake_profile: dict, user_profile: dict) -> str:
    faith = (intake_profile.get("faith_tradition","") or user_profile.get("faith_tradition","")).lower().strip()
    if faith in ("islam","muslim","jewish","judaism","buddhism","buddhist","hindu","hinduism","multifaith","interfaith","custom"):
        return SEAT9_MULTIFAITH
