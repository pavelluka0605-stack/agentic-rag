#!/usr/bin/env bash
# =============================================================================
# Smoke Test — кухнирема.рф (Кухни Рема)
#
# Tests all pages after deployment for HTTP status, response time,
# expected content, PHP errors, redirects, and critical endpoints.
#
# Usage:
#   ./smoke-test.sh [BASE_URL]
#   ./smoke-test.sh https://xn--e1afaihifegddo7k.xn--p1ai
#
# Exit code: 0 if all tests pass, 1 if any test fails
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

BASE_URL="${1:-https://xn--e1afaihifegddo7k.xn--p1ai}"
# Remove trailing slash
BASE_URL="${BASE_URL%/}"

MAX_RESPONSE_TIME=3  # seconds
PHP_ERROR_PATTERNS="Fatal error|Warning:|Notice:|Parse error|Deprecated:"

# Counters
TOTAL=0
PASSED=0
FAILED=0
RESULTS=""

# ─── Colors (disabled if not a terminal) ─────────────────────────────────────

if [ -t 1 ]; then
  GREEN="\033[0;32m"
  RED="\033[0;31m"
  YELLOW="\033[0;33m"
  CYAN="\033[0;36m"
  BOLD="\033[1m"
  RESET="\033[0m"
else
  GREEN="" RED="" YELLOW="" CYAN="" BOLD="" RESET=""
fi

# ─── Helper Functions ────────────────────────────────────────────────────────

add_result() {
  local status="$1" test_name="$2" details="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$status" = "PASS" ]; then
    PASSED=$((PASSED + 1))
    RESULTS="${RESULTS}${GREEN}PASS${RESET} | ${test_name} | ${details}\n"
  else
    FAILED=$((FAILED + 1))
    RESULTS="${RESULTS}${RED}FAIL${RESET} | ${test_name} | ${details}\n"
  fi
}

# Test a page for HTTP 200, response time, expected content, and PHP errors
test_page() {
  local path="$1"
  local expected_text="$2"
  local url="${BASE_URL}${path}"
  local test_name="GET ${path:-/}"

  # Fetch page
  local tmpfile
  tmpfile=$(mktemp)
  local http_code time_total
  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" \
    --max-time 10 -L \
    -H "User-Agent: KuhniRema-SmokeTest/1.0" \
    "$url" 2>/dev/null) || http_code="000"
  time_total=$(curl -s -o /dev/null -w "%{time_total}" \
    --max-time 10 -L \
    -H "User-Agent: KuhniRema-SmokeTest/1.0" \
    "$url" 2>/dev/null) || time_total="99"

  # Check HTTP status
  if [ "$http_code" != "200" ]; then
    add_result "FAIL" "$test_name" "HTTP ${http_code} (expected 200)"
    rm -f "$tmpfile"
    return
  fi

  # Check response time
  local time_int
  time_int=$(echo "$time_total" | cut -d. -f1)
  if [ "${time_int:-99}" -ge "$MAX_RESPONSE_TIME" ]; then
    add_result "FAIL" "$test_name" "Slow: ${time_total}s (max ${MAX_RESPONSE_TIME}s)"
    rm -f "$tmpfile"
    return
  fi

  # Check for PHP errors
  if grep -qEi "$PHP_ERROR_PATTERNS" "$tmpfile" 2>/dev/null; then
    local php_err
    php_err=$(grep -oEi "$PHP_ERROR_PATTERNS" "$tmpfile" | head -1)
    add_result "FAIL" "$test_name" "PHP error found: ${php_err}"
    rm -f "$tmpfile"
    return
  fi

  # Check expected content
  if [ -n "$expected_text" ]; then
    if ! grep -qi "$expected_text" "$tmpfile" 2>/dev/null; then
      add_result "FAIL" "$test_name" "Missing text: '${expected_text}'"
      rm -f "$tmpfile"
      return
    fi
  fi

  add_result "PASS" "$test_name" "HTTP 200, ${time_total}s"
  rm -f "$tmpfile"
}

# Test a redirect (expects 301/302 to target)
test_redirect() {
  local from_path="$1"
  local to_path="$2"
  local expected_code="${3:-301}"
  local url="${BASE_URL}${from_path}"
  local test_name="REDIRECT ${from_path} -> ${to_path}"

  local http_code redirect_url
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 \
    -H "User-Agent: KuhniRema-SmokeTest/1.0" \
    "$url" 2>/dev/null) || http_code="000"
  redirect_url=$(curl -s -o /dev/null -w "%{redirect_url}" \
    --max-time 10 \
    -H "User-Agent: KuhniRema-SmokeTest/1.0" \
    "$url" 2>/dev/null) || redirect_url=""

  if [ "$http_code" != "$expected_code" ]; then
    add_result "FAIL" "$test_name" "HTTP ${http_code} (expected ${expected_code})"
    return
  fi

  # Check redirect target contains expected path
  if [ -n "$to_path" ] && ! echo "$redirect_url" | grep -q "$to_path"; then
    add_result "FAIL" "$test_name" "Redirects to ${redirect_url} (expected ${to_path})"
    return
  fi

  add_result "PASS" "$test_name" "HTTP ${http_code} -> ${redirect_url}"
}

