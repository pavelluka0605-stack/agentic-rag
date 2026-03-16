<?php
/**
 * Footer Template
 *
 * Bricks Builder fallback footer. Dark background, 4-column layout.
 * Mobile: columns stack, catalog/links lists become accordions.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$phone         = kuhni_rema_option( 'global_phone_main' );
$address       = kuhni_rema_option( 'global_address' );
$working_hours = kuhni_rema_option( 'global_working_hours' );
$email         = kuhni_rema_option( 'global_email' );
$vk_url        = kuhni_rema_option( 'social_vk_url' );
$tg_url        = kuhni_rema_option( 'social_tg_url' );
?>

<footer class="footer">
    <section class="section section--dark" style="background-color: var(--color-bg-dark);">
        <div class="container">
            <div class="footer__columns">

                <!-- Column 1: About -->
                <div class="footer__about">
                    <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="footer__logo">
                        Кухни Рема
                    </a>
                    <p class="footer__tagline">Кухни на заказ в Красноярске с точностью до 1 см</p>

                    <?php if ( $vk_url || $tg_url ) : ?>
                        <div class="footer__social">
                            <?php if ( $vk_url ) : ?>
                                <a href="<?php echo esc_url( $vk_url ); ?>" class="footer__social-link footer__social-link--vk" target="_blank" rel="noopener noreferrer" aria-label="VK">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.19 1.362 1.26 2.174 1.817.613.42 1.08.328 1.08.328l2.172-.03s1.136-.07.597-.964c-.044-.073-.314-.661-1.618-1.869-1.366-1.265-1.183-1.06.462-3.248.998-1.33 1.398-2.143 1.273-2.49-.12-.331-.858-.244-.858-.244l-2.446.015s-.181-.025-.316.056c-.131.079-.216.263-.216.263s-.389 1.035-.906 1.914c-1.092 1.855-1.529 1.953-1.708 1.838-.416-.267-.312-1.075-.312-1.648 0-1.79.272-2.537-.529-2.73-.266-.064-.462-.106-1.142-.113-.872-.009-1.61.003-2.028.207-.278.136-.493.439-.362.456.161.022.527.099.72.362.25.34.24 1.104.24 1.104s.145 2.106-.332 2.368c-.328.18-.776-.187-1.74-1.868-.493-.86-.867-1.813-.867-1.813s-.072-.176-.2-.27c-.155-.115-.372-.151-.372-.151l-2.323.015s-.348.01-.476.161c-.114.135-.009.413-.009.413s1.83 4.282 3.902 6.442c1.9 1.98 4.057 1.85 4.057 1.85h.978z"/>
                                    </svg>
                                </a>
                            <?php endif; ?>

                            <?php if ( $tg_url ) : ?>
                                <a href="<?php echo esc_url( $tg_url ); ?>" class="footer__social-link footer__social-link--tg" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- Column 2: Catalog -->
                <div class="footer__catalog">
                    <h4 class="footer__heading" data-accordion>Каталог</h4>
                    <ul class="footer__list">
                        <li><a href="<?php echo esc_url( home_url( '/pryamye-kuhni/' ) ); ?>">Прямые кухни</a></li>
                        <li><a href="<?php echo esc_url( home_url( '/uglovye-kuhni/' ) ); ?>">Угловые кухни</a></li>
                        <li><a href="<?php echo esc_url( home_url( '/p-obraznye-kuhni/' ) ); ?>">П-образные кухни</a></li>
                        <li><a href="<?php echo esc_url( home_url( '/kuhnya/' ) ); ?>">Все кухни</a></li>
                    </ul>
                </div>

                <!-- Column 3: Useful links -->
                <div class="footer__links">
                    <h4 class="footer__heading" data-accordion>Полезное</h4>
                    <ul class="footer__list">
                        <li><a href="<?php echo esc_url( home_url( '/portfolio/' ) ); ?>">Портфолио</a></li>
                        <li><a href="<?php echo esc_url( home_url( '/otzyvy/' ) ); ?>">Отзывы</a></li>
                        <li><a href="<?php echo esc_url( home_url( '/faq/' ) ); ?>">FAQ</a></li>
                        <li><a href="<?php echo esc_url( home_url( '/o-kompanii/' ) ); ?>">О компании</a></li>
                    </ul>
                </div>

                <!-- Column 4: Contacts -->
                <div class="footer__contacts">
                    <h4 class="footer__heading">Контакты</h4>

                    <?php if ( $phone ) : ?>
                        <a href="<?php echo esc_attr( kuhni_rema_phone_link( $phone ) ); ?>" class="footer__phone">
                            <?php echo esc_html( $phone ); ?>
                        </a>
                    <?php endif; ?>

                    <?php if ( $address ) : ?>
                        <p class="footer__address"><?php echo esc_html( $address ); ?></p>
                    <?php endif; ?>

                    <?php if ( $working_hours ) : ?>
                        <p class="footer__hours"><?php echo esc_html( $working_hours ); ?></p>
                    <?php endif; ?>

                    <?php if ( $email ) : ?>
                        <a href="mailto:<?php echo esc_attr( $email ); ?>" class="footer__email">
                            <?php echo esc_html( $email ); ?>
                        </a>
                    <?php endif; ?>
                </div>

            </div><!-- .footer__columns -->
        </div><!-- .container -->

        <!-- Bottom bar -->
        <div class="footer__bottom">
            <div class="container">
                <div class="footer__bottom-inner">
                    <p class="footer__copyright">&copy; <?php echo esc_html( date( 'Y' ) ); ?> Кухни Рема. Красноярск</p>
                    <a href="<?php echo esc_url( home_url( '/politika-konfidencialnosti/' ) ); ?>" class="footer__privacy">
                        Политика конфиденциальности
                    </a>
                </div>
            </div>
        </div><!-- .footer__bottom -->
    </section>
</footer>
