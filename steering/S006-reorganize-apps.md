# [S006] アプリフォルダへの整理

**ステータス**: 進行中
**作成日**: 2026-02-25
**完了日**: —

---

## 目的

ルートに散在しているアプリファイルを `apps/` フォルダに整理し、`index.html` をアプリ一覧ページに作り替える。

---

## スコープ

### やること
- [ ] `apps/breakout/` を作成し `index.html` + `main.js` を移動
- [ ] `tetris.html` / `counter.html` / `planner.html` を `apps/` に移動
- [ ] ルートの `index.html` をアプリ一覧ランディングページに作り替える

### やらないこと（スコープ外）
- アプリ内部のロジック変更
- デザインの大幅な変更

---

## 完了条件

- [ ] 各アプリが新しいパスで正常に動作する
- [ ] ルートの `index.html` から各アプリにリンクできる
- [ ] `git mv` でファイル履歴を保持する

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/breakout/index.html` | 移動（旧 `index.html`） |
| `apps/breakout/main.js` | 移動（旧 `main.js`） |
| `apps/tetris.html` | 移動 |
| `apps/counter.html` | 移動 |
| `apps/planner.html` | 移動 |
| `index.html` | 作り替え（アプリ一覧ページ） |

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
