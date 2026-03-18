-- =============================================================================
-- Migration 005: Chat threads & messages + Task↔Chat linking
-- Separates conversational UX (Chat) from operational UX (Tasks)
-- =============================================================================

-- Chat threads (conversations)
CREATE TABLE IF NOT EXISTS chat_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,                             -- Auto-generated or user-set title
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- Assistant-specific fields
  task_proposal TEXT,                     -- JSON: proposed task formulation when assistant suggests creating a task
  attachments TEXT,                       -- JSON array of { name, type, url }
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);

-- Link tasks to chat threads (many tasks can come from one chat)
-- Adding chat_thread_id to tasks table via ALTER TABLE
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, handled in app code
