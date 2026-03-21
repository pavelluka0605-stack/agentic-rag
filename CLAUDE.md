# Project Knowledge Base — Agentic RAG / P0 Foundation

> **ВАЖНО:** В начале каждой сессии и после сжатия контекста — ОБЯЗАТЕЛЬНО прочитай `STATE.md`.
> Там текущее состояние задач, решения и баги. Не спрашивай пользователя то, что уже записано.
>
> **ПАМЯТЬ:** Используй MCP-сервер `memory` для записи решений, ошибок и паттернов.
> При старте сессии вызови `get_context` чтобы загрузить накопленный опыт.
> При завершении — `save_session` для сохранения итогов.

## Проект
CRM-система для мебельного бизнеса (marbomebel.ru). Автоматизация обработки заявок из VK, Telegram, BlueSales → Google Sheets.
Параллельно — **аудит/ребрендинг mebelit.site → кухнирема.рф** (см. `STATE.md` и `site-analysis/DISCOVERY-AUDIT.md`).

## Инфраструктура

### VPS (Frankfurt)
- **Хост:** задан в секрете `VPS_HOST`
- **Пользователь:** задан в секрете `VPS_USER`
- **SSH-ключ:** секрет `VPS_SSH_KEY`
- **Сервисы на VPS:** N8N (n8n.marbomebel.ru), VK Long Poll listener

### GitHub Actions Workflows
- `deploy-p0.yml` — полный деплой на VPS (N8N + Long Poll + workflows)
- `healthcheck.yml` — проверка состояния всех сервисов
- `sheets-manage.yml` — управление листами Google Sheets (list/add/delete)

## Секреты GitHub (все настроены)

| Секрет | Описание | Статус |
|--------|----------|--------|
| `VPS_HOST` | IP/домен VPS Frankfurt | ✅ |
| `VPS_USER` | SSH пользователь | ✅ |
| `VPS_SSH_KEY` | Приватный SSH-ключ | ✅ |
| `VK_TOKEN` | Access Token сообщества VK | ✅ |
| `VK_GROUP_ID` | ID группы VK | ✅ |
| `VK_USER_TOKEN` | Personal user token VK | ✅ |
| `TG_BOT_TOKEN` | Telegram Bot Token | ✅ |
| `TG_CHAT_ID` | Chat ID менеджера | ✅ |
| `GOOGLE_SA_JSON` | Google Service Account JSON | ✅ |
| `SPREADSHEET_ID` | ID Google-таблицы | ✅ |
| `BLUESALES_LOGIN` | Логин BlueSales | ✅ |
| `BLUESALES_PASS` | Пароль BlueSales | ✅ |
| `BLUESALES_REMOTE_URL` | URL удалённого доступа BlueSales | ✅ |
| `BLUESALES_API_KEY` | API ключ BlueSales | ✅ |
| `OPENAI_API_KEY` | OpenAI API ключ для AI автоответов | ✅ |
| `N8N_API_KEY` | API ключ для N8N | ✅ |
| `N8N_BASE_URL` | Базовый URL N8N | ✅ |

## Google Cloud

- **Проект:** `botn8n-468710`
- **Service Account:** `n8n-sheets@botn8n-468710.iam.gserviceaccount.com`
- **Google Sheets API:** ✅ Включён
- **Spreadsheet ID:** `1i4R4GJuNJTTh1-KijKLToWFDASaHGgpqgirgyrl0iLY`
- **Доступ SA к таблице:** ✅ Расшарена с правами редактора

## Локальные файлы (НЕ в git)

- `.google-sa.json` — ключ сервисного аккаунта Google (в .gitignore)

## Работа с Google Sheets (локально)

Для прямого доступа к Google Sheets из этой среды используется `.google-sa.json`.
Пример скрипта — см. `.github/workflows/sheets-manage.yml` для Python-кода.

```python
import json, requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

sa_info = json.load(open(".google-sa.json"))
creds = service_account.Credentials.from_service_account_info(
    sa_info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
creds.refresh(Request())
SPREADSHEET_ID = "1i4R4GJuNJTTh1-KijKLToWFDASaHGgpqgirgyrl0iLY"
headers = {"Authorization": f"Bearer {creds.token}"}
```

## Структура проекта

