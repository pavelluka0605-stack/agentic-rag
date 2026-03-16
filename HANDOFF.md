# HANDOFF — Dev Environment с Claude Code

> Полная документация системы: архитектура, запуск, настройка, использование.
> Последнее обновление: 2026-03-16

---

## 1. Архитектура и почему она лучшая

### Схема

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI                       │
│                  (tmux session на VPS)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ PreTool  │  │ PostTool │  │   Stop   │             │
│  │  Hooks   │→ │  Hooks   │→ │   Hook   │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │              │              │                   │
│  ┌────▼──────────────▼──────────────▼──────┐           │
│  │          Hook Engine (bash + node)       │           │
│  │  session-start · pre-bash · pre-edit     │           │
│  │  pre-agent · post-bash · post-edit       │           │
│  │  post-agent · session-end                │           │
│  └────────────────┬────────────────────────┘           │
│                   │                                     │
│  ┌────────────────▼────────────────────────┐           │
│  │    MCP Memory Server (stdio, Node.js)    │           │
│  │    27 tools · SQLite + FTS5 · BM25       │           │
│  └────────────────┬────────────────────────┘           │
│                   │                                     │
│  ┌────────────────▼────────────────────────┐           │
│  │         memory.db (SQLite + WAL)         │           │
│  │  policies · episodes · incidents         │           │
│  │  solutions · decisions · contexts        │           │
│  │  github_events · 6× FTS5 indexes        │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
│  ┌─────────────────────────────────────────┐           │
│  │      GitHub Webhook Receiver (:3900)     │           │
│  │  HMAC-SHA256 · PR→solution · Issue→inc   │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
│  ┌─────────────────────────────────────────┐           │
│  │         Subagent Strategy (8 ролей)      │           │
│  │  architect · repo-explorer · memory-eng  │           │
│  │  incident-analyst · repair-agent         │           │
│  │  qa-verifier · github-op · docs-writer   │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  VPS Runtime: tmux(3 окна) + systemd(2 unit)           │
│  Remote Control: GitHub Actions workflow_dispatch       │
└─────────────────────────────────────────────────────────┘
```

### Почему эта архитектура

| Решение | Альтернативы | Почему выбрано |
|---------|-------------|---------------|
| SQLite+FTS5 | Postgres+pgvector, Qdrant, JSONL | Zero-ops, один файл, BM25 ranking, WAL для concurrency |
| tmux+systemd | Docker, screen+supervisor | Нативный доступ, 100k scrollback, systemd restart |
| MCP stdio | HTTP API, gRPC | Нативная интеграция с Claude Code, zero network |
| Hooks (bash+node) | Python, pure node | bash для shell-операций, node для SQLite/MCP |
| GitHub Actions dispatch | SSH напрямую, Ansible | GUI для Remote Control, audit log, secrets management |

---

## 2. Что реализовано

### Полный стек

- **7 hooks** (PreToolUse×3, PostToolUse×3, Stop×1) — self-diagnostics и self-healing
- **MCP Memory Server** — 27 tools, 6 слоёв памяти, SQLite+FTS5
- **Self-healing repair loop** — 11 классов ошибок, verification strategy, max 3 попытки
- **Session bootstrap** — автозагрузка контекста из памяти при старте
- **Completion check** — проверка критериев завершения задачи
- **GitHub Webhook Bridge** — PR/issue/workflow → память
- **VPS Runtime** — tmux(3 окна) + systemd(2 сервиса) + health check(8 проверок)
- **Remote Control** — GitHub Actions workflow_dispatch (6 действий)
- **Subagent Strategy** — 8 ролей, 4 workflow, модели и разрешения
- **Diagnostics** — 54 автоматических проверки

---

## 3. Сервисы и файлы

### Дерево `.claude/`

```
.claude/
├── settings.json                    ← конфиг hooks + MCP
├── hooks/
│   ├── session-start.sh             ← SessionStart (first-call bootstrap)
│   ├── pre-bash.sh                  ← PreToolUse[Bash] (guard + retrieval)
│   ├── pre-edit.sh                  ← PreToolUse[Edit|Write] (secret protection)
│   ├── pre-agent.sh                 ← PreToolUse[Agent] (subagent logging)
│   ├── post-bash.sh                 ← PostToolUse[Bash] (errors + successes + repair)
│   ├── post-edit.sh                 ← PostToolUse[Edit|Write] (change tracking)
│   ├── post-agent.sh                ← PostToolUse[Agent] (result logging)
│   ├── session-end.sh               ← Stop (completion check + summary)
│   ├── diagnose.sh                  ← 54 проверки системы
│   └── lib/
│       ├── session-bootstrap.js     ← загрузка контекста из памяти
│       ├── completion-check.js      ← проверка критериев завершения
│       ├── repair-loop.js           ← self-healing (11 классов, verification)
│       └── query-memory.js          ← CLI для запросов к памяти
├── mcp/memory-server/
│   ├── index.js                     ← MCP server (27 tools)
│   ├── db.js                        ← SQLite + FTS5 (все CRUD)
│   ├── github.js                    ← GitHub webhook → memory
│   └── migrations/001-init.sql      ← schema (7 таблиц + FTS5)
├── memory/
│   └── memory.db                    ← SQLite БД (WAL mode)
└── subagents/
    ├── strategy.json                ← роли, модели, permissions
    └── prompts.md                   ← шаблоны промптов
