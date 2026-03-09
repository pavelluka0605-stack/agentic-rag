"""
DevOps Memory — команды, конфиги, инциденты, деплои, мониторинг.

Обёртки над memory_store для удобной работы с DevOps-данными.
"""

import memory_store


def save_command(
    command: str,
    output: str = "",
    status: str = "success",
    context: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Сохранить shell-команду и её результат."""
    return memory_store.add_step(
        action=command,
        result=output or "(no output)",
        status=status,
        context=context,
        tags=["devops", "command"] + (tags or []),
        project=project,
        source="devops",
        category="devops",
        kind="command",
    )


def save_config(
    name: str,
    content: str,
    context: str = "",
    tags: list[str] | None = None,
    project: str = "default",
    priority: int = 2,
) -> dict:
    """Сохранить конфигурацию (nginx, docker, env, etc)."""
    return memory_store.add_step(
        action=f"config: {name}",
        result=content,
        status="success",
        context=context,
        tags=["devops", "config"] + (tags or []),
        project=project,
        source="devops",
        category="devops",
        kind="config",
        priority=priority,
    )


def save_incident(
    title: str,
    description: str,
    resolution: str = "",
    severity: int = 3,
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Записать инцидент: что сломалось, как починили."""
    status = "success" if resolution else "error"
    return memory_store.add_step(
        action=f"incident: {title}",
        result=resolution or description,
        status=status,
        context=description if resolution else "",
        tags=["devops", "incident"] + (tags or []),
        project=project,
        source="devops",
        category="devops",
        kind="incident",
        priority=severity,
    )


def save_deploy(
    service: str,
    version: str,
    environment: str = "production",
    status: str = "success",
    notes: str = "",
    tags: list[str] | None = None,
    project: str = "default",
) -> dict:
    """Записать деплой."""
    return memory_store.add_step(
        action=f"deploy: {service} {version} → {environment}",
        result=notes or f"Deployed {service}@{version}",
        status=status,
        context=f"env={environment}",
        tags=["devops", "deploy", environment] + (tags or []),
        project=project,
        source="devops",
        category="devops",
        kind="deploy",
        priority=3,
    )


def save_runbook(
    title: str,
    steps_text: str,
    tags: list[str] | None = None,
    project: str = "default",
    priority: int = 3,
) -> dict:
    """Сохранить runbook — инструкцию по выполнению."""
    return memory_store.add_step(
        action=f"runbook: {title}",
        result=steps_text,
        status="success",
        tags=["devops", "runbook"] + (tags or []),
        project=project,
        source="devops",
        category="devops",
        kind="runbook",
        priority=priority,
    )


def get_commands(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("command", project)


def get_configs(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("config", project)


def get_incidents(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("incident", project)


def get_deploys(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("deploy", project)


def get_runbooks(project: str | None = None) -> list[dict]:
    return memory_store.get_by_kind("runbook", project)


def get_all_devops(project: str | None = None) -> list[dict]:
    return memory_store.get_by_category("devops", project)
