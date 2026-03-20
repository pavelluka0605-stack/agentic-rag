"""
Control Bridge API — Minimal GPT Actions bridge for marbomebel.ru
Runs on 0.0.0.0:3000, behind Traefik reverse proxy.
Jobs persisted in SQLite at /opt/control-bridge/jobs.db
"""

import json
import os
import sqlite3
import uuid
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel

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
def create_job(body: JobCreate):
    job_id = str(uuid.uuid4())
    db_create_job(job_id, body.title, body.raw_user_request, body.normalized_brief)
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
    # Auto-complete running jobs for demo purposes
    if job["status"] == "running":
        result_data = JobResultData(
            summary=f"Job '{job['title']}' completed successfully.",
            changes_made=[],
            artifacts=[],
            tests_run=[],
            manual_checks=["Review result in dashboard"],
            risks_remaining=[],
        )
        db_update_status(job_id, "completed", json.dumps(result_data.model_dump()))
        return JobResult(job_id=job_id, status="completed", result=result_data)
    result_data = None
    if job.get("result_json"):
        result_data = JobResultData(**json.loads(job["result_json"]))
    return JobResult(job_id=job_id, status=job["status"], result=result_data)

@app.post("/jobs/{job_id}/cancel", response_model=JobResponse, dependencies=[Depends(verify_token)])
def cancel_job(job_id: str):
    job = db_get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in state: {job['status']}")
    db_update_status(job_id, "cancelled")
    return JobResponse(job_id=job_id, status="cancelled")
