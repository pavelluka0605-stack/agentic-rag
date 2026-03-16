# CONTENT MODEL — кухнирема.рф

**Дата заморозки:** 2026-03-16

---

## CPT: Kitchen (Кухня)

**Slug:** `kuhnya` → URL: `/kuhnya/{model}/`
**Записей:** 42 модели из VK Market
**PHP:** `inc/cpt-kitchen.php`

### ACF-поля (14)

| Поле | Ключ | Тип | Обяз. | Пример |
|------|------|-----|-------|--------|
| Цена | `kitchen_price` | number | Да | 246000 |
| Цена со скидкой | `kitchen_sale_price` | number | Нет | 215000 |
| Размеры | `kitchen_dimensions` | text | Нет | "2400x1800x2200" |
| Столешница | `kitchen_countertop` | select | Нет | Постформинг / Камень / ЛДСП |
| Фурнитура | `kitchen_hardware` | select | Нет | Blum / Hettich / GTV / Стандарт |
| Галерея фото | `kitchen_gallery` | gallery (макс. 10) | Нет | 800x600 мин |
| 3D-визуализация | `kitchen_3d_render` | image | Нет | отдельный рендер |
| Цвет фасада | `kitchen_facade_color` | color_picker | Нет | #FFFFFF |
| Комплектация | `kitchen_equipment` | textarea | Нет | описание |
| Шаг модуля | `kitchen_module_step` | number | Нет | 1 (по умолч.) |
| Срок изготовления | `kitchen_production_time` | text | Нет | "от 14 дней" |
| Рассрочка | `kitchen_installment` | true_false | Нет | true |
| VK Market ID | `kitchen_vk_market_id` | number | Нет | 12345 |
| Сортировка | `kitchen_sort_order` | number | Нет | 10 |

### Таксономии (3)

| Таксономия | Slug | Термы |
|------------|------|-------|
| Тип кухни | `kitchen_type` | Прямая, Угловая, П-образная |
| Стиль | `kitchen_style` | Современный, Классический, Лофт, Минимализм |
| Материал фасада | `kitchen_material` | МДФ плёнка, МДФ эмаль, МДФ пластик, ЛДСП, Массив |

---

## CPT: Project (Проект портфолио)

**Slug:** `portfolio` → URL: `/portfolio/{project}/`
**PHP:** `inc/cpt-project.php`

### ACF-поля (10)

| Поле | Ключ | Тип | Обяз. |
|------|------|-----|-------|
| Имя клиента | `project_client_name` | text | Нет |
| Описание | `project_description` | wysiwyg | Да |
| Галерея | `project_gallery` | gallery (макс. 20) | Да |
| Фото «До» | `project_before_photos` | gallery (макс. 5) | Нет |
| Тип кухни | `project_kitchen_type` | taxonomy | Да |
| Площадь кухни | `project_area` | number | Нет |
| Срок реализации | `project_duration` | text | Нет |
| Отзыв клиента | `project_review` | textarea | Нет |
| Оценка | `project_rating` | number (1-5) | Нет |
| Сортировка | `project_sort_order` | number | Нет |

---

## CPT: Review (Отзыв)

**PHP:** `inc/cpt-review.php`

### ACF-поля (10)

| Поле | Ключ | Тип | Обяз. |
|------|------|-----|-------|
| Имя клиента | `review_client_name` | text | Да |
| Текст | `review_text` | textarea | Да |
| Оценка | `review_rating` | number (1-5) | Да |
| Фото клиента | `review_client_photo` | image | Нет |
| Фото кухни | `review_kitchen_photo` | image | Нет |
| Источник | `review_source` | select | Да |
| Ссылка на источник | `review_source_url` | url | Нет |
| Дата | `review_date` | date | Да |
| Связь с проектом | `review_project` | post_object | Нет |
| Сортировка | `review_sort_order` | number | Нет |

---

## CPT: Team Member (Сотрудник)

**PHP:** `inc/cpt-team.php`
**publicly_queryable:** false (нет отдельных страниц)

### ACF-поля (4)

| Поле | Ключ | Тип | Обяз. |
|------|------|-----|-------|
| Должность | `team_position` | text | Да |
| Фото | `team_photo` | image (400x400 мин) | Да |
| Описание | `team_description` | textarea | Нет |
| Сортировка | `team_sort_order` | number | Нет |

---

## CPT: Promotion (Акция)

**PHP:** `inc/cpt-promotion.php`

### ACF-поля (8)

| Поле | Ключ | Тип | Обяз. |
|------|------|-----|-------|
| Описание | `promo_description` | wysiwyg | Да |
| Условия | `promo_conditions` | textarea | Да |
| Дата начала | `promo_date_start` | date | Да |
| Дата окончания | `promo_date_end` | date | Да |
| Баннер | `promo_banner` | image (1200x400) | Нет |
| Активна | `promo_active` | true_false | Да |
| Размещение | `promo_placement` | checkbox | Нет |
| Скидка % | `promo_discount` | number | Нет |

---

## CPT: FAQ

**PHP:** `inc/cpt-faq.php`

### ACF-поля (3)

| Поле | Ключ | Тип | Обяз. |
|------|------|-----|-------|
| Ответ | `faq_answer` | wysiwyg | Да |
| Категория | `faq_category` | select | Да |
| Сортировка | `faq_sort_order` | number | Нет |

Категории FAQ: Общие, Цены, Материалы, Доставка и установка, Гарантия

---

## ACF Options Pages (6)

### 1. Контакты и реквизиты
| Поле | Ключ | Текущее значение |
|------|------|-----------------|
| Телефон | `global_phone_main` | +7 (391) 216-97-59 |
| Телефон доп. | `global_phone_secondary` | (уточнить) |
| Адрес | `global_address` | ул. 2-я Огородная, 24, Красноярск |
| Email | `global_email` | (уточнить) |
| Часы работы | `global_working_hours` | (уточнить: пн-пт 10-18 или ежедн. 10-20) |
| Широта | `global_lat` | (заполнить) |
| Долгота | `global_lng` | (заполнить) |
| WhatsApp | `global_whatsapp` | (уточнить) |
| Telegram | `global_telegram` | (уточнить) |

### 2. Социальные сети
| Поле | Ключ | Значение |
|------|------|---------|
| VK URL | `social_vk_url` | https://vk.com/mebelit_krsk |
| VK подписчики | `social_vk_count` | 13 017 |
| Telegram URL | `social_tg_url` | (уточнить) |

### 3. Квиз-калькулятор
- Шаги, варианты, поля контактов, webhook URL, текст кнопки

### 4. CTA-блоки
- cta_hero, cta_catalog_mid, cta_single, cta_sticky_mobile

### 5. Партнёры и поставщики
- partners_logos: Blum, Hettich, Egger, AGT

### 6. Рассрочка
- installment_title, description, prepayment (10%), period (3 мес), bank (false), fine_print

---

## Image Sizes

| Имя | Размер | Где используется |
|-----|--------|-----------------|
| kitchen-card | 800x600 | Каталожные сетки |
| kitchen-detail | 1080x810 | Детальная карточка |
| kitchen-hero | 1920x1080 | Hero-баннеры |
| kitchen-thumb | 400x300 | Похожие кухни |
| kitchen-micro | 200x150 | Админка, предпросмотр |

## Роли

| Роль | Доступ |
|------|--------|
| Content Manager | 6 CPT, медиафайлы, ACF Options. Нет: плагины, темы, настройки |
| Administrator | Полный доступ |
