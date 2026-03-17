# Staging Deployment Plan — кухнирема.рф

> Документ описывает план развёртывания staging-среды для сайта кухнирема.рф (xn--e1afaihifegddo7k.xn--p1ai).
> Стек: WordPress + Bricks Builder + ACF Pro + RankMath Pro.

---

## 1. Цель стейджинга

Проверка всей цепочки деплоя WordPress-сайта **до** воздействия на продакшн:

- Убедиться, что скрипты `install-wordpress.sh`, `wp-setup.sh` работают корректно на целевом VPS.
- Проверить конфигурацию nginx, SSL, PHP, MySQL в условиях, идентичных продакшну.
- Протестировать тему Bricks Builder, ACF-поля, формы, квиз — на реальном окружении.
- Выявить проблемы совместимости с существующими сервисами на VPS (N8N, VK Long Poll).
- Получить одобрение заказчика на визуал и функционал перед запуском.

---

## 2. Среда стейджинга

### Вариант A (рекомендуемый): доступ по IP:порт

- Nginx слушает порт `8443` (HTTPS) / `8080` (HTTP) на том же VPS Frankfurt.
- Доступ: `http://<VPS_IP>:8080` — не нужна DNS-запись, полная изоляция.
- WordPress path: `/var/www/kuhni-rema-staging`.

### Вариант B: поддомен staging.кухнирема.рф

