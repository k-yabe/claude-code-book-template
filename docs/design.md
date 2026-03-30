# プロジェクト設計ドキュメント

> **このファイルは「永続的ドキュメント」です。**
> 仕様・設計・決定事項は常にここを最新の状態に保ってください。

最終更新: 2026-03-31（Wireframe Maker V3 スプリットペインUI・CVRスコア・カラースキーム）

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
| OGPチェッカー | `apps/ogp-checker/index.html` | ✅ 完成 | S017 |
| SNS Post Generator | `apps/sns-post-generator/index.html` | ✅ 完成 | S024, S028 |
| Writing Checker | `apps/writing-checker/index.html`, `apps/writing-checker/knowledge.js` | ✅ 完成 | S025 |
| Slide Maker | `apps/slide-maker/index.html`, `api/slide-generate.js`, `apps/slide-maker/templates/` | ✅ 完成 | S034 |
| Prompt Maker | `apps/prompt-maker/index.html`, `api/sources.js` | ✅ 完成 | S035, S037, S038 |
| Wireframe Maker | `apps/wireframe-maker/index.html`, `api/wireframe-generate.js` | ✅ 完成 | S035, S037, S038 |

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
| スライドマスター | 4マスター × 33レイアウト（現行11種使用、V2で16種に拡張予定） |
| レイアウト（現行） | cover / agenda / chapter / content / two-column / content-with-chart / content-with-flow / sixbox / comparison / quote / closing |
| PPTX生成 | python-pptx 1.0.2（`api/slide-export.py`）— ネイティブチャート・テーブル・AutoShape・画像挿入 |
| API | `claude-sonnet-4-6`（チャット・生成）/ `claude-haiku-4-5-20251001`（リファイン） |
| ファイルインポート | PDF（pdf.js）/ Word（mammoth.js）/ PPTX（JSZip）— クライアント側テキスト抽出 |

### Prompt Maker（`apps/prompt-maker/`）

NotebookLM風の2ペインレイアウトでプロンプトを対話生成するツール。ソースはVercel KVでサーバーサイド永続保存。

```
[左ペイン: ソース管理]    [右ペイン: チャット]
  テキスト/URL追加  →  buildSourceContext() で SYSTEM_PROMPT に注入
  /api/sources.js (KV)    → /api/generate.js (claude-sonnet-4-6)
  /api/fetch-article.js    → ヒアリング → プロンプト生成（---PROMPT_START/END--- パース）
```

| 項目 | 詳細 |
|------|------|
| レイアウト | デスクトップ: 左360px + 右flex-1、モバイル(900px以下): タブ切替 |
| ソース永続保存 | Vercel KV（`@vercel/kv`）→ `/api/sources.js` CRUD API、KV未設定時はlocalStorageフォールバック |
| ソース帰属 | 各ソースに追加者ユーザー名・追加日時を記録、チーム全員で共有 |
| URL取得 | `/api/fetch-article.js` で実コンテンツ自動抽出（タイトル・本文） |
| プロンプト生成 | 3フェーズ（ヒアリング → 生成 → 洗練）、4構成要素（指示・背景・入力・出力） |
| API | `claude-sonnet-4-6`（チャット・プロンプト生成） |
| 共通モジュール | `copy-utils.js`（コピー）/ `history.js`（履歴パネル） |
| UXフロー | 4フェーズ（ヒアリング → 構成確認 → プレビュー → 出力）|

**V2 設計見直し（S035 進行中）:**
- 画像対応レイアウト5種の活用（Unsplash API経由で画像挿入）
- ディープリサーチ機能（リサーチ→生成→ファクトチェックの3フェーズ分離）
- SYSTEM_PROMPT強化（16レイアウト + imageQuery + 配分ルール）

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
| API | claude-sonnet-4-6（生成）/ claude-haiku-4-5-20251001（リファイン） |

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
| 2026-03-27 | Banner Resizer 新画像サイズ要件対応 | MV: 800×446→1920×1080、一覧プリセット削除、サムネイル余白ガイド（安全ゾーン上下24px左右100px）追加。ブランドガイドライン違反も修正 |
| 2026-03-30 | Banner Resizer WebPフォールバック修正 | ブラウザがWebP非対応時にPNGにフォールバックされるが拡張子が.webpのままでCMSアップロードエラーになっていた。Blobの実際のMIMEタイプを確認し正しい拡張子で出力するよう修正 |
| 2026-03-31 | Wireframe Maker V3 大規模アップグレード | スプリットペインUI（左パネル+右ライブプレビュー）、CVRスコアリング、カラースキーム3種、ミニマップ、強化SVGレンダリング、ショートカット拡張 |
