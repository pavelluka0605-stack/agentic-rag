#!/bin/bash
# =============================================================
# VPS System Audit — полный аудит безопасности и конфигурации
# Запуск: через remote exec или напрямую на VPS
# =============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

pass()  { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARN++)); }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
info()  { echo -e "      $1"; }

echo "=============================================="
echo " VPS SYSTEM AUDIT — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "=============================================="

# --- 1. Система ---
echo ""
echo "=== 1. СИСТЕМА ==="
uname -a
echo ""
uptime
echo ""

# RAM
MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
if [ "$MEM_PCT" -lt 80 ]; then
  pass "RAM: ${MEM_USED}/${MEM_TOTAL}MB (${MEM_PCT}%)"
elif [ "$MEM_PCT" -lt 95 ]; then
  warn "RAM: ${MEM_USED}/${MEM_TOTAL}MB (${MEM_PCT}%) — высокое потребление"
else
  fail "RAM: ${MEM_USED}/${MEM_TOTAL}MB (${MEM_PCT}%) — критично!"
fi

# Disk
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "$DISK_PCT" -lt 80 ]; then
  pass "Disk /: ${DISK_PCT}% использовано"
elif [ "$DISK_PCT" -lt 95 ]; then
  warn "Disk /: ${DISK_PCT}% — мало места"
else
  fail "Disk /: ${DISK_PCT}% — критично мало места!"
fi

# --- 2. Безопасность SSH ---
echo ""
echo "=== 2. SSH БЕЗОПАСНОСТЬ ==="

SSHD_CONFIG="/etc/ssh/sshd_config"
if [ -f "$SSHD_CONFIG" ]; then
  # Root login
  ROOT_LOGIN=$(grep -i "^PermitRootLogin" "$SSHD_CONFIG" 2>/dev/null | awk '{print $2}' || echo "not set")
  if [ "$ROOT_LOGIN" = "no" ] || [ "$ROOT_LOGIN" = "prohibit-password" ]; then
    pass "PermitRootLogin: $ROOT_LOGIN"
  else
    warn "PermitRootLogin: $ROOT_LOGIN — рекомендуется 'no' или 'prohibit-password'"
  fi

  # Password auth
  PASS_AUTH=$(grep -i "^PasswordAuthentication" "$SSHD_CONFIG" 2>/dev/null | awk '{print $2}' || echo "not set")
  if [ "$PASS_AUTH" = "no" ]; then
    pass "PasswordAuthentication: no (только ключи)"
  else
    warn "PasswordAuthentication: $PASS_AUTH — рекомендуется 'no'"
  fi

  # SSH port
  SSH_PORT=$(grep -i "^Port " "$SSHD_CONFIG" 2>/dev/null | awk '{print $2}' || echo "22")
  if [ "$SSH_PORT" != "22" ]; then
    pass "SSH порт: $SSH_PORT (нестандартный)"
  else
    warn "SSH порт: 22 (стандартный — видим сканерам)"
  fi
else
  warn "sshd_config не найден"
fi

# --- 3. Firewall ---
echo ""
echo "=== 3. FIREWALL ==="

if command -v ufw &>/dev/null; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -q "active"; then
    pass "UFW: активен"
    ufw status numbered 2>/dev/null | head -20
  else
    warn "UFW установлен, но НЕ активен"
  fi
elif command -v firewall-cmd &>/dev/null; then
  FW_STATE=$(firewall-cmd --state 2>/dev/null || echo "unknown")
  if [ "$FW_STATE" = "running" ]; then
    pass "firewalld: running"
    firewall-cmd --list-all 2>/dev/null | head -20
  else
    warn "firewalld: $FW_STATE"
  fi
else
  # Check iptables
  IPTABLES_RULES=$(iptables -L -n 2>/dev/null | wc -l || echo "0")
  if [ "$IPTABLES_RULES" -gt 8 ]; then
    pass "iptables: $IPTABLES_RULES правил"
  else
    warn "Firewall не настроен (нет UFW/firewalld, мало правил iptables)"
  fi
fi

# --- 4. Открытые порты ---
echo ""
echo "=== 4. ОТКРЫТЫЕ ПОРТЫ ==="
ss -tlnp 2>/dev/null | grep LISTEN || echo "нет слушающих портов"

# Check for unexpected public ports
UNEXPECTED_PORTS=$(ss -tlnp 2>/dev/null | grep -E '0\.0\.0\.0:|:::' | grep -vE ':(22|80|443|5678|3900|8443|2053)\s' || true)
if [ -n "$UNEXPECTED_PORTS" ]; then
  warn "Неожиданные публичные порты:"
  echo "$UNEXPECTED_PORTS"
else
  pass "Нет неожиданных публичных портов"
fi

# --- 5. Сервисы ---
echo ""
echo "=== 5. СЕРВИСЫ ==="

# N8N
if systemctl is-active n8n &>/dev/null || docker ps --format '{{.Names}}' 2>/dev/null | grep -q n8n; then
  pass "N8N: работает"
else
  warn "N8N: не найден как systemd/docker"
fi

