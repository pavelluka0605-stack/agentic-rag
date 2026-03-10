#!/usr/bin/env node
/**
 * VK Groups Long Poll Listener — демон для прослушивания событий ВКонтакте.
 *
 * Слушает Long Poll API группы VK и отправляет события в N8N через webhook.
 * Работает как systemd-сервис с автоматическим переподключением.
 *
 * События:
 *   message_new      — новое ЛС в группу
 *   wall_reply_new   — новый комментарий к посту
 *   wall_reply_edit  — редактирование комментария
 *   wall_reply_delete — удаление комментария
 *
 * Переменные окружения (из .env):
 *   VK_TOKEN         — Access Token сообщества
 *   VK_GROUP_ID      — ID сообщества
 *   N8N_WEBHOOK_URL  — URL вебхука N8N (по умолчанию http://localhost:5678/webhook/vk-events)
 *   VK_API_VERSION   — версия API (по умолчанию 5.199)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Загрузка .env ──────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    // Попробуем родительский .env
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
  vk_token: process.env.VK_TOKEN,
  group_id: process.env.VK_GROUP_ID,
  n8n_webhook_url: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/vk-events',
  api_version: process.env.VK_API_VERSION || '5.199',
  reconnect_delay: 5000,
  max_reconnect_delay: 60000,
};

// Валидация
if (!CONFIG.vk_token) {
  console.error('[FATAL] VK_TOKEN не задан. Установите переменную окружения.');
  process.exit(1);
}
if (!CONFIG.group_id) {
  console.error('[FATAL] VK_GROUP_ID не задан. Установите переменную окружения.');
  process.exit(1);
}

// ─── Статистика ─────────────────────────────────
const stats = {
  started_at: new Date().toISOString(),
  events_received: 0,
  events_sent: 0,
  errors: 0,
  reconnects: 0,
  last_event_at: null,
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

function httpsGet(urlStr, timeout = 35000) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, { timeout }, (res) => {
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
    access_token: CONFIG.vk_token,
    v: CONFIG.api_version,
  });

  if (result.error) {
    throw new Error(`VK API ${method}: [${result.error.error_code}] ${result.error.error_msg}`);
  }
  return result.response;
}

// ─── Обработка событий ──────────────────────────

function formatEvent(update) {
  const base = {
    type: update.type,
    group_id: update.group_id,
    event_id: update.event_id,
    received_at: new Date().toISOString(),
  };

  switch (update.type) {
    case 'message_new':
      return {
        ...base,
        message: {
          from_id: update.object.message?.from_id,
          peer_id: update.object.message?.peer_id,
          text: update.object.message?.text,
          date: update.object.message?.date,
          conversation_message_id: update.object.message?.conversation_message_id,
          attachments: (update.object.message?.attachments || []).map(a => a.type),
        },
      };

    case 'wall_reply_new':
    case 'wall_reply_edit':
      return {
        ...base,
        comment: {
          id: update.object.id,
          from_id: update.object.from_id,
          post_id: update.object.post_id,
          text: update.object.text,
          date: update.object.date,
          owner_id: update.object.owner_id || update.object.post_owner_id,
        },
      };

    case 'wall_reply_delete':
      return {
        ...base,
        comment: {
          id: update.object.id,
          post_id: update.object.post_id,
          owner_id: update.object.owner_id,
          deleter_id: update.object.deleter_id,
        },
      };

    default:
      return { ...base, object: update.object };
  }
}

// ─── Основной цикл Long Poll ────────────────────

async function startLongPoll() {
  let reconnectDelay = CONFIG.reconnect_delay;

  console.log(`[VK Long Poll] Запуск...`);
  console.log(`  Group ID: ${CONFIG.group_id}`);
  console.log(`  N8N Webhook: ${CONFIG.n8n_webhook_url}`);
  console.log(`  API Version: ${CONFIG.api_version}`);

  while (true) {
    try {
      // Получаем Long Poll сервер
      console.log('[VK Long Poll] Получаю сервер...');
      const lpServer = await vkApi('groups.getLongPollServer', { group_id: CONFIG.group_id });
      let { server, key, ts } = lpServer;
      console.log(`[VK Long Poll] Подключён. ts=${ts}`);

      // Сброс reconnect delay при успешном подключении
      reconnectDelay = CONFIG.reconnect_delay;

      // Уведомление N8N о старте
      try {
        await sendToN8N({
          type: 'system',
          event: 'longpoll_started',
          timestamp: new Date().toISOString(),
          stats,
        });
      } catch (e) {
        console.warn(`[VK Long Poll] N8N webhook недоступен при старте: ${e.message}`);
      }

      // Цикл опроса
      while (true) {
        const pollUrl = `https://${server}?act=a_check&key=${key}&ts=${ts}&wait=25&mode=2&version=3`;
        const response = await httpsGet(pollUrl);

        // Обработка ошибок Long Poll
        if (response.failed) {
          console.log(`[VK Long Poll] failed=${response.failed}`);
          if (response.failed === 1) {
            ts = response.ts;
          } else {
            // failed 2 или 3 — нужно переполучить сервер
            break;
          }
          continue;
        }

        ts = response.ts;

        if (response.updates && response.updates.length > 0) {
          stats.events_received += response.updates.length;
          stats.last_event_at = new Date().toISOString();
          console.log(`[VK Long Poll] +${response.updates.length} событий (всего: ${stats.events_received})`);

          for (const update of response.updates) {
            const formatted = formatEvent(update);
            try {
              await sendToN8N(formatted);
              stats.events_sent++;
              console.log(`  -> ${update.type} отправлено в N8N`);
            } catch (err) {
              stats.errors++;
              console.error(`  -> Ошибка отправки ${update.type}: ${err.message}`);
            }
          }
        }
      }

    } catch (err) {
      stats.errors++;
      stats.reconnects++;
      console.error(`[VK Long Poll] Ошибка: ${err.message}`);
      console.log(`[VK Long Poll] Переподключение через ${reconnectDelay / 1000}с...`);

      // Попытка уведомить N8N
      try {
        await sendToN8N({
          type: 'system',
          event: 'longpoll_error',
          error: err.message,
          timestamp: new Date().toISOString(),
          stats,
        });
      } catch (_) {}

      await new Promise(r => setTimeout(r, reconnectDelay));
      // Экспоненциальный backoff (до 60с)
      reconnectDelay = Math.min(reconnectDelay * 2, CONFIG.max_reconnect_delay);
    }
  }
}

// ─── HTTP-сервер для health-check ───────────────

const HEALTH_PORT = process.env.HEALTH_PORT || 3100;

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ...stats }));
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
  console.error('[VK Long Poll] Фатальная ошибка:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => { console.log('\n[VK Long Poll] SIGINT — завершение...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('[VK Long Poll] SIGTERM — завершение...'); process.exit(0); });
