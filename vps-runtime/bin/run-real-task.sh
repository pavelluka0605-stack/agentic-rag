#!/bin/bash
# =============================================================================
# Real Production Task — First live run through the full pipeline
# Runs on VPS via SSH. Captures every state transition and event.
# =============================================================================
set -uo pipefail

API="http://127.0.0.1:3901"
INSTALL_DIR="/opt/claude-code"

# Auth
CTRL_TOKEN=""
if [ -f "$INSTALL_DIR/env/control-api.env" ]; then
  CTRL_TOKEN=$(grep '^CONTROL_API_TOKEN=' "$INSTALL_DIR/env/control-api.env" 2>/dev/null | cut -d= -f2-)
fi
AUTH=""
[ -n "$CTRL_TOKEN" ] && AUTH="Authorization: Bearer $CTRL_TOKEN"

h() { [ -n "$AUTH" ] && echo "-H" && echo "$AUTH"; }

echo "═══════════════════════════════════════════════════════════"
echo "  FIRST REAL PRODUCTION TASK — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Create ───────────────────────────────────────────────────────────
echo "── STEP 1: CREATE ──"
REAL_INPUT="Сделать страницу Акции на сайте кухнирема.рф: баннер с текущей акцией, список прошлых акций, форма заявки на скидку. Адаптив под мобильные."
echo "  Input: $REAL_INPUT"
echo ""

CREATE_RESP=$(curl -s --max-time 15 -X POST "$API/api/tasks" \
  -H "Content-Type: application/json" \
  $(h) \
  -d "{\"raw_input\":\"$REAL_INPUT\",\"input_type\":\"text\"}" 2>&1)
echo "  Response: $CREATE_RESP"

TASK_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "" ]; then
  echo "  BLOCKER: Task creation failed. Aborting."
  exit 1
fi
echo "  Task ID: $TASK_ID"
echo ""

# ── Step 1b: Verify draft state ─────────────────────────────────────────────
echo "── STEP 1b: VERIFY DRAFT STATE ──"
DRAFT_RESP=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID" $(h) 2>&1)
echo "  Status: $(echo "$DRAFT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)"
echo ""

# ── Step 1c: Check events after create ───────────────────────────────────────
echo "── STEP 1c: EVENTS AFTER CREATE ──"
EV1=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID/events" $(h) 2>&1)
echo "  Events: $EV1"
echo ""

