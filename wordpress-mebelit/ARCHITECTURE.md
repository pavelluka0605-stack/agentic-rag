# WordPress Architecture — mebelit.site v2.0

## Стек

| Компонент | Решение | Почему |
|-----------|---------|--------|
| CMS | WordPress 6.x | Требование заказчика |
| Page Builder | Elementor Pro | Управляемость без программиста, широкая экосистема |
| Custom Fields | ACF Pro | Динамические данные (кухни, отзывы, команда, настройки) |
| Тема | Hello Elementor (child: mebelit-child) | Чистая тема без мусора |
| Формы | Custom AJAX (functions.php + main.js) | Webhook-ready, honeypot, без плагинов |
| SEO | Yoast SEO | Стандарт рынка |
| Кеш | LiteSpeed Cache / WP Super Cache | Скорость без сложности |
| SMTP | WP Mail SMTP | Надёжная доставка email |
| Аналитика | Yandex Metrika (код в header, ID: 103970425) | Уже используется |

## Решение: Elementor vs Bricks

**Elementor — правильный выбор:**
- Заказчик редактирует без разработчика
- Экосистема шире, порог входа ниже
- Bricks мощнее технически, но требует CSS/HTML для тонкой настройки
- Для этого проекта Bricks не даёт существенных преимуществ

## Структура URL

```
mebelit.site/
├── /               (главная)
├── /straight/      (прямые кухни)
├── /corner/        (угловые кухни)
├── /pshape/        (П-образные кухни)
├── /quiz/          (квиз-калькулятор)
└── /politics/      (политика конфиденциальности)
```

## Файлы дочерней темы

```
mebelit-child/
├── style.css                  — глобальные стили, design tokens, компоненты
├── functions.php              — CPT, ACF, AJAX-обработчики, шорткоды, безопасность
├── screenshot.png             — скриншот темы
├── assets/
│   ├── js/
│   │   ├── main.js            — header, меню, формы, попапы, before/after slider
│   │   └── quiz.js            — 4-шаговый квиз-калькулятор
│   └── img/
│       ├── straight.svg       — иконка прямой кухни
│       ├── corner.svg         — иконка угловой кухни
│       ├── pshape.svg         — иконка П-образной кухни
│       └── project-icon.svg   — иконка "есть проект"
└── templates/
    ├── page-quiz.php          — шаблон квиза
    ├── page-privacy.php       — шаблон политики конфиденциальности
    └── popups.php             — HTML попапов (подключается в wp_footer)
```

## Custom Post Types

### Kitchen (kitchen)
- Архив: нет
- Таксономия: `kitchen_type` (straight, corner, pshape)
- Поля ACF: price, features (repeater)
- Шаблон карточки: Elementor Loop Item

### Review (review)
- Архив: нет
- Поля ACF: author, text, rating
- Вывод: Elementor Loop или Carousel

## ACF Field Groups

### 1. Поля кухни (CPT: kitchen)
- `kitchen_price` (number) — цена
- `kitchen_features` (repeater) → `feature_text` (text)

### 2. Поля отзыва (CPT: review)
- `review_author` (text)
- `review_text` (textarea)
- `review_rating` (number, 1-5)

### 3. Настройки сайта (Options Page: mebelit-settings)
- `site_phone` — телефон отображение
- `site_phone_raw` — телефон для href=tel
- `site_work_hours` — часы работы
- `site_address` — адрес
- `webhook_url` — URL для webhook (n8n/Telegram)
- `min_price_straight` — мин. цена прямых
- `min_price_corner` — мин. цена угловых
- `min_price_pshape` — мин. цена П-образных
- `metrika_id` — ID Яндекс.Метрики

### 4. Команда (Options Sub Page)
- `team_members` (repeater)
  - `member_name`, `member_role`, `member_quote`, `member_photo`

## Шорткоды

| Шорткод | Описание |
|---------|----------|
| `[mebelit_phone]` | Телефон из ACF с ссылкой tel: |
| `[mebelit_hours]` | Часы работы из ACF |
| `[mebelit_address]` | Адрес из ACF |
| `[mebelit_form type="general" title="..." btn="..."]` | Форма заявки |
| `[mebelit_quiz]` | Встроенный квиз |

## Формы и интеграции

### AJAX-обработчики
- `mebelit_quiz_submit` — квиз (4 шага)
- `mebelit_contact` — общая форма (имя + телефон)

### Webhook
POST JSON → n8n/Telegram:
```json
{
  "name": "Имя",
  "phone": "+7...",
  "form_type": "quiz|general|designer|discount|callback|catalog",
  "layout": "straight|corner|pshape|project",
  "side_a": "300",
  "side_b": "",
  "side_c": "",
  "contact_method": "whatsapp|viber|sms|call",
  "page_url": "https://mebelit.site/...",
  "timestamp": "2025-01-01 12:00:00"
}
```

### Защита от спама
- Honeypot (скрытое поле `website_url`)
- Rate limiting (5 заявок/IP/час)
- AJAX nonce verification

## Попапы

| ID | Назначение | Тип формы |
|----|------------|-----------|
| `popup-form` | Общая заявка | general |
| `popup-designer` | Вызов дизайнера | designer |
| `popup-discount` | Скидка новоселам | discount |
| `popup-callback` | Обратный звонок | callback |

Вызов: `data-popup="popup-designer"` на любой кнопке.

## SEO

- Title templates через Yoast
- Schema.org LocalBusiness на главной (автоматически)
- Meta description для каждой страницы
- Yandex Metrika с webvisor

## Безопасность

- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Отключены: XML-RPC, emoji, oEmbed, wp_generator
- REST API: скрыт endpoint users для неавторизованных
- Honeypot + rate limiting на формах

## Design Tokens (CSS Variables)

```css
--color-primary: #1a1a2e;
--color-accent: #e8c547;
--font-heading: 'Montserrat';
--font-body: 'Open Sans';
--container-max: 1200px;
--section-py: 80px;
--radius-md: 8px;
--shadow-card: 0 4px 20px rgba(0,0,0,0.08);
```

Полный список — в style.css `:root`.
