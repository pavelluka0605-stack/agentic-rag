<?php
/**
 * Кухни Рема — Child Theme Functions
 *
 * Стек: WordPress + Bricks Builder + ACF Pro + RankMath Pro
 * Домен: кухнирема.рф
 *
 * @package KuhniRema
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'KUHNI_REMA_VERSION', '1.0.0' );
define( 'KUHNI_REMA_DIR', get_stylesheet_directory() );
define( 'KUHNI_REMA_URI', get_stylesheet_directory_uri() );

// =============================================================================
// 1. Custom Post Types
// =============================================================================

require_once KUHNI_REMA_DIR . '/inc/cpt-kitchen.php';
require_once KUHNI_REMA_DIR . '/inc/cpt-project.php';
require_once KUHNI_REMA_DIR . '/inc/cpt-review.php';
require_once KUHNI_REMA_DIR . '/inc/cpt-team.php';
require_once KUHNI_REMA_DIR . '/inc/cpt-promotion.php';
require_once KUHNI_REMA_DIR . '/inc/cpt-faq.php';

// =============================================================================
// 2. ACF Options Pages
// =============================================================================

require_once KUHNI_REMA_DIR . '/inc/acf-options.php';

// =============================================================================
// 3. Admin Customization (Content Manager role)
// =============================================================================

require_once KUHNI_REMA_DIR . '/inc/admin-roles.php';

// =============================================================================
// 4. Helper Functions
// =============================================================================

require_once KUHNI_REMA_DIR . '/inc/helpers.php';

// =============================================================================
// 4b. SEO (Schema.org + Meta tags)
// =============================================================================

require_once KUHNI_REMA_DIR . '/inc/seo-schema.php';
require_once KUHNI_REMA_DIR . '/inc/seo-meta.php';
require_once KUHNI_REMA_DIR . '/inc/rankmath-config.php';

// =============================================================================
// 5. Enqueue Styles & Scripts
// =============================================================================

add_action( 'wp_enqueue_scripts', 'kuhni_rema_enqueue_assets' );

function kuhni_rema_enqueue_assets() {
    // Design tokens (CSS custom properties)
    wp_enqueue_style(
        'kuhni-rema-tokens',
        KUHNI_REMA_URI . '/assets/css/design-tokens.css',
        array(),
        KUHNI_REMA_VERSION
    );

    // Base styles (reset, typography, layout)
    wp_enqueue_style(
        'kuhni-rema-base',
        KUHNI_REMA_URI . '/assets/css/base.css',
        array( 'kuhni-rema-tokens' ),
        KUHNI_REMA_VERSION
    );

    // Reusable components
    wp_enqueue_style(
        'kuhni-rema-components',
        KUHNI_REMA_URI . '/assets/css/components.css',
        array( 'kuhni-rema-base' ),
        KUHNI_REMA_VERSION
    );

    // Homepage sections (conditional)
    if ( is_front_page() ) {
        wp_enqueue_style(
            'kuhni-rema-homepage',
            KUHNI_REMA_URI . '/assets/css/homepage.css',
            array( 'kuhni-rema-components' ),
            KUHNI_REMA_VERSION
        );
    }

    // Catalog & kitchen pages (archive, taxonomy, single, page-catalog template)
    if (
        is_post_type_archive( 'kitchen' ) ||
        is_tax( array( 'kitchen_type', 'kitchen_style', 'kitchen_material' ) ) ||
        is_singular( 'kitchen' ) ||
        is_page_template( 'templates/page-catalog.php' )
    ) {
        wp_enqueue_style(
            'kuhni-rema-catalog',
            KUHNI_REMA_URI . '/assets/css/catalog.css',
            array( 'kuhni-rema-components' ),
            KUHNI_REMA_VERSION
        );
    }

    // Secondary pages (about, contacts, FAQ, reviews, portfolio, thanks, privacy)
    if (
        is_page_template( 'templates/page-about.php' ) ||
        is_page_template( 'templates/page-contacts.php' ) ||
        is_page_template( 'templates/page-faq.php' ) ||
        is_page_template( 'templates/page-reviews.php' ) ||
        is_page_template( 'templates/page-portfolio.php' ) ||
        is_page_template( 'templates/page-thanks.php' ) ||
        is_page_template( 'templates/page-privacy.php' ) ||
        is_singular( 'project' )
    ) {
        wp_enqueue_style(
            'kuhni-rema-pages',
            KUHNI_REMA_URI . '/assets/css/pages.css',
            array( 'kuhni-rema-components' ),
            KUHNI_REMA_VERSION
        );
    }

    // Responsive (mobile-first overrides)
    wp_enqueue_style(
        'kuhni-rema-responsive',
        KUHNI_REMA_URI . '/assets/css/responsive.css',
        array( 'kuhni-rema-components' ),
        KUHNI_REMA_VERSION
    );

    // Google Fonts: Montserrat + Inter
    wp_enqueue_style(
        'kuhni-rema-fonts',
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600;700&display=swap',
        array(),
        null
    );

    // Main JS (mobile menu, sticky header, lazy interactions)
    wp_enqueue_script(
        'kuhni-rema-main',
        KUHNI_REMA_URI . '/assets/js/main.js',
        array(),
        KUHNI_REMA_VERSION,
        true
    );

    // AJAX forms handler
    wp_enqueue_script(
        'kuhni-rema-forms',
        KUHNI_REMA_URI . '/assets/js/forms.js',
        array(),
        KUHNI_REMA_VERSION,
        true
    );

    // Pass data to JS
    wp_localize_script( 'kuhni-rema-forms', 'kuhniRema', array(
        'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'kuhni_rema_form' ),
        'siteUrl'  => home_url(),
        'thanksUrl' => home_url( '/spasibo/' ),
    ));

    // Quiz (loaded only on pages with quiz)
    if ( is_page( 'kalkulyator' ) || is_front_page() ) {
        wp_enqueue_script(
            'kuhni-rema-quiz',
            KUHNI_REMA_URI . '/assets/js/quiz.js',
            array(),
            KUHNI_REMA_VERSION,
            true
        );
    }

    // Ecommerce DataLayer (Yandex Metrika Ecommerce / GTM compatible)
    wp_enqueue_script(
        'kuhni-rema-datalayer',
        KUHNI_REMA_URI . '/assets/js/datalayer.js',
        array(),
        KUHNI_REMA_VERSION,
        true
    );

    // Analytics events (Yandex Metrika)
    wp_enqueue_script(
        'kuhni-rema-analytics',
        KUHNI_REMA_URI . '/assets/js/analytics.js',
        array( 'kuhni-rema-datalayer' ),
        KUHNI_REMA_VERSION,
        true
    );

    // Quiz popup (45-second timer) — not on quiz or thanks pages
    if ( ! is_page( 'kalkulyator' ) && ! is_page_template( 'templates/page-thanks.php' ) ) {
        wp_enqueue_script(
            'kuhni-rema-quiz-popup',
            KUHNI_REMA_URI . '/assets/js/quiz-popup.js',
            array(),
            KUHNI_REMA_VERSION,
            true
        );
    }
}

// =============================================================================
// 6. Theme Setup
// =============================================================================

add_action( 'after_setup_theme', 'kuhni_rema_setup' );

function kuhni_rema_setup() {
    // Image sizes for catalog
    add_image_size( 'kitchen-card', 800, 600, true );     // Catalog card 4:3
    add_image_size( 'kitchen-detail', 1080, 810, true );   // Detail page
    add_image_size( 'kitchen-hero', 1920, 1080, true );    // Hero banner
    add_image_size( 'kitchen-thumb', 400, 300, true );     // Thumbnail
    add_image_size( 'kitchen-micro', 200, 150, true );     // Quiz/nav micro

    // Nav menus
    register_nav_menus( array(
        'primary'    => 'Главное меню',
        'footer'     => 'Меню футера',
        'catalog'    => 'Меню каталога',
    ));

    // Theme support
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'html5', array(
        'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script',
    ));
}

// =============================================================================
// 7. WebP Upload Support
// =============================================================================

add_filter( 'upload_mimes', 'kuhni_rema_webp_upload' );

function kuhni_rema_webp_upload( $mimes ) {
    $mimes['webp'] = 'image/webp';
    return $mimes;
}

// =============================================================================
// 8a. Add data-kitchen-id to <body> on single kitchen pages (used by datalayer.js & main.js)
// =============================================================================

add_filter( 'body_class', 'kuhni_rema_body_attributes' );

function kuhni_rema_body_attributes( $classes ) {
    if ( is_singular( 'kitchen' ) ) {
        add_filter( 'language_attributes', 'kuhni_rema_kitchen_body_data' );
    }
    return $classes;
}

/**
 * Inject data-kitchen-id on <body> via wp_body_open.
 */