# Nginx
if systemctl is-active nginx &>/dev/null; then
  pass "Nginx: работает"
  nginx -T 2>/dev/null | grep -E "server_name|listen" | head -20
else
  info "Nginx: не запущен (может быть не нужен)"
fi

# Docker
if command -v docker &>/dev/null; then
  DOCKER_RUNNING=$(docker ps -q 2>/dev/null | wc -l)
  pass "Docker: $DOCKER_RUNNING контейнеров"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -15
else
  info "Docker: не установлен"
fi

# Claude Code
if command -v claude &>/dev/null; then
  pass "Claude Code: $(claude --version 2>/dev/null || echo 'установлен')"
else
  info "Claude Code: не установлен на этом сервере"
fi

# Watchdog
if crontab -l 2>/dev/null | grep -q watchdog; then
  pass "Watchdog: настроен в cron"
else
  warn "Watchdog: не найден в cron"
fi

# --- 6. SSL/TLS ---
echo ""
echo "=== 6. SSL/TLS ==="

if [ -d /etc/letsencrypt/live ]; then
  for cert_dir in /etc/letsencrypt/live/*/; do
    domain=$(basename "$cert_dir")
    if [ "$domain" = "README" ]; then continue; fi
    expiry=$(openssl x509 -enddate -noout -in "${cert_dir}fullchain.pem" 2>/dev/null | cut -d= -f2)
    if [ -n "$expiry" ]; then
      exp_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo "0")
      now_epoch=$(date +%s)
      days_left=$(( (exp_epoch - now_epoch) / 86400 ))
      if [ "$days_left" -gt 30 ]; then
        pass "SSL $domain: $days_left дней до истечения"
      elif [ "$days_left" -gt 7 ]; then
        warn "SSL $domain: $days_left дней — скоро истечёт!"
      else
        fail "SSL $domain: $days_left дней — КРИТИЧНО!"
      fi
    fi
  done
else
  info "Let's Encrypt: не настроен"
fi

# --- 7. Обновления ---
echo ""
echo "=== 7. ОБНОВЛЕНИЯ БЕЗОПАСНОСТИ ==="

if command -v apt &>/dev/null; then
  SECURITY_UPDATES=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo "?")
  if [ "$SECURITY_UPDATES" = "0" ] || [ "$SECURITY_UPDATES" = "?" ]; then
    pass "Нет ожидающих security-обновлений (или не удалось проверить)"
  else
    warn "Есть $SECURITY_UPDATES security-обновлений"
  fi
fi

# --- 8. Fail2ban ---
echo ""
echo "=== 8. FAIL2BAN ==="

if command -v fail2ban-client &>/dev/null && systemctl is-active fail2ban &>/dev/null; then
  pass "fail2ban: активен"
  fail2ban-client status sshd 2>/dev/null | head -10 || true
else
  warn "fail2ban: не установлен или не активен — рекомендуется для SSH"
fi

# --- 9. Cron & Scheduled Tasks ---
echo ""
echo "=== 9. CRON ==="
crontab -l 2>/dev/null || echo "Нет cron задач"

# --- 10. Git repos ---
echo ""
echo "=== 10. GIT REPOSITORIES ==="
find /root /home /opt -maxdepth 4 -name '.git' -type d 2>/dev/null | while read g; do
  dir=$(dirname "$g")
  branch=$(cd "$dir" && git branch --show-current 2>/dev/null)
  remote=$(cd "$dir" && git remote get-url origin 2>/dev/null || echo "no remote")
  echo "  $dir [$branch] → $remote"
done

# --- 11. Claude Code Configs ---
echo ""
echo "=== 11. CLAUDE CODE CONFIG ==="
echo "--- CLAUDE.md files ---"
find /root /home /opt -maxdepth 4 -name 'CLAUDE.md' -type f 2>/dev/null || echo "нет"
echo "--- .mcp.json ---"
find /root /home /opt -maxdepth 4 -name '.mcp.json' -type f 2>/dev/null || echo "нет"
echo "--- .claudeignore ---"
find /root /home /opt -maxdepth 4 -name '.claudeignore' -type f 2>/dev/null || echo "нет"
echo "--- .claude dirs ---"
find /root /home /opt -maxdepth 3 -name '.claude' -type d 2>/dev/null || echo "нет"
echo "--- settings.json ---"
find /root /home /opt -maxdepth 5 -name 'settings.json' -path '*/.claude/*' -type f 2>/dev/null || echo "нет"

# --- 12. .env files (existence only, NOT contents) ---
echo ""
echo "=== 12. ENV FILES (пути, не содержимое!) ==="
find /root /home /opt -maxdepth 4 -name '.env' -type f 2>/dev/null | head -20 || echo "нет"

# --- Summary ---
echo ""
echo "=============================================="
echo " ИТОГО: ${GREEN}${PASS} PASS${NC} | ${YELLOW}${WARN} WARN${NC} | ${RED}${FAIL} FAIL${NC}"
echo "=============================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "❗ Есть критические проблемы — требуется внимание!"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "⚠ Есть предупреждения — рекомендуется проверить"
  exit 0
else
  echo "✅ Всё в порядке"
  exit 0
fi
