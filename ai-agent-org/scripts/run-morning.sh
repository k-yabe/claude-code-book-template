#!/bin/bash
# 朝会スクリプト — 朝7時にlaunchdから自動実行
# 1. inboxのファイルをタスクに変換（task-dispatcher）
# 2. 朝会レポートを生成（morning-standup）

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$REPO_DIR/logs/morning-$(date +%Y-%m-%d).log"

mkdir -p "$REPO_DIR/logs"

{
  echo "=== 朝会開始: $(date '+%Y-%m-%d %H:%M:%S') ==="

  cd "$REPO_DIR" || exit 1
  git stash --quiet 2>/dev/null
  git pull origin main --quiet 2>/dev/null

  echo "--- inbox処理（task-dispatcher）---"
  node scripts/task-dispatcher.js

  echo "--- 朝会レポート生成（morning-standup）---"
  node scripts/morning-standup.js

  echo "=== 朝会完了: $(date '+%Y-%m-%d %H:%M:%S') ==="
} >> "$LOG_FILE" 2>&1
