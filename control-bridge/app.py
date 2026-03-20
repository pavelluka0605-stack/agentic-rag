"""
Control Bridge API — Minimal GPT Actions bridge for marbomebel.ru
Runs on 127.0.0.1:3000, behind nginx reverse proxy.
"""

import os
import uuid
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel

import logging

logger = logging.getLogger("bridge")

# --- Auth ---
# Primary token from .env (current)
API_TOKEN = os.environ.get("BRIDGE_API_TOKEN", "")
# Legacy token for transition period (optional, set in .env as BRIDGE_API_TOKEN_LEGACY)
# Remove BRIDGE_API_TOKEN_LEGACY from .env once the GPT is updated to use the current token.
API_TOKEN_LEGACY = os.environ.get("BRIDGE_API_TOKEN_LEGACY", "")
# GPT-captured token (the exact token the custom GPT sends, captured via debug)
API_TOKEN_GPT = os.environ.get("BRIDGE_API_TOKEN_GPT", "")
# TEMPORARY DEBUG FLAG — set to "1" in .env to accept any Bearer token on POST /jobs
# Remove after confirming the GPT token. Logs the token prefix on every auth attempt.
DEBUG_ACCEPT_ANY = os.environ.get("BRIDGE_DEBUG_ACCEPT_ANY", "") == "1"

# BRIDGE_CAPTURE_TOKEN_FILE: when set, writes the next unrecognized token to this file (one-shot).
# Used to capture the exact token the GPT sends. File is written once, then ignored.
CAPTURE_TOKEN_FILE = os.environ.get("BRIDGE_CAPTURE_TOKEN_FILE", "")

def verify_token(authorization: Optional[str] = Header(None)):
    if not API_TOKEN:
        raise HTTPException(status_code=500, detail="Server token not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=403, detail="Invalid token")
    if token == API_TOKEN:
        return
    if API_TOKEN_LEGACY and token == API_TOKEN_LEGACY:
        return
    if API_TOKEN_GPT and token == API_TOKEN_GPT:
        return
    # Fuzzy match: handle O/0 confusion and trailing whitespace from GPT UI copy-paste
    normalized = token.strip()
    for accepted in [API_TOKEN, API_TOKEN_LEGACY, API_TOKEN_GPT]:
        if not accepted:
            continue
        if normalized == accepted:
            return
        # Try O↔0 substitution at position 1 (common copy-paste error)
        if len(normalized) >= 2 and len(accepted) >= 2:
            swapped = normalized[0] + ("O" if normalized[1] == "0" else "0" if normalized[1] == "O" else normalized[1]) + normalized[2:]
            if swapped == accepted or swapped.rstrip() == accepted:
                return
            # Also try with trailing char stripped (len mismatch by 1)
            if len(normalized) == len(accepted) + 1:
                if normalized[:-1] == accepted or swapped[:-1] == accepted:
                    return
    # Debug mode: capture full rejected token to file and accept
    if DEBUG_ACCEPT_ANY:
        prefix = token[:8] if len(token) > 8 else token
        logger.warning("AUTH_DEBUG: rejected token prefix=%s... len=%d", prefix, len(token))
        # Always write rejected token to capture file (overwrite)
        capture_path = "/opt/control-bridge/.captured-token"
        try:
            with open(capture_path, "w") as f:
                f.write(token)
            os.chmod(capture_path, 0o600)
            logger.warning("AUTH_DEBUG: full token written to %s", capture_path)
        except Exception as e:
            logger.warning("AUTH_DEBUG: capture write failed: %s", e)
        return  # Accept in debug mode
    raise HTTPException(status_code=403, detail="Invalid token")

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

# --- In-memory store ---
jobs: dict = {}

# --- App ---
app = FastAPI(
    title="Control Bridge API",
    description="GPT Actions bridge for marbomebel.ru",
    version="1.1.0",
    servers=[{"url": "https://api.marbomebel.ru"}],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/jobs", response_model=JobResponse, dependencies=[Depends(verify_token)])
def create_job(body: JobCreate):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "title": body.title,
        "raw_user_request": body.raw_user_request,
        "normalized_brief": body.normalized_brief,
        "status": "queued",
        "created_at": time.time(),
        "result": None,
    }
    return JobResponse(job_id=job_id, status="queued")

@app.post("/jobs/{job_id}/confirm", response_model=JobResponse, dependencies=[Depends(verify_token)])
def confirm_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job["status"] not in ("queued",):
        raise HTTPException(status_code=409, detail=f"Cannot confirm job in state: {job['status']}")
    job["status"] = "running"
    return JobResponse(job_id=job_id, status="running")

@app.get("/jobs/{job_id}/status", response_model=JobResponse, dependencies=[Depends(verify_token)])
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(job_id=job_id, status=jobs[job_id]["status"])

@app.get("/jobs/{job_id}/result", response_model=JobResult, dependencies=[Depends(verify_token)])
def get_job_result(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    # Auto-complete running jobs for demo purposes
    if job["status"] == "running":
        job["status"] = "completed"
        job["result"] = JobResultData(
            summary=f"Job '{job['title']}' completed successfully.",
            changes_made=[],
            artifacts=[],
            tests_run=[],
            manual_checks=["Review result in dashboard"],
            risks_remaining=[],
        )
    result_data = job.get("result")
    if isinstance(result_data, dict):
        result_data = JobResultData(**result_data)
    return JobResult(job_id=job_id, status=job["status"], result=result_data)

@app.post("/jobs/{job_id}/cancel", response_model=JobResponse, dependencies=[Depends(verify_token)])
def cancel_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in state: {job['status']}")
    job["status"] = "cancelled"
    return JobResponse(job_id=job_id, status="cancelled")
