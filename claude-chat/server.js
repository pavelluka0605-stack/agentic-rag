require('dotenv').config();
const express = require('express');
const { spawn, execSync } = require('child_process');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3847;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

if (!BEARER_TOKEN) {
  console.error('BEARER_TOKEN not set in .env');
  process.exit(1);
}

// --- Middleware ---
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit: 10 req/min
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
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
const runningProcesses = new Map(); // id -> child_process

// --- Routes ---

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRequests,
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
    } catch (_) { /* ignore */ }

    let dockerContainers = [];
    try {
      const ps = execSync('docker ps --format "{{.Names}}|{{.Status}}|{{.Ports}}"', { encoding: 'utf-8' });
      dockerContainers = ps.trim().split('\n').filter(Boolean).map(line => {
        const [name, status, ports] = line.split('|');
        return { name, status, ports };
      });
    } catch (_) { /* docker may not be available */ }

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
app.post('/api/chat', auth, (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  if (activeRequests >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Server busy, max concurrent requests reached' });
  }

  activeRequests++;
  const requestId = uuidv4();

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Request-Id': requestId,
  });

  // Send request ID
  res.write(`data: ${JSON.stringify({ type: 'start', id: requestId })}\n\n`);

  // Build prompt with history context
  let prompt = message;
  if (history && Array.isArray(history) && history.length > 0) {
    const context = history
      .slice(-6) // last 6 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    prompt = `Previous conversation:\n${context}\n\nUser: ${message}`;
  }

  const startTime = Date.now();

  // Spawn claude --print
  const child = spawn('claude', ['--print', prompt], {
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000, // 2 min timeout
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
    res.write(`data: ${JSON.stringify({ type: 'error', text })}\n\n`);
  });

  child.on('close', (code) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    res.write(`data: ${JSON.stringify({ type: 'done', elapsed, code })}\n\n`);
    res.end();
    activeRequests--;
    runningProcesses.delete(requestId);
  });

  child.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', elapsed: '0', code: 1 })}\n\n`);
    res.end();
    activeRequests--;
    runningProcesses.delete(requestId);
  });

  // Client disconnect
  req.on('close', () => {
    if (runningProcesses.has(requestId)) {
      child.kill('SIGTERM');
      runningProcesses.delete(requestId);
      activeRequests--;
    }
  });
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

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Claude Chat server running on port ${PORT}`);
});
