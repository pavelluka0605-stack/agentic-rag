// =============================================================================
// Unit tests for MemoryDB (db.js)
// Run: npx vitest run tests/db.test.js
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryDB } from "../db.js";

let db;
let dbPath;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `test-memory-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new MemoryDB(dbPath);
});

afterEach(() => {
  db.close();
  for (const ext of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(dbPath + ext); } catch {}
  }
});

// ── Fingerprint ──────────────────────────────────────────────────────────────

describe("fingerprint", () => {
  it("returns consistent hash for same input", () => {
    expect(db.fingerprint("hello world")).toBe(db.fingerprint("hello world"));
  });

  it("normalizes whitespace and case", () => {
    expect(db.fingerprint("Hello  World")).toBe(db.fingerprint("hello world"));
  });

  it("returns 16-char hex", () => {
    const fp = db.fingerprint("test");
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]+$/);
  });

  it("handles empty input", () => {
    const fp = db.fingerprint("");
    expect(fp).toHaveLength(16);
    expect(db.fingerprint(null)).toBe(fp);
    expect(db.fingerprint(undefined)).toBe(fp);
  });
});

// ── Policies ─────────────────────────────────────────────────────────────────

describe("policies", () => {
  it("adds and retrieves a policy", () => {
    const p = db.addPolicy({ title: "No rm -rf", content: "Never run rm -rf /", category: "rule" });
    expect(p.id).toBeDefined();
    expect(p.title).toBe("No rm -rf");

    const all = db.getPolicies();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("No rm -rf");
  });

  it("filters by category and active", () => {
    db.addPolicy({ title: "Rule 1", content: "r1", category: "rule" });
    db.addPolicy({ title: "Limit 1", content: "l1", category: "limitation" });

    expect(db.getPolicies({ category: "rule" })).toHaveLength(1);
    expect(db.getPolicies({ category: "limitation" })).toHaveLength(1);
  });

  it("updates a policy", () => {
    const p = db.addPolicy({ title: "Old", content: "old", category: "rule" });
    const updated = db.updatePolicy(p.id, { title: "New", content: "new" });
    expect(updated.title).toBe("New");
    expect(updated.content).toBe("new");
  });
});

// ── Episodes ─────────────────────────────────────────────────────────────────

describe("episodes", () => {
  it("adds and retrieves episodes", () => {
    const e = db.addEpisode({ summary: "Worked on tests", what_done: "Added unit tests" });
    expect(e.id).toBeDefined();
    expect(e.summary).toBe("Worked on tests");

    expect(db.getEpisodes()).toHaveLength(1);
  });

  it("stores open loops as JSON", () => {
    db.addEpisode({ summary: "Session", open_loops: ["fix bug", "deploy"] });
    const loops = db.getOpenLoops();
    expect(loops).toHaveLength(1);
    expect(JSON.parse(loops[0].open_loops)).toEqual(["fix bug", "deploy"]);
  });

  it("ignores empty open loops", () => {
    db.addEpisode({ summary: "Done", open_loops: [] });
    expect(db.getOpenLoops()).toHaveLength(0);
  });
});

// ── Incidents ────────────────────────────────────────────────────────────────

describe("incidents", () => {
  it("adds a new incident", () => {
    const inc = db.addIncident({ error_message: "ENOENT: file not found" });
    expect(inc.id).toBeDefined();
    expect(inc.status).toBe("open");
    expect(inc.occurrence_count).toBe(1);
    expect(inc.fingerprint).toBeDefined();
  });

  it("deduplicates by fingerprint", () => {
    const inc1 = db.addIncident({ error_message: "ENOENT: file not found" });
    const inc2 = db.addIncident({ error_message: "ENOENT: file not found" });
    expect(inc2.deduplicated).toBe(true);
    expect(inc2.occurrence_count).toBe(2);
  });

  it("fixes an incident", () => {
    const inc = db.addIncident({ error_message: "broken" });
    const fixed = db.fixIncident(inc.id, { verified_fix: "Added missing file", probable_cause: "Missing config" });
    expect(fixed.status).toBe("fixed");
    expect(fixed.verified_fix).toBe("Added missing file");
    expect(fixed.probable_cause).toBe("Missing config");
  });

  it("finds similar incidents via FTS", () => {
    db.addIncident({ error_message: "ENOENT: no such file or directory /app/config.json" });
    db.addIncident({ error_message: "ECONNREFUSED: connection refused localhost:5432" });

    const similar = db.findSimilarIncidents("ENOENT file not found");
    expect(similar.length).toBeGreaterThanOrEqual(1);
    expect(similar[0].error_message).toContain("ENOENT");
  });

  it("filters by status", () => {
    const inc = db.addIncident({ error_message: "err1" });
    db.addIncident({ error_message: "err2" });
    db.fixIncident(inc.id, { verified_fix: "fixed it" });

    expect(db.getIncidents({ status: "open" })).toHaveLength(1);
    expect(db.getIncidents({ status: "fixed" })).toHaveLength(1);
  });

  it("updates incident status", () => {
    const inc = db.addIncident({ error_message: "investigating" });
    const updated = db.updateIncidentStatus(inc.id, "investigating");
    expect(updated.status).toBe("investigating");
  });
});

// ── Solutions ────────────────────────────────────────────────────────────────

describe("solutions", () => {
  it("adds and retrieves solutions", () => {
    const sol = db.addSolution({ title: "Fix deploy", description: "Use --force flag", pattern_type: "command" });
    expect(sol.id).toBeDefined();
    expect(sol.verified).toBe(0);
    expect(sol.use_count).toBe(0);
  });

  it("verifies a solution", () => {
    const sol = db.addSolution({ title: "Test", description: "Test fix" });
    const verified = db.verifySolution(sol.id);
    expect(verified.verified).toBe(1);
    expect(verified.verified_at).toBeDefined();
  });

  it("tracks usage", () => {
    const sol = db.addSolution({ title: "Test", description: "Test fix" });
    db.useSolution(sol.id);
    db.useSolution(sol.id);
    const updated = db.useSolution(sol.id);
    expect(updated.use_count).toBe(3);
  });

  it("rates a solution", () => {
    const sol = db.addSolution({ title: "Test", description: "d" });
    const rated = db.rateSolution(sol.id, 8);
    expect(rated.usefulness_score).toBe(8);
  });

  it("auto-fixes linked incident", () => {
    const inc = db.addIncident({ error_message: "broken thing" });
    db.addSolution({ title: "The Fix", description: "How to fix it", solves_incident: inc.id });
    const updated = db.getIncidents({ status: "fixed" });
    expect(updated).toHaveLength(1);
  });

  it("finds similar solutions via FTS", () => {
    db.addSolution({ title: "Deploy fix", description: "Run deploy.sh with sudo" });
    db.addSolution({ title: "Database migration", description: "Run alembic upgrade head" });

    const found = db.findSimilarSolutions("deploy");
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].title).toContain("Deploy");
  });

  it("updates a solution", () => {
    const sol = db.addSolution({ title: "Old", description: "old desc" });
    const updated = db.updateSolution(sol.id, { title: "New", description: "new desc" });
    expect(updated.title).toBe("New");
  });
});

// ── Decisions ────────────────────────────────────────────────────────────────

describe("decisions", () => {
  it("adds a decision with alternatives", () => {
    const dec = db.addDecision({
      title: "Use SQLite",
      context: "Need simple persistent storage",
      chosen: "SQLite + FTS5",
      alternatives: ["PostgreSQL", "Redis"],
      not_doing: "No full ORM",
    });
    expect(dec.id).toBeDefined();
    expect(JSON.parse(dec.alternatives)).toEqual(["PostgreSQL", "Redis"]);
  });
});

// ── Contexts ─────────────────────────────────────────────────────────────────

describe("contexts", () => {
  it("adds and retrieves contexts", () => {
    const ctx = db.addContext({ title: "Deploy script", content: "bash deploy.sh", category: "deployment" });
    expect(ctx.id).toBeDefined();
    expect(db.getContexts({ category: "deployment" })).toHaveLength(1);
  });
});

// ── GitHub Events ────────────────────────────────────────────────────────────

describe("github events", () => {
  it("adds and retrieves events", () => {
    const ev = db.addGithubEvent({ event_type: "push", repo: "org/repo", ref: "main" });
    expect(ev.id).toBeDefined();

    const events = db.getGithubEvents({ repo: "org/repo" });
    expect(events).toHaveLength(1);
  });
});

// ── Cross-layer Search ───────────────────────────────────────────────────────

describe("search", () => {
  it("searches across multiple tables", () => {
    db.addIncident({ error_message: "ENOENT: missing config file" });
    db.addSolution({ title: "Config fix", description: "Create default config file" });

    const results = db.search("config file");
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by table", () => {
    db.addIncident({ error_message: "network error" });
    db.addSolution({ title: "Network fix", description: "Retry logic" });

    const results = db.search("network", { tables: ["solutions"] });
    expect(results).toHaveLength(1);
    expect(results[0]._type).toBe("solutions");
  });
});

// ── Bootstrap Context ────────────────────────────────────────────────────────

describe("getBootstrapContext", () => {
  it("returns all layers", () => {
    db.addPolicy({ title: "P", content: "p", category: "rule" });
    db.addEpisode({ summary: "E" });
    db.addIncident({ error_message: "I" });
    db.addSolution({ title: "S", description: "s" });
    db.addDecision({ title: "D", context: "c", chosen: "ch" });

    const ctx = db.getBootstrapContext();
    expect(ctx.policies).toHaveLength(1);
    expect(ctx.recent_sessions).toHaveLength(1);
    expect(ctx.open_incidents).toHaveLength(1);
    expect(ctx.stats.policies).toBe(1);
    expect(ctx.stats.incidents).toBe(1);
  });
});

// ── Stats ────────────────────────────────────────────────────────────────────

describe("getStats", () => {
  it("returns counts for all tables", () => {
    const stats = db.getStats();
    expect(stats).toHaveProperty("policies");
    expect(stats).toHaveProperty("incidents");
    expect(stats).toHaveProperty("solutions");
    expect(stats).toHaveProperty("open_incidents");
    expect(stats).toHaveProperty("verified_solutions");
  });
});

// ── Delete & Prune ──────────────────────────────────────────────────────────

describe("deleteEntry", () => {
  it("deletes an entry", () => {
    const p = db.addPolicy({ title: "Del", content: "d", category: "rule" });
    const result = db.deleteEntry("policies", p.id);
    expect(result.deleted).toBe(true);
    expect(db.getPolicies()).toHaveLength(0);
  });

  it("returns not found for missing id", () => {
    const result = db.deleteEntry("policies", 9999);
    expect(result.deleted).toBe(false);
  });

  it("rejects invalid table", () => {
    expect(() => db.deleteEntry("users", 1)).toThrow("Cannot delete");
  });
});

describe("pruneOld", () => {
  it("prunes old resolved incidents", () => {
    const inc = db.addIncident({ error_message: "old error" });
    db.fixIncident(inc.id, { verified_fix: "fixed" });
    // Manually backdate
    db.db.prepare("UPDATE incidents SET updated_at = datetime('now', '-100 days') WHERE id = ?").run(inc.id);

    const result = db.pruneOld({ table: "incidents", days: 90, status: "fixed" });
    expect(result.deleted).toBe(1);
  });

  it("does not prune recent entries", () => {
    db.addIncident({ error_message: "new error" });
    const result = db.pruneOld({ table: "incidents", days: 90 });
    expect(result.deleted).toBe(0);
  });

  it("rejects invalid table", () => {
    expect(() => db.pruneOld({ table: "policies" })).toThrow("Cannot prune");
  });
});

// ── FTS Query Helper ────────────────────────────────────────────────────────

describe("_ftsQuery", () => {
  it("converts text to OR-joined quoted terms", () => {
    const q = db._ftsQuery("hello world test");
    expect(q).toBe('"hello" OR "world" OR "test"');
  });

  it("strips special characters", () => {
    const q = db._ftsQuery("error: ENOENT (file)");
    expect(q).toBe('"error" OR "ENOENT" OR "file"');
  });

  it("filters single-char terms", () => {
    const q = db._ftsQuery("a bc d ef");
    expect(q).toBe('"bc" OR "ef"');
  });

  it("handles empty input", () => {
    expect(db._ftsQuery("")).toBe('""');
    expect(db._ftsQuery(null)).toBe('""');
  });
});
