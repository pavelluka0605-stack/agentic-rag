#!/bin/bash
# =============================================================================
# Health check for Claude Code runtime
# Usage: health.sh [--quiet] [--json]
# =============================================================================
set -uo pipefail

QUIET="${1:-}"
JSON="${2:-}"

ENV_FILE="${CLAUDE_ENV_FILE:-/opt/claude-code/env/claude.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

SESSION="${CLAUDE_TMUX_SESSION:-claude-code}"
LOG_DIR="${CLAUDE_LOG_DIR:-/opt/claude-code/logs}"
WORKSPACE="${CLAUDE_WORKSPACE:-/opt/claude-code/workspace}"

pass=0
fail=0
checks=()

check() {
  local name="$1" ok="$2" detail="${3:-}"
  if [ "$ok" = "true" ]; then
    pass=$((pass + 1))
    checks+=("PASS|$name|$detail")
    [ "$QUIET" != "--quiet" ] && echo "  ✓ $name${detail:+ ($detail)}"
  else
    fail=$((fail + 1))
    checks+=("FAIL|$name|$detail")
    [ "$QUIET" != "--quiet" ] && echo "  ✗ $name${detail:+ ($detail)}"
  fi
}

[ "$QUIET" != "--quiet" ] && echo "Claude Code Runtime Health Check"
[ "$QUIET" != "--quiet" ] && echo "================================"

# 1. tmux session
tmux_ok="false"
tmux_windows=""
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux_ok="true"
  tmux_windows=$(tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | tr '\n' ',' | sed 's/,$//')
fi
check "tmux session '$SESSION'" "$tmux_ok" "$tmux_windows"

# 2. Claude CLI
claude_ok="false"
claude_ver=""
if command -v claude >/dev/null 2>&1; then
  claude_ok="true"
  claude_ver=$(claude --version 2>/dev/null || echo "unknown")
fi
check "claude CLI" "$claude_ok" "$claude_ver"

# 3. Workspace dir
ws_ok="$([ -d "$WORKSPACE" ] && echo true || echo false)"
ws_detail=""
if [ -d "$WORKSPACE" ]; then
  ws_detail="$(ls -1 "$WORKSPACE" 2>/dev/null | wc -l | tr -d ' ') items"
fi
check "workspace dir" "$ws_ok" "$ws_detail"

# 4. Log dir
log_ok="$([ -d "$LOG_DIR" ] && echo true || echo false)"
log_detail=""
if [ -d "$LOG_DIR" ]; then
  today_log="$LOG_DIR/session-$(date +%Y%m%d).log"
  if [ -f "$today_log" ]; then
    log_detail="today's log: $(wc -l < "$today_log" | tr -d ' ') lines"
  else
    log_detail="no log today"
  fi
fi
check "log directory" "$log_ok" "$log_detail"

# 5. Environment
env_ok="$([ -f "$ENV_FILE" ] && echo true || echo false)"
api_key_set="false"
if [ -f "$ENV_FILE" ] && grep -q 'ANTHROPIC_API_KEY=.' "$ENV_FILE" 2>/dev/null; then
  api_key_set="true"
fi
check "env file" "$env_ok"
check "ANTHROPIC_API_KEY set" "$api_key_set"

# 6. systemd unit
systemd_ok="false"
systemd_status=""
if systemctl is-enabled claude-code.service >/dev/null 2>&1; then
  systemd_ok="true"
  systemd_status=$(systemctl is-active claude-code.service 2>/dev/null || echo "unknown")
fi
check "systemd unit" "$systemd_ok" "$systemd_status"

# 7. Disk space
disk_pct=$(df /opt 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
disk_ok="true"
if [ -n "$disk_pct" ] && [ "$disk_pct" -gt 90 ]; then
  disk_ok="false"
fi
check "disk space (/opt)" "$disk_ok" "${disk_pct:-?}% used"

# 8. Memory
mem_pct=$(free 2>/dev/null | awk 'NR==2 {printf "%.0f", $3/$2*100}')
mem_ok="true"
if [ -n "$mem_pct" ] && [ "$mem_pct" -gt 90 ]; then
  mem_ok="false"
fi
check "memory" "$mem_ok" "${mem_pct:-?}% used"

# Summary
total=$((pass + fail))
[ "$QUIET" != "--quiet" ] && echo ""
[ "$QUIET" != "--quiet" ] && echo "Result: $pass/$total passed, $fail failed"

# JSON output
if [ "$JSON" = "--json" ] || [ "$QUIET" = "--json" ]; then
  echo "{"
  echo "  \"pass\": $pass,"
  echo "  \"fail\": $fail,"
  echo "  \"total\": $total,"
  echo "  \"status\": \"$([ $fail -eq 0 ] && echo ok || echo degraded)\","
  echo "  \"timestamp\": \"$(date -Iseconds)\""
  echo "}"
fi

exit $fail
