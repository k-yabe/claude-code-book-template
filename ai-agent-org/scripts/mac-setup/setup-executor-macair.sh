#!/bin/bash
# MacBook Air M3 用 AI Agent セットアップスクリプト
# 実行: bash scripts/mac-setup/setup-executor-macair.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LAUNCHAGENTS="$HOME/Library/LaunchAgents"

echo "=== AI Agent セットアップ ==="
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

# 4. Obsidian Vault パスの確認
echo ""
# OneDrive 経由検出（個人用・法人用の両パターン）
for ONEDRIVE_BASE in \
    "$HOME/Library/CloudStorage/OneDrive-個人用" \
    "$HOME/Library/CloudStorage/OneDrive-Personal" \
    "$HOME/OneDrive - 個人用" \
    "$HOME/OneDrive"; do
  if [ -d "$ONEDRIVE_BASE" ]; then
    FIRST_VAULT=$(find "$ONEDRIVE_BASE" -maxdepth 4 -name ".obsidian" -type d 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
    if [ -n "$FIRST_VAULT" ]; then
      DEFAULT_VAULT="$FIRST_VAULT"
      break
    fi
  fi
done
# iCloud 経由検出
if [ -z "$DEFAULT_VAULT" ]; then
  ICLOUD_OBS="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents"
  if [ -d "$ICLOUD_OBS" ]; then
    FIRST_VAULT=$(ls -d "$ICLOUD_OBS"/*/ 2>/dev/null | head -1)
    [ -n "$FIRST_VAULT" ] && DEFAULT_VAULT="${FIRST_VAULT%/}"
  fi
fi
# ~/Obsidian 検出
if [ -z "$DEFAULT_VAULT" ] && [ -d "$HOME/Obsidian" ]; then
  FIRST_VAULT=$(ls -d "$HOME/Obsidian"/*/ 2>/dev/null | head -1)
  [ -n "$FIRST_VAULT" ] && DEFAULT_VAULT="${FIRST_VAULT%/}"
fi
# ~/Documents/Obsidian 検出
if [ -z "$DEFAULT_VAULT" ] && [ -d "$HOME/Documents/Obsidian" ]; then
  FIRST_VAULT=$(ls -d "$HOME/Documents/Obsidian"/*/ 2>/dev/null | head -1)
  [ -n "$FIRST_VAULT" ] && DEFAULT_VAULT="${FIRST_VAULT%/}"
fi

if [ -n "$DEFAULT_VAULT" ]; then
  echo "✓ Obsidian Vault を検出: $DEFAULT_VAULT"
  VAULT_PATH="$DEFAULT_VAULT"
else
  echo "⚠️  Obsidian Vault が自動検出できませんでした。"
  read -p "Vault のパスを入力してください (空白でスキップ): " VAULT_PATH
fi

# 5. executor plist 作成
echo ""
echo "⚙️  launchd 設定を作成中..."
EXECUTOR_PLIST="$LAUNCHAGENTS/com.kyabe.ai-agent-executor.plist"
sed \
  -e "s|REPLACE_WITH_NODE|$NODE_PATH|g" \
  -e "s|REPLACE_WITH_REPO|$REPO_DIR|g" \
  -e "s|REPLACE_WITH_API_KEY|$API_KEY|g" \
  -e "s|REPLACE_WITH_HOME|$HOME|g" \
  "$SCRIPT_DIR/com.kyabe.ai-agent-executor.plist" > "$EXECUTOR_PLIST"
echo "✓ executor plist 作成"

# 6. obsidian-sync plist 作成（Vault が設定されている場合のみ）
if [ -n "$VAULT_PATH" ]; then
  SYNC_PLIST="$LAUNCHAGENTS/com.kyabe.ai-agent-obsidian-sync.plist"
  sed \
    -e "s|REPLACE_WITH_NODE|$NODE_PATH|g" \
    -e "s|REPLACE_WITH_REPO|$REPO_DIR|g" \
    -e "s|REPLACE_WITH_HOME|$HOME|g" \
    "$SCRIPT_DIR/com.kyabe.ai-agent-obsidian-sync.plist" \
    | sed "s|</dict>|  <key>OBSIDIAN_VAULT_PATH</key>\n  <string>$VAULT_PATH</string>\n</dict>|" \
    > "$SYNC_PLIST"
  echo "✓ obsidian-sync plist 作成 (vault: $VAULT_PATH)"
fi

# 7. launchctl に登録
for PLIST in "$EXECUTOR_PLIST" ${SYNC_PLIST:+"$SYNC_PLIST"}; do
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "✓ 登録: $(basename $PLIST)"
done

echo ""
echo "=== セットアップ完了 ✅ ==="
echo ""
echo "動作確認:"
echo "  node $REPO_DIR/scripts/task-executor.js --dry-run"
[ -n "$VAULT_PATH" ] && echo "  node $REPO_DIR/scripts/obsidian-sync.js --dry-run"
echo ""
echo "今すぐ実行:"
echo "  node $REPO_DIR/scripts/task-executor.js"
[ -n "$VAULT_PATH" ] && echo "  node $REPO_DIR/scripts/obsidian-sync.js"
echo ""
echo "ログの確認:"
echo "  tail -f $HOME/Library/Logs/ai-agent-executor.log"
[ -n "$VAULT_PATH" ] && echo "  tail -f $HOME/Library/Logs/ai-agent-obsidian-sync.log"
echo ""
echo "停止する場合:"
echo "  launchctl unload $EXECUTOR_PLIST"
