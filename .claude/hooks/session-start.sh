#!/bin/bash
# =============================================================================
# SessionStart — загрузка контекста при первом вызове инструмента
#
# Вызывается как PreToolUse hook. Определяет "первый вызов" через flag-файл.
# При первом вызове — загружает bootstrap из памяти.
# При последующих — пропускает (нулевой overhead).
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Уникальный ID сессии (по PID родительского процесса claude)
SESSION_FLAG="/tmp/claude-session-started-$$"

# Если сессия уже инициализирована — выходим мгновенно
if [ -f "$SESSION_FLAG" ]; then
  exit 0
fi

# Помечаем сессию как начатую
touch "$SESSION_FLAG"

# Загружаем bootstrap контекст
PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || echo 'unknown')")

BOOTSTRAP=$(node "$HOOKS_DIR/lib/session-bootstrap.js" "$PROJECT" 2>/dev/null)
if [ -n "$BOOTSTRAP" ]; then
  echo "$BOOTSTRAP"
fi

# Проверяем STATE.md
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [ -f "$ROOT/STATE.md" ]; then
  echo ""
  echo "📌 ОБЯЗАТЕЛЬНО: Прочитай STATE.md — там текущее состояние задач."
fi

exit 0