```
agentic-rag/
├── .github/workflows/     — CI/CD пайплайны
├── p0-foundation/
│   ├── credentials/       — шаблоны credentials
│   ├── n8n-workflows/     — JSON-файлы N8N workflows
│   ├── scripts/           — скрипты деплоя и настройки
│   ├── vk-longpoll/       — VK community long poll listener
│   └── vk-user-longpoll/  — VK user long poll listener
├── vps-runtime/
│   ├── bin/               — скрипты запуска/остановки/мониторинга Claude Code
│   ├── env/               — шаблоны env-файлов
│   └── etc/               — конфиги (tmux)
├── .claude/               — Claude Code dev environment (MCP, hooks, memory)
└── CLAUDE.md              — ЭТА БАЗА ЗНАНИЙ
```

## Листы Google Sheets

Актуальный список листов — проверять через API (см. код выше).

## GitHub Token

- **Тип:** Classic (Personal Access Token)
- **Scopes:** `repo`, `workflow`
- **Примечание:** Fine-grained токены НЕ поддерживают scope `workflow` для пуша workflow-файлов

## BlueSales API

- **Base URL:** `https://bluesales.ru/app/Customers/WebServer.aspx`
- **Auth:** POST с query params `login`, `password` (MD5 uppercase хеш), `command`
- **API Key:** сохранён в секрете `BLUESALES_API_KEY`
- **Лимит:** макс. 500 записей за запрос (`pageSize`)
- **Python SDK (неофициальный):** https://github.com/thehighestmath/bluesales-python-sdk

### Методы API

| Команда | Описание |
|---------|----------|
| `customers.get` | Получить клиентов (фильтр: даты, теги, менеджеры, VK ID, телефон) |
| `customers.add` | Добавить клиента |
| `customers.update` | Обновить клиента |
| `customers.addMany` | Добавить несколько клиентов |
| `customers.updateMany` | Обновить несколько клиентов |
| `customers.delete` | Удалить клиента |
| `orders.get` | Получить заказы (фильтр: даты, статусы, ID клиента) |
| `orders.add` | Добавить заказ |
| `orders.updateMany` | Обновить несколько заказов |
| `orders.setStatus` | Изменить статус заказа |
| `users.get` | Получить список пользователей |

### Особенности
- Если другой пользователь онлайн — API возвращает ошибку с таймером ожидания
- Webhook в BlueSales отсутствует — используем polling через N8N (P0-05, каждый час)

## Система памяти

- **`STATE.md`** — текущее состояние задач, баги, решения. Читать ВСЕГДА при старте.
- **`CLAUDE.md`** — этот файл, база знаний инфраструктуры.
- Обновлять `STATE.md` после каждой значимой задачи.

## Известные проблемы

- **Google APIs заблокированы из среды Claude Code** — IP этой среды получает 403 HTML от Google APIs.
  Решение: все операции с Google Sheets выполнять через GitHub Actions workflow `sheets-manage.yml`.
- **Кириллица в workflow_dispatch inputs** — при передаче через API могут быть проблемы с encoding.
  Решение: использовать `delete-sheet-by-id` с числовым ID вместо имени листа.

## Выполненные задачи

- [x] Создан CLAUDE.md как база знаний проекта
- [x] Настроены все секреты GitHub Actions
- [x] Google Sheets API включён, SA расшарен на таблицу
- [x] Удалён "Лист 1" из Google Sheets (через delete-sheet-by-id)
- [x] Workflow sheets-manage.yml поддерживает base64 GOOGLE_SA_JSON
- [x] Classic GitHub PAT с scopes repo + workflow
- [x] .google-sa.json добавлен в .gitignore
- [x] VPS healthcheck пройден (SSH, все сервисы, Telegram)
- [x] Полный деплой deploy-p0.yml — success (N8N + VK Long Poll + workflows)
- [x] N8N workflows P0-01..P0-04 импортированы и активированы
- [x] Создан P0-05_BlueSales_Sync.json — синхронизация BlueSales → Google Sheets
- [x] Листы BlueSales_Клиенты и BlueSales_Заказы созданы в Google Sheets
- [x] BLUESALES_PASSWORD_HASH добавлен в deploy .env
- [x] Финальный healthcheck после деплоя P0-05 — success
- [x] Healthcheck по cron каждые 6 часов (UTC 0/6/12/18)
- [x] P0-03 обновлён: парсинг размеров из VK комментариев → лист "Спрос"
- [x] Формулы в Сводка_спроса (COUNTIFS по размерам XS-XXL, автоподсчёт)
- [x] P0-06 BlueSales Webhook — real-time обработка событий из BlueSales
- [x] sheets-manage.yml: добавлено действие setup-svodka-formulas
- [x] BLUESALES_API_KEY сохранён как GitHub секрет и добавлен в deploy .env
- [x] Документация BlueSales API добавлена в CLAUDE.md
- [x] P0-07 AI Comment Reply — AI автоответы на VK комментарии (GPT-4o)
- [x] P0-03 обновлён: после комментария вызывает P0-07 для AI обработки
- [x] P0-07 исправлен: OpenAI API через $env.OPENAI_API_KEY вместо ручного credential
- [x] OPENAI_API_KEY добавлен как GitHub секрет
- [x] Watchdog скрипт — авторестарт сервисов + мониторинг ресурсов VPS + Telegram алерты
- [x] P0-08 Error Monitor — отслеживание ошибок N8N executions каждые 15 мин
- [x] Watchdog интегрирован в deploy-p0.yml (установка через cron каждые 5 мин)
- [x] healthcheck.yml обновлён — проверяет статус watchdog

