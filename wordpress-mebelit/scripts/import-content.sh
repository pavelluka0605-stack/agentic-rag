#!/bin/bash
#
# Mebelit — WordPress Content Import Script
# Использует WP-CLI для создания страниц, кухонь и отзывов
#
# Запуск: bash import-content.sh
# Требования: WP-CLI установлен, запускать из корня WordPress
#

set -e

echo "=== Mebelit Content Import ==="
echo ""

# ---- 1. Создание страниц ----
echo "--- Создание страниц ---"

wp post create --post_type=page --post_title='Главная' --post_status=publish --post_name='home'
wp post create --post_type=page --post_title='Кухни прямые' --post_status=publish --post_name='straight'
wp post create --post_type=page --post_title='Кухни угловые' --post_status=publish --post_name='corner'
wp post create --post_type=page --post_title='Кухни П-образные' --post_status=publish --post_name='pshape'
wp post create --post_type=page --post_title='Квиз' --post_status=publish --post_name='quiz' --page_template='templates/page-quiz.php'
wp post create --post_type=page --post_title='Политика конфиденциальности' --post_status=publish --post_name='politics' --page_template='templates/page-privacy.php'

echo "Страницы созданы."

# ---- 2. Настройка главной страницы ----
echo "--- Настройка главной ---"
HOME_ID=$(wp post list --post_type=page --name=home --field=ID)
wp option update show_on_front page
wp option update page_on_front "$HOME_ID"
echo "Главная страница: ID $HOME_ID"

# ---- 3. Настройка ЧПУ ----
wp rewrite structure '/%postname%/'
wp rewrite flush

# ---- 4. Создание терминов таксономии ----
echo "--- Создание типов кухонь ---"
wp term create kitchen_type 'Прямая' --slug=straight 2>/dev/null || true
wp term create kitchen_type 'Угловая' --slug=corner 2>/dev/null || true
wp term create kitchen_type 'П-образная' --slug=pshape 2>/dev/null || true

# ---- 5. Импорт кухонь ----
echo "--- Импорт кухонь ---"

# Прямые
declare -A STRAIGHT=(
  ["Кухня «Тренто»"]=217050
  ["Кухня «Скала» 1"]=233100
  ["Кухня «Скала»"]=239400
  ["Кухня «Ройс» 17"]=177600
  ["Кухня «Ройс» 16"]=250800
  ["Кухня «Ройс» 15"]=177600
  ["Кухня «Ройс» 14"]=199800
  ["Кухня «Ройс» 13"]=109350
)

for name in "${!STRAIGHT[@]}"; do
  price=${STRAIGHT[$name]}
  ID=$(wp post create --post_type=kitchen --post_title="$name" --post_status=publish --porcelain)
  wp term set "$ID" kitchen_type straight
  wp post meta update "$ID" kitchen_price "$price"
  echo "  Создана: $name ($price ₽) → ID $ID"
done

# Угловые
declare -A CORNER=(
  ["Кухня «Гарда» 5"]=185100
  ["Кухня «Дебора»"]=170400
  ["Кухня «Капри»"]=189300
  ["Кухня «Капри» 1"]=165750
  ["Кухня «Капри» 3"]=168900
  ["Кухня «Квадро» 1"]=153750
  ["Кухня «Квадро» 2"]=268050
  ["Кухня «Квадро» 5"]=154350
)

for name in "${!CORNER[@]}"; do
  price=${CORNER[$name]}
  ID=$(wp post create --post_type=kitchen --post_title="$name" --post_status=publish --porcelain)
  wp term set "$ID" kitchen_type corner
  wp post meta update "$ID" kitchen_price "$price"
  echo "  Создана: $name ($price ₽) → ID $ID"
done

# П-образные
declare -A PSHAPE=(
  ["Кухня «Квадро»"]=208200
  ["Кухня «Квадро» П1"]=177600
  ["Кухня «Лофт»"]=185550
  ["Кухня «Лофт» 2"]=147900
  ["Кухня «Лофт» 3"]=179250
  ["Кухня «Олива»"]=175050
  ["Кухня «Ройс»"]=189750
  ["Кухня «Ройс» П1"]=230100
)

