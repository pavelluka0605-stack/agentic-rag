<?php
/**
 * Single Project Template (CPT project)
 * URL: /portfolio/{project-slug}/
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

get_header();
?>

<main class="site-main">

    <?php get_template_part( 'templates/breadcrumbs' ); ?>

    <article class="section section--light project-detail">
        <div class="container">

            <?php if ( have_posts() ) : the_post(); ?>

                <h1 class="project-detail__title"><?php the_title(); ?></h1>

                <?php
                // Gallery
                $gallery = get_field( 'project_gallery' );
                if ( $gallery ) : ?>
                    <div class="project-detail__gallery">
                        <?php foreach ( $gallery as $image ) : ?>
                            <figure class="project-detail__gallery-item">
                                <img
                                    src="<?php echo esc_url( $image['sizes']['kitchen-detail'] ?? $image['url'] ); ?>"
                                    alt="<?php echo esc_attr( $image['alt'] ?: get_the_title() ); ?>"
                                    width="1080"
                                    height="810"
                                    loading="lazy"
                                >
                            </figure>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <?php
                // Before/After
                $before_photos = get_field( 'project_before_photos' );
                if ( $before_photos ) : ?>
                    <div class="project-detail__before-after">
                        <h2>До и после</h2>
                        <div class="project-detail__before">
                            <h3>До</h3>
                            <div class="grid">
                                <?php foreach ( $before_photos as $photo ) : ?>
                                    <div class="col-6 col-md-4">
                                        <img
                                            src="<?php echo esc_url( $photo['sizes']['kitchen-thumb'] ?? $photo['url'] ); ?>"
                                            alt="До: <?php the_title(); ?>"
                                            loading="lazy"
                                        >
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- Project Details -->
                <div class="project-detail__info grid">
                    <div class="col-12 col-md-8">
                        <div class="project-detail__content">
                            <?php the_content(); ?>
                        </div>
                    </div>

                    <aside class="col-12 col-md-4">
                        <div class="project-detail__specs">
                            <?php
                            $client = get_field( 'project_client_name' );
                            $type   = get_field( 'project_kitchen_type' );
                            $area   = get_field( 'project_area' );
                            $dur    = get_field( 'project_duration' );
                            $date   = get_field( 'project_date' );
                            ?>

                            <table class="specs-table">
                                <?php if ( $client ) : ?>
                                    <tr><th>Клиент</th><td><?php echo esc_html( $client ); ?></td></tr>
                                <?php endif; ?>
                                <?php if ( $type && ! is_wp_error( $type ) ) : ?>
                                    <tr><th>Тип кухни</th><td><?php echo esc_html( is_object( $type ) ? $type->name : $type ); ?></td></tr>
                                <?php endif; ?>
                                <?php if ( $area ) : ?>
                                    <tr><th>Площадь</th><td><?php echo esc_html( $area ); ?> кв. м</td></tr>
                                <?php endif; ?>
                                <?php if ( $dur ) : ?>
                                    <tr><th>Срок реализации</th><td><?php echo esc_html( $dur ); ?></td></tr>
                                <?php endif; ?>
                                <?php if ( $date ) : ?>
                                    <tr><th>Дата</th><td><?php echo esc_html( date_i18n( 'F Y', strtotime( $date ) ) ); ?></td></tr>
                                <?php endif; ?>
                            </table>
                        </div>
                    </aside>
                </div>

                <?php
                // Client review
                $review_text = get_field( 'project_review' );
                $rating      = get_field( 'project_rating' );
                if ( $review_text ) : ?>
                    <div class="project-detail__review">
                        <h2>Отзыв клиента</h2>
                        <blockquote class="card card--review">
                            <?php if ( $rating ) : ?>
                                <div class="card__rating"><?php echo kuhni_rema_star_rating( $rating ); ?></div>
                            <?php endif; ?>
                            <p class="card__text"><?php echo esc_html( $review_text ); ?></p>
                            <?php if ( $client ) : ?>
                                <cite class="card__author"><?php echo esc_html( $client ); ?></cite>
                            <?php endif; ?>
                        </blockquote>
                    </div>
                <?php endif; ?>

            <?php endif; ?>

        </div>
    </article>

    <!-- Related Projects -->
    <?php
    $current_type = get_field( 'project_kitchen_type' );
    $type_slug    = is_object( $current_type ) ? $current_type->slug : '';

    $related = new WP_Query( array(
        'post_type'      => 'project',
        'posts_per_page' => 3,
        'post__not_in'   => array( get_the_ID() ),
        'meta_key'       => 'project_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
    ));

    if ( $related->have_posts() ) : ?>
        <section class="section section--surface">
            <div class="container">
                <h2>Похожие проекты</h2>
                <div class="grid">
                    <?php while ( $related->have_posts() ) : $related->the_post(); ?>
                        <div class="col-12 col-md-4">
                            <a href="<?php the_permalink(); ?>" class="card card--project">
                                <?php if ( has_post_thumbnail() ) : ?>
                                    <img class="card__image" src="<?php the_post_thumbnail_url( 'kitchen-card' ); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy">
                                <?php endif; ?>
                                <div class="card__body">
                                    <h3 class="card__title"><?php the_title(); ?></h3>
                                    <?php
                                    $p_type = get_field( 'project_kitchen_type' );
                                    if ( $p_type && is_object( $p_type ) ) : ?>
                                        <span class="badge badge--guarantee"><?php echo esc_html( $p_type->name ); ?></span>
                                    <?php endif; ?>
                                </div>
                            </a>
                        </div>
                    <?php endwhile; ?>
                </div>
            </div>
        </section>
    <?php
    endif;
    wp_reset_postdata();
    ?>

    <!-- CTA -->
    <section class="section section--dark">
        <div class="container">
            <div class="cta-block cta-block--dark">
                <h2 class="cta-block__title">Хотите такую же кухню?</h2>
                <p class="cta-block__subtitle">Рассчитаем стоимость по вашим размерам за 2 минуты</p>
                <a href="/kalkulyator/" class="btn btn--primary btn--lg">Рассчитать стоимость</a>
            </div>
        </div>
    </section>

</main>

<?php get_footer(); ?>
