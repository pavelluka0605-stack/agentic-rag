#!/usr/bin/env node
// =============================================================================
// repair-loop.js — безопасный self-healing цикл с верификацией
//
// Вызывается из hooks при повторяющихся ошибках.
// Анализирует ситуацию, предлагает стратегию, НЕ выполняет фикс сам.
//
// Использование:
//   node repair-loop.js <error_message> [failed_command] [attempt_number]
//
// Выводит рекомендацию в stdout (feedback для Claude)
// =============================================================================

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MemoryDB } from "../../mcp/memory-server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../memory/memory.db");

const [,, errorMessage, failedCommand, attemptStr] = process.argv;
const attempt = parseInt(attemptStr || "1");

if (!errorMessage) {
  console.error("Usage: repair-loop.js <error_message> [failed_command] [attempt]");
  process.exit(1);
}

let db;
try {
  db = new MemoryDB(DB_PATH);
} catch (e) {
  console.log(`[repair] Память недоступна: ${e.message}. Действуй по обстоятельствам.`);
  process.exit(0);
}

// ── 1. Классификация ошибки ──────────────────────────────────────────────────

const ERROR_CLASSES = [
  { pattern: /permission denied|EACCES|403/i, class: "permissions", fix_hint: "Проверь права доступа, sudo, chmod", safe_actions: ["chmod", "chown", "sudo"] },
  { pattern: /ENOENT|not found|No such file/i, class: "missing_resource", fix_hint: "Проверь путь, создай файл/директорию, установи зависимость", safe_actions: ["mkdir -p", "touch", "npm install"] },
  { pattern: /ECONNREFUSED|ETIMEDOUT|network|fetch failed/i, class: "network", fix_hint: "Проверь сеть, URL, порт, firewall, retry", safe_actions: ["retry", "ping", "curl -I"] },
  { pattern: /syntax error|SyntaxError|parse error|Unexpected token/i, class: "syntax", fix_hint: "Проверь синтаксис, формат файла, encoding", safe_actions: ["lint", "validate"] },
  { pattern: /ENOMEM|out of memory|heap|JavaScript heap/i, class: "resources", fix_hint: "Освободи память, увеличь лимит, оптимизируй", safe_actions: ["--max-old-space-size"] },
  { pattern: /conflict|ERESOLVE|peer dep/i, class: "dependency", fix_hint: "Разреши конфликт зависимостей, --legacy-peer-deps, обнови версии", safe_actions: ["npm ls", "npm install --legacy-peer-deps"] },
  { pattern: /timeout|ETIMEOUT/i, class: "timeout", fix_hint: "Увеличь timeout, проверь доступность сервиса", safe_actions: ["--timeout", "retry"] },
  { pattern: /already exists|duplicate|EEXIST/i, class: "duplicate", fix_hint: "Удали/переименуй существующий ресурс или пропусти шаг", safe_actions: ["rm", "mv", "--force"] },
  { pattern: /authentication|auth|401|unauthorized|credentials/i, class: "auth", fix_hint: "Проверь токен, ключ, credentials", safe_actions: ["env check", "secret check"] },
  { pattern: /Module not found|Cannot find module|import.*error/i, class: "import", fix_hint: "Проверь путь импорта, установи пакет, проверь package.json", safe_actions: ["npm install", "npm ls"] },
  { pattern: /ENOSPC|no space left/i, class: "disk", fix_hint: "Очисти диск: docker prune, npm cache clean, удали ненужные логи", safe_actions: ["df -h", "du -sh", "npm cache clean"] },
];

let errorClass = { class: "unknown", fix_hint: "Проанализируй ошибку вручную", safe_actions: [] };
for (const ec of ERROR_CLASSES) {
  if (ec.pattern.test(errorMessage)) {
    errorClass = ec;
    break;
  }
}

// ── 2. Поиск похожих инцидентов ──────────────────────────────────────────────

const similarIncidents = db.findSimilarIncidents(errorMessage, 5);
const withFixes = similarIncidents.filter(i => i.verified_fix);
const withoutFixes = similarIncidents.filter(i => !i.verified_fix);

// ── 3. Поиск подходящих решений ──────────────────────────────────────────────

const solutions = db.findSimilarSolutions(errorMessage, 3);
const verifiedSolutions = solutions.filter(s => s.verified);

// ── 4. Проверка failed attempts (чтобы не повторять) ─────────────────────────

const failedApproaches = [];
const failedFile = `/tmp/claude-failed-approaches-${db.fingerprint(errorMessage).slice(0, 8)}`;
try {
  if (fs.existsSync(failedFile)) {
    const content = fs.readFileSync(failedFile, "utf-8").trim();
    failedApproaches.push(...content.split("\n").filter(Boolean));
  }
} catch {}

// Записываем текущую неудачную попытку
if (failedCommand) {
  const entry = `[attempt ${attempt}] ${failedCommand.slice(0, 200)}`;
  if (!failedApproaches.includes(entry)) {
    failedApproaches.push(entry);
    fs.writeFileSync(failedFile, failedApproaches.join("\n") + "\n");
  }
}

// ── 5. Формируем рекомендацию ────────────────────────────────────────────────

const lines = [];

