#!/usr/bin/env bash
#
# WordPress Deploy Script for xn--e1afaihifegddo7k.xn--p1ai
#
# Usage:
#   1. Copy site-build/ to VPS
#   2. Run: sudo bash site-build/deploy/install-wordpress.sh
#
# Prerequisites: Ubuntu/Debian VPS with root access
# This script installs WordPress alongside the existing N8N setup.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_BUILD_DIR="$(dirname "$SCRIPT_DIR")"

# ─── Configuration ────────────────────────────────────
DOMAIN="xn--e1afaihifegddo7k.xn--p1ai"
DOMAIN_DISPLAY="kuhnirema.rf"
WEB_ROOT="/var/www/kuhnirema"
DB_NAME="kuhni_rema"
DB_USER="kuhni_rema"
DB_PASS="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 24)"
DB_HOST="localhost"
WP_LOCALE="ru_RU"
WP_TITLE="Кухни Рема — кухни на заказ в Красноярске"
WP_ADMIN_USER="rema_admin"
WP_ADMIN_PASS="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)"
WP_ADMIN_EMAIL="admin@marbomebel.ru"
PHP_VERSION="8.2"
N8N_WEBHOOK_BASE_URL="https://n8n.marbomebel.ru"
NGINX_CONF_SRC="$SCRIPT_DIR/nginx-kuhnirema.conf"
NGINX_CONF_DST="/etc/nginx/sites-available/kuhnirema"

# ─── Colors / Logging ────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; }
step()  { echo -e "\n${CYAN}--- $1 ---${NC}"; }

echo "============================================"
echo "  WordPress Deploy: $DOMAIN_DISPLAY"
echo "============================================"
echo ""

# ─── Pre-flight checks ───────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  error "This script must be run as root (sudo)"
  exit 1
fi

# ─── Step 1: Install prerequisites ───────────────────
step "Step 1: Install prerequisites"

export DEBIAN_FRONTEND=noninteractive

if command -v nginx &>/dev/null && command -v php &>/dev/null && command -v mariadb &>/dev/null; then
  log "Nginx, PHP, MariaDB already installed — skipping apt install"
else
  warn "Installing packages..."
  apt-get update -qq
  apt-get install -y -qq \
    nginx \
    "php${PHP_VERSION}-fpm" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-curl" \
    "php${PHP_VERSION}-gd" \
    "php${PHP_VERSION}-intl" \
    "php${PHP_VERSION}-mbstring" \
    "php${PHP_VERSION}-xml" \
    "php${PHP_VERSION}-zip" \
    "php${PHP_VERSION}-imagick" \
    "php${PHP_VERSION}-opcache" \
    "php${PHP_VERSION}-redis" \
    mariadb-server \
    certbot \
    python3-certbot-nginx \
    unzip \
    curl \
    ghostscript
  log "All packages installed"
fi

# ─── Step 2: Install WP-CLI ──────────────────────────
step "Step 2: WP-CLI"

if command -v wp &>/dev/null; then
  log "WP-CLI already installed: $(wp --version --allow-root 2>/dev/null || echo 'unknown')"
else
  warn "Installing WP-CLI..."
  curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  chmod +x wp-cli.phar
  mv wp-cli.phar /usr/local/bin/wp
  log "WP-CLI installed: $(wp --version --allow-root)"
fi

# ─── Step 3: MariaDB database ────────────────────────
step "Step 3: MariaDB database"

# Ensure MariaDB is running
systemctl enable mariadb
systemctl start mariadb

# Check if database already exists
if mariadb -e "USE ${DB_NAME}" 2>/dev/null; then
  log "Database '${DB_NAME}' already exists — skipping creation"
  # Try to read existing password from wp-config.php
  if [ -f "${WEB_ROOT}/wp-config.php" ]; then
    EXISTING_PASS=$(grep "DB_PASSWORD" "${WEB_ROOT}/wp-config.php" | sed "s/.*'\([^']*\)'.*/\1/" | head -1)
    if [ -n "$EXISTING_PASS" ]; then
      DB_PASS="$EXISTING_PASS"
      log "Using existing DB password from wp-config.php"
    fi
  fi