```

### VPS Runtime

```
vps-runtime/
├── bin/
│   ├── bootstrap.sh                 ← установка всего на VPS (270 строк, 9 фаз)
│   ├── start.sh                     ← запуск tmux с 3 окнами
│   ├── stop.sh                      ← graceful shutdown
│   ├── restart.sh                   ← safe restart
│   ├── connect.sh                   ← подключение к tmux
│   └── health.sh                    ← 8 health checks
├── etc/tmux.conf                    ← 100k scrollback, mouse, status bar
└── github-webhook/
    ├── server.js                    ← HTTP webhook receiver (:3900)
    └── package.json
```

---

## 4. Как запускать на VPS

### Автоматический деплой (рекомендуется)

1. Убедись что GitHub секреты настроены: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
2. GitHub → Actions → "Deploy Claude Code Runtime" → Run workflow
3. Выбери action: `bootstrap` → Run
4. SSH на VPS:
   ```bash
   ssh user@vps
   echo "ANTHROPIC_API_KEY=sk-ant-..." >> /opt/claude-code/env/claude.env
   ```
5. GitHub → Actions → action: `start` → Run
6. GitHub → Actions → action: `health` → проверь 8/8

### Ручной деплой

```bash
# На VPS:
git clone <repo> /opt/claude-code/workspace
cd /opt/claude-code/workspace
bash vps-runtime/bin/bootstrap.sh --force

# Настрой API ключ:
echo "ANTHROPIC_API_KEY=sk-ant-..." >> /opt/claude-code/env/claude.env

# Запусти:
bash /opt/claude-code/bin/start.sh

# Проверь:
bash /opt/claude-code/bin/health.sh

# Подключись:
bash /opt/claude-code/bin/connect.sh workspace
```

### Структура tmux сессии

```
┌──────────────────────────────────────────────┐
│ Window 1: workspace   ← Claude Code CLI      │
│ Window 2: monitor     ← health.sh каждые 60s │
│ Window 3: logs        ← tail -f session.log  │
└──────────────────────────────────────────────┘
```

---

## 5. Remote Control

### Через GitHub Actions (телефон/планшет/браузер)

GitHub → repo → Actions → "Deploy Claude Code Runtime":
- **bootstrap** — полная установка/переустановка
- **start** — запуск сервисов
- **stop** — остановка
- **restart** — перезапуск
- **health** — проверка статуса
- **update-scripts** — обновление скриптов без bootstrap

### Через SSH

```bash
# Подключиться к Claude workspace:
ssh user@vps "bash /opt/claude-code/bin/connect.sh workspace"

