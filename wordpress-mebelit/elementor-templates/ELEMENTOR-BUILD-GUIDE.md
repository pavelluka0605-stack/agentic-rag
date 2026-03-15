# Elementor Build Guide — mebelit.site

Пошаговая инструкция по сборке всех страниц в Elementor Pro.
Все CSS-классы уже определены в style.css дочерней темы.
Все формы и попапы работают через PHP-шаблоны (popups.php) + JS (main.js).

---

## ПРЕДВАРИТЕЛЬНАЯ НАСТРОЙКА

### Elementor → Настройки → Общие
- Content Width: 1200px
- Default Breakpoints: Tablet 768px, Mobile 480px
- Default Fonts: Montserrat (headings), Open Sans (body)

### Elementor → Site Settings → Global Colors
| Название | Hex |
|----------|-----|
| Primary (тёмный) | #1a1a2e |
| Accent (жёлтый) | #e8c547 |
| Accent Hover | #d4b13e |
| White | #ffffff |
| Light BG | #f7f7f7 |
| Text | #333333 |
| Text Light | #666666 |

### Elementor → Site Settings → Global Fonts
| Название | Шрифт | Weight |
|----------|-------|--------|
| Primary Heading | Montserrat | 700 |
| Secondary Heading | Montserrat | 600 |
| Body Text | Open Sans | 400 |
| Body Bold | Open Sans | 600 |

---

## HEADER (Theme Builder → Header)

**Тип:** Sticky Header
**Условие:** All Pages

### Структура:
```
Section (CSS Class: site-header)
├── Container (CSS Class: header-inner) [Flex, Space Between, Align Center]
│   ├── Image (Logo) → link to /
│   ├── Container (CSS Class: header-nav) [Flex, gap 4px]
│   │   ├── Button / Text Link → "КУХНИ ПРЯМЫЕ" → /straight/
│   │   ├── Button / Text Link → "КУХНИ УГЛОВЫЕ" → /corner/
│   │   └── Button / Text Link → "КУХНИ П-ОБРАЗНЫЕ" → /pshape/
│   └── Container (CSS Class: header-contacts) [Flex, gap 16px, Align Center]
│       ├── Container [Flex Column]
│       │   ├── Shortcode: [mebelit_phone]
│       │   └── Text (CSS Class: header-hours): [mebelit_hours]
│       └── Button "ВЫЗВАТЬ НА ЗАМЕР" (CSS Class: btn-primary)
│           → onclick: data-popup="popup-designer"
│           → Custom Attr: data-popup | popup-designer
```

**Стили секции:**
- Background: var(--color-primary) → #1a1a2e
- Padding: 0
- Height: 72px
- Position: Fixed, Top, Z-Index 1000

**Мобильная версия (≤768px):**
- Скрыть nav (через Responsive → Hide on Tablet/Mobile)
- Скрыть часы работы
- Показать бургер-меню (используется встроенный Nav Menu или кнопка .header-burger)

---

## FOOTER (Theme Builder → Footer)

**Условие:** All Pages

### Структура:
```
Section (CSS Class: site-footer, Background: #1a1a2e)
├── Container (CSS Class: footer-inner) [Grid 3 columns]
│   ├── Column 1
│   │   ├── Image (Logo, white version)
│   │   ├── Text: "Кухни любой сложности на заказ в Красноярске"
│   │   └── Button "ЗАКАЗАТЬ БЕСПЛАТНЫЙ ПРОЕКТ" (CSS Class: btn-primary)
│   │       → data-popup="popup-form"
│   ├── Column 2 (CSS Class: footer-col)
│   │   ├── Heading H4: "Каталог"
│   │   ├── Link → "Кухни прямые" → /straight/
│   │   ├── Link → "Кухни угловые" → /corner/
│   │   └── Link → "Кухни П-образные" → /pshape/
│   └── Column 3 (CSS Class: footer-col)
│       ├── Heading H4: "Контакты"
│       ├── Shortcode: [mebelit_phone]
│       ├── Text: [mebelit_hours]
│       └── Text: [mebelit_address]
├── Container (CSS Class: footer-copyright)
│   ├── Text: "© 2025 Mebelit. Все права защищены"
│   └── Link → "Политика конфиденциальности" → /politics/
```

