<?php
/**
 * Template Name: Квиз-калькулятор
 *
 * Full-page quiz calculator at /kalkulyator/.
 * Minimal header (logo + phone), no sticky CTA, minimal footer.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$logo_text  = kuhni_rema_option( 'global_logo_text' ) ?: get_bloginfo( 'name' );
$phone      = kuhni_rema_option( 'global_phone_main' );
$phone_link = $phone ? kuhni_rema_phone_link( $phone ) : '';
$vk_url     = kuhni_rema_option( 'social_vk_url' );

get_header( 'minimal' );
?>

<!--- Minimal Header (logo + phone) -->
<header class="site-header site-header--minimal" role="banner">
    <div class="container header__container">

        <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header__logo" aria-label="<?php echo esc_attr( $logo_text ); ?> — на главную">
            <?php echo esc_html( $logo_text ); ?>
        </a>

        <?php if ( $phone ) : ?>
            <a href="<?php echo esc_url( $phone_link ); ?>" class="header__phone" aria-label="Позвонить: <?php echo esc_attr( $phone ); ?>">
                <?php echo esc_html( $phone ); ?>
            </a>
        <?php endif; ?>

    </div>
</header>

<main class="quiz-page" id="main-content">
    <div class="container">

        <!-- Heading -->
        <div class="quiz-page__heading">
            <h1 class="quiz-page__title">Рассчитайте стоимость вашей кухни</h1>
            <p class="quiz-page__subtitle">Ответьте на 4 вопроса — мы подберём решение и назовём точную цену</p>
        </div>

        <!-- Quiz Container -->
        <div class="quiz" id="quiz">

            <!-- Progress Bar -->
            <div class="quiz__progress">
                <div class="quiz__progress-fill" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <div class="quiz__progress-text">Шаг 1 из 4</div>

            <!-- Step 1: Layout Type -->
            <div class="quiz__step" data-step="1">
                <h2 class="quiz__step-title">Какая планировка вам нужна?</h2>
                <div class="quiz__options" role="radiogroup" aria-label="Тип планировки">
                    <div class="quiz__option">
                        <input type="radio" name="quiz_layout" value="straight" id="layout-straight" class="quiz__radio">
                        <label for="layout-straight" class="quiz__option-label">Прямая</label>
                    </div>
                    <div class="quiz__option">
                        <input type="radio" name="quiz_layout" value="corner" id="layout-corner" class="quiz__radio">
                        <label for="layout-corner" class="quiz__option-label">Угловая</label>
                    </div>
                    <div class="quiz__option">
                        <input type="radio" name="quiz_layout" value="u-shaped" id="layout-u" class="quiz__radio">
                        <label for="layout-u" class="quiz__option-label">П-образная</label>
                    </div>
                </div>
            </div>

            <!-- Step 2: Dimensions -->
            <div class="quiz__step" data-step="2">
                <h2 class="quiz__step-title">Укажите размеры кухни</h2>
                <div class="quiz__fields">
                    <div class="quiz__field">
                        <label for="quiz-width" class="quiz__field-label">Длина стены (м) *</label>
                        <input type="number" name="quiz_width" id="quiz-width" class="quiz__input" min="1" max="10" step="0.1" placeholder="3.2">
                    </div>
                    <div class="quiz__field">
                        <label for="quiz-depth" class="quiz__field-label">Глубина (м)</label>
                        <input type="number" name="quiz_depth" id="quiz-depth" class="quiz__input" min="0.3" max="3" step="0.1" placeholder="0.6">
                    </div>
                    <div class="quiz__field">
                        <label for="quiz-height" class="quiz__field-label">Высота до потолка (м)</label>
                        <input type="number" name="quiz_height" id="quiz-height" class="quiz__input" min="2" max="4" step="0.1" placeholder="2.7">
                    </div>
                </div>
            </div>

            <!-- Step 3: Contact Method -->
            <div class="quiz__step" data-step="3">
                <h2 class="quiz__step-title">Как вам удобнее получить расчёт?</h2>
                <div class="quiz__options" role="radiogroup" aria-label="Способ связи">
                    <div class="quiz__option">
                        <input type="radio" name="quiz_contact_method" value="phone" id="contact-phone" class="quiz__radio">
                        <label for="contact-phone" class="quiz__option-label">Телефон</label>
                    </div>
                    <div class="quiz__option">
                        <input type="radio" name="quiz_contact_method" value="whatsapp" id="contact-whatsapp" class="quiz__radio">
                        <label for="contact-whatsapp" class="quiz__option-label">WhatsApp</label>
                    </div>
                    <div class="quiz__option">
                        <input type="radio" name="quiz_contact_method" value="telegram" id="contact-telegram" class="quiz__radio">
                        <label for="contact-telegram" class="quiz__option-label">Telegram</label>
                    </div>
                </div>
            </div>

            <!-- Step 4: Contact Details -->
            <div class="quiz__step" data-step="4">
                <h2 class="quiz__step-title">Оставьте контакты для расчёта</h2>
                <div class="quiz__fields">
                    <div class="quiz__field">
                        <label for="quiz-name" class="quiz__field-label">Ваше имя</label>
                        <input type="text" name="quiz_name" id="quiz-name" class="quiz__input" placeholder="Иван">
                    </div>
                    <div class="quiz__field">
                        <label for="quiz-phone" class="quiz__field-label">Телефон *</label>
                        <input type="tel" name="quiz_phone" id="quiz-phone" class="quiz__input" placeholder="+7 (___) ___-__-__">
                    </div>
                </div>
            </div>

            <!-- Navigation -->
            <div class="quiz__nav">
                <button class="btn btn--outline quiz__prev" type="button">Назад</button>
                <button class="btn btn--primary quiz__next" type="button">Далее</button>
            </div>

        </div><!-- .quiz -->

        <!-- Trust Block -->
        <div class="quiz-page__trust">
            <p class="quiz-page__trust-text">Бесплатно. Без обязательств. Мы не звоним без вашего согласия</p>

            <div class="quiz-page__trust-badges">
                <span class="quiz-page__badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.19 1.362 1.26 2.174 1.817.613.42 1.08.328 1.08.328l2.172-.03s1.136-.07.597-.964c-.044-.073-.314-.661-1.618-1.869-1.366-1.265-1.183-1.06.462-3.248.998-1.33 1.398-2.143 1.273-2.49-.12-.331-.858-.244-.858-.244l-2.446.015s-.181-.025-.316.056c-.131.079-.216.263-.216.263s-.389 1.035-.906 1.914c-1.092 1.855-1.529 1.953-1.708 1.838-.416-.267-.312-1.075-.312-1.648 0-1.79.272-2.537-.529-2.73-.266-.064-.462-.106-1.142-.113-.872-.009-1.61.003-2.028.207-.278.136-.493.439-.362.456.161.022.527.099.72.362.25.34.24 1.104.24 1.104s.145 2.106-.332 2.368c-.328.18-.776-.187-1.74-1.868-.493-.86-.867-1.813-.867-1.813s-.072-.176-.2-.27c-.155-.115-.372-.151-.372-.151l-2.323.015s-.348.01-.476.161c-.114.135-.009.413-.009.413s1.83 4.282 3.902 6.442c1.9 1.98 4.057 1.85 4.057 1.85h.978z"/>
                    </svg>
                    13 017 подписчиков VK
                </span>
                <span class="quiz-page__badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Гарантия 24 мес
                </span>
                <span class="quiz-page__badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Blum и Hettich
                </span>
            </div>
        </div>

    </div><!-- .container -->
</main>

<!-- Minimal Footer -->
<footer class="footer footer--minimal">
    <div class="container">
        <div class="footer__bottom-inner">
            <p class="footer__copyright">&copy; <?php echo esc_html( date( 'Y' ) ); ?> Кухни Рема. Красноярск</p>
            <?php if ( $phone ) : ?>
                <a href="<?php echo esc_url( $phone_link ); ?>" class="footer__phone">
                    <?php echo esc_html( $phone ); ?>
                </a>
            <?php endif; ?>
        </div>
    </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
