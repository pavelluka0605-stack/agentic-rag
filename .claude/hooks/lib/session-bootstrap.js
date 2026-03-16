#!/usr/bin/env node
// =============================================================================
// session-bootstrap.js — загрузка контекста из памяти при старте сессии
//
// Вызывается один раз при первом PreToolUse вызове.
// Stdout → feedback для Claude (контекст для работы)
// =============================================================================

import path from "path";
import { fileURLToPath } from "url";
import { MemoryDB } from "../../mcp/memory-server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../memory/memory.db");

let db;
try {
  db = new MemoryDB(DB_PATH);
} catch (e) {
  console.log("📦 Память пока не инициализирована. Первая сессия — создай записи через MCP tools.");
  process.exit(0);
}

const project = process.argv[2] || undefined;
const lines = [];

lines.push("╔══════════════════════════════════════════════════════════╗");
lines.push("║        SESSION BOOTSTRAP — Контекст из памяти           ║");
lines.push("╚══════════════════════════════════════════════════════════╝");
lines.push("");

// ── 1. Активные правила ──────────────────────────────────────────────────────

const policies = db.getPolicies({ project, active: true });
if (policies.length > 0) {
  lines.push(`📜 Активные правила (${policies.length}):`);
  for (const p of policies.slice(0, 10)) {
    lines.push(`   [${p.category}] ${p.title}`);
    if (p.content) lines.push(`   → ${p.content.slice(0, 150)}`);
  }
  lines.push("");
}

// ── 2. Последние сессии ──────────────────────────────────────────────────────

const episodes = db.getEpisodes({ project, limit: 3 });
if (episodes.length > 0) {
  lines.push(`📝 Последние сессии (${episodes.length}):`);
  for (const ep of episodes) {
    const date = ep.created_at?.slice(0, 16) || "?";
    lines.push(`   [${date}] ${ep.summary?.slice(0, 120) || "без описания"}`);
    if (ep.where_stopped) lines.push(`   ⏸ Остановились: ${ep.where_stopped.slice(0, 120)}`);
    if (ep.what_remains) lines.push(`   📋 Осталось: ${ep.what_remains.slice(0, 120)}`);
  }
  lines.push("");
}

// ── 3. Open loops ────────────────────────────────────────────────────────────

const openLoops = db.getOpenLoops({ project });
if (openLoops.length > 0) {
  lines.push("🔄 Открытые задачи/вопросы:");
  for (const ep of openLoops.slice(0, 5)) {
    try {
      const loops = JSON.parse(ep.open_loops);
      if (Array.isArray(loops)) {
        for (const l of loops) lines.push(`   • ${l}`);
      }
    } catch {}
  }
  lines.push("");
}

// ── 4. Открытые инциденты ────────────────────────────────────────────────────

const openIncidents = db.getIncidents({ project, status: "open", limit: 5 });
const investigatingIncidents = db.getIncidents({ project, status: "investigating", limit: 3 });
const allOpen = [...openIncidents, ...investigatingIncidents];

if (allOpen.length > 0) {
  lines.push(`🔴 Открытые инциденты (${allOpen.length}):`);
  for (const inc of allOpen) {
    const occ = inc.occurrence_count > 1 ? ` (×${inc.occurrence_count})` : "";
    lines.push(`   #${inc.id} [${inc.status}] ${inc.error_message?.slice(0, 100)}${occ}`);
    if (inc.probable_cause) lines.push(`   Причина: ${inc.probable_cause.slice(0, 100)}`);
    if (inc.verified_fix) lines.push(`   ✅ Fix: ${inc.verified_fix.slice(0, 100)}`);
  }
  lines.push("");
}

// ── 5. Top verified solutions ────────────────────────────────────────────────

const solutions = db.getSolutions({ project, verified: true, limit: 5 });
if (solutions.length > 0) {
  lines.push(`💡 Проверенные решения (${solutions.length}):`);
  for (const sol of solutions) {
    const uses = sol.use_count > 0 ? ` (${sol.use_count} использований)` : "";
    lines.push(`   #${sol.id} [${sol.pattern_type}] ${sol.title}${uses}`);
  }
  lines.push("");
}

// ── 6. Недавние решения ──────────────────────────────────────────────────────

const decisions = db.getDecisions({ project, limit: 3 });
if (decisions.length > 0) {
  lines.push(`🏗 Недавние архитектурные решения (${decisions.length}):`);
  for (const d of decisions) {
    lines.push(`   ${d.title}: ${d.chosen?.slice(0, 100)}`);
    if (d.not_doing) lines.push(`   ⛔ Не делаем: ${d.not_doing.slice(0, 100)}`);
  }
  lines.push("");
}

// ── 7. Known constraints ─────────────────────────────────────────────────────

const constraints = db.getPolicies({ project, category: "constraint" });
const limitations = db.getPolicies({ project, category: "limitation" });
const allConstraints = [...constraints, ...limitations];
if (allConstraints.length > 0) {
  lines.push("⚠ Известные ограничения:");
  for (const c of allConstraints.slice(0, 5)) {
    lines.push(`   • ${c.title}: ${c.content?.slice(0, 120)}`);
  }
  lines.push("");
}

// ── 8. Статистика ────────────────────────────────────────────────────────────

const stats = db.getStats();
lines.push("📊 Память:");
lines.push(`   Правила: ${stats.policies} | Сессии: ${stats.episodes} | Инциденты: ${stats.incidents} (открытых: ${stats.open_incidents})`);
lines.push(`   Решения: ${stats.solutions} (проверенных: ${stats.verified_solutions}) | Решения арх: ${stats.decisions} | Контексты: ${stats.contexts}`);
lines.push("");

// ── 9. Рекомендации ──────────────────────────────────────────────────────────

if (allOpen.length > 0) {
  lines.push("📌 Рекомендация: есть открытые инциденты — проверь, не связаны ли они с текущей задачей.");
}
if (openLoops.length > 0) {
  lines.push("📌 Рекомендация: есть незакрытые задачи из прошлых сессий — рассмотри их приоритетность.");
}

lines.push("");
lines.push("Используй MCP tools (memory_search, solution_find, incident_find_similar) для поиска в памяти.");

console.log(lines.join("\n"));
db.close();
