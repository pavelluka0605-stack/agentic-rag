#!/bin/bash
# VPS Full Audit Script — 2026-03-22
# Runs all checks and outputs structured data
export PATH=/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/sbin:/usr/local/bin:$PATH
set +e

echo "@@SECTION:SYSTEM@@"
echo "=== OS ===" && cat /etc/os-release | grep PRETTY
echo "=== KERNEL ===" && uname -r
echo "=== HOSTNAME ===" && hostname
echo "=== UPTIME ===" && uptime
echo "=== RAM ===" && free -h
echo "=== DISK ===" && df -h / && df -h /home 2>/dev/null
echo "=== CPU ===" && nproc && lscpu | grep "Model name"
echo "=== SWAP ===" && swapon --show 2>/dev/null || echo "нет swap"
echo "=== LOAD ===" && cat /proc/loadavg

echo "@@SECTION:SECURITY@@"
echo "=== USERS ===" && cat /etc/passwd | grep -v nologin | grep -v false | grep -v sync
echo "=== SSH KEYS ===" && ls -la ~/.ssh/
echo "=== SSH CONFIG ===" && grep -E "PermitRootLogin|PasswordAuthentication|Port " /etc/ssh/sshd_config | grep -v "^#"
echo "=== UFW ===" && ufw status verbose
echo "=== FAIL2BAN ===" && fail2ban-client status 2>/dev/null && fail2ban-client status sshd 2>/dev/null
echo "=== LAST LOGINS ===" && last -20
echo "=== CRON ROOT ===" && crontab -l 2>/dev/null || echo "нет cron"
echo "=== CRON.D ===" && ls /etc/cron.d/ 2>/dev/null
echo "=== SYSTEMD TIMERS ===" && systemctl list-timers --all --no-pager 2>/dev/null | head -20

echo "@@SECTION:DOCKER@@"
echo "=== DOCKER VERSION ===" && docker --version && docker compose version
echo "=== RUNNING ===" && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
echo "=== ALL ===" && docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo "=== IMAGES ===" && docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo "=== VOLUMES ===" && docker volume ls
echo "=== NETWORKS ===" && docker network ls
echo "=== DISK USAGE ===" && docker system df
echo "=== STATS ===" && docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo "@@SECTION:COMPOSE@@"
echo "=== COMPOSE FILES ==="
find / -maxdepth 5 \( -name "docker-compose*.yml" -o -name "compose*.yml" \) 2>/dev/null | grep -v "/proc\|/sys" | sort | while read f; do
    echo "@@FILE:$f@@"
    cat "$f" 2>/dev/null
    echo "@@ENDFILE@@"
done

echo "@@SECTION:TRAEFIK@@"
echo "=== TRAEFIK CONFIGS ==="
find / -maxdepth 5 \( -name "traefik.yml" -o -name "traefik.toml" -o -name "traefik.yaml" \) 2>/dev/null | grep -v proc | while read f; do
    echo "@@FILE:$f@@"
    cat "$f"
    echo "@@ENDFILE@@"
done
echo "=== TRAEFIK DYNAMIC ==="
find / -maxdepth 5 -path "*/traefik/*" \( -name "*.yml" -o -name "*.toml" -o -name "*.yaml" \) 2>/dev/null | grep -v proc | while read f; do
    echo "@@FILE:$f@@"
    cat "$f"
    echo "@@ENDFILE@@"
done
echo "=== TRAEFIK LABELS ==="
docker ps --format '{{.Names}}' | while read c; do
    LABELS=$(docker inspect "$c" --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{println}}{{end}}' 2>/dev/null | grep traefik)
    [ -n "$LABELS" ] && echo "--- $c ---" && echo "$LABELS"
done
echo "=== ACME/SSL ==="
find / -maxdepth 5 -name "acme.json" 2>/dev/null | grep -v proc | while read f; do
    echo "acme file: $f ($(stat -c%s "$f" 2>/dev/null) bytes)"
    python3 -c "
import json
try:
    d=json.load(open('$f'))
    for resolver, data in d.items():
        if isinstance(data, dict):
            for c in data.get('Certificates', []):
                print(f'  cert: {c.get(\"domain\",{}).get(\"main\",\"?\")} sans={c.get(\"domain\",{}).get(\"sans\",[])}')
except Exception as e:
    print(f'  parse error: {e}')
" 2>/dev/null
done

echo "@@SECTION:SERVICES@@"
echo "=== SYSTEMD RUNNING ===" && systemctl list-units --type=service --state=running --no-pager | head -40
echo "=== SYSTEMD FAILED ===" && systemctl list-units --type=service --state=failed --no-pager
echo "=== LISTENING PORTS ===" && ss -tlnp | grep LISTEN
echo "=== TOP PROCESSES BY RAM ===" && ps aux --sort=-%mem | head -20
echo "=== NODE PROCS ===" && ps aux | grep node | grep -v grep
echo "=== PYTHON PROCS ===" && ps aux | grep python | grep -v grep

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
[ -n "$PG_ID" ] && docker exec "$PG_ID" psql -U postgres -c "\l" 2>/dev/null
echo "=== MySQL ===" && docker ps -a | grep -iE "mysql|mariadb"
echo "=== Redis ===" && docker ps -a | grep -i redis
echo "=== Supabase ===" && docker ps -a | grep -i supabase

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