lines.push(`🔧 REPAIR ANALYSIS (попытка ${attempt}/3)`);
lines.push(`   Класс ошибки: ${errorClass.class}`);
lines.push(`   Подсказка: ${errorClass.fix_hint}`);
if (errorClass.safe_actions.length > 0) {
  lines.push(`   Безопасные действия: ${errorClass.safe_actions.join(", ")}`);
}
lines.push("");

// Показываем что уже пробовали
if (failedApproaches.length > 0) {
  lines.push("❌ Уже пробовали (НЕ повторяй):");
  for (const fa of failedApproaches.slice(-5)) {
    lines.push(`   ${fa}`);
  }
  lines.push("");
}

if (attempt >= 3) {
  lines.push("🛑 СТОП: Достигнут лимит попыток (3/3).");
  lines.push("   НЕ повторяй тот же подход.");
  lines.push("   Варианты:");
  lines.push("   1. Принципиально другой подход к задаче");
  lines.push("   2. Спроси пользователя — возможно нужна доп. информация");
  lines.push("   3. Пометь как BLOCKED (incident_update_status → investigating)");
  lines.push("   4. Обойди проблему (workaround) и запиши решение");
  lines.push("");

  // Помечаем в памяти через публичный API
  const similar = db.findSimilarIncidents(errorMessage, 1);
  if (similar.length > 0) {
    db.updateIncidentStatus(similar[0].id, "investigating", {
      probable_cause: `\n[attempt ${attempt}] Достигнут лимит попыток. Последняя команда: ${failedCommand || "unknown"}\nПробовали: ${failedApproaches.join("; ")}`
    });
  }
} else {
  // ── Рекомендуем фикс ───────────────────────────────────────────────────

  if (withFixes.length > 0) {
    lines.push("✅ Найдены ПРОВЕРЕННЫЕ фиксы для похожих ошибок:");
    for (const inc of withFixes.slice(0, 2)) {
      lines.push(`   Инцидент #${inc.id}: ${inc.error_message?.slice(0, 80)}`);
      lines.push(`   Fix: ${inc.verified_fix}`);
      lines.push("");
    }
    lines.push("   → Примени фикс, затем запусти проверку (тест/lint/build).");
    lines.push("   → Если сработало — вызови incident_fix и solution_add.");
  } else if (verifiedSolutions.length > 0) {
    lines.push("💡 Найдены проверенные решения:");
    for (const sol of verifiedSolutions.slice(0, 2)) {
      lines.push(`   [${sol.pattern_type}] ${sol.title} (solution_use #${sol.id})`);
      lines.push(`   ${sol.description?.slice(0, 150)}`);
      if (sol.code) lines.push(`   Код: ${sol.code.slice(0, 200)}`);
      lines.push("");
    }
    lines.push("   → Примени решение и вызови solution_use для трекинга.");
  } else if (withoutFixes.length > 0) {
    lines.push("📋 Найдены похожие инциденты (без фиксов):");
    for (const inc of withoutFixes.slice(0, 2)) {
      lines.push(`   #${inc.id}: ${inc.error_message?.slice(0, 80)}`);
      if (inc.probable_cause) lines.push(`   Причина: ${inc.probable_cause}`);
      if (inc.failed_attempts) lines.push(`   Не сработало: ${inc.failed_attempts}`);
      lines.push("");
    }
    lines.push("   → Избегай уже проваленных подходов.");
  } else {
    lines.push("📭 Похожих инцидентов в памяти нет.");
    lines.push(`   → Действуй по подсказке: ${errorClass.fix_hint}`);
  }

  // ── Verification strategy ──────────────────────────────────────────────

  lines.push("");
  lines.push("🔍 СТРАТЕГИЯ ВЕРИФИКАЦИИ:");
  switch (errorClass.class) {
    case "syntax":
      lines.push("   1. Исправь синтаксис");
      lines.push("   2. Запусти: node --check <file> / python3 -m py_compile <file>");
      lines.push("   3. Если ОК — инцидент закрыт");
      break;
    case "missing_resource":
      lines.push("   1. Создай/установи недостающий ресурс");
      lines.push("   2. Повтори исходную команду");
      lines.push("   3. Проверь что результат корректный");
      break;
    case "dependency":
      lines.push("   1. Разреши конфликт (npm ls, npm install)");
      lines.push("   2. Запусти: npm test (или аналог)");
      lines.push("   3. Проверь что импорты работают");
      break;
    case "permissions":
      lines.push("   1. Исправь права (chmod/chown)");
      lines.push("   2. Повтори исходную команду");
      lines.push("   3. НЕ используй chmod 777 — минимальные необходимые права");
      break;
    default:
      lines.push("   1. Примени фикс");
      lines.push("   2. Повтори исходную команду");
      lines.push("   3. Если ОК — запиши фикс (incident_fix + solution_add)");
      lines.push("   4. Если не ОК — запиши что не сработало");
      break;
  }
}

// ── 6. Правила repair loop ───────────────────────────────────────────────────

lines.push("");
lines.push("📌 Правила repair loop:");
lines.push("   - Каждая попытка должна быть ДРУГОЙ (не повторяй то же самое)");
lines.push("   - Проверь результат после фикса");
lines.push("   - Если фикс сработал → вызови incident_fix и solution_add");
lines.push("   - Если не сработал → запиши в failed_attempts");
lines.push("   - Не скрывай неудачи, не фальсифицируй успешность");

console.log(lines.join("\n"));

db.close();
