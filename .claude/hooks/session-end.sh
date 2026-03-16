#!/bin/bash
# =============================================================================
# Stop hook — итоги сессии
#
# Выводит reminder для Claude сохранить итоги перед завершением
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  SESSION END — Обязательные действия перед завершением   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Перед завершением ты ДОЛЖЕН:"
echo ""
echo "1. Вызови episode_save с:"
echo "   - summary: что было сделано в этой сессии"
echo "   - what_done: конкретные действия"
echo "   - where_stopped: на чём остановились"
echo "   - what_remains: что осталось доделать"
echo "   - open_loops: незакрытые вопросы и задачи"
echo "   - project, branch, files_changed"
echo ""
echo "2. Если были приняты архитектурные решения → вызови decision_add"
echo ""
echo "3. Если были найдены и исправлены ошибки → убедись, что вызвал incident_fix"
echo ""
echo "4. Если нашёл удачный паттерн → вызови solution_add"
echo ""

# Показываем текущую статистику
STATS=$(node "$HOOKS_DIR/lib/query-memory.js" stats 2>/dev/null)
if [ -n "$STATS" ]; then
  echo "📊 Текущая статистика памяти:"
  echo "$STATS"
  echo ""
fi

# Показываем открытые инциденты
OPEN=$(node "$HOOKS_DIR/lib/query-memory.js" open-incidents 2>/dev/null)
if [ -n "$OPEN" ] && [ "$OPEN" != "[]" ]; then
  echo "🔴 Открытые инциденты (не забудь закрыть решённые):"
  echo "$OPEN"
  echo ""
fi

exit 0
