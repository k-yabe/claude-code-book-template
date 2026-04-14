# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

This is a static, no-build project. Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
```

Playwright with Chromium is available in the devcontainer (installed via `post_create.sh`) and can be used for browser-based testing:

```bash
npx playwright test
```

## Architecture

A single-page breakout game (ブロック崩し) in vanilla JavaScript with no framework or build step.

- **`index.html`** — markup, CSS, and a `<canvas id="gameCanvas">` that `main.js` renders into
- **`main.js`** — all game logic, structured as:
  - **Constants** — canvas size, paddle/ball/brick geometry, colors
  - **State variables** — `paddle`, `ball`, `bricks`, `score`, `lives`, `level`, `state`, `keys`
  - **`reset()`** — full game reset (called once on load)
  - **`init()`** — (re)initializes objects for the current level, called by `reset()` and on death/win
  - **State machine** — `state` is one of: `idle | playing | paused | dead | win | gameover`; transitions driven by `handleSpace()` and game events
  - **Input** — keyboard (`keydown`/`keyup`) and mouse (`mousemove`/`click`) listeners on `document`/`canvas`
  - **Game loop** — `requestAnimationFrame`-based loop calling `movePaddle()`, `moveBall()`, `checkBrickCollision()`, then `draw()`
  - **Draw functions** — `drawPaddle()`, `drawBall()`, `drawBricks()`, `drawLaunchHint()` use Canvas 2D gradients

Ball speed scales with level: `speed = 4 + (level - 1) * 0.5`. Each brick is worth 10 points. Clearing all bricks advances the level.

---

## 開発ルール（スペック駆動開発）

### 基本方針

このプロジェクトはスペック駆動開発で進める。バイブコーディング（雰囲気でコードを生成する）は禁止。

### 開発フロー

1. **ステアリングファイルを確認** — `steering/` 内の作業単位を把握する
2. **スペック・設計を先に書く** — `docs/design.md` または `specs/` を更新してからコードを書く
3. **ユーザーの承認を得る** — 実装前にスペック・計画をレビューしてもらう
4. **1ファイルずつ実装** — 一度に複数ファイルを変更しない。1ファイル変更→レビュー→次へ
5. **ステアリングファイルを更新** — 作業完了後にステータスと作業ログを記録する
6. **永続的ドキュメントを最新化** — `docs/design.md` を常に現状と一致させる
7. **WHAT'S NEW を必ず更新する** — `index.html` の `WHATS_NEW` 配列に今日の日付・アプリ名・変更内容を追記する。**これを忘れることは禁止。** コミット前に必ず確認すること
8. **アプリのオンボーディング「最近のアップデート」も必ず更新する** — 変更したアプリの `initOnboarding` 内 `updates` 配列に、わかりやすい文章で最新3件を維持する。WHAT'S NEW と同時に更新すること

### WHAT'S NEW / バッジ運用ルール（統一）

#### エントリ形式（必須5キー）

```js
{ icon: '🔗', app: 'URL Slug Generator', badge: 'UPDATE', date: '2026-04-14(火)', desc: '…' }
```

- `icon` `app` `badge` `date` `desc` の **5キーは必須**。省略禁止
- `date` は `YYYY-MM-DD(曜)` 形式。曜日はカレンダーで必ず計算すること
- 新しいエントリは配列の **先頭** に追加（配列は日付降順を保つ）
- 同じアプリ・同日・同内容のエントリを **重複追加しない**

#### バッジの使い分け

| バッジ | 使う場面 |
|-------|---------|
| `NEW` | 新規アプリの公開、または既存アプリへの**新機能**追加 |
| `UPDATE` | 既存機能の改善・バグ修正・UX改善・リファクタ・アクセシビリティ対応など（ほとんどはこちら） |

迷ったら `UPDATE`。`NEW` は「ユーザーが初めて触れる何か」が増えた時のみ。

#### アプリカード（トップ画面）のバッジも同一ルール

- 新規公開から **14日以内** は `card-new-badge` (NEW)
- 直近の機能追加/改修は `card-update-badge` (UPDATE)
- 同時に両方付けない。優先度: NEW > UPDATE

#### 禁止

- `badge` キーの省略（レンダリング側でデフォルト UPDATE にフォールバックはするが、**データとしては必ず明示する**）
- NEW と UPDATE の混在判断を曖昧にすること（上表を厳守）

### ファイルの役割

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | AIへの開発ルール（本ファイル） |
| `docs/design.md` | 永続的ドキュメント。仕様・設計・決定ログ |
| `steering/S###-*.md` | ステアリングファイル。作業単位の定義と進捗 |
| `specs/*.spec.md` | 機能スペック。詳細な仕様定義 |

### 禁止事項

- スペックなしに実装を始めること
- 複数ファイルを一括変更すること（1ファイルずつ）
- `docs/design.md` を古い状態のまま放置すること
- ステアリングファイルを作らずに作業を始めること
- **`index.html` の WHAT'S NEW を更新せずにコミットすること**
- **機密情報をコードやファイルに含めること**（APIキー・パスワード・個人情報・社内資料など）。これらは `.env` ファイルや Vercel 環境変数で管理すること
