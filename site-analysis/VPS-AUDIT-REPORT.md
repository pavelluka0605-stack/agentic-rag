# VPS System Audit Report

**Date:** 2026-03-22 04:32 UTC
**Hostname:** fra-1-vm-ckr7
**Uptime:** 19 days, 13:41

---

## Executive Summary

VPS аудит выявил **5 критических** и **3 средних** проблемы безопасности. Сервер функционален, но имеет несколько серьёзных уязвимостей, требующих немедленного внимания.

---

## 1. System Resources

| Metric | Value | Status |
|--------|-------|--------|
| OS | Ubuntu, kernel 6.8.0-101-generic | OK |
| RAM | 3915 MB total, 1756 MB used (45%) | OK |
| Swap | 2048 MB, 1251 MB used (61%) | WARNING — swap usage high |
| Disk | 48 GB, 25 GB used (53%) | OK |
| Load | 0.20, 0.22, 0.19 | OK |
| Users logged in | 6 | NOTE — check who |

**Verdict:** Ресурсы в норме, но swap на 61% — возможна нехватка RAM при пиковых нагрузках.

---

## 2. SSH Security

| Setting | Value | Severity |
|---------|-------|----------|
| PermitRootLogin | **yes** | CRITICAL |
| PasswordAuthentication | Not found in output | CHECK |

### Findings:
- **CRITICAL: PermitRootLogin yes** — разрешён вход по SSH от root. Должен быть `no` или `prohibit-password`.
- **PasswordAuthentication** — не обнаружен в выводе. Нужно проверить — если `yes`, это ещё одна критическая уязвимость.

### Recommendations:
1. `PermitRootLogin no` (или `prohibit-password` если нужен root SSH по ключу)
2. `PasswordAuthentication no`
3. Перезапуск `sshd`

---

## 3. Firewall

| Item | Status | Severity |
|------|--------|----------|
| UFW | **inactive** | CRITICAL |

### Findings:
- **CRITICAL: Firewall полностью отключён.** Все порты открыты для внешнего доступа.
- Сервер имеет множество открытых портов (см. раздел 4) без какой-либо фильтрации.

### Recommendations:
1. Включить UFW: `ufw enable`
2. Разрешить только необходимые порты: 22 (SSH), 80 (HTTP), 443 (HTTPS)
3. Все внутренние сервисы (N8N, MySQL, Node) должны слушать только localhost

---

## 4. Open Ports Analysis

### Externally accessible (0.0.0.0 / [::]):

| Port | Service | Purpose | Risk |
|------|---------|---------|------|
| 22 | sshd | SSH | OK (need firewall) |
| 80 | docker-proxy (Traefik) | HTTP → HTTPS redirect | OK |
| 443 | docker-proxy (Traefik) | HTTPS (N8N, sites) | OK |
| 3000 | uvicorn | Control Bridge API | CRITICAL — exposed |
| 3102 | node | Unknown service | HIGH — exposed |
| 3306 | docker-proxy (MySQL) | Database | CRITICAL — exposed |
| 8080 | docker-proxy (WordPress) | mebelit-wp | MEDIUM — direct access bypasses Traefik |
| 8443 | xray | VPN proxy | Intentional |
| 9090 | python3 | Unknown | HIGH — exposed |
| 10050 | zabbix_agentd | Monitoring | MEDIUM |
| 2053 | x-ui | VPN panel | Intentional |
| 2096 | x-ui | VPN panel sub | Intentional |

### Localhost only (127.0.0.1):

| Port | Service | Status |
|------|---------|--------|
| 53 | systemd-resolve | OK |
| 3100 | node | OK — internal |
| 3101 | node | OK — internal |
| 3901 | node | OK — memory server |
| 5678 | N8N | OK — behind Traefik |
| 5679 | node | OK — internal |
| 11111 | xray | OK — internal |
| 46075 | containerd | OK — internal |
| 62789 | xray | OK — internal |

### Critical Findings:
- **CRITICAL: MySQL (3306) доступен извне.** База данных WordPress (mebelit-wp) открыта для всего интернета.
- **CRITICAL: Control Bridge API (3000) доступен извне.** API без ограничений по IP.
- **HIGH: Port 3102 (node) и 9090 (python3) доступны извне** — неизвестные сервисы.
- **MEDIUM: WordPress (8080) доступен напрямую** — обход Traefik, нет SSL.

