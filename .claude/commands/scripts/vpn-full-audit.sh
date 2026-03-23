#!/bin/bash
# Full VPS audit for VPN infrastructure planning
set -euo pipefail

echo "=== VPN INFRASTRUCTURE AUDIT ==="
echo "Date: $(date -u)"
echo "Host: $(hostname)"
echo ""

# 1. System resources
echo "--- SYSTEM RESOURCES ---"
echo "CPU: $(nproc) cores"
echo "RAM: $(free -h | awk '/Mem:/{print $2}') total, $(free -h | awk '/Mem:/{print $3}') used, $(free -h | awk '/Mem:/{print $4}') free"
echo "Disk: $(df -h / | awk 'NR==2{print $2}') total, $(df -h / | awk 'NR==2{print $3}') used, $(df -h / | awk 'NR==2{print $4}') free ($(df -h / | awk 'NR==2{print $5}') used)"
echo "Load: $(uptime | awk -F'load average:' '{print $2}')"
echo ""

# 2. Docker containers
echo "--- DOCKER CONTAINERS ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not available"
echo ""

# 3. Port 443 usage
echo "--- PORT 443 DETAILS ---"
ss -tlnp | grep ':443' || echo "Port 443 not in use"
echo ""

# 4. All listening ports
echo "--- ALL LISTENING PORTS ---"
ss -tlnp | grep LISTEN | sort -t: -k2 -n
echo ""

# 5. Traefik config
echo "--- TRAEFIK CONFIG ---"
docker inspect traefik --format '{{json .Config.Cmd}}' 2>/dev/null | jq -r '.[]' 2>/dev/null || echo "No traefik container or jq not available"
echo ""
# Check traefik compose/config
for f in /opt/*/docker-compose*.yml /opt/*/traefik*.yml /root/*/docker-compose*.yml; do
    if [ -f "$f" ] && grep -l traefik "$f" 2>/dev/null; then
        echo "Traefik config found: $f"
        grep -A5 -B2 '443\|entrypoint\|tls\|cert' "$f" 2>/dev/null || true
    fi
done 2>/dev/null
echo ""

# 6. Nginx config
echo "--- NGINX STATUS ---"
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "Nginx: ACTIVE"
    nginx -T 2>/dev/null | grep -E 'server_name|listen|proxy_pass|ssl_certificate' | head -30
else
    echo "Nginx: not running"
fi
echo ""

# 7. 3X-UI status
echo "--- 3X-UI STATUS ---"
if systemctl is-active --quiet x-ui 2>/dev/null; then
    echo "x-ui: ACTIVE"
    x-ui settings 2>/dev/null || true
    echo ""
    echo "Xray process:"
    ps aux | grep xray | grep -v grep || echo "No xray process"
    echo ""
    echo "Xray config:"
    cat /usr/local/x-ui/bin/config.json 2>/dev/null | jq '.inbounds[]? | {tag, protocol, port, listen}' 2>/dev/null || echo "No config or not readable"
else
    echo "x-ui: NOT RUNNING"
fi
echo ""

# 8. X-UI database info
echo "--- X-UI DATABASE ---"
if [ -f /etc/x-ui/x-ui.db ]; then
    echo "DB exists: $(ls -lh /etc/x-ui/x-ui.db)"
    sqlite3 /etc/x-ui/x-ui.db "SELECT id, up, down, total, remark, enable, protocol FROM inbounds;" 2>/dev/null || echo "Cannot read DB"
    echo ""
    echo "Settings:"
    sqlite3 /etc/x-ui/x-ui.db "SELECT key, value FROM settings WHERE key IN ('webPort','webBasePath','webCertFile','webKeyFile','subEnable','subPort','subPath','subURI','subCertFile','subKeyFile');" 2>/dev/null || echo "Cannot read settings"
else
    echo "No x-ui database found"
fi
echo ""

# 9. Certificates
echo "--- SSL CERTIFICATES ---"
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "No letsencrypt certs"
echo ""

# 10. Firewall
echo "--- FIREWALL ---"
if command -v ufw &>/dev/null; then
    ufw status 2>/dev/null || echo "UFW error"
else
    echo "No UFW"
fi
echo ""
iptables -L INPUT -n --line-numbers 2>/dev/null | head -20 || echo "Cannot read iptables"
echo ""

# 11. BBR
echo "--- TCP BBR ---"
sysctl net.ipv4.tcp_congestion_control 2>/dev/null
sysctl net.core.default_qdisc 2>/dev/null
echo ""

# 12. DNS for marbomebel.ru
echo "--- DNS CHECK ---"
dig +short marbomebel.ru A 2>/dev/null || nslookup marbomebel.ru 2>/dev/null | grep -A1 "Name:" || echo "Cannot resolve"
dig +short n8n.marbomebel.ru A 2>/dev/null || echo "Cannot resolve n8n subdomain"
echo ""

echo "=== AUDIT COMPLETE ==="
