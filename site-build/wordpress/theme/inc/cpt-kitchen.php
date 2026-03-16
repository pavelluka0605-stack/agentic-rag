<?php
/**
 * Custom Post Type: Kitchen (Кухня)
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// =============================================================================
// 1. Register CPT "Kitchen"
// =============================================================================

add_action( 'init', 'kuhni_rema_register_kitchen_cpt' );

function kuhni_rema_register_kitchen_cpt() {
    $labels = array(
        'name'               => 'Кухни',
        'singular_name'      => 'Кухня',
        'add_new'            => 'Добавить кухню',
        'add_new_item'       => 'Добавить новую кухню',
        'edit_item'          => 'Редактировать кухню',
        'new_item'           => 'Новая кухня',
        'view_item'          => 'Посмотреть кухню',
        'search_items'       => 'Найти кухню',
        'not_found'          => 'Кухни не найдены',
        'not_found_in_trash' => 'В корзине кухонь не найдено',
        'all_items'          => 'Все кухни',
        'menu_name'          => 'Кухни',
    );

    register_post_type( 'kitchen', array(
        'labels'             => $labels,
        'public'             => true,
        'publicly_queryable' => true,
        'show_ui'            => true,
        'show_in_menu'       => true,
        'show_in_rest'       => true,
        'has_archive'        => true,
        'hierarchical'       => false,
        'capability_type'    => 'post',
        'map_meta_cap'       => true,
        'supports'           => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
        'rewrite'            => array( 'slug' => 'kuhnya', 'with_front' => false ),
        'menu_position'      => 5,
        'menu_icon'          => 'dashicons-food',
    ));

    // Taxonomy: Kitchen Type (Прямая, Угловая, П-образная)
    register_taxonomy( 'kitchen_type', 'kitchen', array(
        'labels' => array(
            'name'          => 'Типы кухонь',
            'singular_name' => 'Тип кухни',
            'add_new_item'  => 'Добавить новый тип',
            'menu_name'     => 'Тип кухни',
        ),
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'rewrite'           => array( 'slug' => 'tip-kuhni', 'with_front' => false ),
    ));

    // Taxonomy: Kitchen Style
    register_taxonomy( 'kitchen_style', 'kitchen', array(
        'labels' => array(
            'name'          => 'Стили кухонь',
            'singular_name' => 'Стиль кухни',
            'add_new_item'  => 'Добавить новый стиль',
            'menu_name'     => 'Стиль кухни',
        ),
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'rewrite'           => array( 'slug' => 'stil-kuhni', 'with_front' => false ),
    ));

    // Taxonomy: Kitchen Material
    register_taxonomy( 'kitchen_material', 'kitchen', array(
        'labels' => array(
            'name'          => 'Материалы фасада',
            'singular_name' => 'Материал фасада',
            'add_new_item'  => 'Добавить новый материал',
            'menu_name'     => 'Материал фасада',
        ),
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'rewrite'           => array( 'slug' => 'material-fasada', 'with_front' => false ),
    ));
}

// =============================================================================
// 2. Default terms on theme activation
// =============================================================================

add_action( 'after_switch_theme', 'kuhni_rema_kitchen_default_terms' );

function kuhni_rema_kitchen_default_terms() {
    $types = array( 'Прямая' => 'pryamaya', 'Угловая' => 'uglovaya', 'П-образная' => 'p-obraznaya' );
    foreach ( $types as $name => $slug ) {
        if ( ! term_exists( $slug, 'kitchen_type' ) ) {
            wp_insert_term( $name, 'kitchen_type', array( 'slug' => $slug ) );
        }
    }

    $styles = array( 'Современный' => 'sovremennyj', 'Классический' => 'klassicheskij', 'Лофт' => 'loft', 'Минимализм' => 'minimalizm' );
    foreach ( $styles as $name => $slug ) {
        if ( ! term_exists( $slug, 'kitchen_style' ) ) {
            wp_insert_term( $name, 'kitchen_style', array( 'slug' => $slug ) );
        }
    }

    $materials = array( 'МДФ пленка' => 'mdf-plenka', 'МДФ эмаль' => 'mdf-emal', 'МДФ пластик' => 'mdf-plastik', 'ЛДСП' => 'ldsp', 'Массив' => 'massiv' );
    foreach ( $materials as $name => $slug ) {
        if ( ! term_exists( $slug, 'kitchen_material' ) ) {
            wp_insert_term( $name, 'kitchen_material', array( 'slug' => $slug ) );
        }
    }

    flush_rewrite_rules();
}

// =============================================================================
// 3. ACF Fields for Kitchen
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_kitchen_acf_fields' );

function kuhni_rema_kitchen_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'    => 'group_kitchen_specs',
        'title'  => 'Характеристики кухни',
        'fields' => array(
            array(
                'key'     => 'field_kitchen_price',
                'label'   => 'Цена',
                'name'    => 'kitchen_price',
                'type'    => 'number',
                'required' => 1,
                'min'     => 0,
                'append'  => 'руб.',
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'     => 'field_kitchen_sale_price',
                'label'   => 'Цена со скидкой',
                'name'    => 'kitchen_sale_price',
                'type'    => 'number',
                'min'     => 0,
                'append'  => 'руб.',
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'         => 'field_kitchen_dimensions',
                'label'       => 'Размеры кухни',
                'name'        => 'kitchen_dimensions',
                'type'        => 'text',
                'placeholder' => '2400x600x2200',
                'wrapper'     => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_kitchen_countertop',
                'label'         => 'Материал столешницы',
                'name'          => 'kitchen_countertop',
                'type'          => 'select',
                'choices'       => array( 'postforming' => 'Постформинг', 'stone' => 'Камень', 'ldsp' => 'ЛДСП' ),
                'default_value' => 'postforming',
                'ui'            => 1,
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_kitchen_hardware',
                'label'         => 'Фурнитура',
                'name'          => 'kitchen_hardware',
                'type'          => 'select',
                'choices'       => array( 'blum' => 'Blum', 'hettich' => 'Hettich', 'gtv' => 'GTV', 'standard' => 'Стандарт' ),
                'default_value' => 'standard',
                'ui'            => 1,
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_kitchen_gallery',
                'label'         => 'Галерея фото',
                'name'          => 'kitchen_gallery',
                'type'          => 'gallery',
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'min'           => 0,
                'max'           => 10,
                'mime_types'    => 'jpg, jpeg, png, webp',
            ),
            array(
                'key'           => 'field_kitchen_3d_render',
                'label'         => '3D-визуализация',
                'name'          => 'kitchen_3d_render',
                'type'          => 'image',
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'mime_types'    => 'jpg, jpeg, png, webp',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'            => 'field_kitchen_facade_color',
                'label'          => 'Цвет фасада',
                'name'           => 'kitchen_facade_color',
                'type'           => 'color_picker',
                'default_value'  => '#FFFFFF',
                'wrapper'        => array( 'width' => '50' ),
            ),
            array(
                'key'       => 'field_kitchen_equipment',
                'label'     => 'Описание комплектации',
                'name'      => 'kitchen_equipment',
                'type'      => 'textarea',
                'rows'      => 4,
                'new_lines' => 'br',
            ),
            array(
                'key'           => 'field_kitchen_module_step',
                'label'         => 'Шаг модуля',
                'name'          => 'kitchen_module_step',
                'type'          => 'number',
                'default_value' => 1,
                'append'        => 'см',
                'wrapper'       => array( 'width' => '33' ),
            ),
            array(
                'key'           => 'field_kitchen_production_time',
                'label'         => 'Срок изготовления',
                'name'          => 'kitchen_production_time',
                'type'          => 'text',
                'default_value' => 'от 14 дней',
                'wrapper'       => array( 'width' => '33' ),
            ),
            array(
                'key'           => 'field_kitchen_installment',
                'label'         => 'Рассрочка доступна',
                'name'          => 'kitchen_installment',
                'type'          => 'true_false',
                'default_value' => 1,
                'ui'            => 1,
                'ui_on_text'    => 'Да',
                'ui_off_text'   => 'Нет',
                'wrapper'       => array( 'width' => '34' ),
            ),
            array(
                'key'     => 'field_kitchen_vk_market_id',
                'label'   => 'VK Market ID',
                'name'    => 'kitchen_vk_market_id',
                'type'    => 'number',
                'min'     => 0,
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_kitchen_sort_order',
                'label'         => 'Порядок сортировки',
                'name'          => 'kitchen_sort_order',
                'type'          => 'number',
                'default_value' => 0,
                'min'           => 0,
                'wrapper'       => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'post_type', 'operator' => '==', 'value' => 'kitchen' ),
            ),
        ),
        'position'              => 'normal',
        'style'                 => 'default',
        'label_placement'       => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen'        => array( 'comments', 'send-trackbacks' ),
        'active'                => true,
    ));
}

// =============================================================================
// 4. Admin columns
// =============================================================================

add_filter( 'manage_kitchen_posts_columns', 'kuhni_rema_kitchen_admin_columns' );

function kuhni_rema_kitchen_admin_columns( $columns ) {
    $new = array();
    foreach ( $columns as $key => $val ) {
        $new[ $key ] = $val;
        if ( 'title' === $key ) {
            $new['kitchen_price']      = 'Цена';
            $new['kitchen_dimensions'] = 'Размеры';
        }
    }
    return $new;
}

add_action( 'manage_kitchen_posts_custom_column', 'kuhni_rema_kitchen_column_content', 10, 2 );

function kuhni_rema_kitchen_column_content( $column, $post_id ) {
    if ( 'kitchen_price' === $column ) {
        $price = get_field( 'kitchen_price', $post_id );
        $sale  = get_field( 'kitchen_sale_price', $post_id );
        if ( $sale ) {
            echo '<del>' . number_format( $price, 0, '.', ' ' ) . ' руб.</del><br>';
            echo '<strong>' . number_format( $sale, 0, '.', ' ' ) . ' руб.</strong>';
        } elseif ( $price ) {
            echo number_format( $price, 0, '.', ' ' ) . ' руб.';
        } else {
            echo '—';
        }
    }
    if ( 'kitchen_dimensions' === $column ) {
        $dims = get_field( 'kitchen_dimensions', $post_id );
        echo $dims ? esc_html( $dims ) : '—';
    }
}

add_filter( 'manage_edit-kitchen_sortable_columns', 'kuhni_rema_kitchen_sortable' );

function kuhni_rema_kitchen_sortable( $columns ) {
    $columns['kitchen_price'] = 'kitchen_price';
    return $columns;
}

add_action( 'pre_get_posts', 'kuhni_rema_kitchen_orderby' );

function kuhni_rema_kitchen_orderby( $query ) {
    if ( ! is_admin() || ! $query->is_main_query() ) {
        return;
    }
    if ( 'kitchen_price' === $query->get( 'orderby' ) ) {
        $query->set( 'meta_key', 'kitchen_price' );
        $query->set( 'orderby', 'meta_value_num' );
    }
}

// =============================================================================
// 5. Frontend sort by sort_order
// =============================================================================

add_action( 'pre_get_posts', 'kuhni_rema_kitchen_archive_sort' );

function kuhni_rema_kitchen_archive_sort( $query ) {
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
