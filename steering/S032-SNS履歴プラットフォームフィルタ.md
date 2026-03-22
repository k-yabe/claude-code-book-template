# [S032] SNS Post Generator 履歴プラットフォームフィルタ

**ステータス**: 進行中 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-22
**完了日**: —

---

## 目的

履歴パネルに Chatter / LinkedIn / X のフィルタタブを追加し、プラットフォーム別に履歴を絞り込めるようにする。生成件数が増えると混在して見づらくなるため。

---

## スコープ

### やること
- [ ] `apps/sns-post-generator/index.html` の `HistoryManager.save()` にプラットフォーム情報を `meta.platform` として追加
- [ ] `assets/history.js` の `openPanel()` にフィルタタブ（全て / Chatter / LinkedIn / X）を追加
- [ ] フィルタタブはSNS Post Generator のみ表示（`meta.platform` が存在するエントリがある場合のみ）
- [ ] フィルタ状態はパネルを閉じると初期化（「全て」に戻る）

### やらないこと（スコープ外）
- フィルタ状態の永続化
- 他アプリへのフィルタ機能追加

---

## 完了条件

- [ ] 履歴パネルに「全て / Chatter / LinkedIn / X」タブが表示される
- [ ] タブ選択でそのプラットフォームの履歴のみ表示される
- [ ] 「全て」タブは全履歴を表示
- [ ] プラットフォーム情報がないエントリは「全て」タブにのみ表示

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `assets/history.js` | 変更 |
| `apps/sns-post-generator/index.html` | 変更 |

---

## 参照

- `docs/design.md` — SNS Post Generator セクション
- `steering/S028` / `S029` — 前回の履歴改善

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
