#!/bin/bash
# =============================================================================
# report-review.sh — Claude Code requests human review via Bridge API
#
# Usage:
#   bash report-review.sh <job_id> <summary> [--question "..."] [--alt "..."]
#
# Sends review request → Telegram notification → GPT can discuss with user
# =============================================================================

set -euo pipefail

BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:3000}"

# Load token
if [ -f /opt/control-bridge/.env ]; then
    TOKEN=$(grep BRIDGE_API_TOKEN /opt/control-bridge/.env | cut -d= -f2-)
else
    echo "ERROR: /opt/control-bridge/.env not found"
    exit 1
fi

JOB_ID="${1:-}"
SUMMARY="${2:-}"

if [ -z "$JOB_ID" ] || [ -z "$SUMMARY" ]; then
    echo "Usage: report-review.sh <job_id> <summary> [--question '...'] [--alt '...'] [--risk '...']"
    exit 1
fi

shift 2

QUESTIONS=()
ALTERNATIVES=()
RISKS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --question) QUESTIONS+=("$2"); shift 2 ;;
        --alt)      ALTERNATIVES+=("$2"); shift 2 ;;
        --risk)     RISKS+=("$2"); shift 2 ;;
        *)          shift ;;
    esac
done

BODY=$(python3 -c "
import json, sys
print(json.dumps({
    'summary': '''${SUMMARY}''',
    'questions': $(python3 -c "import json; print(json.dumps([$(printf '"""%s""",' "${QUESTIONS[@]+"${QUESTIONS[@]}"}")]))"),
    'alternatives': $(python3 -c "import json; print(json.dumps([$(printf '"""%s""",' "${ALTERNATIVES[@]+"${ALTERNATIVES[@]}"}")]))"),
    'risks': $(python3 -c "import json; print(json.dumps([$(printf '"""%s""",' "${RISKS[@]+"${RISKS[@]}"}")]))"),
}))
")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BRIDGE_URL}/jobs/${JOB_ID}/review" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY")

if [ "$HTTP_CODE" = "200" ]; then
    echo "Review request sent for job ${JOB_ID}. User will be notified in Telegram."
else
    echo "ERROR: Bridge API returned HTTP ${HTTP_CODE}"
    exit 1
fi
