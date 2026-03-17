# Operations Runbook — Task Pipeline (Control API)

> **Scope:** This runbook covers the live task pipeline deployed at `webhook.marbomebel.ru`.
> It is grounded in the actual implementation at `vps-runtime/control-api/server.js` and
> `/.claude/mcp/memory-server/db.js`. Last verified: 2026-03-17.

---

## 1. Operator Overview

### What the system does

The task pipeline takes a task description (text or voice in Russian), interprets it via
OpenAI gpt-4o-mini, generates an engineering packet, dispatches it to a Claude Code executor
running in a tmux session on VPS, tracks progress, and notifies the manager via Telegram at
key milestones.

### Core workflow

```
Operator input (text/voice)
    → draft
    → interpret (OpenAI, 1 call)
    → pending
    → confirm (OpenAI, 1 call → engineering packet)
    → confirmed
    → start execution (write task file → dispatch to tmux)
    → running
    → progress updates (25% / 50% / 75% / 100%)
    → complete / fail / review / manual review
    → done / failed / needs_manual_review / cancelled
```

### Source of truth

- **SQLite database** at `/opt/claude-code/memory/memory.db` — tasks table + task_events table.
- **Control API** on port 3901 — the only write path to the task database.

### Secondary channels

- **Telegram** — receives milestone notifications (confirm, progress milestones, complete, fail,
  review, manual_review). Read-only; no commands accepted from Telegram.
- **Dashboard** (Next.js) — read-only view of tasks and events from the same SQLite DB.
- **Task files** at `/opt/claude-code/workspace/task-{id}.md` — generated for the executor.

---

## 2. Standard Operating Flow

### 2.1 Create a task

**Text input:**
```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"raw_input":"Описание задачи на русском","input_type":"text"}'
```

**Voice input:**
```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/voice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"audio":"<base64-encoded-audio>"}'
```

Voice path: Whisper STT (Russian) → auto-interpret → returns task in `pending` state.
Text path: Returns task in `draft` state.

Max audio size: 10 MB decoded (15 MB base64). Nginx limit: 15 MB.

### 2.2 Interpret

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/interpret \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```

- Requires status `draft`.
- Calls OpenAI gpt-4o-mini. Produces: understood, expected_outcome, affected_areas,
  constraints, plan, risk_level, risk_note.
- Moves task to `pending`.
- **Cost:** 1 LLM call.

### 2.3 Revise (optional)

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/revise \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clarification":"Уточнение или дополнение к задаче"}'
```

- Accepts `draft` or `pending`.
- Appends clarification to raw_input. Does NOT re-interpret automatically.
- After revise, call `/interpret` again to re-analyze.
- **Cost:** 0 LLM calls (text append only).

### 2.4 Confirm

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"safe"}'
```

- Requires status `pending`.
- Mode: `safe` (default) or `fast`.
- Calls OpenAI gpt-4o-mini to generate engineering packet (title, objective, scope, steps,
  constraints, acceptance_criteria).
- Moves task to `confirmed`.
- **Triggers Telegram** notification with task summary and risk level.
- **Cost:** 1 LLM call.

### 2.5 Cancel (any non-terminal state)

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```

- Rejects if already `done` or `cancelled`.
- Works from: draft, pending, confirmed, running, review, needs_manual_review.
- **Cost:** 0 LLM calls.

### 2.6 Start execution

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```

- Requires status `confirmed`.
- **Dispatch-first safety:** writes task file BEFORE flipping status to `running`.
- Writes `/opt/claude-code/workspace/task-{id}.md` with engineering packet as markdown.
- Sends `cat task-{id}.md` to tmux session `claude-code:workspace`.
- If tmux unavailable: task still moves to `running` (external executor can pick up file).
- **Cost:** 0 LLM calls.

### 2.7 Send progress

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/progress \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message_ru":"Описание прогресса","pct":25}'
```

- Requires status `running`.
- `message_ru` is **required**. `pct` is optional (0-100).
- **Telegram milestone** sent only on: first update, 25%, 50%, 75%, 100%.
- **Cost:** 0 LLM calls.

