#!/usr/bin/env bash
# =====================================================================
# AI情報収集の自動化 — ワンショット・ブートストラップ (macOS)
# =====================================================================
# 実行方法 (Mac の Terminal にこの 1 行を貼るだけ):
#
#   curl -fsSL https://raw.githubusercontent.com/k-yabe/claude-code-book-template/main/assets/setup/bootstrap.sh | bash
#
# やること:
#   Phase 1: /last30days プラグインを Claude Code に install
#   Phase 2: daily-watch スキルを ~/.claude/skills/ に設置
#   Phase 2: launchd plist を ~/Library/LaunchAgents/ に設置 + 即時実行テスト
#
# 冪等: 既存設定がある場合は backup → 上書き → reload する
# =====================================================================

set -euo pipefail

# --- 色付きログ -----------------------------------------------------
BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
NAVY=$'\033[38;5;24m'; GOLD=$'\033[38;5;220m'; RED=$'\033[31m'; GREEN=$'\033[32m'

log()  { printf "${NAVY}${BOLD}▸${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn() { printf "${GOLD}⚠${RESET} %s\n" "$*"; }
err()  { printf "${RED}✗${RESET} %s\n" "$*" >&2; }
hr()   { printf "${DIM}%s${RESET}\n" "────────────────────────────────────────────────────────────"; }

REPO_RAW="https://raw.githubusercontent.com/k-yabe/claude-code-book-template/main"
SKILL_URL="${REPO_RAW}/assets/setup/daily-watch/SKILL.md"
PLIST_URL="${REPO_RAW}/assets/setup/launchd/com.kunito.daily-watch.plist"

SKILL_DIR="${HOME}/.claude/skills/daily-watch"
SKILL_PATH="${SKILL_DIR}/SKILL.md"
DOCS_DIR="${HOME}/Documents/AI_Daily"
PLIST_NAME="com.kunito.daily-watch"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG_OUT="/tmp/daily-watch.log"
LOG_ERR="/tmp/daily-watch.error.log"
TODAY="$(date +%Y-%m-%d)"

# --- Preflight ------------------------------------------------------
hr
log "Preflight チェック"
hr

if [[ "$(uname -s)" != "Darwin" ]]; then
    err "このスクリプトは macOS 専用です（現在: $(uname -s)）"
    exit 1
fi
ok "macOS 環境を検出"

if ! command -v claude >/dev/null 2>&1; then
    err "claude コマンドが見つかりません。Claude Code をインストールしてから再実行してください。"
    err "  npm i -g @anthropic-ai/claude-code"
    exit 1
fi
CLAUDE_PATH="$(command -v claude)"
ok "claude バイナリ: ${CLAUDE_PATH}"

CLAUDE_VERSION_RAW="$(claude --version 2>/dev/null | head -1 || true)"
CLAUDE_MAJOR="$(printf '%s' "${CLAUDE_VERSION_RAW}" | grep -oE '[0-9]+' | head -1 || echo 0)"
if [[ -z "${CLAUDE_MAJOR}" || "${CLAUDE_MAJOR}" -lt 1 ]]; then
    err "Claude Code は 1.0 以上が必要です（現在: ${CLAUDE_VERSION_RAW:-unknown}）"
    err "  npm i -g @anthropic-ai/claude-code でアップデートしてください"
    exit 1
fi
ok "Claude Code バージョン: ${CLAUDE_VERSION_RAW}"

if ! command -v curl >/dev/null 2>&1; then
    err "curl が見つかりません。"
    exit 1
fi
ok "curl 利用可能"

# --- Phase 1: /last30days プラグイン -------------------------------
hr
log "Phase 1: /last30days プラグインの install"
hr

# Claude Code の slash command を headless モードから実行する。
# プラグイン install が既に完了していてもエラーにならず通過する想定。
PHASE1_OK=true
if claude -p "/plugin marketplace add mvanhorn/last30days-skill" >/tmp/last30days-marketplace.log 2>&1; then
    ok "marketplace 登録完了"
else
    warn "marketplace 登録の自動実行に失敗（既に登録済みの可能性あり）"
    PHASE1_OK=false
fi

if claude -p "/plugin install last30days@last30days-skill" >/tmp/last30days-install.log 2>&1; then
    ok "プラグイン install 完了"
else
    warn "プラグイン install の自動実行に失敗（既に install 済み or headless 非対応の可能性）"
    PHASE1_OK=false
fi

if [[ "${PHASE1_OK}" != "true" ]]; then
    cat <<EOF
${GOLD}${BOLD}手動で 1 度だけ以下を実行してください（既に done なら skip 可）:${RESET}
   ${BOLD}claude${RESET}                                             # 対話モード起動
   /plugin marketplace add mvanhorn/last30days-skill
   /plugin install last30days@last30days-skill
   /last30days Claude Code skills                  # 動作確認
EOF
fi

# --- Phase 2: daily-watch スキル設置 -------------------------------
hr
log "Phase 2: daily-watch スキルを設置"
hr

mkdir -p "${SKILL_DIR}"
mkdir -p "${DOCS_DIR}"
ok "ディレクトリ準備完了: ${SKILL_DIR}, ${DOCS_DIR}"

if [[ -f "${SKILL_PATH}" ]]; then
    BACKUP="${SKILL_PATH}.bak.$(date +%Y%m%d-%H%M%S)"
    cp "${SKILL_PATH}" "${BACKUP}"
    warn "既存 SKILL.md を ${BACKUP} に退避"
fi

if curl -fsSL "${SKILL_URL}" -o "${SKILL_PATH}"; then
    ok "SKILL.md 取得 → ${SKILL_PATH}"
else
    err "SKILL.md の取得に失敗: ${SKILL_URL}"
    exit 1
fi

# --- Phase 2: 動作テスト (launchd 登録前) ---------------------------
hr
log "Phase 2: daily-watch スキルの動作テスト"
hr

if claude -p "use the daily-watch skill" >/tmp/daily-watch.bootstrap.log 2>&1; then
    ok "スキル起動成功"
else
    warn "スキル起動が non-zero で終了（出力は /tmp/daily-watch.bootstrap.log を確認）"
fi

if [[ -f "${DOCS_DIR}/${TODAY}.md" ]]; then
    ok "本日のレポート生成を確認: ${DOCS_DIR}/${TODAY}.md"
else
    warn "本日のレポートがまだありません（朝7時の自動実行で生成される想定）"
fi

# --- Phase 2: launchd plist 設置 -----------------------------------
hr
log "Phase 2: launchd plist を設置"
hr

mkdir -p "${HOME}/Library/LaunchAgents"

# 既存 LaunchAgent をアンロード（無くてもエラー無視）
if launchctl list | grep -q "${PLIST_NAME}"; then
    launchctl unload "${PLIST_PATH}" 2>/dev/null || true
    warn "既存の ${PLIST_NAME} を unload"
fi

if [[ -f "${PLIST_PATH}" ]]; then
    BACKUP_PLIST="${PLIST_PATH}.bak.$(date +%Y%m%d-%H%M%S)"
    cp "${PLIST_PATH}" "${BACKUP_PLIST}"
    warn "既存 plist を ${BACKUP_PLIST} に退避"
fi

# テンプレートを取得 → __CLAUDE_PATH__ を実パスに置換
TMP_PLIST="$(mktemp -t daily-watch-plist.XXXXXX)"
if curl -fsSL "${PLIST_URL}" -o "${TMP_PLIST}"; then
    ok "plist テンプレート取得"
else
    err "plist テンプレートの取得に失敗: ${PLIST_URL}"
    exit 1
fi

# sed エスケープ（パスに / が含まれるので区切りを | に変える）
sed "s|__CLAUDE_PATH__|${CLAUDE_PATH}|g" "${TMP_PLIST}" > "${PLIST_PATH}"
rm -f "${TMP_PLIST}"
ok "plist を ${PLIST_PATH} に書き出し（claude path: ${CLAUDE_PATH}）"

# 構文検証
if plutil -lint "${PLIST_PATH}" >/dev/null 2>&1; then
    ok "plist 構文 OK"
else
    err "plist の構文エラー。${PLIST_PATH} を確認してください"
    plutil -lint "${PLIST_PATH}" || true
    exit 1
fi

# 登録
launchctl load "${PLIST_PATH}"
if launchctl list | grep -q "${PLIST_NAME}"; then
    ok "launchctl に ${PLIST_NAME} を登録"
else
    err "launchctl 登録の検証に失敗"
    exit 1
fi

# 即時実行
launchctl start "${PLIST_NAME}"
ok "即時実行をキック"

# --- 検証 -----------------------------------------------------------
hr
log "検証"
hr

# launchd の出力を最大 30 秒待つ
WAIT_SEC=0
while [[ ${WAIT_SEC} -lt 30 ]]; do
    if [[ -s "${LOG_OUT}" ]] || [[ -s "${LOG_ERR}" ]] || [[ -f "${DOCS_DIR}/${TODAY}.md" ]]; then
        break
    fi
    sleep 2
    WAIT_SEC=$((WAIT_SEC + 2))
done

if [[ -f "${DOCS_DIR}/${TODAY}.md" ]]; then
    ok "${DOCS_DIR}/${TODAY}.md が生成されています"
else
    warn "${DOCS_DIR}/${TODAY}.md がまだありません（launchd 実行が継続中の可能性）"
fi

if [[ -s "${LOG_ERR}" ]]; then
    warn "標準エラーに出力あり: ${LOG_ERR}"
    tail -20 "${LOG_ERR}" | sed 's/^/    /'
fi

# --- 完了 -----------------------------------------------------------
hr
printf "${GREEN}${BOLD}✓ セットアップ完了${RESET}\n"
hr
cat <<EOF
${BOLD}成果物:${RESET}
  • Skill:     ${SKILL_PATH}
  • LaunchD:   ${PLIST_PATH}
  • 出力先:    ${DOCS_DIR}/
  • Logs:      ${LOG_OUT} / ${LOG_ERR}

${BOLD}日次運用:${RESET}
  毎朝 ${BOLD}07:00 (JST)${RESET} に launchd が daily-watch スキルを起動し、
  新着があれば ${BOLD}${DOCS_DIR}/YYYY-MM-DD.md${RESET} を更新します。

${BOLD}使える場所（~/.claude/ 共有）:${RESET}
  • ${BOLD}CLI${RESET}           ${DIM}claude > /last30days <query>${RESET}
  • ${BOLD}デスクトップアプリ${RESET} ${DIM}/ メニュー → last30days / daily-watch${RESET}
  • ${BOLD}VS Code 拡張${RESET}    ${DIM}コマンドパレット経由で同じスキル${RESET}
  • ${BOLD}JetBrains プラグイン${RESET}
  install は 1 回のみ。すべての入り口で同じスキル・プラグインが使えます。

${BOLD}Tips:${RESET}
  • 即時実行:       ${DIM}launchctl start ${PLIST_NAME}${RESET}
  • 停止:           ${DIM}launchctl unload ${PLIST_PATH}${RESET}
  • 巡回先の編集:   ${DIM}\$EDITOR ${SKILL_PATH}${RESET}
  • Mac がスリープ中は実行されません: ${DIM}sudo pmset repeat wakeorpoweron MTWRFSU 06:55:00${RESET}
EOF
