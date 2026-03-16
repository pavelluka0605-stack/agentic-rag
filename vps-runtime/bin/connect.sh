#!/bin/bash
# =============================================================================
# Connect to Claude Code tmux session
# Usage: connect.sh [options] [window]
#
# Options:
#   --resume    Start claude --resume in workspace window
#   --status    Show session status without attaching
#
# Windows: workspace (default), monitor, logs
# =============================================================================

ENV_FILE="${CLAUDE_ENV_FILE:-/opt/claude-code/env/claude.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

SESSION="${CLAUDE_TMUX_SESSION:-claude-code}"
WINDOW="workspace"
RESUME=""
STATUS=""

# Parse args
for arg in "$@"; do
  case "$arg" in
    --resume) RESUME=1 ;;
    --status) STATUS=1 ;;
    workspace|monitor|logs) WINDOW="$arg" ;;
  esac
done

# ── Status mode ──────────────────────────────────────────────────────────────

if [ "$STATUS" = "1" ]; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session: $SESSION (running)"
    echo "Windows:"
    tmux list-windows -t "$SESSION" -F "  #{window_index}: #{window_name} #{?window_active,(active),}" 2>/dev/null
    echo ""
    echo "Uptime: $(tmux display-message -t "$SESSION" -p '#{session_created}' 2>/dev/null | xargs -I{} date -d @{} 2>/dev/null || echo 'unknown')"
    echo "Panes:"
    tmux list-panes -t "$SESSION" -F "  [#{window_name}] #{pane_current_command} (#{pane_width}x#{pane_height})" 2>/dev/null
  else
    echo "Session: $SESSION (not running)"
    echo ""
    echo "Start with: /opt/claude-code/bin/start.sh"
  fi
  exit 0
fi

# ── Start if not running ────────────────────────────────────────────────────

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[WARN] Session '$SESSION' not running. Starting it..."
  "$(cd "$(dirname "$0")" && pwd)/start.sh"
  sleep 1
fi

# ── Resume mode ──────────────────────────────────────────────────────────────

if [ "$RESUME" = "1" ]; then
  echo "[INFO] Sending 'claude --resume' to workspace window..."
  tmux send-keys -t "$SESSION:workspace" "claude --resume" Enter
  WINDOW="workspace"
fi

# ── Connect ──────────────────────────────────────────────────────────────────

echo "[INFO] Connecting to $SESSION:$WINDOW"
echo "[INFO] Detach: Ctrl-b d | Switch: Ctrl-b n/p | Status: Ctrl-b s"
echo ""

if [ -n "${TMUX:-}" ]; then
  tmux switch-client -t "$SESSION:$WINDOW"
else
  tmux attach-session -t "$SESSION:$WINDOW"
fi
