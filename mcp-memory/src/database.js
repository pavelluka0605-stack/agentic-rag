import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DEFAULT_DB_PATH = '/opt/mcp-memory/data/memory.db';

export function initDatabase(dbPath) {
  const resolvedPath = dbPath || process.env.MEMORY_DB_PATH || DEFAULT_DB_PATH;

  // Create directory if needed
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(resolvedPath);

  // PRAGMAs
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');

  // Table: memories
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      type            TEXT NOT NULL CHECK(type IN ('lesson', 'pattern', 'decision', 'note', 'error_fix', 'snippet')),
      title           TEXT NOT NULL,
      content         TEXT NOT NULL,
      tags            TEXT DEFAULT '',
      project         TEXT DEFAULT 'default',
      status          TEXT DEFAULT 'active' CHECK(status IN ('active', 'outdated', 'archived')),
      importance      INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
      times_used      INTEGER DEFAULT 0,
      last_used_at    TEXT,
      related_files   TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `);

  // Table: sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      goal              TEXT NOT NULL,
      project           TEXT DEFAULT 'default',
      summary           TEXT,
      status            TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
      problems          TEXT,
      next_steps        TEXT,
      files_changed     TEXT DEFAULT '',
      memories_created  TEXT DEFAULT '',
      started_at        TEXT DEFAULT (datetime('now')),
      ended_at          TEXT
    );
  `);

  // FTS5 virtual table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      title,
      content,
      tags,
      content=memories,
      content_rowid=id,
      tokenize='unicode61 remove_diacritics 2'
    );
  `);

  // FTS5 sync triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, title, content, tags)
      VALUES (new.id, new.title, new.content, new.tags);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
      VALUES ('delete', old.id, old.title, old.content, old.tags);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
      VALUES ('delete', old.id, old.title, old.content, old.tags);
      INSERT INTO memories_fts(rowid, title, content, tags)
      VALUES (new.id, new.title, new.content, new.tags);
    END;
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
    CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags);
  `);

  return db;
}
