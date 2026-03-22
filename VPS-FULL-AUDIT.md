# VPS Full Audit — 2026-03-22

**Хост:** fra-1-vm-ckr7 (Frankfurt)
**IP:** 72.56.127.126
**Аудит выполнен:** автоматически через remote exec

---

## 1. Система

| Параметр | Значение |
|----------|----------|
| OS | Ubuntu 24.04.4 LTS |
| Kernel | 6.8.0-101-generic |
| CPU | 2x QEMU Virtual CPU @ 2.0GHz |
| RAM | 3.8 GB total, 1.6 GB used, 2.2 GB available |
| Swap | 2.0 GB, **1.3 GB used (65%)** |
| Disk | 48 GB, 25 GB used (53%) |
| Uptime | 19 дней |
| Load | 0.37 0.21 0.15 |

**Проблемы:**
- Swap 65% — высокое давление на память, система активно свопит

---

## 2. Безопасность

### SSH
- PermitRootLogin: **prohibit-password** (только ключ)
- PasswordAuthentication: **no**
- Один пользователь: root
- SSH ключи: `authorized_keys`, `github_deploy` (пара)

### UFW (firewall)
- Статус: **ACTIVE**
- Default: deny incoming, allow outgoing, deny routed
- Правила:

| Порт | Действие | Комментарий |
|------|----------|-------------|
| 22/tcp | ALLOW | SSH |
| 80/tcp | ALLOW | HTTP Traefik |
| 443/tcp | ALLOW | HTTPS Traefik |
| 2053/tcp | ALLOW | X-UI панель |

### Fail2ban
- Статус: **активен**
- Jail: sshd
- Забанено: **33 IP** (всего 41 бан, 150 неудачных попыток)

### iptables DOCKER-USER
Дополнительная защита Docker-портов:

| Порт | Правило |
|------|---------|
| 3306 (MySQL) | DROP извне, ALLOW localhost + Docker |
| 8080 (WordPress) | DROP извне, ALLOW localhost + Docker |
| 3102 (VK callback) | DROP извне, ALLOW localhost |

### Проблемы безопасности
- Порты **2096, 8443** (X-UI/Xray) открыты на `*` но **НЕ в UFW** — полагаются на x-ui auth
- Порт **10050** (Zabbix agent) на `0.0.0.0` — нужен ли Zabbix?
- Порт **3200** (Dashboard Next.js) на `*` — не защищён UFW
- Порт **5678** (N8N внутренний) на `*` — виден снаружи?
- **AMOCRM_TOKEN** захардкожен открытым текстом в `/opt/n8n/docker-compose.yml` (JWT токен ~500 символов)

---

## 3. Docker

### Версии
- Docker: 28.2.2
- Docker Compose: 2.37.1

### Контейнеры

| Контейнер | Образ | Статус | Порты | RAM |
|-----------|-------|--------|-------|-----|
| n8n-n8n-1 | n8nio/n8n:latest | Up 12 дней | 5678/tcp | 325.7 MB |
| n8n-postgres-1 | pgvector/pgvector:pg16 | Up 13 дней | 5432/tcp (internal) | 39.5 MB |
| n8n-traefik-traefik-1 | traefik | Up 8 дней | 0.0.0.0:80,443 | 24.5 MB |
| n8n-voice-app-1 | nginx:alpine | Up 13 дней | 80/tcp (internal) | 672 KB |
| mebelit-wp-wordpress-1 | wordpress:6.7-php8.2 | Up 7 дней | 0.0.0.0:8080 (blocked) | 60.5 MB |
| mebelit-wp-db-1 | mysql:8.0 | Up 7 дней | 0.0.0.0:3306 (blocked) | 92.4 MB |
| openclaw | alpine/openclaw:latest | Up 2 нед (healthy) | — | 37.6 MB |
| **n8n-traefik-n8n-1** | 9f9e493a5f9e | **Created** (не запущен) | — | — |
| **n8n** | n8nio/n8n | **Created** (не запущен) | — | — |

### Docker ресурсы
- Images: 6.8 GB (9 шт, reclaimable: 467 MB)
- Containers: 74 MB
- Volumes: 448 MB (7 шт)

### Проблемы Docker
- **2 orphan контейнера**: `n8n-traefik-n8n-1` и `n8n` — Created, не запущены, занимают место
- WordPress/MySQL порты на 0.0.0.0 (защищены iptables, но лучше привязать к 127.0.0.1)

---

## 4. Docker Compose проекты

### /opt/n8n-traefik/compose.yaml
- Traefik reverse proxy
- Основной ingress (80/443)
- Let's Encrypt TLS (certresolver: mytlschallenge)
- **acme.json = 0 bytes** — сертификаты могут не сохраняться при рестарте!

