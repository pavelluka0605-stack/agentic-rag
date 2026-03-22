#!/bin/bash
# Phase 1-2: Critical fixes + Cleanup
export PATH=/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/sbin:/usr/local/bin:$PATH
set +e

echo "========================================"
echo "PHASE 1: CRITICAL FIXES"
echo "========================================"

echo "--- 1.1 Kill duplicate N8N (systemd) ---"
systemctl is-active n8n.service 2>/dev/null
systemctl stop n8n.service 2>/dev/null
systemctl disable n8n.service 2>/dev/null
echo "N8N systemd stopped and disabled"
docker ps --filter "name=n8n-n8n-1" --format "{{.Names}}: {{.Status}}"
echo "RAM after killing N8N systemd:"
free -h | grep Mem

echo ""
echo "--- 1.2 AMOCRM_TOKEN: compose → .env ---"
cd /opt/n8n
# Extract token value
AMOCRM_VAL=$(grep 'AMOCRM_TOKEN:' docker-compose.yml | sed 's/.*AMOCRM_TOKEN: *"\{0,1\}//' | sed 's/"\{0,1\} *$//')
if [ -n "$AMOCRM_VAL" ] && echo "$AMOCRM_VAL" | grep -q "^ey"; then
    echo "Token found (starts with ey..., length $(echo -n "$AMOCRM_VAL" | wc -c))"
    # Add to .env if not already there
    if ! grep -q "AMOCRM_TOKEN" /opt/n8n/.env 2>/dev/null; then
        echo "AMOCRM_TOKEN=$AMOCRM_VAL" >> /opt/n8n/.env
        echo "Added to .env"
    else
        echo "Already in .env, updating"
        sed -i "s|^AMOCRM_TOKEN=.*|AMOCRM_TOKEN=$AMOCRM_VAL|" /opt/n8n/.env
    fi
    # Also add AMOCRM_DOMAIN if hardcoded
    if ! grep -q "AMOCRM_DOMAIN" /opt/n8n/.env 2>/dev/null; then
        echo "AMOCRM_DOMAIN=marbomebel" >> /opt/n8n/.env
    fi
    # Replace in docker-compose.yml
    sed -i 's|AMOCRM_TOKEN: "ey[^"]*"|AMOCRM_TOKEN: ${AMOCRM_TOKEN}|' docker-compose.yml
    sed -i "s|AMOCRM_TOKEN: ey.*|AMOCRM_TOKEN: \${AMOCRM_TOKEN}|" docker-compose.yml
    sed -i 's|AMOCRM_DOMAIN: marbomebel|AMOCRM_DOMAIN: ${AMOCRM_DOMAIN}|' docker-compose.yml
    echo "Replaced in docker-compose.yml"
    grep "AMOCRM" docker-compose.yml
    # Restart n8n stack
    docker compose down
    docker compose up -d
    sleep 15
    docker compose ps
else
    echo "Token not found or already replaced"
    grep "AMOCRM" docker-compose.yml
fi

echo ""
echo "--- 1.3 Close exposed ports ---"
# Check if N8N systemd port is gone
echo "Port 5678 check:"
ss -tlnp | grep 5678 || echo "  5678 not listening - OK"

# Dashboard - bind to localhost
echo "Dashboard service:"
if [ -f /etc/systemd/system/dashboard.service ]; then
    cat /etc/systemd/system/dashboard.service | grep ExecStart
    # Check if Next.js - modify to bind localhost
    if grep -q "next" /etc/systemd/system/dashboard.service; then
        # For Next.js, set hostname via env
        if ! grep -q "HOSTNAME=127.0.0.1" /etc/systemd/system/dashboard.service; then
            sed -i '/\[Service\]/a Environment=HOSTNAME=127.0.0.1' /etc/systemd/system/dashboard.service
            systemctl daemon-reload
            systemctl restart dashboard
            echo "Dashboard bound to 127.0.0.1"
        fi
    elif grep -q "node" /etc/systemd/system/dashboard.service; then
        if ! grep -q "HOSTNAME=127.0.0.1" /etc/systemd/system/dashboard.service; then
            sed -i '/\[Service\]/a Environment=HOSTNAME=127.0.0.1' /etc/systemd/system/dashboard.service
            systemctl daemon-reload
            systemctl restart dashboard
            echo "Dashboard bound to 127.0.0.1"
        fi
    fi
