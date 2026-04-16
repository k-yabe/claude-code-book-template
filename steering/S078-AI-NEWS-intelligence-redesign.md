# [S078] AI NEWS — インテリジェンス・ブリーフ化（設計から再構築）

**ステータス**: 進行中
**作成日**: 2026-04-16
**完了日**: —

---

## 背景・課題

ユーザーフィードバック:
- 「デザインも内容もわかりにくい」
- 「具体的にどう実務に役立つかわからない」
- 「視認性が悪い。RSSサイトと変わらない」
- 「なぜマーケで役立つのか、キャッチアップすべきか、そういう設計から考えてほしい」

**根本原因: データモデルが貧弱。** scraperが生成するのは `summary` `tags` `importance` だけ。
UIをどう整えても、元データが「記事の要約」でしかないため、RSSリーダーと差別化できない。

---

## コンセプト

**ニュースを届けるのではなく、判断材料を届ける。**

「昨日こんなニュースがありました」→「昨日の動きを踏まえて、今週こう動くべきです」

---

## スコープ

### A. データモデル拡張（scraper.py）
- [x] Claude プロンプトに3フィールド追加:
  - `whyItMatters` — マーケ担当にとってなぜ重要か（1文）
  - `actionItem` — 推奨アクション（1文、具体的に）
  - `urgency` — `must_know` / `this_week` / `fyi`
- [x] 全記事を俯瞰した `executiveSummary`（3行箇条書き）を news.json トップレベルに追加
- [x] fallback_summarize も同構造に対応

### B. ページ構造の再設計（app.js + index.html）
- [x] ① EXECUTIVE SUMMARY セクション新設（冒頭3行で今日の全体像）
- [x] ② MUST-KNOW（旧TOP STORY）: 「何が起きた？」「マーケへの影響」「Next Step」の3段構成
- [x] ③ THIS WEEK（旧BRIEFING）: 影響ひとこと + 推奨アクション付きカード
- [x] ④ FYI（旧MORE READS）: コンパクトリスト（現状ベース）
- [x] urgency ベースの仕分け（importance → urgency に移行）

### C. 視覚デザイン
- [x] urgency に応じた色分け・アイコン
- [x] EXECUTIVE SUMMARY の金アクセント帯
- [x] アクション行の視覚的強調
- [x] セクション名の日本語化（ユーザーが直感的に理解できる）

### やらないこと
- X HIGHLIGHTS の大幅変更
- 新たなAPIサービス追加
- 認証・権限の変更

---

## 完了条件

- [x] scraper.py が whyItMatters / actionItem / urgency / executiveSummary を生成する
- [x] 冒頭に「今日の要点」3行が表示される
- [x] 各記事に「マーケへの影響」と「Next Step」が表示される
- [x] urgency で must_know / this_week / fyi に自動分類される
- [x] シードデータでも新UIが動作する
- [x] モバイルで崩れない

---

## 影響ファイル

| ファイル | 種別 |
|---------|------|
| `apps/ai-news/scraper.py` | 大幅変更（プロンプト・スキーマ） |
| `apps/ai-news/app.js` | 大幅変更（レンダリング・仕分けロジック） |
| `apps/ai-news/index.html` | 大幅変更（CSS・HTML構造） |
| `index.html` | 変更（WHAT'S NEW） |
| `docs/design.md` | 変更 |

---

## 作業ログ

- 2026-04-16: タスク起票。RSSリーダーからインテリジェンス・ブリーフへの根本再設計。
