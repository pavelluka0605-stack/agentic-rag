# STATE — Текущее состояние проекта

> **ИНСТРУКЦИЯ ДЛЯ CLAUDE:** Этот файл — твоя память. Читай его В НАЧАЛЕ каждой сессии
> и ПОСЛЕ каждого сжатия контекста. Обновляй после завершения значимых задач.
> Последнее обновление: 2026-03-16

---

## Текущая задача

**Audit MEBELIT site for Remakitchens rebrand** — Discovery/аудит сайта mebelit.site
для ребрендинга в «Кухни Рема» (кухнирема.рф).

### Что сделано

**Этап 1: Discovery/Аудит**
- [x] Полный аудит mebelit.site — `site-analysis/DISCOVERY-AUDIT.md`
- [x] Экспорт 205 фото VK Market — `site-analysis/vk-photos-index.json`
- [x] Анализ 6 конкурентов, Яндекс Метрика — `site-analysis/yandex-metrika-report.md`
- [x] План ребрендинга (10 разделов) — `site-analysis/REBRAND-PLAN.md`

**Фундамент (workflows, WordPress, дизайн, SEO)**
- [x] VK Photo Export workflow — `.github/workflows/vk-photo-export.yml`
- [x] CPT Kitchen (JSON + PHP) — `site-build/wordpress/`
- [x] Дизайн-токены + бренд-гайд — `site-build/design/`
- [x] Wireframes 9 страниц — `site-build/wireframes/WIREFRAMES.md`
- [x] SEO-конфиг (5 файлов) — `site-build/seo/`

**Этап 2: Архитектура**
- [x] Сравнение 4 стеков → Bricks Builder — `site-build/architecture/01-stack-comparison.md`
- [x] Архитектура + контентная модель + IA — `site-build/architecture/02-site-architecture.md`
- [x] SEO + лидогенерация + аналитика — `site-build/architecture/03-seo-leadgen-analytics.md`
- [x] Риски + переход в этап 3 — `site-build/architecture/04-risks-and-handoff.md`

**Этап 3: Дизайн-система**
- [x] Визуальное ДНК MEBELIT + направление «Dark Hero + Light Content» — `site-build/design/01-visual-direction.md`
- [x] Полная дизайн-система (14 компонентов) + UX-принципы — `site-build/design/02-design-system.md`
- [x] Структура 10 блоков главной + 7 шаблонов + контентная логика — `site-build/design/03-page-structures.md`
- [x] Фото/визуал + риски + переход в этап 4 — `site-build/design/04-visual-content-risks-handoff.md`

**Этап 4: Реализация (WordPress тема)**
- [x] 4.1 Каркас проекта — functions.php, style.css, 6 CPT, ACF Options, helpers, admin-roles
- [x] 4.2 Контент-модель — 6 CPT с полными ACF полями (Kitchen 14, Project 10, Review 10, Team 4, Promotion 8, FAQ 3)
- [x] 4.3 Глобальные компоненты — header, footer, cta-sticky, breadcrumbs
- [x] 4.4 Шаблоны страниц — 12 шаблонов (home, catalog, kitchen single, contacts, about, reviews, portfolio, project single, quiz, thanks, faq, privacy)
- [x] 4.5 Формы и лидогенерация — forms.js (AJAX + маска + webhook), 4 типа форм
- [x] 4.6 Квиз-калькулятор — quiz.js (4 шага), page-quiz.php
- [x] 4.7 SEO — seo-schema.php (Organization, Product, FAQPage, AggregateRating), seo-meta.php (OG, preconnect)
- [x] 4.8 Аналитика — analytics.js (Яндекс Метрика: формы, квиз, CTA, телефон, scroll depth)
- [x] 4.9 Адаптивность — responsive.css (mobile-first, header/footer/grid/cards/quiz/hero)
- [x] 4.10 CSS — design-tokens.css, base.css, components.css, responsive.css

**Этап 4A-QA: Заморозка решений и валидация каркаса**
- [x] 6 консолидационных документов созданы:
  - `site-build/MASTER-PLAN.md` — генеральный план, фазы, метрики
  - `site-build/DECISION-LOG.md` — 10 утверждённых, 9 спорных, 6 замороженных решений
  - `site-build/SITE-MAP.md` — карта страниц, навигация, приоритеты, редиректы
  - `site-build/CONTENT-MODEL.md` — 6 CPT, ACF-поля, Options Pages, роли
  - `site-build/IMPLEMENTATION-BACKLOG.md` — 58 задач по фазам (21 DONE, 12 SCAFFOLD, 25 TODO)
  - `site-build/QA-CHECKLIST.md` — 51 проверка, все PASS
