#!/bin/bash
# Система проверки артефактов проекта «Кухни Рема»
# Запуск: bash site-build/verify.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check_file() {
  local path="$1"
  local desc="$2"
  local required="${3:-true}"

  if [[ -f "$path" ]] && [[ -s "$path" ]]; then
    echo -e "  ${GREEN}[OK]${NC} $desc"
    echo -e "       $(wc -l < "$path") строк, $(du -h "$path" | cut -f1)"
    ((PASS++))
  elif [[ "$required" == "true" ]]; then
    echo -e "  ${RED}[MISSING]${NC} $desc"
    echo -e "       $path"
    ((FAIL++))
  else
    echo -e "  ${YELLOW}[SKIP]${NC} $desc (необязательный)"
    ((WARN++))
  fi
}

check_git() {
  local path="$1"
  local desc="$2"

  if [[ -f "$path" ]] && [[ -s "$path" ]]; then
    if git ls-files --error-unmatch "$path" &>/dev/null; then
      echo -e "  ${GREEN}[COMMITTED]${NC} $desc"
      ((PASS++))
    else
      echo -e "  ${RED}[NOT COMMITTED]${NC} $desc"
      echo -e "       Файл есть, но НЕ в git!"
      ((FAIL++))
    fi
  fi
}

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  ПРОВЕРКА АРТЕФАКТОВ — Проект «Кухни Рема»${NC}"
echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Этап 1: Discovery/Аудит ───
echo -e "${BLUE}── Этап 1: Discovery/Аудит ──${NC}"
check_file "site-analysis/DISCOVERY-AUDIT.md"      "Полный аудит mebelit.site"
check_file "site-analysis/REBRAND-PLAN.md"          "План ребрендинга (10 разделов)"
check_file "site-analysis/vk-photos-index.json"     "Индекс 205 фото VK Market"
check_file "site-analysis/vk-photo-report.md"       "Отчёт по фото"
check_file "site-analysis/yandex-metrika-report.md" "Отчёт Яндекс Метрики"
check_file "site-analysis/yandex-metrika-raw.json"  "Сырые данные Метрики" "false"
echo ""

# ─── Этап 1.5: Фундамент (workflows, WordPress, дизайн, SEO) ───
echo -e "${BLUE}── Фундамент: Workflows ──${NC}"
check_file ".github/workflows/vk-photo-export.yml"  "Workflow экспорта VK фото"
check_file ".github/workflows/yandex-metrika.yml"   "Workflow Яндекс Метрики"
echo ""

echo -e "${BLUE}── Фундамент: WordPress ──${NC}"
check_file "site-build/wordpress/cpt-kitchen.json"   "CPT Kitchen — JSON-спецификация"
check_file "site-build/wordpress/cpt-kitchen.php"    "CPT Kitchen — PHP-код регистрации"
echo ""

echo -e "${BLUE}── Фундамент: Дизайн ──${NC}"
check_file "site-build/design/design-tokens.css"     "CSS-токены бренда"
check_file "site-build/design/brand-guide.md"        "Бренд-гайд"
echo ""

echo -e "${BLUE}── Фундамент: SEO ──${NC}"
check_file "site-build/seo/schema-templates.json"    "Schema.org шаблоны"
check_file "site-build/seo/meta-tags.json"           "Meta-теги всех страниц"
check_file "site-build/seo/rankmath-settings.json"   "Настройки RankMath"
check_file "site-build/seo/robots.txt"               "robots.txt"
check_file "site-build/seo/htaccess-redirects.conf"  "301 редиректы + .htaccess"
echo ""

echo -e "${BLUE}── Фундамент: Wireframes ──${NC}"
check_file "site-build/wireframes/WIREFRAMES.md"     "Wireframes 8 страниц"
echo ""

# ─── Этап 2: Архитектура ───
echo -e "${BLUE}── Этап 2: Архитектура ──${NC}"
check_file "site-build/architecture/01-stack-comparison.md"       "Сравнение 4 стеков"
check_file "site-build/architecture/02-site-architecture.md"      "Архитектура сайта + контентная модель"
check_file "site-build/architecture/03-seo-leadgen-analytics.md"  "SEO + лидогенерация + аналитика"
check_file "site-build/architecture/04-risks-and-handoff.md"      "Риски + переход в этап 3"
echo ""

# ─── Этап 3: Дизайн-система ───
echo -e "${BLUE}── Этап 3: Дизайн-система ──${NC}"
check_file "site-build/design/01-visual-direction.md"               "Визуальное направление (ДНК MEBELIT)"
check_file "site-build/design/02-design-system.md"                  "Дизайн-система + UX-принципы"
check_file "site-build/design/03-page-structures.md"                "Структура страниц + контентная логика"
check_file "site-build/design/04-visual-content-risks-handoff.md"   "Фото/визуал + риски + этап 4"
echo ""

# ─── Проверка git статуса ───
echo -e "${BLUE}── Git: незакоммиченные файлы ──${NC}"

UNTRACKED=$(git ls-files --others --exclude-standard -- site-build/ site-analysis/ .github/workflows/ 2>/dev/null | head -20)
MODIFIED=$(git diff --name-only -- site-build/ site-analysis/ .github/workflows/ 2>/dev/null | head -20)

if [[ -n "$UNTRACKED" ]]; then
  echo -e "  ${RED}[!] Незакоммиченные файлы:${NC}"
  while IFS= read -r f; do
    echo -e "       ${RED}+ $f${NC}"
    ((FAIL++))
  done <<< "$UNTRACKED"
else
  echo -e "  ${GREEN}[OK]${NC} Все файлы в git"
  ((PASS++))
fi

if [[ -n "$MODIFIED" ]]; then
  echo -e "  ${YELLOW}[!] Изменённые файлы (не staged):${NC}"
  while IFS= read -r f; do
    echo -e "       ${YELLOW}~ $f${NC}"
    ((WARN++))
  done <<< "$MODIFIED"
fi
echo ""

# ─── Проверка push статуса ───
echo -e "${BLUE}── Git: статус push ──${NC}"
BRANCH=$(git branch --show-current)
AHEAD=$(git rev-list --count origin/"$BRANCH"..HEAD 2>/dev/null || echo "?")
if [[ "$AHEAD" == "0" ]]; then
  echo -e "  ${GREEN}[OK]${NC} Ветка $BRANCH синхронизирована с remote"
  ((PASS++))
elif [[ "$AHEAD" == "?" ]]; then
  echo -e "  ${RED}[!]${NC} Не удалось проверить remote"
  ((FAIL++))
else
  echo -e "  ${YELLOW}[!]${NC} $AHEAD коммит(ов) не запушено в $BRANCH"
  ((WARN++))
fi
echo ""

# ─── Система памяти ───
echo -e "${BLUE}── Система памяти ──${NC}"
check_file "STATE.md"   "STATE.md — текущее состояние"
check_file "CLAUDE.md"  "CLAUDE.md — база знаний"
echo ""

# ─── Итог ───
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  ${GREEN}Готово: $PASS${NC}  ${RED}Отсутствует: $FAIL${NC}  ${YELLOW}Предупреждения: $WARN${NC}  Всего: $TOTAL"

if [[ $FAIL -eq 0 ]]; then
  echo -e "  ${GREEN}✓ Все обязательные артефакты на месте!${NC}"
else
  echo -e "  ${RED}✗ Есть отсутствующие артефакты — нужно доделать.${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

exit $FAIL
