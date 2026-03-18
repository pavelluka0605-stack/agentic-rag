#!/bin/bash
# =============================================================================
# Task Executor — runs a task file and reports progress back via control-api
#
# Usage: exec-task.sh <task-id> <task-file>
#
# Lifecycle:
#   1. Validate task file exists and is readable
#   2. POST first progress ("Исполнитель запущен")
#   3. Execute task via claude -p (non-interactive, print mode)
#   4. POST completion or failure based on exit code
#
# This script is spawned by the control-api dispatch handler.
# It runs in the background — the dispatch does not wait for it.
# =============================================================================
set -uo pipefail

TASK_ID="${1:-}"
TASK_FILE="${2:-}"
INSTALL_DIR="/opt/claude-code"
API="http://127.0.0.1:3901"
LOG_DIR="${CLAUDE_LOG_DIR:-$INSTALL_DIR/logs}"
EXEC_LOG="$LOG_DIR/exec-task-${TASK_ID}.log"

# Auth
CTRL_TOKEN=""
if [ -f "$INSTALL_DIR/env/control-api.env" ]; then
  CTRL_TOKEN=$(grep '^CONTROL_API_TOKEN=' "$INSTALL_DIR/env/control-api.env" 2>/dev/null | cut -d= -f2-)
fi

auth_header() {
  if [ -n "$CTRL_TOKEN" ]; then
    echo "-H"
    echo "Authorization: Bearer $CTRL_TOKEN"
  fi
}

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$EXEC_LOG"
}

api_post() {
  local endpoint="$1"
  local data="$2"
  curl -s --max-time 10 -X POST "$API/api/tasks/$TASK_ID/$endpoint" \
    -H "Content-Type: application/json" \
    $(auth_header) \
    -d "$data" 2>/dev/null
}

# ── Validate inputs ─────────────────────────────────────────────────────────

if [ -z "$TASK_ID" ] || [ -z "$TASK_FILE" ]; then
  echo "Usage: exec-task.sh <task-id> <task-file>" >&2
  exit 1
fi

if [ ! -f "$TASK_FILE" ]; then
  log "FATAL: Task file not found: $TASK_FILE"
  api_post "fail" '{"error":"Исполнитель: файл задачи не найден"}'
  exit 1
fi

mkdir -p "$LOG_DIR"

log "=== Executor started for task #$TASK_ID ==="
log "Task file: $TASK_FILE"

# ── First progress: executor alive ──────────────────────────────────────────

FIRST_PROGRESS=$(api_post "progress" '{"message_ru":"Исполнитель запущен, читаю задачу...","pct":0}')
log "First progress sent: $FIRST_PROGRESS"

# ── Check claude CLI availability ───────────────────────────────────────────

if ! command -v claude >/dev/null 2>&1; then
  log "FATAL: claude CLI not found in PATH"
  api_post "fail" '{"error":"Исполнитель: claude CLI не найден на сервере"}'
  exit 1
fi

# ── Read task content ───────────────────────────────────────────────────────

TASK_CONTENT=$(cat "$TASK_FILE")

# ── Build prompt for claude ─────────────────────────────────────────────────

PROMPT="You are executing a task from the dashboard task pipeline.

TASK FILE CONTENTS:
$TASK_CONTENT

IMPORTANT INSTRUCTIONS:
1. Execute the task described above
2. Work in the /opt/claude-code/workspace directory
3. Be thorough but concise
4. When done, output a clear summary of what was accomplished

Do NOT call any API endpoints — just do the work and output results."

# ── Report analysis phase ───────────────────────────────────────────────────

api_post "progress" '{"message_ru":"Анализирую задачу и планирую выполнение...","pct":10,"phase_id":"analysis","phase_status":"active","step_index":0,"step_status":"done"}'
log "Analysis phase started"

# ── Execute via claude -p with heartbeat ────────────────────────────────────

log "Starting claude -p execution..."

CLAUDE_OUTPUT_FILE="$LOG_DIR/exec-output-${TASK_ID}.txt"
EXECUTION_TIMEOUT=${CLAUDE_EXEC_TIMEOUT:-600}  # 10 min default

