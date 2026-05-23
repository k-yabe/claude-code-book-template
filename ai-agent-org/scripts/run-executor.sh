#!/bin/bash
# executor の自動実行ラッパー
# launchd から呼び出され、毎回最新コードを pull してから実行する

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_DIR" || exit 1

# ローカルの変更を退避して最新を取得
git stash --quiet 2>/dev/null
git pull origin main --quiet 2>/dev/null

# executor を実行
node scripts/task-executor.js
