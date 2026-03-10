"""
BlueSales CRM Integration — Remote Control.

Полная интеграция с BlueSales CRM через API:
  - Клиенты: получение, создание, обновление, удаление
  - Заказы: получение, создание, обновление статуса
  - Пользователи (менеджеры): получение списка
  - Отправка сообщений: через Remote Control
  - Webhook: приём уведомлений из BlueSales
  - Синхронизация: автоматический импорт данных в память RAG

Требует PRO-аккаунт BlueSales.
Переменные окружения:
  BLUESALES_LOGIN    — логин BlueSales
  BLUESALES_PASSWORD — пароль BlueSales
"""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]

import memory_store
import bluesales_config

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────

BLUESALES_API_URL = "https://bluesales.ru/app/Customers/WebServer.aspx"
BLUESALES_LOGIN = os.environ.get("BLUESALES_LOGIN", "")
BLUESALES_PASSWORD = os.environ.get("BLUESALES_PASSWORD", "")

MAX_CUSTOMERS_PER_REQUEST = 500
MAX_ORDERS_PER_REQUEST = 500


# ─── Exceptions ──────────────────────────────────────

class BlueSalesError(Exception):
    """General BlueSales API error."""
    pass


class BlueSalesAuthError(BlueSalesError):
    """Authentication failed."""
    pass


class BlueSalesConnectionError(BlueSalesError):
    """Network / connection error."""
    pass


# ─── Low-level API ───────────────────────────────────

def _password_hash(password: str) -> str:
    """MD5 hash of password (BlueSales auth format)."""
    return hashlib.md5(password.encode("utf-8")).hexdigest().upper()


def _send_request(
    command: str,
    data: Optional[dict] = None,
    login: str = "",
    password: str = "",
    max_retries: int = 3,
) -> dict:
    """Send request to BlueSales API.

    Args:
        command: API method name (e.g. 'customers.get')
        data: JSON payload
        login: BlueSales login (or use env var)
        password: BlueSales password (or use env var)
        max_retries: retries on transient errors
    """
    if requests is None:
        raise BlueSalesError("requests library not installed. Run: pip install requests")

    login = login or BLUESALES_LOGIN
    password = password or BLUESALES_PASSWORD

    if not login or not password:
        raise BlueSalesAuthError(
            "BlueSales credentials not set. "
            "Set BLUESALES_LOGIN and BLUESALES_PASSWORD environment variables."
        )

    password_hash = _password_hash(password)

    params = {
        "login": login,
        "password": password_hash,
        "command": command,
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                BLUESALES_API_URL,
                params=params,
                data=json.dumps(data) if data else None,
                timeout=30,
            )
        except (ConnectionError, TimeoutError, requests.exceptions.RequestException) as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                logger.warning("BlueSales API connection error, retry in %ds: %s", wait, e)
                time.sleep(wait)
                continue
            raise BlueSalesConnectionError(f"Connection to BlueSales API failed: {e}") from e

        if resp.status_code == 404:
            raise BlueSalesError(f"Method '{command}' not found (404)")

        try:
            result = resp.json()
        except ValueError:
            raise BlueSalesError(f"Invalid JSON response: {resp.text[:200]}")

        # Handle BlueSales-specific errors
        if "isValid" in result and not result["isValid"]:
            error_msg = result.get("error", "Unknown error")

            if error_msg == "Неправильный логин или пароль.":
                raise BlueSalesAuthError(error_msg)

            # Another user is online — wait and retry
            if "Другой пользователь находится онлайн" in error_msg:
                try:
                    p1 = "<span class='countdown'>"
                    p2 = "</span>"
                    i1 = error_msg.index(p1) + len(p1)
                    i2 = error_msg.index(p2)
                    delay = int(error_msg[i1:i2]) + 1
                except (ValueError, IndexError):
                    delay = 30
                logger.info("Another user online. Waiting %ds...", delay)
                time.sleep(delay)
                continue

            raise BlueSalesError(f"BlueSales API error: {error_msg}")

        return result

    raise BlueSalesError("Max retries exceeded")


# ─── Customers API ───────────────────────────────────

