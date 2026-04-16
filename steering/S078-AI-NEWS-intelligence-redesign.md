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
- 2026-04-16: Executive Summary → 「今日のアクション」（期限付きTo-Do形式）に改善。ナビバー統一、既読トグル、元記事ボタン、日本人X投稿追加。シードデータのsummary/whyItMatters被り解消。scraperプロンプトをAKKODiS採用マーケ・B2B視点に最適化。
- 2026-04-16: ユーザーFBを反映し全面改修。全UI日本語化（英語テキスト全廃）。セクション名を「重要ニュース／注目ニュース／その他のニュース」に変更。Executive Summaryを期限なし3行サマリーに簡素化。日付ナビゲーション追加（過去記事閲覧）。Xトレンドを日本語投稿・Claude Code中心に。カテゴリ色をネイビー統一。シードデータURLを記事ページ風に修正。scraperプロンプトを日次更新に適したラベルに変更。
- 2026-04-16: UI品質強化。記事サムネイル画像追加（シード+scraper OGP抽出）。Web Speech APIによる音声読み上げ機能。インテリジェンスブロックの色味簡素化。注目ニュースカードにマガジン風レイアウト。ソートにimportanceを加味。
- 2026-04-16: NewsPicks風機能追加。Picker風専門家コメント（scraper+シード）。高品質音声読み上げ（OpenAI TTS API + Web Speech APIフォールバック）。スワイプ日付移動。閲覧傾向パーソナライズ。
- 2026-04-16: UX改善。AIダイジェスト音声（Claude Haiku要約→OpenAI TTS、フォールバック：ブラウザTTS）。その他ニュースをカード形式にリデザイン（サムネ・whyItMatters・actionItem表示）。クリックで元記事を開くよう修正。シードデータの偽URLを排除しリンク安全性を強化。元記事リンクはURL存在時のみ表示。
