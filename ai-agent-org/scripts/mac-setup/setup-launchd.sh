#!/bin/bash
# AI Agent — macOS launchd 一括セットアップ
# dispatcher / standup / overnight-qa を登録する
# executor は別途 setup-executor-macair.sh を使う（APIキーが必要なため）
#
# 実行: bash scripts/mac-setup/setup-launchd.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# node のパスを確認
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "エラー: node が見つかりません。Node.jsをインストールしてください。"
    exit 1
fi

echo "=== AI Agent launchd セットアップ ==="
echo "リポジトリ: $REPO_DIR"
echo "node: $NODE_PATH ($( node -v ))"
echo ""

install_plist() {
  local name="$1"
  local src="$SCRIPT_DIR/$name.plist"
  local dst="$HOME/Library/LaunchAgents/$name.plist"

  sed \
    -e "s|REPLACE_WITH_NODE|$NODE_PATH|g" \
    -e "s|REPLACE_WITH_REPO|$REPO_DIR|g" \
    -e "s|REPLACE_WITH_HOME|$HOME|g" \
    "$src" > "$dst"

  launchctl unload "$dst" 2>/dev/null || true
  launchctl load "$dst"
  echo "✓ $name"
}

install_plist "com.kyabe.ai-agent-dispatcher"
install_plist "com.kyabe.ai-agent-standup"
install_plist "com.kyabe.ai-agent-overnight-qa"

echo ""
echo "=== セットアップ完了 ✅ ==="
echo ""
echo "スケジュール:"
echo "  dispatcher   — 5分ごと（inbox → タスク自動生成）"
echo "  standup      — 毎朝 07:00（朝会レポート生成）"
echo "  overnight-qa — 毎朝 02:00（夜間 QA チェック）"
echo ""
echo "ログ確認:"
echo "  tail -f ~/Library/Logs/ai-agent-dispatcher.log"
echo "  tail -f ~/Library/Logs/ai-agent-standup.log"
echo "  tail -f ~/Library/Logs/ai-agent-overnight-qa.log"
echo ""
echo "executor（AIタスク実行）は別途セットアップが必要:"
echo "  bash $SCRIPT_DIR/setup-executor-macair.sh"
echo ""
echo "停止する場合:"
echo "  launchctl unload ~/Library/LaunchAgents/com.kyabe.ai-agent-dispatcher.plist"
