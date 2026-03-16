# SITE MAP — кухнирема.рф

**Дата заморозки:** 2026-03-16

---

## Карта страниц

```
кухнирема.рф/
│
├── /                              P0  Главная (10 блоков, уникальный шаблон)
│
├── /pryamye-kuhni/                P0  Каталог прямых кухонь (page-catalog.php)
├── /uglovye-kuhni/                P0  Каталог угловых кухонь (page-catalog.php)
├── /p-obraznye-kuhni/             P0  Каталог П-образных кухонь (page-catalog.php)
│
├── /kuhnya/                       P1  Архив CPT Kitchen (все модели)
│   ├── /kuhnya/{model}/           P0  Детальная карточка кухни (single-kitchen.php)
│   └── ... (42 модели)
│
├── /portfolio/                    P1  Портфолио (page-portfolio.php)
│   ├── /portfolio/{project}/      P1  Проект (single-project.php)
│   └── ... (10-15 проектов)
│
├── /kalkulyator/                  P0  Квиз-калькулятор (page-quiz.php)
├── /kontakty/                     P0  Контакты (page-contacts.php)
├── /o-kompanii/                   P1  О компании (page-about.php)
├── /otzyvy/                       P1  Отзывы (page-reviews.php)
├── /faq/                          P2  FAQ (page-faq.php)
│
├── /spasibo/                      P0  Спасибо после заявки (page-thanks.php)
├── /politika-konfidencialnosti/   P0  Политика конфиденциальности (page-privacy.php)
│
├── /kuhni-mdf/                    P2  SEO: Кухни МДФ
├── /kuhni-ldsp/                   P2  SEO: Кухни ЛДСП
├── /kuhni-loft/                   P2  SEO: Кухни лофт
├── /kuhni-klassika/               P2  SEO: Кухни классика
├── /besplatnyj-zamer/             P2  SEO: Бесплатный замер
├── /rassrochka/                   P2  SEO: Рассрочка
├── /3d-proekt/                    P2  SEO: 3D-проект
│
├── /blog/                         P2  Блог (архив)
│   └── /blog/{post}/              P2  Статья блога
│
└── Таксономии (P2):
    ├── /stil-kuhni/{style}/       Архив по стилю
    └── /material-fasada/{mat}/    Архив по материалу
```

## Навигация

### Главное меню (header)
```
Кухни ▼
  ├── Прямые кухни         → /pryamye-kuhni/
  ├── Угловые кухни        → /uglovye-kuhni/
  ├── П-образные кухни     → /p-obraznye-kuhni/
  └── Все кухни            → /kuhnya/
Портфолио                  → /portfolio/
О компании                 → /o-kompanii/
Контакты                   → /kontakty/
[Рассчитать стоимость]     → /kalkulyator/  (CTA-кнопка)
```

### Footer (4 колонки)
| О компании | Каталог | Полезное | Контакты |
|---|---|---|---|
| Логотип + слоган | Прямые | Портфолио | Телефон (click-to-call) |
| VK + Telegram | Угловые | Отзывы | Адрес |
| | П-образные | FAQ | Часы работы |
| | Все кухни | | Email |

### Хлебные крошки
- Главная → Угловые кухни → Кухня Элеганс
- Главная → Портфолио → Кухня для Марии
- Главная → FAQ

## Приоритеты запуска

| Приоритет | Страницы | Когда |
|-----------|----------|-------|
| P0 | Главная, 3 каталога, карточки кухонь, квиз, контакты, спасибо, приватность | Запуск |
| P1 | О компании, портфолио, отзывы, архив /kuhnya/ | Неделя 1 после запуска |
| P2 | FAQ, SEO-посадочные, блог, архивы таксономий | Месяцы 1-6 |

## 301 Редиректы (с mebelit.site)

| Старый URL | Новый URL |
|------------|-----------|
| /straight | /pryamye-kuhni/ |
| /corner | /uglovye-kuhni/ |
| /p-shape | /p-obraznye-kuhni/ |
| /quiz | /kalkulyator/ |
| /about | /o-kompanii/ |
| /contacts | /kontakty/ |
| /privacy-policy | /politika-konfidencialnosti/ |

## noindex страницы
- /spasibo/
- /politika-konfidencialnosti/
- /wp-admin/*
- URL с ?utm_* параметрами
