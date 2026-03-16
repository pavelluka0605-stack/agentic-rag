-- =============================================================================
-- Multi-layer Development Memory Schema
-- SQLite + FTS5
-- =============================================================================

-- ── 1. Policy Memory ────────────────────────────────────────────────────────
-- Rules, constraints, conventions, known limitations
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  category TEXT NOT NULL CHECK(category IN ('rule', 'constraint', 'convention', 'limitation')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual',       -- 'CLAUDE.md', 'manual', 'learned', 'incident'
  verified INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── 2. Episodic Memory ──────────────────────────────────────────────────────
-- Session summaries, progress, open loops
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  session_id TEXT,
  summary TEXT NOT NULL,
  what_done TEXT,
  where_stopped TEXT,
  what_remains TEXT,
  open_loops TEXT,                     -- JSON array of open items
  branch TEXT,
  files_changed TEXT,                  -- JSON array
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── 3. Incident Memory ──────────────────────────────────────────────────────
-- Errors, stack traces, failed commands, fingerprints, fixes
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  service TEXT,
  fingerprint TEXT,                    -- SHA256 of normalized error for dedup
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  failed_command TEXT,
  context TEXT,                        -- what was happening when error occurred
  probable_cause TEXT,
  failed_attempts TEXT,                -- JSON array of things that didn't work
  verified_fix TEXT,
  fix_verified_at TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'fixed', 'wontfix', 'duplicate')),
  duplicate_of INTEGER REFERENCES incidents(id),
  occurrence_count INTEGER DEFAULT 1,
  usefulness_score INTEGER DEFAULT 0,
  github_issue TEXT,                   -- linked GitHub issue URL
  github_pr TEXT,                      -- linked GitHub PR URL
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_fingerprint ON incidents(fingerprint);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents(project);

-- ── 4. Solution Memory ──────────────────────────────────────────────────────
-- Working patterns, reusable workflows, debugging playbooks
CREATE TABLE IF NOT EXISTS solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  service TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  code TEXT,
  commands TEXT,                       -- JSON array of commands
  pattern_type TEXT DEFAULT 'pattern' CHECK(pattern_type IN (
    'workflow', 'command', 'pattern', 'playbook', 'snippet', 'config'
  )),
  solves_incident INTEGER REFERENCES incidents(id),
  verified INTEGER DEFAULT 0,
  verified_at TEXT,
  usefulness_score INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  tags TEXT,                           -- JSON array
  github_pr TEXT,                      -- PR that introduced this solution
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_solutions_type ON solutions(pattern_type);
CREATE INDEX IF NOT EXISTS idx_solutions_verified ON solutions(verified);

