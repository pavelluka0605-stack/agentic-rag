<?php
/**
 * Template Name: О компании
 *
 * About page: company story, team, production, partners, CTA.
 *
 * @package KuhniRema
 */

get_header();

$team_query    = kuhni_rema_get_team();
$partners      = kuhni_rema_option( 'partners_logos' );
?>

<?php get_template_part( 'templates/breadcrumbs' ); ?>

<main class="page-about">

    <!-- ============================================================
         Hero
         ============================================================ -->
    <section class="section about-hero">
        <div class="container">
            <h1 class="about-hero__title">О компании &laquo;Кухни Рема&raquo;</h1>
            <p class="about-hero__lead">
                Мы проектируем и производим кухни на заказ в Красноярске. Собственное производство,
                честные цены и точность до 1&nbsp;сантиметра &mdash; то, что отличает нас от&nbsp;конкурентов.
            </p>
        </div>
    </section>

    <!-- ============================================================
         About Text
         ============================================================ -->
    <section class="section about-story">
        <div class="container">
            <div class="about-story__content">
                <h2 class="about-story__heading">Наша история</h2>
                <p>
                    Компания &laquo;Кухни Рема&raquo; начала свою работу с простой идеи: каждая кухня должна
                    идеально вписываться в пространство заказчика. Мы построили собственное производство в
                    Красноярске и&nbsp;наладили полный цикл &mdash; от&nbsp;замера до&nbsp;установки.
                </p>
                <p>
                    Сегодня мы выполнили сотни проектов для семей по&nbsp;всему Красноярскому краю.
                    Каждый проект &mdash; это индивидуальный подход, качественные материалы и&nbsp;соблюдение сроков.
                </p>
            </div>

            <div class="about-story__values">
                <h2 class="about-story__heading">Наши ценности</h2>
                <ul class="about-story__values-list">
                    <li class="about-story__value">
                        <strong class="about-story__value-title">Собственное производство</strong>
                        <span class="about-story__value-text">Полный контроль качества на каждом этапе. Производство в Красноярске.</span>
                    </li>
                    <li class="about-story__value">
                        <strong class="about-story__value-title">Точность до 1 см</strong>
                        <span class="about-story__value-text">Бесплатный выезд замерщика и проектирование с учётом всех особенностей помещения.</span>
                    </li>
                    <li class="about-story__value">
                        <strong class="about-story__value-title">Честное ценообразование</strong>
                        <span class="about-story__value-text">Фиксированная цена в договоре. Никаких скрытых доплат после подписания.</span>
                    </li>
                </ul>
            </div>
        </div><!-- .container -->
    </section>

    <!-- ============================================================
         Team
         ============================================================ -->
    <?php if ( $team_query->have_posts() ) : ?>
        <section class="section about-team">
            <div class="container">
                <h2 class="about-team__title">Наша команда</h2>

                <div class="about-team__grid">
                    <?php while ( $team_query->have_posts() ) : $team_query->the_post(); ?>
                        <?php
                        $photo       = get_field( 'team_photo' );
                        $position    = get_field( 'team_position' );
                        $description = get_field( 'team_description' );
                        ?>
                        <div class="about-team__card">
                            <?php if ( $photo ) : ?>
                                <div class="about-team__photo">
                                    <img
                                        src="<?php echo esc_url( $photo['sizes']['medium'] ?? $photo['url'] ); ?>"
                                        alt="<?php echo esc_attr( get_the_title() ); ?>"
                                        width="<?php echo esc_attr( $photo['sizes']['medium-width'] ?? $photo['width'] ); ?>"
                                        height="<?php echo esc_attr( $photo['sizes']['medium-height'] ?? $photo['height'] ); ?>"
                                        loading="lazy"
                                    >
                                </div>
                            <?php endif; ?>

                            <div class="about-team__info">
                                <h3 class="about-team__name"><?php the_title(); ?></h3>
                                <?php if ( $position ) : ?>
                                    <span class="about-team__position"><?php echo esc_html( $position ); ?></span>
                                <?php endif; ?>
                                <?php if ( $description ) : ?>
                                    <p class="about-team__desc"><?php echo esc_html( $description ); ?></p>
                                <?php endif; ?>
                            </div>
                        </div><!-- .about-team__card -->
                    <?php endwhile; ?>
                </div><!-- .about-team__grid -->
            </div><!-- .container -->
        </section>
        <?php wp_reset_postdata(); ?>
    <?php endif; ?>

    <!-- ============================================================
         Production
         ============================================================ -->
    <section class="section about-production">
        <div class="container">
            <h2 class="about-production__title">Наше производство</h2>
            <p class="about-production__text">
                Производственный цех расположен в Красноярске. Мы используем немецкое и итальянское
                оборудование для раскроя, кромления и сборки. Это позволяет выдерживать точность до&nbsp;1&nbsp;мм
                и&nbsp;выполнять заказы в&nbsp;срок от&nbsp;14&nbsp;дней.
            </p>

            <div class="about-production__gallery" id="production-gallery">
                <!-- Gallery placeholder: images managed via ACF or Bricks Builder -->
                <p class="about-production__gallery-placeholder">Фотогалерея производства</p>
            </div>
        </div><!-- .container -->
    </section>

    <!-- ============================================================
         Partners
         ============================================================ -->
    <?php if ( $partners && is_array( $partners ) ) : ?>
        <section class="section about-partners">
            <div class="container">
                <h2 class="about-partners__title">Наши партнёры</h2>

                <div class="about-partners__grid">
                    <?php foreach ( $partners as $partner ) : ?>
                        <?php
                        $logo = $partner['logo'] ?? null;
                        $name = $partner['name'] ?? '';
                        $url  = $partner['url'] ?? '';
                        ?>
                        <?php if ( $logo ) : ?>
                            <div class="about-partners__item">
                                <?php if ( $url ) : ?>
                                    <a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener noreferrer" class="about-partners__link" aria-label="<?php echo esc_attr( $name ); ?>">
                                <?php endif; ?>

                                <img
                                    src="<?php echo esc_url( $logo['sizes']['thumbnail'] ?? $logo['url'] ); ?>"
                                    alt="<?php echo esc_attr( $name ); ?>"
                                    class="about-partners__logo"
                                    loading="lazy"
                                >

                                <?php if ( $url ) : ?>
                                    </a>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div><!-- .about-partners__grid -->
            </div><!-- .container -->
        </section>
    <?php endif; ?>

    <!-- ============================================================
         CTA
         ============================================================ -->
    <section class="section about-cta">
        <div class="container">
            <div class="about-cta__block">
                <h2 class="about-cta__title">Рассчитать стоимость вашей кухни</h2>
                <p class="about-cta__text">Ответьте на несколько вопросов и получите расчёт за 2 минуты</p>
                <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary about-cta__btn">
                    Рассчитать стоимость
                </a>
            </div>
        </div>
    </section>

</main><!-- .page-about -->

<?php get_footer(); ?>
