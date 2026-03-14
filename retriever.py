"""
RAG Retriever — векторный поиск по смыслу.

Приоритеты:
  1. OpenAI text-embedding-3-small (если есть OPENAI_API_KEY)
  2. sentence-transformers all-MiniLM-L6-v2 (если установлен)
  3. Keyword search (всегда работает)

Кэширование эмбеддингов в SQLite — не пересчитывает уже известные тексты.
"""

import os
import json
import sqlite3
import hashlib
import numpy as np
from typing import Optional

# ─── Embedding cache ─────────────────────────────────

_CACHE_DB = os.environ.get("RAG_CACHE_DB", "rag_embeddings.db")


def _get_cache_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_CACHE_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
            text_hash TEXT PRIMARY KEY,
            embedding BLOB,
            model TEXT,
            dim INTEGER
        )
    """)
    conn.commit()
    return conn


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:32]


def _cache_get(hashes: list[str]) -> dict[str, np.ndarray]:
    if not hashes:
        return {}
    conn = _get_cache_conn()
    placeholders = ",".join("?" for _ in hashes)
    rows = conn.execute(
        f"SELECT text_hash, embedding, dim FROM embeddings WHERE text_hash IN ({placeholders})",
        hashes,
    ).fetchall()
    conn.close()
    result = {}
    for h, blob, dim in rows:
        result[h] = np.frombuffer(blob, dtype=np.float32).reshape(dim)
    return result


def _cache_put(items: list[tuple[str, np.ndarray, str]]):
    if not items:
        return
    conn = _get_cache_conn()
    for h, emb, model in items:
        blob = emb.astype(np.float32).tobytes()
        conn.execute(
            "INSERT OR REPLACE INTO embeddings (text_hash, embedding, model, dim) VALUES (?, ?, ?, ?)",
            (h, blob, model, len(emb)),
        )
    conn.commit()
    conn.close()


# ─── OpenAI embeddings ───────────────────────────────

_openai_client = None
OPENAI_MODEL = "text-embedding-3-small"


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            return None
        try:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=api_key, timeout=30)
        except ImportError:
            return None
    return _openai_client


def _embed_openai(texts: list[str]) -> Optional[np.ndarray]:
    client = _get_openai_client()
    if client is None:
        return None

    # Check cache
    hashes = [_text_hash(t) for t in texts]
    cached = _cache_get(hashes)

    # Find uncached
    uncached_indices = [i for i, h in enumerate(hashes) if h not in cached]

    if uncached_indices:
        uncached_texts = [texts[i] for i in uncached_indices]
        try:
            response = client.embeddings.create(
                model=OPENAI_MODEL,
                input=uncached_texts,
            )
            new_embeddings = [np.array(d.embedding, dtype=np.float32) for d in response.data]
            # Cache new embeddings
            to_cache = []
            for idx, emb in zip(uncached_indices, new_embeddings):
                h = hashes[idx]
                cached[h] = emb
                to_cache.append((h, emb, OPENAI_MODEL))
            _cache_put(to_cache)
        except Exception:
            return None

    # Build result array in order
    embeddings = np.array([cached[h] for h in hashes])
    # Normalize
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return embeddings / norms


# ─── sentence-transformers fallback ──────────────────

_st_model = None


def _get_st_model():
    global _st_model
    if _st_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _st_model = "unavailable"
    return _st_model


def _embed_st(texts: list[str]) -> Optional[np.ndarray]:
    model = _get_st_model()
    if model == "unavailable":
        return None
    return model.encode(texts, normalize_embeddings=True)


# ─── Unified embed ───────────────────────────────────

def _embed(texts: list[str]) -> Optional[np.ndarray]:
    """Try OpenAI first, then sentence-transformers, then None."""
    result = _embed_openai(texts)
    if result is not None:
        return result
    return _embed_st(texts)


# ─── Keyword search (always works) ───────────────────

def _keyword_search(query: str, steps: list[dict], top_k: int) -> list[dict]:
    query_words = set(query.lower().split())
    scored = []
    for step in steps:
        text = f"{step['action']} {step['result']} {step.get('context', '')}".lower()
        score = sum(1 for w in query_words if w in text)
        # Boost by priority
        score += step.get("priority", 0) * 0.5
        if score > 0:
            scored.append((score, step))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s[1] for s in scored[:top_k]]


# ─── Main search ─────────────────────────────────────

def search(
    query: str,
    steps: list[dict],
    top_k: int = 20,
    category: str | None = None,
) -> list[dict]:
    """Найти top_k релевантных шагов.

    1. OpenAI embeddings (text-embedding-3-small) с кэшем
    2. sentence-transformers (если установлен)
    3. Keyword search (fallback)

    category: фильтр по категории (devops/knowledge/wiki/step)
    """
    if not steps:
        return []

    # Filter by category if specified
    if category:
        steps = [s for s in steps if s.get("category") == category]
        if not steps:
            return []

    texts = [
        f"{s['action']} | {s['result']} | {s.get('context', '')} | {' '.join(s.get('tags', []))}"
        for s in steps
    ]
    embeddings = _embed(texts)

    if embeddings is None:
        return _keyword_search(query, steps, top_k)

    query_emb = _embed([query])
    if query_emb is None:
        return _keyword_search(query, steps, top_k)

    similarities = np.dot(embeddings, query_emb.T).flatten()

    # Boost by priority (small factor to not override similarity)
    for i, s in enumerate(steps):
        similarities[i] += s.get("priority", 0) * 0.02

    top_indices = np.argsort(similarities)[::-1][:top_k]
    return [steps[i] for i in top_indices if similarities[i] > 0.1]


def get_embedding_stats() -> dict:
    """Статистика по кэшу эмбеддингов."""
    try:
        conn = _get_cache_conn()
        total = conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
        models = conn.execute("SELECT model, COUNT(*) FROM embeddings GROUP BY model").fetchall()
        conn.close()
        return {
            "cached_embeddings": total,
            "by_model": {m: c for m, c in models},
            "cache_db": _CACHE_DB,
        }
    except Exception:
        return {"cached_embeddings": 0, "error": "cache unavailable"}
