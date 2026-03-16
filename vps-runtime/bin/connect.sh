#!/bin/bash
# =============================================================================
# Connect to Claude Code tmux session
# Usage: connect.sh [window]
#   window: workspace (default), monitor, logs
# =============================================================================

ENV_FILE="${CLAUDE_ENV_FILE:-/opt/claude-code/env/claude.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

SESSION="${CLAUDE_TMUX_SESSION:-claude-code}"
WINDOW="${1:-workspace}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[WARN] Session '$SESSION' not running. Starting it..."
  "$(cd "$(dirname "$0")" && pwd)/start.sh"
fi

echo "[INFO] Connecting to $SESSION:$WINDOW"
echo "[INFO] Detach: Ctrl-b d | Switch window: Ctrl-b n/p | Kill pane: Ctrl-b x"
echo ""

# If inside tmux already, switch; otherwise attach
if [ -n "${TMUX:-}" ]; then
  tmux switch-client -t "$SESSION:$WINDOW"
else
  tmux attach-session -t "$SESSION:$WINDOW"
fi
