#!/usr/bin/env bash
# =============================================================================
# LYLO OS — scripts/check_no_raw_logs.sh
# Pre-deploy guard: fails CI/CD if any logger call prints raw user content.
#
# Usage:
#   bash scripts/check_no_raw_logs.sh           # check all .py files in backend/
#   bash scripts/check_no_raw_logs.sh path/to/  # check specific directory
#
# Fails with exit code 1 if any violation found.
# Add to Render pre-deploy command or GitHub Actions.
# =============================================================================

set -euo pipefail

TARGET="${1:-backend/}"
VIOLATIONS=0

echo "🔍 Checking for raw user content in logger calls under: $TARGET"
echo ""

# ── Patterns that indicate raw user content being logged ──────────────────────
# These match f-strings where {msg}, {content}, {answer} etc. appear
# inside a logger.* call on the same line.
PATTERNS=(
    'logger\.[a-z]*.*\{msg[^_]'
    'logger\.[a-z]*.*\{msg\}'
    'logger\.[a-z]*.*\{content[^_]'
    'logger\.[a-z]*.*\{content\}'
    'logger\.[a-z]*.*\{answer[^_]'
    'logger\.[a-z]*.*\{answer\}'
    'logger\.[a-z]*.*\{text[^_]'
    'logger\.[a-z]*.*\{message[^_]'
    'logger\.[a-z]*.*\{query[^_]'
    'logger\.[a-z]*.*msg\[:.*\]'
    'logger\.[a-z]*.*content\[:.*\]'
    'logger\.[a-z]*.*answer\[:.*\]'
    'logger\.[a-z]*.*message\[:.*\]'
)

for PATTERN in "${PATTERNS[@]}"; do
    MATCHES=$(grep -rEn "$PATTERN" "$TARGET" \
        --include="*.py" \
        --exclude-dir=".git" \
        --exclude-dir="__pycache__" \
        --exclude-dir="venv" \
        --exclude-dir="node_modules" \
        2>/dev/null || true)

    if [ -n "$MATCHES" ]; then
        echo "❌ RAW USER CONTENT IN LOGGER — pattern: $PATTERN"
        echo "$MATCHES" | while IFS= read -r line; do
            echo "   $line"
        done
        echo ""
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done

# ── Special: check for safe_msg usage where raw slicing appears ───────────────
SLICE_MATCHES=$(grep -rEn 'logger\.[a-z]+\(f".*\{[a-z_]*(msg|content|answer|text)\[:' "$TARGET" \
    --include="*.py" \
    --exclude-dir=".git" \
    --exclude-dir="__pycache__" \
    2>/dev/null || true)

if [ -n "$SLICE_MATCHES" ]; then
    echo "❌ RAW SLICE IN LOGGER (use safe_msg() instead):"
    echo "$SLICE_MATCHES" | while IFS= read -r line; do
        echo "   $line"
    done
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# ── Result ─────────────────────────────────────────────────────────────────────
if [ "$VIOLATIONS" -gt 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ PREDEPLOY CHECK FAILED — $VIOLATIONS violation(s) found."
    echo ""
    echo "Fix: replace raw content with safe_msg() from services.log_helper"
    echo "   BEFORE: logger.warning(f\"Gate fired: {msg[:80]}\")"
    echo "   AFTER:  logger.warning(f\"Gate fired: {safe_msg(msg)}\")"
    echo ""
    echo "For local debugging only: LOG_USER_TEXT=1 python ... (never in prod)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
else
    echo "✅ PREDEPLOY CHECK PASSED — no raw user content found in logger calls."
    exit 0
fi
