# プロジェクト設計ドキュメント

> **このファイルは「永続的ドキュメント」です。**
> 仕様・設計・決定事項は常にここを最新の状態に保ってください。

最終更新: 2026-04-19（AI NEWS 競合PR拡充22社・fyi質フィルタ強化・Xトレンド日次更新 (Claude+web_search) ＋シードプール日付シャッフル）

---

## 1. プロジェクト概要

学習用のフロントエンドアプリ集。ビルドステップなし・フレームワークなしの静的ファイルで構成する。

- **技術スタック**: HTML / CSS / Vanilla JavaScript（一部 React via CDN）
- **実行方法**: `npx serve .` でローカルサーバー起動、またはブラウザで直接開く
- **テスト**: Playwright + Chromium（`npx playwright test`）

---

## 2. ファイル構成

```
/
├── CLAUDE.md              # AIへの開発ルール（このプロジェクトの憲法）
├── docs/
│   └── design.md          # 永続的ドキュメント（本ファイル）
├── steering/              # ステアリングファイル（作業単位の管理）
│   ├── _template.md       # テンプレート
│   └── S001-*.md          # 各作業単位
├── specs/                 # 機能スペック（詳細仕様）
│   └── *.spec.md
├── index.html             # ブロック崩しゲーム（マークアップ + CSS）
├── main.js                # ブロック崩しゲーム（ロジック）
├── todo.html              # Todoアプリ（React via CDN）
└── planner.html           # プランナーアプリ（Vanilla JS）
```

---

## 3. 機能一覧

| 機能 | ファイル | ステータス | スペック |
|------|----------|-----------|---------|
| アプリポータル | `index.html` | ✅ 完成（最近開いたアプリ・ドラッグ並替・WHAT'S NEW） | S076 |
| ブロック崩しゲーム | `main.js` | ✅ 完成 | 未作成 |
| Todoアプリ | `todo.html` | ✅ 完成 | 未作成 |
| プランナー（カンバン） | `planner.html` | ✅ 完成 | 未作成 |
| テトリス | `apps/tetris.html` | ✅ 完成 | 未作成 |
| ぷよぷよ | `apps/puyo.html` | ✅ 完成 | 未作成 |
| YouTube説明文ジェネレーター | `apps/youtube-desc/index.html` | ✅ 完成 | S012 |
| AKKODiS Global Antenna | `apps/akkodis-watcher/index.html` | ✅ 完成 | S011 |
| Banner Resizer | `apps/banner-resizer/index.html` | ✅ 完成 | S013 |
| Marketo Mail Generator | `apps/marketo-mail-generator/index.html` | ✅ 完成 | S015 |
| URL Slug Generator | `apps/url-slug-generator/index.html` | ✅ 完成 | S016 |
| OGPチェッカー | `apps/ogp-checker/index.html` | ✅ 完成 | S017, S047 |
| SNS Post Generator | `apps/sns-post-generator/index.html` | ✅ 完成 | S024, S028 |
| Writing Checker | `apps/writing-checker/index.html`, `apps/writing-checker/knowledge.js` | ✅ 完成 | S025 |
| Slide Maker | `apps/slide-maker/index.html`, `api/slide-generate.js`, `api/slide-export.py`, `api/slide-factcheck.js`, `apps/slide-maker/templates/` | ✅ 完成 | S034, S036, S037 |
| Prompt Maker | `apps/prompt-maker/index.html`, `api/sources.js`, `api/fetch-transcript.js` | ✅ 完成 | S035, S037, S038, S039, S040, S041, S042, S043, S044, S045 |
| Wireframe Maker | `apps/wireframe-maker/index.html`, `api/wireframe-generate.js`, `api/figma-import.js`, `api/deploy-lp.js` | ✅ 完成 | S035, S037, S038, S040, S043, S048, S050, S051, S052, S053, S054, S055, S056, S066, S068, S069, S070 |
| Cache Checker | `apps/cache-checker/index.html`, `api/fetch-article.js(mode=proxy)` | ✅ 完成 | S037 |
| Image Converter | `apps/image-converter/index.html` | ✅ 完成 | S047 |
| AI NEWS | `apps/ai-news/index.html`, `apps/ai-news/app.js`, `apps/ai-news/scraper.py`, `api/ai-news-api.js`, `.github/workflows/ai-news-collect.yml`, `.github/workflows/auto-merge-claude.yml` | ✅ 完成（毎朝8時 JST 日本語RSSのみ自動収集 + Claude Haiku 4.5インテリジェンス・ブリーフ + AIダイジェスト音声(tts-1-hd/shimmer/カタカナ変換) + Picker風専門家コメント + スワイプナビ + パーソナライズ + OGP画像自動抽出 + unavatar.io Xアバター + ラジオ番組風ダイジェスト + NewsPicks/SmartNews風UIリデザイン + 日本語率フィルタ + /merges API auto-merge + 「詳しく読む」3ステップ番号UI + Xカード全リンク化） | S073, S074, S075, S077, S078, S079 |

---

## 4. アーキテクチャ方針

### 共通ルール
- ビルドステップなし（no npm build, no bundler）
- 外部ライブラリは CDN 経由のみ許可
- 1ファイルで完結（HTML + CSS + JS をまとめる）
- LocalStorage でデータ永続化

### ブロック崩し（`index.html` + `main.js`）

Canvas 2D ベースのゲーム。状態機械で管理。

```
状態: idle → playing → paused → dead → win → gameover
```

| 定数 | 値 |
|------|----|
| ボール速度 | `4 + (level - 1) × 0.5` |
| ブリック得点 | 10点 |

### プランナー（`planner.html`）

