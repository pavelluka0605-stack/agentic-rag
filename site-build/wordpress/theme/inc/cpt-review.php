<?php
/**
 * Custom Post Type: Review (Отзыв)
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'init', 'kuhni_rema_register_review_cpt' );

function kuhni_rema_register_review_cpt() {
    register_post_type( 'review', array(
        'labels' => array(
            'name'               => 'Отзывы',
            'singular_name'      => 'Отзыв',
            'add_new'            => 'Добавить отзыв',
            'add_new_item'       => 'Добавить новый отзыв',
            'edit_item'          => 'Редактировать отзыв',
            'new_item'           => 'Новый отзыв',
            'view_item'          => 'Посмотреть отзыв',
            'search_items'       => 'Найти отзыв',
            'not_found'          => 'Отзывы не найдены',
            'not_found_in_trash' => 'В корзине отзывов не найдено',
            'all_items'          => 'Все отзывы',
            'menu_name'          => 'Отзывы',
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
        'menu_position'      => 7,
        'menu_icon'          => 'dashicons-star-filled',
    ));
}

// =============================================================================
// ACF Fields for Review
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_review_acf_fields' );

function kuhni_rema_review_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'    => 'group_review_specs',
        'title'  => 'Данные отзыва',
        'fields' => array(
            array(
                'key'      => 'field_review_client_name',
                'label'    => 'Имя клиента',
                'name'     => 'review_client_name',
                'type'     => 'text',
                'required' => 1,
                'placeholder' => 'Мария К.',
                'wrapper'  => array( 'width' => '50' ),
            ),
            array(
                'key'      => 'field_review_rating',
                'label'    => 'Оценка',
                'name'     => 'review_rating',
                'type'     => 'number',
                'required' => 1,
                'min'      => 1,
                'max'      => 5,
                'step'     => 1,
                'wrapper'  => array( 'width' => '50' ),
            ),
            array(
                'key'      => 'field_review_text',
                'label'    => 'Текст отзыва',
                'name'     => 'review_text',
                'type'     => 'textarea',
                'required' => 1,
                'rows'     => 5,
            ),
            array(
                'key'           => 'field_review_client_photo',
                'label'         => 'Фото клиента',
                'name'          => 'review_client_photo',
                'type'          => 'image',
                'return_format' => 'array',
                'preview_size'  => 'thumbnail',
                'mime_types'    => 'jpg, jpeg, png, webp',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_review_kitchen_photo',
                'label'         => 'Фото кухни',
                'name'          => 'review_kitchen_photo',
                'type'          => 'image',
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'mime_types'    => 'jpg, jpeg, png, webp',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'      => 'field_review_source',
                'label'    => 'Источник',
                'name'     => 'review_source',
                'type'     => 'select',
                'required' => 1,
                'choices'  => array(
                    'flamp' => 'Flamp',
                    '2gis'  => '2ГИС',
                    'site'  => 'Сайт',
                    'vk'    => 'VK',
                ),
                'wrapper'  => array( 'width' => '33' ),
            ),
            array(
                'key'     => 'field_review_source_url',
                'label'   => 'Ссылка на источник',
                'name'    => 'review_source_url',
                'type'    => 'url',
                'wrapper' => array( 'width' => '33' ),
            ),
            array(
                'key'            => 'field_review_date',
                'label'          => 'Дата отзыва',
                'name'           => 'review_date',
                'type'           => 'date_picker',
                'required'       => 1,
                'display_format' => 'd.m.Y',
                'return_format'  => 'Y-m-d',
                'wrapper'        => array( 'width' => '34' ),
            ),
            array(
                'key'           => 'field_review_project',
                'label'         => 'Связь с проектом',
                'name'          => 'review_project',
                'type'          => 'post_object',
                'post_type'     => array( 'project' ),
                'return_format' => 'object',
                'ui'            => 1,
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_review_sort_order',
                'label'         => 'Порядок сортировки',
                'name'          => 'review_sort_order',
                'type'          => 'number',
                'default_value' => 0,
                'min'           => 0,
                'wrapper'       => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'post_type', 'operator' => '==', 'value' => 'review' ),
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

add_filter( 'manage_review_posts_columns', 'kuhni_rema_review_admin_columns' );

function kuhni_rema_review_admin_columns( $columns ) {
    $new = array();
    foreach ( $columns as $key => $val ) {
        $new[ $key ] = $val;
        if ( 'title' === $key ) {
            $new['review_rating'] = 'Оценка';
            $new['review_source'] = 'Источник';
        }
    }
    return $new;
}

add_action( 'manage_review_posts_custom_column', 'kuhni_rema_review_column_content', 10, 2 );

function kuhni_rema_review_column_content( $column, $post_id ) {
    if ( 'review_rating' === $column ) {
        $rating = get_field( 'review_rating', $post_id );
        echo $rating ? str_repeat( '★', $rating ) . str_repeat( '☆', 5 - $rating ) : '—';
    }
    if ( 'review_source' === $column ) {
        $sources = array( 'flamp' => 'Flamp', '2gis' => '2ГИС', 'site' => 'Сайт', 'vk' => 'VK' );
        $source = get_field( 'review_source', $post_id );
        echo isset( $sources[ $source ] ) ? esc_html( $sources[ $source ] ) : '—';
    }
}
