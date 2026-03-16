<?php
/**
 * Template: Single Kitchen (CPT kitchen)
 *
 * URL pattern: /kuhnya/{model}/
 * Displays full kitchen detail page with gallery, specs, CTA, equipment,
 * related kitchens, trust block, and Schema.org Product JSON-LD.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

get_header();

// ---------------------------------------------------------------------------
// ACF & taxonomy data
// ---------------------------------------------------------------------------

$post_id         = get_the_ID();
$gallery         = get_field( 'kitchen_gallery', $post_id );
$render_3d       = get_field( 'kitchen_3d_render', $post_id );
$price           = get_field( 'kitchen_price', $post_id );
$sale_price      = get_field( 'kitchen_sale_price', $post_id );
$dimensions      = get_field( 'kitchen_dimensions', $post_id );
$countertop      = get_field( 'kitchen_countertop', $post_id );
$hardware        = get_field( 'kitchen_hardware', $post_id );
$module_step     = get_field( 'kitchen_module_step', $post_id );
$production_time = get_field( 'kitchen_production_time', $post_id );
$installment     = get_field( 'kitchen_installment', $post_id );
$equipment       = get_field( 'kitchen_equipment', $post_id );

// Taxonomy term objects
$type_terms     = wp_get_post_terms( $post_id, 'kitchen_type' );
$material_terms = wp_get_post_terms( $post_id, 'kitchen_material' );

$type_term      = ( ! is_wp_error( $type_terms ) && ! empty( $type_terms ) ) ? $type_terms[0] : null;
$material_term  = ( ! is_wp_error( $material_terms ) && ! empty( $material_terms ) ) ? $material_terms[0] : null;

// Countertop human-readable label
$countertop_labels = array(
    'postforming' => 'Постформинг',
    'stone'       => 'Камень',
    'ldsp'        => 'ЛДСП',
);
$countertop_label = isset( $countertop_labels[ $countertop ] ) ? $countertop_labels[ $countertop ] : $countertop;

// Hardware human-readable label
$hardware_labels = array(
    'blum'     => 'Blum',
    'hettich'  => 'Hettich',
    'gtv'      => 'GTV',
    'standard' => 'Стандарт',
);
$hardware_label = isset( $hardware_labels[ $hardware ] ) ? $hardware_labels[ $hardware ] : $hardware;

// Badges
$is_on_sale   = $sale_price && $sale_price < $price;
$is_new       = ( get_the_date( 'U' ) > strtotime( '-30 days' ) );
$has_installment = (bool) $installment;

// Schema price
$schema_price = $is_on_sale ? $sale_price : $price;

// Featured image for schema fallback
$featured_img = get_the_post_thumbnail_url( $post_id, 'kitchen-detail' );
$schema_image = $featured_img;
if ( ! empty( $gallery ) && isset( $gallery[0]['url'] ) ) {
    $schema_image = $gallery[0]['url'];
}
?>

<?php // ================================================================== ?>
<?php // Block 1 — Breadcrumbs                                             ?>
<?php // ================================================================== ?>

<div class="breadcrumbs">
    <div class="container">
        <?php if ( function_exists( 'rank_math_the_breadcrumbs' ) ) : ?>
            <?php rank_math_the_breadcrumbs(); ?>
        <?php else : ?>
            <nav class="breadcrumbs__nav" aria-label="Хлебные крошки">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Главная</a>
                <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>

                <?php if ( $type_term ) : ?>
                    <?php
                    // Map type slug back to catalog page
                    $type_to_page = array(
                        'pryamaya'    => '/pryamye-kuhni/',
                        'uglovaya'    => '/uglovye-kuhni/',
                        'p-obraznaya' => '/p-obraznye-kuhni/',
                    );
                    $type_url = isset( $type_to_page[ $type_term->slug ] ) ? home_url( $type_to_page[ $type_term->slug ] ) : '';
                    ?>
                    <?php if ( $type_url ) : ?>
                        <a href="<?php echo esc_url( $type_url ); ?>"><?php echo esc_html( $type_term->name ); ?> кухни</a>
                    <?php else : ?>
                        <span><?php echo esc_html( $type_term->name ); ?> кухни</span>
                    <?php endif; ?>
                    <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>
                <?php endif; ?>

                <span class="breadcrumbs__current"><?php the_title(); ?></span>
            </nav>
        <?php endif; ?>
    </div>
</div>

<article class="kitchen-single">
    <div class="container">
        <div class="kitchen-single__layout">

            <?php // ====================================================== ?>
            <?php // Block 2 — Gallery                                       ?>
            <?php // ====================================================== ?>

            <div class="kitchen-single__gallery">

                <?php if ( ! empty( $gallery ) || $render_3d ) : ?>

                    <!-- Gallery tabs -->
                    <div class="kitchen-gallery" data-kitchen-gallery>

                        <?php if ( $render_3d ) : ?>
                            <div class="kitchen-gallery__tabs" role="tablist">
                                <button class="kitchen-gallery__tab kitchen-gallery__tab--active"
                                        role="tab" aria-selected="true" data-tab="photos">
                                    Фото
                                </button>
                                <button class="kitchen-gallery__tab"
                                        role="tab" aria-selected="false" data-tab="render">
                                    <span class="badge badge--render">3D</span>
                                    3D-визуализация
                                </button>
                            </div>
                        <?php endif; ?>

                        <!-- Photo slides -->
                        <div class="kitchen-gallery__slides" data-gallery-panel="photos" role="tabpanel">
                            <?php if ( ! empty( $gallery ) ) : ?>
                                <div class="kitchen-gallery__main">
                                    <img src="<?php echo esc_url( $gallery[0]['sizes']['kitchen-detail'] ?? $gallery[0]['url'] ); ?>"
                                         alt="<?php echo esc_attr( $gallery[0]['alt'] ?: get_the_title() ); ?>"
                                         width="1080" height="810"
                                         class="kitchen-gallery__image">
                                </div>

                                <?php if ( count( $gallery ) > 1 ) : ?>
                                    <div class="kitchen-gallery__thumbs">
                                        <?php foreach ( $gallery as $index => $img ) : ?>
                                            <button class="kitchen-gallery__thumb <?php echo 0 === $index ? 'kitchen-gallery__thumb--active' : ''; ?>"
                                                    data-slide="<?php echo (int) $index; ?>"
                                                    aria-label="Фото <?php echo (int) ( $index + 1 ); ?>">
                                                <img src="<?php echo esc_url( $img['sizes']['kitchen-thumb'] ?? $img['sizes']['thumbnail'] ?? $img['url'] ); ?>"
                                                     alt="<?php echo esc_attr( $img['alt'] ?: get_the_title() . ' — фото ' . ( $index + 1 ) ); ?>"
                                                     width="200" height="150" loading="lazy">
                                            </button>
                                        <?php endforeach; ?>
                                    </div>
                                <?php endif; ?>

                            <?php elseif ( has_post_thumbnail() ) : ?>
                                <div class="kitchen-gallery__main">
                                    <?php the_post_thumbnail( 'kitchen-detail', array( 'class' => 'kitchen-gallery__image' ) ); ?>
                                </div>
                            <?php endif; ?>
                        </div>

                        <!-- 3D Render panel -->
                        <?php if ( $render_3d ) : ?>
                            <div class="kitchen-gallery__slides kitchen-gallery__slides--hidden" data-gallery-panel="render" role="tabpanel" hidden>
                                <div class="kitchen-gallery__main">
                                    <span class="badge badge--render kitchen-gallery__badge">3D-визуализация</span>
                                    <img src="<?php echo esc_url( $render_3d['sizes']['kitchen-detail'] ?? $render_3d['url'] ); ?>"
                                         alt="<?php echo esc_attr( get_the_title() . ' — 3D-визуализация' ); ?>"
                                         width="1080" height="810"
                                         class="kitchen-gallery__image" loading="lazy">
                                </div>
                            </div>
                        <?php endif; ?>

                    </div><!-- .kitchen-gallery -->

                <?php elseif ( has_post_thumbnail() ) : ?>

                    <div class="kitchen-gallery">
                        <div class="kitchen-gallery__main">
                            <?php the_post_thumbnail( 'kitchen-detail', array( 'class' => 'kitchen-gallery__image' ) ); ?>
                        </div>
                    </div>

                <?php endif; ?>

            </div><!-- .kitchen-single__gallery -->

            <?php // ====================================================== ?>
            <?php // Block 3 — Specs Card (.kitchen-detail)                  ?>
            <?php // Block 4 — CTA Sidebar                                   ?>
            <?php // ====================================================== ?>

            <div class="kitchen-single__sidebar">

                <!-- Specs Card -->
                <div class="kitchen-detail">
                    <h1 class="kitchen-detail__title"><?php the_title(); ?></h1>

                    <div class="kitchen-detail__price">
                        <?php echo kuhni_rema_get_price_html( $post_id ); ?>
                    </div>

                    <!-- Badges -->
                    <div class="kitchen-detail__badges">
                        <?php if ( $is_on_sale ) : ?>
                            <span class="badge badge--sale">Скидка</span>
                        <?php endif; ?>
                        <?php if ( $is_new ) : ?>
                            <span class="badge badge--new">Новинка</span>
                        <?php endif; ?>
                        <?php if ( $has_installment ) : ?>
                            <span class="badge badge--installment">Рассрочка</span>
                        <?php endif; ?>
                    </div>

                    <!-- Specs table -->
                    <table class="kitchen-detail__specs">
                        <tbody>
                            <?php if ( $type_term ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Тип кухни</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $type_term->name ); ?></td>
                                </tr>
                            <?php endif; ?>

                            <?php if ( $dimensions ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Размеры</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $dimensions ); ?></td>
                                </tr>
                            <?php endif; ?>

                            <?php if ( $material_term ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Материал фасада</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $material_term->name ); ?></td>
                                </tr>
                            <?php endif; ?>

                            <?php if ( $countertop_label ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Столешница</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $countertop_label ); ?></td>
                                </tr>
                            <?php endif; ?>

                            <?php if ( $hardware_label ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Фурнитура</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $hardware_label ); ?></td>
                                </tr>
                            <?php endif; ?>

                            <?php if ( $module_step ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Шаг модуля</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $module_step ); ?> см</td>
                                </tr>
                            <?php endif; ?>

                            <?php if ( $production_time ) : ?>
                                <tr>
                                    <td class="kitchen-detail__spec-label">Срок изготовления</td>
                                    <td class="kitchen-detail__spec-value"><?php echo esc_html( $production_time ); ?></td>
                                </tr>
                            <?php endif; ?>

                            <tr>
                                <td class="kitchen-detail__spec-label">Рассрочка</td>
                                <td class="kitchen-detail__spec-value"><?php echo $has_installment ? 'Доступна' : 'Нет'; ?></td>
                            </tr>
                        </tbody>
                    </table>
                </div><!-- .kitchen-detail -->

                <!-- CTA Sidebar -->
                <div class="kitchen-cta-sidebar">
                    <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary kitchen-cta-sidebar__btn">
                        Рассчитать по моим размерам
                    </a>

                    <button type="button" class="btn btn--outline kitchen-cta-sidebar__btn"
                            data-kuhni-form data-form-type="zamer"
                            data-popup="designer-invite">
                        Пригласить дизайнера
                    </button>
                </div>

            </div><!-- .kitchen-single__sidebar -->

        </div><!-- .kitchen-single__layout -->
    </div><!-- .container -->

    <?php // ================================================================== ?>
    <?php // Block 5 — Equipment (.kitchen-detail__equipment)                   ?>
    <?php // ================================================================== ?>

    <?php if ( $equipment ) : ?>
        <section class="section section--light kitchen-detail__equipment">
            <div class="container">
                <h2 class="kitchen-detail__section-title">Комплектация</h2>
                <div class="kitchen-detail__equipment-content">
                    <?php echo wp_kses_post( $equipment ); ?>
                </div>
            </div>
        </section>
    <?php endif; ?>

    <?php // ================================================================== ?>
    <?php // Block 6 — Related Kitchens                                         ?>
    <?php // ================================================================== ?>

    <?php
    $related = kuhni_rema_get_related_kitchens( $post_id, 4 );
    if ( $related->have_posts() ) :
    ?>
        <section class="section section--light related-kitchens">
            <div class="container">
                <h2 class="related-kitchens__title">Похожие кухни</h2>

                <div class="catalog-grid catalog-grid--4">
                    <?php while ( $related->have_posts() ) : $related->the_post(); ?>

                        <?php
                        $rel_gallery   = get_field( 'kitchen_gallery' );
                        $rel_dims      = get_field( 'kitchen_dimensions' );
                        $rel_mat_terms = wp_get_post_terms( get_the_ID(), 'kitchen_material', array( 'fields' => 'names' ) );
                        $rel_mat_label = ( ! is_wp_error( $rel_mat_terms ) && ! empty( $rel_mat_terms ) ) ? $rel_mat_terms[0] : '';
                        ?>

                        <article class="card card--kitchen">
                            <a href="<?php the_permalink(); ?>" class="card--kitchen__link">
                                <div class="card--kitchen__image">
                                    <?php if ( has_post_thumbnail() ) : ?>
                                        <?php the_post_thumbnail( 'kitchen-card', array( 'loading' => 'lazy' ) ); ?>
                                    <?php elseif ( ! empty( $rel_gallery ) && isset( $rel_gallery[0] ) ) : ?>
                                        <img src="<?php echo esc_url( $rel_gallery[0]['sizes']['kitchen-card'] ?? $rel_gallery[0]['url'] ); ?>"
                                             alt="<?php echo esc_attr( get_the_title() ); ?>"
                                             width="800" height="600" loading="lazy">
                                    <?php endif; ?>
                                </div>

                                <div class="card--kitchen__body">
                                    <h3 class="card--kitchen__title"><?php the_title(); ?></h3>
                                    <div class="card--kitchen__price"><?php echo kuhni_rema_get_price_html(); ?></div>
                                    <?php if ( $rel_dims ) : ?>
                                        <span class="card--kitchen__dimensions"><?php echo esc_html( $rel_dims ); ?></span>
                                    <?php endif; ?>
                                    <?php if ( $rel_mat_label ) : ?>
                                        <span class="card--kitchen__material tag"><?php echo esc_html( $rel_mat_label ); ?></span>
                                    <?php endif; ?>
                                </div>
                            </a>
                        </article>

                    <?php endwhile; ?>
                </div>
            </div>
        </section>
        <?php wp_reset_postdata(); ?>
    <?php endif; ?>

    <?php // ================================================================== ?>
    <?php // Block 7 — Trust Block                                              ?>
    <?php // ================================================================== ?>

    <section class="section section--surface trust-block">
        <div class="container">
            <div class="trust-block__items">

                <?php
                $vk_count = kuhni_rema_option( 'social_vk_count' );
                $vk_url   = kuhni_rema_option( 'social_vk_url' );
                ?>
                <?php if ( $vk_count ) : ?>
                    <div class="trust-block__item">
                        <?php if ( $vk_url ) : ?>
                            <a href="<?php echo esc_url( $vk_url ); ?>" class="trust-block__link" target="_blank" rel="noopener noreferrer">
                                <strong class="trust-block__number"><?php echo esc_html( $vk_count ); ?></strong>
                                <span class="trust-block__label">подписчиков VK</span>
                            </a>
                        <?php else : ?>
                            <strong class="trust-block__number"><?php echo esc_html( $vk_count ); ?></strong>
                            <span class="trust-block__label">подписчиков VK</span>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>

                <div class="trust-block__item">
                    <strong class="trust-block__number">24 мес.</strong>
                    <span class="trust-block__label">Гарантия</span>
                </div>

            </div>

            <?php // Partner logos from ACF options ?>
            <?php
            $partners = kuhni_rema_option( 'partners_logos' );
            if ( $partners && is_array( $partners ) ) :
            ?>
                <div class="trust-block__partners">
                    <?php foreach ( $partners as $partner ) :
                        if ( empty( $partner['logo'] ) ) continue;
                    ?>
                        <div class="trust-block__partner">
                            <?php if ( ! empty( $partner['url'] ) ) : ?>
                                <a href="<?php echo esc_url( $partner['url'] ); ?>" target="_blank" rel="noopener noreferrer">
                            <?php endif; ?>

                            <img src="<?php echo esc_url( $partner['logo']['url'] ); ?>"
                                 alt="<?php echo esc_attr( $partner['name'] ?? '' ); ?>"
                                 width="120" height="60" loading="lazy"
                                 class="trust-block__partner-logo">

                            <?php if ( ! empty( $partner['url'] ) ) : ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

        </div>
    </section>

</article><!-- .kitchen-single -->

<?php
get_footer();
