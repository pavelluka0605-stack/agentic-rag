"""
RAG Retriever — поиск релевантных шагов по смыслу.
Использует sentence-transformers для эмбеддингов + cosine similarity.
Fallback на keyword search если модель не загружена.
"""

import numpy as np
from typing import Optional

_model = None


def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _model = "fallback"
    return _model


def _embed(texts: list[str]) -> Optional[np.ndarray]:
    model = _get_model()
    if model == "fallback":
        return None
    return model.encode(texts, normalize_embeddings=True)


def _keyword_search(query: str, steps: list[dict], top_k: int) -> list[dict]:
    """Fallback: простой поиск по ключевым словам."""
    query_words = set(query.lower().split())
    scored = []
    for step in steps:
        text = f"{step['action']} {step['result']} {step['context']}".lower()
        score = sum(1 for w in query_words if w in text)
        if score > 0:
            scored.append((score, step))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s[1] for s in scored[:top_k]]


def search(query: str, steps: list[dict], top_k: int = 20) -> list[dict]:
    """Найти top_k релевантных шагов по запросу.

    Сначала пробует semantic search, если не получается — keyword search.
    Возвращает шаги отсортированные по релевантности.
    """
    if not steps:
        return []

    texts = [f"{s['action']} | {s['result']} | {s['context']}" for s in steps]
    embeddings = _embed(texts)

    if embeddings is None:
        return _keyword_search(query, steps, top_k)

    query_emb = _embed([query])
    similarities = np.dot(embeddings, query_emb.T).flatten()

    top_indices = np.argsort(similarities)[::-1][:top_k]
    return [steps[i] for i in top_indices if similarities[i] > 0.1]
