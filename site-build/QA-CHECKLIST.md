# QA CHECKLIST — кухнирема.рф

**Дата заморозки:** 2026-03-16

---

## Фаза 4A: Каркас (самопроверка)

### WordPress-основа

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 1 | style.css — корректный Theme Name, Template: bricks | PASS | Bricks child theme |
| 2 | functions.php — enqueue CSS в правильном порядке | PASS | tokens → base → components → responsive |
| 3 | functions.php — enqueue JS с defer/footer | PASS | main, forms, quiz (conditional), analytics |
| 4 | functions.php — 5 image sizes зарегистрированы | PASS | card, detail, hero, thumb, micro |
| 5 | functions.php — 3 nav menus зарегистрированы | PASS | primary, footer, catalog |
| 6 | functions.php — WordPress bloat удалён | PASS | emoji, embed, REST link, RSD, generator |
| 7 | functions.php — WebP upload поддержка | PASS | mime types |
| 8 | functions.php — AJAX handler для форм | PASS | wp_ajax_kuhni_rema_form |

### CSS

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 9 | design-tokens.css — все переменные определены | PASS | Цвета, типографика, spacing, shadows, z-index |
| 10 | base.css — CSS reset, типографика, grid | PASS | 12-column grid |
| 11 | components.css — кнопки (4 типа), карточки (6), формы, бейджи | PASS | |
| 12 | responsive.css — mobile-first breakpoints | PASS | 768px, 1024px |
| 13 | Цвета соответствуют brand-guide | PASS | #C2613A primary, #3D6B5E secondary |
| 14 | Шрифты: Montserrat (заголовки), Inter (текст) | PASS | Google Fonts в functions.php |

### CPT и ACF

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 15 | CPT Kitchen — 14 ACF полей, 3 таксономии | PASS | cpt-kitchen.php |
| 16 | CPT Project — 10 ACF полей | PASS | cpt-project.php |
| 17 | CPT Review — 10 ACF полей | PASS | cpt-review.php |
| 18 | CPT Team — 4 ACF поля, publicly_queryable false | PASS | cpt-team.php |
| 19 | CPT Promotion — 8 ACF полей | PASS | cpt-promotion.php |
| 20 | CPT FAQ — 3 ACF поля | PASS | cpt-faq.php |
| 21 | ACF Options — 6 страниц настроек | PASS | acf-options.php |
| 22 | kuhni_rema_option() helper работает | PASS | helpers.php |

### Глобальные компоненты

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 23 | Header — sticky, бургер-меню, телефон, CTA | PASS | header.php |
| 24 | Header minimal — для quiz/thanks | PASS | header-minimal.php |
| 25 | Footer — 4 колонки, аккордеон мобайл, соцсети | PASS | footer.php |
| 26 | Sticky CTA — мобайл, скрыт на quiz/thanks | PASS | cta-sticky.php |
| 27 | Breadcrumbs — семантические | PASS | breadcrumbs.php |

### JavaScript

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 28 | main.js — мобильное меню (open/close/escape) | PASS | |
| 29 | main.js — sticky header (100px scroll) | PASS | |
| 30 | main.js — smooth scroll с offset | PASS | |
| 31 | main.js — sticky CTA (600px scroll) | PASS | |
| 32 | main.js — recently viewed (localStorage) | PASS | |
| 33 | main.js — footer аккордеон | PASS | |
| 34 | forms.js — AJAX отправка | PASS | |
| 35 | forms.js — маска телефона | PASS | |
| 36 | forms.js — webhook fallback | PASS | |
| 37 | quiz.js — 4 шага логика | PASS | |
| 38 | analytics.js — Метрика цели | PASS | |

### SEO

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 39 | seo-schema.php — Organization JSON-LD | PASS | |
| 40 | seo-schema.php — Product JSON-LD (single-kitchen) | PASS | |
| 41 | seo-schema.php — FAQPage JSON-LD | PASS | |
| 42 | seo-meta.php — OG теги | PASS | |
| 43 | seo-meta.php — preconnect (fonts, metrika) | PASS | |
| 44 | robots.txt готов | PASS | seo/robots.txt |
| 45 | htaccess-redirects.conf готов | PASS | seo/htaccess-redirects.conf |
| 46 | meta-tags.json — шаблоны для всех страниц | PASS | seo/meta-tags.json |
| 47 | rankmath-settings.json — конфигурация | PASS | seo/rankmath-settings.json |

### Роли и админка

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 48 | Content Manager — доступ к 6 CPT | PASS | admin-roles.php |
| 49 | Content Manager — нет доступа к плагинам/темам | PASS | |
| 50 | Кастомный дашборд | PASS | admin-roles.php |

### PHP Lint

| # | Проверка | Статус | Примечание |
|---|----------|--------|------------|
| 51 | Все PHP файлы — без синтаксических ошибок | PASS | 37 файлов проверены |

---

## Фаза 4B: Проверки (будущие)

| # | Проверка | Статус |
|---|----------|--------|
| B-01 | Все страницы рендерятся без ошибок | PENDING |
| B-02 | Формы отправляются через AJAX | PENDING |
| B-03 | Квиз проходится от начала до конца | PENDING |
| B-04 | Мобильная версия — все кнопки >= 48px | PENDING |
| B-05 | Галерея фото — лайтбокс работает | PENDING |
| B-06 | Хлебные крошки — корректная структура | PENDING |
| B-07 | Schema.org — валидация через Google Rich Results Test | PENDING |
| B-08 | Все ссылки — корректные (нет 404) | PENDING |
| B-09 | WCAG AA контраст (4.5:1) на всех текстах | PENDING |
| B-10 | PageSpeed Mobile >= 80 | PENDING |

---

## Итог фазы 4A

| Метрика | Значение |
|---------|----------|
| Проверок проведено | 51 |
| PASS | 51 |
| FAIL | 0 |
| Файлов в теме | 37 |
| Строк кода | ~7 800 |
| CPT | 6 |
| ACF Options Pages | 6 |
| CSS файлов | 4 |
| JS файлов | 4 |
| PHP шаблонов | 16 |
| PHP includes | 11 |
