# Чеклист деплоя: кухнирема.рф

**Домен:** кухнирема.рф (`xn--e1afaihifegddo7k.xn--p1ai`)
**Старый домен:** mebelit.site (301-редиректы)
**Стек:** WordPress + Bricks Builder + ACF Pro + RankMath Pro
**WP-путь:** `/var/www/kuhnirema`
**VPS:** Frankfurt (SSH через секреты `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`)
**Дата создания:** 2026-03-16

---

## Переменные (заполнить перед началом)

```bash
export VPS_IP="<IP-адрес VPS>"            # узнать: ssh user@VPS_HOST "curl -s ifconfig.me"
export SSH_CMD="ssh -i ~/.ssh/deploy_key user@VPS_HOST"
export WP="/var/www/kuhnirema"
export WP_CLI="wp --path=${WP} --allow-root"
```

---

## 1. DNS — A-записи для кухнирема.рф и www

- [ ] **1.1. Создать A-запись для основного домена**

  **Команда:** В панели регистратора домена (reg.ru / nic.ru / ruCenter):

  ```
  Тип:      A
  Имя:      @
  Значение: <VPS_IP>
  TTL:      300     (снизить на время деплоя, потом поднять до 3600)
  ```

  **Проверка:**
  ```bash
  dig +short xn--e1afaihifegddo7k.xn--p1ai A
  # Должен вернуть VPS_IP
  ```

  **Откат:** Удалить A-запись в панели регистратора или вернуть старый IP.

---

- [ ] **1.2. Создать A-запись для www**

  **Команда:** В панели регистратора:

  ```
  Тип:      A
  Имя:      www
  Значение: <VPS_IP>
  TTL:      300
  ```

  **Проверка:**
  ```bash
  dig +short www.xn--e1afaihifegddo7k.xn--p1ai A
  # Должен вернуть VPS_IP
  ```

  **Откат:** Удалить A-запись `www` в панели регистратора.

---

- [ ] **1.3. Направить mebelit.site на тот же VPS (для 301-редиректов)**

  **Команда:** В панели регистратора mebelit.site:

  ```
  Тип:      A
  Имя:      @
  Значение: <VPS_IP>
  TTL:      300

  Тип:      A
  Имя:      www
  Значение: <VPS_IP>
  TTL:      300
  ```

  **Проверка:**
  ```bash
  dig +short mebelit.site A
  dig +short www.mebelit.site A
  ```

  **Откат:** Вернуть A-записи mebelit.site на старый хостинг.

---

- [ ] **1.4. Дождаться распространения DNS**

  **Команда:**
  ```bash
  # Проверять каждые 5 минут до совпадения
  watch -n 60 "dig +short xn--e1afaihifegddo7k.xn--p1ai A"
  ```

  **Проверка:**
  ```bash
  # Все три должны возвращать VPS_IP:
  dig +short xn--e1afaihifegddo7k.xn--p1ai A
  dig +short www.xn--e1afaihifegddo7k.xn--p1ai A
  dig +short mebelit.site A
  ```

  **Откат:** Не требуется (это проверка).

---

## 2. WordPress installation — установка WordPress, БД, wp-config.php

- [ ] **2.1. Скопировать site-build на VPS**

  **Команда:**
  ```bash
  rsync -avz --delete \
    -e "ssh -i ~/.ssh/deploy_key" \
    site-build/ \
    user@VPS_HOST:/tmp/site-build/
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "ls -la /tmp/site-build/deploy/"
  # Должны быть: install-wordpress.sh, wp-setup.sh, nginx-kuhnirema.conf, smoke-test.sh, htaccess
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "rm -rf /tmp/site-build"
  ```

---

