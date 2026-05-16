# 技術セットアップ

## 使用AIプラットフォーム

| プラットフォーム | 用途 |
|----------------|------|
| Claude (Anthropic) | メイン: エンジニアリング・コンテンツ・ビジネスチーム |
| Gemini (Google) | 補助: 長文コンテキスト処理 |
| ローカルモデル (Hermes Agent等) | インフラ: ゴミ掃除・メンテ（コスト0） |

## モデル使用方針（コスト最適化）

```
Haiku  (最速・最安) → 単純な実行タスク
                       チェック・フォーマット・検索・振り分け

Sonnet (バランス)   → オーケストレーター・中程度の判断
                       タスク割り振り・レビュー・報告書生成

Opus   (最高品質)   → 戦略的・重要な意思決定のみ
                       滅多に使わない。使う前に必ず正当化する
```

**ルール**: オーケストレーター（Tech Lead, Content Director等）はSonnet。
実行エージェント（Frontend, Brand Voice等）はHaiku。
Business Strategistへの相談・重要判断時のみOpus。

## ディレクトリ構造

```
ai-agent-org/
├── context/              # 文脈エンジン（全エージェント共有）
│   ├── inbox/            # 新着ノート投入口 ← ここに書き込むと自動処理
│   ├── projects/         # 進行中プロジェクト
│   ├── ideas/            # アイデア保管
│   ├── resources/        # 参考資料
│   └── context/          # 核心文脈（このファイルが置かれている場所）
│       └── ai-handoffs/  # エージェント間引き継ぎ書
├── agents/               # エージェント役割定義
├── tasks/tasks.json      # タスクDB（人間・AI共用）
├── apps/task-board/      # カンバンWebアプリ
└── scripts/              # 自動化スクリプト
```

## スクリプト一覧

| スクリプト | 実行タイミング | 説明 |
|-----------|--------------|------|
| `scripts/task-dispatcher.js` | 随時 / 自動化 | inbox → タスク自動生成・割り振り |
| `scripts/morning-standup.js` | 毎朝 | 昨夜の完了・今日の未着手を報告 |
| `scripts/overnight-qa.js` | 毎夜 | システム健全性チェック |

## 推奨自動化設定（cron例）

```cron
# 毎日 02:00 夜間QA
0 2 * * * node /path/to/ai-agent-org/scripts/overnight-qa.js

# 毎日 07:00 朝会レポート
0 7 * * * node /path/to/ai-agent-org/scripts/morning-standup.js

# 1時間おきにinboxチェック
0 * * * * node /path/to/ai-agent-org/scripts/task-dispatcher.js
```

## タスクボード同期

- AIエージェント: `tasks/tasks.json` を直接読み書き
- 人間: ブラウザで `apps/task-board/index.html` を開く
- 同期: タスクボードの「Import JSON」「Export JSON」ボタンで手動同期
