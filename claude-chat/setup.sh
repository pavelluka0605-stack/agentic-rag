#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="claude-chat"

echo "=== Claude Chat Setup ==="

# 1. Install dependencies
echo "[1/5] Installing dependencies..."
cd "$APP_DIR"
npm install --production

# 2. Copy Traefik route
echo "[2/5] Configuring Traefik..."
if [ -d /etc/traefik/dynamic ]; then
  sudo cp "$APP_DIR/traefik-route.yml" /etc/traefik/dynamic/claude-chat.yml
  echo "  Traefik config copied to /etc/traefik/dynamic/claude-chat.yml"
else
  echo "  WARNING: /etc/traefik/dynamic/ not found, skipping Traefik config"
fi

# 3. Stop existing process if running
echo "[3/5] Checking existing process..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 delete "$APP_NAME"
  echo "  Stopped existing $APP_NAME"
fi

# 4. Start with PM2
echo "[4/5] Starting with PM2..."
cd "$APP_DIR"
pm2 start server.js --name "$APP_NAME" --cwd "$APP_DIR"
pm2 save

# 5. Setup PM2 startup (if not already)
echo "[5/5] PM2 startup..."
pm2 startup 2>/dev/null || true
pm2 save

echo ""
echo "=== Setup Complete ==="
echo "App running on port 3847"
echo "Bearer token: $(grep BEARER_TOKEN .env | cut -d= -f2)"
echo ""
echo "Access: https://chat.marbomebel.ru"
echo ""