- [ ] **2.2. Запустить install-wordpress.sh**

  **Команда:**
  ```bash
  ssh user@VPS_HOST "sudo bash /tmp/site-build/deploy/install-wordpress.sh"
  ```

  Скрипт выполнит:
  - Установку nginx, PHP 8.2, MariaDB, WP-CLI, Certbot
  - Создание БД `kuhni_rema` и пользователя `kuhni_rema`
  - Скачивание WordPress (ru_RU)
  - Создание wp-config.php (WP_MEMORY_LIMIT=256M, DISALLOW_FILE_EDIT, FORCE_SSL_ADMIN)
  - Установку WordPress (admin: `rema_admin`)
  - Установку плагинов: classic-editor, redis-cache, wp-mail-smtp
  - Копирование темы kuhni-rema
  - Настройку прав (www-data:www-data, 755/644)
  - PHP-FPM тюнинг (upload 20M, exec_time 300s, memory 256M)

  > **ВАЖНО:** Скрипт выведет credentials (admin пароль + DB пароль). Сохранить немедленно!

  **Проверка:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    systemctl is-active nginx && echo "nginx: OK" || echo "nginx: FAIL"
    systemctl is-active php8.2-fpm && echo "php-fpm: OK" || echo "php-fpm: FAIL"
    systemctl is-active mariadb && echo "mariadb: OK" || echo "mariadb: FAIL"
    wp core version --path=/var/www/kuhnirema --allow-root
    wp option get siteurl --path=/var/www/kuhnirema --allow-root
  EOF
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo rm -rf /var/www/kuhnirema
    sudo mariadb -e "DROP DATABASE IF EXISTS kuhni_rema; DROP USER IF EXISTS 'kuhni_rema'@'localhost'; FLUSH PRIVILEGES;"
  EOF
  ```

---

- [ ] **2.3. Сохранить credentials в менеджер паролей**

  **Команда:** Скопировать из вывода install-wordpress.sh:
  ```
  Admin URL:      https://xn--e1afaihifegddo7k.xn--p1ai/wp-admin/
  Admin User:     rema_admin
  Admin Password: <из вывода скрипта>
  DB Name:        kuhni_rema
  DB User:        kuhni_rema
  DB Password:    <из вывода скрипта>
  ```

  **Проверка:** Убедиться, что credentials записаны в безопасное место.

  **Откат:** Не требуется.

---

## 3. nginx + SSL — конфигурация, certbot, HTTPS

- [ ] **3.1. Скопировать nginx-kuhnirema.conf**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo cp /tmp/site-build/deploy/nginx-kuhnirema.conf /etc/nginx/sites-available/kuhnirema
    sudo ln -sf /etc/nginx/sites-available/kuhnirema /etc/nginx/sites-enabled/kuhnirema
    sudo nginx -t
  EOF
  ```

  Конфигурация включает:
  - HTTP -> HTTPS редирект
  - www -> non-www редирект (301)
  - mebelit.site -> кухнирема.рф (301 с маппингом URL)
  - Rate limiting для wp-login.php (3 req/min)
  - Блокировка xmlrpc.php, wp-config.php, .ht*-файлов
  - Gzip-сжатие
  - Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
  - Кэширование статики (365 дней)
  - PHP-FPM через unix socket (php8.2-fpm.sock)

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "sudo nginx -t"
  # Должно быть: syntax is ok / test is successful
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo rm /etc/nginx/sites-enabled/kuhnirema
    sudo systemctl reload nginx
  EOF
  ```

---

- [ ] **3.2. Получить SSL-сертификат Let's Encrypt**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    # Сначала перезагрузить nginx с новым конфигом (нужен для webroot challenge)
    sudo systemctl reload nginx

    # Получить сертификат
    sudo certbot --nginx \
      -d xn--e1afaihifegddo7k.xn--p1ai \
      -d www.xn--e1afaihifegddo7k.xn--p1ai \
      --non-interactive \
      --agree-tos \
      --email admin@marbomebel.ru \
      --redirect

    # Включить автообновление
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo certbot certificates
    # Должен показать сертификат для xn--e1afaihifegddo7k.xn--p1ai
    sudo certbot renew --dry-run
    # Должен пройти без ошибок
  EOF

  # Из локальной машины:
  curl -sI https://xn--e1afaihifegddo7k.xn--p1ai | head -5
  # Ожидается: HTTP/2 200
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo certbot delete --cert-name xn--e1afaihifegddo7k.xn--p1ai
    sudo systemctl reload nginx
  EOF
  ```

---

