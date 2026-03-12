# VK Comment Processor — Architecture & Implementation Guide

## 1. Architecture Options Comparison

### Option A: Enhanced N8N Workflows (Recommended)
**Essence:** Upgrade existing P0-03 + P0-07 N8N workflows with 5-category classification, dedup via Google Sheets lookup, proper error handling.

| Aspect | Value |
|--------|-------|
| Pros | Builds on working infra, no new runtime, visual debugging in N8N UI, fast to deploy |
| Cons | Complex JS code inside N8N nodes, limited testability, N8N restart = brief downtime |
| Complexity | Medium |
| Maintenance | Low (single N8N instance) |
| Cost | $0 extra (existing VPS) |
| Best when | Small team, existing N8N infra, < 1000 comments/day |

### Option B: Python Microservice + N8N Orchestration
**Essence:** Move classification + decision logic into Python service on VPS, N8N calls it via HTTP.

| Aspect | Value |
|--------|-------|
| Pros | Testable Python code, can use bluesales.py directly, proper error handling |
| Cons | Extra service to maintain, deploy complexity, need process manager |
| Complexity | High |
| Maintenance | Medium |
| Cost | $0 extra (same VPS) |
| Best when | High volume, need unit tests, team knows Python well |

### Option C: Standalone Python Service (replace N8N for this flow)
**Essence:** Dedicated Python FastAPI service with VK Long Poll → classify → act pipeline.

| Aspect | Value |
|--------|-------|
| Pros | Full control, proper testing, no N8N limitations |
| Cons | Duplicate infra, lose N8N visual debugging, more code to write |
| Complexity | High |
| Maintenance | High |
| Cost | $0 (same VPS) but more dev time |
| Best when | Enterprise scale, dedicated dev team |

### Option D: N8N + Redis/SQLite for State
**Essence:** Option A + lightweight state store for dedup and processing status.

| Aspect | Value |
|--------|-------|
| Pros | Proper idempotency, fast lookups, clean separation |
| Cons | Extra dependency (Redis/SQLite), more deploy complexity |
| Complexity | Medium-High |
| Maintenance | Medium |
| Cost | $0 (SQLite) or ~$5/mo (Redis) |
| Best when | High reliability requirements, > 500 comments/day |

---

## 2. Recommended Solution: Option A (Enhanced N8N Workflows)

**Why:** The system already runs N8N with working VK Long Poll → P0-03 → P0-07 pipeline. The volume is low (mebel shop, likely < 100 comments/day). Google Sheets serves as both data store and dedup source (lookup by comment_id before processing). This minimizes new infrastructure while delivering all required functionality.

**Upgrade path:** Start with Option A, migrate to Option D (add SQLite) if volume grows.

---

## 3. Assumptions

1. VK comment volume: < 200/day (furniture shop)
2. Acceptable processing latency: < 30 seconds from comment to reply
3. Google Sheets can handle dedup lookups (low volume)
4. BlueSales CRM uses `customers.add` + `orders.add` API (from bluesales.py)
5. Product info is in the VK post text (no separate product catalog DB)
6. Size-based products (clothing/furniture with sizes XS-XXL or custom dimensions)
7. Default quantity = 1 when not specified and intent is buy_complete
8. VK_USER_TOKEN will be a proper user token (not service token)
9. One Telegram chat for all notifications (can split later)
10. Russian language only for comments and replies

---

## 4. End-to-End Flow

