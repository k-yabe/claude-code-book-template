# [S073] Marketing Radar — マーケティングニュースアグリゲーター

**ステータス**: 進行中
**作成日**: 2026-04-15
**完了日**: —

---

## 目的

マーケティングメンバーが「前日のマーケ＆市場ニュース」を1画面でキャッチアップできるアプリを追加する。Global Antenna（社内記事監視）とは別に、外部メディアのRSSを日次でアグリゲートし、カテゴリ別にダイジェスト表示する。

---

## スコープ

### やること
- [x] 新規アプリ `apps/marketing-radar/` を作成
- [x] RSS ベースの scraper（Python / feedparser）で複数メディアを巡回
- [x] `data/news.json` に正規化（タイトル・URL・要約・ソース・カテゴリ・公開日時）
- [x] カテゴリ（マーケ／海外マーケ／ビジネス／テック・AI／SNSピック）で分類
- [x] UI: ヒーロー（前日のハイライト）→ カテゴリタブ → カードグリッド
- [x] 日付フィルタ（昨日／今日／7日間／全期間）
- [x] GitHub Actions で毎日 JST 7:00（UTC 22:00）に scraper を実行し自動コミット
- [x] Marketing Apps ポータル（ルート `index.html`）にカード追加・NEWバッジ
- [x] WHAT'S NEW 更新（NEWバッジ）
- [x] AKKODiS ブランドカラー準拠（Navy/Gold/Cyan）

### やらないこと（スコープ外）
- Twitter/X スクレイピング（RSS不可のため、将来 curated.json 手動追記で対応）
- ログイン毎のパーソナライズ（将来：お気に入りメディア設定）
- AI要約（将来：Anthropic API で3行要約を付与）
- 記事本文のフルテキスト取得（RSSの description で十分）

---

## 完了条件

- [x] `apps/marketing-radar/index.html` を開くと seed データが表示される
- [x] scraper を手動実行して `news.json` が更新される
- [x] GitHub Actions が scheduled 実行できる（cron 設定済み）
- [x] ポータル `index.html` から新規カードで遷移できる
- [x] WHAT'S NEW に NEW バッジでエントリ追加
- [x] 主要ブラウザ（Chrome/Safari/Edge）で表示崩れなし（レスポンシブ 375px〜）

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/marketing-radar/index.html` | 新規 |
| `apps/marketing-radar/scraper.py` | 新規 |
| `apps/marketing-radar/requirements.txt` | 新規 |
| `apps/marketing-radar/data/news.json` | 新規（seed） |
| `.github/workflows/marketing-radar.yml` | 新規 |
| `index.html` | 変更（カード追加・WHAT'S NEW追記） |
| `docs/design.md` | 変更（新規アプリの項を追加） |

---

## 参照

- `docs/design.md` — Marketing Radar セクション
- `apps/akkodis-watcher/` — 類似パターン（scraper → JSON → 表示）
- `.github/workflows/akkodis-watcher.yml` — 日次 GitHub Actions の参考

---

## 作業ログ

### 2026-04-15
- ユーザー要望ヒアリング：マーケ＋市場＋SNS有益情報、前日の内容がわかる、Marketing Apps に追加
- 設計決定：
  - SNSは RSS 対応しにくいので初期は「RSS + 手動キュレーション運用」。将来 Nitter 等の代替手段を検討
  - scraper は Python + feedparser（Playwright 不要）で軽量化
  - seed JSON を同梱して scraper 未実行でも UI が動く状態にする
- 実装一式を1コミットで投入（MVP）
- メディアソース（初期）：
  - **マーケ（JP）**: MarkeZine, Web担当者Forum, AdverTimes, ITmedia Marketing
  - **マーケ（Global）**: MarTech, Marketing Week, HubSpot Blog
  - **ビジネス**: 日経クロストレンド, Reuters Business, PRTIMES（マーケカテゴリ）
  - **テック・AI**: TechCrunch Japan, ITmedia NEWS