- [x] Полная валидация каркаса 4A (37 файлов, ~7800 строк): 4 параллельных QA-агента, 0 FAIL

**Фаза 4B: Сборка страниц (DONE)**
- [x] 4B-1: Homepage CSS (homepage.css)
- [x] 4B-2: Catalog pages (catalog.css + archive-kitchen.php)
- [x] 4B-3: 7 secondary pages (pages.css)

**Фаза 4C: Интеграции и контент (DONE)**
- [x] 4C-01: Импорт 42 кухонь из VK Market — `data/import-kitchens.php` (WP-CLI)
- [x] 4C-02: Импорт 12 проектов портфолио — `data/import-projects.php`
- [x] 4C-03: n8n webhook документация — `data/n8n-webhooks.md` + `data/n8n-form-webhook.json`
- [x] 4C-04: RankMath Pro конфигурация — `inc/rankmath-config.php`
- [x] 4C-05: Яндекс Метрика 12 целей — `data/metrika-goals.md`
- [x] 4C-06: 15 отзывов (2ГИС/Flamp/VK/Яндекс) — `data/import-reviews.php`
- [x] 4C-07: 18 FAQ вопросов по 5 категориям — `data/import-faq.php`
- [x] 4C-08: Квиз-попап 45 сек — `assets/js/quiz-popup.js`
- [x] 4C-09: Ecommerce dataLayer — `assets/js/datalayer.js`

**Фаза 5: Деплой (DONE — скрипты и конфиги готовы)**
- [x] install-wordpress.sh — установка WP + тема + плагины на VPS
- [x] nginx-kuhnirema.conf — Nginx с SSL, gzip, кэш, безопасность
- [x] .htaccess — WP rewrite + 301 редиректы + Apache fallback
- [x] wp-setup.sh — создание страниц, меню, таксономий, настроек
- [x] deploy-theme.yml — GitHub Actions деплой темы на VPS
- [x] smoke-test.sh + smoke-test.yml — тестирование всех страниц
- [x] DEPLOY-GUIDE.md — пошаговая инструкция деплоя (10 шагов)

### Что дальше
- [ ] Выполнить деплой на VPS (запуск скриптов)
- [ ] DNS: A-запись кухнирема.рф → VPS IP
- [ ] SSL: certbot для кухнирема.рф
- [ ] Bricks Builder: визуальный импорт шаблонов
- [ ] Яндекс.Бизнес + 2ГИС — обновление карточек
- [ ] Фаза 6: пост-запуск (SEO-посадочные, блог, A/B тесты)

### Ключевые данные Яндекс Метрики (90 дней: 2025-12-15 — 2026-03-15)
- 7 287 визитов, 5 286 уников
- 90% трафика — реклама (Яндекс Директ), органика ~0 (18 визитов)
- 82% — Красноярск, далее Новосибирск (177), Барнаул (83)
- 77% — смартфоны, 22% — ПК
- Отказы 27.7%, глубина 1.37, время 1:23
- 12 целей (формы, квиз, телефон, Jivo-чат)
- Счётчики: mebelit.site (ID 103970425), marbomebel.ru (ID 88894444), март-мебель.рф (ID 100492476)
- Статус счётчиков: CS_ERR_UNKNOWN — возможно код Метрики на сайте сломан
- Полный отчёт: `site-analysis/yandex-metrika-report.md`
- Сырые данные: `site-analysis/yandex-metrika-raw.json`

---

## Секреты и токены

| Секрет | Статус | Примечание |
|--------|--------|------------|
| `YANDEX_METRIKA_TOKEN` | ✅ Создан | OAuth токен Яндекс Метрики, добавлен в GitHub Secrets |
| `VK_USER_TOKEN` | ✅ | Используется для VK Market API |
| `GOOGLE_SA_JSON` | ✅ | Service Account для Google Sheets |
| Все остальные из CLAUDE.md | ✅ | См. таблицу секретов в CLAUDE.md |

---

## Известные баги

1. ~~yandex-metrika.yml — shell-переменные не попадали в Python~~ → **ИСПРАВЛЕНО** (данные через tmp-файлы)

2. **Google APIs** — заблокированы из среды Claude Code (403). Все операции с Sheets — через GitHub Actions.

---

## Ключевые файлы