else
  warn "Creating database and user..."
  mariadb -e "
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASS}';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_HOST}';
    FLUSH PRIVILEGES;
  "
  log "Database '${DB_NAME}' and user '${DB_USER}' created"
  echo ""
  warn "SAVE THESE CREDENTIALS:"
  echo "  DB Name:     ${DB_NAME}"
  echo "  DB User:     ${DB_USER}"
  echo "  DB Password: ${DB_PASS}"
  echo ""
fi

# ─── Step 4: Download and install WordPress ──────────
step "Step 4: WordPress installation"

mkdir -p "$WEB_ROOT"

if [ -f "${WEB_ROOT}/wp-config.php" ]; then
  log "WordPress already installed at ${WEB_ROOT} — skipping download"
else
  if [ ! -f "${WEB_ROOT}/wp-load.php" ]; then
    warn "Downloading WordPress..."
    wp core download \
      --path="$WEB_ROOT" \
      --locale="$WP_LOCALE" \
      --allow-root
    log "WordPress downloaded"
  fi

  warn "Configuring wp-config.php..."
  wp config create \
    --path="$WEB_ROOT" \
    --dbname="$DB_NAME" \
    --dbuser="$DB_USER" \
    --dbpass="$DB_PASS" \
    --dbhost="$DB_HOST" \
    --dbcharset="utf8mb4" \
    --locale="$WP_LOCALE" \
    --allow-root

  # Add extra constants to wp-config.php
  wp config set WP_MEMORY_LIMIT '256M' --type=constant --path="$WEB_ROOT" --allow-root
  wp config set WP_MAX_MEMORY_LIMIT '512M' --type=constant --path="$WEB_ROOT" --allow-root
  wp config set DISALLOW_FILE_EDIT true --raw --type=constant --path="$WEB_ROOT" --allow-root
  wp config set WP_AUTO_UPDATE_CORE 'minor' --type=constant --path="$WEB_ROOT" --allow-root
  wp config set FORCE_SSL_ADMIN true --raw --type=constant --path="$WEB_ROOT" --allow-root

  log "wp-config.php created"

  warn "Running WordPress install..."
  wp core install \
    --path="$WEB_ROOT" \
    --url="https://${DOMAIN}" \
    --title="$WP_TITLE" \
    --admin_user="$WP_ADMIN_USER" \
    --admin_password="$WP_ADMIN_PASS" \
    --admin_email="$WP_ADMIN_EMAIL" \
    --locale="$WP_LOCALE" \
    --allow-root

  log "WordPress installed"
  echo ""
  warn "SAVE THESE ADMIN CREDENTIALS:"
  echo "  Admin URL:      https://${DOMAIN}/wp-admin/"
  echo "  Admin User:     ${WP_ADMIN_USER}"
  echo "  Admin Password: ${WP_ADMIN_PASS}"
  echo ""
fi

# ─── Step 5: Install and activate plugins ─────────────
step "Step 5: Plugins"

# Free plugins from repository
REPO_PLUGINS=(
  "classic-editor"
  "redis-cache"
  "wp-mail-smtp"
)

for plugin in "${REPO_PLUGINS[@]}"; do
  if wp plugin is-installed "$plugin" --path="$WEB_ROOT" --allow-root 2>/dev/null; then
    log "Plugin '${plugin}' already installed"
  else
    wp plugin install "$plugin" --activate --path="$WEB_ROOT" --allow-root
    log "Plugin '${plugin}' installed and activated"
  fi
done