fi

# Zabbix agent - stop if not needed
echo "Zabbix agent:"
systemctl stop zabbix-agent 2>/dev/null
systemctl disable zabbix-agent 2>/dev/null
echo "Zabbix agent stopped and disabled"

# Verify
echo "Ports on 0.0.0.0 after fixes:"
ss -tlnp | grep "0.0.0.0" | grep -v "127.0.0.1"

echo ""
echo "--- 1.4 Fix acme.json ---"
cd /opt/n8n-traefik
ACME_FILE="letsencrypt/acme.json"
echo "Current acme.json:"
ls -la "$ACME_FILE" 2>/dev/null || echo "not found at $ACME_FILE"
# Try alternate location
if [ ! -f "$ACME_FILE" ]; then
    ACME_FILE="acme.json"
    ls -la "$ACME_FILE" 2>/dev/null || echo "not found at $ACME_FILE either"
fi
ACME_SIZE=$(stat -c%s "$ACME_FILE" 2>/dev/null || echo "0")
if [ "$ACME_SIZE" = "0" ]; then
    echo "acme.json is empty, recreating..."
    rm -f "$ACME_FILE"
    touch "$ACME_FILE"
    chmod 600 "$ACME_FILE"
    docker compose restart 2>/dev/null || docker compose -f compose.yaml restart 2>/dev/null
    sleep 30
    ls -la "$ACME_FILE"
    ACME_SIZE_AFTER=$(stat -c%s "$ACME_FILE" 2>/dev/null || echo "0")
    echo "After restart: $ACME_SIZE_AFTER bytes"
else
    echo "acme.json OK: $ACME_SIZE bytes"
fi

echo ""
echo "--- 1.5 Fix broken systemd services ---"
systemctl reset-failed claude-chat.service 2>/dev/null
systemctl daemon-reload
echo "claude-chat.service reset-failed done"

echo "claude-code-health status:"
systemctl status claude-code-health.service --no-pager 2>/dev/null | head -15
if [ -f /etc/systemd/system/claude-code-health.service ]; then
    cat /etc/systemd/system/claude-code-health.service
fi

echo ""
echo "========================================"
echo "PHASE 2: CLEANUP"
echo "========================================"

echo "--- Orphan Docker containers ---"
docker rm n8n-traefik-n8n-1 2>/dev/null && echo "removed n8n-traefik-n8n-1" || echo "n8n-traefik-n8n-1 not found"
docker rm n8n 2>/dev/null && echo "removed n8n" || echo "n8n not found"

echo "--- /opt/clawtest/ ---"
rm -rf /opt/clawtest/ && echo "removed /opt/clawtest/" || echo "already gone"

echo "--- npm cache ---"
npm cache clean --force 2>/dev/null
echo "npm cache cleaned"

echo "--- .env backups ---"
rm -f /opt/n8n/.env.bak.* && echo "removed .env backups" || echo "no backups"

echo "--- Junk file ---"
rm -f /root/"udo systemctl status"* 2>/dev/null && echo "removed junk file" || echo "no junk file"

echo "--- __pycache__ ---"
find /opt -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
echo "removed __pycache__"

echo "--- Old Claude sessions (>7 days) ---"
COUNT_BEFORE=$(find /root/.claude/projects/ -name "*.jsonl" -mtime +7 2>/dev/null | wc -l)
find /root/.claude/projects/ -name "*.jsonl" -mtime +7 -delete 2>/dev/null
echo "Deleted $COUNT_BEFORE old session files"

echo "--- webapp venv size ---"
du -sh /opt/webapp/venv/ 2>/dev/null
echo "(NOT deleting webapp venv — needs user confirmation)"

echo "--- Docker prune ---"
docker system prune -f 2>/dev/null

echo "--- Journal vacuum ---"
journalctl --vacuum-time=7d 2>/dev/null

echo ""
echo "=== AFTER CLEANUP ==="
df -h /
free -h
docker system df

echo ""
echo "PHASE 1-2 DONE"
