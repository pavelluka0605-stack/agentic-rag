<?php
/**
 * Custom Post Type: Project (Реализованный проект / Кейс)
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'init', 'kuhni_rema_register_project_cpt' );

function kuhni_rema_register_project_cpt() {
    register_post_type( 'project', array(
        'labels' => array(
            'name'               => 'Портфолио',
            'singular_name'      => 'Проект',
            'add_new'            => 'Добавить проект',
            'add_new_item'       => 'Добавить новый проект',
            'edit_item'          => 'Редактировать проект',
            'new_item'           => 'Новый проект',
            'view_item'          => 'Посмотреть проект',
            'search_items'       => 'Найти проект',
            'not_found'          => 'Проекты не найдены',
            'not_found_in_trash' => 'В корзине проектов не найдено',
            'all_items'          => 'Все проекты',
            'menu_name'          => 'Портфолио',
        ),
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
        'rewrite'            => array( 'slug' => 'portfolio', 'with_front' => false ),
        'menu_position'      => 6,
        'menu_icon'          => 'dashicons-portfolio',
    ));
}

// =============================================================================
// ACF Fields for Project
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_project_acf_fields' );

function kuhni_rema_project_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'    => 'group_project_specs',
        'title'  => 'Детали проекта',
        'fields' => array(
            array(
                'key'     => 'field_project_client_name',
                'label'   => 'Имя клиента',
                'name'    => 'project_client_name',
                'type'    => 'text',
                'instructions' => 'Отображается с согласия клиента',
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'     => 'field_project_gallery',
                'label'   => 'Галерея фото',
                'name'    => 'project_gallery',
                'type'    => 'gallery',
                'required' => 1,
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'max'     => 20,
                'mime_types' => 'jpg, jpeg, png, webp',
            ),
            array(
                'key'           => 'field_project_before_photos',
                'label'         => 'Фото "До"',
                'name'          => 'project_before_photos',
                'type'          => 'gallery',
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'max'           => 5,
                'mime_types'    => 'jpg, jpeg, png, webp',
            ),
            array(
                'key'     => 'field_project_kitchen_type',
                'label'   => 'Тип кухни',
                'name'    => 'project_kitchen_type',
                'type'    => 'taxonomy',
                'taxonomy' => 'kitchen_type',
                'field_type' => 'select',
                'return_format' => 'object',
                'required' => 1,
                'wrapper' => array( 'width' => '33' ),
            ),
            array(
                'key'     => 'field_project_area',
                'label'   => 'Площадь кухни',
                'name'    => 'project_area',
                'type'    => 'number',
                'append'  => 'кв. м',
                'step'    => 0.1,
                'wrapper' => array( 'width' => '33' ),
            ),
            array(
                'key'         => 'field_project_duration',
                'label'       => 'Срок реализации',
                'name'        => 'project_duration',
                'type'        => 'text',
                'placeholder' => '21 день',
                'wrapper'     => array( 'width' => '34' ),
            ),
            array(
                'key'     => 'field_project_review',
                'label'   => 'Отзыв клиента',
                'name'    => 'project_review',
                'type'    => 'textarea',
                'rows'    => 3,
            ),
            array(
                'key'     => 'field_project_rating',
                'label'   => 'Оценка клиента',
                'name'    => 'project_rating',
                'type'    => 'number',
                'min'     => 1,
                'max'     => 5,
                'step'    => 1,
                'wrapper' => array( 'width' => '33' ),
            ),
            array(
                'key'     => 'field_project_date',
                'label'   => 'Дата завершения',
                'name'    => 'project_date',
                'type'    => 'date_picker',
                'display_format' => 'd.m.Y',
                'return_format'  => 'Y-m-d',
                'wrapper' => array( 'width' => '33' ),
            ),
            array(
                'key'           => 'field_project_sort_order',
                'label'         => 'Порядок сортировки',
                'name'          => 'project_sort_order',
                'type'          => 'number',
                'default_value' => 0,
                'min'           => 0,
                'wrapper'       => array( 'width' => '34' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'post_type', 'operator' => '==', 'value' => 'project' ),
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
// Frontend sort
// =============================================================================

add_action( 'pre_get_posts', 'kuhni_rema_project_archive_sort' );

function kuhni_rema_project_archive_sort( $query ) {
    if ( is_admin() || ! $query->is_main_query() ) {
        return;
    }
    if ( is_post_type_archive( 'project' ) ) {
        $query->set( 'meta_key', 'project_sort_order' );
        $query->set( 'orderby', 'meta_value_num' );
        $query->set( 'order', 'ASC' );
        $query->set( 'posts_per_page', 12 );
    }
}
