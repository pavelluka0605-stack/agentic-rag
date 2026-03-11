#!/usr/bin/env bash
#
# P0 Foundation — Deploy Script для Frankfurt VPS (v1.2)
#
# Использование:
#   1. Скопируйте p0-foundation/ на VPS
#   2. Заполните .env (скопировав из .env.example)
#   3. Положите Google Service Account JSON в /opt/credentials/
#   4. Запустите: sudo bash scripts/deploy.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo "============================================"
echo "  P0 Foundation — Deployment"
echo "============================================"
echo ""

# ─── Проверка .env ────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  error ".env файл не найден!"
  echo "  Скопируйте: cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env"
  echo "  Заполните все значения и перезапустите скрипт."
  exit 1
fi

source "$ENV_FILE"

# Проверка минимальных credentials
MISSING=0
if [ -z "${VK_TOKEN:-}" ]; then error "VK_TOKEN не задан в .env"; MISSING=1; fi
if [ -z "${VK_GROUP_ID:-}" ]; then error "VK_GROUP_ID не задан в .env"; MISSING=1; fi
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then error "TELEGRAM_BOT_TOKEN не задан в .env"; MISSING=1; fi
if [ -z "${TELEGRAM_MANAGER_CHAT_ID:-}" ]; then error "TELEGRAM_MANAGER_CHAT_ID не задан в .env"; MISSING=1; fi
if [ $MISSING -eq 1 ]; then
  error "Заполните .env и перезапустите скрипт."
  exit 1
fi

log "Credentials проверены"

# ─── 1. Установка N8N (если не установлен) ────────
echo ""
echo "--- Шаг 1: N8N ---"
if command -v n8n &>/dev/null; then
  log "N8N уже установлен: $(n8n --version)"
else
  warn "N8N не установлен. Устанавливаю..."
  npm install -g n8n
  log "N8N установлен: $(n8n --version)"
fi

# Создать systemd unit для N8N (если нет)
if [ ! -f /etc/systemd/system/n8n.service ]; then
  cat > /etc/systemd/system/n8n.service << 'UNIT'
[Unit]
Description=N8N Workflow Automation
After=network.target

[Service]
Type=simple
User=root
Environment=N8N_PORT=5678
Environment=N8N_PROTOCOL=http
Environment=GENERIC_TIMEZONE=Europe/Moscow
Environment=N8N_SECURE_COOKIE=false
ExecStart=/usr/bin/env n8n start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=n8n

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable n8n
  systemctl start n8n
  log "N8N systemd сервис создан и запущен"

  # Подождать старт
  echo "  Ожидаю запуск N8N (до 30с)..."
  for i in $(seq 1 30); do
    if curl -s http://localhost:5678/healthz &>/dev/null; then
      log "N8N запущен на порту 5678"
      break
    fi
    sleep 1
  done
else
  # Убедиться что работает
  if ! systemctl is-active --quiet n8n; then
    systemctl start n8n
    sleep 5
  fi
  log "N8N systemd сервис уже существует"
fi

# ─── 2. VK Long Poll Listener ────────────────────
echo ""
echo "--- Шаг 2: VK Long Poll Listener ---"

mkdir -p /opt/vk-longpoll
cp "$PROJECT_DIR/vk-longpoll/listener.js" /opt/vk-longpoll/
cp "$PROJECT_DIR/vk-longpoll/package.json" /opt/vk-longpoll/

