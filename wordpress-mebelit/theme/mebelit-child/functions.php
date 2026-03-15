<?php
/**
 * Mebelit Child Theme — functions.php
 *
 * Кухни на заказ в Красноярске
 * Дочерняя тема Hello Elementor
 */

if (!defined('ABSPATH')) exit;

define('MEBELIT_VERSION', '2.0.0');
define('MEBELIT_DIR', get_stylesheet_directory());
define('MEBELIT_URI', get_stylesheet_directory_uri());

/* ============================================
   1. ENQUEUE STYLES & SCRIPTS
   ============================================ */

add_action('wp_enqueue_scripts', function () {
    // Parent theme
    wp_enqueue_style('hello-elementor', get_template_directory_uri() . '/style.css');

    // Child theme
    wp_enqueue_style(
        'mebelit-child',
        get_stylesheet_uri(),
        ['hello-elementor'],
        MEBELIT_VERSION
    );

    // Google Fonts — preconnect + swap
    wp_enqueue_style(
        'mebelit-fonts',
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;600&display=swap',
        [],
        null
    );

    // Main JS (header scroll, phone mask, smooth scroll, popups, forms)
    wp_enqueue_script(
        'mebelit-main',
        MEBELIT_URI . '/assets/js/main.js',
        [],
        MEBELIT_VERSION,
        true
    );

    // Localize for AJAX forms
    wp_localize_script('mebelit-main', 'mebelitAjax', [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce'   => wp_create_nonce('mebelit_form_nonce'),
        'siteUrl' => home_url(),
    ]);

    // Quiz script (only on quiz page)
    if (is_page('quiz') || is_page_template('templates/page-quiz.php')) {
        wp_enqueue_script(
            'mebelit-quiz',
            MEBELIT_URI . '/assets/js/quiz.js',
            ['mebelit-main'],
            MEBELIT_VERSION,
            true
        );
        wp_localize_script('mebelit-quiz', 'mebelitQuiz', [
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('mebelit_form_nonce'),
            'themeUrl' => MEBELIT_URI,
        ]);
    }
});

// Preconnect Google Fonts
add_action('wp_head', function () {
    echo '<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n";
    echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";
}, 1);


/* ============================================
   2. CUSTOM POST TYPE: KITCHEN
   ============================================ */

add_action('init', function () {
    register_post_type('kitchen', [
        'labels' => [
            'name'          => 'Кухни',
            'singular_name' => 'Кухня',
            'add_new'       => 'Добавить кухню',
            'add_new_item'  => 'Добавить новую кухню',
            'edit_item'     => 'Редактировать кухню',
            'all_items'     => 'Все кухни',
            'search_items'  => 'Искать кухни',
            'not_found'     => 'Кухни не найдены',
        ],
        'public'       => true,
        'has_archive'  => false,
        'show_in_rest' => true,
        'menu_icon'    => 'dashicons-admin-home',
        'supports'     => ['title', 'thumbnail', 'custom-fields'],
        'rewrite'      => ['slug' => 'kitchen', 'with_front' => false],
    ]);

    register_taxonomy('kitchen_type', 'kitchen', [
        'labels' => [
            'name'          => 'Тип кухни',
            'singular_name' => 'Тип',
            'all_items'     => 'Все типы',
            'add_new_item'  => 'Добавить тип',
        ],
        'public'       => true,
        'hierarchical' => true,
        'show_in_rest' => true,
        'rewrite'      => ['slug' => 'kitchen-type'],
    ]);
});

// Pre-populate kitchen types on theme activation
add_action('after_switch_theme', function () {
    $types = [
        'straight' => 'Прямая',
        'corner'   => 'Угловая',
        'pshape'   => 'П-образная',
    ];
    foreach ($types as $slug => $name) {
        if (!term_exists($slug, 'kitchen_type')) {
            wp_insert_term($name, 'kitchen_type', ['slug' => $slug]);
        }
    }
});


/* ============================================
   3. CUSTOM POST TYPE: REVIEW
   ============================================ */

add_action('init', function () {
    register_post_type('review', [
        'labels' => [
            'name'          => 'Отзывы',
            'singular_name' => 'Отзыв',
            'add_new'       => 'Добавить отзыв',
            'add_new_item'  => 'Новый отзыв',
            'edit_item'     => 'Редактировать отзыв',
            'all_items'     => 'Все отзывы',
        ],
        'public'       => true,
        'has_archive'  => false,
        'show_in_rest' => true,
        'menu_icon'    => 'dashicons-star-filled',
        'supports'     => ['title', 'custom-fields'],
        'rewrite'      => false,
    ]);
});