## Текущее состояние системы

- **N8N** — работает на VPS, 8 workflows (P0-01..P0-08) активированы
- **Watchdog** — cron каждые 5 мин: проверка сервисов, авторестарт, мониторинг CPU/RAM/диска
- **P0-08 Error Monitor** — N8N workflow, проверяет failed executions каждые 15 мин → алерт в Telegram
- **VK Long Poll** (community) — слушает входящие сообщения в группу
- **VK User Long Poll** — слушает личные сообщения
- **BlueSales Sync** (P0-05) — автосинхронизация клиентов/заказов каждый час
- **BlueSales Webhook** (P0-06) — real-time обработка событий (endpoint: /webhook/bluesales-webhook)
- **Парсинг спроса** — VK комментарии автоматически парсятся на размеры (XS-XXL) → лист "Спрос"
- **Сводка спроса** — формулы COUNTIFS автоматически считают спрос по размерам
- **Healthcheck** — автоматически каждые 6 часов + ручной запуск
- **Google Sheets** — листы: Товары, Спрос, Заказы_поставщику, Заказы_клиентов, Сводка_спроса, Логи_N8N, BlueSales_Клиенты, BlueSales_Заказы
- **AI автоответы** (P0-07) — GPT-4o классифицирует VK комментарии: консультация / уточнение / сделка
- **Telegram** — уведомления менеджеру работают

## Автономное управление VPS (Remote Exec)

### Архитектура
Claude Code **не имеет** прямого SSH на VPS и `gh` CLI. Вместо этого — система управления через git push:

```
Claude Code пишет exec.json → git push → GitHub Actions → SSH на VPS → выполнение → commit result.json → Claude Code читает результат
```

### Как использовать

**1. Выполнить произвольную команду на VPS:**
```python
# Записать команду
import json
with open('.claude/commands/exec.json', 'w') as f:
    json.dump({"command": "systemctl status control-bridge", "intent": "проверка статуса"}, f)
# git add, commit, push → workflow запустится автоматически
```

**2. Запустить готовый скрипт:**
```python
import json
with open('.claude/commands/exec.json', 'w') as f:
    json.dump({"script_file": ".claude/commands/scripts/full-cycle-bridge.sh", "intent": "полный цикл"}, f)
```

**3. Прочитать результат:**
```bash
git pull origin <branch>
cat .claude/commands/result.json
```

### Готовые скрипты

| Скрипт | Описание |
|--------|----------|
| `scripts/diagnose-bridge.sh` | 15 проверок Control Bridge (сервис, health, TLS, DNS, Docker, CORS) |
| `scripts/fix-bridge.sh` | Автофикс типовых проблем (рестарт, nginx конфликт, iptables, зомби) |
| `scripts/full-cycle-bridge.sh` | Полный цикл: диагностика → автофикс → верификация |

### Workflow
- **Файл:** `.github/workflows/vps-remote-exec.yml`
- **Триггер:** push в `.claude/commands/exec.json`
- **Результат:** коммит в `.claude/commands/result.json` (с `[skip ci]`)
- **Уведомление:** Telegram

### Цикл работы (автономный)
1. Обнаружил проблему → записал exec.json с диагностикой
2. Пуш → workflow выполнил на VPS → закоммитил результат
3. `git pull` → прочитал result.json → понял проблему
4. Записал exec.json с фиксом → пуш → проверка
5. Повторить до решения

