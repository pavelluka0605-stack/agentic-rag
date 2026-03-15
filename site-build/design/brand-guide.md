# Brand Guide — Кухни Рема

**Домен:** кухнирема.рф
**Слоган:** Кухни, в которых хочется жить
**Позиционирование:** Кухни на заказ с индивидуальным подходом. Тепло, уют, точность исполнения.

---

## 1. Логотип

Текстовый логотип **"Кухни Рема"** набран шрифтом Montserrat Bold.
Акцентный элемент: стилизованная сантиметровая шкала (линейка) под или рядом со словом "Рема", подчёркивающая точность изготовления.

**Варианты:**
- Основной: терракотовый на светлом фоне
- Инверсный: белый на терракотовом / тёмном фоне
- Монохромный: тёмно-коричневый на белом

**Защитное поле:** минимум 1/2 высоты буквы "К" вокруг логотипа.

---

## 2. Цветовая палитра

### Primary — Терракот (глина, тепло)

| Вариант | HEX | RGB | HSL | Использование |
|---------|-----|-----|-----|---------------|
| Primary | `#C2613A` | 194, 97, 58 | 17, 54%, 49% | Кнопки CTA, акценты, ссылки |
| Primary Dark | `#9E4A2A` | 158, 74, 42 | 17, 58%, 39% | Hover-состояния, активные элементы |
| Primary Light | `#E8956F` | 232, 149, 111 | 17, 72%, 67% | Бейджи, теги, мягкие акценты |

### Secondary — Лесной зелёный (свежесть, природа)

| Вариант | HEX | RGB | HSL | Использование |
|---------|-----|-----|-----|---------------|
| Secondary | `#3D6B5E` | 61, 107, 94 | 162, 28%, 33% | Вторичные кнопки, иконки, фоны секций |
| Secondary Dark | `#2C4F45` | 44, 79, 69 | 162, 29%, 24% | Hover, футер |
| Secondary Light | `#5A9484` | 90, 148, 132 | 162, 25%, 47% | Декоративные элементы |

### Фоны и поверхности

| Название | HEX | RGB | HSL | Использование |
|----------|-----|-----|-----|---------------|
| Background | `#FDFAF6` | 253, 250, 246 | 34, 54%, 98% | Основной фон страниц |
| Background Alt | `#F5EDE3` | 245, 237, 227 | 30, 46%, 93% | Чередующиеся секции |
| Surface | `#FFFFFF` | 255, 255, 255 | 0, 0%, 100% | Карточки, модалки, попапы |

### Текст

| Название | HEX | RGB | HSL | Использование |
|----------|-----|-----|-----|---------------|
| Text | `#2D2418` | 45, 36, 24 | 30, 30%, 14% | Основной текст, заголовки |
| Text Muted | `#7A6E60` | 122, 110, 96 | 30, 13%, 43% | Подписи, мелкий текст |
| Text on Primary | `#FFFFFF` | 255, 255, 255 | — | Текст поверх цветных фонов |

### Дерево (декоративные)

| Название | HEX | RGB | Использование |
|----------|-----|-----|---------------|
| Wood Light | `#D4B896` | 212, 184, 150 | Фоновые паттерны, линии |
| Wood | `#A67B5B` | 166, 123, 91 | Акцентные линии, иконки |
| Wood Dark | `#6B4A30` | 107, 74, 48 | Заголовки на светлом фоне (опционально) |

### Семантические

| Название | HEX | Использование |
|----------|-----|---------------|
| Success | `#3D8B5F` | Статусы "готово", подтверждения |
| Error | `#C94444` | Ошибки валидации, алерты |
| Warning | `#D4962A` | Предупреждения |
| Info | `#3B82A0` | Информационные сообщения |

---

## 3. Типографика

### Шрифты

| Роль | Шрифт | Подключение |
|------|-------|-------------|
| Заголовки (h1-h4) | **Montserrat** 600-700 | Google Fonts |
| Основной текст | **Inter** 400-500 | Google Fonts |

### Размеры (mobile-first)

| Token | Mobile | Tablet (768px+) | Desktop (1024px+) | Использование |
|-------|--------|------------------|--------------------|---------------|
| `--font-size-xs` | 12px | 12px | 12px | Мелкие подписи |
| `--font-size-sm` | 14px | 14px | 14px | Кнопки, метки |
| `--font-size-base` | 16px | 16px | 16px | Основной текст |
| `--font-size-lg` | 18px | 20px | 20px | Подзаголовки |
| `--font-size-xl` | 20px | 24px | 24px | h4 |
| `--font-size-2xl` | 24px | 30px | 30px | h3 |
| `--font-size-3xl` | 30px | 36px | 40px | h2 |
| `--font-size-4xl` | 36px | 48px | 56px | h1, hero |

### Иерархия заголовков

```
h1 — Montserrat Bold (700), --font-size-4xl, --line-height-tight
h2 — Montserrat SemiBold (600), --font-size-3xl, --line-height-tight
h3 — Montserrat SemiBold (600), --font-size-2xl, --line-height-tight
h4 — Montserrat Medium (500), --font-size-xl, --line-height-normal
Body — Inter Regular (400), --font-size-base, --line-height-relaxed
Body Small — Inter Regular (400), --font-size-sm, --line-height-normal
Caption — Inter Medium (500), --font-size-xs, --line-height-normal, uppercase, tracking-wider
```

---

## 4. Система отступов

Базовая единица: **8px**. Все отступы кратны 4px.

