<?php
/**
 * ACF Options Pages — Global settings
 *
 * 6 pages: Contacts, Social, Quiz, CTA, Partners, Installment
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'acf/init', 'kuhni_rema_register_options_pages' );

function kuhni_rema_register_options_pages() {
    if ( ! function_exists( 'acf_add_options_page' ) ) {
        return;
    }

    // Parent page
    acf_add_options_page( array(
        'page_title'  => 'Настройки Кухни Рема',
        'menu_title'  => 'Настройки сайта',
        'menu_slug'   => 'kuhni-rema-settings',
        'capability'  => 'edit_posts',
        'redirect'    => true,
        'icon_url'    => 'dashicons-admin-settings',
        'position'    => 2,
    ));

    // Sub-pages
    acf_add_options_sub_page( array(
        'page_title'  => 'Контакты и реквизиты',
        'menu_title'  => 'Контакты',
        'parent_slug' => 'kuhni-rema-settings',
        'menu_slug'   => 'kuhni-rema-contacts',
    ));

    acf_add_options_sub_page( array(
        'page_title'  => 'Социальные сети',
        'menu_title'  => 'Соцсети',
        'parent_slug' => 'kuhni-rema-settings',
        'menu_slug'   => 'kuhni-rema-social',
    ));

    acf_add_options_sub_page( array(
        'page_title'  => 'Квиз-калькулятор',
        'menu_title'  => 'Квиз',
        'parent_slug' => 'kuhni-rema-settings',
        'menu_slug'   => 'kuhni-rema-quiz',
    ));

    acf_add_options_sub_page( array(
        'page_title'  => 'CTA-блоки',
        'menu_title'  => 'CTA',
        'parent_slug' => 'kuhni-rema-settings',
        'menu_slug'   => 'kuhni-rema-cta',
    ));

    acf_add_options_sub_page( array(
        'page_title'  => 'Партнёры и поставщики',
        'menu_title'  => 'Партнёры',
        'parent_slug' => 'kuhni-rema-settings',
        'menu_slug'   => 'kuhni-rema-partners',
    ));

    acf_add_options_sub_page( array(
        'page_title'  => 'Рассрочка',
        'menu_title'  => 'Рассрочка',
        'parent_slug' => 'kuhni-rema-settings',
        'menu_slug'   => 'kuhni-rema-installment',
    ));
}

// =============================================================================
// ACF Field Groups for Options Pages
// =============================================================================

add_action( 'acf/include_fields', 'kuhni_rema_options_acf_fields' );

function kuhni_rema_options_acf_fields() {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) {
        return;
    }

    // --- Contacts ---
    acf_add_local_field_group( array(
        'key'    => 'group_contacts',
        'title'  => 'Контакты и реквизиты',
        'fields' => array(
            array(
                'key'           => 'field_global_phone_main',
                'label'         => 'Телефон основной',
                'name'          => 'global_phone_main',
                'type'          => 'text',
                'default_value' => '+7 (391) 216-97-59',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'     => 'field_global_phone_secondary',
                'label'   => 'Телефон дополнительный',
                'name'    => 'global_phone_secondary',
                'type'    => 'text',
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_global_address',
                'label'         => 'Адрес',
                'name'          => 'global_address',
                'type'          => 'text',
                'default_value' => 'ул. 2-я Огородная, 24, Красноярск',
            ),
            array(
                'key'     => 'field_global_email',
                'label'   => 'Email',
                'name'    => 'global_email',
                'type'    => 'email',
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_global_working_hours',
                'label'         => 'Часы работы',
                'name'          => 'global_working_hours',
                'type'          => 'text',
                'default_value' => 'Ежедневно 10:00-20:00',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'     => 'field_global_lat',
                'label'   => 'Широта',
                'name'    => 'global_lat',
                'type'    => 'number',
                'step'    => 'any',
                'wrapper' => array( 'width' => '25' ),
            ),
            array(
                'key'     => 'field_global_lng',
                'label'   => 'Долгота',
                'name'    => 'global_lng',
                'type'    => 'number',
                'step'    => 'any',
                'wrapper' => array( 'width' => '25' ),
            ),
            array(
                'key'     => 'field_global_whatsapp',
                'label'   => 'WhatsApp',
                'name'    => 'global_whatsapp',
                'type'    => 'text',
                'wrapper' => array( 'width' => '25' ),
            ),
            array(
                'key'     => 'field_global_telegram',
                'label'   => 'Telegram',
                'name'    => 'global_telegram',
                'type'    => 'text',
                'wrapper' => array( 'width' => '25' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'options_page', 'operator' => '==', 'value' => 'kuhni-rema-contacts' ),
            ),
        ),
        'active' => true,
    ));

    // --- Social ---
    acf_add_local_field_group( array(
        'key'    => 'group_social',
        'title'  => 'Социальные сети',
        'fields' => array(
            array(
                'key'           => 'field_social_vk_url',
                'label'         => 'VK группа',
                'name'          => 'social_vk_url',
                'type'          => 'url',
                'default_value' => 'https://vk.com/mebelit_krsk',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_social_vk_count',
                'label'         => 'VK подписчики',
                'name'          => 'social_vk_count',
                'type'          => 'text',
                'default_value' => '13 017',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'     => 'field_social_tg_url',
                'label'   => 'Telegram',
                'name'    => 'social_tg_url',
                'type'    => 'url',
                'wrapper' => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'options_page', 'operator' => '==', 'value' => 'kuhni-rema-social' ),
            ),
        ),
        'active' => true,
    ));

    // --- Quiz ---
    acf_add_local_field_group( array(
        'key'    => 'group_quiz',
        'title'  => 'Квиз-калькулятор',
        'fields' => array(
            array(
                'key'        => 'field_quiz_step1_options',
                'label'      => 'Шаг 1: Варианты планировки',
                'name'       => 'quiz_step1_options',
                'type'       => 'repeater',
                'layout'     => 'block',
                'sub_fields' => array(
                    array( 'key' => 'field_quiz_s1_image', 'label' => 'Изображение', 'name' => 'image', 'type' => 'image', 'return_format' => 'array', 'wrapper' => array( 'width' => '50' ) ),
                    array( 'key' => 'field_quiz_s1_name', 'label' => 'Название', 'name' => 'name', 'type' => 'text', 'wrapper' => array( 'width' => '50' ) ),
                ),
            ),
            array(
                'key'     => 'field_quiz_webhook_url',
                'label'   => 'Webhook URL',
                'name'    => 'quiz_webhook_url',
                'type'    => 'url',
                'wrapper' => array( 'width' => '50' ),
            ),
            array(
                'key'           => 'field_quiz_submit_text',
                'label'         => 'Текст кнопки "Отправить"',
                'name'          => 'quiz_submit_text',
                'type'          => 'text',
                'default_value' => 'Получить расчёт',
                'wrapper'       => array( 'width' => '50' ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'options_page', 'operator' => '==', 'value' => 'kuhni-rema-quiz' ),
            ),
        ),
        'active' => true,
    ));

    // --- CTA ---
    acf_add_local_field_group( array(
        'key'    => 'group_cta',
        'title'  => 'CTA-блоки',
        'fields' => array(
            array(
                'key'        => 'field_cta_hero',
                'label'      => 'CTA Hero (главная)',
                'name'       => 'cta_hero',
                'type'       => 'group',
                'layout'     => 'block',
                'sub_fields' => array(
                    array( 'key' => 'field_cta_hero_title', 'label' => 'Заголовок', 'name' => 'title', 'type' => 'text' ),
                    array( 'key' => 'field_cta_hero_subtitle', 'label' => 'Подзаголовок', 'name' => 'subtitle', 'type' => 'text' ),
                    array( 'key' => 'field_cta_hero_btn_text', 'label' => 'Текст кнопки', 'name' => 'btn_text', 'type' => 'text', 'default_value' => 'Рассчитать стоимость' ),
                    array( 'key' => 'field_cta_hero_btn_url', 'label' => 'URL кнопки', 'name' => 'btn_url', 'type' => 'url', 'default_value' => '/kalkulyator/' ),
                ),
            ),
            array(
                'key'        => 'field_cta_catalog_mid',
                'label'      => 'CTA каталог',
                'name'       => 'cta_catalog_mid',
                'type'       => 'group',
                'layout'     => 'block',
                'sub_fields' => array(
                    array( 'key' => 'field_cta_cat_title', 'label' => 'Заголовок', 'name' => 'title', 'type' => 'text' ),
                    array( 'key' => 'field_cta_cat_btn_text', 'label' => 'Текст кнопки', 'name' => 'btn_text', 'type' => 'text', 'default_value' => 'Рассчитать стоимость' ),
                    array( 'key' => 'field_cta_cat_btn_url', 'label' => 'URL кнопки', 'name' => 'btn_url', 'type' => 'url', 'default_value' => '/kalkulyator/' ),
                ),
            ),
            array(
                'key'        => 'field_cta_sticky_mobile',
                'label'      => 'CTA sticky mobile',
                'name'       => 'cta_sticky_mobile',
                'type'       => 'group',
                'layout'     => 'block',
                'sub_fields' => array(
                    array( 'key' => 'field_cta_sticky_text', 'label' => 'Текст кнопки', 'name' => 'btn_text', 'type' => 'text', 'default_value' => 'Рассчитать стоимость' ),
                    array( 'key' => 'field_cta_sticky_url', 'label' => 'URL', 'name' => 'btn_url', 'type' => 'url', 'default_value' => '/kalkulyator/' ),
                ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'options_page', 'operator' => '==', 'value' => 'kuhni-rema-cta' ),
            ),
        ),
        'active' => true,
    ));

    // --- Partners ---
    acf_add_local_field_group( array(
        'key'    => 'group_partners',
        'title'  => 'Партнёры и поставщики',
        'fields' => array(
            array(
                'key'        => 'field_partners_logos',
                'label'      => 'Партнёры',
                'name'       => 'partners_logos',
                'type'       => 'repeater',
                'layout'     => 'table',
                'sub_fields' => array(
                    array( 'key' => 'field_partner_name', 'label' => 'Название', 'name' => 'name', 'type' => 'text' ),
                    array( 'key' => 'field_partner_logo', 'label' => 'Логотип', 'name' => 'logo', 'type' => 'image', 'return_format' => 'array', 'preview_size' => 'thumbnail' ),
                    array( 'key' => 'field_partner_url', 'label' => 'URL', 'name' => 'url', 'type' => 'url' ),
                ),
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'options_page', 'operator' => '==', 'value' => 'kuhni-rema-partners' ),
            ),
        ),
        'active' => true,
    ));

    // --- Installment ---
    acf_add_local_field_group( array(
        'key'    => 'group_installment',
        'title'  => 'Рассрочка',
        'fields' => array(
            array(
                'key'           => 'field_installment_title',
                'label'         => 'Заголовок',
                'name'          => 'installment_title',
                'type'          => 'text',
                'default_value' => 'Рассрочка без банка',
                'wrapper'       => array( 'width' => '50' ),
            ),
            array(
                'key'     => 'field_installment_description',
                'label'   => 'Описание условий',
                'name'    => 'installment_description',
                'type'    => 'wysiwyg',
                'tabs'    => 'all',
                'toolbar' => 'basic',
                'media_upload' => 0,
            ),
            array(
                'key'           => 'field_installment_prepayment',
                'label'         => 'Предоплата',
                'name'          => 'installment_prepayment',
                'type'          => 'text',
                'default_value' => '10%',
                'wrapper'       => array( 'width' => '33' ),
            ),
            array(
                'key'           => 'field_installment_period',
                'label'         => 'Срок рассрочки',
                'name'          => 'installment_period',
                'type'          => 'text',
                'default_value' => 'до 3 месяцев',
                'wrapper'       => array( 'width' => '33' ),
            ),
            array(
                'key'           => 'field_installment_bank',
                'label'         => 'Через банк',
                'name'          => 'installment_bank',
                'type'          => 'true_false',
                'default_value' => 0,
                'ui'            => 1,
                'ui_on_text'    => 'Да',
                'ui_off_text'   => 'Нет',
                'wrapper'       => array( 'width' => '34' ),
            ),
            array(
                'key'  => 'field_installment_fine_print',
                'label' => 'Текст мелким шрифтом',
                'name'  => 'installment_fine_print',
                'type'  => 'textarea',
                'rows'  => 2,
            ),
        ),
        'location' => array(
            array(
                array( 'param' => 'options_page', 'operator' => '==', 'value' => 'kuhni-rema-installment' ),
            ),
        ),
        'active' => true,
    ));
}
