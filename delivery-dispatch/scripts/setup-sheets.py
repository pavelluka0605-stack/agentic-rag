#!/usr/bin/env python3
"""
Setup Google Sheets for Delivery Dispatch v5.
Creates two sheets: Заказы (orders) and Настройки (settings).

Usage (via GitHub Actions sheets-manage.yml or directly):
  python3 setup-sheets.py

Requires env vars:
  GOOGLE_SA_JSON - Service Account JSON (raw or base64)
  SPREADSHEET_ID - Google Spreadsheet ID
"""

import json
import os
import sys
import base64
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request


def get_credentials():
    raw = os.environ["GOOGLE_SA_JSON"]
    try:
        sa_info = json.loads(raw)
    except json.JSONDecodeError:
        sa_info = json.loads(base64.b64decode(raw))
    creds = service_account.Credentials.from_service_account_info(
        sa_info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    creds.refresh(Request())
    return creds


def sheets_api(creds, method, path, body=None):
    sid = os.environ["SPREADSHEET_ID"]
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sid}{path}"
    headers = {
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
    }
    if method == "GET":
        resp = requests.get(url, headers=headers)
    elif method == "POST":
        resp = requests.post(url, headers=headers, json=body)
    elif method == "PUT":
        resp = requests.put(url, headers=headers, json=body)
    else:
        raise ValueError(f"Unknown method: {method}")
    resp.raise_for_status()
    return resp.json()


def get_existing_sheets(creds):
    data = sheets_api(creds, "GET", "")
    return {s["properties"]["title"]: s["properties"]["sheetId"] for s in data["sheets"]}


def create_sheet(creds, title):
    body = {
        "requests": [
            {
                "addSheet": {
                    "properties": {
                        "title": title,
                        "gridProperties": {"frozenRowCount": 1},
                    }
                }
            }
        ]
    }
    result = sheets_api(creds, "POST", ":batchUpdate", body)
    sheet_id = result["replies"][0]["addSheet"]["properties"]["sheetId"]
    print(f"  Created sheet '{title}' (ID: {sheet_id})")
    return sheet_id


def setup_orders_sheet(creds):
    """Create Доставка_Заказы sheet with headers and formatting."""
    sheet_name = "Доставка_Заказы"
    existing = get_existing_sheets(creds)

    if sheet_name in existing:
        print(f"  Sheet '{sheet_name}' already exists (ID: {existing[sheet_name]})")
        sheet_id = existing[sheet_name]
    else:
        sheet_id = create_sheet(creds, sheet_name)

    # Headers (A-AA = 27 columns)
    headers = [
        "order_id",          # A
        "created_at",        # B
        "client_name",       # C
        "phone",             # D
        "city_to",           # E
        "address",           # F
        "postal_code",       # G
        "length_cm",         # H
        "width_cm",          # I
        "height_cm",         # J
        "weight_kg",         # K
        "declared_value",    # L
        "status",            # M
        "yandex_price",      # N
        "yandex_days",       # O
        "ozon_price",        # P
        "ozon_days",         # Q
        "best_carrier",      # R
        "best_price",        # S
        "chosen_carrier",    # T
        "track_number",      # U
        "label_file",        # V
        "tracking_url",      # W
        "message_for_client",  # X
        "vk_dialog_url",     # Y
        "notes",             # Z
        "updated_at",        # AA
    ]

    # Write headers
    sid = os.environ["SPREADSHEET_ID"]
    range_str = f"'{sheet_name}'!A1:AA1"
    body = {"values": [headers]}
    sheets_api(creds, "PUT", f"/values/{range_str}?valueInputOption=RAW", body)
    print(f"  Headers written ({len(headers)} columns)")

    # Format header row (bold, background color, freeze)
    requests_batch = [
        # Bold header
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True},
                        "backgroundColor": {
                            "red": 0.85,
                            "green": 0.92,
                            "blue": 1.0,
                        },
                    }
                },
                "fields": "userEnteredFormat(textFormat,backgroundColor)",
            }
        },
        # Auto-resize columns
        {
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": len(headers),
                }
            }
        },
        # Data validation for status column (M = index 12)
        {
            "setDataValidation": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": 1000,
                    "startColumnIndex": 12,
                    "endColumnIndex": 13,
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": [
                            {"userEnteredValue": "Новый"},
                            {"userEnteredValue": "Расчёт"},
                            {"userEnteredValue": "Рассчитан"},
                            {"userEnteredValue": "Оформляется"},
                            {"userEnteredValue": "Оформлен"},
                            {"userEnteredValue": "Ошибка"},
                        ],
                    },
                    "strict": True,
                    "showCustomUi": True,
                },
            }
        },
        # Conditional formatting: status = "Новый" → yellow
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [
                        {
                            "sheetId": sheet_id,
                            "startRowIndex": 1,
                            "endRowIndex": 1000,
                            "startColumnIndex": 12,
                            "endColumnIndex": 13,
                        }
                    ],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": "Новый"}],
                        },
                        "format": {
                            "backgroundColor": {
                                "red": 1.0,
                                "green": 0.95,
                                "blue": 0.6,
                            }
                        },
                    },
                },
                "index": 0,
            }
        },
        # Conditional formatting: status = "Оформлен" → green
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [
                        {
                            "sheetId": sheet_id,
                            "startRowIndex": 1,
                            "endRowIndex": 1000,
                            "startColumnIndex": 12,
                            "endColumnIndex": 13,
                        }
                    ],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": "Оформлен"}],
                        },
                        "format": {
                            "backgroundColor": {
                                "red": 0.72,
                                "green": 0.88,
                                "blue": 0.72,
                            }
                        },
                    },
                },
                "index": 1,
            }
        },
        # Conditional formatting: status = "Ошибка" → red
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [
                        {
                            "sheetId": sheet_id,
                            "startRowIndex": 1,
                            "endRowIndex": 1000,
                            "startColumnIndex": 12,
                            "endColumnIndex": 13,
                        }
                    ],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": "Ошибка"}],
                        },
                        "format": {
                            "backgroundColor": {
                                "red": 0.96,
                                "green": 0.70,
                                "blue": 0.70,
                            }
                        },
                    },
                },
                "index": 2,
            }
        },
    ]

    sheets_api(creds, "POST", ":batchUpdate", {"requests": requests_batch})
    print(f"  Formatting applied (bold header, status validation, conditional colors)")
    return sheet_id


