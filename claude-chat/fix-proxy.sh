#!/bin/bash
# Self-diagnosing proxy fix for chat.marbomebel.ru
# Writes all output to /tmp/proxy-diag.txt for retrieval
set -uo pipefail

LOGFILE="/tmp/proxy-diag.txt"
exec > >(tee "$LOGFILE") 2>&1

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

# Load nvm for pm2
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

echo "=== DIAGNOSTICS $(date) ==="

# 1. App health on port 3847
echo "--- App :3847 ---"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "NO_RESPONSE"
echo ""

# 2. What's on port 80 and 443
echo "--- Port 80 ---"
ss -tlnp | grep ':80 ' || echo "NOTHING on port 80"
echo "--- Port 443 ---"
ss -tlnp | grep ':443 ' || echo "NOTHING on port 443"

# 3. Identify the web server
echo "--- Web servers ---"
echo "Caddy bin: $(which caddy 2>/dev/null || echo none)"
echo "Caddy active: $(systemctl is-active caddy 2>/dev/null || echo inactive)"
echo "Caddy version: $(caddy version 2>/dev/null || echo none)"
echo "Nginx bin: $(which nginx 2>/dev/null || echo none)"
echo "Nginx active: $(systemctl is-active nginx 2>/dev/null || echo inactive)"

# 4. Caddyfile
echo "--- Caddyfile search ---"
CADDYFILE=""
for f in /etc/caddy/Caddyfile /root/Caddyfile /opt/caddy/Caddyfile; do
  if [ -f "$f" ]; then
    CADDYFILE="$f"
    echo "Found: $f"
    break
  fi
done
# Check systemd unit for config path
for unit in /etc/systemd/system/caddy.service /lib/systemd/system/caddy.service; do
  if [ -z "$CADDYFILE" ] && [ -f "$unit" ]; then
    echo "Checking $unit..."
    grep -i config "$unit" || true
    CF=$(grep -oP '(?<=--config\s)\S+' "$unit" 2>/dev/null || true)
    [ -n "$CF" ] && [ -f "$CF" ] && CADDYFILE="$CF" && echo "Found from unit: $CF"
  fi
done
echo "Using Caddyfile: ${CADDYFILE:-NOT_FOUND}"
if [ -n "$CADDYFILE" ] && [ -f "$CADDYFILE" ]; then
  echo "--- Caddyfile content ---"
  cat "$CADDYFILE"
  echo "--- end ---"
fi

# 5. All listening ports
echo "--- All TCP ports ---"
ss -tlnp | head -25

# 6. PM2
echo "--- PM2 ---"
pm2 list 2>/dev/null || echo "pm2 not found"

# 7. Caddy systemd unit
echo "--- Caddy service file ---"
cat /etc/systemd/system/caddy.service 2>/dev/null || cat /lib/systemd/system/caddy.service 2>/dev/null || echo "No caddy service file"

# 8. Caddy admin API
echo "--- Caddy admin API /config/ ---"
curl -s --max-time 3 http://localhost:2019/config/ 2>/dev/null | head -c 1000 || echo "No Caddy admin API"
echo ""

echo ""
echo "=== FIXING ==="

