#!/bin/bash
# Auto-fix common Control Bridge issues
# Tries to fix and restart everything

echo "=== CONTROL BRIDGE AUTO-FIX ==="
echo "Timestamp: $(date -u)"
echo ""

FIXED=0

# 1. Check if service is running
echo "--- Check 1: Service status ---"
if ! systemctl is-active control-bridge >/dev/null 2>&1; then
  echo "Service is down. Restarting..."
  systemctl restart control-bridge
  sleep 3
  if systemctl is-active control-bridge >/dev/null 2>&1; then
    echo "FIXED: Service restarted successfully"
    FIXED=$((FIXED+1))
  else
    echo "FAIL: Service won't start"
    journalctl -u control-bridge --no-pager -n 20 2>&1
  fi
else
  echo "OK: Service is running"
fi
echo ""

# 2. Check local health
echo "--- Check 2: Local health ---"
if ! curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
  echo "Local health failed. Restarting service..."
  systemctl restart control-bridge
  sleep 3
  curl -sf http://127.0.0.1:3000/health && echo " FIXED" || echo " STILL FAILING"
  FIXED=$((FIXED+1))
else
  echo "OK: Local health passes"
fi
echo ""

# 3. Check Traefik config
echo "--- Check 3: Traefik config ---"
TRAEFIK_DYN=""
for d in /opt/n8n-traefik/dynamic /opt/traefik/dynamic /etc/traefik/dynamic; do
  [ -d "$d" ] && TRAEFIK_DYN="$d" && break
done
if [ -z "$TRAEFIK_DYN" ]; then
  echo "FAIL: No Traefik dynamic dir found"
elif [ ! -f "$TRAEFIK_DYN/api-bridge.yml" ]; then
  echo "FAIL: api-bridge.yml missing, creating..."
  # Minimal working config
  cat > "$TRAEFIK_DYN/api-bridge.yml" << 'YML'
http:
  routers:
    api-bridge:
      rule: "Host(`api.marbomebel.ru`)"
      entryPoints:
        - websecure
      service: api-bridge
      tls:
        certResolver: mytlschallenge
    api-bridge-http:
      rule: "Host(`api.marbomebel.ru`)"
      entryPoints:
        - web
      middlewares:
        - redirect-to-https
      service: api-bridge
  middlewares:
    redirect-to-https:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    api-bridge:
      loadBalancer:
        servers:
          - url: "http://172.17.0.1:3000"
YML
  echo "FIXED: Created api-bridge.yml"
  FIXED=$((FIXED+1))
else
  echo "OK: Traefik config exists"
fi
echo ""

# 4. Check Docker bridge connectivity
echo "--- Check 4: Docker bridge ---"
if ! curl -sf --max-time 5 http://172.17.0.1:3000/health >/dev/null 2>&1; then
  echo "Docker bridge can't reach port 3000"
  # Check if iptables blocks it
  iptables -L DOCKER-USER -n 2>/dev/null | head -10 || true
  # Try allowing
  iptables -I DOCKER-USER -p tcp --dport 3000 -j ACCEPT 2>/dev/null && echo "FIXED: Added iptables rule" && FIXED=$((FIXED+1)) || true
else
  echo "OK: Docker bridge reaches port 3000"
fi
echo ""

# 5. Check nginx conflict
echo "--- Check 5: Nginx conflict ---"
if [ -f /etc/nginx/sites-enabled/api-marbomebel ]; then
  echo "Removing conflicting nginx config..."
  rm -f /etc/nginx/sites-enabled/api-marbomebel
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null
  echo "FIXED: Removed nginx conflict"
  FIXED=$((FIXED+1))
else
  echo "OK: No nginx conflict"
fi
echo ""

# 6. Kill zombies
echo "--- Check 6: Zombie processes ---"
ZOMBIE_COUNT=$(ps -eo stat --no-headers | grep -c "^Z" || echo 0)
if [ "$ZOMBIE_COUNT" -gt 0 ]; then
  echo "Found $ZOMBIE_COUNT zombies, cleaning..."
  ps -eo pid,ppid,stat --no-headers | awk '$3~/^Z/{print $2}' | sort -u | while read P; do
    kill -SIGCHLD $P 2>/dev/null
  done
  FIXED=$((FIXED+1))
else
  echo "OK: No zombies"
fi
echo ""

# 7. Final verification
echo "--- Final verification ---"
echo "Local health:"
curl -sf http://127.0.0.1:3000/health 2>&1 && echo " OK" || echo " FAIL"
echo "HTTPS health:"
curl -sf --max-time 10 https://api.marbomebel.ru/health 2>&1 && echo " OK" || echo " FAIL"
echo ""

echo "=== AUTO-FIX COMPLETE: ${FIXED} issues fixed ==="