- [ ] **3.3. Получить SSL для mebelit.site (для 301-редиректов)**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo certbot --nginx \
      -d mebelit.site \
      -d www.mebelit.site \
      --non-interactive \
      --agree-tos \
      --email admin@marbomebel.ru
  EOF
  ```

  > **Примечание:** nginx-kuhnirema.conf уже содержит server-блок для mebelit.site, но SSL-пути указывают на сертификат кухнирема.рф. Если mebelit.site нужен отдельный сертификат -- обновить пути в конфиге.

  **Проверка:**
  ```bash
  curl -sI https://mebelit.site/ | grep -i "location"
  # Ожидается: location: https://xn--e1afaihifegddo7k.xn--p1ai/
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "sudo certbot delete --cert-name mebelit.site"
  ```

---

- [ ] **3.4. Проверить security headers**

  **Команда:**
  ```bash
  curl -sI https://xn--e1afaihifegddo7k.xn--p1ai | grep -Ei "(strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy)"
  ```

  **Проверка:** Должны присутствовать все 5 заголовков:
  ```
  strict-transport-security: max-age=31536000; includeSubDomains; preload
  x-frame-options: SAMEORIGIN
  x-content-type-options: nosniff
  referrer-policy: strict-origin-when-cross-origin
  permissions-policy: camera=(), microphone=(), geolocation=()
  ```

  **Откат:** Исправить заголовки в `/etc/nginx/sites-available/kuhnirema` и `sudo systemctl reload nginx`.

---

## 4. Деплой темы — rsync или deploy-theme.yml, права файлов, активация

- [ ] **4.1 (вариант A). Деплой через GitHub Actions**

  **Команда:**
  ```bash
  # Из локального окружения:
  gh workflow run deploy-theme.yml --ref main

  # Или с импортами:
  gh workflow run deploy-theme.yml --ref main -f run_imports=true

  # Только валидация (без деплоя):
  gh workflow run deploy-theme.yml --ref main -f dry_run=true
  ```

  **Проверка:**
  ```bash
  gh run list --workflow=deploy-theme.yml --limit=1
  # Статус: completed / success
  ```

  **Откат:**
  ```bash
  # Откатить на предыдущий коммит темы:
  git log --oneline site-build/wordpress/theme/ | head -5
  git checkout <COMMIT_HASH> -- site-build/wordpress/theme/
  git push origin main
  # Workflow запустится автоматически
  ```

---

- [ ] **4.1 (вариант B). Деплой вручную через rsync**

  **Команда:**
  ```bash
  # Из корня проекта:
  rsync -avz --delete \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='node_modules' \
    -e "ssh -i ~/.ssh/deploy_key" \
    site-build/wordpress/theme/ \
    user@VPS_HOST:/var/www/kuhnirema/wp-content/themes/kuhni-rema/
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "ls -la /var/www/kuhnirema/wp-content/themes/kuhni-rema/"
  # Должны быть: functions.php, style.css, inc/, templates/, assets/
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp theme activate twentytwentyfour --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **4.2. Установить права файлов**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    sudo chown -R www-data:www-data /var/www/kuhnirema/wp-content/themes/kuhni-rema/
    sudo find /var/www/kuhnirema/wp-content/themes/kuhni-rema/ -type d -exec chmod 755 {} \;
    sudo find /var/www/kuhnirema/wp-content/themes/kuhni-rema/ -type f -exec chmod 644 {} \;
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "stat -c '%U:%G %a %n' /var/www/kuhnirema/wp-content/themes/kuhni-rema/functions.php"
  # Ожидается: www-data:www-data 644 ...functions.php
  ```

  **Откат:** Повторить с правильными правами.

---

- [ ] **4.3. Активировать тему**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    wp theme activate kuhni-rema --path=/var/www/kuhnirema --allow-root
    wp cache flush --path=/var/www/kuhnirema --allow-root
    sudo systemctl restart php8.2-fpm
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp theme list --status=active --path=/var/www/kuhnirema --allow-root"
  # Должна быть: kuhni-rema
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp theme activate twentytwentyfour --path=/var/www/kuhnirema --allow-root"
  ```

---

## 5. wp-setup.sh — 12 страниц, 3 меню, 11 таксономий, настройки

- [ ] **5.1. Запустить wp-setup.sh**

  **Команда:**
  ```bash
  ssh user@VPS_HOST "bash /tmp/site-build/deploy/wp-setup.sh --path=/var/www/kuhnirema"
  ```

  Скрипт создаст:
  - **12 страниц:** Главная, Прямые кухни, Угловые кухни, П-образные кухни, О компании, Контакты, Отзывы, Портфолио, Калькулятор, FAQ, Спасибо, Политика конфиденциальности
  - **3 меню:** Главное меню (primary), Меню футера (footer), Меню каталога (catalog)
  - **11 терминов таксономий:**
    - kitchen_type: Прямая, Угловая, П-образная
    - kitchen_style: Современный, Классический, Лофт, Минимализм
    - kitchen_material: МДФ пленка, Эмаль, Глянец, Массив
  - **Настройки:** title, tagline, timezone=Asia/Krasnoyarsk, permalink=/%postname%/, static front page, noindex для /spasibo/ и /politika-konfidencialnosti/
  - **N8N URL:** https://n8n.marbomebel.ru

  **Проверка:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"

    echo "=== Страницы ==="
    $WP post list --post_type=page --fields=ID,post_title,post_name --format=table

    echo ""
    echo "=== Меню ==="
    $WP menu list --format=table

    echo ""
    echo "=== Таксономии ==="
    $WP term list kitchen_type --format=table
    $WP term list kitchen_style --format=table
    $WP term list kitchen_material --format=table

    echo ""
    echo "=== Настройки ==="
    echo "blogname: $($WP option get blogname)"
    echo "show_on_front: $($WP option get show_on_front)"
    echo "permalink: $($WP option get permalink_structure)"
    echo "timezone: $($WP option get timezone_string)"
    echo "n8n_url: $($WP option get kuhni_rema_n8n_url)"
  EOF
  ```

  Ожидаемый результат:
  - 12 страниц (publish)
  - 3 меню с пунктами
  - 11 терминов в 3 таксономиях
  - show_on_front = page
  - permalink = /%postname%/
  - timezone = Asia/Krasnoyarsk

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"

    # Удалить страницы
    $WP post list --post_type=page --format=ids | xargs -r -I{} $WP post delete {} --force

    # Удалить меню
    $WP menu delete "Главное меню" "Меню футера" "Меню каталога" 2>/dev/null || true

    # Удалить термины
    for tax in kitchen_type kitchen_style kitchen_material; do
      $WP term list $tax --field=term_id | xargs -r -I{} $WP term delete $tax {}
    done

    # Сбросить настройки
    $WP option update show_on_front "posts"
    $WP option update permalink_structure ""
    $WP rewrite flush
  EOF
  ```

