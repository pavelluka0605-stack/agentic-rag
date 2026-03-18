import 'server-only'
import Database from 'better-sqlite3'
import type { ChatThread, ChatMessage } from '@/types'

let chatDb: Database.Database | null = null

function getChatDbPath(): string {
  if (process.env.CHAT_DB_PATH) return process.env.CHAT_DB_PATH
  if (process.env.MEMORY_DB_PATH) {
    return process.env.MEMORY_DB_PATH.replace(/[^/]+$/, 'chat.db')
  }
  if (process.env.NODE_ENV === 'development') return '../.claude/memory/chat.db'
  return '/opt/claude-code/memory/chat.db'
}

function getChat(): Database.Database {
  if (chatDb) return chatDb

  const dbPath = getChatDbPath()

  const fs = require('fs')
  const path = require('path')
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  chatDb = new Database(dbPath)
  chatDb.pragma('journal_mode = WAL')
  chatDb.pragma('foreign_keys = ON')

  chatDb.exec(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata TEXT,
      task_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
  `)

  // Migration: add metadata column if missing (existing DBs)
  try {
    chatDb.prepare("SELECT metadata FROM chat_messages LIMIT 0").run()
  } catch {
    chatDb.exec("ALTER TABLE chat_messages ADD COLUMN metadata TEXT")
  }

  return chatDb
}

// ── Threads ─────────────────────────────────────────────

export function listThreads(limit = 50, offset = 0): ChatThread[] {
  const db = getChat()
  return db.prepare(`
    SELECT
      t.id, t.title, t.created_at, t.updated_at,
      (SELECT content FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM chat_messages WHERE thread_id = t.id) as message_count
    FROM chat_threads t
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as ChatThread[]
}

export function getThread(id: number): ChatThread | null {
  const db = getChat()
  return (db.prepare(`
    SELECT
      t.id, t.title, t.created_at, t.updated_at,
      (SELECT content FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM chat_messages WHERE thread_id = t.id) as message_count
    FROM chat_threads t
    WHERE t.id = ?
  `).get(id) as ChatThread | undefined) ?? null
}

export function createThread(title?: string): ChatThread {
  const db = getChat()
  const result = db.prepare('INSERT INTO chat_threads (title) VALUES (?)').run(title ?? null)
  return getThread(result.lastInsertRowid as number)!
}

export function updateThreadTitle(id: number, title: string): void {
  const db = getChat()
  db.prepare("UPDATE chat_threads SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id)
}

// ── Messages ────────────────────────────────────────────

export function listMessages(threadId: number, limit = 200, offset = 0): ChatMessage[] {
  const db = getChat()
  return db.prepare(
    'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
  ).all(threadId, limit, offset) as ChatMessage[]
}

export function getMessage(id: number): ChatMessage | null {
  const db = getChat()
  return (db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessage | undefined) ?? null
}

export function addMessage(
  threadId: number,
  role: 'user' | 'assistant' | 'system',
  content: string,
  opts?: { metadata?: string; taskId?: number }
): ChatMessage {
  const db = getChat()

  const result = db.prepare(
    'INSERT INTO chat_messages (thread_id, role, content, metadata, task_id) VALUES (?, ?, ?, ?, ?)'
  ).run(threadId, role, content, opts?.metadata ?? null, opts?.taskId ?? null)

  db.prepare("UPDATE chat_threads SET updated_at = datetime('now') WHERE id = ?").run(threadId)

  // Auto-set thread title from first user message if still null
  const thread = db.prepare('SELECT title FROM chat_threads WHERE id = ?').get(threadId) as { title: string | null } | undefined
  if (thread && !thread.title && role === 'user') {
    const autoTitle = content.length > 80 ? content.slice(0, 77) + '...' : content
    db.prepare('UPDATE chat_threads SET title = ? WHERE id = ?').run(autoTitle, threadId)
  }

  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid as number) as ChatMessage
}

export function setMessageTaskId(messageId: number, taskId: number): void {
  const db = getChat()
  db.prepare('UPDATE chat_messages SET task_id = ? WHERE id = ?').run(taskId, messageId)
}
