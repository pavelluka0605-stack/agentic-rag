#!/bin/bash
# =============================================================================
# Self-diagnostics for the dev environment
# Usage: bash .claude/hooks/diagnose.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAUDE_DIR="$ROOT/.claude"
MEMORY_DIR="$CLAUDE_DIR/memory"
MCP_DIR="$CLAUDE_DIR/mcp/memory-server"
HOOKS_DIR="$CLAUDE_DIR/hooks"

pass=0
fail=0
warn=0

check() {
  local label="$1" ok="$2"
  if [ "$ok" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} $label"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} $label"
    fail=$((fail + 1))
  fi
}

warning() {
  local label="$1"
  echo -e "  ${YELLOW}!${NC} $label"
  warn=$((warn + 1))
}

echo "╔══════════════════════════════════════════╗"
echo "║   Dev Environment Diagnostics v2         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Структура
echo "1. Структура директорий"
check ".claude/" "$([ -d "$CLAUDE_DIR" ] && echo true || echo false)"
check ".claude/memory/" "$([ -d "$MEMORY_DIR" ] && echo true || echo false)"
check ".claude/hooks/" "$([ -d "$HOOKS_DIR" ] && echo true || echo false)"
check ".claude/hooks/lib/" "$([ -d "$HOOKS_DIR/lib" ] && echo true || echo false)"
check ".claude/mcp/memory-server/" "$([ -d "$MCP_DIR" ] && echo true || echo false)"

# 2. Конфигурация
echo ""
echo "2. Конфигурация"
SETTINGS="$CLAUDE_DIR/settings.json"
check "settings.json exists" "$([ -f "$SETTINGS" ] && echo true || echo false)"
if [ -f "$SETTINGS" ]; then
  check "settings.json valid JSON" "$(python3 -c 'import json; json.load(open("'"$SETTINGS"'"))' 2>/dev/null && echo true || echo false)"

  # Проверяем наличие всех hook events
  for event in PreToolUse PostToolUse Stop; do
    check "hook: $event configured" "$(python3 -c 'import json; d=json.load(open("'"$SETTINGS"'")); assert "'"$event"'" in d["hooks"]' 2>/dev/null && echo true || echo false)"
  done

  check "MCP server: memory" "$(python3 -c 'import json; d=json.load(open("'"$SETTINGS"'")); assert "memory" in d["mcpServers"]' 2>/dev/null && echo true || echo false)"
fi

# 3. MCP Memory Server
echo ""
echo "3. MCP Memory Server (SQLite + FTS5)"
check "index.js" "$([ -f "$MCP_DIR/index.js" ] && echo true || echo false)"
check "db.js" "$([ -f "$MCP_DIR/db.js" ] && echo true || echo false)"
check "github.js" "$([ -f "$MCP_DIR/github.js" ] && echo true || echo false)"
check "migrations/001-init.sql" "$([ -f "$MCP_DIR/migrations/001-init.sql" ] && echo true || echo false)"
check "node_modules" "$([ -d "$MCP_DIR/node_modules" ] && echo true || echo false)"
if [ -d "$MCP_DIR/node_modules" ]; then
  check "@modelcontextprotocol/sdk" "$([ -d "$MCP_DIR/node_modules/@modelcontextprotocol" ] && echo true || echo false)"
  check "better-sqlite3" "$([ -d "$MCP_DIR/node_modules/better-sqlite3" ] && echo true || echo false)"
fi

# 4. Hooks
echo ""
echo "4. Hooks"
REQUIRED_HOOKS=(pre-bash.sh pre-edit.sh post-bash.sh session-end.sh diagnose.sh)
for hook in "${REQUIRED_HOOKS[@]}"; do
  check "$hook exists" "$([ -f "$HOOKS_DIR/$hook" ] && echo true || echo false)"
  check "$hook executable" "$([ -x "$HOOKS_DIR/$hook" ] && echo true || echo false)"
done

# Hook helpers
echo ""
echo "5. Hook Helpers"
check "lib/query-memory.js" "$([ -f "$HOOKS_DIR/lib/query-memory.js" ] && echo true || echo false)"
check "lib/repair-loop.js" "$([ -f "$HOOKS_DIR/lib/repair-loop.js" ] && echo true || echo false)"

# 6. Memory Database
echo ""
echo "6. Memory Database"
DB_FILE="$MEMORY_DIR/memory.db"
if [ -f "$DB_FILE" ]; then
  check "memory.db exists" "true"
  DB_SIZE=$(du -h "$DB_FILE" 2>/dev/null | cut -f1)
  echo "     Size: $DB_SIZE"

  # Проверяем таблицы
  TABLES=$(node -e "
    const Database = require('$MCP_DIR/node_modules/better-sqlite3');
    const db = new Database('$DB_FILE');
    const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite%' AND name NOT LIKE '%_fts%'\").all();
    console.log(tables.map(t=>t.name).join(','));
    db.close();
  " 2>/dev/null || echo "")

  if [ -n "$TABLES" ]; then
    check "Tables: $TABLES" "true"
  else
    check "Database tables readable" "false"
  fi

  # Статистика через query-memory.js
  STATS=$(node "$HOOKS_DIR/lib/query-memory.js" stats 2>/dev/null || echo "")
  if [ -n "$STATS" ]; then
    echo "     Stats: $STATS" | head -1
  fi
else
  warning "memory.db not created yet (will be created on first MCP call)"
fi

# 7. Runtime
echo ""
echo "7. Runtime"
check "Node.js" "$(command -v node >/dev/null && echo true || echo false)"
if command -v node >/dev/null; then
  echo "     $(node --version)"
fi
check "Git" "$(command -v git >/dev/null && echo true || echo false)"
check "Python3" "$(command -v python3 >/dev/null && echo true || echo false)"

# 8. Git
echo ""
echo "8. Git"
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git -C "$ROOT" branch --show-current)
  check "Branch: $branch" "true"
  dirty=$(git -C "$ROOT" status --porcelain | wc -l | tr -d ' ')
  if [ "$dirty" -gt 0 ]; then
    warning "$dirty uncommitted changes"
  else
    check "Working tree clean" "true"
  fi
else
  check "Git repo" "false"
fi

# 9. Системные ресурсы
echo ""
echo "9. Ресурсы"
disk_pct=$(df /home 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
if [ -n "$disk_pct" ]; then
  disk_ok="$([ "$disk_pct" -lt 90 ] && echo true || echo false)"
  check "Disk: ${disk_pct}% used" "$disk_ok"
fi
mem_pct=$(free 2>/dev/null | awk 'NR==2 {printf "%.0f", $3/$2*100}')
if [ -n "$mem_pct" ]; then
  mem_ok="$([ "$mem_pct" -lt 90 ] && echo true || echo false)"
  check "Memory: ${mem_pct}% used" "$mem_ok"
fi

# Summary
total=$((pass + fail))
echo ""
echo "════════════════════════════════════════"
echo -e "  ${GREEN}Pass: $pass${NC}  ${RED}Fail: $fail${NC}  ${YELLOW}Warn: $warn${NC}  Total: $total"
if [ "$fail" -eq 0 ]; then
  echo -e "  ${GREEN}Environment OK${NC}"
else
  echo -e "  ${RED}$fail issues found${NC}"
fi
echo "════════════════════════════════════════"

exit $fail
