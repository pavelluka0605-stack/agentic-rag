#!/usr/bin/env node
// =============================================================================
// completion-check.js — проверка критериев завершения задачи
//
// Вызывается из Stop hook перед завершением сессии.
// Проверяет: uncommitted changes, open incidents, test status, etc.
// Stdout → feedback для Claude (что нужно доделать)
// Exit 0 = OK, Exit 1 = есть незавершённые дела
// =============================================================================

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { MemoryDB } from "../../mcp/memory-server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../memory/memory.db");
const ROOT = path.resolve(__dirname, "../..");

const issues = [];
const warnings = [];

// ── 1. Git status — незакоммиченные изменения ────────────────────────────────

try {
  const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf-8" }).trim();
  if (status) {
    const lines = status.split("\n");
    const modified = lines.filter(l => l.startsWith(" M") || l.startsWith("M "));
    const untracked = lines.filter(l => l.startsWith("??"));
    const staged = lines.filter(l => /^[MADRC]/.test(l));

    if (modified.length > 0 || staged.length > 0) {
      issues.push(`📁 Незакоммиченные изменения: ${modified.length + staged.length} файлов`);
      for (const l of lines.slice(0, 8)) {
        issues.push(`   ${l}`);
      }
      if (lines.length > 8) issues.push(`   ... и ещё ${lines.length - 8}`);
    }
    if (untracked.length > 0) {
      warnings.push(`📁 Untracked файлы: ${untracked.length}`);
    }
  }
} catch {}

// ── 2. Unpushed commits ──────────────────────────────────────────────────────

try {
  const unpushed = execSync("git log @{u}..HEAD --oneline 2>/dev/null", { cwd: ROOT, encoding: "utf-8" }).trim();
  if (unpushed) {
    const count = unpushed.split("\n").length;
    issues.push(`📤 Незапушенные коммиты: ${count}`);
    for (const l of unpushed.split("\n").slice(0, 5)) {
      issues.push(`   ${l}`);
    }
  }
} catch {}

// ── 3. Open incidents в текущей сессии ───────────────────────────────────────

let db;
try {
  db = new MemoryDB(DB_PATH);

  const openInc = db.getIncidents({ status: "open", limit: 10 });
  const investigating = db.getIncidents({ status: "investigating", limit: 5 });
  const allOpen = [...openInc, ...investigating];

  if (allOpen.length > 0) {
    warnings.push(`🔴 Открытые инциденты: ${allOpen.length}`);
    for (const inc of allOpen.slice(0, 5)) {
      warnings.push(`   #${inc.id} [${inc.status}] ${inc.error_message?.slice(0, 80)}`);
    }
    warnings.push("   → Если решены, вызови incident_fix. Если не актуальны — incident_update_status → wontfix.");
  }

  // ── 4. Session episode check ───────────────────────────────────────────────

  const sessionFile = `/tmp/claude-session-${process.ppid || "unknown"}`;
  // Не проверяем episode — это делает session-end.sh

  db.close();
} catch {}

// ── 5. Проверка что lint/build проходят (если есть package.json) ─────────────

try {
  const pkg = JSON.parse(execSync(`cat ${ROOT}/package.json 2>/dev/null`, { encoding: "utf-8" }));
  const scripts = pkg.scripts || {};

  if (scripts.lint) {
    try {
      execSync("npm run lint 2>&1", { cwd: ROOT, encoding: "utf-8", timeout: 30000 });
    } catch (e) {
      warnings.push("⚠ Lint не проходит. Рекомендуется исправить перед завершением.");
    }
  }

  if (scripts.test) {
    // Не запускаем тесты автоматически — только предупреждаем
    warnings.push("ℹ В проекте есть тесты (npm test). Убедись, что они проходят.");
  }
} catch {}

// ── Вывод ────────────────────────────────────────────────────────────────────

if (issues.length === 0 && warnings.length === 0) {
  console.log("✅ Все проверки завершения пройдены.");
  process.exit(0);
}

if (issues.length > 0) {
  console.log("🛑 НЕЗАВЕРШЁННЫЕ ДЕЛА:");
  for (const i of issues) console.log(i);
  console.log("");
}

if (warnings.length > 0) {
  console.log("⚠ ПРЕДУПРЕЖДЕНИЯ:");
  for (const w of warnings) console.log(w);
  console.log("");
}

if (issues.length > 0) {
  console.log("📌 Рекомендация: закоммить и запушь изменения перед завершением.");
}

// Exit 1 only for blocking issues (uncommitted changes, unpushed)
process.exit(issues.length > 0 ? 1 : 0);
