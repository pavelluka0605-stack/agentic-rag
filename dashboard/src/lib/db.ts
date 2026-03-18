import 'server-only'
import Database from 'better-sqlite3'
import type {
  MemoryStats,
  Incident,
  Solution,
  Episode,
  Decision,
  Policy,
  Context,
  GithubEvent,
  SearchResult,
  MemoryType,
} from '@/types'

let db: Database.Database | null = null

function getDbPath(): string {
  if (process.env.MEMORY_DB_PATH) {
    return process.env.MEMORY_DB_PATH
  }
  if (process.env.NODE_ENV === 'development') {
    return '../.claude/memory/memory.db'
  }
  return '/opt/claude-code/memory/memory.db'
}

export function getDb(): Database.Database | null {
  if (db) return db

  const dbPath = getDbPath()

  try {
    const fs = require('fs')
    if (!fs.existsSync(dbPath)) {
      console.warn(`[db] Database file not found: ${dbPath}`)
      return null
    }
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
    try { db.pragma('journal_mode = WAL') } catch { /* readonly — skip WAL */ }
    return db
  } catch (err) {
    console.error(`[db] Failed to open database: ${err}`)
    return null
  }
}

export function queryAll<T>(sql: string, params?: unknown[]): T[] {
  const database = getDb()
  if (!database) return []
  try {
    const stmt = database.prepare(sql)
    return (params ? stmt.all(...params) : stmt.all()) as T[]
  } catch (err) {
    console.error(`[db] queryAll error: ${err}`)
    return []
  }
}

export function queryOne<T>(sql: string, params?: unknown[]): T | null {
  const database = getDb()
  if (!database) return null
  try {
    const stmt = database.prepare(sql)
    return (params ? stmt.get(...params) : stmt.get()) as T | null ?? null
  } catch (err) {
    console.error(`[db] queryOne error: ${err}`)
    return null
  }
}

// --- Stats ---

export function getStats(): MemoryStats {
  const defaults: MemoryStats = {
    policies: 0,
    episodes: 0,
    incidents: 0,
    solutions: 0,
    decisions: 0,
    contexts: 0,
    github_events: 0,
    open_incidents: 0,
    verified_solutions: 0,
  }

  const database = getDb()
  if (!database) return defaults

  try {
    const tables = ['policies', 'episodes', 'incidents', 'solutions', 'decisions', 'contexts', 'github_events'] as const
    for (const table of tables) {
      const row = queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table}`)
      if (row) defaults[table] = row.cnt
    }

    const openRow = queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM incidents WHERE status IN ('open', 'investigating')`
    )
    if (openRow) defaults.open_incidents = openRow.cnt

    const verifiedRow = queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM solutions WHERE verified = 1`
    )
    if (verifiedRow) defaults.verified_solutions = verifiedRow.cnt

    return defaults
  } catch (err) {
    console.error(`[db] getStats error: ${err}`)
    return defaults
  }
}

// --- Incidents ---

export function getIncidents(opts: {
  status?: string
  project?: string
  limit?: number
  offset?: number
} = {}): Incident[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.status) {
    conditions.push('status = ?')
    params.push(opts.status)
  }
  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  return queryAll<Incident>(
    `SELECT * FROM incidents ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
}

export function getIncident(id: number): Incident | null {
  return queryOne<Incident>('SELECT * FROM incidents WHERE id = ?', [id])
}

// --- Solutions ---

