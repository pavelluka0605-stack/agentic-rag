# Quick Start — Task Pipeline Operations

> One-page cheatsheet. Full details in [OPERATIONS.md](OPERATIONS.md).

## Setup

```bash
export API="https://webhook.marbomebel.ru"
export TOKEN="<your CONTROL_API_TOKEN>"
AUTH="Authorization: Bearer $TOKEN"
```

## Run a task (text, happy path)

```bash
# 1. Create
curl -s -X POST "$API/api/tasks" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"raw_input":"Описание задачи","input_type":"text"}' | python3 -m json.tool
# → note the "id" field

# 2. Interpret (1 OpenAI call)
curl -s -X POST "$API/api/tasks/{id}/interpret" -H "$AUTH" -H "Content-Type: application/json" -d '{}'

# 3. Confirm (1 OpenAI call, sends Telegram)
curl -s -X POST "$API/api/tasks/{id}/confirm" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"mode":"safe"}'

# 4. Start execution (writes task file, dispatches to tmux)
curl -s -X POST "$API/api/tasks/{id}/start" -H "$AUTH" -H "Content-Type: application/json" -d '{}'

# 5. Send progress (during execution)
curl -s -X POST "$API/api/tasks/{id}/progress" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"message_ru":"Описание прогресса","pct":50}'

# 6. Complete
curl -s -X POST "$API/api/tasks/{id}/complete" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"result_summary_ru":"Что сделано"}'
```

## Check task status

```bash
curl -s "$API/api/tasks/{id}" -H "$AUTH" | python3 -m json.tool
```

## Check event trail

```bash
curl -s "$API/api/tasks/{id}/events" -H "$AUTH" | python3 -m json.tool
```

## List all tasks

```bash
curl -s "$API/api/tasks" -H "$AUTH" | python3 -m json.tool
```

## Cancel a task

```bash
curl -s -X POST "$API/api/tasks/{id}/cancel" -H "$AUTH" -H "Content-Type: application/json" -d '{}'
```

## Health check

```bash
curl -s "$API/health"
```

## Status meanings (short)

| Status | Meaning | Your action |
|--------|---------|-------------|
| `draft` | Created, not interpreted | `/interpret` |
| `pending` | Interpreted, awaiting you | `/confirm` or `/cancel` |
| `confirmed` | Ready to execute | `/start` |
| `running` | Executing | Wait for progress/completion |
| `review` | Executor asks you to check | `/complete` or `/fail` |
| `needs_manual_review` | Escalated | Investigate, then `/complete` or `/fail` |
| `done` | Finished | Nothing |
| `failed` | Failed | Analyze error, create new task if needed |
| `cancelled` | Cancelled | Nothing |

## Cost per task

- **Text task:** 2 OpenAI calls (~$0.01). Interpret + confirm.
- **Voice task:** 3 calls (~$0.03). Whisper + interpret + confirm.
- **Everything else:** Free (no LLM calls).
