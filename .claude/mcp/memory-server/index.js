#!/usr/bin/env node
// =============================================================================
// MCP Memory Server — многослойная память разработки
// SQLite + FTS5 | 6 типов памяти | GitHub интеграция
// =============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import { MemoryDB } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../memory/memory.db");

const db = new MemoryDB(DB_PATH);
const server = new McpServer({ name: "memory-server", version: "2.0.0" });

// ── Утилита для JSON-ответа ──────────────────────────────────────────────────

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// =============================================================================
// 1. POLICY MEMORY — правила, ограничения, конвенции
// =============================================================================

server.tool(
  "policy_add",
  "Записать правило/ограничение/конвенцию проекта",
  {
    title: z.string().describe("Название правила"),
    content: z.string().describe("Содержание правила"),
    category: z.enum(["rule", "constraint", "convention", "limitation"]).optional(),
    project: z.string().optional(),
    source: z.string().optional().describe("Источник: CLAUDE.md, manual, learned, incident"),
  },
  async (args) => ok(db.addPolicy(args))
);

server.tool(
  "policy_list",
  "Получить активные правила проекта",
  {
    project: z.string().optional(),
    category: z.enum(["rule", "constraint", "convention", "limitation"]).optional(),
  },
  async (args) => ok(db.getPolicies({ ...args, active: true }))
);

// =============================================================================
// 2. EPISODIC MEMORY — сессии, прогресс, open loops
// =============================================================================

server.tool(
  "episode_save",
  "Сохранить итоги сессии: что сделано, где остановились, что осталось",
  {
    summary: z.string().describe("Краткое резюме сессии"),
    what_done: z.string().optional().describe("Что было сделано"),
    where_stopped: z.string().optional().describe("На чём остановились"),
    what_remains: z.string().optional().describe("Что осталось доделать"),
    open_loops: z.array(z.string()).optional().describe("Открытые задачи/вопросы"),
    project: z.string().optional(),
    branch: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
  },
  async (args) => ok(db.addEpisode(args))
);

server.tool(
  "episode_list",
  "Получить последние сессии",
  {
    project: z.string().optional(),
    limit: z.number().optional().default(5),
  },
  async (args) => ok(db.getEpisodes(args))
);

server.tool(
  "episode_open_loops",
  "Получить все открытые задачи/вопросы из прошлых сессий",
  { project: z.string().optional() },
  async (args) => ok(db.getOpenLoops(args))
);

// =============================================================================
// 3. INCIDENT MEMORY — ошибки, stack traces, fingerprints, фиксы
// =============================================================================

server.tool(
  "incident_add",
  "Записать ошибку/инцидент (автоматическая дедупликация по fingerprint)",
  {
    error_message: z.string().describe("Текст ошибки"),
    stack_trace: z.string().optional(),
    failed_command: z.string().optional(),
    context: z.string().optional().describe("Что делали, когда произошла ошибка"),
    probable_cause: z.string().optional(),
    failed_attempts: z.array(z.string()).optional().describe("Что пробовали и не сработало"),
    project: z.string().optional(),
    service: z.string().optional(),
    github_issue: z.string().optional(),
  },
  async (args) => ok(db.addIncident(args))
);

server.tool(
  "incident_fix",
  "Записать проверенное исправление для инцидента",
  {
    id: z.number().describe("ID инцидента"),
    verified_fix: z.string().describe("Что именно исправило проблему"),
    probable_cause: z.string().optional().describe("Уточнённая причина"),
  },
  async (args) => ok(db.fixIncident(args.id, args))
);

server.tool(
  "incident_find_similar",
  "Найти похожие ошибки в памяти (FTS5 BM25 ranking)",
  {
    error_message: z.string().describe("Текст ошибки для поиска похожих"),
    limit: z.number().optional().default(5),
  },
  async ({ error_message, limit }) => ok(db.findSimilarIncidents(error_message, limit))
);

server.tool(
  "incident_list",
  "Получить инциденты с фильтрами",
  {
    project: z.string().optional(),
    service: z.string().optional(),
    status: z.enum(["open", "investigating", "fixed", "wontfix", "duplicate"]).optional(),
    limit: z.number().optional().default(10),
  },
  async (args) => ok(db.getIncidents(args))
);

// =============================================================================
// 4. SOLUTION MEMORY — рабочие решения, паттерны, playbooks
// =============================================================================

server.tool(
  "solution_add",
  "Записать удачное решение/паттерн/playbook",
  {
    title: z.string().describe("Название решения"),
    description: z.string().describe("Описание: что делает, когда применять"),
    code: z.string().optional().describe("Код или сниппет"),
    commands: z.array(z.string()).optional().describe("Команды"),
    pattern_type: z.enum(["workflow", "command", "pattern", "playbook", "snippet", "config"]).optional(),
    solves_incident: z.number().optional().describe("ID инцидента, который это решает"),
    verified: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    project: z.string().optional(),
    service: z.string().optional(),
    github_pr: z.string().optional(),
  },
  async (args) => ok(db.addSolution(args))
);

