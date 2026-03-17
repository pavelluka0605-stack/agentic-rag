# Production Cutover Checklist — кухнирема.рф

**Дата перехода:** _______________
**Ответственный:** _______________
**VPS IP:** _______________

---

## Phase 0: Pre-Cutover (за 24ч до перехода)

### 0.1. Backup

- [ ] **Backup mebelit.site** (если есть живой WordPress на VPS):
  ```bash
  # На VPS:
  mysqldump mebelit_db > /root/backups/mebelit_$(date +%Y%m%d).sql
  tar -czf /root/backups/mebelit_files_$(date +%Y%m%d).tar.gz /var/www/mebelit/
  ```
- [ ] **Backup N8N данных** (на всякий случай):
  ```bash
  cp -r /root/.n8n /root/backups/n8n_$(date +%Y%m%d)
  ```
- [ ] **Backup Google Sheets** — скачать копию таблицы `1i4R4GJu...` через Google Drive
- [ ] **Записать текущее состояние VPS**:
  ```bash
  systemctl list-units --state=running > /root/backups/services_before.txt
  df -h > /root/backups/disk_before.txt
  free -h > /root/backups/memory_before.txt
  ```

### 0.2. Rollback Point

- [ ] **Зафиксировать rollback-инструкции**:
  ```
  ROLLBACK:
  1. nginx: sudo ln -sf /etc/nginx/sites-available/mebelit /etc/nginx/sites-enabled/mebelit
  2. nginx: sudo rm /etc/nginx/sites-enabled/kuhnirema
  3. sudo nginx -t && sudo systemctl reload nginx
  4. DNS: вернуть A-запись на старый IP (если менялся)
  5. Проверить: curl -I https://mebelit.site → 200
  ```
- [ ] **Rollback: критерий активации** — если после cutover:
  - Сайт недоступен > 15 минут
  - Формы не отправляются (проверка в Telegram)
  - PHP fatal errors в production

### 0.3. Уведомления

- [ ] **Уведомить заказчика** — согласовать окно перехода (рекомендуется: 22:00-02:00 MSK, минимум трафика)
- [ ] **Уведомить менеджера** — формы могут быть недоступны 10-15 минут

---

## Phase 1: DNS + SSL (точка невозврата по DNS)

### 1.1. DNS

- [ ] **Создать A-запись** в панели регистратора:
  ```
  Тип: A    Имя: @                       Значение: <VPS_IP>    TTL: 300
  Тип: A    Имя: www                     Значение: <VPS_IP>    TTL: 300
  ```
- [ ] **Проверить распространение DNS**:
  ```bash
  dig +short xn--e1afaihifegddo7k.xn--p1ai A
  # Должен вернуть VPS_IP
  ```
- [ ] **Дождаться распространения** (может занять до 24ч, обычно 5-30 мин при TTL 300)

### 1.2. SSL

- [ ] **Получить SSL-сертификат**:
  ```bash
  sudo certbot --nginx \
    -d xn--e1afaihifegddo7k.xn--p1ai \
    -d www.xn--e1afaihifegddo7k.xn--p1ai \
    --non-interactive --agree-tos \
    --email admin@marbomebel.ru --redirect
  ```
- [ ] **Проверить SSL**:
  ```bash
  curl -I https://xn--e1afaihifegddo7k.xn--p1ai
  # Должен вернуть HTTP/2 200
  ```
- [ ] **Проверить auto-renewal**:
  ```bash
  sudo certbot renew --dry-run
  ```

---

## Phase 2: WordPress Deploy

- [ ] **Запустить install-wordpress.sh**:
  ```bash
  sudo bash site-build/deploy/install-wordpress.sh
  ```
  **СОХРАНИТЬ** вывод с credentials (DB password, WP admin password)

- [ ] **Запустить wp-setup.sh**:
  ```bash
  sudo bash site-build/deploy/wp-setup.sh --path=/var/www/kuhnirema
  ```

- [ ] **Установить premium плагины** (вручную через wp-admin или ZIP):
  - [ ] Bricks Builder — активировать лицензию
  - [ ] ACF Pro — активировать лицензию
  - [ ] RankMath Pro — активировать лицензию