# Premium plugins — require manual download
echo ""
warn "=== PREMIUM PLUGINS (manual install required) ==="
echo ""
echo "  The following plugins must be downloaded manually and placed as ZIP files"
echo "  in ${SITE_BUILD_DIR}/deploy/plugins/ before running the next section:"
echo ""
echo "  1. Bricks Builder (bricks.zip)"
echo "     - Download from: https://bricksbuilder.io/account/"
echo "     - Requires active license"
echo ""
echo "  2. Advanced Custom Fields Pro (advanced-custom-fields-pro.zip)"
echo "     - Download from: https://www.advancedcustomfields.com/my-account/"
echo "     - Requires active license key"
echo ""
echo "  3. RankMath Pro (seo-by-rank-math-pro.zip)"
echo "     - Download from: https://rankmath.com/account/"
echo "     - Requires active license"
echo ""

# TODO: Install premium plugins from ZIP files
PLUGIN_DIR="${SCRIPT_DIR}/plugins"
if [ -d "$PLUGIN_DIR" ]; then
  for zipfile in "$PLUGIN_DIR"/*.zip; do
    [ -f "$zipfile" ] || continue
    plugin_basename="$(basename "$zipfile" .zip)"
    warn "Installing premium plugin from: $(basename "$zipfile")..."
    wp plugin install "$zipfile" --activate --path="$WEB_ROOT" --allow-root || \
      warn "Failed to install $(basename "$zipfile") — check the ZIP file"
  done
else
  warn "No plugins/ directory found at ${PLUGIN_DIR} — skipping premium plugins"
fi

# ─── Step 6: Copy custom theme ───────────────────────
step "Step 6: Custom theme"

THEME_SRC="${SITE_BUILD_DIR}/wordpress/theme"
THEME_DST="${WEB_ROOT}/wp-content/themes/kuhni-rema"

if [ -d "$THEME_SRC" ]; then
  mkdir -p "$THEME_DST"
  cp -r "$THEME_SRC/"* "$THEME_DST/"
  log "Theme copied to ${THEME_DST}"

  # Activate the theme
  wp theme activate kuhni-rema --path="$WEB_ROOT" --allow-root 2>/dev/null || \
    warn "Could not activate theme 'kuhni-rema' — may need Bricks Builder first"
else
  warn "Theme source not found at ${THEME_SRC} — skipping"
  echo "  Expected path: ${THEME_SRC}"
fi

# ─── Step 7: File permissions ─────────────────────────
step "Step 7: File permissions"

chown -R www-data:www-data "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

# wp-config.php should be more restrictive
if [ -f "${WEB_ROOT}/wp-config.php" ]; then
  chmod 640 "${WEB_ROOT}/wp-config.php"
fi

# Uploads directory needs write access
mkdir -p "${WEB_ROOT}/wp-content/uploads"
chown -R www-data:www-data "${WEB_ROOT}/wp-content/uploads"

log "File permissions set (owner: www-data)"

# ─── Step 8: PHP-FPM configuration ───────────────────
step "Step 8: PHP-FPM tuning"

PHP_FPM_POOL="/etc/php/${PHP_VERSION}/fpm/pool.d/www.conf"
if [ -f "$PHP_FPM_POOL" ]; then
  # Increase upload limits
  sed -i "s/^upload_max_filesize.*/upload_max_filesize = 20M/" "/etc/php/${PHP_VERSION}/fpm/php.ini" 2>/dev/null || true
  sed -i "s/^post_max_size.*/post_max_size = 25M/" "/etc/php/${PHP_VERSION}/fpm/php.ini" 2>/dev/null || true
  sed -i "s/^max_execution_time.*/max_execution_time = 300/" "/etc/php/${PHP_VERSION}/fpm/php.ini" 2>/dev/null || true
  sed -i "s/^memory_limit.*/memory_limit = 256M/" "/etc/php/${PHP_VERSION}/fpm/php.ini" 2>/dev/null || true

  # If values don't exist, append them
  grep -q "^upload_max_filesize" "/etc/php/${PHP_VERSION}/fpm/php.ini" || echo "upload_max_filesize = 20M" >> "/etc/php/${PHP_VERSION}/fpm/php.ini"
  grep -q "^post_max_size" "/etc/php/${PHP_VERSION}/fpm/php.ini" || echo "post_max_size = 25M" >> "/etc/php/${PHP_VERSION}/fpm/php.ini"
  grep -q "^max_execution_time" "/etc/php/${PHP_VERSION}/fpm/php.ini" || echo "max_execution_time = 300" >> "/etc/php/${PHP_VERSION}/fpm/php.ini"
  grep -q "^memory_limit" "/etc/php/${PHP_VERSION}/fpm/php.ini" || echo "memory_limit = 256M" >> "/etc/php/${PHP_VERSION}/fpm/php.ini"

  systemctl restart "php${PHP_VERSION}-fpm"
  log "PHP-FPM configured and restarted"