Vanilla JS のカンバンボード。状態は `S` オブジェクトで一元管理。

```
State: { columns: [...], tasks: [...], nextColumnId, nextTaskId }
```

主要関数:
- `render()` — 全体を再描画
- `mkCol(col)` — カラム要素を生成
- `mkCard(task)` — タスクカードを生成
- `saveState()` / `loadState()` — LocalStorage との同期

### Slide Maker（`apps/slide-maker/`）

チャット対話 → AI構成生成 → アウトライン編集 → python-pptx PPTX生成。

```
[チャット対話] → /api/slide-generate.js (mode: chat)
  → claude-sonnet-4-6 + web_search でヒアリング
  → 構成生成 (mode: generate) → スライド構成JSON
  → /api/slide-export.py (python-pptx)
  → テンプレートの slide_layout で add_slide → PPTX → Base64 → DL
```

| 項目 | 詳細 |
|------|------|
| テンプレート | 4種（社外/社内 × WHITE/DARK）、`apps/slide-maker/templates/` |
| スライドマスター | 4マスター × 33レイアウト（17種使用） |
| レイアウト | cover / agenda / chapter / content / two-column / content-with-chart / content-with-flow / sixbox / comparison / quote / closing / centered-text / text-left-picture-right / text-right-picture-left / content-left-full-picture-right / large-image-right / picture-fullscreen |
| PPTX生成 | python-pptx 1.0.2（`api/slide-export.py`）— ネイティブチャート・テーブル・AutoShape・Unsplash画像挿入 |
| API | `claude-sonnet-4-6`（チャット・生成）/ `claude-haiku-4-5-20251001`（リファイン・ファクトチェック） |
| ファイルインポート | PDF（pdf.js）/ Word（mammoth.js）/ PPTX（JSZip）— クライアント側テキスト抽出 |
| ファクトチェック | `api/slide-factcheck.js` — claude-haiku + web_search で主張検証（個別+一括） |
| プレビュー | GoogleSlides風2ペインエディタ（左サムネイル220px＋右キャンバス16:9）・Chart.jsミニチャート・SVGフロー図・画像プレースホルダ描画 |
| UXフロー | 4フェーズ（ヒアリング → 構成確認 → プレビュー → 出力）|
| デザインシステム | CSS変数（shadow xs-xl / spacing 4px基準 / typography xs-xl / transition ease）|
| エディタ操作 | サムネイルクリック選択・ダブルクリック編集・キーボードナビ（矢印/Enter/Delete）・レイアウト自動修正AI |
| プレゼンモード | フルスクリーン・プログレスバー・スライド番号表示・矢印キー操作 |
| 動的SYSTEM_PROMPT | `buildSystemPrompt(imageEnabled)` — Unsplash API有無でレイアウト配分を自動切替 |

### Prompt Maker（`apps/prompt-maker/`）

NotebookLM超えの2ペインレイアウトでプロンプトを対話生成するツール。ソースはVercel KVでサーバーサイド永続保存。4種のソース（テキスト/URL/PDF/YouTube）に対応し、回答に引用マーカーを自動付与。

```
[左ペイン: ソース管理]    [右ペイン: チャット]
  テキスト/URL/PDF/YT追加 →  buildSourceContext() で SYSTEM_PROMPT に注入
  /api/sources.js (KV)    → /api/generate.js (claude-sonnet-4-6)
  /api/fetch-article.js   → ヒアリング → プロンプト生成（---PROMPT_START/END--- パース）
  /api/fetch-transcript.js → YouTube字幕取得        → 回答に引用マーカー [ソース1] 自動付与
```

| 項目 | 詳細 |
|------|------|
| レイアウト | デスクトップ: 左380px + 右flex-1、モバイル(900px以下): タブ切替 |
| ソース種類 | テキスト / URL / PDF（pdf.jsクライアントサイド抽出、最大50p・15000字） / YouTube（字幕自動取得、日英自動選択） |
| ソース永続保存 | Vercel KV（`@vercel/kv`）→ `/api/sources.js` CRUD+PATCH API、KV未設定時はlocalStorageフォールバック |
| ソース帰属 | 各ソースに追加者ユーザー名・追加日時を記録、チーム全員で共有 |
| AI自動要約 | ソース追加時に`claude-haiku-4-5`で3行要約を自動生成・KV保存・再生成対応 |
| 動的サジェスチョン | ソース内容を分析しAIが5つのタスク案を提案（ソース変更時に自動更新） |
| ソース横断分析 | 全ソースの共通テーマ/矛盾/キーポイント/推奨方針を`claude-sonnet-4-6`で分析 |
| 引用・出典表示 | 回答にインライン引用マーカー[ソース1]を自動付与、クリックで左ペインの該当ソースをハイライト＆スクロール |
| マインドマップ | AIがソース間の関係性を分析→SVGマインドマップ自動生成（中心テーマ/サブテーマ/キーワード/ソース接続/コネクション）、ノードクリックでソースジャンプ、SVGダウンロード |
| フラッシュカード | AIがソースからQ&Aペア10枚を自動生成、フリップカードUI（CSS 3Dトランスフォーム）、「覚えた/もう一回」ボタンで進捗管理、モーダル表示 |
| FAQ自動生成 | AIがソースからFAQ 8-10件を生成、アコーディオンUI（クリックで回答展開）、コピー機能 |
| インフォグラフィック | AIがソースのキー数値・統計・比較をJSON抽出→SVGで統計サークル・比較バー・キーポイントを描画、SVGダウンロード |
| UIポリッシュ(v8) | シマーローダー、トースト通知（成功/エラー/情報）、モーダルフェードイン+backdrop-filter、ESCキー閉じ、ボタンhoverリフト統一、ブランドカラー準拠修正、検索クリアボタン+件数、品質スコアバー改善、PDFプログレスバー、引用マーカー視認性向上 |
| ソース選択(v9) | 各ソースにチェックボックスON/OFF、選択ソースのみAIコンテキストに含める、全選択/全解除ボタン、「N/M件をAIに使用中」インジケータ、初回3ステップガイド、ソースヒントバナー、全ボタンにツールチップ |
| 品質スコア | 生成プロンプトを5軸（明確性/具体性/構造/再利用性/テクニック）で0-100点評価+改善ヒント |
| メモ機能 | 各ソースにユーザーメモを追加可能（デバウンス自動保存） |
| URL取得 | `/api/fetch-article.js` で実コンテンツ自動抽出（タイトル・本文） |
| YouTube字幕 | `/api/fetch-transcript.js` でYouTube動画の字幕テキストを自動抽出（日本語優先→英語→最初のトラック） |
| プロンプト生成 | 3フェーズ（ヒアリング → 生成 → 洗練）、4構成要素（指示・背景・入力・出力） |
| API | `claude-sonnet-4-6`（チャット・プロンプト生成・横断分析）/ `claude-haiku-4-5`（要約・サジェスチョン・品質スコア） |
| 共通モジュール | `copy-utils.js`（コピー）/ `history.js`（履歴パネル） |