### Ограничения
- Каждый цикл занимает ~2-3 минуты (CI pipeline)
- Нужен `git pull` перед чтением результата
- Concurrency: один exec за раз (cancel-in-progress)

## Возможные дальнейшие улучшения

1. ~~Автоответы клиентам VK~~ → реализовано в P0-07 (AI автоответы GPT-4o)
2. Получение имени клиента VK через VK API (users.get) при парсинге комментариев
3. Дашборд/отчёты по продажам в Telegram (еженедельная сводка)
4. Настройка webhook URL в BlueSales для P0-06 (нужен публичный URL N8N)

## Dev Memory System (многослойная)

### Архитектура
SQLite + FTS5 (BM25 ranking) | Node.js MCP server | 6 слоёв памяти | 22 инструмента

### Хранилище
- **БД:** `.claude/memory/memory.db` (SQLite, WAL mode)
- **Бэкап:** `cp memory.db memory.db.bak`
- **Zero-ops:** нет Docker, нет Postgres, один файл

### 6 слоёв памяти

| # | Слой | Таблица | Описание |
|---|------|---------|----------|
| 1 | **Policy** | `policies` | Правила, ограничения, конвенции, known limitations |
| 2 | **Episodic** | `episodes` | Сессии, прогресс, open loops, где остановились |
| 3 | **Incident** | `incidents` | Ошибки, stack traces, fingerprints, фиксы, дедупликация |
| 4 | **Solution** | `solutions` | Рабочие решения, паттерны, playbooks, verified/rated |
| 5 | **Decision** | `decisions` | Архитектурные решения, компромиссы, что НЕ делаем |
| 6 | **Context** | `contexts` | Код, инфра, доки, deployment knowledge |

### MCP Tools (22 инструмента)

**Policy:** `policy_add`, `policy_list`
**Episodic:** `episode_save`, `episode_list`, `episode_open_loops`
**Incident:** `incident_add` (auto-dedup), `incident_fix`, `incident_find_similar`, `incident_list`
**Solution:** `solution_add`, `solution_verify`, `solution_use`, `solution_rate`, `solution_find`, `solution_list`
**Decision:** `decision_add`, `decision_list`
**Context:** `context_add`, `context_list`
**Cross-layer:** `memory_search` (FTS5 BM25), `memory_bootstrap`, `memory_stats`

### Правила работы с памятью
1. **Старт сессии**: `memory_bootstrap` — загрузить policies, open incidents, top solutions, open loops
2. **Решение принято**: `decision_add` — записать что, почему, альтернативы, что НЕ делаем
3. **Ошибка найдена**: `incident_add` — auto-dedup по fingerprint
4. **Ошибка исправлена**: `incident_fix` — записать verified fix
5. **Нашёл похожую ошибку**: `incident_find_similar` — FTS5 поиск
6. **Удачный паттерн**: `solution_add` → `solution_verify` → `solution_rate`
7. **Конец сессии**: `episode_save` — итоги, open loops, что осталось
8. **Нужен контекст**: `memory_search` — поиск по всем слоям

### GitHub → Memory (автоматически через webhook)
- **PR merged** → `solutions` (verified)
- **Issue opened (bug label)** → `incidents`
- **Issue opened (other)** → `episodes` (open loop)
- **Workflow failed** → `incidents` (с fingerprint)
- **Workflow succeeded after retry** → `solutions` (verified)

### Webhook receiver
- Порт: 3900
- Endpoint: `POST /webhook/github`
- Health: `GET /health`
- Stats: `GET /stats`
- systemd: `github-webhook.service`

### Hooks (самодиагностика + самоисправление)

| Event | Hook | Что делает |
|-------|------|-----------|
| `PreToolUse[Bash]` | `pre-bash.sh` | Блокирует `rm -rf /`, предупреждает об опасных командах, ищет похожие инциденты |
| `PreToolUse[Edit\|Write]` | `pre-edit.sh` | Блокирует запись в `.env`/credentials, предупреждает при правке инфра-файлов |
| `PostToolUse[Bash]` | `post-bash.sh` | При ошибке: записывает incident, ищет похожие фиксы, запускает repair retrieval |
| `Stop` | `session-end.sh` | Напоминает сохранить episode, закрыть incidents, записать decisions |

### Self-Healing (repair loop)
1. Ошибка → классификация (9 классов: permissions, network, syntax, dependency...)
2. Retrieval похожих инцидентов и solutions из памяти
3. Рекомендация фикса (если есть verified fix — предлагает его)
4. Лимит 3 попытки на уникальную ошибку — потом СТОП
5. Каждая попытка должна быть ДРУГОЙ
6. Успешный фикс → `incident_fix` + `solution_add`
7. Неудачный → запись в `failed_attempts`, не скрывать

