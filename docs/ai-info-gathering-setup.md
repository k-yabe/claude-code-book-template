# AI情報収集の自動化セットアップ — ランブック

> **対象**: ユーザーのローカル macOS 環境（MacBook Air M3、常時稼働サーバー想定）
> **関連ステアリング**: `steering/S080-AI情報収集セットアップ.md`
> **方針**: 完全無料の範囲で実装する。有料 API は使わない。

このランブックは、ユーザーが自分の Mac で順番に実行するためのもの。本リポジトリ側で用意済みの成果物（テンプレート）を **コピー → 置換 → 起動** するだけで完了するように構成してある。

---

## 構築するもの

1. **`/last30days` スキル** — Reddit / Hacker News / Polymarket / GitHub / WebSearch を横断する SNS リサーチ
2. **`daily-watch` スキル + launchd** — 指定サイトを毎朝 07:00 JST に巡回し、新着のみを差分要約して `~/Documents/AI_Daily/` に蓄積
3. **ナレッジベース連携（任意）** — 取得結果を Obsidian Vault などから過去文脈として参照可能にする

## CLI とデスクトップアプリの両対応について

**install は 1 回で OK**。Claude Code は CLI / デスクトップアプリ / VS Code 拡張 / JetBrains プラグインで `~/.claude/` を共有しているため（公式: *Configuration file locations*）、後述の bootstrap.sh で `~/.claude/skills/daily-watch/SKILL.md` と `/last30days` プラグインが入れば、**すべての入り口から同じように呼び出せます**。

| 入り口 | 使い方 |
|--------|--------|
| CLI | `claude` で対話モード起動 → `/last30days <query>` または `daily-watch` を要求 |
| デスクトップアプリ | `/` メニューから `last30days` を選択、または `daily-watch` をスキル一覧から起動 |
| VS Code 拡張 | コマンドパレット経由で同じスキル |
| JetBrains プラグイン | 同上 |

毎朝 07:00 の launchd 自動実行は **CLI 経由**（`claude -p "use the daily-watch skill"`）で動きます。生成された `~/Documents/AI_Daily/YYYY-MM-DD.md` はディスク上のファイルなので、デスクトップアプリ含めどこからでも参照できます。

---

## ⚡ ワンライナー・セットアップ（推奨）

Mac の Terminal に以下の **1 行を貼るだけ** で Phase 1 + Phase 2 が自動セットアップされる:

```bash
curl -fsSL https://raw.githubusercontent.com/k-yabe/claude-code-book-template/main/assets/setup/bootstrap.sh | bash
```

スクリプトの実体は `assets/setup/bootstrap.sh`。やること:

- macOS / `claude` バイナリ / バージョン 1.0+ の preflight チェック
- `/plugin marketplace add` + `/plugin install last30days@last30days-skill` の自動実行（headless が失敗した場合は対話で再実行する案内を表示）
- `~/.claude/skills/daily-watch/SKILL.md` の設置（既存は `.bak.YYYYMMDD-HHMMSS` に退避）
- `~/Documents/AI_Daily/` 作成
- `~/Library/LaunchAgents/com.kunito.daily-watch.plist` を `which claude` の結果で置換しつつ設置（既存 plist は退避＋ unload）
- `plutil -lint` で構文検証
- `launchctl load` → `launchctl start` で即時実行
- 30 秒以内の出力ファイル生成を verify

冪等で安全に再実行できる。Phase 3（Obsidian 連携）はパス確定後に手動で SKILL.md と plist の出力先を書き換える運用。

うまく動かない場合は次セクションの手動手順を参照。

---

## 制約・前提

- Claude Code 1.0 以上が必要（`claude --version`）
- X / YouTube / TikTok / Instagram の `/last30days` 連携は **ScrapeCreators API が有料のため使わない**
- `/last30days` のゼロコンフィグ範囲（Reddit / HN / Polymarket / GitHub / WebSearch）のみで運用
- 不足は Claude Code 標準の `WebSearch` + `WebFetch` で補完

---

## Phase 1: `/last30days` スキルの導入

### 手順

1. バージョン確認:

   ```bash
   claude --version
   ```

   1.0 未満の場合は先にアップデート（`npm i -g @anthropic-ai/claude-code` 等）してから先に進むこと。

2. Claude Code 内で順に実行:

   ```
   /plugin marketplace add mvanhorn/last30days-skill
   /plugin install last30days@last30days-skill
   ```

3. 動作確認:

   ```
   /last30days Claude Code skills
   ```

4. 「APIキーが無いが WebSearch で代替する」旨のメッセージが出ても無視して続行。Reddit / HN / Polymarket / GitHub / WebSearch だけで動くことを確認する。

5. レポートが `~/Documents/Last30Days/` に `.md` ファイルとして保存されることを確認。

### 完了条件

- レポートファイルが生成され、`~/Documents/Last30Days/` に保存されている
- レポート内に Reddit のアップボート数または HN のスコアが含まれている

---

## Phase 2: 定期巡回スキル（`daily-watch`）の構築

### Phase 2.0: 巡回対象の確定

初期セット（必要に応じてユーザーが追加・削除）:

- Anthropic News: https://www.anthropic.com/news
- Anthropic Engineering Blog: https://www.anthropic.com/engineering
- Claude Code Release Notes: https://docs.claude.com/en/release-notes/claude-code
- Claude Docs Map: https://docs.claude.com/en/docs/claude-code/claude_code_docs_map.md

URL を変更する場合は Phase 2.1 でコピーした SKILL.md の「巡回対象 URL」セクションを直接編集する。

### Phase 2.1: スキルの設置

