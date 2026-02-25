# [S004] PR マージ時に /done を自動実行する GitHub Actions

**ステータス**: 完了
**作成日**: 2026-02-25
**完了日**: 2026-02-25

---

## 目的

PR が main にマージされたとき、GitHub Actions がヘッドレスモードで `claude -p` を実行し、対応するステアリングファイルを自動的に「完了」に更新する。

---

## スコープ

### やること
- [ ] `.github/workflows/auto-done.yml` を新規作成する
  - トリガー: `pull_request` が `main` にマージされたとき
  - PR タイトルから S番号を抽出（例: `[S004] 機能名` → `S004`）
  - `claude -p "/done S###"` をヘッドレスで実行

### やらないこと（スコープ外）
- Slack 通知との連携
- S番号が取得できない場合の自動推定
- `new-spec` / `review` の自動化

---

## 完了条件

- [ ] `.github/workflows/auto-done.yml` が作成されている
- [ ] PR タイトルに `[S###]` が含まれる場合のみ発火する
- [ ] `ANTHROPIC_API_KEY` を GitHub Secrets から参照している

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `.github/workflows/auto-done.yml` | 新規 |

---

## 参照

- `steering/S003-done-subagent.md` — /done コマンドの設計
- `.claude/commands/done.md` — 実行するコマンド定義

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
