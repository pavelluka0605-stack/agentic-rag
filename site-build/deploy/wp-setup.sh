#!/usr/bin/env bash
# =============================================================================
# wp-setup.sh — WordPress Initial Setup for кухнирема.рф
#
# Run AFTER WordPress is installed and kuhni-rema theme is activated.
# Requires: wp-cli, active WordPress installation.
# Usage: bash wp-setup.sh [--path=/var/www/kuhni-rema]
#
# Idempotent: safe to run multiple times.
# =============================================================================

set -euo pipefail

# ---------- Configuration ----------

WP_PATH="${1:---path=/var/www/kuhni-rema}"
WP="wp ${WP_PATH} --allow-root"

SITE_TITLE="Кухни Рема"
TAGLINE="Кухни на заказ в Красноярске от производителя"
TIMEZONE="Asia/Krasnoyarsk"
DATE_FORMAT="d.m.Y"
PERMALINK="/%postname%/"
POSTS_PER_PAGE=12
N8N_URL="https://n8n.marbomebel.ru"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[SKIP]${NC} $1"; }

echo "============================================="
echo "  Кухни Рема — WordPress Initial Setup"
echo "============================================="
echo ""

# ---------- Helper: create page if not exists ----------
# Usage: create_page "Title" "slug" "template"
create_page() {
    local title="$1"
    local slug="$2"
    local template="$3"

    local existing
    existing=$($WP post list --post_type=page --name="$slug" --format=ids 2>/dev/null || true)

    if [ -n "$existing" ]; then
        # Update template assignment in case it changed
        $WP post meta update "$existing" _wp_page_template "$template" --quiet 2>/dev/null || true
        warn "Page '$title' already exists (ID: $existing)"
        echo "$existing"
    else
        local page_id
        page_id=$($WP post create \
            --post_type=page \
            --post_title="$title" \
            --post_name="$slug" \
            --post_status=publish \
            --porcelain)
        $WP post meta update "$page_id" _wp_page_template "$template" --quiet 2>/dev/null || true
        log "Created page '$title' (ID: $page_id)"
        echo "$page_id"
    fi
}

# ---------- Helper: create taxonomy term if not exists ----------
# Usage: create_term "taxonomy" "name" "slug"
create_term() {
    local taxonomy="$1"
    local name="$2"
    local slug="$3"

    local existing
    existing=$($WP term get "$taxonomy" "$slug" --by=slug --field=term_id 2>/dev/null || true)

    if [ -n "$existing" ]; then
        warn "Term '$name' ($taxonomy) already exists (ID: $existing)"
    else
        $WP term create "$taxonomy" "$name" --slug="$slug" --quiet 2>/dev/null || true
        log "Created term '$name' in taxonomy '$taxonomy'"
    fi
}

# =============================================================================
# 1. SITE SETTINGS
# =============================================================================

echo ""
echo "--- 1. Site Settings ---"

$WP option update blogname "$SITE_TITLE"
$WP option update blogdescription "$TAGLINE"
log "Site title: $SITE_TITLE"
log "Tagline: $TAGLINE"

$WP option update timezone_string "$TIMEZONE"
log "Timezone: $TIMEZONE"

$WP option update date_format "$DATE_FORMAT"
log "Date format: $DATE_FORMAT"

$WP option update time_format "H:i"
log "Time format: H:i"

# Permalink structure
$WP rewrite structure "$PERMALINK" --hard 2>/dev/null || \
    $WP option update permalink_structure "$PERMALINK"
log "Permalink: $PERMALINK"

# Posts per page
$WP option update posts_per_page "$POSTS_PER_PAGE"
log "Posts per page: $POSTS_PER_PAGE"

# Disable comments globally
$WP option update default_comment_status "closed"
$WP option update default_ping_status "closed"
log "Comments disabled globally"

# Close comments on all existing posts/pages
$WP post list --post_type=any --format=ids 2>/dev/null | xargs -r -I{} $WP post update {} --comment_status=closed --quiet 2>/dev/null || true
log "Closed comments on existing content"

# Discourage search engines until go-live (remove manually when ready)
# $WP option update blog_public 0

# Uploads year/month
$WP option update uploads_use_yearmonth_folders 1
log "Uploads organized by year/month"

# =============================================================================
# 2. CREATE PAGES
# =============================================================================

echo ""
echo "--- 2. Creating Pages ---"

