require('dotenv').config();
const express = require('express');
const { spawn, execSync } = require('child_process');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1); // Behind Traefik reverse proxy
const PORT = process.env.PORT || 3847;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BEARER_TOKEN) {
  console.error('BEARER_TOKEN not set in .env');
  process.exit(1);
}

// --- RAG Memory Search ---
const RAG_SCRIPT = path.join(__dirname, 'rag_search.py');
const RAG_SAVE_SCRIPT = path.join(__dirname, 'rag_save.py');

function ragSearch(query) {
  return new Promise((resolve) => {
    if (!query || query.length < 5) return resolve(null);
    try {
      const child = spawn('python3', [RAG_SCRIPT, query], {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      });
      let stdout = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) return resolve(null);
        try {
          const result = JSON.parse(stdout.trim());
          if (result.found > 0 && result.context) return resolve(result);
        } catch (_) {}
        resolve(null);
      });
      child.on('error', () => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

function ragSave(action, result, category, tags) {
  try {
    const child = spawn('python3', [RAG_SAVE_SCRIPT, action, result, category, JSON.stringify(tags)], {
      env: { ...process.env },
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 5000,
    });
    child.unref();
  } catch (_) {}
}

// --- Find claude CLI ---
function findClaude() {
  const candidates = [
    'claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(os.homedir(), '.claude', 'bin', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
  ];
  try {
    const found = execSync('which claude 2>/dev/null || command -v claude 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (found) return found;
  } catch (_) {}
  for (const c of candidates) {
    try {
      if (c === 'claude') continue;
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return null;
}

const CLAUDE_PATH = findClaude();
console.log(`Claude CLI: ${CLAUDE_PATH || 'NOT FOUND'}`);
if (!CLAUDE_PATH) {
  console.warn('WARNING: claude CLI not found. Chat will use fallback shell mode.');
}

// --- Persistent conversations on disk ---
const CONV_DIR = path.join(__dirname, 'data');
const CONV_FILE = path.join(CONV_DIR, 'conversations.json');
if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });

function loadConversations() {
  try {
    if (fs.existsSync(CONV_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONV_FILE, 'utf-8'));
      const map = new Map();
      for (const [k, v] of Object.entries(data)) {
        map.set(k, v);
      }
      console.log(`Loaded ${map.size} conversations from disk`);
      return map;
    }
  } catch (e) {
    console.error('Failed to load conversations:', e.message);
  }
  return new Map();
}

function saveConversations() {
  try {
    const obj = {};
    for (const [k, v] of conversations) {
      obj[k] = v;
    }
    fs.writeFileSync(CONV_FILE, JSON.stringify(obj), 'utf-8');
  } catch (e) {
    console.error('Failed to save conversations:', e.message);
  }
}

// Debounced save
let saveTimer = null;
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveConversations, 5000);
}