---

## 5. Services Status

| Service | Status | Notes |
|---------|--------|-------|
| n8n | **active** | OK — workflow engine |
| nginx | **inactive** | OK — Traefik used instead |
| docker | **active** | OK |
| claude-code | **inactive** | Expected — on-demand |
| control-bridge | **active** | OK — but exposed on :3000 |
| github-webhook | **activating** | WARNING — stuck in startup? |

### Docker Containers:

| Container | Status | Ports |
|-----------|--------|-------|
| mebelit-wp-wordpress-1 | Up 7 days | 8080→80 |
| mebelit-wp-db-1 | Up 7 days | 3306→3306 |
| n8n-traefik-traefik-1 | Up 8 days | 80→80, 443→443 |
| n8n-postgres-1 | Up 12 days | 5432 (internal) |
| n8n-voice-app-1 | Up 13 days | 80 (internal) |
| n8n-n8n-1 | Up 11 days | 5678 (internal) |
| openclaw | Up 2 weeks (healthy) | — |

### Findings:
- **github-webhook в состоянии "activating"** — возможно, зависает при старте. Проверить логи.
- **7 Docker контейнеров** — все работают стабильно.

---

## 6. SSL Certificates

| Item | Status | Severity |
|------|--------|----------|
| Let's Encrypt | **No certs** | MEDIUM |
| ACME.sh | Cron active (`/root/.acme.sh`) | OK |
| Nginx server_name | chat.marbomebel.ru | OK |

### Findings:
- Let's Encrypt каталог `/etc/letsencrypt/live` отсутствует — SSL через ACME.sh + Traefik.
- ACME.sh cron работает ежедневно в 13:27 — автообновление сертификатов.
- Nginx настроен для `chat.marbomebel.ru`.

---

## 7. Security Updates

| Item | Value | Severity |
|------|-------|----------|
| Pending security updates | **1** | LOW |

---

## 8. Fail2ban

| Item | Status | Severity |
|------|--------|----------|
| fail2ban (sshd) | **Not active** | HIGH |

### Findings:
- **HIGH: fail2ban не защищает SSH.** При PermitRootLogin=yes и без fail2ban сервер уязвим к brute-force.

### Recommendations:
```bash
apt install fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
maxretry = 5
bantime = 3600
findtime = 600
EOF
systemctl enable --now fail2ban
```

---

## 9. Cron Jobs

| Schedule | Command | Purpose |
|----------|---------|---------|
| `0 3 * * *` | `/opt/mcp-memory/src/backup.js` | MCP memory backup |
| `*/5 * * * *` | `/opt/p0-foundation/scripts/watchdog.sh` | P0 watchdog |
| `*/30 * * * *` | `/opt/claude-code/bin/backup-memory.sh` | Claude memory backup |
| `27 13 * * *` | `acme.sh --cron` | SSL cert renewal |
| `*/10 * * * *` | `/opt/control-bridge/cleanup-processes.sh` | Process cleanup |

All cron jobs look reasonable and expected.

---

## 10. Git Repos

No git repos found via `find`. Likely deployed via Docker or direct file copies.

---

## 11. Environment Files

| Path | Notes |
|------|-------|
| `/root/n8n-automation/.env` | N8N automation |
| `/home/rag/.env` | RAG app |
| `/opt/vk-user-longpoll/.env` | VK user longpoll |
| `/opt/n8n/.env` | N8N main |
| `/opt/vk-callback/.env` | VK callback |
| `/opt/claude-chat/.env` | Claude chat |
| `/opt/n8n-traefik/.env` | N8N Traefik |
| `/opt/vk-longpoll/.env` | VK longpoll |
| `/opt/control-bridge/.env` | Control Bridge |
| `/opt/p0-foundation/.env` | P0 Foundation |

10 .env files found. Ensure they are not readable by unauthorized users (`chmod 600`).

---

## 12. Disk Usage

