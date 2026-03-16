<?php
/**
 * Template Name: Спасибо
 *
 * Thank-you page at /spasibo/. Yandex Metrika conversion goal page.
 * Minimal header (logo only), no sticky CTA, no footer navigation.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$logo_text      = kuhni_rema_option( 'global_logo_text' ) ?: get_bloginfo( 'name' );
$phone          = kuhni_rema_option( 'global_phone_main' );
$phone_link     = $phone ? kuhni_rema_phone_link( $phone ) : '';
$working_hours  = kuhni_rema_option( 'global_working_hours' );
$ym_counter_id  = kuhni_rema_option( 'analytics_ym_counter_id' );

get_header( 'minimal' );
?>

<!-- Minimal Header (logo only) -->
<header class="site-header site-header--minimal" role="banner">
    <div class="container header__container">
        <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header__logo" aria-label="<?php echo esc_attr( $logo_text ); ?> — на главную">
            <?php echo esc_html( $logo_text ); ?>
        </a>
    </div>
</header>

<main class="thanks-page" id="main-content">
    <div class="container">
        <div class="thanks-page__content">

            <!-- Checkmark Icon -->
            <div class="thanks-page__icon" aria-hidden="true">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="40" cy="40" r="38" stroke="#22c55e" stroke-width="4"/>
                    <polyline points="24,42 35,53 56,28" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>

            <!-- Heading -->
            <h1 class="thanks-page__title">Спасибо! Ваша заявка получена</h1>

            <!-- Response Time -->
            <p class="thanks-page__text">Мы свяжемся с вами в течение 15 минут в рабочее время</p>

            <!-- Working Hours -->
            <?php if ( $working_hours ) : ?>
                <p class="thanks-page__hours">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <?php echo esc_html( $working_hours ); ?>
                </p>
            <?php endif; ?>

            <!-- Phone -->
            <?php if ( $phone ) : ?>
                <a href="<?php echo esc_url( $phone_link ); ?>" class="thanks-page__phone">
                    <?php echo esc_html( $phone ); ?>
                </a>
            <?php endif; ?>

            <!-- CTAs -->
            <div class="thanks-page__actions">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="btn btn--primary thanks-page__cta">
                    Вернуться на главную
                </a>
                <a href="<?php echo esc_url( home_url( '/kuhnya/' ) ); ?>" class="btn btn--outline thanks-page__cta thanks-page__cta--secondary">
                    Посмотреть каталог
                </a>
            </div>

        </div><!-- .thanks-page__content -->
    </div><!-- .container -->
</main>

<!-- Yandex Metrika Goal -->
<script>
(function() {
    var counterId = <?php echo $ym_counter_id ? absint( $ym_counter_id ) : 0; ?>;
    if (counterId && typeof ym === 'function') {
        ym(counterId, 'reachGoal', 'form_complete');
    } else if (counterId) {
        // Fallback: wait for Metrika to load
        document.addEventListener('yacounter' + counterId + 'inited', function() {
            ym(counterId, 'reachGoal', 'form_complete');
        });
    }
})();
</script>

<?php wp_footer(); ?>
</body>
</html>
