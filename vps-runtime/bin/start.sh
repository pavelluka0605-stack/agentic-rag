#!/bin/bash
# =============================================================================
# Start Claude Code in a tmux session
# Can be called directly or via systemd
# =============================================================================
set -euo pipefail

# Load environment
ENV_FILE="${CLAUDE_ENV_FILE:-/opt/claude-code/env/claude.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

SESSION="${CLAUDE_TMUX_SESSION:-claude-code}"
WORKSPACE="${CLAUDE_WORKSPACE:-/opt/claude-code/workspace}"
LOG_DIR="${CLAUDE_LOG_DIR:-/opt/claude-code/logs}"
TMUX_CONF="/opt/claude-code/etc/tmux.conf"
LOGFILE="$LOG_DIR/session-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR" "$WORKSPACE"

# ── Pre-checks ──────────────────────────────────────────────────────────────

if ! command -v tmux >/dev/null 2>&1; then
  echo "[FAIL] tmux not found. Run bootstrap.sh first." >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "[FAIL] claude CLI not found. Run bootstrap.sh first." >&2
  exit 1
fi

# ── Check if already running ────────────────────────────────────────────────

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[INFO] Session '$SESSION' already running."
  echo "[INFO] Use connect.sh to attach, or restart.sh to restart."
  exit 0
fi

# ── Build tmux args ─────────────────────────────────────────────────────────

TMUX_ARGS=()
if [ -f "$TMUX_CONF" ]; then
  TMUX_ARGS+=(-f "$TMUX_CONF")
fi

# ── Start tmux session ──────────────────────────────────────────────────────

echo "[INFO] Starting Claude Code tmux session: $SESSION"
echo "[INFO] Workspace: $WORKSPACE"
echo "[INFO] Log: $LOGFILE"

# Create detached tmux session
tmux "${TMUX_ARGS[@]}" new-session -d -s "$SESSION" -c "$WORKSPACE"

# Set up logging (capture all output)
tmux pipe-pane -t "$SESSION" -o "cat >> $LOGFILE"

# Window 0: Claude Code workspace (shell ready for claude commands)
tmux rename-window -t "$SESSION:0" "workspace"
tmux send-keys -t "$SESSION:workspace" "cd $WORKSPACE && echo '=== Claude Code Session Started: $(date) ===' && echo 'Run: claude  (or: claude --resume)'" Enter

# Window 1: monitoring
tmux new-window -t "$SESSION" -n "monitor"
tmux send-keys -t "$SESSION:monitor" "watch -n 30 '/opt/claude-code/bin/health.sh --quiet 2>/dev/null || echo \"health check not available\"'" Enter

# Window 2: logs
tmux new-window -t "$SESSION" -n "logs"
tmux send-keys -t "$SESSION:logs" "tail -f $LOGFILE 2>/dev/null || echo 'No log yet'" Enter

# Select workspace window
tmux select-window -t "$SESSION:workspace"

echo "[OK] Session '$SESSION' started with 3 windows: workspace, monitor, logs"
echo "[INFO] Connect with: /opt/claude-code/bin/connect.sh"

# Log start event
echo "[$(date -Iseconds)] SESSION_START workspace=$WORKSPACE" >> "$LOG_DIR/events.log"
