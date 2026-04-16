# [S074] AI NEWS — RSS自動収集 + Anthropic要約 + GitHub Actions cron

**ステータス**: 進行中
**作成日**: 2026-04-15
**完了日**: —

---

## 目的

S073で作成した AI NEWS アプリを「**毎朝8:00 JST に最新ニュースが自動更新される**」状態にする。
シードデータ表示から実データ駆動に進化させ、マーケメンバーが朝イチでアクセスするだけで前日の動向を把握できる体験を実現する。

---

## スコープ

### やること

**A. 収集スクリプト `apps/ai-news/scraper.py`**
- [ ] マーケ／市場・業界／AI 系の RSS フィードを横断取得（直近約36時間分）
- [ ] 重複排除（URL基準）・公開時刻降順ソート
- [ ] Anthropic Claude Haiku で日本語サマリー（〜140字）と日本語タグを生成
- [ ] APIキー無し or API失敗時は RSS 元 description を簡易整形してフォールバック
- [ ] 出力: `apps/ai-news/data/news.json`（最新）+ `apps/ai-news/data/archives/YYYY-MM-DD.json`（履歴）

**B. ワークフロー `.github/workflows/ai-news-collect.yml`**
- [ ] cron `0 23 * * *`（UTC 23:00 = JST 08:00）+ 手動実行可
- [ ] Python 3.12 + `apps/ai-news/requirements.txt`
- [ ] 既存 `ANTHROPIC_API_KEY` シークレットを利用
- [ ] 変更があれば `data/` を `[skip ci]` でコミット&push

**C. アプリ改修 `apps/ai-news/app.js`**
- [ ] 起動時に `./data/news.json` を fetch
- [ ] 取得成功 → `NEWS_DATA` を上書き、`updatedAt` をヒーローに反映
- [ ] 取得失敗 / 空 → 既存シードデータにフォールバック（オフライン耐性）
- [ ] X（旧Twitter）ハイライトは引き続きバンドル静的データ（API有料化のため別タスクで検討）

**D. 依存・ドキュメント**
- [ ] `apps/ai-news/requirements.txt` 新規（`feedparser`, `anthropic`）
- [ ] `docs/design.md` の AI NEWS 行を「シードデータ」→「RSS自動収集（毎朝8時 JST）」に更新
- [ ] `index.html` の WHAT'S NEW にエントリ追加（UPDATE）
- [ ] AI NEWS のオンボーディング `updates` に1行追加

### やらないこと

- X / Threads など API 認証必須のソース（別タスク）
- ユーザー側のリアルタイム subscribe / push 通知
- 記事本文の全文取得（要約は description ベース）
- メール送信（既存 `daily-ai-news.yml` で実施済み）

---

## 完了条件

- [ ] `python apps/ai-news/scraper.py` をローカル実行で `data/news.json` が生成される（APIキー無しでも動く）
- [ ] アプリが `news.json` を読み、ヒーローに「最終更新 MM/DD HH:MM」が出る
- [ ] ワークフローが手動実行で成功し、`apps/ai-news/data/news.json` が更新される
- [ ] ワークフロー失敗時の影響がアプリに波及しない（フォールバック動作）
- [ ] WHAT'S NEW・design.md・オンボーディング更新済み

---

## 影響ファイル

| ファイル | 種別 |
|---------|------|
| `apps/ai-news/scraper.py` | 新規 |
| `apps/ai-news/requirements.txt` | 新規 |
| `apps/ai-news/data/news.json` | 新規（初回ダミーコミット可） |
| `apps/ai-news/data/.gitkeep` または `archives/.gitkeep` | 新規 |
| `apps/ai-news/app.js` | 変更（fetch + フォールバック） |
| `apps/ai-news/index.html` | 変更（オンボーディング `updates` 追加） |
| `.github/workflows/ai-news-collect.yml` | 新規 |
| `index.html` | 変更（WHAT'S NEW） |
| `docs/design.md` | 変更 |

---

## 参照

- `apps/akkodis-watcher/scraper.py`, `.github/workflows/akkodis-watcher.yml` — 同種パターン
- `scripts/fetch_and_send.py` — Anthropic SDK 利用例
- `steering/S073-AI-NEWS.md` — 親タスク

---

## 作業ログ

- 2026-04-15: PR #247 マージ済み（プロダクション反映）。本タスクで自動収集仕組みを別PRで追加する方針。
- 2026-04-15: 実装完了。`scraper.py`（feedparser+anthropic、API失敗時は素朴フォールバック）、`requirements.txt`、`.github/workflows/ai-news-collect.yml`（cron 23:00 UTC = 08:00 JST）、`apps/ai-news/data/news.json`（空ペイロード初期値）、`app.js`（loadRemote→失敗時シードのフォールバック）。
- 2026-04-15: ユーザー指摘「UIぐちゃぐちゃ」「どれが重要かわからない／10分でわかる一覧にしたい」を受け、レイアウトを TOP STORY（重要度1の1件・大カード）／BRIEFING（重要度2の5件・番号付きリスト）／MORE READS（残り・1行リスト）／X HIGHLIGHTS（3件カード）に再設計。`importance` フィールドを scraper の Claude プロンプトと fallback ロジックに追加。読了時間（readMin）バッジを各セクションに表示。
