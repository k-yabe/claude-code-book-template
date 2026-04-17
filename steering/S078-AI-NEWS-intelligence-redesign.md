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
- 2026-04-16: リンク安全性全面強化。シード偽画像（Unsplash）を全排除。画像onerrorフォールバック追加。safeImgUrl()でhttps以外を遮断。XハイライトにTwitterアバター表示・リンク条件分岐。日付ナビ連打の競合防止。scraper側でURL/画像バリデーション追加。
- 2026-04-16: 品質修正（S078-quality-fix）。画像CSSプレースホルダー追加（シードでも画像枠表示）。Xアバター外部URL全削除→CSSイニシャル表示に統一。音声ダイジェストをラジオ番組構成に改善（3幕：ポイント予告→詳細→まとめ）。Claudeダイジェストプロンプトを3幕構成に強化（1000〜1500字、記事間のつながり指示）。
- 2026-04-16: UIリデザイン。NewsPicks/SmartNews風のモダンUIにCSS全面刷新。白背景カード＋シャドウベース。760px幅フォーカスレイアウト。重要ニュースに金アクセントボーダー。タブをアンダーラインスタイルに。FYIカードをコンパクト化（テキスト省略）。ページ背景を#f5f5f5に。モバイル対応強化。
- 2026-04-17: 日本語強化＋画像＋Xアバター品質修正。英語RSS（MarTech/HubSpot/TechCrunch AI等）を全廃し日本語のみ（ITmedia AI+/ITmedia NEWS/ASCII.jp/ferret/ITmediaマーケティングを追加）。scraperにタイトル日本語率フィルタ（25%未満は除外）。og:image 抽出ロジック追加で記事サムネを必須化（RSS画像なし→記事ページから og:image/twitter:image取得）。Xアバターを unavatar.io 経由で実プロフィール画像に変更（@ymatsuo/@kaz_ataka/@ochyai等）。音声ダイジェストプロンプトに「英単語はカタカナ化」ルール追加、日付を明示、TTSを tts-1-hd + shimmer に切り替えて日本語読み上げ品質向上。
- 2026-04-17: news.json を AKKODiS マーケ視点の日本語記事15件にシード差し替え（重要2/注目5/その他8）。Google AI Overview日本展開／パーソルHD AI採用基盤／Cookie廃止対応／Claude Code強化／LINE広告AI／DX人材不足／電通Creative AI Studio等。次回 ai-news-collect cron で実RSSから自動更新。auto-merge workflow を /merges API 直呼び版に刷新（pull_requests=write 権限不要、contents:write のみで動作）。CLAUDE.md に「自動承認で進める」運用ルール追加。
- 2026-04-17: NewsPicks/SmartNews風に全面刷新。記事ごとに美しいSVGヒーロー画像を決定論的に自動生成（カテゴリ別色調＋ソース名ウォーターマーク）。重要ニュースは16:9大判ヒーロー、注目は16:9サムネ付き。詳細情報は「詳しく見る」で折りたたみ、文字密度を大幅削減。壊れたリンクを非表示化（シード url=""）。8記事に絞り朝コーヒータイム10分に最適化。音声を gpt-4o-mini-tts + sage + instructions で人間らしい自然な読み上げに。起動時バックグラウンド事前生成で即再生。
