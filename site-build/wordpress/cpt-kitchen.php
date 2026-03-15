<?php
/**
 * Custom Post Type: Kitchen (Кухня)
 * Регистрация CPT, таксономий и ACF полей для каталога кухонь.
 * Сайт: кухнирема.рф
 *
 * Использование: подключить в functions.php темы:
 *   require_once get_template_directory() . '/inc/cpt-kitchen.php';
 *
 * Или как MU-plugin:
 *   Скопировать в wp-content/mu-plugins/cpt-kitchen.php
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// =============================================================================
// 1. Регистрация Custom Post Type "Kitchen"
// =============================================================================

add_action( 'init', 'kitchen_register_post_type' );

function kitchen_register_post_type() {
    $labels = array(
        'name'                  => 'Кухни',
        'singular_name'         => 'Кухня',
        'add_new'               => 'Добавить кухню',
        'add_new_item'          => 'Добавить новую кухню',
        'edit_item'             => 'Редактировать кухню',
        'new_item'              => 'Новая кухня',
        'view_item'             => 'Посмотреть кухню',
        'view_items'            => 'Посмотреть кухни',
        'search_items'          => 'Найти кухню',
        'not_found'             => 'Кухни не найдены',
        'not_found_in_trash'    => 'В корзине кухонь не найдено',
        'all_items'             => 'Все кухни',
        'archives'              => 'Архив кухонь',
        'attributes'            => 'Атрибуты кухни',
        'insert_into_item'      => 'Вставить в кухню',
        'uploaded_to_this_item' => 'Загружено для этой кухни',
        'filter_items_list'     => 'Фильтр списка кухонь',
        'items_list_navigation' => 'Навигация по списку кухонь',
        'items_list'            => 'Список кухонь',
        'menu_name'             => 'Кухни',
    );

    $args = array(
        'labels'             => $labels,
        'public'             => true,
        'publicly_queryable' => true,
        'show_ui'            => true,
        'show_in_menu'       => true,
        'show_in_nav_menus'  => true,
        'show_in_admin_bar'  => true,
        'show_in_rest'       => true,
        'has_archive'        => true,
        'hierarchical'       => false,
        'exclude_from_search'=> false,
        'capability_type'    => 'post',
        'map_meta_cap'       => true,
        'supports'           => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
        'rewrite'            => array(
            'slug'       => 'kuhnya',
            'with_front' => false,
            'feeds'      => true,
        ),
        'menu_position'      => 5,
        'menu_icon'          => 'dashicons-food',
    );

    register_post_type( 'kitchen', $args );
}

// =============================================================================
// 2. Регистрация таксономий
// =============================================================================

add_action( 'init', 'kitchen_register_taxonomies' );

function kitchen_register_taxonomies() {

    // --- Тип кухни (прямая, угловая, П-образная) ---
    register_taxonomy( 'kitchen_type', 'kitchen', array(
        'labels' => array(
            'name'              => 'Типы кухонь',
            'singular_name'     => 'Тип кухни',
            'search_items'      => 'Найти тип',
            'all_items'         => 'Все типы',
            'parent_item'       => 'Родительский тип',
            'parent_item_colon' => 'Родительский тип:',
            'edit_item'         => 'Редактировать тип',
            'update_item'       => 'Обновить тип',
            'add_new_item'      => 'Добавить новый тип',
            'new_item_name'     => 'Название нового типа',
            'menu_name'         => 'Тип кухни',
        ),
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_nav_menus' => true,
        'show_in_rest'      => true,
        'rewrite'           => array(
            'slug'         => 'tip-kuhni',
            'with_front'   => false,
            'hierarchical' => true,
        ),
    ));

    // --- Стиль кухни ---
    register_taxonomy( 'kitchen_style', 'kitchen', array(
        'labels' => array(
            'name'              => 'Стили кухонь',
            'singular_name'     => 'Стиль кухни',
            'search_items'      => 'Найти стиль',
            'all_items'         => 'Все стили',
            'parent_item'       => 'Родительский стиль',
            'parent_item_colon' => 'Родительский стиль:',
            'edit_item'         => 'Редактировать стиль',
            'update_item'       => 'Обновить стиль',
            'add_new_item'      => 'Добавить новый стиль',
            'new_item_name'     => 'Название нового стиля',
            'menu_name'         => 'Стиль кухни',
        ),
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_nav_menus' => true,
        'show_in_rest'      => true,
        'rewrite'           => array(
            'slug'         => 'stil-kuhni',
            'with_front'   => false,
            'hierarchical' => true,
        ),
    ));

    // --- Материал фасада ---
    register_taxonomy( 'kitchen_material', 'kitchen', array(
        'labels' => array(
            'name'              => 'Материалы фасада',
            'singular_name'     => 'Материал фасада',
            'search_items'      => 'Найти материал',
            'all_items'         => 'Все материалы',
            'parent_item'       => 'Родительский материал',
            'parent_item_colon' => 'Родительский материал:',
            'edit_item'         => 'Редактировать материал',
            'update_item'       => 'Обновить материал',
            'add_new_item'      => 'Добавить новый материал',
            'new_item_name'     => 'Название нового материала',
            'menu_name'         => 'Материал фасада',
        ),
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_nav_menus' => true,
        'show_in_rest'      => true,
        'rewrite'           => array(
            'slug'         => 'material-fasada',
            'with_front'   => false,
            'hierarchical' => true,
        ),
    ));
}

// =============================================================================
// 3. Создание термов по умолчанию при активации темы
// =============================================================================

add_action( 'after_switch_theme', 'kitchen_create_default_terms' );

function kitchen_create_default_terms() {

    // Типы кухонь
    $types = array(
        'Прямая'      => 'pryamaya',
        'Угловая'     => 'uglovaya',
        'П-образная'  => 'p-obraznaya',
    );
    foreach ( $types as $name => $slug ) {
        if ( ! term_exists( $slug, 'kitchen_type' ) ) {
            wp_insert_term( $name, 'kitchen_type', array( 'slug' => $slug ) );
        }
    }

    // Стили
    $styles = array(
        'Современный'   => 'sovremennyj',
        'Классический'  => 'klassicheskij',
        'Лофт'          => 'loft',
        'Минимализм'    => 'minimalizm',
    );
    foreach ( $styles as $name => $slug ) {
        if ( ! term_exists( $slug, 'kitchen_style' ) ) {
            wp_insert_term( $name, 'kitchen_style', array( 'slug' => $slug ) );
        }
    }

    // Материалы фасада
    $materials = array(
        'МДФ пленка'  => 'mdf-plenka',
        'МДФ эмаль'   => 'mdf-emal',
        'МДФ пластик' => 'mdf-plastik',
        'ЛДСП'        => 'ldsp',
        'Массив'      => 'massiv',
    );
    foreach ( $materials as $name => $slug ) {
        if ( ! term_exists( $slug, 'kitchen_material' ) ) {
            wp_insert_term( $name, 'kitchen_material', array( 'slug' => $slug ) );
        }
    }
}

// =============================================================================
// 4. Регистрация ACF полей (программно, без импорта JSON)
// =============================================================================

add_action( 'acf/include_fields', 'kitchen_register_acf_fields' );

function kitchen_register_acf_fields() {

    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'                   => 'group_kitchen_specs',
        'title'                 => 'Характеристики кухни',
        'fields'                => array(

            // --- Цена ---
            array(
                'key'          => 'field_kitchen_price',
                'label'        => 'Цена',
                'name'         => 'kitchen_price',
                'type'         => 'number',
                'instructions' => 'Цена кухни в рублях',
                'required'     => 1,
                'min'          => 0,
                'step'         => 1,
                'append'       => 'руб.',
                'wrapper'      => array( 'width' => '50' ),
            ),

            // --- Цена со скидкой ---
            array(
                'key'          => 'field_kitchen_sale_price',
                'label'        => 'Цена со скидкой',
                'name'         => 'kitchen_sale_price',
                'type'         => 'number',
                'instructions' => 'Цена со скидкой (оставьте пустым, если нет скидки)',
                'required'     => 0,
                'min'          => 0,
                'step'         => 1,
                'append'       => 'руб.',
                'wrapper'      => array( 'width' => '50' ),
            ),

            // --- Размеры ---
            array(
                'key'          => 'field_kitchen_dimensions',
                'label'        => 'Размеры кухни',
                'name'         => 'kitchen_dimensions',
                'type'         => 'text',
                'instructions' => 'Формат: ширина x глубина x высота (мм), например 2400x600x2200',
                'placeholder'  => '2400x600x2200',
                'wrapper'      => array( 'width' => '50' ),
            ),

            // --- Материал столешницы ---
            array(
                'key'          => 'field_kitchen_countertop',
                'label'        => 'Материал столешницы',
                'name'         => 'kitchen_countertop',
                'type'         => 'select',
                'instructions' => 'Выберите материал столешницы',
                'choices'      => array(
                    'postforming' => 'Постформинг',
                    'stone'       => 'Камень',
                    'ldsp'        => 'ЛДСП',
                ),
                'default_value' => 'postforming',
                'ui'            => 1,
                'return_format' => 'value',
                'wrapper'       => array( 'width' => '50' ),
            ),

            // --- Фурнитура ---
            array(
                'key'          => 'field_kitchen_hardware',
                'label'        => 'Фурнитура',
                'name'         => 'kitchen_hardware',
                'type'         => 'select',
                'instructions' => 'Производитель фурнитуры',
                'choices'      => array(
                    'blum'     => 'Blum',
                    'hettich'  => 'Hettich',
                    'gtv'      => 'GTV',
                    'standard' => 'Стандарт',
                ),
                'default_value' => 'standard',
                'ui'            => 1,
                'return_format' => 'value',
                'wrapper'       => array( 'width' => '50' ),
            ),

            // --- Галерея фото ---
            array(
                'key'          => 'field_kitchen_gallery',
                'label'        => 'Галерея фото',
                'name'         => 'kitchen_gallery',
                'type'         => 'gallery',
                'instructions' => '3-5 фотографий кухни',
                'return_format'=> 'array',
                'preview_size' => 'medium',
                'insert'       => 'append',
                'library'      => 'all',
                'min'          => 0,
                'max'          => 10,
                'min_width'    => 800,
                'min_height'   => 600,
                'mime_types'   => 'jpg, jpeg, png, webp',
            ),

            // --- 3D визуализация ---
            array(
                'key'          => 'field_kitchen_3d_render',
                'label'        => '3D-визуализация',
                'name'         => 'kitchen_3d_render',
                'type'         => 'image',
                'instructions' => '3D-рендер кухни (опционально)',
                'return_format'=> 'array',
                'preview_size' => 'medium',
                'library'      => 'all',
                'mime_types'   => 'jpg, jpeg, png, webp',
                'wrapper'      => array( 'width' => '50' ),
            ),

            // --- Цвет фасада ---
            array(
                'key'           => 'field_kitchen_facade_color',
                'label'         => 'Цвет фасада',
                'name'          => 'kitchen_facade_color',
                'type'          => 'color_picker',
                'instructions'  => 'Основной цвет фасада',
                'default_value' => '#FFFFFF',
                'enable_opacity'=> 0,
                'return_format' => 'string',
                'wrapper'       => array( 'width' => '50' ),
            ),

            // --- Описание комплектации ---
            array(
                'key'          => 'field_kitchen_equipment',
                'label'        => 'Описание комплектации',
                'name'         => 'kitchen_equipment',
                'type'         => 'textarea',
                'instructions' => 'Подробное описание комплектации кухни',
                'rows'         => 4,
                'new_lines'    => 'br',
            ),

            // --- Шаг модуля ---
            array(
                'key'           => 'field_kitchen_module_step',
                'label'         => 'Шаг модуля',
                'name'          => 'kitchen_module_step',
                'type'          => 'number',
                'instructions'  => 'Шаг модуля в сантиметрах',
                'default_value' => 1,
                'min'           => 1,
                'max'           => 100,
                'step'          => 1,
                'append'        => 'см',
                'wrapper'       => array( 'width' => '33' ),
            ),

            // --- Срок изготовления ---
            array(
                'key'           => 'field_kitchen_production_time',
                'label'         => 'Срок изготовления',
                'name'          => 'kitchen_production_time',
                'type'          => 'text',
                'instructions'  => 'Срок изготовления кухни',
                'default_value' => 'от 14 дней',
                'placeholder'   => 'от 14 дней',
                'wrapper'       => array( 'width' => '33' ),
            ),

            // --- Рассрочка ---
            array(
                'key'           => 'field_kitchen_installment',
                'label'         => 'Рассрочка доступна',
                'name'          => 'kitchen_installment',
                'type'          => 'true_false',
                'instructions'  => 'Доступна ли покупка в рассрочку',
                'default_value' => 1,
                'ui'            => 1,
                'ui_on_text'    => 'Да',
                'ui_off_text'   => 'Нет',
                'wrapper'       => array( 'width' => '34' ),
            ),

            // --- VK Market ID ---
            array(
                'key'          => 'field_kitchen_vk_market_id',
                'label'        => 'VK Market ID',
                'name'         => 'kitchen_vk_market_id',
                'type'         => 'number',
                'instructions' => 'ID товара в VK Market (для связи с VK)',
                'min'          => 0,
                'step'         => 1,
                'wrapper'      => array( 'width' => '50' ),
            ),

            // --- Порядок сортировки ---
            array(
                'key'           => 'field_kitchen_sort_order',
                'label'         => 'Порядок сортировки',
                'name'          => 'kitchen_sort_order',
                'type'          => 'number',
                'instructions'  => 'Порядок отображения в каталоге (меньше = выше)',
                'default_value' => 0,
                'min'           => 0,
                'step'          => 1,
                'wrapper'       => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array(
                    'param'    => 'post_type',
                    'operator' => '==',
                    'value'    => 'kitchen',
                ),
            ),
        ),
        'menu_order'            => 0,
        'position'              => 'normal',
        'style'                 => 'default',
        'label_placement'       => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen'        => array( 'comments', 'send-trackbacks' ),
        'active'                => true,
        'description'           => 'Характеристики, цены, галерея, связь с VK Market',
        'show_in_rest'          => 1,
    ));
}

// =============================================================================
// 5. Flush rewrite rules при активации (для permalink /kuhnya/{model}/)
// =============================================================================

add_action( 'after_switch_theme', 'kitchen_flush_rewrite_rules', 99 );

function kitchen_flush_rewrite_rules() {
    kitchen_register_post_type();
    kitchen_register_taxonomies();
    flush_rewrite_rules();
}

// =============================================================================
// 6. Настройка колонок в admin list для CPT Kitchen
// =============================================================================

add_filter( 'manage_kitchen_posts_columns', 'kitchen_admin_columns' );

function kitchen_admin_columns( $columns ) {
    $new_columns = array();
    foreach ( $columns as $key => $value ) {
        $new_columns[ $key ] = $value;
        if ( 'title' === $key ) {
            $new_columns['kitchen_price']    = 'Цена';
            $new_columns['kitchen_dimensions'] = 'Размеры';
        }
    }
    return $new_columns;
}

add_action( 'manage_kitchen_posts_custom_column', 'kitchen_admin_column_content', 10, 2 );

function kitchen_admin_column_content( $column, $post_id ) {
    switch ( $column ) {
        case 'kitchen_price':
            $price      = get_field( 'kitchen_price', $post_id );
            $sale_price = get_field( 'kitchen_sale_price', $post_id );
            if ( $sale_price ) {
                echo '<del>' . number_format( $price, 0, '.', ' ' ) . ' руб.</del><br>';
                echo '<strong>' . number_format( $sale_price, 0, '.', ' ' ) . ' руб.</strong>';
            } elseif ( $price ) {
                echo number_format( $price, 0, '.', ' ' ) . ' руб.';
            } else {
                echo '—';
            }
            break;

        case 'kitchen_dimensions':
            $dims = get_field( 'kitchen_dimensions', $post_id );
            echo $dims ? esc_html( $dims ) : '—';
            break;
    }
}

// --- Сортировка по цене в админке ---
add_filter( 'manage_edit-kitchen_sortable_columns', 'kitchen_sortable_columns' );

function kitchen_sortable_columns( $columns ) {
    $columns['kitchen_price'] = 'kitchen_price';
    return $columns;
}

add_action( 'pre_get_posts', 'kitchen_orderby_price' );

function kitchen_orderby_price( $query ) {
    if ( ! is_admin() || ! $query->is_main_query() ) {
        return;
    }
    if ( 'kitchen_price' === $query->get( 'orderby' ) ) {
        $query->set( 'meta_key', 'kitchen_price' );
        $query->set( 'orderby', 'meta_value_num' );
    }
}

// =============================================================================
// 7. Сортировка на фронтенде по полю sort_order
// =============================================================================

add_action( 'pre_get_posts', 'kitchen_archive_sort_order' );

function kitchen_archive_sort_order( $query ) {
    if ( is_admin() || ! $query->is_main_query() ) {
        return;
    }
    if ( is_post_type_archive( 'kitchen' ) || is_tax( array( 'kitchen_type', 'kitchen_style', 'kitchen_material' ) ) ) {
        $query->set( 'meta_key', 'kitchen_sort_order' );
        $query->set( 'orderby', 'meta_value_num' );
        $query->set( 'order', 'ASC' );
        $query->set( 'posts_per_page', 24 );
    }
}