# Посмотреть логи:
ssh user@vps "bash /opt/claude-code/bin/connect.sh logs"

# Health check:
ssh user@vps "bash /opt/claude-code/bin/health.sh"
```

---

## 6. GitHub Integration

### Webhook

1. Сгенерируй секрет:
   ```bash
   head -c 32 /dev/urandom | base64
   ```
2. Настрой на VPS:
   ```bash
   echo "GITHUB_WEBHOOK_SECRET=<секрет>" >> /opt/claude-code/github-webhook/.env
   systemctl restart github-webhook
   ```
3. В GitHub → repo → Settings → Webhooks → Add:
   - URL: `http://<vps-host>:3900/webhook/github`
   - Content type: `application/json`
   - Secret: тот же
   - Events: Push, Pull requests, Issues, Workflow runs

### Что попадает в память

| GitHub Event | → Memory Layer |
|-------------|----------------|
| PR merged | → solution (verified) |
| Issue opened (bug label) | → incident |
| Workflow run failed | → incident |
| Workflow run success (after failure) | → solution (verified) |

### CI/CD Workflows

15 workflows в `.github/workflows/`:
- `deploy-p0.yml` — деплой CRM
- `deploy-claude-code.yml` — управление VPS
- `healthcheck.yml` — мониторинг (cron каждые 6ч)
- `sheets-manage.yml` — Google Sheets операции
- и 11 других

---

## 7. Как работает память

### 6 слоёв

| Слой | Таблица | Что хранит | Примеры |
|------|---------|-----------|---------|
| **Policy** | policies | Правила, ограничения, конвенции | "Google APIs блокируются из Claude Code" |
| **Episodic** | episodes | Сессии, прогресс, open loops | "Собрана память, осталось тестирование" |
| **Incident** | incidents | Ошибки с fingerprint, dedup, fixes | "npm ERESOLVE peer dependency conflict" |
| **Solution** | solutions | Рабочие решения, паттерны | "SQLite+FTS5 для dev memory" |
| **Decision** | decisions | Архитектурные решения | "tmux+systemd вместо Docker" |
| **Context** | contexts | Код, конфиги, deployment knowledge | API endpoints, config snippets |

### MCP Tools (27 штук)

**CRUD:** policy_add/list/update, episode_save/list/open_loops, incident_add/fix/find_similar/list/update_status, solution_add/verify/use/rate/find/list/update, decision_add/list, context_add/list

**Cross-layer:** memory_search (FTS5 BM25), memory_bootstrap, memory_stats, memory_delete, memory_prune

### FTS5 Full-Text Search

Каждая таблица имеет FTS5 виртуальную таблицу с автосинхронизацией через триггеры.
Поиск: BM25 ranking, tokenizer unicode61, кросс-слойный.

```
memory_search("peer dependency conflict") →
  #1 incident: npm ERESOLVE (rank: -4.2)
  #2 solution: --legacy-peer-deps (rank: -3.8)
```

### Fingerprint Dedup

Инциденты дедуплицируются по SHA256 fingerprint:
- `error_message` → normalize → SHA256 → first 16 chars
- Повторная ошибка → `occurrence_count++`, не дублирует запись

---

## 8. Самодиагностика

### Автоматическая (hooks)

**SessionStart** — при первом вызове инструмента:
- Загружает bootstrap из памяти (правила, сессии, инциденты, решения)
- Напоминает прочитать STATE.md

**PreToolUse[Bash]** — перед каждой bash-командой:
- Блокирует `rm -rf /`, `mkfs`, `dd of=/dev/`
- Предупреждает об опасных командах (12 паттернов)
- Ищет похожие прошлые ошибки
- Показывает ограничения из policies

**Completion Check** — при остановке:
- Незакоммиченные изменения
- Незапушенные коммиты
- Открытые инциденты
- Lint/test статус

### Ручная

```bash
bash .claude/hooks/diagnose.sh
```