-- ── 5. Decision Memory ──────────────────────────────────────────────────────
-- Architectural decisions, tradeoffs, conscious exclusions
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  title TEXT NOT NULL,
  context TEXT NOT NULL,               -- why this decision was needed
  chosen TEXT NOT NULL,                -- what was chosen
  alternatives TEXT,                   -- JSON array of alternatives considered
  tradeoffs TEXT,                      -- what we're giving up
  not_doing TEXT,                      -- what we consciously decided NOT to do
  revisit_trigger TEXT,                -- when to reconsider this decision
  supersedes INTEGER REFERENCES decisions(id),
  tags TEXT,                           -- JSON array
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── 6. Code/Context Memory ──────────────────────────────────────────────────
-- Important code chunks, infra files, deployment knowledge, project summaries
CREATE TABLE IF NOT EXISTS contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  category TEXT NOT NULL CHECK(category IN (
    'code', 'infra', 'docs', 'deployment', 'summary', 'config', 'api'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_path TEXT,
  language TEXT,                       -- programming language
  tags TEXT,                           -- JSON array
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── 7. GitHub Events ────────────────────────────────────────────────────────
-- Raw GitHub webhook events linked to memory entries
CREATE TABLE IF NOT EXISTS github_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,            -- 'push', 'pull_request', 'issues', 'workflow_run', etc.
  action TEXT,                         -- 'opened', 'closed', 'merged', 'completed', etc.
  repo TEXT NOT NULL,
  ref TEXT,                            -- branch/tag
  payload_summary TEXT,                -- condensed event data
  linked_memory_type TEXT,             -- 'incident', 'solution', 'episode', etc.
  linked_memory_id INTEGER,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_github_events_type ON github_events(event_type);
CREATE INDEX IF NOT EXISTS idx_github_events_repo ON github_events(repo);

-- ── FTS5 Virtual Tables ─────────────────────────────────────────────────────

CREATE VIRTUAL TABLE IF NOT EXISTS policies_fts USING fts5(
  title, content, category, project,
  content='policies', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
  summary, what_done, where_stopped, what_remains, open_loops,
  content='episodes', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS incidents_fts USING fts5(
  error_message, stack_trace, failed_command, probable_cause, verified_fix, context,
  content='incidents', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS solutions_fts USING fts5(
  title, description, code, commands,
  content='solutions', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
  title, context, chosen, alternatives, tradeoffs, not_doing,
  content='decisions', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS contexts_fts USING fts5(
  title, content, file_path, tags,
  content='contexts', content_rowid='id'
);

-- ── FTS Sync Triggers ───────────────────────────────────────────────────────

-- Policies
CREATE TRIGGER IF NOT EXISTS policies_ai AFTER INSERT ON policies BEGIN
  INSERT INTO policies_fts(rowid, title, content, category, project)
  VALUES (new.id, new.title, new.content, new.category, new.project);
END;
CREATE TRIGGER IF NOT EXISTS policies_ad AFTER DELETE ON policies BEGIN
  INSERT INTO policies_fts(policies_fts, rowid, title, content, category, project)
  VALUES ('delete', old.id, old.title, old.content, old.category, old.project);
END;
CREATE TRIGGER IF NOT EXISTS policies_au AFTER UPDATE ON policies BEGIN
  INSERT INTO policies_fts(policies_fts, rowid, title, content, category, project)
  VALUES ('delete', old.id, old.title, old.content, old.category, old.project);
  INSERT INTO policies_fts(rowid, title, content, category, project)
  VALUES (new.id, new.title, new.content, new.category, new.project);
END;

-- Episodes
CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
  INSERT INTO episodes_fts(rowid, summary, what_done, where_stopped, what_remains, open_loops)
  VALUES (new.id, new.summary, new.what_done, new.where_stopped, new.what_remains, new.open_loops);
END;
CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
  INSERT INTO episodes_fts(episodes_fts, rowid, summary, what_done, where_stopped, what_remains, open_loops)
  VALUES ('delete', old.id, old.summary, old.what_done, old.where_stopped, old.what_remains, old.open_loops);
END;

-- Incidents
CREATE TRIGGER IF NOT EXISTS incidents_ai AFTER INSERT ON incidents BEGIN
  INSERT INTO incidents_fts(rowid, error_message, stack_trace, failed_command, probable_cause, verified_fix, context)
  VALUES (new.id, new.error_message, new.stack_trace, new.failed_command, new.probable_cause, new.verified_fix, new.context);
END;
CREATE TRIGGER IF NOT EXISTS incidents_ad AFTER DELETE ON incidents BEGIN
  INSERT INTO incidents_fts(incidents_fts, rowid, error_message, stack_trace, failed_command, probable_cause, verified_fix, context)
  VALUES ('delete', old.id, old.error_message, old.stack_trace, old.failed_command, old.probable_cause, old.verified_fix, old.context);
END;
CREATE TRIGGER IF NOT EXISTS incidents_au AFTER UPDATE ON incidents BEGIN
  INSERT INTO incidents_fts(incidents_fts, rowid, error_message, stack_trace, failed_command, probable_cause, verified_fix, context)
  VALUES ('delete', old.id, old.error_message, old.stack_trace, old.failed_command, old.probable_cause, old.verified_fix, old.context);
  INSERT INTO incidents_fts(rowid, error_message, stack_trace, failed_command, probable_cause, verified_fix, context)
  VALUES (new.id, new.error_message, new.stack_trace, new.failed_command, new.probable_cause, new.verified_fix, new.context);
END;

-- Solutions
CREATE TRIGGER IF NOT EXISTS solutions_ai AFTER INSERT ON solutions BEGIN
  INSERT INTO solutions_fts(rowid, title, description, code, commands)
  VALUES (new.id, new.title, new.description, new.code, new.commands);
END;
CREATE TRIGGER IF NOT EXISTS solutions_ad AFTER DELETE ON solutions BEGIN
  INSERT INTO solutions_fts(solutions_fts, rowid, title, description, code, commands)
  VALUES ('delete', old.id, old.title, old.description, old.code, old.commands);
END;
CREATE TRIGGER IF NOT EXISTS solutions_au AFTER UPDATE ON solutions BEGIN
  INSERT INTO solutions_fts(solutions_fts, rowid, title, description, code, commands)
  VALUES ('delete', old.id, old.title, old.description, old.code, old.commands);
  INSERT INTO solutions_fts(rowid, title, description, code, commands)
  VALUES (new.id, new.title, new.description, new.code, new.commands);
END;

-- Decisions
CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions BEGIN
  INSERT INTO decisions_fts(rowid, title, context, chosen, alternatives, tradeoffs, not_doing)
  VALUES (new.id, new.title, new.context, new.chosen, new.alternatives, new.tradeoffs, new.not_doing);
END;
CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, title, context, chosen, alternatives, tradeoffs, not_doing)
  VALUES ('delete', old.id, old.title, old.context, old.chosen, old.alternatives, old.tradeoffs, old.not_doing);
END;

-- Contexts
CREATE TRIGGER IF NOT EXISTS contexts_ai AFTER INSERT ON contexts BEGIN
  INSERT INTO contexts_fts(rowid, title, content, file_path, tags)
  VALUES (new.id, new.title, new.content, new.file_path, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS contexts_ad AFTER DELETE ON contexts BEGIN
  INSERT INTO contexts_fts(contexts_fts, rowid, title, content, file_path, tags)
  VALUES ('delete', old.id, old.title, old.content, old.file_path, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS contexts_au AFTER UPDATE ON contexts BEGIN
  INSERT INTO contexts_fts(contexts_fts, rowid, title, content, file_path, tags)
  VALUES ('delete', old.id, old.title, old.content, old.file_path, old.tags);
  INSERT INTO contexts_fts(rowid, title, content, file_path, tags)
  VALUES (new.id, new.title, new.content, new.file_path, new.tags);
END;
