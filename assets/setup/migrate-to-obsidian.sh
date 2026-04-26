#!/usr/bin/env bash
# =====================================================================
# AI Daily の出力先を Obsidian Vault に移行する (macOS)
# =====================================================================
# 使い方:
#
#   # ローカルで:
#   ./assets/setup/migrate-to-obsidian.sh ~/Obsidian/MyVault
#
#   # ワンライナーで:
#   curl -fsSL https://raw.githubusercontent.com/k-yabe/claude-code-book-template/main/assets/setup/migrate-to-obsidian.sh \
#     | bash -s -- ~/Obsidian/MyVault
#
# やること:
#   1. Vault パスの存在確認
#   2. ~/Documents/AI_Daily/ の既存ファイルを <Vault>/AI_Daily/ にコピー
#   3. ~/.claude/skills/daily-watch/SKILL.md の出力先を書き換え
#   4. ~/Library/LaunchAgents/com.kunito.daily-watch.plist は触らない
#      （SKILL.md 側で出力先を制御するため、launchd 設定の変更は不要）
#   5. launchd を unload → load して新しい SKILL.md を反映
#
# 冪等: 既存ファイルは .bak.YYYYMMDD-HHMMSS に退避してから上書き
# =====================================================================

set -euo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
NAVY=$'\033[38;5;24m'; GOLD=$'\033[38;5;220m'; RED=$'\033[31m'; GREEN=$'\033[32m'

log()  { printf "${NAVY}${BOLD}▸${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn() { printf "${GOLD}⚠${RESET} %s\n" "$*"; }
err()  { printf "${RED}✗${RESET} %s\n" "$*" >&2; }
hr()   { printf "${DIM}%s${RESET}\n" "────────────────────────────────────────────────────────────"; }

# --- 引数チェック ---------------------------------------------------
if [[ $# -lt 1 || -z "${1:-}" ]]; then
    err "Vault パスを引数で指定してください"
    err "  例: $0 ~/Obsidian/MyVault"
    exit 1
fi

VAULT="${1%/}"  # 末尾のスラッシュを除去
# tilde 展開（コマンド置換ではなく eval で安全に）
VAULT="$(cd "${VAULT/#\~/$HOME}" 2>/dev/null && pwd)" || {
    err "Vault パスが存在しないか、ディレクトリではありません: $1"
    exit 1
}

OLD_DOCS="${HOME}/Documents/AI_Daily"
NEW_DOCS="${VAULT}/AI_Daily"
SKILL_PATH="${HOME}/.claude/skills/daily-watch/SKILL.md"
PLIST_NAME="com.kunito.daily-watch"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_NAME}.plist"

# --- Preflight ------------------------------------------------------
hr
log "Preflight チェック"
hr

if [[ "$(uname -s)" != "Darwin" ]]; then
    err "このスクリプトは macOS 専用です"
    exit 1
fi
ok "macOS 環境を検出"

if [[ ! -f "${SKILL_PATH}" ]]; then
    err "${SKILL_PATH} が存在しません。先に bootstrap.sh を実行してください。"
    exit 1
fi
ok "SKILL.md 検出: ${SKILL_PATH}"

ok "Vault: ${VAULT}"
ok "新しい出力先: ${NEW_DOCS}"

# --- 既存ファイルを Vault にコピー ----------------------------------
hr
log "既存の AI Daily ファイルを Vault にコピー"
hr

mkdir -p "${NEW_DOCS}"

if [[ -d "${OLD_DOCS}" ]]; then
    COPIED=0
    # md ファイルと last_snapshot.json をコピー
    for src in "${OLD_DOCS}"/*.md "${OLD_DOCS}"/last_snapshot.json; do
        [[ -e "${src}" ]] || continue
        basename="$(basename "${src}")"
        dst="${NEW_DOCS}/${basename}"
        if [[ -e "${dst}" ]]; then
            cp "${dst}" "${dst}.bak.$(date +%Y%m%d-%H%M%S)"
            warn "既存 ${basename} を退避"
        fi
        cp -p "${src}" "${dst}"
        COPIED=$((COPIED + 1))
    done
    ok "${COPIED} ファイルを ${NEW_DOCS} にコピー"
else
    warn "${OLD_DOCS} が存在しません（新規 setup として続行）"
fi

# --- SKILL.md の出力先を書き換え -----------------------------------
hr
log "SKILL.md の出力先を Vault に書き換え"
hr

cp "${SKILL_PATH}" "${SKILL_PATH}.bak.$(date +%Y%m%d-%H%M%S)"
ok "SKILL.md を退避"

# `~/Documents/AI_Daily` を全て新しい Vault パスに置換
# Vault パスに $HOME を含める形で sed する（plist と同じ規約）
# sed の区切り文字を | に変えてスラッシュを安全に通す
ESCAPED_NEW="${NEW_DOCS}"
sed -i '' "s|~/Documents/AI_Daily|${ESCAPED_NEW}|g" "${SKILL_PATH}"
sed -i '' "s|\$HOME/Documents/AI_Daily|${ESCAPED_NEW}|g" "${SKILL_PATH}"
ok "SKILL.md の出力先を ${NEW_DOCS} に変更"

# --- launchd の reload ---------------------------------------------
hr
log "launchd を reload して反映"
hr

if [[ -f "${PLIST_PATH}" ]]; then
    if launchctl list | grep -q "${PLIST_NAME}"; then
        launchctl unload "${PLIST_PATH}" 2>/dev/null || true
        ok "${PLIST_NAME} を unload"
    fi
    launchctl load "${PLIST_PATH}"
    if launchctl list | grep -q "${PLIST_NAME}"; then
        ok "${PLIST_NAME} を load し直し"
    else
        err "launchctl load に失敗"
        exit 1
    fi
else
    warn "${PLIST_PATH} が存在しません。bootstrap.sh を未実行の可能性"
fi

# --- 完了案内 -------------------------------------------------------
hr
printf "${GREEN}${BOLD}✓ Obsidian Vault への移行完了${RESET}\n"
hr
cat <<EOF
${BOLD}新しい出力先:${RESET} ${NEW_DOCS}/
${BOLD}SKILL.md:${RESET}     ${SKILL_PATH}（${DIM}.bak で退避済み${RESET}）

${BOLD}次回起動から${RESET} ${NEW_DOCS}/YYYY-MM-DD.md に出力されます。

${BOLD}即時確認:${RESET}
  ${DIM}launchctl start ${PLIST_NAME}${RESET}
  ${DIM}ls -la ${NEW_DOCS}/${RESET}

${BOLD}元の ${OLD_DOCS} は残しています。${RESET}
削除する場合は手動で:
  ${DIM}rm -rf ${OLD_DOCS}${RESET}
EOF
