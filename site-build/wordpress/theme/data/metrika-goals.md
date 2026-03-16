# Yandex Metrika Goals Configuration

**Counter ID:** 103970425
**Site:** кухнирема.рф
**Metrika Console:** https://metrika.yandex.ru/goals?id=103970425

---

## Goals List

All goals use type **JavaScript event** (`reachGoal`). The event identifiers match exactly the strings passed to `ym(counterId, 'reachGoal', '<identifier>')` in `assets/js/analytics.js`.

### 1. form_submit — Отправка формы

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Отправка формы                     |
| **Type**        | JavaScript event                   |
| **Identifier**  | `form_submit`                      |
| **Priority**    | **High**                           |
| **Description** | Any form submission (quiz, callback, measurement request, quick contact). Triggered by the custom event `kuhniRema:formSuccess`. |

### 2. quiz_step_1 — Квиз: шаг 1

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Квиз: шаг 1                       |
| **Type**        | JavaScript event                   |
| **Identifier**  | `quiz_step_1`                      |
| **Priority**    | Medium                             |
| **Description** | User completed quiz step 1 (e.g., selected kitchen type). Triggered by `kuhniRema:quizStep` with `detail.step = 1`. |

### 3. quiz_step_2 — Квиз: шаг 2

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Квиз: шаг 2                       |
| **Type**        | JavaScript event                   |
| **Identifier**  | `quiz_step_2`                      |
| **Priority**    | Medium                             |
| **Description** | User completed quiz step 2 (e.g., selected material/style). Triggered by `kuhniRema:quizStep` with `detail.step = 2`. |

### 4. quiz_step_3 — Квиз: шаг 3

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Квиз: шаг 3                       |
| **Type**        | JavaScript event                   |
| **Identifier**  | `quiz_step_3`                      |
| **Priority**    | Medium                             |
| **Description** | User completed quiz step 3 (e.g., selected budget range). Triggered by `kuhniRema:quizStep` with `detail.step = 3`. |

### 5. quiz_complete — Квиз: завершён

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Квиз: завершён                    |
| **Type**        | JavaScript event                   |
| **Identifier**  | `quiz_complete`                    |
| **Priority**    | **High**                           |
| **Description** | User submitted the quiz form with contact info. Triggered by `kuhniRema:quizComplete`. |

### 6. cta_click — Клик по CTA кнопке

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Клик по CTA кнопке                |
| **Type**        | JavaScript event                   |
| **Identifier**  | `cta_click`                        |
| **Priority**    | Medium                             |
| **Description** | Click on any `.btn--primary` element. Params include `button_text` and `page_url`. |

### 7. phone_click — Клик по телефону

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Клик по телефону                   |
| **Type**        | JavaScript event                   |
| **Identifier**  | `phone_click`                      |
| **Priority**    | **High**                           |
| **Description** | Click on any `a[href^="tel:"]` link. Indicates strong purchase intent. |

### 8. filter_use — Использование фильтра каталога

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Использование фильтра каталога     |
| **Type**        | JavaScript event                   |
| **Identifier**  | `filter_use`                       |
| **Priority**    | Low                                |
| **Description** | User changed a value in `.catalog-filter`. Indicates catalog engagement. |

### 9. scroll_depth_25 — Прокрутка 25%

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Прокрутка 25%                      |
| **Type**        | JavaScript event                   |
| **Identifier**  | `scroll_depth_25`                  |
| **Priority**    | Low                                |
| **Description** | Page scrolled to 25% depth. Fires once per pageview. |

### 10. scroll_depth_50 — Прокрутка 50%

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Прокрутка 50%                      |
| **Type**        | JavaScript event                   |
| **Identifier**  | `scroll_depth_50`                  |
| **Priority**    | Low                                |
| **Description** | Page scrolled to 50% depth. Fires once per pageview. |

### 11. scroll_depth_75 — Прокрутка 75%

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Прокрутка 75%                      |
| **Type**        | JavaScript event                   |
| **Identifier**  | `scroll_depth_75`                  |
| **Priority**    | Low                                |
| **Description** | Page scrolled to 75% depth. Fires once per pageview. |

### 12. scroll_depth_100 — Прокрутка 100%

| Parameter       | Value                              |
|-----------------|------------------------------------|
| **Name (RU)**   | Прокрутка 100%                     |
| **Type**        | JavaScript event                   |
| **Identifier**  | `scroll_depth_100`                 |
| **Priority**    | Low                                |
| **Description** | Page scrolled to 100% depth (bottom). Fires once per pageview. |

---

## Setup Instructions (Yandex Metrika Web Interface)

1. Open https://metrika.yandex.ru/ and log in.
2. Select counter **103970425** (кухнирема.рф).
3. Navigate to **Settings** > **Goals** (Настройка > Цели).
4. For each goal above, click **Add goal** (Добавить цель):
   - **Goal name**: Use the **Name (RU)** value from the table.
   - **Goal type**: Select **JavaScript event** (JavaScript-событие).
   - **Event identifier**: Enter the exact **Identifier** string (e.g., `form_submit`).
   - Click **Add goal** to save.
5. After adding all 12 goals, verify they appear in the goals list.

### Verification

After setup, test each goal:

1. Open the site in a browser with Yandex Metrika debug mode enabled.
2. Trigger each action (submit a form, click CTA, scroll the page, etc.).
3. In Metrika console, go to **Reports** > **Conversions** (Отчёты > Конверсии).
4. Confirm that goal completions appear within 5-10 minutes.

### Conversion Funnels (Recommended)

Create these funnels in Metrika for deeper analytics:

**Funnel: Quiz to Lead**
1. `quiz_step_1`
2. `quiz_step_2`
3. `quiz_step_3`
4. `quiz_complete`
5. `form_submit`

**Funnel: Page Engagement**
1. `scroll_depth_25`
2. `scroll_depth_50`
3. `scroll_depth_75`
4. `scroll_depth_100`
5. `cta_click`

---

## Analytics.js Reference

The goal identifiers are fired from `/assets/js/analytics.js` using the helper function:

```js
ymGoal('goal_identifier', { optional_params });
```

Which internally calls:

```js
window.ym(counterId, 'reachGoal', 'goal_identifier', params);
```

The counter ID is resolved from `window.kuhniRema.ymCounterId` (set by the theme) or auto-detected from Yandex Metrika internal structures.
