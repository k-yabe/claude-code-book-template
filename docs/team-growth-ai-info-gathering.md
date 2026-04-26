# AI 情報収集の自動化：具体的内容とチームへの学びシェア

2026-04-26 — Team Growth

---

## 1. ざっくり何を作ったか

**毎朝 07:00 (JST) に AI 関連の主要サイト（Anthropic News / Engineering Blog / Claude Code Release Notes / Claude Docs Map）を勝手に巡回し、新着差分だけを日本語で要約して Mac に貯めてくれる仕組み。**

セットアップは Mac の Terminal に **1 行貼るだけ**：

```bash
curl -fsSL https://raw.githubusercontent.com/k-yabe/claude-code-book-template/main/assets/setup/bootstrap.sh | bash
```

これで以下が全部入る：
- `/last30days` プラグイン（Reddit / HN / Polymarket / GitHub / WebSearch を横断するSNSリサーチ）
- `daily-watch` スキル（指定サイトを差分巡回）
- launchd 設定（毎朝 07:00 に CLI 経由で `daily-watch` 実行）
- 蓄積先: `~/Documents/AI_Daily/YYYY-MM-DD.md`
- 自作 `/last30` カスタムスラッシュコマンド + `last30` スキル（デスクトップアプリ対応の試み）

加えて本リポジトリの `CLAUDE.md` に「ナレッジ参照ルール」を追記済み。これにより Claude Code がこのリポで「最近の Claude Code どう？」と聞かれたら、`~/Documents/AI_Daily/` の蓄積を読みに行って根拠ベースで答えるようになった。

完全無料で構築（X / YouTube / TikTok / Instagram の `/last30days` 連携は ScrapeCreators API が有料のため除外）。

---

## 2. 具体的にやったこと

### Phase 1: SNS 横断リサーチの導入
1. **`/last30days` プラグイン** を Claude Code に install（Reddit / HN / Polymarket / GitHub / WebSearch のゼロコンフィグ範囲のみ）
2. レポートが `~/Documents/Last30Days/` に蓄積される運用に

### Phase 2: 定期巡回 + ナレッジ蓄積
3. **`~/.claude/skills/daily-watch/SKILL.md`** を新規作成（巡回対象 URL・差分判定ロジック・出力フォーマットを規定）
4. **launchd plist** を `~/Library/LaunchAgents/com.kunito.daily-watch.plist` に設置（`StartCalendarInterval` で毎朝 07:00、`__CLAUDE_PATH__` プレースホルダを `which claude` の結果で sed 置換）
5. **`last_snapshot.json`** で前回取得済みエントリを記録、新着差分のみを抽出する設計
6. 新着 0 件の日でも「本日の新着なし」と書いたファイルを残す運用（運用が止まっていない証跡）
7. WebFetch がブロックされた場合はそのサイトだけスキップしてエラーログに残す

### Phase 3: ナレッジ参照ルール
8. プロジェクト `CLAUDE.md` に「ナレッジ参照ルール（AI Daily）」セクションを追記。AI / Claude Code 動向を聞かれたら蓄積された .md を読みに行く運用に
9. **`migrate-to-obsidian.sh`** を新規作成（後で Obsidian Vault に移行したくなった時に 1 コマンドで出力先を切り替え + 既存ファイルを Vault にコピー + launchd reload まで自動）

### 自動化スクリプト（最重要成果）
10. **`assets/setup/bootstrap.sh`** — 上記 Phase 1〜2 を全部自動セットアップする冪等スクリプト。preflight（macOS / claude バイナリ / バージョン 1.0+）、`/plugin install`、SKILL.md 設置、plist 設置（自動 sed 置換 + `plutil -lint` 構文検証）、`launchctl load`+`start`、30 秒の verify、まで一気通貫
11. 既存ファイルは `.bak.YYYYMMDD-HHMMSS` に退避してから上書き → 安全に再実行可能

