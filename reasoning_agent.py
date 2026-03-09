"""
Reasoning Agent — "думающий" слой на OpenAI.
Анализирует найденные шаги, вычленяет успешные цепочки,
убирает ошибки и тупики, выдаёт golden path.
"""

import os
from openai import OpenAI

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        _client = OpenAI(api_key=api_key)
    return _client


EXTRACT_CHAIN_PROMPT = """Ты — аналитик рабочих процессов. Тебе даны шаги работы над задачей.
Каждый шаг имеет: action (что делали), result (что получилось), status (success/error/rollback/partial), context.

Твоя задача:
1. Проанализируй ВСЕ шаги
2. Определи, какие шаги привели к успешному результату, а какие были ошибками/тупиками
3. Выстрой ЧИСТУЮ цепочку успешных шагов (golden path) — только те действия, которые нужно повторить
4. Если были ошибки, которые привели к важным урокам — вынеси их отдельно как "Уроки"

Формат ответа:

## Golden Path (чистая цепочка)
1. [действие] → [результат]
2. [действие] → [результат]
...

## Уроки (если есть)
- [что пошло не так и почему]

## Резюме
[1-2 предложения: что было сделано и ключевой результат]
"""

ANALYZE_PROMPT = """Ты — аналитик. Тебе даны шаги из памяти проекта.
Ответь на вопрос пользователя, опираясь ТОЛЬКО на эти данные.
Думай глубоко: ищи паттерны, причинно-следственные связи, скрытые зависимости.
Если данных недостаточно — скажи об этом.
"""

SMART_SEARCH_PROMPT = """Ты — умный поисковик по памяти проекта. Тебе даны шаги из памяти.
Пользователь ищет информацию. Твоя задача:
1. Найди всё релевантное
2. Сгруппируй по смыслу
3. Выдели главное
4. Представь в структурированном виде
"""


def _format_steps(steps: list[dict]) -> str:
    lines = []
    for s in steps:
        lines.append(
            f"[#{s['id']}] status={s['status']} | tags={s.get('tags', [])}\n"
            f"  Action: {s['action']}\n"
            f"  Result: {s['result']}\n"
            f"  Context: {s.get('context', '')}"
        )
    return "\n\n".join(lines)


def _call_llm(system_prompt: str, user_message: str, model: str = "gpt-4o") -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=4096,
    )
    return response.choices[0].message.content


def extract_golden_path(steps: list[dict], task_description: str = "") -> str:
    """Вычленить чистую успешную цепочку из шагов.

    Это главная фича — DeepSeek анализирует все шаги,
    убирает ошибки и тупики, выдаёт ready-to-repeat путь.
    """
    formatted = _format_steps(steps)
    user_msg = f"Задача: {task_description}\n\nШаги:\n{formatted}" if task_description else f"Шаги:\n{formatted}"
    return _call_llm(EXTRACT_CHAIN_PROMPT, user_msg)


def analyze(steps: list[dict], question: str) -> str:
    """Глубокий анализ шагов с ответом на вопрос."""
    formatted = _format_steps(steps)
    user_msg = f"Вопрос: {question}\n\nШаги из памяти:\n{formatted}"
    return _call_llm(ANALYZE_PROMPT, user_msg)


def smart_search(steps: list[dict], query: str) -> str:
    """Умный поиск — не просто найти, а понять и структурировать."""
    formatted = _format_steps(steps)
    user_msg = f"Запрос: {query}\n\nШаги из памяти:\n{formatted}"
    return _call_llm(SMART_SEARCH_PROMPT, user_msg)
