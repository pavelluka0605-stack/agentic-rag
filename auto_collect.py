"""
Auto Collector — автоматический сбор шагов из разных источников.
- Git commits → шаги в память
- Shell команды → логирование
- CI/CD webhooks → результаты пайплайнов
"""

import subprocess
import os
import memory_store


def collect_git_log(
    repo_path: str = ".",
    project: str = "default",
    limit: int = 50,
) -> list[dict]:
    """Собрать git log и записать каждый коммит как шаг."""
    try:
        result = subprocess.run(
            ["git", "log", f"--max-count={limit}", "--format=%H|%s|%an|%ai"],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return []
    except FileNotFoundError:
        return []

    steps = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|", 3)
        if len(parts) < 4:
            continue
        commit_hash, message, author, date = parts

        # Определяем статус по message
        status = "success"
        if any(w in message.lower() for w in ["fix", "bugfix", "hotfix", "revert"]):
            status = "rollback" if "revert" in message.lower() else "error"

        tags = ["git"]
        # Извлекаем conventional commit type
        if ":" in message:
            commit_type = message.split(":")[0].strip().lower()
            if commit_type in ("feat", "fix", "docs", "style", "refactor", "test", "chore", "ci"):
                tags.append(commit_type)

        step = memory_store.add_step(
            action=f"git commit: {message}",
            result=f"by {author} ({commit_hash[:8]})",
            status=status,
            context=f"date: {date}",
            tags=tags,
            project=project,
            source="git",
        )
        steps.append(step)
    return steps


def collect_shell_command(
    command: str,
    project: str = "default",
    tags: list[str] | None = None,
) -> dict:
    """Выполнить shell-команду и записать результат как шаг."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        status = "success" if result.returncode == 0 else "error"
        output = result.stdout[:500] if result.stdout else result.stderr[:500]
    except subprocess.TimeoutExpired:
        status = "error"
        output = "Command timed out (60s)"
    except Exception as e:
        status = "error"
        output = str(e)

    return memory_store.add_step(
        action=f"shell: {command}",
        result=output.strip() or "(no output)",
        status=status,
        context=f"exit_code={result.returncode if 'result' in dir() else 'N/A'}",
        tags=["shell"] + (tags or []),
        project=project,
        source="shell",
    )


def install_git_hook(repo_path: str = ".", project: str = "default") -> str:
    """Установить post-commit hook, который автоматически записывает коммиты."""
    hooks_dir = os.path.join(repo_path, ".git", "hooks")
    if not os.path.isdir(hooks_dir):
        return f"Not a git repo: {repo_path}"

    hook_path = os.path.join(hooks_dir, "post-commit")
    rag_dir = os.path.dirname(os.path.abspath(__file__))

    hook_content = f"""#!/usr/bin/env bash
# Agentic RAG auto-collector
COMMIT_MSG=$(git log -1 --format=%s)
COMMIT_HASH=$(git log -1 --format=%H)
AUTHOR=$(git log -1 --format=%an)

python3 -c "
import sys; sys.path.insert(0, '{rag_dir}')
import memory_store
memory_store.add_step(
    action='git commit: ' + '''$COMMIT_MSG''',
    result='by $AUTHOR (${{COMMIT_HASH:0:8}})',
    status='success',
    tags=['git', 'auto'],
    project='{project}',
    source='git-hook',
)
" 2>/dev/null || true
"""
    # Append to existing hook if it exists
    mode = "a" if os.path.exists(hook_path) else "w"
    with open(hook_path, mode) as f:
        if mode == "a":
            f.write("\n\n# --- Agentic RAG ---\n")
        f.write(hook_content)

    os.chmod(hook_path, 0o755)
    return f"Hook installed: {hook_path}"


def collect_directory_commands(
    commands: list[str],
    project: str = "default",
    cwd: str = ".",
) -> list[dict]:
    """Выполнить список команд последовательно, записывая каждую."""
    results = []
    for cmd in commands:
        step = collect_shell_command(cmd, project=project, tags=["batch"])
        results.append(step)
        if step["status"] == "error":
            break  # остановиться при ошибке
    return results
