<?php
/**
 * Mebelit Child Theme — functions.php
 *
 * Кухни на заказ в Красноярске
 * Дочерняя тема Hello Elementor
 */

if (!defined('ABSPATH')) exit;

define('MEBELIT_VERSION', '1.0.0');

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

    // Google Fonts
    wp_enqueue_style(
        'mebelit-fonts',
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;600&display=swap',
        [],
        null
    );

    // Quiz script (only on quiz page)
    if (is_page('quiz')) {
        wp_enqueue_script(
            'mebelit-quiz',
            get_stylesheet_directory_uri() . '/assets/js/quiz.js',
            [],
            MEBELIT_VERSION,
            true
        );
        wp_localize_script('mebelit-quiz', 'mebelitQuiz', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('mebelit_quiz_nonce'),
        ]);
    }

    // Header scroll effect
    wp_enqueue_script(
        'mebelit-main',
        get_stylesheet_directory_uri() . '/assets/js/main.js',
        [],
        MEBELIT_VERSION,
        true
    );
});


/* ============================================
   2. CUSTOM POST TYPE: KITCHEN
   ============================================ */

add_action('init', function () {
    register_post_type('kitchen', [
        'labels' => [
            'name'               => 'Кухни',
            'singular_name'      => 'Кухня',
            'add_new'            => 'Добавить кухню',
            'add_new_item'       => 'Добавить новую кухню',
            'edit_item'          => 'Редактировать кухню',
            'all_items'          => 'Все кухни',
            'search_items'       => 'Искать кухни',
            'not_found'          => 'Кухни не найдены',
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
            'singular_name' => 'Тип кухни',
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
            'name'               => 'Отзывы',
            'singular_name'      => 'Отзыв',
            'add_new'            => 'Добавить отзыв',
            'add_new_item'       => 'Новый отзыв',
            'edit_item'          => 'Редактировать отзыв',
            'all_items'          => 'Все отзывы',
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
    if (function_exists('acf_add_options_page')) {
        acf_add_options_page([
            'page_title' => 'Настройки сайта',
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
    }
});


/* ============================================
   5. QUIZ FORM HANDLER (AJAX)
   ============================================ */

add_action('wp_ajax_mebelit_quiz_submit', 'mebelit_handle_quiz');
add_action('wp_ajax_nopriv_mebelit_quiz_submit', 'mebelit_handle_quiz');

function mebelit_handle_quiz() {
    check_ajax_referer('mebelit_quiz_nonce', 'nonce');

    $data = [
        'name'      => sanitize_text_field($_POST['name'] ?? ''),
        'phone'     => sanitize_text_field($_POST['phone'] ?? ''),
        'layout'    => sanitize_text_field($_POST['layout'] ?? ''),
        'side_a'    => sanitize_text_field($_POST['side_a'] ?? ''),
        'side_b'    => sanitize_text_field($_POST['side_b'] ?? ''),
        'side_c'    => sanitize_text_field($_POST['side_c'] ?? ''),
        'contact'   => sanitize_text_field($_POST['contact_method'] ?? ''),
        'page_url'  => sanitize_url($_POST['page_url'] ?? ''),
        'timestamp' => current_time('mysql'),
    ];

    // Validate required fields
    if (empty($data['name']) || empty($data['phone'])) {
        wp_send_json_error(['message' => 'Заполните имя и телефон']);
    }

    // Validate phone format (Russian)
    $phone_clean = preg_replace('/[^0-9+]/', '', $data['phone']);
    if (strlen($phone_clean) < 10) {
        wp_send_json_error(['message' => 'Некорректный номер телефона']);
    }

    // Send to webhook (n8n / Telegram)
    $webhook_url = get_option('mebelit_webhook_url', '');
    if (!empty($webhook_url)) {
        wp_remote_post($webhook_url, [
            'body'    => wp_json_encode($data),
            'headers' => ['Content-Type' => 'application/json'],
            'timeout' => 10,
        ]);
    }

    // Send email notification
    $admin_email = get_option('admin_email');
    $subject = sprintf('Новая заявка с квиза — %s', $data['name']);
    $body = sprintf(
        "Имя: %s\nТелефон: %s\nПланировка: %s\nРазмеры: A=%s B=%s C=%s\nСпособ связи: %s\nСтраница: %s\nВремя: %s",
        $data['name'], $data['phone'], $data['layout'],
        $data['side_a'], $data['side_b'], $data['side_c'],
        $data['contact'], $data['page_url'], $data['timestamp']
    );
    wp_mail($admin_email, $subject, $body);

    wp_send_json_success(['message' => 'Заявка отправлена']);
}


/* ============================================
   6. CONTACT FORM HANDLER (AJAX)
   ============================================ */

add_action('wp_ajax_mebelit_contact', 'mebelit_handle_contact');
add_action('wp_ajax_nopriv_mebelit_contact', 'mebelit_handle_contact');

function mebelit_handle_contact() {
    check_ajax_referer('mebelit_quiz_nonce', 'nonce');

    $name  = sanitize_text_field($_POST['name'] ?? '');
    $phone = sanitize_text_field($_POST['phone'] ?? '');
    $form  = sanitize_text_field($_POST['form_type'] ?? 'general');

    if (empty($phone)) {
        wp_send_json_error(['message' => 'Укажите телефон']);
    }

    $data = [
        'name'      => $name,
        'phone'     => $phone,
        'form_type' => $form,
        'page_url'  => sanitize_url($_POST['page_url'] ?? ''),
        'timestamp' => current_time('mysql'),
    ];

    // Webhook
    $webhook_url = get_option('mebelit_webhook_url', '');
    if (!empty($webhook_url)) {
        wp_remote_post($webhook_url, [
            'body'    => wp_json_encode($data),
            'headers' => ['Content-Type' => 'application/json'],
            'timeout' => 10,
        ]);
    }

    // Email
    $admin_email = get_option('admin_email');
    $form_labels = [
        'general'  => 'Общая заявка',
        'designer' => 'Вызов дизайнера',
        'discount' => 'Скидка новоселам',
        'callback' => 'Обратный звонок',
    ];
    $label = $form_labels[$form] ?? 'Заявка';
    wp_mail(
        $admin_email,
        sprintf('%s — %s (%s)', $label, $name, $phone),
        sprintf("Тип: %s\nИмя: %s\nТелефон: %s\nСтраница: %s\nВремя: %s",
            $label, $name, $phone, $data['page_url'], $data['timestamp']
        )
    );

    wp_send_json_success(['message' => 'Заявка отправлена']);
}


/* ============================================
   7. WEBHOOK SETTINGS PAGE
   ============================================ */

add_action('admin_init', function () {
    register_setting('mebelit_settings', 'mebelit_webhook_url', [
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
    ]);
});


/* ============================================
   8. YANDEX METRIKA
   ============================================ */

add_action('wp_head', function () {
    $metrika_id = '103970425';
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
   9. SECURITY HEADERS
   ============================================ */

add_action('send_headers', function () {
    if (!is_admin()) {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
    }
});


/* ============================================
   10. DISABLE UNNECESSARY FEATURES
   ============================================ */

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
