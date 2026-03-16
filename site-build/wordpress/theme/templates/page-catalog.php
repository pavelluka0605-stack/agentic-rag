<?php
/**
 * Template Name: Каталог кухонь
 *
 * Used for /pryamye-kuhni/, /uglovye-kuhni/, /p-obraznye-kuhni/.
 * Determines kitchen_type from page slug mapping.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ---------------------------------------------------------------------------
// Determine kitchen_type from page slug
// ---------------------------------------------------------------------------

$slug_to_type = array(
    'pryamye-kuhni'    => 'pryamaya',
    'uglovye-kuhni'    => 'uglovaya',
    'p-obraznye-kuhni' => 'p-obraznaya',
);

$page_slug    = get_post_field( 'post_name', get_the_ID() );
$kitchen_type = isset( $slug_to_type[ $page_slug ] ) ? $slug_to_type[ $page_slug ] : '';

// Type term object (for name, description, etc.)
$type_term = $kitchen_type ? get_term_by( 'slug', $kitchen_type, 'kitchen_type' ) : null;

// Minimum price for this type
$min_price     = $kitchen_type ? kuhni_rema_get_min_price_by_type( $kitchen_type ) : null;
$min_price_fmt = $min_price ? kuhni_rema_format_price( $min_price ) : null;

// Pagination
$paged = get_query_var( 'paged' ) ? get_query_var( 'paged' ) : 1;

get_header();
?>

<?php // ================================================================== ?>
<?php // Block 7 — Breadcrumbs (at top)                                     ?>
<?php // ================================================================== ?>

<div class="breadcrumbs">
    <div class="container">
        <?php if ( function_exists( 'rank_math_the_breadcrumbs' ) ) : ?>
            <?php rank_math_the_breadcrumbs(); ?>
        <?php else : ?>
            <nav class="breadcrumbs__nav" aria-label="Хлебные крошки">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Главная</a>
                <span class="breadcrumbs__sep" aria-hidden="true">&rsaquo;</span>
                <span class="breadcrumbs__current"><?php echo esc_html( get_the_title() ); ?></span>
            </nav>
        <?php endif; ?>
    </div>
</div>

<?php // ================================================================== ?>
<?php // Block 1 — Hero (.section--dark)                                    ?>
<?php // ================================================================== ?>

<section class="section section--dark catalog-hero" style="background-image:url('<?php echo esc_url( get_the_post_thumbnail_url( get_the_ID(), 'kitchen-hero' ) ); ?>');">
    <div class="container catalog-hero__inner">
        <h1 class="catalog-hero__title"><?php the_title(); ?></h1>

        <?php if ( $min_price_fmt ) : ?>
            <p class="catalog-hero__subtitle">
                Кухни на заказ от <strong><?php echo esc_html( $min_price_fmt ); ?></strong>
            </p>
        <?php endif; ?>

        <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary catalog-hero__cta">
            Рассчитать стоимость
        </a>
    </div>
</section>

<?php // ================================================================== ?>
<?php // Block 2 — Filters (.catalog-filters)                              ?>
<?php // ================================================================== ?>

<section class="section section--light catalog-filters">
    <div class="container">
        <form class="catalog-filter"
              data-kuhni-filter
              data-kitchen-type="<?php echo esc_attr( $kitchen_type ); ?>"
              method="get"
              action="">

            <div class="catalog-filter__row">

                <!-- Price range (placeholder for JS slider) -->
                <div class="catalog-filter__group catalog-filter__group--price">
                    <label class="catalog-filter__label">Цена</label>
                    <div class="catalog-filter__slider" data-filter="price"
                         data-min="0"
                         data-max="500000">
                        <input type="hidden" name="price_min" value="">
                        <input type="hidden" name="price_max" value="">
                        <div class="catalog-filter__slider-track"></div>
                    </div>
                </div>

                <!-- Style checkboxes -->
                <div class="catalog-filter__group catalog-filter__group--style">
                    <label class="catalog-filter__label">Стиль</label>
                    <div class="catalog-filter__checkboxes" data-filter="style">
                        <?php
                        $styles = get_terms( array(
                            'taxonomy'   => 'kitchen_style',
                            'hide_empty' => true,
                        ) );
                        if ( ! is_wp_error( $styles ) && ! empty( $styles ) ) :
                            foreach ( $styles as $style ) : ?>
                                <label class="catalog-filter__checkbox">
                                    <input type="checkbox" name="style[]" value="<?php echo esc_attr( $style->slug ); ?>">
                                    <span><?php echo esc_html( $style->name ); ?></span>
                                </label>
                            <?php endforeach;
                        endif;
                        ?>
                    </div>
                </div>

                <!-- Material checkboxes -->
                <div class="catalog-filter__group catalog-filter__group--material">
                    <label class="catalog-filter__label">Материал фасада</label>
                    <div class="catalog-filter__checkboxes" data-filter="material">
                        <?php
                        $materials = get_terms( array(
                            'taxonomy'   => 'kitchen_material',
                            'hide_empty' => true,
                        ) );
                        if ( ! is_wp_error( $materials ) && ! empty( $materials ) ) :
                            foreach ( $materials as $mat ) : ?>
                                <label class="catalog-filter__checkbox">
                                    <input type="checkbox" name="material[]" value="<?php echo esc_attr( $mat->slug ); ?>">
                                    <span><?php echo esc_html( $mat->name ); ?></span>
                                </label>
                            <?php endforeach;
                        endif;
                        ?>
                    </div>
                </div>

                <!-- Sort -->
                <div class="catalog-filter__group catalog-filter__group--sort">
                    <label class="catalog-filter__label" for="catalog-sort">Сортировка</label>
                    <select class="catalog-filter__select" id="catalog-sort" name="sort" data-filter="sort">
                        <option value="default">По умолчанию</option>
                        <option value="price_asc">По цене (сначала дешевле)</option>
                        <option value="price_desc">По цене (сначала дороже)</option>
                        <option value="popular">По популярности</option>
                    </select>
                </div>

            </div><!-- .catalog-filter__row -->

        </form>
    </div>
</section>

<?php // ================================================================== ?>
<?php // Block 3 — Kitchen Grid (.catalog-grid)                            ?>
<?php // ================================================================== ?>

<section class="section section--light catalog-grid-section">
    <div class="container">

        <?php
        $query_args = array(
            'post_type'      => 'kitchen',
            'posts_per_page' => 12,
            'paged'          => $paged,
            'meta_key'       => 'kitchen_sort_order',
            'orderby'        => 'meta_value_num',
            'order'          => 'ASC',
        );

        if ( $kitchen_type ) {
            $query_args['tax_query'] = array(
                array(
                    'taxonomy' => 'kitchen_type',
                    'field'    => 'slug',
                    'terms'    => $kitchen_type,
                ),
            );
        }

        $kitchens = new WP_Query( $query_args );
        ?>

        <?php if ( $kitchens->have_posts() ) : ?>

            <div class="catalog-grid" data-catalog-grid>

                <?php while ( $kitchens->have_posts() ) : $kitchens->the_post(); ?>

                    <?php
                    $gallery    = get_field( 'kitchen_gallery' );
                    $dimensions = get_field( 'kitchen_dimensions' );
                    $mat_terms  = wp_get_post_terms( get_the_ID(), 'kitchen_material', array( 'fields' => 'names' ) );
                    $mat_label  = ( ! is_wp_error( $mat_terms ) && ! empty( $mat_terms ) ) ? $mat_terms[0] : '';
                    ?>

                    <article class="card card--kitchen">
                        <a href="<?php the_permalink(); ?>" class="card--kitchen__link">

                            <div class="card--kitchen__image">
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
                                    <span class="card--kitchen__material tag"><?php echo esc_html( $mat_label ); ?></span>
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
                    'total'     => $kitchens->max_num_pages,
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

        <?php wp_reset_postdata(); ?>

    </div>
</section>

<?php // ================================================================== ?>
<?php // Block 4 — Competitor Project Upload (.section--surface)           ?>
<?php // ================================================================== ?>

<section class="section section--surface competitor-project">
    <div class="container competitor-project__inner">
        <div class="competitor-project__text">
            <h2 class="competitor-project__title">Есть проект от другой компании?</h2>
            <p class="competitor-project__subtitle">Пришлите проект — предложим выгоднее</p>
        </div>

        <form class="competitor-project__form" data-kuhni-form data-form-type="competitor_project">
            <div class="competitor-project__fields">
                <div class="form-group">
                    <label class="form-group__label" for="cp-name">Ваше имя</label>
                    <input class="form-group__input" type="text" id="cp-name" name="name" placeholder="Иван" autocomplete="name">
                </div>

                <div class="form-group">
                    <label class="form-group__label" for="cp-phone">Телефон <span class="required">*</span></label>
                    <input class="form-group__input" type="tel" id="cp-phone" name="phone" placeholder="+7 (___) ___-__-__" required autocomplete="tel">
                </div>

                <div class="form-group">
                    <label class="form-group__label" for="cp-file">Прикрепите проект</label>
                    <input class="form-group__input form-group__input--file" type="file" id="cp-file" name="project_file"
                           accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                </div>
            </div>

            <input type="hidden" name="page_url" value="<?php echo esc_url( get_permalink() ); ?>">
            <button type="submit" class="btn btn--primary competitor-project__submit">Отправить проект</button>
            <p class="form-privacy">Нажимая кнопку, вы соглашаетесь с <a href="<?php echo esc_url( home_url( '/politika-konfidencialnosti/' ) ); ?>">политикой конфиденциальности</a></p>
        </form>
    </div>
</section>

<?php // ================================================================== ?>
<?php // Block 5 — Advantages (.section--light)                            ?>
<?php // ================================================================== ?>

<section class="section section--light advantages">
    <div class="container">
        <div class="advantages__grid">

            <div class="advantages__card">
                <span class="advantages__icon" aria-hidden="true">📐</span>
                <h3 class="advantages__title">Точность до 1 см</h3>
                <p class="advantages__desc">Шаг модуля — 1 сантиметр. Кухня идеально впишется в ваше помещение.</p>
            </div>

            <div class="advantages__card">
                <span class="advantages__icon" aria-hidden="true">⏱</span>
                <h3 class="advantages__title">От 14 дней</h3>
                <p class="advantages__desc">Быстрое производство благодаря собственному цеху в Красноярске.</p>
            </div>

            <div class="advantages__card">
                <span class="advantages__icon" aria-hidden="true">💳</span>
                <h3 class="advantages__title">Рассрочка</h3>
                <p class="advantages__desc">Рассрочка без банка и переплат — удобная оплата частями.</p>
            </div>

            <div class="advantages__card">
                <span class="advantages__icon" aria-hidden="true">🛡</span>
                <h3 class="advantages__title">Гарантия 24 мес.</h3>
                <p class="advantages__desc">Гарантируем качество на 2 года. Бесплатный сервис при гарантийном случае.</p>
            </div>

        </div>
    </div>
</section>

<?php // ================================================================== ?>
<?php // Block 6 — CTA Block (.cta-block--dark)                           ?>
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