### Диагностика (38 проверок)
```bash
bash .claude/hooks/diagnose.sh
```

## VPS Runtime Layer (Claude Code)

### Архитектура
tmux + systemd + bash wrapper scripts.

### Структура на VPS
```
/opt/claude-code/
├── bin/
│   ├── bootstrap.sh    # One-time VPS setup
│   ├── start.sh        # Start tmux session (3 windows)
│   ├── stop.sh         # Graceful stop
│   ├── restart.sh      # Safe restart
│   ├── connect.sh      # Attach to session
│   ├── health.sh       # Health check (8 checks)
│   ├── backup-memory.sh # Backup + pruning memory.db (cron)
│   └── setup-https.sh  # HTTPS setup (nginx + certbot)
├── env/
│   └── claude.env      # Environment (ANTHROPIC_API_KEY, etc.)
├── etc/
│   ├── tmux.conf       # tmux config (100k scrollback, status bar)
│   └── nginx-webhook.conf # Nginx reverse proxy config (HTTPS)
├── logs/
│   ├── session-*.log   # Daily session logs
│   └── events.log      # Start/stop events
├── memory/
│   └── memory.db       # SQLite database (все 6 слоёв)
├── memory-server/      # MCP memory server (Node.js)
├── github-webhook/     # GitHub webhook → memory
│   └── .env            # WEBHOOK_PORT, SECRET, DB_PATH
└── workspace/          # Git repos & working directories
```

### Команды
```bash
# Bootstrap (one-time)
bash /opt/claude-code/bin/bootstrap.sh

# Daily usage
systemctl start claude-code     # Start session
/opt/claude-code/bin/connect.sh  # Attach from SSH
/opt/claude-code/bin/health.sh   # Check health

# Inside tmux session
claude                           # Start Claude Code
claude --resume                  # Resume previous conversation

# Windows: Ctrl-b n/p to switch
#   0: workspace  — Claude Code here
#   1: monitor    — health check every 30s
#   2: logs       — live log tail
```

### GitHub Actions
`deploy-claude-code.yml` — bootstrap, start, stop, restart, health, update-scripts

### Backup & Pruning
```bash
# Cron (каждые 30 мин): backup memory.db + очистка старых записей
*/30 * * * * /opt/claude-code/bin/backup-memory.sh >> /opt/claude-code/logs/backup.log 2>&1

# Только backup
/opt/claude-code/bin/backup-memory.sh --backup-only

# Только pruning
/opt/claude-code/bin/backup-memory.sh --prune-only
```
- Хранит до 48 бэкапов (24ч при 30-мин интервале), автоматическая ротация
- Pruning: resolved incidents >90д, episodes >180д, github_events >60д
- SQLite backup API (WAL-safe)

### HTTPS Webhook (Nginx + Let's Encrypt)
```bash
# Setup (на VPS с root):
bash /opt/claude-code/bin/setup-https.sh webhook.marbomebel.ru

# Dry run:
bash /opt/claude-code/bin/setup-https.sh webhook.marbomebel.ru --dry-run
```
- Nginx reverse proxy: HTTPS → localhost:3900 (GitHub webhook) / localhost:5678 (BlueSales)
- Rate limiting: 30 req/min per IP
- Auto-renewal: certbot cron daily 3am
- SSL hardening: TLS 1.2+, HSTS

### Unit Tests
```bash
cd .claude/mcp/memory-server && npm test
```
- 40 тестов для db.js (все 6 слоёв + search + prune + fingerprint)
- Vitest (ESM-native)

## История ключевых решений

- Деплой через GitHub Actions → SSH на VPS
- N8N как движок workflow (n8n.marbomebel.ru)
- Google Sheets как хранилище данных CRM
- VK Long Poll для получения сообщений из ВК
- Telegram для уведомлений менеджеру
- BlueSales для интеграции с CRM
- OpenAI GPT-4o для AI автоответов на VK комментарии
- **JSONL + Node MCP** для системы памяти dev environment
- **tmux + systemd** для VPS runtime layer Claude Code
- **Nginx + Let's Encrypt** для HTTPS webhook endpoints
- **SQLite backup + cron pruning** для защиты memory.db
- **Vitest** для unit-тестирования memory server
