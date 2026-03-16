#!/bin/bash
# =============================================================================
# PostToolUse[Agent] — логирование результатов subagent
#
# Записывает результат subagent'а, оценивает полезность.
# Сохраняет значимые результаты в лог для session-end.
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat)

# Извлекаем данные
eval "$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    desc = ti.get('description', '').replace(\"'\", \"'\\\\\\\\'\")
    agent_type = ti.get('subagent_type', 'general').replace(\"'\", \"'\\\\\\\\'\")
    # tool_output может быть строкой или объектом
    out = d.get('tool_output', '')
    if isinstance(out, dict):
        result = str(out.get('content', out.get('result', '')))[:300].replace(\"'\", \"'\\\\\\\\'\")
    else:
        result = str(out)[:300].replace(\"'\", \"'\\\\\\\\'\")
    print(f\"AGENT_DESC='{desc}'\")
    print(f\"AGENT_TYPE='{agent_type}'\")
    print(f\"AGENT_RESULT='{result}'\")
except:
    print(\"AGENT_TYPE='unknown'\")
" 2>/dev/null)"

if [ -z "$AGENT_TYPE" ] || [ "$AGENT_TYPE" = "unknown" ]; then
  exit 0
fi

# Логируем результат
AGENT_LOG="/tmp/claude-agents-$$"
TIMESTAMP=$(date +%H:%M:%S)
echo "$TIMESTAMP|${AGENT_TYPE}|done|${AGENT_DESC}" >> "$AGENT_LOG"

# Считаем количество subagent'ов в сессии
if [ -f "$AGENT_LOG" ]; then
  TOTAL=$(grep -c "|done|" "$AGENT_LOG" 2>/dev/null || echo "0")
  if [ "$TOTAL" -eq 5 ] || [ "$TOTAL" -eq 10 ] || [ "$TOTAL" -eq 20 ]; then
    echo "📊 Subagent'ов в сессии: $TOTAL"
  fi
fi

echo "✅ Subagent [$AGENT_TYPE] завершён: $AGENT_DESC"

exit 0
