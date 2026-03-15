#!/usr/bin/env python3
"""
RAG Search bridge — вызывается из Node.js server.js перед Claude CLI.
Принимает запрос, ищет по векторной памяти, возвращает контекст.

Usage: python3 rag_search.py "запрос пользователя"
Output: JSON { "found": N, "context": "..." }
"""

import sys
import os
import json

# Путь к корню проекта (родительская директория claude-chat/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

# БД памяти лежит в корне проекта
DB_FILE = os.path.join(PROJECT_ROOT, "rag_memory.db")
CACHE_DB = os.path.join(PROJECT_ROOT, "rag_embeddings.db")
os.environ.setdefault("RAG_DB", DB_FILE)
os.environ.setdefault("RAG_CACHE_DB", CACHE_DB)

import memory_store
import retriever


def search(query: str, top_k: int = 15) -> dict:
    """Поиск релевантного контекста из RAG-памяти."""
    steps = memory_store.get_all()
    if not steps:
        return {"found": 0, "context": ""}

    relevant = retriever.search(query, steps, top_k=top_k)
    if not relevant:
        return {"found": 0, "context": ""}

    # Форматируем контекст для Claude
    lines = []
    for s in relevant:
        cat = s.get("category", "step")
        kind = s.get("kind", "")
        tags = ", ".join(s.get("tags", []))
        prefix = f"[{cat}"
        if kind:
            prefix += f"/{kind}"
        prefix += "]"
        if tags:
            prefix += f" ({tags})"

        lines.append(f"{prefix} {s['action']}")
        if s.get("result"):
            lines.append(f"  → {s['result']}")
        if s.get("context"):
            lines.append(f"  Контекст: {s['context']}")
        lines.append("")

    context = "\n".join(lines).strip()
    return {"found": len(relevant), "context": context}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"found": 0, "context": ""}, ensure_ascii=False))
        sys.exit(0)

    query = sys.argv[1]
    result = search(query)
    print(json.dumps(result, ensure_ascii=False))