---

## 6. Плагины — Bricks Builder, ACF Pro, RankMath Pro, safe-svg, webp-express, wp-mail-smtp

- [ ] **6.1. Установить бесплатные плагины**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"

    $WP plugin install safe-svg --activate
    $WP plugin install webp-express --activate
    # wp-mail-smtp уже установлен install-wordpress.sh
    $WP plugin is-installed wp-mail-smtp && $WP plugin activate wp-mail-smtp || $WP plugin install wp-mail-smtp --activate
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp plugin list --status=active --path=/var/www/kuhnirema --allow-root"
  # Должны быть active: safe-svg, webp-express, wp-mail-smtp, classic-editor, redis-cache
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"
    $WP plugin deactivate safe-svg webp-express
    $WP plugin uninstall safe-svg webp-express
  EOF
  ```

---

- [ ] **6.2. Загрузить и установить Bricks Builder**

  **Команда:**
  ```bash
  # 1. Скачать bricks.zip из https://bricksbuilder.io/account/
  # 2. Загрузить на VPS:
  scp bricks.zip user@VPS_HOST:/tmp/

  # 3. Установить:
  ssh user@VPS_HOST << 'EOF'
    wp plugin install /tmp/bricks.zip --activate --path=/var/www/kuhnirema --allow-root
    rm /tmp/bricks.zip
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp plugin list --name=bricks --path=/var/www/kuhnirema --allow-root"
  # status: active
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp plugin deactivate bricks --path=/var/www/kuhnirema --allow-root && wp plugin uninstall bricks --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **6.3. Загрузить и установить ACF Pro**

  **Команда:**
  ```bash
  # 1. Скачать advanced-custom-fields-pro.zip из https://www.advancedcustomfields.com/my-account/
  # 2. Загрузить на VPS:
  scp advanced-custom-fields-pro.zip user@VPS_HOST:/tmp/

  # 3. Установить:
  ssh user@VPS_HOST << 'EOF'
    wp plugin install /tmp/advanced-custom-fields-pro.zip --activate --path=/var/www/kuhnirema --allow-root
    rm /tmp/advanced-custom-fields-pro.zip
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp plugin list --name=advanced-custom-fields-pro --path=/var/www/kuhnirema --allow-root"
  # status: active
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp plugin deactivate advanced-custom-fields-pro --path=/var/www/kuhnirema --allow-root && wp plugin uninstall advanced-custom-fields-pro --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **6.4. Загрузить и установить RankMath Pro**

  **Команда:**
  ```bash
  # 1. Скачать seo-by-rank-math-pro.zip из https://rankmath.com/account/
  # 2. Также нужен бесплатный RankMath (зависимость):
  scp seo-by-rank-math-pro.zip user@VPS_HOST:/tmp/

  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"
    $WP plugin install seo-by-rank-math --activate
    $WP plugin install /tmp/seo-by-rank-math-pro.zip --activate
    rm /tmp/seo-by-rank-math-pro.zip
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp plugin list --path=/var/www/kuhnirema --allow-root | grep rank-math"
  # Оба плагина: active
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"
    $WP plugin deactivate seo-by-rank-math-pro seo-by-rank-math
    $WP plugin uninstall seo-by-rank-math-pro seo-by-rank-math
  EOF
  ```

---

- [ ] **6.5. Активировать лицензии в WP Admin**

  **Команда (ручная):**
  1. Открыть `https://xn--e1afaihifegddo7k.xn--p1ai/wp-admin/`
  2. **Bricks:** Bricks -> License -> ввести ключ -> Activate
  3. **ACF Pro:** Custom Fields -> Updates -> ввести ключ -> Activate
  4. **RankMath Pro:** RankMath -> Dashboard -> подключить аккаунт

  **Проверка:** В WP Admin -> Plugins все три показывают "Licensed" / "Connected".

  **Откат:** Деактивировать лицензии в соответствующих разделах WP Admin.

---

## 7. Импорт контента — кухни, проекты, отзывы, FAQ

> **ВАЖНО:** Импортировать строго в указанном порядке. Проекты зависят от кухонь (связи).

