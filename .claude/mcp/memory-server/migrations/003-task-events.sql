-- =============================================================================
-- Migration 003: Task events audit trail + expanded task statuses
-- Adds lifecycle event tracking and review/manual_review states
-- =============================================================================

-- Audit trail for task lifecycle events (deterministic, no LLM)
CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,           -- created, interpreted, confirmed, dispatched, dispatch_failed, running, progress, review_requested, manual_review_needed, completed, failed, cancelled
  detail TEXT,                        -- Russian-readable event description
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);
