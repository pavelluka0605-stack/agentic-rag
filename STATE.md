# STATE — Текущее состояние проекта

> **ИНСТРУКЦИЯ ДЛЯ CLAUDE:** Этот файл — твоя память. Читай его В НАЧАЛЕ каждой сессии
> и ПОСЛЕ каждого сжатия контекста. Обновляй после завершения значимых задач.
> Последнее обновление: 2026-03-15

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

### Что в процессе
- (всё завершено, готовы к этапу 4)

### Что дальше
- [ ] Этап 4: Реализация — сборка сайта кухнирема.рф на WordPress + Bricks Builder

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