def get_customers(
    first_contact_from: Optional[datetime] = None,
    first_contact_to: Optional[datetime] = None,
    next_contact_from: Optional[datetime] = None,
    next_contact_to: Optional[datetime] = None,
    last_contact_from: Optional[datetime] = None,
    last_contact_to: Optional[datetime] = None,
    ids: Optional[list[int]] = None,
    vk_ids: Optional[list[int]] = None,
    tags: Optional[list[str]] = None,
    managers: Optional[list] = None,
    sources: Optional[list] = None,
    phone: Optional[str] = None,
    count: int = 500,
    offset: int = 0,
    login: str = "",
    password: str = "",
) -> dict:
    """Get customers from BlueSales CRM.

    Returns dict with keys: count, notReturnedCount, customers
    """
    if count > MAX_CUSTOMERS_PER_REQUEST:
        count = MAX_CUSTOMERS_PER_REQUEST

    tags_payload = [{"name": t} for t in (tags or [])]

    managers_payload = []
    for m in (managers or []):
        if isinstance(m, int):
            managers_payload.append({"id": m})
        elif isinstance(m, str):
            managers_payload.append({"login": m})

    data = {
        "firstContactDateFrom": first_contact_from.strftime("%Y-%m-%d") if first_contact_from else None,
        "firstContactDateTill": (first_contact_to + timedelta(days=1)).strftime("%Y-%m-%d") if first_contact_to else None,
        "nextContactDateFrom": next_contact_from.strftime("%Y-%m-%d") if next_contact_from else None,
        "nextContactDateTill": (next_contact_to + timedelta(days=1)).strftime("%Y-%m-%d") if next_contact_to else None,
        "lastContactDateFrom": last_contact_from.strftime("%Y-%m-%d") if last_contact_from else None,
        "lastContactDateTill": (last_contact_to + timedelta(days=1)).strftime("%Y-%m-%d") if last_contact_to else None,
        "ids": ids,
        "vkIds": vk_ids,
        "pageSize": count,
        "startRowNumber": offset,
        "tags": tags_payload if tags_payload else None,
        "managers": managers_payload if managers_payload else None,
        "sources": sources,
        "phone": phone,
    }

    return _send_request("customers.get", data, login, password)


def get_all_customers(
    first_contact_from: Optional[datetime] = None,
    first_contact_to: Optional[datetime] = None,
    tags: Optional[list[str]] = None,
    managers: Optional[list] = None,
    login: str = "",
    password: str = "",
) -> list[dict]:
    """Get all customers with automatic pagination."""
    all_customers = []
    offset = 0

    while True:
        result = get_customers(
            first_contact_from=first_contact_from,
            first_contact_to=first_contact_to,
            tags=tags,
            managers=managers,
            count=MAX_CUSTOMERS_PER_REQUEST,
            offset=offset,
            login=login,
            password=password,
        )

        customers = result.get("customers", [])
        all_customers.extend(customers)

        returned = result.get("count", 0)
        not_returned = result.get("notReturnedCount", 0)

        if not_returned == 0 or returned == 0:
            break

        offset += returned

    return all_customers


def add_customer(customer_data: dict, login: str = "", password: str = "") -> dict:
    """Add a new customer to BlueSales.

    customer_data should contain fields like:
      name, phone, vkId, tags, source, etc.
    """
    return _send_request("customers.add", customer_data, login, password)


def update_customer(customer_data: dict, login: str = "", password: str = "") -> dict:
    """Update an existing customer in BlueSales."""
    return _send_request("customers.update", customer_data, login, password)


def add_customers_many(customers: list[dict], login: str = "", password: str = "") -> dict:
    """Batch add multiple customers."""
    return _send_request("customers.addMany", {"customers": customers}, login, password)


def update_customers_many(customers: list[dict], login: str = "", password: str = "") -> dict:
    """Batch update multiple customers."""
    return _send_request("customers.updateMany", {"customers": customers}, login, password)


def delete_customer(customer_id: int, login: str = "", password: str = "") -> dict:
    """Delete a customer by ID."""
    return _send_request("customers.delete", {"id": customer_id}, login, password)


