#!/bin/bash
# Self-diagnosing proxy fix for chat.marbomebel.ru
# Sends all output to Telegram for remote monitoring
set -uo pipefail

LOG=""
log() { echo "$1"; LOG="${LOG}${1}\n"; }

TG_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT="${TG_CHAT_ID:-}"

send_telegram() {
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    local msg="🔧 CHAT PROXY FIX\n\n${LOG}"
    curl -s --max-time 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TG_CHAT}" \
      --data-urlencode "text=$(printf "$msg")" > /dev/null 2>&1 || true
  fi
}
trap send_telegram EXIT

# Load nvm for pm2
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true

log "=== DIAGNOSTICS ==="

# 1. App health on port 3847
APP_HEALTH=$(curl -s --max-time 5 http://127.0.0.1:3847/api/health 2>&1 || echo "NO_RESPONSE")
log "App :3847 = $APP_HEALTH"

# 2. What's on port 80 and 443
PORT80=$(ss -tlnp | grep ':80 ' || echo "NOTHING")
PORT443=$(ss -tlnp | grep ':443 ' || echo "NOTHING")
log "Port 80: $PORT80"
log "Port 443: $PORT443"

# 3. Identify the web server
CADDY_BIN=$(which caddy 2>/dev/null || echo "")
NGINX_BIN=$(which nginx 2>/dev/null || echo "")
CADDY_ACTIVE=$(systemctl is-active caddy 2>/dev/null || echo "inactive")
NGINX_ACTIVE=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
log "Caddy bin: ${CADDY_BIN:-none} active: $CADDY_ACTIVE"
log "Nginx bin: ${NGINX_BIN:-none} active: $NGINX_ACTIVE"

# 4. Caddy details
if [ -n "$CADDY_BIN" ]; then
  CADDY_VER=$(caddy version 2>&1 || echo "?")
  log "Caddy version: $CADDY_VER"
fi

# Find Caddyfile
CADDYFILE=""
for f in /etc/caddy/Caddyfile /root/Caddyfile /opt/caddy/Caddyfile /home/*/Caddyfile; do
  [ -f "$f" ] && CADDYFILE="$f" && break
done
# Check systemd for config path
if [ -z "$CADDYFILE" ] && [ -f /etc/systemd/system/caddy.service ]; then
  CADDYFILE=$(grep -oP '(?<=--config\s)\S+' /etc/systemd/system/caddy.service 2>/dev/null || true)
fi
if [ -z "$CADDYFILE" ] && [ -f /lib/systemd/system/caddy.service ]; then
  CADDYFILE=$(grep -oP '(?<=--config\s)\S+' /lib/systemd/system/caddy.service 2>/dev/null || true)
fi
log "Caddyfile: ${CADDYFILE:-NOT_FOUND}"

if [ -n "$CADDYFILE" ] && [ -f "$CADDYFILE" ]; then
  CADDYFILE_CONTENT=$(cat "$CADDYFILE" 2>/dev/null)
  log "Caddyfile content:\n$CADDYFILE_CONTENT"
fi

# 5. Check all listening ports
ALL_PORTS=$(ss -tlnp 2>/dev/null | head -25)
log "All ports:\n$ALL_PORTS"

# 6. PM2 status
PM2_LIST=$(pm2 list 2>/dev/null || echo "pm2 not found")
log "PM2: $PM2_LIST"

log ""
log "=== FIXING ==="

# Ensure app is running
if ! echo "$APP_HEALTH" | grep -q '"ok"'; then
  log "App not healthy, restarting PM2..."
  cd /opt/claude-chat 2>/dev/null
  pm2 restart claude-chat 2>/dev/null || pm2 start server.js --name claude-chat --cwd /opt/claude-chat 2>/dev/null
  sleep 2
  APP_HEALTH=$(curl -s --max-time 5 http://127.0.0.1:3847/api/health 2>&1 || echo "STILL_DOWN")
  log "App after restart: $APP_HEALTH"
fi

# Fix proxy
if [ "$CADDY_ACTIVE" = "active" ] || echo "$PORT80" | grep -q caddy; then
  log "Strategy: Caddy"

  if [ -z "$CADDYFILE" ]; then
    mkdir -p /etc/caddy
    CADDYFILE="/etc/caddy/Caddyfile"
    log "Created new Caddyfile at $CADDYFILE"
  fi

  # Remove old chat entry with python3
  if [ -f "$CADDYFILE" ] && grep -q "chat.marbomebel.ru" "$CADDYFILE"; then
    log "Removing old chat.marbomebel.ru entry..."
    python3 << 'PYEOF'
import re
caddyfile = "$CADDYFILE"  # won't be substituted in quoted heredoc
PYEOF
    # Use shell variable properly
    python3 -c "
import re, sys
cf='$CADDYFILE'
with open(cf) as f: c=f.read()
c=re.sub(r'\n*chat\.marbomebel\.ru\s*\{[^}]*\}', '', c)
with open(cf,'w') as f: f.write(c.strip()+'\n')
" 2>/dev/null || log "WARN: python3 cleanup failed"
  fi

  # Append config
  printf '\nchat.marbomebel.ru {\n    reverse_proxy 127.0.0.1:3847\n}\n' >> "$CADDYFILE"
  log "Appended chat.marbomebel.ru block"

  # Show final Caddyfile
  FINAL_CF=$(cat "$CADDYFILE")
  log "Final Caddyfile:\n$FINAL_CF"

  # Validate with --adapter caddyfile (important!)
  VALIDATE=$(caddy validate --config "$CADDYFILE" --adapter caddyfile 2>&1 || echo "VALIDATE_FAIL")
  log "Caddy validate: $VALIDATE"

  # Reload - try multiple methods
  RELOAD=$(caddy reload --config "$CADDYFILE" --adapter caddyfile 2>&1) && log "caddy reload OK: $RELOAD" || {
    log "caddy reload failed: $RELOAD"
    RELOAD2=$(systemctl reload caddy 2>&1) && log "systemctl reload OK" || {
      log "systemctl reload failed: $RELOAD2"
      RELOAD3=$(systemctl restart caddy 2>&1) && log "systemctl restart OK" || log "ALL RELOADS FAILED: $RELOAD3"
    }
  }

elif [ "$NGINX_ACTIVE" = "active" ] || echo "$PORT80" | grep -q nginx; then
  log "Strategy: NGINX"
  printf 'server {\n    listen 80;\n    server_name chat.marbomebel.ru;\n    location / {\n        proxy_pass http://127.0.0.1:3847;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_read_timeout 300s;\n    }\n}\n' > /etc/nginx/sites-enabled/chat-marbomebel
  TEST=$(nginx -t 2>&1)
  log "nginx -t: $TEST"
  systemctl reload nginx 2>&1
  log "NGINX reloaded"

else
  log "Strategy: No known webserver, installing NGINX"
  # Kill whatever is on port 80
  PORT80_PID=$(echo "$PORT80" | grep -oP 'pid=\K[0-9]+' | head -1 || true)
  if [ -n "$PORT80_PID" ]; then
    kill "$PORT80_PID" 2>/dev/null && sleep 2
    log "Killed PID $PORT80_PID"
  fi

  apt-get update -qq 2>&1
  apt-get install -y -qq nginx 2>&1
  printf 'server {\n    listen 80;\n    server_name chat.marbomebel.ru;\n    location / {\n        proxy_pass http://127.0.0.1:3847;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_read_timeout 300s;\n    }\n}\n' > /etc/nginx/sites-enabled/chat-marbomebel
  rm -f /etc/nginx/sites-enabled/default
  nginx -t 2>&1 && systemctl start nginx 2>&1
  systemctl enable nginx 2>&1
  log "NGINX installed and started"
fi

sleep 3

log ""
log "=== VERIFICATION ==="

# Test 1: Direct app
V1=$(curl -s --max-time 5 http://127.0.0.1:3847/api/health 2>&1 || echo "FAIL")
log "Direct :3847 = $V1"

# Test 2: Via proxy with Host header
V2=$(curl -s --max-time 5 -H "Host: chat.marbomebel.ru" http://127.0.0.1/api/health 2>&1 || echo "FAIL")
log "Proxy localhost = $V2"

# Test 3: Via HTTPS (if Caddy auto-TLS)
V3=$(curl -sk --max-time 5 https://chat.marbomebel.ru/api/health 2>&1 || echo "FAIL")
log "HTTPS = $V3"

# Test 4: Via HTTP
V4=$(curl -s --max-time 5 http://chat.marbomebel.ru/api/health 2>&1 || echo "FAIL")
log "HTTP = $V4"

# Final status
if echo "$V2" | grep -q '"ok"'; then
  log ""
  log "✅ PROXY WORKS! chat.marbomebel.ru -> :3847"
elif echo "$V3" | grep -q '"ok"'; then
  log ""
  log "✅ HTTPS WORKS! chat.marbomebel.ru -> :3847"
else
  log ""
  log "❌ PROXY STILL BROKEN"
  # Extra debug
  log "Port 80 after fix: $(ss -tlnp | grep ':80 ' || echo NOTHING)"
  log "Port 443 after fix: $(ss -tlnp | grep ':443 ' || echo NOTHING)"

  # Try direct caddy API if available
  if [ -n "$CADDY_BIN" ]; then
    CADDY_CFG_API=$(curl -s http://localhost:2019/config/ 2>&1 | head -c 500 || echo "no admin API")
    log "Caddy admin API: $CADDY_CFG_API"
  fi
fi

log ""
log "=== DONE ==="