- [ ] **7.1. Импорт кухонь (42 модели)**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    wp eval-file /var/www/kuhnirema/wp-content/themes/kuhni-rema/data/import-kitchens.php \
      --path=/var/www/kuhnirema --allow-root
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=kitchen --format=count --path=/var/www/kuhnirema --allow-root"
  # Ожидается: 42
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=kitchen --format=ids --path=/var/www/kuhnirema --allow-root | xargs -r -I{} wp post delete {} --force --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **7.2. Импорт проектов портфолио (12 проектов)**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    wp eval-file /var/www/kuhnirema/wp-content/themes/kuhni-rema/data/import-projects.php \
      --path=/var/www/kuhnirema --allow-root
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=project --format=count --path=/var/www/kuhnirema --allow-root"
  # Ожидается: 12
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=project --format=ids --path=/var/www/kuhnirema --allow-root | xargs -r -I{} wp post delete {} --force --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **7.3. Импорт отзывов (15 отзывов)**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    wp eval-file /var/www/kuhnirema/wp-content/themes/kuhni-rema/data/import-reviews.php \
      --path=/var/www/kuhnirema --allow-root
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=review --format=count --path=/var/www/kuhnirema --allow-root"
  # Ожидается: 15
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=review --format=ids --path=/var/www/kuhnirema --allow-root | xargs -r -I{} wp post delete {} --force --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **7.4. Импорт FAQ (18 вопросов)**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    wp eval-file /var/www/kuhnirema/wp-content/themes/kuhni-rema/data/import-faq.php \
      --path=/var/www/kuhnirema --allow-root
  EOF
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=faq --format=count --path=/var/www/kuhnirema --allow-root"
  # Ожидается: 18
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=faq --format=ids --path=/var/www/kuhnirema --allow-root | xargs -r -I{} wp post delete {} --force --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **7.5. Регенерировать миниатюры изображений**

  **Команда:**
  ```bash
  ssh user@VPS_HOST "wp media regenerate --yes --path=/var/www/kuhnirema --allow-root"
  ```

  **Проверка:**
  ```bash
  ssh user@VPS_HOST "wp post list --post_type=attachment --post_mime_type=image --format=count --path=/var/www/kuhnirema --allow-root"
  # Должно быть > 0 (фото кухонь)
  ```

  **Откат:** Не требуется (перезапись миниатюр безопасна).

---

## 8. SMTP — настройка wp-mail-smtp

- [ ] **8.1. Настроить SMTP через WP-CLI**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"

    # Настроить WP Mail SMTP (через wp_options)
    # Заменить значения на реальные SMTP-данные:
    $WP option update wp_mail_smtp "{
      \"mail\": {
        \"from_email\": \"noreply@marbomebel.ru\",
        \"from_name\": \"Кухни Рема\",
        \"return_path\": true,
        \"mailer\": \"smtp\"
      },
      \"smtp\": {
        \"host\": \"<SMTP_HOST>\",
        \"port\": 465,
        \"encryption\": \"ssl\",
        \"auth\": true,
        \"user\": \"<SMTP_USER>\",
        \"pass\": \"<SMTP_PASSWORD>\",
        \"autotls\": true
      }
    }" --format=json
  EOF
  ```

  > **Примечание:** Если SMTP-данные неизвестны, настроить через WP Admin -> WP Mail SMTP -> Settings.

  **Проверка:**
  ```bash
  # Отправить тестовое письмо через WP Admin:
  # WP Admin -> WP Mail SMTP -> Tools -> Email Test
  # Ввести свой email, нажать Send Test Email
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp option delete wp_mail_smtp --path=/var/www/kuhnirema --allow-root"
  ```

---

## 9. SSL / robots.txt / noindex — staging vs production

- [ ] **9.1. (Staging) Включить noindex на время разработки**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"
    $WP option update blog_public 0
    echo "noindex включен (staging mode)"
  EOF
  ```

  **Проверка:**
  ```bash
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai | grep -i "noindex"
  # Должен содержать: <meta name='robots' content='noindex,nofollow' />
  ```

  **Откат:** См. шаг 9.2.

---

- [ ] **9.2. (Production) Убрать noindex при запуске**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"
    $WP option update blog_public 1
    echo "noindex убран (production mode)"
  EOF
  ```

  **Проверка:**
  ```bash
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai | grep -i "noindex"
  # НЕ должен содержать noindex (пустой вывод)
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp option update blog_public 0 --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **9.3. Разместить robots.txt**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    cp /tmp/site-build/seo/robots.txt /var/www/kuhnirema/robots.txt
    chown www-data:www-data /var/www/kuhnirema/robots.txt
    chmod 644 /var/www/kuhnirema/robots.txt
  EOF
  ```

  **Проверка:**
  ```bash
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai/robots.txt | head -5
  # Должен начинаться с: # robots.txt for кухнирема.рф
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai/robots.txt | grep "Sitemap"
  # Должен содержать: Sitemap: https://xn--e1afaihifegddo7k.xn--p1ai/sitemap_index.xml
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "rm /var/www/kuhnirema/robots.txt"
  # WordPress будет генерировать виртуальный robots.txt
  ```

---

- [ ] **9.4. Проверить noindex на служебных страницах**

  **Команда:**
  ```bash
  # Эти страницы должны остаться noindex (установлено wp-setup.sh через RankMath meta):
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai/spasibo/ | grep -i "noindex"
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai/politika-konfidencialnosti/ | grep -i "noindex"
  ```

  **Проверка:** Обе страницы содержат `noindex` в meta robots.

  **Откат:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    WP="wp --path=/var/www/kuhnirema --allow-root"
    $WP post meta delete $($WP post list --post_type=page --name=spasibo --format=ids) rank_math_robots
    $WP post meta delete $($WP post list --post_type=page --name=politika-konfidencialnosti --format=ids) rank_math_robots
  EOF
  ```

