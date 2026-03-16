<?php
/**
 * Template Name: Политика конфиденциальности
 *
 * Simple content page at /politika-konfidencialnosti/.
 * Content managed via WordPress editor. No CTA blocks.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

get_header();

$company_name   = kuhni_rema_option( 'global_company_name' );
$company_inn    = kuhni_rema_option( 'global_company_inn' );
$company_ogrn   = kuhni_rema_option( 'global_company_ogrn' );
$address        = kuhni_rema_option( 'global_address' );
$email          = kuhni_rema_option( 'global_email' );
$phone          = kuhni_rema_option( 'global_phone_main' );
?>

<main class="privacy-page" id="main-content">

    <!-- Breadcrumbs -->
    <?php get_template_part( 'templates/breadcrumbs' ); ?>

    <section class="section">
        <div class="container">

            <h1 class="privacy-page__title"><?php the_title(); ?></h1>

            <!-- Content from WordPress editor -->
            <div class="privacy-page__content prose">
                <?php
                while ( have_posts() ) :
                    the_post();
                    the_content();
                endwhile;
                ?>
            </div>

            <!-- Company Details from ACF Options -->
            <?php if ( $company_name || $company_inn || $address ) : ?>
                <div class="privacy-page__company">
                    <h2 class="privacy-page__company-title">Реквизиты оператора персональных данных</h2>
                    <dl class="privacy-page__details">
                        <?php if ( $company_name ) : ?>
                            <dt>Наименование</dt>
                            <dd><?php echo esc_html( $company_name ); ?></dd>
                        <?php endif; ?>

                        <?php if ( $company_inn ) : ?>
                            <dt>ИНН</dt>
                            <dd><?php echo esc_html( $company_inn ); ?></dd>
                        <?php endif; ?>

                        <?php if ( $company_ogrn ) : ?>
                            <dt>ОГРН</dt>
                            <dd><?php echo esc_html( $company_ogrn ); ?></dd>
                        <?php endif; ?>

                        <?php if ( $address ) : ?>
                            <dt>Адрес</dt>
                            <dd><?php echo esc_html( $address ); ?></dd>
                        <?php endif; ?>

                        <?php if ( $email ) : ?>
                            <dt>Email</dt>
                            <dd><a href="mailto:<?php echo esc_attr( $email ); ?>"><?php echo esc_html( $email ); ?></a></dd>
                        <?php endif; ?>

                        <?php if ( $phone ) : ?>
                            <dt>Телефон</dt>
                            <dd><a href="<?php echo esc_url( kuhni_rema_phone_link( $phone ) ); ?>"><?php echo esc_html( $phone ); ?></a></dd>
                        <?php endif; ?>
                    </dl>
                </div>
            <?php endif; ?>

        </div><!-- .container -->
    </section>
</main>

<?php get_footer(); ?>
