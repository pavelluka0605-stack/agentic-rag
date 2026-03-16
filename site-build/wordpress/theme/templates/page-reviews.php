<?php
/**
 * Template Name: Отзывы
 *
 * Reviews page: aggregate rating, review cards, external links, Schema.org AggregateRating.
 *
 * @package KuhniRema
 */

get_header();

$reviews_query = kuhni_rema_get_reviews( -1 );

// Calculate aggregate rating
$total_rating  = 0;
$review_count  = 0;

if ( $reviews_query->have_posts() ) {
    while ( $reviews_query->have_posts() ) {
        $reviews_query->the_post();
        $rating = get_field( 'review_rating' );
        if ( $rating ) {
            $total_rating += (int) $rating;
            $review_count++;
        }
    }
    $reviews_query->rewind_posts();
}

$average_rating = $review_count > 0 ? round( $total_rating / $review_count, 1 ) : 0;

$source_labels = array(
    'flamp' => 'Flamp',
    '2gis'  => '2ГИС',
    'site'  => 'Сайт',
    'vk'    => 'VK',
);
?>

<?php get_template_part( 'templates/breadcrumbs' ); ?>

<main class="page-reviews">

    <!-- ============================================================
         Header + Aggregate Rating
         ============================================================ -->
    <section class="section reviews-header">
        <div class="container">
            <h1 class="reviews-header__title">Отзывы наших клиентов</h1>

            <?php if ( $review_count > 0 ) : ?>
                <div class="reviews-header__aggregate">
                    <span class="reviews-header__average"><?php echo esc_html( $average_rating ); ?></span>
                    <?php echo kuhni_rema_star_rating( round( $average_rating ) ); ?>
                    <span class="reviews-header__count">
                        <?php
                        printf(
                            'на основе %d %s',
                            $review_count,
                            _n( 'отзыва', 'отзывов', $review_count, 'kuhni-rema' )
                        );
                        ?>
                    </span>
                </div>
            <?php endif; ?>
        </div>
    </section>

    <!-- ============================================================
         Reviews Grid
         ============================================================ -->
    <?php if ( $reviews_query->have_posts() ) : ?>
        <section class="section reviews-grid">
            <div class="container">
                <div class="reviews-grid__list">
                    <?php while ( $reviews_query->have_posts() ) : $reviews_query->the_post(); ?>
                        <?php
                        $client_name   = get_field( 'review_client_name' );
                        $rating        = get_field( 'review_rating' );
                        $text          = get_field( 'review_text' );
                        $source        = get_field( 'review_source' );
                        $source_url    = get_field( 'review_source_url' );
                        $kitchen_photo = get_field( 'review_kitchen_photo' );
                        $review_date   = get_field( 'review_date' );
                        ?>
                        <article class="reviews-grid__card">

                            <?php if ( $kitchen_photo ) : ?>
                                <div class="reviews-grid__photo">
                                    <img
                                        src="<?php echo esc_url( $kitchen_photo['sizes']['kitchen-card'] ?? $kitchen_photo['url'] ); ?>"
                                        alt="Кухня — отзыв <?php echo esc_attr( $client_name ); ?>"
                                        width="<?php echo esc_attr( $kitchen_photo['sizes']['kitchen-card-width'] ?? $kitchen_photo['width'] ); ?>"
                                        height="<?php echo esc_attr( $kitchen_photo['sizes']['kitchen-card-height'] ?? $kitchen_photo['height'] ); ?>"
                                        loading="lazy"
                                    >
                                </div>
                            <?php endif; ?>

                            <div class="reviews-grid__body">
                                <div class="reviews-grid__meta">
                                    <span class="reviews-grid__name"><?php echo esc_html( $client_name ); ?></span>
                                    <?php if ( $rating ) : ?>
                                        <?php echo kuhni_rema_star_rating( $rating ); ?>
                                    <?php endif; ?>
                                </div>

                                <?php if ( $text ) : ?>
                                    <p class="reviews-grid__text"><?php echo esc_html( $text ); ?></p>
                                <?php endif; ?>

                                <div class="reviews-grid__footer">
                                    <?php if ( $source && isset( $source_labels[ $source ] ) ) : ?>
                                        <?php if ( $source_url ) : ?>
                                            <a href="<?php echo esc_url( $source_url ); ?>" class="reviews-grid__source reviews-grid__source--<?php echo esc_attr( $source ); ?>" target="_blank" rel="noopener noreferrer">
                                                <?php echo esc_html( $source_labels[ $source ] ); ?>
                                            </a>
                                        <?php else : ?>
                                            <span class="reviews-grid__source reviews-grid__source--<?php echo esc_attr( $source ); ?>">
                                                <?php echo esc_html( $source_labels[ $source ] ); ?>
                                            </span>
                                        <?php endif; ?>
                                    <?php endif; ?>

                                    <?php if ( $review_date ) : ?>
                                        <time class="reviews-grid__date" datetime="<?php echo esc_attr( $review_date ); ?>">
                                            <?php echo esc_html( date_i18n( 'd.m.Y', strtotime( $review_date ) ) ); ?>
                                        </time>
                                    <?php endif; ?>
                                </div>
                            </div><!-- .reviews-grid__body -->

                        </article><!-- .reviews-grid__card -->
                    <?php endwhile; ?>
                </div><!-- .reviews-grid__list -->
            </div><!-- .container -->
        </section>
        <?php wp_reset_postdata(); ?>
    <?php endif; ?>

    <!-- ============================================================
         External Reviews
         ============================================================ -->
    <section class="section reviews-external">
        <div class="container">
            <h2 class="reviews-external__title">Отзывы на площадках</h2>
            <div class="reviews-external__links">
                <a href="https://krasnoyarsk.flamp.ru/" class="reviews-external__link reviews-external__link--flamp" target="_blank" rel="noopener noreferrer">
                    Читать на Flamp
                </a>
                <a href="https://2gis.ru/krasnoyarsk" class="reviews-external__link reviews-external__link--2gis" target="_blank" rel="noopener noreferrer">
                    Читать на 2ГИС
                </a>
            </div>
        </div>
    </section>

    <!-- ============================================================
         CTA
         ============================================================ -->
    <section class="section reviews-cta">
        <div class="container">
            <div class="reviews-cta__block">
                <h2 class="reviews-cta__title">Хотите такой же результат?</h2>
                <p class="reviews-cta__text">Рассчитайте стоимость кухни за 2 минуты</p>
                <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary reviews-cta__btn">
                    Рассчитать стоимость
                </a>
            </div>
        </div>
    </section>

</main><!-- .page-reviews -->

<?php get_footer(); ?>