### Wireframe Maker V3（`apps/wireframe-maker/`）

スプリットペインUIでリアルタイムプレビュー付きワイヤーフレーム生成ツール。

```
[左パネル: タブ切替]          [右パネル: ライブプレビュー]
  チャット / 構成編集 / 出力    SVG常時表示 + ミニマップ
  → /api/wireframe-generate.js  → リアルタイム同期
```

| 項目 | 詳細 |
|------|------|
| レイアウト | スプリットペイン（左380px + 右flex-1）、リサイズ可能、モバイル縦積み |
| セクションタイプ | 19種（navigation〜sticky-cta） |
| SVGレンダリング | カラースキーム3種（grayscale/brand/blueprint）、ドロップシャドウ、テキスト要素 |
| CVRスコア | WACUL/Unbounceデータに基づくヒューリスティック採点（0-100点） |
| セクション影響度 | HIGH/MID/LOWバッジ表示 |
| Undo/Redo | 30ステップ、JSON直列化 |
| デバイスプレビュー | PC(1200px)/Tab(768px)/SP(375px) |
| グリッド | 12カラムオーバーレイ |
| ミニマップ | 右下にSVG縮小版常時表示 |
| ショートカット | Ctrl+Z/Y/S/G/P/E、1/2/3タブ切替、Delete、? |
| テンプレート | 10種（BtoB LP、SaaS、EC商品、採用、イベント等） |
| API | claude-sonnet-4-6（生成/バリアント）/ claude-haiku-4-5-20251001（リファイン） |
| SVGダイレクト操作 | プレビュー上でドラッグ並べ替え、オーバーレイツールバー（↑↓複製削除編集リンク） |
| A/Bバリアント | AI代替構成生成、サイドバイサイドdiff比較、セクション単位チェリーピック、B案一括採用 |
| マルチページ | ページ追加/削除/名前変更、ページ間リンク設定、SVG上リンクインジケータ、クリック遷移 |
| AIコピーライティング | refineモードでプレースホルダーを実コピーに一括変換 |
| ヒートマップ予測 | F字パターン・CTA集中度のCanvasオーバーレイ（mix-blend-mode: multiply） |
| レスポンシブ3画面 | PC(1200)/Tab(768)/SP(375)を横並び同時プレビュー |
| プロトタイプ再生 | フルスクリーン、ページ遷移、矢印キー操作、ドットナビゲーション |
| セクションコメント | レビュー用注釈、バッジ表示、ポップオーバー入力 |
| アクセシビリティチェック | WCAG準拠チェック（見出し階層・CTA配置・フォームEFO・信頼要素・セクション数）、スコア0-100 |
| 競合サイト分析 | URLから競合ページ構成をAI推定、自サイトとの差分比較（共通/自サイトのみ/競合のみ） |
| セクションアニメーション | fadeIn/slideLeft/slideUp/zoomIn設定、プレビューデモ再生、HTML出力に data-animate 属性 |
| HTML/CSSエクスポート | セマンティックHTML/CSS変数/Tailwind CSSの3形式でコード出力 |
| デザイントークン | カラースキームからCSS変数/JSONを自動生成（色・スペーシング・タイポグラフィ・レイアウト） |
| テキスト自由配置 | T+ボタンでキャンバス任意位置にテキスト追加、ドラッグ移動、ダブルクリック編集、ツールバーでサイズ/色/太さ/削除 |
| インポートモード選択 | URLインポート・ファイルインポート時に「既存に追加」「全て置換」をモーダルで選択（既存セクション保護） |

### Todoアプリ（`todo.html`）

React 18 + Babel（CDN）。フィルタ（全て / 未完了 / 完了）、LocalStorage 永続化。

### ぷよぷよ（`apps/puyo.html`）

Canvas 2D ベースのぷよぷよゲーム。1ファイル完結。

```
状態: idle → playing ⇄ paused → gameover → idle
```

| 定数 | 値 |
|------|----|
| ボード | 6列 × 13行（可視12行 + 隠し行1行） |
| セルサイズ | 40px |
| Canvas | 400 × 480（ボード240 + サイドパネル160） |
| 落下速度 | 800ms/行（レベルごとに80ms短縮、最小150ms） |

