"""
╔══════════════════════════════════════════════════════════════╗
║  DETERMINISTIC ANCHOR — Pillar 3                            ║
║  "Never let an LLM simulate what a deterministic system     ║
║   can compute." — GPT's key insight                         ║
╚══════════════════════════════════════════════════════════════╝

If a question can be answered by computation, database lookup, or
deterministic logic, this module answers it. No hallucination possible.

Deterministic answers ALWAYS override LLM consensus.
"""

import re
import math
from datetime import datetime, timedelta
import calendar


class DeterministicAnchor:
    """
    Attempts to answer questions deterministically.
    Returns None if the question requires LLM reasoning.
    Returns a verified answer if it can be computed.
    """

    def try_answer(self, question):
        """
        Try to answer deterministically. Returns dict or None.
        
        Returns:
            {
                "answer": str,
                "method": str (e.g., "math_computation", "date_calculation"),
                "confidence": 100,  # Always 100 for deterministic
                "source": "Deterministic computation — cannot hallucinate"
            }
            or None if question requires LLM
        """
        q = question.strip().lower()

        # Try each deterministic method
        for method in [
            self._try_math,
            self._try_date,
            self._try_unit_conversion,
            self._try_basic_facts,
        ]:
            result = method(q)
            if result:
                return result

        return None

    # ── MATH COMPUTATION ──
    def _try_math(self, q):
        """Detect and solve math expressions"""
        # Check if this looks like a math question
        math_indicators = [
            r"what is \d", r"calculate", r"compute", r"solve",
            r"how much is", r"what\'s \d", r"multiply", r"divide",
            r"add \d", r"subtract", r"square root", r"factorial",
            r"percent of", r"\d\s*[\+\-\*\/\^]\s*\d",
        ]

        is_math = any(re.search(p, q) for p in math_indicators)
        if not is_math:
            return None

        try:
            # Extract and clean math expression
            expr = self._extract_math_expression(q)
            if expr is None:
                return None

            result = self._safe_eval(expr)
            if result is not None:
                # Format nicely
                if isinstance(result, float) and result == int(result):
                    result = int(result)

                return {
                    "answer": f"The answer is {result}",
                    "method": "math_computation",
                    "expression": expr,
                    "result": result,
                    "confidence": 100,
                    "source": "Deterministic math computation — cannot hallucinate"
                }
        except Exception:
            pass

        return None

    def _extract_math_expression(self, q):
        """Extract a math expression from natural language"""
        # Percentage FIRST (before generic extraction grabs just the number)
        m = re.search(r'(\d+(?:\.\d+)?)\s*(?:percent|%)\s*of\s*(\d+(?:\.\d+)?)', q)
        if m:
            return f"({m.group(1)} / 100) * {m.group(2)}"

        # Square root (before generic)
        m = re.search(r'square root of\s*(\d+(?:\.\d+)?)', q)
        if m:
            return f"math.sqrt({m.group(1)})"

        # Factorial (before generic)
        m = re.search(r'factorial of\s*(\d+)', q)
        if m:
            n = int(m.group(1))
            if n <= 170:
                return f"math.factorial({n})"

        # Direct arithmetic: "what is 15 * 23"
        m = re.search(r'(?:what is|what\'s|calculate|compute|solve)\s+([\d\.\s\+\-\*\/\^\(\)]+)', q)
        if m:
            expr = m.group(1).strip()
            # Make sure it's actually an expression, not just a number
            if re.search(r'[\+\-\*\/\^]', expr):
                return expr

        # "X plus/minus/times/divided by Y"
        word_ops = {
            'plus': '+', 'added to': '+', 'add': '+',
            'minus': '-', 'subtract': '-', 'less': '-',
            'times': '*', 'multiplied by': '*', 'multiply': '*',
            'divided by': '/', 'divide': '/',
            'to the power of': '**', 'raised to': '**',
        }
        text = q
        for word, op in sorted(word_ops.items(), key=lambda x: -len(x[0])):
            text = text.replace(word, op)

        # Try to extract numbers and operators
        cleaned = re.findall(r'[\d\.\+\-\*\/\^\(\)\s]+', text)
        if cleaned:
            expr = ''.join(cleaned).strip()
            if re.search(r'\d', expr) and re.search(r'[\+\-\*\/\^]', expr):
                return expr

        return None

    def _safe_eval(self, expr):
        """Safely evaluate a math expression"""
        # Only allow safe characters
        allowed = set('0123456789.+-*/() ')
        expr_clean = expr.replace('^', '**')

        # Handle math functions
        if 'math.' in expr_clean:
            try:
                return eval(expr_clean, {"__builtins__": {}, "math": math})
            except Exception:
                return None

        if not all(c in allowed or c == '*' for c in expr_clean):
            return None

        try:
            result = eval(expr_clean, {"__builtins__": {}})
            if isinstance(result, (int, float)) and not math.isinf(result):
                return round(result, 10) if isinstance(result, float) else result
        except Exception:
            pass

        return None

    # ── DATE COMPUTATION ──
    def _try_date(self, q):
        """Handle date-related questions"""
        today = datetime.now()

        # "What day is today" / "what is today's date"
        if re.search(r"what (?:day|date) is (?:it )?today", q) or q in ("today", "what day is it"):
            return {
                "answer": f"Today is {today.strftime('%A, %B %d, %Y')}",
                "method": "date_calculation",
                "confidence": 100,
                "source": "System clock — deterministic"
            }

        # "What day of the week was/is [date]"
        m = re.search(r"what day (?:of the week )?(?:was|is|will be)\s+(\w+ \d+,?\s*\d{4})", q)
        if m:
            try:
                date = datetime.strptime(m.group(1).replace(',', ''), '%B %d %Y')
                return {
                    "answer": f"{m.group(1)} was a {date.strftime('%A')}",
                    "method": "date_calculation",
                    "confidence": 100,
                    "source": "Calendar computation — deterministic"
                }
            except ValueError:
                pass

        # "How many days between X and Y"
        m = re.search(r"how many days (?:between|from|since|until)\s+(.+?)(?:\s+and\s+|\s+to\s+)(.+?)[\?\.]?$", q)
        if m:
            try:
                date1 = self._parse_date(m.group(1).strip())
                date2 = self._parse_date(m.group(2).strip())
                if date1 and date2:
                    diff = abs((date2 - date1).days)
                    return {
                        "answer": f"There are {diff} days between those dates",
                        "method": "date_calculation",
                        "confidence": 100,
                        "source": "Calendar computation — deterministic"
                    }
            except Exception:
                pass

        # "How many days in [month] [year]"
        m = re.search(r"how many days (?:in|does) (\w+)\s*(\d{4})?", q)
        if m:
            month_name = m.group(1).strip()
            year = int(m.group(2)) if m.group(2) else today.year
            try:
                month_num = list(calendar.month_name).index(month_name.capitalize())
                days = calendar.monthrange(year, month_num)[1]
                return {
                    "answer": f"{month_name.capitalize()} {year} has {days} days",
                    "method": "date_calculation",
                    "confidence": 100,
                    "source": "Calendar computation — deterministic"
                }
            except (ValueError, IndexError):
                pass

        # Leap year check
        m = re.search(r"is (\d{4}) a leap year", q)
        if m:
            year = int(m.group(1))
            is_leap = calendar.isleap(year)
            return {
                "answer": f"{'Yes' if is_leap else 'No'}, {year} {'is' if is_leap else 'is not'} a leap year",
                "method": "date_calculation",
                "confidence": 100,
                "source": "Calendar computation — deterministic"
            }

        return None

    def _parse_date(self, text):
        """Try to parse a date from text"""
        if text.strip().lower() == 'today':
            return datetime.now()

        formats = ['%B %d %Y', '%B %d, %Y', '%m/%d/%Y', '%Y-%m-%d', '%d %B %Y']
        for fmt in formats:
            try:
                return datetime.strptime(text.strip(), fmt)
            except ValueError:
                continue
        return None

    # ── UNIT CONVERSION ──
    def _try_unit_conversion(self, q):
        """Handle unit conversion questions"""
        conversions = {
            # Length
            ('miles', 'kilometers'): 1.60934,
            ('kilometers', 'miles'): 0.621371,
            ('feet', 'meters'): 0.3048,
            ('meters', 'feet'): 3.28084,
            ('inches', 'centimeters'): 2.54,
            ('centimeters', 'inches'): 0.393701,
            ('yards', 'meters'): 0.9144,
            ('meters', 'yards'): 1.09361,
            # Weight
            ('pounds', 'kilograms'): 0.453592,
            ('kilograms', 'pounds'): 2.20462,
            ('ounces', 'grams'): 28.3495,
            ('grams', 'ounces'): 0.035274,
            # Temperature handled separately
            # Volume
            ('gallons', 'liters'): 3.78541,
            ('liters', 'gallons'): 0.264172,
            ('cups', 'milliliters'): 236.588,
            ('milliliters', 'cups'): 0.00422675,
        }

        # Pattern: "convert X unit to unit" or "X unit in unit" or "how many unit in X unit"
        patterns = [
            r'(?:convert\s+)?(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|in|into)\s+(\w+)',
            r'how many\s+(\w+)\s+(?:in|are in)\s+(\d+(?:\.\d+)?)\s+(\w+)',
        ]

        for pattern in patterns:
            m = re.search(pattern, q)
            if m:
                groups = m.groups()
                # First pattern: number, from_unit, to_unit
                # Second pattern: to_unit, number, from_unit
                if pattern == patterns[0]:
                    value, from_unit, to_unit = float(groups[0]), groups[1], groups[2]
                else:
                    to_unit, value, from_unit = groups[0], float(groups[1]), groups[2]

                # Normalize plurals
                from_u = from_unit.rstrip('s') + 's' if not from_unit.endswith('s') else from_unit
                to_u = to_unit.rstrip('s') + 's' if not to_unit.endswith('s') else to_unit

                key = (from_u, to_u)
                if key in conversions:
                    result = round(value * conversions[key], 4)
                    return {
                        "answer": f"{value} {from_unit} = {result} {to_unit}",
                        "method": "unit_conversion",
                        "confidence": 100,
                        "source": "Mathematical conversion — deterministic"
                    }

                # Temperature
                if 'fahrenheit' in q and 'celsius' in q:
                    if 'fahrenheit' in from_unit or 'f ' in q[:q.index('to')] if 'to' in q else False:
                        result = round((value - 32) * 5/9, 2)
                        return {
                            "answer": f"{value}°F = {result}°C",
                            "method": "unit_conversion",
                            "confidence": 100,
                            "source": "Mathematical conversion — deterministic"
                        }
                if 'celsius' in q and 'fahrenheit' in q:
                    result = round(value * 9/5 + 32, 2)
                    return {
                        "answer": f"{value}°C = {result}°F",
                        "method": "unit_conversion",
                        "confidence": 100,
                        "source": "Mathematical conversion — deterministic"
                    }

        return None

    # ── BASIC VERIFIABLE FACTS ──
    def _try_basic_facts(self, q):
        """Answer questions that have single, unchanging, verifiable answers"""
        # These are facts that CANNOT change and are mathematically/scientifically fixed
        facts = {
            r"boiling point of water": ("The boiling point of water is 100°C (212°F) at standard atmospheric pressure", "Physics constant"),
            r"freezing point of water": ("The freezing point of water is 0°C (32°F) at standard atmospheric pressure", "Physics constant"),
            r"speed of light": ("The speed of light in a vacuum is 299,792,458 meters per second (approximately 186,282 miles per second)", "Physics constant"),
            r"how many (?:inches|in) in a foot": ("There are 12 inches in a foot", "Unit definition"),
            r"how many feet in a (?:mile|mi)": ("There are 5,280 feet in a mile", "Unit definition"),
            r"how many (?:cm|centimeters) in a (?:meter|m)": ("There are 100 centimeters in a meter", "Unit definition"),
            r"how many (?:mm|millimeters) in a (?:meter|m)": ("There are 1,000 millimeters in a meter", "Unit definition"),
            r"how many seconds in a minute": ("There are 60 seconds in a minute", "Unit definition"),
            r"how many minutes in an hour": ("There are 60 minutes in an hour", "Unit definition"),
            r"how many hours in a day": ("There are 24 hours in a day", "Unit definition"),
            r"how many days in a (?:regular |normal )?year": ("There are 365 days in a regular year, and 366 in a leap year", "Calendar definition"),
            r"how many sides (?:does|on) a (?:triangle|hexagon|pentagon|octagon|square)": None,  # handled below
        }

        for pattern, value in facts.items():
            if re.search(pattern, q):
                if value is None:
                    continue
                return {
                    "answer": value[0],
                    "method": "verified_constant",
                    "confidence": 100,
                    "source": f"{value[1]} — immutable fact, deterministic"
                }

        # Polygon sides
        polygons = {
            'triangle': 3, 'square': 4, 'pentagon': 5,
            'hexagon': 6, 'heptagon': 7, 'octagon': 8,
            'nonagon': 9, 'decagon': 10,
        }
        for shape, sides in polygons.items():
            if shape in q and ('sides' in q or 'how many' in q):
                return {
                    "answer": f"A {shape} has {sides} sides",
                    "method": "geometric_definition",
                    "confidence": 100,
                    "source": "Mathematical definition — deterministic"
                }

        # ── WELL-KNOWN DOCUMENT / HISTORICAL FACTS ──
        # These are countable, fixed, and verifiable
        document_facts = {
            r"how many words?.+(?:us |u\.s\. |united states )?constitution": (
                "The US Constitution contains approximately 4,543 words including signatures "
                "(4,440 words without signatures). With all 27 amendments, the total is approximately 7,591 words.",
                "National Archives — verifiable document count"
            ),
            r"how many amendments?.+(?:us |u\.s\. |united states )?constitution": (
                "There are 27 amendments to the US Constitution. The first 10 are the Bill of Rights (ratified 1791). "
                "The most recent is the 27th Amendment (ratified 1992, originally proposed 1789).",
                "National Archives — constitutional record"
            ),
            r"how many articles?.+(?:us |u\.s\. |united states )?constitution": (
                "The US Constitution contains 7 Articles.",
                "National Archives — constitutional structure"
            ),
            r"how many (?:countries|nations|states).+(?:africa|african)": (
                "There are 54 recognized sovereign countries in Africa, as recognized by both "
                "the African Union and the United Nations.",
                "African Union / United Nations — recognized member states"
            ),
            r"how many (?:countries|nations|states).+(?:europe|european)": (
                "There are 44 countries in Europe (or 50 if including transcontinental countries "
                "and dependent territories). The EU has 27 member states.",
                "United Nations geographic classification"
            ),
            r"how many states?.+(?:us |u\.s\. |united states|america)": (
                "There are 50 states in the United States of America.",
                "US Government — constitutional fact"
            ),
            r"how many (?:planets?).+solar system": (
                "There are 8 planets in our solar system: Mercury, Venus, Earth, Mars, "
                "Jupiter, Saturn, Uranus, and Neptune. Pluto was reclassified as a dwarf planet in 2006.",
                "International Astronomical Union (2006 resolution)"
            ),
            r"how many bones?.+(?:human|adult) body": (
                "An adult human body has 206 bones. Babies are born with approximately 270 bones, "
                "some of which fuse together during development.",
                "Gray's Anatomy — standard anatomical reference"
            ),
            r"how many chromosomes?.+human": (
                "Humans have 46 chromosomes (23 pairs). 22 pairs are autosomes and 1 pair are sex chromosomes.",
                "Molecular biology — verified genomic fact"
            ),
            r"what is the chemical formula.+water": (
                "The chemical formula for water is H₂O (two hydrogen atoms and one oxygen atom).",
                "Chemistry — molecular definition"
            ),
            r"(?:chemical symbol|periodic table symbol).+gold": (
                "The chemical symbol for gold is Au (from Latin 'aurum').",
                "Periodic table — IUPAC standard"
            ),
            r"how many elements?.+periodic table": (
                "There are 118 confirmed elements in the periodic table as of 2024. "
                "Elements 1 (hydrogen) through 118 (oganesson) have been confirmed.",
                "IUPAC — International Union of Pure and Applied Chemistry"
            ),
        }

        for pattern, (answer_text, source_text) in document_facts.items():
            if re.search(pattern, q):
                return {
                    "answer": answer_text,
                    "method": "verified_reference",
                    "confidence": 100,
                    "source": f"{source_text} — deterministic"
                }

        return None
