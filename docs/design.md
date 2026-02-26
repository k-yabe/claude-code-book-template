# プロジェクト設計ドキュメント

> **このファイルは「永続的ドキュメント」です。**
> 仕様・設計・決定事項は常にここを最新の状態に保ってください。

最終更新: 2026-02-26

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
| ブロック崩しゲーム | `index.html`, `main.js` | ✅ 完成 | 未作成 |
| Todoアプリ | `todo.html` | ✅ 完成 | 未作成 |
| プランナー（カンバン） | `planner.html` | ✅ 完成 | 未作成 |
| テトリス | `apps/tetris.html` | ✅ 完成 | 未作成 |
| ぷよぷよ | `apps/puyo.html` | ✅ 完成 | 未作成 |

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