### 2.8 Complete

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"result_summary_ru":"Краткий результат","result_detail":"Подробности"}'
```

- Accepts: `running`, `confirmed`, `review`, `needs_manual_review`.
- Moves to `done`. Sends Telegram notification.
- **Cost:** 0 LLM calls.

### 2.9 Fail

```bash
curl -X POST https://webhook.marbomebel.ru/api/tasks/{id}/fail \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"error":"Описание ошибки"}'
```

- Accepts: `running`, `confirmed`, `review`, `needs_manual_review`.
- Moves to `failed`. Sends Telegram notification.
- **Cost:** 0 LLM calls.

### 2.10 Review / Manual Review

See section 5 below.

---

## 3. Status Guide

| Status | What it means | Who acts | Next expected action |
|--------|--------------|----------|---------------------|
| **draft** | Task created, not yet interpreted. | Operator | Call `/interpret` or `/cancel`. |
| **pending** | Interpreted by AI. Awaiting human confirmation. | Operator | Review interpretation, then `/confirm`, `/revise`, or `/cancel`. |
| **confirmed** | Engineering packet generated. Ready to start. | Operator | Call `/start` to dispatch to executor. |
| **running** | Dispatched to executor. Work in progress. | Executor (automated) | Send `/progress` updates. Then `/complete`, `/fail`, or `/review`. |
| **review** | Executor requests operator review before finalizing. | Operator | Review work, then `/complete`, `/fail`, or `/request-review`. |
| **needs_manual_review** | Escalated. Requires human judgment. | Operator / Developer | Investigate. Then `/complete` or `/fail`. |
| **done** | Completed successfully. Terminal state. | Nobody | Archive. No further actions. |
| **failed** | Failed. Terminal state. | Operator | Analyze error. Create new task if retry needed. |
| **cancelled** | Cancelled. Terminal state. | Nobody | No further actions. |

### State transition map

```
draft → pending       (interpret)
draft → cancelled     (cancel)
pending → confirmed   (confirm)
pending → draft       (revise → re-interpret)
pending → cancelled   (cancel)
confirmed → running   (start)
confirmed → cancelled (cancel)
confirmed → done      (complete — skip execution)
confirmed → failed    (fail — skip execution)
running → review      (review)
running → needs_manual_review  (request-review)
running → done        (complete)
running → failed      (fail)
running → cancelled   (cancel)
review → needs_manual_review  (request-review)
review → done         (complete)
review → failed       (fail)
review → cancelled    (cancel)
needs_manual_review → done     (complete)
needs_manual_review → failed   (fail)
needs_manual_review → cancelled (cancel)
```

---

## 4. Event Timeline Guide

### Events recorded

| event_type | When | Normal? |
|-----------|------|---------|
| `created` | Task created (text or voice) | Yes — always first |
| `interpreted` | AI analysis complete | Yes — detail includes risk level |
| `revised` | Operator added clarification | Yes — optional |
| `confirmed` | Engineering packet generated | Yes — detail includes mode |
| `dispatched` | Task file written to workspace | Yes — detail includes filename |
| `dispatch_failed` | Task file write failed | **Problem** — investigate disk/permissions |
| `running` | Sent to tmux session | Yes — may say "tmux unavailable" |
| `progress` | Progress update received | Yes — normal during execution |
| `completed` | Task marked done | Yes — final event for success |
| `failed` | Task marked failed | **Problem** — check error field |
| `cancelled` | Task cancelled | Yes — if intentional |
| `review` | Executor requests review | Depends — check review detail |
| `needs_manual_review` | Escalation to manual review | **Attention** — operator must act |

### How to read the audit trail

```bash
curl -s https://webhook.marbomebel.ru/api/tasks/{id}/events \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected healthy sequence for a completed text task:
```
created → interpreted → confirmed → dispatched → running → [progress...] → completed
```

Expected healthy sequence for a voice task:
```
created → interpreted → confirmed → dispatched → running → [progress...] → completed
```

(Voice tasks auto-interpret on creation, so `created` and `interpreted` happen together.)

### Problem indicators

- **Missing `interpreted` after `created`**: Interpret was never called or OpenAI failed.
- **`dispatch_failed`**: File write failed. Check disk space and `/opt/claude-code/workspace/` permissions.
- **`running` says "tmux unavailable"**: tmux session not running. Task file still exists — restart tmux and executor can resume.
- **Long gap between `dispatched` and any progress**: Executor may be stuck or not running.
- **No events at all**: Task may not exist. Check task ID.