# Test an endpoint returns valid JSON
test_json_endpoint() {
  local method="$1"
  local path="$2"
  local data="$3"
  local test_name="$4"
  local url="${BASE_URL}${path}"

  local tmpfile
  tmpfile=$(mktemp)
  local http_code
  if [ "$method" = "POST" ]; then
    http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" \
      --max-time 10 \
      -X POST \
      -H "User-Agent: KuhniRema-SmokeTest/1.0" \
      -d "$data" \
      "$url" 2>/dev/null) || http_code="000"
  else
    http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" \
      --max-time 10 \
      -H "User-Agent: KuhniRema-SmokeTest/1.0" \
      "$url" 2>/dev/null) || http_code="000"
  fi

  # Accept 200 or 400 (WP returns 400 for missing nonce, but still JSON)
  if [ "$http_code" = "000" ]; then
    add_result "FAIL" "$test_name" "Connection failed"
    rm -f "$tmpfile"
    return
  fi

  # Check if response looks like JSON
  if head -c 1 "$tmpfile" | grep -q '{'; then
    add_result "PASS" "$test_name" "HTTP ${http_code}, JSON response"
  elif head -c 1 "$tmpfile" | grep -q '0'; then
    # WP sometimes returns "0" for invalid AJAX — still means WP is alive
    add_result "PASS" "$test_name" "HTTP ${http_code}, WP AJAX alive"
  else
    add_result "FAIL" "$test_name" "HTTP ${http_code}, not JSON"
  fi

  rm -f "$tmpfile"
}

# Test a URL returns specific HTTP status
test_status() {
  local path="$1"
  local expected_code="$2"
  local test_name="STATUS ${path}"

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 -L \
    -H "User-Agent: KuhniRema-SmokeTest/1.0" \
    "${BASE_URL}${path}" 2>/dev/null) || http_code="000"

  if [ "$http_code" = "$expected_code" ]; then
    add_result "PASS" "$test_name" "HTTP ${http_code}"
  else
    add_result "FAIL" "$test_name" "HTTP ${http_code} (expected ${expected_code})"
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}=== Smoke Test: ${BASE_URL} ===${RESET}"
echo -e "Started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# ─── 1. Page tests (HTTP 200, speed, content, no PHP errors) ───

echo -e "${CYAN}--- Page Tests ---${RESET}"

test_page "/" "Кухни Рема"
test_page "/pryamye-kuhni/" "прямые"
test_page "/uglovye-kuhni/" "угловые"
test_page "/p-obraznye-kuhni/" "П-образные"
test_page "/kuhnya/" "кухн"
test_page "/o-kompanii/" "компании"
test_page "/kontakty/" "контакт"
test_page "/faq/" "вопрос"
test_page "/otzyvy/" "отзыв"
test_page "/portfolio/" "портфолио"
test_page "/kalkulyator/" "калькулятор"
test_page "/politika-konfidencialnosti/" "конфиденциальност"

# ─── 2. Form / AJAX tests ───

echo -e "${CYAN}--- AJAX Tests ---${RESET}"

test_json_endpoint "POST" "/wp-admin/admin-ajax.php" \
  "action=kuhni_rema_submit_form&form_type=quick&phone=70000000000" \
  "AJAX kuhni_rema_submit_form"

# ─── 3. Redirect tests ───

echo -e "${CYAN}--- Redirect Tests ---${RESET}"

test_redirect "/straight" "/pryamye-kuhni/" "301"
test_redirect "/corner" "/uglovye-kuhni/" "301"

# ─── 4. SEO / technical endpoints ───

echo -e "${CYAN}--- SEO & Technical ---${RESET}"

test_status "/robots.txt" "200"
test_status "/sitemap_index.xml" "200"

# ─── Results ─────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}=== Results ===${RESET}"
echo ""
printf "${BOLD}%-6s | %-45s | %s${RESET}\n" "Status" "Test" "Details"
printf "%-6s-+-%-45s-+-%s\n" "------" "---------------------------------------------" "-----------------------------"
echo -e "$RESULTS"

echo ""
echo -e "${BOLD}Total: ${TOTAL} | Passed: ${GREEN}${PASSED}${RESET}${BOLD} | Failed: ${RED}${FAILED}${RESET}"
echo -e "Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# ─── Exit code ───

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}SMOKE TEST FAILED — ${FAILED} test(s) did not pass${RESET}"
  exit 1
else
  echo -e "${GREEN}ALL SMOKE TESTS PASSED${RESET}"
  exit 0
fi
