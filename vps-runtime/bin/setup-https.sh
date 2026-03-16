#!/bin/bash
# =============================================================================
# Setup HTTPS for webhook endpoints via Nginx + Let's Encrypt
# Usage: setup-https.sh <domain> [--dry-run]
# Example: setup-https.sh webhook.marbomebel.ru
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
DRY_RUN="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_CONF="$SCRIPT_DIR/../etc/nginx-webhook.conf"

if [ -z "$DOMAIN" ]; then
  echo "Usage: setup-https.sh <domain> [--dry-run]"
  echo "Example: setup-https.sh webhook.marbomebel.ru"
  exit 1
fi

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── 1. Install nginx + certbot ───────────────────────────────────────────────

log "Installing nginx and certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

# ── 2. Create certbot webroot ────────────────────────────────────────────────

mkdir -p /var/www/certbot

# ── 3. Add rate limiting zone to nginx.conf if missing ───────────────────────

if ! grep -q "limit_req_zone.*webhook" /etc/nginx/nginx.conf; then
  log "Adding rate limiting zone to nginx.conf..."
  sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=webhook:10m rate=30r/m;' /etc/nginx/nginx.conf
fi

# ── 4. Deploy nginx config (update domain) ───────────────────────────────────

log "Deploying nginx config for $DOMAIN..."
sed "s/webhook\.marbomebel\.ru/$DOMAIN/g" "$NGINX_CONF" > /etc/nginx/sites-available/webhook

ln -sf /etc/nginx/sites-available/webhook /etc/nginx/sites-enabled/webhook

# Remove default site if it conflicts
[ -f /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default

# ── 5. Test nginx config (HTTP only first) ───────────────────────────────────

# Temporarily comment out SSL server block for initial cert request
cat > /etc/nginx/sites-available/webhook-temp <<TMPEOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'waiting for cert';
        add_header Content-Type text/plain;
    }
}
TMPEOF

ln -sf /etc/nginx/sites-available/webhook-temp /etc/nginx/sites-enabled/webhook
nginx -t
systemctl reload nginx

# ── 6. Get SSL certificate ───────────────────────────────────────────────────

log "Requesting SSL certificate for $DOMAIN..."

CERTBOT_ARGS="--nginx -d $DOMAIN --non-interactive --agree-tos --email admin@marbomebel.ru --redirect"

if [ "$DRY_RUN" = "--dry-run" ]; then
  CERTBOT_ARGS="$CERTBOT_ARGS --dry-run"
  log "(DRY RUN mode)"
fi

certbot $CERTBOT_ARGS

# ── 7. Restore full config with SSL ─────────────────────────────────────────

log "Restoring full nginx config..."
sed "s/webhook\.marbomebel\.ru/$DOMAIN/g" "$NGINX_CONF" > /etc/nginx/sites-available/webhook
ln -sf /etc/nginx/sites-available/webhook /etc/nginx/sites-enabled/webhook
rm -f /etc/nginx/sites-available/webhook-temp

nginx -t && systemctl reload nginx

# ── 8. Auto-renewal cron ────────────────────────────────────────────────────

log "Setting up auto-renewal..."
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
  log "Added certbot renewal cron (daily 3am)"
fi

# ── 9. Verify ────────────────────────────────────────────────────────────────

log "Setup complete!"
log "Endpoints:"
log "  https://$DOMAIN/webhook/github     → localhost:3900"
log "  https://$DOMAIN/webhook/bluesales-webhook → localhost:5678"
log "  https://$DOMAIN/health             → localhost:3900"

if [ "$DRY_RUN" != "--dry-run" ]; then
  log "Testing HTTPS..."
  curl -sk "https://$DOMAIN/health" && log "Health check OK" || log "Health check failed (service may not be running)"
fi
