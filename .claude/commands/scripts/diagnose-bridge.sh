#!/bin/bash
# Full diagnostic of Control Bridge API
# Run via: push exec.json with command="bash /tmp/cb-deploy/diagnose-bridge.sh"
# Or inline in exec.json script field

echo "=== CONTROL BRIDGE DIAGNOSTIC ==="
echo "Timestamp: $(date -u)"
echo ""

echo "--- 1. Service status ---"
systemctl is-active control-bridge 2>&1 && echo "ACTIVE" || echo "INACTIVE"
systemctl status control-bridge --no-pager -l 2>&1 | tail -15
echo ""

echo "--- 2. Local health check ---"
curl -sf http://127.0.0.1:3000/health 2>&1 && echo " LOCAL_OK" || echo "LOCAL_FAIL"
echo ""

echo "--- 3. HTTPS health check ---"
curl -sv --max-time 10 https://api.marbomebel.ru/health 2>&1
echo ""

echo "--- 4. TLS certificate ---"
echo | openssl s_client -servername api.marbomebel.ru -connect api.marbomebel.ru:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null || echo "CERT_CHECK_FAIL"
echo ""

echo "--- 5. DNS resolution ---"
dig +short api.marbomebel.ru 2>/dev/null || host api.marbomebel.ru 2>/dev/null || echo "DNS_FAIL"
echo ""

echo "--- 6. Port listeners ---"
ss -tlnp | grep -E '3000|80|443' 2>/dev/null || echo "no relevant ports"
echo ""

echo "--- 7. Docker / Traefik ---"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -10 || echo "no docker"
echo ""

echo "--- 8. Traefik dynamic configs ---"
for d in /opt/n8n-traefik/dynamic /opt/traefik/dynamic /etc/traefik/dynamic; do
  [ -d "$d" ] && ls -la "$d" && cat "$d/api-bridge.yml" 2>/dev/null && break
done
echo ""

echo "--- 9. Traefik logs (api-related) ---"
docker logs $(docker ps -q --filter "name=traefik" 2>/dev/null) --tail 100 2>&1 | grep -i "api\.\|marbomebel\|acme\|cert\|error\|ERR\|404\|502\|503" | tail -30 || echo "no traefik logs"
echo ""

echo "--- 10. Docker bridge connectivity ---"
curl -sf --max-time 5 http://172.17.0.1:3000/health 2>&1 && echo " DOCKER_BRIDGE_OK" || echo "DOCKER_BRIDGE_FAIL"
echo ""

echo "--- 11. Control bridge logs ---"
journalctl -u control-bridge --no-pager -n 30 2>&1 || echo "no journal logs"
echo ""

echo "--- 12. Memory ---"
free -m | head -3
echo ""

echo "--- 13. Disk ---"
df -h / | tail -1
echo ""

echo "--- 14. .env check ---"
test -f /opt/control-bridge/.env && echo ".env exists ($(stat -c '%a' /opt/control-bridge/.env))" || echo ".env MISSING"
grep -c "." /opt/control-bridge/.env 2>/dev/null && echo "lines in .env" || true
echo ""

echo "--- 15. CORS test ---"
curl -sI -X OPTIONS https://api.marbomebel.ru/health \
  -H "Origin: https://chat.openai.com" \
  -H "Access-Control-Request-Method: GET" \
  --max-time 10 2>&1 || echo "CORS_TEST_FAIL"
echo ""

echo "=== DIAGNOSTIC COMPLETE ==="
