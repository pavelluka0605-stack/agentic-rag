<?php
/**
 * Template Part: Sticky CTA Bar (Mobile)
 *
 * Mobile sticky CTA bar fixed to the bottom of the screen.
 * Hidden by default; shown via JS in main.js when scrolled > 600px on mobile.
 * Hidden on /kalkulyator/ and /spasibo/ pages.
 *
 * @package Kuhni_Rema
 */

if ( is_page( array( 'kalkulyator', 'spasibo' ) ) ) {
    return;
}

$btn_text = kuhni_rema_option( 'cta_sticky_mobile', 'btn_text' );
if ( empty( $btn_text ) ) {
    $btn_text = 'Рассчитать стоимость';
}

$phone_raw = kuhni_rema_option( 'contacts', 'phone' );
$phone_href = $phone_raw ? preg_replace( '/[^\d+]/', '', $phone_raw ) : '';
?>

<div class="cta-sticky" style="display:none;">
    <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="cta-sticky__btn">
        <?php echo esc_html( $btn_text ); ?>
    </a>

    <?php if ( $phone_href ) : ?>
        <a href="tel:<?php echo esc_attr( $phone_href ); ?>" class="cta-sticky__phone" aria-label="<?php esc_attr_e( 'Позвонить', 'kuhni-rema' ); ?>">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
        </a>
    <?php endif; ?>
</div>
