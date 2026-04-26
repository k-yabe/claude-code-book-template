---
name: last30
description: 過去30日(直近1ヶ月)のAI関連トレンドを Reddit / Hacker News / GitHub / 公式発表で横断リサーチして要点ブリーフィングを返す。プラグイン由来の /last30days はデスクトップアプリで動かないので、その代替として全入口（CLI/デスクトップ/IDE）から自然言語で呼び出せるようスキル形式で実装した版。
---

# Last30 Skill

過去 30 日（直近約 1 ヶ月）の AI / Claude Code / 開発者コミュニティ動向を横断調査し、構造化されたブリーフィングを返すスキル。

**呼び出し方:**
- 「last30 スキルで Claude Code を調べて」
- 「last30 を使って Claude Agent SDK の30日トレンドをまとめて」
- 「過去30日の MCP サーバー動向を last30 で」

## 実行手順

ユーザーの依頼から **主軸キーワード** を抽出し、過去 30 日の動向を以下のソースを `WebSearch` と `WebFetch` で横断調査する:

1. **Hacker News** — `site:news.ycombinator.com <キーワード>` で WebSearch、ヒットしたら詳細 URL を WebFetch して score 確認
2. **Reddit** — `site:reddit.com/r/ClaudeAI OR r/LocalLLaMA OR r/MachineLearning OR r/programming <キーワード>` で WebSearch、月間 top を抽出
3. **GitHub** — `site:github.com <キーワード>` で WebSearch、star 数が高い・最近活発なリポジトリを抽出
4. **Anthropic / OpenAI / Google DeepMind** の公式発表ページ
5. その他 WebSearch で浮上する主要メディア

## 出力フォーマット

```markdown
# Last30 Brief — <主軸キーワード> （取得日: YYYY-MM-DD）

## TL;DR
- 3 行で過去30日の要点。

## 🔥 Top Stories（5件）
1. **タイトル** — Source / upvote or score など数字
   - URL
   - 30〜60字の日本語要約

## 📦 Trending Repos（3件）
- `owner/repo` ★N — 1行説明

## 📣 Notable Releases / Announcements（3件）
- 発信元・日付・要点

## 🎯 Themes / Sentiment
3〜5 個の bullet。

## 🔗 さらに掘る
3〜5 URL。
```

## ルール

- 数字（upvote / score / star）は **必ず併記**。「人気」とだけ書くのは禁止
- 推測ではなく取得できた情報のみ。ソース URL を必ず併記
- 出力は日本語。英文ソースの内容も日本語で要点化
- 30 日以上前の記事は除外
- 主軸キーワードから逸れたトピックは載せない

## プラグイン版との違い

`mvanhorn/last30days-skill` プラグイン由来の `/last30days` はプラグインのスラッシュコマンド経由で動くため CLI 専用。本スキルは `~/.claude/skills/last30/` に置かれた **通常スキル** なので、CLI / デスクトップアプリ / VS Code 拡張 / JetBrains プラグインのいずれからも自然言語で起動可能。

ScrapeCreators API を使う X / YouTube / TikTok / Instagram は対象外（プラグイン版と同じ制約）。代わりに WebSearch + WebFetch で取れる範囲を最大限活用する。