# Ensure app is running
APP_OK=$(curl -s --max-time 5 http://127.0.0.1:3847/api/health 2>/dev/null || echo "")
if ! echo "$APP_OK" | grep -q '"ok"'; then
  echo "App not healthy, restarting PM2..."
  cd /opt/claude-chat 2>/dev/null || true
  pm2 restart claude-chat 2>/dev/null || pm2 start server.js --name claude-chat --cwd /opt/claude-chat 2>/dev/null || true
  sleep 2
  curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "STILL_DOWN"
else
  echo "App healthy on :3847"
fi

# Determine strategy
CADDY_ACTIVE=$(systemctl is-active caddy 2>/dev/null || echo "inactive")
PORT80_HAS_CADDY=$(ss -tlnp | grep ':80 ' | grep caddy || true)

if [ "$CADDY_ACTIVE" = "active" ] || [ -n "$PORT80_HAS_CADDY" ]; then
  echo "Strategy: CADDY"

  if [ -z "$CADDYFILE" ]; then
    mkdir -p /etc/caddy
    CADDYFILE="/etc/caddy/Caddyfile"
    echo "Created $CADDYFILE"
  fi

  # Remove old chat entry
  if [ -f "$CADDYFILE" ] && grep -q "chat.marbomebel.ru" "$CADDYFILE"; then
    echo "Removing old chat.marbomebel.ru entry..."
    python3 -c "
import re
cf='${CADDYFILE}'
with open(cf) as f: c=f.read()
c=re.sub(r'\n*chat\.marbomebel\.ru\s*\{[^}]*\}', '', c)
with open(cf,'w') as f: f.write(c.strip()+'\n')
" 2>/dev/null && echo "Removed" || echo "WARN: python3 cleanup failed"
  fi

  # Append config
  printf '\nchat.marbomebel.ru {\n    reverse_proxy 127.0.0.1:3847\n}\n' >> "$CADDYFILE"
  echo "Appended chat.marbomebel.ru block"
  echo "--- Final Caddyfile ---"
  cat "$CADDYFILE"
  echo "--- end ---"

  # Validate
  echo "Validating..."
  caddy validate --config "$CADDYFILE" --adapter caddyfile 2>&1 || echo "VALIDATE_FAIL"

  # Reload
  echo "Reloading..."
  caddy reload --config "$CADDYFILE" --adapter caddyfile 2>&1 && echo "caddy reload OK" || {
    echo "caddy reload failed, trying systemctl..."
    systemctl reload caddy 2>&1 && echo "systemctl reload OK" || {
      echo "reload failed, trying restart..."
      systemctl restart caddy 2>&1 && echo "restart OK" || echo "ALL FAILED"
    }
  }

else
  NGINX_ACTIVE=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
  PORT80_HAS_NGINX=$(ss -tlnp | grep ':80 ' | grep nginx || true)

  if [ "$NGINX_ACTIVE" = "active" ] || [ -n "$PORT80_HAS_NGINX" ]; then
    echo "Strategy: NGINX"
  else
    echo "Strategy: Install NGINX"
    PORT80_PID=$(ss -tlnp | grep ':80 ' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    [ -n "$PORT80_PID" ] && kill "$PORT80_PID" 2>/dev/null && sleep 2 && echo "Killed PID $PORT80_PID"
    apt-get update -qq 2>&1
    apt-get install -y -qq nginx 2>&1
    rm -f /etc/nginx/sites-enabled/default
  fi

  printf 'server {\n    listen 80;\n    server_name chat.marbomebel.ru;\n    location / {\n        proxy_pass http://127.0.0.1:3847;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_read_timeout 300s;\n    }\n}\n' > /etc/nginx/sites-enabled/chat-marbomebel
  nginx -t 2>&1 && echo "nginx config OK"
  systemctl reload nginx 2>&1 || systemctl start nginx 2>&1
  echo "NGINX configured"
fi

sleep 3

echo ""
echo "=== VERIFICATION ==="
echo "Direct :3847:"
curl -s --max-time 5 http://127.0.0.1:3847/api/health || echo "FAIL"
echo ""
echo "Proxy (Host header):"
curl -s --max-time 5 -H "Host: chat.marbomebel.ru" http://127.0.0.1/api/health || echo "FAIL"
echo ""
echo "HTTPS:"
curl -sk --max-time 5 https://chat.marbomebel.ru/api/health || echo "FAIL"
echo ""
echo "HTTP:"
curl -s --max-time 5 http://chat.marbomebel.ru/api/health || echo "FAIL"
echo ""

# Final verdict
if curl -s --max-time 5 -H "Host: chat.marbomebel.ru" http://127.0.0.1/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: PROXY_OK"
elif curl -sk --max-time 5 https://chat.marbomebel.ru/api/health 2>/dev/null | grep -q '"ok"'; then
  echo "RESULT: HTTPS_OK"
else
  echo "RESULT: STILL_BROKEN"
  echo "--- Extra debug ---"
  echo "Port 80 now:"
  ss -tlnp | grep ':80 ' || echo "NOTHING"
  echo "Port 443 now:"
  ss -tlnp | grep ':443 ' || echo "NOTHING"
fi

echo ""
echo "=== DONE ==="

# Send summary to Telegram
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  SUMMARY=$(tail -30 "$LOGFILE")
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=CHAT PROXY FIX:
${SUMMARY}" > /dev/null 2>&1 || true
fi
