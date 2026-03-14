#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# P0 System Watchdog — мониторинг, авторестарт, алерты
# Запускается каждые 5 минут через cron
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Конфигурация ────────────────────────────────────────────
ALERT_LOG="/var/log/p0-watchdog.log"
STATE_FILE="/tmp/p0-watchdog-state.json"
COOLDOWN_FILE="/tmp/p0-watchdog-cooldown"
COOLDOWN_MINUTES=30  # Не слать алерты чаще чем раз в 30 мин (кроме критических)

# Пороги ресурсов
DISK_THRESHOLD=90     # %
RAM_THRESHOLD=85      # %
CPU_THRESHOLD=90      # % (средняя за 1 мин)
SWAP_THRESHOLD=80     # %

# Загрузить env
source /opt/p0-foundation/.env 2>/dev/null || true

TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT="${TELEGRAM_MANAGER_CHAT_ID:-}"
N8N_API_KEY="${N8N_API_KEY:-}"

# ─── Функции ─────────────────────────────────────────────────

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$ALERT_LOG"
}

send_telegram() {
  local text="$1"
  local force="${2:-false}"

  if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT" ]; then
    log "WARN: Telegram credentials not set"
    return 1
  fi

  # Cooldown: не спамить алертами
  if [ "$force" != "true" ] && [ -f "$COOLDOWN_FILE" ]; then
    local last_sent
    last_sent=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local diff=$(( now - last_sent ))
    if [ "$diff" -lt $(( COOLDOWN_MINUTES * 60 )) ]; then
      log "Cooldown active ($diff sec since last alert), skipping Telegram"
      return 0
    fi
  fi

  curl -s --max-time 10 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "
import json, sys
text = sys.argv[1]
print(json.dumps({
    'chat_id': '$TG_CHAT',
    'text': text,
    'parse_mode': 'HTML'
}))
" "$text")" > /dev/null 2>&1

  date +%s > "$COOLDOWN_FILE"
  log "Telegram alert sent"
}

# ─── 1. Проверка сервисов + авторестарт ──────────────────────

ISSUES=""
RESTARTS=""
CRITICAL=false

check_service() {
  local name="$1"
  local service="$2"
  local health_url="${3:-}"
  local health_timeout="${4:-3}"

  if ! systemctl is-active --quiet "$service" 2>/dev/null; then
    log "ALERT: $name ($service) is DOWN — restarting..."
    systemctl restart "$service" 2>/dev/null || true
    sleep 5

    if systemctl is-active --quiet "$service" 2>/dev/null; then
      log "OK: $name restarted successfully"
      RESTARTS="${RESTARTS}\n🔄 <b>${name}</b> — перезапущен (был упавший)"
    else
      log "CRITICAL: $name failed to restart!"
      ISSUES="${ISSUES}\n🔴 <b>${name}</b> — НЕ ЗАПУСКАЕТСЯ"
      CRITICAL=true
    fi
    return
  fi

  # Проверить health endpoint
  if [ -n "$health_url" ]; then
    local resp
    resp=$(curl -s --max-time "$health_timeout" "$health_url" 2>/dev/null || echo "TIMEOUT")
    if echo "$resp" | grep -q "TIMEOUT\|Connection refused"; then
      log "WARN: $name running but health endpoint not responding"
      ISSUES="${ISSUES}\n🟡 <b>${name}</b> — запущен, но health не отвечает"
    fi
  fi
}

# N8N
check_service "N8N" "n8n" "http://localhost:5678/healthz" 5

# VK Long Poll (Groups)
check_service "VK Long Poll" "vk-longpoll" "http://127.0.0.1:3100/health"

# VK User Long Poll
if systemctl is-enabled --quiet vk-user-longpoll 2>/dev/null; then
  check_service "VK User Long Poll" "vk-user-longpoll" "http://127.0.0.1:3101/health"
fi

# FastAPI Webapp
if systemctl is-enabled --quiet webapp 2>/dev/null; then
  check_service "Webapp" "webapp" "http://localhost:8000/" 5
fi

# ─── 1b. Проверка что API реально отвечает на запросы ────────

