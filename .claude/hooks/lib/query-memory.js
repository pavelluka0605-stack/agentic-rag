#!/usr/bin/env node
// =============================================================================
// query-memory.js — CLI утилита для запросов к памяти из shell hooks
//
// Использование:
//   node query-memory.js bootstrap [project]
//   node query-memory.js search <query> [project]
//   node query-memory.js similar-incidents <error_message>
//   node query-memory.js similar-solutions <query>
//   node query-memory.js add-incident <json>
//   node query-memory.js fix-incident <id> <json>
//   node query-memory.js save-episode <json>
//   node query-memory.js open-incidents [project]
//   node query-memory.js stats
//   node query-memory.js policies [project]
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
  console.error(`[memory] DB not available: ${e.message}`);
  process.exit(1); // Сообщаем hook что память недоступна
}

const [,, command, ...args] = process.argv;

function out(data) {
  console.log(JSON.stringify(data, null, 2));
}

function compact(data) {
  // Компактный вывод для hook feedback — только важные поля
  if (Array.isArray(data)) {
    return data.map(compact);
  }
  if (data && typeof data === "object") {
    const { id, title, error_message, summary, status, verified_fix, probable_cause,
            category, content, chosen, pattern_type, usefulness_score, occurrence_count,
            verified, use_count, created_at, open_loops, what_remains } = data;
    const result = {};
    if (id) result.id = id;
    if (title) result.title = title;
    if (error_message) result.error = error_message;
    if (summary) result.summary = summary;
    if (status) result.status = status;
    if (verified_fix) result.fix = verified_fix;
    if (probable_cause) result.cause = probable_cause;
    if (category) result.cat = category;
    if (content) result.content = content.slice(0, 200);
    if (chosen) result.chosen = chosen;
    if (pattern_type) result.type = pattern_type;
    if (usefulness_score) result.score = usefulness_score;
    if (occurrence_count > 1) result.occurrences = occurrence_count;
    if (verified) result.verified = true;
    if (use_count > 0) result.uses = use_count;
    if (open_loops) result.open_loops = open_loops;
    if (what_remains) result.remains = what_remains;
    if (created_at) result.date = created_at.slice(0, 10);
    return result;
  }
  return data;
}

try {
  switch (command) {
    case "bootstrap": {
      const project = args[0] || undefined;
      const ctx = db.getBootstrapContext(project);
      // Компактный вывод для hook feedback
      const summary = {};
      if (ctx.policies?.length) summary.policies = compact(ctx.policies);
      if (ctx.open_incidents?.length) summary.open_incidents = compact(ctx.open_incidents);
      if (ctx.top_solutions?.length) summary.top_solutions = compact(ctx.top_solutions);
      if (ctx.recent_decisions?.length) summary.recent_decisions = compact(ctx.recent_decisions);
      if (ctx.recent_sessions?.length) summary.recent_sessions = compact(ctx.recent_sessions);
      if (ctx.open_loops?.length) {
        summary.open_loops = ctx.open_loops.map(e => ({
          loops: e.open_loops,
          date: e.created_at?.slice(0, 10),
        }));
      }
      summary.stats = ctx.stats;
      out(summary);
      break;
    }

    case "search": {
      const query = args[0];
      const project = args[1] || undefined;
      if (!query) { console.error("Usage: search <query>"); process.exit(1); }
      out(compact(db.search(query, { project, limit: 5 })));
      break;
    }

    case "similar-incidents": {
      const msg = args[0];
      if (!msg) { console.error("Usage: similar-incidents <error_message>"); process.exit(1); }
      const results = db.findSimilarIncidents(msg, 5);
      out(compact(results));
      break;
    }

    case "similar-solutions": {
      const query = args[0];
      if (!query) { console.error("Usage: similar-solutions <query>"); process.exit(1); }
      out(compact(db.findSimilarSolutions(query, 5)));
      break;
    }

    case "add-incident": {
      const data = JSON.parse(args[0]);
      out(db.addIncident(data));
      break;
    }

    case "fix-incident": {
      const id = parseInt(args[0]);
      const data = JSON.parse(args[1]);
      out(db.fixIncident(id, data));
      break;
    }

    case "save-episode": {
      const data = JSON.parse(args[0]);
      out(db.addEpisode(data));
      break;
    }

    case "open-incidents": {
      const project = args[0] || undefined;
      out(compact(db.getIncidents({ project, status: "open", limit: 10 })));
      break;
    }

    case "policies": {
      const project = args[0] || undefined;
      out(compact(db.getPolicies({ project, active: true })));
      break;
    }

    case "stats":
      out(db.getStats());
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Commands: bootstrap, search, similar-incidents, similar-solutions, add-incident, fix-incident, save-episode, open-incidents, policies, stats");
      process.exit(1);
  }
} catch (e) {
  console.error(`[memory] Error: ${e.message}`);
  process.exit(0); // Не блокируем hook
}

db.close();