// --- Middleware ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  next();
});
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const configScript = `<script>window.__CHAT_CONFIG__=${JSON.stringify({ token: BEARER_TOKEN, url: '' })};</script>`;
  html = html.replace('</head>', configScript + '</head>');
  res.type('html').send(html);
});
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit: 15 req/min (increased for better UX)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api/', limiter);

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || header !== `Bearer ${BEARER_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- Concurrency control ---
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const runningProcesses = new Map();

// --- Background results store ---
const backgroundResults = new Map();
const BG_RESULT_TTL = 10 * 60 * 1000;

// --- Conversation history store (persistent) ---
const conversations = loadConversations();
const CONV_TTL = 24 * 60 * 60 * 1000; // 24 hours TTL
const pendingRequests = new Map();

// Cleanup old results, conversations, and fix counter drift
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of backgroundResults) {
    if (r.done && now - r.doneAt > BG_RESULT_TTL) {
      backgroundResults.delete(id);
    }
  }
  let cleaned = false;
  for (const [sid, conv] of conversations) {
    if (now - conv.lastActivity > CONV_TTL) {
      conversations.delete(sid);
      pendingRequests.delete(sid);
      cleaned = true;
    }
  }
  if (cleaned) debouncedSave();
  if (activeRequests !== runningProcesses.size) {
    console.warn(`[cleanup] activeRequests drift: counter=${activeRequests}, actual=${runningProcesses.size}. Correcting.`);
    activeRequests = runningProcesses.size;
  }
}, 60000);

// --- RAG memory stats ---
function ragStats() {
  return new Promise((resolve) => {
    try {
      const child = spawn('python3', ['-c', `
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath("${RAG_SCRIPT}"))))
os.environ.setdefault("RAG_DB", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath("${RAG_SCRIPT}"))), "rag_memory.db"))
import memory_store
s = memory_store.stats()
print(json.dumps(s))
`], {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });
      let stdout = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.on('close', () => {
        try { resolve(JSON.parse(stdout.trim())); } catch (_) { resolve(null); }
      });
      child.on('error', () => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

// --- Routes ---

// Health check (no auth)
app.get('/api/health', async (_req, res) => {
  const now = Date.now();
  const MAX_AGE = 6 * 60 * 1000;
  let cleaned = 0;
  for (const [id, bg] of backgroundResults) {
    if (!bg.done && bg.startTime && (now - bg.startTime) > MAX_AGE) {
      const child = runningProcesses.get(id);
      if (child) {
        console.error(`[health] Force-killing stale process ${id} (age: ${((now - bg.startTime)/1000).toFixed(0)}s)`);
        child.kill('SIGKILL');
        runningProcesses.delete(id);
        activeRequests = Math.max(0, activeRequests - 1);
        bg.done = true;
        bg.doneAt = now;
        bg.code = -1;
        bg.fullText += '\n\n[Запрос принудительно завершён — превышен лимит времени]';
        cleaned++;
      }
    }
  }

  let rag = null;
  try { rag = await ragStats(); } catch (_) {}

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRequests,
    runningProcesses: runningProcesses.size,
    backgroundResults: backgroundResults.size,
    conversations: conversations.size,
    cleaned,
    claudeCli: CLAUDE_PATH || 'not found (fallback: bash)',
    rag: rag || { status: 'unavailable' },
    timestamp: new Date().toISOString(),
  });
});

// VPS status
app.get('/api/vps-status', auth, (_req, res) => {
  try {
    const uptime = os.uptime();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    let diskInfo = { total: 0, used: 0, available: 0, percent: '0%' };
    try {
      const df = execSync("df -h / | tail -1", { encoding: 'utf-8' }).trim().split(/\s+/);
      diskInfo = { total: df[1], used: df[2], available: df[3], percent: df[4] };
    } catch (_) {}

    let dockerContainers = [];
    try {
      const ps = execSync('docker ps --format "{{.Names}}|{{.Status}}|{{.Ports}}"', { encoding: 'utf-8' });
      dockerContainers = ps.trim().split('\n').filter(Boolean).map(line => {
        const [name, status, ports] = line.split('|');
        return { name, status, ports };
      });
    } catch (_) {}

    res.json({
      uptime: formatUptime(uptime),
      memory: {
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem),
        percent: ((usedMem / totalMem) * 100).toFixed(1) + '%',
      },
      disk: diskInfo,
      load: {
        '1m': loadAvg[0].toFixed(2),
        '5m': loadAvg[1].toFixed(2),
        '15m': loadAvg[2].toFixed(2),
      },
      cpus: os.cpus().length,
      docker: dockerContainers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat — SSE streaming
app.post('/api/chat', auth, async (req, res) => {
  const { message, history, sessionId: clientSessionId } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  if (activeRequests >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Server busy, max concurrent requests reached' });
  }

  activeRequests++;
  const requestId = uuidv4();
  const sessionId = clientSessionId || uuidv4();

  // Initialize conversation if needed
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, { messages: [], lastActivity: Date.now() });
  }
  const conv = conversations.get(sessionId);
  conv.lastActivity = Date.now();

  // Save user message
  conv.messages.push({ role: 'user', content: message, timestamp: Date.now() });
  debouncedSave();

  // Track pending request for this session
  pendingRequests.set(sessionId, requestId);

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Request-Id': requestId,
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 5000);

  // Send request ID and session ID
  res.write(`data: ${JSON.stringify({ type: 'start', id: requestId, sessionId })}\n\n`);

  // RAG: search memory for relevant context
  let ragContext = null;
  try {
    ragContext = await ragSearch(message);
    // Notify client about RAG status
    if (ragContext) {
      res.write(`data: ${JSON.stringify({ type: 'rag', found: ragContext.found })}\n\n`);
    }
  } catch (_) {}

  // Build prompt with system prompt + RAG context + full conversation history
  let prompt = '';

  // Add RAG context if found
  if (ragContext) {
    prompt += `=== Контекст из памяти проекта (${ragContext.found} записей) ===\n${ragContext.context}\n=== Конец контекста ===\n\n`;
  }

  // Use server-side conversation history (full, not limited)
  if (conv.messages.length > 1) {
    const historyMsgs = conv.messages.slice(0, -1); // all except current message
    const historyText = historyMsgs
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    prompt += `Previous conversation:\n${historyText}\n\n`;
  }

  prompt += `User: ${message}`;

  const startTime = Date.now();

  if (!CLAUDE_PATH) {
    // Fallback: run command directly via bash
    const child = spawn('bash', ['-lc', message], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });
    runningProcesses.set(requestId, child);
    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
    });
    child.on('close', (code) => {
      clearInterval(heartbeat);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (!output) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: `[exit code: ${code}]` })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', elapsed, code })}\n\n`);
      res.end();
      activeRequests--;
      runningProcesses.delete(requestId);
    });
    child.on('error', (err) => {
      clearInterval(heartbeat);
      res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', elapsed: '0', code: 1 })}\n\n`);
      res.end();
      activeRequests--;
      runningProcesses.delete(requestId);
    });
    req.on('close', () => {
      clearInterval(heartbeat);
      if (runningProcesses.has(requestId)) {
        child.kill('SIGTERM');
        runningProcesses.delete(requestId);
        activeRequests--;
      }
    });
    return;
  }

  // Spawn claude CLI with stream-json for thinking/tool visibility
  const child = spawn(CLAUDE_PATH, ['-p', '--output-format', 'stream-json', prompt], {
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Timeouts
  const TIMEOUT_MS = 5 * 60 * 1000;
  const STALE_TIMEOUT_MS = 90 * 1000;
  const FIRST_BYTE_TIMEOUT_MS = 30 * 1000;

  let lastDataAt = Date.now();
  let gotFirstByte = false;

  const processTimeout = setTimeout(() => {
    if (runningProcesses.has(requestId)) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      safeSend({ type: 'chunk', text: '\n\n[Превышено время ожидания (5 мин). Запрос отменён.]' });
      safeSend({ type: 'done', elapsed, code: 124 });
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }
  }, TIMEOUT_MS);

  const staleChecker = setInterval(() => {
    const silentMs = Date.now() - lastDataAt;
    if (!gotFirstByte && silentMs > FIRST_BYTE_TIMEOUT_MS) {
      console.error(`[${requestId}] No first byte in ${FIRST_BYTE_TIMEOUT_MS/1000}s — killing`);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      safeSend({ type: 'chunk', text: '\n\n[Claude CLI не отвечает. Попробуйте снова.]' });
      safeSend({ type: 'done', elapsed, code: 1 });
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000);
      clearInterval(staleChecker);
    } else if (gotFirstByte && silentMs > STALE_TIMEOUT_MS) {
      console.error(`[${requestId}] Stale for ${STALE_TIMEOUT_MS/1000}s — killing`);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      safeSend({ type: 'chunk', text: '\n\n[Ответ прервался. Попробуйте снова.]' });
      safeSend({ type: 'done', elapsed, code: 1 });
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000);
      clearInterval(staleChecker);
    }
  }, 15000);

  runningProcesses.set(requestId, child);

  const bgResult = { chunks: [], fullText: '', done: false, elapsed: null, code: null, doneAt: null, startTime };
  backgroundResults.set(requestId, bgResult);

  let clientConnected = true;

  function safeSend(data) {
    if (clientConnected) {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) { clientConnected = false; }
    }
  }

  // Parse stream-json output line by line
  let stdoutBuffer = '';
  child.stdout.on('data', (chunk) => {
    lastDataAt = Date.now();
    gotFirstByte = true;
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        // Map stream-json events to SSE events
        if (event.type === 'assistant') {
          if (event.subtype === 'thinking') {
            safeSend({ type: 'thinking', text: event.text || '' });
          } else if (event.subtype === 'text') {
            const text = event.text || '';
            bgResult.fullText += text;
            bgResult.chunks.push({ type: 'chunk', text });
            safeSend({ type: 'chunk', text });
          }
        } else if (event.type === 'tool_use') {
          safeSend({
            type: 'tool_use',
            tool: event.tool || event.name || 'tool',
            input: event.input || '',
          });
        } else if (event.type === 'tool_result') {
          safeSend({
            type: 'tool_result',
            output: typeof event.output === 'string' ? event.output.slice(0, 2000) : JSON.stringify(event.output).slice(0, 2000),
          });
        } else if (event.type === 'result') {
          // Final result event — extract text if present
          if (event.result && !bgResult.fullText) {
            bgResult.fullText = event.result;
            safeSend({ type: 'chunk', text: event.result });
          }
        } else {
          // Unknown event type — try to extract text
          if (event.text) {
            bgResult.fullText += event.text;
            safeSend({ type: 'chunk', text: event.text });
          }
        }
      } catch (_) {
        // Not valid JSON — treat as raw text (fallback)
        const text = line;
        bgResult.fullText += text + '\n';
        bgResult.chunks.push({ type: 'chunk', text: text + '\n' });
        safeSend({ type: 'chunk', text: text + '\n' });
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    lastDataAt = Date.now();
    gotFirstByte = true;
    bgResult.chunks.push({ type: 'error', text });
    safeSend({ type: 'error', text });
  });

  child.on('close', (code) => {
    clearTimeout(processTimeout);
    clearInterval(heartbeat);
    clearInterval(staleChecker);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    bgResult.done = true;
    bgResult.elapsed = elapsed;
    bgResult.code = code;
    bgResult.doneAt = Date.now();

    // Save assistant response to conversation history
    if (bgResult.fullText && conv) {
      conv.messages.push({
        role: 'assistant',
        content: bgResult.fullText,
        timestamp: Date.now(),
        elapsed: parseFloat(elapsed),
        requestId,
      });
      conv.lastActivity = Date.now();
      debouncedSave();
    }

    // Auto-save meaningful interactions to RAG memory
    if (bgResult.fullText && message.length > 20 && bgResult.fullText.length > 100) {
      const tags = ['chat', 'ai-response'];
      if (message.toLowerCase().match(/vps|docker|сервер|deploy|nginx/)) tags.push('devops');
      if (message.toLowerCase().match(/n8n|workflow|автоматиз/)) tags.push('n8n');
      if (message.toLowerCase().match(/vk|комментар|сообщен/)) tags.push('vk');
      if (message.toLowerCase().match(/bluesales|crm|клиент|заказ/)) tags.push('crm');
      if (message.toLowerCase().match(/ошибк|error|fix|баг|bug/)) tags.push('incident');
      ragSave(
        `Вопрос: ${message.slice(0, 200)}`,
        `Ответ: ${bgResult.fullText.slice(0, 500)}`,
        tags.includes('devops') ? 'devops' : tags.includes('crm') ? 'crm' : 'knowledge',
        tags
      );
    }

    // Clear pending request
    if (pendingRequests.get(sessionId) === requestId) {
      pendingRequests.delete(sessionId);
    }

    safeSend({ type: 'done', elapsed, code });
    if (clientConnected) { try { res.end(); } catch (_) {} }
    activeRequests--;
    runningProcesses.delete(requestId);
  });

  child.on('error', (err) => {
    clearTimeout(processTimeout);
    clearInterval(heartbeat);
    clearInterval(staleChecker);
    bgResult.chunks.push({ type: 'error', text: err.message });
    bgResult.done = true;
    bgResult.elapsed = '0';
    bgResult.code = 1;
    bgResult.doneAt = Date.now();
    safeSend({ type: 'error', text: err.message });
    safeSend({ type: 'done', elapsed: '0', code: 1 });
    if (clientConnected) { try { res.end(); } catch (_) {} }
    activeRequests--;
    runningProcesses.delete(requestId);
  });

  req.on('close', () => {
    clientConnected = false;
    clearInterval(heartbeat);
  });
});