### /opt/n8n/docker-compose.yml
- N8N + PostgreSQL (pgvector) + Voice App (nginx)
- Сервисы: n8n, postgres, voice-app
- Env: POSTGRES_PASSWORD, N8N_ENCRYPTION_KEY, N8N_BASIC_AUTH_* (из .env)
- **КРИТИЧНО: AMOCRM_TOKEN в открытом виде прямо в файле!**
- Домен: n8n.marbomebel.ru (Traefik labels)
- Voice app: n8n.marbomebel.ru/voice

### /opt/openclaw/docker-compose.yml
- OpenClaw → claw.marbomebel.ru
- Порт: 18789 (internal, через Traefik)

### /opt/clawtest/docker-compose.yml
- traefik/whoami — тестовый контейнер
- Тот же домен claw.marbomebel.ru (конфликт с openclaw?)
- **Не запущен** — можно удалить

---

## 5. Systemd сервисы

### Работающие (30 шт)

| Сервис | Описание |
|--------|----------|
| control-api.service | Claude Code Control API |
| control-bridge.service | GPT Actions bridge (uvicorn :3000) |
| dashboard.service | Claude Code Task Dashboard (Next.js :3200) |
| n8n.service | N8N Workflow Automation |
| vk-callback.service | VK Callback API Receiver (:3102) |
| vk-longpoll.service | VK Long Poll Listener (:3100) |
| vk-user-longpoll.service | VK User Long Poll (:3101) |
| webapp.service | FastAPI Webapp chat.marbomebel.ru (:8000) |
| x-ui.service | X-UI VPN Panel (:2053) |
| zabbix-agent.service | Zabbix Agent (:10050) |
| fail2ban.service | Fail2Ban |
| docker.service | Docker |
| ssh.service | SSH |

### Сломанные

| Сервис | Статус | Проблема |
|--------|--------|----------|
| claude-chat.service | **not-found** | Unit file удалён, но сервис остался в памяти |
| claude-code-health.service | **failed** | Проверка здоровья падает |

### Проблема: ДВА экземпляра N8N!
1. **Docker**: n8n-n8n-1 (PID 332320, 272 MB, up 12 дней)
2. **Systemd**: n8n.service (PID 2220714, 238 MB, запущен сегодня)
- Оба потребляют ~500 MB RAM суммарно — причина высокого swap!

---

## 6. Порты (все слушающие)

### Внешние (0.0.0.0 / *)

| Порт | Процесс | Примечание |
|------|---------|------------|
| 22 | sshd | OK — в UFW |
| 80 | docker-proxy (Traefik) | OK — в UFW |
| 443 | docker-proxy (Traefik) | OK — в UFW |
| 2053 | x-ui | OK — в UFW |
| 2096 | x-ui | **НЕ в UFW!** |
| 3200 | next-server (dashboard) | **НЕ в UFW!** |
| 3306 | docker-proxy (MySQL) | Blocked iptables |
| 5678 | node (n8n systemd) | **НЕ в UFW!** |
| 8080 | docker-proxy (WordPress) | Blocked iptables |
| 8443 | xray | **НЕ в UFW!** |
| 10050 | zabbix_agentd | **НЕ в UFW!** |

### Внутренние (127.0.0.1) — ОК

| Порт | Процесс |
|------|---------|
| 3000 | control-bridge (uvicorn) |
| 3100 | vk-longpoll (node) |
| 3101 | vk-user-longpoll (node) |
| 3102 | vk-callback (node) |
| 3901 | control-api (node) |
| 5679 | n8n (node internal) |
| 8000 | webapp (uvicorn) |
| 11111 | xray (fallback) |
| 62789 | xray (internal) |

---

## 7. Базы данных

| БД | Тип | Контейнер | Размер | Назначение |
|----|-----|-----------|--------|------------|
| n8n | PostgreSQL 16 (pgvector) | n8n-postgres-1 | — | N8N workflows |
| MySQL 8.0 | MySQL | mebelit-wp-db-1 | — | WordPress mebelit |
| memory.db | SQLite | host /opt/mcp-memory/data/ | 68 KB | MCP Memory |
| rag_memory.db | SQLite | host /opt/ | 32 KB | RAG memory |
| bridge_jobs.db | SQLite | host /opt/control-bridge/ | — | Control Bridge |

---

## 8. Домены и DNS

| Домен | IP | Этот VPS? | SSL | Назначение |
|-------|------|-----------|-----|------------|
| marbomebel.ru | 185.215.4.49 | Нет | — | Основной сайт (другой сервер) |
| n8n.marbomebel.ru | 72.56.127.126 | Да | Traefik LE | N8N |
| chat.marbomebel.ru | 72.56.127.126 | Да | ? | FastAPI webapp |
| claw.marbomebel.ru | 72.56.127.126 | Да | Traefik LE | OpenClaw |
| webhook.marbomebel.ru | **НЕТ DNS** | — | — | Не настроен! |
| mebelit.site | 176.57.64.253 | Нет | — | Другой сервер |