echo "@@SECTION:CLAUDE@@"
echo "=== CLAUDE VERSION ===" && claude --version 2>/dev/null || echo "not installed"
echo "=== CLAUDE GLOBAL JSON ===" && cat ~/.claude.json 2>/dev/null | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    # mask sensitive values
    for k,v in d.items():
        if k == 'mcpServers':
            for name, cfg in v.items():
                cmd = cfg.get('command', cfg.get('url', '?'))
                args = ' '.join(cfg.get('args', []))
                env_keys = list(cfg.get('env', {}).keys())
                print(f'MCP: {name} -> {cmd} {args}')
                if env_keys: print(f'  env: {env_keys}')
        elif isinstance(v, str) and len(v) > 50:
            print(f'{k}: [long string {len(v)} chars]')
        else:
            print(f'{k}: {v}')
except: print('parse error')
" 2>/dev/null || echo "no ~/.claude.json"
echo "=== CLAUDE GLOBAL DIR ===" && find ~/.claude -type f 2>/dev/null | sort
echo "=== CLAUDE SETTINGS ===" && cat ~/.claude/settings.json 2>/dev/null || echo "нет"
echo "=== CLAUDE AGENTS ===" && ls -la ~/.claude/agents/ 2>/dev/null || echo "нет"
for f in ~/.claude/agents/*.md 2>/dev/null; do [ -f "$f" ] && echo "@@FILE:$f@@" && cat "$f" && echo "@@ENDFILE@@"; done
echo "=== CLAUDE SKILLS ===" && ls -la ~/.claude/skills/ 2>/dev/null || echo "нет"
echo "=== CLAUDE COMMANDS ===" && ls -la ~/.claude/commands/ 2>/dev/null || echo "нет"

echo "=== PROJECT CLAUDE.md ==="
find /root /home /opt -maxdepth 4 -name "CLAUDE.md" -type f 2>/dev/null | while read f; do
    echo "CLAUDEMD|$f|$(wc -l < "$f")"
done

echo "=== PROJECT .mcp.json ==="
find /root /home /opt -maxdepth 4 -name ".mcp.json" -type f 2>/dev/null | while read f; do
    echo "@@FILE:$f@@"
    cat "$f"
    echo "@@ENDFILE@@"
done

echo "=== PROJECT .claudeignore ==="
find /root /home /opt -maxdepth 4 -name ".claudeignore" -type f 2>/dev/null | while read f; do
    echo "@@FILE:$f@@"
    cat "$f"
    echo "@@ENDFILE@@"
done

echo "=== PROJECT .claude DIRS ==="
find /root /home /opt -maxdepth 4 -name ".claude" -type d 2>/dev/null | while read d; do
    echo "DIR: $d"
    find "$d" -type f 2>/dev/null | sort
done

echo "@@SECTION:ENVFILES@@"
echo "=== .env FILES ==="
find /root /home /opt -maxdepth 4 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | while read f; do
    echo "ENVFILE|$f"
    cat "$f" 2>/dev/null | grep -v "^#" | grep -v "^$" | cut -d= -f1
    echo "---"
done

echo "@@SECTION:DOMAINS@@"
echo "=== TRAEFIK DOMAINS ==="
docker ps --format '{{.Names}}' | while read c; do
    HOSTS=$(docker inspect "$c" --format '{{range $k,$v := .Config.Labels}}{{if or (eq $k "traefik.http.routers.'$c'.rule") (eq $k "traefik.http.routers.'$c'-secure.rule")}}{{$v}}{{end}}{{end}}' 2>/dev/null)
    [ -n "$HOSTS" ] && echo "  $c -> $HOSTS"
done
echo "=== NGINX CONFIGS ==="
find /etc/nginx /root /home -name "*.conf" -maxdepth 4 2>/dev/null | xargs grep -l "server_name" 2>/dev/null | while read f; do
    echo "  nginx: $f -> $(grep server_name "$f" | head -3)"
done
echo "=== DNS ==="
for d in marbomebel.ru n8n.marbomebel.ru chat.marbomebel.ru webhook.marbomebel.ru mebelit.site; do
    IP=$(dig +short "$d" A 2>/dev/null || host "$d" 2>/dev/null | grep "has address" | head -1 || echo "?")
    echo "DNS|$d|$IP"
done

echo "@@SECTION:XRAY@@"
echo "=== XRAY/VPN ==="
docker ps -a 2>/dev/null | grep -iE "x-ui|xray|3x-ui" || echo "no xray docker"
systemctl status x-ui 2>/dev/null | head -10 || echo "no x-ui service"
ss -tlnp | grep 2053 || echo "port 2053 not listening"
find / -maxdepth 4 \( -path "*x-ui*" -name "*.db" -o -path "*xray*" -name "config.json" \) 2>/dev/null | grep -v proc | head -5

echo "@@SECTION:STRUCTURE@@"
echo "=== HOME ===" && ls -la ~/
echo "=== /opt ===" && ls -la /opt/ 2>/dev/null
echo "=== PROJECTS ==="
for d in ~/*/; do
    [ -d "$d" ] || continue
    echo "PROJECT|$d"
    ls -1 "$d" | head -15
    echo "---"
done

echo "@@SECTION:IPTABLES@@"
echo "=== IPTABLES DOCKER-USER ===" && iptables -L DOCKER-USER -n --line-numbers 2>/dev/null || echo "no DOCKER-USER chain"
echo "=== IPTABLES NAT ===" && iptables -t nat -L -n 2>/dev/null | head -30

echo "@@DONE@@"