---

## ГЛАВНАЯ СТРАНИЦА

### Секция 1: Hero
```
Section (CSS Class: hero-section, Full Width, Min-height: 600px)
├── Background Image (фото кухни, position: center right)
├── Background Overlay: gradient (left #1a1a2e 40% → transparent)
├── Container (CSS Class: hero-section__content)
│   ├── Container (CSS Class: hero-badges) [Flex, gap 12px]
│   │   ├── Text Block "ЦЕНЫ НИЖЕ РЫНОЧНОЙ 50%" (CSS Class: hero-badge)
│   │   └── Text Block "ОТ 21 ДНЯ" (CSS Class: hero-badge)
│   ├── Heading H1: "КУХНИ ЛЮБОЙ СЛОЖНОСТИ НА ЗАКАЗ"
│   ├── Text: "Узнайте стоимость кухни по своим размерам с выгодой до 50%"
│   │   (CSS Class: hero-section__subtitle)
│   └── Button "РАССЧИТАТЬ СТОИМОСТЬ" (CSS Class: btn-primary) → /quiz/
```

### Секция 2: Рассрочка (акция)
```
Section (Background: #f7f7f7, Padding: 40px 0)
├── Container [Flex, Center, gap 24px]
│   ├── Heading H3: "РАССРОЧКА ДО 10 МЕСЯЦЕВ"
│   ├── Button "ПОЛУЧИТЬ СКИДКУ" (CSS Class: btn-primary)
│   │   → data-popup="popup-discount"
│   └── Button "СКИДКА НОВОСЕЛАМ" (CSS Class: btn-secondary)
│       → data-popup="popup-discount"
```

### Секция 3: Каталог категорий
```
Section (Padding: 80px 0)
├── Heading H2 (Center): "КАТАЛОГ КУХОНЬ"
├── Container (CSS Class: catalog-grid)
│   ├── Link Container → /straight/ (CSS Class: catalog-card)
│   │   ├── Image (CSS Class: catalog-card__image)
│   │   └── Container (CSS Class: catalog-card__overlay)
│   │       ├── Text "Кухни прямые" (CSS Class: catalog-card__title)
│   │       └── Text "от 63 700 ₽" (CSS Class: catalog-card__price)
│   ├── Link Container → /corner/ (CSS Class: catalog-card)
│   │   ├── Image (CSS Class: catalog-card__image)
│   │   └── Container (CSS Class: catalog-card__overlay)
│   │       ├── Text "Кухни угловые" (CSS Class: catalog-card__title)
│   │       └── Text "от 96 300 ₽" (CSS Class: catalog-card__price)
│   └── Link Container → /pshape/ (CSS Class: catalog-card)
│       ├── Image (CSS Class: catalog-card__image)
│       └── Container (CSS Class: catalog-card__overlay)
│           ├── Text "Кухни П-образные" (CSS Class: catalog-card__title)
│           └── Text "от 98 600 ₽" (CSS Class: catalog-card__price)
```