54 проверки:
1. Структура директорий (5)
2. Конфигурация settings.json (12)
3. MCP Memory Server (7)
4. Hooks — наличие и исполняемость (18)
5. Hook helpers (4)
6. Memory database (таблицы, stats)
7. Runtime (Node.js, Git, Python3)
8. Git (branch, dirty status)
9. Ресурсы (disk, memory)

---

## 9. Self-healing Loop

### Как работает

```
Ошибка в Bash
    │
    ▼
post-bash.sh: exit_code != 0
    │
    ├── Записать инцидент (fingerprint dedup)
    ├── Поиск похожих инцидентов с фиксами
    ├── Поиск решений из памяти
    │
    ▼
Повторная ошибка (attempt ≥ 2)?
    │
    ▼
repair-loop.js:
    ├── Классификация (11 классов)
    ├── Retrieval похожих случаев
    ├── Показ failed approaches (не повторять!)
    ├── Verification strategy для класса ошибки
    │
    ▼
attempt ≥ 3? → СТОП
    ├── Пометить incident как "investigating"
    ├── Записать все failed approaches
    ├── Предложить: другой подход / спросить / blocked
```

### 11 классов ошибок

| Класс | Pattern | Safe Actions |
|-------|---------|-------------|
| permissions | EACCES, 403 | chmod, chown, sudo |
| missing_resource | ENOENT, not found | mkdir -p, touch, npm install |
| network | ECONNREFUSED, ETIMEDOUT | retry, ping, curl -I |
| syntax | SyntaxError | lint, validate |
| resources | ENOMEM, heap | --max-old-space-size |
| dependency | ERESOLVE, peer dep | npm ls, --legacy-peer-deps |
| timeout | ETIMEOUT | --timeout, retry |
| duplicate | EEXIST | rm, mv, --force |
| auth | 401, unauthorized | env check, secret check |
| import | Module not found | npm install, npm ls |
| disk | ENOSPC | df -h, npm cache clean |

### Verification Strategy

После каждого fix — конкретные шаги проверки:
- **syntax**: `node --check` / `python3 -m py_compile`
- **missing_resource**: повторить исходную команду
- **dependency**: `npm test`
- **permissions**: повторить исходную команду (без chmod 777!)

### Защиты

- Max 3 попытки на одну ошибку
- Failed approaches записываются и показываются
- Нет бесконечных retry
- Нет фальсификации успешности
- Incident не закрывается без verified fix

---

## 10. Subagents — роли и назначение

### 8 ролей

| Роль | Тип | Модель | R/W | Когда использовать |
|------|-----|--------|-----|-------------------|
| **architect** | Plan | opus | R | Выбор архитектуры, сравнение вариантов |
| **repo-explorer** | Explore | sonnet | R | Исследование кода, поиск файлов |
| **memory-engineer** | general | sonnet | RW | Работа с памятью, schema, retrieval |
| **incident-analyst** | general | sonnet | R | Анализ ошибок, root cause |
| **repair-agent** | general | opus | RW (worktree) | Безопасные фиксы с изоляцией |
| **qa-verifier** | general | haiku | R | Тесты, lint, smoke checks |
| **github-operator** | general | sonnet | RW | GitHub операции |
| **docs-writer** | general | sonnet | RW | Документация |

### 4 workflow

1. **investigate-and-fix**: explorer → analyst → repair → qa
2. **architecture-decision**: explorer ∥ architect → docs
3. **pre-deploy-check**: qa ∥ explorer ∥ github (параллельно)
4. **session-bootstrap**: explorer ∥ memory-engineer (параллельно)

### Распределение по моделям

- **opus** (сильная): architect, repair-agent — требуют глубокого понимания
- **sonnet** (быстрая): explorer, memory, analyst, github, docs — баланс скорости и качества
- **haiku** (лёгкая): qa-verifier — простые проверки, максимальная скорость

---

## 11. Что протестировано

### Синтаксис (100%)

- ✅ Все 9 bash hooks: `bash -n`
- ✅ Все 4 JS helpers: `node --check`
- ✅ MCP server (db.js, index.js, github.js): `node --check`
- ✅ settings.json: valid JSON, все matchers