# ─── Orders API ──────────────────────────────────────

def get_orders(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    order_statuses: Optional[list] = None,
    ids: Optional[list[int]] = None,
    internal_numbers: Optional[list[int]] = None,
    customer_id: Optional[int] = None,
    count: int = 500,
    offset: int = 0,
    login: str = "",
    password: str = "",
) -> dict:
    """Get orders from BlueSales.

    Returns dict with keys: count, notReturnedCount, orders
    """
    if count > MAX_ORDERS_PER_REQUEST:
        count = MAX_ORDERS_PER_REQUEST

    statuses_payload = []
    for s in (order_statuses or []):
        if isinstance(s, int):
            statuses_payload.append({"id": s})
        elif isinstance(s, str):
            statuses_payload.append({"name": s})

    data = {
        "dateFrom": date_from.strftime("%Y-%m-%d") if date_from else None,
        "dateTill": (date_to + timedelta(days=1)).strftime("%Y-%m-%d") if date_to else None,
        "orderStatuses": statuses_payload if statuses_payload else None,
        "customerId": customer_id,
        "ids": ids,
        "internalNumbers": internal_numbers,
        "pageSize": count,
        "startRowNumber": offset,
    }

    return _send_request("orders.get", data, login, password)


def get_all_orders(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    order_statuses: Optional[list] = None,
    customer_id: Optional[int] = None,
    login: str = "",
    password: str = "",
) -> list[dict]:
    """Get all orders with automatic pagination."""
    all_orders = []
    offset = 0

    while True:
        result = get_orders(
            date_from=date_from,
            date_to=date_to,
            order_statuses=order_statuses,
            customer_id=customer_id,
            count=MAX_ORDERS_PER_REQUEST,
            offset=offset,
            login=login,
            password=password,
        )

        orders = result.get("orders", [])
        all_orders.extend(orders)

        returned = result.get("count", 0)
        not_returned = result.get("notReturnedCount", 0)

        if not_returned == 0 or returned == 0:
            break

        offset += returned

    return all_orders


def add_order(order_data: dict, login: str = "", password: str = "") -> dict:
    """Add a new order."""
    return _send_request("orders.add", order_data, login, password)


def set_order_status(order_id: int, status: str, login: str = "", password: str = "") -> dict:
    """Update order status."""
    return _send_request("orders.setStatus", {"id": order_id, "status": status}, login, password)


def update_orders_many(orders: list[dict], login: str = "", password: str = "") -> dict:
    """Batch update multiple orders."""
    return _send_request("orders.updateMany", {"orders": orders}, login, password)


# ─── Users API ───────────────────────────────────────

def get_users(login: str = "", password: str = "") -> dict:
    """Get list of BlueSales users (managers)."""
    return _send_request("users.get", login=login, password=password)


# ─── Remote Control: Send Messages ──────────────────

def send_message(
    customer_id: int,
    message: str,
    login: str = "",
    password: str = "",
) -> dict:
    """Send a message to a customer via BlueSales Remote Control.

    This uses the BlueSales messaging API to send messages
    through the connected social network (VK, etc.).
    """
    data = {
        "customerId": customer_id,
        "message": message,
    }
    return _send_request("messages.send", data, login, password)


def send_message_by_vk_id(
    vk_id: int,
    message: str,
    login: str = "",
    password: str = "",
) -> dict:
    """Send a message to a customer by VK ID."""
    data = {
        "vkId": vk_id,
        "message": message,
    }
    return _send_request("messages.send", data, login, password)


# ─── Sync to RAG Memory ─────────────────────────────

