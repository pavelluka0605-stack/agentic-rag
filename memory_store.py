"""
Memory Store v3 — SQLite + мультипроектная память + типизация.

Типы записей (category):
  - step      — шаг работы (action → result)
  - devops    — команда, конфиг, инцидент, runbook
  - knowledge — архитектурное решение, ADR, паттерн
  - wiki      — заметка, ссылка, справка

Каждая запись может иметь:
  - kind      — подтип (command/config/incident/adr/pattern/note/link/snippet)
  - priority  — 0-5 (0=нет, 5=критический)
  - parent_id — ссылка на связанную запись
"""

import sqlite3
import json
import os
from datetime import datetime
from typing import Optional

DB_FILE = os.environ.get("RAG_DB", "rag_memory.db")
DEFAULT_PROJECT = "default"

CATEGORIES = ("step", "devops", "knowledge", "wiki")
KINDS = {
    "devops": ("command", "config", "incident", "runbook", "deploy", "monitor"),
    "knowledge": ("adr", "pattern", "decision", "lesson", "dependency"),
    "wiki": ("note", "link", "snippet", "howto", "reference"),
    "step": ("action",),
}


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
            source TEXT DEFAULT 'manual',
            category TEXT NOT NULL DEFAULT 'step',
            kind TEXT DEFAULT '',
            priority INTEGER DEFAULT 0,
            parent_id INTEGER DEFAULT NULL,
            FOREIGN KEY (parent_id) REFERENCES steps(id)
        )
    """)
    # Migrate first (add columns before creating indexes)
    _migrate(conn)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_project ON steps(project)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON steps(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_category ON steps(category)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_kind ON steps(kind)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_priority ON steps(priority)")
    conn.commit()
    return conn


def _migrate(conn: sqlite3.Connection):
    """Add new columns to old databases."""
    cols = {r[1] for r in conn.execute("PRAGMA table_info(steps)").fetchall()}
    migrations = [
        ("category", "TEXT NOT NULL DEFAULT 'step'"),
        ("kind", "TEXT DEFAULT ''"),
        ("priority", "INTEGER DEFAULT 0"),
        ("parent_id", "INTEGER DEFAULT NULL"),
    ]
    for col, typedef in migrations:
        if col not in cols:
            conn.execute(f"ALTER TABLE steps ADD COLUMN {col} {typedef}")


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d["tags"])
    d.setdefault("category", "step")
    d.setdefault("kind", "")
    d.setdefault("priority", 0)
    d.setdefault("parent_id", None)
    return d


def add_step(
    action: str,
    result: str,
    status: str = "success",
    context: str = "",
    tags: list[str] | None = None,
    project: str = DEFAULT_PROJECT,
    source: str = "manual",
    category: str = "step",
    kind: str = "",
    priority: int = 0,
    parent_id: int | None = None,
    db_path: str = DB_FILE,
) -> dict:
    conn = _get_conn(db_path)
    now = datetime.now().isoformat()
    tags_json = json.dumps(tags or [], ensure_ascii=False)
    cur = conn.execute(
        "INSERT INTO steps (project, timestamp, action, result, status, context, tags, source, category, kind, priority, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (project, now, action, result, status, context, tags_json, source, category, kind, priority, parent_id),
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
        "category": category,
        "kind": kind,
        "priority": priority,
        "parent_id": parent_id,
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


def get_by_category(category: str, project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    conn = _get_conn(db_path)
    if project:
        rows = conn.execute("SELECT * FROM steps WHERE category = ? AND project = ? ORDER BY id", (category, project)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM steps WHERE category = ? ORDER BY id", (category,)).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_by_kind(kind: str, project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    conn = _get_conn(db_path)
    if project:
        rows = conn.execute("SELECT * FROM steps WHERE kind = ? AND project = ? ORDER BY id", (kind, project)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM steps WHERE kind = ? ORDER BY id", (kind,)).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_by_priority(min_priority: int = 1, project: str | None = None, db_path: str = DB_FILE) -> list[dict]:
    conn = _get_conn(db_path)
    if project:
        rows = conn.execute("SELECT * FROM steps WHERE priority >= ? AND project = ? ORDER BY priority DESC, id", (min_priority, project)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM steps WHERE priority >= ? ORDER BY priority DESC, id", (min_priority,)).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_children(parent_id: int, db_path: str = DB_FILE) -> list[dict]:
    conn = _get_conn(db_path)
    rows = conn.execute("SELECT * FROM steps WHERE parent_id = ? ORDER BY id", (parent_id,)).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_by_id(step_id: int, db_path: str = DB_FILE) -> dict | None:
    conn = _get_conn(db_path)
    row = conn.execute("SELECT * FROM steps WHERE id = ?", (step_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def update_step(step_id: int, db_path: str = DB_FILE, **kwargs) -> dict | None:
    conn = _get_conn(db_path)
    allowed = {"action", "result", "status", "context", "tags", "category", "kind", "priority", "parent_id"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        conn.close()
        return get_by_id(step_id, db_path)
    if "tags" in updates and isinstance(updates["tags"], list):
        updates["tags"] = json.dumps(updates["tags"], ensure_ascii=False)
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [step_id]
    conn.execute(f"UPDATE steps SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()
    return get_by_id(step_id, db_path)


def stats(project: str | None = None, db_path: str = DB_FILE) -> dict:
    conn = _get_conn(db_path)
    if project:
        total = conn.execute("SELECT COUNT(*) as c FROM steps WHERE project = ?", (project,)).fetchone()["c"]
        by_status = conn.execute(
            "SELECT status, COUNT(*) as c FROM steps WHERE project = ? GROUP BY status", (project,)
        ).fetchall()
        by_category = conn.execute(
            "SELECT category, COUNT(*) as c FROM steps WHERE project = ? GROUP BY category", (project,)
        ).fetchall()
    else:
        total = conn.execute("SELECT COUNT(*) as c FROM steps").fetchone()["c"]
        by_status = conn.execute("SELECT status, COUNT(*) as c FROM steps GROUP BY status").fetchall()
        by_category = conn.execute("SELECT category, COUNT(*) as c FROM steps GROUP BY category").fetchall()
    conn.close()
    return {
        "total": total,
        "by_status": {r["status"]: r["c"] for r in by_status},
        "by_category": {r["category"]: r["c"] for r in by_category},
        "projects": list_projects(db_path),
    }
