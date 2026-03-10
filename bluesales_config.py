"""
BlueSales CRM Configuration — все поля, статусы, быстрые фразы, воронки.

Этот файл содержит настройки CRM, которые загружаются/сохраняются
в JSON-файл (bluesales_config.json) и используются для:
  - Полей клиента (стандартные + дополнительные)
  - CRM-статусов клиентов (воронка продаж)
  - Статусов заказов
  - Тегов (авто-теги и ручные)
  - Быстрых фраз с переменными подстановками
  - Автоматизации (JSON-боты)

Настройка: отредактируйте DEFAULT_CONFIG или загрузите свой bluesales_config.json.
"""

import json
import os
import re
from datetime import datetime
from typing import Optional

CONFIG_FILE = os.environ.get("BLUESALES_CONFIG", "bluesales_config.json")

# ─── Стандартные поля клиента BlueSales ──────────────

CUSTOMER_STANDARD_FIELDS = {
    "id":                {"type": "int",    "label": "ID клиента",         "readonly": True},
    "vkId":              {"type": "int",    "label": "VK ID",              "readonly": True},
    "name":              {"type": "str",    "label": "Имя",                "required": True},
    "lastName":          {"type": "str",    "label": "Фамилия"},
    "phone":             {"type": "str",    "label": "Телефон"},
    "email":             {"type": "str",    "label": "Email"},
    "source":            {"type": "str",    "label": "Источник",           "help": "VK, Instagram, WhatsApp, Telegram, OK..."},
    "manager":           {"type": "ref",    "label": "Менеджер",           "help": "Логин или ID менеджера"},
    "crmStatus":         {"type": "ref",    "label": "CRM-статус",         "help": "Этап воронки продаж"},
    "tags":              {"type": "list",   "label": "Теги"},
    "firstContactDate":  {"type": "date",   "label": "Дата первого контакта", "readonly": True},
    "lastContactDate":   {"type": "date",   "label": "Дата последнего контакта", "readonly": True},
    "nextContactDate":   {"type": "date",   "label": "Дата след. контакта", "help": "Напоминание менеджеру"},
    "notes":             {"type": "text",   "label": "Заметки"},
    "city":              {"type": "str",    "label": "Город"},
    "address":           {"type": "str",    "label": "Адрес доставки"},
}

# ─── Стандартные поля заказа ─────────────────────────

ORDER_STANDARD_FIELDS = {
    "id":              {"type": "int",    "label": "ID заказа",          "readonly": True},
    "internalNumber":  {"type": "int",    "label": "Внутренний номер",   "readonly": True},
    "customerId":      {"type": "int",    "label": "ID клиента",         "required": True},
    "status":          {"type": "ref",    "label": "Статус заказа"},
    "totalPrice":      {"type": "float",  "label": "Сумма заказа"},
    "items":           {"type": "list",   "label": "Товары"},
    "trackNumber":     {"type": "str",    "label": "Трек-номер",         "help": "Номер отслеживания посылки"},
    "deliveryService": {"type": "str",    "label": "Служба доставки",    "help": "СДЭК, Почта России, Boxberry..."},
    "deliveryAddress": {"type": "str",    "label": "Адрес доставки"},
    "paymentMethod":   {"type": "str",    "label": "Способ оплаты"},
    "paymentStatus":   {"type": "str",    "label": "Статус оплаты"},
    "comment":         {"type": "text",   "label": "Комментарий"},
    "createdAt":       {"type": "date",   "label": "Дата создания",      "readonly": True},
    "updatedAt":       {"type": "date",   "label": "Дата обновления",    "readonly": True},
}

# ─── Конфигурация по умолчанию ──────────────────────

