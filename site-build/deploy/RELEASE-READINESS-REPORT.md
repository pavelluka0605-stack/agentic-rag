# Release Readiness Report — кухнирема.рф RC-1.0.0

**Дата:** 2026-03-17
**Версия:** RC-1.0.0
**Метод QA:** Статический аудит (PHP lint, security audit, cross-reference, CSS/JS, deploy scripts)
**Среда тестирования:** Локальная (без VPS staging)

---

## 1. Результаты QA

### 1.1. PHP Lint

| Метрика | Результат |
|---------|-----------|
| Файлов проверено | 35 |
| Синтаксических ошибок | 0 |
| **Статус** | **PASS** |

### 1.2. Security Audit

| Метрика | Результат |
|---------|-----------|
| SQL Injection | 0 — $wpdb не используется напрямую |
| CSRF | 0 — nonce корректно |
| XSS | 1 P1 (исправлен), 1 P2, 3 P3 |
| File Inclusion | 0 — только KUHNI_REMA_DIR + hardcoded paths |
| Direct Access Guards | 10 шаблонов без ABSPATH guard (P3, неэксплуатируемо) |
| AJAX Handler | PASS — nonce, sanitize, wp_send_json |
| **Статус** | **PASS (после исправлений)** |

### 1.3. Cross-Reference Integrity

| Метрика | Результат |
|---------|-----------|
| require_once references | Все 11 файлов существуют |
| CSS/JS enqueue | Все 13 asset-файлов существуют по указанным путям |
| ACF field consistency | OK — CPT определения совпадают с использованием |
| Menus (3 зарег.) | Используются в header.php, footer.php |
| Image sizes (5 зарег.) | Используются в templates |
| Page templates | 12 шаблонов, все с правильной иерархией |
| **Статус** | **PASS** |

### 1.4. CSS/JS Validation

| Метрика | Результат |
|---------|-----------|
| CSS custom properties | Все var(--xxx) определены в design-tokens.css |
| JS IIFE scoping | Все файлы обёрнуты в IIFE, нет глобального загрязнения |
| AJAX nonce | Корректно через wp_localize_script |
| console.log | 0 — нет debug statements |
| ES5 совместимость | main.js имел `let` (P1, исправлен) |
| quiz-popup.js fallback colors | Не совпадали с design tokens (P1, исправлены) |
| CSS `--font-size-xs` | Использовался в 4 файлах, не был определён (P1, исправлен) |
| Quiz page-quiz.php | Пустой контейнер `.quiz__steps`, неверные селекторы — квиз не работал (P0, исправлен) |
| **Статус** | **PASS (после исправлений)** |

### 1.5. Deploy Scripts

| Метрика | Результат |
|---------|-----------|
| install-wordpress.sh | set -euo pipefail, идемпотентный, pre-flight checks |
| wp-setup.sh | Путь был `/var/www/kuhni-rema` вместо `/var/www/kuhnirema` (P0, исправлен) |
| smoke-test.sh | Redirect тесты предполагали mebelit.site → main domain (P1, исправлен) |
| nginx-kuhnirema.conf | Полный: SSL, gzip, security headers, rate limiting, HSTS |
| nginx static location | `add_header` в location блоке перезаписывал server-level security headers (P1, исправлен) |
| **Статус** | **PASS (после исправлений)** |

---

## 2. Обнаруженные дефекты

### Исправлены (P0 + P1)

