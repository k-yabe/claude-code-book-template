# 🤖 AI Agent組織 — かんたん使い方ガイド

> **このガイドを読めば、今日からすぐ使えます。**  
> 難しい設定は不要。メモを書くだけでAIが動きます。

---

## ❓ そもそも何ができるの？

**一言で言うと：**

> **「やりたいことをメモに書くだけで、AIが仕事を進めてくれる」**

```
あなた（社長）
  ↓  メモを書く
inbox（依頼ボックス）
  ↓  5分で自動タスク化
AIエージェント（各部門スタッフ）
  ↓  進捗をタスクボードに記録
タスクボード（どこからでも確認）
```

---

## 👥 どんなAIスタッフがいるの？

```mermaid
graph TD
    You[👤 あなた] --> EN[🛠️ エンジニアチーム\nコード・バグ・実装]
    You --> CO[✍️ コンテンツチーム\n記事・動画・台本]
    You --> BU[💼 ビジネスチーム\nマーケ・戦略・法務]

    EN --> TL[Tech Lead]
    EN --> FE[Frontend Engineer]
    EN --> QA[QA Engineer]

    CO --> CD[Content Director]
    CO --> BV[Brand Voice]

    BU --> MD[Marketing Director]
    BU --> BS[Business Strategist]
    BU --> LR[Legal Review]
```

**キーワードを書くだけで担当が自動で決まります。**  
例：「コンテンツ」と書けば → Content Director へ自動振り分け

---

## 🚀 基本の使い方（3ステップ）

### STEP 1 ✏️ メモを書く

```mermaid
flowchart LR
    A["① Obsidianを開く"] --> B["② 左の\ninboxフォルダ\nを右クリック"]
    B --> C["③ 新規ノート\nを作成"]
    C --> D["④ タイトルに\nやりたいこと\nを一言で書く"]
    D --> E["⑤ 本文に\n詳細を書く\n（自由に）"]
    E --> F["⑥ 保存して\n完了 ✅"]
```

**📝 書き方テンプレート**

```
# ○○をしたい（タイトルは一言で）

## 背景・目的
なぜやりたいのかを書く

## 詳細
- ターゲットは誰か
- ゴールは何か
- 期限はいつか
- 必要なアウトプットは何か
```

**✅ 実際の書き方例**

```
# 来月のウェビナー集客コンテンツを作りたい

## 背景
来月15日にウェビナー開催。集客コンテンツが必要。

## 詳細
- ターゲット：B2BのITマネージャー（従業員500名以上）
- ゴール：申込み100名
- 必要なもの：LP×1、招待メール×2、SNS投稿文×3
- 期限：来月10日まで
```

---

### STEP 2 ⏳ 待つだけ（自動でタスク化される）

```mermaid
sequenceDiagram
    participant You as ✏️ あなた
    participant Inbox as 📥 inbox
    participant Script as ⚙️ 自動スクリプト
    participant Board as 📋 タスクボード

    You->>Inbox: メモを保存
    Note over Script: 5分後に自動実行
    Script->>Inbox: メモを読み込む
    Script->>Board: タスクを自動生成
    Note over Board: 担当AIスタッフに自動割り振り
    Board-->>You: タスクボードに反映 ✅
```

> ⚠️ **MacBookが起動中のときだけ動きます。**  
> 電源オフ・スリープ中は動きません。  
> すぐに動かしたい場合はターミナルで：
> ```bash
> cd ~/Documents/ai-agent-workspace/ai-agent-org
> node scripts/task-dispatcher.js
> ```

---

### STEP 3 📊 タスクボードで確認

**🌐 URL（ブックマーク推奨）**

```
https://claude-code-book-template-git-main-k-yabes-projects.vercel.app/ai-agent-org/apps/task-board/
```

> スマホ・別PC・どのデバイスからでも見られます。

**🔑 初回だけ：トークンを設定する**

```mermaid
flowchart LR
    A["タスクボードを開く"] --> B["右上の\n🔑 トークン設定\nをクリック"]
    B --> C["github_pat_...\nを貼り付け"]
    C --> D["OK を押す"]
    D --> E["設定完了✅\n次回から不要"]
```

**📋 カンバンボードの見方**

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  📬 未着手   │  │  🔄 進行中   │  │  🚨 要確認   │  │  ✅ 完了    │
│ New Assigned │  │  In Progress │  │   Blocked    │  │    Done     │
│              │  │              │  │              │  │             │
│ タスクが割り  │  │  AIが今      │  │ ⚠️ ここに   │  │ 完了した    │
│ 振られた状態  │  │  作業中      │  │ 溜まったら   │  │ タスク      │
│              │  │              │  │ あなたの     │  │             │
│              │  │              │  │ 判断が必要！  │  │             │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

> 🚨 **Blocked（要確認）に溜まっていたら要注意！**  
> AIが判断できず止まっているサイン。カードを開いて確認してください。

---

## 🔤 担当の自動振り分けルール

メモにこのキーワードを入れると、自動で担当が決まります。

| 書くキーワード | 担当AIスタッフ |
|-------------|-------------|
| 記事・ブログ・動画・台本・コンテンツ | ✍️ Content Director |
| マーケ・マーケティング・SNS・プロモ | 📣 Marketing Director |
| 戦略・事業・ビジネス・収益・方針 | 💡 Business Strategist |
| 契約・法的・リーガル・規約 | ⚖️ Legal Review |
| コード・バグ・実装・エラー・API | 🛠️ Tech Lead |
| UI・デザイン・フロントエンド・CSS | 🎨 Frontend Engineer |

**優先度のキーワード：**

