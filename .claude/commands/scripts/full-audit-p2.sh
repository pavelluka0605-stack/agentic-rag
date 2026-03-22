#!/bin/bash
export PATH=/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/sbin:/usr/local/bin:$PATH
set +e

echo "@@SECTION:N8N@@"
N8N_ID=$(docker ps --filter "name=n8n" --format "{{.ID}}" | head -1)
echo "=== N8N STATUS ===" && docker ps --filter "name=n8n" --format "{{.Names}}: {{.Status}} {{.Ports}}"
if [ -n "$N8N_ID" ]; then
    echo "=== N8N VERSION ===" && docker exec "$N8N_ID" n8n --version 2>/dev/null
    echo "=== N8N ENV KEYS ===" && docker inspect "$N8N_ID" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | cut -d= -f1
fi

echo "@@SECTION:DATABASES@@"
echo "=== PostgreSQL ===" && docker ps -a --filter "name=postgres" --format "{{.Names}}: {{.Status}} {{.Ports}}"
PG_ID=$(docker ps --filter "name=postgres" --format "{{.ID}}" | head -1)
if [ -n "$PG_ID" ]; then
    docker exec "$PG_ID" psql -U n8n -c "\l" 2>/dev/null || echo "psql failed"
fi
echo "=== MySQL ===" && docker ps -a | grep -iE "mysql|mariadb"
echo "=== Redis ===" && docker ps -a | grep -i redis || echo "нет redis"

echo "@@SECTION:GIT@@"
echo "=== GIT REPOS ==="
find /root /home /opt /var -maxdepth 4 -name ".git" -type d 2>/dev/null | while read g; do
    DIR=$(dirname "$g")
    BRANCH=$(cd "$DIR" && git branch --show-current 2>/dev/null || echo "?")
    REMOTE=$(cd "$DIR" && git remote get-url origin 2>/dev/null || echo "no remote")
    LAST=$(cd "$DIR" && git log --oneline -1 2>/dev/null || echo "?")
    DIRTY=$(cd "$DIR" && git status --porcelain 2>/dev/null | wc -l)
    echo "REPO|$DIR|$BRANCH|$REMOTE|$LAST|$DIRTY"
done

echo "@@SECTION:ENVFILES@@"
echo "=== .env FILES ==="
find /root /home /opt -maxdepth 4 -name ".env" -o -name ".env.*" 2>/dev/null | while read f; do
    echo "ENVFILE|$f"
    cat "$f" 2>/dev/null | grep -v "^#" | grep -v "^$" | cut -d= -f1
    echo "---"
done

echo "@@SECTION:DOMAINS@@"
echo "=== NGINX ==="
find /etc/nginx /root /home -name "*.conf" -maxdepth 4 2>/dev/null | xargs grep -l "server_name" 2>/dev/null | while read f; do
    echo "nginx: $f"
    grep server_name "$f" | head -3
done
echo "=== DNS ==="
for d in marbomebel.ru n8n.marbomebel.ru chat.marbomebel.ru webhook.marbomebel.ru claw.marbomebel.ru mebelit.site; do
    IP=$(dig +short "$d" A 2>/dev/null | head -1)
    echo "DNS|$d|$IP"
done

echo "@@SECTION:XRAY@@"
systemctl status x-ui 2>/dev/null | head -10
ss -tlnp | grep -E "2053|8443|2096"

echo "@@SECTION:STRUCTURE@@"
echo "=== HOME ===" && ls -la ~/
echo "=== /opt ===" && ls -la /opt/
echo "=== PROJECTS ==="
for d in /opt/*/; do
    [ -d "$d" ] || continue
    echo "PROJECT|$d"
    ls -1 "$d" 2>/dev/null | head -10
    echo "---"
done

echo "@@SECTION:IPTABLES@@"
echo "=== DOCKER-USER ===" && iptables -L DOCKER-USER -n --line-numbers 2>/dev/null || echo "no DOCKER-USER"

echo "@@SECTION:MEBELIT@@"
echo "=== WORDPRESS COMPOSE ==="
cat /opt/mebelit-wp/docker-compose.yml 2>/dev/null || find /opt /root -maxdepth 3 -path "*mebelit*" -name "docker-compose*" -exec cat {} \; 2>/dev/null
echo "=== WP SITE ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080 2>/dev/null
echo ""

echo "@@SECTION:CLAUDE_MCP@@"
echo "=== MCP MEMORY ==="
ls -la /opt/mcp-memory/ 2>/dev/null
ls -la /opt/mcp-memory/data/ 2>/dev/null
echo "=== MCP MEMORY DB SIZE ===" && du -h /opt/mcp-memory/data/memory.db 2>/dev/null

echo "@@SECTION:DISK_DETAIL@@"
echo "=== LARGE DIRS ===" && du -h --max-depth=2 /opt/ 2>/dev/null | sort -rh | head -20
echo "=== LARGE DIRS HOME ===" && du -h --max-depth=2 /root/ 2>/dev/null | sort -rh | head -20

echo "@@DONE@@"