| Path | Size | Notes |
|------|------|-------|
| `/var/lib/docker` | **15 GB** | Docker images/volumes — 31% of disk |
| `/opt` | 8.1 GB | Application code |
| `/root` | 1.1 GB | Root home |
| `/var/log` | 980 MB | Logs — consider rotation |
| `/home` | 36 KB | Nearly empty |

### Recommendations:
- `docker system prune -a` to clean unused images (could free several GB)
- Check log rotation: `ls -lh /var/log/*.log | sort -k5 -h | tail -10`

---

## 13. Recent Logins

All recent logins are as **root** from various IPs:

| Date | IP | Duration |
|------|-----|----------|
| Mar 22, 00:01 | 72.56.127.126 | 54 min |
| Mar 21, 23:28 | 84.17.54.23 | **still logged in** |
| Mar 21, 23:25-23:28 | 149.88.96.161 | Multiple short sessions |
| Mar 21, 12:44 | 149.88.96.161 | 5h 52m |
| Mar 21, 02:06-02:16 | 64.188.59.204 / 64.188.63.158 | Short sessions |
| Mar 20, 05:58-12:53 | 78.40.108.244 | ~7h |
| Mar 19, 18:03 | 89.222.116.67 | 8h 29m |

Multiple IPs suggest either VPN rotation or multiple users sharing root. This is a **security concern** — should create individual user accounts.

---

## 14. Top Processes

| Process | CPU% | MEM% | Notes |
|---------|------|------|-------|
| control-bridge (uvicorn) | 76.4% | 1.3% | Spike at scan time |
| xray (VPN) | 1.3% | 0.9% | Normal |
| mysqld (Zabbix) | 1.0% | 2.9% | Normal |
| n8n (host) | 0.2% | 6.3% | Normal |
| n8n (Docker) | 0.2% | 6.9% | Normal |

**Note:** Two N8N instances running — one on host (pid 2086925, port 5678), one in Docker (pid 332320). This may be intentional (dev/prod) or a misconfiguration.

---

## 15. Docker Networks

5 networks — standard setup. No unusual configurations.

---

## 16. Nginx

- Config syntax: **OK**
- Server names: `chat.marbomebel.ru`
- Nginx is installed but **inactive** as a systemd service (Traefik handles reverse proxy)

---

## Priority Action Items

### CRITICAL (немедленно):
1. **Firewall:** `ufw default deny incoming && ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw allow 8443 && ufw allow 2053 && ufw allow 2096 && ufw enable`
2. **MySQL:** Убрать внешний биндинг порта 3306 в docker-compose (использовать `127.0.0.1:3306:3306`)
3. **SSH:** `PermitRootLogin no` + `PasswordAuthentication no` → `systemctl restart sshd`
4. **Control Bridge:** Биндить на `127.0.0.1:3000` или добавить в UFW deny

### HIGH (в течение 24ч):
5. **Fail2ban:** Установить и настроить для SSH (см. раздел 8)
6. **Port 3102, 9090:** Идентифицировать и закрыть или перевести на localhost
7. **WordPress 8080:** Перевести на `127.0.0.1:8080:80` (доступ только через Traefik)
8. **github-webhook:** Проверить логи `journalctl -u github-webhook` (статус: activating)
9. **Root login от разных IP:** Создать отдельные user accounts, запретить прямой root login

### MEDIUM (в течение недели):
10. **Swap usage 61%:** Мониторить, при необходимости увеличить RAM или swap
11. **Docker cleanup:** `docker system prune -a` — /var/lib/docker занимает 15 GB (31% диска)
12. **Log rotation:** /var/log занимает 980 MB — проверить logrotate
13. **Duplicate N8N:** Два инстанса N8N (host + Docker) — убедиться что это intentional
14. **.env permissions:** `chmod 600` для всех 10 .env файлов

---

## Risk Score

| Category | Score | Max |
|----------|-------|-----|
| Network Security | 2/10 | Firewall off, ports exposed |
| SSH Security | 3/10 | Root login, no fail2ban |
| Service Isolation | 4/10 | MySQL/API externally accessible |
| Monitoring | 6/10 | Watchdog + Zabbix agent present |
| Backups | 7/10 | Memory backups via cron |
| SSL/TLS | 7/10 | ACME.sh + Traefik auto-renewal |
| **Overall** | **4/10** | **Needs immediate hardening** |
