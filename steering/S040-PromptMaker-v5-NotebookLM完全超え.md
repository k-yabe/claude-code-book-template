# [S040] Prompt Maker v5 NotebookLM完全超え（PDF対応・引用表示・YouTube対応）

**ステータス**: 進行中 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-31
**完了日**: —

---

## 目的

Prompt MakerをNotebookLMと実用面で同等以上にするため、3つの重要機能を追加する。
1. PDFファイルをソースとして追加（pdf.jsによるクライアントサイドテキスト抽出）
2. チャット回答にソース引用番号をインライン表示（クリックでソースハイライト）
3. YouTube URLから字幕テキストを自動抽出してソースに追加

---

## スコープ

### やること

#### 1. PDFソース対応
- [ ] pdf.js CDN読み込み（Slide Makerと同じバージョン）
- [ ] ファイル選択UI（ソース追加タブに「PDF」追加）
- [ ] クライアントサイドPDFテキスト抽出（最大50ページ、15000文字）
- [ ] 抽出テキストをソースとして追加（type: 'pdf'）

#### 2. 引用・出典表示
- [ ] SYSTEM_PROMPTに引用ルール追加（回答時に[ソース1]等の引用マーカーを付与）
- [ ] addBubble()でインライン引用マーカーをクリッカブルに変換
- [ ] クリック時に左ペインの該当ソースをハイライト＆スクロール
- [ ] 引用マーカーのCSS（小さなバッジスタイル）

#### 3. YouTube URL対応
- [ ] URLがYouTubeの場合を自動検出（正規表現）
- [ ] /api/fetch-transcript.js 新規作成（YouTube字幕取得API）
- [ ] 字幕テキストをソースとして追加（type: 'youtube'）
- [ ] ソースタイプ表示にYOUTUBEバッジ追加

#### 4. その他
- [ ] `index.html` WHAT'S NEW 更新
- [ ] `docs/design.md` 更新

### やらないこと（スコープ外）
- Google Docs/Slides連携
- Audio Overview（ポッドキャスト生成）
- 画像OCR

---

## 完了条件

- [ ] PDFファイルをソースとして追加でき、テキストが抽出されている
- [ ] チャット回答に引用マーカーが表示され、クリックで該当ソースにジャンプする
- [ ] YouTube URLを入力すると字幕テキストがソースに追加される
- [ ] 既存機能（チャット・コピー・履歴・永続保存・要約・分析・品質スコア）が維持されている
- [ ] index.html の WHAT'S NEW が更新されている
- [ ] docs/design.md が最新化されている

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/prompt-maker/index.html` | 変更 |
| `api/fetch-transcript.js` | 新規 |
| `vercel.json` | 変更（fetch-transcript追加） |
| `index.html` | 変更 |
| `docs/design.md` | 変更 |

---

## 参照

- `steering/S039-PromptMaker-v4-NotebookLM超え.md` — v4実装
- `apps/slide-maker/index.html` — pdf.js使用例
- `api/fetch-article.js` — URL取得API

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