export function getSolutions(opts: {
  verified?: boolean
  project?: string
  pattern_type?: string
  limit?: number
  offset?: number
} = {}): Solution[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.verified !== undefined) {
    conditions.push('verified = ?')
    params.push(opts.verified ? 1 : 0)
  }
  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }
  if (opts.pattern_type) {
    conditions.push('pattern_type = ?')
    params.push(opts.pattern_type)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  return queryAll<Solution>(
    `SELECT * FROM solutions ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
}

export function getSolution(id: number): Solution | null {
  return queryOne<Solution>('SELECT * FROM solutions WHERE id = ?', [id])
}

// --- Episodes ---

export function getEpisodes(opts: {
  project?: string
  limit?: number
  offset?: number
} = {}): Episode[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  return queryAll<Episode>(
    `SELECT * FROM episodes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
}

export function getEpisode(id: number): Episode | null {
  return queryOne<Episode>('SELECT * FROM episodes WHERE id = ?', [id])
}

// --- Decisions ---

export function getDecisions(opts: {
  project?: string
  limit?: number
} = {}): Decision[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50

  return queryAll<Decision>(
    `SELECT * FROM decisions ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  )
}

// --- Policies ---

export function getPolicies(opts: {
  project?: string
  category?: string
  limit?: number
} = {}): Policy[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }
  if (opts.category) {
    conditions.push('category = ?')
    params.push(opts.category)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50

  return queryAll<Policy>(
    `SELECT * FROM policies ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  )
}

// --- Contexts ---

export function getContexts(opts: {
  project?: string
  category?: string
  limit?: number
} = {}): Context[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }
  if (opts.category) {
    conditions.push('category = ?')
    params.push(opts.category)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50

  return queryAll<Context>(
    `SELECT * FROM contexts ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  )
}

// --- GitHub Events ---

export function getGithubEvents(opts: {
  repo?: string
  event_type?: string
  limit?: number
} = {}): GithubEvent[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.repo) {
    conditions.push('repo = ?')
    params.push(opts.repo)
  }
  if (opts.event_type) {
    conditions.push('event_type = ?')
    params.push(opts.event_type)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50

  return queryAll<GithubEvent>(
    `SELECT * FROM github_events ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  )
}

// --- Tasks ---

export function getTasks(opts: {
  status?: string
  project?: string
  limit?: number
  offset?: number
} = {}): import('@/types').Task[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.status) {
    conditions.push('status = ?')
    params.push(opts.status)
  }
  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  return queryAll<import('@/types').Task>(
    `SELECT * FROM tasks ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
}

export function getTask(id: number): import('@/types').Task | null {
  return queryOne<import('@/types').Task>('SELECT * FROM tasks WHERE id = ?', [id])
}

export function getTaskEvents(taskId: number): import('@/types').TaskEvent[] {
  return queryAll<import('@/types').TaskEvent>(
    'SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC',
    [taskId]
  )
}

export function getTaskStats(): { total: number; draft: number; pending: number; running: number; done: number; failed: number } {
  const defaults = { total: 0, draft: 0, pending: 0, running: 0, done: 0, failed: 0 }
  try {
    const total = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM tasks')
    if (total) defaults.total = total.cnt
    for (const status of ['draft', 'pending', 'running', 'done', 'failed'] as const) {
      const row = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM tasks WHERE status = ?', [status])
      if (row) defaults[status] = row.cnt
    }
  } catch {
    // tasks table may not exist yet
  }
  return defaults
}

// --- Search ---

interface FtsRow {
  rowid: number
  rank: number
  [key: string]: unknown
}

const FTS_TABLE_MAP: Record<MemoryType, { fts: string; main: string; fields: string }> = {
  policies: { fts: 'policies_fts', main: 'policies', fields: 'title, content, category' },
  episodes: { fts: 'episodes_fts', main: 'episodes', fields: 'summary, what_done, where_stopped, what_remains' },
  incidents: { fts: 'incidents_fts', main: 'incidents', fields: 'error_message, stack_trace, probable_cause, verified_fix' },
  solutions: { fts: 'solutions_fts', main: 'solutions', fields: 'title, description, code' },
  decisions: { fts: 'decisions_fts', main: 'decisions', fields: 'title, context, chosen, alternatives' },
  contexts: { fts: 'contexts_fts', main: 'contexts', fields: 'title, content' },
  github_events: { fts: 'github_events_fts', main: 'github_events', fields: 'event_type, repo, payload_summary' },
}

export function searchMemory(
  query: string,
  opts: { tables?: MemoryType[]; project?: string; limit?: number } = {}
): SearchResult[] {
  const database = getDb()
  if (!database) return []

  const tables = opts.tables ?? (Object.keys(FTS_TABLE_MAP) as MemoryType[])
  const limit = opts.limit ?? 20
  const results: SearchResult[] = []

  for (const table of tables) {
    const mapping = FTS_TABLE_MAP[table]
    if (!mapping) continue

    try {
      let sql = `
        SELECT m.*, fts.rank
        FROM ${mapping.fts} fts
        JOIN ${mapping.main} m ON m.rowid = fts.rowid
        WHERE ${mapping.fts} MATCH ?
      `
      const params: unknown[] = [query]

      if (opts.project) {
        sql += ' AND m.project = ?'
        params.push(opts.project)
      }

      sql += ` ORDER BY fts.rank LIMIT ?`
      params.push(limit)

      const rows = queryAll<FtsRow>(sql, params)
      for (const row of rows) {
        results.push({
          ...row,
          _type: table,
          id: (row.id as number | undefined) ?? row.rowid,
          rank: row.rank,
        } as unknown as SearchResult)
      }
    } catch {
      // FTS table may not exist — skip silently
    }
  }

  // Sort by BM25 rank (lower = better match in SQLite FTS5)
  results.sort((a, b) => a.rank - b.rank)

  return results.slice(0, limit)
}

// --- Open Loops ---

export function getOpenLoops(): Episode[] {
  return queryAll<Episode>(
    `SELECT * FROM episodes WHERE open_loops IS NOT NULL AND open_loops != '' AND open_loops != '[]' ORDER BY created_at DESC`
  )
}

// --- Projects ---

export interface ProjectInfo {
  project: string
  counts: Record<string, number>
}

export function getProjects(): ProjectInfo[] {
  const database = getDb()
  if (!database) return []

  const tables = ['policies', 'episodes', 'incidents', 'solutions', 'decisions', 'contexts'] as const
  const projectMap = new Map<string, Record<string, number>>()

  for (const table of tables) {
    const rows = queryAll<{ project: string; cnt: number }>(
      `SELECT COALESCE(project, 'unset') as project, COUNT(*) as cnt FROM ${table} GROUP BY project`
    )
    for (const row of rows) {
      if (!projectMap.has(row.project)) {
        projectMap.set(row.project, {})
      }
      projectMap.get(row.project)![table] = row.cnt
    }
  }

  return Array.from(projectMap.entries()).map(([project, counts]) => ({
    project,
    counts,
  }))
}