### Секция 4: Преимущества производства
```
Section (CSS Class: mebelit-section mebelit-section--light)
├── Heading H2 (Center): "ПОЧЕМУ У НАС ДЕШЕВЛЕ"
├── Container (CSS Class: advantages-grid)
│   ├── Item (CSS Class: advantage-item)
│   │   ├── Icon (gear / settings)
│   │   ├── H4: "Оптимизация производства"
│   │   └── Text: "Шаг модуля 1 см — минимум отходов материала"
│   ├── Item (CSS Class: advantage-item)
│   │   ├── Icon (handshake)
│   │   ├── H4: "Прямые контакты"
│   │   └── Text: "Работаем напрямую с производителями материалов"
│   ├── Item (CSS Class: advantage-item)
│   │   ├── Icon (no-store)
│   │   ├── H4: "Без посредников"
│   │   └── Text: "Нет торговых площадей — нет наценок"
│   └── Item (CSS Class: advantage-item)
│       ├── Icon (ruler)
│       ├── H4: "Стандартизация"
│       └── Text: "Оптимальный шаг модуля снижает стоимость"
├── Text (Center, Bold): "ВСЁ ЭТО ДАЁТ ВОЗМОЖНОСТЬ СЭКОНОМИТЬ ДО 50%"
```

### Секция 5: Форма заявки
```
Section (CSS Class: mebelit-section mebelit-section--dark)
├── Heading H2 (Center, White): "ОСТАВЬТЕ ДАННЫЕ И МЫ СВЯЖЕМСЯ С ВАМИ"
├── Text (Center, White opacity 0.8): "Обсудим кухню вашей мечты"
├── Shortcode: [mebelit_form type="general" title="" btn="ОТПРАВИТЬ ЗАЯВКУ"]
```

### Секция 6: Пригласите дизайнера
```
Section (Padding: 80px 0)
├── Container (CSS Class: designer-cta)
│   ├── Container (CSS Class: designer-cta__content)
│   │   ├── Heading H2: "ПРИГЛАСИТЕ ДИЗАЙНЕРА БЕСПЛАТНО"
│   │   ├── List (CSS Class: designer-cta__list)
│   │   │   ├── "Привезёт с собой образцы материалов и фурнитуры"
│   │   │   ├── "Сделает профессиональный замер вашей кухни"
│   │   │   └── "Произведёт расчёт и сделает 3D-проект"
│   │   └── Button "ПРИГЛАСИТЬ ДИЗАЙНЕРА" (CSS Class: btn-primary)
│   │       → data-popup="popup-designer"
│   └── Image (CSS Class: designer-cta__image)
│       → Фото дизайнера за работой / красивая кухня
```

### Секция 7: Гарантии
```
Section (CSS Class: mebelit-section mebelit-section--light)
├── Heading H2 (Center): "ЧТО ВЫДЕЛЯЕТ НАС НА РЫНКЕ"
├── Container (CSS Class: guarantees-grid)
│   ├── Item (CSS Class: guarantee-badge)
│   │   ├── Icon (clock / timer)
│   │   ├── H4: "Готовая кухня от 21 дня"
│   │   └── Text: "Фиксированные сроки в договоре. За каждый день просрочки — компенсация."
│   ├── Item (CSS Class: guarantee-badge)
│   │   ├── Icon (price-tag / badge-percent)
│   │   ├── H4: "Гарантия низкой цены"
│   │   └── Text: "Цены до 50% ниже рыночной. Принесите проект — предложим дешевле."
│   └── Item (CSS Class: guarantee-badge)
│       ├── Icon (tools / wrench)
│       ├── H4: "Установка за 1 день"
│       └── Text: "Проверенные монтажники. Аккуратно, быстро, без мусора."
```

### Секция 8: До / После
```
Section (Padding: 80px 0)
├── Heading H2 (Center): "МАГИЯ ПРЕОБРАЖЕНИЯ ВАШЕЙ КУХНИ"
├── Text (Center): "Двигайте ползунок влево или вправо"
├── Container (CSS Class: before-after)
│   ├── Image "after" (CSS Class: before-after__after)
│   ├── Image "before" (CSS Class: before-after__before)
│   ├── Container (CSS Class: before-after__slider)
│   │   └── Container (CSS Class: before-after__handle)
│   ├── Text "ДО" (CSS Class: before-after__label before-after__label--before)
│   └── Text "ПОСЛЕ" (CSS Class: before-after__label before-after__label--after)
├── Text (Center, mt-24): "100+ цветов и фасадов на выбор"
```
**Примечание:** Before/After slider работает через main.js автоматически.

