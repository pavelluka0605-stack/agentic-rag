#!/bin/bash
# Fix HTTPS proxy for chat.marbomebel.ru
# Problem: Docker-proxy on 443 returns 404. Need NGINX with SSL on 443.
set -uo pipefail

LOGFILE="/tmp/proxy-diag.txt"
exec > >(tee "$LOGFILE") 2>&1

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

echo "=== FIX HTTPS PROXY $(date) ==="

# 1. Find what Docker container is on port 443
echo "--- Docker on 443 ---"
DOCKER_PID=$(ss -tlnp | grep '0.0.0.0:443' | grep -oP 'pid=\K[0-9]+' || true)
echo "PID on 443: $DOCKER_PID"
if [ -n "$DOCKER_PID" ]; then
  DOCKER_CONTAINER=$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null | grep '443' || true)
  echo "Docker containers on 443: $DOCKER_CONTAINER"
  docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null || true
fi

# 2. Check current NGINX config
echo "--- Current NGINX config ---"
cat /etc/nginx/sites-enabled/chat-marbomebel 2>/dev/null || echo "No chat config"
echo "--- nginx.conf includes ---"
grep -r "include" /etc/nginx/nginx.conf 2>/dev/null | head -5 || true

# 3. Install certbot
echo "--- Installing certbot ---"
if ! command -v certbot &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
  echo "Certbot installed"
else
  echo "Certbot already installed: $(certbot --version 2>&1)"
fi

# 4. Make sure NGINX listens on 443 too
# First, we need to stop Docker from using 443 OR make NGINX use a different approach
# Check if Docker container on 443 is for n8n
echo "--- Docker inspect ---"
DOCKER_443_ID=$(docker ps -q --filter "publish=443" 2>/dev/null | head -1 || true)
if [ -n "$DOCKER_443_ID" ]; then
  DOCKER_443_NAME=$(docker inspect --format '{{.Name}}' "$DOCKER_443_ID" 2>/dev/null || echo "unknown")
  DOCKER_443_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$DOCKER_443_ID" 2>/dev/null || echo "unknown")
  echo "Container on 443: $DOCKER_443_NAME ($DOCKER_443_IMAGE)"

  # Check if it's a reverse proxy (caddy/traefik/nginx in docker)
  if echo "$DOCKER_443_IMAGE" | grep -qiE "caddy|traefik|nginx"; then
    echo "Docker reverse proxy detected: $DOCKER_443_IMAGE"

    # If it's Caddy in Docker, we can configure it via admin API or docker exec
    if echo "$DOCKER_443_IMAGE" | grep -qi caddy; then
      echo "Caddy in Docker! Configuring via API..."
      # Try Caddy admin API
      CADDY_API=$(curl -s --max-time 3 http://localhost:2019/config/ 2>/dev/null || echo "no_api")
      echo "Caddy API: $(echo "$CADDY_API" | head -c 300)"

      # Add route via Caddy API
      curl -s -X POST http://localhost:2019/config/apps/http/servers/srv0/routes \
        -H "Content-Type: application/json" \
        -d '{
          "@id": "chat-marbomebel",
          "match": [{"host": ["chat.marbomebel.ru"]}],
          "handle": [{"handler": "reverse_proxy", "upstreams": [{"dial": "host.docker.internal:3847"}]}]
        }' 2>&1 && echo "Caddy API route added" || echo "Caddy API failed"

      # Also try docker exec with Caddyfile
      CADDY_CONTAINER_ID="$DOCKER_443_ID"
      docker exec "$CADDY_CONTAINER_ID" sh -c 'cat /etc/caddy/Caddyfile 2>/dev/null || echo "no caddyfile"' 2>/dev/null || true
    fi

    if echo "$DOCKER_443_IMAGE" | grep -qi traefik; then
      echo "Traefik in Docker! Need to add labels or file provider config"
    fi
  fi
else
  echo "No Docker container explicitly publishing 443"
fi