| キーワード | 優先度 | 意味 |
|----------|--------|------|
| 緊急・至急 | 🔴 P0 | 今すぐ対応 |
| 重要・高優先 | 🟠 P1 | 優先して対応 |
| （何も書かない） | 🟡 P2 | 通常ペース |
| いつか・低優先 | 🟢 P3 | 余裕があれば |

---

## 📂 Obsidianのフォルダ構成

```
📁 context（Obsidian vault）
 │
 ├── 📥 inbox/          ★ここにメモを書く（毎日使う場所）
 │    └── 作りたいコンテンツ.md
 │    └── 修正してほしいバグ.md
 │
 ├── 📁 context/        AIが参照する「共有知識」
 │    ├── professional-identity.md  ← あなたのプロフィール
 │    ├── philosophy.md             ← 組織の運営方針
 │    ├── visual-design.md          ← デザインガイドライン
 │    └── ai-handoffs/             ← AIの引き継ぎ・自動レポート
 │
 ├── 📁 projects/       進行中プロジェクト
 ├── 📁 ideas/          アイデアメモ
 └── 📁 resources/      参考資料
```

---

## 🔄 Obsidian Gitの自動同期

**何もしなくても勝手に同期されます。**

```mermaid
sequenceDiagram
    participant Ob as 📓 Obsidian（あなたのMac）
    participant GH as ☁️ GitHub（クラウド）

    Note over Ob,GH: 1分ごとに自動コミット
    Ob->>GH: 自分のメモをPush ↑
    Note over Ob,GH: 10分ごとに自動Pull
    GH->>Ob: AIの更新を受信 ↓
```

**今すぐ手動で同期したい場合：**  
`Cmd+P` → `Obsidian Git: Commit and sync` と入力 → Enter

---

## 💻 2台Mac体制

このシステムは2台のMacで役割分担しています。

```mermaid
graph LR
    M5["💻 MacBook Pro M5\n（メイン作業機）\n・Obsidianでメモを書く\n・タスクボードを確認"] -->|push/pull| GH["☁️ GitHub\n（データ保管庫）"]
    MA["⚡ MacBook Air M3\n（常時起動・自動化サーバー）\n・朝9時・夜9時にAI実行\n・朝7時にレポート生成"] -->|push/pull| GH
    GH -->|sync| OB["📱 タスクボード\n（どのデバイスからでも）"]
```

| Mac | 役割 |
|-----|------|
| MacBook Pro M5 | メモを書く・タスクボードを確認する |
| MacBook Air M3 | 常時起動してAIを自動実行するサーバー |

---

## 🤖 AIによるタスク自動実行（task-executor）

MacBook Air M3（常時起動）が**毎日9時・21時の1日2回**、未着手タスクをAIが自動処理します。

```mermaid
sequenceDiagram
    participant LD as ⏰ launchd（9時・21時）
    participant EX as 🤖 task-executor.js
    participant AI as 🧠 Claude API（Haiku）
    participant GH as ☁️ GitHub

    LD->>EX: 起動
    EX->>GH: 未着手タスクを取得
    EX->>AI: タスク内容を送信して処理
    AI-->>EX: 成果物・結果を返す
    EX->>GH: ステータスを更新＋コメントに結果を書き込む
    GH-->>You: タスクボードに反映 ✅
```

> 💡 **コスト目安：月3ドル以内**  
> ほとんどのタスクはHaikuモデルで処理されます（戦略的判断のみSonnet）。

**AIが処理できないと判断した場合（`要確認`ステータスになったとき）：**

```mermaid
flowchart LR
    B["🚨 タスクボードの\n要確認カラム"] --> C["カードをクリック\nしてコメントを読む"]
    C --> D["必要な判断・情報を\nコメントに追記"]
    D --> E["次の9時か21時に\nAIが続きを処理"]
```

**成果物の保存場所：**
`context/projects/` フォルダにMarkdownファイルとして保存されます。

---

## 🌅 朝会レポート（毎朝7時・自動）

MacBook Air M3 が**毎朝7時に自動でデイリーレポートを生成**します。

レポートの内容：
- 昨夜完了したタスク
- 現在進行中のタスク
- 🚨 要確認（あなたの判断が必要なタスク）
- 未着手タスクの一覧

**保存場所：** `context/context/ai-handoffs/standup-YYYY-MM-DD.md`

今すぐ実行したい場合：
```bash
cd ~/Documents/ai-agent-workspace/ai-agent-org
node scripts/morning-standup.js
```

---

## ⌨️ タスクボードのキーボードショートカット

| キー | 動作 |
|------|------|
| `N` | 新規タスク作成モーダルを開く |
| `Esc` | 開いているモーダルを閉じる |
| `Enter`（タイトル入力中） | タスクを作成 |

---

## ❓ よくある質問

**Q: inboxのファイルはタスク化されたら消えますか？**  
→ 消えません。処理済みでもそのまま残ります。

**Q: MacがスリープするとAIは止まりますか？**  
→ はい。自動タスク化はMacが起動中のみ動きます。タスクボードの閲覧は常時OK。

**Q: 別のPC・スマホからも使えますか？**  
→ タスクボードのURLを開いてGitHub PATを入力すれば使えます。

**Q: AIに追加の指示を出したい**  
→ タスクボードでカードをクリック → コメント欄に追記。

**Q: タスクのステータスを変えたい**  
→ タスクボードでカードを開いて「ステータス」のドロップダウンで変更。

**Q: 朝の状況をまとめて確認したい**  
→ ターミナルで `node scripts/morning-standup.js` を実行。レポートが自動生成されます。
