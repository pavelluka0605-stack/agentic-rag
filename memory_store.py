"""
Memory Store v2 — SQLite + мультипроектная память.
Каждый шаг привязан к проекту. Поддержка кросс-проектного поиска.
"""

import sqlite3
import json
import os
from datetime import datetime
from typing import Optional

DB_FILE = os.environ.get("RAG_DB", "rag_memory.db")
DEFAULT_PROJECT = "default"


def _get_conn(db_path: str = DB_FILE) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT NOT NULL DEFAULT 'default',
            timestamp TEXT NOT NULL,
            action TEXT NOT NULL,
            result TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'success',
            context TEXT DEFAULT '',
            tags TEXT DEFAULT '[]',
            source TEXT DEFAULT 'manual'
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_project ON steps(project)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_status ON steps(status)
    """)
    conn.commit()
    return conn


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d["tags"])
    return d


def add_step(
    action: str,
    result: str,
    status: str = "success",
    context: str = "",
    tags: list[str] | None = None,
    project: str = DEFAULT_PROJECT,
    source: str = "manual",
    db_path: str = DB_FILE,
) -> dict:
    conn = _get_conn(db_path)
    now = datetime.now().isoformat()
    tags_json = json.dumps(tags or [], ensure_ascii=False)
    cur = conn.execute(
        "INSERT INTO steps (project, timestamp, action, result, status, context, tags, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (project, now, action, result, status, context, tags_json, source),
    )
    conn.commit()
    step = {
        "id": cur.lastrowid,
        "project": project,
        "timestamp": now,
        "action": action,
        "result": result,
        "status": status,
        "context": context,
        "tags": tags or [],
        "source": source,
    }
    conn.close()
    return step


def get_all(project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    conn = _get_conn(db_path)
    if project:
        rows = conn.execute("SELECT * FROM steps WHERE project = ? ORDER BY id", (project,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM steps ORDER BY id").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_by_tags(tags: list[str], project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    steps = get_all(project, db_path)
    return [s for s in steps if set(tags) & set(s.get("tags", []))]


def get_by_status(status: str, project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    conn = _get_conn(db_path)
    if project:
        rows = conn.execute("SELECT * FROM steps WHERE status = ? AND project = ? ORDER BY id", (status, project)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM steps WHERE status = ? ORDER BY id", (status,)).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def list_projects(db_path: str = DB_FILE) -> list[str]:
    conn = _get_conn(db_path)
    rows = conn.execute("SELECT DISTINCT project FROM steps ORDER BY project").fetchall()
    conn.close()
    return [r["project"] for r in rows]


def search_text(query: str, project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    """Полнотекстовый поиск по action, result, context."""
    conn = _get_conn(db_path)
    pattern = f"%{query}%"
    if project:
        rows = conn.execute(
            "SELECT * FROM steps WHERE project = ? AND (action LIKE ? OR result LIKE ? OR context LIKE ?) ORDER BY id",
            (project, pattern, pattern, pattern),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM steps WHERE (action LIKE ? OR result LIKE ? OR context LIKE ?) ORDER BY id",
            (pattern, pattern, pattern),
        ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def clear(project: str | None = None, db_path: str = DB_FILE):
    conn = _get_conn(db_path)
    if project:
        conn.execute("DELETE FROM steps WHERE project = ?", (project,))
    else:
        conn.execute("DELETE FROM steps")
    conn.commit()
    conn.close()


def stats(project: str | None = None, db_path: str = DB_FILE) -> dict:
    """Статистика по памяти."""
    conn = _get_conn(db_path)
    if project:
        total = conn.execute("SELECT COUNT(*) as c FROM steps WHERE project = ?", (project,)).fetchone()["c"]
        by_status = conn.execute(
            "SELECT status, COUNT(*) as c FROM steps WHERE project = ? GROUP BY status", (project,)
        ).fetchall()
    else:
        total = conn.execute("SELECT COUNT(*) as c FROM steps").fetchone()["c"]
        by_status = conn.execute("SELECT status, COUNT(*) as c FROM steps GROUP BY status").fetchall()
    conn.close()
    return {
        "total": total,
        "by_status": {r["status"]: r["c"] for r in by_status},
        "projects": list_projects(db_path),
    }
