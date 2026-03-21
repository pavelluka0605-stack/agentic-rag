#!/bin/bash
# =============================================================
# VPS Security Hardening — применение базовых мер безопасности
# ВНИМАНИЕ: запускать только после аудита (system-audit.sh)
# =============================================================
set -euo pipefail

echo "=============================================="
echo " VPS SECURITY HARDENING — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "=============================================="

DRY_RUN="${1:-}"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "🔍 DRY RUN — только показ изменений, без применения"
  echo ""
fi

apply() {
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "[DRY] $1"
  else
    echo "[APPLY] $1"
    eval "$2"
  fi
}

# --- 1. SSH Hardening ---
echo ""
echo "=== 1. SSH HARDENING ==="

SSHD="/etc/ssh/sshd_config"
if [ -f "$SSHD" ]; then
  # Backup
  apply "Backup sshd_config" "cp $SSHD ${SSHD}.bak.$(date +%s)"

  # Disable password auth
  if grep -q "^PasswordAuthentication yes" "$SSHD" 2>/dev/null; then
    apply "Disable PasswordAuthentication" "sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' $SSHD"
  else
    echo "[OK] PasswordAuthentication уже отключён или не задан"
  fi

  # PermitRootLogin
  ROOT_LOGIN=$(grep -i "^PermitRootLogin" "$SSHD" 2>/dev/null | awk '{print $2}' || echo "not set")
  if [ "$ROOT_LOGIN" = "yes" ]; then
    apply "Set PermitRootLogin prohibit-password" "sed -i 's/^PermitRootLogin yes/PermitRootLogin prohibit-password/' $SSHD"
  else
    echo "[OK] PermitRootLogin: $ROOT_LOGIN"
  fi

  # MaxAuthTries
  if ! grep -q "^MaxAuthTries" "$SSHD"; then
    apply "Set MaxAuthTries 3" "echo 'MaxAuthTries 3' >> $SSHD"
  fi

  # Restart SSH (only if changes were made)
  if [ "$DRY_RUN" != "--dry-run" ]; then
    echo "[INFO] Restarting sshd..."
    systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || true
  fi
fi

# --- 2. Fail2ban ---
echo ""
echo "=== 2. FAIL2BAN ==="

if ! command -v fail2ban-client &>/dev/null; then
  apply "Install fail2ban" "apt-get update -qq && apt-get install -y -qq fail2ban"
fi

if [ "$DRY_RUN" != "--dry-run" ]; then
  # Create jail.local for SSH
  cat > /etc/fail2ban/jail.local << 'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600

[sshd-ddos]
enabled = true
port = ssh
filter = sshd-ddos
logpath = /var/log/auth.log
maxretry = 6
bantime = 7200
findtime = 600
JAIL
  systemctl enable fail2ban 2>/dev/null || true
  systemctl restart fail2ban 2>/dev/null || true
  echo "[OK] fail2ban настроен"
else
  echo "[DRY] Would create /etc/fail2ban/jail.local with sshd rules"
fi

# --- 3. UFW Firewall ---
echo ""
echo "=== 3. FIREWALL (UFW) ==="

if command -v ufw &>/dev/null; then
  UFW_ACTIVE=$(ufw status 2>/dev/null | head -1 || echo "")
  if ! echo "$UFW_ACTIVE" | grep -q "active"; then
    # Detect SSH port
    SSH_PORT=$(grep -i "^Port " /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "22")
    apply "Allow SSH port $SSH_PORT" "ufw allow $SSH_PORT/tcp comment 'SSH'"
    apply "Allow HTTP" "ufw allow 80/tcp comment 'HTTP'"
    apply "Allow HTTPS" "ufw allow 443/tcp comment 'HTTPS'"
    apply "Allow N8N (5678)" "ufw allow 5678/tcp comment 'N8N'"
    apply "Allow Webhook (3900)" "ufw allow 3900/tcp comment 'GitHub Webhook'"
    apply "Enable UFW" "echo 'y' | ufw enable"
  else
    echo "[OK] UFW уже активен"
  fi
else
  echo "[SKIP] UFW не установлен (используется другой firewall?)"
fi

# --- 4. Автообновления безопасности ---
echo ""
echo "=== 4. UNATTENDED UPGRADES ==="

if command -v apt &>/dev/null; then
  if ! dpkg -l unattended-upgrades &>/dev/null 2>&1; then
    apply "Install unattended-upgrades" "apt-get install -y -qq unattended-upgrades"
  fi
  apply "Enable auto security updates" "dpkg-reconfigure -plow unattended-upgrades 2>/dev/null || true"
  echo "[OK] Автообновления безопасности"
fi

# --- 5. Sysctl hardening ---
echo ""
echo "=== 5. SYSCTL HARDENING ==="

SYSCTL_FILE="/etc/sysctl.d/99-security.conf"
if [ ! -f "$SYSCTL_FILE" ] || [ "$DRY_RUN" = "--dry-run" ]; then
  if [ "$DRY_RUN" != "--dry-run" ]; then
    cat > "$SYSCTL_FILE" << 'SYSCTL'
# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Ignore ICMP broadcast
net.ipv4.icmp_echo_ignore_broadcasts = 1
SYSCTL
    sysctl -p "$SYSCTL_FILE" 2>/dev/null || true
  fi
  echo "[OK] Sysctl hardening применён"
else
  echo "[OK] Sysctl hardening уже настроен"
fi

echo ""
echo "=============================================="
echo " HARDENING ЗАВЕРШЁН"
echo "=============================================="
echo ""
echo "Рекомендуется запустить system-audit.sh для проверки"
