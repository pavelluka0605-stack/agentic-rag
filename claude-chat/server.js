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

// --- Find claude CLI ---
function findClaude() {
  // Common locations for claude CLI
  const candidates = [
    'claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(os.homedir(), '.claude', 'bin', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
  ];

  // Try which first
  try {
    const found = execSync('which claude 2>/dev/null || command -v claude 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (found) return found;
  } catch (_) {}

  // Check candidate paths
  for (const c of candidates) {
    try {
      if (c === 'claude') continue; // already tried via which
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

// --- Middleware ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '10mb' }));
// No-cache for HTML to prevent stale versions
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  next();
});
// Serve index.html dynamically with injected config
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');
  // Inject auto-config script before </head>
  const configScript = `<script>window.__CHAT_CONFIG__=${JSON.stringify({ token: BEARER_TOKEN, url: '' })};</script>`;
  html = html.replace('</head>', configScript + '</head>');
  res.type('html').send(html);
});
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

// --- Background results store ---
// Keeps results for disconnected clients to poll
const backgroundResults = new Map(); // id -> { chunks: [], done: boolean, elapsed, code, startTime }
const BG_RESULT_TTL = 10 * 60 * 1000; // 10 min TTL

// Cleanup old results periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of backgroundResults) {
    if (r.done && now - r.doneAt > BG_RESULT_TTL) {
      backgroundResults.delete(id);
    }
  }
}, 60000);

// --- Routes ---

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRequests,
    claudeCli: CLAUDE_PATH || 'not found (fallback: bash)',
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
    'X-Accel-Buffering': 'no',
    'X-Request-Id': requestId,
  });

  // Heartbeat to keep connection alive through proxies (every 5s)
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 5000);

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

  if (!CLAUDE_PATH) {
    // Fallback: run command directly via bash if it looks like a shell command
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

  // Spawn claude CLI (no spawn timeout — we manage it ourselves for clean error messages)
  const child = spawn(CLAUDE_PATH, ['--print', prompt], {
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Manual timeout: 5 minutes — sends clean error before killing
  const TIMEOUT_MS = 5 * 60 * 1000;
  const processTimeout = setTimeout(() => {
    if (runningProcesses.has(requestId)) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      safeSend({ type: 'chunk', text: '\n\n[Превышено время ожидания (5 мин). Запрос отменён.]' });
      safeSend({ type: 'done', elapsed, code: 124 });
      child.kill('SIGTERM');
    }
  }, TIMEOUT_MS);

  runningProcesses.set(requestId, child);

  // Background buffer — always accumulate so client can poll if disconnected
  const bgResult = { chunks: [], fullText: '', done: false, elapsed: null, code: null, doneAt: null, startTime };
  backgroundResults.set(requestId, bgResult);

  let clientConnected = true;

  function safeSend(data) {
    if (clientConnected) {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) { clientConnected = false; }
    }
  }

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    bgResult.fullText += text;
    bgResult.chunks.push({ type: 'chunk', text });
    safeSend({ type: 'chunk', text });
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    bgResult.chunks.push({ type: 'error', text });
    safeSend({ type: 'error', text });
  });

  child.on('close', (code) => {
    clearTimeout(processTimeout);
    clearInterval(heartbeat);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    bgResult.done = true;
    bgResult.elapsed = elapsed;
    bgResult.code = code;
    bgResult.doneAt = Date.now();
    safeSend({ type: 'done', elapsed, code });
    if (clientConnected) { try { res.end(); } catch (_) {} }
    activeRequests--;
    runningProcesses.delete(requestId);
  });

  child.on('error', (err) => {
    clearTimeout(processTimeout);
    clearInterval(heartbeat);
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

  // Client disconnect — DO NOT kill the process, let it finish in background
  req.on('close', () => {
    clientConnected = false;
    clearInterval(heartbeat);
    // Process continues running, results buffered in backgroundResults
  });
});

// Poll for result of a background request
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (OpenAI limit)
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

app.post('/api/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
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
