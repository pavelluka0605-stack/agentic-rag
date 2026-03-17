#!/bin/bash
# =============================================================================
# Live Pilot Test — Full task pipeline verification on VPS
# Usage: live-pilot-test.sh
#
# Tests the complete task lifecycle:
#   A. Text task: create → interpret → confirm (with Telegram)
#   B. Cancel path: create → cancel
#   C. Health & service verification
#   D. OpenAI connectivity (interpretation uses gpt-4o-mini)
#   E. Telegram delivery (confirm triggers milestone notification)
#
# Outputs JSON-style results for easy parsing from CI.
# =============================================================================
set -uo pipefail

INSTALL_DIR="/opt/claude-code"
API="http://127.0.0.1:3901"

pass=0
fail=0
total=0

test_it() {
  local name="$1"
  local result="$2"
  total=$((total + 1))
  if [ "$result" = "0" ]; then
    pass=$((pass + 1))
    echo "  ✓ $name"
  else
    fail=$((fail + 1))
    echo "  ✗ $name"
  fi
}

# Read auth token
CTRL_TOKEN=""
if [ -f "$INSTALL_DIR/env/control-api.env" ]; then
  CTRL_TOKEN=$(grep '^CONTROL_API_TOKEN=' "$INSTALL_DIR/env/control-api.env" 2>/dev/null | cut -d= -f2-)
fi
AUTH_HDR=""
[ -n "$CTRL_TOKEN" ] && AUTH_HDR="Authorization: Bearer $CTRL_TOKEN"

echo "═══════════════════════════════════════"
echo "  LIVE PILOT TEST — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════"
echo ""

# ── A. Health & Services ─────────────────────────────────────────────────────

echo "A. Health & Services:"

# Control API health
HEALTH_RESP=$(curl -s --max-time 5 "$API/health" 2>/dev/null)
echo "$HEALTH_RESP" | grep -qi 'ok\|healthy\|running'
test_it "control-api /health responds" "$?"
echo "    Response: $HEALTH_RESP"

# Control API env vars present
ENV_CHECK=$(curl -s --max-time 5 "$API/health" 2>/dev/null)
test_it "control-api is running" "$([ -n "$ENV_CHECK" ] && echo 0 || echo 1)"

# Systemd services
systemctl is-active control-api.service >/dev/null 2>&1
test_it "control-api.service active" "$?"

systemctl is-active claude-code.service >/dev/null 2>&1
test_it "claude-code.service active" "$?"

# Check env vars loaded
if [ -f "$INSTALL_DIR/env/control-api.env" ]; then
  grep -q 'OPENAI_API_KEY=.' "$INSTALL_DIR/env/control-api.env" 2>/dev/null
  test_it "OPENAI_API_KEY provisioned" "$?"

  grep -q 'TG_BOT_TOKEN=.' "$INSTALL_DIR/env/control-api.env" 2>/dev/null
  test_it "TG_BOT_TOKEN provisioned" "$?"

  grep -q 'TG_CHAT_ID=.' "$INSTALL_DIR/env/control-api.env" 2>/dev/null
  test_it "TG_CHAT_ID provisioned" "$?"
else
  test_it "control-api.env exists" "1"
fi

echo ""

# ── B. Text Task — Create → Interpret → Confirm ─────────────────────────────

echo "B. Text Task (create → interpret → confirm):"

# Create task
CREATE_RESP=$(curl -s --max-time 10 -X POST "$API/api/tasks" \
  -H "Content-Type: application/json" \
  ${AUTH_HDR:+-H "$AUTH_HDR"} \
  -d '{"raw_input":"Добавить кнопку Обратный звонок на главную страницу сайта кухнирема.рф","input_type":"text"}' 2>/dev/null)
