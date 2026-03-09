#!/usr/bin/env python3
"""
Agentic RAG v3 — CLI + Web UI.

CLI:   python main.py
Web:   python main.py --web [--port 8000]

Команды CLI:
  === Общие ===
  /remember  — запомнить шаг
  /steps     — показать шаги (фильтр по категории)
  /golden    — извлечь golden path
  /search    — умный поиск
  /analyze   — глубокий анализ
  /stats     — статистика

  === DevOps ===
  /cmd       — сохранить команду
  /config    — сохранить конфиг
  /incident  — записать инцидент
  /deploy    — записать деплой
  /runbook   — сохранить runbook
  /devops    — показать все DevOps записи

  === Knowledge Base ===
  /decision  — записать решение
  /adr       — записать ADR
  /pattern   — записать паттерн
  /lesson    — записать урок
  /kb        — показать все KB записи

  === Wiki ===
  /note      — создать заметку
  /link      — сохранить ссылку
  /snippet   — сохранить сниппет
  /howto     — сохранить how-to
  /wiki      — показать все wiki записи

  === Agents ===
  /critic    — Critic agent ревьюит шаги
  /plan      — Planner + Critic + Executor цепочка

  === Tools ===
  /export    — экспорт (markdown/bash/checklist)
  /git       — собрать git log в память
  /run       — выполнить команду и записать
  /hook      — установить git hook
  /projects  — список проектов
  /project X — переключить проект
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
import devops_mem
import knowledge_base
import wiki

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


_project = "default"


def _input(prompt: str) -> str:
    return input(f"  {prompt}: ").strip()


def _print_entries(entries: list[dict], label: str = ""):
    if not entries:
        print_info(f"{label or 'Записи'}: пусто.")
        return
    if label:
        print_info(f"--- {label} ({len(entries)}) ---")
    for s in entries:
        icon = {"success": "+", "error": "x", "rollback": "~", "partial": "?"}.get(s["status"], " ")
        cat = f"[{s.get('category', 'step')}]" if s.get("category", "step") != "step" else ""
        kind = f"({s.get('kind', '')})" if s.get("kind") else ""
        prio = f" P{s['priority']}" if s.get("priority", 0) > 0 else ""
        print(f"  [{icon}] #{s['id']}{prio} {cat}{kind} {s['action']}")
        print(f"       → {s['result'][:200]}")


def load_demo():
    memory_store.clear()
    # Steps
    demo_steps = [
        ("npm init", "package.json создан", "success", "Начало проекта", ["setup"]),
        ("npm install react", "react@18.2.0", "success", "", ["setup", "react"]),
        ("webpack build", "webpack.config.js не найден", "error", "Забыли конфиг", ["webpack"]),
        ("Создал webpack.config.js", "Сборка работает", "success", "path.resolve(__dirname, 'dist')", ["webpack"]),
    ]
    for a, r, s, c, t in demo_steps:
        memory_store.add_step(a, r, s, c, t)

    # DevOps
    devops_mem.save_config("nginx.conf", "worker_processes auto;\nserver { listen 80; }", tags=["nginx"])
    devops_mem.save_command("docker compose up -d", "All 3 services started", tags=["docker"])
    devops_mem.save_incident("Redis OOM", "Redis killed by OOM killer", "maxmemory 512mb + eviction policy", severity=4, tags=["redis"])
    devops_mem.save_deploy("api", "v2.1.0", "production", notes="Zero-downtime rolling update")

    # Knowledge
    knowledge_base.save_decision("PostgreSQL вместо MongoDB", "Выбрали PostgreSQL", reasoning="ACID, joins, jsonb", alternatives="MongoDB, CockroachDB", tags=["db"])
    knowledge_base.save_pattern("Circuit Breaker", "Оборачивать внешние вызовы в circuit breaker", when_to_use="Любой внешний API", tags=["resilience"])
    knowledge_base.save_lesson("N+1 queries", "Страница грузилась 8 секунд", "Всегда использовать select_related/prefetch_related", tags=["django", "perf"])

    # Wiki
    wiki.save_note("Git aliases", "co = checkout\nbr = branch\nst = status\nlg = log --oneline --graph")
    wiki.save_snippet("retry decorator", "import time\ndef retry(fn, n=3):\n    for i in range(n):\n        try: return fn()\n        except: time.sleep(2**i)", language="python", tags=["utils"])
    wiki.save_howto("Как обновить SSL сертификат", "1. certbot renew\n2. nginx -t\n3. systemctl reload nginx", tags=["ssl", "nginx"])

    print_ok("Демо загружено: steps + devops + knowledge + wiki")


def main():
    global _project

    if "--web" in sys.argv:
        start_web()
        return

    print_info("=== Agentic RAG v3 ===")
    print_info("Модули: Steps | DevOps | Knowledge | Wiki | Agents")
    print_info("Команды: /help для списка\n")

    while True:
        try:
            cmd = input(f"\n[{_project}]> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not cmd:
            continue

        # ─── System ───
        if cmd == "/quit":
            break
        elif cmd == "/help":
            print(__doc__)
        elif cmd == "/demo":
            load_demo()
        elif cmd == "/clear":
            memory_store.clear(_project)
            print_ok(f"Память проекта '{_project}' очищена.")

        # ─── Steps (original) ───
        elif cmd == "/remember":
            action = _input("Action")
            result = _input("Result")
            status = _input("Status [success]") or "success"
            context = _input("Context")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = memory_store.add_step(action, result, status, context, tags, _project)
            print_ok(f"Шаг #{step['id']} сохранён.")

        elif cmd == "/steps":
            cat = _input("Категория (all/step/devops/knowledge/wiki) [all]") or "all"
            if cat == "all":
                entries = memory_store.get_all(_project)
            else:
                entries = memory_store.get_by_category(cat, _project)
            _print_entries(entries, cat)

        elif cmd == "/golden":
            query = _input("Задача (Enter=все)")
            print_info("GPT-4o анализирует...")
            print()
            print_md(rag.golden_path(query))

        elif cmd == "/search":
            query = _input("Запрос")
            print_info("GPT-4o ищет...")
            print()
            print_md(rag.smart_search(query))

        elif cmd == "/analyze":
            question = _input("Вопрос")
            print_info("GPT-4o анализирует...")
            print()
            print_md(rag.analyze(question))

        # ─── DevOps ───
        elif cmd == "/cmd":
            command = _input("Команда")
            output = _input("Output")
            status = _input("Status [success]") or "success"
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = devops_mem.save_command(command, output, status, tags=tags, project=_project)
            print_ok(f"Command #{step['id']} сохранена.")

        elif cmd == "/config":
            name = _input("Имя конфига (напр. nginx.conf)")
            content = _input("Содержимое (или путь)")
            context = _input("Контекст")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = devops_mem.save_config(name, content, context, tags, _project)
            print_ok(f"Config #{step['id']} сохранён.")

        elif cmd == "/incident":
            title = _input("Заголовок")
            desc = _input("Что произошло")
            resolution = _input("Как решили")
            severity = int(_input("Severity 1-5 [3]") or "3")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = devops_mem.save_incident(title, desc, resolution, severity, tags, _project)
            print_ok(f"Incident #{step['id']} записан.")

        elif cmd == "/deploy":
            service = _input("Сервис")
            version = _input("Версия")
            env = _input("Окружение [production]") or "production"
            status = _input("Status [success]") or "success"
            notes = _input("Заметки")
            step = devops_mem.save_deploy(service, version, env, status, notes, project=_project)
            print_ok(f"Deploy #{step['id']} записан.")

        elif cmd == "/runbook":
            title = _input("Название")
            steps_text = _input("Шаги (текст)")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = devops_mem.save_runbook(title, steps_text, tags, _project)
            print_ok(f"Runbook #{step['id']} сохранён.")

        elif cmd == "/devops":
            kind_filter = _input("Вид (all/command/config/incident/deploy/runbook) [all]") or "all"
            if kind_filter == "all":
                entries = devops_mem.get_all_devops(_project)
            else:
                entries = memory_store.get_by_kind(kind_filter, _project)
            _print_entries(entries, f"DevOps/{kind_filter}")

        # ─── Knowledge Base ───
        elif cmd == "/decision":
            title = _input("Заголовок решения")
            decision = _input("Что решили")
            reasoning = _input("Почему")
            alternatives = _input("Альтернативы")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = knowledge_base.save_decision(title, decision, reasoning, alternatives, tags, _project)
            print_ok(f"Decision #{step['id']} записано.")

        elif cmd == "/adr":
            title = _input("Заголовок ADR")
            status = _input("Status (proposed/accepted/deprecated)")
            context = _input("Контекст проблемы")
            decision = _input("Решение")
            consequences = _input("Последствия")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = knowledge_base.save_adr(title, status, context, decision, consequences, tags, _project)
            print_ok(f"ADR #{step['id']} записан.")

        elif cmd == "/pattern":
            name = _input("Название паттерна")
            desc = _input("Описание")
            when = _input("Когда использовать")
            example = _input("Пример")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = knowledge_base.save_pattern(name, desc, example, when, tags, _project)
            print_ok(f"Pattern #{step['id']} записан.")

        elif cmd == "/lesson":
            title = _input("Заголовок")
            what = _input("Что произошло")
            lesson = _input("Урок")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = knowledge_base.save_lesson(title, what, lesson, tags, _project)
            print_ok(f"Lesson #{step['id']} записан.")

        elif cmd == "/kb":
            kind_filter = _input("Вид (all/decision/adr/pattern/lesson/dependency) [all]") or "all"
            if kind_filter == "all":
                entries = knowledge_base.get_all_knowledge(_project)
            else:
                entries = memory_store.get_by_kind(kind_filter, _project)
            _print_entries(entries, f"KB/{kind_filter}")

        # ─── Wiki ───
        elif cmd == "/note":
            title = _input("Заголовок")
            content = _input("Текст")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = wiki.save_note(title, content, tags, _project)
            print_ok(f"Note #{step['id']} сохранена.")

        elif cmd == "/link":
            title = _input("Название")
            url = _input("URL")
            desc = _input("Описание")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = wiki.save_link(title, url, desc, tags, _project)
            print_ok(f"Link #{step['id']} сохранена.")

        elif cmd == "/snippet":
            title = _input("Название")
            lang = _input("Язык (python/bash/js/...)")
            code = _input("Код")
            desc = _input("Описание")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = wiki.save_snippet(title, code, lang, desc, tags, _project)
            print_ok(f"Snippet #{step['id']} сохранён.")

        elif cmd == "/howto":
            title = _input("Заголовок")
            steps_text = _input("Шаги")
            tags_raw = _input("Tags (comma)")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
            step = wiki.save_howto(title, steps_text, tags, _project)
            print_ok(f"HowTo #{step['id']} сохранён.")

        elif cmd == "/wiki":
            kind_filter = _input("Вид (all/note/link/snippet/howto) [all]") or "all"
            if kind_filter == "all":
                entries = wiki.get_all_wiki(_project)
            else:
                entries = memory_store.get_by_kind(kind_filter, _project)
            _print_entries(entries, f"Wiki/{kind_filter}")

        # ─── Agents ───
        elif cmd == "/critic":
            steps = memory_store.get_all(_project)
            if not steps:
                print_info("Память пуста.")
                continue
            print_info("Critic ревьюит...")
            print()
            print_md(agents.run_critic(steps))

        elif cmd == "/plan":
            task = _input("Новая задача")
            steps = memory_store.get_all(_project)
            if not steps:
                print_info("Память пуста.")
                continue
            print_info("Planner → Critic → Executor...")
            result = agents.run_full_chain(steps, task)
            print()
            print_md("## Plan\n" + result["plan"])
            print_md("## Critique\n" + result["critique"])
            print_md("## Execution\n" + result["execution"])

        # ─── Tools ───
        elif cmd == "/export":
            fmt = _input("Формат (markdown/bash/checklist) [markdown]") or "markdown"
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
            repo = _input("Путь к репо [.]") or "."
            print_info("Собираю git log...")
            steps = auto_collect.collect_git_log(repo, project=_project)
            print_ok(f"Собрано {len(steps)} коммитов.")

        elif cmd == "/run":
            command = _input("Команда")
            print_info(f"Выполняю: {command}")
            step = auto_collect.collect_shell_command(command, project=_project)
            icon = "+" if step["status"] == "success" else "x"
            print(f"  [{icon}] {step['result'][:200]}")

        elif cmd == "/stats":
            s = memory_store.stats(_project)
            print_info(f"Проект: {_project}")
            print(f"  Всего: {s['total']}")
            print(f"  По статусу:")
            for status, count in s["by_status"].items():
                print(f"    {status}: {count}")
            print(f"  По категории:")
            for cat, count in s.get("by_category", {}).items():
                print(f"    {cat}: {count}")
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
            repo = _input("Путь к репо [.]") or "."
            result = auto_collect.install_git_hook(repo, _project)
            print_ok(result)

        else:
            # Свободный запрос — умный поиск
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
