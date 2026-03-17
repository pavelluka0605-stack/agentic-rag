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
//   Task Pipeline (intake → confirm → execute):
//   POST /api/tasks              — create task from Russian text/voice
//   GET  /api/tasks              — list tasks (?status=&limit=&offset=)
//   GET  /api/tasks/:id          — get task by id
//   POST /api/tasks/:id/interpret — generate Russian interpretation (1 LLM call)
//   POST /api/tasks/:id/revise   — add text revision (deterministic, no LLM)
//   POST /api/tasks/:id/confirm  — confirm + build eng packet (1 LLM call)
//   POST /api/tasks/:id/cancel   — cancel task
//   POST /api/tasks/:id/progress — add progress update (Russian)
//   POST /api/tasks/:id/complete — mark done with Russian result
//   POST /api/tasks/:id/fail     — mark failed
//
// Security: Bearer token auth via CONTROL_API_TOKEN env var
// =============================================================================

import http from "http";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.CONTROL_API_PORT || "3901");
const TOKEN = process.env.CONTROL_API_TOKEN || "";
const BIN_DIR = process.env.CLAUDE_BIN_DIR || "/opt/claude-code/bin";
const LOG_DIR = process.env.CLAUDE_LOG_DIR || "/opt/claude-code/logs";
const MEMORY_DB = process.env.MEMORY_DB_PATH || "/opt/claude-code/memory/memory.db";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

// ── Database (lazy init at startup) ──────────────────────────────────────

let taskDb = null;
async function initTaskDb() {
  const memoryServerPath = process.env.MEMORY_SERVER_PATH
    || path.join(__dirname, "..", "..", ".claude", "mcp", "memory-server");
  try {
    const mod = await import(path.join(memoryServerPath, "db.js"));
    taskDb = new mod.MemoryDB(MEMORY_DB);
    console.log("[control-api] Task DB initialized from", MEMORY_DB);
  } catch (e) {
    console.warn("[control-api] Task DB not available:", e.message);
  }
}

// ── LLM helper (single-call, cost-conscious) ─────────────────────────────

async function llmCall(systemPrompt, userMessage) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",     // Cost-conscious: mini for interpretation
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// ── Telegram helper ────────────────────────────────────────────────────────

async function sendTelegram(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("[telegram] Send failed:", e.message);
  }
}

// ── Request body parser ──────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

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

// ── Whisper STT helper ────────────────────────────────────────────────────

async function whisperTranscribe(audioBase64) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  // Decode base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // Build multipart/form-data manually (no external deps)
  const boundary = "----WhisperBoundary" + Date.now();
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
  const modelPart = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`;
  const langPart = `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nru\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(header),
    audioBuffer,
    Buffer.from(modelPart),
    Buffer.from(langPart),
  ]);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  return data.text;
}

// ── Task Pipeline Handlers ──────────────────────────────────────────────────

const INTERPRET_SYSTEM_PROMPT = `Ты — ассистент-интерпретатор задач. Пользователь описал задачу на русском языке.
Верни JSON со следующими полями (все на русском):
{
  "understood": "Как ты понял задачу (1-2 предложения)",
  "expected_outcome": "Ожидаемый результат",
  "affected_areas": ["Список затрагиваемых областей/файлов/систем"],
  "constraints": ["Ограничения и условия"],
  "plan": ["Шаг 1", "Шаг 2", ...],
  "risk_level": "low|medium|high",
  "risk_note": "Почему такой уровень риска (1 предложение)"
}
Будь конкретным и практичным. Не добавляй лишних шагов.`;

const ENGINEERING_SYSTEM_PROMPT = `You are an engineering task packager. Given a task description in Russian with its interpretation, produce a structured English engineering packet as JSON:
{
  "title": "Short English title",
  "objective": "What needs to be accomplished",
  "scope": ["file or system 1", "file or system 2"],
  "steps": ["Step 1", "Step 2", ...],
  "constraints": ["Constraint 1"],
  "acceptance_criteria": ["Criterion 1", "Criterion 2"],
  "mode": "fast|safe"
}
Be precise and actionable. The executor will use this packet directly.`;

