#!/bin/bash
# Fix chat.marbomebel.ru — add to Traefik in Docker via file provider
set -uo pipefail

LOGFILE="/tmp/proxy-diag.txt"
exec > >(tee "$LOGFILE") 2>&1

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

echo "=== FIX v4 — Traefik file provider $(date) ==="

COMPOSE_DIR="/opt/n8n-traefik"
COMPOSE_FILE="$COMPOSE_DIR/compose.yaml"

# 1. Ensure app is healthy
echo "--- App check ---"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "App down!"

# 2. Get host IP for Docker network
HOST_IP=$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo "172.17.0.1")
echo "Docker host IP: $HOST_IP"

# 3. Create Traefik dynamic config file for chat.marbomebel.ru
echo "--- Creating Traefik dynamic config ---"
mkdir -p "$COMPOSE_DIR/dynamic"

cat > "$COMPOSE_DIR/dynamic/chat.yml" << TREAFIK
http:
  routers:
    chat-marbomebel:
      rule: "Host(\`chat.marbomebel.ru\`)"
      entryPoints:
        - websecure
      service: chat-marbomebel
      tls:
        certResolver: mytlschallenge

  services:
    chat-marbomebel:
      loadBalancer:
        servers:
          - url: "http://${HOST_IP}:3847"
TREAFIK

echo "Dynamic config:"
cat "$COMPOSE_DIR/dynamic/chat.yml"

# 4. Update compose.yaml to add file provider and dynamic config volume
echo ""
echo "--- Updating compose.yaml ---"
echo "Current compose:"
cat "$COMPOSE_FILE"
echo ""

# Check if file provider already configured
if grep -q "providers.file" "$COMPOSE_FILE"; then
  echo "File provider already in compose"
else
  echo "Adding file provider to Traefik..."
  # Add --providers.file.directory=/dynamic and --providers.file.watch=true
  python3 -c "
import yaml, sys

with open('$COMPOSE_FILE') as f:
    data = yaml.safe_load(f)

traefik = data['services']['traefik']

# Add file provider commands
cmds = traefik.get('command', [])
if not any('providers.file' in str(c) for c in cmds):
    cmds.append('--providers.file.directory=/dynamic')
    cmds.append('--providers.file.watch=true')
    traefik['command'] = cmds

# Add dynamic volume
vols = traefik.get('volumes', [])
dynamic_vol = './dynamic:/dynamic:ro'
if dynamic_vol not in vols:
    vols.append(dynamic_vol)
    traefik['volumes'] = vols

with open('$COMPOSE_FILE', 'w') as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False)

print('Updated successfully')
" 2>&1 || {
    echo "Python yaml not available, using sed..."
    # Fallback: add lines manually
    # Add file provider command
    sed -i '/certificatesresolvers.*storage/a\      - "--providers.file.directory=/dynamic"\n      - "--providers.file.watch=true"' "$COMPOSE_FILE"
    # Add volume mount
    sed -i '/var\/run\/docker.sock/a\      - ./dynamic:/dynamic:ro' "$COMPOSE_FILE"
    echo "Added via sed"
  }
fi

echo "Updated compose:"
cat "$COMPOSE_FILE"

# 5. Restart Traefik to pick up changes
echo ""
echo "--- Restarting Traefik ---"
cd "$COMPOSE_DIR"
docker compose up -d traefik 2>&1 || docker-compose up -d traefik 2>&1 || echo "Compose restart failed"
sleep 5

# Check Traefik logs
echo "--- Traefik logs (last 10 lines) ---"
docker logs --tail 10 n8n-traefik-traefik-1 2>&1 || docker logs --tail 10 $(docker ps -q --filter "name=traefik" | head -1) 2>&1 || echo "No logs"

# 6. Verification
echo ""
echo "=== VERIFICATION ==="
echo "Direct :3847:"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "FAIL"
echo ""
echo "HTTPS chat.marbomebel.ru:"
curl -sk --max-time 10 https://chat.marbomebel.ru/api/health || echo "FAIL"
echo ""
echo "HTTP chat.marbomebel.ru:"
curl -s --max-time 10 http://chat.marbomebel.ru/api/health 2>&1 | head -3 || echo "FAIL"
echo ""
echo "HTTPS n8n.marbomebel.ru (should still work):"
curl -sk --max-time 10 https://n8n.marbomebel.ru/ -o /dev/null -w "HTTP %{http_code}" 2>&1 || echo "FAIL"
echo ""
echo "Ports:"
ss -tlnp | grep -E ':80 |:443 '

if curl -sk --max-time 5 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: SUCCESS"
else
  echo "RESULT: NEEDS_TIME_FOR_TLS"
  echo "(Traefik needs ~30s to get Let's Encrypt cert, try again in 1 min)"
fi
echo "=== DONE ==="

# Telegram
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  SUMMARY=$(tail -30 "$LOGFILE")
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=FIX v4 Traefik:
${SUMMARY}" > /dev/null 2>&1 || true
fi