---

## 5. Review / Manual Review Workflow

### Review (`POST /api/tasks/{id}/review`)

**What it means:** The executor finished work and wants the operator to check before marking done.

**Trigger:** Executor (or automated process) calls `/review` while task is `running`.

**Telegram notification:** "Задача #{id} — запрос проверки" with detail.

**Operator actions:**
1. Inspect the work (code, files, deployment result).
2. If satisfied: `POST /api/tasks/{id}/complete` with result summary.
3. If not satisfied: `POST /api/tasks/{id}/fail` with error description.
4. If needs deeper investigation: `POST /api/tasks/{id}/request-review`.

### Manual Review (`POST /api/tasks/{id}/request-review`)

**What it means:** The task has been escalated. Something is unclear, risky, or the automated
process cannot decide.

**Trigger:** Operator or executor calls `/request-review` while task is `running` or `review`.

**Telegram notification:** "Задача #{id} — нужна ручная проверка" with reason.

**Operator actions:**
1. Read the reason from the event trail.
2. Investigate the issue.
3. Decide: `/complete` (if acceptable) or `/fail` (if not).
4. If blocked: escalate to developer (see section 12).

**Tasks in `needs_manual_review` stay there until an operator acts.** There is no timeout.

---

## 6. Telegram Operations Guide

### Notifications that should appear

| Trigger | Message format |
|---------|---------------|
| Task confirmed | "Задача подтверждена" + understood + mode + risk |
| First progress | Progress message + percentage |
| 25% progress | Progress message + percentage |
| 50% progress | Progress message + percentage |
| 75% progress | Progress message + percentage |
| 100% progress | Progress message + percentage |
| Task completed | "Задача #{id} выполнена" + result summary |
| Task failed | "Задача #{id} не выполнена" + error |
| Review requested | "Задача #{id} — запрос проверки" + detail |
| Manual review | "Задача #{id} — нужна ручная проверка" + reason |

### Notifications that should NOT appear

- Task creation (draft state — no notification).
- Interpretation (no notification).
- Non-milestone progress (e.g. 10%, 33%, 60% — skipped).
- Cancel (no Telegram notification).
- Revise (no Telegram notification).

### If Telegram stops sending

1. Check `TG_BOT_TOKEN` and `TG_CHAT_ID` in `/opt/claude-code/env/control-api.env` on VPS.
2. Verify the bot is not blocked by the user in Telegram.
3. Check control-api logs: `journalctl -u control-api.service --since "1 hour ago"`.
4. Test bot manually: `curl -s "https://api.telegram.org/bot$TG_BOT_TOKEN/getMe"`.
5. Restart control-api: `systemctl restart control-api.service`.

Telegram failures are **non-blocking** — the task pipeline continues regardless. Missing
notifications are an operational inconvenience, not a system failure.

---

## 7. Health and Diagnostics Guide

### Quick health check

```bash
# From VPS:
/opt/claude-code/bin/health.sh

# From VPS (JSON output):
/opt/claude-code/bin/health.sh --json

# Via API:
curl -s https://webhook.marbomebel.ru/health
```

### What health.sh checks (8 checks)

| # | Check | What it verifies |
|---|-------|-----------------|
| 1 | tmux session | `claude-code` session running with 3 windows |
| 2 | Claude CLI | Installed and responds to `--version` |
| 3 | Workspace dir | `/opt/claude-code/workspace` exists |
| 4 | Log dir | Logs directory exists, today's log present |
| 5 | Env file | `claude.env` exists, ANTHROPIC_API_KEY set |
| 6 | systemd | `claude-code.service` enabled and active |
| 7 | Disk space | `/opt` usage ≤ 90% |
| 8 | Memory (RAM) | Usage ≤ 90% |

### Full smoke test

```bash
# From VPS:
/opt/claude-code/bin/smoke-test.sh
```

Runs 30+ checks including scripts, CLI, MCP memory server, systemd, tmux, network
connectivity, and task pipeline (create → events → cancel).

