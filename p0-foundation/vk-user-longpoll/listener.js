#!/usr/bin/env node
/**
 * VK User Long Poll Listener — чтение ВСЕХ личных сообщений в реальном времени.
 *
 * Использует User Long Poll API (messages.getLongPollServer) с токеном пользователя.
 * Перехватывает входящие и исходящие сообщения и отправляет в N8N webhook.
 *
 * Переменные окружения:
 *   VK_USER_TOKEN    — Access Token пользователя (standalone app, scope: messages)
 *   N8N_WEBHOOK_URL  — URL вебхука N8N (по умолчанию http://localhost:5678/webhook/vk-user-messages)
 *   VK_API_VERSION   — версия API (по умолчанию 5.199)
 *   VK_LP_MODE       — режим Long Poll (по умолчанию 234 = attachments + extended + pts)
 *   VK_LP_VERSION    — версия Long Poll (по умолчанию 10)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Загрузка .env ──────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    const parentEnv = path.join(__dirname, '..', '.env');
    if (fs.existsSync(parentEnv)) {
      parseEnvFile(parentEnv);
    }
  } else {
    parseEnvFile(envPath);
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ─── Конфигурация ──────────────────────────────
const CONFIG = {
  user_token: process.env.VK_USER_TOKEN,
  n8n_webhook_url: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/vk-user-messages',
  api_version: process.env.VK_API_VERSION || '5.199',
  lp_mode: parseInt(process.env.VK_LP_MODE || '234', 10),
  lp_version: parseInt(process.env.VK_LP_VERSION || '10', 10),
  reconnect_delay: 5000,
  max_reconnect_delay: 60000,
};

if (!CONFIG.user_token) {
  console.error('[FATAL] VK_USER_TOKEN не задан.');
  console.error('Получите токен через standalone-приложение (Kate Mobile app_id=2685278):');
  console.error('https://oauth.vk.com/authorize?client_id=2685278&scope=messages,friends,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token&v=5.199');
  process.exit(1);
}

// ─── Статистика ─────────────────────────────────
const stats = {
  started_at: new Date().toISOString(),
  messages_received: 0,
  messages_sent_to_n8n: 0,
  errors: 0,
  reconnects: 0,
  last_message_at: null,
};

// ─── HTTP helpers ───────────────────────────────

function httpsPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const data = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`JSON parse error: ${responseData.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(data);
    req.end();
  });
}

function httpsGet(urlStr, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(urlStr, { timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Long Poll timeout')); });
  });
}

function sendToN8N(event) {
  const data = JSON.stringify(event);
  const url = new URL(CONFIG.n8n_webhook_url);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
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
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('N8N webhook timeout')); });
    req.write(data);
    req.end();
  });
}

// ─── VK API ─────────────────────────────────────

async function vkApi(method, params = {}) {
  const result = await httpsPost(`https://api.vk.com/method/${method}`, {
    ...params,
    access_token: CONFIG.user_token,
    v: CONFIG.api_version,
  });

  if (result.error) {
    throw new Error(`VK API ${method}: [${result.error.error_code}] ${result.error.error_msg}`);
  }
  return result.response;
}

// ─── Флаги сообщений (User Long Poll v10) ───────

const MESSAGE_FLAGS = {
  1: 'UNREAD',
  2: 'OUTBOX',
  4: 'REPLIED',
  8: 'IMPORTANT',
  16: 'CHAT',       // через чат
  32: 'FRIENDS',
  64: 'SPAM',
  128: 'DELETED',
  256: 'AUDIO_LISTENED',
  512: 'CHAT2',
  65536: 'HIDDEN',
};

function parseFlags(flags) {
  const result = [];
  for (const [bit, name] of Object.entries(MESSAGE_FLAGS)) {
    if (flags & parseInt(bit, 10)) result.push(name);
  }
  return result;
}

// ─── Обработка событий User Long Poll ───────────
// Коды событий: https://dev.vk.com/ru/api/user-long-poll/getting-started

function parseUpdate(update) {
  const eventCode = update[0];

  switch (eventCode) {
    // 4 — новое сообщение
    case 4: {
      const messageId = update[1];
      const flags = update[2];
      const peerId = update[3];
      const timestamp = update[4];
      const text = update[5];
      const extra = update[6] || {};
      const attachments = update[7] || {};

      const isOutgoing = !!(flags & 2);

      return {
        type: 'message_new',
        message_id: messageId,
        flags: parseFlags(flags),
        is_outgoing: isOutgoing,
        peer_id: peerId,
        from_id: isOutgoing ? 'self' : (extra.from || peerId),
        timestamp,
        date: new Date(timestamp * 1000).toISOString(),
        text,
        extra,
        attachments,
        received_at: new Date().toISOString(),
      };
    }

    // 2 — установка флагов сообщения (прочитано, удалено и т.д.)
    case 2: {
      return {
        type: 'message_flags_set',
        message_id: update[1],
        flags: parseFlags(update[2]),
        peer_id: update[3],
        received_at: new Date().toISOString(),
      };
    }

    // 3 — сброс флагов сообщения
    case 3: {
      return {
        type: 'message_flags_reset',
        message_id: update[1],
        flags: parseFlags(update[2]),
        peer_id: update[3],
        received_at: new Date().toISOString(),
      };
    }

    // 6 — прочитаны все входящие до message_id
    case 6: {
      return {
        type: 'read_incoming',
        peer_id: update[1],
        message_id: update[2],
        received_at: new Date().toISOString(),
      };
    }

    // 7 — прочитаны все исходящие до message_id
    case 7: {
      return {
        type: 'read_outgoing',
        peer_id: update[1],
        message_id: update[2],
        received_at: new Date().toISOString(),
      };
    }

    // 8 — друг онлайн
    case 8: {
      return {
        type: 'friend_online',
        user_id: -update[1],
        extra: update[2],
        timestamp: update[3],
        received_at: new Date().toISOString(),
      };
    }

    // 9 — друг оффлайн
    case 9: {
      return {
        type: 'friend_offline',
        user_id: -update[1],
        flags: update[2],
        timestamp: update[3],
        received_at: new Date().toISOString(),
      };
    }

    // 63 — набирает текст
    case 63: {
      return {
        type: 'typing',
        user_id: update[1],
        peer_id: update[1],
        received_at: new Date().toISOString(),
      };
    }

    default:
      return {
        type: `event_${eventCode}`,
        raw: update,
        received_at: new Date().toISOString(),
      };
  }
}

// ─── Фильтр: какие события отправлять в N8N ────

const FORWARD_EVENTS = new Set([
  'message_new',       // новые сообщения (входящие + исходящие)
  'read_incoming',     // прочтение входящих
  'typing',            // набирает текст
]);

// ─── Основной цикл User Long Poll ──────────────

async function startLongPoll() {
  let reconnectDelay = CONFIG.reconnect_delay;

  console.log('[User Long Poll] Запуск...');
  console.log(`  N8N Webhook: ${CONFIG.n8n_webhook_url}`);
  console.log(`  LP Mode: ${CONFIG.lp_mode}, LP Version: ${CONFIG.lp_version}`);

  while (true) {
    try {
      console.log('[User Long Poll] Получаю сервер...');
      const lpServer = await vkApi('messages.getLongPollServer', {
        need_pts: 1,
        lp_version: CONFIG.lp_version,
      });
      let { server, key, ts, pts } = lpServer;
      console.log(`[User Long Poll] Подключён. ts=${ts}, pts=${pts}`);

      reconnectDelay = CONFIG.reconnect_delay;

      try {
        await sendToN8N({
          type: 'system',
          event: 'user_longpoll_started',
          timestamp: new Date().toISOString(),
          stats,
        });
      } catch (e) {
        console.warn(`[User Long Poll] N8N webhook недоступен при старте: ${e.message}`);
      }

      // Цикл опроса
      while (true) {
        const pollUrl = `https://${server}?act=a_check&key=${key}&ts=${ts}&wait=25&mode=${CONFIG.lp_mode}&version=${CONFIG.lp_version}`;
        const response = await httpsGet(pollUrl);

        if (response.failed) {
          console.log(`[User Long Poll] failed=${response.failed}`);
          if (response.failed === 1) {
            ts = response.ts;
            continue;
          }
          // failed 2,3,4 — переполучить сервер
          break;
        }

        ts = response.ts;

        if (response.updates && response.updates.length > 0) {
          for (const update of response.updates) {
            const parsed = parseUpdate(update);

            if (FORWARD_EVENTS.has(parsed.type)) {
              stats.messages_received++;
              stats.last_message_at = new Date().toISOString();

              const label = parsed.type === 'message_new'
                ? `${parsed.is_outgoing ? 'OUT' : 'IN'} peer=${parsed.peer_id} "${(parsed.text || '').substring(0, 50)}"`
                : parsed.type;
              console.log(`[User Long Poll] ${label}`);

              try {
                await sendToN8N(parsed);
                stats.messages_sent_to_n8n++;
              } catch (err) {
                stats.errors++;
                console.error(`  -> Ошибка отправки: ${err.message}`);
              }
            }
          }
        }
      }

    } catch (err) {
      stats.errors++;
      stats.reconnects++;
      console.error(`[User Long Poll] Ошибка: ${err.message}`);
      console.log(`[User Long Poll] Переподключение через ${reconnectDelay / 1000}с...`);

      try {
        await sendToN8N({
          type: 'system',
          event: 'user_longpoll_error',
          error: err.message,
          timestamp: new Date().toISOString(),
          stats,
        });
      } catch (_) {}

      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, CONFIG.max_reconnect_delay);
    }
  }
}

// ─── HTTP-сервер для health-check ───────────────

const HEALTH_PORT = process.env.HEALTH_PORT || 3101;

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'vk-user-longpoll', ...stats }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

healthServer.listen(HEALTH_PORT, '127.0.0.1', () => {
  console.log(`[Health] http://127.0.0.1:${HEALTH_PORT}/health`);
});

// ─── Запуск ─────────────────────────────────────

startLongPoll().catch(err => {
  console.error('[User Long Poll] Фатальная ошибка:', err);
  process.exit(1);
});

process.on('SIGINT', () => { console.log('\n[User Long Poll] SIGINT — завершение...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('[User Long Poll] SIGTERM — завершение...'); process.exit(0); });
