# Project Knowledge Base — Agentic RAG / P0 Foundation

## Проект
CRM-система для мебельного бизнеса (marbomebel.ru). Автоматизация обработки заявок из VK, Telegram, BlueSales → Google Sheets.

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
└── CLAUDE.md              — ЭТА БАЗА ЗНАНИЙ
```

## Листы Google Sheets

Актуальный список листов — проверять через API (см. код выше).

## GitHub Token

- **Тип:** Classic (Personal Access Token)
- **Scopes:** `repo`, `workflow`
- **Примечание:** Fine-grained токены НЕ поддерживают scope `workflow` для пуша workflow-файлов

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

## Оставшиеся задачи (по порядку)

1. **Уточнить BLUESALES_REMOTE_URL** — нужен реальный URL или убрать секрет?
2. **Проверить готовность VPS** — запустить healthcheck.yml
3. **Запустить полный деплой** — deploy-p0.yml (N8N + VK Long Poll + workflows)
4. **Настроить N8N workflows** — импортировать P0-01..P0-04
5. **Настроить BlueSales ↔ Google Sheets синхронизацию**
6. **Протестировать полную цепочку** — VK → N8N → Sheets → Telegram уведомление

## Что нужно от владельца для автономной работы

- [ ] Подтвердить готовность VPS (Ubuntu, Node.js установлен?)
- [ ] Подтвердить что VK Long Poll API включён в настройках сообщества
- [ ] Уточнить статус N8N на VPS (установлен или ставить с нуля?)
- [ ] Уточнить BLUESALES_REMOTE_URL (реальный URL или не нужен?)

## История ключевых решений

- Деплой через GitHub Actions → SSH на VPS
- N8N как движок workflow (n8n.marbomebel.ru)
- Google Sheets как хранилище данных CRM
- VK Long Poll для получения сообщений из ВК
- Telegram для уведомлений менеджеру
- BlueSales для интеграции с CRM
