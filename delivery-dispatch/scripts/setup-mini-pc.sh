#!/usr/bin/env bash
# ============================================================
# Delivery Dispatch v5 — Mini-PC Setup Script
# Настройка мини-ПК для автоматической обработки доставок
# ============================================================
# OS: Windows 10/11 (WSL/Git Bash) or Ubuntu Desktop
# Usage: bash setup-mini-pc.sh
# ============================================================

set -euo pipefail

echo "========================================"
echo " Delivery Dispatch v5 — Mini-PC Setup"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_ok() { echo -e "  ${GREEN}✓${NC} $1"; }
check_fail() { echo -e "  ${RED}✗${NC} $1"; }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

# ---- 1. Check Chrome ----
echo "[1/6] Checking Chrome..."
if command -v google-chrome &>/dev/null || command -v google-chrome-stable &>/dev/null; then
    CHROME_VER=$(google-chrome --version 2>/dev/null || google-chrome-stable --version 2>/dev/null)
    check_ok "Chrome installed: $CHROME_VER"
else
    check_fail "Chrome not found. Install: https://www.google.com/chrome/"
fi

# ---- 2. Check printer ----
echo ""
echo "[2/6] Checking printers..."
if command -v lpstat &>/dev/null; then
    DEFAULT_PRINTER=$(lpstat -d 2>/dev/null | grep -oP '(?<=: ).*' || true)
    if [ -n "$DEFAULT_PRINTER" ]; then
        check_ok "Default printer: $DEFAULT_PRINTER"
    else
        check_warn "No default printer set. Run: lpadmin -d <printer_name>"
    fi
    echo "  Available printers:"
    lpstat -p 2>/dev/null | while read -r line; do
        echo "    $line"
    done
else
    check_warn "lpstat not available (Windows? Check printer in Settings)"
fi

# ---- 3. Check network ----
echo ""
echo "[3/6] Checking network..."
if ping -c 1 -W 3 docs.google.com &>/dev/null; then
    check_ok "Google Sheets accessible"
else
    check_fail "Cannot reach docs.google.com"
fi

if ping -c 1 -W 3 dostavka.yandex.ru &>/dev/null; then
    check_ok "Yandex Delivery accessible"
else
    check_fail "Cannot reach dostavka.yandex.ru"
fi

if ping -c 1 -W 3 seller.ozon.ru &>/dev/null; then
    check_ok "Ozon Seller accessible"
else
    check_fail "Cannot reach seller.ozon.ru"
fi

# ---- 4. System info ----
echo ""
echo "[4/6] System info..."
echo "  OS: $(uname -s -r)"
echo "  RAM: $(free -h 2>/dev/null | awk '/Mem:/{print $2}' || echo 'N/A')"
echo "  Disk: $(df -h / 2>/dev/null | awk 'NR==2{print $4 " free of " $2}' || echo 'N/A')"
echo "  CPU: $(nproc 2>/dev/null || echo 'N/A') cores"

# ---- 5. Chrome autostart ----
echo ""
echo "[5/6] Chrome kiosk-printing setup..."
CHROME_DESKTOP="/etc/xdg/autostart/chrome-delivery.desktop"
echo "  To enable auto-print without dialog, launch Chrome with:"
echo "    google-chrome --kiosk-printing"
echo ""
echo "  To autostart Chrome on login (Linux):"
echo "    Create $CHROME_DESKTOP with:"
echo "    [Desktop Entry]"
echo "    Type=Application"
echo "    Name=Chrome Delivery"
echo "    Exec=google-chrome --kiosk-printing --start-maximized"
echo "    X-GNOME-Autostart-enabled=true"

# ---- 6. Checklist ----
echo ""
echo "[6/6] Setup checklist:"
echo "  [ ] Chrome installed & updated"
echo "  [ ] Claude in Chrome extension installed"
echo "  [ ] Claude Max subscription active"
echo "  [ ] Model: Sonnet 4.6 (fast) or Opus 4.6 (accurate)"
echo "  [ ] Allowed sites: docs.google.com, dostavka.yandex.ru,"
echo "      b2b.taxi.yandex.net, seller.ozon.ru"
echo "  [ ] Logged into Yandex Delivery (b2b.taxi.yandex.net)"
echo "  [ ] Logged into Ozon Seller (seller.ozon.ru)"
echo "  [ ] Printer connected & set as default"
echo "  [ ] Chrome --kiosk-printing flag enabled"
echo "  [ ] Chrome autostart configured"
echo "  [ ] Scheduled Task recorded (see templates/scheduled-task-prompt.md)"
echo "  [ ] 4 workflows recorded (Yandex calc, Ozon calc, Yandex order, Ozon order)"
echo "  [ ] UPS connected (recommended)"
echo "  [ ] Network: wired ethernet (recommended)"
echo ""
echo "========================================"
echo " Setup check complete!"
echo "========================================"
