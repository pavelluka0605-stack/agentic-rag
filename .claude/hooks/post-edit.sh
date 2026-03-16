#!/bin/bash
# =============================================================================
# PostToolUse[Edit|Write] — трекинг изменений файлов
#
# Фиксирует какие файлы были изменены в сессии.
# Отслеживает паттерны (много изменений в одном файле, инфра-файлы).
# =============================================================================

INPUT=$(cat)

# Извлекаем данные
eval "$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    tool = d.get('tool_name', '')
    ti = d.get('tool_input', {})
    fp = ti.get('file_path', '').replace(\"'\", \"'\\\\\\\\'\")
    print(f\"TOOL_NAME='{tool}'\")
    print(f\"FILE_PATH='{fp}'\")
except:
    print(\"FILE_PATH=''\")
" 2>/dev/null)"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Логируем изменённый файл
CHANGES_LOG="/tmp/claude-changes-$$"
echo "$FILE_PATH" >> "$CHANGES_LOG"

# Проверяем частоту изменений одного файла
if [ -f "$CHANGES_LOG" ]; then
  EDIT_COUNT=$(grep -c "^${FILE_PATH}$" "$CHANGES_LOG" 2>/dev/null || echo "0")
  if [ "$EDIT_COUNT" -ge 5 ]; then
    echo "⚠ Файл $FILE_PATH изменялся уже ${EDIT_COUNT} раз в этой сессии."
    echo "  Возможно стоит сделать паузу и проверить правильность подхода."
  fi
fi

# Предупреждение для инфра-файлов
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  Dockerfile|docker-compose*|nginx.conf|*.service|*.timer)
    echo "📝 Изменён инфраструктурный файл: $BASENAME — учти при деплое."
    ;;
  *.yml|*.yaml)
    if echo "$FILE_PATH" | grep -q ".github/workflows"; then
      echo "📝 Изменён CI/CD workflow: $BASENAME"
    fi
    ;;
esac

exit 0