# Background heartbeat: send progress every 30s while claude is running
_heartbeat_pid=""
_start_heartbeat() {
  (
    local elapsed=0
    while true; do
      sleep 30
      elapsed=$((elapsed + 30))
      local pct=$((10 + elapsed * 70 / EXECUTION_TIMEOUT))
      [ $pct -gt 80 ] && pct=80
      api_post "progress" "{\"message_ru\":\"Выполняется... (${elapsed}с)\",\"pct\":$pct,\"phase_id\":\"implementation\",\"phase_status\":\"active\"}" >/dev/null 2>&1
    done
  ) &
  _heartbeat_pid=$!
}

_stop_heartbeat() {
  if [ -n "$_heartbeat_pid" ]; then
    kill "$_heartbeat_pid" 2>/dev/null
    wait "$_heartbeat_pid" 2>/dev/null
    _heartbeat_pid=""
  fi
}
trap _stop_heartbeat EXIT

_start_heartbeat

# Run claude in print mode with timeout
timeout "$EXECUTION_TIMEOUT" claude -p "$PROMPT" > "$CLAUDE_OUTPUT_FILE" 2>&1
CLAUDE_EXIT=$?

_stop_heartbeat

if [ $CLAUDE_EXIT -eq 124 ]; then
  log "claude -p timed out after ${EXECUTION_TIMEOUT}s"
else
  log "claude -p exited with code: $CLAUDE_EXIT"
fi

# ── Read output ─────────────────────────────────────────────────────────────

CLAUDE_OUTPUT=""
if [ -f "$CLAUDE_OUTPUT_FILE" ]; then
  CLAUDE_OUTPUT=$(cat "$CLAUDE_OUTPUT_FILE")
  log "Output length: ${#CLAUDE_OUTPUT} chars"
fi

# Truncate for API (max ~4000 chars for JSON safety)
RESULT_DETAIL="${CLAUDE_OUTPUT:0:4000}"
# Escape for JSON
RESULT_DETAIL_JSON=$(printf '%s' "$RESULT_DETAIL" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"(output encoding error)"')

# ── Report result ───────────────────────────────────────────────────────────

if [ $CLAUDE_EXIT -eq 124 ]; then
  # Timeout
  ERROR_MSG="Исполнитель: claude превысил таймаут (${EXECUTION_TIMEOUT}с)"
  if [ -n "$CLAUDE_OUTPUT" ]; then
    ERROR_MSG="$ERROR_MSG. Частичный вывод: ${CLAUDE_OUTPUT:0:300}"
  fi
  ERROR_JSON=$(printf '%s' "$ERROR_MSG" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"Таймаут исполнителя"')
  api_post "fail" "{\"error\":$ERROR_JSON}"
  log "Task #$TASK_ID timed out"
elif [ $CLAUDE_EXIT -eq 0 ] && [ -n "$CLAUDE_OUTPUT" ]; then
  # Success — report implementation phase done, then complete
  api_post "progress" '{"message_ru":"Выполнение завершено, формирую результат...","pct":90,"phase_id":"implementation","phase_status":"done"}'

  # Build completion summary (first 500 chars of output as summary)
  SUMMARY="${CLAUDE_OUTPUT:0:500}"
  SUMMARY_JSON=$(printf '%s' "$SUMMARY" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"Задача выполнена"')

  api_post "complete" "{\"result_summary_ru\":$SUMMARY_JSON,\"result_detail\":$RESULT_DETAIL_JSON}"
  log "Task #$TASK_ID completed successfully"
else
  # Failure
  if [ -z "$CLAUDE_OUTPUT" ]; then
    ERROR_MSG="Исполнитель: claude не вернул результат (exit code: $CLAUDE_EXIT)"
  else
    ERROR_EXCERPT="${CLAUDE_OUTPUT:0:500}"
    ERROR_MSG="Исполнитель завершился с ошибкой (exit $CLAUDE_EXIT): $ERROR_EXCERPT"
  fi
  ERROR_JSON=$(printf '%s' "$ERROR_MSG" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"Неизвестная ошибка исполнителя"')

  api_post "fail" "{\"error\":$ERROR_JSON}"
  log "Task #$TASK_ID failed: $ERROR_MSG"
fi

log "=== Executor finished for task #$TASK_ID ==="