- [ ] **Проверить тему активирована**:
  ```bash
  wp theme status kuhni-rema --path=/var/www/kuhnirema --allow-root
  ```

---

## Phase 3: Smoke Test

- [ ] **Запустить smoke-test.sh**:
  ```bash
  bash site-build/deploy/smoke-test.sh https://xn--e1afaihifegddo7k.xn--p1ai
  ```
  Ожидаемый результат: ALL SMOKE TESTS PASSED

- [ ] **Ручная проверка в браузере**:
  - [ ] Главная загружается
  - [ ] Каталог показывает кухни
  - [ ] Мобильная версия (DevTools → 375px)
  - [ ] Квиз работает (4 шага)

---

## Phase 4: Analytics Verification

### 4.1. Яндекс Метрика

- [ ] **Проверить код Метрики на странице**:
  ```bash
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai | grep -o 'ym([0-9]*'
  # Должен вернуть ID счётчика
  ```
- [ ] **Обновить домен в настройках Метрики**:
  - Войти в metrika.yandex.ru
  - Настройки счётчика → Домен: `кухнирема.рф`
  - Или создать новый счётчик для нового домена
- [ ] **Проверить цели**: 12 целей настроены (см. `data/metrika-goals.md`)
- [ ] **Проверить Ecommerce**: включён в настройках счётчика

### 4.2. RankMath / SEO

- [ ] **Проверить sitemap**:
  ```bash
  curl -I https://xn--e1afaihifegddo7k.xn--p1ai/sitemap_index.xml
  # HTTP 200
  ```
- [ ] **Проверить robots.txt**:
  ```bash
  curl https://xn--e1afaihifegddo7k.xn--p1ai/robots.txt
  # НЕ должен содержать "Disallow: /"
  # Должен содержать "Sitemap:"
  ```
- [ ] **Подтвердить домен** в Яндекс.Вебмастер и Google Search Console

---

## Phase 5: Indexation Switch

- [ ] **Включить индексацию**:
  ```bash
  wp option update blog_public 1 --path=/var/www/kuhnirema --allow-root
  ```
- [ ] **Удалить noindex** (если был установлен на staging):
  ```bash
  # Проверить meta robots на главной:
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai | grep 'noindex'
  # НЕ должен быть найден (кроме /spasibo/ и /politika/)
  ```
- [ ] **Убедиться noindex остаётся на**:
  - `/spasibo/` (страница благодарности)
  - `/politika-konfidencialnosti/`
- [ ] **Отправить sitemap** в Яндекс.Вебмастер:
  ```
  Яндекс.Вебмастер → Индексирование → Файлы Sitemap → Добавить
  URL: https://xn--e1afaihifegddo7k.xn--p1ai/sitemap_index.xml
  ```
- [ ] **Отправить sitemap** в Google Search Console

---

## Phase 6: Redirects mebelit.site → кухнирема.рф

- [ ] **Настроить DNS для mebelit.site** → тот же VPS IP (если ещё не настроен)
- [ ] **Получить SSL для mebelit.site** (если нужен для HTTPS → HTTPS redirect):
  ```bash
  sudo certbot --nginx -d mebelit.site -d www.mebelit.site \
    --non-interactive --agree-tos --email admin@marbomebel.ru
  ```
- [ ] **Проверить nginx redirect**:
  ```bash
  curl -I http://mebelit.site
  # HTTP/1.1 301 → https://xn--e1afaihifegddo7k.xn--p1ai/

  curl -I https://mebelit.site/straight
  # HTTP/1.1 301 → https://xn--e1afaihifegddo7k.xn--p1ai/pryamye-kuhni/
  ```
- [ ] **Проверить все path-specific redirects**:
  - `/straight` → `/pryamye-kuhni/`
  - `/corner` → `/uglovye-kuhni/`
  - `/quiz` → `/kalkulyator/`
  - `/about` → `/o-kompanii/`
  - `/contacts` → `/kontakty/`
  - `/portfolio` → `/portfolio/`
  - `/privacy-policy` → `/politika-konfidencialnosti/`

---

## Phase 7: Forms & Integrations

