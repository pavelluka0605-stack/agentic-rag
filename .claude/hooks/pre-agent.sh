#!/bin/bash
# =============================================================================
# PreToolUse[Agent] — логирование запуска subagent
#
# Записывает в лог какой subagent запускается и зачем.
# Предупреждает о повторных вызовах тех же задач.
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat)

# Извлекаем данные subagent'а
eval "$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    desc = ti.get('description', '').replace(\"'\", \"'\\\\\\\\'\")
    prompt = ti.get('prompt', '')[:200].replace(\"'\", \"'\\\\\\\\'\")
    agent_type = ti.get('subagent_type', 'general').replace(\"'\", \"'\\\\\\\\'\")
    print(f\"AGENT_DESC='{desc}'\")
    print(f\"AGENT_PROMPT='{prompt}'\")
    print(f\"AGENT_TYPE='{agent_type}'\")
except:
    print(\"AGENT_TYPE='unknown'\")
" 2>/dev/null)"

if [ -z "$AGENT_TYPE" ] || [ "$AGENT_TYPE" = "unknown" ]; then
  exit 0
fi

# Логируем запуск
AGENT_LOG="/tmp/claude-agents-$$"
TIMESTAMP=$(date +%H:%M:%S)

echo "$TIMESTAMP|$AGENT_TYPE|$AGENT_DESC" >> "$AGENT_LOG"

# Проверяем повторные вызовы
if [ -f "$AGENT_LOG" ]; then
  SAME_COUNT=$(grep -c "|${AGENT_DESC}$" "$AGENT_LOG" 2>/dev/null || echo "0")
  if [ "$SAME_COUNT" -gt 2 ]; then
    echo "⚠ Subagent '$AGENT_DESC' вызывается уже ${SAME_COUNT}-й раз."
    echo "  Проверь, не зацикливание ли это."
  fi
fi

echo "🤖 Subagent [$AGENT_TYPE]: $AGENT_DESC"

exit 0
