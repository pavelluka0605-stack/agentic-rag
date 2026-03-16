#!/bin/bash
# =============================================================================
# Safe restart of Claude Code session
# Stops existing session, waits, starts new one
# =============================================================================
set -euo pipefail

BIN_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[INFO] Restarting Claude Code session..."

"$BIN_DIR/stop.sh"
sleep 2
"$BIN_DIR/start.sh"

echo "[OK] Restart complete."