### デスクトップアプリ対応の試行
12. 公式ドキュメントの記述「`~/.claude/` は CLI / デスクトップアプリ / VS Code / JetBrains で共有」を根拠に「全部使える」と実装したが、**実機検証で `/last30days` がデスクトップで Unknown command** と判明
13. 代替として **自作 `/last30` カスタムスラッシュコマンド** を `~/.claude/commands/last30.md` に実装したが、**こちらも desktop で Unknown command** と判明（プラグイン由来も自作カスタムも desktop の textual `/<cmd>` 入力では NG）
14. 最終的に **`~/.claude/skills/last30/SKILL.md` で同じロジックをスキル形式で実装**。「last30 スキルで Claude Code skills を調べて」と自然言語で頼めば全入口で動く設計に着地

---

## 3. チームへの学びシェア（7 つ）

### 🤖 学び 1: AI agent の自信満々の回答を鵜呑みにしない

- 公式ドキュメントを WebFetch で読む agent に「`~/.claude/` 共有だから skill も plugin も全入口で使える」と回答され、それを信じて docs に書いた
- 実機検証で **3 回連続で覆された**：`/last30days`（plugin）→ NG、`/last30`（custom command）→ NG、最後に `last30` スキル（自然言語呼び出し）でようやく desktop で動いた
- **教訓**: 「公式ドキュメントに `A は B` と書いてある」と「`A は実機で B と振る舞う`」は別問題。**動かして確認するまでは仮説**として扱う

### 🛠 学び 2: bootstrap スクリプトは「冪等性」が命

- 「ユーザーが Mac で 1 行貼るだけ」を実現するには、**何度叩いても壊れない**設計が必須
- 既存ファイルは `.bak.YYYYMMDD-HHMMSS` で退避してから上書き、launchd は `unload` してから `load` し直し、`plutil -lint` で構文検証
- このおかげで「機能追加 → bootstrap.sh 再実行で全員に反映」のフローが安全に成立

### 🔄 学び 3: 「実装変更不要」を提案できる agent が最も価値が高い

- 「デスクトップ対応してほしい」と言われた時、最初の agent は「`~/.claude/` 共有なので変更不要、明文化だけ」と提案 → 結果的にこれは半分正しく半分間違いだった
- 半分正しい部分：launchd 出力 .md と CLI 専用機能はその構成で正解
- 半分間違い部分：plugin command と custom slash command は desktop で動かない
- **教訓**: 「無改修で済む」提案は素晴らしいが、その**根拠を 1 段深く検証**しないと仮説が現実を上書きしてしまう

### 📡 学び 4: 「外部依存しすぎないチャネル選定」は重要

- `/last30days` プラグインは **ScrapeCreators API が有料**で X / YouTube / TikTok / Instagram が使えない
- ゼロコンフィグの Reddit / HN / Polymarket / GitHub だけで運用する判断 → 完全無料 + 永続的に動く構成に
- **教訓**: 「全機能使えるが有料」より「8 割で十分なら無料」の方が、長期的にはチームに継続利用される

### 🧬 学び 5: skill / command / plugin の使い分け

| 仕組み | 起動方法 | 動く場所 | 引数 |
|--------|----------|---------|------|
| **プラグイン由来コマンド**（`/plugin install` で入る） | `/<command>` | **CLI のみ** | あり |
| **カスタムスラッシュコマンド**（`~/.claude/commands/*.md`） | `/<command>` | **CLI のみ**（実機検証） | `$ARGUMENTS` |
| **スキル**（`~/.claude/skills/<name>/SKILL.md`） | 自然言語で「`<name>` スキルで〜」 | **CLI / デスクトップ / VS Code / JetBrains 全部** | プロンプト内に含めて渡す |

- **教訓**: 「全入口で使えるもの」を作りたいなら **スキル一択**。コマンド形式に固執するとデスクトップ対応で詰む

### 🗓 学び 6: 「ファイルベースの蓄積」は最強の API レス連携

- launchd で生成された `~/Documents/AI_Daily/*.md` はただの md ファイル
- これを CLAUDE.md ナレッジ参照ルール経由で「Claude Code がこのリポで作業する時に自動で読みに行く」運用にした
- API も Webhook もなく、**ファイル参照だけで AI が過去文脈を持つ**設計
- **教訓**: AI と連携させたいなら、まずファイルに落とせ。整形・標準化・差分判定はあとから自由に変えられる

