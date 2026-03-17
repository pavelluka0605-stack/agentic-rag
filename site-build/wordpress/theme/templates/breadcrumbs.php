<?php
/**
 * Template Part: Breadcrumbs
 *
 * Displays RankMath breadcrumbs if available, otherwise falls back
 * to a simple Home > Current Page trail.
 * Not shown on the front page.
 *
 * @package Kuhni_Rema
 */

if ( is_front_page() ) {
    return;
}
?>

<div class="breadcrumbs">
    <div class="container">
        <?php
        // RankMath breadcrumbs are disabled in rankmath-config.php; always use custom breadcrumbs.
        ?>
        <nav class="breadcrumbs__nav" aria-label="<?php esc_attr_e( 'Хлебные крошки', 'kuhni-rema' ); ?>">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Главная', 'kuhni-rema' ); ?></a>
            <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>
            <span class="breadcrumbs__current"><?php echo esc_html( get_the_title() ); ?></span>
        </nav>
    </div>
</div>
