"""
Control Bridge API — GPT Actions bridge for marbomebel.ru
Runs on 0.0.0.0:3000, behind Traefik reverse proxy.
Jobs persisted in SQLite. On createJob, dispatches to Control API
(port 3901) which runs the full pipeline: interpret → confirm → start → Claude Code.

Memory API — shared memory for GPT and Claude Code.
Both read/write the same SQLite memory.db (6 layers + FTS5 search).
"""

import json
import os
import re
import sqlite3
import uuid
import time
import threading
import logging
import hashlib
import urllib.request
import urllib.error
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks, Query
from pydantic import BaseModel

logger = logging.getLogger("bridge")

# --- Version / uptime ---
_STARTED_AT = time.time()
_VERSION = "2.0.0"

# --- Concurrency lock ---
# Only one task can run at a time to prevent VPS resource exhaustion.
_running_lock = threading.Lock()
_running_job_id: Optional[str] = None

# --- Auth ---
API_TOKEN = os.environ.get("BRIDGE_API_TOKEN", "")

def verify_token(authorization: Optional[str] = Header(None)):
    if not API_TOKEN:
        raise HTTPException(status_code=500, detail="Server token not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")

# --- SQLite storage ---
DB_PATH = os.environ.get("BRIDGE_DB_PATH", "/opt/control-bridge/jobs.db")

