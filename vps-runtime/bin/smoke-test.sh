#!/bin/bash
# =============================================================================
# Smoke test for Claude Code runtime
# Usage: smoke-test.sh [--verbose]
#
# Validates that the runtime is actually functional, not just present.
# Runs after bootstrap or deploy to verify everything works end-to-end.
# =============================================================================
set -uo pipefail

VERBOSE="${1:-}"
INSTALL_DIR="/opt/claude-code"

pass=0
fail=0
total=0

test_it() {
  local name="$1"
  local result="$2"
  total=$((total + 1))
  if [ "$result" = "0" ]; then
    pass=$((pass + 1))
    echo "  ✓ $name"
  else
    fail=$((fail + 1))
    echo "  ✗ $name"
  fi
}

echo "Claude Code Smoke Test"
echo "======================"
echo ""

# ── 1. Pre-flight verification ──────────────────────────────────────────────

echo "1. Pre-flight:"
$INSTALL_DIR/bin/verify.sh --quiet >/dev/null 2>&1
test_it "verify.sh passes" "$?"

echo ""

# ── 2. Scripts are executable ────────────────────────────────────────────────

echo "2. Scripts:"
for script in start.sh stop.sh restart.sh connect.sh health.sh verify.sh backup-memory.sh; do
  [ -x "$INSTALL_DIR/bin/$script" ]
  test_it "$script executable" "$?"
done

echo ""

# ── 3. Claude CLI ────────────────────────────────────────────────────────────

echo "3. Claude CLI:"
command -v claude >/dev/null 2>&1
test_it "claude in PATH" "$?"

claude --version >/dev/null 2>&1
test_it "claude --version works" "$?"

echo ""

# ── 4. Node.js & MCP ────────────────────────────────────────────────────────

echo "4. MCP Memory Server:"
node --check "$INSTALL_DIR/memory-server/index.js" 2>/dev/null
test_it "index.js syntax valid" "$?"

node --check "$INSTALL_DIR/memory-server/db.js" 2>/dev/null
test_it "db.js syntax valid" "$?"

# Quick functional test: create temp DB, test basic ops
TEMP_DB="/tmp/claude-smoke-test-$$.db"
node -e "
import { MemoryDB } from '$INSTALL_DIR/memory-server/db.js';
const db = new MemoryDB('$TEMP_DB');
const p = db.addPolicy({ title: 'smoke-test', content: 'test', category: 'rule' });
if (p.id !== 1) throw new Error('addPolicy failed');
const s = db.getStats();
if (s.policies !== 1) throw new Error('getStats failed');
db.close();
console.log('MCP functional test passed');
" 2>/dev/null
test_it "MCP functional test (add + query)" "$?"
rm -f "$TEMP_DB" "$TEMP_DB-wal" "$TEMP_DB-shm" 2>/dev/null

echo ""

# ── 5. Systemd units ────────────────────────────────────────────────────────

echo "5. Systemd:"
systemctl is-enabled claude-code.service >/dev/null 2>&1
test_it "claude-code.service enabled" "$?"

systemctl is-enabled github-webhook.service >/dev/null 2>&1
test_it "github-webhook.service enabled" "$?"

echo ""

# ── 6. tmux session ─────────────────────────────────────────────────────────

echo "6. Runtime:"
SESSION="${CLAUDE_TMUX_SESSION:-claude-code}"
tmux has-session -t "$SESSION" 2>/dev/null
tmux_running=$?
test_it "tmux session '$SESSION' running" "$tmux_running"

if [ "$tmux_running" -eq 0 ]; then
  # Check all 3 windows exist
  windows=$(tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | sort | tr '\n' ',')
  echo "$windows" | grep -q "workspace"
  test_it "workspace window exists" "$?"
  echo "$windows" | grep -q "monitor"
  test_it "monitor window exists" "$?"
  echo "$windows" | grep -q "logs"
  test_it "logs window exists" "$?"
fi

echo ""

# ── 7. Health check ──────────────────────────────────────────────────────────

echo "7. Health:"
$INSTALL_DIR/bin/health.sh --quiet >/dev/null 2>&1
test_it "health.sh passes" "$?"

echo ""

# ── 8. Network ──────────────────────────────────────────────────────────────

echo "8. Network:"
curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://api.anthropic.com 2>/dev/null | grep -qE '200|401|403'
test_it "api.anthropic.com reachable" "$?"

# Check control API if running
if curl -s --max-time 2 http://127.0.0.1:3901/health >/dev/null 2>&1; then
  test_it "control-api responding" "0"
else
  test_it "control-api responding" "1"
fi

# Check webhook if running
if curl -s --max-time 2 http://127.0.0.1:3900/health >/dev/null 2>&1; then
  test_it "github-webhook responding" "0"
else
  test_it "github-webhook responding" "1"
fi

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────

echo "════════════════════════════"
echo "Result: $pass/$total passed, $fail failed"
echo ""

if [ $fail -eq 0 ]; then
  echo "✓ All smoke tests passed. System is fully operational."
  exit 0
elif [ $fail -le 3 ]; then
  echo "⚠ Some tests failed. System is partially operational."
  exit 1
else
  echo "✗ Multiple failures. System needs attention."
  exit 2
fi