**Проблема:** acme.json = 0 bytes. SSL сертификаты могут не персиститься!

---

## 9. Проекты на VPS (/opt/)

| Путь | Описание | Размер |
|------|----------|--------|
| /opt/webapp/ | FastAPI app (chat.marbomebel.ru) | **7.3 GB** (venv!) |
| /opt/claude-code/ | Claude Code runtime (bin, dashboard, memory) | 672 MB |
| /opt/control-bridge/ | GPT Actions bridge (Python/uvicorn) | 52 MB |
| /opt/mcp-memory/ | MCP Memory Server (Node.js) | 40 MB |
| /opt/claude-chat/ | Chat UI (Node.js) | 20 MB |
| /opt/n8n/ | N8N Docker compose | — |
| /opt/n8n-traefik/ | Traefik Docker compose | — |
| /opt/n8n-workflows/ | 9 workflow JSON файлов (P0-01..P0-08) | — |
| /opt/openclaw/ | OpenClaw Docker compose | — |
| /opt/clawtest/ | Тестовый whoami (можно удалить) | — |
| /opt/p0-foundation/ | Python скрипты (agents, RAG, bluesales) | 472 KB |
| /opt/vk-longpoll/ | VK Long Poll listener (Node.js) | — |
| /opt/vk-user-longpoll/ | VK User Long Poll (Node.js) | — |
| /opt/vk-callback/ | VK Callback API (Node.js) | — |
| /opt/credentials/ | google-service-account.json | — |

### /root/ (1.1 GB)
- `.claude/` — 123 MB (115 MB session history)
- `.npm/` — 400 MB (cache)
- `.cache/` — 71 MB
- `n8n-automation/` — project dir
- `claude-remote.log` — 2.7 MB
- Мусорный файл: `udo systemctl status...` (2.9 KB, опечатка в команде)

---

## 10. ENV файлы

| Файл | Переменные |
|------|------------|
| /opt/n8n/.env | N8N_HOST, POSTGRES_PASSWORD, N8N_ENCRYPTION_KEY, N8N_BASIC_AUTH_*, TZ |
| /opt/n8n-traefik/.env | DOMAIN_NAME, SUBDOMAIN, SSL_EMAIL |
| /opt/p0-foundation/.env | VK_TOKEN, VK_GROUP_ID, TG_BOT_TOKEN, GOOGLE_*, BLUESALES_*, OPENAI_API_KEY, N8N_API_KEY |
| /opt/vk-longpoll/.env | VK_TOKEN, VK_GROUP_ID, N8N_WEBHOOK_URL |
| /opt/vk-user-longpoll/.env | VK_USER_TOKEN, N8N_WEBHOOK_URL |
| /opt/vk-callback/.env | VK_CONFIRMATION_TOKEN, VK_SECRET_KEY, N8N_WEBHOOK_URL |
| /opt/control-bridge/.env | BRIDGE_API_TOKEN, CONTROL_API_TOKEN, TG_BOT_TOKEN |
| /opt/claude-chat/.env | BEARER_TOKEN, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN |
| /opt/claude-code/dashboard/.env.local | MEMORY_DB_PATH, CONTROL_API_URL |
| /home/rag/.env | ANTHROPIC_API_KEY, OPENAI_API_KEY, PG_* |
| /root/n8n-automation/.env | N8N_API_URL, N8N_API_KEY |
| /opt/n8n/.env.bak.* | **2 бэкапа** .env (можно удалить) |

---

## 11. X-UI / Xray VPN

- **Статус:** active (running), 21 час uptime
- **Память:** 70 MB (пик 103 MB)
- **Порты:**
  - 2053 — X-UI панель управления
  - 2096 — X-UI подписки
  - 8443 — Xray proxy (VLESS/VMess/etc)
- **Бинарь:** /usr/local/x-ui/x-ui + xray-linux-amd64

---

## 12. Claude Code на VPS

- **Версия:** установлен (точная версия не определена)
- **Settings:** все инструменты разрешены (Bash, Read, Write, Edit, Glob, Grep, Agent)
- **Hooks:** SessionStart (load-rag-context.sh), SessionEnd (save-session-rag.sh)
- **MCP серверы:** memory → /opt/mcp-memory/src/index.js (SQLite: /opt/mcp-memory/data/memory.db)
- **Agents:** нет
- **Skills:** нет
- **Commands:** нет
- **Session history:** ~115 MB в /root/.claude/projects/ (два проекта: claude-chat, n8n-automation)

---

## 13. Cron задачи