/* ============================================
   4. ACF OPTIONS PAGES
   ============================================ */

add_action('acf/init', function () {
    if (!function_exists('acf_add_options_page')) return;

    acf_add_options_page([
        'page_title' => 'Настройки Mebelit',
        'menu_title' => 'Mebelit',
        'menu_slug'  => 'mebelit-settings',
        'capability' => 'manage_options',
        'icon_url'   => 'dashicons-admin-generic',
        'position'   => 2,
    ]);

    acf_add_options_sub_page([
        'page_title'  => 'Команда',
        'menu_title'  => 'Команда',
        'parent_slug' => 'mebelit-settings',
    ]);

    acf_add_options_sub_page([
        'page_title'  => 'Интеграции',
        'menu_title'  => 'Интеграции',
        'parent_slug' => 'mebelit-settings',
    ]);
});


/* ============================================
   5. FORM HANDLERS (AJAX)
   ============================================ */

/**
 * Get webhook URL from ACF options or WP option
 */
function mebelit_get_webhook_url() {
    if (function_exists('get_field')) {
        $url = get_field('webhook_url', 'option');
        if ($url) return $url;
    }
    return get_option('mebelit_webhook_url', '');
}

/**
 * Send form data to webhook + email
 */
function mebelit_send_lead($data, $type = 'general') {
    $data['form_type'] = $type;
    $data['timestamp'] = current_time('mysql');

    // Send to webhook (n8n / Telegram)
    $webhook_url = mebelit_get_webhook_url();
    if (!empty($webhook_url)) {
        wp_remote_post($webhook_url, [
            'body'    => wp_json_encode($data),
            'headers' => ['Content-Type' => 'application/json'],
            'timeout' => 15,
        ]);
    }

    // Email notification
    $admin_email = get_option('admin_email');
    $form_labels = [
        'general'   => 'Общая заявка',
        'designer'  => 'Вызов дизайнера',
        'discount'  => 'Скидка новоселам',
        'callback'  => 'Обратный звонок',
        'quiz'      => 'Квиз-калькулятор',
        'catalog'   => 'Заявка из каталога',
    ];
    $label = $form_labels[$type] ?? 'Заявка';
    $name = $data['name'] ?? 'Без имени';
    $phone = $data['phone'] ?? 'Нет телефона';

    $body_lines = ["Тип: {$label}"];
    foreach ($data as $key => $value) {
        if (!empty($value) && $key !== 'form_type' && $key !== 'honeypot') {
            $body_lines[] = ucfirst(str_replace('_', ' ', $key)) . ": {$value}";
        }
    }

    wp_mail(
        $admin_email,
        sprintf('%s — %s (%s)', $label, $name, $phone),
        implode("\n", $body_lines)
    );

    return true;
}

/**
 * Honeypot validation — spam protection
 */
function mebelit_check_honeypot($post_data) {
    if (!empty($post_data['website_url'])) {
        return false; // Bot filled hidden field
    }
    return true;
}

/**
 * Rate limiting — max 5 submissions per IP per hour
 */
function mebelit_check_rate_limit() {
    $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
    $transient_key = 'mebelit_rate_' . md5($ip);
    $count = (int) get_transient($transient_key);

    if ($count >= 5) {
        return false;
    }

    set_transient($transient_key, $count + 1, HOUR_IN_SECONDS);
    return true;
}

// --- Quiz form handler ---
add_action('wp_ajax_mebelit_quiz_submit', 'mebelit_handle_quiz');
add_action('wp_ajax_nopriv_mebelit_quiz_submit', 'mebelit_handle_quiz');

function mebelit_handle_quiz() {
    check_ajax_referer('mebelit_form_nonce', 'nonce');

    if (!mebelit_check_honeypot($_POST)) {
        wp_send_json_success(['message' => 'Заявка отправлена']); // Silent fail
    }
    if (!mebelit_check_rate_limit()) {
        wp_send_json_error(['message' => 'Слишком много заявок. Попробуйте позже.']);
    }

    $data = [
        'name'           => sanitize_text_field($_POST['name'] ?? ''),
        'phone'          => sanitize_text_field($_POST['phone'] ?? ''),
        'layout'         => sanitize_text_field($_POST['layout'] ?? ''),
        'side_a'         => sanitize_text_field($_POST['side_a'] ?? ''),
        'side_b'         => sanitize_text_field($_POST['side_b'] ?? ''),
        'side_c'         => sanitize_text_field($_POST['side_c'] ?? ''),
        'contact_method' => sanitize_text_field($_POST['contact_method'] ?? ''),
        'page_url'       => sanitize_url($_POST['page_url'] ?? ''),
    ];

    if (empty($data['name']) || empty($data['phone'])) {
        wp_send_json_error(['message' => 'Заполните имя и телефон']);
    }

    $phone_clean = preg_replace('/[^0-9+]/', '', $data['phone']);
    if (strlen($phone_clean) < 11) {
        wp_send_json_error(['message' => 'Некорректный номер телефона']);
    }

    mebelit_send_lead($data, 'quiz');
    wp_send_json_success(['message' => 'Заявка отправлена']);
}

