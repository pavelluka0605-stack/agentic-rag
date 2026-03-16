<?php
/**
 * Header Template — Кухни Рема
 *
 * Sticky header with logo, working hours, navigation, phone, and CTA.
 * Serves as Bricks Builder fallback or includable partial.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$logo_text     = kuhni_rema_option( 'global_logo_text' ) ?: get_bloginfo( 'name' );
$phone         = kuhni_rema_option( 'global_phone_main' );
$phone_link    = $phone ? kuhni_rema_phone_link( $phone ) : '';
$working_hours = kuhni_rema_option( 'global_working_hours' );
?>

<header class="site-header" id="site-header" role="banner">
    <div class="container header__container">

        <!-- Logo -->
        <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header__logo" aria-label="<?php echo esc_attr( $logo_text ); ?> — на главную">
            <?php echo esc_html( $logo_text ); ?>
        </a>

        <!-- Working Hours (desktop only) -->
        <?php if ( $working_hours ) : ?>
            <span class="header__hours" aria-label="Часы работы">
                <?php echo esc_html( $working_hours ); ?>
            </span>
        <?php endif; ?>

        <!-- Primary Navigation (desktop) -->
        <nav class="header__nav" aria-label="Основная навигация">
            <?php
            wp_nav_menu( array(
                'theme_location' => 'primary',
                'container'      => false,
                'menu_class'     => 'header__nav-list',
                'items_wrap'     => '<ul class="%2$s">%3$s</ul>',
                'depth'          => 2,
                'fallback_cb'    => false,
            ) );
            ?>
        </nav>

        <!-- Phone (desktop) -->
        <?php if ( $phone ) : ?>
            <a href="<?php echo esc_url( $phone_link ); ?>" class="header__phone" aria-label="Позвонить: <?php echo esc_attr( $phone ); ?>">
                <?php echo esc_html( $phone ); ?>
            </a>
        <?php endif; ?>

        <!-- CTA Button (desktop) -->
        <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary header__cta">
            Рассчитать стоимость
        </a>

        <!-- Mobile: Phone Icon -->
        <?php if ( $phone ) : ?>
            <a href="<?php echo esc_url( $phone_link ); ?>" class="header__phone-icon" aria-label="Позвонить">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.1.31.03.66-.25 1.02l-2.2 2.2z" fill="currentColor"/>
                </svg>
            </a>
        <?php endif; ?>

        <!-- Burger Button (mobile) -->
        <button class="header__burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-nav">
            <span></span>
            <span></span>
            <span></span>
        </button>

    </div><!-- .header__container -->

    <!-- Mobile Off-Canvas Menu -->
    <nav class="header__mobile-nav" id="mobile-nav" aria-label="Мобильное меню" aria-hidden="true">
        <div class="header__mobile-nav-inner">

            <!-- CTA -->
            <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary header__mobile-cta">
                Рассчитать стоимость
            </a>

            <!-- Phone -->
            <?php if ( $phone ) : ?>
                <a href="<?php echo esc_url( $phone_link ); ?>" class="header__mobile-phone">
                    <?php echo esc_html( $phone ); ?>
                </a>
            <?php endif; ?>

            <!-- Nav Menu Items -->
            <?php
            wp_nav_menu( array(
                'theme_location' => 'primary',
                'container'      => false,
                'menu_class'     => 'header__mobile-nav-list',
                'items_wrap'     => '<ul class="%2$s">%3$s</ul>',
                'depth'          => 2,
                'fallback_cb'    => false,
            ) );
            ?>

            <!-- Working Hours -->
            <?php if ( $working_hours ) : ?>
                <span class="header__mobile-hours">
                    <?php echo esc_html( $working_hours ); ?>
                </span>
            <?php endif; ?>

        </div>
    </nav><!-- .header__mobile-nav -->

</header><!-- .site-header -->
