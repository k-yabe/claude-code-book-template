# AI Agent Organization — CLAUDE.md

このリポジトリはAIエージェントを人間の組織のように運用するシステムです。

## ディレクトリ構造

```
ai-agent-org/
├── context/                 # 文脈エンジン（全エージェント共有の知識ベース）
│   ├── inbox/               # 受信ボックス（新着ノートの投入口）
│   ├── projects/            # 進行中プロジェクト
│   ├── ideas/               # アイデア
│   ├── resources/           # 参考資料
│   └── context/             # 核心文脈
│       ├── philosophy.md    # 哲学・価値観
│       ├── professional-identity.md
│       ├── technical-setup.md
│       ├── visual-design.md # デザインシステム
│       └── ai-handoffs/     # AI間引き継ぎ書
├── agents/                  # エージェント役割定義
│   ├── engineering/
│   ├── content/
│   ├── business/
│   └── infrastructure/
├── tasks/
│   └── tasks.json           # タスクデータ（人間・AI共用）
├── apps/
│   └── task-board/          # カンバンボードWebアプリ
└── scripts/
    ├── task-dispatcher.js   # inbox → タスク自動生成
    ├── morning-standup.js   # 朝会レポート生成
    └── overnight-qa.js      # 夜間QA実行
```

## エージェント組織

### エンジニアリングチーム
- **Tech Lead** (Sonnet) — オーケストレーター、タスク割り振り
- **Frontend Engineer** (Haiku) — UI/CSS/HTML実装
- **Backend Engineer** (Haiku) — API/DB/インフラ
- **QA Engineer** (Sonnet) — テスト・品質チェック・夜間自動QA

### コンテンツチーム
- **Content Director** (Sonnet) — オーケストレーター、台本レビュー
- **Brand Voice** (Haiku) — ブランドボイスチェック
- **Root Cause** (Haiku) — 本質・深さチェック
- **Anti-AI Slop** (Haiku) — AIっぽい表現の除去

### ビジネスチーム
- **Marketing Director** (Sonnet) — マーケ戦略
- **Business Strategist** (Opus ※戦略判断時のみ) — 事業判断
- **Partnership Manager** (Haiku) — 案件管理・フィルタリング
- **Legal Review** (Sonnet) — 契約書レビュー（第1段階）

### インフラ運用チーム
- **Task Dispatcher** (Sonnet) — inbox監視→タスク生成・割り振り
- **Local Support** (ローカルモデル) — ゴミ掃除・メンテ

## 運用ルール

### AIエージェントが必ず守ること
1. `context/inbox/` のファイルは**削除しない**（移動・処理済みマークのみ）
2. `tasks/tasks.json` を書き換える前に現在の内容を必ず読む
3. 判断に迷ったら `context/context/philosophy.md` を参照する
4. 引き継ぎは必ず `context/context/ai-handoffs/` に書き物で残す
5. 人間の確認が必要な判断はタスクに `blocked` ステータスと理由を記録する

### モデル使用方針
- **Haiku** — 単純な実行タスク（チェック・フォーマット・検索）
- **Sonnet** — オーケストレーション・中程度の判断
- **Opus** — 戦略的・重要な意思決定のみ（コスト節約のため最小限）

### タスクボードの使い方
- AIエージェント: `tasks/tasks.json` を直接読み書き
- 人間: `apps/task-board/` のWebアプリ経由（Import/Exportで同期）

## スクリプト実行

```bash
# タスクディスパッチ（inbox処理）
node scripts/task-dispatcher.js

# 朝会レポート生成
node scripts/morning-standup.js

# 夜間QA実行
node scripts/overnight-qa.js
```
