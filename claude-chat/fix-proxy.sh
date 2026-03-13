#!/bin/bash
# FIX v6: Diagnose and fix SSL certificate for chat.marbomebel.ru
set -uo pipefail

LOGFILE="/tmp/proxy-diag.txt"
exec > >(tee "$LOGFILE") 2>&1

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

echo "=== FIX v6 — SSL Certificate Fix $(date) ==="

COMPOSE_DIR="/opt/n8n-traefik"

# 1. Stop NGINX if running
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

# 2. Check current SSL certificate
echo "--- Current SSL cert for chat.marbomebel.ru ---"
echo | openssl s_client -connect chat.marbomebel.ru:443 -servername chat.marbomebel.ru 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>/dev/null || echo "No valid cert found"

echo ""
echo "--- Current SSL cert for n8n.marbomebel.ru ---"
echo | openssl s_client -connect n8n.marbomebel.ru:443 -servername n8n.marbomebel.ru 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>/dev/null || echo "No valid cert found"

# 3. Check ACME storage
echo ""
echo "--- ACME storage ---"
ACME_FILE="$COMPOSE_DIR/letsencrypt/acme.json"
if [ -f "$ACME_FILE" ]; then
  echo "acme.json exists, size: $(stat -c%s "$ACME_FILE") bytes"
  # Check if chat.marbomebel.ru cert is in ACME storage
  if grep -q "chat.marbomebel.ru" "$ACME_FILE" 2>/dev/null; then
    echo "chat.marbomebel.ru IS in acme.json"
  else
    echo "chat.marbomebel.ru NOT in acme.json — cert not yet obtained!"
  fi
  # Show domains in ACME
  python3 -c "
import json, sys
try:
    with open('$ACME_FILE') as f:
        data = json.load(f)
    for resolver, info in data.items():
        if isinstance(info, dict) and 'Certificates' in info:
            certs = info['Certificates'] or []
            print(f'Resolver {resolver}: {len(certs)} certs')
            for c in certs:
                print(f'  - {c.get(\"domain\",{}).get(\"main\",\"?\")}')
        elif isinstance(info, dict) and 'Account' in info:
            print(f'Resolver {resolver}: account registered')
except Exception as e:
    print(f'Parse error: {e}')
" 2>/dev/null || echo "Could not parse acme.json"
else
  echo "NO acme.json found! Creating directory..."
  mkdir -p "$COMPOSE_DIR/letsencrypt"
  touch "$ACME_FILE"
  chmod 600 "$ACME_FILE"
fi

# 4. Check Traefik compose config
echo ""
echo "--- Traefik compose commands ---"
grep -E 'command:|--' "$COMPOSE_DIR/compose.yaml" 2>/dev/null | head -30

# 5. Check dynamic config
echo ""
echo "--- Dynamic chat.yml ---"
cat "$COMPOSE_DIR/dynamic/chat.yml" 2>/dev/null || echo "MISSING!"

# 6. Verify DNS resolves to this server
echo ""
echo "--- DNS check ---"
MY_IP=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || curl -s --max-time 5 https://icanhazip.com 2>/dev/null || echo "unknown")
CHAT_IP=$(dig +short chat.marbomebel.ru 2>/dev/null || echo "unknown")
N8N_IP=$(dig +short n8n.marbomebel.ru 2>/dev/null || echo "unknown")
echo "Server IP: $MY_IP"
echo "chat.marbomebel.ru -> $CHAT_IP"
echo "n8n.marbomebel.ru -> $N8N_IP"
if [ "$MY_IP" != "$CHAT_IP" ]; then
  echo "WARNING: DNS mismatch! chat.marbomebel.ru does NOT point to this server!"
fi

# 7. Check Traefik entrypoints - make sure TLS challenge works
echo ""
echo "--- Traefik static config check ---"
# Ensure compose.yaml has proper ACME config
if ! grep -q "tlschallenge" "$COMPOSE_DIR/compose.yaml" 2>/dev/null; then
  echo "WARNING: No tlschallenge in compose.yaml!"
fi

# 8. Restart Traefik to trigger cert renewal
echo ""
echo "--- Restarting Traefik ---"
cd "$COMPOSE_DIR"

# Force Traefik to re-request cert by restarting
docker compose restart traefik 2>&1 || docker compose up -d 2>&1
sleep 15

# 9. Check Traefik logs for ACME errors
echo ""
echo "--- Traefik ACME logs ---"
docker logs --tail 40 n8n-traefik-traefik-1 2>&1 | grep -iE "acme|letsencrypt|certificate|tls|error|chat" | tail -20

echo ""
echo "--- Traefik all recent logs ---"
docker logs --tail 20 n8n-traefik-traefik-1 2>&1 | tail -20

# 10. Wait for cert and verify
echo ""
echo "=== VERIFICATION (after restart) ==="
echo "chat.marbomebel.ru SSL cert:"
echo | openssl s_client -connect chat.marbomebel.ru:443 -servername chat.marbomebel.ru 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>/dev/null || echo "Still no valid cert"

echo ""
echo "App :3847:"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "FAIL"
echo ""
echo "chat HTTPS (strict, no -k):"
curl -s --max-time 10 https://chat.marbomebel.ru/api/health 2>&1 || echo "CERT_INVALID"
echo ""
echo "chat HTTPS (skip verify):"
curl -sk --max-time 10 https://chat.marbomebel.ru/api/health || echo "FAIL"
echo ""
echo "n8n HTTPS:"
curl -sk --max-time 10 https://n8n.marbomebel.ru/ -o /dev/null -w "HTTP %{http_code}" || echo "FAIL"
echo ""

echo "Ports:"
ss -tlnp | grep -E ':80 |:443 '
echo ""
echo "Docker:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -10

# Result
echo ""
if curl -s --max-time 10 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: SUCCESS — SSL is VALID, chat.marbomebel.ru works with trusted cert!"
elif curl -sk --max-time 10 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: CERT_PENDING — app works but SSL cert not yet trusted (Let's Encrypt may need a few minutes)"
else
  echo "RESULT: FAIL — chat.marbomebel.ru not reachable"
fi
echo "=== DONE ==="

# Telegram
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  SUMMARY=$(tail -50 "$LOGFILE")
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=FIX v6 SSL:
${SUMMARY}" > /dev/null 2>&1 || true
fi
