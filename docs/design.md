# プロジェクト設計ドキュメント

> **このファイルは「永続的ドキュメント」です。**
> 仕様・設計・決定事項は常にここを最新の状態に保ってください。

最終更新: 2026-04-03（Cache Checker マーカーハイライト刷新）

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
| アプリポータル | `index.html` | ✅ 完成 | — |
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
| Wireframe Maker | `apps/wireframe-maker/index.html`, `api/wireframe-generate.js`, `api/figma-import.js`, `api/deploy-lp.js` | ✅ 完成 | S035, S037, S038, S040, S043 |
| Cache Checker | `apps/cache-checker/index.html`, `api/fetch-article.js(mode=proxy)` | ✅ 完成 | S037 |
| Image Converter | `apps/image-converter/index.html` | ✅ 完成 | S047 |

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
| 2026-04-01 | Banner Resizer ガイド準拠の容量制限追加 | MV: 1MB以内、OGP: 100KB以下。WebP/JPGは品質0.70下限で自動圧縮（画質維持優先）。PNGは圧縮不可のため超過時警告表示。プレビューにファイルサイズ・上限・超過状態を常時表示 |
| 2026-04-01 | Wireframe Maker V11 総合UI見直し | ウェルカムカード導線、URLインポートUI改善（横一列化+プロンプト強化で忠実再現）、セクション番号+CVR日本語ラベル、ビジュアルピッカー（アイコングリッド）、全ツールバーにツールチップ、デバイス幅明示、エクスポート画面4フォーマットカード化+プロジェクト管理統合、ショートカット拡充（Ctrl+N）、ナビバー58px統一 |
| 2026-04-01 | Cache Checker 新規追加 | CMSキャッシュ反映状況チェックツール。通常版とキャッシュバイパス版（ランダムパラメータ付与）を比較し差分を可視化。Vercel Serverless Function（api/fetch-article.js mode=proxy）でCORS回避。jsdiffによる行単位diff表示 |
| 2026-04-02 | Cache Checker UX刷新 | 仕組み説明フロー（3ステップ）追加、診断結果を「反映済み」「キャッシュ待ち」に分類、CMS公開設定ミスの可能性を両パターンで提示。ラベルを運用に即した表現に統一（サイト訪問者が見ている状態 / CMSの最新状態）。OGP・画像・テキストの2カラム比較＋変更箇所バッジ表示 |
| 2026-04-03 | Cache Checker iframe プレビュー刷新 | 実際のWebページをiframe（srcdoc＋baseタグ）で表示する方式に変更。OGP/テキスト抽出表示を廃止。変更検出はバッジサマリーで表示。サンプルURLをakkodis.com/jaに変更。diff.js依存を削除 |
| 2026-04-03 | Image Converter 新規追加 | 画像フォーマット変換・軽量化ツール。WebP/JPEG/PNGへの変換、品質スライダー（デフォルト80%）、リサイズオプション、変換前後のサイズ比較・削減率表示、複数ファイル一括変換・ZIPダウンロード。Canvas API使用、クライアントサイド完結 |
| 2026-04-04 | Wireframe Maker テキスト自由配置＆インポート改善 | Aa+ボタンでキャンバス任意位置にテキスト追加（ドラッグ移動・ダブルクリック編集・サイズ/色/太さ変更）、URLインポート時に「既存に追加」「全て置換」選択モーダル追加、Undo/RedoのfreeTexts対応、マルチページfreeTexts同期修正 |