// Poll for result
app.get('/api/result/:id', auth, (req, res) => {
  const { id } = req.params;
  const bg = backgroundResults.get(id);
  if (!bg) {
    return res.status(404).json({ error: 'Request not found' });
  }
  res.json({
    done: bg.done,
    fullText: bg.fullText,
    elapsed: bg.elapsed,
    code: bg.code,
  });
});

// Recover after disconnect
app.get('/api/recover/:sessionId', auth, (req, res) => {
  const { sessionId } = req.params;
  const pendingRequestId = pendingRequests.get(sessionId);
  const conv = conversations.get(sessionId);

  if (pendingRequestId) {
    const bg = backgroundResults.get(pendingRequestId);
    if (bg) {
      const ageMs = Date.now() - (bg.startTime || Date.now());
      return res.json({
        status: bg.done ? 'completed' : 'running',
        requestId: pendingRequestId,
        fullText: bg.fullText,
        elapsed: bg.elapsed,
        code: bg.code,
        done: bg.done,
        ageMs,
      });
    }
  }

  if (conv && conv.messages.length > 0) {
    const lastMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');
    if (lastMsg) {
      return res.json({
        status: 'completed',
        requestId: lastMsg.requestId || null,
        fullText: lastMsg.content,
        elapsed: lastMsg.elapsed || null,
        done: true,
      });
    }
  }

  res.json({ status: 'none' });
});