### 🧪 学び 7: スペック駆動 + 自動マージで「自分が止まらない」開発体験

- ステアリングファイル（`steering/S080-*.md`）に進捗・スコープ・作業ログを記録 → 仕様の散逸を防止
- `auto-merge-claude.yml` が `claude/` ブランチを main に自動マージ → PR 作成・レビュー・マージの摩擦ゼロ
- 結果、本日 1 日で `S080` の 9 commit が main に積まれて Vercel 反映まで完走
- **教訓**: 「人間の承認」を待たない仕組みを CLAUDE.md と CI に書き込んでおくと、AI が完走できる

---

## 4. 今後のチーム展開（提案）

| 施策 | 工数 | 効果 |
|------|------|------|
| `bootstrap.sh` を Slack シェア → チーム全員の Mac で AI Daily 蓄積を回す | 極小 | 個別調査の重複ゼロ化 |
| 巡回対象 URL に **マーケ系メディア**（MarkeZine / DIGIDAY 等）を追加 | 小 | 業務直結ニュースの自動蓄積 |
| 蓄積された `AI_Daily/*.md` を **週次で Claude に要約させて Slack ポスト** | 小 | 受動的にチーム全員に届く運用 |
| Obsidian / Notion 等のチーム共有 Vault に `migrate-to-obsidian.sh` で接続 | 極小 | チームの集合知に統合 |
| `daily-watch` スキルに **「この URL の前回からの変更点を diff で出す」モード**を追加 | 中 | 巡回先サイトの細かな仕様変更を見逃さない |
| 「skill / command / plugin の使い分け」を社内ドキュメントに展開 | 小 | 他メンバーが Claude Code 拡張を作る時の判断基準が明確に |

---

## 5. 再現可能なレシピ

### 「Mac の常駐タスクで何かを毎朝動かしたい」最小テンプレ

```
project/
├── assets/setup/
│   ├── bootstrap.sh                    # ワンライナー curl|bash 用
│   ├── <feature>/SKILL.md              # ~/.claude/skills/<feature>/ にコピー
│   ├── launchd/<reverse-domain>.plist  # ~/Library/LaunchAgents/ にコピー
│   └── migrate-to-<destination>.sh     # 後で出力先を変更したくなった時用
├── docs/
│   └── <feature>-setup.md              # ユーザー向けランブック
├── steering/
│   └── S###-<feature>セットアップ.md   # 進捗管理
└── CLAUDE.md（プロジェクトルール ＋ AI に読ませたい運用ルール）
```

### bootstrap.sh の必須要素

1. **Preflight チェック**（OS / 必須バイナリ / バージョン）— 失敗したら即停止
2. **冪等性**（既存ファイルは `.bak.YYYYMMDD-HHMMSS` 退避 → 上書き）
3. **構文検証**（plist は `plutil -lint`、yaml は `yq` 等）
4. **テンプレート埋め込みは sed の `__PLACEHOLDER__` 規約**（区切りに `|` を使ってパスに含まれる `/` を回避）
5. **30 秒程度の grace 期間で出力ファイル生成を verify**

### スキル設計の原則

- 「全入口で動かしたい」なら **スキル一択**（カスタムコマンドは CLI 専用）
- SKILL.md の `description:` に「いつ呼び出してほしいか」「何ができるか」を 1〜2 文で書く（agent がこれを見て選ぶ）
- 出力フォーマットを `## TL;DR` 等で構造化しておくと、後段の処理（要約・転記・配信）が楽になる
- 数字（upvote / score / star 等）の併記を必須にすると「人気」とだけ書く曖昧出力を防げる

このレシピで「Mac 常駐 + AI 自動収集」系のチーム運用は **半日〜1日で構築可能**。

---

**以上。**

質問・フィードバック・横展開の相談ウェルカム。`bootstrap.sh` を試したい人は遠慮なく声かけてください、巡回対象 URL のカスタマイズも一緒にやります。
