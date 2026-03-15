#!/usr/bin/env python3
"""
RAG Save — сохраняет взаимодействия чата в RAG-память.
Вызывается из Node.js server.js после успешного ответа.

Использование: python3 rag_save.py "действие" "результат" "категория" '["тег1","тег2"]'
"""

import sys
import os
import json

# Путь к корню проекта
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

DB_FILE = os.path.join(PROJECT_ROOT, "rag_memory.db")
os.environ.setdefault("RAG_DB", DB_FILE)

import memory_store


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)

    action = sys.argv[1]
    result = sys.argv[2]
    category = sys.argv[3] if len(sys.argv) > 3 else "knowledge"
    tags = []
    if len(sys.argv) > 4:
        try:
            tags = json.loads(sys.argv[4])
        except (json.JSONDecodeError, ValueError):
            tags = []

    memory_store.add_step(
        action=action,
        result=result,
        status="success",
        context="auto-saved from chat.marbomebel.ru",
        tags=tags,
        project="marbomebel",
        source="chat-auto",
        category=category,
        kind="note",
    )
