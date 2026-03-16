#!/bin/bash
# =============================================================================
# PreToolUse[Bash] — защита от опасных команд + retrieval + session bootstrap
#
# Получает JSON на stdin: {"tool_name":"Bash","tool_input":{"command":"..."}}
# Stdout → feedback для Claude
# Exit 0 = разрешить, exit 2 = заблокировать
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat)

# ── 0. Session bootstrap (первый вызов) ───────────────────────────────────────

SESSION_FLAG="/tmp/claude-session-started-$$"
if [ ! -f "$SESSION_FLAG" ]; then
  touch "$SESSION_FLAG"
  PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || echo 'unknown')")
  BOOTSTRAP=$(node "$HOOKS_DIR/lib/session-bootstrap.js" "$PROJECT" 2>/dev/null)
  if [ -n "$BOOTSTRAP" ]; then
    echo "$BOOTSTRAP"
    echo ""
  fi
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  if [ -f "$ROOT/STATE.md" ]; then
    echo "📌 ОБЯЗАТЕЛЬНО: Прочитай STATE.md — там текущее состояние задач."
    echo ""
  fi
fi

# ── 1. Извлекаем команду ──────────────────────────────────────────────────────

CMD=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input',{}).get('command',''))
except:
    print('')
" 2>/dev/null)

if [ -z "$CMD" ]; then
  exit 0
fi

WARNINGS=""

# ── 2. Проверка деструктивных паттернов ───────────────────────────────────────

# Критические — блокируем
if echo "$CMD" | grep -qE '(rm\s+-rf\s+/[^a-z]|rm\s+-rf\s+/\s*$|mkfs\.|dd\s+if=.*of=/dev/)'; then
  echo "BLOCKED: Критически опасная команда: $CMD"
  echo "Эта команда может уничтожить систему. Отмена."
  exit 2
fi

# Опасные — предупреждаем
DANGEROUS_PATTERNS=(
  'git\s+push\s+--force|git\s+push\s+-f'
  'git\s+reset\s+--hard'
  'git\s+clean\s+-f'
  'git\s+checkout\s+--\s+\.'
  'rm\s+-rf'
  'DROP\s+(TABLE|DATABASE)'
  'kill\s+-9'
  'systemctl\s+(stop|disable|mask)\s+'
  'chmod\s+-R\s+777'
  'curl.*\|\s*(bash|sh)'
  'npm\s+publish'
  'docker\s+system\s+prune'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qiE "$pattern"; then
    WARNINGS="${WARNINGS}⚠ ОПАСНАЯ КОМАНДА: паттерн [$pattern]\n"
    break
  fi
done

# Файлы с секретами
if echo "$CMD" | grep -qiE '\.(env|pem|key|secret|credentials|google-sa)'; then
  WARNINGS="${WARNINGS}⚠ Команда работает с файлом, содержащим секреты.\n"
fi

# Длинные pipe-цепочки (потенциально опасные)
PIPE_COUNT=$(echo "$CMD" | tr -cd '|' | wc -c)
if [ "$PIPE_COUNT" -ge 5 ]; then
  WARNINGS="${WARNINGS}⚠ Сложная команда с ${PIPE_COUNT} pipes — проверь промежуточные результаты.\n"
fi

# ── 3. Retrieval похожих ошибок из памяти ─────────────────────────────────────

if [ ${#CMD} -gt 20 ]; then
  SIMILAR=$(node "$HOOKS_DIR/lib/query-memory.js" similar-incidents "$CMD" 2>/dev/null | head -30)
  if [ -n "$SIMILAR" ] && [ "$SIMILAR" != "[]" ]; then
    HAS_FIX=$(echo "$SIMILAR" | grep -c '"fix"' 2>/dev/null | tail -1 || echo "0")
    if [ "$HAS_FIX" -gt 0 ]; then
      WARNINGS="${WARNINGS}\n📋 Похожие прошлые инциденты С ФИКСАМИ:\n${SIMILAR}\nПроверь, не повторяешь ли известную ошибку.\n"
    elif [ -n "$WARNINGS" ]; then
      # Показываем инциденты только при наличии других предупреждений
      WARNINGS="${WARNINGS}\n📋 Похожие прошлые инциденты:\n${SIMILAR}\n"
    fi
  fi
fi

# ── 4. Retrieval policies (constraints) ───────────────────────────────────────

if [ -n "$WARNINGS" ]; then
  POLICIES=$(node "$HOOKS_DIR/lib/query-memory.js" policies 2>/dev/null | head -10)
  if [ -n "$POLICIES" ] && [ "$POLICIES" != "[]" ]; then
    WARNINGS="${WARNINGS}\n📜 Активные ограничения:\n${POLICIES}\n"
  fi
fi

# ── 5. Вывод ──────────────────────────────────────────────────────────────────

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS"
fi

exit 0
