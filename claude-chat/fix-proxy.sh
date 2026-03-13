#!/bin/bash
# URGENT FIX: Stop NGINX, restart Traefik, verify n8n + chat
set -uo pipefail

LOGFILE="/tmp/proxy-diag.txt"
exec > >(tee "$LOGFILE") 2>&1

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

echo "=== URGENT FIX v5 $(date) ==="

COMPOSE_DIR="/opt/n8n-traefik"

# 1. Stop NGINX — it conflicts with Traefik on port 80
echo "--- Stopping NGINX ---"
systemctl stop nginx 2>&1 && echo "NGINX stopped" || echo "NGINX was not running"
systemctl disable nginx 2>&1 || true

# 2. Check if dynamic config exists
echo "--- Dynamic config ---"
cat "$COMPOSE_DIR/dynamic/chat.yml" 2>/dev/null || echo "No dynamic config!"

# 3. Restart Traefik
echo "--- Starting Traefik ---"
cd "$COMPOSE_DIR"
docker compose up -d 2>&1 || echo "Compose up failed"
sleep 10

# 4. Traefik logs
echo "--- Traefik logs ---"
docker logs --tail 20 n8n-traefik-traefik-1 2>&1 | tail -20

# 5. Verification
echo ""
echo "=== VERIFICATION ==="
echo "App :3847:"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "FAIL"
echo ""
echo "n8n.marbomebel.ru HTTPS:"
curl -sk --max-time 10 https://n8n.marbomebel.ru/ -o /dev/null -w "HTTP %{http_code}" || echo "FAIL"
echo ""
echo "chat.marbomebel.ru HTTPS:"
curl -sk --max-time 10 https://chat.marbomebel.ru/api/health || echo "FAIL"
echo ""
echo "chat.marbomebel.ru HTTP (should redirect):"
curl -s --max-time 10 http://chat.marbomebel.ru/api/health -o /dev/null -w "HTTP %{http_code}" || echo "FAIL"
echo ""
echo "Ports:"
ss -tlnp | grep -E ':80 |:443 '
echo ""
echo "Docker:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -10

if curl -sk --max-time 10 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo ""
  echo "RESULT: SUCCESS — chat.marbomebel.ru WORKS!"
elif curl -sk --max-time 10 https://n8n.marbomebel.ru/ -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q "200\|301\|302"; then
  echo ""
  echo "RESULT: N8N_OK_CHAT_PENDING (cert may need 30-60s)"
else
  echo ""
  echo "RESULT: BOTH_DOWN — check Traefik logs!"
fi
echo "=== DONE ==="

# Telegram
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  SUMMARY=$(tail -40 "$LOGFILE")
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=URGENT FIX v5:
${SUMMARY}" > /dev/null 2>&1 || true
fi