### Service status commands (on VPS)

```bash
systemctl status control-api.service
systemctl status claude-code.service
systemctl status github-webhook.service

# Control API logs:
journalctl -u control-api.service -n 50 --no-pager

# Check ports:
ss -tlnp | grep -E '3900|3901|5678'
```

### Deploy workflow (remote)

Trigger via GitHub Actions: `deploy-claude-code.yml` with action `health` or `smoke-test`.

---

## 8. Troubleshooting

### Task stuck in `draft`

**Likely cause:** Operator forgot to call `/interpret`.
**Check:** `GET /api/tasks/{id}` — status should be `draft`.
**Fix:** Call `POST /api/tasks/{id}/interpret`.

### Task stuck in `pending`

**Likely cause:** Operator reviewed interpretation but didn't confirm or cancel.
**Check:** `GET /api/tasks/{id}` — look at `interpretation` field.
**Fix:** Call `/confirm`, `/revise`, or `/cancel`.

### Interpret returns error

**Likely cause:** OpenAI API key invalid or quota exceeded.
**Check:** `journalctl -u control-api.service --since "10 min ago" | grep -i openai`.
**Fix:** Verify `OPENAI_API_KEY` in `/opt/claude-code/env/control-api.env`. Restart service
after fixing: `systemctl restart control-api.service`.

### Task stuck in `confirmed`

**Likely cause:** Operator forgot to call `/start`.
**Check:** `GET /api/tasks/{id}` — status `confirmed`, no `dispatched` event.
**Fix:** Call `POST /api/tasks/{id}/start`.

### Dispatch failed

**Likely cause:** Disk full or permissions error writing task file.
**Check:** `GET /api/tasks/{id}/events` — look for `dispatch_failed` event.
**Fix:** Check disk: `df -h /opt`. Check permissions: `ls -la /opt/claude-code/workspace/`.
Task stays `confirmed` — fix the issue and call `/start` again.

### No Telegram notification after confirm

**Likely cause:** TG_BOT_TOKEN or TG_CHAT_ID missing/invalid.
**Check:** `grep TG /opt/claude-code/env/control-api.env`.
**Fix:** Update env file, restart: `systemctl restart control-api.service`.
**Note:** Telegram is non-blocking. The task proceeds regardless.

### Progress rejected with "message_ru is required"

**Likely cause:** Sending `message` instead of `message_ru`.
**Fix:** Use field name `message_ru` in the request body.

### Task in `running` but no progress for a long time

**Likely cause:** Executor is stuck, crashed, or tmux session died.
**Check:**
1. `tmux has-session -t claude-code` — is tmux alive?
2. `ls -la /opt/claude-code/workspace/task-{id}.md` — does the task file exist?
3. Check tmux: `/opt/claude-code/bin/connect.sh` to see executor state.
**Fix:**
- If tmux dead: `/opt/claude-code/bin/start.sh` to restart.
- If executor stuck: kill and restart the Claude process within tmux.
- Task stays `running` — progress/complete/fail still accepted.

### Task in `review` — what to do

**Action:** Operator must review the work and call `/complete` or `/fail`.
**Check:** Read the `review` event detail via `GET /api/tasks/{id}/events`.

### Task in `needs_manual_review` — what to do

**Action:** Operator or developer must investigate, then call `/complete` or `/fail`.
**Check:** Read event trail for the `needs_manual_review` event with reason.
**Escalate:** If unsure, contact the developer (see section 12).

### Voice transcription failed

**Likely cause:** Audio too large (>10 MB), corrupt audio, or Whisper API failure.
**Check:** API response (400 or 413 status code).
**Fix:**
- If 413: Reduce audio size or compress.
- If 400 (empty transcript): Re-record with clearer audio.
- If 500: Check OpenAI API key and control-api logs.

### Dashboard shows stale data

**Likely cause:** Dashboard reads from the same SQLite DB. If it shows stale data, the DB
may be locked or the dashboard server needs restart.
**Fix:** The dashboard uses read-only access. Check if the SQLite DB is not corrupted:
`sqlite3 /opt/claude-code/memory/memory.db "PRAGMA integrity_check;"`.

### Env/secret issue after deploy

