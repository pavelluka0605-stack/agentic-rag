#!/bin/bash
# Phase 8: Validation
export PATH=/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/sbin:/usr/local/bin:$PATH
set +e

echo "=== СТРУКТУРА CLAUDE CODE ==="
echo "CLAUDE.md:"
for f in $(find /root /home /opt -maxdepth 5 -name "CLAUDE.md" 2>/dev/null | grep -v proc); do
    LINES=$(wc -l < "$f")
    echo "  $f ($LINES строк)"
done
echo ""
echo "Agents:"
ls ~/.claude/agents/ 2>/dev/null || echo "  нет"
echo ""
echo "Skills:"
ls ~/.claude/skills/ 2>/dev/null || echo "  нет"
echo ""
echo "Commands:"
ls ~/.claude/commands/ 2>/dev/null || echo "  нет"
echo ""
echo "Settings/Hooks:"
cat ~/.claude/settings.json 2>/dev/null | head -30
echo ""
echo ".claudeignore:"
find /root /home /opt -maxdepth 4 -name ".claudeignore" 2>/dev/null | grep -v proc
echo ""
echo "=== КРИТИЧЕСКИЕ ФИКСЫ ==="
echo -n "N8N дубль: "
systemctl is-active n8n.service 2>/dev/null || echo "УБИТ (OK)"
echo -n "Порт 5678: "
if ss -tlnp | grep 5678 | grep -q "0.0.0.0"; then echo "ОТКРЫТ (BAD)"; else echo "ЗАКРЫТ (OK)"; fi
echo -n "Порт 3200: "
if ss -tlnp | grep 3200 | grep -q "0.0.0.0"; then echo "ОТКРЫТ (BAD)"; else echo "ЗАКРЫТ (OK)"; fi
echo -n "Порт 10050: "
if ss -tlnp | grep 10050 | grep -q "0.0.0.0"; then echo "ОТКРЫТ (BAD)"; else echo "ЗАКРЫТ (OK)"; fi
echo -n "acme.json: "
ACME=$(find /opt/n8n-traefik -name "acme.json" 2>/dev/null | head -1)
if [ -n "$ACME" ]; then
    SIZE=$(stat -c%s "$ACME" 2>/dev/null)
    echo "$ACME ($SIZE bytes)"
else
    echo "NOT FOUND"
fi
echo -n "AMOCRM_TOKEN в compose: "
if grep -q 'AMOCRM_TOKEN.*ey' /opt/n8n/docker-compose.yml 2>/dev/null; then
    echo "ЕЩЁ ЗАХАРДКОЖЕН (BAD)"
else
    echo "ВЫНЕСЕН В .env (OK)"
fi
echo ""
echo "=== DOCKER ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Orphan containers:"
docker ps -a --filter "status=created" --format "{{.Names}}: {{.Status}}" || echo "нет"
echo ""
echo "=== SYSTEMD FAILED ==="
systemctl list-units --state=failed --no-pager
echo ""
echo "=== ПОРТЫ НА 0.0.0.0 ==="
ss -tlnp | grep "0.0.0.0"
echo ""
echo "=== РЕСУРСЫ ==="
free -h
df -h /
echo ""
echo "=== ГОТОВО ==="
