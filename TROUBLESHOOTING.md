# Troubleshooting Guide — Task Pipeline

> Quick reference for diagnosing and fixing common issues.
> Full context in [OPERATIONS.md](OPERATIONS.md).

---

## Issue Index

| # | Issue | Severity | Section |
|---|-------|----------|---------|
| 1 | Task stuck in `draft` | Low | [Link](#1-task-stuck-in-draft) |
| 2 | Task stuck in `pending` | Low | [Link](#2-task-stuck-in-pending) |
| 3 | Interpret returns error | Medium | [Link](#3-interpret-returns-error) |
| 4 | Task stuck in `confirmed` | Low | [Link](#4-task-stuck-in-confirmed) |
| 5 | Dispatch failed | High | [Link](#5-dispatch-failed) |
| 6 | No Telegram notification | Medium | [Link](#6-no-telegram-notification) |
| 7 | Progress rejected | Low | [Link](#7-progress-rejected) |
| 8 | Task running, no progress | Medium | [Link](#8-task-running-no-progress) |
| 9 | Task stuck in `review` | Medium | [Link](#9-task-stuck-in-review) |
| 10 | Task in `needs_manual_review` | High | [Link](#10-task-in-needs_manual_review) |
| 11 | Voice transcription failed | Medium | [Link](#11-voice-transcription-failed) |
| 12 | Control API not responding | Critical | [Link](#12-control-api-not-responding) |
| 13 | tmux session dead | High | [Link](#13-tmux-session-dead) |
| 14 | Database issues | Critical | [Link](#14-database-issues) |
| 15 | Env/secret issue after deploy | High | [Link](#15-envsecret-issue-after-deploy) |
| 16 | Deploy workflow fails | High | [Link](#16-deploy-workflow-fails) |

---

## 1. Task stuck in `draft`

**Cause:** `/interpret` was never called.
**Check:** `GET /api/tasks/{id}` → status is `draft`, no `interpreted` event.
**Fix:** Call `POST /api/tasks/{id}/interpret`.

## 2. Task stuck in `pending`

**Cause:** Operator didn't confirm, revise, or cancel after interpretation.
**Check:** `GET /api/tasks/{id}` → status is `pending`, `interpretation` field is populated.
**Fix:** Review interpretation. Call `/confirm`, `/revise`, or `/cancel`.

## 3. Interpret returns error

**Cause:** OpenAI API key invalid, expired, or quota exceeded.
**Check:**
```bash
# On VPS:
journalctl -u control-api.service --since "10 min ago" | grep -i "openai\|error\|401\|429"
grep OPENAI_API_KEY /opt/claude-code/env/control-api.env
```
**Fix:**
- If key missing/empty: add key to env file, restart service.
- If 429 (rate limit): wait and retry.
- If 401 (invalid): replace key in GitHub secrets, redeploy.

## 4. Task stuck in `confirmed`

**Cause:** `/start` was never called.
**Check:** `GET /api/tasks/{id}/events` → has `confirmed` but no `dispatched`.
**Fix:** Call `POST /api/tasks/{id}/start`.

## 5. Dispatch failed

**Cause:** Disk full or permission error writing `/opt/claude-code/workspace/task-{id}.md`.
**Check:**
```bash
# Event trail will show dispatch_failed:
curl -s "$API/api/tasks/{id}/events" -H "$AUTH"

# On VPS:
df -h /opt
ls -la /opt/claude-code/workspace/
```
**Fix:**
- Free disk space if full.
- Fix permissions: `chmod 755 /opt/claude-code/workspace`.
- Retry: `POST /api/tasks/{id}/start` (task stays `confirmed` after dispatch failure).

## 6. No Telegram notification

**Cause:** Bot token or chat ID missing/invalid; bot blocked by user.
**Check:**
```bash
# On VPS:
grep TG_ /opt/claude-code/env/control-api.env
curl -s "https://api.telegram.org/bot$TG_BOT_TOKEN/getMe"
journalctl -u control-api.service --since "30 min ago" | grep -i telegram
```
**Fix:**
- Verify bot token and chat ID.
- Unblock the bot in Telegram if blocked.
- Restart: `systemctl restart control-api.service`.

**Note:** Telegram is non-blocking. Tasks proceed without notifications.

## 7. Progress rejected

**Cause:** Wrong field name or task not in `running` state.
**Check:** API response: `{"error":"message_ru is required"}` or status guard error.
**Fix:**
- Use `message_ru` (not `message`) in request body.
- Verify task is in `running` state before sending progress.

## 8. Task running, no progress

**Cause:** Executor (tmux/Claude) stuck, crashed, or disconnected.
**Check:**
```bash
# On VPS:
tmux has-session -t claude-code && echo "alive" || echo "dead"
ls -la /opt/claude-code/workspace/task-{id}.md
/opt/claude-code/bin/connect.sh  # attach to see executor state
```
**Fix:**
- If tmux dead: `/opt/claude-code/bin/start.sh`.
- If executor stuck: kill process in tmux, restart.
- Task stays `running` — you can still send `/complete` or `/fail` manually.

## 9. Task stuck in `review`

**Cause:** Operator hasn't acted on the review request.
**Check:** `GET /api/tasks/{id}/events` → find `review` event with detail.
**Fix:** Review the work. Then call `/complete` (approve) or `/fail` (reject).

## 10. Task in `needs_manual_review`

**Cause:** Escalated by executor or operator. Requires human judgment.
**Check:** `GET /api/tasks/{id}/events` → find `needs_manual_review` event with reason.
**Fix:**
- Investigate the issue described in the reason.
- Call `/complete` or `/fail` after resolution.
- If blocked: escalate to developer.

**Warning:** Tasks in `needs_manual_review` have no timeout. They will stay there forever
until someone acts.

## 11. Voice transcription failed

**Cause:** Audio too large, corrupt, or Whisper API error.
**Check:** API response code:
- 413: Audio exceeds 10 MB (decoded).
- 400 + empty transcript: Audio unclear or wrong format.
- 500: OpenAI/Whisper API failure.

**Fix:**
- Compress or shorten audio (keep under 10 MB).
- Use clear Russian speech.
- Check OpenAI API key if 500.
- Fallback: use text input instead.

## 12. Control API not responding

**Cause:** Service crashed, port conflict, or node.js error.
**Check:**
```bash
# On VPS:
systemctl status control-api.service
journalctl -u control-api.service -n 30 --no-pager
ss -tlnp | grep 3901
```
**Fix:**
```bash
systemctl restart control-api.service
# Wait 5 seconds, then check:
curl -s http://127.0.0.1:3901/health
```
If it keeps crashing (restart loop): check logs for the error. Likely a code bug or missing
dependency — escalate to developer.

## 13. tmux session dead

**Cause:** VPS restarted, OOM killed, or manual stop.
**Check:**
```bash
tmux has-session -t claude-code 2>&1
systemctl status claude-code.service
```
**Fix:**
```bash
/opt/claude-code/bin/start.sh
# Or:
systemctl start claude-code.service
```
**Impact:** Tasks in `running` state will have no executor. Task files still exist in
`/opt/claude-code/workspace/`. After restarting tmux, the executor can resume from
the task file.

## 14. Database issues

**Cause:** SQLite corruption, WAL file issues, or disk full.
**Check:**
```bash
sqlite3 /opt/claude-code/memory/memory.db "PRAGMA integrity_check;"
ls -la /opt/claude-code/memory/memory.db*
df -h /opt
```
**Fix:**
- If integrity check passes: likely a transient lock. Restart control-api.
- If corruption: restore from backup:
  ```bash
  ls -lt /opt/claude-code/backups/memory-*.db | head -5
  cp /opt/claude-code/backups/memory-LATEST.db /opt/claude-code/memory/memory.db
  systemctl restart control-api.service
  ```
- Backups run every 30 minutes. Max data loss: 30 minutes.

**Escalate immediately** if no valid backup exists.

## 15. Env/secret issue after deploy

**Cause:** Deploy workflow failed to write `control-api.env`.
**Check:**
```bash
cat /opt/claude-code/env/control-api.env
# Verify all values are non-empty:
grep -c '=.' /opt/claude-code/env/control-api.env
# Should show 5 lines with values
```
**Fix:**
- Re-run deploy workflow with `update-scripts` action.
- Or manually write the env file on VPS and restart service.
- **Never commit secrets to git.** Use GitHub Secrets only.

## 16. Deploy workflow fails

**Cause:** SSH key issue, VPS unreachable, YAML syntax error, or npm install failure.
**Check:** GitHub Actions → workflow run → read step logs.
**Common fixes:**
- SSH failure: verify VPS_HOST, VPS_USER, VPS_SSH_KEY secrets.
- YAML error: validate with `python3 -c "import yaml; yaml.safe_load(open('file.yml'))"`.
- npm install failure: SSH to VPS and run `cd /opt/claude-code/memory-server && npm install` manually.

---

## Quick Diagnostic Commands (run on VPS)

```bash
# Full health:
/opt/claude-code/bin/health.sh

# Full smoke test:
/opt/claude-code/bin/smoke-test.sh

# Service status:
systemctl status control-api.service claude-code.service github-webhook.service

# Recent errors:
journalctl -u control-api.service --since "1 hour ago" --priority err

# Disk and memory:
df -h /opt && free -h

# Active ports:
ss -tlnp | grep -E '3900|3901'

# Database check:
sqlite3 /opt/claude-code/memory/memory.db "SELECT status, count(*) FROM tasks GROUP BY status;"
```
