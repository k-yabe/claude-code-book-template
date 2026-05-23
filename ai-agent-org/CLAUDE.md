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

## エージェント組織（26名体制）

すべてのアウトプットはCOOレビューを経て人間（CEO）に届けられる。

### 経営層
- **COO** (Sonnet) — 全アウトプット検収・エージェント間調整・品質保証
- CEO = 人間（k-yabe）

### リサーチチーム
- **Research Analyst** (Sonnet) — 調査・比較・購入検討・導入判断全般（フォールバック先）
- **Data Analyst** (Haiku) — 数値データ分析・KPI集計・インサイト抽出

### パーソナルチーム（kunito）
- **Career Advisor** (Sonnet) — 副業案件探し・キャリア相談・収入機会の発見
- **Personal Assistant** (Haiku) — 日程調整・メール下書き・雑務処理の汎用窓口

### エンジニアリングチーム
- **Tech Lead** (Sonnet) — オーケストレーター、技術的タスクの割り振り
- **Frontend Engineer** (Haiku) — UI/CSS/HTML実装
- **Backend Engineer** (Haiku) — API/DB/サーバー実装
- **QA Engineer** (Sonnet) — テスト・品質チェック・夜間自動QA
- **DevOps Engineer** (Haiku) — CI/CD・Vercelデプロイ・インフラ自動化

### コンテンツチーム
- **Content Director** (Sonnet) — オーケストレーター、台本・記事・コンテンツ全般
  - ※ Video Producer / Brand Voice / Root Cause / Anti-AI Slop はContent Directorが内部で呼び出すサブエージェント
- **Video Producer** (Haiku) — YouTube/Shorts台本・動画企画

### ビジネスチーム
- **Business Strategist** (Opus ※戦略判断時のみ) — 事業の重要意思決定
- **Marketing Director** (Sonnet) — マーケ戦略・SNS・集客施策
- **Sales & Growth Manager** (Haiku) — 収益化・グロース施策・LTV最大化
- **Partnership Manager** (Haiku) — 外部パートナー・コラボ・スポンサー案件のフィルタリング
- **Legal Review** (Sonnet) — 契約書レビュー（第1段階）

### ファイナンスチーム
- **Finance Manager** (Haiku) — 収支・予算管理・AI利用コスト追跡・月次レポート

### CX / セキュリティチーム
- **Customer Success** (Sonnet) — ユーザーフィードバック分析・改善提案・FAQ作成
- **SEO / Analytics Specialist** (Haiku) — 検索流入分析・SEO改善・アクセス解析
- **Security Reviewer** (Sonnet) — コード・設定のセキュリティチェック・脆弱性レビュー

### インフラ運用チーム
- **Task Dispatcher** (Sonnet) — inbox監視→タスク生成・割り振り
- **Project Manager** (Haiku) — 既存タスクの優先度・スケジュール・依存関係管理
- **Local Support** (ローカルモデル) — ゴミ掃除・メンテ

## 運用ルール

### AIエージェントが必ず守ること
1. `context/inbox/` のファイルは**削除しない**（移動・処理済みマークのみ）
2. `tasks/tasks.json` を書き換える前に現在の内容を必ず読む
3. 判断に迷ったら `context/context/philosophy.md` を参照する
4. 引き継ぎは必ず `context/context/ai-handoffs/` に書き物で残す
5. 人間の確認が必要な判断はタスクに `blocked` ステータスと理由を記録する
6. **アウトプットは必ずCOOレビューを通す** — 担当エージェントが成果物を完成させたら、タスクコメントに「COOレビュー依頼」と記録してCOOに引き継ぐ
7. **COO差し戻しには即座に対応** — 差し戻し指示を受けたエージェントは修正後にタスクコメントへ「修正完了 → COO再レビュー依頼」と記録する

### COOレビューフロー
```
担当エージェント → 完成 → COOレビュー → 承認 → 人間(CEO)へ
                              ↓
                           差し戻し → 担当エージェント修正 → 再レビュー
```

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
