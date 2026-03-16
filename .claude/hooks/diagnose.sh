#!/bin/bash
# Self-diagnostics for the dev environment
# Usage: bash .claude/hooks/diagnose.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAUDE_DIR="$ROOT/.claude"
MEMORY_DIR="$CLAUDE_DIR/memory"
MCP_DIR="$CLAUDE_DIR/mcp/memory-server"

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

echo "╔══════════════════════════════════════╗"
echo "║   Dev Environment Diagnostics        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Structure
echo "1. Directory Structure"
check ".claude/ exists" "$([ -d "$CLAUDE_DIR" ] && echo true || echo false)"
check ".claude/memory/ exists" "$([ -d "$MEMORY_DIR" ] && echo true || echo false)"
check ".claude/hooks/ exists" "$([ -d "$CLAUDE_DIR/hooks" ] && echo true || echo false)"
check ".claude/mcp/memory-server/ exists" "$([ -d "$MCP_DIR" ] && echo true || echo false)"

# 2. Settings
echo ""
echo "2. Configuration"
SETTINGS="$CLAUDE_DIR/settings.json"
check "settings.json exists" "$([ -f "$SETTINGS" ] && echo true || echo false)"
if [ -f "$SETTINGS" ]; then
  check "settings.json valid JSON" "$(python3 -c 'import json; json.load(open("'"$SETTINGS"'"))' 2>/dev/null && echo true || echo false)"
  check "hooks configured" "$(python3 -c 'import json; d=json.load(open("'"$SETTINGS"'")); assert "hooks" in d' 2>/dev/null && echo true || echo false)"
  check "MCP servers configured" "$(python3 -c 'import json; d=json.load(open("'"$SETTINGS"'")); assert "mcpServers" in d' 2>/dev/null && echo true || echo false)"
fi

# 3. MCP Server
echo ""
echo "3. MCP Memory Server"
check "package.json exists" "$([ -f "$MCP_DIR/package.json" ] && echo true || echo false)"
check "index.js exists" "$([ -f "$MCP_DIR/index.js" ] && echo true || echo false)"
check "node_modules installed" "$([ -d "$MCP_DIR/node_modules" ] && echo true || echo false)"
if [ -d "$MCP_DIR/node_modules" ]; then
  check "@modelcontextprotocol/sdk installed" "$([ -d "$MCP_DIR/node_modules/@modelcontextprotocol" ] && echo true || echo false)"
fi

# 4. Hooks
echo ""
echo "4. Hooks"
for hook in session-start.sh diagnose.sh; do
  check "$hook exists" "$([ -f "$CLAUDE_DIR/hooks/$hook" ] && echo true || echo false)"
  check "$hook executable" "$([ -x "$CLAUDE_DIR/hooks/$hook" ] && echo true || echo false)"
done

# 5. Memory stores
echo ""
echo "5. Memory Stores"
for store in decisions errors patterns sessions; do
  file="$MEMORY_DIR/${store}.jsonl"
  if [ -f "$file" ]; then
    count=$(wc -l < "$file" | tr -d ' ')
    check "${store}.jsonl ($count entries)" "true"
  else
    warning "${store}.jsonl — not yet created (will be created on first write)"
  fi
done

# 6. Runtime
echo ""
echo "6. Runtime"
check "Node.js available" "$(command -v node >/dev/null && echo true || echo false)"
if command -v node >/dev/null; then
  echo "     Node.js $(node --version)"
fi
check "Git available" "$(command -v git >/dev/null && echo true || echo false)"
check "Python3 available" "$(command -v python3 >/dev/null && echo true || echo false)"

# 7. Git status
echo ""
echo "7. Git"
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git -C "$ROOT" branch --show-current)
  check "In git repo (branch: $branch)" "true"
else
  check "In git repo" "false"
fi

# Summary
echo ""
echo "════════════════════════════════════════"
echo -e "  ${GREEN}Pass: $pass${NC}  ${RED}Fail: $fail${NC}  ${YELLOW}Warn: $warn${NC}"
if [ "$fail" -eq 0 ]; then
  echo -e "  ${GREEN}Environment OK${NC}"
else
  echo -e "  ${RED}Issues found — fix before proceeding${NC}"
fi
echo "════════════════════════════════════════"

exit $fail