```
VK User posts comment
        ↓
VK Long Poll Listener (community) detects event
        ↓
HTTP POST → N8N webhook /vk-events
        ↓
P0-03: VK Event Receiver
  ├─ Flatten body
  ├─ Switch by event type
  ├─ Extract comment fields
  ├─ Log to Логи_N8N
  ├─ Telegram: "New comment received"
  └─ HTTP POST → /vk-ai-process (P0-08)
        ↓
P0-08: VK Comment Processor (NEW - replaces P0-07)
  ├─ Flatten body
  ├─ DEDUP: Lookup comment_id in Спрос sheet
  │   ├─ Found → SKIP (already processed)
  │   └─ Not found → continue
  ├─ CONTEXT: Fetch VK post text via VK API
  ├─ CONTEXT: Fetch VK user name via VK API
  ├─ PRE-PARSE: Rule-based extraction (size, qty, keywords)
  ├─ AI CLASSIFY: GPT-4o with structured prompt
  ├─ PARSE AI RESPONSE: Extract structured fields
  ├─ DECISION ENGINE: Rules + AI output → action
  │   ├─ buy_complete (confidence ≥ 0.8)
  │   │   ├─ Write to Спрос (status: order_created)
  │   │   ├─ Create BlueSales customer
  │   │   ├─ VK Reply: order confirmation
  │   │   └─ Telegram: "Order created"
  │   ├─ buy_incomplete (confidence ≥ 0.6)
  │   │   ├─ Write to Спрос (status: clarification_requested)
  │   │   ├─ VK Reply: clarification question
  │   │   └─ Telegram: "Clarification sent"
  │   ├─ question (confidence ≥ 0.5)
  │   │   ├─ Write to Спрос (status: new_demand)
  │   │   ├─ VK Reply: answer/consultation
  │   │   └─ Telegram: "Question answered"
  │   ├─ clarification (confidence ≥ 0.5)
  │   │   ├─ Write to Спрос (status: clarification_requested)
  │   │   ├─ VK Reply: follow-up question
  │   │   └─ Telegram: "Clarification sent"
  │   └─ ignore
  │       ├─ Write to Спрос (status: ignored)
  │       └─ Telegram: "Ignored" (optional)
  └─ ERROR HANDLER: catch all
      ├─ Write to Спрос (status: error)
      └─ Telegram: "Error occurred"
```

---

## 5. Component/Module Architecture

### N8N Workflows:
- **P0-03** VK Event Receiver (existing, minor updates)
- **P0-08** VK Comment Processor (NEW, replaces P0-07)

### P0-08 Node Map:
```
Webhook: VK Comment
  → Flatten: Body
  → Dedup: Check Спрос
  → IF: Already Processed?
    → [yes] → Stop
    → [no] → Context: Fetch Post
             → Context: Fetch User
             → Pre-Parse: Rules
             → AI: Classify (GPT-4o)
             → Parse: AI Response
             → Decision: Route
               → [buy_complete] → BlueSales: Add Customer
                                → Sheets: Write Спрос
                                → VK: Reply Confirm
                                → TG: Order Created
               → [buy_incomplete] → Sheets: Write Спрос
                                  → VK: Reply Clarify
                                  → TG: Clarification
               → [question] → Sheets: Write Спрос
                            → VK: Reply Answer
                            → TG: Question
               → [clarification] → Sheets: Write Спрос
                                 → VK: Reply Follow-up
                                 → TG: Clarification
               → [ignore] → Sheets: Write Спрос
                          → TG: Ignored (debug)
```

---

## 6. Data Models and JSON Schemas

### 6.1 Incoming VK Comment Event (from P0-03 to P0-08)
```json
{
  "comment_id": 12345,
  "from_id": 67890,
  "post_id": 111,
  "owner_id": -137949809,
  "text": "Беру M 2 штуки",
  "date": "2026-03-12T10:30:00.000Z",
  "event_type": "photo_comment_new"
}
```

### 6.2 AI Classification Output Schema
```json
{
  "intent_type": "buy_complete",
  "confidence": 0.92,
  "product_name": "Футболка",
  "sku": "",
  "variant": "",
  "size": "M",
  "quantity": 2,
  "color": "",
  "customer_question": "",
  "missing_fields": [],
  "suggested_reply": "Спасибо за заказ! Футболка размер M, 2 шт. Для оформления напишите нам в ЛС.",
  "should_create_order": true,
  "should_write_demand": true
}
```

