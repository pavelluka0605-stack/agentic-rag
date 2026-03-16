# Subagent Prompt Templates

## Когда какой subagent вызывать

### 1. architect (Plan, opus, read-only)

```
Проанализируй архитектурные варианты для: <ЗАДАЧА>

Контекст проекта:
- CRM-система для мебельного бизнеса
- VPS (Frankfurt), N8N, Google Sheets, VK, Telegram, BlueSales
- SQLite+FTS5 для dev memory
- Claude Code hooks для self-diagnostics

Сравни варианты по критериям:
1. Простота реализации
2. Расширяемость
3. Надёжность
4. Скорость
5. Обслуживаемость

Выдай:
- Таблицу сравнения
- Рекомендацию с обоснованием
- Что сознательно НЕ делаем
- При каких условиях пересмотреть решение
```

### 2. repo-explorer (Explore, sonnet, read-only)

```
Исследуй кодовую базу для задачи: <ЗАДАЧА>

Нужно найти:
1. Все файлы, связанные с <ТЕМА>
2. Как они взаимодействуют
3. Какие зависимости есть
4. Где потенциальные проблемы

Уровень глубины: <quick|medium|very thorough>

НЕ делай изменений. Только исследуй и отчитайся.
```

### 3. memory-engineer (general-purpose, sonnet, read-write)

```
Работай с системой памяти проекта.

Расположение:
- DB: .claude/memory/memory.db (SQLite + FTS5)
- Schema: .claude/mcp/memory-server/migrations/001-init.sql
- API: .claude/mcp/memory-server/db.js
- MCP Server: .claude/mcp/memory-server/index.js

Задача: <ЗАДАЧА>

Доступные MCP tools: policy_add/list, episode_save/list/open_loops,
incident_add/fix/find_similar/list/update_status, solution_add/verify/use/rate/find/list/update,
decision_add/list, context_add/list, memory_search/bootstrap/stats,
memory_delete, memory_prune, policy_update
```

### 4. incident-analyst (general-purpose, sonnet, read-only)

```
Проанализируй инцидент:

Ошибка: <ERROR_MESSAGE>
Команда: <FAILED_COMMAND>
Контекст: <ЧТО ДЕЛАЛИ>
Stack trace: <ЕСЛИ ЕСТЬ>

Определи:
1. Класс ошибки (permissions, missing_resource, network, syntax, resources, dependency, timeout, duplicate, auth, import, disk, unknown)
2. Root cause
3. Есть ли похожие инциденты в памяти (используй incident_find_similar)
4. Связь с конкретным файлом/сервисом
5. Рекомендуемый подход к исправлению
6. Что НЕ делать (failed approaches)

НЕ применяй fix сам. Только анализ.
```

### 5. repair-agent (general-purpose, opus, read-write, worktree)

```
Исправь проблему безопасным способом.

Инцидент: <ОПИСАНИЕ>
Root cause: <ПРИЧИНА>
Рекомендуемый fix: <ИЗ ANALYST>

ПРАВИЛА:
1. Применяй fix только в worktree (изоляция)
2. После fix — обязательно проверь (node --check, bash -n, npm test, etc.)
3. Если fix не работает — откати и запиши в failed_attempts
4. Если fix вызвал регрессию — откати и помети решение как неудачное
5. Если fix успешен — вызови incident_fix и solution_add
6. НЕ делай вид что проблема решена если это не так
```

### 6. qa-verifier (general-purpose, haiku, read-only)

```
Проведи проверку качества:

Что проверить:
1. Синтаксис всех изменённых файлов (node --check, bash -n, python3 -m py_compile)
2. Lint (если есть: npm run lint, eslint, flake8)
3. Тесты (если есть: npm test, pytest)
4. Build (если есть: npm run build)
5. Smoke check: основные команды работают

Файлы для проверки: <СПИСОК>

Выдай:
- ✅ что прошло
- ❌ что упало (с ошибками)
- ⚠ что подозрительно
- Можно ли считать задачу завершённой: YES/NO
```

### 7. github-operator (general-purpose, sonnet, read-write)

```
Выполни GitHub операцию:

Задача: <ЗАДАЧА>

Используй gh CLI для всех операций.
Доступные секреты: VPS_HOST, VPS_USER, VPS_SSH_KEY, и другие (см. CLAUDE.md).

ПРАВИЛА:
- Не создавай PR без явного запроса
- Не мержь без подтверждения
- Проверяй статус CI перед push
- При ошибках auth — проверь gh auth status
```

### 8. docs-writer (general-purpose, sonnet, read-write)

```
Напиши/обнови документацию:

Задача: <ЗАДАЧА>

Контекст:
- CLAUDE.md — база знаний проекта (обновляй при значимых изменениях)
- STATE.md — текущее состояние (обновляй после каждой задачи)
- HANDOFF.md — инструкции для передачи

ПРАВИЛА:
- Пиши на русском
- Не удаляй существующие записи в CLAUDE.md и STATE.md
- Добавляй в конец или обновляй конкретные секции
- Используй markdown таблицы где уместно
- Будь конкретным: путь к файлу, команда, пример
```

## Параллельное выполнение

Можно запускать параллельно:
- repo-explorer + architect (исследование + анализ)
- qa-verifier + repo-explorer (проверка + поиск)
- incident-analyst + repo-explorer (анализ ошибки + поиск контекста)
- docs-writer + qa-verifier (документация + проверка)

Только последовательно:
- incident-analyst → repair-agent → qa-verifier (анализ → фикс → проверка)
- architect → memory-engineer (решение → реализация)
- repair-agent → qa-verifier (фикс → подтверждение)
