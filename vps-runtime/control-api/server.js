#!/usr/bin/env node
// =============================================================================
// Claude Code Control API — lightweight HTTP server for Remote Control
//
// Provides REST endpoints for monitoring and controlling Claude Code runtime.
// Designed to run behind nginx (HTTPS termination).
//
// Endpoints:
//   GET  /api/status     — runtime status (tmux, systemd, resources)
//   GET  /api/logs       — recent session logs (?lines=50&window=workspace)
//   GET  /api/memory     — memory DB stats
//   POST /api/start      — start runtime
//   POST /api/stop       — stop runtime
//   POST /api/restart    — restart runtime
//   GET  /health         — simple health check
//
// Security: Bearer token auth via CONTROL_API_TOKEN env var
// =============================================================================

import http from "http";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";

const PORT = parseInt(process.env.CONTROL_API_PORT || "3901");
const TOKEN = process.env.CONTROL_API_TOKEN || "";
const BIN_DIR = process.env.CLAUDE_BIN_DIR || "/opt/claude-code/bin";
const LOG_DIR = process.env.CLAUDE_LOG_DIR || "/opt/claude-code/logs";
const MEMORY_DB = process.env.MEMORY_DB_PATH || "/opt/claude-code/memory/memory.db";

// ── Auth middleware ─────────────────────────────────────────────────────────

function authenticate(req) {
  if (!TOKEN) return true; // No token = no auth (dev mode)
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${TOKEN}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd, timeout = 5000) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout }).trim();
  } catch (e) {
    return null;
  }
}

function runAsync(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 15000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

// ── Route handlers ──────────────────────────────────────────────────────────

async function handleStatus(req, res) {
  const session = process.env.CLAUDE_TMUX_SESSION || "claude-code";

  // tmux status
  const tmuxRunning = run(`tmux has-session -t "${session}" 2>/dev/null && echo yes`) === "yes";
  const tmuxWindows = tmuxRunning
    ? run(`tmux list-windows -t "${session}" -F '#{window_name}:#{window_active}' 2>/dev/null`)?.split("\n") || []
    : [];

  // systemd
  const serviceActive = run("systemctl is-active claude-code.service 2>/dev/null") || "unknown";
  const webhookActive = run("systemctl is-active github-webhook.service 2>/dev/null") || "unknown";

  // Resources
  const diskPct = run("df /opt 2>/dev/null | tail -1 | awk '{print $5}'") || "?";
  const memInfo = run("free -m 2>/dev/null | awk 'NR==2 {printf \"%d/%dMB\", $3, $2}'") || "?";
  const uptime = run("uptime -p 2>/dev/null") || "?";
  const loadAvg = run("cat /proc/loadavg 2>/dev/null | cut -d' ' -f1-3") || "?";

  // Claude version
  const claudeVer = run("claude --version 2>/dev/null") || "not installed";

  // Today's log size
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const logFile = path.join(LOG_DIR, `session-${today}.log`);
  let logLines = 0;
  try { logLines = run(`wc -l < "${logFile}" 2>/dev/null`); } catch {}

  json(res, 200, {
    status: tmuxRunning ? "running" : "stopped",
    tmux: { running: tmuxRunning, session, windows: tmuxWindows },
    services: { "claude-code": serviceActive, "github-webhook": webhookActive },
    resources: { disk: diskPct, memory: memInfo, uptime, load: loadAvg },
    claude: { version: claudeVer },
    logs: { today: `${logLines || 0} lines` },
    timestamp: new Date().toISOString(),
  });
}

async function handleLogs(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const lines = Math.min(parseInt(url.searchParams.get("lines") || "50"), 500);

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const logFile = path.join(LOG_DIR, `session-${today}.log`);

  if (!fs.existsSync(logFile)) {
    return json(res, 200, { lines: [], message: "No log file for today" });
  }

  const content = run(`tail -n ${lines} "${logFile}" 2>/dev/null`) || "";
  json(res, 200, {
    file: path.basename(logFile),
    count: content.split("\n").length,
    lines: content.split("\n"),
  });
}

async function handleMemory(req, res) {
  if (!fs.existsSync(MEMORY_DB)) {
    return json(res, 200, { status: "not_initialized", message: "memory.db not found" });
  }

  const stats = {};
  for (const table of ["policies", "episodes", "incidents", "solutions", "decisions", "contexts", "github_events"]) {
    stats[table] = parseInt(run(`sqlite3 "${MEMORY_DB}" "SELECT COUNT(*) FROM ${table};" 2>/dev/null`) || "0");
  }
  stats.open_incidents = parseInt(run(`sqlite3 "${MEMORY_DB}" "SELECT COUNT(*) FROM incidents WHERE status='open';" 2>/dev/null`) || "0");
  stats.verified_solutions = parseInt(run(`sqlite3 "${MEMORY_DB}" "SELECT COUNT(*) FROM solutions WHERE verified=1;" 2>/dev/null`) || "0");

  const dbSize = run(`du -h "${MEMORY_DB}" 2>/dev/null | cut -f1`) || "?";

  json(res, 200, { status: "ok", size: dbSize, stats });
}

async function handleAction(action, req, res) {
  const script = path.join(BIN_DIR, `${action}.sh`);
  if (!fs.existsSync(script)) {
    return json(res, 404, { error: `Script not found: ${action}.sh` });
  }

  try {
    const output = await runAsync(`bash "${script}" 2>&1`);
    json(res, 200, { action, success: true, output });
  } catch (e) {
    json(res, 500, { action, success: false, error: e.message });
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // Health (no auth)
  if (req.url === "/health") {
    return json(res, 200, { status: "ok", timestamp: new Date().toISOString() });
  }

  // Auth check for all /api/ routes
  if (req.url.startsWith("/api/") && !authenticate(req)) {
    return json(res, 401, { error: "Unauthorized. Set Authorization: Bearer <token>" });
  }

  try {
    const urlPath = req.url.split("?")[0];

    if (req.method === "GET" && urlPath === "/api/status") return handleStatus(req, res);
    if (req.method === "GET" && urlPath === "/api/logs") return handleLogs(req, res);
    if (req.method === "GET" && urlPath === "/api/memory") return handleMemory(req, res);
    if (req.method === "POST" && urlPath === "/api/start") return handleAction("start", req, res);
    if (req.method === "POST" && urlPath === "/api/stop") return handleAction("stop", req, res);
    if (req.method === "POST" && urlPath === "/api/restart") return handleAction("restart", req, res);

    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[control-api] Listening on 127.0.0.1:${PORT}`);
  console.log(`[control-api] Auth: ${TOKEN ? "enabled" : "disabled (set CONTROL_API_TOKEN)"}`);
});
