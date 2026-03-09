"""
Agentic RAG — главный модуль, объединяющий все слои.

Пайплайн:
  Запрос → Retriever (поиск по смыслу) → GPT-4o Agent (анализ) → Чистый результат
"""

import memory_store
import retriever
import reasoning_agent


def golden_path(query: str = "", tags: list[str] | None = None) -> str:
    """Извлечь чистую успешную цепочку шагов.

    Главная функция: берёт все шаги (или по тегам),
    прогоняет через DeepSeek, получает golden path без ошибок.
    """
    if tags:
        steps = memory_store.get_by_tags(tags)
    else:
        steps = memory_store.get_all()

    if not steps:
        return "Память пуста. Нет шагов для анализа."

    # Если есть запрос — сначала фильтруем через retriever
    if query:
        steps = retriever.search(query, steps, top_k=30)

    return reasoning_agent.extract_golden_path(steps, task_description=query)


def smart_search(query: str) -> str:
    """Умный поиск: найти → понять → структурировать."""
    steps = memory_store.get_all()
    if not steps:
        return "Память пуста."

    relevant = retriever.search(query, steps, top_k=20)
    if not relevant:
        return f"Ничего не найдено по запросу: {query}"

    return reasoning_agent.smart_search(relevant, query)


def analyze(question: str) -> str:
    """Глубокий анализ с ответом на вопрос."""
    steps = memory_store.get_all()
    if not steps:
        return "Память пуста."

    relevant = retriever.search(question, steps, top_k=20)
    if not relevant:
        relevant = steps[-20:]  # последние 20, если поиск ничего не дал

    return reasoning_agent.analyze(relevant, question)


def remember(
    action: str,
    result: str,
    status: str = "success",
    context: str = "",
    tags: list[str] | None = None,
) -> dict:
    """Запомнить шаг."""
    return memory_store.add_step(action, result, status, context, tags)
