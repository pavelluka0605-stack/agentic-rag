# VPS Hardening Report — 2026-03-22

**Хост:** fra-1-vm-ckr7 | **IP:** 72.56.127.126 | **OS:** Ubuntu 24.04.4

---

## Выполнено (Phase 1-8)

### Phase 1: Критические фиксы

| # | Задача | Результат |
|---|--------|-----------|
| 1.1 | Убить дублирующий N8N (systemd) | DONE — `systemctl stop/disable n8n.service`, освободил ~238 MB RAM |
| 1.2 | AMOCRM_TOKEN из docker-compose в .env | DONE — токен (1102 символа) перенесён в `/opt/n8n/.env`, N8N перезапущен |
| 1.3 | Закрыть порт 5678 (N8N) | DONE — не слушает |
| 1.3 | Закрыть порт 3200 (Dashboard) | DONE — привязан к 127.0.0.1 через `Environment=HOSTNAME=127.0.0.1` |
| 1.3 | Закрыть порт 10050 (Zabbix) | DONE — `systemctl stop/disable zabbix-agent` |
| 1.4 | Починить acme.json | ЧАСТИЧНО — пересоздан с chmod 600, Traefik перезапущен, но файл всё ещё 0 bytes |
| 1.5 | claude-chat.service | DONE — `systemctl reset-failed`, `daemon-reload` |
| 1.5 | claude-code-health.service | БЕЗ ИЗМЕНЕНИЙ — падает из-за 2 failed checks в health.sh (7/9 pass) |

### Phase 2: Очистка

| Что удалено | Размер |
|-------------|--------|
| Orphan контейнер `n8n` | — |
| /opt/clawtest/ (тестовый whoami) | ~1 MB |
| npm cache | ~400 MB |
| .env.bak файлы в /opt/n8n/ | ~2 KB |
| Мусорный файл в /root/ | 2.9 KB |
| __pycache__ в /opt/ | ~200 KB |
| 150 старых Claude сессий (>7 дней) | ~50 MB |
| Docker prune (неиспользуемые сети) | n8n_default |
| Journal vacuum (>7 дней) | — |

### Phase 3: CLAUDE.md

Создан `~/.claude/CLAUDE.md` (70 строк) — глобальный для всех проектов на VPS.
Содержит: стек, приложения, docker-compose проекты, домены, правила N8N, безопасность, команды, debug.

### Phase 4: .claudeignore

Создан `~/.claudeignore` + скопирован в:
- /opt/webapp/.claudeignore
- /opt/claude-code/.claudeignore
- /opt/claude-chat/.claudeignore

Игнорирует: node_modules, venv, .env, *.db, *.log, __pycache__, .git, dist, build, .next

### Phase 5: Агенты (~/.claude/agents/)

| Агент | Описание |
|-------|----------|
| deployer.md | DevOps — деплой Docker/systemd сервисов, макс 3 попытки |
| code-reviewer.md | Ревью кода: безопасность, баги, стиль, Docker-практики |
| researcher.md | Только чтение — поиск файлов, логов, конфигов |

### Phase 6: Skills (~/.claude/skills/)

| Skill | Триггер |
|-------|---------|
| n8n-expert.md | n8n, webhook, workflow, автоматизация |
| docker-traefik.md | docker, traefik, ssl, домен |
| vps-security.md | порты, firewall, SSH, безопасность, iptables |

### Phase 7: Slash Commands (~/.claude/commands/)

| Команда | Описание |
|---------|----------|
| /deploy | Полный цикл деплоя (Docker или systemd) |
| /debug | Диагностика всех сервисов, логов, портов |
| /status | Быстрая сводка VPS (ресурсы, Docker, systemd, ошибки) |
| /cleanup | Очистка: docker prune, npm cache, старые логи/сессии |

---

## Метрики до/после

| Метрика | До | После | Изменение |
|---------|-----|-------|-----------|
| Swap usage | 1.3 GB (65%) | 897 MB (44%) | **-400 MB** |
| Disk usage | 25 GB (53%) | 24 GB (51%) | **-1 GB** |
| Порты на 0.0.0.0 | 11 | 6 | **-5 закрыто** |
| Orphan контейнеры | 2 | 0 | **-2** |
| AMOCRM_TOKEN в коде | Да | Нет | **исправлено** |
| Экземпляров N8N | 2 (~500 MB) | 1 (~325 MB) | **-175 MB** |

---

## Текущие порты на 0.0.0.0 (после hardening)

| Порт | Процесс | Статус |
|------|---------|--------|
| 22 | sshd | OK — UFW |
| 80 | Traefik | OK — UFW |
| 443 | Traefik | OK — UFW |
| 3000 | control-bridge | **ПРОБЛЕМА** — нужно 127.0.0.1 |
| 3306 | MySQL (Docker) | OK — blocked iptables |
| 8080 | WordPress (Docker) | OK — blocked iptables |

X-UI/Xray порты (2053, 2096, 8443) — на `*`, управляются x-ui.

---

## Оставшиеся задачи

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | control-bridge (порт 3000) привязать к 127.0.0.1 | Высокий |
| 2 | acme.json = 0 bytes — разобраться с SSL Traefik | Высокий |
| 3 | claude-code-health.service — 2 failing checks | Средний |
| 4 | /opt/webapp/venv = 7.1 GB — пересоздать | Средний |
| 5 | n8n-traefik-n8n-1 — дублирующий контейнер из Traefik compose | Низкий |
| 6 | Docker images :latest заменить на конкретные версии | Низкий |

---

## Структура Claude Code на VPS (итог)

```
~/.claude/
├── CLAUDE.md              (70 строк — глобальная база знаний)
├── settings.json          (permissions, hooks, MCP memory)
├── agents/
│   ├── deployer.md        (деплой Docker/systemd)
│   ├── code-reviewer.md   (ревью кода)
│   └── researcher.md      (исследование, только чтение)
├── skills/
│   ├── n8n-expert.md      (N8N workflows)
│   ├── docker-traefik.md  (Docker + Traefik + SSL)
│   └── vps-security.md    (безопасность VPS)
├── commands/
│   ├── deploy.md          (/deploy)
│   ├── debug.md           (/debug)
│   ├── status.md          (/status)
│   └── cleanup.md         (/cleanup)
└── hooks/
    ├── load-rag-context.sh (SessionStart)
    └── save-session-rag.sh (SessionEnd)

~/.claudeignore              (node_modules, venv, .env, *.db, *.log)
```