---

## 10. Аналитика — Яндекс Метрика, цели, Ecommerce, Yandex.Webmaster

- [ ] **10.1. Установить ID Яндекс Метрики**

  **Команда:**
  ```bash
  ssh user@VPS_HOST << 'EOF'
    wp option update kuhni_rema_metrika_id '103970425' --path=/var/www/kuhnirema --allow-root
  EOF
  ```

  > Или в WP Admin -> ACF Options -> Аналитика -> Yandex Metrika ID: `103970425`

  **Проверка:**
  ```bash
  curl -s https://xn--e1afaihifegddo7k.xn--p1ai | grep -o "ym(103970425"
  # Должен найти вызов ym() с ID счётчика
  ```

  **Откат:**
  ```bash
  ssh user@VPS_HOST "wp option delete kuhni_rema_metrika_id --path=/var/www/kuhnirema --allow-root"
  ```

---

- [ ] **10.2. Создать 12 целей в Яндекс Метрике**

  **Команда (ручная):** Открыть https://metrika.yandex.ru/goals?id=103970425 -> Добавить цель

  | # | Название | Тип | Идентификатор |
  |---|----------|-----|---------------|
  | 1 | Отправка формы | JavaScript-событие | `form_submit` |
  | 2 | Квиз: шаг 1 | JavaScript-событие | `quiz_step_1` |
  | 3 | Квиз: шаг 2 | JavaScript-событие | `quiz_step_2` |
  | 4 | Квиз: шаг 3 | JavaScript-событие | `quiz_step_3` |
  | 5 | Квиз: завершён | JavaScript-событие | `quiz_complete` |
  | 6 | Клик по CTA кнопке | JavaScript-событие | `cta_click` |
  | 7 | Клик по телефону | JavaScript-событие | `phone_click` |
  | 8 | Использование фильтра каталога | JavaScript-событие | `filter_use` |
  | 9 | Прокрутка 25% | JavaScript-событие | `scroll_depth_25` |
  | 10 | Прокрутка 50% | JavaScript-событие | `scroll_depth_50` |
  | 11 | Прокрутка 75% | JavaScript-событие | `scroll_depth_75` |
  | 12 | Прокрутка 100% | JavaScript-событие | `scroll_depth_100` |

  **Проверка:** В настройках Метрики (Настройка -> Цели) должно быть 12 целей.

  **Откат:** Удалить цели в интерфейсе Метрики.

---

- [ ] **10.3. Включить Ecommerce в Яндекс Метрике**

  **Команда (ручная):**
  1. Метрика -> Настройка -> Электронная коммерция
  2. Включить переключатель "Электронная коммерция"
  3. Контейнер данных: `dataLayer` (по умолчанию)
  4. Сохранить

  > Ecommerce-события уже реализованы в `assets/js/datalayer.js`.

  **Проверка:** В разделе "Электронная коммерция" настроек Метрики стоит "Включено".

  **Откат:** Выключить переключатель в настройках Метрики.

---

- [ ] **10.4. Создать воронки конверсий (рекомендуется)**

  **Команда (ручная):** Метрика -> Настройка -> Цели -> Составная цель

  **Воронка "Квиз -> Заявка":**
  1. `quiz_step_1`
  2. `quiz_step_2`
  3. `quiz_step_3`
  4. `quiz_complete`
  5. `form_submit`

  **Воронка "Вовлечённость":**
  1. `scroll_depth_25`
  2. `scroll_depth_50`
  3. `scroll_depth_75`
  4. `scroll_depth_100`
  5. `cta_click`

  **Проверка:** Воронки видны в разделе целей.

  **Откат:** Удалить составные цели в интерфейсе Метрики.

---

- [ ] **10.5. Зарегистрировать сайт в Яндекс.Вебмастер**

  **Команда (ручная):**
  1. Открыть https://webmaster.yandex.ru
  2. Нажать "Добавить сайт"
  3. Ввести: `https://xn--e1afaihifegddo7k.xn--p1ai`
  4. Подтвердить владение (meta-тег или DNS TXT-запись)
  5. Настройки сайта:
     - Регион: **Красноярск**
     - Главное зеркало: `https://xn--e1afaihifegddo7k.xn--p1ai`
  6. Добавить Sitemap: `https://xn--e1afaihifegddo7k.xn--p1ai/sitemap_index.xml`

  **Проверка:**
  - Сайт отображается как "Подтверждён" в Вебмастере
  - Sitemap в статусе "Загружен" (может занять до 24 часов)

  **Откат:** Удалить сайт из Яндекс.Вебмастера.