| Token | Значение | Типичное использование |
|-------|----------|------------------------|
| `--space-1` | 4px | Минимальные отступы (иконка от текста) |
| `--space-2` | 8px | Внутренние отступы мелких элементов |
| `--space-3` | 12px | Padding кнопок (вертикальный) |
| `--space-4` | 16px | Стандартный gap, padding карточек |
| `--space-5` | 20px | — |
| `--space-6` | 24px | Padding секций (мобайл) |
| `--space-8` | 32px | Промежутки между блоками |
| `--space-10` | 40px | — |
| `--space-12` | 48px | Отступы между секциями (мобайл) |
| `--space-14` | 56px | — |
| `--space-16` | 64px | Отступы между секциями (десктоп) |

---

## 5. Компоненты

### Кнопки

**Primary (CTA)**
```
Background: var(--color-primary)
Color: var(--color-text-on-primary)
Font: Inter SemiBold, --font-size-base
Padding: 12px 24px (--space-3 --space-6)
Border-radius: var(--radius-md) — 8px
Transition: var(--transition-fast)
Hover: var(--color-primary-dark)
Shadow: var(--shadow-sm)
```

**Secondary**
```
Background: var(--color-secondary)
Color: var(--color-text-on-secondary)
Padding: 12px 24px
Border-radius: var(--radius-md)
Hover: var(--color-secondary-dark)
```

**Outline**
```
Background: transparent
Color: var(--color-primary)
Border: 2px solid var(--color-primary)
Padding: 10px 22px (вычтена граница)
Border-radius: var(--radius-md)
Hover: background var(--color-primary), color white
```

**Ghost (текстовая)**
```
Background: transparent
Color: var(--color-primary)
Padding: 8px 16px
Hover: background rgba(194, 97, 58, 0.08)
```

**Состояния для всех кнопок:**
- `:hover` — затемнение на 1 ступень
- `:active` — затемнение + scale(0.98)
- `:focus-visible` — outline 2px offset 2px var(--color-primary-light)
- `:disabled` — opacity 0.5, cursor not-allowed

### Карточки (товар/проект)

```
Background: var(--color-surface)
Border-radius: var(--radius-lg) — 12px
Padding: var(--space-4) — 16px
Shadow: var(--shadow-sm)
Hover: var(--shadow-md), translateY(-2px)
Transition: var(--transition-normal)
Border: 1px solid var(--color-border)
```

Изображение внутри карточки:
```
Border-radius: var(--radius-md)
Aspect-ratio: 4/3 или 3/2
Object-fit: cover
```

### Формы

**Input / Textarea**
```
Background: var(--color-surface)
Border: 1px solid var(--color-border)
Border-radius: var(--radius-md)
Padding: 12px 16px
Font: Inter, --font-size-base
Color: var(--color-text)
Placeholder color: var(--color-text-muted)
Focus: border-color var(--color-primary), box-shadow 0 0 0 3px rgba(194,97,58,0.15)
Error: border-color var(--color-error)
```

**Label**
```
Font: Inter Medium, --font-size-sm
Color: var(--color-text)
Margin-bottom: var(--space-1)
```

---

## 6. Иконография

**Набор:** [Lucide Icons](https://lucide.dev/)
**Стиль:** Outline, stroke-width 1.5-2px
**Размеры:**
- Inline (в тексте): 16px
- UI (кнопки, навигация): 20-24px
- Feature (блоки преимуществ): 32-40px

**Цвет:** Наследует `currentColor`. На светлом фоне: `var(--color-text)` или `var(--color-primary)`.

---

## 7. Фотостиль

- Светлые, тёплые кухонные интерьеры с естественным освещением
- Мягкий дневной свет (из окна), тёплая цветовая температура
- Показывать реальные кухни, процесс сборки, детали фурнитуры
- Живые фото (не стоковые рендеры) с элементами уюта: растения, посуда, текстиль
- На фотографиях не должно быть чужих логотипов
- Формат: WebP, с LQIP-превью (размытая версия для ленивой загрузки)
- Соотношение сторон: 4:3 (горизонтальные), 3:4 (вертикальные в каталоге), 16:9 (hero)

---

## 8. Сетка и контейнер

- **Max-width:** 1280px
- **Контейнер padding:** 16px (мобайл) / 32px (планшет) / 40px (десктоп)
- **Сетка:** CSS Grid
  - Каталог: 1 колонка (мобайл) / 2 (планшет) / 3 (десктоп)
  - Gap: `var(--space-4)` мобайл / `var(--space-6)` десктоп

---

## 9. Do's and Don'ts

### Do's

- Использовать CSS-переменные из `design-tokens.css` для всех значений
- Придерживаться 8px-сетки для отступов
- Обеспечить контраст текста WCAG AA (минимум 4.5:1 для текста, 3:1 для крупного)
- Использовать `rem` для размеров шрифтов (доступность)
- Тестировать на мобильных устройствах в первую очередь (76.7% трафика)
- Использовать `prefers-reduced-motion` для отключения анимаций
- Сжимать изображения: WebP, max 200 КБ для карточек, max 500 КБ для hero
- Добавлять `alt`-текст на русском ко всем изображениям
- Использовать `font-display: swap` при подключении шрифтов

### Don'ts

- Не использовать чёрный цвет (`#000000`) — заменять на `var(--color-text)` (#2D2418)
- Не использовать чистый белый (`#FFFFFF`) для фона страницы — использовать `var(--color-bg)`
- Не применять более 2 акцентных цветов на одном экране
- Не использовать тени темнее `var(--shadow-lg)` на мобильных
- Не ставить текст меньше 14px (`--font-size-sm`) для основного контента
- Не использовать золотой (#e8c547) и тёмный (#1a1a2e) из старого mebelit.site
- Не загружать изображения без lazy loading (`loading="lazy"`)
- Не использовать горизонтальную прокрутку на мобильных
- Не анимировать layout-свойства (width, height, top, left) — только transform и opacity

---

## 10. Подключение шрифтов

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet">
```

---

*Последнее обновление: 2026-03-15*
