# Vector Memory Server — Setup Guide

## Текущий статус: ГОТОВО

БД `vector_memory` создана на VPS (22.03.2026):
- **User:** `n8n`
- **Password:** задан в POSTGRES_PASSWORD
- **pgvector:** v0.8.2
- **Таблица:** `embeddings` (owner: n8n)
- **Индексы:** layer, created_at

## PG_URL

```
postgresql://n8n:<POSTGRES_PASSWORD>@127.0.0.1:5432/vector_memory
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

## Пересоздание (если нужно)

```bash
docker exec n8n-postgres-1 psql -U n8n -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;"
docker exec n8n-postgres-1 psql -U n8n -c "CREATE DATABASE vector_memory TEMPLATE template0;"
docker exec n8n-postgres-1 psql -U n8n -d vector_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec n8n-postgres-1 psql -U n8n -d vector_memory -c "
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    layer TEXT NOT NULL DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_embeddings_layer ON embeddings (layer);
CREATE INDEX IF NOT EXISTS idx_embeddings_created ON embeddings (created_at);
"
```