add_action( 'wp_body_open', 'kuhni_rema_body_open_kitchen_id' );

function kuhni_rema_body_open_kitchen_id() {
    if ( is_singular( 'kitchen' ) ) {
        echo '<script>document.body.setAttribute("data-kitchen-id","' . esc_js( get_the_ID() ) . '");</script>' . "\n";
    }
}

// =============================================================================
// 8. Disable unnecessary features for performance
// =============================================================================

// Remove emoji scripts
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );

// Remove WP embed
remove_action( 'wp_head', 'wp_oembed_add_host_js' );

// Remove REST API link
remove_action( 'wp_head', 'rest_output_link_wp_head' );

// Remove wlwmanifest link
remove_action( 'wp_head', 'wlwmanifest_link' );

// Remove RSD link
remove_action( 'wp_head', 'rsd_link' );

// Remove WordPress version
remove_action( 'wp_head', 'wp_generator' );

// =============================================================================
// 9. AJAX Form Handler (webhook to n8n)
// =============================================================================

add_action( 'wp_ajax_kuhni_rema_submit_form', 'kuhni_rema_handle_form' );
add_action( 'wp_ajax_nopriv_kuhni_rema_submit_form', 'kuhni_rema_handle_form' );

function kuhni_rema_handle_form() {
    check_ajax_referer( 'kuhni_rema_form', 'nonce' );

    $form_type = sanitize_text_field( $_POST['form_type'] ?? '' );
    $name      = sanitize_text_field( $_POST['name'] ?? '' );
    $phone     = sanitize_text_field( $_POST['phone'] ?? '' );

    if ( empty( $phone ) ) {
        wp_send_json_error( array( 'message' => 'Укажите телефон' ), 400 );
    }

    // Build payload
    $payload = array(
        'form_type'  => $form_type,
        'name'       => $name,
        'phone'      => $phone,
        'page_url'   => sanitize_url( $_POST['page_url'] ?? '' ),
        'utm_source' => sanitize_text_field( $_POST['utm_source'] ?? '' ),
        'utm_medium' => sanitize_text_field( $_POST['utm_medium'] ?? '' ),
        'utm_campaign' => sanitize_text_field( $_POST['utm_campaign'] ?? '' ),
        'timestamp'  => current_time( 'mysql' ),
    );

    // Additional fields by form type
    if ( 'zamer' === $form_type ) {
        $payload['address'] = sanitize_text_field( $_POST['address'] ?? '' );
        $payload['preferred_time'] = sanitize_text_field( $_POST['preferred_time'] ?? '' );
    }

    if ( 'callback' === $form_type ) {
        // Minimal fields
    }

    // Determine webhook URL based on form type
    $webhook_urls = array(
        'quiz'               => 'webhook/quiz-lead',
        'zamer'              => 'webhook/zamer-lead',
        'competitor_project' => 'webhook/competitor-project',
        'callback'           => 'webhook/callback',
        'quick'              => 'webhook/quick-lead',
    );

    $webhook_path = $webhook_urls[ $form_type ] ?? 'webhook/quick-lead';

    // Get n8n base URL from ACF options or wp_options
    $n8n_base = get_option( 'kuhni_rema_n8n_url', '' );
    if ( empty( $n8n_base ) ) {
        // Fallback: send via email
        kuhni_rema_fallback_email( $payload );
        wp_send_json_success( array( 'message' => 'Заявка отправлена' ) );
    }

    $webhook_url = trailingslashit( $n8n_base ) . $webhook_path;

    // Send to n8n webhook
    $response = wp_remote_post( $webhook_url, array(
        'body'    => wp_json_encode( $payload ),
        'headers' => array( 'Content-Type' => 'application/json' ),
        'timeout' => 10,
    ));

    if ( is_wp_error( $response ) ) {
        // Fallback: email
        kuhni_rema_fallback_email( $payload );
    }

    wp_send_json_success( array( 'message' => 'Заявка отправлена' ) );
}

/**
 * Fallback: send lead via email if webhook is unavailable
 */
function kuhni_rema_fallback_email( $payload ) {
    $to      = get_option( 'admin_email' );
    $subject = sprintf( '[Кухни Рема] Новая заявка: %s', $payload['form_type'] );
    $body    = "Новая заявка с сайта кухнирема.рф\n\n";
    foreach ( $payload as $key => $value ) {
        if ( ! empty( $value ) ) {
            $body .= ucfirst( $key ) . ': ' . $value . "\n";
        }
    }
    wp_mail( $to, $subject, $body );
}