else
  warn "PHP-FPM pool config not found at ${PHP_FPM_POOL}"
fi

# ─── Step 9: Nginx configuration ─────────────────────
step "Step 9: Nginx configuration"

if [ -f "$NGINX_CONF_SRC" ]; then
  cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"
  log "Nginx config copied to ${NGINX_CONF_DST}"

  # Enable site
  if [ ! -L "/etc/nginx/sites-enabled/kuhnirema" ]; then
    ln -s "$NGINX_CONF_DST" /etc/nginx/sites-enabled/kuhnirema
    log "Nginx site enabled"
  fi

  # Test config
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "Nginx config valid — reloaded"
  else
    error "Nginx config test failed! Check: nginx -t"
  fi
else
  warn "Nginx config not found at ${NGINX_CONF_SRC}"
  echo "  Copy nginx-kuhnirema.conf to ${NGINX_CONF_DST} manually"
fi

# ─── Step 10: SSL certificate (Let's Encrypt) ────────
step "Step 10: SSL certificate"

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
  log "SSL certificate already exists for ${DOMAIN}"
else
  warn "Obtaining SSL certificate..."
  certbot --nginx \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" \
    --non-interactive \
    --agree-tos \
    --email "$WP_ADMIN_EMAIL" \
    --redirect || {
      error "Certbot failed — ensure DNS A records point to this server"
      echo "  Required DNS records:"
      echo "    ${DOMAIN}       -> $(curl -s ifconfig.me)"
      echo "    www.${DOMAIN}   -> $(curl -s ifconfig.me)"
    }
fi

# Ensure auto-renewal timer is active
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

# ─── Step 11: Copy robots.txt ────────────────────────
step "Step 11: robots.txt"

ROBOTS_SRC="${SITE_BUILD_DIR}/seo/robots.txt"
if [ -f "$ROBOTS_SRC" ]; then
  cp "$ROBOTS_SRC" "${WEB_ROOT}/robots.txt"
  chown www-data:www-data "${WEB_ROOT}/robots.txt"
  log "robots.txt copied to ${WEB_ROOT}/robots.txt"
else
  warn "robots.txt not found at ${ROBOTS_SRC}"
fi

# ─── Step 12: Import data ────────────────────────────
step "Step 12: Data imports"

DATA_DIR="${SITE_BUILD_DIR}/wordpress/theme/data"
IMPORT_SCRIPTS=(
  "import-kitchens.php"
  "import-projects.php"
  "import-reviews.php"
  "import-faq.php"
)

for script in "${IMPORT_SCRIPTS[@]}"; do
  SCRIPT_PATH="${DATA_DIR}/${script}"
  if [ -f "$SCRIPT_PATH" ]; then
    warn "Running ${script}..."
    wp eval-file "$SCRIPT_PATH" --path="$WEB_ROOT" --allow-root && \
      log "${script} completed" || \
      error "${script} failed — check the script"
  else
    warn "${script} not found at ${SCRIPT_PATH} — skipping"
  fi
done

# ─── Step 13: Set N8N webhook URL in wp_options ──────
step "Step 13: N8N integration"

wp option update kuhni_rema_n8n_url "$N8N_WEBHOOK_BASE_URL" --path="$WEB_ROOT" --allow-root
log "N8N webhook URL set: ${N8N_WEBHOOK_BASE_URL}"