async function handleTaskCreate(req, res) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  try {
    const body = await parseBody(req);
    if (!body.raw_input) return json(res, 400, { error: "raw_input is required" });
    const task = taskDb.createTask({
      project: body.project,
      raw_input: body.raw_input,
      input_type: body.input_type || "text",
      voice_transcript: body.voice_transcript,
    });
    json(res, 201, task);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleTaskVoice(req, res) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  try {
    const body = await parseBody(req);
    if (!body.audio) return json(res, 400, { error: "audio (base64) is required" });

    // 1. Transcribe with Whisper
    const transcript = await whisperTranscribe(body.audio);
    if (!transcript || !transcript.trim()) {
      return json(res, 400, { error: "Не удалось распознать речь" });
    }

    // 2. Create task from transcript
    const task = taskDb.createTask({
      project: body.project,
      raw_input: transcript,
      input_type: "voice",
      voice_transcript: transcript,
    });

    // 3. Auto-interpret
    try {
      const interpretation = await llmCall(INTERPRET_SYSTEM_PROMPT, transcript);
      const updated = taskDb.updateTaskInterpretation(task.id, interpretation);
      return json(res, 201, updated);
    } catch (llmErr) {
      // Task created but interpretation failed — return draft task
      return json(res, 201, task);
    }
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleTaskList(req, res) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const tasks = taskDb.getTasks({
    status: url.searchParams.get("status") || undefined,
    project: url.searchParams.get("project") || undefined,
    limit: parseInt(url.searchParams.get("limit") || "20"),
    offset: parseInt(url.searchParams.get("offset") || "0"),
  });
  json(res, 200, tasks);
}

async function handleTaskGet(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  json(res, 200, task);
}

async function handleTaskInterpret(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (task.status !== "draft") return json(res, 400, { error: `Cannot interpret task in status '${task.status}'` });

  try {
    // Single LLM call for interpretation
    const interpretation = await llmCall(INTERPRET_SYSTEM_PROMPT, task.raw_input);
    const updated = taskDb.updateTaskInterpretation(id, interpretation);
    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: `Interpretation failed: ${e.message}` });
  }
}

async function handleTaskRevise(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (!["pending", "draft"].includes(task.status)) {
    return json(res, 400, { error: `Cannot revise task in status '${task.status}'` });
  }

  try {
    const body = await parseBody(req);
    if (!body.text) return json(res, 400, { error: "text is required" });
    // Deterministic: append revision, reset to draft, NO LLM call
    const updated = taskDb.addTaskRevision(id, body.text);
    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleTaskConfirm(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (task.status !== "pending") {
    return json(res, 400, { error: `Cannot confirm task in status '${task.status}'. Must be 'pending'.` });
  }

  try {
    const body = await parseBody(req);
    const mode = body.mode || task.mode || "safe";

    // Single LLM call for engineering packet
    const contextForPacket = `Task (Russian): ${task.raw_input}\n\nInterpretation: ${task.interpretation}\n\nMode: ${mode}`;
    const packet = await llmCall(ENGINEERING_SYSTEM_PROMPT, contextForPacket);
    packet.mode = mode;

    const updated = taskDb.confirmTask(id, { mode, engineering_packet: packet });

    // Notify Telegram
    const interp = typeof task.interpretation === "string" ? JSON.parse(task.interpretation) : task.interpretation;
    await sendTelegram(
      `<b>Задача подтверждена</b>\n\n` +
      `<b>Задача:</b> ${interp?.understood || task.raw_input.slice(0, 200)}\n` +
      `<b>Режим:</b> ${mode === "fast" ? "Быстрый" : "Безопасный"}\n` +
      `<b>Риск:</b> ${interp?.risk_level || "?"}`
    );

    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: `Confirm failed: ${e.message}` });
  }
}

async function handleTaskCancel(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (["done", "cancelled"].includes(task.status)) {
    return json(res, 400, { error: `Task already ${task.status}` });
  }
  const updated = taskDb.cancelTask(id);
  json(res, 200, updated);
}