### 6.3 Google Sheets "Спрос" Schema
| Column | Type | Description |
|--------|------|-------------|
| ID_записи | string | `{post_id}_{comment_id}` — dedup key |
| created_at | datetime | ISO timestamp |
| vk_post_id | number | VK post ID |
| vk_comment_id | number | VK comment ID |
| vk_user_id | number | VK user ID |
| vk_user_name | string | User first+last name from VK API |
| comment_text | string | Original comment text |
| intent_type | string | buy_complete/buy_incomplete/question/clarification/ignore |
| confidence | number | 0..1 AI confidence score |
| product_name | string | Extracted product name |
| sku | string | Product SKU if determinable |
| size | string | Extracted size (XS/S/M/L/XL/XXL) |
| quantity | number | Extracted quantity |
| color | string | Extracted color |
| status | string | new_demand/clarification_requested/order_created/ignored/error |
| bluesales_order_id | string | BlueSales order/customer ID |
| reply_text | string | Text sent as VK reply |
| post_url | string | VK post URL |
| post_context | string | First 200 chars of post text |
| source | string | Always "vk_comment" |
| error_details | string | Error info if status=error |

### 6.4 State Machine
```
             ┌─────────────┐
     ┌───────│  incoming    │───────┐
     │       └─────────────┘       │
     ↓                             ↓
┌──────────┐               ┌──────────────┐
│ duplicate │               │  processing  │
│ (skip)    │               └──────────────┘
└──────────┘                ┌──────┼──────┐─────────┐
                            ↓      ↓      ↓         ↓
                    ┌───────┐ ┌────────┐ ┌────────┐ ┌───────┐
                    │order_ │ │clarif_ │ │new_    │ │ignored│
                    │created│ │request │ │demand  │ │       │
                    └───────┘ └────────┘ └────────┘ └───────┘
                                                        ↑
                                                   ┌────────┐
                                                   │ error   │
                                                   └────────┘
```

---

## 7. Decision Logic

### Confidence Thresholds
| Intent | Min Confidence | Action |
|--------|---------------|--------|
| buy_complete | ≥ 0.8 | Create order + reply |
| buy_complete | 0.6-0.8 | Treat as buy_incomplete |
| buy_incomplete | ≥ 0.6 | Ask clarification + reply |
| buy_incomplete | < 0.6 | Treat as question |
| question | ≥ 0.5 | Answer + reply |
| clarification | ≥ 0.5 | Ask follow-up + reply |
| ignore | any | Log only |

### Required Fields for Order Creation
- `from_id` (VK user ID) — always present
- `post_id` (which post/product) — always present
- `size` — REQUIRED for size-based products
- `quantity` — default to 1 if not specified (safe default for furniture)

### Decision Rules (applied AFTER AI classification)
```
Rule 1: IF intent=buy_complete AND confidence >= 0.8 AND size != ""
         THEN create_order=true
Rule 2: IF intent=buy_complete AND confidence >= 0.8 AND size == ""
         THEN downgrade to buy_incomplete, ask for size
Rule 3: IF intent=buy_complete AND confidence < 0.8
         THEN downgrade to buy_incomplete
Rule 4: IF intent=buy_incomplete
         THEN ask clarification, list missing fields
Rule 5: IF intent=question
         THEN answer using post context
Rule 6: IF intent=ignore AND confidence >= 0.7
         THEN skip silently
Rule 7: IF intent=ignore AND confidence < 0.7
         THEN treat as question (safety)
Rule 8: IF any external call fails
         THEN log error, send Telegram alert, DO NOT retry VK reply
```

---

## 8. Anti-Duplicate Strategy

### Primary Key: `{post_id}_{comment_id}`

### Dedup Flow:
1. Before processing, lookup `ID_записи` in Google Sheets "Спрос"
2. If found → SKIP processing entirely
3. If not found → proceed with processing
4. Write to Спрос as FIRST action after classification (before VK reply)
5. VK reply and BlueSales calls happen AFTER Sheets write

