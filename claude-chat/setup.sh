#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="claude-chat"

echo "=== Claude Chat Setup ==="

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
cd "$APP_DIR"
npm install --production

# 2. Check what's on port 80 and handle it
echo "[2/6] Checking port 80..."
PORT80_PID=$(ss -tlnp | grep ':80 ' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [ -n "$PORT80_PID" ]; then
  PORT80_NAME=$(ps -p "$PORT80_PID" -o comm= 2>/dev/null || echo "unknown")
  echo "  Port 80 is used by: $PORT80_NAME (PID $PORT80_PID)"

  if [ "$PORT80_NAME" = "caddy" ]; then
    echo "  Caddy detected! Configuring Caddy instead of NGINX..."

    # Configure Caddy for chat.marbomebel.ru
    CADDY_CFG="/etc/caddy/Caddyfile"
    if [ -f "$CADDY_CFG" ]; then
      # Add chat.marbomebel.ru block if not already present
      if ! grep -q "chat.marbomebel.ru" "$CADDY_CFG"; then
        cat >> "$CADDY_CFG" << 'CADDY'

chat.marbomebel.ru {
    reverse_proxy 127.0.0.1:3847
}
CADDY
        echo "  Added chat.marbomebel.ru to Caddyfile"
      else
        echo "  chat.marbomebel.ru already in Caddyfile"
      fi
      systemctl reload caddy || caddy reload --config "$CADDY_CFG" 2>/dev/null || true
      echo "  Caddy reloaded"
    else
      echo "  WARNING: Caddyfile not found at $CADDY_CFG"
    fi
  else
    echo "  Stopping $PORT80_NAME to free port 80..."
    kill "$PORT80_PID" 2>/dev/null || true
    sleep 2
    # Proceed to install NGINX
    INSTALL_NGINX=1
  fi
else
  INSTALL_NGINX=1
fi

# 3. Install and configure NGINX (only if Caddy not handling it)
if [ "${INSTALL_NGINX:-}" = "1" ]; then
  echo "[3/6] Setting up NGINX..."
  if ! command -v nginx &>/dev/null; then
    echo "  Installing NGINX..."
    apt-get update -qq
    apt-get install -y -qq nginx
    systemctl enable nginx
  fi

  cat > /etc/nginx/sites-enabled/chat-marbomebel << 'NGINX'
server {
    listen 80;
    server_name chat.marbomebel.ru;

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX

  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl start nginx || systemctl reload nginx
  echo "  NGINX configured for chat.marbomebel.ru"
else
  echo "[3/6] Skipping NGINX (using Caddy)"
fi

# 4. Stop existing process if running
echo "[4/6] Checking existing process..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 delete "$APP_NAME"
  echo "  Stopped existing $APP_NAME"
fi

# 5. Start with PM2
echo "[5/6] Starting with PM2..."
cd "$APP_DIR"
pm2 start server.js --name "$APP_NAME" --cwd "$APP_DIR"
pm2 save

# 6. Setup PM2 startup (if not already)
echo "[6/6] PM2 startup..."
pm2 startup 2>/dev/null || true
pm2 save

echo ""
echo "=== Setup Complete ==="
echo "App running on port 3847"
echo "Access: https://chat.marbomebel.ru"
echo ""
