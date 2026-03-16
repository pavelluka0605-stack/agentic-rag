#!/bin/bash
# =============================================================================
# Backup & Pruning for memory.db
# Usage: backup-memory.sh [--prune-only] [--backup-only]
#
# Designed to run via cron:
#   */30 * * * * /opt/claude-code/bin/backup-memory.sh >> /opt/claude-code/logs/backup.log 2>&1
# =============================================================================
set -uo pipefail

MEMORY_DIR="${CLAUDE_MEMORY_DIR:-/opt/claude-code/memory}"
BACKUP_DIR="${CLAUDE_BACKUP_DIR:-/opt/claude-code/backups}"
DB_FILE="$MEMORY_DIR/memory.db"
MAX_BACKUPS="${CLAUDE_MAX_BACKUPS:-48}"  # Keep 48 backups (24h at 30min interval)
PRUNE_DAYS_INCIDENTS="${PRUNE_DAYS_INCIDENTS:-90}"
PRUNE_DAYS_EPISODES="${PRUNE_DAYS_EPISODES:-180}"
PRUNE_DAYS_EVENTS="${PRUNE_DAYS_EVENTS:-60}"

MODE="${1:-all}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ── Backup ────────────────────────────────────────────────────────────────────

do_backup() {
  if [ ! -f "$DB_FILE" ]; then
    log "WARN: Database not found at $DB_FILE"
    return 1
  fi

  mkdir -p "$BACKUP_DIR"

  local backup_file="$BACKUP_DIR/memory-$TIMESTAMP.db"

  # Use SQLite backup API via CLI for consistency (WAL-safe)
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".backup '$backup_file'"
  else
    # Fallback: checkpoint WAL then copy
    sqlite3_fallback() {
      cp "$DB_FILE" "$backup_file"
      # Also copy WAL/SHM if they exist
      [ -f "$DB_FILE-wal" ] && cp "$DB_FILE-wal" "$backup_file-wal"
      [ -f "$DB_FILE-shm" ] && cp "$DB_FILE-shm" "$backup_file-shm"
    }
    sqlite3_fallback
  fi

  if [ -f "$backup_file" ]; then
    local size
    size=$(du -h "$backup_file" | cut -f1)
    log "OK: Backup created $backup_file ($size)"
  else
    log "ERROR: Backup failed"
    return 1
  fi

  # Rotate: remove old backups beyond MAX_BACKUPS
  local count
  count=$(ls -1 "$BACKUP_DIR"/memory-*.db 2>/dev/null | wc -l)
  if [ "$count" -gt "$MAX_BACKUPS" ]; then
    local to_remove=$((count - MAX_BACKUPS))
    ls -1t "$BACKUP_DIR"/memory-*.db | tail -n "$to_remove" | while read -r old; do
      rm -f "$old" "${old}-wal" "${old}-shm"
      log "ROTATED: Removed old backup $(basename "$old")"
    done
  fi
}

# ── Pruning ───────────────────────────────────────────────────────────────────

do_prune() {
  if [ ! -f "$DB_FILE" ]; then
    log "WARN: Database not found at $DB_FILE"
    return 1
  fi

  if ! command -v sqlite3 >/dev/null 2>&1; then
    log "WARN: sqlite3 not found, skipping prune"
    return 1
  fi

  # Prune resolved incidents older than N days
  local pruned_incidents
  pruned_incidents=$(sqlite3 "$DB_FILE" "DELETE FROM incidents WHERE status IN ('fixed', 'duplicate', 'wont_fix') AND updated_at < datetime('now', '-${PRUNE_DAYS_INCIDENTS} days'); SELECT changes();")
  [ "$pruned_incidents" -gt 0 ] 2>/dev/null && log "PRUNED: $pruned_incidents resolved incidents (>${PRUNE_DAYS_INCIDENTS}d)"

  # Prune old episodes (keep recent for context)
  local pruned_episodes
  pruned_episodes=$(sqlite3 "$DB_FILE" "DELETE FROM episodes WHERE updated_at < datetime('now', '-${PRUNE_DAYS_EPISODES} days'); SELECT changes();")
  [ "$pruned_episodes" -gt 0 ] 2>/dev/null && log "PRUNED: $pruned_episodes old episodes (>${PRUNE_DAYS_EPISODES}d)"

  # Prune old github_events
  local pruned_events
  pruned_events=$(sqlite3 "$DB_FILE" "DELETE FROM github_events WHERE created_at < datetime('now', '-${PRUNE_DAYS_EVENTS} days'); SELECT changes();")
  [ "$pruned_events" -gt 0 ] 2>/dev/null && log "PRUNED: $pruned_events old github events (>${PRUNE_DAYS_EVENTS}d)"

  # VACUUM to reclaim space after pruning
  sqlite3 "$DB_FILE" "PRAGMA wal_checkpoint(TRUNCATE);"

  # Stats after prune
  local stats
  stats=$(sqlite3 "$DB_FILE" "SELECT 'incidents=' || COUNT(*) FROM incidents UNION ALL SELECT 'episodes=' || COUNT(*) FROM episodes UNION ALL SELECT 'solutions=' || COUNT(*) FROM solutions UNION ALL SELECT 'events=' || COUNT(*) FROM github_events;" | tr '\n' ' ')
  log "STATS: $stats"
}

# ── Main ──────────────────────────────────────────────────────────────────────

case "$MODE" in
  --backup-only)
    do_backup
    ;;
  --prune-only)
    do_prune
    ;;
  all|*)
    do_backup
    do_prune
    ;;
esac
