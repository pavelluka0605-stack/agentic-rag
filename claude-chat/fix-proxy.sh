#!/bin/bash
# Fix chat.marbomebel.ru — Docker blocks port 443
set -uo pipefail

LOGFILE="/tmp/proxy-diag.txt"
exec > >(tee "$LOGFILE") 2>&1

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

echo "=== FIX v3 $(date) ==="

# 1. Docker containers — what's running?
echo "--- Docker containers ---"
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || echo "Docker not available"
echo ""

# 2. Docker container on port 443
echo "--- Docker on 443 ---"
DOCKER_443=$(docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null | grep '443' || echo "none")
echo "$DOCKER_443"

# 3. If it's a reverse proxy in Docker, inspect its config
CONTAINER_ID=$(docker ps -q --filter "publish=443" 2>/dev/null | head -1 || true)
if [ -n "$CONTAINER_ID" ]; then
  CONTAINER_NAME=$(docker inspect --format '{{.Name}}' "$CONTAINER_ID" 2>/dev/null | tr -d '/')
  CONTAINER_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_ID" 2>/dev/null)
  echo "Container: $CONTAINER_NAME ($CONTAINER_IMAGE)"

  # Show docker-compose file if exists
  echo "--- Docker compose ---"
  COMPOSE_FILE=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$CONTAINER_ID" 2>/dev/null || true)
  echo "Compose file: $COMPOSE_FILE"
  [ -n "$COMPOSE_FILE" ] && cat "$COMPOSE_FILE" 2>/dev/null | head -50 || true

  COMPOSE_DIR=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$CONTAINER_ID" 2>/dev/null || true)
  echo "Compose dir: $COMPOSE_DIR"
  [ -n "$COMPOSE_DIR" ] && ls -la "$COMPOSE_DIR/" 2>/dev/null || true
  [ -n "$COMPOSE_DIR" ] && cat "$COMPOSE_DIR/docker-compose.yml" 2>/dev/null | head -50 || true
  [ -n "$COMPOSE_DIR" ] && cat "$COMPOSE_DIR/Caddyfile" 2>/dev/null | head -30 || true

  # Check Caddy in Docker
  if echo "$CONTAINER_IMAGE" | grep -qi caddy; then
    echo "--- Caddy in Docker ---"
    docker exec "$CONTAINER_ID" cat /etc/caddy/Caddyfile 2>/dev/null || echo "No Caddyfile in container"
    echo "--- Caddy API ---"
    curl -s http://localhost:2019/config/ 2>/dev/null | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin),indent=2)[:1000])" 2>/dev/null || echo "No Caddy API"
  fi
fi

# 4. DNS check
echo ""
echo "--- DNS ---"
dig +short chat.marbomebel.ru A 2>/dev/null || host chat.marbomebel.ru 2>/dev/null || nslookup chat.marbomebel.ru 2>/dev/null || echo "No DNS tools"