### Секция 9: Калькулятор CTA
```
Section (Padding: 60px 0)
├── Container (CSS Class: cta-banner)
│   ├── Heading H2: "ХОТИТЕ УЗНАТЬ ТОЧНУЮ СТОИМОСТЬ КУХНИ ПО СВОИМ РАЗМЕРАМ?"
│   ├── Container (CSS Class: cta-banner__features) [Flex]
│   │   ├── Span: "В режиме онлайн"
│   │   ├── Span: "В течение 5 минут"
│   │   └── Span: "Не выходя из дома"
│   └── Button "КАЛЬКУЛЯТОР" (CSS Class: btn-primary) → /quiz/
```

### Секция 10: Команда
```
Section (CSS Class: mebelit-section mebelit-section--light)
├── Heading H2 (Center): "НАША КОМАНДА"
├── Container (CSS Class: team-grid)
│   ├── Item (CSS Class: team-member)
│   │   ├── Image (CSS Class: team-member__photo)
│   │   ├── Text "Наоми" (CSS Class: team-member__name)
│   │   ├── Text "ДИЗАЙНЕР" (CSS Class: team-member__role)
│   │   └── Text "Воплощаю желания клиентов..." (CSS Class: team-member__quote)
│   ├── Item (CSS Class: team-member)
│   │   ├── Image
│   │   ├── Text "Павел"
│   │   ├── Text "ИНЖЕНЕР-ДИЗАЙНЕР"
│   │   └── Text "Сделать работу так, чтобы люди вспоминали добрым словом"
│   └── Item (CSS Class: team-member)
│       ├── Image
│       ├── Text "Николай Колесников"
│       ├── Text "ИНЖЕНЕР-ДИЗАЙНЕР"
│       └── Text "Стараюсь услышать желание заказчика"
```
**Альтернатива:** Использовать ACF Options → Team Members через Elementor Dynamic Loop.

### Секция 11: Отзывы
```
Section (Padding: 80px 0)
├── Heading H2 (Center): "ОТЗЫВЫ НАШИХ КЛИЕНТОВ"
├── Posts Widget (CPT: review) / Custom Loop
│   → Loop Template: review-card
│   → Grid: 3 columns / Auto-fill minmax(320px, 1fr)
│   → Каждая карточка:
│       ├── Stars (CSS Class: review-card__stars) → "★★★★★"
│       ├── Text (CSS Class: review-card__text) → ACF: review_text
│       └── Text (CSS Class: review-card__author) → ACF: review_author
```
**Альтернатива:** Carousel с Elementor Slides / Testimonial Carousel.

### Секция 12: Квиз CTA
```
Section (CSS Class: mebelit-section mebelit-section--dark)
├── Heading H2 (Center, White):
│   "ОТВЕТЬТЕ НА ПРОСТЫЕ ВОПРОСЫ И УЗНАЙТЕ ТОЧНУЮ СТОИМОСТЬ КУХНИ"
├── Button "РАССЧИТАТЬ СТОИМОСТЬ" (CSS Class: btn-primary) → /quiz/
```

---

## СТРАНИЦЫ КАТАЛОГА (straight / corner / pshape)

Используется один шаблон Elementor с Dynamic Content.

### Секция 1: Hero (аналогично главной)
```
Section (CSS Class: hero-section)
├── H1: "КУХНИ [ПРЯМЫЕ / УГЛОВЫЕ / П-ОБРАЗНЫЕ] НА ЗАКАЗ"
├── Badges + CTA → /quiz/
```