def setup_settings_sheet(creds):
    """Create Доставка_Настройки sheet with default settings."""
    sheet_name = "Доставка_Настройки"
    existing = get_existing_sheets(creds)

    if sheet_name in existing:
        print(f"  Sheet '{sheet_name}' already exists (ID: {existing[sheet_name]})")
        sheet_id = existing[sheet_name]
    else:
        sheet_id = create_sheet(creds, sheet_name)

    # Settings data
    settings = [
        ["Параметр", "Значение", "Описание"],
        ["city_from", "Красноярск", "Город отправки"],
        ["postal_code_from", "660000", "Индекс отправки"],
        ["sender_name", "", "ИП / ФИО отправителя"],
        ["sender_phone", "", "Телефон отправителя +7..."],
        ["sender_address", "Красноярск, Борисова 30", "Адрес пункта выдачи (Озон/Яндекс)"],
        ["price_rule", "cheapest_or_fastest_if_diff_under_50", "Правило выбора СД"],
        ["sheet_url", "", "Ссылка на эту таблицу"],
        ["check_interval_min", "5", "Интервал проверки новых заказов (мин)"],
        ["yandex_enabled", "true", "Использовать Яндекс Доставку"],
        ["ozon_enabled", "true", "Использовать Озон Посылку"],
    ]

    sid = os.environ["SPREADSHEET_ID"]
    range_str = f"'{sheet_name}'!A1:C{len(settings)}"
    body = {"values": settings}
    sheets_api(creds, "PUT", f"/values/{range_str}?valueInputOption=RAW", body)
    print(f"  Settings written ({len(settings) - 1} parameters)")

    # Format header
    requests_batch = [
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True},
                        "backgroundColor": {
                            "red": 0.85,
                            "green": 0.92,
                            "blue": 1.0,
                        },
                    }
                },
                "fields": "userEnteredFormat(textFormat,backgroundColor)",
            }
        },
        {
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": 3,
                }
            }
        },
    ]
    sheets_api(creds, "POST", ":batchUpdate", {"requests": requests_batch})
    print(f"  Formatting applied")
    return sheet_id


def main():
    print("=== Delivery Dispatch v5 — Google Sheets Setup ===\n")
    creds = get_credentials()

    print("[1/2] Setting up Доставка_Заказы...")
    setup_orders_sheet(creds)

    print("\n[2/2] Setting up Доставка_Настройки...")
    setup_settings_sheet(creds)

    print("\n=== Done! Sheets are ready. ===")


if __name__ == "__main__":
    main()