**主要関数:**
- `spawnPair()` — 次のペアをスポーン。詰まりを検知→gameover
- `isValidPair(mr,mc,rot)` — ペア位置の有効性を判定
- `rotateCW/CCW()` — 壁蹴り（±1列試行）付き回転
- `lockPair()` — ボードに書き込み→runChain()
- `applyGravity()` — 空中ぷよを下に落下
- `findErasable()` — BFSで同色連結グループ列挙、size≥4を返す
- `runChain(chain)` — setTimeout で重力→消去→再帰のループ

**スコア計算:**
`10 × 消去数 × max(1, 連鎖ボーナス + 色ボーナス + グループボーナス)`

---

## 5. データモデル

### プランナー

```js
// カラム
{ id: number, title: string, color: string }

// タスク
{
  id: number,
  columnId: number,
  title: string,
  description: string,
  dueDate: string,      // "YYYY-MM-DD" or ""
  priority: "none" | "low" | "medium" | "high" | "urgent",
  label: "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "indigo" | "purple" | "pink" | "none",
  completed: boolean
}
```

### Todo

```js
{ id: number, text: string, done: boolean }
```

---

## 6. 決定事項ログ

| 日付 | 決定内容 | 理由 |
|------|---------|------|
| 2026-02-23 | スペック駆動開発を採用 | 技術的負債の抑制、品質向上 |
| 2026-02-23 | プランナーを Vanilla JS で実装 | ビルド不要の方針に合わせる |
| 2026-02-23 | ステアリングファイルで作業単位を管理 | レビュー可能な開発フローの確立 |
| 2026-02-26 | ぷよぷよを `apps/puyo.html` に実装 | 既存ゲーム群と同スタイルで1ファイル完結 |
| 2026-03-20 | Writing Checkerを `apps/writing-checker/` に実装 | 記者ハンドブック準拠＋AKKODiSブランド＋Microsoft表記＋IOWN®のチェックツール。ナレッジをknowledge.jsに分離 |
| 2026-03-20 | 全アプリUI統一（ブランドカラー・navbar・h1・ファビコン） | AKKODiSブランドカラー (#001f33/#ffb81c/#00ffff) 徹底、角丸NG、色付きborderNG、各アプリにファビコン追加 |
| 2026-03-22 | SNS Post Generator 履歴ラベルを「プラットフォーム ｜ 記事タイトル」形式に改善 | URL のみでは判別しにくいため。保存パターンもおすすめ（recommend）に変更 |
| 2026-03-20 | ポータルカードUIリニューアル | 正方形カード(190×190px)・`aspect-ratio:1`・グリッドを`justify-content:center`で最終行崩れ防止 |
| 2026-03-28 | Slide Maker 完成 | AKKODiSブランド準拠PPTXジェネレーター。ウィザード入力・Claude API構成生成・テンプレートPPTX直接操作（JSZip）・図版自動生成3種（グラフ・フロー・比較表）・対話型リファイン・ブラウザプレビュー・UIオンボーディング改善 |
| 2026-03-29 | Slide Maker V1→V2移行開始 | チャット対話UI・python-pptx移行（JSZip廃止）・アウトライン編集・ファイルインポート・4フェーズUX |
| 2026-03-30 | Slide Maker V2 設計決定 | アプローチB（python-pptx強化）採用。画像系5レイアウト活用（Unsplash API）、ディープリサーチ3フェーズ分離、SYSTEM_PROMPT 16レイアウト化 |
| 2026-03-30 | Slide Maker 16レイアウト完全対応 | フロントエンド全17レイアウト対応（VALID_LAYOUTS/編集モーダル/プレビュー描画）、Chart.jsミニチャート・SVGフロー図プレビュー、ファクトチェック（個別+一括）、動的SYSTEM_PROMPT（画像有無切替）、closing/画像レイアウト空スライド修正 |
| 2026-03-27 | Banner Resizer 新画像サイズ要件対応 | MV: 800×446→1920×1080、一覧プリセット削除、サムネイル余白ガイド（安全ゾーン上下24px左右100px）追加。ブランドガイドライン違反も修正 |
| 2026-03-30 | Banner Resizer WebPフォールバック修正 | ブラウザがWebP非対応時にPNGにフォールバックされるが拡張子が.webpのままでCMSアップロードエラーになっていた。Blobの実際のMIMEタイプを確認し正しい拡張子で出力するよう修正 |
| 2026-03-31 | Slide Maker UI全面刷新 | GoogleSlides風2ペインエディタ（左サムネイル＋右キャンバス）、CSS変数デザインシステム（shadow/spacing/typography/transition）、フェーズプログレスバー、シマーローディング、レイアウト自動修正AI、プレゼンモード改善（プログレスバー+スライド番号）、キーボードナビゲーション |
| 2026-03-31 | Wireframe Maker V3 大規模アップグレード | スプリットペインUI（左パネル+右ライブプレビュー）、CVRスコアリング、カラースキーム3種、ミニマップ、強化SVGレンダリング、ショートカット拡張 |
| 2026-03-31 | Wireframe Maker V4 Figma超え3機能 | SVGダイレクト操作（ドラッグ並べ替え+オーバーレイツールバー）、A/Bバリアント生成（AI代替構成diff比較+チェリーピック）、マルチページプロトタイプ（ページ管理+ページ間リンク+遷移） |
| 2026-03-31 | Wireframe Maker V5 5機能追加 | AIコピーライティング、ヒートマップ予測（F字パターン）、レスポンシブ3画面同時プレビュー、プロトタイプ再生モード、セクションコメント/注釈 |
| 2026-03-31 | Wireframe Maker V6 5機能追加 | アクセシビリティチェッカー、競合サイト構成分析、セクションアニメーション、HTML/CSS/Tailwindエクスポート、デザイントークン自動生成 |
| 2026-03-31 | Banner Resizer 安全ゾーンダウンロードバグ修正 | ダウンロード画像に安全ゾーンオーバーレイが焼き込まれるバグを修正。data-safe-zone-overlay属性マーカー方式でプレビュー表示とダウンロード出力を分離。AIアップスケール時の品質劣化も防止 |
| 2026-03-31 | Wireframe Maker V7 Figma完全超え5機能 | リアルタイム共同編集（BroadcastChannel P2P）、コンポーネントライブラリ、Figmaインポート（API連携）、ABテスト連携（GO/VWO設定出力）、LP公開（Vercelデプロイ） |
| 2026-03-31 | Wireframe Maker V8 分析・ハンドオフ5機能 | AIデザインレビュー（改善提案+優先度）、ユーザーフロー自動生成（ページ遷移図SVG）、デザインハンドオフモード（スペック表示）、テンプレートマーケットプレイス（公開/取込/JSON）、パフォーマンス予測（CWV推定+最適化提案） |
| 2026-03-31 | Wireframe Maker バグ修正 | 構成パネルのスクロール不具合修正（flexbox min-height問題）、SVGプレビュー上のダブルクリックテキスト直接編集追加、左パネルのテキスト編集をシングルクリックに変更 |
| 2026-03-31 | Wireframe Maker V9 URLインポート・画像差し込み | URLからサイト構造をコピーしてワイヤーフレーム自動生成（fetch-article.js+AI分析）、セクションへの画像差し込み（SVG image要素・5MB上限・PNG/JPG/GIF/WebP対応） |
| 2026-04-01 | Cache Checker 新規追加 | CMSキャッシュ反映状況チェックツール。通常版とキャッシュバイパス版（ランダムパラメータ付与）を比較し差分を可視化。Vercel Serverless Function（api/proxy.js）でCORS回避。jsdiffによる行単位diff表示 |
| 2026-04-01 | Wireframe Maker V10 Figma到達 | SVGテキスト直接編集（全セクション対応）、プロジェクト保存/読込（localStorage+JSON）、自動保存（3秒デバウンス）+起動時復元、セクション個別スタイル（背景色・テキスト色・アクセント色）、PDFエクスポート（JPEG埋込PDF生成） |
| 2026-04-05 | Wireframe Maker 致命的バグ修正5件 | 比較表Math.random()→決定論的パターン、チャット中のタブ強制切替抑止、Ctrl+Sショートカット誤表記修正、自動復元時CVR表示、テンプレート適用時の状態更新統一 |
| 2026-04-01 | Banner Resizer ガイド準拠の容量制限追加 | MV: 1MB以内、OGP: 100KB以下。WebP/JPGは品質0.70下限で自動圧縮（画質維持優先）。PNGは圧縮不可のため超過時警告表示。プレビューにファイルサイズ・上限・超過状態を常時表示 |
| 2026-04-01 | Wireframe Maker V11 総合UI見直し | ウェルカムカード導線、URLインポートUI改善（横一列化+プロンプト強化で忠実再現）、セクション番号+CVR日本語ラベル、ビジュアルピッカー（アイコングリッド）、全ツールバーにツールチップ、デバイス幅明示、エクスポート画面4フォーマットカード化+プロジェクト管理統合、ショートカット拡充（Ctrl+N）、ナビバー58px統一 |
| 2026-04-01 | Cache Checker 新規追加 | CMSキャッシュ反映状況チェックツール。通常版とキャッシュバイパス版（ランダムパラメータ付与）を比較し差分を可視化。Vercel Serverless Function（api/fetch-article.js mode=proxy）でCORS回避。jsdiffによる行単位diff表示 |
| 2026-04-02 | Cache Checker UX刷新 | 仕組み説明フロー（3ステップ）追加、診断結果を「反映済み」「キャッシュ待ち」に分類、CMS公開設定ミスの可能性を両パターンで提示。ラベルを運用に即した表現に統一（サイト訪問者が見ている状態 / CMSの最新状態）。OGP・画像・テキストの2カラム比較＋変更箇所バッジ表示 |
| 2026-04-03 | Cache Checker iframe プレビュー刷新 | 実際のWebページをiframe（srcdoc＋baseタグ）で表示する方式に変更。OGP/テキスト抽出表示を廃止。変更検出はバッジサマリーで表示。サンプルURLをakkodis.com/jaに変更。diff.js依存を削除 |
| 2026-04-03 | Image Converter 新規追加 | 画像フォーマット変換・軽量化ツール。WebP/JPEG/PNGへの変換、品質スライダー（デフォルト80%）、リサイズオプション、変換前後のサイズ比較・削減率表示、複数ファイル一括変換・ZIPダウンロード。Canvas API使用、クライアントサイド完結 |
| 2026-04-04 | Wireframe Maker テキスト自由配置＆インポート改善 | Aa+ボタンでキャンバス任意位置にテキスト追加（ドラッグ移動・ダブルクリック編集・サイズ/色/太さ変更）、URLインポート時に「既存に追加」「全て置換」選択モーダル追加、Undo/RedoのfreeTexts対応、マルチページfreeTexts同期修正 |
| 2026-04-04 | Wireframe Maker UX致命的バグ4件修正 | クローンモード→WFプレビュー自動切替、「構成をWFに変換」ラベル+tooltip改善、要素移動ボタン(⬆⬇)+挿入位置選択(前/後)+未選択トースト、デバイス切替時iframe幅レスポンシブ+WFモード期待値トースト |
| 2026-04-04 | Wireframe Maker 致命的バグ4件修正(S050) | renderSections/requestPreviewRender未定義→正しい関数名に修正、cloneAIRewriteのframe変数未宣言修正、エクスポートJSON読込ボタンの参照先修正、copySVGのカードレイアウト破壊修正 |
| 2026-04-05 | Wireframe Maker クローンモードUX4件修正(S051) | 構成パネルにiframeセクション一覧表示、要素追加パネルCSS追加+デザイン刷新、onSectionsChanged自動モード切替削除、WF変換時に編集済みiframe HTML使用で忠実度向上 |
| 2026-04-05 | Wireframe Maker バグ修正2件(S052) | showUserFlowのp.links型不整合(object→array)修正、HistoryManager.togglePanel未定義→開閉トグル実装 |
| 2026-04-05 | Wireframe Maker E2Eバグ修正(S053) | editSVGTextのblur/remove競合によるDOMクラッシュ修正、AI修正(refine)のmax_tokens不足(2000→4000)修正 |
| 2026-04-07 | Wireframe Maker UX改善3件(S054) | SP/Tabプレビュー表示修正(CSS transform方式)、背景色変更時テキスト色自動調整(コントラスト保証)、「✎ 編集」ボタンをshowInlineEditに変更 |
| 2026-04-07 | Wireframe Maker プロトタイプ表示修正(S055) | プロトタイプ再生モードのSVG表示位置修正(height属性→style.height計算で上部空白解消) |
| 2026-04-08 | Wireframe Maker Figma連携とインポート改善(S056) | Figmaインポート後onSectionsChanged呼び出し追加、AIフォールバックエラーハンドリング改善、インポートセクションのデフォルトfields生成、クローン編集後チャットへの最新テキスト反映、Figma互換JSONエクスポート機能追加 |
| 2026-04-08 | Banner Resizer 画像品質劣化バグ修正 | OGP容量制限を100KB→300KBに緩和。圧縮品質下限を0.70→0.80に引き上げ（Lossy・PNG→JPEG変換とも）。ソース画像がターゲットより小さい場合の警告UI追加（AIアップスケール推奨表示） |
| 2026-04-08 | Banner Resizer 大きい画像の歪みリサイズ修正 | バナー（MV）・一覧サムネイルで横幅1920px固定・縦は元画像のアスペクト比を保持して自動計算するfitWidthモード追加。16:9以外の画像でも歪まずにリサイズされる |
| 2026-04-08 | Cache Checker UX改善(S057) | チェック中のキャンセルボタン追加（AbortController）。進捗ステージ表示（通常版取得中→最新版取得中→比較中）。Escapeキーで結果クリア/ローディング中はキャンセル。アクセシビリティ属性追加（role="alert", aria-live="polite"） |
| 2026-04-09 | Banner Resizer OGP PNG固定・100KB対応(S059) | OGP上限を300KB→100KBに変更（AKKODiS基準準拠）。JPEGフォールバックを廃止し常にPNG出力。1200×630px固定を保証（縮小は行わない）。超過時は控えめなポスタライズ（7/6bit/ch）で最適化、それでも超過の場合は画質優先で警告表示。Lossy形式の圧縮品質ステップに0.75/0.70を追加 |
| 2026-04-09 | WHAT'S NEW ポップアップ改善(S062) | ポータル: ログイン後に前回アクセス以降の新着のみモーダル自動表示（localStorage追跡）、日付グループ化ヘッダー、説明文1行truncate+クリック展開、既存ドロップダウンも同UIに統一。各アプリ: onboarding.jsにupdatesセクション追加、全12アプリのinitOnboardingに最近のアップデート配列を追加（機能説明の下にタイムライン形式表示）。OB_VERSION=3に更新 |
| 2026-04-09 | 全アプリ共通デザインシステム洗練化(S063) | app-styles.css: トランジション変数追加（ease-fast/ease-slow）、ナビバーにゴールドアクセント＋シャドウ強化、コンテナにネイビートップボーダー、h1にゴールドアンダーライン、フォーム入力44px最小＋ホバー状態、ステップヘッダーにグラデーション背景、カードホバーエフェクト、結果エリアにネイビー左ボーダー、フッターにゴールドトップボーダー。各アプリ: ハードコードカラー（#636e72, #f0ac10, #d8dde6, #e17055, #b8860b等）をCSS変数（--text-muted, --gold-80, --navy-10, --error-text, --text-faint等）に置換 |
| 2026-04-09 | 複数アプリ機能アップデート(S067) | SNS Post Generator: 文字数制限バグ修正（X:140→280、LinkedIn:1300→3000、Chatter:1000→5000）、プラットフォーム別最適文字数範囲表示追加。Image Converter: AVIF形式対応追加（ブラウザ未対応時は自動無効化） |
| 2026-04-11 | Wireframe Maker ゼロから完了までの導線強化(S070) | クローン→WF変換: iframe無応答/セクション0件/AI空応答を沈黙させず明確なエラーメッセージで案内（タイムアウト 3s→5s、frame未取得検知、structure空配列時はthrow）。資料インポート: PDF/Word/PPTX で 15000文字を超える場合は元文字数付きで警告チャット表示（sliceWithTruncateFlag 追加）。URLインポート: 既存 currentSections がある場合も確認ダイアログで編集破棄を防止。エクスポート: exportSVG/exportPNG を try/catch で包み showError 経由で失敗理由を提示、PNGは最大6000pxにスケール制限でOOM回避、toBlob 失敗時ハンドリング追加。完了導線: notifyReadyToExport ヘルパー追加、初回セクション生成時に「📤 エクスポートタブへ進む」ボタン付きチャットメッセージを1度だけ表示（startNew でフラグリセット） |
| 2026-04-12 | Wireframe Maker 品質改善(S069) | セキュリティ: postMessageオリジンチェック追加（iframe/親双方・srcdoc nullオリジン互換対応）、innerHTML XSS対策（escHtml適用・insert-htmlサニタイズ・data.urlプロトコル検証）、Math.random()→crypto.getRandomValues()（collabUserId/roomId）。パフォーマンス: setupFreeTextEventsのaddEventListener累積リークをAbortControllerで解消、ミニマップ更新にデバウンス(150ms)追加、空setInterval削除。安定性: getScreenCTM() nullガード、iframe/contentWindow nullチェック統一、localStorage.setItem容量超過try-catch、showError/applyInlineEdit nullガード、ドラッグtransform nullチェック、認証チェックtry-catch。描画: drawLinesのMath.random()→決定論的パターン配列。API: fetch全箇所にres.okチェック追加、postMessageタイムアウト1秒→5秒。UI: more-tools-menu z-index衝突解消(100→110)。リソース: URL.createObjectURL revoke漏れ2箇所修正。アクセシビリティ: 全モーダル17箇所にrole=dialog/aria-modal追加、Escapeキーモーダル閉じ、タブリスト矢印キーナビゲーション、全閉じるボタン18箇所にaria-label追加。コラボレーション: アバター名/カーソルラベルのXSSエスケープ |
| 2026-04-10 | Wireframe Maker モード分離とテキスト編集改善(S068) | ウェルカム画面: 「ゼロから作る」「既存サイトから作る」にモード分離、空プレビュー案内文改善。テキスト編集: 全17セクションタイプのテキストにeditKey付与（navigation/footer/video/logo-bar/comparison/sticky-cta/form項目名/pricing機能名）、ホバー時下線ヒント追加。クローン→WF変換: セクション抽出クエリ拡張（div/wrapper/container/role属性対応・高さ30px未満フィルタ・重複排除）、抽出情報にテキスト概要/CTA/画像有無/フォーム有無/高さ追加。クローンモードUI: 「WFに変換→」ボタンをゴールド強調、Stepガイドメッセージ追加、WF生成後に編集ヒント表示 |
| 2026-04-09 | Wireframe Maker UX全面改善(S066) | セクションテキスト編集: contenteditable click問題修正（イベント伝播競合解消・全選択・Esc取消対応）、CSSプレースホルダーテキスト追加。画像プレースホルダー: SVG img-click-areaクラス追加でクリック→ファイル選択→画像挿入を実現、ヒントテキスト「クリックで画像挿入」表示。SVGテキスト: シングルクリックで編集モード開始（ダブルクリック不要に）。ツールバー: 絵文字→テキストラベル（配色/+テキスト/HTML出力/AIコピー）、18個の詳細機能を「その他▾」メニューに集約（上方展開・クリック外閉じ）。空状態ヒント改善（3つの開始方法を案内） |
| 2026-04-09 | Writing Checker記者ハンドブック網羅的拡充(S065) | knowledge.js: 新規9セクション追加（【11】慣用句25語・【12】助詞ルール・【13】常用漢字外書き換え30語・【14】漢字使い分け20組・【15】敬語誤用18パターン・【16】一般外来語35語・【17】敬称ルール・【18】句読点記号・【19】数字表記）。既存補完: 送り仮名15語追加・誤用表現5語追加・重複表現19語追加 |
| 2026-04-13 | 全アプリ品質改善(S071) | Banner Resizer: setupCropDragイベントリスナーメモリリーク修正（AbortController導入で再レンダリング時にリスナー自動除去）、ドロップゾーンrole/aria-label/tabindex追加。Writing Checker: contenteditable paste時にプレーンテキスト化でXSS防止、ファイルドロップゾーンa11y追加。Image Converter: 変換ループにキャンセルボタン＋フラグチェック追加。SNS Post Generator: モバイルレスポンシブCSS追加（platform-tabs/pattern-tabs flex-wrap、input-row縦並び、375px対応）。OGP Checker: フェッチ中スケルトンローディングUI追加（shimmerアニメーション、aria-busy）。 |
| 2026-04-09 | Cache Checkerデザイン刷新・機能強化(S064) | デザイン: ネイビーグラデーションヒーローヘッダー、アイコン付きステップカード（How it works）、プログレスバー付きローディング、リアルブラウザドット色、変更バッジにゴールド左ボーダー、verdict結果にグラデーション背景。機能: チェック履歴パネル（過去10件保存・ワンクリック再チェック）、OGP画像新旧並列比較、キャッシュ関連レスポンスヘッダー表示（Cache-Control/Age/X-Cache等）、チェック所要時間表示、レポートコピーに所要時間追加 |
| 2026-04-15 | Banner Resizer サムネのセーフエリア自動余白(S072) | 一覧サムネイル(1920×1080)はCMSで上下24px・左右100pxが自動カットされ、要素を端まで配置すると途切れるため、「セーフエリア内に収めて周囲を自動生成」モードを追加（チェックボックスでオプトイン・デフォルトOFF）。ON時は元画像を1720×1032内にcontain配置し、外周の24px/100pxを同画像の拡大ぼかし背景（CanvasFilter blur 60px・1.15倍拡大カバー）で埋める。ON時はカット領域オーバーレイとクロップドラッグ操作を自動的に無効化（重複警告と操作競合の防止）。プレビューとダウンロード両方に反映。 |
| 2026-04-19 | AI NEWS 表示品質修正 | ①競合動向セクションで「富士通 WEB MART」のPCセール記事など「競合ではない文脈」の誤検出を除去：お買い得/キャンセル品/セール品/値下げ/通販/新発売 等のノイズ語を含む記事は isCompetitor=true でも除外（scraper / client 両側で対応）。②「その他のニュース 0件」問題を修正：partition() の fyi にバズ閾値 (passes) を適用していたため、hatena=0 の記事が全滅していた → fyi は残り全件を拾うように変更。③Executive Summary の冗長出力を抑制：scraper プロンプトで「各行60字以内」を強制し、クライアント側 tightenSummaryLine() でも 60 字で末尾「…」カット。 |
| 2026-04-19 | AI NEWS キュレーション精度強化 | ①消費者向け商品記事（PC通販／値引き／クーポン／アウトレット／新発売／開封レビュー等）を scrape 段階でハード除外（is_consumer_noise）し client 側にも同じ CONSUMER_NOISE_WORDS フィルタを追加 → 全セクションから B2B 無関係記事が消える。②主要ニュース（must-know）の同話題重複を排除：pickTopUnique() で sameStory() 判定し、同じ話題は人気度最高の1件のみ採択。注目ニュース（this-week）でも主要ニュースと同話題は除外。③注目ニュース件数不足を修正：this_week に passes() バズ閾値がかかっていた回帰を解消 → hatena=0 の記事も拾う。④TODAY'S BRIEFING の機械的60字カットを廃止し sentence-aware トリミングへ：80字以内は全文、超過時は「、」「──」等の自然な境界で切る（SOFT 80 / HARD 110）。⑤競合動向 0 件時の renderCompetitor() をセクション非表示ではなく空状態メッセージ表示に変更（「消えた」誤解を防止）。 |
| 2026-04-19 | AI NEWS さらなる精度改善 | ①3行サマリーの文字数カットを完全撤廃：tightenSummaryLine() を「1文（「。」「！」「？」まで）を必ず全文表示」に変更 — 連用形「〜し、」で切れて「途中で切れてる」誤認を根絶（長さは CSS 折り返しに委ねる）。②注目ニュース品質改善：fyi から this_week への昇格条件を「非UGC & (hatena>=1 or ageHours<12 or matchesTool)」に厳格化 — Qiita/Zenn/note 個人ブログや低人気記事が「注目ニュース」に紛れ込む問題を解消。LLM 直接タグ付けの this_week 記事は UGC も含めて尊重。③競合動向フォールバック導入：INDUSTRY_KEYWORDS（SIer/エンジニア派遣/IT人材/採用市場/DX人材 等）で業界動向をサブマッチ、それも 0 件なら market カテゴリ直近 3 件を表示、すべて 0 件の場合は監視対象（主要競合 50+社）を明示した空状態メッセージ。④scraper 前日重複除外：load_recent_archive_urls() で直近 N 日（既定 2 日）分のアーカイブから URL 集合を構築し、fetch_all 内で skip → 毎朝同じ記事が並ぶ問題を解消。 |
| 2026-04-19 | AI NEWS 競合PR拡充 + その他ニュース品質 + Xトレンド日次更新 | ①競合プレスリリース取得を 5 社（パーソル/リクルート/マイナビ/ビズリーチ/レバテック）→ 22 社に拡張。SIer 8社（NTTデータ/富士通/日立/NEC/NRI/TIS/SCSK/BIPROGY）、コンサル 5社（アクセンチュア/デロイト/PwC/ベイカレント/アビーム）、派遣 5社（テクノプロ/メイテック/アウトソーシングテクノロジー/UT/アルプス技研）、QA 2社（SHIFT/ベリサーブ）、人材 +2社（パソナ/アデコ）。②その他ニュースの fyi 質フィルタを強化：「メディア記事はそのまま、UGC は hatena>=1 か matchesTool のみ採択」 → 0 hatena の個人ブログが混ざらない（0件時は安全弁で全件採択）。③X 生成AIトレンド日次更新：(a) scraper.fetch_x_trends_via_claude() を追加。Anthropic Claude + web_search ツールで「今日の話題のAIに関するXポスト」を取得、X URL 形式チェック + validate_url で実在保証 → news.json の xHighlights に保存。(b) クライアント側に dailyShuffleX() を導入：scraper 未取得時のフォールバックとしてシードプールを日付シードで決定論的シャッフル → 毎日違う組み合わせが表示される。④loadRemote() の xHighlights マッピングで likes/retweets を保持（renderX のバズ閾値判定が機能するように）。 |
| 2026-04-19 | AI NEWS 競合IR拡充 + 注目ニュース厳格化 + デザイン崩れ修正 | ①競合動向の情報量を充実：プレスリリース（PR TIMES）に加えて、第三者報道（決算記事・業界分析・M&A・業務提携・新サービス紹介等）を Google News RSS 検索で 17 フィード追加。NTTデータ/富士通/日立/NEC/NRI/アクセンチュア/デロイト/テクノプロ/メイテック/SHIFT/パーソル/リクルート/ビズリーチ/レバテック の各社、加えて「SIer業界」「エンジニア派遣」「IT人材市場」のマクロ動向検索（AI/決算/業績/M&A 等の絞り込みキーワード付き）。②注目ニュースの UGC 厳格化：LLM が this_week とタグ付けた UGC 記事も hatena>=1 か matchesTool/matchesAIBrand を必須化 → 注目度シグナルゼロの個人ブログを除外。③fyi 質フィルタに matchesAIBrand 救済シグナル追加：Claude/ChatGPT/LLM/Anthropic/OpenAI 等の主要ブランド名を含む UGC 記事は救済（はてブが付いていないだけの良質な技術記事を残す）。④デザイン崩れ修正：注目ニュースの brief-grid と その他ニュースの more-list を固定列数（2列/3列）から `repeat(auto-fit, minmax(...))` に変更 → 1〜2 件の日でも右側が空白にならず、項目数に応じて自動的に列数が調整される。 |
