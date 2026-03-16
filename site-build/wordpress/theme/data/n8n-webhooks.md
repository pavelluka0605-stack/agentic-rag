# n8n Webhook Endpoints for Form Processing

**Base URL:** Stored in WordPress `wp_options` key `kuhni_rema_n8n_url`
**Example:** `https://n8n.marbomebel.ru/`

The WordPress AJAX handler (`kuhni_rema_handle_form` in `functions.php`) sends form submissions as JSON POST requests to these webhook paths.

---

## Webhook Endpoints

### 1. `webhook/quiz-lead` — Quiz Form Submissions

**Trigger:** `form_type = "quiz"`

**Expected Payload:**

```json
{
  "form_type": "quiz",
  "name": "Иван Петров",
  "phone": "+7 (391) 123-45-67",
  "page_url": "https://кухнирема.рф/kalkulyator/",
  "utm_source": "yandex",
  "utm_medium": "cpc",
  "utm_campaign": "kuhni_krasnoyarsk",
  "timestamp": "2026-03-16 14:30:00"
}
```

**Note:** Quiz-specific answers (kitchen type, material, budget) may be added to the payload in future iterations.

**Recommended n8n Workflow Actions:**
1. **Save to Google Sheets** — Append row to sheet "Заявки_квиз" with all fields.
2. **Send Telegram notification** — Message to manager with name, phone, page URL, UTM data.
3. **Send email confirmation** — Optional auto-reply to the client (requires email field in future).

---

### 2. `webhook/zamer-lead` — Measurement Request Form

**Trigger:** `form_type = "zamer"`

**Expected Payload:**

```json
{
  "form_type": "zamer",
  "name": "Мария Сидорова",
  "phone": "+7 (391) 987-65-43",
  "address": "ул. Ленина, д. 10, кв. 25",
  "preferred_time": "Утро (9:00-12:00)",
  "page_url": "https://кухнирема.рф/kontakty/",
  "utm_source": "",
  "utm_medium": "",
  "utm_campaign": "",
  "timestamp": "2026-03-16 10:15:00"
}
```

**Additional Fields:**
- `address` — Client's address for the measurement visit.
- `preferred_time` — Preferred time slot for the visit.

**Recommended n8n Workflow Actions:**
1. **Save to Google Sheets** — Append row to sheet "Заявки_замер" with all fields including address and preferred time.
2. **Send Telegram notification** — Urgent message to manager (measurement requests are high priority).
3. **Send email confirmation** — Confirmation to admin with address details.

---

### 3. `webhook/competitor-project` — Competitor Project Upload Form

**Trigger:** `form_type = "competitor_project"`

**Expected Payload:**

```json
{
  "form_type": "competitor_project",
  "name": "Алексей",
  "phone": "+7 (391) 555-12-34",
  "page_url": "https://кухнирема.рф/",
  "utm_source": "",
  "utm_medium": "",
  "utm_campaign": "",
  "timestamp": "2026-03-16 16:45:00"
}
```

**Note:** File uploads (competitor project images) are handled separately by WordPress media upload; the webhook receives metadata only.

**Recommended n8n Workflow Actions:**
1. **Save to Google Sheets** — Append row to sheet "Заявки_проект" with all fields.
2. **Send Telegram notification** — Message to manager about competitor project analysis request.
3. **Send email confirmation** — Admin notification.

---

### 4. `webhook/callback` — Callback Request Form

**Trigger:** `form_type = "callback"`

**Expected Payload:**

```json
{
  "form_type": "callback",
  "name": "",
  "phone": "+7 (391) 111-22-33",
  "page_url": "https://кухнирема.рф/catalog/",
  "utm_source": "vk",
  "utm_medium": "social",
  "utm_campaign": "",
  "timestamp": "2026-03-16 12:00:00"
}
```

**Note:** Callback forms are minimal -- often only phone is provided, name may be empty.

**Recommended n8n Workflow Actions:**
1. **Save to Google Sheets** — Append row to sheet "Заявки_callback".
2. **Send Telegram notification** — Immediate alert to manager for quick callback.
3. **Send email confirmation** — Admin notification.

---

### 5. `webhook/quick-lead` — Quick Contact Form (Default)

**Trigger:** `form_type = "quick"` or any unrecognized form type (fallback).

**Expected Payload:**

```json
{
  "form_type": "quick",
  "name": "Елена",
  "phone": "+7 (391) 333-44-55",
  "page_url": "https://кухнирема.рф/kuhnya-moderna/",
  "utm_source": "",
  "utm_medium": "",
  "utm_campaign": "",
  "timestamp": "2026-03-16 09:30:00"
}
```

**Recommended n8n Workflow Actions:**
1. **Save to Google Sheets** — Append row to sheet "Заявки_быстрые".
2. **Send Telegram notification** — Standard lead notification to manager.
3. **Send email confirmation** — Admin notification.

---

## Common Payload Fields

All webhooks receive these base fields:

| Field          | Type   | Required | Description                                    |
|----------------|--------|----------|------------------------------------------------|
| `form_type`    | string | Yes      | Form identifier (quiz, zamer, callback, etc.)  |
| `name`         | string | No       | Client name (may be empty)                     |
| `phone`        | string | Yes      | Client phone number                            |
| `page_url`     | string | No       | URL of the page where form was submitted       |
| `utm_source`   | string | No       | UTM source parameter                           |
| `utm_medium`   | string | No       | UTM medium parameter                           |
| `utm_campaign` | string | No       | UTM campaign parameter                         |
| `timestamp`    | string | Yes      | Server-side timestamp (MySQL format)           |

---

## WordPress Configuration

The n8n base URL is stored in `wp_options`:

```php
// Set via WordPress admin or WP-CLI:
update_option( 'kuhni_rema_n8n_url', 'https://n8n.marbomebel.ru/' );

// Read in the form handler:
$n8n_base = get_option( 'kuhni_rema_n8n_url', '' );
$webhook_url = trailingslashit( $n8n_base ) . 'webhook/quiz-lead';
```

If the n8n URL is not set or the webhook request fails, the form handler falls back to sending an email via `wp_mail()` to the WordPress admin email.

---

## Sample n8n Workflow

See `data/n8n-form-webhook.json` for a basic webhook receiver workflow that:
1. Receives POST JSON from any form type.
2. Formats a Telegram notification message.
3. Appends the lead data to a Google Sheets row.
