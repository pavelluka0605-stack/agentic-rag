#!/bin/bash
# =============================================================================
# Claude Code VPS Bootstrap — one-time setup
# Usage: bash bootstrap.sh [--force]
# =============================================================================
set -euo pipefail

FORCE="${1:-}"
INSTALL_DIR="/opt/claude-code"
WORKSPACE_DIR="/opt/claude-code/workspace"
LOG_DIR="/opt/claude-code/logs"
BIN_DIR="/opt/claude-code/bin"
ENV_DIR="/opt/claude-code/env"
ETC_DIR="/opt/claude-code/etc"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ── Pre-checks ──────────────────────────────────────────────────────────────

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root (or with sudo)"
fi

info "Claude Code VPS Bootstrap starting..."

# ── 1. System dependencies ──────────────────────────────────────────────────

info "1/7 Checking system dependencies..."

if ! command -v tmux >/dev/null 2>&1; then
  info "Installing tmux..."
  apt-get update -qq && apt-get install -y -qq tmux
fi
ok "tmux $(tmux -V)"

if ! command -v node >/dev/null 2>&1; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
ok "node $(node --version)"

if ! command -v git >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq git
fi
ok "git $(git --version | cut -d' ' -f3)"

if ! command -v jq >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq jq
fi
ok "jq installed"

# ── 2. Install Claude Code CLI ──────────────────────────────────────────────

info "2/7 Installing Claude Code CLI..."

if command -v claude >/dev/null 2>&1 && [ "$FORCE" != "--force" ]; then
  ok "Claude Code already installed: $(claude --version 2>/dev/null || echo 'version unknown')"
else
  npm install -g @anthropic-ai/claude-code
  ok "Claude Code installed: $(claude --version 2>/dev/null || echo 'installed')"
fi

# ── 3. Directory structure ──────────────────────────────────────────────────

info "3/7 Creating directory structure..."

mkdir -p "$INSTALL_DIR" "$WORKSPACE_DIR" "$LOG_DIR" "$BIN_DIR" "$ENV_DIR" "$ETC_DIR"

ok "Directory structure:"
echo "  /opt/claude-code/"
echo "  ├── bin/          # Runtime scripts"
echo "  ├── env/          # Environment files"
echo "  ├── etc/          # Configs (tmux, systemd)"
echo "  ├── logs/         # Session logs"
echo "  └── workspace/    # Git repos & working dirs"

# ── 4. Copy runtime scripts ────────────────────────────────────────────────

info "4/7 Installing runtime scripts..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for script in start.sh stop.sh restart.sh connect.sh health.sh; do
  if [ -f "$SCRIPT_DIR/$script" ]; then
    cp "$SCRIPT_DIR/$script" "$BIN_DIR/$script"
    chmod +x "$BIN_DIR/$script"
    ok "Installed $script"
  else
    warn "$script not found in $SCRIPT_DIR"
  fi
done

# ── 5. Install tmux config ─────────────────────────────────────────────────

info "5/7 Installing tmux config..."

if [ -f "$SCRIPT_DIR/../etc/tmux.conf" ]; then
  cp "$SCRIPT_DIR/../etc/tmux.conf" "$ETC_DIR/tmux.conf"
  ok "tmux.conf installed"
else
  warn "tmux.conf not found, will use defaults"
fi

# ── 6. Create environment template ─────────────────────────────────────────

info "6/7 Setting up environment..."

ENV_FILE="$ENV_DIR/claude.env"
if [ ! -f "$ENV_FILE" ] || [ "$FORCE" = "--force" ]; then
  cat > "$ENV_FILE" << 'ENVEOF'
# Claude Code Runtime Environment
# ──────────────────────────────────
# Required: set ANTHROPIC_API_KEY before starting
ANTHROPIC_API_KEY=

# Working directory for Claude Code sessions
CLAUDE_WORKSPACE=/opt/claude-code/workspace

# tmux session name
CLAUDE_TMUX_SESSION=claude-code

# Logging
CLAUDE_LOG_DIR=/opt/claude-code/logs

# Optional: GitHub token for repo operations
GITHUB_TOKEN=

# Optional: additional MCP servers
# CLAUDE_MCP_SERVERS=memory,github
ENVEOF
  ok "Environment template created at $ENV_FILE"
  warn "IMPORTANT: Set ANTHROPIC_API_KEY in $ENV_FILE before starting!"
else
  ok "Environment file already exists"
fi

# ── 7. Install systemd unit ────────────────────────────────────────────────

info "7/7 Installing systemd service..."

cat > /etc/systemd/system/claude-code.service << 'UNITEOF'
[Unit]
Description=Claude Code Runtime (tmux session)
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=root
EnvironmentFile=/opt/claude-code/env/claude.env
ExecStart=/opt/claude-code/bin/start.sh
ExecStop=/opt/claude-code/bin/stop.sh
ExecReload=/opt/claude-code/bin/restart.sh
Restart=on-failure
RestartSec=10
TimeoutStartSec=30
TimeoutStopSec=30

# Keep tmux session alive
KillMode=none
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable claude-code.service 2>/dev/null || true
ok "systemd unit installed and enabled"

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Claude Code VPS Bootstrap Complete          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Set ANTHROPIC_API_KEY in /opt/claude-code/env/claude.env"
echo "  2. Clone your repos into /opt/claude-code/workspace/"
echo "  3. Start:   systemctl start claude-code"
echo "  4. Connect: /opt/claude-code/bin/connect.sh"
echo "  5. Health:  /opt/claude-code/bin/health.sh"
echo ""
echo "Quick start:"
echo "  /opt/claude-code/bin/start.sh          # Start session"
echo "  /opt/claude-code/bin/connect.sh        # Attach to session"
echo "  /opt/claude-code/bin/health.sh         # Check health"
echo "  /opt/claude-code/bin/restart.sh        # Safe restart"
echo ""