// Get conversation history
app.get('/api/history/:sessionId', auth, (req, res) => {
  const { sessionId } = req.params;
  const conv = conversations.get(sessionId);
  if (!conv) {
    return res.json({ messages: [] });
  }
  const messages = conv.messages.map(m => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    elapsed: m.elapsed,
  }));
  res.json({ messages, sessionId });
});

// Clear session history
app.post('/api/clear-history', auth, (req, res) => {
  const { sessionId: sid } = req.body;
  if (sid && conversations.has(sid)) {
    conversations.delete(sid);
    debouncedSave();
    res.json({ status: 'cleared', sessionId: sid });
  } else {
    res.json({ status: 'not_found' });
  }
});

// Force reset
app.post('/api/reset', auth, (_req, res) => {
  let killed = 0;
  for (const [id, child] of runningProcesses) {
    child.kill('SIGKILL');
    runningProcesses.delete(id);
    const bg = backgroundResults.get(id);
    if (bg) {
      bg.done = true;
      bg.doneAt = Date.now();
      bg.code = -1;
    }
    killed++;
  }
  activeRequests = 0;
  pendingRequests.clear();
  console.log(`[reset] Force-killed ${killed} processes`);
  res.json({ status: 'reset', killed });
});

// Cancel request
app.post('/api/cancel/:id', auth, (req, res) => {
  const { id } = req.params;
  const child = runningProcesses.get(id);
  if (child) {
    child.kill('SIGTERM');
    runningProcesses.delete(id);
    res.json({ status: 'cancelled', id });
  } else {
    res.status(404).json({ error: 'Request not found or already completed' });
  }
});