### Why Sheets-based dedup works here:
- Low volume (< 200 comments/day)
- Google Sheets API lookup is fast enough (< 1s)
- Acts as both storage and dedup source
- No extra infrastructure needed

### Edge Cases:
- N8N receives same event twice within ms → second execution will find row and skip
- VK Long Poll reconnect delivers old events → dedup catches them

---

## 9. Integration Contracts

### 9.1 BlueSales Adapter
```
Endpoint: POST https://bluesales.ru/app/Customers/WebServer.aspx
Auth: ?login=X&password=MD5_HASH&command=Y
Commands used:
  - customers.add — create customer from VK commenter
  - customers.get — check if customer exists (by vkId)
  - orders.add — create order (for buy_complete)

Customer payload:
{
  "vkId": "67890",
  "firstName": "Иван",
  "lastName": "Петров",
  "source": "VK комментарий",
  "tags": [{"name": "AI-заказ"}],
  "comment": "Автозаказ: Футболка M x2"
}

Order payload:
{
  "customerId": <from customers.add response>,
  "items": [{"name": "Футболка M", "count": 2}],
  "comment": "Из VK комментария #12345 под постом #111"
}

Error handling:
- "Другой пользователь онлайн" → retry after countdown
- Auth error → log + Telegram alert, do NOT retry
- Connection error → retry 3x with backoff
```

### 9.2 Google Sheets Adapter
```
Spreadsheet: 1i4R4GJuNJTTh1-KijKLToWFDASaHGgpqgirgyrl0iLY
Sheet: Спрос

Operations:
1. Lookup (dedup): GET rows where ID_записи = "{post_id}_{comment_id}"
2. Append: POST new row with full schema
3. Update: PATCH status field (e.g., from new_demand to order_created)
```

### 9.3 VK API Adapter
```
Base: https://api.vk.com/method/
Auth: access_token=VK_USER_TOKEN (user token, NOT service token!)
API version: v=5.199

Methods:
1. wall.createComment — reply to comment
   Params: owner_id, post_id, reply_to_comment, message, access_token

2. wall.getById — get post text for context
   Params: posts={owner_id}_{post_id}

3. users.get — get commenter name
   Params: user_ids={from_id}, fields=first_name,last_name

4. photos.getComments or wall.getComments — get thread context
```

### 9.4 Telegram Adapter
```
Base: https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage
Chat: TG_CHAT_ID

Error policy:
- Telegram failure MUST NOT break the core flow
- Use continueOnFail=true on Telegram nodes
- Log Telegram errors to Логи_N8N
```

---

## 10. Telegram Notification Design

### Notification 1: New Comment Received (from P0-03)
```
💬 Новый комментарий

📝 Пост: wall-137949809_111
👤 VK ID 67890 (Иван Петров)
💬 Текст: Беру M 2 штуки
📊 Пре-парсинг: размер=M, кол-во=2

⏰ 12.03.2026 10:30
```

### Notification 2a: Order Created
```
✅ Заказ создан

📝 Пост: wall-137949809_111
👤 Иван Петров (VK ID 67890)
🛒 Футболка | M | x2
🤖 AI: buy_complete (0.92)
📋 BlueSales: клиент #456
💬 Ответ: "Спасибо за заказ!..."

⏰ 12.03.2026 10:30
```

### Notification 2b: Clarification Sent
```
❓ Уточнение отправлено

📝 Пост: wall-137949809_111
👤 Иван Петров (VK ID 67890)
💬 "Беру"
🤖 AI: buy_incomplete (0.75)
📋 Не хватает: размер
💬 Ответ: "Подскажите, какой размер вам нужен?"

⏰ 12.03.2026 10:30
```

### Notification 2c: Question Answered
```
💡 Консультация

📝 Пост: wall-137949809_111
👤 VK ID 67890
💬 "Сколько доставка?"
🤖 AI: question (0.88)
💬 Ответ: "Доставка по Москве бесплатная..."

⏰ 12.03.2026 10:30
```

