-- =============================================================================
-- Migration 004: Solution options + execution phases for owner workflow
-- Adds strategy selection (Stage B) and live execution tracking (Stage D)
-- =============================================================================

-- Note: SQLite ALTER TABLE ADD COLUMN is idempotent-safe via db.js wrapper
-- These columns are added programmatically in _migrateTaskColumns()
