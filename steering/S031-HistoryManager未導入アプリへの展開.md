# [S031] HistoryManager 未導入アプリへの展開

**ステータス**: 進行中 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-22
**完了日**: —

---

## 目的

`marketo-mail-generator` `ogp-checker` `banner-resizer` の3アプリに HistoryManager を導入し、生成結果の履歴機能を追加する。

---

## スコープ

### やること
- [ ] `apps/marketo-mail-generator/index.html` に HistoryManager を導入（`HistoryManager.init()` + `HistoryManager.save()`）
- [ ] `apps/ogp-checker/index.html` に HistoryManager を導入
- [ ] `apps/banner-resizer/index.html` に HistoryManager を導入
- [ ] 各アプリで適切な `input`（検索キーやURL）と `output`（生成結果）を保存

### やらないこと（スコープ外）
- `history.js` 本体の変更
- banner-resizer は画像出力のためoutputにはファイル名やサイズ情報のテキストを保存

---

## 完了条件

- [ ] 3アプリのナビバーに「📋 履歴」ボタンが表示される
- [ ] 各アプリで生成・処理を行うと履歴に保存される
- [ ] 履歴からコピーが正常に動作する

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/marketo-mail-generator/index.html` | 変更 |
| `apps/ogp-checker/index.html` | 変更 |
| `apps/banner-resizer/index.html` | 変更 |

---

## 参照

- `docs/design.md` — 各アプリセクション
- `assets/history.js` — HistoryManager 実装

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
