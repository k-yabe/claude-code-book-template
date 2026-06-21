# [S096] ROI / ROAS Simulator — 画像/スクショ・画像PDFの vision 読み取り

**ステータス**: 完了
**作成日**: 2026-06-21
**完了日**: 2026-06-21

---

## 目的

「予算・料金の数字が PDF の中にスクリーンショット画像として貼ってある」「料金表のスクショ画像はあるが従来は読めない」という声に対応し、画像を AI が“見て”読み取れるようにする。

## スコープ
- [x] 画像ファイル（PNG/JPG/JPEG/WEBP/GIF）を直接アップロード → vision 読み取り
- [x] PDF はテキストから予算・流入が取れない場合、ページを画像化して vision で再読み取り（フォールバック）
- [x] `callAI(content, tokens)` ヘルパーに fetch を集約しマルチモーダル対応
- [x] `ACCEPTED_EXTS`・`<input accept>`・import-desc の文言を画像対応に更新
- [x] 0件時のエラーメッセージを `usedVision` で切り分け
- [x] テキスト抽出パス（既存モック fetch テスト）を温存／回帰テストに vision パス追加

## 完了条件
- [x] 画像アップロードがマルチモーダル配列（image パート）で送られ、値が反映される
- [x] PDF のテキストで数値が取れないとき自動で画像化フォールバックする
- [x] `npm run test:roi` 全 pass（138）

## 影響ファイル
| ファイル | 変更種別 |
|---------|---------|
| `apps/roi-roas-simulator/index.html` | 変更 |
| `tests/roi-roas-simulator.e2e.js` | 変更（8f 追加） |
| `index.html`（WHAT'S NEW） | 変更 |
| `docs/design.md` | 変更（S096） |
| `steering/S096-ROI-ROAS-Simulator-画像とスクショのvision読み取り.md` | 新規 |

## 参照
- ユーザー報告（本セッション）: 「PDFの中に貼ってある」「スクショの画像はあるんだけど、それだと厳しいのか」
- `api/generate.js`（Anthropic 透過プロキシ・vision コンテンツブロック対応を確認）
- `steering/S082`〜`S095`

## 作業ログ
- 2026-06-21: `analyzeDocument` をマルチモーダル対応に再設計。`callAI` ヘルパー集約、`isImageFile`/`readImagePart`/`renderPdfToImages` を配線。画像直アップロードと PDF 画像化フォールバック（`hasData` 判定）を追加。`ACCEPTED_EXTS`・accept・import-desc・0件エラーを更新。回帰テスト 8f（画像 vision パス）を追加し 138 全 pass。実機目視はサンドボックス制限のため Vercel デプロイ後確認。
