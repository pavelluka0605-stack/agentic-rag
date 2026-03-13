#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="claude-chat"

echo "=== Claude Chat Setup ==="

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
cd "$APP_DIR"
npm install --production

# 2. Install NGINX if not present
echo "[2/6] Checking NGINX..."
if ! command -v nginx &>/dev/null; then
  echo "  Installing NGINX..."
  apt-get update -qq
  apt-get install -y -qq nginx
  systemctl enable nginx
fi

# 3. Configure NGINX for chat.marbomebel.ru
echo "[3/6] Configuring NGINX..."
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

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx || systemctl start nginx
echo "  NGINX configured for chat.marbomebel.ru"

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
echo "NGINX proxying chat.marbomebel.ru -> :3847"
echo ""
echo "Access: http://chat.marbomebel.ru"
echo "For HTTPS run: certbot --nginx -d chat.marbomebel.ru"
echo ""