---

## 11. Smoke test — smoke-test.sh, ручная проверка форм

- [ ] **11.1. Запустить автоматический smoke-test.sh**

  **Команда:**
  ```bash
  ssh user@VPS_HOST "bash /tmp/site-build/deploy/smoke-test.sh https://xn--e1afaihifegddo7k.xn--p1ai"
  ```

  Тест проверяет:
  - 12 страниц: HTTP 200, время ответа < 3с, отсутствие PHP ошибок, наличие ключевого текста
  - AJAX endpoint: `/wp-admin/admin-ajax.php`
  - Редиректы: `/straight` -> `/pryamye-kuhni/`, `/corner` -> `/uglovye-kuhni/`
  - SEO: robots.txt (200), sitemap_index.xml (200)

  **Проверка:**
  ```
  Ожидаемый вывод: ALL SMOKE TESTS PASSED
  Exit code: 0
  ```

  **Откат:** Smoke test -- это только проверка. Исправить найденные проблемы в соответствующих шагах.

---

- [ ] **11.2. Проверить 301-редиректы с mebelit.site**

  **Команда:**
  ```bash
  for path in / /straight /corner /quiz /about /contacts /portfolio /privacy-policy; do
    echo -n "mebelit.site${path} -> "
    curl -sI "https://mebelit.site${path}" 2>/dev/null | grep -i "^location:" || echo "NO REDIRECT"
  done
  ```

  **Проверка:** Все пути возвращают `301` с корректным `location:` на `xn--e1afaihifegddo7k.xn--p1ai`.

  **Откат:** Не требуется.

---

- [ ] **11.3. Ручная проверка формы квиза**

  **Команда (ручная):**
  1. Открыть `https://xn--e1afaihifegddo7k.xn--p1ai/kalkulyator/` в браузере
  2. Пройти все шаги квиза
  3. Ввести тестовый телефон: `+7 (999) 000-00-00`
  4. Отправить форму

  **Проверка:**
  - Переход на страницу `/spasibo/`
  - Заявка пришла в Telegram менеджеру (через n8n webhook)
  - В Яндекс Метрике зафиксированы цели: `quiz_step_1`, `quiz_step_2`, `quiz_step_3`, `quiz_complete`, `form_submit`

  **Откат:** Удалить тестовую заявку из Google Sheets / Telegram.

---

- [ ] **11.4. Ручная проверка формы обратного звонка**

  **Команда (ручная):**
  1. Открыть любую страницу сайта
  2. Нажать кнопку "Обратный звонок" / CTA
  3. Заполнить телефон
  4. Отправить

  **Проверка:**
  - Уведомление в Telegram
  - Цель `form_submit` в Метрике

  **Откат:** Не требуется.

---

- [ ] **11.5. Проверить мобильную версию**

  **Команда (ручная):**
  1. Открыть сайт на мобильном устройстве (или Chrome DevTools -> Responsive)
  2. Проверить: меню-гамбургер работает, формы доступны, телефон кликабельный
  3. Проверить клик по телефону `+7 (391) 216-97-59` -- открывает звонилку

  **Проверка:** Все элементы отображаются корректно, формы работают.

  **Откат:** Не требуется.

---

- [ ] **11.6. Проверить скорость загрузки**

  **Команда:**
  ```bash
  # PageSpeed Insights (ручная проверка):
  # https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fxn--e1afaihifegddo7k.xn--p1ai
  ```

  **Проверка:** Performance score >= 80 (mobile), >= 90 (desktop).

  **Откат:** Оптимизировать изображения, включить кэширование, проверить WebP-конвертацию.

---

## 12. Bricks Builder — лицензия, импорт шаблонов, назначение conditions

- [ ] **12.1. Активировать лицензию Bricks Builder**

  **Команда (ручная):**
  1. WP Admin -> Bricks -> License
  2. Ввести лицензионный ключ
  3. Нажать "Activate"

  **Проверка:** Статус лицензии: "Active". Доступны все функции Bricks Builder.

  **Откат:** Bricks -> License -> Deactivate.

---

- [ ] **12.2. Настроить Bricks Builder Settings**

  **Команда (ручная):** WP Admin -> Bricks -> Settings:

  | Настройка | Значение |
  |-----------|----------|
  | Disable default WordPress widgets | Yes |
  | Disable Gutenberg (for post types) | Pages |
  | CSS Loading Method | External Files |
  | Lazy load images | Yes |
  | Disable emoji scripts | Yes |

  **Проверка:** Открыть любую страницу в редакторе Bricks (Edit with Bricks) -- редактор загружается.

  **Откат:** Вернуть настройки по умолчанию в Bricks -> Settings.