// --- File upload ---
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

// --- Audio transcription via OpenAI Whisper ---
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => cb(null, `voice-${uuidv4()}.webm`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.post('/api/transcribe', auth, audioUpload.single('audio'), async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const audioPath = req.file.path;
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath), {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm',
    });
    form.append('model', 'gpt-4o-transcribe');
    form.append('language', 'ru');

    const https = require('https');
    const result = await new Promise((resolve, reject) => {
      const request = https.request('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          if (response.statusCode >= 400) {
            reject(new Error(`OpenAI API error ${response.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      });
      request.on('error', reject);
      form.pipe(request);
    });

    res.json({ text: result.text || '' });
  } catch (err) {
    console.error('Transcription error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(audioPath, () => {});
  }
});

app.post('/api/upload', auth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }
  const url = `/uploads/${req.file.filename}`;
  const filePath = path.join(uploadsDir, req.file.filename);

  // Анализ фото через OpenAI GPT-4o Vision
  let description = '';
  if (OPENAI_API_KEY) {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = req.file.mimetype || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const https = require('https');
      const payload = JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Опиши подробно что ты видишь на этом изображении. Если есть текст — прочитай его. Если это товар/мебель — опиши характеристики. Если это скриншот — опиши содержимое.' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        }],
        max_tokens: 1000,
      });

      const result = await new Promise((resolve, reject) => {
        const request = https.request('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            if (response.statusCode >= 400) {
              reject(new Error(`Vision API error ${response.statusCode}: ${data}`));
            } else {
              resolve(JSON.parse(data));
            }
          });
        });
        request.on('error', reject);
        request.write(payload);
        request.end();
      });

      description = result.choices?.[0]?.message?.content || '';
      console.log(`[vision] Analyzed ${req.file.filename}: ${description.length} chars`);
    } catch (err) {
      console.error('[vision] Error:', err.message);
    }
  }

  res.json({ url, filename: req.file.filename, description });
});

// --- Helpers ---
function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return gb.toFixed(1) + ' GB';
  return (bytes / (1024 ** 2)).toFixed(0) + ' MB';
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// --- Graceful shutdown ---
function shutdown(signal) {
  console.log(`\n[${signal}] Saving conversations...`);
  saveConversations();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Claude Chat server running on port ${PORT}`);
  console.log(`Conversations loaded: ${conversations.size}`);
  console.log(`RAG script: ${RAG_SCRIPT}`);
});