# ─── Step 14: WordPress hardening ────────────────────
step "Step 14: WordPress hardening"

# Disable XML-RPC
wp option update default_ping_status 'closed' --path="$WEB_ROOT" --allow-root
wp option update default_comment_status 'closed' --path="$WEB_ROOT" --allow-root

# Set permalink structure
wp rewrite structure '/%postname%/' --path="$WEB_ROOT" --allow-root
wp rewrite flush --path="$WEB_ROOT" --allow-root
log "Permalinks set to /%postname%/"

# Set timezone
wp option update timezone_string 'Asia/Krasnoyarsk' --path="$WEB_ROOT" --allow-root
wp option update date_format 'd.m.Y' --path="$WEB_ROOT" --allow-root
wp option update time_format 'H:i' --path="$WEB_ROOT" --allow-root
log "Timezone set to Asia/Krasnoyarsk"

# Remove default content
wp post delete 1 --force --path="$WEB_ROOT" --allow-root 2>/dev/null || true
wp post delete 2 --force --path="$WEB_ROOT" --allow-root 2>/dev/null || true
wp comment delete 1 --force --path="$WEB_ROOT" --allow-root 2>/dev/null || true

# Remove unused themes
wp theme delete twentytwentytwo --path="$WEB_ROOT" --allow-root 2>/dev/null || true
wp theme delete twentytwentythree --path="$WEB_ROOT" --allow-root 2>/dev/null || true

log "WordPress hardened"

# ─── Final summary ───────────────────────────────────
echo ""
echo "============================================"
echo "  Deployment Summary"
echo "============================================"
echo ""

# Check services
if systemctl is-active --quiet nginx; then
  log "Nginx:        running"
else
  error "Nginx:        NOT running"
fi

if systemctl is-active --quiet "php${PHP_VERSION}-fpm"; then
  log "PHP-FPM:      running (${PHP_VERSION})"
else
  error "PHP-FPM:      NOT running"
fi

if systemctl is-active --quiet mariadb; then
  log "MariaDB:      running"
else
  error "MariaDB:      NOT running"
fi

if systemctl is-active --quiet n8n 2>/dev/null; then
  log "N8N:          running (existing)"
else
  warn "N8N:          not detected (may be on different host)"
fi

if [ -f "$CERT_PATH" ]; then
  log "SSL:          active"
else
  warn "SSL:          not yet configured"
fi

echo ""
echo "============================================"
echo "  Credentials (SAVE THESE!)"
echo "============================================"
echo ""
echo "  Site URL:       https://${DOMAIN}"
echo "  Admin URL:      https://${DOMAIN}/wp-admin/"
echo "  Admin User:     ${WP_ADMIN_USER}"
echo "  Admin Password: ${WP_ADMIN_PASS}"
echo ""
echo "  DB Name:        ${DB_NAME}"
echo "  DB User:        ${DB_USER}"
echo "  DB Password:    ${DB_PASS}"
echo ""
echo "============================================"
echo "  Next Steps"
echo "============================================"
echo ""
echo "  1. Ensure DNS A records point to this server:"
echo "     ${DOMAIN}       -> $(curl -s ifconfig.me 2>/dev/null || echo '<SERVER_IP>')"
echo "     www.${DOMAIN}   -> $(curl -s ifconfig.me 2>/dev/null || echo '<SERVER_IP>')"
echo ""
echo "  2. Upload premium plugin ZIPs to ${SCRIPT_DIR}/plugins/ and re-run,"
echo "     or install manually via wp-admin:"
echo "     - Bricks Builder"
echo "     - ACF Pro"
echo "     - RankMath Pro"
echo ""
echo "  3. Activate Bricks Builder license in wp-admin"
echo "  4. Import Bricks Builder templates"
echo "  5. Verify data imports at /wp-admin/edit.php?post_type=kitchen"
echo ""
log "WordPress deploy completed!"
