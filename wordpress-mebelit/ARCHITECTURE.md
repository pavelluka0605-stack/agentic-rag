# WordPress Architecture — mebelit.site

## Стек

| Компонент | Решение | Почему |
|-----------|---------|--------|
| CMS | WordPress 6.x | Требование заказчика |
| Page Builder | Elementor Pro | Основной конструктор, управляемость без программиста |
| Custom Fields | ACF Pro | Динамические данные (кухни, отзывы, команда) |
| Тема | Hello Elementor (child) | Чистая тема без мусора, идеально под Elementor |
| Формы | WPForms Lite или Elementor Forms | Webhook-ready, SMTP, защита от спама |
| SEO | Yoast SEO | Стандарт рынка, мета-теги, sitemap |
| Кеш | LiteSpeed Cache или WP Super Cache | Скорость без сложности |
| SMTP | WP Mail SMTP | Надёжная доставка email |
| Безопасность | Wordfence (free) | Базовая защита |
| Аналитика | Yandex Metrika (код в header) | Уже используется, ID: 103970425 |

## Решение: Elementor vs Bricks

Elementor — правильный выбор для этого проекта:
- **Заказчик** сможет редактировать без разработчика
- **Экосистема** плагинов и виджетов шире
- **Порог входа** ниже для непрограммиста
- **Bricks** мощнее технически, но требует знаний CSS/HTML для тонкой настройки

## Структура страниц

```
mebelit.site/
├── / (главная)
├── /straight/ (прямые кухни)
├── /corner/ (угловые кухни)
├── /pshape/ (П-образные кухни)
├── /quiz/ (квиз-калькулятор)
└── /politics/ (политика конфиденциальности)
```

## ACF Field Groups

### 1. Kitchen Model (CPT: kitchen)
- `kitchen_name` (text) — название кухни
- `kitchen_price` (number) — цена
- `kitchen_image` (image) — фото
- `kitchen_type` (taxonomy: kitchen_type) — прямая / угловая / п-образная
- `kitchen_features` (repeater) — характеристики
  - `feature_text` (text)

### 2. Review (CPT: review)
- `review_author` (text) — имя
- `review_text` (textarea) — текст отзыва
- `review_rating` (number, 1-5) — рейтинг

### 3. Team Member (ACF options page)
- `team_members` (repeater)
  - `member_name` (text)
  - `member_role` (text)
  - `member_quote` (textarea)
  - `member_photo` (image)

### 4. Site Settings (ACF options page)
- `phone` (text)
- `phone_raw` (text) — для href=tel
- `work_hours` (text)
- `address` (text)
- `city` (text)
- `metrika_id` (text)
- `min_price_straight` (number)
- `min_price_corner` (number)
- `min_price_pshape` (number)

## Custom Post Types

### Kitchen (kitchen)
- Архив: нет (используем страницы-каталоги)
- Таксономия: kitchen_type (прямая, угловая, п-образная)
- Шаблон карточки — Elementor Loop Item

## Global Styles (CSS Variables)

```css
:root {
  /* Цвета (из текущего сайта) */
  --color-primary: #1a1a2e;      /* тёмный фон */
  --color-accent: #e8c547;       /* жёлтый акцент */
  --color-accent-hover: #d4b13e;
  --color-white: #ffffff;
  --color-light-bg: #f5f5f5;
  --color-text: #333333;
  --color-text-light: #666666;

  /* Типографика */
  --font-heading: 'Montserrat', sans-serif;
  --font-body: 'Open Sans', sans-serif;

  /* Размеры */
  --container-width: 1200px;
  --section-padding: 80px;
  --section-padding-mobile: 40px;
  --border-radius: 8px;
  --border-radius-lg: 16px;
}
```

## Elementor Templates

### Global
1. **Header** — логотип, меню (3 пункта), телефон, CTA «Вызвать на замер»
2. **Footer** — логотип, копирайт, ссылка на политику, контакты, адрес, CTA
3. **Popup: Заявка** — имя + телефон + согласие
4. **Popup: Вызов дизайнера** — имя + телефон + согласие
5. **Popup: Скидка новоселам** — имя + телефон + согласие

### Страницы
1. **Главная** — Hero → Каталог (3 категории) → Преимущества → Форма → Дизайнер → Гарантии → До/После → Калькулятор CTA → Команда → Отзывы → Квиз CTA → Форма (footer)
2. **Каталог кухонь** (шаблон для 3 страниц) — Hero → Гарантия цены → Карточки кухонь (loop) → Удобства → Дизайнер CTA → Формы
3. **Квиз** — Пошаговый квиз (планировка → размеры → контакт → отправка)
4. **Политика** — текстовая страница

## Формы и интеграции

### Типы форм
1. **Быстрая заявка** (имя + телефон) — popup и inline
2. **Вызов дизайнера** (имя + телефон) — popup
3. **Расчёт стоимости** — redirect на /quiz/

### Webhook-интеграция
Все формы → webhook URL → n8n/Telegram:
- POST JSON: `{name, phone, form_type, page_url, timestamp}`
- Резервно: email на admin

### Квиз
Шаги:
1. Выбор планировки (прямая / угловая / п-образная / есть проект)
2. Если «есть проект» → загрузка файла
3. Размеры (зависят от типа: 1-3 стороны)
4. Способ связи (WhatsApp / Viber / SMS / Звонок)
5. Имя + телефон → отправка

### Защита от спама
- reCAPTCHA v3 (invisible)
- Honeypot fields
- Rate limiting

## SEO

- Title templates: «Кухни [тип] на заказ в Красноярске | Mebelit»
- Meta description для каждой страницы
- Schema.org: LocalBusiness, Product, Review
- OpenGraph tags
- Sitemap.xml
- Robots.txt

## Производительность

- Lazy loading изображений
- WebP автоконвертация
- CSS/JS минификация через Elementor
- Кеширование страниц
- CDN (опционально)