| Файл | Описание |
|------|----------|
| `CLAUDE.md` | База знаний проекта (инфраструктура, секреты, история) |
| `STATE.md` | **ЭТОТ ФАЙЛ** — текущее состояние и память |
| `site-analysis/DISCOVERY-AUDIT.md` | Полный аудит mebelit.site |
| `site-analysis/vk-photos-index.json` | Индекс 205 фото из VK Market |
| `site-analysis/vk-photo-report.md` | Отчёт по фото |
| `site-analysis/REBRAND-PLAN.md` | **План ребрендинга** — 10 разделов, roadmap |
| `site-analysis/yandex-metrika-report.md` | Отчёт Яндекс Метрики (90 дней) |
| `.github/workflows/yandex-metrika.yml` | Workflow Яндекс Метрики |
| `site-build/wordpress/theme/` | **WordPress тема «Кухни Рема»** — полный каркас |
| `site-build/wordpress/theme/functions.php` | Точка входа темы (enqueue, AJAX, theme setup) |
| `site-build/wordpress/theme/inc/` | CPT, ACF Options, SEO, роли, хелперы (11 файлов) |
| `site-build/wordpress/theme/templates/` | Шаблоны страниц (16 файлов) |
| `site-build/wordpress/theme/assets/css/` | CSS: tokens, base, components, responsive |
| `site-build/wordpress/theme/assets/js/` | JS: main, forms, quiz, analytics |

---

## История сессий

### Сессия 2026-03-15
- Полный Discovery/аудит mebelit.site
- Экспорт VK Market фото (205 фото, 43 товара)
- Анализ 6 конкурентов кухонь в Красноярске
- Создание Яндекс Метрика workflow + токен
- Починка workflow (баг с env → tmp-файлы)
- Получены данные Метрики: 7287 визитов, 90% реклама, 82% Красноярск
- Создан STATE.md как система памяти
- Данные Метрики добавлены в DISCOVERY-AUDIT.md (раздел 10)
- Создан REBRAND-PLAN.md — 10 разделов, roadmap 5 фаз
- Push-триггер убран из yandex-metrika.yml

### Сессия 2026-03-16
- **Этап 4: Реализация WordPress темы «Кухни Рема»** — полная сборка
- Каркас: functions.php, style.css (Bricks child theme), 5 image sizes, 3 nav menus
- 6 CPT с ACF полями: Kitchen (14), Project (10), Review (10), Team (4), Promotion (8), FAQ (3)
- 6 ACF Options Pages: Контакты, Соцсети, Квиз, CTA, Партнёры, Рассрочка
- Роль Content Manager + кастомный дашборд (admin-roles.php)
- 12 хелпер-функций (helpers.php): цены, рейтинги, промо, FAQ, команда
- Header (sticky, бургер-меню) + Footer (4 колонки, аккордеон мобайл)
- 12 шаблонов страниц: home, catalog, single-kitchen, contacts, about, reviews, portfolio, single-project, quiz, thanks, faq, privacy
- + breadcrumbs.php, cta-sticky.php
- CSS: design-tokens.css, base.css, components.css, responsive.css
- JS: main.js, forms.js (AJAX + маска), quiz.js (4 шага), analytics.js (Метрика)
- SEO: seo-schema.php (Organization, Product, FAQPage, AggregateRating), seo-meta.php (OG, preconnect)
- AJAX form handler с webhook к n8n + fallback email
- Performance: remove emoji/embed/REST link/wlwmanifest/generator, WebP upload support
- PHP lint: все файлы без ошибок
- Итого: 37 файлов, ~7800 строк кода

### Сессия 2026-03-16 (Dev Environment)
- **Dev Memory System v1**: MCP memory server (Node.js) + JSONL stores + Claude Code hooks
- **VPS Runtime Layer**: tmux + systemd + bash wrapper scripts
  - bootstrap.sh, start.sh, stop.sh, restart.sh, connect.sh, health.sh
  - deploy-claude-code.yml: GitHub Actions workflow

### Сессия 2026-03-16 (Knowledge + Memory + GitHub Layer)
- **Dev Memory System v2**: Полная перестройка на SQLite + FTS5
  - 7 таблиц: policies, episodes, incidents, solutions, decisions, contexts, github_events
  - 6 FTS5 virtual tables с BM25 ranking + auto-sync triggers
  - 22 MCP tools: CRUD + search + bootstrap + dedup + ranking + verify
  - Дедупликация инцидентов по SHA256 fingerprint
  - Решение: SQLite вместо Postgres/Qdrant (zero-ops, single file, FTS5 достаточно)
- **GitHub Integration Layer**:
  - Webhook receiver (server.js, порт 3900) → автоматическая запись в memory
  - PR merged → solutions (verified)
  - Issue opened (bug) → incidents
  - Workflow failed → incidents (с fingerprint)
  - Workflow succeeded after retry → solutions (verified)
  - systemd unit: github-webhook.service
- **Bootstrap обновлён**: теперь ставит memory-server + webhook на VPS
- Smoke test пройден: все 22 tools работают, FTS5 поиск находит релевантные записи
