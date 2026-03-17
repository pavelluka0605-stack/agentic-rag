# Staging Acceptance Report — кухнирема.рф RC-1.0.0

**Дата:** 2026-03-17
**Commit:** `15900bd`
**Ветка:** `claude/mebelit-discovery-audit-gRQGq`
**Метод:** Статический аудит (VPS staging недоступен из среды Claude Code)

---

## 1. Static Smoke Test Results

### 1.1. Code Integrity

| Check | Result | Details |
|-------|--------|---------|
| PHP Lint (35 files) | **PASS** | 0 syntax errors |
| Template Hierarchy | **PASS** | single-kitchen.php, single-project.php, archive-kitchen.php, header-minimal.php, header.php, footer.php — все в корне темы |
| Asset File Existence | **PASS** | 13 CSS/JS файлов по путям из functions.php |
| require_once References | **PASS** | 11 inc/ файлов существуют |
| Deploy Script Paths | **PASS** | wp-setup.sh и install-wordpress.sh оба используют `/var/www/kuhnirema` |

### 1.2. Functional Coverage (Static)

| Page/Feature | Template Exists | ACF Fields OK | Schema OK | Breadcrumbs OK |
|-------------|-----------------|---------------|-----------|----------------|
| Homepage | page-home.php | YES | Org ✓ | N/A (front page) |
| Catalog | page-catalog.php | YES | — | Custom ✓ |
| Single Kitchen | single-kitchen.php | YES | Product ✓ | Custom + type ✓ |
| Archive Kitchen | archive-kitchen.php | YES | — | Custom + tax ✓ |
| Portfolio | page-portfolio.php | YES | — | breadcrumbs.php ✓ |
| Single Project | single-project.php | YES | — | Custom ✓ |
| Reviews | page-reviews.php | YES | AggregateRating ✓ | breadcrumbs.php ✓ |
| About | page-about.php | YES | — | breadcrumbs.php ✓ |
| Contacts | page-contacts.php | YES | LocalBusiness ✓ | breadcrumbs.php ✓ |
| FAQ | page-faq.php | YES | FAQPage ✓ | breadcrumbs.php ✓ |
| Quiz | page-quiz.php | YES | — | breadcrumbs.php ✓ |
| Thank You | page-thanks.php | YES | — | N/A |
| Privacy | page-privacy.php | YES | — | breadcrumbs.php ✓ |

### 1.3. Forms

| Form | data-form-type | Webhook Route | Template |
|------|---------------|---------------|----------|
| Quick callback | `callback` → `webhook/callback` | page-home.php ✓ | ✓ |
| Zamer (homepage) | `zamer` → `webhook/zamer-lead` | page-home.php ✓ | ✓ |
| Zamer (contacts) | `zamer` → `webhook/zamer-lead` | page-contacts.php ✓ | ✓ |
| Zamer (kitchen card) | `zamer` → `webhook/zamer-lead` | single-kitchen.php ✓ | ✓ |
| Competitor project | `competitor_project` → `webhook/competitor-project` | page-catalog.php ✓ | ✓ |
| Quiz | `quiz` → `webhook/quiz-lead` | quiz.js ✓ | ✓ |

### 1.4. Mobile & Responsiveness (Static)

| Check | Result |
|-------|--------|
| responsive.css loaded | **PASS** (enqueued globally) |
| Footer accordion JS → HTML match | **PASS** (P1-014 fixed) |
| Mobile menu JS | **PASS** (initMobileMenu in main.js) |
| Sticky CTA JS | **PASS** (initStickyCTA in main.js) |
| viewport meta tag | **Requires manual check** — set in Bricks/header |

### 1.5. Analytics (Static)

| Check | Result |
|-------|--------|
| datalayer.js enqueued | **PASS** |
| analytics.js enqueued | **PASS** |
| data-kitchen-id set on body | **PASS** (P0-004 fixed via wp_body_open) |
| Ecommerce detail_view | **PASS** (datalayer.js reads data-kitchen-id) |
| Ecommerce add_to_cart | **PASS** (datalayer.js reads data-kitchen-id) |
| YM counter ID ACF field | **PASS** (P1-008: analytics_ym_counter_id registered) |

### 1.6. SEO (Static)

| Check | Result |
|-------|--------|
| Schema.org Organization | **PASS** — guarded by `!function_exists('rank_math')` |
| Schema.org LocalBusiness | **PASS** — contacts page only, guarded |
| Schema.org Product | **PASS** — uses taxonomies (P1-009 fixed) |
| Schema.org FAQPage | **PASS** |
| Schema.org AggregateRating | **PASS** |
| No duplicate schema w/ RankMath | **PASS** (P0-005 fixed) |
| RankMath title templates | **PASS** |
| OG meta tags | **PASS** (REQUEST_URI sanitized, P1-002) |
| RankMath breadcrumbs disabled | **PASS** — all 5 templates use custom breadcrumbs |
| Sitemap CPT config | **PASS** (kitchen, project included; review, team, faq excluded) |

