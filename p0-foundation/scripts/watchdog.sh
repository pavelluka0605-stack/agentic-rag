#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# P0 System Watchdog — мониторинг + самовосстановление
# Запускается каждые 5 минут через cron
#
# Что делает:
#   1. Проверяет сервисы — перезапускает упавшие
#   2. Проверяет что API реально отвечает — перезапускает зависшие
#   3. Убивает zombie/зависшие процессы на занятых портах
#   4. Реактивирует отключённые N8N workflows
#   5. Мониторит ресурсы VPS — чистит при нехватке
#   6. Чинит SQLite если заблокирована
#   7. Проверяет VK Long Poll активность
#   8. Шлёт алерт в Telegram с деталями
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

# Пути
WEBAPP_DB="/opt/webapp/memory.db"
WEBAPP_DIR="/opt/webapp"

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

ISSUES=""
RESTARTS=""
FIXES=""
CRITICAL=false

# ═══════════════════════════════════════════════════════════════
# 1. ПРОВЕРКА И АВТОРЕСТАРТ СЕРВИСОВ
# ═══════════════════════════════════════════════════════════════

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
      RESTARTS="${RESTARTS}\n  - <b>${name}</b> — перезапущен (был упавший)"
    else
      log "CRITICAL: $name failed to restart!"
      ISSUES="${ISSUES}\n  - <b>${name}</b> — НЕ ЗАПУСКАЕТСЯ"
      CRITICAL=true
    fi
    return
  fi

  # Проверить health endpoint
  if [ -n "$health_url" ]; then
    local resp
    resp=$(curl -s --max-time "$health_timeout" "$health_url" 2>/dev/null || echo "TIMEOUT")
    if echo "$resp" | grep -q "TIMEOUT\|Connection refused"; then
      log "WARN: $name running but health endpoint not responding — restarting"
      systemctl restart "$service" 2>/dev/null || true
      sleep 5
      RESTARTS="${RESTARTS}\n  - <b>${name}</b> — health не отвечал, перезапущен"
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

# Claude Chat (chat.marbomebel.ru)
if systemctl is-enabled --quiet claude-chat 2>/dev/null; then
  check_service "Claude Chat" "claude-chat" "http://localhost:3847/api/health" 10
fi


# ═══════════════════════════════════════════════════════════════
# 2. ГЛУБОКАЯ ПРОВЕРКА API — НЕ ПРОСТО "ЗАПУЩЕН", А "ОТВЕЧАЕТ"
# ═══════════════════════════════════════════════════════════════