**Likely cause:** Deploy workflow failed to write `control-api.env`.
**Check:** `cat /opt/claude-code/env/control-api.env` — verify all keys are present and non-empty.
**Fix:** Re-run deploy workflow with `update-scripts` action, or manually write the env file.
Then: `systemctl restart control-api.service`.

---

## 9. Cost Control Guide

### Current cost model

| Step | LLM calls | Model | Est. cost/call |
|------|-----------|-------|---------------|
| Create (text) | 0 | — | $0 |
| Create (voice) | 1 Whisper + 1 gpt-4o-mini | whisper-1 + gpt-4o-mini | ~$0.01–0.03 |
| Interpret | 1 | gpt-4o-mini | ~$0.005 |
| Revise | 0 | — | $0 |
| Confirm | 1 | gpt-4o-mini | ~$0.005 |
| Start | 0 | — | $0 |
| Progress | 0 | — | $0 |
| Complete | 0 | — | $0 |
| Fail | 0 | — | $0 |
| Review | 0 | — | $0 |
| Cancel | 0 | — | $0 |

**Text task total:** 2 LLM calls (~$0.01).
**Voice task total:** 3 calls (1 Whisper + 2 gpt-4o-mini, ~$0.02–0.04).

### Deterministic steps (zero LLM cost)

Everything after `confirm`: start, progress, complete, fail, review, cancel.
Events recording is deterministic (no LLM).
Telegram notifications are deterministic (no LLM).

### What to avoid

- **Repeatedly interpreting the same task** — each `/interpret` call costs 1 LLM call. Use
  `/revise` to append clarification, then interpret once.
- **Creating duplicate tasks** — check existing tasks before creating new ones.
- **Large voice files** — Whisper charges per minute of audio. Keep recordings short.

### What would increase cost

- Switching from gpt-4o-mini to gpt-4o (10x cost per call).
- Adding auto-retry on interpret failure (unbounded retries).
- Adding AI-generated progress summaries.
- Adding auto-review with LLM scoring.

None of these exist in the current system.

---

## 10. Deployment / Update Guide

### How deploy is triggered

1. **On push** to `claude/vps-dev-environment-*` branches changing files in `vps-runtime/**`,
   `.claude/mcp/**`, or `.claude/hooks/**`.
2. **Manual dispatch** at GitHub → Actions → "Deploy Claude Code Runtime" → Run workflow → select action.

### What a good deploy looks like

All steps green in GitHub Actions:
- Step 4: Deploy runtime scripts — **success**
- Step 7: Ensure services running — **success**
- Step 11: Health Check — **success**
- Step 12: Smoke Test — **success**

### What to verify after deploy

1. Control API responds: `curl -s https://webhook.marbomebel.ru/health`.
2. Smoke test passed (check Step 12 in workflow).
3. Env file intact: SSH to VPS, check `/opt/claude-code/env/control-api.env`.
4. Services running: `systemctl status control-api.service claude-code.service`.

### If deploy partially succeeds

**Scripts deployed but services failed to restart:**
```bash
ssh user@vps "systemctl restart control-api.service && systemctl restart claude-code.service"
```

**Deploy step failed but health passed:**
Check the specific step failure. The health check runs on the pre-deploy state.

**Deploy succeeded but smoke test failed:**
Check which smoke test assertion failed. Common: tmux not running (restart it), port not
listening (restart service), task API error (check control-api logs).

### If behavior is wrong after successful deploy

1. Check if the right code was deployed: `ssh user@vps "head -5 /opt/claude-code/control-api/server.js"`.
2. Check if env vars were refreshed: services load env on startup, so restart is needed.
3. Rollback: re-run deploy workflow targeting the previous commit.

---

## 11. Minimal Acceptance Checklist

Run after: a fresh deploy, a suspicious failure, or a secret/config change.

```
[ ] curl health endpoint returns OK
[ ] systemctl status control-api.service → active
[ ] systemctl status claude-code.service → active
[ ] tmux has-session -t claude-code → success
[ ] POST /api/tasks with test input → returns id
[ ] GET /api/tasks/{id} → status=draft
[ ] GET /api/tasks/{id}/events → has "created" event
[ ] POST /api/tasks/{id}/cancel → status=cancelled
[ ] grep OPENAI_API_KEY control-api.env → non-empty
[ ] grep TG_BOT_TOKEN control-api.env → non-empty
[ ] grep CONTROL_API_TOKEN control-api.env → non-empty
[ ] /opt/claude-code/bin/health.sh → 0 failures
```

