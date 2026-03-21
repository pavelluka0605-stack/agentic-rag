#!/bin/bash
# vps-exec.sh — Отправить команду на VPS через GitHub Actions
# Использование:
#   bash .claude/commands/vps-exec.sh "systemctl status control-bridge" "проверка статуса"
#   bash .claude/commands/vps-exec.sh --script .claude/commands/scripts/diagnose-bridge.sh "диагностика"
#   bash .claude/commands/vps-exec.sh --wait "curl -sf http://127.0.0.1:3000/health" "health check"
#
# Пишет exec.json → git add → git commit → git push → workflow триггерится автоматически.
# Результат появится в .claude/commands/result.json после git pull.

set -euo pipefail

EXEC_FILE=".claude/commands/exec.json"
RESULT_FILE=".claude/commands/result.json"

# Парсинг аргументов
SCRIPT_MODE=false
WAIT_MODE=false
SCRIPT_FILE=""
COMMAND=""
INTENT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --script)
      SCRIPT_MODE=true
      SCRIPT_FILE="$2"
      shift 2
      ;;
    --wait)
      WAIT_MODE=true
      shift
      ;;
    *)
      if [ -z "$COMMAND" ]; then
        COMMAND="$1"
      else
        INTENT="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$COMMAND" ] && [ -z "$SCRIPT_FILE" ]; then
  echo "Использование:"
  echo "  $0 \"команда\" \"описание\""
  echo "  $0 --script path/to/script.sh \"описание\""
  exit 1
fi

# Формируем exec.json
if [ "$SCRIPT_MODE" = true ]; then
  python3 -c "
import json
data = {'script_file': '$SCRIPT_FILE', 'intent': '''$INTENT'''}
with open('$EXEC_FILE', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(json.dumps(data, indent=2, ensure_ascii=False))
"
else
  python3 -c "
import json
data = {'command': '''$COMMAND''', 'intent': '''$INTENT'''}
with open('$EXEC_FILE', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(json.dumps(data, indent=2, ensure_ascii=False))
"
fi

echo ""
echo "--- Коммит и пуш ---"
BRANCH=$(git branch --show-current)
git add "$EXEC_FILE"
git commit -m "exec: ${INTENT:-vps command} [auto]"
git push -u origin "$BRANCH"

echo ""
echo "Команда отправлена. Workflow запустится автоматически."
echo "Результат появится в: $RESULT_FILE"
echo ""
echo "Чтобы получить результат:"
echo "  git pull origin $BRANCH"
echo "  cat $RESULT_FILE"
