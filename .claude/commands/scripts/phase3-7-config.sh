#!/bin/bash
# Phase 3-7: Create CLAUDE.md, .claudeignore, agents, skills, commands
export PATH=/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/sbin:/usr/local/bin:$PATH
set +e

echo "========================================"
echo "PHASE 3: CLAUDE.md"
echo "========================================"

mkdir -p ~/.claude/agents ~/.claude/skills ~/.claude/commands

cat > ~/.claude/CLAUDE.md << 'CLAUDEEOF'
# CLAUDE.md — VPS fra-1-vm-ckr7

## Философия
- Делай, а не спрашивай
- Максимум 3 попытки отладки. Не вышло — диагностика и стоп
- Логи первым делом: docker compose logs --tail=50 <service>
- Git: feature-ветки, коммиты на русском, НЕ push --force

## Стек
- VPS: Ubuntu 24.04, 2 CPU, 3.8 GB RAM, 48 GB disk
- Docker + Traefik (reverse proxy, auto SSL Let's Encrypt)
- N8N: n8n.marbomebel.ru (Docker: /opt/n8n/)
- PostgreSQL 16 (pgvector) — внутри Docker, internal port 5432
- WordPress + MySQL: mebelit-wp (порты заблокированы iptables)
- OpenClaw: claw.marbomebel.ru (/opt/openclaw/)
- Xray/VLESS: порт 2053 (x-ui), 8443 (proxy)

## Приложения
- webapp (FastAPI): chat.marbomebel.ru, /opt/webapp/, systemd
- control-bridge (uvicorn): 127.0.0.1:3000, /opt/control-bridge/
- control-api (Node.js): 127.0.0.1:3901, /opt/claude-code/
- dashboard (Next.js): 127.0.0.1:3200, /opt/claude-code/dashboard/
- vk-longpoll: 127.0.0.1:3100, /opt/vk-longpoll/
- vk-user-longpoll: 127.0.0.1:3101, /opt/vk-user-longpoll/
- vk-callback: 127.0.0.1:3102, /opt/vk-callback/
- MCP Memory: /opt/mcp-memory/ (SQLite: /opt/mcp-memory/data/memory.db)

## Docker-compose проекты
| Путь | Сервисы |
|------|---------|
| /opt/n8n-traefik/ | traefik (80/443) |
| /opt/n8n/ | n8n, postgres, voice-app |
| /opt/openclaw/ | openclaw |

## Домены
- n8n.marbomebel.ru → Traefik → n8n (Docker)
- chat.marbomebel.ru → systemd webapp (FastAPI :8000)
- claw.marbomebel.ru → Traefik → openclaw

## N8N правила
- $env для переменных, НЕ process.env
- HTTP Request: timeout 30s обязательно
- Error Trigger на каждый production workflow
- Bitrix24: rate limit 2 req/sec
- CDEK: токен TTL 3600s — кешируй
- T-Bank webhook: подпись SHA-256
- Workflow JSON: /opt/n8n-workflows/ (P0-01..P0-08)

## Безопасность
- UFW active: только 22, 80, 443, 2053
- Docker порты: MySQL/WP заблокированы iptables DOCKER-USER
- SSH: только ключи, fail2ban (ban 24h)
- НЕ открывай порты на 0.0.0.0 — только 127.0.0.1
- Секреты в .env файлах, НИКОГДА в docker-compose.yml
- НЕ коммить .env файлы в git

## Команды
```
docker compose -f /opt/n8n/docker-compose.yml logs -f --tail=50 n8n
docker compose -f /opt/n8n/docker-compose.yml restart n8n
docker compose -f /opt/n8n-traefik/compose.yaml restart
systemctl restart <webapp|control-bridge|vk-longpoll|dashboard>
ss -tlnp | grep LISTEN
```

## Debug
1. docker compose logs --tail=100 | grep -iE "error|warn|fatal"
2. journalctl -u <service> --since "1 hour ago" --no-pager
3. ss -tlnp | grep <port>
4. curl -s http://127.0.0.1:<port>/health
CLAUDEEOF
echo "Created ~/.claude/CLAUDE.md ($(wc -l < ~/.claude/CLAUDE.md) lines)"

echo ""
echo "========================================"
echo "PHASE 4: .claudeignore"
echo "========================================"

cat > ~/.claudeignore << 'EOF'
node_modules/
.git/
dist/
build/
*.lock
.next/
coverage/
__pycache__/
*.pyc
venv/
.env
.env.*
*.db
*.sqlite
*.log
EOF
echo "Created ~/.claudeignore"

# Also in key project dirs
for d in /opt/claude-chat /opt/webapp /opt/claude-code; do
    if [ -d "$d" ]; then
        cp ~/.claudeignore "$d/.claudeignore"
        echo "Copied to $d/.claudeignore"
    fi
done

echo ""
echo "========================================"
echo "PHASE 5: AGENTS"
echo "========================================"

cat > ~/.claude/agents/deployer.md << 'EOF'
---
name: deployer
description: Деплой Docker-сервисов и systemd-приложений на VPS. Используй для любых задач деплоя.
tools:
  - Bash
  - Read
  - Write
---

Ты DevOps-инженер на VPS fra-1-vm-ckr7.

Docker-проекты: /opt/n8n/, /opt/n8n-traefik/, /opt/openclaw/
Systemd-сервисы: webapp, control-bridge, dashboard, vk-longpoll, vk-user-longpoll, vk-callback

Алгоритм для Docker:
1. cd в директорию проекта
2. docker compose config — валидация
3. docker compose build --no-cache <service> (если нужен rebuild)
4. docker compose up -d <service>
5. sleep 10 && docker compose ps
6. docker compose logs --tail=20 <service> — проверь ошибки
7. Если упало — docker compose logs --tail=50, найди причину, исправь (макс 3 попытки)

Алгоритм для systemd:
1. cat /etc/systemd/system/<service>.service — пойми что запускается
2. systemctl restart <service>
3. sleep 5 && systemctl status <service>
4. journalctl -u <service> --since "5 min ago" --no-pager | tail -30

НИКОГДА: docker compose down для ВСЕГО стека. Только для конкретного сервиса.
НИКОГДА: открывай порты на 0.0.0.0. Только 127.0.0.1.
EOF
echo "Created deployer.md"

cat > ~/.claude/agents/code-reviewer.md << 'EOF'
---
name: code-reviewer
description: Ревью кода на баги, безопасность, стиль. Используй перед коммитами и мержами.
tools:
  - Bash
  - Read
  - Glob
  - Grep
---

Ты senior code reviewer.

Проверяй:
1. Безопасность: токены/пароли в коде, SQL injection, XSS, порты на 0.0.0.0
2. Баги и edge cases
3. Код-стайл: ES modules, async/await, error handling
4. Docker: порты только 127.0.0.1, health checks, no :latest в production
5. .env: секреты НЕ в docker-compose, НЕ в git

Формат: таблица [Severity | File:Line | Issue | Fix]
Critical — безопасность, потеря данных
Warning — баги, плохие практики
Info — стиль, оптимизации
EOF
echo "Created code-reviewer.md"

cat > ~/.claude/agents/researcher.md << 'EOF'
---
name: researcher
description: Исследование проекта, логов, конфигов. Только чтение, никаких изменений.
tools:
  - Bash
  - Read
  - Glob
  - Grep
---

Ты исследователь. ТОЛЬКО читаешь, НЕ создаёшь и НЕ редактируешь файлы.

Умеешь:
- Искать файлы: find, glob, grep
- Читать логи: docker compose logs, journalctl
- Анализировать конфиги: docker-compose.yml, .env, systemd units
- Проверять порты: ss -tlnp
- Смотреть git: log, diff, status

Отчёт: что нашёл, где лежит, какие зависимости, что странного.
EOF
echo "Created researcher.md"

echo ""
echo "========================================"
echo "PHASE 6: SKILLS"
echo "========================================"

cat > ~/.claude/skills/n8n-expert.md << 'EOF'
---
name: n8n-expert
description: Работа с n8n воркфлоу. Автоактивируется при n8n, webhook, автоматизация, workflow.
---

## N8N на этом VPS:
- Docker: /opt/n8n/docker-compose.yml
- URL: n8n.marbomebel.ru
- БД: PostgreSQL 16 (pgvector), контейнер n8n-postgres-1
- Workflows: /opt/n8n-workflows/ (P0-01..P0-08)

## Правила:
- $env для переменных, НЕ process.env
- HTTP Request: timeout 30s
- Error Trigger на каждый production workflow
- Bitrix24: 2 req/sec rate limit — ставь Wait node
- CDEK: токен TTL 3600s — кешируй в workflow variables
- T-Bank: проверяй подпись SHA-256
- VK API: Long Poll через /opt/vk-longpoll/ -> N8N webhook
- Логи: docker compose -f /opt/n8n/docker-compose.yml logs -f --tail=50 n8n
- Рестарт: docker compose -f /opt/n8n/docker-compose.yml restart n8n
EOF
echo "Created n8n-expert.md"

cat > ~/.claude/skills/docker-traefik.md << 'EOF'
---
name: docker-traefik
description: Docker, Traefik, SSL, деплой контейнеров. Автоактивируется при docker, traefik, ssl, домен.
---

## Traefik:
- Compose: /opt/n8n-traefik/compose.yaml
- Слушает: 80/443 (единственные порты наружу)
- SSL: Let's Encrypt (certresolver: mytlschallenge)
- acme.json: /opt/n8n-traefik/letsencrypt/acme.json (chmod 600!)

## Маршрутизация через labels:
traefik.http.routers.<svc>.rule=Host(`subdomain.marbomebel.ru`)
traefik.http.routers.<svc>.tls.certresolver=mytlschallenge

## Docker правила:
- Порты ТОЛЬКО 127.0.0.1:<port>:<port> (НИКОГДА 0.0.0.0)
- Или через Traefik (internal port, labels)
- Health check в каждом сервисе
- Не используй :latest в production
- docker system prune для очистки
EOF
echo "Created docker-traefik.md"

cat > ~/.claude/skills/vps-security.md << 'EOF'
---
name: vps-security
description: Безопасность VPS. Автоактивируется при порты, firewall, SSH, безопасность, iptables.
---

## Текущая защита:
- UFW: deny all, allow 22/80/443/2053
- SSH: PermitRootLogin prohibit-password, PasswordAuthentication no
- Fail2ban: SSH jail, ban 24h
- Docker: MySQL/WP заблокированы через iptables DOCKER-USER
- Сервисы: привязаны к 127.0.0.1

## Правила:
- НИКОГДА не открывай порты на 0.0.0.0
- Новые сервисы: только 127.0.0.1 или через Traefik
- Секреты: ТОЛЬКО в .env файлах
- ufw allow <port> — ТОЛЬКО для 80/443 и VPN
- Перед изменениями SSH — ПРОВЕРЬ что ключ есть!
- Docker обходит UFW — контролируй через 127.0.0.1 в compose
EOF
echo "Created vps-security.md"

echo ""
echo "========================================"
echo "PHASE 7: SLASH COMMANDS"
echo "========================================"

cat > ~/.claude/commands/deploy.md << 'EOF'
Полный цикл деплоя. Определи тип (Docker или systemd) и выполни:

Docker:
1. cd в директорию проекта
2. docker compose config
3. git add -A && git commit -m "deploy: <что>"
4. docker compose build --no-cache
5. docker compose up -d
6. sleep 15 && docker compose ps
7. docker compose logs --tail=20 — есть ошибки?
8. Итог: что обновлено, статус

Systemd:
1. systemctl restart <service>
2. sleep 5 && systemctl status <service>
3. journalctl -u <service> --since "2 min ago" | tail -20
4. Итог
EOF
echo "Created deploy.md"

cat > ~/.claude/commands/debug.md << 'EOF'
Режим отладки:
1. docker compose ps (все проекты в /opt/n8n/, /opt/n8n-traefik/, /opt/openclaw/)
2. systemctl status webapp control-bridge dashboard vk-longpoll vk-user-longpoll vk-callback
3. docker compose logs --tail=100 2>&1 | grep -iE "error|warn|exception|fatal"
4. journalctl --since "1 hour ago" --no-pager | grep -iE "error|fail" | tail -30
5. ss -tlnp | grep "0.0.0.0" — есть ли порты торчащие наружу (кроме 22/80/443/2053)?
6. free -h && df -h /
7. Для каждой найденной ошибки: определи root cause, предложи fix
8. Макс 3 попытки на ошибку
EOF
echo "Created debug.md"

cat > ~/.claude/commands/status.md << 'EOF'
Быстрый статус VPS:

1. Ресурсы:
   free -h && df -h / && cat /proc/loadavg

2. Docker:
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

3. Systemd сервисы:
   for s in webapp control-bridge dashboard vk-longpoll vk-user-longpoll vk-callback x-ui; do
     STATUS=$(systemctl is-active $s 2>/dev/null)
     echo "  $s: $STATUS"
   done

4. Ошибки:
   systemctl list-units --state=failed --no-pager
   docker ps --filter "status=exited" --format "{{.Names}}: {{.Status}}"

5. Порты наружу:
   ss -tlnp | grep "0.0.0.0" | grep -v "127.0.0.1"

6. Fail2ban:
   fail2ban-client status sshd 2>/dev/null | grep "Currently banned"

Покажи компактную сводку-таблицу.
EOF
echo "Created status.md"

cat > ~/.claude/commands/cleanup.md << 'EOF'
Очистка VPS:
1. Docker: docker system prune -f && docker volume prune -f
2. npm: npm cache clean --force
3. Логи: journalctl --vacuum-time=7d
4. Claude сессии старше 7 дней: find /root/.claude/projects/ -name "*.jsonl" -mtime +7 -delete
5. Temp файлы: find /tmp -mtime +3 -delete 2>/dev/null
6. Покажи: df -h / (до и после)
EOF
echo "Created cleanup.md"

echo ""
echo "========================================"
echo "PHASE 3-7 DONE"
echo "========================================"
echo "Files created:"
echo "  ~/.claude/CLAUDE.md"
echo "  ~/.claudeignore"
echo "  Agents: $(ls ~/.claude/agents/*.md 2>/dev/null | wc -l)"
echo "  Skills: $(ls ~/.claude/skills/*.md 2>/dev/null | wc -l)"
echo "  Commands: $(ls ~/.claude/commands/*.md 2>/dev/null | wc -l)"