def sync_customers_to_memory(
    project: str = "default",
    first_contact_from: Optional[datetime] = None,
    first_contact_to: Optional[datetime] = None,
    tags: Optional[list[str]] = None,
    login: str = "",
    password: str = "",
) -> list[dict]:
    """Sync BlueSales customers into RAG memory.

    Each customer is saved as a step with category='crm', kind='customer'.
    Returns list of saved steps.
    """
    customers = get_all_customers(
        first_contact_from=first_contact_from,
        first_contact_to=first_contact_to,
        tags=tags,
        login=login,
        password=password,
    )

    saved = []
    for c in customers:
        name = c.get("name", c.get("firstName", ""))
        last_name = c.get("lastName", "")
        full_name = f"{name} {last_name}".strip() or f"Customer #{c.get('id', '?')}"

        customer_tags = [t.get("name", t) if isinstance(t, dict) else str(t) for t in c.get("tags", [])]
        customer_tags.append("bluesales")

        vk_id = c.get("vkId", "")
        phone = c.get("phone", "")
        source = c.get("source", "")
        status = c.get("crmStatus", {})
        status_name = status.get("name", "") if isinstance(status, dict) else str(status)
        manager = c.get("manager", {})
        manager_name = manager.get("login", "") if isinstance(manager, dict) else str(manager)

        context_parts = []
        if vk_id:
            context_parts.append(f"VK: {vk_id}")
        if phone:
            context_parts.append(f"Phone: {phone}")
        if source:
            context_parts.append(f"Source: {source}")
        if status_name:
            context_parts.append(f"CRM Status: {status_name}")
        if manager_name:
            context_parts.append(f"Manager: {manager_name}")

        step = memory_store.add_step(
            action=f"customer: {full_name}",
            result=json.dumps(c, ensure_ascii=False, default=str)[:2000],
            status="success",
            context=" | ".join(context_parts),
            tags=customer_tags,
            project=project,
            source="bluesales",
            category="crm",
            kind="customer",
            priority=0,
        )
        saved.append(step)

    return saved


def sync_orders_to_memory(
    project: str = "default",
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    login: str = "",
    password: str = "",
) -> list[dict]:
    """Sync BlueSales orders into RAG memory.

    Each order is saved as a step with category='crm', kind='order'.
    """
    orders = get_all_orders(
        date_from=date_from,
        date_to=date_to,
        login=login,
        password=password,
    )

    saved = []
    for o in orders:
        order_id = o.get("id", o.get("internalNumber", "?"))
        customer_name = ""
        customer = o.get("customer", {})
        if customer:
            customer_name = f"{customer.get('name', '')} {customer.get('lastName', '')}".strip()

        status_info = o.get("status", {})
        status_name = status_info.get("name", "") if isinstance(status_info, dict) else str(status_info)

        total = o.get("totalPrice", o.get("total", 0))

        order_tags = ["bluesales", "order"]
        if status_name:
            order_tags.append(status_name)

        context_parts = []
        if customer_name:
            context_parts.append(f"Customer: {customer_name}")
        if status_name:
            context_parts.append(f"Status: {status_name}")
        if total:
            context_parts.append(f"Total: {total}")

        step = memory_store.add_step(
            action=f"order: #{order_id}" + (f" ({customer_name})" if customer_name else ""),
            result=json.dumps(o, ensure_ascii=False, default=str)[:2000],
            status="success",
            context=" | ".join(context_parts),
            tags=order_tags,
            project=project,
            source="bluesales",
            category="crm",
            kind="order",
            priority=0,
        )
        saved.append(step)

    return saved


def sync_all_to_memory(
    project: str = "default",
    days_back: int = 30,
    login: str = "",
    password: str = "",
) -> dict:
    """Full sync: customers + orders from last N days."""
    date_from = datetime.now() - timedelta(days=days_back)
    date_to = datetime.now()

    customers = sync_customers_to_memory(
        project=project,
        first_contact_from=date_from,
        first_contact_to=date_to,
        login=login,
        password=password,
    )

    orders = sync_orders_to_memory(
        project=project,
        date_from=date_from,
        date_to=date_to,
        login=login,
        password=password,
    )

    return {
        "customers_synced": len(customers),
        "orders_synced": len(orders),
        "total": len(customers) + len(orders),
        "period_days": days_back,
    }


# ─── Webhook Processing ─────────────────────────────

