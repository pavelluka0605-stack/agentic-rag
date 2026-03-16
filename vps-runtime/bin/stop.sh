#!/bin/bash
# =============================================================================
# Gracefully stop Claude Code tmux session
# =============================================================================
set -euo pipefail

ENV_FILE="${CLAUDE_ENV_FILE:-/opt/claude-code/env/claude.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

SESSION="${CLAUDE_TMUX_SESSION:-claude-code}"
LOG_DIR="${CLAUDE_LOG_DIR:-/opt/claude-code/logs}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[INFO] Session '$SESSION' not running."
  exit 0
fi

echo "[INFO] Stopping session '$SESSION'..."

# Send Ctrl-C to workspace window (graceful interrupt of any running claude process)
tmux send-keys -t "$SESSION:workspace" C-c 2>/dev/null || true
sleep 2

# Kill the tmux session
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo "[OK] Session '$SESSION' stopped."
echo "[$(date -Iseconds)] SESSION_STOP" >> "$LOG_DIR/events.log" 2>/dev/null || true
