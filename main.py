#!/usr/bin/env python3
"""
Agentic RAG v2 — CLI + Web UI.

CLI:   python main.py
Web:   python main.py --web [--port 8000]

Команды CLI:
  /remember  — запомнить шаг
  /golden    — извлечь golden path
  /search    — умный поиск
  /analyze   — глубокий анализ
  /critic    — Critic agent ревьюит шаги
  /plan      — Planner + Critic + Executor цепочка
  /export    — экспорт (markdown/bash/checklist)
  /git       — собрать git log в память
  /run       — выполнить команду и записать
  /stats     — статистика
  /steps     — показать шаги
  /projects  — список проектов
  /demo      — демо-данные
  /clear     — очистить
  /web       — запустить веб-интерфейс
  /quit      — выход
"""

import sys
import rag
import memory_store
import exporter
import agents
import auto_collect

try:
    from rich.console import Console
    from rich.markdown import Markdown
    console = Console()
    def print_md(text: str):
        console.print(Markdown(text))
    def print_info(text: str):
        console.print(f"[cyan]{text}[/cyan]")
    def print_ok(text: str):
        console.print(f"[green]{text}[/green]")
    def print_err(text: str):
        console.print(f"[red]{text}[/red]")
except ImportError:
    def print_md(text: str):
        print(text)
    def print_info(text: str):
        print(text)
    def print_ok(text: str):
        print(text)
    def print_err(text: str):
        print(text)


# Current project context
_project = "default"


def load_demo():
    memory_store.clear()
    demo = [
        ("Инициализация проекта: npm init", "package.json создан", "success", "Начало проекта", ["setup"]),
        ("Установка React: npm install react", "react@18.2.0 установлен", "success", "", ["setup", "react"]),
        ("Настройка webpack", "Ошибка: webpack.config.js не найден", "error", "Забыли создать конфиг", ["setup", "webpack"]),
        ("Создание webpack.config.js вручную", "Конфиг с ошибкой в путях", "error", "Неправильный output path", ["setup", "webpack"]),
        ("Исправление путей в webpack.config.js", "Сборка проходит", "success", "path.resolve(__dirname, 'dist')", ["setup", "webpack"]),
        ("Добавление TypeScript", "tsconfig.json создан", "success", "", ["setup", "typescript"]),
        ("Компиляция TS — strict mode", "Ошибки в 12 файлах", "error", "strict: true слишком строгий", ["typescript"]),
        ("Откат strict mode", "Компиляция прошла", "rollback", "strictNullChecks only", ["typescript"]),
        ("Настройка ESLint", "ESLint работает", "success", "@typescript-eslint/parser", ["setup", "lint"]),
        ("Jest не видит TS", "ModuleFileExtensions error", "error", "Jest не настроен для .tsx", ["tests"]),
        ("Добавление ts-jest", "Тесты проходят", "success", "npm install ts-jest", ["tests"]),
        ("Деплой на Vercel", "Деплой успешен", "success", "vercel --prod", ["deploy"]),
        ("Настройка CI/CD", "Pipeline работает", "success", "GitHub Actions", ["ci", "deploy"]),
    ]
    for a, r, s, c, t in demo:
        memory_store.add_step(a, r, s, c, t)
    print_ok(f"Загружено {len(demo)} демо-шагов.")


