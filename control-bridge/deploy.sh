#!/bin/bash
# deploy.sh — Full deployment of Control Bridge API on VPS
# Run as root on the VPS.
set -euo pipefail

BRIDGE_DIR="/opt/control-bridge"
NGINX_CONF="/etc/nginx/sites-available/api-marbomebel"
NGINX_ENABLED="/etc/nginx/sites-enabled/api-marbomebel"
SERVICE_NAME="control-bridge"
DOMAIN="api.marbomebel.ru"

echo "=== Control Bridge API Deployment ==="
echo "Target: ${BRIDGE_DIR}"
echo "Domain: ${DOMAIN}"

# --- 1. System packages ---
echo ""
echo "--- Step 1: Installing system packages ---"
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx certbot python3-certbot-nginx curl

# --- 2. App directory ---
echo ""
echo "--- Step 2: Setting up app directory ---"
mkdir -p "${BRIDGE_DIR}"

# Copy app files (assumes they are in the same directory as this script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "${SCRIPT_DIR}/app.py" "${BRIDGE_DIR}/app.py"
cp "${SCRIPT_DIR}/requirements.txt" "${BRIDGE_DIR}/requirements.txt"

# --- 3. Python venv ---
echo ""
echo "--- Step 3: Setting up Python venv ---"
if [ ! -d "${BRIDGE_DIR}/venv" ]; then
    python3 -m venv "${BRIDGE_DIR}/venv"
fi
"${BRIDGE_DIR}/venv/bin/pip" install --upgrade pip -q
"${BRIDGE_DIR}/venv/bin/pip" install -r "${BRIDGE_DIR}/requirements.txt" -q

# --- 4. Generate API token ---
echo ""
echo "--- Step 4: Configuring API token ---"
if [ -f "${BRIDGE_DIR}/.env" ] && grep -q "BRIDGE_API_TOKEN=" "${BRIDGE_DIR}/.env"; then
    echo "Token already exists in .env, keeping it."
else
    TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    echo "BRIDGE_API_TOKEN=${TOKEN}" > "${BRIDGE_DIR}/.env"
    chmod 600 "${BRIDGE_DIR}/.env"
    echo "Generated new API token: ${TOKEN}"
    echo "IMPORTANT: Save this token — you'll need it for your custom GPT."
fi

# --- 5. systemd service ---
echo ""
echo "--- Step 5: Installing systemd service ---"
cp "${SCRIPT_DIR}/control-bridge.service" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
sleep 2
systemctl is-active "${SERVICE_NAME}" && echo "Service is running." || { echo "ERROR: Service failed to start!"; journalctl -u "${SERVICE_NAME}" --no-pager -n 20; exit 1; }

# --- 6. Test local ---
echo ""
echo "--- Step 6: Testing local endpoint ---"
LOCAL_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health)
if [ "${LOCAL_HEALTH}" = "200" ]; then
    echo "Local health check: OK (${LOCAL_HEALTH})"
else
    echo "ERROR: Local health check failed (HTTP ${LOCAL_HEALTH})"
    journalctl -u "${SERVICE_NAME}" --no-pager -n 20
    exit 1
fi

# --- 7. nginx ---
echo ""
echo "--- Step 7: Configuring nginx ---"

# First, create a temporary HTTP-only config for certbot
cat > "${NGINX_CONF}" << 'NGINX_HTTP'
server {
    listen 80;
    server_name api.marbomebel.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_HTTP

# Enable site
ln -sf "${NGINX_CONF}" "${NGINX_ENABLED}"

# Remove default if it conflicts
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "Note: default nginx site exists, keeping it."
fi

nginx -t && systemctl reload nginx
echo "nginx configured (HTTP only for now)."

# --- 8. DNS check ---
echo ""
echo "--- Step 8: DNS verification ---"
RESOLVED_IP=$(dig +short "${DOMAIN}" 2>/dev/null || host "${DOMAIN}" 2>/dev/null | awk '/has address/ {print $4}' || echo "")
SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s -4 icanhazip.com 2>/dev/null || echo "unknown")
echo "Domain ${DOMAIN} resolves to: ${RESOLVED_IP}"
echo "This server's IP: ${SERVER_IP}"