| ID | Severity | Файл | Описание | Статус |
|----|----------|------|----------|--------|
| P0-001 | **P0** | `wp-setup.sh:16` | Путь `/var/www/kuhni-rema` не совпадает с install-wordpress.sh `/var/www/kuhnirema` — WordPress не нашёл бы установку | **FIXED** |
| P1-001 | **P1** | `install-wordpress.sh:374` | DATA_DIR указывал на `site-build/data/` (не существует), вместо `site-build/wordpress/theme/data/` — импорт данных пропускался | **FIXED** |
| P1-002 | **P1** | `seo-meta.php:149` | `$_SERVER['REQUEST_URI']` без санитизации в OG URL — потенциальный reflected XSS | **FIXED** |
| P1-003 | **P1** | `quiz-popup.js:114,128,133` | CSS fallback цвета `#E65100` / `#BF360C` не совпадали с design tokens `#C2613A` / `#A8512F` — визуальное расхождение | **FIXED** |
| P1-004 | **P1** | `smoke-test.sh:249-250` | Redirect тесты `/straight` → `/pryamye-kuhni/` работают только для mebelit.site nginx block, падали на основном домене | **FIXED** |
| P1-005 | **P1** | `main.js:13` | Использование `let` (ES6) вместо `var` — несовместимо со старыми браузерами (77% трафика — мобильные) | **FIXED** |
| P0-002 | **P0** | `templates/single-kitchen.php`, `templates/single-project.php`, `templates/archive-kitchen.php` | Файлы template hierarchy в `templates/` — WordPress их НЕ загружает из подпапок. Кухни/проекты показывали бы generic Bricks content. Перемещены в корень темы | **FIXED** |
| P1-006 | **P1** | `templates/header-minimal.php` | `get_header('minimal')` ищет в корне темы, файл был в `templates/`. Перемещён | **FIXED** |
| P1-007 | **P1** | `acf-options.php` | ACF поля `global_company_name`, `global_company_inn`, `global_company_ogrn` не зарегистрированы — страница политики конфиденциальности без обязательных данных оператора (152-ФЗ). Зарегистрированы | **FIXED** |
| P1-008 | **P1** | `acf-options.php` | ACF поле `analytics_ym_counter_id` не зарегистрировано — конверсии на странице «Спасибо» не отслеживались. Зарегистрировано | **FIXED** |
| P1-009 | **P1** | `seo-schema.php:278-279` | `kitchen_facade_material` и `kitchen_type` читались как ACF поля, но это таксономии. Schema.org Product material/category были пустыми. Исправлено на `wp_get_post_terms()` | **FIXED** |
| P1-010 | **P1** | `rankmath-config.php:304` | Неверное имя поля `contacts_phone` вместо `global_phone_main`. Телефон в RankMath Organization schema был пустым | **FIXED** |
| P1-011 | **P1** | `page-faq.php:28` | Неверное имя поля `social_whatsapp_phone` вместо `global_whatsapp`. WhatsApp CTA на FAQ не работал | **FIXED** |
| P0-003 | **P0** | `page-quiz.php` | Квиз полностью нефункционален: пустой `.quiz__steps` контейнер, неверные классы кнопок (`.quiz__nav-prev` вместо `.quiz__prev`), неверный класс прогресс-бара (`.quiz__progress-bar` вместо `.quiz__progress-fill`). JS не находил элементы — квиз не работал | **FIXED** |
| P1-012 | **P1** | `design-tokens.css` | CSS custom property `--font-size-xs` использовалась в 4 CSS файлах но не была определена — текст элементов получал `unset` | **FIXED** |
| P1-013 | **P1** | `nginx-kuhnirema.conf:177-188` | Nginx `add_header` в static files location block перезаписывал server-level security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS) — статические файлы отдавались без security headers | **FIXED** |
| P0-004 | **P0** | `single-kitchen.php`, `datalayer.js`, `main.js` | `data-kitchen-id` никогда не устанавливался на `<body>` — ecommerce tracking (detail view, add-to-cart) и «Недавно просмотренные» не работали. Добавлен через `wp_body_open` | **FIXED** |
| P0-005 | **P0** | `seo-schema.php` + `rankmath-config.php` | Дублирующиеся Schema.org Organization + LocalBusiness (тема + RankMath) — Google Search Console конфликт. Тема-схема теперь пропускается при активном RankMath | **FIXED** |
| P0-006 | **P0** | 5 шаблонов с breadcrumbs | RankMath breadcrumbs отключены в rankmath-config.php, но шаблоны вызывали `rank_math_the_breadcrumbs()` — пустые хлебные крошки. Заменено на custom breadcrumbs | **FIXED** |
| P1-014 | **P1** | `main.js:259`, `footer.php` | Footer accordion JS искал `.footer__accordion-toggle`, HTML использует `[data-accordion]` на `<h4>` — мобильный аккордион футера не работал | **FIXED** |
| P1-015 | **P1** | `page-home.php:460` | Форма замера без `data-form-type="zamer"` — leads маршрутизировались на `webhook/quick-lead` вместо `webhook/zamer-lead` | **FIXED** |

