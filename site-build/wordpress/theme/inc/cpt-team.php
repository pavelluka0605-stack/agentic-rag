<?php
/**
 * Custom Post Type: Team Member (Сотрудник)
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'init', 'kuhni_rema_register_team_cpt' );

function kuhni_rema_register_team_cpt() {
    register_post_type( 'team_member', array(
        'labels' => array(
            'name'               => 'Команда',
            'singular_name'      => 'Сотрудник',
            'add_new'            => 'Добавить сотрудника',
            'add_new_item'       => 'Добавить нового сотрудника',
            'edit_item'          => 'Редактировать сотрудника',
            'new_item'           => 'Новый сотрудник',
            'view_item'          => 'Посмотреть сотрудника',
            'search_items'       => 'Найти сотрудника',
            'not_found'          => 'Сотрудники не найдены',
            'not_found_in_trash' => 'В корзине сотрудников не найдено',
            'all_items'          => 'Все сотрудники',
            'menu_name'          => 'Команда',
        ),
        'public'             => false,
        'publicly_queryable' => false,
        'show_ui'            => true,
        'show_in_menu'       => true,
        'show_in_rest'       => true,
        'has_archive'        => false,
        'hierarchical'       => false,
        'capability_type'    => 'post',
        'map_meta_cap'       => true,
        'supports'           => array( 'title', 'thumbnail' ),
        'menu_position'      => 8,
        'menu_icon'          => 'dashicons-groups',
    ));
}

// =============================================================================
// ACF Fields for Team Member
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_team_acf_fields' );

function kuhni_rema_team_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'    => 'group_team_specs',
        'title'  => 'Данные сотрудника',
        'fields' => array(
            array(
                'key'      => 'field_team_position',
                'label'    => 'Должность',
                'name'     => 'team_position',
                'type'     => 'text',
                'required' => 1,
                'placeholder' => 'Инженер-дизайнер',
                'wrapper'  => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_team_photo',
                'label'         => 'Фото',
                'name'          => 'team_photo',
                'type'          => 'image',
                'required'      => 1,
                'return_format' => 'array',
                'preview_size'  => 'medium',
                'mime_types'    => 'jpg, jpeg, png, webp',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'  => 'field_team_description',
                'label' => 'Описание',
                'name'  => 'team_description',
                'type'  => 'textarea',
                'rows'  => 3,
            ),
            array(
                'key'           => 'field_team_sort_order',
                'label'         => 'Порядок сортировки',
                'name'          => 'team_sort_order',
                'type'          => 'number',
                'default_value' => 0,
                'min'           => 0,
                'wrapper'       => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'post_type', 'operator' => '==', 'value' => 'team_member' ),
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