# Создать .env для listener
cat > /opt/vk-longpoll/.env << ENVEOF
VK_TOKEN=${VK_TOKEN}
VK_GROUP_ID=${VK_GROUP_ID}
N8N_WEBHOOK_URL=${N8N_WEBHOOK_BASE_URL:-http://localhost:5678/webhook}/vk-events
VK_API_VERSION=${VK_API_VERSION:-5.199}
HEALTH_PORT=3100
ENVEOF

log "VK Long Poll файлы скопированы"

# Systemd unit
cat > /etc/systemd/system/vk-longpoll.service << 'UNIT'
[Unit]
Description=VK Long Poll Listener for N8N
After=network.target n8n.service
Wants=n8n.service

[Service]
Type=simple
WorkingDirectory=/opt/vk-longpoll
EnvironmentFile=/opt/vk-longpoll/.env
ExecStart=/usr/bin/node /opt/vk-longpoll/listener.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vk-longpoll

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable vk-longpoll
systemctl restart vk-longpoll
log "VK Long Poll сервис запущен"

# ─── 2b. VK User Long Poll (личные сообщения) ────
echo ""
echo "--- Шаг 2b: VK User Long Poll (личка) ---"

if [ -n "${VK_USER_TOKEN:-}" ]; then
  mkdir -p /opt/vk-user-longpoll
  cp "$PROJECT_DIR/vk-user-longpoll/listener.js" /opt/vk-user-longpoll/
  cp "$PROJECT_DIR/vk-user-longpoll/package.json" /opt/vk-user-longpoll/

  cat > /opt/vk-user-longpoll/.env << ENVEOF
VK_USER_TOKEN=${VK_USER_TOKEN}
N8N_WEBHOOK_URL=${N8N_WEBHOOK_BASE_URL:-http://localhost:5678/webhook}/vk-user-messages
VK_API_VERSION=${VK_API_VERSION:-5.199}
HEALTH_PORT=3101
ENVEOF

  log "VK User Long Poll файлы скопированы"

  cat > /etc/systemd/system/vk-user-longpoll.service << 'UNIT'
[Unit]
Description=VK User Long Poll — личные сообщения в реальном времени
After=network.target n8n.service
Wants=n8n.service

[Service]
Type=simple
WorkingDirectory=/opt/vk-user-longpoll
EnvironmentFile=/opt/vk-user-longpoll/.env
ExecStart=/usr/bin/node /opt/vk-user-longpoll/listener.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vk-user-longpoll

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable vk-user-longpoll
  systemctl restart vk-user-longpoll
  log "VK User Long Poll сервис запущен"
else
  warn "VK_USER_TOKEN не задан — User Long Poll (личка) пропущен"
  echo "  Для чтения личных сообщений добавьте VK_USER_TOKEN в .env"
fi

# ─── 3. Telegram Bot Test ────────────────────────
echo ""
echo "--- Шаг 3: Telegram Bot ---"

TG_RESPONSE=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe")
if echo "$TG_RESPONSE" | grep -q '"ok":true'; then
  BOT_NAME=$(echo "$TG_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null || echo "unknown")
  log "Telegram бот работает: @$BOT_NAME"

  # Тестовое сообщение
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_MANAGER_CHAT_ID}" \
    -d "text=🔧 P0 Foundation Deploy\n\n✅ Telegram бот подключён\n⏰ $(date '+%d.%m.%Y %H:%M')\n🖥 Frankfurt VPS" \
    -d "parse_mode=HTML" > /dev/null
  log "Тестовое сообщение отправлено"
else
  error "Telegram бот не отвечает! Проверьте TELEGRAM_BOT_TOKEN"
fi

# ─── 4. Импорт workflows в N8N ──────────────────
echo ""
echo "--- Шаг 4: Импорт N8N workflows ---"

N8N_URL="${N8N_URL:-http://localhost:5678}"
WORKFLOW_DIR="$PROJECT_DIR/n8n-workflows"

# Бэкап
mkdir -p /opt/n8n-workflows
cp "$WORKFLOW_DIR"/*.json /opt/n8n-workflows/
log "Workflow JSON'ы скопированы в /opt/n8n-workflows/"

# Импорт через API
for wf_file in "$WORKFLOW_DIR"/P0-*.json; do
  wf_name=$(basename "$wf_file" .json)
  echo "  Импортирую: $wf_name..."

  RESPONSE=$(curl -s -X POST "${N8N_URL}/api/v1/workflows" \
    -H "Content-Type: application/json" \
    -d @"$wf_file" 2>&1)

  if echo "$RESPONSE" | grep -q '"id"'; then
    WF_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "?")
    log "  $wf_name → ID: $WF_ID"
  else
    warn "  $wf_name — возможно требуется ручной импорт через UI"
    echo "    Ответ: $(echo "$RESPONSE" | head -c 200)"
  fi
done

# ─── 5. Credentials в N8N ───────────────────────
echo ""
echo "--- Шаг 5: N8N Credentials ---"
warn "Credentials рекомендуется создать через UI N8N:"
echo "  1. Откройте ${N8N_URL} в браузере"
echo "  2. Settings → Credentials → Add Credential"
echo "  3. Создайте:"
echo "     - Telegram API: вставьте Bot Token"
echo "     - Google Sheets: загрузите Service Account JSON"
echo "     - HTTP Header Auth (VK): Authorization = Bearer <VK_TOKEN>"
echo ""
echo "  4. В каждом workflow обновите ссылки на credentials"

# ─── 6. Финальная проверка ───────────────────────
echo ""
echo "============================================"
echo "  Итоговая проверка"
echo "============================================"

# N8N
if curl -s http://localhost:5678/healthz &>/dev/null; then
  log "N8N:          работает (порт 5678)"
else
  error "N8N:          НЕ работает"
fi

# Long Poll
if curl -s http://127.0.0.1:3100/health &>/dev/null; then
  LP_EVENTS=$(curl -s http://127.0.0.1:3100/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('events_received',0))" 2>/dev/null || echo "?")
  log "VK Long Poll: работает (events: $LP_EVENTS)"
else
  warn "VK Long Poll: может потребоваться несколько секунд для запуска"
fi

# User Long Poll
if [ -n "${VK_USER_TOKEN:-}" ]; then
  if curl -s http://127.0.0.1:3101/health &>/dev/null; then
    LP_MSGS=$(curl -s http://127.0.0.1:3101/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('messages_received',0))" 2>/dev/null || echo "?")
    log "User LongPoll: работает (msgs: $LP_MSGS)"
  else
    warn "User LongPoll: может потребоваться несколько секунд для запуска"
  fi
fi

# Telegram
if echo "$TG_RESPONSE" | grep -q '"ok":true'; then
  log "Telegram:     работает"
else
  error "Telegram:     проблема"
fi

echo ""
echo "============================================"
echo "  Следующие шаги:"
echo "============================================"
echo ""
echo "  1. Создайте credentials в N8N UI (${N8N_URL})"
echo "  2. Запустите workflow P0-01_Init_Google_Sheets (один раз)"
echo "  3. Запустите workflow P0-02_Test_Telegram (один раз)"
echo "  4. Активируйте P0-03_VK_Event_Receiver"
echo "  5. Активируйте P0-04_Health_Check"
echo "  6. Проведите тест: напишите комментарий в группе VK"
echo ""
echo "  Логи: journalctl -u vk-longpoll -f"
echo "         journalctl -u vk-user-longpoll -f"
echo "         journalctl -u n8n -f"
echo ""
log "Deploy завершён!"
