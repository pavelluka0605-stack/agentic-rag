<?php
/**
 * Template Name: Главная
 *
 * Front page template for Кухни Рема (кухнирема.рф).
 * 10 sections: Hero, Advantages, Catalog, Quiz, Portfolio, How We Work,
 * Reviews, Installment, Partners, Final CTA.
 *
 * @package KuhniRema
 */

get_header();

// Pre-fetch reusable data
$phone         = kuhni_rema_option( 'global_phone_main' );
$promotions    = kuhni_rema_get_active_promotions( 'home' );
$total_kitchens = kuhni_rema_get_kitchen_count();

$types = array(
    array(
        'slug'  => 'pryamye',
        'name'  => 'Прямые кухни',
        'url'   => home_url( '/pryamye-kuhni/' ),
        'image' => 'catalog-pryamye.jpg',
    ),
    array(
        'slug'  => 'uglovye',
        'name'  => 'Угловые кухни',
        'url'   => home_url( '/uglovye-kuhni/' ),
        'image' => 'catalog-uglovye.jpg',
    ),
    array(
        'slug'  => 'p-obraznye',
        'name'  => 'П-образные кухни',
        'url'   => home_url( '/p-obraznye-kuhni/' ),
        'image' => 'catalog-p-obraznye.jpg',
    ),
);
?>

    <!-- ================================================================
         Block 1: Hero
         ================================================================ -->
    <section class="section section--dark hero" aria-label="Главный баннер">
        <div class="hero__overlay" aria-hidden="true"></div>
        <div class="container hero__inner">

            <?php if ( $promotions->have_posts() ) : ?>
                <?php while ( $promotions->have_posts() ) : $promotions->the_post(); ?>
                    <span class="badge badge--sale hero__badge">
                        <?php the_title(); ?>
                    </span>
                <?php endwhile; wp_reset_postdata(); ?>
            <?php endif; ?>

            <h1 class="hero__title">Кухня точно под ваши размеры — с точностью до сантиметра</h1>

            <p class="hero__subtitle">
                Собственное производство в Красноярске. Индивидуальный проект от&nbsp;63&nbsp;700&nbsp;&#8381;.
                Рассрочка без банка
            </p>

            <a href="#quiz-preview" class="btn btn--primary btn--lg hero__cta">
                Рассчитать стоимость за 2 минуты
            </a>
        </div>
    </section>


    <!-- ================================================================
         Block 2: Advantages
         ================================================================ -->
    <section class="section section--light advantages" aria-label="Преимущества">
        <div class="container">
            <div class="advantages__grid">

                <article class="card card--advantage">
                    <div class="card__body">
                        <div class="advantage__icon" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 42h36M12 42V18l12-12 12 12v24M20 30h8v12H20z"/>
                            </svg>
                        </div>
                        <h3 class="advantage__title">Шаг модуля — 1 сантиметр</h3>
                        <p class="advantage__text">Кухня идеально вписывается в ваше пространство</p>
                    </div>
                </article>

                <article class="card card--advantage">
                    <div class="card__body">
                        <div class="advantage__icon" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="24" cy="24" r="20"/>
                                <path d="M16 24l6 6 12-12"/>
                            </svg>
                        </div>
                        <h3 class="advantage__title">Фурнитура Blum и Hettich</h3>
                        <p class="advantage__text">Австрийские петли и ящики. Гарантия 20 лет</p>
                    </div>
                </article>

                <article class="card card--advantage">
                    <div class="card__body">
                        <div class="advantage__icon" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="6" y="10" width="36" height="28" rx="3"/>
                                <path d="M6 20h36M18 20v18"/>
                            </svg>
                        </div>
                        <h3 class="advantage__title">Честная цена на сайте</h3>
                        <p class="advantage__text">Цена на сайте = цена в договоре. Без скрытых доплат</p>
                    </div>
                </article>

            </div>
        </div>
    </section>


    <!-- ================================================================
         Block 3: Catalog Preview
         ================================================================ -->
    <section class="section section--surface catalog-preview" aria-label="Каталог кухонь">
        <div class="container">

            <div class="text-center mb-lg">
                <h2>Наши кухни</h2>
                <p class="catalog-preview__subtitle">
                    <?php echo esc_html( $total_kitchens ); ?> модели в 3 планировках
                </p>
            </div>

            <div class="catalog-preview__grid">
                <?php foreach ( $types as $type ) :
                    $min_price = kuhni_rema_get_min_price_by_type( $type['slug'] );
                    $term      = get_term_by( 'slug', $type['slug'], 'kitchen_type' );
                    $image_id  = $term ? get_field( 'kitchen_type_image', 'kitchen_type_' . $term->term_id ) : null;
                ?>
                    <a href="<?php echo esc_url( $type['url'] ); ?>" class="card card--kitchen catalog-preview__card">
                        <?php if ( $image_id ) : ?>
                            <?php echo wp_get_attachment_image( $image_id, 'medium_large', false, array( 'class' => 'card__image', 'loading' => 'lazy' ) ); ?>
                        <?php else : ?>
                            <img class="card__image"
                                 src="<?php echo esc_url( get_theme_file_uri( 'assets/img/' . $type['image'] ) ); ?>"
                                 alt="<?php echo esc_attr( $type['name'] ); ?>"
                                 loading="lazy"
                                 width="600" height="450">
                        <?php endif; ?>
                        <div class="card__body">
                            <h3 class="card__title"><?php echo esc_html( $type['name'] ); ?></h3>
                            <?php if ( $min_price ) : ?>
                                <span class="card__price">от <?php echo esc_html( kuhni_rema_format_price( $min_price ) ); ?></span>
                            <?php endif; ?>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>

        </div>
    </section>


    <!-- ================================================================
         Block 4: Quiz Preview
         ================================================================ -->
    <section class="section section--dark quiz-preview" id="quiz-preview" aria-label="Калькулятор стоимости">
        <div class="container text-center">

            <h2>Рассчитайте стоимость вашей кухни за 2 минуты</h2>
            <p class="quiz-preview__subtitle">
                Ответьте на 5 вопросов — мы подберём решение и назовём точную цену
            </p>

            <div class="quiz-preview__layouts">
                <?php
                $layouts = array(
                    array( 'name' => 'Прямая',     'icon' => 'layout-straight' ),
                    array( 'name' => 'Угловая',    'icon' => 'layout-corner' ),
                    array( 'name' => 'П-образная', 'icon' => 'layout-u-shape' ),
                );
                foreach ( $layouts as $layout ) : ?>
                    <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="quiz-preview__layout-card">
                        <img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/' . $layout['icon'] . '.svg' ) ); ?>"
                             alt="<?php echo esc_attr( $layout['name'] ); ?>"
                             class="quiz-preview__layout-icon"
                             width="120" height="80"
                             loading="lazy">
                        <span class="quiz-preview__layout-name"><?php echo esc_html( $layout['name'] ); ?></span>
                    </a>
                <?php endforeach; ?>
            </div>

            <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary btn--lg quiz-preview__cta">
                Начать расчёт
            </a>

            <p class="quiz-preview__disclaimer">
                Это бесплатно. Мы не звоним без вашего согласия
            </p>

        </div>
    </section>


    <!-- ================================================================
         Block 5: Portfolio Preview
         ================================================================ -->
    <section class="section section--light portfolio-preview" aria-label="Портфолио">
        <div class="container">

            <div class="text-center mb-lg">
                <h2>Наши работы</h2>
            </div>

            <?php
            $projects = new WP_Query( array(
                'post_type'      => 'project',
                'posts_per_page' => 6,
                'orderby'        => 'date',
                'order'          => 'DESC',
            ) );
            ?>

            <?php if ( $projects->have_posts() ) : ?>
                <div class="portfolio-preview__grid">
                    <?php while ( $projects->have_posts() ) : $projects->the_post(); ?>
                        <a href="<?php the_permalink(); ?>" class="card card--project">
                            <?php if ( has_post_thumbnail() ) : ?>
                                <?php the_post_thumbnail( 'medium_large', array(
                                    'class'   => 'card__image',
                                    'loading' => 'lazy',
                                ) ); ?>
                            <?php endif; ?>
                            <div class="card__body">
                                <h3 class="card__title"><?php the_title(); ?></h3>
                                <?php
                                $project_type = get_field( 'project_kitchen_type' );
                                if ( $project_type ) : ?>
                                    <span class="badge badge--new"><?php echo esc_html( $project_type ); ?></span>
                                <?php endif; ?>
                            </div>
                        </a>
                    <?php endwhile; wp_reset_postdata(); ?>
                </div>

                <div class="text-center" style="margin-top: var(--spacing-xl);">
                    <a href="<?php echo esc_url( home_url( '/portfolio/' ) ); ?>" class="btn btn--outline">
                        Смотреть все проекты &rarr;
                    </a>
                </div>
            <?php endif; ?>

        </div>
    </section>


    <!-- ================================================================
         Block 6: How We Work
         ================================================================ -->
    <section class="section section--surface how-we-work" aria-label="Как мы работаем">
        <div class="container">

            <div class="text-center mb-lg">
                <h2>Как мы работаем</h2>
            </div>

            <div class="how-we-work__steps">
                <?php
                $steps = array(
                    array(
                        'title' => 'Расчёт',
                        'text'  => 'Вы отвечаете на 5 вопросов — мы называем точную стоимость вашей кухни.',
                    ),
                    array(
                        'title' => 'Проект',
                        'text'  => 'Дизайнер создаёт 3D-проект с учётом ваших размеров и пожеланий.',
                    ),
                    array(
                        'title' => 'Производство',
                        'text'  => 'Изготавливаем кухню на собственном производстве в Красноярске за 25-30 дней.',
                    ),
                    array(
                        'title' => 'Доставка',
                        'text'  => 'Бережно доставляем в удобное для вас время по Красноярску и краю.',
                    ),
                    array(
                        'title' => 'Установка',
                        'text'  => 'Профессиональный монтаж за 1 день. Гарантия на установку — 2 года.',
                    ),
                );

                foreach ( $steps as $index => $step ) : ?>
                    <div class="how-we-work__step">
                        <span class="how-we-work__number" aria-hidden="true"><?php echo esc_html( $index + 1 ); ?></span>
                        <h3 class="how-we-work__step-title"><?php echo esc_html( $step['title'] ); ?></h3>
                        <p class="how-we-work__step-text"><?php echo esc_html( $step['text'] ); ?></p>
                    </div>
                <?php endforeach; ?>
            </div>

        </div>
    </section>


    <!-- ================================================================
         Block 7: Reviews
         ================================================================ -->
    <section class="section section--light reviews" aria-label="Отзывы клиентов">
        <div class="container">

            <div class="text-center mb-lg">
                <h2>Отзывы наших клиентов</h2>
                <?php
                $vk_count = kuhni_rema_option( 'social_vk_count' );
                if ( $vk_count ) : ?>
                    <p class="reviews__social-proof">
                        <?php echo esc_html( $vk_count ); ?> подписчиков VK
                    </p>
                <?php endif; ?>
            </div>

            <?php $reviews = kuhni_rema_get_reviews( 5 ); ?>

            <?php if ( $reviews->have_posts() ) : ?>
                <div class="reviews__grid">
                    <?php while ( $reviews->have_posts() ) : $reviews->the_post(); ?>
                        <article class="card card--review">
                            <div class="card__body">
                                <div class="review__header">
                                    <strong class="review__name"><?php the_title(); ?></strong>
                                    <?php
                                    $rating = get_field( 'review_rating' );
                                    if ( $rating ) {
                                        echo kuhni_rema_star_rating( $rating );
                                    }
                                    ?>
                                </div>

                                <div class="review__text">
                                    <?php echo wp_kses_post( wp_trim_words( get_field( 'review_text' ), 40, '&hellip;' ) ); ?>
                                </div>

                                <?php $source = get_field( 'review_source' ); ?>
                                <?php if ( $source ) : ?>
                                    <span class="badge badge--guarantee review__source"><?php echo esc_html( $source ); ?></span>
                                <?php endif; ?>
                            </div>
                        </article>
                    <?php endwhile; wp_reset_postdata(); ?>
                </div>
            <?php endif; ?>

        </div>
    </section>


    <!-- ================================================================
         Block 8: Installment
         ================================================================ -->
    <section class="section section--dark installment" aria-label="Рассрочка">
        <div class="container">
            <div class="installment__inner">

                <h2><?php echo esc_html( kuhni_rema_option( 'installment_title' ) ?: 'Рассрочка без банка' ); ?></h2>

                <?php $installment_desc = kuhni_rema_option( 'installment_description' ); ?>
                <?php if ( $installment_desc ) : ?>
                    <div class="installment__description">
                        <?php echo wp_kses_post( $installment_desc ); ?>
                    </div>
                <?php endif; ?>

                <div class="installment__details">
                    <?php $prepayment = kuhni_rema_option( 'installment_prepayment' ); ?>
                    <?php if ( $prepayment ) : ?>
                        <div class="installment__detail">
                            <span class="installment__detail-value"><?php echo esc_html( $prepayment ); ?></span>
                            <span class="installment__detail-label">предоплата</span>
                        </div>
                    <?php endif; ?>

                    <?php $period = kuhni_rema_option( 'installment_period' ); ?>
                    <?php if ( $period ) : ?>
                        <div class="installment__detail">
                            <span class="installment__detail-value"><?php echo esc_html( $period ); ?></span>
                            <span class="installment__detail-label">срок рассрочки</span>
                        </div>
                    <?php endif; ?>

                    <?php $bank = kuhni_rema_option( 'installment_bank' ); ?>
                    <div class="installment__detail">
                        <span class="installment__detail-value"><?php echo $bank ? 'Да' : 'Нет'; ?></span>
                        <span class="installment__detail-label">через банк</span>
                    </div>
                </div>

                <a href="<?php echo esc_url( home_url( '/kalkulyator/' ) ); ?>" class="btn btn--primary btn--lg installment__cta">
                    Подробнее
                </a>

                <?php $fine_print = kuhni_rema_option( 'installment_fine_print' ); ?>
                <?php if ( $fine_print ) : ?>
                    <p class="installment__fine-print"><?php echo esc_html( $fine_print ); ?></p>
                <?php endif; ?>

            </div>
        </div>
    </section>


    <!-- ================================================================
         Block 9: Partners
         ================================================================ -->
    <section class="section section--surface partners" aria-label="Партнёры">
        <div class="container text-center">

            <h2 class="mb-md">Наши партнёры</h2>
            <p class="partners__subtitle mb-lg">Работаем только с проверенными производителями</p>

            <?php $logos = kuhni_rema_option( 'partners_logos' ); ?>
            <?php if ( $logos ) : ?>
                <div class="partners__logos">
                    <?php foreach ( $logos as $partner ) : ?>
                        <?php if ( ! empty( $partner['logo'] ) ) : ?>
                            <figure class="partners__logo-item">
                                <?php if ( ! empty( $partner['url'] ) ) : ?>
                                    <a href="<?php echo esc_url( $partner['url'] ); ?>" target="_blank" rel="noopener noreferrer">
                                <?php endif; ?>

                                <img src="<?php echo esc_url( $partner['logo']['url'] ); ?>"
                                     alt="<?php echo esc_attr( $partner['name'] ?? '' ); ?>"
                                     width="160" height="80"
                                     loading="lazy"
                                     class="partners__logo">

                                <?php if ( ! empty( $partner['url'] ) ) : ?>
                                    </a>
                                <?php endif; ?>
                            </figure>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

        </div>
    </section>


    <!-- ================================================================
         Block 10: Final CTA — Форма записи на замер
         ================================================================ -->
    <section class="section section--dark final-cta" aria-label="Запись на замер">
        <div class="container text-center">

            <h2>Готовы начать? Запишитесь на бесплатный замер</h2>
            <p class="final-cta__subtitle" style="color: rgba(255,255,255,0.8); margin-bottom: var(--spacing-lg);">
                Дизайнер приедет, измерит кухню и составит 3D-проект. Это бесплатно и ни к чему не обязывает
            </p>

            <form class="final-cta__form" data-kuhni-form="zamer" data-form-type="zamer" novalidate>
                <div class="form-group">
                    <label for="final-cta-name" class="form-label">Ваше имя</label>
                    <input type="text" id="final-cta-name" name="name" class="form-input" placeholder="Как к вам обращаться?" autocomplete="given-name">
                </div>

                <div class="form-group">
                    <label for="final-cta-phone" class="form-label">Телефон <span aria-hidden="true">*</span></label>
                    <input type="tel" id="final-cta-phone" name="phone" class="form-input" data-phone-mask placeholder="+7 (___) ___-__-__" required autocomplete="tel">
                </div>

                <div class="form-group">
                    <label for="final-cta-time" class="form-label">Удобное время</label>
                    <select id="final-cta-time" name="preferred_time" class="form-select">
                        <option value="">Выберите время</option>
                        <option value="morning">Утро (10:00–13:00)</option>
                        <option value="afternoon">День (13:00–17:00)</option>
                        <option value="evening">Вечер (17:00–20:00)</option>
                        <option value="weekend">Выходные</option>
                    </select>
                </div>

                <button type="submit" class="btn btn--primary btn--lg btn--full">
                    Вызвать замерщика бесплатно
                </button>

                <p class="final-cta__privacy">
                    Нажимая кнопку, вы соглашаетесь с
                    <a href="<?php echo esc_url( home_url( '/politika-konfidencialnosti/' ) ); ?>">политикой конфиденциальности</a>
                </p>
            </form>

            <?php if ( $phone ) : ?>
                <div class="final-cta__or" style="margin-top: var(--spacing-xl); color: rgba(255,255,255,0.5); font-size: var(--font-size-body-sm);">
                    Или позвоните:
                    <a href="<?php echo esc_url( kuhni_rema_phone_link( $phone ) ); ?>" style="color: var(--color-primary);">
                        <?php echo esc_html( $phone ); ?>
                    </a>
                </div>
            <?php endif; ?>

        </div>
    </section>

<?php get_footer(); ?>
