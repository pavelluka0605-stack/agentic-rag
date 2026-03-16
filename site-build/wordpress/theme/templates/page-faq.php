<?php
/**
 * Template Name: FAQ
 *
 * FAQ page at /faq/. Schema.org FAQPage markup.
 * Accordion grouped by category using details/summary for no-JS accessibility.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

get_header();

// FAQ categories matching ACF select choices in cpt-faq.php
$faq_categories = array(
    'general'   => 'Общие',
    'prices'    => 'Цены',
    'materials' => 'Материалы',
    'delivery'  => 'Доставка и установка',
    'warranty'  => 'Гарантия',
);

$phone          = kuhni_rema_option( 'global_phone_main' );
$phone_link     = $phone ? kuhni_rema_phone_link( $phone ) : '';
$whatsapp_phone = kuhni_rema_option( 'social_whatsapp_phone' );

// Collect all FAQs for Schema.org
$all_faqs_schema = array();
?>

<main class="faq-page" id="main-content">

    <!-- Breadcrumbs -->
    <?php get_template_part( 'templates/breadcrumbs' ); ?>

    <section class="section">
        <div class="container">

            <h1 class="faq-page__title">Часто задаваемые вопросы</h1>

            <!-- Category Tabs (desktop) -->
            <div class="faq-page__tabs" role="tablist" aria-label="Категории вопросов">
                <?php $first = true; ?>
                <?php foreach ( $faq_categories as $slug => $label ) : ?>
                    <button
                        class="faq-page__tab<?php echo $first ? ' faq-page__tab--active' : ''; ?>"
                        role="tab"
                        type="button"
                        aria-selected="<?php echo $first ? 'true' : 'false'; ?>"
                        aria-controls="faq-panel-<?php echo esc_attr( $slug ); ?>"
                        data-category="<?php echo esc_attr( $slug ); ?>"
                    >
                        <?php echo esc_html( $label ); ?>
                    </button>
                    <?php $first = false; ?>
                <?php endforeach; ?>
            </div>

            <!-- FAQ Panels -->
            <?php $first_panel = true; ?>
            <?php foreach ( $faq_categories as $slug => $label ) : ?>
                <?php
                $faqs = kuhni_rema_get_faqs( $slug );
                ?>
                <div
                    class="faq-page__panel<?php echo $first_panel ? ' faq-page__panel--active' : ''; ?>"
                    id="faq-panel-<?php echo esc_attr( $slug ); ?>"
                    role="tabpanel"
                    <?php echo $first_panel ? '' : 'hidden'; ?>
                >
                    <?php if ( $faqs->have_posts() ) : ?>
                        <div class="faq-page__list">
                            <?php while ( $faqs->have_posts() ) : $faqs->the_post(); ?>
                                <?php
                                $question = get_the_title();
                                $answer   = get_field( 'faq_answer' );

                                // Collect for Schema.org
                                $all_faqs_schema[] = array(
                                    'question' => $question,
                                    'answer'   => wp_strip_all_tags( $answer ),
                                );
                                ?>
                                <details class="faq-page__item">
                                    <summary class="faq-page__question">
                                        <?php echo esc_html( $question ); ?>
                                        <svg class="faq-page__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <polyline points="6 9 12 15 18 9"/>
                                        </svg>
                                    </summary>
                                    <div class="faq-page__answer">
                                        <?php echo wp_kses_post( $answer ); ?>
                                    </div>
                                </details>
                            <?php endwhile; ?>
                        </div>
                    <?php else : ?>
                        <p class="faq-page__empty">В этой категории пока нет вопросов</p>
                    <?php endif; ?>
                    <?php wp_reset_postdata(); ?>
                </div>
                <?php $first_panel = false; ?>
            <?php endforeach; ?>

            <!-- CTA Block -->
            <div class="faq-page__cta">
                <h2 class="faq-page__cta-title">Не нашли ответ?</h2>
                <div class="faq-page__cta-actions">
                    <?php if ( $phone ) : ?>
                        <a href="<?php echo esc_url( $phone_link ); ?>" class="btn btn--primary faq-page__cta-phone">
                            <?php echo esc_html( $phone ); ?>
                        </a>
                    <?php endif; ?>
                    <?php if ( $whatsapp_phone ) : ?>
                        <a href="https://wa.me/<?php echo esc_attr( preg_replace( '/[^0-9]/', '', $whatsapp_phone ) ); ?>?text=<?php echo rawurlencode( 'Здравствуйте! У меня вопрос по кухням.' ); ?>" class="btn btn--outline faq-page__cta-wa" target="_blank" rel="noopener noreferrer">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Напишите нам
                        </a>
                    <?php endif; ?>
                </div>
            </div>

        </div><!-- .container -->
    </section>
</main>

<?php get_footer(); ?>
