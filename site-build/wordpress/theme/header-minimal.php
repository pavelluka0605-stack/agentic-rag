<?php
/**
 * Minimal Header — Used for quiz and thanks pages.
 * No navigation, no CTA, just the logo.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header site-header--minimal">
    <div class="container">
        <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header__logo" aria-label="<?php bloginfo( 'name' ); ?>">
            <?php
            $custom_logo_id = get_theme_mod( 'custom_logo' );
            if ( $custom_logo_id ) {
                echo wp_get_attachment_image( $custom_logo_id, 'full', false, array( 'class' => 'header__logo-img' ) );
            } else {
                echo '<span class="header__logo-text">' . esc_html( get_bloginfo( 'name' ) ) . '</span>';
            }
            ?>
        </a>
    </div>
</header>
