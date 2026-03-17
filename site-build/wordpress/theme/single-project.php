<?php
/**
 * Single Project Template (CPT: project)
 *
 * Gallery slider, before/after, project details, client review, related projects.
 *
 * @package KuhniRema
 */

get_header();

$client_name   = get_field( 'project_client_name' );
$gallery       = get_field( 'project_gallery' );
$before_photos = get_field( 'project_before_photos' );
$kitchen_type  = get_field( 'project_kitchen_type' );
$area          = get_field( 'project_area' );
$duration      = get_field( 'project_duration' );
$review_text   = get_field( 'project_review' );
$rating        = get_field( 'project_rating' );
$project_date  = get_field( 'project_date' );
?>

<!-- Breadcrumbs: Главная > Портфолио > Project title -->
<div class="breadcrumbs">
    <div class="container">
        <?php // RankMath breadcrumbs disabled in rankmath-config.php; use custom breadcrumbs. ?>
            <nav class="breadcrumbs__nav" aria-label="Хлебные крошки">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Главная</a>
                <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>
                <a href="<?php echo esc_url( home_url( '/portfolio/' ) ); ?>">Портфолио</a>
                <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>
                <span class="breadcrumbs__current"><?php the_title(); ?></span>
            </nav>
    </div>
</div>

<main class="single-project">

    <!-- ============================================================
         Header
         ============================================================ -->
    <section class="section project-header">
        <div class="container">
            <h1 class="project-header__title"><?php the_title(); ?></h1>
        </div>
    </section>

    <!-- ============================================================
         Gallery Slider
         ============================================================ -->
    <?php if ( $gallery && is_array( $gallery ) ) : ?>
        <section class="section project-gallery">
            <div class="container">
                <div class="project-gallery__slider" data-gallery>
                    <?php foreach ( $gallery as $index => $image ) : ?>
                        <div class="project-gallery__slide">
                            <img
                                src="<?php echo esc_url( $image['sizes']['kitchen-detail'] ?? $image['url'] ); ?>"
                                alt="<?php echo esc_attr( $image['alt'] ?: get_the_title() . ' — фото ' . ( $index + 1 ) ); ?>"
                                width="<?php echo esc_attr( $image['sizes']['kitchen-detail-width'] ?? $image['width'] ); ?>"
                                height="<?php echo esc_attr( $image['sizes']['kitchen-detail-height'] ?? $image['height'] ); ?>"
                                <?php echo $index > 0 ? 'loading="lazy"' : ''; ?>
                            >
                        </div>
                    <?php endforeach; ?>
                </div><!-- .project-gallery__slider -->
            </div>
        </section>
    <?php endif; ?>

    <!-- ============================================================
         Before / After
         ============================================================ -->
    <?php if ( $before_photos && is_array( $before_photos ) ) : ?>
        <section class="section project-before-after">
            <div class="container">
                <h2 class="project-before-after__title">До и после</h2>

                <div class="project-before-after__grid">
                    <div class="project-before-after__column project-before-after__column--before">
                        <h3 class="project-before-after__label">До</h3>
                        <?php foreach ( $before_photos as $photo ) : ?>
                            <img
                                src="<?php echo esc_url( $photo['sizes']['kitchen-card'] ?? $photo['url'] ); ?>"
                                alt="До ремонта — <?php the_title(); ?>"
                                class="project-before-after__img"
                                loading="lazy"
                            >
                        <?php endforeach; ?>
                    </div>

                    <?php if ( $gallery && is_array( $gallery ) ) : ?>
                        <div class="project-before-after__column project-before-after__column--after">
                            <h3 class="project-before-after__label">После</h3>
                            <?php
                            $after_count = min( count( $before_photos ), count( $gallery ) );
                            for ( $i = 0; $i < $after_count; $i++ ) :
                                $photo = $gallery[ $i ];
                            ?>
                                <img
                                    src="<?php echo esc_url( $photo['sizes']['kitchen-card'] ?? $photo['url'] ); ?>"
                                    alt="После ремонта — <?php the_title(); ?>"
                                    class="project-before-after__img"
                                    loading="lazy"
                                >
                            <?php endfor; ?>
                        </div>
                    <?php endif; ?>
                </div><!-- .project-before-after__grid -->
            </div>
        </section>
    <?php endif; ?>

    <!-- ============================================================
         Project Details
         ============================================================ -->
    <section class="section project-details">
        <div class="container">
            <h2 class="project-details__title">Детали проекта</h2>

            <dl class="project-details__list">
                <?php if ( $client_name ) : ?>
                    <div class="project-details__item">
                        <dt class="project-details__label">Клиент</dt>
                        <dd class="project-details__value"><?php echo esc_html( $client_name ); ?></dd>
                    </div>
                <?php endif; ?>

                <?php if ( $kitchen_type && ! is_wp_error( $kitchen_type ) ) : ?>
                    <div class="project-details__item">
                        <dt class="project-details__label">Тип кухни</dt>
                        <dd class="project-details__value"><?php echo esc_html( $kitchen_type->name ); ?></dd>
                    </div>
                <?php endif; ?>

                <?php if ( $area ) : ?>
                    <div class="project-details__item">
                        <dt class="project-details__label">Площадь</dt>
                        <dd class="project-details__value"><?php echo esc_html( $area ); ?> кв. м</dd>
                    </div>
                <?php endif; ?>

                <?php if ( $duration ) : ?>
                    <div class="project-details__item">
                        <dt class="project-details__label">Срок реализации</dt>
                        <dd class="project-details__value"><?php echo esc_html( $duration ); ?></dd>
                    </div>
                <?php endif; ?>

                <?php if ( $project_date ) : ?>
                    <div class="project-details__item">
                        <dt class="project-details__label">Дата завершения</dt>
                        <dd class="project-details__value"><?php echo esc_html( date_i18n( 'd.m.Y', strtotime( $project_date ) ) ); ?></dd>
                    </div>
                <?php endif; ?>
            </dl>
        </div>
    </section>

    <!-- ============================================================
         Client Review
         ============================================================ -->
    <?php if ( $review_text ) : ?>
        <section class="section project-review">
            <div class="container">
                <h2 class="project-review__title">Отзыв клиента</h2>

                <blockquote class="project-review__quote">
                    <?php if ( $rating ) : ?>
                        <div class="project-review__rating">
                            <?php echo kuhni_rema_star_rating( $rating ); ?>
                        </div>
                    <?php endif; ?>

                    <p class="project-review__text"><?php echo esc_html( $review_text ); ?></p>

                    <?php if ( $client_name ) : ?>
                        <cite class="project-review__author">&mdash; <?php echo esc_html( $client_name ); ?></cite>
                    <?php endif; ?>
                </blockquote>
            </div>
        </section>
    <?php endif; ?>

    <!-- ============================================================
         Related Projects
         ============================================================ -->
    <?php
    $related_args = array(
        'post_type'      => 'project',
        'posts_per_page' => 3,
        'post__not_in'   => array( get_the_ID() ),
        'meta_key'       => 'project_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
    );

    // Filter by same kitchen type if available
    if ( $kitchen_type && ! is_wp_error( $kitchen_type ) ) {
        $related_args['meta_query'] = array(
            array(
                'key'   => 'project_kitchen_type',
                'value' => $kitchen_type->term_id,
            ),
        );
    }

    $related = new WP_Query( $related_args );

    // Fallback: if not enough related by type, get any other projects
    if ( $related->post_count < 3 && $kitchen_type && ! is_wp_error( $kitchen_type ) ) {
        $exclude = array( get_the_ID() );
        if ( $related->have_posts() ) {
            foreach ( $related->posts as $p ) {
                $exclude[] = $p->ID;
            }
        }
        $fallback = new WP_Query( array(
            'post_type'      => 'project',
            'posts_per_page' => 3 - $related->post_count,
            'post__not_in'   => $exclude,
            'meta_key'       => 'project_sort_order',
            'orderby'        => 'meta_value_num',
            'order'          => 'ASC',
        ) );
        $related->posts      = array_merge( $related->posts, $fallback->posts );
        $related->post_count = count( $related->posts );
    }
    ?>

    <?php if ( $related->have_posts() ) : ?>
        <section class="section project-related">
            <div class="container">
                <h2 class="project-related__title">Похожие проекты</h2>

                <div class="project-related__grid">
                    <?php while ( $related->have_posts() ) : $related->the_post(); ?>
                        <?php $rel_type = get_field( 'project_kitchen_type' ); ?>
                        <a href="<?php the_permalink(); ?>" class="project-related__card">
                            <?php if ( has_post_thumbnail() ) : ?>
                                <div class="project-related__image">
                                    <?php the_post_thumbnail( 'kitchen-card', array(
                                        'class'   => 'project-related__img',
                                        'loading' => 'lazy',
                                    ) ); ?>
                                </div>
                            <?php endif; ?>
                            <div class="project-related__body">
                                <h3 class="project-related__name"><?php the_title(); ?></h3>
                                <?php if ( $rel_type && ! is_wp_error( $rel_type ) ) : ?>
                                    <span class="project-related__tag"><?php echo esc_html( $rel_type->name ); ?></span>
                                <?php endif; ?>
                            </div>
                        </a>
                    <?php endwhile; ?>
                </div><!-- .project-related__grid -->
            </div>
        </section>
        <?php wp_reset_postdata(); ?>
    <?php endif; ?>

    <!-- ============================================================
         CTA
         ============================================================ -->
    <section class="section project-cta">
        <div class="container">
            <div class="project-cta__block">
                <h2 class="project-cta__title">Хотите такую же кухню?</h2>
                <p class="project-cta__text">Рассчитайте стоимость за 2 минуты</p>
                <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary project-cta__btn">
                    Рассчитать стоимость
                </a>
            </div>
        </div>
    </section>

</main><!-- .single-project -->

<?php get_footer(); ?>