Or run the automated version: `/opt/claude-code/bin/smoke-test.sh`
(covers all the above plus more).

---

## 12. Ownership / Escalation

### What the operator can safely do

- Create, interpret, revise, confirm, cancel tasks.
- Start execution.
- Send progress updates.
- Complete or fail tasks.
- Approve review or manual review requests.
- Restart services: `systemctl restart control-api.service`.
- Run health check and smoke test.
- Read logs: `journalctl -u control-api.service`.
- Re-run deploy workflow (same action, same branch).

### What requires developer intervention

- Changing task state machine logic (server.js).
- Modifying database schema (migrations).
- Changing OpenAI prompts (interpretation/packet prompts in server.js).
- Adding new API endpoints.
- Fixing deploy workflow YAML.
- Changing nginx configuration.
- Updating systemd unit files.

### What requires infrastructure intervention

- VPS disk full (expand or clean).
- VPS memory exhausted (investigate processes).
- SSL certificate renewal failure (check certbot).
- Domain DNS changes.
- Firewall/network issues.

### What should be escalated immediately

- Database corruption (`PRAGMA integrity_check` fails).
- Control API crashes in a loop (check `journalctl` — RestartSec is 5s, so rapid restarts
  indicate a code bug).
- OpenAI API key compromised or revoked.
- Telegram bot token compromised.
- CONTROL_API_TOKEN leaked (rotate immediately in GitHub secrets + redeploy).
- Unknown tasks appearing in the database (possible unauthorized access).

---

## Appendix A: API Reference Quick Card

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/tasks` | Yes | List all tasks |
| POST | `/api/tasks` | Yes | Create text task |
| POST | `/api/tasks/voice` | Yes | Create voice task |
| GET | `/api/tasks/{id}` | Yes | Get task details |
| GET | `/api/tasks/{id}/events` | Yes | Get event trail |
| POST | `/api/tasks/{id}/interpret` | Yes | Interpret (AI) |
| POST | `/api/tasks/{id}/revise` | Yes | Add clarification |
| POST | `/api/tasks/{id}/confirm` | Yes | Confirm + gen packet |
| POST | `/api/tasks/{id}/cancel` | Yes | Cancel task |
| POST | `/api/tasks/{id}/start` | Yes | Start execution |
| POST | `/api/tasks/{id}/progress` | Yes | Progress update |
| POST | `/api/tasks/{id}/complete` | Yes | Mark done |
| POST | `/api/tasks/{id}/fail` | Yes | Mark failed |
| POST | `/api/tasks/{id}/review` | Yes | Request review |
| POST | `/api/tasks/{id}/request-review` | Yes | Escalate to manual review |

Auth: `Authorization: Bearer $CONTROL_API_TOKEN`

### Appendix B: Nginx Endpoints

| URL path | Backend | Rate limit |
|----------|---------|-----------|
| `/api/*` | `127.0.0.1:3901` | 30 req/min, burst 20 |
| `/health` | `127.0.0.1:3901` | No limit |
| `/webhook/github` | `127.0.0.1:3900` | 30 req/min, burst 10 |
| `/webhook/bluesales-webhook` | `127.0.0.1:5678` | 30 req/min, burst 10 |

### Appendix C: Key File Paths (VPS)

| Path | Purpose |
|------|---------|
| `/opt/claude-code/env/control-api.env` | Secrets (OpenAI, Telegram, token) |
| `/opt/claude-code/env/claude.env` | Anthropic API key |
| `/opt/claude-code/memory/memory.db` | SQLite database |
| `/opt/claude-code/workspace/task-{id}.md` | Dispatched task files |
| `/opt/claude-code/logs/` | Session and event logs |
| `/opt/claude-code/control-api/server.js` | Control API source |
| `/opt/claude-code/memory-server/db.js` | Database layer |
| `/opt/claude-code/bin/` | Operator scripts |
