## Отчёт по сессии — 2026-03-18

Ветка: `claude/vps-dev-environment-3ecmD`
Коммиты: 4

---

### 1. Кнопка загрузки — наложение на мобильном (f97bc21)

Проблема: На /tasks кнопка «Повторить» показывала спиннер и текст поверх друг друга на мобильных.

Причина: Button компонент при loading=true рендерил SVG-спиннер рядом с children в одном flex-контейнере. На узком экране 3 элемента (спиннер + иконка + текст) не помещались.

Исправление: Паттерн «invisible children + absolute spinner» — спиннер центрируется абсолютно поверх кнопки, children становятся невидимыми но сохраняют размеры. Размер кнопки стабилен, наложения нет.

Файл: dashboard/src/components/ui/button.tsx

Охват: Все 15+ кнопок с loading prop на странице /tasks исправлены автоматически (один компонент).

---

### 2. Telegram — только критические уведомления (dd67177)

Проблема: Telegram получал уведомления на каждое событие жизненного цикла задачи — подтверждение, прогресс, milestone, завершение. Слишком шумно.

Убрано: confirmed, progress milestones (25/50/75/100%), completed.
Оставлено: failed, review, needs_manual_review.

Файл: vps-runtime/control-api/server.js — удалены 3 блока sendTelegram()

---

### 3. Детекция зависших задач (d050c28)

Проблема: Задача могла зависнуть в статусе «Выполняется» навсегда — если исполнитель не отвечал, задача оставалась в running с пустым прогрессом и пустыми фазами (0/N). Не было никакого таймаута.

Исправление:
- Новый метод getStalledTasks(stallSeconds) в db.js — находит задачи в running без прогресса дольше порога
- Watchdog в server.js: проверка каждые 30с, порог 90с → эскалация в needs_manual_review
- Событие stall_detected в event trail
- Telegram алерт (критическое событие)
- Dashboard: красный баннер «Задача зависла» вместо бесконечного спиннера

Файлы: vps-runtime/control-api/server.js, .claude/mcp/memory-server/db.js, dashboard/src/app/tasks/page.tsx

---

### 4. Реальный исполнитель вместо cat в tmux (73fc894)

Проблема: Dispatch запускал tmux send-keys "cat task-file" — это просто печатало содержимое файла в терминал. Никакой процесс не читал файл, не выполнял задачу и не вызывал API прогресса. Задача помечалась как running на основе надежды, а не факта.

Цепочка отказа:
1. Записать task-42.md на диск → OK
2. Перевести статус в running → OK
3. tmux send-keys "cat task-42.md" → Печатает текст в пустой shell
4. Кто-то должен выполнить задачу → НИКТО — исполнителя нет
5. POST /api/tasks/42/progress → Никогда не вызывается
6. Задача висит в running вечно

Исправление:

Новый файл vps-runtime/bin/exec-task.sh:
- Запускается как фоновый процесс (detached от control-api)
- Валидирует входные данные (файл существует, claude CLI доступен)
- Отправляет первый прогресс (pct: 0) в течение ~1 секунды
- Запускает claude -p (non-interactive print mode) с содержимым задачи
- При успехе → POST /complete с результатом
- При ошибке → POST /fail с exit code и выводом

Dispatch handler (server.js):
- Спавнит exec-task.sh как detached child process
- Логирует executor_started (с PID) или executor_spawn_failed
- Fallback на tmux cat только если exec-task.sh не задеплоен
- Fallback помечается как executor_fallback_tmux

Stall watchdog — диагностика по event trail:
- executor_spawn_failed → exec-task.sh не удалось выполнить
- executor_no_ack → Исполнитель не запущен (с деталями)
- executor_fallback_tmux → Файл в tmux, автоисполнитель отсутствует
- executor_started → Запущен, но не прислал прогресс (claude CLI hang / auth / crash)
- dispatched → Отправлена, но executor_started отсутствует

Файлы: vps-runtime/bin/exec-task.sh (новый, 157 строк), vps-runtime/control-api/server.js

---

### Итого

Коммитов: 4
Файлов изменено: 5
Новых файлов: 1 (exec-task.sh)
Строк добавлено: ~285
Строк удалено: ~76
Ветка: claude/vps-dev-environment-3ecmD