# --- Webapp: проверка /health + /api/projects ---
if systemctl is-active --quiet webapp 2>/dev/null; then
  HEALTH_RESP=$(curl -s --max-time 10 http://localhost:8000/health 2>/dev/null || echo "TIMEOUT")

  if echo "$HEALTH_RESP" | grep -q "TIMEOUT\|Connection refused"; then
    log "FIX: Webapp /health не отвечает — перезапуск"
    systemctl restart webapp 2>/dev/null || true
    sleep 5
    FIXES="${FIXES}\n  - Webapp /health не отвечал — перезапущен"
  elif echo "$HEALTH_RESP" | grep -q '"status":"degraded"'; then
    # DB проблема — попробуем починить
    log "FIX: Webapp degraded — trying DB fix"
    fix_sqlite  # функция определена ниже, но bash выполнит после определения
    FIXES="${FIXES}\n  - Webapp degraded — попытка починки БД"
  fi

  # Проверка что API отдаёт данные
  API_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://localhost:8000/api/projects 2>/dev/null || echo "000")
  if [ "$API_CODE" = "000" ] || [ "$API_CODE" = "502" ] || [ "$API_CODE" = "503" ]; then
    log "FIX: Webapp /api/projects HTTP $API_CODE — перезапуск"
    systemctl restart webapp 2>/dev/null || true
    sleep 5
    FIXES="${FIXES}\n  - Webapp API вернул HTTP $API_CODE — перезапущен"
  elif [ "$API_CODE" = "500" ]; then
    ISSUES="${ISSUES}\n  - Webapp /api/projects — HTTP 500 (ошибка приложения)"
  fi
fi

# --- Claude Chat: проверка что API реально работает ---
if systemctl is-active --quiet claude-chat 2>/dev/null; then
  CHAT_HEALTH=$(curl -s --max-time 10 http://localhost:3847/api/health 2>/dev/null || echo "TIMEOUT")

  if echo "$CHAT_HEALTH" | grep -q "TIMEOUT\|Connection refused"; then
    log "FIX: Claude Chat /api/health не отвечает — перезапуск"

    # Убить zombie на порту 3847
    ZOMBIE_PID=$(lsof -ti :3847 2>/dev/null || true)
    if [ -n "$ZOMBIE_PID" ]; then
      kill -9 "$ZOMBIE_PID" 2>/dev/null || true
      sleep 2
    fi

    systemctl restart claude-chat 2>/dev/null || true
    sleep 5
    FIXES="${FIXES}\n  - Claude Chat: /api/health не отвечал — перезапущен"
  elif echo "$CHAT_HEALTH" | grep -q '"activeRequests"'; then
    # Проверить не зависли ли запросы
    ACTIVE=$(echo "$CHAT_HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('activeRequests',0))" 2>/dev/null || echo "0")
    UPTIME=$(echo "$CHAT_HEALTH" | python3 -c "import sys,json; print(int(json.load(sys.stdin).get('uptime',0)))" 2>/dev/null || echo "0")

    # Если activeRequests=2 (MAX) больше 10 мин — зависшие запросы, перезапуск
    if [ "${ACTIVE:-0}" -ge 2 ] && [ "${UPTIME:-0}" -gt 600 ]; then
      log "FIX: Claude Chat stuck — ${ACTIVE} active requests for too long, restarting"
      systemctl restart claude-chat 2>/dev/null || true
      sleep 5
      FIXES="${FIXES}\n  - Claude Chat: зависшие запросы (${ACTIVE} активных) — перезапущен"
    fi
  fi
fi

# --- N8N: проверка API + реактивация workflows ---
if systemctl is-active --quiet n8n 2>/dev/null && [ -n "$N8N_API_KEY" ]; then
  N8N_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    "http://localhost:5678/api/v1/workflows?limit=1" 2>/dev/null || echo "000")

  if [ "$N8N_CODE" = "000" ] || [ "$N8N_CODE" = "502" ] || [ "$N8N_CODE" = "503" ]; then
    log "FIX: N8N API HTTP $N8N_CODE — перезапуск"
    systemctl restart n8n 2>/dev/null || true
    sleep 10
    FIXES="${FIXES}\n  - N8N API не отвечал (HTTP $N8N_CODE) — перезапущен"
  fi
fi


# ═══════════════════════════════════════════════════════════════
# 3. ZOMBIE ПРОЦЕССЫ + ЗАНЯТЫЕ ПОРТЫ
# ═══════════════════════════════════════════════════════════════

kill_zombie_on_port() {
  local port="$1"
  local service="$2"

  # Найти PID процесса на порту
  local pid
  pid=$(lsof -ti ":${port}" 2>/dev/null || true)
  if [ -z "$pid" ]; then
    return
  fi

  # Проверить: это управляемый systemd процесс или zombie?
  local service_pid
  service_pid=$(systemctl show "$service" --property=MainPID 2>/dev/null | cut -d= -f2 || echo "0")

  if [ "$pid" != "$service_pid" ] && [ "$service_pid" != "0" ]; then
    # Порт занят НЕ systemd-процессом — zombie
    log "FIX: Killing zombie process $pid on port $port (service $service has PID $service_pid)"
    kill -9 "$pid" 2>/dev/null || true
    sleep 2
    systemctl restart "$service" 2>/dev/null || true
    sleep 3
    FIXES="${FIXES}\n  - Убит zombie PID $pid на порту $port, сервис $service перезапущен"
  fi
}

# Проверить ключевые порты
kill_zombie_on_port 5678 "n8n"
kill_zombie_on_port 8000 "webapp"
kill_zombie_on_port 3100 "vk-longpoll"
kill_zombie_on_port 3847 "claude-chat"


# ═══════════════════════════════════════════════════════════════
# 4. РЕАКТИВАЦИЯ N8N WORKFLOWS
# ═══════════════════════════════════════════════════════════════

if systemctl is-active --quiet n8n 2>/dev/null && [ -n "$N8N_API_KEY" ]; then
  # Получить все workflows
  ALL_WF=$(curl -s --max-time 15 -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    "http://localhost:5678/api/v1/workflows?limit=100" 2>/dev/null || echo "{}")

  # Найти неактивные P0-* workflows и реактивировать
  INACTIVE_WF=$(echo "$ALL_WF" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin).get('data', [])
    for w in data:
        if w['name'].startswith('P0-') and not w.get('active', False):
            print(f\"{w['id']}|{w['name']}\")
except:
    pass
" 2>/dev/null || true)

  if [ -n "$INACTIVE_WF" ]; then
    while IFS='|' read -r wf_id wf_name; do
      if [ -z "$wf_id" ]; then continue; fi
      log "FIX: Reactivating $wf_name (ID: $wf_id)"
      ACTIVATE_RESP=$(curl -s --max-time 10 -X POST \
        "http://localhost:5678/api/v1/workflows/${wf_id}/activate" \
        -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
        -H "Content-Type: application/json" 2>/dev/null || echo "{}")

      if echo "$ACTIVATE_RESP" | grep -q '"active":true'; then
        log "OK: $wf_name reactivated"
        FIXES="${FIXES}\n  - N8N <b>${wf_name}</b> — реактивирован"
      else
        log "WARN: Failed to reactivate $wf_name"
        ISSUES="${ISSUES}\n  - N8N <b>${wf_name}</b> — не удалось реактивировать"
      fi
    done <<< "$INACTIVE_WF"
  fi
fi


# ═══════════════════════════════════════════════════════════════
# 5. МОНИТОРИНГ РЕСУРСОВ + АВТООЧИСТКА
# ═══════════════════════════════════════════════════════════════

# Диск
DISK_USAGE=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')

if [ "$DISK_USAGE" -ge 95 ]; then
  CRITICAL=true
  log "FIX: Disk ${DISK_USAGE}% — aggressive cleanup"

  # 1. Сжать systemd journal до 50MB
  journalctl --vacuum-size=50M 2>/dev/null || true

  # 2. Очистить npm cache
  npm cache clean --force 2>/dev/null || true

  # 3. Удалить старые N8N execution data (старше 7 дней)
  find /root/.n8n/executions* -type f -mtime +7 -delete 2>/dev/null || true

  # 4. Очистить /tmp от старых файлов (>1 день)
  find /tmp -type f -mtime +1 -not -name "p0-*" -delete 2>/dev/null || true

  # 5. Очистить старые логи
  find /var/log -name "*.gz" -mtime +7 -delete 2>/dev/null || true
  find /var/log -name "*.old" -delete 2>/dev/null || true

  # Проверить результат
  DISK_AFTER=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
  FREED=$((DISK_USAGE - DISK_AFTER))
  FIXES="${FIXES}\n  - Диск: очистка (было ${DISK_USAGE}% → стало ${DISK_AFTER}%, освобождено ~${FREED}%)"
  DISK_USAGE=$DISK_AFTER

elif [ "$DISK_USAGE" -ge "$DISK_THRESHOLD" ]; then
  # Мягкая очистка
  journalctl --vacuum-size=100M 2>/dev/null || true
  find /tmp -type f -mtime +3 -not -name "p0-*" -delete 2>/dev/null || true
  ISSUES="${ISSUES}\n  - Диск: ${DISK_USAGE}% (свободно: ${DISK_AVAIL})"
fi

# RAM
RAM_TOTAL=$(free | awk '/Mem:/ {print $2}')
RAM_USED=$(free | awk '/Mem:/ {print $3}')
RAM_PCT=$(( RAM_USED * 100 / RAM_TOTAL ))
RAM_AVAIL_MB=$(free -m | awk '/Mem:/ {print $7}')

if [ "$RAM_PCT" -ge 95 ]; then
  log "FIX: RAM ${RAM_PCT}% — clearing caches"
  # Очистить page cache (безопасно)
  sync && echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
  RAM_AFTER_PCT=$(free | awk '/Mem:/ {printf "%.0f", $3*100/$2}')
  FIXES="${FIXES}\n  - RAM: очистка кэша (было ${RAM_PCT}% → ${RAM_AFTER_PCT}%)"
  RAM_PCT=$RAM_AFTER_PCT
elif [ "$RAM_PCT" -ge "$RAM_THRESHOLD" ]; then
  ISSUES="${ISSUES}\n  - RAM: ${RAM_PCT}% (свободно: ${RAM_AVAIL_MB}MB)"
fi

# Swap
SWAP_TOTAL=$(free | awk '/Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -gt 0 ]; then
  SWAP_USED=$(free | awk '/Swap:/ {print $3}')
  SWAP_PCT=$(( SWAP_USED * 100 / SWAP_TOTAL ))
  if [ "$SWAP_PCT" -ge "$SWAP_THRESHOLD" ]; then
    ISSUES="${ISSUES}\n  - Swap: ${SWAP_PCT}%"
  fi
fi

# CPU (средняя за 1 минуту)
CPU_LOAD=$(awk '{printf "%.0f", $1 * 100}' /proc/loadavg)
CPU_CORES=$(nproc)
CPU_PCT=$(( CPU_LOAD / CPU_CORES ))
if [ "$CPU_PCT" -ge "$CPU_THRESHOLD" ]; then
  ISSUES="${ISSUES}\n  - CPU: ${CPU_PCT}% (load: $(cut -d' ' -f1-3 /proc/loadavg))"
fi


# ═══════════════════════════════════════════════════════════════
# 6. SQLITE — ПРОВЕРКА + ПОЧИНКА
# ═══════════════════════════════════════════════════════════════

fix_sqlite() {
  local db_path="${1:-$WEBAPP_DB}"

  if [ ! -f "$db_path" ]; then
    return
  fi

  # Проверить что БД не заблокирована
  local lock_check
  lock_check=$(python3 -c "
import sqlite3, sys
try:
    conn = sqlite3.connect('$db_path', timeout=3)
    conn.execute('SELECT 1')
    conn.close()
    print('ok')
except sqlite3.OperationalError as e:
    print(f'locked: {e}')
except Exception as e:
    print(f'error: {e}')
" 2>/dev/null || echo "error")

  if echo "$lock_check" | grep -q "locked"; then
    log "FIX: SQLite locked — clearing lock"

    # Убить процессы которые держат lock
    fuser -k "$db_path" 2>/dev/null || true
    sleep 2

    # Перезапустить webapp
    systemctl restart webapp 2>/dev/null || true
    sleep 3
    FIXES="${FIXES}\n  - SQLite разблокирована (${db_path}), webapp перезапущен"

  elif echo "$lock_check" | grep -q "error"; then
    log "WARN: SQLite error — attempting integrity check"

    # Попробовать починить через integrity_check
    local integrity
    integrity=$(python3 -c "
import sqlite3
try:
    conn = sqlite3.connect('$db_path')
    result = conn.execute('PRAGMA integrity_check').fetchone()[0]
    print(result)
    conn.close()
except Exception as e:
    print(f'fail: {e}')
" 2>/dev/null || echo "fail")

    if [ "$integrity" != "ok" ]; then
      log "CRITICAL: SQLite corrupted — $integrity"
      # Бэкап поврежённой и создание новой
      cp "$db_path" "${db_path}.corrupted.$(date +%s)" 2>/dev/null || true
      ISSUES="${ISSUES}\n  - SQLite повреждена: $integrity (бэкап создан)"
      CRITICAL=true
    fi
  fi
}

# Проверить все SQLite файлы
for db_file in "$WEBAPP_DB" "${WEBAPP_DIR}/rag_embeddings.db"; do
  if [ -f "$db_file" ]; then
    fix_sqlite "$db_file"
  fi
done

# Удалить -wal/-shm файлы если webapp не работает (cleanup)
if ! systemctl is-active --quiet webapp 2>/dev/null; then
  rm -f "${WEBAPP_DB}-wal" "${WEBAPP_DB}-shm" 2>/dev/null || true
fi


# ═══════════════════════════════════════════════════════════════
# 7. VK LONG POLL — АКТИВНОСТЬ + РЕКОННЕКТ
# ═══════════════════════════════════════════════════════════════

LP_HEALTH=$(curl -s --max-time 3 http://127.0.0.1:3100/health 2>/dev/null || echo "{}")

# Проверить: много ошибок? → перезапустить
LP_ERRORS=$(echo "$LP_HEALTH" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    errors = d.get('errors', 0)
    received = d.get('events_received', 0)
    # Если ошибок > 10% от событий и ошибок > 5
    if errors > 5 and received > 0 and (errors / received) > 0.1:
        print(f'{errors}/{received}')
except:
    pass
" 2>/dev/null || echo "")

if [ -n "$LP_ERRORS" ]; then
  log "FIX: VK Long Poll high error rate ($LP_ERRORS) — restarting"
  systemctl restart vk-longpoll 2>/dev/null || true
  sleep 3
  FIXES="${FIXES}\n  - VK Long Poll: высокий % ошибок ($LP_ERRORS), перезапущен"
fi

# Проверить: нет событий давно? → предупредить
LP_STALE=$(echo "$LP_HEALTH" | python3 -c "
import sys, json
from datetime import datetime, timedelta, timezone
try:
    d = json.load(sys.stdin)
    last = d.get('last_event_at')
    reconnects = d.get('reconnects', 0)
    if last:
        dt = datetime.fromisoformat(last.replace('Z', '+00:00'))
        age = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        if age > 6:
            print(f'{age:.1f}h|{reconnects}')
except:
    pass
" 2>/dev/null || echo "")

if [ -n "$LP_STALE" ]; then
  LP_AGE=$(echo "$LP_STALE" | cut -d'|' -f1)
  LP_RECONN=$(echo "$LP_STALE" | cut -d'|' -f2)

  # Если больше 12 часов — перезапустить
  LP_AGE_INT=$(echo "$LP_AGE" | cut -d'.' -f1)
  if [ "${LP_AGE_INT:-0}" -ge 12 ]; then
    log "FIX: VK Long Poll no events for ${LP_AGE}h — restarting"
    systemctl restart vk-longpoll 2>/dev/null || true
    sleep 3
    FIXES="${FIXES}\n  - VK Long Poll: нет событий ${LP_AGE}ч — перезапущен"
  else
    ISSUES="${ISSUES}\n  - VK Long Poll: нет событий ${LP_AGE}ч (reconnects: $LP_RECONN)"
  fi
fi


# ═══════════════════════════════════════════════════════════════
# 8. N8N FAILED EXECUTIONS — МОНИТОРИНГ
# ═══════════════════════════════════════════════════════════════

N8N_ERRORS=""
if [ -n "$N8N_API_KEY" ]; then
  EXEC_RESP=$(curl -s --max-time 10 -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    "http://localhost:5678/api/v1/executions?status=error&limit=10" 2>/dev/null || echo "{}")

  N8N_ERRORS=$(echo "$EXEC_RESP" | python3 -c "
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
except:
    pass
" 2>/dev/null || echo "")

  if [ -n "$N8N_ERRORS" ]; then
    ISSUES="${ISSUES}\n  - N8N ошибки: ${N8N_ERRORS}"
  fi
fi


# ═══════════════════════════════════════════════════════════════
# 9. ПРОВЕРКА .ENV — ВСЕ КРИТИЧЕСКИЕ ПЕРЕМЕННЫЕ НА МЕСТЕ
# ═══════════════════════════════════════════════════════════════

MISSING_VARS=""
for var in VK_TOKEN VK_GROUP_ID TELEGRAM_BOT_TOKEN TELEGRAM_MANAGER_CHAT_ID GOOGLE_SPREADSHEET_ID; do
  val=$(eval echo "\${${var}:-}")
  if [ -z "$val" ]; then
    MISSING_VARS="${MISSING_VARS} ${var}"
  fi
done

if [ -n "$MISSING_VARS" ]; then
  ISSUES="${ISSUES}\n  - .env: отсутствуют переменные:${MISSING_VARS}"
fi

# Проверить Google SA файл
if [ ! -f "/opt/credentials/google-service-account.json" ]; then
  ISSUES="${ISSUES}\n  - Google SA JSON: файл отсутствует"
elif ! python3 -c "import json; json.load(open('/opt/credentials/google-service-account.json'))" 2>/dev/null; then
  ISSUES="${ISSUES}\n  - Google SA JSON: файл повреждён"
fi


# ═══════════════════════════════════════════════════════════════
# 10. СОХРАНИТЬ СОСТОЯНИЕ
# ═══════════════════════════════════════════════════════════════

python3 -c "
import json
from datetime import datetime
state = {
    'timestamp': datetime.now().isoformat(),
    'disk_pct': ${DISK_USAGE:-0},
    'ram_pct': ${RAM_PCT:-0},
    'cpu_pct': ${CPU_PCT:-0},
    'n8n_errors': '${N8N_ERRORS}',
    'has_issues': $([ -n "$ISSUES" ] && echo 'True' || echo 'False'),
    'has_restarts': $([ -n "$RESTARTS" ] && echo 'True' || echo 'False'),
    'has_fixes': $([ -n "$FIXES" ] && echo 'True' || echo 'False')
}
json.dump(state, open('$STATE_FILE', 'w'), indent=2)
" 2>/dev/null || true


# ═══════════════════════════════════════════════════════════════
# 11. ОТПРАВИТЬ АЛЕРТ В TELEGRAM
# ═══════════════════════════════════════════════════════════════

if [ -n "$RESTARTS" ] || [ -n "$ISSUES" ] || [ -n "$FIXES" ]; then
  MSG="🛡 <b>P0 Watchdog</b>\n⏰ $(date '+%d.%m.%Y %H:%M:%S')\n"

  if [ -n "$FIXES" ]; then
    MSG="${MSG}\n✅ <b>Автофикс:</b>${FIXES}\n"
  fi

  if [ -n "$RESTARTS" ]; then
    MSG="${MSG}\n🔄 <b>Перезапуск:</b>${RESTARTS}\n"
  fi

  if [ -n "$ISSUES" ]; then
    MSG="${MSG}\n⚠️ <b>Проблемы:</b>${ISSUES}\n"
  fi

  MSG="${MSG}\n📊 CPU: ${CPU_PCT:-?}% | RAM: ${RAM_PCT:-?}% | Диск: ${DISK_USAGE:-?}%"

  if [ "$CRITICAL" = true ]; then
    send_telegram "$(echo -e "$MSG")" "true"
  else
    send_telegram "$(echo -e "$MSG")"
  fi
  log "Alert sent: fixes=$([ -n "$FIXES" ] && echo 'yes' || echo 'no') restarts=$([ -n "$RESTARTS" ] && echo 'yes' || echo 'no') issues=$([ -n "$ISSUES" ] && echo 'yes' || echo 'no')"
else
  log "OK: all systems healthy"
fi


# ═══════════════════════════════════════════════════════════════
# 12. РОТАЦИЯ ЛОГА
# ═══════════════════════════════════════════════════════════════

if [ -f "$ALERT_LOG" ]; then
  LOG_SIZE=$(stat -c%s "$ALERT_LOG" 2>/dev/null || stat -f%z "$ALERT_LOG" 2>/dev/null || echo 0)
  if [ "$LOG_SIZE" -gt 5242880 ]; then  # > 5MB
    tail -1000 "$ALERT_LOG" > "${ALERT_LOG}.tmp"
    mv "${ALERT_LOG}.tmp" "$ALERT_LOG"
    log "Log rotated (was ${LOG_SIZE} bytes)"
  fi
fi