# --- 9. SSL with certbot ---
echo ""
echo "--- Step 9: Setting up SSL ---"
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo "SSL certificate already exists."
else
    echo "Requesting SSL certificate..."
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email admin@marbomebel.ru --redirect || {
        echo "WARNING: certbot failed. Trying standalone..."
        systemctl stop nginx
        certbot certonly --standalone -d "${DOMAIN}" --non-interactive --agree-tos --email admin@marbomebel.ru || {
            echo "ERROR: SSL setup failed. API will work on HTTP only."
            systemctl start nginx
        }
    }
fi

# If cert exists, install the full HTTPS nginx config
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    cp "${SCRIPT_DIR}/nginx-api.conf" "${NGINX_CONF}"
    nginx -t && systemctl reload nginx
    echo "HTTPS nginx config installed."
else
    echo "WARNING: Running without SSL."
fi

# --- 10. Final verification ---
echo ""
echo "=== Final Verification ==="

# Read token
TOKEN=$(grep BRIDGE_API_TOKEN "${BRIDGE_DIR}/.env" | cut -d= -f2-)

echo ""
echo "1. Health check (local):"
curl -s http://127.0.0.1:3000/health
echo ""

echo ""
echo "2. Health check (public HTTPS):"
HTTPS_RESULT=$(curl -sk https://${DOMAIN}/health 2>&1) || HTTPS_RESULT=$(curl -s http://${DOMAIN}/health 2>&1)
echo "${HTTPS_RESULT}"

echo ""
echo "3. Create job:"
CREATE_RESULT=$(curl -s -X POST "http://127.0.0.1:3000/jobs" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test job","raw_user_request":"GPT bridge test","normalized_brief":"Test run"}')
echo "${CREATE_RESULT}"
JOB_ID=$(echo "${CREATE_RESULT}" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])" 2>/dev/null || echo "")

if [ -n "${JOB_ID}" ]; then
    echo ""
    echo "4. Confirm job ${JOB_ID}:"
    curl -s -X POST "http://127.0.0.1:3000/jobs/${JOB_ID}/confirm" -H "Authorization: Bearer ${TOKEN}"
    echo ""

    echo ""
    echo "5. Job status:"
    curl -s "http://127.0.0.1:3000/jobs/${JOB_ID}/status" -H "Authorization: Bearer ${TOKEN}"
    echo ""

    echo ""
    echo "6. Job result:"
    curl -s "http://127.0.0.1:3000/jobs/${JOB_ID}/result" -H "Authorization: Bearer ${TOKEN}"
    echo ""

    echo ""
    echo "7. Create another job for cancel test:"
    CANCEL_RESULT=$(curl -s -X POST "http://127.0.0.1:3000/jobs" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"title":"Cancel test","raw_user_request":"Test cancel","normalized_brief":"Cancel"}')
    echo "${CANCEL_RESULT}"
    CANCEL_ID=$(echo "${CANCEL_RESULT}" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])" 2>/dev/null || echo "")
    if [ -n "${CANCEL_ID}" ]; then
        echo ""
        echo "8. Cancel job ${CANCEL_ID}:"
        curl -s -X POST "http://127.0.0.1:3000/jobs/${CANCEL_ID}/cancel" -H "Authorization: Bearer ${TOKEN}"
        echo ""
    fi
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "SUMMARY:"
echo "  App directory:    ${BRIDGE_DIR}"
echo "  Service:          systemctl status ${SERVICE_NAME}"
echo "  nginx config:     ${NGINX_CONF}"
echo "  Token file:       ${BRIDGE_DIR}/.env"
echo "  Public URL:       https://${DOMAIN}"
echo "  Token value:      ${TOKEN}"
echo ""
echo "To rotate the token later:"
echo "  1. Edit ${BRIDGE_DIR}/.env"
echo "  2. systemctl restart ${SERVICE_NAME}"
