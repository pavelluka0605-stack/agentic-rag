# VPS Remote Exec — система удалённого управления

## Как это работает

1. Claude Code записывает команду в `.claude/commands/exec.json`
2. `git push` триггерит workflow `vps-remote-exec.yml`
3. Workflow подключается к VPS по SSH и выполняет команду
4. Результат коммитится в `.claude/commands/result.json`
5. Claude Code читает результат и принимает решения

## Формат exec.json

### Простая команда
```json
{"command": "systemctl status control-bridge", "intent": "проверка статуса"}
```

### Скрипт (многострочный)
```json
{"script": "#!/bin/bash\necho hello\ndate", "intent": "тест"}
```

### Файл-скрипт из репозитория
```json
{"script_file": ".claude/commands/scripts/diagnose-bridge.sh", "intent": "диагностика"}
```

## Готовые скрипты

- `scripts/diagnose-bridge.sh` — полная диагностика Control Bridge API
- `scripts/fix-bridge.sh` — автоматическое исправление типичных проблем
