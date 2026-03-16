#!/bin/bash
# Hook: session-start — load context summary at session start
# Triggered by: PreToolUse (first tool call)

MEMORY_DIR="$(cd "$(dirname "$0")/../memory" && pwd)"

echo "=== Dev Memory Context ==="

for store in decisions errors patterns sessions; do
  file="$MEMORY_DIR/${store}.jsonl"
  if [ -f "$file" ]; then
    count=$(wc -l < "$file" | tr -d ' ')
    if [ "$count" -gt 0 ]; then
      echo ""
      echo "--- ${store} (${count} entries, last 3) ---"
      tail -3 "$file" | while IFS= read -r line; do
        echo "  $line"
      done
    fi
  fi
done

echo ""
echo "=== End Memory Context ==="
