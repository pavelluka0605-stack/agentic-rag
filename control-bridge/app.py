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

# --- Models ---
class JobCreate(BaseModel):
    title: str
    raw_user_request: str
    normalized_brief: str = ""

class JobResponse(BaseModel):
    job_id: str
    status: str

class JobResult(BaseModel):
    job_id: str
    status: str
    result: Optional[dict] = None

# --- In-memory store ---
jobs: dict = {}

# --- App ---
app = FastAPI(
    title="Control Bridge API",
    description="GPT Actions bridge for marbomebel.ru",
    version="1.0.0",
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
        job["result"] = {
            "summary": f"Job '{job['title']}' completed successfully.",
            "details": {"request": job["raw_user_request"], "brief": job["normalized_brief"]},
        }
    return JobResult(job_id=job_id, status=job["status"], result=job.get("result"))

@app.post("/jobs/{job_id}/cancel", response_model=JobResponse, dependencies=[Depends(verify_token)])
def cancel_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in state: {job['status']}")
    job["status"] = "cancelled"
    return JobResponse(job_id=job_id, status="cancelled")
