#!/bin/bash
# full-cycle-bridge.sh — Полный цикл: диагностика + автофикс + верификация
# Запускается на VPS через vps-remote-exec workflow

echo "╔══════════════════════════════════════════╗"
echo "║  CONTROL BRIDGE — ПОЛНЫЙ ЦИКЛ            ║"
echo "║  $(date -u '+%Y-%m-%d %H:%M:%S UTC')                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

ISSUES=0
FIXED=0

# ═══════════════════════════════════════════
# ФАЗА 1: ДИАГНОСТИКА
# ═══════════════════════════════════════════
echo "━━━ ФАЗА 1: ДИАГНОСТИКА ━━━"
echo ""

# 1.1 Сервис
echo "[1.1] control-bridge.service"
SVC_STATUS=$(systemctl is-active control-bridge 2>&1)
echo "  Статус: $SVC_STATUS"
if [ "$SVC_STATUS" != "active" ]; then
  echo "  ⚠ ПРОБЛЕМА: сервис не активен"
  ISSUES=$((ISSUES+1))
fi

# 1.2 Локальный health
echo "[1.2] Локальный health check (127.0.0.1:3000)"
LOCAL_HEALTH=$(curl -sf --max-time 5 http://127.0.0.1:3000/health 2>&1)
if [ $? -eq 0 ]; then
  echo "  OK: $LOCAL_HEALTH"
else
  echo "  ⚠ ПРОБЛЕМА: локальный health не отвечает"
  ISSUES=$((ISSUES+1))
fi

# 1.3 Docker bridge
echo "[1.3] Docker bridge (172.17.0.1:3000)"
BRIDGE_HEALTH=$(curl -sf --max-time 5 http://172.17.0.1:3000/health 2>&1)
if [ $? -eq 0 ]; then
  echo "  OK: $BRIDGE_HEALTH"
else
  echo "  ⚠ ПРОБЛЕМА: Docker bridge не доходит до сервиса"
  ISSUES=$((ISSUES+1))
fi

# 1.4 HTTPS
echo "[1.4] HTTPS (api.marbomebel.ru)"
HTTPS_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time 10 https://api.marbomebel.ru/health 2>/dev/null)
HTTPS_BODY=$(curl -sf --max-time 10 https://api.marbomebel.ru/health 2>/dev/null)
echo "  HTTP код: $HTTPS_CODE"
if [ "$HTTPS_CODE" = "200" ]; then
  echo "  OK: $HTTPS_BODY"
else
  echo "  ⚠ ПРОБЛЕМА: HTTPS возвращает $HTTPS_CODE"
  ISSUES=$((ISSUES+1))
fi

# 1.5 TLS сертификат
echo "[1.5] TLS сертификат"
CERT_INFO=$(echo | openssl s_client -servername api.marbomebel.ru -connect api.marbomebel.ru:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null)
if [ -n "$CERT_INFO" ]; then
  echo "  $CERT_INFO"
else
  echo "  ⚠ ПРОБЛЕМА: не удалось получить сертификат"
  ISSUES=$((ISSUES+1))
fi

# 1.6 DNS
echo "[1.6] DNS"
DNS_IP=$(dig +short api.marbomebel.ru 2>/dev/null || host -t A api.marbomebel.ru 2>/dev/null | awk '/has address/{print $NF}')
SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || echo "unknown")
echo "  DNS: $DNS_IP"
echo "  VPS: $SERVER_IP"
if [ "$DNS_IP" != "$SERVER_IP" ] && [ -n "$DNS_IP" ] && [ -n "$SERVER_IP" ]; then
  echo "  ⚠ ПРОБЛЕМА: DNS не указывает на этот сервер"
  ISSUES=$((ISSUES+1))
fi

# 1.7 Traefik
echo "[1.7] Traefik"
TRAEFIK_UP=$(docker ps --filter "name=traefik" --format '{{.Status}}' 2>/dev/null)
echo "  Traefik: ${TRAEFIK_UP:-НЕ НАЙДЕН}"
TRAEFIK_DYN=""
for d in /opt/n8n-traefik/dynamic /opt/traefik/dynamic /etc/traefik/dynamic; do
  [ -d "$d" ] && TRAEFIK_DYN="$d" && break
done
if [ -n "$TRAEFIK_DYN" ]; then
  if [ -f "$TRAEFIK_DYN/api-bridge.yml" ]; then
    echo "  Конфиг: $TRAEFIK_DYN/api-bridge.yml (есть)"
  else
    echo "  ⚠ ПРОБЛЕМА: api-bridge.yml отсутствует в $TRAEFIK_DYN"
    ISSUES=$((ISSUES+1))
  fi
else
  echo "  ⚠ ПРОБЛЕМА: директория Traefik dynamic не найдена"
  ISSUES=$((ISSUES+1))
fi

# 1.8 Nginx конфликт
echo "[1.8] Nginx конфликт"
if [ -f /etc/nginx/sites-enabled/api-marbomebel ]; then
  echo "  ⚠ ПРОБЛЕМА: nginx конфиг для api.marbomebel.ru найден (конфликт с Traefik)"
  ISSUES=$((ISSUES+1))
else
  echo "  OK: нет конфликта"
fi

# 1.9 Ресурсы
echo "[1.9] Ресурсы VPS"
MEM=$(free -m | awk 'NR==2{printf "%dM/%dM (%.0f%%)", $3, $2, $3/$2*100}')
DISK=$(df -h / | awk 'NR==2{printf "%s/%s (%s)", $3, $2, $5}')
LOAD=$(cat /proc/loadavg | awk '{print $1, $2, $3}')
PROCS=$(ps -e | wc -l)
ZOMBIES=$(ps -eo stat --no-headers | grep -c "^Z" 2>/dev/null || echo 0)
echo "  RAM: $MEM"
echo "  Диск: $DISK"
echo "  Load: $LOAD"
echo "  Процессы: $PROCS (зомби: $ZOMBIES)"

# 1.10 CORS
echo "[1.10] CORS проверка"
CORS_RESP=$(curl -sI -X OPTIONS https://api.marbomebel.ru/health \
  -H "Origin: https://chat.openai.com" \
  -H "Access-Control-Request-Method: GET" \
  --max-time 10 2>&1)
if echo "$CORS_RESP" | grep -qi "access-control-allow"; then
  echo "  OK: CORS headers присутствуют"
else
  echo "  ⚠ ПРОБЛЕМА: CORS headers отсутствуют"
  ISSUES=$((ISSUES+1))
fi

echo ""
echo "━━━ ИТОГО ДИАГНОСТИКА: $ISSUES проблем найдено ━━━"
echo ""

# ═══════════════════════════════════════════
# ФАЗА 2: АВТОФИКС (если есть проблемы)
# ═══════════════════════════════════════════
if [ $ISSUES -gt 0 ]; then
  echo "━━━ ФАЗА 2: АВТОФИКС ━━━"
  echo ""

  # 2.1 Рестарт сервиса если не работает
  if [ "$SVC_STATUS" != "active" ] || [ -z "$LOCAL_HEALTH" ]; then
    echo "[FIX] Рестарт control-bridge..."
    systemctl restart control-bridge
    sleep 3
    if systemctl is-active control-bridge >/dev/null 2>&1; then
      echo "  Сервис запущен"
      FIXED=$((FIXED+1))
    else
      echo "  Сервис не запустился! Логи:"
      journalctl -u control-bridge --no-pager -n 15
    fi
  fi

  # 2.2 Nginx конфликт
  if [ -f /etc/nginx/sites-enabled/api-marbomebel ]; then
    echo "[FIX] Удаляю nginx конфиг для api.marbomebel.ru..."
    rm -f /etc/nginx/sites-enabled/api-marbomebel
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null
    echo "  Удалено"
    FIXED=$((FIXED+1))
  fi

  # 2.3 Traefik конфиг
  if [ -n "$TRAEFIK_DYN" ] && [ ! -f "$TRAEFIK_DYN/api-bridge.yml" ]; then
    echo "[FIX] Создаю минимальный api-bridge.yml..."
    cat > "$TRAEFIK_DYN/api-bridge.yml" << 'YML'
http:
  routers:
    api-bridge:
      rule: "Host(`api.marbomebel.ru`)"
      entryPoints:
        - websecure
      service: api-bridge
      tls:
        certResolver: mytlschallenge
    api-bridge-http:
      rule: "Host(`api.marbomebel.ru`)"
      entryPoints:
        - web
      middlewares:
        - redirect-to-https
      service: api-bridge
  middlewares:
    redirect-to-https:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    api-bridge:
      loadBalancer:
        servers:
          - url: "http://172.17.0.1:3000"
YML
    echo "  Создано"
    FIXED=$((FIXED+1))
  fi

  # 2.4 Docker bridge — iptables
  if ! curl -sf --max-time 3 http://172.17.0.1:3000/health >/dev/null 2>&1; then
    echo "[FIX] Пробую добавить iptables правило для Docker bridge..."
    iptables -I DOCKER-USER -p tcp --dport 3000 -j ACCEPT 2>/dev/null && FIXED=$((FIXED+1)) || true
  fi

  # 2.5 Зомби
  if [ "$ZOMBIES" -gt 0 ]; then
    echo "[FIX] Очистка $ZOMBIES зомби-процессов..."
    ps -eo pid,ppid,stat --no-headers | awk '$3~/^Z/{print $2}' | sort -u | while read P; do
      kill -SIGCHLD $P 2>/dev/null
    done
    FIXED=$((FIXED+1))
  fi

  echo ""
  echo "━━━ АВТОФИКС ЗАВЕРШЁН: $FIXED исправлений ━━━"
  echo ""
fi

# ═══════════════════════════════════════════
# ФАЗА 3: ВЕРИФИКАЦИЯ
# ═══════════════════════════════════════════
echo "━━━ ФАЗА 3: ВЕРИФИКАЦИЯ ━━━"
echo ""

echo "[V1] Сервис:"
systemctl is-active control-bridge 2>&1

echo "[V2] Локальный health:"
curl -sf http://127.0.0.1:3000/health 2>&1 || echo "FAIL"

echo "[V3] Docker bridge:"
curl -sf --max-time 5 http://172.17.0.1:3000/health 2>&1 || echo "FAIL"

echo "[V4] HTTPS:"
FINAL_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time 10 https://api.marbomebel.ru/health 2>/dev/null)
FINAL_BODY=$(curl -sf --max-time 10 https://api.marbomebel.ru/health 2>/dev/null)
echo "  HTTP $FINAL_CODE: $FINAL_BODY"

echo "[V5] CORS:"
curl -sI -X OPTIONS https://api.marbomebel.ru/health \
  -H "Origin: https://chat.openai.com" \
  -H "Access-Control-Request-Method: GET" \
  --max-time 10 2>&1 | grep -i "access-control" || echo "  NO CORS HEADERS"

echo ""
echo "╔══════════════════════════════════════════╗"
if [ "$FINAL_CODE" = "200" ]; then
  echo "║  РЕЗУЛЬТАТ: API РАБОТАЕТ (HTTP 200)      ║"
else
  echo "║  РЕЗУЛЬТАТ: API НЕ РАБОТАЕТ (HTTP $FINAL_CODE)    ║"
fi
echo "║  Проблем найдено: $ISSUES                         ║"
echo "║  Исправлено: $FIXED                                ║"
echo "╚══════════════════════════════════════════╝"
