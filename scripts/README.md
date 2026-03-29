# AI日報 自動配信システム

毎朝7時（JST）に生成AIの最新ニュースを自動収集・まとめて、メールで配信するシステムです。

## 構成図

```
GitHub Actions (cron: 毎朝7時JST)
    │
    ├─ Claude API (claude-sonnet-4-6)
    │   └─ ニュース生成・まとめ
    │
    └─ Gmail SMTP
        └─ HTML メール送信
```

## セットアップ手順

### 1. Gmail アプリパスワードの発行

1. Googleアカウントで **2段階認証を有効化**（未設定の場合）
2. [アプリパスワード](https://myaccount.google.com/apppasswords) のページへアクセス
3. アプリ名に「AI日報」など任意の名前を入力して「作成」
4. 表示される16文字のパスワードを控えておく（スペースは除去して使用）

### 2. Anthropic API キーの取得

1. [Anthropic Console](https://console.anthropic.com/) にログイン
2. **API Keys** から新しいキーを作成
3. キーを安全な場所に控えておく

### 3. GitHub Secrets の設定

リポジトリの **Settings > Secrets and variables > Actions** で以下の4つを登録：

| Secret名 | 値 | 説明 |
|-----------|-----|------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic の API キー |
| `GMAIL_ADDRESS` | `you@gmail.com` | 送信元Gmailアドレス |
| `GMAIL_APP_PASSWORD` | `abcdefghijklmnop` | Gmailアプリパスワード（16文字） |
| `TO_EMAIL` | `you@example.com` | 配信先メールアドレス |

### 4. 動作確認

GitHub リポジトリの **Actions** タブから：

1. 左のワークフロー一覧から「AI日報 自動生成・送信」を選択
2. 「Run workflow」ボタンをクリック
3. 実行ログを確認し、メールが届けば成功

## ファイル構成

```
scripts/
├── fetch_and_send.py    # メインスクリプト（ニュース生成・送信）
├── requirements.txt     # Python依存パッケージ
└── README.md            # 本ファイル

.github/workflows/
└── daily-ai-news.yml    # GitHub Actions ワークフロー定義
```

## メール内容

以下の3セクションで構成されます：

1. **【B2Bマーケ向け】生成AI最新ニュース**（2〜3本）
   - 事実と解釈を分離、ビジネス活用の示唆付き
2. **【一般】生成AI注目トピック**（2〜3本）
   - バズっている話題を簡潔にまとめ
3. **【今日のアクション示唆】**
   - B2Bマーケ担当者向けの行動提案（1行）

## 配信スケジュール

- **毎日 7:00 JST**（UTC 22:00）に自動実行
- GitHub Actions の `workflow_dispatch` により手動実行も可能

> **注意**: GitHub Actions の cron は数分の遅延が発生する場合があります。

## コスト目安

| サービス | 料金 |
|----------|------|
| GitHub Actions | 無料枠（2,000分/月）で十分 |
| Claude API | 1回あたり約$0.01〜0.03（sonnet） |
| Gmail SMTP | 無料（1日500通まで） |

月額コストは **約$1以下** で運用可能です。

## トラブルシューティング

### メールが届かない場合
- GitHub Actions のログでエラーを確認
- Gmailの2段階認証とアプリパスワードが有効か確認
- 迷惑メールフォルダを確認

### Claude API エラーの場合
- API キーが有効か確認
- Anthropic アカウントのクレジット残高を確認
- レートリミットに達していないか確認

### GitHub Actions が実行されない場合
- リポジトリが60日以上非アクティブだとcronが無効化される
- Actions タブでワークフローが有効になっているか確認