def main():
    global _project

    if "--web" in sys.argv:
        start_web()
        return

    print_info("=== Agentic RAG v2 ===")
    print_info("Команды: /golden /search /analyze /critic /plan /export /git /run /steps /stats /demo /web /quit")
    print_info(f"Проект: {_project} | OPENAI_API_KEY для GPT-4o\n")

    while True:
        try:
            cmd = input(f"\n[{_project}]> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not cmd:
            continue

        if cmd == "/quit":
            break

        elif cmd == "/demo":
            load_demo()

        elif cmd == "/clear":
            memory_store.clear(_project)
            print_ok(f"Память проекта '{_project}' очищена.")

        elif cmd == "/remember":
            action = input("  Action: ").strip()
            result = input("  Result: ").strip()
            status = input("  Status [success]: ").strip() or "success"
            context = input("  Context: ").strip()
            tags_raw = input("  Tags (comma-separated): ").strip()
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = memory_store.add_step(action, result, status, context, tags, _project)
            print_ok(f"Шаг #{step['id']} сохранён.")

        elif cmd == "/steps":
            steps = memory_store.get_all(_project)
            if not steps:
                print_info("Память пуста.")
                continue
            for s in steps:
                icon = {"+": "success", "x": "error", "~": "rollback", "?": "partial"}
                i = {"success": "+", "error": "x", "rollback": "~", "partial": "?"}.get(s["status"], " ")
                src = f" [{s['source']}]" if s.get("source", "manual") != "manual" else ""
                print(f"  [{i}] #{s['id']} {s['action']}{src}")
                print(f"       → {s['result']}")

        elif cmd == "/golden":
            query = input("  Задача (Enter=все): ").strip()
            print_info("GPT-4o анализирует...")
            result = rag.golden_path(query)
            print()
            print_md(result)

        elif cmd == "/search":
            query = input("  Запрос: ").strip()
            print_info("GPT-4o ищет...")
            result = rag.smart_search(query)
            print()
            print_md(result)

        elif cmd == "/analyze":
            question = input("  Вопрос: ").strip()
            print_info("GPT-4o анализирует...")
            result = rag.analyze(question)
            print()
            print_md(result)

        elif cmd == "/critic":
            steps = memory_store.get_all(_project)
            if not steps:
                print_info("Память пуста.")
                continue
            print_info("Critic ревьюит...")
            result = agents.run_critic(steps)
            print()
            print_md(result)

        elif cmd == "/plan":
            task = input("  Новая задача: ").strip()
            steps = memory_store.get_all(_project)
            if not steps:
                print_info("Память пуста — нет опыта для планирования.")
                continue
            print_info("Planner → Critic → Executor...")
            result = agents.run_full_chain(steps, task)
            print()
            print_md("## Plan\n" + result["plan"])
            print_md("## Critique\n" + result["critique"])
            print_md("## Execution\n" + result["execution"])

        elif cmd == "/export":
            fmt = input("  Формат (markdown/bash/checklist) [markdown]: ").strip() or "markdown"
            steps = memory_store.get_all(_project)
            if not steps:
                print_info("Память пуста.")
                continue
            if fmt == "bash":
                content = exporter.to_bash_script(steps)
                filename = "runbook.sh"
            elif fmt == "checklist":
                content = exporter.to_checklist(steps)
                filename = "checklist.md"
            else:
                golden = rag.golden_path("")
                content = exporter.to_markdown(golden)
                filename = "runbook.md"
            path = exporter.save(content, filename)
            print_ok(f"Экспортировано: {path}")
            print()
            print(content[:500])

        elif cmd == "/git":
            repo = input("  Путь к репо [.]: ").strip() or "."
            print_info("Собираю git log...")
            steps = auto_collect.collect_git_log(repo, project=_project)
            print_ok(f"Собрано {len(steps)} коммитов.")

        elif cmd == "/run":
            command = input("  Команда: ").strip()
            print_info(f"Выполняю: {command}")
            step = auto_collect.collect_shell_command(command, project=_project)
            icon = "+" if step["status"] == "success" else "x"
            print(f"  [{icon}] {step['result'][:200]}")

        elif cmd == "/stats":
            s = memory_store.stats(_project)
            print_info(f"Проект: {_project}")
            print(f"  Всего шагов: {s['total']}")
            for status, count in s["by_status"].items():
                print(f"    {status}: {count}")
            print(f"  Проекты: {', '.join(s['projects'])}")

        elif cmd == "/projects":
            projects = memory_store.list_projects()
            print_info(f"Проекты: {', '.join(projects) if projects else '(нет)'}")

        elif cmd.startswith("/project "):
            _project = cmd.split(" ", 1)[1].strip()
            print_ok(f"Переключено на проект: {_project}")

        elif cmd == "/web":
            start_web()

        elif cmd == "/hook":
            repo = input("  Путь к репо [.]: ").strip() or "."
            result = auto_collect.install_git_hook(repo, _project)
            print_ok(result)

        else:
            print_info("GPT-4o ищет...")
            result = rag.smart_search(cmd)
            print()
            print_md(result)


def start_web(port: int = 8000):
    try:
        import uvicorn
    except ImportError:
        print_err("pip install uvicorn fastapi")
        return
    print_info(f"Web UI: http://localhost:{port}")
    uvicorn.run("web:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    port = 8000
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        port = int(sys.argv[idx + 1])
    if "--web" in sys.argv:
        start_web(port)
    else:
        main()
