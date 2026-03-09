"""
Wiki — личные заметки, ссылки, сниппеты, howto.

Быстрый доступ к заметкам с полнотекстовым поиском.
"""

import memory_store


def save_note(
    title: str,
    content: str,
    tags: list[str] | None = None,
    project: str = "default",
    priority: int = 1,
) -> dict:
    """Сохранить заметку."""
    return memory_store.add_step(
        action=f"note: {title}",
        result=content,
        status="success",
        tags=["wiki", "note"] + (tags or []),
        project=project,
        source="wiki",
        category="wiki",
        kind="note",
        priority=priority,
    )


def save_link(
    title: str,
    url: str,
    description: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Сохранить ссылку с описанием."""
    return memory_store.add_step(
        action=f"link: {title}",
        result=url,
        status="success",
        context=description,
        tags=["wiki", "link"] + (tags or []),
        project=project,
        source="wiki",
        category="wiki",
        kind="link",
    )


def save_snippet(
    title: str,
    code: str,
    language: str = "",
    description: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Сохранить сниппет кода."""
    result = f"```{language}\n{code}\n```" if language else code
    return memory_store.add_step(
        action=f"snippet: {title}",
        result=result,
        status="success",
        context=description,
        tags=["wiki", "snippet", language] + (tags or []) if language else ["wiki", "snippet"] + (tags or []),
        project=project,
        source="wiki",
        category="wiki",
        kind="snippet",
        priority=1,
    )


def save_howto(
    title: str,
    steps_text: str,
    tags: list[str] | None = None,
    project: str = "default",
    priority: int = 2,
) -> dict:
    """Сохранить how-to инструкцию."""
    return memory_store.add_step(
        action=f"howto: {title}",
        result=steps_text,
        status="success",
        tags=["wiki", "howto"] + (tags or []),
        project=project,
        source="wiki",
        category="wiki",
        kind="howto",
        priority=priority,
    )


def save_reference(
    title: str,
    content: str,
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Сохранить справочную информацию."""
    return memory_store.add_step(
        action=f"ref: {title}",
        result=content,
        tags=["wiki", "reference"] + (tags or []),
        project=project,
        source="wiki",
        category="wiki",
        kind="reference",
        status="success",
    )


def get_notes(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("note", project)


def get_links(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("link", project)


def get_snippets(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("snippet", project)


def get_howtos(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("howto", project)


def get_all_wiki(project: str | None = None) -> list[dict]:
    return memory_store.get_by_category("wiki", project)


def search(query: str, project: str | None = None) -> list[dict]:
    """Полнотекстовый поиск по wiki."""
    results = memory_store.search_text(query, project)
    return [r for r in results if r.get("category") == "wiki"]
