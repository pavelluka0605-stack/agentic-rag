-- =============================================================================
-- Task Intake-Confirm-Execute Pipeline
-- Structured flow: intake → interpretation → confirmation → engineering packet → execution
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,

  -- Intake
  raw_input TEXT NOT NULL,              -- Original user text (Russian)
  input_type TEXT DEFAULT 'text' CHECK(input_type IN ('text', 'voice')),
  voice_transcript TEXT,                -- STT transcript if voice input

  -- Interpretation (generated once on intake)
  interpretation TEXT,                  -- JSON: { understood, expected_outcome, affected_areas, constraints, plan, risk_level }

  -- User decision
  status TEXT DEFAULT 'draft' CHECK(status IN (
    'draft',        -- Just created, interpretation pending
    'pending',      -- Interpretation ready, awaiting user confirmation
    'confirmed',    -- User confirmed, engineering packet building
    'running',      -- Execution in progress
    'done',         -- Completed successfully
    'failed',       -- Execution failed
    'cancelled'     -- User cancelled
  )),
  mode TEXT DEFAULT 'safe' CHECK(mode IN ('fast', 'safe')),

  -- Revisions (appended, not LLM-reprocessed)
  revisions TEXT,                       -- JSON array of { text, timestamp }

  -- Engineering packet (generated once on confirmation)
  engineering_packet TEXT,              -- JSON: { title, objective, scope, steps, constraints, acceptance_criteria }

  -- Execution
  execution_run_id TEXT,                -- Links to executor/orchestrator run
  progress TEXT,                        -- JSON array of { message_ru, timestamp, pct }
  result_summary_ru TEXT,               -- Final result in Russian
  result_detail TEXT,                   -- Full execution result (English)
  error TEXT,                           -- Error message if failed

  -- Telegram
  telegram_notified INTEGER DEFAULT 0,  -- 1 if final result sent to Telegram

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);

-- FTS for task search
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  raw_input, interpretation, result_summary_ru,
  content='tasks', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, raw_input, interpretation, result_summary_ru)
  VALUES (new.id, new.raw_input, new.interpretation, new.result_summary_ru);
END;
CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, raw_input, interpretation, result_summary_ru)
  VALUES ('delete', old.id, old.raw_input, old.interpretation, old.result_summary_ru);
END;
CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, raw_input, interpretation, result_summary_ru)
  VALUES ('delete', old.id, old.raw_input, old.interpretation, old.result_summary_ru);
  INSERT INTO tasks_fts(rowid, raw_input, interpretation, result_summary_ru)
  VALUES (new.id, new.raw_input, new.interpretation, new.result_summary_ru);
END;