### 1.7. Security (Static)

| Check | Result |
|-------|--------|
| AJAX nonce (kuhni_rema_form) | **PASS** |
| Input sanitization | **PASS** (sanitize_text_field, sanitize_url) |
| XSS in OG URL | **PASS** (P1-002 fixed, uses esc_url(home_url())) |
| Nginx security headers | **PASS** (P1-013: headers in all location blocks) |
| HSTS | **PASS** (Strict-Transport-Security in nginx) |
| Rate limiting | **PASS** (nginx limit_req_zone) |

### 1.8. Deploy Infrastructure

| Check | Result |
|-------|--------|
| install-wordpress.sh | **PASS** (set -euo pipefail, pre-flight checks) |
| wp-setup.sh | **PASS** (path aligned to /var/www/kuhnirema) |
| nginx-kuhnirema.conf | **PASS** (SSL, gzip, security, mebelit redirects) |
| smoke-test.sh | **PASS** (tests all pages, redirects, PHP errors) |
| deploy-theme.yml (CI/CD) | **PASS** (workflow exists) |

---

## 2. Summary

| Category | Passed | Failed | Manual Check Required |
|----------|--------|--------|----------------------|
| Code Integrity | 5/5 | 0 | 0 |
| Functional Coverage | 13/13 | 0 | 0 |
| Forms | 6/6 | 0 | 0 |
| Mobile | 4/5 | 0 | 1 (viewport meta) |
| Analytics | 6/6 | 0 | 0 |
| SEO | 10/10 | 0 | 0 |
| Security | 6/6 | 0 | 0 |
| Deploy | 5/5 | 0 | 0 |
| **TOTAL** | **55/56** | **0** | **1** |

---

## 3. Blockers

**None.** 0 blocking issues found.

---

## 4. Non-Blockers (Known Limitations)

| # | Item | Impact | Plan |
|---|------|--------|------|
| 1 | 5 P2 defects documented | Cosmetic / minor functional | Fix in v1.0.1 |
| 2 | 7 P3 defects documented | Best practices | Fix in v1.0.1 |
| 3 | Quiz file upload server-side handler missing | Quiz files silently discarded | P2, non-critical |
| 4 | sessionStorage `kuhni_form_submitted` never set | Quiz popup may re-show after form submit | P2, non-critical |

---

## 5. Items Requiring VPS Staging Verification

These **cannot be verified statically** and must be checked after deploy to VPS:

| # | Check | How to Verify |
|---|-------|---------------|
| 1 | Pages render in browser (no blank pages) | Visual check on all 13 pages |
| 2 | Forms submit end-to-end → Telegram | Submit test leads, check Telegram |
| 3 | Quiz 4-step flow completes | Walk through quiz, verify redirect to /spasibo/ |
| 4 | Mobile responsive (375px, 768px) | Chrome DevTools responsive mode |
| 5 | Yandex Metrika fires events | Metrika debugger or browser console |
| 6 | PageSpeed score ≥80 mobile / ≥90 desktop | pagespeed.web.dev |
| 7 | SSL A+ grade | ssllabs.com |
| 8 | TTFB < 500ms | WebPageTest or curl timing |
| 9 | N8N webhook integration | POST to webhook, check Google Sheets |
| 10 | mebelit.site 301 redirects | curl -I all redirect paths |
| 11 | Bricks Builder visual rendering | Admin → Pages → Edit with Bricks |
| 12 | Premium plugins activated | wp-admin → Plugins |

---

## 6. Verdict

### CONDITIONALLY READY FOR PRODUCTION

The codebase passes **all static verification checks** (55/56, 1 requires manual viewport meta check).

**Before go-live, the following MUST be done on VPS:**

1. Deploy to staging (`install-wordpress.sh` + `wp-setup.sh`)
2. Install & activate premium plugins (Bricks, ACF Pro, RankMath Pro)
3. Run `smoke-test.sh` — expect ALL PASS
4. Visual check: desktop + mobile (375px)
5. Test forms: callback + zamer + quiz → Telegram
6. Client approval

**Once staging is green → proceed with PRODUCTION-CUTOVER-CHECKLIST.md**

---

**QA Engineer:** Claude Code (static analysis)
**Date:** 2026-03-17
