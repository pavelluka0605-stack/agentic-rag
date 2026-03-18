import 'server-only'
import Database from 'better-sqlite3'
import type { ChatThread, ChatMessage } from '@/types'

let db: Database.Database | null = null

function getDbPath(): string {
  if (process.env.MEMORY_DB_PATH) return process.env.MEMORY_DB_PATH
  if (process.env.NODE_ENV === 'development') return '../.claude/memory/memory.db'
  return '/opt/claude-code/memory/memory.db'
}

function getDb(): Database.Database | null {
  if (db) return db
  try {
    const fs = require('fs')
    const dbPath = getDbPath()
    if (!fs.existsSync(dbPath)) {
      console.warn(`[chat-db] Database file not found: ${dbPath}`)
      return null
    }
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    ensureTables(db)
    return db
  } catch (err) {
    console.error(`[chat-db] Failed to open database: ${err}`)
    return null
  }
}

function ensureTables(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      task_proposal TEXT,
      attachments TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
  `)

  // Add chat_thread_id to tasks if column doesn't exist
  try {
    const cols = database.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
    if (!cols.find(c => c.name === 'chat_thread_id')) {
      database.exec('ALTER TABLE tasks ADD COLUMN chat_thread_id INTEGER REFERENCES chat_threads(id)')
      database.exec('CREATE INDEX IF NOT EXISTS idx_tasks_chat_thread ON tasks(chat_thread_id)')
    }
  } catch {
    // tasks table may not exist yet
  }
}

// --- Threads ---

export function getChatThreads(opts: {
  status?: string
  limit?: number
  offset?: number
} = {}): (ChatThread & { last_message_preview: string | null; message_count: number; linked_task_ids: string | null })[] {
  const database = getDb()
  if (!database) return []

  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.status) {
    conditions.push('t.status = ?')
    params.push(opts.status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  return database.prepare(`
    SELECT
      t.*,
      (SELECT content FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
      (SELECT COUNT(*) FROM chat_messages WHERE thread_id = t.id) as message_count,
      (SELECT json_group_array(id) FROM tasks WHERE chat_thread_id = t.id AND deleted_at IS NULL) as linked_task_ids
    FROM chat_threads t
    ${where}
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (ChatThread & { last_message_preview: string | null; message_count: number; linked_task_ids: string | null })[]
}

export function getChatThread(id: number): ChatThread | null {
  const database = getDb()
  if (!database) return null
  return database.prepare(`
    SELECT
      t.*,
      (SELECT content FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
      (SELECT COUNT(*) FROM chat_messages WHERE thread_id = t.id) as message_count,
      (SELECT json_group_array(id) FROM tasks WHERE chat_thread_id = t.id AND deleted_at IS NULL) as linked_task_ids
    FROM chat_threads t
    WHERE t.id = ?
  `).get(id) as ChatThread | null
}

export function createChatThread(title?: string): ChatThread | null {
  const database = getDb()
  if (!database) return null
  const result = database.prepare(
    'INSERT INTO chat_threads (title) VALUES (?)'
  ).run(title || null)
  return getChatThread(result.lastInsertRowid as number)
}

export function updateChatThread(id: number, data: { title?: string; status?: string }): ChatThread | null {
  const database = getDb()
  if (!database) return null
  const sets: string[] = []
  const params: unknown[] = []
  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title) }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status) }
  sets.push("updated_at = datetime('now')")
  params.push(id)
  database.prepare(`UPDATE chat_threads SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return getChatThread(id)
}

export function deleteChatThread(id: number): boolean {
  const database = getDb()
  if (!database) return false
  const result = database.prepare('DELETE FROM chat_threads WHERE id = ?').run(id)
  return result.changes > 0
}

// --- Messages ---

export function getChatMessages(threadId: number, opts: {
  limit?: number
  offset?: number
  before?: number
} = {}): ChatMessage[] {
  const database = getDb()
  if (!database) return []

  const conditions = ['thread_id = ?']
  const params: unknown[] = [threadId]

  if (opts.before) {
    conditions.push('id < ?')
    params.push(opts.before)
  }

  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  return database.prepare(`
    SELECT * FROM chat_messages
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ChatMessage[]
}

export function addChatMessage(data: {
  thread_id: number
  role: 'user' | 'assistant'
  content: string
  task_proposal?: string
  attachments?: string
}): ChatMessage | null {
  const database = getDb()
  if (!database) return null

  const result = database.prepare(`
    INSERT INTO chat_messages (thread_id, role, content, task_proposal, attachments)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.thread_id, data.role, data.content, data.task_proposal || null, data.attachments || null)

  // Update thread timestamp
  database.prepare("UPDATE chat_threads SET updated_at = datetime('now') WHERE id = ?").run(data.thread_id)

  // Auto-set thread title from first user message
  const thread = database.prepare('SELECT title FROM chat_threads WHERE id = ?').get(data.thread_id) as { title: string | null } | undefined
  if (thread && !thread.title && data.role === 'user') {
    const titleText = data.content.length > 60 ? data.content.slice(0, 57) + '...' : data.content
    database.prepare('UPDATE chat_threads SET title = ? WHERE id = ?').run(titleText, data.thread_id)
  }

  return database.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid) as ChatMessage | null
}

// --- Task linking ---

export function linkTaskToThread(taskId: number, threadId: number): boolean {
  const database = getDb()
  if (!database) return false
  try {
    database.prepare('UPDATE tasks SET chat_thread_id = ? WHERE id = ?').run(threadId, taskId)
    return true
  } catch {
    return false
  }
}

export function getTasksForThread(threadId: number): { id: number; raw_input: string; status: string; created_at: string }[] {
  const database = getDb()
  if (!database) return []
  return database.prepare(
    'SELECT id, raw_input, status, created_at FROM tasks WHERE chat_thread_id = ? AND deleted_at IS NULL ORDER BY created_at DESC'
  ).all(threadId) as { id: number; raw_input: string; status: string; created_at: string }[]
}
