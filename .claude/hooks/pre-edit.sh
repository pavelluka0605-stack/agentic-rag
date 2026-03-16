#!/bin/bash
# =============================================================================
# PreToolUse[Edit|Write] — защита важных файлов
#
# Получает JSON на stdin: {"tool_name":"Edit","tool_input":{"file_path":"..."}}
# Stdout → feedback для Claude
# Exit 0 = разрешить, exit 2 = заблокировать
# =============================================================================

INPUT=$(cat)

# Извлекаем путь к файлу
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input',{}).get('file_path',''))
except:
    print('')
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

WARNINGS=""
BASENAME=$(basename "$FILE_PATH")

# ── Полная блокировка секретных файлов ───────────────────────────────────────

case "$BASENAME" in
  .env|.google-sa.json|id_rsa|id_ed25519|credentials.json)
    echo "BLOCKED: Запись в $BASENAME заблокирована — файл содержит секреты."
    echo "Если нужно изменить — сделай вручную."
    exit 2
    ;;
esac

# ── Предупреждения ───────────────────────────────────────────────────────────

if echo "$FILE_PATH" | grep -qE '\.(env\.|service|pem|key)$|docker-compose|Dockerfile|nginx\.conf|systemd|crontab'; then
  WARNINGS="${WARNINGS}⚠ Инфраструктурный файл: $FILE_PATH — убедись, что не сломаешь деплой.\n"
fi

if echo "$BASENAME" | grep -qE '^(CLAUDE|STATE)\.md$'; then
  WARNINGS="${WARNINGS}📝 Файл памяти проекта ($BASENAME) — не удаляй существующие записи.\n"
fi

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS"
fi

exit 0
