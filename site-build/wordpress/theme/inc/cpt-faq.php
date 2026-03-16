<?php
/**
 * Custom Post Type: FAQ (Часто задаваемые вопросы)
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'init', 'kuhni_rema_register_faq_cpt' );

function kuhni_rema_register_faq_cpt() {
    register_post_type( 'faq', array(
        'labels' => array(
            'name'               => 'FAQ',
            'singular_name'      => 'Вопрос',
            'add_new'            => 'Добавить вопрос',
            'add_new_item'       => 'Добавить новый вопрос',
            'edit_item'          => 'Редактировать вопрос',
            'new_item'           => 'Новый вопрос',
            'view_item'          => 'Посмотреть вопрос',
            'search_items'       => 'Найти вопрос',
            'not_found'          => 'Вопросы не найдены',
            'not_found_in_trash' => 'В корзине вопросов не найдено',
            'all_items'          => 'Все вопросы',
            'menu_name'          => 'FAQ',
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
        'supports'           => array( 'title' ),
        'menu_position'      => 10,
        'menu_icon'          => 'dashicons-editor-help',
    ));
}

// =============================================================================
// ACF Fields for FAQ
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_faq_acf_fields' );

function kuhni_rema_faq_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    acf_add_local_field_group( array(
        'key'    => 'group_faq_specs',
        'title'  => 'Ответ на вопрос',
        'fields' => array(
            array(
                'key'      => 'field_faq_answer',
                'label'    => 'Ответ',
                'name'     => 'faq_answer',
                'type'     => 'wysiwyg',
                'required' => 1,
                'tabs'     => 'all',
                'toolbar'  => 'basic',
                'media_upload' => 0,
            ),
            array(
                'key'      => 'field_faq_category',
                'label'    => 'Категория',
                'name'     => 'faq_category',
                'type'     => 'select',
                'required' => 1,
                'choices'  => array(
                    'general'   => 'Общие',
                    'prices'    => 'Цены',
                    'materials' => 'Материалы',
                    'delivery'  => 'Доставка и установка',
                    'warranty'  => 'Гарантия',
                ),
                'wrapper'  => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_faq_sort_order',
                'label'         => 'Порядок сортировки',
                'name'          => 'faq_sort_order',
                'type'          => 'number',
                'default_value' => 0,
                'min'           => 0,
                'wrapper'       => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'post_type', 'operator' => '==', 'value' => 'faq' ),
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