# 5. Strategy: Stop Docker from 443, let NGINX handle everything
# OR: Configure NGINX on 443 with a different approach
echo ""
echo "--- Strategy: NGINX SSL ---"

# Check if port 443 is available for NGINX (stop Docker if needed)
# First try certbot with NGINX (it handles 443 automatically)
echo "Trying certbot..."
certbot --nginx -d chat.marbomebel.ru --non-interactive --agree-tos --register-unsafely-without-email 2>&1 || {
  echo "Certbot failed. Trying alternative..."

  # If certbot failed because 443 is taken, try standalone with webroot
  certbot certonly --webroot -w /var/www/html -d chat.marbomebel.ru --non-interactive --agree-tos --register-unsafely-without-email 2>&1 || {
    echo "Webroot also failed. Trying standalone with port 80..."
    # Stop NGINX temporarily for standalone
    systemctl stop nginx 2>/dev/null
    certbot certonly --standalone -d chat.marbomebel.ru --non-interactive --agree-tos --register-unsafely-without-email --preferred-challenges http 2>&1 || echo "All certbot methods failed"
    systemctl start nginx 2>/dev/null
  }
}

# 6. If we got a cert, configure NGINX manually for SSL
if [ -d /etc/letsencrypt/live/chat.marbomebel.ru ]; then
  echo "SSL cert exists! Configuring NGINX for HTTPS..."

  # Write NGINX config with SSL - need port 443 free
  # Check if we can listen on 443
  NGINX_443_POSSIBLE=true
  if ss -tlnp | grep '0.0.0.0:443' | grep -v nginx > /dev/null 2>&1; then
    echo "Port 443 still taken by non-NGINX process"
    NGINX_443_POSSIBLE=false
  fi

  if [ "$NGINX_443_POSSIBLE" = true ]; then
    printf 'server {\n    listen 80;\n    server_name chat.marbomebel.ru;\n    return 301 https://$host$request_uri;\n}\n\nserver {\n    listen 443 ssl;\n    server_name chat.marbomebel.ru;\n\n    ssl_certificate /etc/letsencrypt/live/chat.marbomebel.ru/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/chat.marbomebel.ru/privkey.pem;\n\n    location / {\n        proxy_pass http://127.0.0.1:3847;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n    }\n}\n' > /etc/nginx/sites-enabled/chat-marbomebel
    nginx -t 2>&1 && systemctl reload nginx 2>&1
    echo "NGINX SSL configured"
  else
    echo "Cannot use port 443 - Docker is blocking it"
    echo "Keeping HTTP-only proxy (port 80)"
  fi
else
  echo "No SSL cert obtained"
fi

# 7. Verification
sleep 3
echo ""
echo "=== VERIFICATION ==="
echo "Direct :3847:"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "FAIL"
echo ""
echo "HTTP proxy:"
curl -s --max-time 5 -H "Host: chat.marbomebel.ru" http://127.0.0.1/api/health || echo "FAIL"
echo ""
echo "HTTPS proxy:"
curl -sk --max-time 5 -H "Host: chat.marbomebel.ru" https://127.0.0.1/api/health || echo "FAIL"
echo ""
echo "External HTTP:"
curl -sL --max-time 5 http://chat.marbomebel.ru/api/health 2>&1 | head -3 || echo "FAIL"
echo ""
echo "External HTTPS:"
curl -sk --max-time 5 https://chat.marbomebel.ru/api/health 2>&1 | head -3 || echo "FAIL"
echo ""

# Status
echo "--- Port status after fix ---"
ss -tlnp | grep -E ':80 |:443 '

if curl -sk --max-time 5 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: HTTPS_OK"
elif curl -s --max-time 5 -H "Host: chat.marbomebel.ru" http://127.0.0.1/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: HTTP_PROXY_OK_BUT_HTTPS_BROKEN"
else
  echo "RESULT: STILL_BROKEN"
fi

echo "=== DONE ==="

# Telegram
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  SUMMARY=$(tail -30 "$LOGFILE")
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=CHAT PROXY FIX:
${SUMMARY}" > /dev/null 2>&1 || true
fi