### Notification 2d: Error
```
⚠️ Ошибка обработки комментария

📝 Пост: wall-137949809_111
👤 VK ID 67890
💬 "Беру M"
❌ Шаг: VK Reply
❌ Ошибка: method is unavailable with service token
🔧 Код: 28

⏰ 12.03.2026 10:30
```

---

## 11. Error Handling and Retries

| Component | Error | Strategy |
|-----------|-------|----------|
| VK Long Poll | Connection lost | Auto-reconnect (listener.js) |
| N8N Webhook | 404 not registered | Re-activate workflow (healthcheck) |
| OpenAI API | Timeout/5xx | Retry 2x, then fallback to rule-based |
| OpenAI API | Invalid JSON response | Fallback: intent=question, generic reply |
| VK wall.createComment | Token error (28) | Log error, Telegram alert, NO retry |
| VK wall.createComment | Rate limit | Retry after 1s, max 2x |
| BlueSales | "Другой пользователь" | Wait countdown + retry |
| BlueSales | Auth error | Log + alert, NO retry |
| Google Sheets | Quota exceeded | Retry 2x with 5s delay |
| Telegram | Any error | Log, do NOT break main flow |

### Fallback for Low-Confidence AI Output:
If confidence < 0.5 for any intent:
1. Do NOT create order
2. Do NOT ignore
3. Write to Спрос with status=new_demand
4. Send generic safe reply: "Спасибо за комментарий! Напишите нам в ЛС для подробной консультации."
5. Telegram notification with low-confidence flag

---

## 12. Test Cases

### Happy Path Tests:
1. `"Беру M 2 штуки"` → buy_complete → order + reply + sheets + telegram
2. `"Хочу"` → buy_incomplete → clarify reply + sheets + telegram
3. `"Сколько доставка?"` → question → answer reply + sheets + telegram
4. `"😂😂😂"` → ignore → sheets (status=ignored) + telegram (debug)
5. `"Размер XL есть?"` → question → answer + sheets + telegram

### Edge Case Tests:
6. Same comment_id twice → second is dedup'd, no action
7. `"Беру"` (no size, no qty) → buy_incomplete → ask size
8. `"M L XL по 2"` → multiple sizes → buy_incomplete → ask to clarify
9. Comment under old post (> 30 days) → process normally, flag in sheets
10. `"купллю м"` (typos) → AI should still detect buy intent + size M
11. BlueSales down → error status in sheets, Telegram alert, VK reply still sent
12. Google Sheets down → Telegram alert, VK reply still sent, retry sheets later
13. Empty comment text → ignore
14. Very long comment (> 1000 chars) → truncate for AI, process normally
15. Bot's own reply detected as comment → ignore (from_id = group bot)

---

## 13. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Comment without size | buy_incomplete → ask size |
| Comment without quantity | Default to 1 for buy_complete |
| Multiple products | buy_incomplete → ask to specify one |
| Thread reply | Process normally, include parent context if available |
| Repeat comment by same user | Process each comment independently (different comment_id) |
| Old post (> 30 days) | Process normally |
| Question + buy intent | AI decides primary intent; if ambiguous → buy_incomplete |
| Typos in size ("ЭмКа", "Эль") | AI handles via GPT-4o understanding |
| Emojis only | ignore |
| Spam/ads | ignore |
| VK event delivered twice | Dedup by comment_id |
| from_id is negative (group/bot) | ignore |
| Post not found (deleted) | Log error, skip context enrichment |

---

## 14. Implementation Plan by Phases

### Phase 1: MVP (Week 1)
- [x] VK_USER_TOKEN setup (in progress — need proper user token)
- [ ] Create P0-08 workflow with 5-category classification
- [ ] Add dedup via Sheets lookup
- [ ] Add VK post context fetching
- [ ] Add VK user name fetching
- [ ] Update Спрос schema with new columns
- [ ] Improved Telegram notifications (2 types)
- [ ] Deploy and test with real comments