- [ ] **Тестовая отправка формы callback**:
  - Заполнить форму на сайте
  - Проверить: данные пришли в Telegram
  - Проверить: данные пришли в N8N → Google Sheets
- [ ] **Тестовая отправка формы zamer**:
  - Заполнить с адресом и временем
  - Проверить: Telegram + Sheets
- [ ] **Тестовая отправка квиза**:
  - Пройти 4 шага
  - Проверить: Telegram с ответами + Sheets
- [ ] **Проверить N8N webhook**:
  ```bash
  # На VPS:
  curl -s https://n8n.marbomebel.ru/webhook/quick-lead \
    -X POST -H "Content-Type: application/json" \
    -d '{"form_type":"test","phone":"70000000000","name":"QA Test"}'
  ```
- [ ] **Удалить тестовые заявки** из Google Sheets после проверки

---

## Phase 8: First 72h Monitoring

### Час 0-1 (сразу после cutover)

- [ ] **Проверить healthcheck workflow**:
  ```bash
  gh workflow run healthcheck.yml
  ```
- [ ] **Проверить watchdog на VPS**:
  ```bash
  ssh user@VPS "grep kuhnirema /var/log/syslog | tail -5"
  ```
- [ ] **Проверить error log nginx**:
  ```bash
  ssh user@VPS "tail -20 /var/log/nginx/kuhnirema-error.log"
  ```
- [ ] **Проверить PHP error log**:
  ```bash
  ssh user@VPS "tail -20 /var/www/kuhnirema/wp-content/debug.log"
  ```

### Час 1-24

- [ ] **Мониторить Яндекс Метрику** — визиты начинают появляться
- [ ] **Мониторить Telegram** — реальные заявки приходят
- [ ] **Проверить рекламу Яндекс Директ**:
  - Обновить URL в рекламных кампаниях: `mebelit.site` → `кухнирема.рф`
  - Или убедиться что 301 redirect не ломает UTM-метки
- [ ] **Проверить Google/Yandex** — сайт начал индексироваться:
  ```
  site:xn--e1afaihifegddo7k.xn--p1ai
  ```

### Час 24-72

- [ ] **Проверить SSL renewal** работает:
  ```bash
  sudo certbot renew --dry-run
  ```
- [ ] **Проверить disk space** (не забился ли uploads или logs):
  ```bash
  df -h
  du -sh /var/www/kuhnirema/wp-content/uploads/
  du -sh /var/log/nginx/
  ```
- [ ] **Собрать первую статистику**:
  - Визиты за 72ч
  - Количество заявок
  - Ошибки N8N (P0-08 должен отправить алерт если есть)
  - Отказы и глубина просмотра
- [ ] **Сравнить с baseline mebelit.site** (7287 визитов / 90 дней = ~81/день):
  - Если < 50 визитов/день через 72ч — проверить рекламу и DNS
- [ ] **Увеличить TTL DNS** до 3600 (после стабилизации)
- [ ] **Уведомить заказчика** — cutover завершён, передать credentials

---

## Post-Cutover: Яндекс.Бизнес + 2ГИС

- [ ] **Обновить карточку в Яндекс.Бизнес**:
  - Название: Кухни Рема
  - Сайт: кухнирема.рф
  - Часы работы, фото
- [ ] **Обновить карточку в 2ГИС**:
  - Название: Кухни Рема
  - Сайт: кухнирема.рф
- [ ] **Обновить ссылку в VK сообществе**
- [ ] **Обновить ссылку в Telegram боте** (если есть)

---

## Контрольные числа

| Метрика | Значение до | Значение после (72ч) |
|---------|-------------|---------------------|
| Визиты/день | ~81 (mebelit.site) | |
| Заявки/день | | |
| Отказы | 27.7% | |
| Время на сайте | 1:23 | |
| TTFB (ms) | | < 500 |
| PageSpeed Mobile | | >= 80 |
| PageSpeed Desktop | | >= 90 |
| SSL Grade | — | A+ |
| PHP errors (72ч) | — | 0 |
| nginx 5xx (72ч) | — | 0 |

---

**Подпись ответственного:** _______________
**Дата:** _______________