# 5. NGINX current full config
echo "--- NGINX configs ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
for f in /etc/nginx/sites-enabled/*; do
  echo "=== $f ==="
  cat "$f" 2>/dev/null | head -40
done

echo ""
echo "=== PLAN ==="
echo "Docker container on 443: ${CONTAINER_NAME:-unknown} (${CONTAINER_IMAGE:-unknown})"

# 6. Fix: Add chat.marbomebel.ru to Docker's reverse proxy OR remap ports
if [ -n "$CONTAINER_ID" ]; then
  if echo "$CONTAINER_IMAGE" | grep -qi caddy; then
    echo "FIX: Adding chat.marbomebel.ru to Caddy in Docker"

    # Method 1: Caddy API
    echo "Trying Caddy API..."
    # First get current config
    CURRENT_CFG=$(curl -s http://localhost:2019/config/ 2>/dev/null || echo "{}")
    echo "Current API config: $(echo "$CURRENT_CFG" | head -c 500)"

    # Add via Caddyfile in container
    echo "Trying Caddyfile in Docker..."
    docker exec "$CONTAINER_ID" sh -c '
      CF="/etc/caddy/Caddyfile"
      if [ -f "$CF" ]; then
        if ! grep -q "chat.marbomebel.ru" "$CF"; then
          printf "\nchat.marbomebel.ru {\n    reverse_proxy host.docker.internal:3847\n}\n" >> "$CF"
          echo "Added to Caddyfile"
          cat "$CF"
        else
          echo "Already in Caddyfile"
          cat "$CF"
        fi
        caddy reload --config "$CF" --adapter caddyfile 2>&1 || caddy reload --config "$CF" 2>&1 || echo "Reload failed"
      else
        echo "No Caddyfile, trying /config/..."
        ls /config/ 2>/dev/null
        CF2=$(find / -name "Caddyfile" -maxdepth 4 2>/dev/null | head -1)
        echo "Found: $CF2"
        if [ -n "$CF2" ]; then
          printf "\nchat.marbomebel.ru {\n    reverse_proxy host.docker.internal:3847\n}\n" >> "$CF2"
          caddy reload --config "$CF2" --adapter caddyfile 2>&1 || echo "Reload failed"
          cat "$CF2"
        fi
      fi
    ' 2>&1 || echo "Docker exec failed"

    # Also try with container IP instead of host.docker.internal
    HOST_IP=$(ip route | grep default | awk '{print $3}' 2>/dev/null || echo "172.17.0.1")
    echo "Host IP for Docker: $HOST_IP"
    docker exec "$CONTAINER_ID" sh -c "
      CF=\$(find / -name 'Caddyfile' -maxdepth 4 2>/dev/null | head -1)
      if [ -n \"\$CF\" ]; then
        sed -i 's|host.docker.internal:3847|${HOST_IP}:3847|g' \"\$CF\" 2>/dev/null || true
        caddy reload --config \"\$CF\" --adapter caddyfile 2>&1 || true
      fi
    " 2>&1 || true

  elif echo "$CONTAINER_IMAGE" | grep -qi traefik; then
    echo "FIX: Traefik in Docker - need labels or file provider"
    # Show traefik config
    docker exec "$CONTAINER_ID" cat /etc/traefik/traefik.yml 2>/dev/null || true
    docker exec "$CONTAINER_ID" ls /etc/traefik/ 2>/dev/null || true

  elif echo "$CONTAINER_IMAGE" | grep -qi nginx; then
    echo "FIX: NGINX in Docker"
    docker exec "$CONTAINER_ID" sh -c '
      printf "server {\n    listen 443 ssl;\n    server_name chat.marbomebel.ru;\n    ssl_certificate /etc/ssl/certs/cert.pem;\n    ssl_certificate_key /etc/ssl/private/key.pem;\n    location / {\n        proxy_pass http://host.docker.internal:3847;\n    }\n}\n" > /etc/nginx/conf.d/chat.conf
      nginx -t && nginx -s reload
    ' 2>&1 || echo "NGINX in Docker failed"

  else
    echo "Unknown container image: $CONTAINER_IMAGE"
    echo "Stopping Docker container to free port 443..."
    docker stop "$CONTAINER_ID" 2>&1 || echo "Stop failed"
    sleep 2

    # Now get certbot and configure NGINX
    if ! command -v certbot &>/dev/null; then
      apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx
    fi
    certbot --nginx -d chat.marbomebel.ru --non-interactive --agree-tos --register-unsafely-without-email 2>&1 || echo "Certbot failed"
    # Restart Docker container
    docker start "$CONTAINER_ID" 2>&1 || true
  fi
fi

# 7. Verification
sleep 5
echo ""
echo "=== VERIFICATION ==="
echo "Direct :3847:"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "FAIL"
echo ""
echo "HTTPS:"
curl -sk --max-time 5 https://chat.marbomebel.ru/api/health || echo "FAIL"
echo ""
echo "HTTP:"
curl -s --max-time 5 http://chat.marbomebel.ru/api/health 2>&1 | head -3 || echo "FAIL"
echo ""
echo "Ports:"
ss -tlnp | grep -E ':80 |:443 '

if curl -sk --max-time 5 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: SUCCESS"
else
  echo "RESULT: STILL_BROKEN"
fi
echo "=== DONE ==="

# Telegram
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  SUMMARY=$(cat "$LOGFILE" | tail -50)
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=FIX v3:
${SUMMARY}" > /dev/null 2>&1 || true
fi
