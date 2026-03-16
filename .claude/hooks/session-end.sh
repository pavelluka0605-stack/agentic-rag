#!/bin/bash
# =============================================================================
# Stop hook — итоги сессии + completion criteria + cleanup
#
# Проверяет завершённость, напоминает сохранить итоги, чистит temp.
# =============================================================================

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  SESSION END — Проверки и обязательные действия          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Completion check ───────────────────────────────────────────────────────

COMPLETION=$(node "$HOOKS_DIR/lib/completion-check.js" 2>/dev/null)
COMPLETION_CODE=$?

if [ -n "$COMPLETION" ]; then
  echo "$COMPLETION"
  echo ""
fi

if [ "$COMPLETION_CODE" -ne 0 ]; then
  echo "⚠ Есть незавершённые дела. Рекомендуется доделать перед завершением."
  echo ""
fi

# ── 2. Subagent summary ──────────────────────────────────────────────────────

AGENT_LOG="/tmp/claude-agents-$$"
if [ -f "$AGENT_LOG" ]; then
  AGENT_COUNT=$(grep -c "|done|" "$AGENT_LOG" 2>/dev/null || echo "0")
  if [ "$AGENT_COUNT" -gt 0 ]; then
    echo "🤖 Subagent'ы в сессии: $AGENT_COUNT"
    grep "|done|" "$AGENT_LOG" | tail -5 | while IFS='|' read -r ts type status desc; do
      echo "   [$ts] $type: $desc"
    done
    echo ""
  fi
fi

# ── 3. Changes summary ───────────────────────────────────────────────────────

CHANGES_LOG="/tmp/claude-changes-$$"
if [ -f "$CHANGES_LOG" ]; then
  CHANGE_COUNT=$(wc -l < "$CHANGES_LOG" | tr -d ' ')
  UNIQUE_FILES=$(sort -u "$CHANGES_LOG" | wc -l | tr -d ' ')
  echo "📁 Файлов изменено: $UNIQUE_FILES (операций: $CHANGE_COUNT)"
  sort -u "$CHANGES_LOG" | head -10 | while read -r f; do
    echo "   • $f"
  done
  if [ "$UNIQUE_FILES" -gt 10 ]; then
    echo "   ... и ещё $((UNIQUE_FILES - 10))"
  fi
  echo ""
fi

# ── 4. Success summary ───────────────────────────────────────────────────────

SUCCESS_LOG="/tmp/claude-successes-$$"
if [ -f "$SUCCESS_LOG" ]; then
  echo "✅ Значимые успешные действия:"
  tail -5 "$SUCCESS_LOG" | while IFS='|' read -r ts cmd; do
    echo "   [$ts] $cmd"
  done
  echo ""
fi

# ── 5. Обязательные действия ──────────────────────────────────────────────────

echo "Перед завершением ты ДОЛЖЕН:"
echo ""
echo "1. 📝 Вызови episode_save с:"
echo "   - summary: что было сделано в этой сессии"
echo "   - what_done: конкретные действия"
echo "   - where_stopped: на чём остановились"
echo "   - what_remains: что осталось доделать"
echo "   - open_loops: незакрытые вопросы и задачи"
echo "   - project, branch, files_changed"
echo ""
echo "2. 🏗 Если были приняты архитектурные решения → вызови decision_add"
echo ""
echo "3. 🔧 Если были найдены и исправлены ошибки → убедись, что вызвал incident_fix"
echo ""
echo "4. 💡 Если нашёл удачный паттерн/workaround → вызови solution_add"
echo ""
echo "5. 📜 Если узнал новое ограничение/правило → вызови policy_add"
echo ""

# ── 6. Текущая статистика памяти ──────────────────────────────────────────────

STATS=$(node "$HOOKS_DIR/lib/query-memory.js" stats 2>/dev/null)
if [ -n "$STATS" ]; then
  echo "📊 Статистика памяти:"
  echo "$STATS"
  echo ""
fi

# ── 7. Открытые инциденты ─────────────────────────────────────────────────────

OPEN=$(node "$HOOKS_DIR/lib/query-memory.js" open-incidents 2>/dev/null)
if [ -n "$OPEN" ] && [ "$OPEN" != "[]" ]; then
  echo "🔴 Открытые инциденты (закрой решённые через incident_fix или incident_update_status):"
  echo "$OPEN"
  echo ""
fi

# ── 8. Cleanup temp files ────────────────────────────────────────────────────

rm -f "/tmp/claude-session-started-$$" 2>/dev/null
rm -f "/tmp/claude-agents-$$" 2>/dev/null
rm -f "/tmp/claude-changes-$$" 2>/dev/null
rm -f "/tmp/claude-successes-$$" 2>/dev/null
# НЕ чистим repair files — они нужны между сессиями
# НЕ чистим failed-approaches — они тоже кросс-сессионные

exit 0
