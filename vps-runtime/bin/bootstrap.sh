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

for script in start.sh stop.sh restart.sh connect.sh health.sh verify.sh backup-memory.sh smoke-test.sh; do
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

for conf in tmux.conf nginx-webhook.conf; do
  if [ -f "$SCRIPT_DIR/../etc/$conf" ]; then
    cp "$SCRIPT_DIR/../etc/$conf" "$ETC_DIR/$conf"
    ok "$conf installed"
  fi
done

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

# Install systemd units from etc/ directory
for unit in claude-code.service github-webhook.service control-api.service claude-code-health.timer claude-code-health.service; do
  if [ -f "$SCRIPT_DIR/../etc/$unit" ]; then
    cp "$SCRIPT_DIR/../etc/$unit" /etc/systemd/system/
    ok "systemd: $unit installed"
  fi
done

systemctl daemon-reload
systemctl enable claude-code.service 2>/dev/null || true
ok "systemd unit: claude-code.service"

# ── 8. Install MCP memory server ───────────────────────────────────────────

info "8/9 Installing MCP memory server..."

MCP_DIR="/opt/claude-code/memory-server"
MEMORY_DIR="/opt/claude-code/memory"
mkdir -p "$MCP_DIR" "$MEMORY_DIR"

if [ -d "$SCRIPT_DIR/../../.claude/mcp/memory-server" ]; then
  cp "$SCRIPT_DIR/../../.claude/mcp/memory-server/package.json" "$MCP_DIR/"
  cp "$SCRIPT_DIR/../../.claude/mcp/memory-server/index.js" "$MCP_DIR/"
  cp "$SCRIPT_DIR/../../.claude/mcp/memory-server/db.js" "$MCP_DIR/"
  cp "$SCRIPT_DIR/../../.claude/mcp/memory-server/github.js" "$MCP_DIR/"
  cp -r "$SCRIPT_DIR/../../.claude/mcp/memory-server/migrations" "$MCP_DIR/"
  cd "$MCP_DIR" && npm install --omit=dev 2>&1 | tail -3
  ok "MCP memory server installed"
else
  warn "MCP memory server source not found"
fi

# ── 9. Install GitHub Webhook Receiver ──────────────────────────────────────

info "9/9 Installing GitHub webhook receiver..."

WEBHOOK_DIR="/opt/claude-code/github-webhook"
mkdir -p "$WEBHOOK_DIR"

if [ -d "$SCRIPT_DIR/../../vps-runtime/github-webhook" ]; then
  cp "$SCRIPT_DIR/../../vps-runtime/github-webhook/package.json" "$WEBHOOK_DIR/"
  cp "$SCRIPT_DIR/../../vps-runtime/github-webhook/server.js" "$WEBHOOK_DIR/"
  cd "$WEBHOOK_DIR" && npm install --omit=dev 2>&1 | tail -3
  ok "GitHub webhook receiver installed"
fi

# Webhook env
WEBHOOK_ENV="$WEBHOOK_DIR/.env"
if [ ! -f "$WEBHOOK_ENV" ] || [ "$FORCE" = "--force" ]; then
  cat > "$WEBHOOK_ENV" << 'WEBHOOKENV'
WEBHOOK_PORT=3900
GITHUB_WEBHOOK_SECRET=
MEMORY_DB_PATH=/opt/claude-code/memory/memory.db
WEBHOOKENV
  ok "Webhook .env created"
fi

systemctl enable github-webhook.service 2>/dev/null || true
ok "systemd unit: github-webhook.service"

# ── 10. Install Control API ───────────────────────────────────────────────────

info "10/10 Installing Control API..."

CONTROL_DIR="/opt/claude-code/control-api"
mkdir -p "$CONTROL_DIR"

if [ -d "$SCRIPT_DIR/../../vps-runtime/control-api" ]; then
  cp "$SCRIPT_DIR/../../vps-runtime/control-api/package.json" "$CONTROL_DIR/"
  cp "$SCRIPT_DIR/../../vps-runtime/control-api/server.js" "$CONTROL_DIR/"
  ok "Control API installed"
fi

# Control API env (generate token on first install)
CONTROL_ENV="/opt/claude-code/env/control-api.env"
if [ ! -f "$CONTROL_ENV" ] || [ "$FORCE" = "--force" ]; then
  GENERATED_TOKEN=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)
  cat > "$CONTROL_ENV" << CTRLENV
CONTROL_API_PORT=3901
CONTROL_API_TOKEN=$GENERATED_TOKEN
CTRLENV
  chmod 600 "$CONTROL_ENV"
  ok "Control API env created (token auto-generated)"
  warn "Save this token: $GENERATED_TOKEN"
fi

systemctl enable control-api.service 2>/dev/null || true
ok "systemd unit: control-api.service"

# Enable health timer
systemctl enable claude-code-health.timer 2>/dev/null || true
systemctl start claude-code-health.timer 2>/dev/null || true
ok "systemd timer: claude-code-health.timer (every 30min)"

# Setup backup cron
mkdir -p "$INSTALL_DIR/backups"
if ! crontab -l 2>/dev/null | grep -q backup-memory; then
  (crontab -l 2>/dev/null; echo "*/30 * * * * $BIN_DIR/backup-memory.sh >> $LOG_DIR/backup.log 2>&1") | crontab -
  ok "Backup cron configured (every 30min)"
fi

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
