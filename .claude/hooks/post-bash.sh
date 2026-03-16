#!/bin/bash
# =============================================================================
# PostToolUse[Bash] — фиксация ошибок + трекинг успешных шагов + repair loop
#
# Получает JSON на stdin с результатом выполнения
# Stdout → feedback для Claude (рекомендации)
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat)

# Извлекаем данные через python3
eval "$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cmd = d.get('tool_input',{}).get('command','').replace(\"'\", \"'\\\\\\\\'\")
    # tool_output может быть строкой или объектом
    out = d.get('tool_output', '')
    if isinstance(out, dict):
        stdout_val = str(out.get('stdout',''))[:500].replace(\"'\", \"'\\\\\\\\'\")
        stderr_val = str(out.get('stderr',''))[:500].replace(\"'\", \"'\\\\\\\\'\")
        code = out.get('exit_code', 0)
    else:
        stdout_val = str(out)[:500].replace(\"'\", \"'\\\\\\\\'\")
        stderr_val = ''
        code = d.get('exit_code', 0)
    print(f\"CMD='{cmd}'\")
    print(f\"STDOUT='{stdout_val}'\")
    print(f\"STDERR='{stderr_val}'\")
    print(f'EXIT_CODE={code}')
except:
    print('EXIT_CODE=0')
" 2>/dev/null)"

# ── Успешная команда — трекинг значимых шагов ─────────────────────────────────

if [ "${EXIT_CODE:-0}" = "0" ]; then
  # Логируем успешные команды определённых типов
  SUCCESS_LOG="/tmp/claude-successes-$$"

  # Трекинг значимых успехов (git, npm, deploy, test, build)
  if echo "$CMD" | grep -qiE '(git\s+(commit|push|merge)|npm\s+(test|run\s+build|run\s+lint)|make\s|docker\s+build|deploy|pytest|cargo\s+(build|test))'; then
    TIMESTAMP=$(date +%H:%M:%S)
    echo "$TIMESTAMP|$CMD" >> "$SUCCESS_LOG"

    # Если это успешный git push — чистим repair файлы
    if echo "$CMD" | grep -qiE 'git\s+push'; then
      find /tmp -maxdepth 1 -name "claude-repair-*" -delete 2>/dev/null
    fi
  fi

  # Трекинг успешных тестов — потенциальная верификация фикса
  if echo "$CMD" | grep -qiE '(npm\s+test|pytest|cargo\s+test|go\s+test|make\s+test)'; then
    VERIFY_FLAG="/tmp/claude-verify-pending-$$"
    if [ -f "$VERIFY_FLAG" ]; then
      INCIDENT_ID=$(cat "$VERIFY_FLAG")
      echo "✅ Тест прошёл после фикса инцидента #${INCIDENT_ID}."
      echo "   Рекомендация: вызови incident_fix для #${INCIDENT_ID} и solution_add для решения."
      rm -f "$VERIFY_FLAG"
    fi
  fi

  exit 0
fi

# ── Неуспешная команда ────────────────────────────────────────────────────────

ERROR_MSG="${STDERR:-$STDOUT}"
if [ -z "$ERROR_MSG" ]; then
  exit 0
fi

# Пропускаем тривиальные ошибки
if [ ${#ERROR_MSG} -lt 10 ]; then
  exit 0
fi

echo "🔴 Bash exit code: $EXIT_CODE"

# ── 1. Записываем инцидент ────────────────────────────────────────────────────

PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || echo 'unknown')")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

INCIDENT_JSON=$(python3 -c "
import json, sys
print(json.dumps({
    'error_message': sys.argv[1][:500],
    'failed_command': sys.argv[2][:300],
    'context': 'branch: ' + sys.argv[3],
    'project': sys.argv[4]
}))
" "$ERROR_MSG" "$CMD" "$BRANCH" "$PROJECT" 2>/dev/null)

INCIDENT_RESULT=""
if [ -n "$INCIDENT_JSON" ]; then
  INCIDENT_RESULT=$(node "$HOOKS_DIR/lib/query-memory.js" add-incident "$INCIDENT_JSON" 2>/dev/null)
  if echo "$INCIDENT_RESULT" | grep -q '"deduplicated"'; then
    echo "📋 Ошибка уже встречалась ранее (повторное появление)."
    # Извлекаем ID для верификации
    INCIDENT_ID=$(echo "$INCIDENT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  else
    echo "📝 Записан новый инцидент."
    INCIDENT_ID=$(echo "$INCIDENT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  fi

  # Сохраняем ID для verify после фикса
  if [ -n "$INCIDENT_ID" ]; then
    echo "$INCIDENT_ID" > "/tmp/claude-verify-pending-$$"
  fi
fi

# ── 2. Поиск похожих инцидентов с фиксами ────────────────────────────────────

SIMILAR=$(node "$HOOKS_DIR/lib/query-memory.js" similar-incidents "$ERROR_MSG" 2>/dev/null)

if [ -n "$SIMILAR" ] && [ "$SIMILAR" != "[]" ]; then
  HAS_FIX=$(echo "$SIMILAR" | grep -c '"fix"' 2>/dev/null | tail -1 || echo "0")
  if [ "$HAS_FIX" -gt 0 ]; then
    echo ""
    echo "✅ Найдены похожие инциденты С ФИКСАМИ:"
    echo "$SIMILAR" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for i in data:
        if i.get('fix'):
            print(f\"  #{i['id']}: {i.get('error','')[:70]}\")
            print(f\"  Fix: {i['fix']}\")
            print()
except: pass
" 2>/dev/null
    echo "Попробуй применить один из этих фиксов."
  fi
fi

# ── 3. Поиск решений ─────────────────────────────────────────────────────────

SOLUTIONS=$(node "$HOOKS_DIR/lib/query-memory.js" similar-solutions "$ERROR_MSG" 2>/dev/null)
if [ -n "$SOLUTIONS" ] && [ "$SOLUTIONS" != "[]" ]; then
  echo ""
  echo "💡 Возможные решения из памяти:"
  echo "$SOLUTIONS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for s in data[:3]:
        v = ' ✓verified' if s.get('verified') else ''
        print(f\"  [{s.get('type','?')}] {s.get('title','')}{v}\")
except: pass
" 2>/dev/null
fi

# ── 4. Repair loop ────────────────────────────────────────────────────────────

REPAIR_COUNT_FILE="/tmp/claude-repair-$(echo "$ERROR_MSG" | md5sum | cut -c1-8)"
if [ -f "$REPAIR_COUNT_FILE" ]; then
  ATTEMPTS=$(cat "$REPAIR_COUNT_FILE")
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "$ATTEMPTS" > "$REPAIR_COUNT_FILE"

  if [ "$ATTEMPTS" -ge 2 ]; then
    REPAIR_OUTPUT=$(node "$HOOKS_DIR/lib/repair-loop.js" "$ERROR_MSG" "$CMD" "$ATTEMPTS" 2>/dev/null)
    if [ -n "$REPAIR_OUTPUT" ]; then
      echo ""
      echo "$REPAIR_OUTPUT"
    fi
  fi
else
  echo "1" > "$REPAIR_COUNT_FILE"
fi

# ── 5. Subagent рекомендации ────────────────────────────────────────────────

REPAIR_ATTEMPTS="${ATTEMPTS:-1}"
if [ "$REPAIR_ATTEMPTS" -ge 2 ]; then
  echo ""
  echo "🤖 Рекомендация по subagents:"
  echo "   1. Запусти incident-analyst (Explore, read-only) для глубокого анализа root cause"
  echo "   2. Затем repair-agent (general-purpose, worktree) для безопасного fix"
  echo "   3. Затем qa-verifier (haiku) для подтверждения"
fi

# ── 6. Очистка старых temp-файлов repair loop ─────────────────────────────────
find /tmp -maxdepth 1 -name "claude-repair-*" -mtime +1 -delete 2>/dev/null

exit 0
