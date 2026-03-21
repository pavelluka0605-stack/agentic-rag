#!/bin/bash
set -euo pipefail

echo "=== 3X-UI + VLESS Reality VPN Setup ==="
echo "Date: $(date -u)"
echo "Host: $(hostname)"

# --- 1. Check if already installed ---
if systemctl is-active --quiet x-ui 2>/dev/null; then
    echo ">>> 3X-UI already running!"
    echo "Status: $(systemctl status x-ui --no-pager 2>&1 | head -5)"
    # Show panel info
    x-ui settings 2>/dev/null || true
    echo "=== Already installed, skipping ==="
    exit 0
fi

# --- 2. System update ---
echo ">>> Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget unzip jq > /dev/null 2>&1

# --- 3. Install 3X-UI ---
echo ">>> Installing 3X-UI..."
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh) << 'INPUT'
y
INPUT

# Wait for service to start
sleep 3

# --- 4. Check if x-ui is running ---
if ! systemctl is-active --quiet x-ui; then
    echo "ERROR: x-ui service failed to start"
    systemctl status x-ui --no-pager 2>&1 || true
    journalctl -u x-ui --no-pager -n 30 2>&1 || true
    exit 1
fi

echo ">>> 3X-UI installed and running"

# --- 5. Get panel info ---
echo ""
echo "=== 3X-UI Panel Info ==="
x-ui settings 2>/dev/null || echo "Run 'x-ui settings' manually to see panel credentials"

# --- 6. Show access info ---
SERVER_IP=$(curl -s4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo "=== Access Info ==="
echo "Panel URL: http://${SERVER_IP}:2053"
echo "Server IP: ${SERVER_IP}"
echo ""

# --- 7. Open firewall if needed ---
if command -v ufw &>/dev/null; then
    ufw allow 2053/tcp 2>/dev/null || true
    echo ">>> UFW: port 2053 opened"
fi
if command -v iptables &>/dev/null; then
    iptables -I INPUT -p tcp --dport 2053 -j ACCEPT 2>/dev/null || true
    echo ">>> iptables: port 2053 opened"
fi

# --- 8. Enable BBR (speed optimization) ---
if ! sysctl net.ipv4.tcp_congestion_control 2>/dev/null | grep -q bbr; then
    echo ">>> Enabling BBR..."
    echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
    echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
    sysctl -p > /dev/null 2>&1
    echo ">>> BBR enabled"
else
    echo ">>> BBR already enabled"
fi

echo ""
echo "=== SETUP COMPLETE ==="
echo ""
echo "Next steps:"
echo "1. Open panel: http://${SERVER_IP}:2053"
echo "2. Login with default credentials (shown above)"
echo "3. Add Inbound: VLESS + Reality"
echo "4. Download Streisand or V2Box on iPhone"
echo "5. Scan QR code from panel"
echo ""
echo "=== Done ==="
