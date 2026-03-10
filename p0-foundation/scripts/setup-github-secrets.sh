#!/usr/bin/env bash
#
# Настройка GitHub Secrets для автодеплоя
#
# Запустите на ЛОКАЛЬНОЙ машине (не на VPS!), где есть gh CLI.
# Или добавьте секреты вручную через GitHub UI:
#   Repo → Settings → Secrets and variables → Actions → New repository secret
#
set -euo pipefail

REPO="pavelluka0605-stack/agentic-rag"

echo "============================================"
echo "  GitHub Secrets Setup"
echo "============================================"
echo ""
echo "Repo: $REPO"
echo ""

# Проверка gh CLI
if ! command -v gh &>/dev/null; then
  echo "gh CLI не найден."
  echo ""
  echo "Добавьте секреты ВРУЧНУЮ через GitHub UI:"
  echo "  https://github.com/$REPO/settings/secrets/actions"
  echo ""
  echo "Список секретов:"
  echo "  VPS_HOST           — IP вашего Frankfurt VPS"
  echo "  VPS_USER           — SSH user (обычно root)"
  echo "  VPS_SSH_KEY        — Приватный SSH-ключ (Ed25519)"
  echo "  VPS_PORT           — SSH порт (22)"
  echo "  VK_TOKEN           — Access Token сообщества VK"
  echo "  VK_GROUP_ID        — ID группы VK"
  echo "  TG_BOT_TOKEN       — Telegram Bot Token"
  echo "  TG_CHAT_ID         — Telegram Chat ID менеджера"
  echo "  GOOGLE_SA_JSON     — Google Service Account JSON (base64)"
  echo "  SPREADSHEET_ID     — ID Google-таблицы"
  echo "  BLUESALES_LOGIN    — Логин BlueSales"
  echo "  BLUESALES_PASS     — Пароль BlueSales"
  echo ""
  echo "Для GOOGLE_SA_JSON: base64 -w0 < google-service-account.json | pbcopy"
  exit 0
fi

echo "gh CLI найден. Начинаю настройку секретов..."
echo ""

# ─── VPS ──────────────────────────────────────────

read -p "VPS IP/hostname: " VPS_HOST
read -p "VPS SSH user [root]: " VPS_USER
VPS_USER=${VPS_USER:-root}
read -p "VPS SSH port [22]: " VPS_PORT
VPS_PORT=${VPS_PORT:-22}

echo ""
echo "SSH-ключ для доступа к VPS."
echo "Если ещё нет — сгенерируйте:"
echo "  ssh-keygen -t ed25519 -f ~/.ssh/vps_deploy -N ''"
echo "  ssh-copy-id -i ~/.ssh/vps_deploy.pub ${VPS_USER}@${VPS_HOST}"
echo ""
read -p "Путь к приватному SSH-ключу [~/.ssh/vps_deploy]: " SSH_KEY_PATH
SSH_KEY_PATH=${SSH_KEY_PATH:-~/.ssh/vps_deploy}

gh secret set VPS_HOST --repo "$REPO" --body "$VPS_HOST"
gh secret set VPS_USER --repo "$REPO" --body "$VPS_USER"
gh secret set VPS_PORT --repo "$REPO" --body "$VPS_PORT"
gh secret set VPS_SSH_KEY --repo "$REPO" < "$SSH_KEY_PATH"
echo "✓ VPS secrets set"

# ─── VK ───────────────────────────────────────────

echo ""
read -p "VK Community Token: " VK_TOKEN
read -p "VK Group ID: " VK_GROUP_ID

gh secret set VK_TOKEN --repo "$REPO" --body "$VK_TOKEN"
gh secret set VK_GROUP_ID --repo "$REPO" --body "$VK_GROUP_ID"
echo "✓ VK secrets set"

# ─── Telegram ────────────────────────────────────

echo ""
read -p "Telegram Bot Token: " TG_BOT_TOKEN
read -p "Telegram Manager Chat ID: " TG_CHAT_ID

gh secret set TG_BOT_TOKEN --repo "$REPO" --body "$TG_BOT_TOKEN"
gh secret set TG_CHAT_ID --repo "$REPO" --body "$TG_CHAT_ID"
echo "✓ Telegram secrets set"

# ─── Google ──────────────────────────────────────

echo ""
read -p "Путь к Google Service Account JSON: " SA_PATH
if [ -f "$SA_PATH" ]; then
  SA_BASE64=$(base64 -w0 < "$SA_PATH")
  gh secret set GOOGLE_SA_JSON --repo "$REPO" --body "$SA_BASE64"
  echo "✓ Google SA secret set (base64)"
else
  echo "! Файл не найден: $SA_PATH — пропускаю"
fi

read -p "Google Spreadsheet ID (или Enter чтобы пропустить): " SPREADSHEET_ID
if [ -n "$SPREADSHEET_ID" ]; then
  gh secret set SPREADSHEET_ID --repo "$REPO" --body "$SPREADSHEET_ID"
  echo "✓ Spreadsheet ID set"
fi

# ─── BlueSales ───────────────────────────────────

echo ""
read -p "BlueSales login (или Enter чтобы пропустить): " BS_LOGIN
if [ -n "$BS_LOGIN" ]; then
  read -p "BlueSales password: " BS_PASS
  gh secret set BLUESALES_LOGIN --repo "$REPO" --body "$BS_LOGIN"
  gh secret set BLUESALES_PASS --repo "$REPO" --body "$BS_PASS"
  echo "✓ BlueSales secrets set"
fi

echo ""
echo "============================================"
echo "  Все секреты настроены!"
echo "============================================"
echo ""
echo "Теперь сделайте push в ветку — деплой запустится автоматически."
echo "Или запустите вручную:"
echo "  gh workflow run deploy-p0.yml --repo $REPO -f action=full"
echo ""
echo "Следить за деплоем:"
echo "  gh run watch --repo $REPO"
