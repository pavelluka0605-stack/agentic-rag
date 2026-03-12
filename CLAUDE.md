# Project Knowledge Base — Agentic RAG / P0 Foundation

## Проект
CRM-система для мебельного бизнеса (marbomebel.ru). Автоматизация обработки заявок из VK, Telegram, BlueSales → Google Sheets.

## Инфраструктура

### VPS (Frankfurt)
- **Хост:** задан в секрете `VPS_HOST`
- **Пользователь:** задан в секрете `VPS_USER`
- **SSH-ключ:** секрет `VPS_SSH_KEY`
- **Сервисы на VPS:** N8N (n8n.marbomebel.ru), VK Long Poll listener, VK Callback receiver

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
| `VK_CONFIRMATION_TOKEN` | Строка подтверждения VK Callback API | ⬜ |
| `VK_SECRET_KEY` | Секретный ключ VK Callback API | ⬜ |

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
│   ├── vk-callback/       — VK Callback API receiver (продовый вариант)
│   ├── vk-longpoll/       — VK community long poll listener (legacy)
│   └── vk-user-longpoll/  — VK user long poll listener
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
- [x] VK Callback API receiver — отдельный приёмник callback с валидацией secret + confirmation

## Текущее состояние системы

- **N8N** — работает на VPS, 7 workflows (P0-01..P0-07) активированы
- **VK Callback** (community) — приёмник VK Callback API на :3102 (продовый вариант, мгновенная доставка событий)
- **VK Long Poll** (community) — legacy, слушает входящие сообщения в группу (polling каждые 25с)
- **VK User Long Poll** — слушает личные сообщения
- **BlueSales Sync** (P0-05) — автосинхронизация клиентов/заказов каждый час
- **BlueSales Webhook** (P0-06) — real-time обработка событий (endpoint: /webhook/bluesales-webhook)
- **Парсинг спроса** — VK комментарии автоматически парсятся на размеры (XS-XXL) → лист "Спрос"
- **Сводка спроса** — формулы COUNTIFS автоматически считают спрос по размерам
- **Healthcheck** — автоматически каждые 6 часов + ручной запуск
- **Google Sheets** — листы: Товары, Спрос, Заказы_поставщику, Заказы_клиентов, Сводка_спроса, Логи_N8N, BlueSales_Клиенты, BlueSales_Заказы
- **AI автоответы** (P0-07) — GPT-4o классифицирует VK комментарии: консультация / уточнение / сделка
- **Telegram** — уведомления менеджеру работают

## Возможные дальнейшие улучшения

1. ~~Автоответы клиентам VK~~ → реализовано в P0-07 (AI автоответы GPT-4o)
2. Получение имени клиента VK через VK API (users.get) при парсинге комментариев
3. Дашборд/отчёты по продажам в Telegram (еженедельная сводка)
4. Настройка webhook URL в BlueSales для P0-06 (нужен публичный URL N8N)

## История ключевых решений

- Деплой через GitHub Actions → SSH на VPS
- N8N как движок workflow (n8n.marbomebel.ru)
- Google Sheets как хранилище данных CRM
- VK Callback API (приёмник) + N8N (worker) для событий ВК
- VK Long Poll как legacy/fallback
- Telegram для уведомлений менеджеру
- BlueSales для интеграции с CRM
- OpenAI GPT-4o для AI автоответов на VK комментарии