---

- [ ] **12.3. Импортировать шаблоны Bricks**

  **Команда (ручная):**
  1. WP Admin -> Bricks -> Templates -> Import
  2. Импортировать в порядке:
     - **Header** -- шапка (логотип, меню, CTA, телефон +7 (391) 216-97-59)
     - **Footer** -- подвал (4 колонки: о компании, каталог, полезное, контакты)
     - **Single Kitchen** -- шаблон карточки кухни (CPT kitchen)
     - **Single Project** -- шаблон проекта портфолио (CPT project)
     - **Шаблоны страниц** (если есть дополнительные)

  **Проверка:**
  ```
  WP Admin -> Bricks -> Templates
  Должны отображаться все импортированные шаблоны
  ```

  **Откат:** WP Admin -> Bricks -> Templates -> выбрать -> удалить.

---

- [ ] **12.4. Назначить conditions (условия применения) шаблонам**

  **Команда (ручная):** WP Admin -> Bricks -> Templates -> для каждого шаблона нажать "Conditions":

  | Шаблон | Тип | Условие |
  |--------|-----|---------|
  | Header | Header | Entire Website |
  | Footer | Footer | Entire Website |
  | Single Kitchen | Single | Post Type: kitchen |
  | Single Project | Single | Post Type: project |

  **Проверка:**
  1. Открыть `https://xn--e1afaihifegddo7k.xn--p1ai` -- видна шапка и подвал
  2. Открыть любую карточку кухни (`/kuhnya/...`) -- применяется шаблон Single Kitchen
  3. Открыть любой проект (`/project/...`) -- применяется шаблон Single Project

  **Откат:** WP Admin -> Bricks -> Templates -> убрать conditions у нужного шаблона.

---

- [ ] **12.5. Проверить отображение всех страниц**

  **Команда:**
  ```bash
  # Быстрая проверка HTTP 200 всех страниц:
  DOMAIN="https://xn--e1afaihifegddo7k.xn--p1ai"
  for path in / /pryamye-kuhni/ /uglovye-kuhni/ /p-obraznye-kuhni/ /o-kompanii/ /kontakty/ /otzyvy/ /portfolio/ /kalkulyator/ /faq/ /spasibo/ /politika-konfidencialnosti/; do
    STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "${DOMAIN}${path}")
    echo "${STATUS} ${path}"
  done
  ```

  **Проверка:** Все страницы возвращают HTTP 200. Визуально: header/footer на месте, контент отображается.

  **Откат:** Не требуется (это проверка).

---

## Сводка после завершения деплоя

После выполнения всех шагов проверить итоговое состояние:

```bash
ssh user@VPS_HOST << 'EOF'
  WP="wp --path=/var/www/kuhnirema --allow-root"

  echo "=== Сводка ==="
  echo "WordPress: $($WP core version)"
  echo "Тема: $($WP theme list --status=active --field=name)"
  echo "Активных плагинов: $($WP plugin list --status=active --format=count)"
  echo ""
  echo "Страниц: $($WP post list --post_type=page --post_status=publish --format=count)"
  echo "Кухонь: $($WP post list --post_type=kitchen --post_status=publish --format=count)"
  echo "Проектов: $($WP post list --post_type=project --post_status=publish --format=count)"
  echo "Отзывов: $($WP post list --post_type=review --post_status=publish --format=count)"
  echo "FAQ: $($WP post list --post_type=faq --post_status=publish --format=count)"
  echo ""
  echo "blog_public: $($WP option get blog_public)"
  echo "siteurl: $($WP option get siteurl)"
  echo "n8n_url: $($WP option get kuhni_rema_n8n_url)"
  echo "metrika_id: $($WP option get kuhni_rema_metrika_id)"
  echo ""
  echo "=== Сервисы ==="
  systemctl is-active nginx && echo "nginx: OK" || echo "nginx: FAIL"
  systemctl is-active php8.2-fpm && echo "php-fpm: OK" || echo "php-fpm: FAIL"
  systemctl is-active mariadb && echo "mariadb: OK" || echo "mariadb: FAIL"
  test -f /etc/letsencrypt/live/xn--e1afaihifegddo7k.xn--p1ai/fullchain.pem && echo "SSL: OK" || echo "SSL: FAIL"
EOF
```

**Ожидаемые значения:**
- Страниц: 12
- Кухонь: 42
- Проектов: 12
- Отзывов: 15
- FAQ: 18
- blog_public: 1 (production) / 0 (staging)
- Все сервисы: OK

---

## Контакты и реквизиты

- **Телефон:** +7 (391) 216-97-59
- **Адрес:** ул. 2-я Огородная, 24, Красноярск
- **Email:** admin@marbomebel.ru
- **VK:** https://vk.com/mebelit_krsk
- **N8N:** https://n8n.marbomebel.ru