DEFAULT_CONFIG = {
    # Воронка продаж — CRM-статусы клиентов
    "crm_statuses": [
        {"name": "Новый",            "color": "#3498db", "order": 1},
        {"name": "В обработке",      "color": "#f39c12", "order": 2},
        {"name": "Ожидает ответа",   "color": "#e67e22", "order": 3},
        {"name": "Обсуждение",       "color": "#9b59b6", "order": 4},
        {"name": "Оформление",       "color": "#1abc9c", "order": 5},
        {"name": "Оплачен",          "color": "#2ecc71", "order": 6},
        {"name": "Отправлен",        "color": "#27ae60", "order": 7},
        {"name": "Доставлен",        "color": "#16a085", "order": 8},
        {"name": "Завершён",         "color": "#2c3e50", "order": 9},
        {"name": "Отказ",            "color": "#e74c3c", "order": 10},
        {"name": "Возврат",          "color": "#c0392b", "order": 11},
    ],

    # Статусы заказов
    "order_statuses": [
        {"name": "Новый",                "color": "#3498db"},
        {"name": "Подтверждён",           "color": "#2ecc71"},
        {"name": "Комплектуется",         "color": "#f39c12"},
        {"name": "Передан в доставку",    "color": "#9b59b6"},
        {"name": "В пути",               "color": "#1abc9c"},
        {"name": "Доставлен",            "color": "#27ae60"},
        {"name": "Выполнен",             "color": "#2c3e50"},
        {"name": "Отменён",              "color": "#e74c3c"},
        {"name": "Возврат",              "color": "#c0392b"},
    ],

    # Дополнительные поля клиента (кастомные)
    "custom_customer_fields": [
        {"key": "instagram",      "label": "Instagram",         "type": "str"},
        {"key": "telegram",       "label": "Telegram",          "type": "str"},
        {"key": "whatsapp",       "label": "WhatsApp",          "type": "str"},
        {"key": "birthday",       "label": "День рождения",     "type": "date"},
        {"key": "size",           "label": "Размер",            "type": "str"},
        {"key": "preference",     "label": "Предпочтения",      "type": "text"},
        {"key": "discount",       "label": "Скидка %",          "type": "float"},
        {"key": "loyalty_level",  "label": "Уровень лояльности", "type": "str"},
        {"key": "referral",       "label": "Кто привёл",         "type": "str"},
        {"key": "total_orders",   "label": "Всего заказов",      "type": "int"},
        {"key": "total_spent",    "label": "Всего потрачено",    "type": "float"},
    ],

    # Дополнительные поля заказа (кастомные)
    "custom_order_fields": [
        {"key": "promo_code",     "label": "Промокод",          "type": "str"},
        {"key": "gift_wrap",      "label": "Подарочная упаковка", "type": "bool"},
        {"key": "urgency",        "label": "Срочность",          "type": "str"},
        {"key": "weight",         "label": "Вес (кг)",           "type": "float"},
    ],

    # Теги — предустановленные категории
    "tags": {
        "sources": ["VK", "Instagram", "WhatsApp", "Telegram", "Одноклассники", "Сайт", "Реклама"],
        "customer_type": ["Новый клиент", "Постоянный", "VIP", "Оптовик", "Проблемный"],
        "interests": ["Акции", "Новинки", "Распродажа", "Предзаказ"],
        "actions": ["Перезвонить", "Отправить КП", "Дожим", "Ожидает оплату", "Рекламация"],
        "auto_tags": [
            "Запретил сообщения",
            "Не отвечает 3 дня",
            "Повторная покупка",
            "Крупный заказ",
        ],
    },

    # Быстрые фразы (скрипты) с переменными
    # Переменные: {name}, {lastName}, {fullName}, {orderId}, {orderTotal},
    #             {trackNumber}, {deliveryService}, {phone}, {manager},
    #             {crmStatus}, {date}, {nextContactDate}
    "quick_phrases": {
        "Приветствие": [
            {
                "name": "Приветствие",
                "text": "Здравствуйте, {name}! Рады видеть вас. Чем могу помочь?",
                "hotkey": "F1",
            },
            {
                "name": "Повторный визит",
                "text": "Здравствуйте, {name}! Рады видеть вас снова. Как ваш предыдущий заказ?",
                "hotkey": "F2",
            },
        ],
        "Заказ": [
            {
                "name": "Принят",
                "text": "{name}, ваш заказ #{orderId} на сумму {orderTotal} руб. принят! Ожидайте подтверждение.",
                "hotkey": "",
            },
            {
                "name": "Отправлен",
                "text": "{name}, ваш заказ #{orderId} отправлен через {deliveryService}! Трек-номер: {trackNumber}. Отслеживать можно на сайте службы доставки.",
                "hotkey": "",
            },
            {
                "name": "Доставлен",
                "text": "{name}, ваш заказ #{orderId} доставлен! Пожалуйста, проверьте содержимое. Если всё хорошо — будем рады отзыву!",
                "hotkey": "",
            },
        ],
        "Оплата": [
            {
                "name": "Реквизиты",
                "text": "{name}, для оплаты заказа #{orderId} на сумму {orderTotal} руб. используйте:\nКарта: XXXX XXXX XXXX XXXX\nПолучатель: ИП Иванов И.И.\nВ комментарии укажите номер заказа.",
                "hotkey": "",
            },
            {
                "name": "Напоминание об оплате",
                "text": "{name}, напоминаю о неоплаченном заказе #{orderId} на сумму {orderTotal} руб. Если возникли вопросы — пишите, с радостью помогу!",
                "hotkey": "",
            },
        ],
        "Доставка": [
            {
                "name": "Уточнение адреса",
                "text": "{name}, подскажите, пожалуйста, полный адрес доставки (индекс, город, улица, дом, квартира) и удобный номер телефона для курьера.",
                "hotkey": "",
            },
            {
                "name": "Трек-номер",
                "text": "{name}, трек-номер вашей посылки: {trackNumber}. Служба доставки: {deliveryService}.",
                "hotkey": "",
            },
        ],
        "Дожим": [
            {
                "name": "Мягкий дожим",
                "text": "{name}, добрый день! Вы интересовались нашим товаром. Могу я чем-то помочь? У нас сейчас действуют выгодные условия.",
                "hotkey": "",
            },
            {
                "name": "Ограниченное предложение",
                "text": "{name}, спешу напомнить — скидка/акция действует ещё ограниченное время. Успейте заказать по выгодной цене!",
                "hotkey": "",
            },
        ],
        "Проблемы": [
            {
                "name": "Извинение",
                "text": "{name}, приносим извинения за неудобства. Мы уже разбираемся в ситуации. Обязательно вернусь с решением в ближайшее время.",
                "hotkey": "",
            },
            {
                "name": "Возврат",
                "text": "{name}, по вашей заявке на возврат — средства будут возвращены в течение 3-5 рабочих дней. Если есть вопросы — пишите.",
                "hotkey": "",
            },
        ],
        "Завершение": [
            {
                "name": "Спасибо за покупку",
                "text": "{name}, спасибо за покупку! Будем рады видеть вас снова. Если понравилось — будем благодарны за отзыв!",
                "hotkey": "",
            },
            {
                "name": "Прощание",
                "text": "{name}, если будут вопросы — пишите в любое время. Хорошего дня!",
                "hotkey": "",
            },
        ],
    },

    # Автоматизация — правила (упрощённый формат, аналог JSON-ботов)
    "automation_rules": [
        {
            "name": "Автостатус: Новый клиент",
            "trigger": "new_customer",
            "actions": [
                {"type": "set_crm_status", "value": "Новый"},
                {"type": "add_tag", "value": "Новый клиент"},
                {"type": "set_next_contact", "value": "+1d"},
            ],
        },
        {
            "name": "Автостатус: Оплата получена",
            "trigger": "payment_received",
            "actions": [
                {"type": "set_crm_status", "value": "Оплачен"},
                {"type": "set_order_status", "value": "Подтверждён"},
                {"type": "remove_tag", "value": "Ожидает оплату"},
            ],
        },
        {
            "name": "Автотег: Нет ответа 3 дня",
            "trigger": "no_reply_3d",
            "actions": [
                {"type": "add_tag", "value": "Не отвечает 3 дня"},
                {"type": "set_crm_status", "value": "Ожидает ответа"},
            ],
        },
        {
            "name": "Автоуведомление: заказ отправлен",
            "trigger": "order_status_change",
            "condition": {"order_status": "Передан в доставку"},
            "actions": [
                {"type": "send_phrase", "value": "Заказ/Отправлен"},
                {"type": "set_crm_status", "value": "Отправлен"},
            ],
        },
    ],

    # Службы доставки
    "delivery_services": [
        {"name": "СДЭК",           "tracking_url": "https://www.cdek.ru/tracking?order_id={trackNumber}"},
        {"name": "Почта России",    "tracking_url": "https://www.pochta.ru/tracking#{trackNumber}"},
        {"name": "Boxberry",        "tracking_url": "https://boxberry.ru/tracking-page?id={trackNumber}"},
        {"name": "DPD",             "tracking_url": "https://www.dpd.ru/ols/trace2/parcel.do2?parcelNumber={trackNumber}"},
        {"name": "PickPoint",       "tracking_url": ""},
        {"name": "Курьер",          "tracking_url": ""},
        {"name": "Самовывоз",       "tracking_url": ""},
    ],

    # Способы оплаты
    "payment_methods": [
        "Перевод на карту",
        "Наличные курьеру",
        "Онлайн-оплата",
        "Наложенный платёж",
        "Счёт для юр. лица",
    ],

    # Источники трафика
    "traffic_sources": [
        "VK — органика",
        "VK — таргет",
        "VK — рассылка",
        "Instagram — органика",
        "Instagram — реклама",
        "WhatsApp",
        "Telegram",
        "Одноклассники",
        "Сайт",
        "Рекомендация",
        "Другое",
    ],

    # Менеджеры (заполнять реальными данными)
    "managers": [],
}


