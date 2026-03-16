# IMPLEMENTATION BACKLOG — кухнирема.рф

**Дата заморозки:** 2026-03-16

---

## Фаза 4A: Каркас проекта (ТЕКУЩАЯ)

| # | Задача | Файлы | Статус |
|---|--------|-------|--------|
| 4A-01 | WordPress-основа: functions.php, style.css (Bricks child) | functions.php, style.css | DONE |
| 4A-02 | Design tokens CSS (цвета, типографика, spacing) | assets/css/design-tokens.css | DONE |
| 4A-03 | Base CSS (reset, typography, layout, sections) | assets/css/base.css | DONE |
| 4A-04 | Components CSS (buttons, cards, forms, badges, CTA) | assets/css/components.css | DONE |
| 4A-05 | Responsive CSS (mobile-first breakpoints) | assets/css/responsive.css | DONE |
| 4A-06 | 6 CPT с ACF-полями | inc/cpt-*.php (6 файлов) | DONE |
| 4A-07 | ACF Options Pages (6 страниц настроек) | inc/acf-options.php | DONE |
| 4A-08 | Admin roles (Content Manager) | inc/admin-roles.php | DONE |
| 4A-09 | Helper functions (12 функций) | inc/helpers.php | DONE |
| 4A-10 | Header (sticky, бургер-меню, CTA) | templates/header.php | DONE |
| 4A-11 | Header minimal (для quiz/thanks) | templates/header-minimal.php | DONE |
| 4A-12 | Footer (4 колонки, аккордеон мобайл) | templates/footer.php | DONE |
| 4A-13 | Sticky CTA (мобайл) | templates/cta-sticky.php | DONE |
| 4A-14 | Breadcrumbs | templates/breadcrumbs.php | DONE |
| 4A-15 | SEO Schema (Organization, Product, FAQ) | inc/seo-schema.php | DONE |
| 4A-16 | SEO Meta (OG, preconnect) | inc/seo-meta.php | DONE |
| 4A-17 | main.js (menu, sticky header, scroll, CTA) | assets/js/main.js | DONE |
| 4A-18 | forms.js (AJAX, маска, webhook) | assets/js/forms.js | DONE |
| 4A-19 | quiz.js (4 шага) | assets/js/quiz.js | DONE |
| 4A-20 | analytics.js (Метрика цели) | assets/js/analytics.js | DONE |
| 4A-21 | assets/img/.gitkeep | assets/img/.gitkeep | DONE |

---

## Фаза 4B: Сборка страниц

| # | Задача | Шаблон | Статус |
|---|--------|--------|--------|
| 4B-01 | Главная (10 блоков) | page-home.php | SCAFFOLD |
| 4B-02 | Каталог категории (3 страницы) | page-catalog.php | SCAFFOLD |
| 4B-03 | Детальная карточка кухни | single-kitchen.php | SCAFFOLD |
| 4B-04 | Контакты (карта, форма) | page-contacts.php | SCAFFOLD |
| 4B-05 | О компании (команда, производство) | page-about.php | SCAFFOLD |
| 4B-06 | Портфолио (архив проектов) | page-portfolio.php | SCAFFOLD |
| 4B-07 | Проект (single project) | single-project.php | SCAFFOLD |
| 4B-08 | Отзывы | page-reviews.php | SCAFFOLD |
| 4B-09 | Квиз полная страница | page-quiz.php | SCAFFOLD |
| 4B-10 | FAQ аккордеон | page-faq.php | SCAFFOLD |
| 4B-11 | Спасибо | page-thanks.php | SCAFFOLD |
| 4B-12 | Политика конфиденциальности | page-privacy.php | SCAFFOLD |
| 4B-13 | AJAX-фильтрация каталога | js + PHP endpoint | TODO |
| 4B-14 | "Недавно просмотренные" UI | компонент | TODO |
| 4B-15 | Лайтбокс галерея | js компонент | TODO |

**SCAFFOLD** = шаблон создан с секциями и вызовами ACF, но не привязан к реальному контенту Bricks.

---

## Фаза 4C: Интеграции и контент

| # | Задача | Статус |
|---|--------|--------|
| 4C-01 | Загрузка 42 моделей в CPT Kitchen | TODO |
| 4C-02 | Создание 10-15 проектов для портфолио | TODO |
| 4C-03 | Настройка n8n webhooks для форм | TODO |
| 4C-04 | RankMath Pro — meta-теги, sitemap | TODO |
| 4C-05 | Яндекс Метрика — 12 целей | TODO |
| 4C-06 | Реальные отзывы из 2ГИС/Flamp | TODO |
| 4C-07 | FAQ контент (15+ вопросов) | TODO |
| 4C-08 | Попап квиза по времени (45 сек) | TODO |
| 4C-09 | Ecommerce dataLayer | TODO |

---

## Фаза 5: Деплой

| # | Задача | Статус |
|---|--------|--------|
| 5-01 | WordPress + Bricks на хостинг | TODO |
| 5-02 | DNS кухнирема.рф → VPS | TODO |
| 5-03 | SSL Let's Encrypt | TODO |
| 5-04 | Импорт шаблонов в Bricks Builder | TODO |
| 5-05 | robots.txt, sitemap.xml | TODO |
| 5-06 | 301 редиректы .htaccess | TODO |
| 5-07 | Яндекс.Бизнес + Google Business Profile | TODO |
| 5-08 | 2ГИС обновление карточки | TODO |
| 5-09 | PageSpeed тестирование | TODO |
| 5-10 | Smoke-тест всех страниц и форм | TODO |

---

## Фаза 6: Пост-запуск

| # | Задача | Когда | Статус |
|---|--------|-------|--------|
| 6-01 | SEO-посадочные (мдф, лофт, замер, рассрочка) | мес 1-2 | TODO |
| 6-02 | Блог — 10 статей | мес 3-6 | TODO |
| 6-03 | A/B тест CTA-текстов | мес 1-2 | TODO |
| 6-04 | Архивы таксономий (стиль, материал) | мес 2-3 | TODO |
| 6-05 | Яндекс.Вебмастер + Google Search Console | неделя 1 | TODO |
| 6-06 | Стратегия отзывов (SMS после установки) | мес 1 | TODO |

---

## Счётчики

| Метрика | Значение |
|---------|----------|
| Всего задач | 58 |
| Фаза 4A (каркас) | 21 DONE |
| Фаза 4B (страницы) | 12 SCAFFOLD, 3 TODO |
| Фаза 4C (интеграции) | 9 TODO |
| Фаза 5 (деплой) | 10 TODO |
| Фаза 6 (пост-запуск) | 6 TODO |