// --- Contact form handler ---
add_action('wp_ajax_mebelit_contact', 'mebelit_handle_contact');
add_action('wp_ajax_nopriv_mebelit_contact', 'mebelit_handle_contact');

function mebelit_handle_contact() {
    check_ajax_referer('mebelit_form_nonce', 'nonce');

    if (!mebelit_check_honeypot($_POST)) {
        wp_send_json_success(['message' => 'Заявка отправлена']);
    }
    if (!mebelit_check_rate_limit()) {
        wp_send_json_error(['message' => 'Слишком много заявок. Попробуйте позже.']);
    }

    $name  = sanitize_text_field($_POST['name'] ?? '');
    $phone = sanitize_text_field($_POST['phone'] ?? '');
    $form  = sanitize_text_field($_POST['form_type'] ?? 'general');

    if (empty($phone)) {
        wp_send_json_error(['message' => 'Укажите телефон']);
    }

    $phone_clean = preg_replace('/[^0-9+]/', '', $phone);
    if (strlen($phone_clean) < 11) {
        wp_send_json_error(['message' => 'Некорректный номер телефона']);
    }

    mebelit_send_lead([
        'name'     => $name,
        'phone'    => $phone,
        'page_url' => sanitize_url($_POST['page_url'] ?? ''),
    ], $form);

    wp_send_json_success(['message' => 'Заявка отправлена']);
}


/* ============================================
   6. SHORTCODES
   ============================================ */

// Phone number shortcode: [mebelit_phone]
add_shortcode('mebelit_phone', function () {
    if (function_exists('get_field')) {
        $phone = get_field('site_phone', 'option');
        $raw = get_field('site_phone_raw', 'option');
        if ($phone && $raw) {
            return '<a href="tel:' . esc_attr($raw) . '" class="header-phone">' . esc_html($phone) . '</a>';
        }
    }
    return '<a href="tel:+73912169759" class="header-phone">+7 (391) 216-97-59</a>';
});

// Work hours shortcode: [mebelit_hours]
add_shortcode('mebelit_hours', function () {
    if (function_exists('get_field')) {
        $hours = get_field('site_work_hours', 'option');
        if ($hours) return esc_html($hours);
    }
    return '10:00-18:00 пн-пт';
});

// Address shortcode: [mebelit_address]
add_shortcode('mebelit_address', function () {
    if (function_exists('get_field')) {
        $addr = get_field('site_address', 'option');
        if ($addr) return esc_html($addr);
    }
    return 'Красноярск, ул. 2 Огородная 26';
});

// Contact form shortcode: [mebelit_form type="general" title="Оставьте заявку"]
add_shortcode('mebelit_form', function ($atts) {
    $atts = shortcode_atts([
        'type'  => 'general',
        'title' => 'Оставьте заявку',
        'btn'   => 'ОТПРАВИТЬ',
    ], $atts);

    ob_start();
    ?>
    <div class="mebelit-form-wrap">
        <?php if ($atts['title']): ?>
            <h3 class="mebelit-form__title"><?php echo esc_html($atts['title']); ?></h3>
        <?php endif; ?>
        <form class="mebelit-form" data-form-type="<?php echo esc_attr($atts['type']); ?>">
            <input type="text" name="name" placeholder="Ваше имя" required>
            <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" required>
            <!-- Honeypot -->
            <div style="position:absolute;left:-9999px;" aria-hidden="true">
                <input type="text" name="website_url" tabindex="-1" autocomplete="off">
            </div>
            <label class="form-consent">
                <input type="checkbox" name="consent" checked required>
                <span>Даю согласие на обработку данных в соответствии с
                <a href="/politics/" target="_blank">Политикой конфиденциальности</a></span>
            </label>
            <button type="submit" class="btn-primary"><?php echo esc_html($atts['btn']); ?></button>
            <div class="mebelit-form__status" style="display:none;"></div>
        </form>
    </div>
    <?php
    return ob_get_clean();
});

