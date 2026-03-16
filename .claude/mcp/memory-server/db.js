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
  }

  // ── Fingerprint for dedup ─────────────────────────────────────────────────

  fingerprint(text) {
    const normalized = (text || "").toLowerCase().replace(/\s+/g, " ").trim();
    return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
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