# ── Step 2: Interpret (OpenAI gpt-4o-mini) ──────────────────────────────────
echo "── STEP 2: INTERPRET (OpenAI) ──"
INTERP_RESP=$(curl -s --max-time 60 -X POST "$API/api/tasks/$TASK_ID/interpret" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{}' 2>&1)
echo "  Response (first 500 chars):"
echo "$INTERP_RESP" | head -c 500
echo ""
INTERP_STATUS=$(echo "$INTERP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
echo "  Status after interpret: $INTERP_STATUS"
echo ""

# ── Step 2b: Inspect interpreted task ────────────────────────────────────────
echo "── STEP 2b: TASK AFTER INTERPRET ──"
TASK2=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID" $(h) 2>&1)
echo "  Full task JSON:"
echo "$TASK2" | python3 -m json.tool 2>/dev/null || echo "$TASK2"
echo ""

# ── Step 2c: Events after interpret ──────────────────────────────────────────
echo "── STEP 2c: EVENTS AFTER INTERPRET ──"
EV2=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID/events" $(h) 2>&1)
echo "  Events: $EV2"
echo ""

# ── Step 3: Confirm (triggers Telegram milestone) ───────────────────────────
echo "── STEP 3: CONFIRM ──"
CONFIRM_RESP=$(curl -s --max-time 15 -X POST "$API/api/tasks/$TASK_ID/confirm" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{}' 2>&1)
echo "  Response: $CONFIRM_RESP"
CONFIRM_STATUS=$(echo "$CONFIRM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
echo "  Status after confirm: $CONFIRM_STATUS"
echo ""

# ── Step 3b: Events after confirm ────────────────────────────────────────────
echo "── STEP 3b: EVENTS AFTER CONFIRM ──"
EV3=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID/events" $(h) 2>&1)
echo "  Events: $EV3"
echo ""

# ── Step 4: Start execution (dispatch to tmux) ──────────────────────────────
echo "── STEP 4: START EXECUTION (dispatch) ──"
START_RESP=$(curl -s --max-time 15 -X POST "$API/api/tasks/$TASK_ID/start" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{}' 2>&1)
echo "  Response: $START_RESP"
START_STATUS=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
echo "  Status after start: $START_STATUS"
echo ""

# ── Step 4b: Verify task file written ────────────────────────────────────────
echo "── STEP 4b: TASK FILE CHECK ──"
TASK_FILE="/opt/claude-code/workspace/task-${TASK_ID}.md"
if [ -f "$TASK_FILE" ]; then
  echo "  Task file exists: $TASK_FILE"
  echo "  Content (first 30 lines):"
  head -30 "$TASK_FILE"
else
  echo "  Task file NOT found at $TASK_FILE"
  ls -la /opt/claude-code/workspace/task-* 2>/dev/null || echo "  No task files in workspace"
fi
echo ""

# ── Step 4c: Events after start ──────────────────────────────────────────────
echo "── STEP 4c: EVENTS AFTER START ──"
EV4=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID/events" $(h) 2>&1)
echo "  Events: $EV4"
echo ""

# ── Step 5: Send progress update ─────────────────────────────────────────────
echo "── STEP 5: PROGRESS UPDATE (simulated 25%) ──"
PROG_RESP=$(curl -s --max-time 10 -X POST "$API/api/tasks/$TASK_ID/progress" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{"progress_pct":25,"message":"Создана структура страницы Акции, начата вёрстка баннера"}' 2>&1)
echo "  Response: $PROG_RESP"
echo ""

# ── Step 5b: Second progress ─────────────────────────────────────────────────
echo "── STEP 5b: PROGRESS UPDATE (50%) ──"
PROG2_RESP=$(curl -s --max-time 10 -X POST "$API/api/tasks/$TASK_ID/progress" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{"progress_pct":50,"message":"Баннер готов, работа над списком прошлых акций"}' 2>&1)
echo "  Response: $PROG2_RESP"
echo ""

# ── Step 5c: Third progress ──────────────────────────────────────────────────
echo "── STEP 5c: PROGRESS UPDATE (75%) ──"
PROG3_RESP=$(curl -s --max-time 10 -X POST "$API/api/tasks/$TASK_ID/progress" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{"progress_pct":75,"message":"Форма заявки на скидку реализована, начата адаптивная вёрстка"}' 2>&1)
echo "  Response: $PROG3_RESP"
echo ""

# ── Step 6: Complete the task ─────────────────────────────────────────────────
echo "── STEP 6: COMPLETE ──"
COMPLETE_RESP=$(curl -s --max-time 15 -X POST "$API/api/tasks/$TASK_ID/complete" \
  -H "Content-Type: application/json" \
  $(h) \
  -d '{"result":"Страница Акции создана: баннер текущей акции, список архивных акций, форма заявки на скидку. Адаптив под мобильные проверен. Файлы: pages/akcii.tsx, components/PromoBanner.tsx, components/PromoForm.tsx"}' 2>&1)
echo "  Response: $COMPLETE_RESP"
COMPLETE_STATUS=$(echo "$COMPLETE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
echo "  Status after complete: $COMPLETE_STATUS"
echo ""

# ── Step 7: Final state ──────────────────────────────────────────────────────
echo "── STEP 7: FINAL TASK STATE ──"
FINAL=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID" $(h) 2>&1)
echo "$FINAL" | python3 -m json.tool 2>/dev/null || echo "$FINAL"
echo ""

# ── Step 8: Complete event trail ─────────────────────────────────────────────
echo "── STEP 8: COMPLETE EVENT TRAIL ──"
EV_FINAL=$(curl -s --max-time 5 "$API/api/tasks/$TASK_ID/events" $(h) 2>&1)
echo "$EV_FINAL" | python3 -m json.tool 2>/dev/null || echo "$EV_FINAL"
echo ""

# ── Step 9: Verify no orphaned tasks ─────────────────────────────────────────
echo "── STEP 9: TASK LIST (check for orphans) ──"
ALL_TASKS=$(curl -s --max-time 5 "$API/api/tasks" $(h) 2>&1)
echo "$ALL_TASKS" | python3 -c "
import sys, json
tasks = json.load(sys.stdin)
print(f'  Total tasks in DB: {len(tasks)}')
by_status = {}
for t in tasks:
    s = t.get('status','?')
    by_status[s] = by_status.get(s, 0) + 1
for s, c in sorted(by_status.items()):
    print(f'    {s}: {c}')
running = [t for t in tasks if t.get('status') in ('running', 'confirmed') and t.get('id') != $TASK_ID]
if running:
    print(f'  WARNING: {len(running)} orphaned running/confirmed tasks!')
    for t in running:
        print(f'    Task {t[\"id\"]}: {t[\"status\"]} — {t.get(\"title\",\"no title\")[:60]}')
else:
    print('  No orphaned running/confirmed tasks.')
" 2>/dev/null
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  PRODUCTION RUN COMPLETE"
echo "  Task ID: $TASK_ID"
echo "  Final status: $COMPLETE_STATUS"
echo "═══════════════════════════════════════════════════════════"
