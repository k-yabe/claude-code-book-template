---
description: 過去30日(直近1ヶ月)のAI関連トレンドを Reddit / Hacker News / GitHub / 公式発表で横断リサーチして要点ブリーフィングを返す。プラグイン由来の /last30days と違い、CLI / デスクトップアプリ / IDE 拡張のすべてから呼び出せる軽量カスタム版。
argument-hint: <調査したいキーワード>（例: Claude Code skills）
---

# /last30 — AI トレンド 30日横断リサーチ

主軸キーワード: **$ARGUMENTS**

過去 30 日（直近約 1 ヶ月）の AI / Claude Code / 開発者コミュニティ動向について、上記キーワードを軸に以下のソースを `WebSearch` と `WebFetch` で横断調査して、構造化されたブリーフィングを日本語で返してください。

## 調査ソース

1. **Hacker News** — 過去 30 日の top stories でキーワード関連（`site:news.ycombinator.com $ARGUMENTS` を WebSearch、必要なら直接 WebFetch）
2. **Reddit** — `r/ClaudeAI` `r/LocalLLaMA` `r/MachineLearning` `r/programming` の月間 top（`site:reddit.com $ARGUMENTS` を WebSearch、ピックアップ後 WebFetch でスコア確認）
3. **GitHub Trending** — 過去 30 日でキーワード関連の人気リポジトリ（`site:github.com $ARGUMENTS` で star 数の高いものを優先）
4. **Anthropic / OpenAI / Google DeepMind** の公式発表・ブログ記事
5. その他 WebSearch で浮上した主要メディア（TechCrunch / The Verge / Ars Technica / 日本語メディア）

## 出力フォーマット

```markdown
# Last30 Brief — $ARGUMENTS （取得日: YYYY-MM-DD）

## TL;DR
- 過去30日で起きたことを 3 行で。

## 🔥 Top Stories（5件）
1. **タイトル** — Source / 数字（upvote / score / star など必ず付ける）
   - URL: …
   - 要約（30〜60字、日本語）

## 📦 Trending Repos（3件）
- `owner/repo` ★N — 1行説明（日本語）

## 📣 Notable Releases / Announcements（3件）
- 発信元・日付・要点（1行）

## 🎯 Themes / Sentiment
コミュニティで盛り上がっている話題、論争、コンセンサスを 3〜5 個の bullet で。

## 🔗 さらに掘る
- 関連 URL を 3〜5 個
```

## ルール

- 数字（upvote / HN score / GitHub star 等）は **必ず併記**。「人気」と書くだけでは不十分
- 推測ではなく取得できた情報のみを書く。ソースの URL を必ず併記
- 日本語で出力。英文ソースの内容も日本語で要点を書く
- 30 日以上前の記事は除外
- 主軸キーワード `$ARGUMENTS` から逸れる雑多なトピックは載せない
