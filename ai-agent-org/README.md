# AI Agent Organization

AIエージェントを人間の組織のように設計・運用するシステム。

参考: [シリコンバレー17年のプロが本気でAIエージェント使い込んだ結果全部見せます](https://www.youtube.com/watch?v=K1JBWvTIc2Y)

## クイックスタート

```bash
# 1. context/context/ のファイルをあなた自身の情報で埋める
#    特に professional-identity.md と philosophy.md

# 2. タスクボードを開く
open apps/task-board/index.html

# 3. inboxにノートを投入してタスクを自動生成
echo "# 新しいアイデア\nこのビジネスのマーケ戦略を考えたい" > context/inbox/idea-1.md
node scripts/task-dispatcher.js

# 4. 朝会レポートを確認
node scripts/morning-standup.js

# 5. 夜間QAを実行
node scripts/overnight-qa.js
```

## 構成

- `context/` — 文脈エンジン（全エージェント共有の知識ベース）
- `agents/` — 4チーム・各エージェントの役割定義
- `tasks/tasks.json` — タスクDB（人間・AI共用）
- `apps/task-board/` — カンバンボードWebアプリ
- `scripts/` — 自動化スクリプト

詳細は [CLAUDE.md](CLAUDE.md) を参照。
