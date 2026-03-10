#!/usr/bin/env bash
#
# Скрипт-помощник для получения credentials
# Запускается интерактивно на VPS
#
set -euo pipefail

echo "============================================"
echo "  P0 — Получение Credentials"
echo "============================================"
echo ""

# ─── VK Token ─────────────────────────────────────
echo "═══ 1. VK COMMUNITY TOKEN ═══"
echo ""
echo "Как получить:"
echo "  1. Зайдите в управление сообществом ВК"
echo "  2. Настройки → Работа с API → Ключи доступа"
echo "  3. Создать ключ с правами:"
echo "     ✓ Сообщения сообщества"
echo "     ✓ Стена"
echo "     ✓ Управление"
echo "  4. Скопируйте токен"
echo ""
echo "  Также: Работа с API → Long Poll API → Включить"
echo "     ✓ Версия API: 5.199"
echo "     ✓ Типы событий: сообщения, комментарии"
echo ""
echo "  ID сообщества: число из URL (vk.com/club123456 → 123456)"
echo ""

# ─── Telegram Bot ─────────────────────────────────
echo "═══ 2. TELEGRAM BOT ═══"
echo ""
echo "Как получить:"
echo "  1. Откройте @BotFather в Telegram"
echo "  2. /newbot → введите имя и username"
echo "  3. Скопируйте токен"
echo ""
echo "  Получение Chat ID:"
echo "  1. Напишите боту /start"
echo "  2. Откройте:"
echo "     https://api.telegram.org/bot<TOKEN>/getUpdates"
echo "  3. Найдите chat.id в ответе"
echo ""

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "  Автоматическое определение Chat ID..."
  echo "  Напишите боту /start, затем нажмите Enter."
  read -p "  [Enter] " _
  UPDATES=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates")
  CHAT_ID=$(echo "$UPDATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('result'):
    print(data['result'][-1]['message']['chat']['id'])
else:
    print('NOT FOUND')
" 2>/dev/null || echo "NOT FOUND")
  echo "  Chat ID: $CHAT_ID"
fi

# ─── Google Service Account ──────────────────────
echo ""
echo "═══ 3. GOOGLE SERVICE ACCOUNT ═══"
echo ""
echo "Как получить:"
echo "  1. https://console.cloud.google.com/"
echo "  2. Создайте проект (или выберите существующий)"
echo "  3. APIs & Services → Enable → Google Sheets API"
echo "  4. APIs & Services → Credentials → Create → Service Account"
echo "  5. Создайте ключ (JSON) → скачайте файл"
echo "  6. Скопируйте JSON на VPS:"
echo "     scp credentials.json user@vps:/opt/credentials/"
echo ""
echo "  7. В Google Sheets расшарьте таблицу на email"
echo "     из поля 'client_email' в JSON-ключе"
echo ""

echo "═══ ГОТОВО ═══"
echo ""
echo "После получения всех данных:"
echo "  1. cp .env.example .env"
echo "  2. nano .env  (заполните значения)"
echo "  3. sudo bash scripts/deploy.sh"