PAGE_HOME=$(create_page "Главная" "glavnaya" "templates/page-home.php")
PAGE_PRYAMYE=$(create_page "Прямые кухни" "pryamye-kuhni" "templates/page-catalog.php")
PAGE_UGLOVYE=$(create_page "Угловые кухни" "uglovye-kuhni" "templates/page-catalog.php")
PAGE_POBRAZNYE=$(create_page "П-образные кухни" "p-obraznye-kuhni" "templates/page-catalog.php")
PAGE_ABOUT=$(create_page "О компании" "o-kompanii" "templates/page-about.php")
PAGE_CONTACTS=$(create_page "Контакты" "kontakty" "templates/page-contacts.php")
PAGE_REVIEWS=$(create_page "Отзывы" "otzyvy" "templates/page-reviews.php")
PAGE_PORTFOLIO=$(create_page "Портфолио" "portfolio" "templates/page-portfolio.php")
PAGE_QUIZ=$(create_page "Калькулятор" "kalkulyator" "templates/page-quiz.php")
PAGE_FAQ=$(create_page "FAQ" "faq" "templates/page-faq.php")
PAGE_THANKS=$(create_page "Спасибо" "spasibo" "templates/page-thanks.php")
PAGE_PRIVACY=$(create_page "Политика конфиденциальности" "politika-konfidencialnosti" "templates/page-privacy.php")

# =============================================================================
# 3. READING SETTINGS (static front page)
# =============================================================================

echo ""
echo "--- 3. Reading Settings ---"

$WP option update show_on_front "page"
$WP option update page_on_front "$PAGE_HOME"
$WP option update page_for_posts "0"
log "Front page = Главная (ID: $PAGE_HOME)"
log "Posts page = none"

# =============================================================================
# 4. CREATE MENUS
# =============================================================================

echo ""
echo "--- 4. Creating Menus ---"

# --- Primary Menu ---
PRIMARY_MENU="Главное меню"
PRIMARY_EXISTS=$($WP menu list --format=json 2>/dev/null | grep -o "\"$PRIMARY_MENU\"" || true)

if [ -z "$PRIMARY_EXISTS" ]; then
    $WP menu create "$PRIMARY_MENU"
    log "Created menu: $PRIMARY_MENU"
else
    warn "Menu '$PRIMARY_MENU' already exists"
fi

# Assign to location
$WP menu location assign "$PRIMARY_MENU" primary 2>/dev/null || true
log "Assigned '$PRIMARY_MENU' to location 'primary'"

# Delete existing items and recreate (idempotent approach)
$WP menu item list "$PRIMARY_MENU" --format=ids 2>/dev/null | xargs -r -I{} $WP menu item delete {} 2>/dev/null || true

# Add items to primary menu
CATALOG_PARENT=$($WP menu item add-custom "$PRIMARY_MENU" "Каталог" "#" --porcelain 2>/dev/null)
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_PRYAMYE" --title="Прямые кухни" --parent-id="$CATALOG_PARENT" 2>/dev/null || true
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_UGLOVYE" --title="Угловые кухни" --parent-id="$CATALOG_PARENT" 2>/dev/null || true
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_POBRAZNYE" --title="П-образные кухни" --parent-id="$CATALOG_PARENT" 2>/dev/null || true
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_ABOUT" --title="О компании" 2>/dev/null || true
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_PORTFOLIO" --title="Портфолио" 2>/dev/null || true
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_REVIEWS" --title="Отзывы" 2>/dev/null || true
$WP menu item add-post "$PRIMARY_MENU" "$PAGE_CONTACTS" --title="Контакты" 2>/dev/null || true
log "Primary menu items created"

# --- Footer Menu ---
FOOTER_MENU="Меню футера"
FOOTER_EXISTS=$($WP menu list --format=json 2>/dev/null | grep -o "\"$FOOTER_MENU\"" || true)

if [ -z "$FOOTER_EXISTS" ]; then
    $WP menu create "$FOOTER_MENU"
    log "Created menu: $FOOTER_MENU"
else
    warn "Menu '$FOOTER_MENU' already exists"
fi

$WP menu location assign "$FOOTER_MENU" footer 2>/dev/null || true
log "Assigned '$FOOTER_MENU' to location 'footer'"

$WP menu item list "$FOOTER_MENU" --format=ids 2>/dev/null | xargs -r -I{} $WP menu item delete {} 2>/dev/null || true

$WP menu item add-post "$FOOTER_MENU" "$PAGE_ABOUT" --title="О компании" 2>/dev/null || true
$WP menu item add-post "$FOOTER_MENU" "$PAGE_PORTFOLIO" --title="Портфолио" 2>/dev/null || true
$WP menu item add-post "$FOOTER_MENU" "$PAGE_FAQ" --title="FAQ" 2>/dev/null || true
$WP menu item add-post "$FOOTER_MENU" "$PAGE_PRIVACY" --title="Политика конфиденциальности" 2>/dev/null || true
log "Footer menu items created"

# --- Catalog Menu ---
CATALOG_MENU="Меню каталога"
CATALOG_MENU_EXISTS=$($WP menu list --format=json 2>/dev/null | grep -o "\"$CATALOG_MENU\"" || true)

if [ -z "$CATALOG_MENU_EXISTS" ]; then
    $WP menu create "$CATALOG_MENU"
    log "Created menu: $CATALOG_MENU"
else
    warn "Menu '$CATALOG_MENU' already exists"
