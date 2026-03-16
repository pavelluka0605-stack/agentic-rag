<?php
/**
 * Admin Customization — Content Manager role
 *
 * Restricts admin access so the site owner can only manage CPT content
 * via ACF fields, not Bricks templates or theme settings.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// =============================================================================
// 1. Create Content Manager role on theme activation
// =============================================================================

add_action( 'after_switch_theme', 'kuhni_rema_create_content_manager_role' );

function kuhni_rema_create_content_manager_role() {
    remove_role( 'content_manager' );

    add_role( 'content_manager', 'Контент-менеджер', array(
        'read'                   => true,
        'upload_files'           => true,
        'edit_posts'             => true,
        'edit_published_posts'   => true,
        'publish_posts'          => true,
        'delete_posts'           => true,
        'delete_published_posts' => true,
        'edit_others_posts'      => false,
        'delete_others_posts'    => false,
        'manage_categories'      => true,
        'edit_pages'             => false,
        'edit_theme_options'     => false,
        'manage_options'         => false,
    ));
}

// =============================================================================
// 2. Hide admin menu items for Content Manager
// =============================================================================

add_action( 'admin_menu', 'kuhni_rema_restrict_content_manager_menu', 999 );

function kuhni_rema_restrict_content_manager_menu() {
    if ( ! current_user_can( 'manage_options' ) && current_user_can( 'content_manager' ) ) {
        remove_menu_page( 'tools.php' );
        remove_menu_page( 'options-general.php' );
        remove_menu_page( 'themes.php' );
        remove_menu_page( 'plugins.php' );
        remove_menu_page( 'users.php' );
        remove_menu_page( 'edit-comments.php' );
        remove_menu_page( 'edit.php' );         // Default posts
        remove_menu_page( 'edit.php?post_type=page' );
    }
}

// =============================================================================
// 3. Customize admin bar for Content Manager
// =============================================================================

add_action( 'wp_before_admin_bar_render', 'kuhni_rema_customize_admin_bar' );

function kuhni_rema_customize_admin_bar() {
    if ( ! current_user_can( 'manage_options' ) && current_user_can( 'content_manager' ) ) {
        global $wp_admin_bar;
        $wp_admin_bar->remove_menu( 'comments' );
        $wp_admin_bar->remove_menu( 'new-post' );
        $wp_admin_bar->remove_menu( 'new-page' );
    }
}

// =============================================================================
// 4. Custom admin dashboard for Content Manager
// =============================================================================

add_action( 'wp_dashboard_setup', 'kuhni_rema_custom_dashboard' );

function kuhni_rema_custom_dashboard() {
    if ( ! current_user_can( 'manage_options' ) ) {
        remove_meta_box( 'dashboard_quick_press', 'dashboard', 'side' );
        remove_meta_box( 'dashboard_primary', 'dashboard', 'side' );
        remove_meta_box( 'dashboard_site_health', 'dashboard', 'normal' );

        wp_add_dashboard_widget(
            'kuhni_rema_welcome',
            'Кухни Рема — Управление контентом',
            'kuhni_rema_welcome_widget'
        );
    }
}

function kuhni_rema_welcome_widget() {
    $kitchens   = wp_count_posts( 'kitchen' );
    $projects   = wp_count_posts( 'project' );
    $reviews    = wp_count_posts( 'review' );
    $promotions = wp_count_posts( 'promotion' );

    echo '<ul style="font-size:14px;line-height:2;">';
    echo '<li><a href="' . admin_url( 'edit.php?post_type=kitchen' ) . '">Кухни</a>: ' . intval( $kitchens->publish ) . '</li>';
    echo '<li><a href="' . admin_url( 'edit.php?post_type=project' ) . '">Портфолио</a>: ' . intval( $projects->publish ) . '</li>';
    echo '<li><a href="' . admin_url( 'edit.php?post_type=review' ) . '">Отзывы</a>: ' . intval( $reviews->publish ) . '</li>';
    echo '<li><a href="' . admin_url( 'edit.php?post_type=promotion' ) . '">Акции</a>: ' . intval( $promotions->publish ) . '</li>';
    echo '<li><a href="' . admin_url( 'admin.php?page=kuhni-rema-settings' ) . '">Настройки сайта</a></li>';
    echo '</ul>';
}
