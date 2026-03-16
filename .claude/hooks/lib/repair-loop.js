#!/usr/bin/env node
// =============================================================================
// repair-loop.js — безопасный self-healing цикл
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
  { pattern: /permission denied|EACCES|403/i, class: "permissions", fix_hint: "Проверь права доступа, sudo, chmod" },
  { pattern: /ENOENT|not found|No such file/i, class: "missing_resource", fix_hint: "Проверь путь, создай файл/директорию, установи зависимость" },
  { pattern: /ECONNREFUSED|ETIMEDOUT|network/i, class: "network", fix_hint: "Проверь сеть, URL, порт, firewall, retry" },
  { pattern: /syntax error|SyntaxError|parse error/i, class: "syntax", fix_hint: "Проверь синтаксис, формат файла, encoding" },
  { pattern: /ENOMEM|out of memory|heap/i, class: "resources", fix_hint: "Освободи память, увеличь лимит, оптимизируй" },
  { pattern: /conflict|ERESOLVE|peer dep/i, class: "dependency", fix_hint: "Разреши конфликт зависимостей, --legacy-peer-deps, обнови версии" },
  { pattern: /timeout|ETIMEOUT/i, class: "timeout", fix_hint: "Увеличь timeout, проверь доступность сервиса" },
  { pattern: /already exists|duplicate|EEXIST/i, class: "duplicate", fix_hint: "Удали/переименуй существующий ресурс или пропусти шаг" },
  { pattern: /authentication|auth|401|unauthorized/i, class: "auth", fix_hint: "Проверь токен, ключ, credentials" },
];

let errorClass = { class: "unknown", fix_hint: "Проанализируй ошибку вручную" };
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

// ── 4. Формируем рекомендацию ────────────────────────────────────────────────

const lines = [];

lines.push(`🔧 REPAIR ANALYSIS (попытка ${attempt}/3)`);
lines.push(`   Класс ошибки: ${errorClass.class}`);
lines.push(`   Подсказка: ${errorClass.fix_hint}`);
lines.push("");

if (attempt >= 3) {
  lines.push("🛑 СТОП: Достигнут лимит попыток (3/3).");
  lines.push("   НЕ повторяй тот же подход.");
  lines.push("   Варианты:");
  lines.push("   1. Принципиально другой подход");
  lines.push("   2. Спроси пользователя");
  lines.push("   3. Пометь как BLOCKED и двигайся дальше");
  lines.push("");

  // Помечаем в памяти через публичный API
  const similar = db.findSimilarIncidents(errorMessage, 1);
  if (similar.length > 0) {
    db.updateIncidentStatus(similar[0].id, "investigating", {
      probable_cause: `\n[attempt ${attempt}] Достигнут лимит попыток. Последняя команда: ${failedCommand || 'unknown'}`
    });
  }
} else {
  // Рекомендуем фикс
  if (withFixes.length > 0) {
    lines.push("✅ Найдены ПРОВЕРЕННЫЕ фиксы для похожих ошибок:");
    for (const inc of withFixes.slice(0, 2)) {
      lines.push(`   Инцидент #${inc.id}: ${inc.error_message?.slice(0, 80)}`);
      lines.push(`   Fix: ${inc.verified_fix}`);
      lines.push("");
    }
    lines.push("   → Попробуй применить один из этих фиксов.");
  } else if (verifiedSolutions.length > 0) {
    lines.push("💡 Найдены проверенные решения:");
    for (const sol of verifiedSolutions.slice(0, 2)) {
      lines.push(`   [${sol.pattern_type}] ${sol.title}`);
      lines.push(`   ${sol.description?.slice(0, 150)}`);
      if (sol.code) lines.push(`   Код: ${sol.code.slice(0, 200)}`);
      lines.push("");
    }
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
}

// ── 5. Напоминание о безопасности ────────────────────────────────────────────

lines.push("");
lines.push("📌 Правила repair loop:");
lines.push("   - Каждая попытка должна быть ДРУГОЙ (не повторяй то же самое)");
lines.push("   - Проверь результат после фикса");
lines.push("   - Если фикс сработал → вызови incident_fix и solution_add");
lines.push("   - Если не сработал → запиши в failed_attempts");
lines.push("   - Не скрывай неудачи");

console.log(lines.join("\n"));

db.close();