fi

$WP menu location assign "$CATALOG_MENU" catalog 2>/dev/null || true
log "Assigned '$CATALOG_MENU' to location 'catalog'"

$WP menu item list "$CATALOG_MENU" --format=ids 2>/dev/null | xargs -r -I{} $WP menu item delete {} 2>/dev/null || true

$WP menu item add-post "$CATALOG_MENU" "$PAGE_PRYAMYE" --title="Прямые кухни" 2>/dev/null || true
$WP menu item add-post "$CATALOG_MENU" "$PAGE_UGLOVYE" --title="Угловые кухни" 2>/dev/null || true
$WP menu item add-post "$CATALOG_MENU" "$PAGE_POBRAZNYE" --title="П-образные кухни" 2>/dev/null || true
log "Catalog menu items created"

# =============================================================================
# 5. CREATE TAXONOMY TERMS
# =============================================================================

echo ""
echo "--- 5. Creating Taxonomy Terms ---"

# kitchen_type
create_term "kitchen_type" "Прямая" "pryamaya"
create_term "kitchen_type" "Угловая" "uglovaya"
create_term "kitchen_type" "П-образная" "p-obraznaya"

# kitchen_style
create_term "kitchen_style" "Современный" "sovremennyj"
create_term "kitchen_style" "Классический" "klassicheskij"
create_term "kitchen_style" "Лофт" "loft"
create_term "kitchen_style" "Минимализм" "minimalizm"

# kitchen_material
create_term "kitchen_material" "МДФ плёнка" "mdf-plenka"
create_term "kitchen_material" "Эмаль" "emal"
create_term "kitchen_material" "Глянец" "glyanec"
create_term "kitchen_material" "Массив" "massiv"

# =============================================================================
# 6. N8N WEBHOOK URL
# =============================================================================

echo ""
echo "--- 6. N8N Webhook URL ---"

$WP option update kuhni_rema_n8n_url "$N8N_URL"
log "N8N URL: $N8N_URL"

# =============================================================================
# 7. NOINDEX PAGES (via meta)
# =============================================================================

echo ""
echo "--- 7. noindex Pages ---"

# Set noindex on thanks and privacy pages (RankMath meta)
if [ -n "$PAGE_THANKS" ]; then
    $WP post meta update "$PAGE_THANKS" rank_math_robots "noindex,nofollow" --quiet 2>/dev/null || true
    log "noindex set on /spasibo/"
fi
if [ -n "$PAGE_PRIVACY" ]; then
    $WP post meta update "$PAGE_PRIVACY" rank_math_robots "noindex,nofollow" --quiet 2>/dev/null || true
    log "noindex set on /politika-konfidencialnosti/"
fi

# =============================================================================
# 8. FLUSH REWRITE RULES
# =============================================================================

echo ""
echo "--- 8. Flush Rewrite Rules ---"

$WP rewrite flush --hard 2>/dev/null || $WP rewrite flush
log "Rewrite rules flushed"

# =============================================================================
# 9. CLEANUP
# =============================================================================

echo ""
echo "--- 9. Cleanup ---"

# Delete default "Hello world!" post
HELLO_WORLD=$($WP post list --post_type=post --name="hello-world" --format=ids 2>/dev/null || true)
if [ -n "$HELLO_WORLD" ]; then
    $WP post delete "$HELLO_WORLD" --force --quiet 2>/dev/null || true
    log "Deleted 'Hello world!' post"
fi

# Delete default "Sample Page"
SAMPLE_PAGE=$($WP post list --post_type=page --name="sample-page" --format=ids 2>/dev/null || true)
if [ -n "$SAMPLE_PAGE" ]; then
    $WP post delete "$SAMPLE_PAGE" --force --quiet 2>/dev/null || true
    log "Deleted 'Sample Page'"
fi

# Delete default "Privacy Policy" page (we have our own)
DEFAULT_PRIVACY=$($WP post list --post_type=page --name="privacy-policy" --format=ids 2>/dev/null || true)
if [ -n "$DEFAULT_PRIVACY" ]; then
    $WP post delete "$DEFAULT_PRIVACY" --force --quiet 2>/dev/null || true
    log "Deleted default 'Privacy Policy' page"
fi

# Remove default widgets
$WP widget reset --all 2>/dev/null || true
log "Widgets reset"

# =============================================================================
# DONE
# =============================================================================

echo ""
echo "============================================="
echo "  Setup complete!"
echo "============================================="
echo ""
echo "  Pages created: 12"
echo "  Menus created: 3"
echo "  Taxonomy terms: 11"
echo ""
echo "  Next steps:"
echo "  1. Activate plugins: Bricks Builder, ACF Pro, RankMath Pro"
echo "  2. Import content (kitchens, projects, reviews, FAQ)"
echo "  3. Configure Bricks Builder templates"
echo "  4. Run smoke-test.sh"
echo ""
