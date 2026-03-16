<?php
/**
 * Template Name: Портфолио
 *
 * Portfolio page: grid of completed projects (CPT project).
 *
 * @package KuhniRema
 */

get_header();

$projects = new WP_Query( array(
    'post_type'      => 'project',
    'posts_per_page' => -1,
    'meta_key'       => 'project_sort_order',
    'orderby'        => 'meta_value_num',
    'order'          => 'ASC',
) );
?>

<?php get_template_part( 'templates/breadcrumbs' ); ?>

<main class="page-portfolio">

    <!-- ============================================================
         Header
         ============================================================ -->
    <section class="section portfolio-header">
        <div class="container">
            <h1 class="portfolio-header__title">Портфолио &mdash; реализованные проекты</h1>
        </div>
    </section>

    <!-- ============================================================
         Projects Grid
         ============================================================ -->
    <?php if ( $projects->have_posts() ) : ?>
        <section class="section portfolio-grid">
            <div class="container">
                <div class="portfolio-grid__list">
                    <?php while ( $projects->have_posts() ) : $projects->the_post(); ?>
                        <?php
                        $kitchen_type = get_field( 'project_kitchen_type' );
                        $area         = get_field( 'project_area' );
                        $duration     = get_field( 'project_duration' );
                        ?>
                        <a href="<?php the_permalink(); ?>" class="portfolio-grid__card">

                            <?php if ( has_post_thumbnail() ) : ?>
                                <div class="portfolio-grid__image">
                                    <?php the_post_thumbnail( 'kitchen-card', array(
                                        'class'   => 'portfolio-grid__img',
                                        'loading' => 'lazy',
                                    ) ); ?>
                                </div>
                            <?php endif; ?>

                            <div class="portfolio-grid__body">
                                <h2 class="portfolio-grid__title"><?php the_title(); ?></h2>

                                <div class="portfolio-grid__meta">
                                    <?php if ( $kitchen_type && ! is_wp_error( $kitchen_type ) ) : ?>
                                        <span class="portfolio-grid__tag"><?php echo esc_html( $kitchen_type->name ); ?></span>
                                    <?php endif; ?>

                                    <?php if ( $area ) : ?>
                                        <span class="portfolio-grid__area"><?php echo esc_html( $area ); ?> кв.&nbsp;м</span>
                                    <?php endif; ?>

                                    <?php if ( $duration ) : ?>
                                        <span class="portfolio-grid__duration"><?php echo esc_html( $duration ); ?></span>
                                    <?php endif; ?>
                                </div>
                            </div><!-- .portfolio-grid__body -->

                        </a><!-- .portfolio-grid__card -->
                    <?php endwhile; ?>
                </div><!-- .portfolio-grid__list -->
            </div><!-- .container -->
        </section>
        <?php wp_reset_postdata(); ?>
    <?php else : ?>
        <section class="section portfolio-empty">
            <div class="container">
                <p class="portfolio-empty__text">Проекты скоро появятся. Следите за обновлениями!</p>
            </div>
        </section>
    <?php endif; ?>

    <!-- ============================================================
         CTA
         ============================================================ -->
    <section class="section portfolio-cta">
        <div class="container">
            <div class="portfolio-cta__block">
                <h2 class="portfolio-cta__title">Хотите такую же кухню?</h2>
                <p class="portfolio-cta__text">Рассчитайте стоимость за 2 минуты</p>
                <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary portfolio-cta__btn">
                    Рассчитать стоимость
                </a>
            </div>
        </div>
    </section>

</main><!-- .page-portfolio -->

<?php get_footer(); ?>
