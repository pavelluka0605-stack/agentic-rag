#!/usr/bin/env node
/**
 * VK Callback API Receiver — принимает события от VK, форвардит в N8N.
 *
 * Продовый паттерн: мгновенный ответ VK + async forward в N8N.
 *
 * Endpoints:
 *   POST /callback    — VK Callback API endpoint
 *   GET  /health      — health check
 *
 * Переменные окружения (из .env):
 *   VK_CONFIRMATION_TOKEN — строка подтверждения сервера (из настроек Callback API)
 *   VK_SECRET_KEY         — секретный ключ для валидации (из настроек Callback API)
 *   VK_GROUP_ID           — ID сообщества (для валидации group_id)
 *   N8N_WEBHOOK_URL       — URL вебхука N8N (по умолчанию http://localhost:5678/webhook/vk-events)
 *   CALLBACK_PORT         — порт сервера (по умолчанию 3102)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Загрузка .env ──────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    parseEnvFile(envPath);
  } else {
    const parentEnv = path.join(__dirname, '..', '.env');
    if (fs.existsSync(parentEnv)) parseEnvFile(parentEnv);
  }
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

// ─── Конфигурация ──────────────────────────────
const CONFIG = {
  confirmation_token: process.env.VK_CONFIRMATION_TOKEN,
  secret_key: process.env.VK_SECRET_KEY || '',
  group_id: process.env.VK_GROUP_ID,
  n8n_webhook_url: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/vk-events',
  port: parseInt(process.env.CALLBACK_PORT, 10) || 3102,
};

if (!CONFIG.confirmation_token) {
  console.error('[FATAL] VK_CONFIRMATION_TOKEN не задан.');
  process.exit(1);
}
if (!CONFIG.group_id) {
  console.error('[FATAL] VK_GROUP_ID не задан.');
  process.exit(1);
}

// ─── Статистика ─────────────────────────────────
const stats = {
  started_at: new Date().toISOString(),
  events_received: 0,
  events_forwarded: 0,
  errors: 0,
  last_event_at: null,
  last_event_type: null,
};

// ─── Forward to N8N (fire-and-forget) ───────────
function forwardToN8N(event) {
  const data = JSON.stringify(event);
  const url = new URL(CONFIG.n8n_webhook_url);
  const transport = url.protocol === 'https:' ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  const req = transport.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      stats.events_forwarded++;
      console.log(`  -> forwarded to N8N (${res.statusCode})`);
    });
  });

  req.on('error', (err) => {
    stats.errors++;
    console.error(`  -> N8N forward error: ${err.message}`);
  });

  req.setTimeout(10000, () => {
    req.destroy();
    stats.errors++;
    console.error('  -> N8N forward timeout');
  });

  req.write(data);
  req.end();
}

// ─── Форматирование события ─────────────────────
function formatEvent(body) {
  const base = {
    type: body.type,
    group_id: body.group_id,
    event_id: body.event_id,
    received_at: new Date().toISOString(),
  };

  switch (body.type) {
    case 'message_new':
      return {
        ...base,
        message: {
          from_id: body.object?.message?.from_id,
          peer_id: body.object?.message?.peer_id,
          text: body.object?.message?.text,
          date: body.object?.message?.date,
          conversation_message_id: body.object?.message?.conversation_message_id,
          attachments: (body.object?.message?.attachments || []).map(a => a.type),
        },
      };

    case 'wall_reply_new':
    case 'wall_reply_edit':
      return {
        ...base,
        comment: {
          id: body.object?.id,
          from_id: body.object?.from_id,
          post_id: body.object?.post_id,
          text: body.object?.text,
          date: body.object?.date,
          owner_id: body.object?.owner_id || body.object?.post_owner_id,
        },
      };

    case 'photo_comment_new':
    case 'photo_comment_edit':
      return {
        ...base,
        comment: {
          id: body.object?.id,
          from_id: body.object?.from_id,
          post_id: body.object?.photo_id,
          text: body.object?.text,
          date: body.object?.date,
          owner_id: body.object?.photo_owner_id,
        },
      };

    case 'wall_reply_delete':
      return {
        ...base,
        comment: {
          id: body.object?.id,
          post_id: body.object?.post_id,
          owner_id: body.object?.owner_id,
          deleter_id: body.object?.deleter_id,
        },
      };

    default:
      return { ...base, object: body.object };
  }
}

// ─── HTTP Server ────────────────────────────────
const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ...stats }));
    return;
  }

  // Callback endpoint
  if (req.method === 'POST' && req.url === '/callback') {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // 1. Confirmation — VK проверяет сервер
        if (data.type === 'confirmation') {
          if (String(data.group_id) === String(CONFIG.group_id)) {
            console.log(`[Callback] confirmation request from group ${data.group_id}`);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(CONFIG.confirmation_token);
          } else {
            console.warn(`[Callback] confirmation from unknown group: ${data.group_id}`);
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('bad group');
          }
          return;
        }

        // 2. Валидация secret key
        if (CONFIG.secret_key && data.secret !== CONFIG.secret_key) {
          console.warn(`[Callback] invalid secret from ${req.socket.remoteAddress}`);
          stats.errors++;
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('forbidden');
          return;
        }

        // 3. Мгновенный ответ VK — "ok"
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');

        // 4. Async forward to N8N
        stats.events_received++;
        stats.last_event_at = new Date().toISOString();
        stats.last_event_type = data.type;
        console.log(`[Callback] ${data.type} (event_id: ${data.event_id || 'n/a'})`);

        const formatted = formatEvent(data);
        forwardToN8N(formatted);

      } catch (err) {
        stats.errors++;
        console.error(`[Callback] JSON parse error: ${err.message}`);
        // Всё равно отвечаем ok, чтобы VK не ретраил
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`[VK Callback] Listening on :${CONFIG.port}/callback`);
  console.log(`  Group ID: ${CONFIG.group_id}`);
  console.log(`  Secret key: ${CONFIG.secret_key ? 'configured' : 'disabled'}`);
  console.log(`  N8N webhook: ${CONFIG.n8n_webhook_url}`);
  console.log(`  Health: http://0.0.0.0:${CONFIG.port}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => { console.log('\n[VK Callback] SIGINT — shutting down...'); server.close(); process.exit(0); });
process.on('SIGTERM', () => { console.log('[VK Callback] SIGTERM — shutting down...'); server.close(); process.exit(0); });