# ─── Загрузка / Сохранение конфига ───────────────────

def load_config(path: str = CONFIG_FILE) -> dict:
    """Load config from JSON file. Falls back to DEFAULT_CONFIG."""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        # Merge with defaults for any missing keys
        config = {**DEFAULT_CONFIG, **loaded}
        return config
    return DEFAULT_CONFIG.copy()


def save_config(config: dict, path: str = CONFIG_FILE):
    """Save config to JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


# ─── Быстрые фразы — движок подстановки ─────────────

def render_phrase(
    template: str,
    customer: Optional[dict] = None,
    order: Optional[dict] = None,
    extra: Optional[dict] = None,
) -> str:
    """Render a quick phrase template with variable substitution.

    Available variables:
      {name}             — имя клиента
      {lastName}         — фамилия
      {fullName}         — имя + фамилия
      {phone}            — телефон
      {email}            — email
      {city}             — город
      {manager}          — менеджер
      {crmStatus}        — CRM-статус
      {orderId}          — номер заказа
      {orderTotal}       — сумма заказа
      {trackNumber}      — трек-номер
      {deliveryService}  — служба доставки
      {date}             — текущая дата
      {nextContactDate}  — дата следующего контакта
      {any_custom_field} — любое доп. поле
    """
    c = customer or {}
    o = order or {}

    name = c.get("name", c.get("firstName", ""))
    last_name = c.get("lastName", "")
    manager = c.get("manager", {})
    manager_name = manager.get("login", "") if isinstance(manager, dict) else str(manager)
    crm_status = c.get("crmStatus", {})
    crm_status_name = crm_status.get("name", "") if isinstance(crm_status, dict) else str(crm_status)

    order_status = o.get("status", {})
    order_status_name = order_status.get("name", "") if isinstance(order_status, dict) else str(order_status)

    variables = {
        "name": name,
        "lastName": last_name,
        "fullName": f"{name} {last_name}".strip(),
        "phone": c.get("phone", ""),
        "email": c.get("email", ""),
        "city": c.get("city", ""),
        "manager": manager_name,
        "crmStatus": crm_status_name,
        "orderId": str(o.get("id", o.get("internalNumber", ""))),
        "orderTotal": str(o.get("totalPrice", o.get("total", ""))),
        "orderStatus": order_status_name,
        "trackNumber": o.get("trackNumber", ""),
        "deliveryService": o.get("deliveryService", ""),
        "date": datetime.now().strftime("%d.%m.%Y"),
        "nextContactDate": c.get("nextContactDate", ""),
    }

    # Add extra vars
    if extra:
        variables.update(extra)

    # Add custom fields from customer
    for k, v in c.items():
        if k not in variables:
            variables[k] = str(v) if v is not None else ""

    # Substitute {variable} patterns
    def replacer(match):
        key = match.group(1)
        return variables.get(key, match.group(0))

    return re.sub(r"\{(\w+)\}", replacer, template)


def get_phrase(group: str, phrase_name: str, config: Optional[dict] = None) -> Optional[str]:
    """Get a quick phrase template by group and name."""
    cfg = config or load_config()
    phrases = cfg.get("quick_phrases", {})
    group_phrases = phrases.get(group, [])
    for p in group_phrases:
        if p["name"] == phrase_name:
            return p["text"]
    return None


def list_phrases(config: Optional[dict] = None) -> dict:
    """List all quick phrase groups and their phrases."""
    cfg = config or load_config()
    result = {}
    for group, phrases in cfg.get("quick_phrases", {}).items():
        result[group] = [
            {"name": p["name"], "hotkey": p.get("hotkey", ""), "preview": p["text"][:60]}
            for p in phrases
        ]
    return result


# ─── Управление CRM-статусами ───────────────────────

def get_crm_statuses(config: Optional[dict] = None) -> list[dict]:
    cfg = config or load_config()
    return cfg.get("crm_statuses", [])


def add_crm_status(name: str, color: str = "#888888", config: Optional[dict] = None) -> list[dict]:
    cfg = config or load_config()
    statuses = cfg.get("crm_statuses", [])
    max_order = max((s.get("order", 0) for s in statuses), default=0)
    statuses.append({"name": name, "color": color, "order": max_order + 1})
    cfg["crm_statuses"] = statuses
    save_config(cfg)
    return statuses


# ─── Управление статусами заказов ────────────────────

def get_order_statuses(config: Optional[dict] = None) -> list[dict]:
    cfg = config or load_config()
    return cfg.get("order_statuses", [])


def add_order_status(name: str, color: str = "#888888", config: Optional[dict] = None) -> list[dict]:
    cfg = config or load_config()
    statuses = cfg.get("order_statuses", [])
    statuses.append({"name": name, "color": color})
    cfg["order_statuses"] = statuses
    save_config(cfg)
    return statuses


# ─── Управление тегами ──────────────────────────────

def get_tags(config: Optional[dict] = None) -> dict:
    cfg = config or load_config()
    return cfg.get("tags", {})


def add_tag(category: str, tag: str, config: Optional[dict] = None):
    cfg = config or load_config()
    tags = cfg.get("tags", {})
    if category not in tags:
        tags[category] = []
    if tag not in tags[category]:
        tags[category].append(tag)
    cfg["tags"] = tags
    save_config(cfg)


# ─── Управление кастомными полями ────────────────────

def get_custom_fields(entity: str = "customer", config: Optional[dict] = None) -> list[dict]:
    """Get custom fields for 'customer' or 'order'."""
    cfg = config or load_config()
    key = f"custom_{entity}_fields"
    return cfg.get(key, [])


def add_custom_field(
    entity: str,
    key: str,
    label: str,
    field_type: str = "str",
    config: Optional[dict] = None,
):
    """Add a custom field to customer or order."""
    cfg = config or load_config()
    config_key = f"custom_{entity}_fields"
    fields = cfg.get(config_key, [])
    # Check for duplicate key
    if any(f["key"] == key for f in fields):
        return fields
    fields.append({"key": key, "label": label, "type": field_type})
    cfg[config_key] = fields
    save_config(cfg)
    return fields


# ─── Управление быстрыми фразами ────────────────────

def add_phrase(group: str, name: str, text: str, hotkey: str = "", config: Optional[dict] = None):
    """Add a quick phrase to a group."""
    cfg = config or load_config()
    phrases = cfg.get("quick_phrases", {})
    if group not in phrases:
        phrases[group] = []
    phrases[group].append({"name": name, "text": text, "hotkey": hotkey})
    cfg["quick_phrases"] = phrases
    save_config(cfg)


def remove_phrase(group: str, name: str, config: Optional[dict] = None):
    """Remove a quick phrase from a group."""
    cfg = config or load_config()
    phrases = cfg.get("quick_phrases", {})
    if group in phrases:
        phrases[group] = [p for p in phrases[group] if p["name"] != name]
    cfg["quick_phrases"] = phrases
    save_config(cfg)


# ─── Полная структура для отображения ────────────────

def get_full_schema() -> dict:
    """Get complete schema: standard fields + custom fields + statuses + tags + phrases."""
    config = load_config()
    return {
        "customer_standard_fields": CUSTOMER_STANDARD_FIELDS,
        "customer_custom_fields": config.get("custom_customer_fields", []),
        "order_standard_fields": ORDER_STANDARD_FIELDS,
        "order_custom_fields": config.get("custom_order_fields", []),
        "crm_statuses": config.get("crm_statuses", []),
        "order_statuses": config.get("order_statuses", []),
        "tags": config.get("tags", {}),
        "quick_phrases": list_phrases(config),
        "delivery_services": config.get("delivery_services", []),
        "payment_methods": config.get("payment_methods", []),
        "traffic_sources": config.get("traffic_sources", []),
        "automation_rules": config.get("automation_rules", []),
        "managers": config.get("managers", []),
    }
