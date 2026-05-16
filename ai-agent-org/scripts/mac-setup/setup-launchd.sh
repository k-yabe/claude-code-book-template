#!/bin/bash
# AI Agent Dispatcher - macOS自動実行セットアップ
# 使い方: bash scripts/mac-setup/setup-launchd.sh

set -e

REPO_PATH="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_SRC="$REPO_PATH/scripts/mac-setup/com.kyabe.ai-agent-dispatcher.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.kyabe.ai-agent-dispatcher.plist"

# node のパスを確認
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "エラー: node が見つかりません。Node.jsをインストールしてください。"
    exit 1
fi

echo "リポジトリパス: $REPO_PATH"
echo "node パス: $NODE_PATH"

# plist をコピーして REPLACE_WITH_REPO_PATH を実際のパスに置換
sed \
    -e "s|REPLACE_WITH_REPO_PATH|$REPO_PATH|g" \
    -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    "$PLIST_SRC" > "$PLIST_DEST"

echo "plist を設置: $PLIST_DEST"

# 既存のジョブをアンロード（エラーは無視）
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# ロード
launchctl load "$PLIST_DEST"

echo ""
echo "✅ セットアップ完了！"
echo "   inboxに .md ファイルを入れると、5分以内に自動でタスク化されます。"
echo ""
echo "ログ確認: tail -f $REPO_PATH/ai-agent-org/scripts/mac-setup/dispatcher.log"
echo "停止する場合: launchctl unload $PLIST_DEST"
