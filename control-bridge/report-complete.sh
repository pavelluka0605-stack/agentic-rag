#!/bin/bash
# =============================================================================
# report-complete.sh — Claude Code calls this to report job results to Bridge API
#
# Usage:
#   bash report-complete.sh <job_id> <summary> [changes_made...]
#
# Or with env vars:
#   JOB_ID=xxx SUMMARY="done" CHANGES="file1.py,file2.py" bash report-complete.sh
#
# Reads BRIDGE_API_TOKEN from /opt/control-bridge/.env
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

# Parse args
JOB_ID="${1:-${JOB_ID:-}}"
SUMMARY="${2:-${SUMMARY:-Job completed}}"

if [ -z "$JOB_ID" ]; then
    echo "Usage: report-complete.sh <job_id> <summary>"
    exit 1
fi

# Build changes array from remaining args or CHANGES env var
CHANGES_JSON="[]"
if [ $# -gt 2 ]; then
    shift 2
    CHANGES_JSON=$(printf '%s\n' "$@" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))")
elif [ -n "${CHANGES:-}" ]; then
    CHANGES_JSON=$(echo "$CHANGES" | tr ',' '\n' | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))")
fi

# Git diff for auto-detecting changes
GIT_CHANGES="[]"
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
    GIT_CHANGES=$(git diff --name-only HEAD~1 2>/dev/null | head -20 | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))" 2>/dev/null || echo "[]")
fi

# Merge changes
if [ "$CHANGES_JSON" = "[]" ]; then
    CHANGES_JSON="$GIT_CHANGES"
fi

# Send completion
BODY=$(python3 -c "
import json
print(json.dumps({
    'summary': '''$SUMMARY''',
    'changes_made': $CHANGES_JSON,
}))
")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BRIDGE_URL}/jobs/${JOB_ID}/complete" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY")

if [ "$HTTP_CODE" = "200" ]; then
    echo "Job ${JOB_ID} reported as completed."
else
    echo "ERROR: Bridge API returned HTTP ${HTTP_CODE}"
    exit 1
fi