async function handleTaskProgress(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (task.status !== "running") return json(res, 400, { error: "Task is not running" });

  try {
    const body = await parseBody(req);
    if (!body.message_ru) return json(res, 400, { error: "message_ru is required" });
    const updated = taskDb.addTaskProgress(id, body.message_ru, body.pct);

    // Send progress to Telegram only on milestones (first update, 25/50/75/100%)
    const progressArr = updated.progress ? JSON.parse(updated.progress) : [];
    const isMilestone = progressArr.length === 1
      || (body.pct != null && [25, 50, 75, 100].includes(body.pct));
    if (isMilestone) {
      await sendTelegram(`<b>Прогресс задачи #${id}</b>\n${body.message_ru}${body.pct != null ? ` (${body.pct}%)` : ""}`);
    }

    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleTaskComplete(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (!["running", "confirmed"].includes(task.status)) {
    return json(res, 400, { error: `Cannot complete task in status '${task.status}'. Must be 'running' or 'confirmed'.` });
  }

  try {
    const body = await parseBody(req);
    const updated = taskDb.completeTask(id, {
      result_summary_ru: body.result_summary_ru,
      result_detail: body.result_detail,
    });

    // Send result to Telegram
    await sendTelegram(
      `<b>Задача #${id} выполнена</b>\n\n` +
      `${body.result_summary_ru || "Результат не указан"}`
    );
    taskDb.setTaskTelegramNotified(id);

    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleTaskFail(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (!["running", "confirmed"].includes(task.status)) {
    return json(res, 400, { error: `Cannot fail task in status '${task.status}'. Must be 'running' or 'confirmed'.` });
  }

  try {
    const body = await parseBody(req);
    const updated = taskDb.failTask(id, body.error || "Unknown error");

    await sendTelegram(`<b>Задача #${id} не выполнена</b>\n\n<b>Ошибка:</b> ${body.error || "Неизвестная ошибка"}`);
    taskDb.setTaskTelegramNotified(id);

    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleTaskStartExec(req, res, id) {
  if (!taskDb) return json(res, 503, { error: "Task DB not available" });
  const task = taskDb.getTask(id);
  if (!task) return json(res, 404, { error: "Task not found" });
  if (task.status !== "confirmed") {
    return json(res, 400, { error: `Cannot start execution for task in status '${task.status}'. Must be 'confirmed'.` });
  }

  try {
    const body = await parseBody(req);
    const updated = taskDb.startTaskExecution(id, body.execution_run_id);
    json(res, 200, updated);
  } catch (e) {
    json(res, 500, { error: e.message });
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

    // Task pipeline routes
    if (req.method === "POST" && urlPath === "/api/tasks/voice") return handleTaskVoice(req, res);
    if (req.method === "POST" && urlPath === "/api/tasks") return handleTaskCreate(req, res);
    if (req.method === "GET" && urlPath === "/api/tasks") return handleTaskList(req, res);

    // /api/tasks/:id and /api/tasks/:id/:action
    const taskMatch = urlPath.match(/^\/api\/tasks\/(\d+)(?:\/(\w+))?$/);
    if (taskMatch) {
      const taskId = parseInt(taskMatch[1]);
      const action = taskMatch[2];
      if (req.method === "GET" && !action) return handleTaskGet(req, res, taskId);
      if (req.method === "POST" && action === "interpret") return handleTaskInterpret(req, res, taskId);
      if (req.method === "POST" && action === "revise") return handleTaskRevise(req, res, taskId);
      if (req.method === "POST" && action === "confirm") return handleTaskConfirm(req, res, taskId);
      if (req.method === "POST" && action === "cancel") return handleTaskCancel(req, res, taskId);
      if (req.method === "POST" && action === "start") return handleTaskStartExec(req, res, taskId);
      if (req.method === "POST" && action === "progress") return handleTaskProgress(req, res, taskId);
      if (req.method === "POST" && action === "complete") return handleTaskComplete(req, res, taskId);
      if (req.method === "POST" && action === "fail") return handleTaskFail(req, res, taskId);
    }

    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

// ── Startup ──────────────────────────────────────────────────────────────────

await initTaskDb();

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[control-api] Listening on 127.0.0.1:${PORT}`);
  console.log(`[control-api] Auth: ${TOKEN ? "enabled" : "disabled (set CONTROL_API_TOKEN)"}`);
  console.log(`[control-api] Task DB: ${taskDb ? "ready" : "not available"}`);
  console.log(`[control-api] LLM: ${OPENAI_API_KEY ? "configured" : "not configured"}`);
  console.log(`[control-api] Telegram: ${TG_BOT_TOKEN && TG_CHAT_ID ? "configured" : "not configured"}`);
});
