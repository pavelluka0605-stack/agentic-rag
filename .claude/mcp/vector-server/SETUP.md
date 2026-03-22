# Vector Memory Server — Setup Guide

## 1. Определить пользователя PostgreSQL на VPS

```bash
# SSH на VPS, затем:
docker exec n8n-postgres-1 env | grep POSTGRES
# Или посмотреть в compose:
cat /opt/n8n/docker-compose.yml | grep -A10 postgres
# Или найти пользователя из pg_roles:
docker exec n8n-postgres-1 psql -U $(docker exec n8n-postgres-1 env | grep POSTGRES_USER | cut -d= -f2) -c '\du'
```

## 2. Создать БД и таблицу

Заменить `PGUSER` на найденного пользователя:

```bash
PGUSER=root  # или postgres, n8n, etc.

# Создать БД
docker exec n8n-postgres-1 psql -U $PGUSER -c 'CREATE DATABASE vector_memory;'

# Включить pgvector
docker exec n8n-postgres-1 psql -U $PGUSER -d vector_memory -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Создать таблицу
docker exec n8n-postgres-1 psql -U $PGUSER -d vector_memory -c '
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    layer TEXT NOT NULL DEFAULT '\''general'\'',
    metadata JSONB DEFAULT '\''{}'\'' ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_embeddings_cosine ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_embeddings_layer ON embeddings (layer);
CREATE INDEX IF NOT EXISTS idx_embeddings_created ON embeddings (created_at);
'

# Проверить
docker exec n8n-postgres-1 psql -U $PGUSER -d vector_memory -c '\dt'
docker exec n8n-postgres-1 psql -U $PGUSER -d vector_memory -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
```

## 3. Установить зависимости

```bash
cd .claude/mcp/vector-server
npm install
```

## 4. Настроить переменные окружения

Задать в среде Claude Code (или в .claude/settings.json env):

```bash
export PG_URL="postgresql://PGUSER:PASSWORD@127.0.0.1:5432/vector_memory"
export OPENAI_API_KEY="sk-..."
```

Или через VPS /home/rag/.env:
```
PG_URL=postgresql://PGUSER:PASSWORD@127.0.0.1:5432/vector_memory
OPENAI_API_KEY=sk-...
```

## 5. Проверить работу

```bash
# Проверка подключения:
PG_URL="postgresql://..." OPENAI_API_KEY="sk-..." node -e "
import { VectorDB } from './db.js';
const db = new VectorDB({ pgUrl: process.env.PG_URL, openaiKey: process.env.OPENAI_API_KEY });
console.log(await db.health());
await db.close();
"
```

## MCP Tools

| Tool | Описание |
|------|----------|
| `vector_store` | Сохранить текст + автоматический embedding |
| `vector_search` | Семантический поиск (cosine similarity) |
| `vector_delete` | Удалить запись по ID |
| `vector_stats` | Статистика по слоям |
| `vector_health` | Проверка подключения к PostgreSQL + pgvector |

## Архитектура

```
Claude Code
  ├── MCP "memory"  → SQLite + FTS5 (ключевые слова, 22 tools)
  └── MCP "vector"  → pgvector + OpenAI embeddings (семантика, 5 tools)
                         ↓
                  n8n-postgres-1:5432
                  БД: vector_memory
                  Модель: text-embedding-3-small (1536 dim)
```
