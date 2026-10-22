# GitHub Actions ワークフロー設定ドキュメント

本リポジトリでは、Claude AIを活用した2つのGitHub Actionsワークフローを提供しています。

## ワークフロー一覧

| ファイル名 | ワークフロー名 | 概要 |
|---|---|---|
| `claude.yml` | Claude Code | IssueやPRへの@claudeメンション対応 |
| `claude-code-review.yml` | Claude Code Review | PRの自動コードレビュー |

---

## claude.yml

**ファイルパス**: `.github/workflows/claude.yml`

### 概要

IssueコメントやPRコメントで `@claude` とメンションすることで、Claude AIにタスクを依頼できるワークフローです。

### トリガー条件

以下のいずれかのイベントが発生し、かつ `@claude` が含まれている場合に実行されます。

| イベント | 条件 |
|---|---|
| `issue_comment` | Issueコメントが作成された時 |
| `pull_request_review_comment` | PRレビューコメントが作成された時 |
| `issues` | Issueが作成・アサインされた時 |
| `pull_request_review` | PRレビューが送信された時 |

### 必要な権限

```yaml
permissions:
  contents: read
  pull-requests: read
  issues: read
  id-token: write
  actions: read
```

### 必要なシークレット

| シークレット名 | 説明 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code認証用OAuthトークン |

### 使い方

IssueまたはPRのコメントに `@claude` を含めてメッセージを送信します。

```
@claude このコードをレビューしてください
@claude バグを修正してください
@claude この機能を実装してください
```

---

## claude-code-review.yml

**ファイルパス**: `.github/workflows/claude-code-review.yml`

### 概要

プルリクエストが作成・更新された際に、Claude AIが自動的にコードレビューを実施するワークフローです。

### トリガー条件

以下のPRイベントで実行されます。

| イベントタイプ | 説明 |
|---|---|
| `opened` | PRが新規作成された時 |
| `synchronize` | PRに新しいコミットがプッシュされた時 |
| `ready_for_review` | ドラフトPRがレビュー準備完了になった時 |
| `reopened` | クローズされたPRが再オープンされた時 |

### 必要な権限

```yaml
permissions:
  contents: read
  pull-requests: read
  issues: read
  id-token: write
```

### 必要なシークレット

| シークレット名 | 説明 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code認証用OAuthトークン |

### 使い方

PRを作成するだけで自動的にコードレビューが実行されます。レビュー結果はPRコメントに投稿されます。

#### PRの作成者でフィルタリングする場合（オプション）

特定のユーザーのPRのみレビューしたい場合は、以下のように `if` 条件を追加します。

```yaml
jobs:
  claude-review:
    if: |
      github.event.pull_request.user.login == 'external-contributor' ||
      github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'
```

#### 特定のファイル変更時のみ実行する場合（オプション）

```yaml
on:
  pull_request:
    paths:
      - "src/**/*.ts"
      - "src/**/*.tsx"
```

---

## セットアップ

### 1. シークレットの設定

リポジトリの **Settings > Secrets and variables > Actions** から以下のシークレットを設定してください。

| シークレット名 | 取得方法 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | [Claude Code](https://claude.ai/code) でOAuthトークンを発行 |

### 2. ワークフローの有効化

`.github/workflows/` ディレクトリにYAMLファイルを配置するだけで自動的に有効化されます。

---

## 参考リンク

- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
- [Claude Code Action 使用方法](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)
- [Claude Code CLI リファレンス](https://code.claude.com/docs/en/cli-reference)
