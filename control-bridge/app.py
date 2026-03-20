"""
Control Bridge API — GPT Actions bridge for marbomebel.ru
Runs on 0.0.0.0:3000, behind Traefik reverse proxy.
Jobs persisted in SQLite. On createJob, dispatches to Control API
(port 3901) which runs the full pipeline: interpret → confirm → start → Claude Code.
"""

import json
import os
import sqlite3
import uuid
import time
import threading
import logging
import urllib.request
import urllib.error
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger("bridge")

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

# --- App ---
app = FastAPI(
    title="Control Bridge API",
    description="GPT Actions bridge for marbomebel.ru",
    version="1.2.0",
    servers=[{"url": "https://api.marbomebel.ru"}],
)

@app.get("/health")
def health():
    return {"ok": True}

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
    job = db_get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "queued":
        raise HTTPException(status_code=409, detail=f"Cannot confirm job in state: {job['status']}")
    db_update_status(job_id, "running")
    return JobResponse(job_id=job_id, status="running")

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
