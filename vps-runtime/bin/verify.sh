#!/bin/bash
# =============================================================================
# Pre-flight verification for Claude Code runtime
# Usage: verify.sh [--fix] [--quiet]
#
# Checks environment, dependencies, permissions, connectivity.
# Run before start.sh to catch issues early.
# Exit 0 = ready, Exit 1 = problems found
# =============================================================================
set -uo pipefail

FIX="${1:-}"
QUIET="${2:-}"
[ "$FIX" = "--quiet" ] && QUIET="--quiet" && FIX=""

ENV_FILE="${CLAUDE_ENV_FILE:-/opt/claude-code/env/claude.env}"
INSTALL_DIR="/opt/claude-code"

pass=0
fail=0
warn_count=0

log()  { [ "$QUIET" != "--quiet" ] && echo "$*"; }
ok()   { pass=$((pass + 1)); log "  ✓ $*"; }
fail() { fail=$((fail + 1)); log "  ✗ $*"; }
warn() { warn_count=$((warn_count + 1)); log "  ⚠ $*"; }

log "Claude Code Pre-flight Verification"
log "===================================="
log ""

# ── 1. Environment file ──────────────────────────────────────────────────────

log "Environment:"

if [ -f "$ENV_FILE" ]; then
  ok "env file exists: $ENV_FILE"

  # Load env
  set -a; source "$ENV_FILE" 2>/dev/null; set +a

  # Check API key
  API_KEY="${ANTHROPIC_API_KEY:-}"
  if [ -z "$API_KEY" ]; then
    fail "ANTHROPIC_API_KEY is empty"
  elif [ ${#API_KEY} -lt 20 ]; then
    fail "ANTHROPIC_API_KEY looks invalid (too short: ${#API_KEY} chars)"
  else
    ok "ANTHROPIC_API_KEY set (${#API_KEY} chars)"
  fi

  # Check file permissions
  perms=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || stat -f "%Lp" "$ENV_FILE" 2>/dev/null)
  if [ "$perms" = "600" ] || [ "$perms" = "400" ]; then
    ok "env file permissions: $perms"
  else
    warn "env file permissions: $perms (should be 600)"
    if [ "$FIX" = "--fix" ]; then
      chmod 600 "$ENV_FILE"
      ok "FIXED: permissions set to 600"
    fi
  fi
else
  fail "env file not found: $ENV_FILE"
fi

log ""

# ── 2. Dependencies ──────────────────────────────────────────────────────────

log "Dependencies:"

for cmd in tmux node npm git jq sqlite3; do
  if command -v $cmd >/dev/null 2>&1; then
    ver=$($cmd --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    ok "$cmd${ver:+ v$ver}"
  else
    if [ "$cmd" = "sqlite3" ]; then
      warn "$cmd not found (backup-memory.sh needs it for pruning)"
    else
      fail "$cmd not found"
    fi
  fi
done

# Check Claude Code CLI specifically
if command -v claude >/dev/null 2>&1; then
  claude_ver=$(claude --version 2>/dev/null || echo "unknown")
  ok "claude CLI: $claude_ver"
else
  fail "claude CLI not installed"
fi

# Check Node.js version (need 18+)
if command -v node >/dev/null 2>&1; then
  node_major=$(node -v | grep -oE '^v([0-9]+)' | tr -d 'v')
  if [ "$node_major" -ge 18 ] 2>/dev/null; then
    ok "Node.js version OK (v$node_major, need 18+)"
  else
    fail "Node.js version too old (v$node_major, need 18+)"
  fi
fi

log ""

# ── 3. Directory structure ────────────────────────────────────────────────────

log "Directories:"

for dir in bin env etc logs workspace backups; do
  full="$INSTALL_DIR/$dir"
  if [ -d "$full" ]; then
    ok "$dir/"
  else
    warn "$dir/ missing"
    if [ "$FIX" = "--fix" ]; then
      mkdir -p "$full"
      ok "FIXED: created $full"
    fi
  fi
done

# Check workspace write permissions
WORKSPACE="${CLAUDE_WORKSPACE:-$INSTALL_DIR/workspace}"
if [ -d "$WORKSPACE" ] && [ -w "$WORKSPACE" ]; then
  ok "workspace writable"
else
  fail "workspace not writable: $WORKSPACE"
fi

log ""

# ── 4. Systemd ────────────────────────────────────────────────────────────────

log "Systemd:"

for unit in claude-code.service github-webhook.service; do
  if systemctl list-unit-files "$unit" >/dev/null 2>&1; then
    enabled=$(systemctl is-enabled "$unit" 2>/dev/null || echo "unknown")
    active=$(systemctl is-active "$unit" 2>/dev/null || echo "unknown")
    ok "$unit (enabled=$enabled, active=$active)"
  else
    warn "$unit not installed"
  fi
done

log ""

# ── 5. MCP Memory Server ─────────────────────────────────────────────────────

log "MCP Memory Server:"

MCP_DIR="$INSTALL_DIR/memory-server"
if [ -f "$MCP_DIR/index.js" ]; then
  ok "index.js present"
  if [ -d "$MCP_DIR/node_modules" ]; then
    ok "node_modules installed"
  else
    fail "node_modules missing (run: cd $MCP_DIR && npm install)"
  fi
else
  warn "memory server not deployed"
fi

MEMORY_DB="$INSTALL_DIR/memory/memory.db"
if [ -f "$MEMORY_DB" ]; then
  db_size=$(du -h "$MEMORY_DB" | cut -f1)
  ok "memory.db exists ($db_size)"

  # Integrity check
  if command -v sqlite3 >/dev/null 2>&1; then
    integrity=$(sqlite3 "$MEMORY_DB" "PRAGMA integrity_check;" 2>/dev/null)
    if [ "$integrity" = "ok" ]; then
      ok "memory.db integrity OK"
    else
      fail "memory.db integrity FAILED: $integrity"
    fi
  fi
else
  warn "memory.db not yet created (will be created on first use)"
fi

log ""

# ── 6. Disk & Memory ─────────────────────────────────────────────────────────

log "Resources:"

disk_pct=$(df "$INSTALL_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
if [ -n "$disk_pct" ]; then
  if [ "$disk_pct" -lt 80 ]; then
    ok "disk: ${disk_pct}% used"
  elif [ "$disk_pct" -lt 90 ]; then
    warn "disk: ${disk_pct}% used (getting full)"
  else
    fail "disk: ${disk_pct}% used (critical!)"
  fi
fi

mem_free=$(free -m 2>/dev/null | awk 'NR==2 {print $7}')
if [ -n "$mem_free" ]; then
  if [ "$mem_free" -gt 512 ]; then
    ok "memory: ${mem_free}MB available"
  elif [ "$mem_free" -gt 256 ]; then
    warn "memory: ${mem_free}MB available (low)"
  else
    fail "memory: ${mem_free}MB available (critical!)"
  fi
fi

log ""

# ── 7. Network (basic) ──────────────────────────────────────────────────────

log "Network:"

if curl -s --max-time 5 https://api.anthropic.com >/dev/null 2>&1; then
  ok "api.anthropic.com reachable"
else
  warn "api.anthropic.com not reachable (may work with proxy)"
fi

if curl -s --max-time 5 https://github.com >/dev/null 2>&1; then
  ok "github.com reachable"
else
  warn "github.com not reachable"
fi

log ""

# ── Summary ───────────────────────────────────────────────────────────────────

total=$((pass + fail))
log "Result: $pass passed, $fail failed, $warn_count warnings"

if [ $fail -eq 0 ]; then
  log ""
  log "✓ System ready. Run: /opt/claude-code/bin/start.sh"
  exit 0
else
  log ""
  log "✗ $fail issues found. Fix them before starting."
  [ "$FIX" != "--fix" ] && log "  Tip: run with --fix to auto-fix some issues"
  exit 1
fi
