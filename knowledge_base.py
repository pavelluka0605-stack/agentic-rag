"""
Knowledge Base — архитектурные решения, ADR, паттерны, уроки.

Проектная база знаний: почему приняли решение, какие альтернативы рассматривали,
какие паттерны работают, какие зависимости между компонентами.
"""

import memory_store


def save_decision(
    title: str,
    decision: str,
    reasoning: str = "",
    alternatives: str = "",
    tags: list[str] | None = None,
    project: str = "default",
    priority: int = 3,
) -> dict:
    """Записать архитектурное решение (ADR-style)."""
    context_parts = []
    if reasoning:
        context_parts.append(f"Reasoning: {reasoning}")
    if alternatives:
        context_parts.append(f"Alternatives: {alternatives}")
    return memory_store.add_step(
        action=f"decision: {title}",
        result=decision,
        status="success",
        context="\n".join(context_parts),
        tags=["knowledge", "decision"] + (tags or []),
        project=project,
        source="knowledge",
        category="knowledge",
        kind="decision",
        priority=priority,
    )


def save_adr(
    title: str,
    status: str,
    context: str,
    decision: str,
    consequences: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Записать полноценный ADR (Architecture Decision Record)."""
    result = f"Status: {status}\nDecision: {decision}"
    if consequences:
        result += f"\nConsequences: {consequences}"
    return memory_store.add_step(
        action=f"ADR: {title}",
        result=result,
        status="success",
        context=context,
        tags=["knowledge", "adr"] + (tags or []),
        project=project,
        source="knowledge",
        category="knowledge",
        kind="adr",
        priority=4,
    )


def save_pattern(
    name: str,
    description: str,
    example: str = "",
    when_to_use: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Записать паттерн — подход, который работает."""
    context = ""
    if when_to_use:
        context = f"When: {when_to_use}"
    if example:
        context += f"\nExample: {example}" if context else f"Example: {example}"
    return memory_store.add_step(
        action=f"pattern: {name}",
        result=description,
        status="success",
        context=context,
        tags=["knowledge", "pattern"] + (tags or []),
        project=project,
        source="knowledge",
        category="knowledge",
        kind="pattern",
        priority=2,
    )


def save_lesson(
    title: str,
    what_happened: str,
    lesson: str,
    tags: list[str] | None = None,
    project: str = "default",
    related_to: int | None = None,
) -> dict:
    """Записать урок — что пошло не так и чему научились."""
    return memory_store.add_step(
        action=f"lesson: {title}",
        result=lesson,
        status="rollback",
        context=what_happened,
        tags=["knowledge", "lesson"] + (tags or []),
        project=project,
        source="knowledge",
        category="knowledge",
        kind="lesson",
        priority=3,
        parent_id=related_to,
    )


def save_dependency(
    component: str,
    depends_on: str,
    description: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Записать зависимость между компонентами."""
    return memory_store.add_step(
        action=f"dependency: {component} → {depends_on}",
        result=description or f"{component} depends on {depends_on}",
        status="success",
        tags=["knowledge", "dependency"] + (tags or []),
        project=project,
        source="knowledge",
        category="knowledge",
        kind="dependency",
    )


def get_decisions(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("decision", project)


def get_adrs(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("adr", project)


def get_patterns(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("pattern", project)


def get_lessons(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("lesson", project)


def get_dependencies(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("dependency", project)


def get_all_knowledge(project: str | None = None) -> list[dict]:
    return memory_store.get_by_category("knowledge", project)