### Phase 2: Beta (Week 2)
- [ ] BlueSales order creation for buy_complete
- [ ] Rule-based pre-parser (before AI)
- [ ] Confidence threshold enforcement
- [ ] Error handling for all external calls
- [ ] Fallback for low-confidence AI
- [ ] Safe reply templates
- [ ] Test all edge cases

### Phase 3: Production Hardening (Week 3-4)
- [ ] Thread context (parent comment) for replies
- [ ] Product catalog mapping (post → SKU)
- [ ] Separate Telegram channels (ops vs errors)
- [ ] Monitoring dashboard in Google Sheets
- [ ] Rate limiting for VK API calls
- [ ] Weekly summary report via Telegram

---

## 15. Safe Reply Templates (Russian)

### buy_complete
```
Спасибо за заказ! {product} размер {size}, {quantity} шт. — записали!
Для подтверждения напишите нам в ЛС группы.
```

### buy_incomplete — missing size
```
Здравствуйте! Подскажите, пожалуйста, какой размер вам нужен?
Доступны: XS, S, M, L, XL, XXL.
```

### buy_incomplete — missing details
```
Здравствуйте! Мы рады, что вам понравилось!
Уточните, пожалуйста: какой размер и количество?
```

### question — delivery
```
Здравствуйте! Доставка осуществляется по всей России.
Стоимость зависит от региона. Напишите нам в ЛС для расчёта.
```

### question — availability
```
Здравствуйте! Уточним наличие и напишем вам в ЛС.
Обычно отвечаем в течение часа.
```

### question — generic
```
Здравствуйте! Спасибо за вопрос.
Напишите нам в ЛС группы — подробно проконсультируем!
```

### low_confidence fallback
```
Спасибо за комментарий!
Если у вас есть вопросы — напишите нам в ЛС, ответим в ближайшее время.
```

---

## 16. Environment Variables / Config

```env
# VK
VK_TOKEN=vk1.a...           # Community token (Long Poll)
VK_USER_TOKEN=vk1.a...      # User token (wall.createComment) — MUST be user token!
VK_GROUP_ID=137949809

# N8N
N8N_BASE_URL=https://n8n.marbomebel.ru
N8N_API_KEY=...
N8N_WEBHOOK_BASE=http://localhost:5678/webhook

# Telegram
TG_BOT_TOKEN=...
TG_CHAT_ID=...

# Google
GOOGLE_SA_JSON=...           # Base64 encoded service account
SPREADSHEET_ID=1i4R4GJuNJTTh1-KijKLToWFDASaHGgpqgirgyrl0iLY

# BlueSales
BLUESALES_LOGIN=...
BLUESALES_PASSWORD_HASH=...  # MD5 uppercase
BLUESALES_API_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...

# Thresholds (in P0-08 code node)
CONFIDENCE_ORDER_MIN=0.8
CONFIDENCE_CLARIFY_MIN=0.6
CONFIDENCE_QUESTION_MIN=0.5
```

---

## 17. Acceptance Checklist

- [ ] Comments classified into 5 categories (buy_complete, buy_incomplete, question, clarification, ignore)
- [ ] No duplicate orders/replies/rows (dedup by comment_id)
- [ ] Clarifying questions for incomplete purchase intent
- [ ] BlueSales order created only when safe (confidence ≥ 0.8 + required fields)
- [ ] Demand rows written to Спрос with full schema
- [ ] Telegram notification on new comment
- [ ] Telegram notification on processing result
- [ ] External system failures isolated (BlueSales/Sheets/VK/Telegram)
- [ ] Low-confidence fallback to safe generic reply
- [ ] VK user name fetched and included
- [ ] VK post context fetched for AI classification
- [ ] Error handling with Telegram alerts
- [ ] All stages logged to Логи_N8N
