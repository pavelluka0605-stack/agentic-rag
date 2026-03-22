# Delivery Dispatch v5 — Архитектура

## Концепция

Менеджер вносит данные клиента в Google Sheet →
Claude сам видит новый заказ (каждые 5 мин) →
рассчитывает Яндекс Доставку и Озон Посылку →
оформляет в лучшей СД →
печатает этикетку →
записывает трек в Sheet →
n8n шлёт Telegram менеджеру.

**Паша не участвует в процессе.**

## Схема

```
 ПК МЕНЕДЖЕРА              МИНИ-ПК (CLAUDE)              VPS
┌──────────────┐      ┌──────────────────────┐    ┌──────────┐
│ Google Sheet  │──G───│ Claude in Chrome     │    │ n8n      │
│ (заполняет)  │  o   │ Scheduled Task 5мин  │    │          │
│              │  o   │                      │    │ P0-09    │
│ Telegram ◀───│──g───│ Яндекс Доставка ЛК   │    │ алерт    │
│ (трек готов) │  l   │ Озон Seller ЛК       │    │ менедж.  │
│              │  e   │                      │    │          │
│ ВК ← текст  │      │ 🖨️ ПРИНТЕР           │    │ P0-10    │
└──────────────┘      └──────────────────────┘    │ ошибки   │
                                                   │          │
                                                   │ P0-11    │
                                                   │ сводка   │
                                                   └──────────┘
```

## Полный цикл (без участия Паши)

1. Менеджер → заполняет Sheet (данные из ВК)
2. Claude (авто) ← видит статус "Новый" каждые 5 мин
3. Claude → Яндекс калькулятор → цена
4. Claude → Озон ЛК → цена
5. Claude → записывает цены в Sheet
6. Claude → выбирает лучшую цену (правило из Настроек)
7. Claude → оформляет заказ в ЛК лучшей СД
8. Claude → печатает этикетку (штрих-код / адрес+ФИО)
9. Claude → записывает трек, ссылку, текст для клиента
10. Claude → статус = "Оформлен"
11. n8n (VPS) ← видит "Оформлен" (P0-09, каждые 2 мин)
12. n8n → Telegram менеджеру с треком и текстом
13. Менеджер → копирует текст → отправляет в ВК

## Структура файлов

```
delivery-dispatch/
├── docs/
│   └── ARCHITECTURE.md          ← этот файл
├── n8n-workflows/
│   ├── P0-09_Order_Completed_Alert.json   — алерт менеджеру при "Оформлен"
│   ├── P0-10_Order_Error_Alert.json       — алерт при "Ошибка"
│   └── P0-11_Daily_Summary.json           — ежедневная сводка 20:00
├── scripts/
│   ├── setup-sheets.py          — создание листов в Google Sheets
│   └── setup-mini-pc.sh         — проверка настройки мини-ПК
└── templates/
    └── scheduled-task-prompt.md  — промпт для Claude in Chrome
```

## Google Sheets

### Лист: Доставка_Заказы (27 колонок)

| Колонка | Поле | Заполняет |
|---------|------|-----------|
| A | order_id | Авто |
| B | created_at | Авто |
| C | client_name | Менеджер |
| D | phone | Менеджер |
| E | city_to | Менеджер |
| F | address | Менеджер |
| G | postal_code | Менеджер |
| H-K | габариты + вес | Менеджер |
| L | declared_value | Менеджер |
| M | status | Claude |
| N-O | yandex_price/days | Claude |
| P-Q | ozon_price/days | Claude |
| R-S | best_carrier/price | Claude |
| T | chosen_carrier | Claude (авто) |
| U | track_number | Claude |
| V | label_file | Claude |
| W | tracking_url | Claude |
| X | message_for_client | Claude |
| Y | vk_dialog_url | Менеджер |
| Z | notes | Менеджер/Claude |
| AA | updated_at | Авто |

### Лист: Доставка_Настройки

| Параметр | Описание |
|----------|----------|
| city_from | Город отправки |
| postal_code_from | Индекс |
| sender_name | ИП / ФИО |
| sender_phone | Телефон |
| sender_address | Адрес пункта |
| price_rule | Правило выбора СД |

### Статусы

```
Новый        → жёлтый  (менеджер внёс)
Расчёт       →          (Claude считает)
Рассчитан    →          (цены готовы)
Оформляется  →          (Claude создаёт заказ)
Оформлен     → зелёный (трек есть, этикетка напечатана)
Ошибка       → красный (см. notes)
```

## n8n Workflows

| # | Workflow | Триггер | Действие |
|---|---------|---------|----------|
| P0-09 | Order Completed Alert | каждые 2 мин | Telegram менеджеру при статусе "Оформлен" |
| P0-10 | Order Error Alert | каждые 2 мин | Telegram при статусе "Ошибка" |
| P0-11 | Daily Summary | ежедневно 20:00 | Сводка за день в Telegram |

## URL-ы сервисов

| Сервис | URL |
|--------|-----|
| Яндекс калькулятор | dostavka.yandex.ru/calculator |
| Яндекс ЛК | b2b.taxi.yandex.net |
| Озон Seller | seller.ozon.ru |
| Озон FBS | seller.ozon.ru/app/postings/fbs |

## Мини-ПК — требования

- ОС: Windows 10/11 или Ubuntu Desktop
- RAM: 4 GB+
- Диск: 64 GB SSD
- Chrome + Claude in Chrome (Max подписка)
- Принтер: USB/сеть, по умолчанию
- Интернет: кабель
- UPS: желательно

## Деплой

```bash
# 1. Создать листы в Google Sheets
#    GitHub Actions → deploy-delivery-dispatch.yml → action: setup-sheets

# 2. Задеплоить n8n workflows
#    GitHub Actions → deploy-delivery-dispatch.yml → action: deploy-n8n-workflows

# 3. Или всё сразу
#    GitHub Actions → deploy-delivery-dispatch.yml → action: full-setup

# 4. Настроить мини-ПК
#    bash delivery-dispatch/scripts/setup-mini-pc.sh

# 5. Записать Scheduled Task в Claude in Chrome
#    См. delivery-dispatch/templates/scheduled-task-prompt.md
```