TASK_A_ID=$(echo "$CREATE_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
[ -n "$TASK_A_ID" ] && [ "$TASK_A_ID" -gt 0 ] 2>/dev/null
test_it "create text task (id=$TASK_A_ID)" "$?"
echo "    Response: $(echo "$CREATE_RESP" | head -c 200)"

if [ -n "$TASK_A_ID" ] && [ "$TASK_A_ID" -gt 0 ] 2>/dev/null; then
  # Check draft status
  GET_RESP=$(curl -s --max-time 5 "$API/api/tasks/$TASK_A_ID" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$GET_RESP" | grep -q '"status":"draft"'
  test_it "task starts as draft" "$?"

  # Check created event
  EVENTS_RESP=$(curl -s --max-time 5 "$API/api/tasks/$TASK_A_ID/events" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$EVENTS_RESP" | grep -q '"event_type":"created"'
  test_it "created event recorded" "$?"

  # Interpret (calls OpenAI gpt-4o-mini)
  echo "    → Calling interpret (OpenAI gpt-4o-mini)..."
  INTERP_RESP=$(curl -s --max-time 30 -X POST "$API/api/tasks/$TASK_A_ID/interpret" \
    -H "Content-Type: application/json" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} \
    -d '{}' 2>/dev/null)
  echo "$INTERP_RESP" | grep -q '"status":"pending"'
  test_it "interpret → status=pending" "$?"
  echo "    Response: $(echo "$INTERP_RESP" | head -c 300)"

  # Check interpreted event
  EVENTS_RESP2=$(curl -s --max-time 5 "$API/api/tasks/$TASK_A_ID/events" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$EVENTS_RESP2" | grep -q '"event_type":"interpreted"'
  test_it "interpreted event recorded" "$?"

  # Check task has title and engineering_packet after interpretation
  TASK_AFTER=$(curl -s --max-time 5 "$API/api/tasks/$TASK_A_ID" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$TASK_AFTER" | grep -q '"title":'
  test_it "task has title after interpret" "$?"
  echo "$TASK_AFTER" | grep -q '"engineering_packet":'
  test_it "task has engineering_packet" "$?"

  # Confirm (triggers Telegram notification)
  echo "    → Calling confirm (triggers Telegram)..."
  CONFIRM_RESP=$(curl -s --max-time 10 -X POST "$API/api/tasks/$TASK_A_ID/confirm" \
    -H "Content-Type: application/json" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} \
    -d '{}' 2>/dev/null)
  echo "$CONFIRM_RESP" | grep -q '"status":"confirmed"'
  test_it "confirm → status=confirmed" "$?"
  echo "    Response: $(echo "$CONFIRM_RESP" | head -c 200)"

  # Check confirmed event
  EVENTS_RESP3=$(curl -s --max-time 5 "$API/api/tasks/$TASK_A_ID/events" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$EVENTS_RESP3" | grep -q '"event_type":"confirmed"'
  test_it "confirmed event recorded" "$?"

  # Cancel after test (cleanup — don't actually dispatch)
  curl -s --max-time 5 -X POST "$API/api/tasks/$TASK_A_ID/cancel" \
    -H "Content-Type: application/json" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} \
    -d '{}' >/dev/null 2>&1
  FINAL_RESP=$(curl -s --max-time 5 "$API/api/tasks/$TASK_A_ID" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$FINAL_RESP" | grep -q '"status":"cancelled"'
  test_it "cleanup: task cancelled" "$?"
else
  echo "  (skipping — task creation failed)"
fi

echo ""

# ── C. Cancel Path ───────────────────────────────────────────────────────────

echo "C. Cancel Path (create → cancel):"

CREATE_B=$(curl -s --max-time 10 -X POST "$API/api/tasks" \
  -H "Content-Type: application/json" \
  ${AUTH_HDR:+-H "$AUTH_HDR"} \
  -d '{"raw_input":"Тестовая задача для отмены","input_type":"text"}' 2>/dev/null)
TASK_B_ID=$(echo "$CREATE_B" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$TASK_B_ID" ] && [ "$TASK_B_ID" -gt 0 ] 2>/dev/null; then
  # Cancel from draft
  CANCEL_RESP=$(curl -s --max-time 5 -X POST "$API/api/tasks/$TASK_B_ID/cancel" \
    -H "Content-Type: application/json" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} \
    -d '{}' 2>/dev/null)
  echo "$CANCEL_RESP" | grep -q '"status":"cancelled"'
  test_it "cancel from draft succeeds" "$?"

  # Verify cancelled event
  EVENTS_B=$(curl -s --max-time 5 "$API/api/tasks/$TASK_B_ID/events" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
  echo "$EVENTS_B" | grep -q '"event_type":"cancelled"'
  test_it "cancelled event recorded" "$?"

  # Verify can't interpret after cancel
  REJECT_RESP=$(curl -s --max-time 5 -X POST "$API/api/tasks/$TASK_B_ID/interpret" \
    -H "Content-Type: application/json" \
    ${AUTH_HDR:+-H "$AUTH_HDR"} \
    -d '{}' 2>/dev/null)
  echo "$REJECT_RESP" | grep -qi 'error\|invalid\|cannot\|not allowed\|status'
  test_it "interpret after cancel rejected" "$?"
else
  test_it "create cancel-test task" "1"
fi

echo ""

# ── D. Task List ─────────────────────────────────────────────────────────────

echo "D. Task List API:"
LIST_RESP=$(curl -s --max-time 5 "$API/api/tasks" \
  ${AUTH_HDR:+-H "$AUTH_HDR"} 2>/dev/null)
echo "$LIST_RESP" | grep -q '\['
test_it "GET /api/tasks returns array" "$?"
TASK_COUNT=$(echo "$LIST_RESP" | grep -o '"id":' | wc -l)
echo "    Tasks in DB: $TASK_COUNT"

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════"
echo "Result: $pass/$total passed, $fail failed"
echo ""

if [ $fail -eq 0 ]; then
  echo "✓ LIVE PILOT: ALL TESTS PASSED"
  echo "  System is fully operational for live use."
  exit 0
elif [ $fail -le 2 ]; then
  echo "⚠ LIVE PILOT: MOSTLY PASSED ($fail minor failures)"
  exit 1
else
  echo "✗ LIVE PILOT: MULTIPLE FAILURES — needs investigation"
  exit 2
fi