### Функциональность

- ✅ session-bootstrap.js: загружает полный контекст (правила, сессии, инциденты, решения)
- ✅ completion-check.js: определяет незакоммиченные файлы, unpushed, открытые инциденты
- ✅ repair-loop.js: классификация ошибок, retrieval, verification strategy, failed approaches
- ✅ pre-agent.sh: логирует subagent start
- ✅ post-agent.sh: логирует subagent завершение
- ✅ post-edit.sh: трекинг изменённых файлов
- ✅ diagnose.sh: 54/54 проверок пройдено

### Интеграция

- ✅ db.js: fingerprint (empty→sentinel), updateIncidentStatus, updateSolution, updatePolicy, deleteEntry, pruneOld
- ✅ MCP server: 27 tools работают через stdio
- ✅ Memory DB: 7 таблиц + FTS5 + триггеры

---

## 12. Ограничения

| Ограничение | Влияние | Workaround |
|-------------|---------|-----------|
| Google APIs блокируются из Claude Code | Нет прямого доступа к Sheets | Через GitHub Actions workflow `sheets-manage.yml` |
| MCP server — stdio only | Нет HTTP API для внешних клиентов | Через hooks + query-memory.js CLI |
| GitHub webhook — HTTP only | Нужен reverse proxy для HTTPS | Настроить nginx/caddy на VPS |
| Нет real-time мониторинга | Только health checks | Watchdog (cron 5 мин) + healthcheck (6ч) |
| memory.db — один файл | Нет backup стратегии | Добавить rsync/cron бэкап |
| Нет тестового покрытия (unit tests) | Тесты только smoke/syntax | Добавить jest/vitest во 2-й итерации |
| session flag по PID | Не на 100% unique | Работает для одного экземпляра Claude |
| FTS5 tokenizer | Кириллица работает, но не идеально | unicode61 достаточен для текущих нужд |

---

## 13. Улучшения для второй итерации

### Приоритет 1 (высокий)

1. **Unit тесты** — jest/vitest для db.js, repair-loop.js, query-memory.js
2. **Backup memory.db** — cron rsync на S3/отдельный диск
3. **HTTPS webhook** — nginx reverse proxy с Let's Encrypt
4. **Memory pruning cron** — автоочистка старых записей (>90 дней)

### Приоритет 2 (средний)

5. **Dashboard** — простой web UI для просмотра памяти (read-only)
6. **Telegram интеграция** — алерты об инцидентах менеджеру
7. **Метрики** — сколько инцидентов решено, среднее время fix, top ошибки
8. **Migration system** — версионирование schema (002-xxx.sql, 003-xxx.sql)

### Приоритет 3 (низкий)

9. **Vector embeddings** — дополнительно к FTS5 для семантического поиска
10. **Multi-project** — общая память между проектами с фильтрацией
11. **AI-powered retrieval** — Claude для re-ranking результатов поиска
12. **Session recording** — полная запись сессий для ретроспективы

---

## Быстрый старт

```bash
# 1. Клонируй репозиторий на VPS
git clone <repo> /opt/claude-code/workspace
cd /opt/claude-code/workspace

# 2. Установи
bash vps-runtime/bin/bootstrap.sh --force

# 3. Настрой API ключ
echo "ANTHROPIC_API_KEY=sk-ant-..." >> /opt/claude-code/env/claude.env

# 4. Запусти
bash /opt/claude-code/bin/start.sh

# 5. Проверь
bash /opt/claude-code/bin/health.sh     # 8 checks
bash .claude/hooks/diagnose.sh           # 54 checks

# 6. Подключись
bash /opt/claude-code/bin/connect.sh workspace

# 7. Claude автоматически:
#    - загрузит контекст из памяти (session bootstrap)
#    - будет проверять команды (pre-bash, pre-edit)
#    - будет фиксировать ошибки и решения (post-bash)
#    - при завершении — completion check + summary
```