# Проверка webapp /health (функциональная, не только "порт открыт")
if systemctl is-active --quiet webapp 2>/dev/null; then
  HEALTH_RESP=$(curl -s --max-time 10 http://localhost:8000/health 2>/dev/null || echo "TIMEOUT")
  if echo "$HEALTH_RESP" | grep -q "TIMEOUT\|Connection refused"; then
    log "WARN: Webapp /health не отвечает — перезапуск"
    systemctl restart webapp 2>/dev/null || true
    RESTARTS="${RESTARTS}\n🔄 <b>Webapp</b> — /health не отвечал, перезапущен"
  elif echo "$HEALTH_RESP" | grep -q '"status":"degraded"'; then
    ISSUES="${ISSUES}\n🟡 <b>Webapp</b> — работает, но degraded: $(echo "$HEALTH_RESP" | head -c 200)"
  fi

  # Проверка что API отдаёт данные (простой GET)
  API_RESP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://localhost:8000/api/projects 2>/dev/null || echo "000")
  if [ "$API_RESP" = "000" ] || [ "$API_RESP" = "502" ] || [ "$API_RESP" = "503" ]; then
    log "WARN: Webapp /api/projects вернул HTTP $API_RESP"
    ISSUES="${ISSUES}\n🟡 <b>Webapp API</b> — HTTP $API_RESP на /api/projects"
  fi
fi

# Проверка N8N API
if systemctl is-active --quiet n8n 2>/dev/null && [ -n "$N8N_API_KEY" ]; then
  N8N_RESP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    "http://localhost:5678/api/v1/workflows?limit=1" 2>/dev/null || echo "000")
  if [ "$N8N_RESP" = "000" ] || [ "$N8N_RESP" = "502" ] || [ "$N8N_RESP" = "503" ]; then
    log "WARN: N8N API вернул HTTP $N8N_RESP — перезапуск"
    systemctl restart n8n 2>/dev/null || true
    sleep 10
    RESTARTS="${RESTARTS}\n🔄 <b>N8N</b> — API не отвечал (HTTP $N8N_RESP), перезапущен"
  fi
fi

# ─── 2. Проверка ресурсов VPS ────────────────────────────────

# Диск
DISK_USAGE=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
if [ "$DISK_USAGE" -ge "$DISK_THRESHOLD" ]; then
  ISSUES="${ISSUES}\n💾 <b>Диск</b>: ${DISK_USAGE}% (свободно: ${DISK_AVAIL})"
  if [ "$DISK_USAGE" -ge 95 ]; then
    CRITICAL=true
    # Попробовать почистить systemd journal
    journalctl --vacuum-size=100M 2>/dev/null || true
    log "Auto-cleaned journal (disk ${DISK_USAGE}%)"
  fi
fi

# RAM
RAM_TOTAL=$(free | awk '/Mem:/ {print $2}')
RAM_USED=$(free | awk '/Mem:/ {print $3}')
RAM_PCT=$(( RAM_USED * 100 / RAM_TOTAL ))
RAM_AVAIL_MB=$(free -m | awk '/Mem:/ {print $7}')
if [ "$RAM_PCT" -ge "$RAM_THRESHOLD" ]; then
  ISSUES="${ISSUES}\n🧠 <b>RAM</b>: ${RAM_PCT}% (свободно: ${RAM_AVAIL_MB}MB)"
fi