// Quiz embed shortcode: [mebelit_quiz]
add_shortcode('mebelit_quiz', function () {
    if (!wp_script_is('mebelit-quiz', 'enqueued')) {
        wp_enqueue_script(
            'mebelit-quiz',
            MEBELIT_URI . '/assets/js/quiz.js',
            ['mebelit-main'],
            MEBELIT_VERSION,
            true
        );
        wp_localize_script('mebelit-quiz', 'mebelitQuiz', [
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('mebelit_form_nonce'),
            'themeUrl' => MEBELIT_URI,
        ]);
    }
    return '<div id="mebelit-quiz"></div>';
});


/* ============================================
   7. YANDEX METRIKA
   ============================================ */

add_action('wp_head', function () {
    $metrika_id = '103970425';
    if (function_exists('get_field')) {
        $custom = get_field('metrika_id', 'option');
        if ($custom) $metrika_id = $custom;
    }
    ?>
    <!-- Yandex.Metrika counter -->
    <script type="text/javascript">
       (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
       m[i].l=1*new Date();
       for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
       k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
       (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
       ym(<?php echo esc_js($metrika_id); ?>, "init", {
            clickmap:true,
            trackLinks:true,
            accurateTrackBounce:true,
            webvisor:true
       });
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/<?php echo esc_attr($metrika_id); ?>" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    <?php
});


/* ============================================
   8. SECURITY
   ============================================ */

// Security headers
add_action('send_headers', function () {
    if (!is_admin()) {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    }
});

// Remove WordPress emoji
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');

// Remove XML-RPC (security)
add_filter('xmlrpc_enabled', '__return_false');

// Remove WordPress version
remove_action('wp_head', 'wp_generator');

// Disable oEmbed
remove_action('wp_head', 'wp_oembed_add_discovery_links');
remove_action('wp_head', 'wp_oembed_add_host_js');

// Remove REST API user enumeration for non-logged-in users
add_filter('rest_endpoints', function ($endpoints) {
    if (!is_user_logged_in()) {
        unset($endpoints['/wp/v2/users']);
        unset($endpoints['/wp/v2/users/(?P<id>[\d]+)']);
    }
    return $endpoints;
});


/* ============================================
   9. ELEMENTOR CUSTOMIZATIONS
   ============================================ */

// Register Elementor custom breakpoints
add_action('elementor/init', function () {
    // Ensure Elementor uses our fonts
    add_filter('elementor/fonts/additional_fonts', function ($fonts) {
        $fonts['Montserrat'] = 'googlefonts';
        $fonts['Open Sans']  = 'googlefonts';
        return $fonts;
    });
});

// Add custom classes to Elementor widgets
add_action('elementor/widget/before_render', function ($widget) {
    if ($widget->get_name() === 'button') {
        $settings = $widget->get_settings_for_display();
        // Auto-add btn-primary class to accent-colored buttons
    }
});


/* ============================================
   10. SCHEMA.ORG STRUCTURED DATA
   ============================================ */

add_action('wp_head', function () {
    if (!is_front_page()) return;

    $phone = '+73912169759';
    $address = 'Красноярск, ул. 2 Огородная 26';
    if (function_exists('get_field')) {
        $p = get_field('site_phone_raw', 'option');
        if ($p) $phone = $p;
        $a = get_field('site_address', 'option');
        if ($a) $address = $a;
    }

    $schema = [
        '@context'    => 'https://schema.org',
        '@type'       => 'LocalBusiness',
        'name'        => 'Mebelit — Кухни на заказ',
        'description' => 'Кухни любой сложности на заказ в Красноярске. Цены ниже рыночной до 50%. Сроки от 21 дня.',
        'url'         => home_url('/'),
        'telephone'   => $phone,
        'address'     => [
            '@type'           => 'PostalAddress',
            'addressLocality' => 'Красноярск',
            'streetAddress'   => $address,
            'addressCountry'  => 'RU',
        ],
        'openingHours' => 'Mo-Fr 10:00-18:00',
        'priceRange'   => '₽₽',
        'image'        => MEBELIT_URI . '/screenshot.png',
    ];

    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
});


/* ============================================
   11. ADMIN CUSTOMIZATION
   ============================================ */

// Custom admin footer
add_filter('admin_footer_text', function () {
    return '<span>Mebelit — Кухни на заказ в Красноярске</span>';
});

// Include popup templates in footer
add_action('wp_footer', function () {
    include MEBELIT_DIR . '/templates/popups.php';
});

// Custom login logo
add_action('login_enqueue_scripts', function () {
    echo '<style>
        #login h1 a {
            background-image: none !important;
            font-size: 24px;
            font-weight: 700;
            color: #1a1a2e;
            text-indent: 0;
            width: auto;
            height: auto;
        }
        #login h1 a::after {
            content: "MEBELIT";
        }
    </style>';
});
