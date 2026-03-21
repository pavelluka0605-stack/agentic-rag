#!/bin/bash
# =============================================================
# DEPLOY & RUN AUDIT — одна команда на VPS
# Пулит ветку, запускает аудит, сохраняет результат, пушит обратно
#
# Использование на VPS:
#   curl -sL https://raw.githubusercontent.com/pavelluka0605-stack/agentic-rag/claude/system-audit-9Hi6H/.claude/commands/scripts/deploy-audit.sh | bash
#
# Или если репо уже клонирован:
#   cd /path/to/agentic-rag && bash .claude/commands/scripts/deploy-audit.sh
# =============================================================
set -euo pipefail

BRANCH="claude/system-audit-9Hi6H"
REPO_URL="https://github.com/pavelluka0605-stack/agentic-rag.git"

echo "=============================================="
echo " DEPLOY AUDIT — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "=============================================="

# --- Find or clone repo ---
REPO_DIR=""
for dir in /opt/claude-code/workspace/agentic-rag /root/agentic-rag /home/*/agentic-rag; do
  if [ -d "$dir/.git" ]; then
    REPO_DIR="$dir"
    break
  fi
done

if [ -z "$REPO_DIR" ]; then
  echo "[INFO] Repo not found, cloning..."
  REPO_DIR="/tmp/agentic-rag-audit"
  git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  echo "[INFO] Found repo: $REPO_DIR"
  cd "$REPO_DIR"
  git fetch origin "$BRANCH" 2>/dev/null || true
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null || true
  git pull origin "$BRANCH" 2>/dev/null || true
fi

cd "$REPO_DIR"
echo "[INFO] Working dir: $(pwd)"
echo ""

# --- Run audit ---
echo "[INFO] Running system audit..."
AUDIT_OUTPUT=$(bash .claude/commands/scripts/system-audit.sh 2>&1) || true
echo "$AUDIT_OUTPUT"

# --- Save result.json ---
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
EXIT_CODE=$?

python3 -c "
import json, sys
output = sys.stdin.read()
if len(output) > 60000:
    output = output[:30000] + '\n\n... TRUNCATED ...\n\n' + output[-30000:]
result = {
    'timestamp': '$TIMESTAMP',
    'exit_code': $EXIT_CODE,
    'command': 'system-audit.sh',
    'intent': 'Full VPS system audit — security, services, configs',
    'output': output.strip()
}
with open('.claude/commands/result.json', 'w') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)
print('[INFO] Result saved to .claude/commands/result.json')
" <<< "$AUDIT_OUTPUT"

# --- Commit & push result ---
git config user.name "vps-audit[bot]" 2>/dev/null || true
git config user.email "audit@marbomebel.ru" 2>/dev/null || true

# Reset exec.json to noop
echo '{"command":"noop","intent":"audit completed"}' > .claude/commands/exec.json

git add .claude/commands/result.json .claude/commands/exec.json
git commit -m "result: VPS system audit completed [skip ci]" || echo "[WARN] Nothing to commit"

for i in 1 2 3 4; do
  git push origin "$BRANCH" && break || sleep $((i * 2))
done

echo ""
echo "=============================================="
echo " AUDIT COMPLETE — result pushed to $BRANCH"
echo "=============================================="
