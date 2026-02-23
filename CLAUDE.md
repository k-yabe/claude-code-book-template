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
