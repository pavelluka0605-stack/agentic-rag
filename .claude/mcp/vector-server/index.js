#!/usr/bin/env node
// =============================================================================
// MCP Vector Server — семантический поиск через pgvector + OpenAI embeddings
// =============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VectorDB } from "./db.js";

const PG_URL = process.env.PG_URL || "postgresql://n8n@127.0.0.1:5432/vector_memory";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required");
  process.exit(1);
}

const db = new VectorDB({ pgUrl: PG_URL, openaiKey: OPENAI_API_KEY });
const server = new McpServer({ name: "vector-server", version: "1.0.0" });

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// ── vector_store — сохранить текст с embedding ──────────────────────────────

server.tool(
  "vector_store",
  "Сохранить текст в векторную память (автоматически генерирует embedding)",
  {
    content: z.string().describe("Текст для сохранения"),
    layer: z.enum(["policy", "episodic", "incident", "solution", "decision", "context", "general"])
      .describe("Слой памяти"),
    metadata: z.record(z.any()).optional().describe("Произвольные метаданные (JSON)"),
  },
  async (args) => {
    try {
      return ok(await db.store(args));
    } catch (e) {
      return ok({ error: e.message });
    }
  }
);

// ── vector_search — семантический поиск ─────────────────────────────────────

server.tool(
  "vector_search",
  "Семантический поиск по векторной памяти (cosine similarity)",
  {
    query: z.string().describe("Поисковый запрос (будет преобразован в embedding)"),
    limit: z.number().optional().default(5).describe("Количество результатов (по умолчанию 5)"),
    layer: z.enum(["policy", "episodic", "incident", "solution", "decision", "context", "general"])
      .optional().describe("Фильтр по слою памяти"),
    threshold: z.number().optional().default(0.3).describe("Минимальный порог similarity (0-1)"),
  },
  async (args) => {
    try {
      return ok(await db.search(args));
    } catch (e) {
      return ok({ error: e.message });
    }
  }
);

// ── vector_delete — удалить запись ──────────────────────────────────────────

server.tool(
  "vector_delete",
  "Удалить запись из векторной памяти по ID",
  {
    id: z.number().describe("ID записи для удаления"),
  },
  async ({ id }) => {
    try {
      const result = await db.remove(id);
      return ok(result ? { deleted: id } : { error: "not found" });
    } catch (e) {
      return ok({ error: e.message });
    }
  }
);

// ── vector_stats — статистика ───────────────────────────────────────────────

server.tool(
  "vector_stats",
  "Статистика векторной памяти (количество записей по слоям)",
  {},
  async () => {
    try {
      return ok(await db.stats());
    } catch (e) {
      return ok({ error: e.message });
    }
  }
);

// ── vector_health — проверка подключения ────────────────────────────────────

server.tool(
  "vector_health",
  "Проверить подключение к PostgreSQL и статус pgvector",
  {},
  async () => {
    try {
      return ok(await db.health());
    } catch (e) {
      return ok({ error: e.message });
    }
  }
);

// ── Запуск ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
