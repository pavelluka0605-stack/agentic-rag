#!/bin/bash
# =============================================================================
# PreToolUse[Bash] — защита от опасных команд + retrieval похожих ошибок
#
# Получает JSON на stdin: {"tool_name":"Bash","tool_input":{"command":"..."}}
# Stdout → feedback для Claude
# Exit 0 = разрешить, exit 2 = заблокировать
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat)

# Извлекаем команду через python3 (синхронный, надёжный)
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

# ── 1. Проверка деструктивных паттернов ──────────────────────────────────────

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

# ── 2. Retrieval похожих ошибок из памяти ────────────────────────────────────

if [ ${#CMD} -gt 20 ] && [ -n "$WARNINGS" ]; then
  SIMILAR=$(node "$HOOKS_DIR/lib/query-memory.js" similar-incidents "$CMD" 2>/dev/null | head -30)
  if [ -n "$SIMILAR" ] && [ "$SIMILAR" != "[]" ]; then
    WARNINGS="${WARNINGS}\n📋 Похожие прошлые инциденты:\n${SIMILAR}\n"
    WARNINGS="${WARNINGS}Проверь, не повторяешь ли известную ошибку.\n"
  fi
fi

# ── 3. Вывод ─────────────────────────────────────────────────────────────────

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS"
fi

exit 0