server.tool(
  "solution_verify",
  "Пометить решение как проверенное",
  { id: z.number() },
  async ({ id }) => ok(db.verifySolution(id))
);

server.tool(
  "solution_use",
  "Зафиксировать использование решения (увеличивает use_count)",
  { id: z.number() },
  async ({ id }) => ok(db.useSolution(id))
);

server.tool(
  "solution_rate",
  "Оценить полезность решения (0-10)",
  {
    id: z.number(),
    score: z.number().min(0).max(10),
  },
  async ({ id, score }) => ok(db.rateSolution(id, score))
);

server.tool(
  "solution_find",
  "Найти подходящие решения по описанию проблемы (FTS5 BM25)",
  {
    query: z.string().describe("Описание проблемы или задачи"),
    limit: z.number().optional().default(5),
  },
  async ({ query, limit }) => ok(db.findSimilarSolutions(query, limit))
);

server.tool(
  "solution_list",
  "Получить решения с фильтрами",
  {
    project: z.string().optional(),
    service: z.string().optional(),
    pattern_type: z.enum(["workflow", "command", "pattern", "playbook", "snippet", "config"]).optional(),
    verified: z.boolean().optional(),
    limit: z.number().optional().default(10),
  },
  async (args) => ok(db.getSolutions(args))
);

// =============================================================================
// 5. DECISION MEMORY — архитектурные решения, компромиссы
// =============================================================================

server.tool(
  "decision_add",
  "Записать архитектурное решение: что выбрали, почему, что сознательно не делаем",
  {
    title: z.string().describe("Название решения"),
    context: z.string().describe("Контекст: зачем это решение понадобилось"),
    chosen: z.string().describe("Что выбрали"),
    alternatives: z.array(z.string()).optional().describe("Какие варианты рассматривали"),
    tradeoffs: z.string().optional().describe("Чем жертвуем"),
    not_doing: z.string().optional().describe("Что сознательно НЕ делаем"),
    revisit_trigger: z.string().optional().describe("При каких условиях пересмотреть"),
    supersedes: z.number().optional().describe("ID предыдущего решения, которое заменяем"),
    tags: z.array(z.string()).optional(),
    project: z.string().optional(),
  },
  async (args) => ok(db.addDecision(args))
);

server.tool(
  "decision_list",
  "Получить архитектурные решения",
  {
    project: z.string().optional(),
    limit: z.number().optional().default(10),
  },
  async (args) => ok(db.getDecisions(args))
);

// =============================================================================
// 6. CODE/CONTEXT MEMORY — код, инфра, доки, deployment knowledge
// =============================================================================

server.tool(
  "context_add",
  "Сохранить важный контекст: код, конфиг, deployment knowledge",
  {
    title: z.string().describe("Название"),
    content: z.string().describe("Содержимое (код, конфиг, описание)"),
    category: z.enum(["code", "infra", "docs", "deployment", "summary", "config", "api"]).optional(),
    file_path: z.string().optional(),
    language: z.string().optional(),
    tags: z.array(z.string()).optional(),
    project: z.string().optional(),
    verified: z.boolean().optional(),
  },
  async (args) => ok(db.addContext(args))
);

server.tool(
  "context_list",
  "Получить сохранённые контексты",
  {
    project: z.string().optional(),
    category: z.enum(["code", "infra", "docs", "deployment", "summary", "config", "api"]).optional(),
    limit: z.number().optional().default(10),
  },
  async (args) => ok(db.getContexts(args))
);

// =============================================================================
// CROSS-LAYER TOOLS — поиск, bootstrap, статистика
// =============================================================================

server.tool(
  "memory_search",
  "Поиск по всей памяти (FTS5 BM25 ranking) с фильтрами по типу и проекту",
  {
    query: z.string().describe("Поисковый запрос"),
    tables: z.array(z.enum(["incidents", "solutions", "decisions", "contexts", "policies", "episodes"])).optional()
      .describe("В каких слоях искать (по умолчанию — все)"),
    project: z.string().optional(),
    limit: z.number().optional().default(10),
  },
  async (args) => ok(db.search(args.query, args))
);

server.tool(
  "memory_bootstrap",
  "Загрузить контекст для старта сессии: policies, последние сессии, open incidents, top solutions, решения, open loops",
  { project: z.string().optional() },
  async ({ project }) => ok(db.getBootstrapContext(project))
);

server.tool(
  "memory_stats",
  "Статистика по всем слоям памяти",
  {},
  async () => ok(db.getStats())
);

// =============================================================================
// RESOURCES
// =============================================================================

server.resource(
  "memory-stats",
  "memory://stats",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(db.getStats(), null, 2),
    }],
  })
);

// =============================================================================
// START
// =============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
