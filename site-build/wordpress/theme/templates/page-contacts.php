<?php
/**
 * Template Name: Контакты
 *
 * Contact page: info, Yandex Map, measurement booking form, Schema.org LocalBusiness.
 *
 * @package KuhniRema
 */

get_header();

$phone          = kuhni_rema_option( 'global_phone_main' );
$phone2         = kuhni_rema_option( 'global_phone_secondary' );
$address        = kuhni_rema_option( 'global_address' );
$email          = kuhni_rema_option( 'global_email' );
$working_hours  = kuhni_rema_option( 'global_working_hours' );
$whatsapp       = kuhni_rema_option( 'global_whatsapp' );
$telegram       = kuhni_rema_option( 'global_telegram' );
$lat            = kuhni_rema_option( 'global_lat' );
$lng            = kuhni_rema_option( 'global_lng' );
?>

<?php get_template_part( 'templates/breadcrumbs' ); ?>

<main class="page-contacts">

    <!-- ============================================================
         Contact Info + Map
         ============================================================ -->
    <section class="section contacts-info">
        <div class="container">
            <h1 class="contacts-info__title">Контакты</h1>

            <div class="contacts-info__grid">

                <!-- Left: Contact details -->
                <div class="contacts-info__details">

                    <?php if ( $phone ) : ?>
                        <div class="contacts-info__item contacts-info__item--phone">
                            <span class="contacts-info__label">Телефон</span>
                            <a href="<?php echo esc_url( kuhni_rema_phone_link( $phone ) ); ?>" class="contacts-info__value contacts-info__value--link">
                                <?php echo esc_html( $phone ); ?>
                            </a>
                            <?php if ( $phone2 ) : ?>
                                <a href="<?php echo esc_url( kuhni_rema_phone_link( $phone2 ) ); ?>" class="contacts-info__value contacts-info__value--link">
                                    <?php echo esc_html( $phone2 ); ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <?php if ( $address ) : ?>
                        <div class="contacts-info__item contacts-info__item--address">
                            <span class="contacts-info__label">Адрес</span>
                            <span class="contacts-info__value"><?php echo esc_html( $address ); ?></span>
                        </div>
                    <?php endif; ?>

                    <?php if ( $email ) : ?>
                        <div class="contacts-info__item contacts-info__item--email">
                            <span class="contacts-info__label">Email</span>
                            <a href="mailto:<?php echo esc_attr( $email ); ?>" class="contacts-info__value contacts-info__value--link">
                                <?php echo esc_html( $email ); ?>
                            </a>
                        </div>
                    <?php endif; ?>

                    <?php if ( $working_hours ) : ?>
                        <div class="contacts-info__item contacts-info__item--hours">
                            <span class="contacts-info__label">Время работы</span>
                            <span class="contacts-info__value"><?php echo esc_html( $working_hours ); ?></span>
                        </div>
                    <?php endif; ?>

                    <?php if ( $whatsapp || $telegram ) : ?>
                        <div class="contacts-info__item contacts-info__item--messengers">
                            <span class="contacts-info__label">Мессенджеры</span>
                            <div class="contacts-info__messengers">
                                <?php if ( $whatsapp ) : ?>
                                    <a href="https://wa.me/<?php echo esc_attr( preg_replace( '/[^0-9]/', '', $whatsapp ) ); ?>" class="contacts-info__messenger contacts-info__messenger--whatsapp" target="_blank" rel="noopener noreferrer">
                                        WhatsApp
                                    </a>
                                <?php endif; ?>
                                <?php if ( $telegram ) : ?>
                                    <a href="https://t.me/<?php echo esc_attr( ltrim( $telegram, '@' ) ); ?>" class="contacts-info__messenger contacts-info__messenger--telegram" target="_blank" rel="noopener noreferrer">
                                        Telegram
                                    </a>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                </div><!-- .contacts-info__details -->

                <!-- Right: Yandex Map -->
                <div class="contacts-info__map">
                    <div
                        id="map"
                        class="contacts-info__map-canvas"
                        data-lat="<?php echo esc_attr( $lat ); ?>"
                        data-lng="<?php echo esc_attr( $lng ); ?>"
                        style="width:100%;min-height:400px;"
                    ></div>
                </div><!-- .contacts-info__map -->

            </div><!-- .contacts-info__grid -->
        </div><!-- .container -->
    </section>

    <!-- ============================================================
         Measurement Booking Form
         ============================================================ -->
    <section class="section contacts-zamer">
        <div class="container">
            <h2 class="contacts-zamer__title">Пригласить дизайнера на бесплатный замер</h2>
            <p class="contacts-zamer__subtitle">Оставьте заявку, и мы приедем в удобное для вас время</p>

            <form class="contacts-zamer__form" data-kuhni-form data-form-type="zamer">
                <div class="contacts-zamer__fields">
                    <div class="contacts-zamer__field">
                        <label class="contacts-zamer__label" for="zamer-name">Ваше имя</label>
                        <input
                            type="text"
                            id="zamer-name"
                            name="name"
                            class="contacts-zamer__input"
                            placeholder="Иван"
                            required
                        >
                    </div>

                    <div class="contacts-zamer__field">
                        <label class="contacts-zamer__label" for="zamer-phone">Телефон</label>
                        <input
                            type="tel"
                            id="zamer-phone"
                            name="phone"
                            class="contacts-zamer__input"
                            placeholder="+7 (___) ___-__-__"
                            required
                        >
                    </div>

                    <div class="contacts-zamer__field">
                        <label class="contacts-zamer__label" for="zamer-address">Адрес</label>
                        <input
                            type="text"
                            id="zamer-address"
                            name="address"
                            class="contacts-zamer__input"
                            placeholder="Улица, дом, квартира"
                        >
                    </div>

                    <div class="contacts-zamer__field">
                        <label class="contacts-zamer__label" for="zamer-time">Удобное время</label>
                        <select id="zamer-time" name="preferred_time" class="contacts-zamer__select">
                            <option value="">Выберите время</option>
                            <option value="morning">Утро (9:00 — 12:00)</option>
                            <option value="afternoon">День (12:00 — 16:00)</option>
                            <option value="evening">Вечер (16:00 — 20:00)</option>
                            <option value="weekend">Выходные</option>
                        </select>
                    </div>
                </div><!-- .contacts-zamer__fields -->

                <button type="submit" class="btn btn--primary contacts-zamer__submit">
                    Записаться на замер
                </button>

                <p class="contacts-zamer__privacy">
                    Нажимая кнопку, вы соглашаетесь с
                    <a href="<?php echo esc_url( home_url( '/politika-konfidencialnosti/' ) ); ?>">политикой конфиденциальности</a>
                </p>
            </form>
        </div><!-- .container -->
    </section>

</main><!-- .page-contacts -->

<!-- Schema.org LocalBusiness -->
<script type="application/ld+json">
<?php
echo wp_json_encode( array(
    '@context'    => 'https://schema.org',
    '@type'       => 'LocalBusiness',
    'name'        => 'Кухни Рема',
    'description' => 'Кухни на заказ в Красноярске с точностью до 1 см. Собственное производство.',
    'url'         => home_url( '/' ),
    'telephone'   => $phone ? preg_replace( '/[^+0-9]/', '', $phone ) : '',
    'email'       => $email ?: '',
    'address'     => array(
        '@type'           => 'PostalAddress',
        'streetAddress'   => $address ?: '',
        'addressLocality' => 'Красноярск',
        'addressRegion'   => 'Красноярский край',
        'addressCountry'  => 'RU',
    ),
    'geo'         => ( $lat && $lng ) ? array(
        '@type'     => 'GeoCoordinates',
        'latitude'  => (float) $lat,
        'longitude' => (float) $lng,
    ) : null,
    'openingHours' => $working_hours ?: '',
    'image'        => get_site_icon_url(),
), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
?>
</script>

<?php get_footer(); ?>
