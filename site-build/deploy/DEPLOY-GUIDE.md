# Deployment Guide -- кухнирема.рф

**Дата:** 2026-03-16
**Домен:** кухнирема.рф (Punycode: `xn--e1afaihifegddo7k.xn--p1ai`)
**Стек:** WordPress + Bricks Builder + ACF Pro + RankMath Pro
**Тема:** kuhni-rema (child theme)

---

## Содержание

1. [Пререквизиты](#1-пререквизиты)
2. [Настройка сервера](#2-настройка-сервера)
3. [Деплой темы](#3-деплой-темы)
4. [Конфигурация WordPress](#4-конфигурация-wordpress)
5. [Импорт контента](#5-импорт-контента)
6. [Настройка Bricks Builder](#6-настройка-bricks-builder)
7. [SEO настройка](#7-seo-настройка)
8. [Аналитика](#8-аналитика)
9. [DNS и редиректы](#9-dns-и-редиректы)
10. [Smoke Test](#10-smoke-test)
11. [Go Live Checklist](#11-go-live-checklist)

---

## 1. Пререквизиты

### Инфраструктура

| Ресурс | Описание | Статус |
|--------|----------|--------|
| VPS (Frankfurt) | SSH-доступ через секреты `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` | Готов |
| Домен кухнирема.рф | Punycode: `xn--e1afaihifegddo7k.xn--p1ai` | Зарегистрирован |
| DNS A-запись | `xn--e1afaihifegddo7k.xn--p1ai` -> IP VPS | Настроить |
| DNS A-запись (www) | `www.xn--e1afaihifegddo7k.xn--p1ai` -> IP VPS | Настроить |

### Лицензии

| Продукт | Тип | Примечание |
|---------|-----|------------|
| Bricks Builder | Lifetime | Скачать ZIP из личного кабинета |
| ACF Pro | Лицензия | Установить через ключ в WP Admin |
| RankMath Pro | Лицензия | Установить через ключ в WP Admin |

### Локальные файлы

| Файл | Путь | Назначение |
|------|------|------------|
| `.google-sa.json` | корень проекта | Google Service Account (не в git) |
| `bricks-*.zip` | скачать вручную | ZIP плагина Bricks Builder |

### Необходимое ПО на сервере

- nginx (или Apache)
- PHP 8.1+ (с расширениями: mysql, curl, mbstring, xml, gd, zip, intl)
- MySQL 8.0+ или MariaDB 10.6+
- WP-CLI (`wp`)
- Certbot (Let's Encrypt)
- rsync, git

---

## 2. Настройка сервера

### 2.1. Установка WordPress

```bash
ssh user@VPS_HOST

# Запустить скрипт установки (если есть)
bash /path/to/install-wordpress.sh

# Или вручную:
cd /var/www
mkdir -p kuhni-rema
cd kuhni-rema

# Скачать WordPress (русская локализация)
wp core download --locale=ru_RU --allow-root

# Создать базу данных
mysql -u root -p -e "CREATE DATABASE kuhni_rema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'kuhni_rema'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON kuhni_rema.* TO 'kuhni_rema'@'localhost';"

# Создать wp-config.php
wp config create \
    --dbname=kuhni_rema \
    --dbuser=kuhni_rema \
    --dbpass='STRONG_PASSWORD_HERE' \
    --dbcharset=utf8mb4 \
    --locale=ru_RU \
    --allow-root

# Установить WordPress
wp core install \
    --url="https://xn--e1afaihifegddo7k.xn--p1ai" \
    --title="Кухни Рема" \
    --admin_user=admin \
    --admin_password='ADMIN_PASSWORD_HERE' \
    --admin_email=admin@kuhni-rema.ru \
    --allow-root
```

### 2.2. Настройка nginx

Создать `/etc/nginx/sites-available/kuhni-rema.conf`:

```nginx
server {
    listen 80;
    server_name xn--e1afaihifegddo7k.xn--p1ai www.xn--e1afaihifegddo7k.xn--p1ai;

    root /var/www/kuhni-rema;
    index index.php;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;

    # Static file caching
    location ~* \.(jpg|jpeg|png|webp|gif|ico|css|js|woff2|woff|ttf|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # WordPress
    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Block xmlrpc
    location = /xmlrpc.php {
        deny all;
    }

    # Block .ht* files
    location ~ /\.ht {
        deny all;
    }

    # Upload limit
    client_max_body_size 64M;
}
```

```bash
# Активировать конфигурацию
sudo ln -sf /etc/nginx/sites-available/kuhni-rema.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2.3. SSL-сертификат

```bash
sudo certbot --nginx -d xn--e1afaihifegddo7k.xn--p1ai -d www.xn--e1afaihifegddo7k.xn--p1ai

# Проверить автообновление
sudo certbot renew --dry-run
```

### Откат шага 2

```bash
# Удалить nginx конфигурацию
sudo rm /etc/nginx/sites-enabled/kuhni-rema.conf
sudo systemctl reload nginx

# Удалить WordPress и БД
sudo rm -rf /var/www/kuhni-rema
mysql -u root -p -e "DROP DATABASE kuhni_rema; DROP USER 'kuhni_rema'@'localhost';"
```

---

## 3. Деплой темы

### Вариант A: через GitHub Actions

```bash
# Запустить workflow deploy-theme.yml из GitHub
gh workflow run deploy-theme.yml
```

### Вариант B: вручную через rsync

```bash
# Из локального окружения / CI
rsync -avz --delete \
    site-build/wordpress/theme/ \
    user@VPS_HOST:/var/www/kuhni-rema/wp-content/themes/kuhni-rema/

# На сервере — установить права
ssh user@VPS_HOST << 'EOF'
    sudo chown -R www-data:www-data /var/www/kuhni-rema/wp-content/themes/kuhni-rema/
    sudo find /var/www/kuhni-rema/wp-content/themes/kuhni-rema/ -type d -exec chmod 755 {} \;
    sudo find /var/www/kuhni-rema/wp-content/themes/kuhni-rema/ -type f -exec chmod 644 {} \;
EOF
```

### Проверка

```bash
ssh user@VPS_HOST "wp theme list --path=/var/www/kuhni-rema --allow-root"
# Должна быть тема kuhni-rema в списке
```

### Откат шага 3

```bash
# Откатить тему на предыдущую версию из git
git log --oneline site-build/wordpress/theme/ | head -5
git checkout <COMMIT_HASH> -- site-build/wordpress/theme/
# Повторить rsync
```

---

## 4. Конфигурация WordPress

### 4.1. Установка и активация плагинов

```bash
ssh user@VPS_HOST

cd /var/www/kuhni-rema
WP="wp --allow-root"

# Bricks Builder (загрузить ZIP вручную)
$WP plugin install /tmp/bricks-*.zip --activate

# ACF Pro (через ключ лицензии)
# Скачать ZIP из acf.com и загрузить:
$WP plugin install /tmp/advanced-custom-fields-pro.zip --activate

# RankMath Pro
$WP plugin install /tmp/seo-by-rank-math-pro.zip --activate

# Дополнительные плагины (бесплатные)
$WP plugin install safe-svg --activate        # SVG uploads
$WP plugin install webp-express --activate     # WebP conversion
$WP plugin install wp-mail-smtp --activate     # SMTP for email
```

### 4.2. Активация темы

```bash
$WP theme activate kuhni-rema
```

### 4.3. Запуск wp-setup.sh

```bash
# Скопировать скрипт на сервер
scp site-build/deploy/wp-setup.sh user@VPS_HOST:/tmp/

# Запустить
ssh user@VPS_HOST "bash /tmp/wp-setup.sh --path=/var/www/kuhni-rema"
```

Скрипт создаст:
- 12 страниц с шаблонами
- 3 меню навигации
- 11 терминов таксономий
- Настройки сайта (title, tagline, timezone, permalinks)
- Статическую главную страницу
- URL вебхука n8n

### Проверка

```bash
# Проверить страницы
$WP post list --post_type=page --fields=ID,post_title,post_name --format=table

# Проверить меню
$WP menu list --format=table

# Проверить таксономии
$WP term list kitchen_type --format=table
$WP term list kitchen_style --format=table
$WP term list kitchen_material --format=table

# Проверить настройки
$WP option get blogname
$WP option get show_on_front
$WP option get page_on_front
$WP option get permalink_structure
```

### Откат шага 4

```bash
# Сброс на стандартные настройки
$WP option update show_on_front "posts"
$WP option update permalink_structure ""

# Удалить созданные страницы
$WP post list --post_type=page --format=ids | xargs -r -I{} $WP post delete {} --force

# Удалить меню
$WP menu delete "Главное меню" "Меню футера" "Меню каталога"

# Удалить термины
$WP term list kitchen_type --field=term_id | xargs -r -I{} $WP term delete kitchen_type {}
$WP term list kitchen_style --field=term_id | xargs -r -I{} $WP term delete kitchen_style {}
$WP term list kitchen_material --field=term_id | xargs -r -I{} $WP term delete kitchen_material {}
```

---

## 5. Импорт контента

### 5.1. Порядок импорта

Импортировать строго в указанном порядке (из-за зависимостей):

```bash
# 1. Кухни (42 модели из VK Market)
bash site-build/deploy/import-kitchens.sh --path=/var/www/kuhni-rema

# 2. Проекты портфолио
bash site-build/deploy/import-projects.sh --path=/var/www/kuhni-rema

# 3. Отзывы
bash site-build/deploy/import-reviews.sh --path=/var/www/kuhni-rema

# 4. FAQ
bash site-build/deploy/import-faq.sh --path=/var/www/kuhni-rema
```

### 5.2. Проверка импорта

```bash
WP="wp --path=/var/www/kuhni-rema --allow-root"

echo "Кухни:   $($WP post list --post_type=kitchen --format=count)"
echo "Проекты: $($WP post list --post_type=project --format=count)"
echo "Отзывы:  $($WP post list --post_type=review --format=count)"
echo "FAQ:     $($WP post list --post_type=faq --format=count)"
```

Ожидаемые значения:
- Кухни: 42
- Проекты: 10-15
- Отзывы: 15-20
- FAQ: 15-20

### 5.3. Медиафайлы

Фото кухонь загружаются при импорте. Проверить:

```bash
# Количество загруженных изображений
$WP post list --post_type=attachment --post_mime_type=image --format=count

# Проверить, что image sizes сгенерированы
$WP media regenerate --yes
```

### Откат шага 5

```bash
# Удалить весь импортированный контент
$WP post list --post_type=kitchen --format=ids | xargs -r -I{} $WP post delete {} --force
$WP post list --post_type=project --format=ids | xargs -r -I{} $WP post delete {} --force
$WP post list --post_type=review --format=ids | xargs -r -I{} $WP post delete {} --force
$WP post list --post_type=faq --format=ids | xargs -r -I{} $WP post delete {} --force

# Удалить orphan медиафайлы (осторожно!)
# $WP media import --dry-run
```

---

## 6. Настройка Bricks Builder

### 6.1. Активация лицензии

1. WP Admin -> Bricks -> License
2. Ввести ключ лицензии
3. Активировать

### 6.2. Импорт шаблонов

```
WP Admin -> Bricks -> Templates -> Import
```

Импортировать в порядке:

1. **Header** -- шапка сайта (логотип, меню, CTA-кнопка, телефон)
2. **Footer** -- подвал (4 колонки: о компании, каталог, полезное, контакты)
3. **Single Kitchen** -- шаблон карточки кухни
4. **Single Project** -- шаблон проекта портфолио

### 6.3. Назначение шаблонов

```
WP Admin -> Bricks -> Templates -> Conditions
```

| Шаблон | Условие |
|--------|---------|
| Header | Entire Website |
| Footer | Entire Website |
| Single Kitchen | Single Post (kitchen) |
| Single Project | Single Post (project) |

### 6.4. Настройки Bricks

```
WP Admin -> Bricks -> Settings
```

- Disable default WordPress widgets: Yes
- Disable Gutenberg: Yes (для обычных страниц)
- CSS Loading Method: External Files
- Lazy load images: Yes

### Откат шага 6

```
WP Admin -> Bricks -> Templates -> удалить импортированные шаблоны
WP Admin -> Plugins -> Deactivate Bricks
```

---

## 7. SEO настройка

### 7.1. robots.txt

```bash
# Скопировать robots.txt в корень сайта
scp site-build/seo/robots.txt user@VPS_HOST:/var/www/kuhni-rema/robots.txt
sudo chown www-data:www-data /var/www/kuhni-rema/robots.txt
```

Проверить: `curl https://xn--e1afaihifegddo7k.xn--p1ai/robots.txt`

### 7.2. RankMath Pro -- начальная настройка

1. WP Admin -> RankMath -> Dashboard -> Setup Wizard
2. Настройки:
   - **Site Type:** Local Business
   - **Business Type:** Furniture Store
   - **Business Name:** Кухни Рема
   - **Logo:** загрузить логотип
   - **Social Profiles:** VK URL (`https://vk.com/mebelit_krsk`)
   - **Sitemap:** Enable
   - **Noindex:** empty categories, tags, author archives
   - **Local SEO:** Enable
     - Address: ул. 2-я Огородная, 24, Красноярск
     - Phone: +7 (391) 216-97-59
     - Opening hours: (настроить по факту)
3. Advanced:
   - Breadcrumbs: Enable
   - 404 Monitor: Enable
   - Redirections: Enable

### 7.3. Sitemap

Sitemap генерируется автоматически RankMath:
```
https://xn--e1afaihifegddo7k.xn--p1ai/sitemap_index.xml
```

### 7.4. Yandex.Webmaster

1. Перейти: https://webmaster.yandex.ru
2. Добавить сайт: `https://xn--e1afaihifegddo7k.xn--p1ai`
3. Подтвердить владение (meta-tag или DNS TXT-запись)
4. Настройки сайта:
   - Регион: Красноярск
   - Главное зеркало: `https://xn--e1afaihifegddo7k.xn--p1ai`
5. Добавить sitemap: `https://xn--e1afaihifegddo7k.xn--p1ai/sitemap_index.xml`

### Откат шага 7

```bash
# Удалить robots.txt (WordPress будет генерировать виртуальный)
ssh user@VPS_HOST "rm /var/www/kuhni-rema/robots.txt"

# Деактивировать RankMath
ssh user@VPS_HOST "wp plugin deactivate seo-by-rank-math-pro --path=/var/www/kuhni-rema --allow-root"
```

---

## 8. Аналитика

### 8.1. Яндекс Метрика

1. Создать счётчик в https://metrika.yandex.ru
2. Записать ID счётчика
3. Установить в теме:

```bash
ssh user@VPS_HOST
wp option update kuhni_rema_metrika_id 'COUNTER_ID' --path=/var/www/kuhni-rema --allow-root
```

Или в WP Admin -> ACF Options -> Аналитика -> Yandex Metrika ID

### 8.2. Цели Яндекс Метрики (12 целей)

Создать в интерфейсе Метрики (Настройка -> Цели):

| # | Цель | Тип | Условие |
|---|------|-----|---------|
| 1 | Отправка квиза | JavaScript-событие | `quiz_complete` |
| 2 | Клик «Рассчитать стоимость» | JavaScript-событие | `cta_calculator_click` |
| 3 | Отправка формы обратного звонка | JavaScript-событие | `callback_submit` |
| 4 | Отправка формы замера | JavaScript-событие | `zamer_submit` |
| 5 | Отправка быстрой заявки | JavaScript-событие | `quick_lead_submit` |
| 6 | Посещение «Спасибо» | Посещение страниц | URL содержит `/spasibo/` |
| 7 | Клик по телефону | JavaScript-событие | `phone_click` |
| 8 | Клик WhatsApp / Telegram | JavaScript-событие | `messenger_click` |
| 9 | Просмотр карточки кухни | JavaScript-событие | `kitchen_view` |
| 10 | Просмотр 3+ страниц | Кол-во просмотров | >= 3 страницы |
| 11 | Скролл до конца страницы | JavaScript-событие | `scroll_bottom` |
| 12 | Взаимодействие с квизом (начал) | JavaScript-событие | `quiz_start` |

### 8.3. Ecommerce DataLayer

Ecommerce-события уже реализованы в `assets/js/datalayer.js`. Включить Ecommerce в настройках счётчика Метрики:
- Метрика -> Настройка -> Электронная коммерция -> Включить

### Откат шага 8

```bash
# Удалить ID счётчика
ssh user@VPS_HOST "wp option delete kuhni_rema_metrika_id --path=/var/www/kuhni-rema --allow-root"

# Цели удаляются в интерфейсе Метрики
```

---

## 9. DNS и редиректы

### 9.1. DNS-записи

Настроить у регистратора домена:

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | `@` | `<VPS_IP>` | 300 (потом 3600) |
| A | `www` | `<VPS_IP>` | 300 |
| A | `mebelit.site` (отдельный домен) | `<VPS_IP>` | 300 |

### 9.2. Редиректы с mebelit.site

Добавить в nginx конфигурацию (`/etc/nginx/sites-available/mebelit-redirect.conf`):

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name mebelit.site www.mebelit.site;

    # SSL сертификат для mebelit.site (получить через certbot)
    ssl_certificate /etc/letsencrypt/live/mebelit.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mebelit.site/privkey.pem;

    # 301 redirects по маршрутам
    location = /straight    { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/pryamye-kuhni/; }
    location = /corner      { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/uglovye-kuhni/; }
    location = /p-shape     { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/p-obraznye-kuhni/; }
    location = /quiz        { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/kalkulyator/; }
    location = /about       { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/o-kompanii/; }
    location = /contacts    { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/kontakty/; }
    location = /privacy-policy { return 301 https://xn--e1afaihifegddo7k.xn--p1ai/politika-konfidencialnosti/; }

    # Все остальные -> главная
    location / {
        return 301 https://xn--e1afaihifegddo7k.xn--p1ai$request_uri;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/mebelit-redirect.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d mebelit.site -d www.mebelit.site
sudo nginx -t && sudo systemctl reload nginx
```

### 9.3. Проверка редиректов

```bash
# Проверить каждый 301
for path in /straight /corner /p-shape /quiz /about /contacts /privacy-policy /; do
    echo -n "$path -> "
    curl -sI "https://mebelit.site${path}" | grep -i "location:" || echo "NO REDIRECT"
done
```

### 9.4. www -> non-www redirect

Добавить в основной nginx-конфиг кухнирема.рф:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name www.xn--e1afaihifegddo7k.xn--p1ai;
    return 301 https://xn--e1afaihifegddo7k.xn--p1ai$request_uri;
}
```

### Откат шага 9

```bash
# Откатить DNS: вернуть A-записи на старый IP (у регистратора)
# Удалить nginx конфигурацию редиректов
sudo rm /etc/nginx/sites-enabled/mebelit-redirect.conf
sudo systemctl reload nginx
```

---

## 10. Smoke Test

### 10.1. Запуск smoke test

```bash
# Скопировать и запустить
scp site-build/deploy/smoke-test.sh user@VPS_HOST:/tmp/
ssh user@VPS_HOST "bash /tmp/smoke-test.sh"
```

### 10.2. Ручная проверка (если скрипт отсутствует)

```bash
DOMAIN="https://xn--e1afaihifegddo7k.xn--p1ai"

echo "=== Smoke Test ==="

# Проверить все страницы (HTTP 200)
PAGES=(
    "/"
    "/pryamye-kuhni/"
    "/uglovye-kuhni/"
    "/p-obraznye-kuhni/"
    "/o-kompanii/"
    "/kontakty/"
    "/otzyvy/"
    "/portfolio/"
    "/kalkulyator/"
    "/faq/"
    "/spasibo/"
    "/politika-konfidencialnosti/"
)

for page in "${PAGES[@]}"; do
    STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "${DOMAIN}${page}")
    if [ "$STATUS" = "200" ]; then
        echo "[OK]  ${page} -> ${STATUS}"
    else
        echo "[FAIL] ${page} -> ${STATUS}"
    fi
done

# Проверить robots.txt
STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "${DOMAIN}/robots.txt")
echo ""
echo "robots.txt: ${STATUS}"

# Проверить sitemap
STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "${DOMAIN}/sitemap_index.xml")
echo "sitemap: ${STATUS}"

# Проверить SSL
echo ""
echo "SSL:"
curl -sI "${DOMAIN}" | grep -i "strict-transport"

# Проверить AJAX (forms endpoint)
STATUS=$(curl -sI -o /dev/null -w "%{http_code}" -X POST "${DOMAIN}/wp-admin/admin-ajax.php" -d "action=kuhni_rema_submit_form")
echo ""
echo "AJAX endpoint: ${STATUS} (400 expected = working)"

# Проверить 301 с mebelit.site
echo ""
echo "Redirects:"
REDIRECT=$(curl -sI "https://mebelit.site/" | grep -i "location:" | head -1)
echo "mebelit.site -> ${REDIRECT}"
```

### 10.3. Проверка форм

1. Открыть `/kalkulyator/` в браузере
2. Заполнить квиз до конца
3. Проверить: переход на `/spasibo/`
4. Проверить: заявка пришла в Telegram (через n8n webhook)
5. Проверить: данные в Google Sheets

### Откат шага 10

Smoke test -- это только проверка, откат не требуется. Исправить найденные проблемы в соответствующих шагах.

---

## 11. Go Live Checklist

### Финальные действия перед запуском

- [ ] Убрать `noindex` с основных страниц (если был установлен на время разработки)

```bash
wp option update blog_public 1 --path=/var/www/kuhni-rema --allow-root
```

- [ ] Проверить, что `/spasibo/` и `/politika-konfidencialnosti/` остаются `noindex`
- [ ] Убедиться, что все формы отправляются и приходят в Telegram
- [ ] Проверить мобильную версию на реальном устройстве
- [ ] Проверить скорость загрузки: PageSpeed Insights (цель: 80+ mobile)

### Регистрация в поисковых системах

- [ ] **Yandex.Webmaster**: подтвердить сайт, добавить sitemap, указать регион Красноярск
- [ ] **Google Search Console**: подтвердить сайт, добавить sitemap

### Бизнес-каталоги

- [ ] **Яндекс.Бизнес** (https://business.yandex.ru): создать/обновить карточку
  - Название: Кухни Рема
  - Адрес: ул. 2-я Огородная, 24, Красноярск
  - Телефон: +7 (391) 216-97-59
  - Сайт: https://кухнирема.рф
  - Категория: Мебель на заказ
  - Фото: загрузить 10+ фото кухонь
- [ ] **2ГИС** (https://2gis.ru): создать/обновить карточку с аналогичными данными
- [ ] **Google My Business**: создать карточку (опционально, приоритет ниже)

### Социальные сети

- [ ] Обновить ссылку на сайт в группе VK (`https://vk.com/mebelit_krsk`)
- [ ] Обновить ссылку в Telegram-канале (если есть)
- [ ] Опубликовать пост о запуске нового сайта в VK

### Мониторинг (первая неделя)

- [ ] Ежедневно проверять Яндекс.Метрику: посещаемость, цели, ошибки
- [ ] Проверить индексацию через 3-5 дней в Yandex.Webmaster
- [ ] Проверить 404 ошибки в RankMath -> 404 Monitor
- [ ] Убедиться, что редиректы с mebelit.site работают (проверить в Webmaster)
- [ ] Мониторить Telegram: все заявки приходят менеджеру

### Откат (полный)

Если необходимо откатить весь запуск:

1. Вернуть DNS mebelit.site на старый хостинг
2. Убрать DNS-записи кухнирема.рф
3. Остановить nginx-конфигурацию кухнирема.рф

```bash
sudo rm /etc/nginx/sites-enabled/kuhni-rema.conf
sudo rm /etc/nginx/sites-enabled/mebelit-redirect.conf
sudo systemctl reload nginx
```

4. При необходимости -- восстановить mebelit.site из бэкапа

---

## Справочник

### Пути на сервере

| Путь | Содержание |
|------|------------|
| `/var/www/kuhni-rema/` | WordPress root |
| `/var/www/kuhni-rema/wp-content/themes/kuhni-rema/` | Тема |
| `/var/www/kuhni-rema/wp-content/uploads/` | Медиафайлы |
| `/var/www/kuhni-rema/robots.txt` | robots.txt |
| `/etc/nginx/sites-available/kuhni-rema.conf` | nginx config |
| `/etc/nginx/sites-available/mebelit-redirect.conf` | Redirect config |

### Полезные команды

```bash
# WP-CLI
WP="wp --path=/var/www/kuhni-rema --allow-root"

# Проверить версию WP
$WP core version

# Обновить WP
$WP core update

# Бэкап БД
$WP db export /tmp/kuhni-rema-backup-$(date +%Y%m%d).sql

# Восстановить БД
$WP db import /tmp/kuhni-rema-backup-YYYYMMDD.sql

# Очистить кэш
$WP cache flush

# Поискать/заменить URL (при миграции)
$WP search-replace 'old-domain.com' 'xn--e1afaihifegddo7k.xn--p1ai' --all-tables --dry-run
```