def process_webhook(payload: dict, project: str = "default") -> dict:
    """Process incoming webhook from BlueSales.

    Saves the event to RAG memory and returns the saved step.
    Expected payload fields:
      - event: event type (new_message, status_change, new_customer, etc.)
      - data: event-specific data
    """
    event_type = payload.get("event", "unknown")
    data = payload.get("data", {})

    # Determine kind and action based on event type
    event_mapping = {
        "new_message": ("message", "Новое сообщение"),
        "new_customer": ("customer", "Новый клиент"),
        "status_change": ("status_update", "Смена статуса"),
        "new_order": ("order", "Новый заказ"),
        "order_status_change": ("order_update", "Смена статуса заказа"),
        "tag_added": ("tag_event", "Добавлен тег"),
        "tag_removed": ("tag_event", "Удалён тег"),
    }

    kind, action_prefix = event_mapping.get(event_type, ("event", event_type))

    # Build human-readable description
    customer_name = ""
    if "customer" in data:
        c = data["customer"]
        customer_name = f"{c.get('name', '')} {c.get('lastName', '')}".strip()
    elif "customerName" in data:
        customer_name = data["customerName"]

    action = f"{action_prefix}: {customer_name}" if customer_name else action_prefix

    # Build context
    context_parts = [f"event={event_type}"]
    if "message" in data:
        context_parts.append(f"msg: {str(data['message'])[:100]}")
    if "status" in data:
        context_parts.append(f"status: {data['status']}")
    if "tag" in data:
        context_parts.append(f"tag: {data['tag']}")

    tags = ["bluesales", "webhook", event_type]

    step = memory_store.add_step(
        action=action,
        result=json.dumps(data, ensure_ascii=False, default=str)[:2000],
        status="success",
        context=" | ".join(context_parts),
        tags=tags,
        project=project,
        source="bluesales-webhook",
        category="crm",
        kind=kind,
        priority=1 if event_type in ("new_order", "new_customer") else 0,
    )

    return {
        "ok": True,
        "id": step["id"],
        "event": event_type,
        "action": action,
    }


# ─── Connection Test ─────────────────────────────────

def test_connection(login: str = "", password: str = "") -> dict:
    """Test BlueSales API connection by fetching users list."""
    try:
        result = get_users(login=login, password=password)
        users = result.get("users", [])
        return {
            "ok": True,
            "users_count": len(users),
            "users": [u.get("login", u.get("name", "?")) for u in users],
        }
    except BlueSalesAuthError as e:
        return {"ok": False, "error": f"Auth failed: {e}"}
    except BlueSalesConnectionError as e:
        return {"ok": False, "error": f"Connection failed: {e}"}
    except BlueSalesError as e:
        return {"ok": False, "error": str(e)}


# ─── Summary for RAG ────────────────────────────────

def send_quick_phrase(
    customer_id: int,
    phrase_group: str,
    phrase_name: str,
    customer_data: Optional[dict] = None,
    order_data: Optional[dict] = None,
    login: str = "",
    password: str = "",
) -> dict:
    """Send a quick phrase to a customer with variable substitution.

    1. Looks up the phrase template from config
    2. Fills in variables from customer/order data
    3. Sends via BlueSales API
    """
    template = bluesales_config.get_phrase(phrase_group, phrase_name)
    if not template:
        raise BlueSalesError(f"Phrase not found: {phrase_group}/{phrase_name}")

    rendered = bluesales_config.render_phrase(template, customer_data, order_data)
    result = send_message(customer_id, rendered, login, password)

    return {
        "ok": True,
        "phrase": phrase_name,
        "rendered_text": rendered,
        "api_result": result,
    }


# ─── Summary for RAG ────────────────────────────────

def get_crm_summary(project: str = "default") -> dict:
    """Get summary of CRM data stored in RAG memory."""
    all_crm = memory_store.get_by_category("crm", project)

    customers = [s for s in all_crm if s.get("kind") == "customer"]
    orders = [s for s in all_crm if s.get("kind") == "order"]
    messages = [s for s in all_crm if s.get("kind") == "message"]
    webhooks = [s for s in all_crm if s.get("source") == "bluesales-webhook"]

    return {
        "total_records": len(all_crm),
        "customers": len(customers),
        "orders": len(orders),
        "messages": len(messages),
        "webhook_events": len(webhooks),
    }
