<?php
/**
 * Template: Archive Kitchen (CPT kitchen)
 *
 * URL: /kuhnya/ — main catalog page showing all kitchens.
 * Also handles taxonomy archives: kitchen_type, kitchen_style, kitchen_material.
 * Filters: type, style, material, price sort.
 * Grid: 3-column desktop, 2-column tablet, 1-column mobile.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

get_header();

// ---------------------------------------------------------------------------
// Determine current context (archive vs taxonomy)
// ---------------------------------------------------------------------------

$current_type     = '';
$current_style    = '';
$current_material = '';
$archive_title    = 'Каталог кухонь';
$archive_desc     = 'Кухни на заказ от производителя в Красноярске';

if ( is_tax( 'kitchen_type' ) ) {
    $term          = get_queried_object();
    $current_type  = $term->slug;
    $archive_title = $term->name . ' кухни';
    if ( $term->description ) {
        $archive_desc = $term->description;
    }
} elseif ( is_tax( 'kitchen_style' ) ) {
    $term          = get_queried_object();
    $current_style = $term->slug;
    $archive_title = 'Кухни в стиле «' . $term->name . '»';
    if ( $term->description ) {
        $archive_desc = $term->description;
    }
} elseif ( is_tax( 'kitchen_material' ) ) {
    $term             = get_queried_object();
    $current_material = $term->slug;
    $archive_title    = 'Кухни — ' . $term->name;
    if ( $term->description ) {
        $archive_desc = $term->description;
    }
}

// Pagination
$paged = get_query_var( 'paged' ) ? get_query_var( 'paged' ) : 1;

// Total count for this archive
global $wp_query;
$total_found = $wp_query->found_posts;
?>

<?php // ================================================================== ?>
<?php // Breadcrumbs                                                         ?>
<?php // ================================================================== ?>

<div class="breadcrumbs">
    <div class="container">
        <?php if ( function_exists( 'rank_math_the_breadcrumbs' ) ) : ?>
            <?php rank_math_the_breadcrumbs(); ?>
        <?php else : ?>
            <nav class="breadcrumbs__nav" aria-label="Хлебные крошки">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Главная</a>
                <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>

                <?php if ( is_tax() ) : ?>
                    <a href="<?php echo esc_url( get_post_type_archive_link( 'kitchen' ) ); ?>">Каталог кухонь</a>
                    <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>
                    <span class="breadcrumbs__current"><?php echo esc_html( get_queried_object()->name ); ?></span>
                <?php else : ?>
                    <span class="breadcrumbs__current">Каталог кухонь</span>
                <?php endif; ?>
            </nav>
        <?php endif; ?>
    </div>
</div>

<?php // ================================================================== ?>
<?php // Hero                                                                ?>
<?php // ================================================================== ?>

<section class="section section--dark catalog-hero">
    <div class="container catalog-hero__inner">
        <h1 class="catalog-hero__title"><?php echo esc_html( $archive_title ); ?></h1>
        <p class="catalog-hero__subtitle"><?php echo esc_html( $archive_desc ); ?></p>
    </div>
</section>

<?php // ================================================================== ?>
<?php // Filters                                                             ?>
<?php // ================================================================== ?>

<section class="section section--light catalog-filters">
    <div class="container">
        <form class="catalog-filter" data-kuhni-filter method="get" action="<?php echo esc_url( get_post_type_archive_link( 'kitchen' ) ); ?>">

            <div class="catalog-filter__row">

                <!-- Type pills -->
                <div class="catalog-filter__group catalog-filter__group--type">
                    <label class="catalog-filter__label">Тип кухни</label>
                    <div class="catalog-filter__checkboxes" data-filter="type">
                        <?php
                        $types = get_terms( array(
                            'taxonomy'   => 'kitchen_type',
                            'hide_empty' => true,
                        ) );
                        if ( ! is_wp_error( $types ) && ! empty( $types ) ) :
                            foreach ( $types as $type ) :
                                $checked = ( $current_type === $type->slug ) ? 'checked' : '';
                        ?>
                                <label class="catalog-filter__checkbox">
                                    <input type="checkbox" name="type[]" value="<?php echo esc_attr( $type->slug ); ?>" <?php echo $checked; ?>>
                                    <span><?php echo esc_html( $type->name ); ?></span>
                                    <span class="catalog-filter__count">(<?php echo (int) $type->count; ?>)</span>
                                </label>
                        <?php
                            endforeach;
                        endif;
                        ?>
                    </div>
                </div>

                <!-- Style pills -->
                <div class="catalog-filter__group catalog-filter__group--style">
                    <label class="catalog-filter__label">Стиль</label>
                    <div class="catalog-filter__checkboxes" data-filter="style">
                        <?php
                        $styles = get_terms( array(
                            'taxonomy'   => 'kitchen_style',
                            'hide_empty' => true,
                        ) );
                        if ( ! is_wp_error( $styles ) && ! empty( $styles ) ) :
                            foreach ( $styles as $style ) :
                                $checked = ( $current_style === $style->slug ) ? 'checked' : '';
                        ?>
                                <label class="catalog-filter__checkbox">
                                    <input type="checkbox" name="style[]" value="<?php echo esc_attr( $style->slug ); ?>" <?php echo $checked; ?>>
                                    <span><?php echo esc_html( $style->name ); ?></span>
                                </label>
                        <?php
                            endforeach;
                        endif;
                        ?>
                    </div>
                </div>

                <!-- Material pills -->
                <div class="catalog-filter__group catalog-filter__group--material">
                    <label class="catalog-filter__label">Материал фасада</label>
                    <div class="catalog-filter__checkboxes" data-filter="material">
                        <?php
                        $materials = get_terms( array(
                            'taxonomy'   => 'kitchen_material',
                            'hide_empty' => true,
                        ) );
                        if ( ! is_wp_error( $materials ) && ! empty( $materials ) ) :
                            foreach ( $materials as $mat ) :
                                $checked = ( $current_material === $mat->slug ) ? 'checked' : '';
                        ?>
                                <label class="catalog-filter__checkbox">
                                    <input type="checkbox" name="material[]" value="<?php echo esc_attr( $mat->slug ); ?>" <?php echo $checked; ?>>
                                    <span><?php echo esc_html( $mat->name ); ?></span>
                                </label>
                        <?php
                            endforeach;
                        endif;
                        ?>
                    </div>
                </div>

                <!-- Sort -->
                <div class="catalog-filter__group catalog-filter__group--sort">
                    <label class="catalog-filter__label" for="archive-sort">Сортировка</label>
                    <select class="catalog-filter__select" id="archive-sort" name="sort" data-filter="sort">
                        <option value="default">По умолчанию</option>
                        <option value="price_asc">Сначала дешевле</option>
                        <option value="price_desc">Сначала дороже</option>
                        <option value="newest">Новинки</option>
                    </select>
                </div>

            </div><!-- .catalog-filter__row -->

        </form>
    </div>
</section>

<?php // ================================================================== ?>
<?php // Kitchen Grid                                                        ?>
<?php // ================================================================== ?>

<section class="section section--light catalog-grid-section">
    <div class="container">

        <p class="catalog-results-count">
            <?php
            printf(
                '%s %s',
                esc_html( $total_found ),
                esc_html( _n_noop( 'кухня', 'кухонь' )[ $total_found % 10 === 1 && $total_found % 100 !== 11 ? 0 : 1 ] ?? 'кухонь' )
            );
            ?>
        </p>

        <?php if ( have_posts() ) : ?>

            <div class="catalog-grid" data-catalog-grid>

                <?php while ( have_posts() ) : the_post(); ?>

                    <?php
                    $gallery    = get_field( 'kitchen_gallery' );
                    $dimensions = get_field( 'kitchen_dimensions' );
                    $sale_price = get_field( 'kitchen_sale_price' );
                    $price      = get_field( 'kitchen_price' );
                    $installment = get_field( 'kitchen_installment' );
                    $mat_terms  = wp_get_post_terms( get_the_ID(), 'kitchen_material', array( 'fields' => 'names' ) );
                    $mat_label  = ( ! is_wp_error( $mat_terms ) && ! empty( $mat_terms ) ) ? $mat_terms[0] : '';

                    $is_on_sale = $sale_price && $sale_price < $price;
                    $is_new     = ( get_the_date( 'U' ) > strtotime( '-30 days' ) );
                    ?>

                    <article class="card card--kitchen">
                        <a href="<?php the_permalink(); ?>" class="card--kitchen__link">

                            <div class="card--kitchen__image">

                                <?php // Badges ?>
                                <?php if ( $is_on_sale || $is_new || $installment ) : ?>
                                    <div class="card--kitchen__badges">
                                        <?php if ( $is_on_sale ) : ?>
                                            <span class="badge badge--sale">Скидка</span>
                                        <?php endif; ?>
                                        <?php if ( $is_new ) : ?>
                                            <span class="badge badge--new">Новинка</span>
                                        <?php endif; ?>
                                        <?php if ( $installment ) : ?>
                                            <span class="badge badge--installment">Рассрочка</span>
                                        <?php endif; ?>
                                    </div>
                                <?php endif; ?>

                                <?php if ( has_post_thumbnail() ) : ?>
                                    <?php the_post_thumbnail( 'kitchen-card', array( 'loading' => 'lazy' ) ); ?>
                                <?php elseif ( ! empty( $gallery ) && isset( $gallery[0] ) ) : ?>
                                    <img src="<?php echo esc_url( $gallery[0]['sizes']['kitchen-card'] ?? $gallery[0]['url'] ); ?>"
                                         alt="<?php echo esc_attr( $gallery[0]['alt'] ?: get_the_title() ); ?>"
                                         width="800" height="600" loading="lazy">
                                <?php endif; ?>
                            </div>

                            <div class="card--kitchen__body">
                                <h3 class="card--kitchen__title"><?php the_title(); ?></h3>

                                <div class="card--kitchen__price">
                                    <?php echo kuhni_rema_get_price_html(); ?>
                                </div>

                                <?php if ( $dimensions ) : ?>
                                    <span class="card--kitchen__dimensions"><?php echo esc_html( $dimensions ); ?></span>
                                <?php endif; ?>

                                <?php if ( $mat_label ) : ?>
                                    <span class="card--kitchen__material"><?php echo esc_html( $mat_label ); ?></span>
                                <?php endif; ?>
                            </div>

                        </a>
                    </article>

                <?php endwhile; ?>

            </div><!-- .catalog-grid -->

            <?php // Pagination ?>
            <div class="catalog-pagination">
                <?php
                echo paginate_links( array(
                    'total'     => $wp_query->max_num_pages,
                    'current'   => $paged,
                    'prev_text' => '&larr; Назад',
                    'next_text' => 'Далее &rarr;',
                    'mid_size'  => 2,
                ) );
                ?>
            </div>

        <?php else : ?>

            <p class="catalog-grid__empty">Кухни пока не добавлены. Позвоните нам — подберём модель по вашим размерам!</p>

        <?php endif; ?>

    </div>
</section>

<?php // ================================================================== ?>
<?php // CTA Block                                                           ?>
<?php // ================================================================== ?>

<section class="section section--dark cta-block cta-block--dark">
    <div class="container cta-block__inner">
        <h2 class="cta-block__title">Не нашли подходящую модель?</h2>
        <p class="cta-block__text">Пройдите короткий квиз — мы подберём кухню под ваши размеры и бюджет</p>
        <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary cta-block__btn">
            Подобрать кухню
        </a>
    </div>
</section>

<?php
get_footer();
