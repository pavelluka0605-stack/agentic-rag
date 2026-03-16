#!/usr/bin/env node
// =============================================================================
// GitHub Webhook Receiver → Memory Layer
// HTTP сервер, принимает webhook-и от GitHub и записывает в SQLite память
//
// Запуск: node server.js
// Порт: WEBHOOK_PORT (default 3900)
// Секрет: GITHUB_WEBHOOK_SECRET (для проверки подписи)
// =============================================================================

import http from "http";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// Импортируем DB и GitHub bridge из MCP-сервера
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpDir = path.resolve(__dirname, "../../.claude/mcp/memory-server");

// Динамический импорт (пути могут отличаться на VPS vs в репо)
let MemoryDB, GitHubMemoryBridge;
try {
  ({ MemoryDB } = await import(path.join(mcpDir, "db.js")));
  ({ GitHubMemoryBridge } = await import(path.join(mcpDir, "github.js")));
} catch (e) {
  // На VPS путь может быть другой
  const altMcpDir = "/opt/claude-code/memory-server";
  ({ MemoryDB } = await import(path.join(altMcpDir, "db.js")));
  ({ GitHubMemoryBridge } = await import(path.join(altMcpDir, "github.js")));
}

const PORT = parseInt(process.env.WEBHOOK_PORT || "3900");
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const DB_PATH = process.env.MEMORY_DB_PATH || path.resolve(__dirname, "../../.claude/memory/memory.db");

const db = new MemoryDB(DB_PATH);
const bridge = new GitHubMemoryBridge(db);

// ── Проверка подписи GitHub ──────────────────────────────────────────────────

function verifySignature(payload, signature) {
  if (!SECRET) return true; // Без секрета — пропускаем проверку (dev mode)
  if (!signature) return false;

  const sig = Buffer.from(signature);
  const hmac = crypto.createHmac("sha256", SECRET);
  const digest = Buffer.from("sha256=" + hmac.update(payload).digest("hex"));

  return sig.length === digest.length && crypto.timingSafeEqual(digest, sig);
}

// ── HTTP сервер ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    const stats = db.getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", ...stats }));
    return;
  }

  // Webhook endpoint
  if (req.method === "POST" && req.url === "/webhook/github") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        // Проверяем подпись
        const signature = req.headers["x-hub-signature-256"];
        if (!verifySignature(body, signature)) {
          console.error(`[${new Date().toISOString()}] Invalid signature`);
          res.writeHead(401);
          res.end("Invalid signature");
          return;
        }

        const event_type = req.headers["x-github-event"];
        const payload = JSON.parse(body);

        console.log(`[${new Date().toISOString()}] ${event_type}: ${payload.action || "n/a"} @ ${payload.repository?.full_name || "?"}`);

        const result = bridge.processEvent(event_type, payload);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ processed: true, event_type, result }));
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error:`, err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Статистика
  if (req.method === "GET" && req.url === "/stats") {
    const stats = db.getStats();
    const recent = db.getGithubEvents({ limit: 10 });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ stats, recent_events: recent }, null, 2));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] GitHub Webhook Receiver listening on :${PORT}`);
  console.log(`  Webhook URL: http://localhost:${PORT}/webhook/github`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Stats: http://localhost:${PORT}/stats`);
  console.log(`  DB: ${DB_PATH}`);
  console.log(`  Secret: ${SECRET ? "configured" : "NOT SET (dev mode)"}`);
});
