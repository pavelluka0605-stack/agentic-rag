#!/bin/bash
# rotate-token.sh — Rotate BRIDGE_API_TOKEN on the VPS
# Run as root on the VPS. Generates a new token and restarts the service.
set -euo pipefail

BRIDGE_DIR="/opt/control-bridge"
ENV_FILE="${BRIDGE_DIR}/.env"

if [ ! -f "${ENV_FILE}" ]; then
    echo "ERROR: ${ENV_FILE} not found"
    exit 1
fi

# Generate new token
NEW_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Replace token in .env
sed -i "s|^BRIDGE_API_TOKEN=.*|BRIDGE_API_TOKEN=${NEW_TOKEN}|" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

# Restart service to pick up new token
systemctl restart control-bridge
sleep 2

# Verify service is running
if systemctl is-active --quiet control-bridge; then
    echo "Token rotated successfully. Service is running."
    echo "New token saved to ${ENV_FILE}"
    echo ""
    echo "IMPORTANT: Update the token in your custom GPT Actions configuration."
    echo "To view the new token: cat ${ENV_FILE}"
else
    echo "ERROR: Service failed to start after token rotation!"
    journalctl -u control-bridge --no-pager -n 10
    exit 1
fi