```bash
# スキルディレクトリ作成
mkdir -p ~/.claude/skills/daily-watch
mkdir -p ~/Documents/AI_Daily

# 本リポジトリからテンプレートをコピー（リポジトリのパスは適宜置換）
cp <repo>/assets/setup/daily-watch/SKILL.md ~/.claude/skills/daily-watch/SKILL.md
```

> リポジトリを `~/work/claude-code-book-template` に clone している場合:
>
> ```bash
> cp ~/work/claude-code-book-template/assets/setup/daily-watch/SKILL.md ~/.claude/skills/daily-watch/SKILL.md
> ```

### Phase 2.2: 動作テスト（launchd 登録前）

```bash
claude -p "use the daily-watch skill"
```

`~/Documents/AI_Daily/YYYY-MM-DD.md` が生成されていれば成功。失敗する場合は SKILL.md を修正してから次に進む。

### Phase 2.3: claude のフルパス取得

```bash
which claude
# 例: /Users/yabekunito/.npm-global/bin/claude
```

返ってきたパスを控える。次のステップで plist に埋め込む。

### Phase 2.4: launchd plist の設置

```bash
# 1. テンプレートを LaunchAgents にコピー
cp <repo>/assets/setup/launchd/com.kunito.daily-watch.plist ~/Library/LaunchAgents/com.kunito.daily-watch.plist

# 2. プレースホルダを実パスに置換（CLAUDE_PATH には Phase 2.3 の結果を入れる）
CLAUDE_PATH="$(which claude)"
# macOS の sed は -i に空文字を要求するので注意
sed -i '' "s|__CLAUDE_PATH__|${CLAUDE_PATH}|g" ~/Library/LaunchAgents/com.kunito.daily-watch.plist

# 3. 置換結果の確認（ProgramArguments の最後の文字列に絶対パスが入っているはず）
grep -A1 ProgramArguments ~/Library/LaunchAgents/com.kunito.daily-watch.plist
```

### Phase 2.5: launchd 登録 + 即時実行テスト

```bash
launchctl load ~/Library/LaunchAgents/com.kunito.daily-watch.plist
launchctl list | grep daily-watch     # com.kunito.daily-watch が出れば登録成功
launchctl start com.kunito.daily-watch # 即時実行
```

確認:

- `/tmp/daily-watch.log` — 標準出力
- `/tmp/daily-watch.error.log` — 標準エラー
- `~/Documents/AI_Daily/YYYY-MM-DD.md` — 当日の新着レポート

### 完了条件

- `~/Documents/AI_Daily/YYYY-MM-DD.md` が手動・launchd 両方で生成される
- `/tmp/daily-watch.error.log` にエラーが無い（または無視可能なエラーのみ）
- 翌朝 07:00 に自動実行される

---

## Phase 3: ナレッジベース連携

### 3-A. CLAUDE.md のナレッジ参照ルール（既に追記済み）

本リポジトリの `CLAUDE.md` には既に「ナレッジ参照ルール（AI Daily）」セクションが入っている（S080 の一環）。Claude Code がこのリポで作業する際、AI / Claude Code の動向を問う質問が来たら `~/Documents/AI_Daily/`（Obsidian 移行後は Vault 配下）の関連 .md を読んで回答する運用になる。

ファイルが存在しない・読めない環境（Web サンドボックス等）では無理に読みに行かず通常知識で回答する設計にしているため、Obsidian 連携の有無に関わらず安全。

### 3-B. Obsidian Vault への移行（任意・自動）

Obsidian を使い始めたら、Mac の Terminal に **1 行貼るだけ** で出力先を Vault に切り替えられる:

```bash
curl -fsSL https://raw.githubusercontent.com/k-yabe/claude-code-book-template/main/assets/setup/migrate-to-obsidian.sh \
  | bash -s -- ~/Obsidian/MyVault
```

スクリプトの実体は `assets/setup/migrate-to-obsidian.sh`。やること:

- Vault パスの存在検証
- `~/Documents/AI_Daily/` の既存 .md と `last_snapshot.json` を `<Vault>/AI_Daily/` にコピー（既存は `.bak.YYYYMMDD-HHMMSS` に退避）
- `~/.claude/skills/daily-watch/SKILL.md` の出力先パスを sed で書き換え（バックアップ取得）
- `launchctl unload` → `load` で新しい SKILL.md を反映
- 元の `~/Documents/AI_Daily/` は残す（手動で削除可）

冪等。Vault パスを変えて再実行も可能（その場合は新しい Vault に再コピー）。

### 完了条件

- 本リポジトリの `CLAUDE.md` に「ナレッジ参照ルール（AI Daily）」セクションが入っている（S080 で追記済み）
- （任意）Obsidian 移行後、`<Vault>/AI_Daily/YYYY-MM-DD.md` が翌朝の launchd 自動実行で生成される

---

## エラー時の標準対処

| 症状 | 確認・対処 |
|------|-----------|
| `/plugin install` が失敗 | `claude --version` で 1.0 以上か確認 |
| `/last30days` がレポートを返さない | `~/.claude/plugins/` にスキルが入っているか・`/plugin list` で確認 |
| `WebFetch` がブロックされる | 対象サイトの robots.txt を確認、別サイトに置き換え |
| launchd が動かない | `launchctl list \| grep daily-watch` で登録状態確認、plist の構文を再チェック |
| 朝 07:00 に動かない | Mac がスリープ中の可能性。`pmset -g sched` で起動スケジュールを確認、必要なら `sudo pmset repeat wakeorpoweron MTWRFSU 06:55:00` |
| plist 編集が反映されない | `launchctl unload` → 編集 → `launchctl load` の順で再読込 |

---

## 進め方の原則

- Phase 1 → 2 → 3 の順に進める
- 各 Phase 完了時に動作確認してから次へ
- ファイル設置・コマンド実行の前に、内容を必ず確認する
- 不明点があれば独断で進めず立ち止まる