| Расписание | Команда | Назначение |
|------------|---------|------------|
| */5 * * * * | watchdog.sh | P0 мониторинг/авторестарт |
| */10 * * * * | cleanup-processes.sh | Очистка зомби-процессов |
| */30 * * * * | backup-memory.sh | Бэкап memory.db |
| 0 3 * * * | mcp-memory backup.js | Бэкап MCP memory |
| 27 13 * * * | acme.sh --cron | Обновление SSL (acme.sh) |

**systemd timers:**
- claude-code-health.timer (каждые 30 мин) — **FAILED**
- certbot.timer (2 раза в день)
- sysstat, apt-daily, logrotate, etc.

---

## 14. Топ процессов по RAM

| PID | %MEM | RSS | Процесс |
|-----|------|-----|---------|
| 332320 | 6.7% | 272 MB | node n8n (Docker) |
| 2220714 | 5.9% | 238 MB | node n8n (systemd) |
| 300 | 3.6% | 145 MB | systemd-journald |
| 752884 | 2.2% | 90 MB | mysqld |
| 1364737 | 2.2% | 89 MB | next-server (dashboard) |
| 2198513 | 2.0% | 81 MB | webapp (uvicorn) |
| 826121 | 1.7% | 71 MB | vk-user-longpoll |
| 2217143 | 1.7% | 70 MB | node server.js |
| 825837 | 1.4% | 57 MB | vk-longpoll |
| 2218764 | 1.3% | 56 MB | control-bridge |
| 2193779 | 1.2% | 52 MB | fail2ban |

---

## 15. РЕКОМЕНДАЦИИ

### КРИТИЧНЫЕ (сделать немедленно)

1. **Убрать AMOCRM_TOKEN** из `/opt/n8n/docker-compose.yml` — перенести в .env файл
2. **Остановить дублирующий N8N** — работают ДВА экземпляра (docker + systemd), ~500 MB RAM впустую. Оставить один (Docker)
3. **Починить acme.json** (0 bytes) — SSL сертификаты могут потеряться при рестарте Traefik

### ВАЖНЫЕ (безопасность)

4. **Закрыть порт 5678** (N8N systemd) — слушает на `*`, доступен извне
5. **Закрыть порт 3200** (Dashboard) — слушает на `*`, доступен извне без авторизации
6. **Закрыть порт 10050** (Zabbix) — если мониторинг не используется, отключить агент
7. **Добавить UFW правила** для 2096, 8443 (или ограничить доступ)
8. **Настроить DNS** для webhook.marbomebel.ru (или убрать из конфигов)

### ОЧИСТКА (освободить место)

9. **Пересоздать /opt/webapp/venv** — 7.3 GB для Python venv это аномально
10. **Удалить orphan контейнеры**: `docker rm n8n-traefik-n8n-1 n8n`
11. **Удалить /opt/clawtest/** — тестовый whoami, не используется
12. **Очистить npm кэш**: `npm cache clean --force` (400 MB)
13. **Удалить .env.bak файлы** в /opt/n8n/
14. **Очистить /opt/__pycache__/** — не должен быть в /opt
15. **Удалить файл** `/root/udo systemctl status...` (опечатка)
16. **Очистить старые Claude сессии** в /root/.claude/projects/ (115 MB)

### ИНФРАСТРУКТУРНЫЕ

17. **Починить claude-code-health.service** — failed
18. **Удалить claude-chat.service** из systemd (unit not-found)
19. **Привязать WordPress/MySQL** к 127.0.0.1 в docker-compose (вместо 0.0.0.0 + iptables)
20. **Увеличить swap или RAM** — 65% swap usage при 3.8 GB RAM
21. **Проверить нужен ли Zabbix agent** — если мониторинг не настроен, отключить

---

## Сводка состояния

| Компонент | Статус | Примечание |
|-----------|--------|------------|
| OS/Kernel | OK | Ubuntu 24.04.4, актуальный |
| SSH | OK | Только ключи, fail2ban |
| UFW | PARTIAL | Активен, но не все порты покрыты |
| Docker | OK | 7 контейнеров работают |
| N8N (Docker) | OK | Up 12 дней |
| N8N (systemd) | DUPLICATE | Лишний экземпляр, жрёт RAM |
| PostgreSQL | OK | pgvector/pg16 |
| MySQL/WordPress | OK | Защищён iptables |
| Traefik | WARNING | acme.json пустой |
| OpenClaw | OK | healthy |
| VK Long Poll | OK | 3 сервиса работают |
| X-UI/Xray | OK | VPN работает |
| Control Bridge | OK | localhost:3000 |
| Webapp | WARNING | venv 7.3 GB |
| Claude Code | PARTIAL | health check failed |
| MCP Memory | OK | 68 KB DB |
| Disk | OK | 53% (23 GB free) |
| RAM/Swap | WARNING | 65% swap used |