### Оставшиеся (P2 + P3 — не блокируют релиз)

| ID | Severity | Файл | Описание |
|----|----------|------|----------|
| P2-001 | P2 | `helpers.php:37-43` | ACF price field echoed без explicit esc_html() — риск минимален (number_format на numeric field) |
| P2-002 | P2 | `seo-meta.php`, `rankmath-config.php` | `yandex_verification`, `google_verification`, `og_default_image` не зарегистрированы в ACF — работают через wp_options fallback |
| P2-003 | P2 | `quiz-popup.js` | `SUBMITTED_KEY` ('kuhni_form_submitted') проверяется в sessionStorage, но forms.js не устанавливает его после успешной отправки — повторная защита не работает |
| P2-004 | P2 | `analytics.js` | Селектор `.catalog-filter` не совпадает с `.catalog-filters` в catalog.css — трекинг фильтров не сработает |
| P2-005 | P2 | Несколько CSS файлов | Hardcoded rgba() цвета (rgba(194,97,58,...)) вместо calc от var(--color-primary) — при смене палитры потребуется ручная замена |
| P3-001 | P3 | 10 template files | Отсутствует `defined('ABSPATH') \|\| exit` guard — неэксплуатируемо, т.к. шаблоны вызывают get_header() |
| P3-002 | P3 | `helpers.php:193` | `aria-label` без esc_attr() — intval() уже санитизирует |
| P3-003 | P3 | `admin-roles.php:101-107` | admin_url() без esc_url() — admin-only context |
| P3-004 | P3 | `cpt-kitchen.php:315-316` | number_format() в admin column без esc_html() — admin-only |
| P3-005 | P3 | `functions.php:227` | Image size `kitchen-micro` зарегистрирован но не используется |
| P3-006 | P3 | `functions.php:232-233` | Menu locations `footer` и `catalog` зарегистрированы но не используются в шаблонах |
| P3-007 | P3 | `page-home.php:137` | ACF field `kitchen_type_image` для таксономии не зарегистрирован |

---

## 3. Что не проверено (требует VPS staging)

| Проверка | Причина |
|----------|---------|
| Загрузка страниц в браузере | Нет доступа к VPS |
| Формы и квиз end-to-end | Требуется работающий WordPress |
| Мобильная адаптивность | Нужен браузер/DevTools |
| Яндекс Метрика goals | Нужен живой сайт |
| PageSpeed / TTFB | Нужен живой сайт |
| SSL / HTTPS redirect | Нужен certbot на VPS |
| Bricks Builder визуальный импорт | Ручной процесс |
| N8N webhook интеграция | Нужны боевые endpoints |

---

## 4. Вердикт

### Можно ли выпускать в production?

**Условный ДА** — при выполнении обязательных условий ниже.

Код статически валиден:
- 0 PHP syntax errors (35 файлов проверены)
- 0 P0/P1 дефектов (6 P0 + 15 P1 = 21 дефект обнаружен и исправлен)
- Security audit пройден
- Deploy scripts корректны (пути, nginx, SSL, permissions)
- Оставшиеся дефекты: 5 P2, 7 P3 — не блокируют запуск

### Обязательные условия перед production

1. **Staging deploy на VPS** — запустить `install-wordpress.sh`, проверить что WordPress работает
2. **Smoke test** — `./smoke-test.sh` должен дать 0 FAIL
3. **Визуальная проверка** — заказчик одобряет десктоп + мобильную версию
4. **Формы** — тестовая отправка callback/zamer/quiz → Telegram
5. **Premium плагины** — Bricks Builder, ACF Pro, RankMath Pro загружены и активированы
6. **DNS** — A-запись кухнирема.рф → VPS IP
7. **SSL** — certbot для кухнирема.рф + www

---

## 5. Рекомендации

1. Развернуть staging по `STAGING-PLAN.md` (вариант A: IP:8080)
2. Пройти QA-RELEASE-CHECKLIST.md на staging
3. Получить одобрение заказчика
4. Использовать PRODUCTION-CUTOVER-CHECKLIST.md для перехода
5. P2/P3 дефекты — исправить в следующей итерации (не блокируют запуск)