### Секция 2: Гарантия цены
```
Section (Padding: 40px 0)
├── Container (CSS Class: price-guarantee)
│   ├── Container
│   │   ├── H3: "ГАРАНТИЯ САМОЙ НИЗКОЙ ЦЕНЫ НА РЫНКЕ"
│   │   └── Text: "Есть проект от другой компании? Присылайте — предложим выгоднее!"
│   └── Button "РАССЧИТАТЬ ПО МОИМ РАЗМЕРАМ" (CSS Class: btn-primary) → /quiz/
```

### Секция 3: Карточки кухонь
```
Section (Padding: 60px 0)
├── Heading H2 (Center): "НАШИ РАБОТЫ"
├── Posts Widget / Loop Grid (CSS Class: kitchens-grid)
│   → CPT: kitchen
│   → Taxonomy Filter: kitchen_type = [straight|corner|pshape]
│   → Loop Item Template:
│       ├── Container (CSS Class: kitchen-card)
│       │   ├── Container (CSS Class: kitchen-card__image-wrap)
│       │   │   └── Post Thumbnail (CSS Class: kitchen-card__image)
│       │   └── Container (CSS Class: kitchen-card__content)
│       │       ├── Title (CSS Class: kitchen-card__name)
│       │       ├── ACF: kitchen_price → formatted (CSS Class: kitchen-card__price)
│       │       ├── ACF Repeater: kitchen_features → list (CSS Class: kitchen-card__features)
│       │       └── Button "РАССЧИТАТЬ" (CSS Class: btn-primary kitchen-card__cta)
│       │           → data-popup="popup-form"
```

### Секция 4: Удобства
```
Section (CSS Class: mebelit-section mebelit-section--light)
├── Container (CSS Class: services-grid)
│   ├── Item: Icon + "Рассрочка до 10 месяцев"
│   ├── Item: Icon + "Выезд дизайнера — 0 руб"
│   ├── Item: Icon + "Демонстрация материалов"
│   └── Item: Icon + "3D-проект — 0 руб"
├── Button "ПРИГЛАСИТЬ ДИЗАЙНЕРА" (Center) → data-popup="popup-designer"
```

### Секция 5: Форма + CTA
```
Section (CSS Class: mebelit-section mebelit-section--dark)
├── Shortcode: [mebelit_form type="catalog" title="ОСТАВЬТЕ ЗАЯВКУ" btn="ОТПРАВИТЬ"]
```

---

## КВИЗ

Страница использует шаблон `page-quiz.php`.
Весь UI генерируется через `quiz.js`.
В Elementor нужно создать страницу "Квиз" со slug "quiz" и назначить шаблон "Квиз — Калькулятор".

---

## ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ

Страница использует шаблон `page-privacy.php`.
Создать страницу со slug "politics" и назначить шаблон "Политика конфиденциальности".

---

## ПОПАПЫ

Попапы подключаются автоматически через `wp_footer` → `popups.php`.
Вызов: добавить к любой кнопке custom attribute `data-popup` с ID попапа:

| Попап | ID | Назначение |
|-------|----|------------|
| Общая заявка | popup-form | Лид-форма |
| Вызов дизайнера | popup-designer | Замер |
| Скидка новоселам | popup-discount | Акция |
| Обратный звонок | popup-callback | Перезвон |

В Elementor: Кнопка → Advanced → Custom Attributes → `data-popup|popup-designer`

---

## ЧЕКЛИСТ ПОСЛЕ СБОРКИ

- [ ] Все кнопки CTA ведут на попапы или /quiz/
- [ ] Формы отправляются через AJAX (проверить в консоли)
- [ ] Webhook URL настроен в Mebelit → Настройки → Интеграции
- [ ] Телефон, адрес, часы указаны в ACF Options
- [ ] Yandex Metrika работает (проверить ym в консоли)
- [ ] Mobile: меню открывается, формы работают
- [ ] Before/After slider работает
- [ ] SEO: мета-теги заполнены в Yoast
- [ ] Скорость: PageSpeed > 80
- [ ] SSL: https работает
- [ ] Редиректы со старых URL настроены