for name in "${!PSHAPE[@]}"; do
  price=${PSHAPE[$name]}
  ID=$(wp post create --post_type=kitchen --post_title="$name" --post_status=publish --porcelain)
  wp term set "$ID" kitchen_type pshape
  wp post meta update "$ID" kitchen_price "$price"
  echo "  Создана: $name ($price ₽) → ID $ID"
done

echo "Кухни импортированы: $(wp post list --post_type=kitchen --format=count) записей"

# ---- 6. Импорт отзывов ----
echo "--- Импорт отзывов ---"

declare -a REVIEWS=(
  "Анна К.|Заказывали угловую кухню. Всё сделали быстро, качественно, в срок. Дизайнер приехал, помог определиться с цветом и планировкой. Очень довольны результатом!|5"
  "Михаил С.|Кухня получилась даже лучше, чем ожидали. Фасады ровные, фурнитура работает без нареканий. Рекомендую Mebelit всем знакомым.|5"
  "Елена В.|Третий раз заказываем мебель здесь. Кухня для новой квартиры — просто восторг. Замер бесплатный, 3D-проект делали при нас. Спасибо команде!|5"
  "Сергей П.|Установили кухню за один день, как и обещали. Качество материалов отличное, цена ниже, чем в салонах. Отдельное спасибо дизайнеру Наоми.|5"
  "Ольга Т.|Долго выбирали фабрику — остановились на Mebelit. Не пожалели. П-образная кухня вписалась идеально. Ребята работают честно и аккуратно.|5"
  "Дмитрий Н.|Кухня под заказ за 25 дней — вполне реальный срок. Качество сборки на высоте. Фурнитура Blum, всё открывается/закрывается мягко.|5"
  "Наталья Р.|Заказывали прямую кухню длиной 3 метра. Уложились в бюджет, даже осталось на технику. Спасибо за профессиональный подход!|5"
  "Алексей М.|Рассрочка без переплат — это реально удобно. Кухня качественная, замер и доставка бесплатно. Рекомендую!|5"
  "Ирина Б.|Переехали в новостройку, заказали кухню в Mebelit по совету друзей. Результат превзошёл ожидания. Вежливые мастера, чистая установка.|5"
  "Владимир К.|Сравнивал цены с тремя другими фирмами. У Mebelit вышло на 40% дешевле при тех же материалах. Очень доволен.|5"
)

for review in "${REVIEWS[@]}"; do
  IFS='|' read -r author text rating <<< "$review"
  ID=$(wp post create --post_type=review --post_title="Отзыв — $author" --post_status=publish --porcelain)
  wp post meta update "$ID" review_author "$author"
  wp post meta update "$ID" review_text "$text"
  wp post meta update "$ID" review_rating "$rating"
  echo "  Отзыв: $author → ID $ID"
done

echo "Отзывы импортированы: $(wp post list --post_type=review --format=count) записей"

# ---- 7. Создание меню ----
echo "--- Создание меню ---"
wp menu create "Главное меню" 2>/dev/null || true

STRAIGHT_ID=$(wp post list --post_type=page --name=straight --field=ID)
CORNER_ID=$(wp post list --post_type=page --name=corner --field=ID)
PSHAPE_ID=$(wp post list --post_type=page --name=pshape --field=ID)

wp menu item add-post "Главное меню" "$STRAIGHT_ID" --title="Кухни прямые"
wp menu item add-post "Главное меню" "$CORNER_ID" --title="Кухни угловые"
wp menu item add-post "Главное меню" "$PSHAPE_ID" --title="Кухни П-образные"

wp menu location assign "Главное меню" primary 2>/dev/null || true

echo ""
echo "=== Импорт завершён ==="
echo "Страниц: $(wp post list --post_type=page --format=count)"
echo "Кухонь: $(wp post list --post_type=kitchen --format=count)"
echo "Отзывов: $(wp post list --post_type=review --format=count)"
echo ""
echo "Следующий шаг: собрать страницы в Elementor (см. ELEMENTOR-BUILD-GUIDE.md)"
