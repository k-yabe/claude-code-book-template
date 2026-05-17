#!/bin/bash
# MacBook Air M3 用 task-executor セットアップスクリプト
# 実行: bash setup-executor-macair.sh

set -e

REPO_DIR="$HOME/Documents/ai-agent-workspace/ai-agent-org"
PLIST_NAME="com.kyabe.ai-agent-executor.plist"
PLIST_SRC="$REPO_DIR/scripts/mac-setup/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "=== AI Agent Executor セットアップ ==="
echo ""

# 1. Node.js の確認
if ! command -v node &>/dev/null; then
  echo "❌ Node.js が見つかりません。https://nodejs.org/ からインストールしてください。"
  exit 1
fi
NODE_PATH=$(which node)
echo "✓ Node.js: $NODE_PATH ($(node -v))"

# 2. npm install
echo ""
echo "📦 依存パッケージをインストール中..."
cd "$REPO_DIR"
npm install
echo "✓ npm install 完了"

# 3. ANTHROPIC_API_KEY の確認
echo ""
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY が未設定です。"
  read -p "APIキーを入力してください (sk-ant-...): " API_KEY
  if [ -z "$API_KEY" ]; then
    echo "❌ APIキーが空です。中断します。"
    exit 1
  fi
else
  API_KEY="$ANTHROPIC_API_KEY"
  echo "✓ ANTHROPIC_API_KEY: 設定済み"
fi

# 4. plist をコピーして APIキーと node パスを埋め込む
echo ""
echo "⚙️  launchd 設定を作成中..."
cp "$PLIST_SRC" "$PLIST_DST"
sed -i '' "s|ここにAPIキーを入れる|$API_KEY|g" "$PLIST_DST"
sed -i '' "s|/usr/local/bin/node|$NODE_PATH|g" "$PLIST_DST"
echo "✓ plist を $PLIST_DST に配置"

# 5. launchctl に登録
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "✓ launchd に登録完了（1時間ごとに自動実行）"

echo ""
echo "=== セットアップ完了 ✅ ==="
echo ""
echo "動作確認："
echo "  node $REPO_DIR/scripts/task-executor.js --dry-run"
echo ""
echo "今すぐ実行："
echo "  node $REPO_DIR/scripts/task-executor.js"
echo ""
echo "ログの確認："
echo "  tail -f ~/Library/Logs/ai-agent-executor.log"
