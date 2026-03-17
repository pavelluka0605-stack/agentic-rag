# Deploy Checklist

> Run after: fresh deploy, suspicious failure, secret/config change.
> Automated: `/opt/claude-code/bin/smoke-test.sh` (covers all below + more).

## Post-Deploy Verification

### Services
```
[ ] systemctl status control-api.service → active (running)
[ ] systemctl status claude-code.service → active (running)
[ ] tmux has-session -t claude-code → success (3 windows)
[ ] ss -tlnp | grep 3901 → node listening
```

### Health
```
[ ] curl http://127.0.0.1:3901/health → responds OK
[ ] /opt/claude-code/bin/health.sh → 0 failures
```

### Secrets/Env
```
[ ] grep OPENAI_API_KEY /opt/claude-code/env/control-api.env → non-empty value
[ ] grep TG_BOT_TOKEN /opt/claude-code/env/control-api.env → non-empty value
[ ] grep TG_CHAT_ID /opt/claude-code/env/control-api.env → non-empty value
[ ] grep CONTROL_API_TOKEN /opt/claude-code/env/control-api.env → non-empty value
```

### Task Pipeline (smoke)
```
[ ] POST /api/tasks → returns {"id": N, "status": "draft"}
[ ] GET /api/tasks/N → status=draft
[ ] GET /api/tasks/N/events → has "created" event
[ ] POST /api/tasks/N/cancel → status=cancelled
```

### External Connectivity
```
[ ] curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $KEY" → 200
[ ] curl -s "https://api.telegram.org/bot$TG_TOKEN/getMe" → ok=true
```

### Database
```
[ ] sqlite3 /opt/claude-code/memory/memory.db "PRAGMA integrity_check;" → ok
[ ] sqlite3 /opt/claude-code/memory/memory.db "SELECT count(*) FROM tasks;" → number
```

---

## What "Good" Looks Like

GitHub Actions workflow — all steps green:
- Deploy runtime scripts: success
- Ensure services running: success
- Health Check: success
- Smoke Test: success

VPS:
- Both services active, no restart loops.
- All env vars populated.
- Health check: 8/8 pass.
- Task pipeline: create/cancel cycle works.

---

## If Something Fails

| Check failed | Likely cause | Fix |
|-------------|-------------|-----|
| Service not active | Deploy didn't restart it | `systemctl restart control-api.service` |
| tmux dead | claude-code.service failed | `/opt/claude-code/bin/start.sh` |
| Port not listening | control-api crashed on startup | Check `journalctl -u control-api.service -n 30` |
| Env var empty | Deploy step didn't write env | Re-run deploy with `update-scripts` |
| Task create fails | DB locked or missing | Check DB: `PRAGMA integrity_check` |
| OpenAI unreachable | Key invalid or network issue | Verify key, check DNS |
| Telegram unreachable | Bot token wrong | Verify token with `/getMe` |

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed recovery steps.
