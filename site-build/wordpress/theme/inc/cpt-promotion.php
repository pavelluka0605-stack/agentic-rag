<?php
/**
 * Custom Post Type: Promotion (Акция)
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'init', 'kuhni_rema_register_promotion_cpt' );

function kuhni_rema_register_promotion_cpt() {
    register_post_type( 'promotion', array(
        'labels' => array(
            'name'               => 'Акции',
            'singular_name'      => 'Акция',
            'add_new'            => 'Добавить акцию',
            'add_new_item'       => 'Добавить новую акцию',
            'edit_item'          => 'Редактировать акцию',
            'new_item'           => 'Новая акция',
            'view_item'          => 'Посмотреть акцию',
            'search_items'       => 'Найти акцию',
            'not_found'          => 'Акции не найдены',
            'not_found_in_trash' => 'В корзине акций не найдено',
            'all_items'          => 'Все акции',
            'menu_name'          => 'Акции',
        ),
        'public'             => true,
        'publicly_queryable' => false,
        'show_ui'            => true,
        'show_in_menu'       => true,
        'show_in_rest'       => true,
        'has_archive'        => false,
        'hierarchical'       => false,
        'capability_type'    => 'post',
        'map_meta_cap'       => true,
        'supports'           => array( 'title' ),
        'menu_position'      => 9,
        'menu_icon'          => 'dashicons-megaphone',
    ));
}

// =============================================================================
// ACF Fields for Promotion
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_promotion_acf_fields' );

function kuhni_rema_promotion_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'    => 'group_promo_specs',
        'title'  => 'Данные акции',
        'fields' => array(
            array(
                'key'      => 'field_promo_description',
                'label'    => 'Описание',
                'name'     => 'promo_description',
                'type'     => 'wysiwyg',
                'required' => 1,
                'tabs'     => 'all',
                'toolbar'  => 'basic',
                'media_upload' => 0,
            ),
            array(
                'key'      => 'field_promo_conditions',
                'label'    => 'Условия',
                'name'     => 'promo_conditions',
                'type'     => 'textarea',
                'required' => 1,
                'rows'     => 3,
            ),
            array(
                'key'            => 'field_promo_date_start',
                'label'          => 'Дата начала',
                'name'           => 'promo_date_start',
                'type'           => 'date_picker',
                'required'       => 1,
                'display_format' => 'd.m.Y',
                'return_format'  => 'Y-m-d',
                'wrapper'        => array( 'width' => '33' ),
            ),
            array(
                'key'            => 'field_promo_date_end',
                'label'          => 'Дата окончания',
                'name'           => 'promo_date_end',
                'type'           => 'date_picker',
                'required'       => 1,
                'display_format' => 'd.m.Y',
                'return_format'  => 'Y-m-d',
                'wrapper'        => array( 'width' => '33' ),
            ),
            array(
                'key'           => 'field_promo_active',
                'label'         => 'Активна',
                'name'          => 'promo_active',
                'type'          => 'true_false',
                'required'      => 1,
                'default_value' => 1,
                'ui'            => 1,
                'ui_on_text'    => 'Да',
                'ui_off_text'   => 'Нет',
                'wrapper'       => array( 'width' => '34' ),
            ),
            array(
                'key'           => 'field_promo_banner',
                'label'         => 'Баннер',
                'name'          => 'promo_banner',
                'type'          => 'image',
                'instructions'  => '1200x400px',
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'mime_types'    => 'jpg, jpeg, png, webp',
            ),
            array(
                'key'     => 'field_promo_placement',
                'label'   => 'Место на сайте',
                'name'    => 'promo_placement',
                'type'    => 'checkbox',
                'choices' => array(
                    'home'    => 'Главная',
                    'catalog' => 'Каталог',
                    'single'  => 'Карточка кухни',
                ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'post_type', 'operator' => '==', 'value' => 'promotion' ),
            ),
        ),
        'position'              => 'normal',
        'style'                 => 'default',
        'label_placement'       => 'top',
        'instruction_placement' => 'label',
        'hide_on_screen'        => array( 'the_content', 'comments', 'send-trackbacks' ),
        'active'                => true,
    ));
}

// =============================================================================
// Admin columns
// =============================================================================

add_filter( 'manage_promotion_posts_columns', 'kuhni_rema_promo_admin_columns' );

function kuhni_rema_promo_admin_columns( $columns ) {
    $new = array();
    foreach ( $columns as $key => $val ) {
        $new[ $key ] = $val;
        if ( 'title' === $key ) {
            $new['promo_active']   = 'Статус';
            $new['promo_date_end'] = 'Окончание';
        }
    }
    return $new;
}

add_action( 'manage_promotion_posts_custom_column', 'kuhni_rema_promo_column_content', 10, 2 );

function kuhni_rema_promo_column_content( $column, $post_id ) {
    if ( 'promo_active' === $column ) {
        $active   = get_field( 'promo_active', $post_id );
        $date_end = get_field( 'promo_date_end', $post_id );
        $expired  = $date_end && strtotime( $date_end ) < time();
        if ( ! $active || $expired ) {
            echo '<span style="color:#dc3545;">Неактивна</span>';
        } else {
            echo '<span style="color:#28a745;">Активна</span>';
        }
    }
    if ( 'promo_date_end' === $column ) {
        $date = get_field( 'promo_date_end', $post_id );
        echo $date ? esc_html( date_i18n( 'd.m.Y', strtotime( $date ) ) ) : '—';
    }
}
