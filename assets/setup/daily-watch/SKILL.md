---
name: daily-watch
description: 指定サイトの最新情報を取得して差分要約する。毎朝の定期実行を想定。
---

# Daily Watch Skill

毎朝7時(JST)に launchd から起動され、AI 関連の主要サイトを巡回し、新着のみを差分要約して保存する。

## 巡回対象 URL（初期セット）

- Anthropic News: https://www.anthropic.com/news
- Anthropic Engineering Blog: https://www.anthropic.com/engineering
- Claude Code Release Notes: https://docs.claude.com/en/release-notes/claude-code
- Claude Docs Map: https://docs.claude.com/en/docs/claude-code/claude_code_docs_map.md

> URL を追加・削除する場合は本ファイルのこのリストを直接編集する。

## 実行手順

1. 上記 URL それぞれに `WebFetch` でアクセスし、ページ本文（タイトル一覧・公開日・要約に必要な範囲）を取得する。

2. 前回取得時のスナップショット `~/Documents/AI_Daily/last_snapshot.json` を読み込む。
   存在しない場合は空オブジェクト `{}` で開始。
   形式:

   ```json
   {
     "https://www.anthropic.com/news": {
       "lastChecked": "2026-04-25T07:00:00+09:00",
       "knownEntries": [
         { "title": "...", "url": "...", "publishedAt": "..." }
       ]
     }
   }
   ```

3. 各サイトについて、`knownEntries` に含まれない記事を「新着」として抽出する。
   判定キー: 記事 URL を最優先、無い場合はタイトル文字列で代替。

4. 抽出した新着記事を以下のフォーマットで日本語要約する:
   - **タイトル**（原文ママ）
   - **発信日**（取得できた場合）
   - **要点**（3行以内、日本語、各行 60〜80 字目安）
   - **URL**（原文ママ）

5. 結果を `~/Documents/AI_Daily/YYYY-MM-DD.md` に保存する。
   ファイル先頭に以下のヘッダを必ず付ける:

   ```markdown
   # AI Daily — YYYY-MM-DD

   - 取得時刻: HH:MM (JST)
   - 新着件数: N 件
   - 巡回対象: 4 サイト（Anthropic News / Engineering / Claude Code Release Notes / Docs Map）
   ```

6. `last_snapshot.json` を最新状態に更新する（新着分を `knownEntries` に追記、`lastChecked` を現在時刻に）。

## 出力先

- `~/Documents/AI_Daily/YYYY-MM-DD.md`（毎日 1 ファイル、過去分は残す）
- `~/Documents/AI_Daily/last_snapshot.json`（差分判定用、毎回上書き）

## 注意事項

- 新着が 0 件の日でも、空のファイルは作らず「**本日の新着なし**」と本文に明記したファイルを残す（運用が止まっていないことの証跡）
- `WebFetch` がブロックされた・タイムアウトした場合は **そのサイトだけスキップ**し、本文末尾の「## エラーログ」セクションに `- {URL}: {理由}` を追記する。他サイトの処理は止めない
- 同じ記事が複数サイトに出現する場合、最初に検出したサイトの新着としてのみ記録する（重複要約を避ける）
- 要約は **日本語**。英文記事も日本語で要点を書く
- robots.txt または利用規約で巡回を禁止しているサイトは除外する
- 出力ファイルに API キー・認証情報を絶対に書き込まない
