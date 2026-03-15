# S011 AKKODiSサイト監視ウォッチャー

## 目的

AKKODiSグローバルサイトのブログに新着記事が追加されたら、Webダッシュボードで確認できるようにする。

## スペック

### 監視対象
- URL: `https://www.akkodis.com/en/blog`
- チェック頻度: 毎日1回（GitHub Actions cron）

### 構成

```
apps/akkodis-watcher/
  index.html          # ダッシュボード（記事一覧・新着ハイライト）
  data/
    articles.json     # スクレイピング結果（GitHub Actionsが更新）
  scraper.py          # スクレイピングスクリプト
  requirements.txt    # Python依存
.github/workflows/
  akkodis-check.yml   # 毎日1回実行するGitHub Actions
```

### データフロー

1. GitHub Actions（毎日JST 9:00）が `scraper.py` を実行
2. `scraper.py` がAKKODiSブログをスクレイピングし `articles.json` に保存
3. 差分があればコミット・プッシュ
4. `index.html` が `articles.json` を読んで記事一覧を表示

### Web UI 仕様

- 記事一覧をカード形式で表示（タイトル・日付・URL）
- 前回訪問以降の新着は「NEW」バッジでハイライト（localStorage管理）
- 最終スクレイピング日時を表示
- 他のアプリと同じデザインテイスト

### 通知
- なし（Webダッシュボードのみ）

### apps/index.html への追加
- 他アプリと同様にリストへ追加

## ステータス

完了（2026-03-15）

- [x] scraper.py 実装
- [x] articles.json 初期データ作成
- [x] GitHub Actions ワークフロー実装
- [x] index.html（ダッシュボード）実装
- [x] apps/index.html にリンク追加

## 作業ログ

- 2026-03-14: ステアリングファイル作成
