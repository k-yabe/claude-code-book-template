# [S038] Prompt Maker v3 高性能化（永続ソース保存・ユーザー帰属・NotebookLM超え）

**ステータス**: 完了 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-30
**完了日**: 2026-03-31

---

## 目的

Prompt MakerをNotebookLMを超える高性能ツールに進化させる。ソースをサーバーサイド（Vercel KV）で永続保存し、キャッシュクリアしてもデータが失われないようにする。誰がソースを追加したかを記録し、チーム全体でソースを共有できるようにする。

---

## スコープ

### やること
- [x]Vercel KV によるソースのサーバーサイド永続保存
- [x]`/api/sources.js` CRUD API（一覧取得・追加・削除）
- [x]ソース追加者のユーザー名を記録・表示
- [x]URL追加時に `/api/fetch-article.js` で実コンテンツを自動取得
- [x]ソースの全文展開・折りたたみ表示
- [x]ソース検索・フィルタ
- [x]チーム共有（全ユーザーのソースを閲覧可能）
- [x]localStorage フォールバック（KV未設定時）
- [x]`package.json` に `@vercel/kv` 追加
- [x]`vercel.json` にAPI設定追加
- [x]`index.html` WHAT'S NEW 更新
- [x]`docs/design.md` 更新

### やらないこと（スコープ外）
- ファイルアップロード（PDF・画像）
- ソースの編集機能（削除→再追加で対応）
- リアルタイム同期（リロードで最新化）

---

## 完了条件

- [x]ソースがサーバーサイドに永続保存され、キャッシュクリア後も復元される
- [x]各ソースに追加者のユーザー名が表示される
- [x]URL追加時に実コンテンツが自動取得される
- [x]チーム全員のソースが一覧で閲覧可能
- [x]KV未設定時はlocalStorageにフォールバックする
- [x]index.html の WHAT'S NEW が更新されている
- [x]docs/design.md が最新化されている

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/prompt-maker/index.html` | 変更 |
| `api/sources.js` | 新規 |
| `package.json` | 変更 |
| `vercel.json` | 変更 |
| `index.html` | 変更 |
| `docs/design.md` | 変更 |

---

## 参照

- `steering/S037-PromptMaker-NotebookLM風リニューアル.md` — v2実装
- `api/fetch-article.js` — URL本文取得API（再利用）

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