# Swap
SWAP_TOTAL=$(free | awk '/Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -gt 0 ]; then
  SWAP_USED=$(free | awk '/Swap:/ {print $3}')
  SWAP_PCT=$(( SWAP_USED * 100 / SWAP_TOTAL ))
  if [ "$SWAP_PCT" -ge "$SWAP_THRESHOLD" ]; then
    ISSUES="${ISSUES}\n📀 <b>Swap</b>: ${SWAP_PCT}%"
  fi
fi

# CPU (средняя за 1 минуту)
CPU_LOAD=$(awk '{printf "%.0f", $1 * 100}' /proc/loadavg)
CPU_CORES=$(nproc)
CPU_PCT=$(( CPU_LOAD / CPU_CORES ))
if [ "$CPU_PCT" -ge "$CPU_THRESHOLD" ]; then
  ISSUES="${ISSUES}\n⚡ <b>CPU</b>: ${CPU_PCT}% (load: $(cat /proc/loadavg | cut -d' ' -f1-3))"
fi

# ─── 3. Проверка N8N failed executions ──────────────────────

N8N_ERRORS=""
if [ -n "$N8N_API_KEY" ]; then
  # Получить executions за последние 30 минут
  SINCE=$(date -d '30 minutes ago' -Iseconds 2>/dev/null || date -v-30M -Iseconds 2>/dev/null || echo "")
  if [ -n "$SINCE" ]; then
    EXEC_RESP=$(curl -s --max-time 10 -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
      "http://localhost:5678/api/v1/executions?status=error&limit=10" 2>/dev/null || echo "{}")

    FAILED_COUNT=$(echo "$EXEC_RESP" | python3 -c "
import sys, json
from datetime import datetime, timedelta, timezone
try:
    data = json.load(sys.stdin)
    execs = data.get('data', [])
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    recent_fails = []
    for e in execs:
        finished = e.get('stoppedAt') or e.get('startedAt', '')
        if not finished:
            continue
        try:
            # Parse ISO date
            dt = datetime.fromisoformat(finished.replace('Z', '+00:00'))
            if dt > cutoff:
                wf_name = e.get('workflowData', {}).get('name', e.get('workflowId', '?'))
                recent_fails.append(wf_name)
        except:
            pass
    if recent_fails:
        from collections import Counter
        counts = Counter(recent_fails)
        parts = [f'{name} ({cnt}x)' if cnt > 1 else name for name, cnt in counts.items()]
        print(', '.join(parts))
    else:
        print('')
except Exception as ex:
    print('')
" 2>/dev/null || echo "")

    if [ -n "$FAILED_COUNT" ]; then
      ISSUES="${ISSUES}\n⚠️ <b>N8N ошибки</b>: ${FAILED_COUNT}"
      N8N_ERRORS="$FAILED_COUNT"
    fi
  fi
fi

# ─── 4. Проверка VK Long Poll: нет событий давно ────────────

LP_STALE=""
LP_HEALTH=$(curl -s --max-time 3 http://127.0.0.1:3100/health 2>/dev/null || echo "{}")
LP_LAST_EVENT=$(echo "$LP_HEALTH" | python3 -c "
import sys, json
from datetime import datetime, timedelta, timezone
try:
    d = json.load(sys.stdin)
    last = d.get('last_event_at')
    if last:
        dt = datetime.fromisoformat(last.replace('Z', '+00:00'))
        age = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        if age > 6:
            print(f'{age:.1f}h')
except:
    pass
" 2>/dev/null || echo "")

if [ -n "$LP_LAST_EVENT" ]; then
  ISSUES="${ISSUES}\n📡 <b>VK Long Poll</b>: нет событий ${LP_LAST_EVENT}"
fi

# ─── 5. Сохранить состояние ──────────────────────────────────

python3 -c "
import json
from datetime import datetime
state = {
    'timestamp': datetime.now().isoformat(),
    'disk_pct': $DISK_USAGE,
    'ram_pct': $RAM_PCT,
    'cpu_pct': $CPU_PCT,
    'n8n_errors': '${N8N_ERRORS}',
    'issues': $([ -n "$ISSUES" ] && echo 'True' || echo 'False'),
    'restarts': $([ -n "$RESTARTS" ] && echo 'True' || echo 'False')
}
json.dump(state, open('$STATE_FILE', 'w'), indent=2)
" 2>/dev/null || true

# ─── 6. Отправить алерт если есть проблемы ──────────────────

if [ -n "$RESTARTS" ] || [ -n "$ISSUES" ]; then
  MSG="🛡 <b>P0 Watchdog Alert</b>\n"
  MSG="${MSG}⏰ $(date '+%d.%m.%Y %H:%M:%S')\n"

  if [ -n "$RESTARTS" ]; then
    MSG="${MSG}\n<b>Авторестарт:</b>${RESTARTS}\n"
  fi

  if [ -n "$ISSUES" ]; then
    MSG="${MSG}\n<b>Проблемы:</b>${ISSUES}\n"
  fi

  # Добавить сводку ресурсов
  MSG="${MSG}\n📊 CPU: ${CPU_PCT}% | RAM: ${RAM_PCT}% | Диск: ${DISK_USAGE}%"

  if [ "$CRITICAL" = true ]; then
    send_telegram "$(echo -e "$MSG")" "true"
  else
    send_telegram "$(echo -e "$MSG")"
  fi
  log "Alert: issues=${ISSUES}, restarts=${RESTARTS}"
else
  log "OK: all services healthy, resources normal"
fi

# ─── 7. Ротация лога ────────────────────────────────────────

if [ -f "$ALERT_LOG" ]; then
  LOG_SIZE=$(stat -f%z "$ALERT_LOG" 2>/dev/null || stat -c%s "$ALERT_LOG" 2>/dev/null || echo 0)
  if [ "$LOG_SIZE" -gt 5242880 ]; then  # > 5MB
    tail -1000 "$ALERT_LOG" > "${ALERT_LOG}.tmp"
    mv "${ALERT_LOG}.tmp" "$ALERT_LOG"
    log "Log rotated (was ${LOG_SIZE} bytes)"
  fi
fi
