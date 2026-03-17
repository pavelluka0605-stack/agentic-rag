// =============================================================================
// SQLite + FTS5 Database Layer for Multi-Layer Memory
// =============================================================================

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export class MemoryDB {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this._migrate();
  }

  _migrate() {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      this.db.exec(sql);
    }
    this._expandTaskStatuses();
  }

  // Expand task status CHECK constraint to include review states
  // SQLite can't ALTER CHECK, so we recreate the table if needed
  _expandTaskStatuses() {
    try {
      // Test if new statuses are supported
      this.db.prepare("INSERT INTO tasks (raw_input, status) VALUES ('__migrate_test__', 'review')").run();
      this.db.prepare("DELETE FROM tasks WHERE raw_input = '__migrate_test__'").run();
      // Already migrated
    } catch {
      // CHECK constraint blocks 'review' — need to recreate table
      try {
        this.db.exec(`
          BEGIN TRANSACTION;
          ALTER TABLE tasks RENAME TO tasks_old;
          CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT,
            raw_input TEXT NOT NULL,
            input_type TEXT DEFAULT 'text' CHECK(input_type IN ('text', 'voice')),
            voice_transcript TEXT,
            interpretation TEXT,
            status TEXT DEFAULT 'draft' CHECK(status IN (
              'draft', 'pending', 'confirmed', 'running',
              'review', 'needs_manual_review',
              'done', 'failed', 'cancelled'
            )),
            mode TEXT DEFAULT 'safe' CHECK(mode IN ('fast', 'safe')),
            revisions TEXT,
            engineering_packet TEXT,
            execution_run_id TEXT,
            progress TEXT,
            result_summary_ru TEXT,
            result_detail TEXT,
            error TEXT,
            telegram_notified INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
          INSERT INTO tasks SELECT * FROM tasks_old;
          DROP TABLE tasks_old;
          CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
          CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
          -- Recreate FTS triggers
          DROP TRIGGER IF EXISTS tasks_ai;
          DROP TRIGGER IF EXISTS tasks_ad;
          DROP TRIGGER IF EXISTS tasks_au;
          CREATE TRIGGER tasks_ai AFTER INSERT ON tasks BEGIN
            INSERT INTO tasks_fts(rowid, raw_input, interpretation, result_summary_ru)
            VALUES (new.id, new.raw_input, new.interpretation, new.result_summary_ru);
          END;
          CREATE TRIGGER tasks_ad AFTER DELETE ON tasks BEGIN
            INSERT INTO tasks_fts(tasks_fts, rowid, raw_input, interpretation, result_summary_ru)
            VALUES ('delete', old.id, old.raw_input, old.interpretation, old.result_summary_ru);
          END;
          CREATE TRIGGER tasks_au AFTER UPDATE ON tasks BEGIN
            INSERT INTO tasks_fts(tasks_fts, rowid, raw_input, interpretation, result_summary_ru)
            VALUES ('delete', old.id, old.raw_input, old.interpretation, old.result_summary_ru);
            INSERT INTO tasks_fts(rowid, raw_input, interpretation, result_summary_ru)
            VALUES (new.id, new.raw_input, new.interpretation, new.result_summary_ru);
          END;
          COMMIT;
        `);
        console.log("[db] Expanded task statuses to include review states");
      } catch (e) {
        console.warn("[db] Task status expansion failed (may already be done):", e.message);
      }
    }
  }

  // ── Fingerprint for dedup ─────────────────────────────────────────────────

  fingerprint(text) {
    const normalized = (text || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized) return crypto.createHash("sha256").update("__empty__").digest("hex").slice(0, 16);
    return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  // ── Update / Delete / Prune ────────────────────────────────────────────────

  updateIncidentStatus(id, status, extra = {}) {
    const fields = ["status = ?", "updated_at = datetime('now')"];
    const params = [status];
    if (extra.probable_cause) { fields.push("probable_cause = COALESCE(probable_cause, '') || ?"); params.push(extra.probable_cause); }
    if (extra.verified_fix) { fields.push("verified_fix = ?"); params.push(extra.verified_fix); }
    params.push(id);
    this.db.prepare(`UPDATE incidents SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  }

  updateSolution(id, updates) {
    const fields = ["updated_at = datetime('now')"];
    const params = [];
    for (const key of ["title", "description", "code", "commands", "tags", "verified"]) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(typeof updates[key] === "object" ? JSON.stringify(updates[key]) : updates[key]);
      }
    }
    if (fields.length === 1) return this.db.prepare("SELECT * FROM solutions WHERE id = ?").get(id);
    params.push(id);
    this.db.prepare(`UPDATE solutions SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.db.prepare("SELECT * FROM solutions WHERE id = ?").get(id);
  }

  updatePolicy(id, updates) {
    const fields = ["updated_at = datetime('now')"];
    const params = [];
    for (const key of ["title", "content", "category", "active", "verified"]) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }
    if (fields.length === 1) return this.db.prepare("SELECT * FROM policies WHERE id = ?").get(id);
    params.push(id);
    this.db.prepare(`UPDATE policies SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.db.prepare("SELECT * FROM policies WHERE id = ?").get(id);
  }

  deleteEntry(table, id) {
    const allowed = ["policies", "episodes", "incidents", "solutions", "decisions", "contexts"];
    if (!allowed.includes(table)) throw new Error(`Cannot delete from table: ${table}`);
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) return { deleted: false, reason: "not found" };
    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return { deleted: true, id, table };
  }

  pruneOld({ table, days = 90, status } = {}) {
    const allowed = ["incidents", "episodes", "contexts", "github_events"];
    if (!allowed.includes(table)) throw new Error(`Cannot prune table: ${table}`);
    let sql = `DELETE FROM ${table} WHERE updated_at < datetime('now', '-' || ? || ' days')`;
    const params = [days];
    if (status && table === "incidents") {
      sql += " AND status = ?";
      params.push(status);
    }
    const result = this.db.prepare(sql).run(...params);
    return { table, deleted: result.changes, older_than_days: days };
  }

  // ── Policy Memory ────────────────────────────────────────────────────────

  addPolicy({ project, category, title, content, source, verified }) {
    const stmt = this.db.prepare(`
      INSERT INTO policies (project, category, title, content, source, verified)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(project || null, category || "rule", title, content, source || "manual", verified ?? 1);
    return this.db.prepare("SELECT * FROM policies WHERE id = ?").get(r.lastInsertRowid);
  }

  getPolicies({ project, category, active } = {}) {
    let sql = "SELECT * FROM policies WHERE 1=1";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    if (category) { sql += " AND category = ?"; params.push(category); }
    if (active !== undefined) { sql += " AND active = ?"; params.push(active ? 1 : 0); }
    sql += " ORDER BY created_at DESC";
    return this.db.prepare(sql).all(...params);
  }

  // ── Episodic Memory ──────────────────────────────────────────────────────

  addEpisode({ project, session_id, summary, what_done, where_stopped, what_remains, open_loops, branch, files_changed }) {
    const stmt = this.db.prepare(`
      INSERT INTO episodes (project, session_id, summary, what_done, where_stopped, what_remains, open_loops, branch, files_changed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const ol = Array.isArray(open_loops) ? JSON.stringify(open_loops) : open_loops;
    const fc = Array.isArray(files_changed) ? JSON.stringify(files_changed) : files_changed;
    const r = stmt.run(project || null, session_id || null, summary, what_done || null, where_stopped || null, what_remains || null, ol || null, branch || null, fc || null);
    return this.db.prepare("SELECT * FROM episodes WHERE id = ?").get(r.lastInsertRowid);
  }

  getEpisodes({ project, limit = 10 } = {}) {
    let sql = "SELECT * FROM episodes WHERE 1=1";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    return this.db.prepare(sql).all(...params);
  }

  getOpenLoops({ project } = {}) {
    let sql = "SELECT * FROM episodes WHERE open_loops IS NOT NULL AND open_loops != '[]' AND open_loops != ''";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    sql += " ORDER BY created_at DESC LIMIT 20";
    return this.db.prepare(sql).all(...params);
  }

  // ── Incident Memory ──────────────────────────────────────────────────────

  addIncident({ project, service, error_message, stack_trace, failed_command, context, probable_cause, failed_attempts, github_issue }) {
    const fp = this.fingerprint(error_message);

    // Check for duplicate
    const existing = this.db.prepare("SELECT * FROM incidents WHERE fingerprint = ? AND status != 'duplicate'").get(fp);
    if (existing) {
      this.db.prepare("UPDATE incidents SET occurrence_count = occurrence_count + 1, updated_at = datetime('now') WHERE id = ?").run(existing.id);
      return { ...existing, occurrence_count: existing.occurrence_count + 1, deduplicated: true };
    }

    const fa = Array.isArray(failed_attempts) ? JSON.stringify(failed_attempts) : failed_attempts;
    const stmt = this.db.prepare(`
      INSERT INTO incidents (project, service, fingerprint, error_message, stack_trace, failed_command, context, probable_cause, failed_attempts, github_issue)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(project || null, service || null, fp, error_message, stack_trace || null, failed_command || null, context || null, probable_cause || null, fa || null, github_issue || null);
    return this.db.prepare("SELECT * FROM incidents WHERE id = ?").get(r.lastInsertRowid);
  }

  fixIncident(id, { verified_fix, probable_cause }) {
    this.db.prepare(`
      UPDATE incidents SET verified_fix = ?, probable_cause = COALESCE(?, probable_cause),
      status = 'fixed', fix_verified_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(verified_fix, probable_cause || null, id);
    return this.db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  }

  getIncidents({ project, service, status, limit = 20 } = {}) {
    let sql = "SELECT * FROM incidents WHERE 1=1";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    if (service) { sql += " AND service = ?"; params.push(service); }
    if (status) { sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY updated_at DESC LIMIT ?";
    params.push(limit);
    return this.db.prepare(sql).all(...params);
  }

  findSimilarIncidents(error_message, limit = 5) {
    const results = this.db.prepare(`
      SELECT i.*, rank
      FROM incidents_fts fts
      JOIN incidents i ON i.id = fts.rowid
      WHERE incidents_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(this._ftsQuery(error_message), limit);
    return results;
  }

  // ── Solution Memory ──────────────────────────────────────────────────────

  addSolution({ project, service, title, description, code, commands, pattern_type, solves_incident, verified, tags, github_pr }) {
    const cmds = Array.isArray(commands) ? JSON.stringify(commands) : commands;
    const t = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    const stmt = this.db.prepare(`
      INSERT INTO solutions (project, service, title, description, code, commands, pattern_type, solves_incident, verified, tags, github_pr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(project || null, service || null, title, description, code || null, cmds || null, pattern_type || "pattern", solves_incident || null, verified ? 1 : 0, t || null, github_pr || null);

    // If this solves an incident, mark it fixed
    if (solves_incident) {
      this.db.prepare("UPDATE incidents SET status = 'fixed', verified_fix = ?, fix_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(title + ": " + description, solves_incident);
    }

    return this.db.prepare("SELECT * FROM solutions WHERE id = ?").get(r.lastInsertRowid);
  }

  verifySolution(id) {
    this.db.prepare("UPDATE solutions SET verified = 1, verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    return this.db.prepare("SELECT * FROM solutions WHERE id = ?").get(id);
  }

  useSolution(id) {
    this.db.prepare("UPDATE solutions SET use_count = use_count + 1, updated_at = datetime('now') WHERE id = ?").run(id);
    return this.db.prepare("SELECT * FROM solutions WHERE id = ?").get(id);
  }

  rateSolution(id, score) {
    this.db.prepare("UPDATE solutions SET usefulness_score = ?, updated_at = datetime('now') WHERE id = ?").run(score, id);
    return this.db.prepare("SELECT * FROM solutions WHERE id = ?").get(id);
  }

  getSolutions({ project, service, pattern_type, verified, limit = 20 } = {}) {
    let sql = "SELECT * FROM solutions WHERE 1=1";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    if (service) { sql += " AND service = ?"; params.push(service); }
    if (pattern_type) { sql += " AND pattern_type = ?"; params.push(pattern_type); }
    if (verified !== undefined) { sql += " AND verified = ?"; params.push(verified ? 1 : 0); }
    sql += " ORDER BY usefulness_score DESC, use_count DESC, created_at DESC LIMIT ?";
    params.push(limit);
    return this.db.prepare(sql).all(...params);
  }

  findSimilarSolutions(query, limit = 5) {
    return this.db.prepare(`
      SELECT s.*, rank
      FROM solutions_fts fts
      JOIN solutions s ON s.id = fts.rowid
      WHERE solutions_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(this._ftsQuery(query), limit);
  }

  // ── Decision Memory ──────────────────────────────────────────────────────

  addDecision({ project, title, context, chosen, alternatives, tradeoffs, not_doing, revisit_trigger, supersedes, tags }) {
    const alts = Array.isArray(alternatives) ? JSON.stringify(alternatives) : alternatives;
    const t = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    const stmt = this.db.prepare(`
      INSERT INTO decisions (project, title, context, chosen, alternatives, tradeoffs, not_doing, revisit_trigger, supersedes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(project || null, title, context, chosen, alts || null, tradeoffs || null, not_doing || null, revisit_trigger || null, supersedes || null, t || null);
    return this.db.prepare("SELECT * FROM decisions WHERE id = ?").get(r.lastInsertRowid);
  }

  getDecisions({ project, limit = 20 } = {}) {
    let sql = "SELECT * FROM decisions WHERE 1=1";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    return this.db.prepare(sql).all(...params);
  }

  // ── Context Memory ───────────────────────────────────────────────────────

  addContext({ project, category, title, content, file_path, language, tags, verified }) {
    const t = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    const stmt = this.db.prepare(`
      INSERT INTO contexts (project, category, title, content, file_path, language, tags, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(project || null, category || "code", title, content, file_path || null, language || null, t || null, verified ? 1 : 0);
    return this.db.prepare("SELECT * FROM contexts WHERE id = ?").get(r.lastInsertRowid);
  }

  getContexts({ project, category, limit = 20 } = {}) {
    let sql = "SELECT * FROM contexts WHERE 1=1";
    const params = [];
    if (project) { sql += " AND project = ?"; params.push(project); }
    if (category) { sql += " AND category = ?"; params.push(category); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    return this.db.prepare(sql).all(...params);
  }

  // ── GitHub Events ────────────────────────────────────────────────────────

  addGithubEvent({ event_type, action, repo, ref, payload_summary, linked_memory_type, linked_memory_id }) {
    const stmt = this.db.prepare(`
      INSERT INTO github_events (event_type, action, repo, ref, payload_summary, linked_memory_type, linked_memory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(event_type, action || null, repo, ref || null, payload_summary || null, linked_memory_type || null, linked_memory_id || null);
    return this.db.prepare("SELECT * FROM github_events WHERE id = ?").get(r.lastInsertRowid);
  }

  getGithubEvents({ repo, event_type, limit = 20 } = {}) {
    let sql = "SELECT * FROM github_events WHERE 1=1";
    const params = [];
    if (repo) { sql += " AND repo = ?"; params.push(repo); }
    if (event_type) { sql += " AND event_type = ?"; params.push(event_type); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    return this.db.prepare(sql).all(...params);
  }

  // ── Cross-Layer Search ───────────────────────────────────────────────────

  search(query, { tables, project, limit = 10 } = {}) {
    const ftsQuery = this._ftsQuery(query);
    const allTables = tables || ["incidents", "solutions", "decisions", "contexts", "policies", "episodes"];
    const results = [];

    for (const table of allTables) {
      try {
        let sql;
        const params = [ftsQuery];

        if (project) {
          sql = `SELECT '${table}' as _type, t.*, fts.rank FROM ${table}_fts fts JOIN ${table} t ON t.id = fts.rowid WHERE ${table}_fts MATCH ? AND t.project = ? ORDER BY fts.rank LIMIT ?`;
          params.push(project, limit);
        } else {
          sql = `SELECT '${table}' as _type, t.*, fts.rank FROM ${table}_fts fts JOIN ${table} t ON t.id = fts.rowid WHERE ${table}_fts MATCH ? ORDER BY fts.rank LIMIT ?`;
          params.push(limit);
        }

        const rows = this.db.prepare(sql).all(...params);
        results.push(...rows);
      } catch (e) {
        // Skip tables that fail (e.g., empty FTS)
      }
    }

    // Sort by FTS rank (lower = better match)
    results.sort((a, b) => a.rank - b.rank);
    return results.slice(0, limit);
  }

  // ── Bootstrap Context ────────────────────────────────────────────────────

  getBootstrapContext(project) {
    const ctx = {};

    // Active policies
    ctx.policies = this.getPolicies({ project, active: true });

    // Last 3 sessions
    ctx.recent_sessions = this.getEpisodes({ project, limit: 3 });

    // Open incidents
    ctx.open_incidents = this.getIncidents({ project, status: "open", limit: 5 });

    // Top verified solutions
    ctx.top_solutions = this.getSolutions({ project, verified: true, limit: 5 });

    // Recent decisions
    ctx.recent_decisions = this.getDecisions({ project, limit: 5 });

    // Open loops
    ctx.open_loops = this.getOpenLoops({ project });

    // Stats
    ctx.stats = this.getStats();

    return ctx;
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats() {
    const tables = ["policies", "episodes", "incidents", "solutions", "decisions", "contexts", "github_events"];
    const stats = {};
    for (const t of tables) {
      try {
        stats[t] = this.db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get().count;
      } catch { stats[t] = 0; }
    }
    stats.open_incidents = this.db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'open'").get()?.count || 0;
    stats.verified_solutions = this.db.prepare("SELECT COUNT(*) as count FROM solutions WHERE verified = 1").get()?.count || 0;
    return stats;
  }

  // ── Task Pipeline ────────────────────────────────────────────────────────

  createTask({ project, raw_input, input_type, voice_transcript }) {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (project, raw_input, input_type, voice_transcript, status)
      VALUES (?, ?, ?, ?, 'draft')
    `);
    const r = stmt.run(project || null, raw_input, input_type || "text", voice_transcript || null);
    return this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(r.lastInsertRowid);
  }

  getTask(id) {
    return this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  }

  getTasks({ status, project, limit = 20, offset = 0 } = {}) {
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params = [];
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (project) { sql += " AND project = ?"; params.push(project); }
    sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    return this.db.prepare(sql).all(...params);
  }

  updateTaskInterpretation(id, interpretation) {
    this.db.prepare(`
      UPDATE tasks SET interpretation = ?, status = 'pending', updated_at = datetime('now')
      WHERE id = ?
    `).run(typeof interpretation === "object" ? JSON.stringify(interpretation) : interpretation, id);
    return this.getTask(id);
  }

  addTaskRevision(id, text) {
    const task = this.getTask(id);
    if (!task) return null;
    const revisions = task.revisions ? JSON.parse(task.revisions) : [];
    revisions.push({ text, timestamp: new Date().toISOString() });
    // Append revision to raw_input for context
    const updatedInput = task.raw_input + "\n\n[Уточнение]: " + text;
    this.db.prepare(`
      UPDATE tasks SET revisions = ?, raw_input = ?, status = 'draft', updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(revisions), updatedInput, id);
    return this.getTask(id);
  }

  confirmTask(id, { mode, engineering_packet } = {}) {
    const fields = ["status = 'confirmed'", "updated_at = datetime('now')"];
    const params = [];
    if (mode) { fields.push("mode = ?"); params.push(mode); }
    if (engineering_packet) {
      fields.push("engineering_packet = ?");
      params.push(typeof engineering_packet === "object" ? JSON.stringify(engineering_packet) : engineering_packet);
    }
    params.push(id);
    this.db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.getTask(id);
  }

  startTaskExecution(id, execution_run_id) {
    this.db.prepare(`
      UPDATE tasks SET status = 'running', execution_run_id = ?, progress = '[]', updated_at = datetime('now')
      WHERE id = ?
    `).run(execution_run_id || null, id);
    return this.getTask(id);
  }

  addTaskProgress(id, message_ru, pct) {
    const task = this.getTask(id);
    if (!task) return null;
    const progress = task.progress ? JSON.parse(task.progress) : [];
    progress.push({ message_ru, pct: pct ?? null, timestamp: new Date().toISOString() });
    this.db.prepare(`
      UPDATE tasks SET progress = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(progress), id);
    return this.getTask(id);
  }

  completeTask(id, { result_summary_ru, result_detail }) {
    this.db.prepare(`
      UPDATE tasks SET status = 'done', result_summary_ru = ?, result_detail = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(result_summary_ru || null, result_detail || null, id);
    return this.getTask(id);
  }

  failTask(id, error) {
    this.db.prepare(`
      UPDATE tasks SET status = 'failed', error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(error || "Unknown error", id);
    return this.getTask(id);
  }

  cancelTask(id) {
    this.db.prepare(`
      UPDATE tasks SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
    return this.getTask(id);
  }

  setTaskTelegramNotified(id) {
    this.db.prepare(`UPDATE tasks SET telegram_notified = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
    return this.getTask(id);
  }

  // ── Task Events (audit trail) ──────────────────────────────────────────────

  addTaskEvent(taskId, eventType, detail) {
    this.db.prepare(`
      INSERT INTO task_events (task_id, event_type, detail) VALUES (?, ?, ?)
    `).run(taskId, eventType, detail || null);
  }

  getTaskEvents(taskId) {
    return this.db.prepare(
      `SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC`
    ).all(taskId);
  }

  // ── Review states ──────────────────────────────────────────────────────────

  reviewTask(id, detail) {
    this.db.prepare(`
      UPDATE tasks SET status = 'review', updated_at = datetime('now') WHERE id = ?
    `).run(id);
    this.addTaskEvent(id, "review_requested", detail || "Задача ожидает проверки");
    return this.getTask(id);
  }

  requestManualReview(id, reason) {
    this.db.prepare(`
      UPDATE tasks SET status = 'needs_manual_review', error = ?, updated_at = datetime('now') WHERE id = ?
    `).run(reason || "Требуется ручная проверка", id);
    this.addTaskEvent(id, "manual_review_needed", reason || "Требуется ручная проверка");
    return this.getTask(id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _ftsQuery(text) {
    // Sanitize for FTS5: remove special chars, quote terms
    const terms = (text || "")
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 1)
      .map(t => `"${t}"`)
      .join(" OR ");
    return terms || '""';
  }

  close() {
    this.db.close();
  }
}