def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _init_db():
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            job_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            raw_user_request TEXT NOT NULL,
            normalized_brief TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'queued',
            created_at REAL NOT NULL,
            result_json TEXT
        )
    """)
    conn.commit()
    conn.close()

_init_db()

def db_create_job(job_id: str, title: str, raw_user_request: str, normalized_brief: str) -> dict:
    conn = _get_db()
    conn.execute(
        "INSERT INTO jobs (job_id, title, raw_user_request, normalized_brief, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)",
        (job_id, title, raw_user_request, normalized_brief, time.time()),
    )
    conn.commit()
    conn.close()
    return {"job_id": job_id, "status": "queued"}

def db_get_job(job_id: str) -> Optional[dict]:
    conn = _get_db()
    row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)

def db_update_status(job_id: str, status: str, result_json: Optional[str] = None):
    conn = _get_db()
    if result_json is not None:
        conn.execute("UPDATE jobs SET status = ?, result_json = ? WHERE job_id = ?", (status, result_json, job_id))
    else:
        conn.execute("UPDATE jobs SET status = ? WHERE job_id = ?", (status, job_id))
    conn.commit()
    conn.close()

# --- Control API dispatcher ---
CONTROL_API_URL = os.environ.get("CONTROL_API_URL", "http://127.0.0.1:3901")
CONTROL_API_TOKEN = os.environ.get("CONTROL_API_TOKEN", "")

def _api_call(method: str, path: str, body: dict = None) -> dict:
    """Call Control API (port 3901) with Bearer auth."""
    url = f"{CONTROL_API_URL}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Authorization": f"Bearer {CONTROL_API_TOKEN}"}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        logger.error("Control API %s %s → %d: %s", method, path, e.code, body_text)
        return {"error": body_text, "status_code": e.code}
    except Exception as e:
        logger.error("Control API %s %s failed: %s", method, path, e)
        return {"error": str(e)}

def _api_call_checked(method: str, path: str, body: dict = None, step: str = "") -> dict:
    """Call Control API and raise on error."""
    result = _api_call(method, path, body)
    if "error" in result and "status_code" in result:
        raise RuntimeError(f"{step}: HTTP {result['status_code']} — {result['error']}")
    if "error" in result and not result.get("id"):
        raise RuntimeError(f"{step}: {result['error']}")
    return result

def dispatch_to_claude(job_id: str, title: str, raw_user_request: str, normalized_brief: str):
    """Background: create task in Control API and run full pipeline.
    Pipeline: create → interpret (LLM) → confirm (LLM) → start (tmux dispatch).
    Enforces single-task concurrency to prevent VPS resource exhaustion.
    """
    global _running_job_id
    try:
        with _running_lock:
            _running_job_id = job_id

        # 0. Pre-check: Control API is reachable
        health = _api_call("GET", "/health")
        if "error" in health:
            raise RuntimeError(f"Control API unreachable: {health['error']}")

        # 1. Create task
        task = _api_call_checked("POST", "/api/tasks", {"raw_input": raw_user_request}, step="create")
        task_id = task.get("id")
        if not task_id:
            raise RuntimeError(f"create returned no id: {task}")

        logger.info("dispatch job=%s → task=%s created", job_id, task_id)
        db_update_status(job_id, "dispatched")

        # 2. Interpret (LLM call — may take 10-20s)
        _api_call_checked("POST", f"/api/tasks/{task_id}/interpret", step="interpret")
        logger.info("dispatch job=%s → task=%s interpreted", job_id, task_id)

        # 3. Confirm with mode=safe (builds engineering packet via LLM — may take 10-20s)
        _api_call_checked("POST", f"/api/tasks/{task_id}/confirm", {"mode": "safe"}, step="confirm")
        logger.info("dispatch job=%s → task=%s confirmed", job_id, task_id)

        # 4. Start execution (writes task file + dispatches to tmux)
        _api_call_checked("POST", f"/api/tasks/{task_id}/start", {}, step="start")
        logger.info("dispatch job=%s → task=%s started (dispatched to Claude Code)", job_id, task_id)

        db_update_status(job_id, "running")

    except Exception as e:
        logger.error("dispatch job=%s failed at: %s", job_id, e)
        db_update_status(job_id, "failed", result_json=json.dumps({"summary": str(e)}))
    finally:
        with _running_lock:
            if _running_job_id == job_id:
                _running_job_id = None

# --- Models ---
class JobCreate(BaseModel):
    title: str
    raw_user_request: str
    normalized_brief: str = ""

class JobResponse(BaseModel):
    job_id: str
    status: str

class JobResultData(BaseModel):
    summary: str = ""
    changes_made: list[str] = []
    artifacts: list[str] = []
    tests_run: list[str] = []
    manual_checks: list[str] = []
    risks_remaining: list[str] = []

class JobResult(BaseModel):
    job_id: str
    status: str
    result: Optional[JobResultData] = None

# --- Memory DB (shared with Claude Code MCP) ---
MEMORY_DB_PATH = os.environ.get("MEMORY_DB_PATH", "/opt/claude-code/memory/memory.db")

def _get_mem_db() -> sqlite3.Connection:
    conn = sqlite3.connect(MEMORY_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _fts_query(text: str) -> str:
    """Sanitize text for FTS5 MATCH (same logic as db.js)."""
    terms = re.sub(r"[^\w\s]", " ", text or "").split()
    quoted = [f'"{t}"' for t in terms if len(t) > 1]
    return " OR ".join(quoted) if quoted else '""'

def _fingerprint(text: str) -> str:
    normalized = re.sub(r"\s+", " ", (text or "").lower()).strip() or "__empty__"
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]

def _mem_search(query: str, tables: list[str] | None = None, project: str | None = None, limit: int = 10) -> list[dict]:
    """FTS5 cross-layer search (same as MemoryDB.search in db.js)."""
    fts_q = _fts_query(query)
    all_tables = tables or ["incidents", "solutions", "decisions", "contexts", "policies", "episodes"]
    results = []
    conn = _get_mem_db()
    for table in all_tables:
        try:
            if project:
                sql = f"SELECT '{table}' as _type, t.*, fts.rank FROM {table}_fts fts JOIN {table} t ON t.id = fts.rowid WHERE {table}_fts MATCH ? AND t.project = ? ORDER BY fts.rank LIMIT ?"
                rows = conn.execute(sql, (fts_q, project, limit)).fetchall()
            else:
                sql = f"SELECT '{table}' as _type, t.*, fts.rank FROM {table}_fts fts JOIN {table} t ON t.id = fts.rowid WHERE {table}_fts MATCH ? ORDER BY fts.rank LIMIT ?"
                rows = conn.execute(sql, (fts_q, limit)).fetchall()
            results.extend(dict(r) for r in rows)
        except Exception:
            pass
    conn.close()
    results.sort(key=lambda x: x.get("rank", 0))
    return results[:limit]

def _mem_bootstrap(project: str | None = None) -> dict:
    """Load session bootstrap context (same as MemoryDB.getBootstrapContext)."""
    conn = _get_mem_db()
    ctx = {}
    try:
        # Active policies
        if project:
            ctx["policies"] = [dict(r) for r in conn.execute("SELECT * FROM policies WHERE active = 1 AND project = ? ORDER BY created_at DESC", (project,)).fetchall()]
        else:
            ctx["policies"] = [dict(r) for r in conn.execute("SELECT * FROM policies WHERE active = 1 ORDER BY created_at DESC").fetchall()]
        # Recent sessions
        ctx["recent_sessions"] = [dict(r) for r in conn.execute("SELECT * FROM episodes ORDER BY created_at DESC LIMIT 3").fetchall()]
        # Open incidents
        ctx["open_incidents"] = [dict(r) for r in conn.execute("SELECT * FROM incidents WHERE status = 'open' ORDER BY updated_at DESC LIMIT 5").fetchall()]
        # Top verified solutions
        ctx["top_solutions"] = [dict(r) for r in conn.execute("SELECT * FROM solutions WHERE verified = 1 ORDER BY usefulness_score DESC, use_count DESC LIMIT 5").fetchall()]
        # Recent decisions
        ctx["recent_decisions"] = [dict(r) for r in conn.execute("SELECT * FROM decisions ORDER BY created_at DESC LIMIT 5").fetchall()]
        # Stats
        stats = {}
        for t in ["policies", "episodes", "incidents", "solutions", "decisions", "contexts"]:
            try:
                stats[t] = conn.execute(f"SELECT COUNT(*) as c FROM {t}").fetchone()["c"]
            except Exception:
                stats[t] = 0
        stats["open_incidents"] = conn.execute("SELECT COUNT(*) as c FROM incidents WHERE status = 'open'").fetchone()["c"]
        stats["verified_solutions"] = conn.execute("SELECT COUNT(*) as c FROM solutions WHERE verified = 1").fetchone()["c"]
        ctx["stats"] = stats
    finally:
        conn.close()
    return ctx

def _mem_stats() -> dict:
    conn = _get_mem_db()
    stats = {}
    for t in ["policies", "episodes", "incidents", "solutions", "decisions", "contexts", "github_events"]:
        try:
            stats[t] = conn.execute(f"SELECT COUNT(*) as c FROM {t}").fetchone()["c"]
        except Exception:
            stats[t] = 0
    try:
        stats["open_incidents"] = conn.execute("SELECT COUNT(*) as c FROM incidents WHERE status = 'open'").fetchone()["c"]
        stats["verified_solutions"] = conn.execute("SELECT COUNT(*) as c FROM solutions WHERE verified = 1").fetchone()["c"]
    except Exception:
        pass
    conn.close()
    return stats

# --- App ---
app = FastAPI(
    title="Control Bridge API",
    description="GPT Actions bridge + shared memory for marbomebel.ru",
    version="2.0.0",
    servers=[{"url": "https://api.marbomebel.ru"}],
)

@app.get("/health")
def health():
    return {"ok": True, "version": _VERSION, "uptime_s": int(time.time() - _STARTED_AT)}

@app.post("/jobs", response_model=JobResponse, dependencies=[Depends(verify_token)])
def create_job(body: JobCreate, background_tasks: BackgroundTasks):
    # Concurrency guard: reject if another job is already running
    with _running_lock:
        if _running_job_id is not None:
            raise HTTPException(
                status_code=429,
                detail=f"Another job is already running: {_running_job_id}. Wait for it to finish.",
            )

    # Also check DB for stuck jobs (dispatched/running for > 10 min)
    conn = _get_db()
    stuck = conn.execute(
        "SELECT job_id FROM jobs WHERE status IN ('queued','dispatched','running') AND created_at < ?",
        (time.time() - 600,),
    ).fetchall()
    for row in stuck:
        conn.execute("UPDATE jobs SET status = 'failed' WHERE job_id = ?", (row["job_id"],))
        logger.warning("Auto-failed stuck job %s", row["job_id"])
    conn.commit()
    conn.close()

    job_id = str(uuid.uuid4())
    db_create_job(job_id, body.title, body.raw_user_request, body.normalized_brief)
    # Dispatch to Control API → Claude Code in background
    if CONTROL_API_TOKEN:
        background_tasks.add_task(
            dispatch_to_claude, job_id, body.title, body.raw_user_request, body.normalized_brief
        )
    return JobResponse(job_id=job_id, status="queued")

@app.post("/jobs/{job_id}/confirm", response_model=JobResponse, dependencies=[Depends(verify_token)])
def confirm_job(job_id: str):
    """No-op: jobs are auto-dispatched on creation. Kept for backward compat."""
    job = db_get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    # Always return current status — never 409
    return JobResponse(job_id=job_id, status=job["status"])

@app.get("/jobs/{job_id}/status", response_model=JobResponse, dependencies=[Depends(verify_token)])
def get_job_status(job_id: str):
    job = db_get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(job_id=job_id, status=job["status"])

@app.get("/jobs/{job_id}/result", response_model=JobResult, dependencies=[Depends(verify_token)])
def get_job_result(job_id: str):
    job = db_get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    result_data = None
    if job.get("result_json"):
        result_data = JobResultData(**json.loads(job["result_json"]))
    return JobResult(job_id=job_id, status=job["status"], result=result_data)

@app.get("/jobs/active", dependencies=[Depends(verify_token)])
def get_active_jobs():
    """Return currently running/queued jobs. GPT can check before submitting."""
    conn = _get_db()
    rows = conn.execute(
        "SELECT job_id, status, title, created_at FROM jobs WHERE status IN ('queued','dispatched','running') ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/jobs/{job_id}/cancel", response_model=JobResponse, dependencies=[Depends(verify_token)])
def cancel_job(job_id: str):
    job = db_get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in state: {job['status']}")
    db_update_status(job_id, "cancelled")
    return JobResponse(job_id=job_id, status="cancelled")


# =============================================================================
# MEMORY API — shared memory for GPT and Claude Code
# =============================================================================

@app.get("/memory/search", dependencies=[Depends(verify_token)])
def memory_search(
    q: str = Query(..., description="Search query"),
    tables: Optional[str] = Query(None, description="Comma-separated: incidents,solutions,decisions,contexts,policies,episodes"),
    project: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """FTS5 full-text search across all memory layers. Returns ranked results."""
    tbl_list = [t.strip() for t in tables.split(",")] if tables else None
    return _mem_search(q, tables=tbl_list, project=project, limit=limit)

@app.get("/memory/bootstrap", dependencies=[Depends(verify_token)])
def memory_bootstrap(project: Optional[str] = Query(None)):
    """Load full session context: policies, recent sessions, open incidents, top solutions, decisions, stats.
    Call this at the START of every task to get project context."""
    return _mem_bootstrap(project)

@app.get("/memory/stats", dependencies=[Depends(verify_token)])
def memory_stats():
    """Get counts for all memory layers."""
    return _mem_stats()

@app.get("/memory/incidents", dependencies=[Depends(verify_token)])
def memory_incidents(
    status: Optional[str] = Query(None, description="open, investigating, fixed, wontfix, duplicate"),
    project: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """List incidents (errors and their fixes)."""
    conn = _get_mem_db()
    sql = "SELECT * FROM incidents WHERE 1=1"
    params: list = []
    if status:
        sql += " AND status = ?"
        params.append(status)
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows

@app.get("/memory/solutions", dependencies=[Depends(verify_token)])
def memory_solutions(
    verified: Optional[bool] = Query(None),
    project: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """List proven solutions and patterns."""
    conn = _get_mem_db()
    sql = "SELECT * FROM solutions WHERE 1=1"
    params: list = []
    if verified is not None:
        sql += " AND verified = ?"
        params.append(1 if verified else 0)
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY usefulness_score DESC, use_count DESC, created_at DESC LIMIT ?"
    params.append(limit)
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows

@app.get("/memory/decisions", dependencies=[Depends(verify_token)])
def memory_decisions(
    project: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """List architectural decisions."""
    conn = _get_mem_db()
    sql = "SELECT * FROM decisions WHERE 1=1"
    params: list = []
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows

@app.get("/memory/policies", dependencies=[Depends(verify_token)])
def memory_policies(
    project: Optional[str] = Query(None),
    category: Optional[str] = Query(None, description="rule, constraint, convention, limitation"),
):
    """List active project rules and constraints."""
    conn = _get_mem_db()
    sql = "SELECT * FROM policies WHERE active = 1"
    params: list = []
    if project:
        sql += " AND project = ?"
        params.append(project)
    if category:
        sql += " AND category = ?"
        params.append(category)
    sql += " ORDER BY created_at DESC"
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows

@app.get("/memory/episodes", dependencies=[Depends(verify_token)])
def memory_episodes(
    project: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """List recent work sessions."""
    conn = _get_mem_db()
    sql = "SELECT * FROM episodes WHERE 1=1"
    params: list = []
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows

@app.get("/memory/contexts", dependencies=[Depends(verify_token)])
def memory_contexts(
    category: Optional[str] = Query(None, description="code, infra, docs, deployment, summary, config, api"),
    project: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """List saved code/infra/deployment contexts."""
    conn = _get_mem_db()
    sql = "SELECT * FROM contexts WHERE 1=1"
    params: list = []
    if category:
        sql += " AND category = ?"
        params.append(category)
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows

# --- Memory write endpoints (GPT can also record findings) ---

class IncidentCreate(BaseModel):
    error_message: str
    context: str = ""
    probable_cause: str = ""
    project: str = ""
    service: str = ""

@app.post("/memory/incidents", dependencies=[Depends(verify_token)])
def memory_add_incident(body: IncidentCreate):
    """Record a new error/incident. Auto-deduplicates by fingerprint."""
    conn = _get_mem_db()
    fp = _fingerprint(body.error_message)
    existing = conn.execute("SELECT * FROM incidents WHERE fingerprint = ? AND status != 'duplicate'", (fp,)).fetchone()
    if existing:
        conn.execute("UPDATE incidents SET occurrence_count = occurrence_count + 1, updated_at = datetime('now') WHERE id = ?", (existing["id"],))
        conn.commit()
        result = dict(conn.execute("SELECT * FROM incidents WHERE id = ?", (existing["id"],)).fetchone())
        result["deduplicated"] = True
        conn.close()
        return result
    conn.execute(
        "INSERT INTO incidents (project, service, fingerprint, error_message, context, probable_cause) VALUES (?, ?, ?, ?, ?, ?)",
        (body.project or None, body.service or None, fp, body.error_message, body.context or None, body.probable_cause or None),
    )
    conn.commit()
    row = dict(conn.execute("SELECT * FROM incidents WHERE fingerprint = ?", (fp,)).fetchone())
    conn.close()
    return row

class SolutionCreate(BaseModel):
    title: str
    description: str
    code: str = ""
    tags: str = ""
    project: str = ""
    verified: bool = False

@app.post("/memory/solutions", dependencies=[Depends(verify_token)])
def memory_add_solution(body: SolutionCreate):
    """Record a working solution or pattern."""
    conn = _get_mem_db()
    conn.execute(
        "INSERT INTO solutions (project, title, description, code, tags, verified) VALUES (?, ?, ?, ?, ?, ?)",
        (body.project or None, body.title, body.description, body.code or None, body.tags or None, 1 if body.verified else 0),
    )
    conn.commit()
    row = dict(conn.execute("SELECT * FROM solutions ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()
    return row

class EpisodeCreate(BaseModel):
    summary: str
    what_done: str = ""
    where_stopped: str = ""
    what_remains: str = ""
    project: str = ""

@app.post("/memory/episodes", dependencies=[Depends(verify_token)])
def memory_add_episode(body: EpisodeCreate):
    """Record a session summary."""
    conn = _get_mem_db()
    conn.execute(
        "INSERT INTO episodes (project, summary, what_done, where_stopped, what_remains) VALUES (?, ?, ?, ?, ?)",
        (body.project or None, body.summary, body.what_done or None, body.where_stopped or None, body.what_remains or None),
    )
    conn.commit()
    row = dict(conn.execute("SELECT * FROM episodes ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()
    return row