- DNS A-запись: `staging.кухнирема.рф` → IP VPS.
- Отдельный nginx server block.
- WordPress path: `/var/www/kuhni-rema-staging`.
- Требует дополнительный SSL-сертификат (Let's Encrypt).

### Изоляция от продакшна

| Ресурс | Production | Staging |
|--------|-----------|---------|
| WordPress path | `/var/www/kuhni-rema` | `/var/www/kuhni-rema-staging` |
| MySQL БД | `kuhni_rema` | `kuhni_rema_staging` |
| MySQL user | `kuhni_rema_user` | `kuhni_rema_staging_user` |
| nginx config | `nginx-kuhnirema.conf` | `nginx-kuhnirema-staging.conf` |
| robots.txt | обычный | `Disallow: /` |
| Telegram | боевой чат | тестовый чат или отключено |
| N8N webhooks | боевые | тестовые endpoint или отключены |

---

## 3. Пререквизиты стейджинга

### 3.1. DNS / Сетевой доступ

- **Вариант A:** открыть порт 8080 в firewall VPS (`ufw allow 8080/tcp`).
- **Вариант B:** создать DNS A-запись `staging.кухнирема.рф` → IP VPS, дождаться распространения (до 24ч).

### 3.2. Nginx конфигурация для staging

Создать файл `nginx-kuhnirema-staging.conf`:

```nginx
server {
    listen 8080;
    server_name _;

    root /var/www/kuhni-rema-staging;
    index index.php index.html;

    # Запрет индексации
    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### 3.3. Отдельная MySQL БД

```bash
mysql -u root -p <<'SQL'
CREATE DATABASE kuhni_rema_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kuhni_rema_staging_user'@'localhost' IDENTIFIED BY '<STAGING_DB_PASS>';
GRANT ALL PRIVILEGES ON kuhni_rema_staging.* TO 'kuhni_rema_staging_user'@'localhost';
FLUSH PRIVILEGES;
SQL
```

### 3.4. robots.txt для staging

```
User-agent: *
Disallow: /
```

Размещается в `/var/www/kuhni-rema-staging/robots.txt` сразу после установки WP.

### 3.5. noindex meta для staging

Включить через WP-CLI после установки:

```bash
wp option update blog_public 0 --path=/var/www/kuhni-rema-staging
```

Дополнительно — RankMath Pro глобальный noindex (если установлен).

### 3.6. Отключение Telegram-уведомлений

- В `wp-setup.sh` для staging: использовать тестовый `TG_CHAT_ID` или пропустить настройку Telegram.
- Если формы отправляют в Telegram через N8N — использовать тестовый webhook endpoint.

### 3.7. Отключение / изоляция N8N webhooks

- Формы на staging отправлять на тестовый webhook: `https://n8n.marbomebel.ru/webhook-test/...`
- Либо создать отдельный N8N workflow с пометкой `[STAGING]` без реальной отправки.
- **Не** направлять staging-формы на боевые webhook-адреса.

---

## 4. Порядок развёртывания стейджинга

### Шаг 1. Подготовка сервера

```bash
# SSH на VPS
ssh ${VPS_USER}@${VPS_HOST}

# Создать директорию
sudo mkdir -p /var/www/kuhni-rema-staging
sudo chown www-data:www-data /var/www/kuhni-rema-staging

# Открыть порт (если вариант A)
sudo ufw allow 8080/tcp
```

### Шаг 2. Создание БД

```bash
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS kuhni_rema_staging
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'kuhni_rema_staging_user'@'localhost'
  IDENTIFIED BY '<STAGING_DB_PASS>';
GRANT ALL PRIVILEGES ON kuhni_rema_staging.*
  TO 'kuhni_rema_staging_user'@'localhost';
FLUSH PRIVILEGES;
"
```

### Шаг 3. WordPress Core Install

Использовать `install-wordpress.sh` с переменными staging-среды:

```bash
export WP_PATH="/var/www/kuhni-rema-staging"
export WP_URL="http://<VPS_IP>:8080"
export WP_TITLE="Кухни Рема [STAGING]"
export DB_NAME="kuhni_rema_staging"
export DB_USER="kuhni_rema_staging_user"
export DB_PASS="<STAGING_DB_PASS>"

bash install-wordpress.sh
```

Либо вручную:

```bash
cd /var/www/kuhni-rema-staging
wp core download --locale=ru_RU --allow-root
wp config create \
  --dbname=kuhni_rema_staging \
  --dbuser=kuhni_rema_staging_user \
  --dbpass=<STAGING_DB_PASS> \
  --dbhost=localhost \
  --locale=ru_RU \
  --allow-root
wp core install \
  --url="http://<VPS_IP>:8080" \
  --title="Кухни Рема [STAGING]" \
  --admin_user=admin \
  --admin_password=<STAGING_ADMIN_PASS> \
  --admin_email=admin@kuhnirema.rf \
  --allow-root
```

### Шаг 4. Деплой темы (rsync)

```bash
rsync -avz --delete \
  site-build/theme/ \
  ${VPS_USER}@${VPS_HOST}:/var/www/kuhni-rema-staging/wp-content/themes/flavor/
```

### Шаг 5. Плагины

```bash
wp plugin install bricks --activate --path=/var/www/kuhni-rema-staging --allow-root
# ACF Pro и RankMath Pro — установка из zip (лицензионные):
wp plugin install /tmp/advanced-custom-fields-pro.zip --activate --allow-root
wp plugin install /tmp/seo-by-rank-math-pro.zip --activate --allow-root
# Дополнительные плагины:
wp plugin install contact-form-7 --activate --allow-root
wp plugin install wp-fastest-cache --activate --allow-root
```

### Шаг 6. wp-setup.sh

Запустить `wp-setup.sh` с параметрами staging:

```bash
export WP_PATH="/var/www/kuhni-rema-staging"
export STAGING=true
bash wp-setup.sh
```

### Шаг 7. Импорт контента

- Импорт страниц из XML/JSON (если подготовлен экспорт).
- Загрузка медиафайлов в `/var/www/kuhni-rema-staging/wp-content/uploads/`.
- Настройка ACF-полей для ключевых страниц.

```bash
wp import content-export.xml --authors=create --path=/var/www/kuhni-rema-staging --allow-root
```

### Шаг 8. Bricks Builder настройка

- Активировать лицензию Bricks Builder на staging.
- Импортировать шаблоны Bricks (JSON).
- Проверить привязку шаблонов к страницам.
- Убедиться, что все элементы отображаются корректно.

### Шаг 9. robots.txt и noindex

```bash
echo -e "User-agent: *\nDisallow: /" > /var/www/kuhni-rema-staging/robots.txt
wp option update blog_public 0 --path=/var/www/kuhni-rema-staging --allow-root
```

### Шаг 10. Nginx staging конфиг

```bash
sudo cp nginx-kuhnirema-staging.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/nginx-kuhnirema-staging.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Шаг 11. Smoke test

```bash
export SITE_URL="http://<VPS_IP>:8080"
bash smoke-test.sh
```

---

## 5. Критерии прохождения стейджинга

Staging считается пройденным **только** при выполнении **всех** условий:

### 5.1. Функциональность

| Критерий | Проверка | Статус |
|----------|----------|--------|
| Все страницы отдают HTTP 200 | `smoke-test.sh` — curl каждой страницы | ⬜ |
| Главная страница загружается полностью | Визуальная проверка + curl | ⬜ |
| Страницы каталога кухонь отображаются | Проверка ACF-полей, изображений | ⬜ |
| Формы отправляются на тестовый webhook | Заполнить форму, проверить N8N | ⬜ |
| Квиз работает end-to-end | Пройти все шаги квиза, получить результат | ⬜ |
| Мобильная версия корректна | Проверка на 375px, 768px, 1024px | ⬜ |

### 5.2. Техническое качество

| Критерий | Проверка | Статус |
|----------|----------|--------|
| Нет PHP ошибок в `debug.log` | `wp_debug = true`, проверка лога | ⬜ |
| Нет JS ошибок в консоли | DevTools → Console на каждой странице | ⬜ |
| Скорость загрузки < 3 сек | Chrome DevTools → Network, TTFB < 1с | ⬜ |
| robots.txt отдаёт `Disallow: /` | `curl http://<VPS_IP>:8080/robots.txt` | ⬜ |
| noindex meta присутствует | Проверить `<meta name="robots">` в HTML | ⬜ |
| Нет конфликтов с N8N и VK Long Poll | Проверить сервисы после деплоя staging | ⬜ |

### 5.3. Одобрение заказчика

| Критерий | Проверка | Статус |
|----------|----------|--------|
| Визуал одобрен (десктоп) | Показать заказчику | ⬜ |
| Визуал одобрен (мобильная) | Показать заказчику | ⬜ |
| Тексты / контент согласованы | Вычитка заказчиком | ⬜ |

---

## 6. Переход staging → production

### Условия перехода

1. **Все критерии из раздела 5 выполнены** — каждая ячейка отмечена.
2. **Заказчик дал письменное одобрение** (сообщение в чате / Telegram).
3. **DNS для кухнирема.рф настроен** — A-запись указывает на VPS.
4. **SSL-сертификат получен** — Let's Encrypt для кухнирема.рф + www.

### Порядок перехода

```
1. Остановить staging (nginx disable site)
2. Скопировать файлы staging → production:
   rsync -avz /var/www/kuhni-rema-staging/ /var/www/kuhni-rema/
3. Создать production БД и импортировать из staging:
   mysqldump kuhni_rema_staging | mysql kuhni_rema
4. wp search-replace "http://<VPS_IP>:8080" "https://кухнирема.рф" --path=/var/www/kuhni-rema
5. Обновить wp-config.php (production DB credentials)
6. Включить production nginx config (nginx-kuhnirema.conf)
7. Получить SSL: certbot --nginx -d xn--e1afaihifegddo7k.xn--p1ai -d www.xn--e1afaihifegddo7k.xn--p1ai
8. Удалить robots.txt с Disallow, включить blog_public = 1
9. Переключить формы на боевые N8N webhooks
10. Запустить smoke-test.sh с production URL
11. Проверить отправку в Telegram (боевой чат)
12. Настроить редирект mebelit.site → кухнирема.рф (301)
```

---

## 7. Срок жизни стейджинга

- **Staging сохраняется после запуска продакшна.**
- Используется для:
  - Тестирования обновлений WordPress, плагинов, темы.
  - Проверки новых страниц и функционала перед выкаткой на прод.
  - Отладки проблем (воспроизведение багов).
- Данные staging обновлять из продакшна по необходимости:
  ```bash
  mysqldump kuhni_rema | mysql kuhni_rema_staging
  rsync -avz /var/www/kuhni-rema/wp-content/uploads/ /var/www/kuhni-rema-staging/wp-content/uploads/
  wp search-replace "https://кухнирема.рф" "http://<VPS_IP>:8080" --path=/var/www/kuhni-rema-staging
  ```
- При нехватке ресурсов VPS — staging можно временно отключить (остановить nginx site), но **не удалять**.

---

## Контрольный чеклист

```
[ ] Пререквизиты выполнены (раздел 3)
[ ] БД создана
[ ] WordPress установлен
[ ] Тема задеплоена
[ ] Плагины установлены и активированы
[ ] wp-setup.sh выполнен
[ ] Контент импортирован
[ ] Bricks Builder настроен
[ ] robots.txt + noindex настроены
[ ] nginx staging запущен
[ ] smoke-test.sh пройден
[ ] Критерии раздела 5 выполнены
[ ] Одобрение заказчика получено
[ ] Готов к переходу на production (раздел 6)
```
