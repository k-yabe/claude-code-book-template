# S047 — OGP Checker: Twitter Card 目視チェック注意喚起

## ステータス: 完了

## 概要

OGP Checker の検証項目に Twitter Card タグの目視チェック注意喚起を追加する。
CMSで twitter:card 等を設定しても、仕様上タグを HTML に吐き出さない CMS がある。
そのため、タグが未検出の場合は「目検でも確認してください」という注意メッセージを表示する。

## 変更内容

### apps/ogp-checker/index.html
- バリデーション項目に Twitter Card チェックを追加:
  - `twitter:card` 未設定 → warn「twitter:card が未検出です。CMSによってはタグを出力しない仕様の場合があります。目視でもご確認ください」
  - `twitter:title` 未設定 → warn（同様の注意喚起）
  - `twitter:image` 未設定 → warn（同様の注意喚起）

## 作業ログ

- 2026-04-02: 作成・実装開始
- 2026-04-02: Twitter Card (card/title/image) + h1 の目視チェック注意喚起をバリデーションに追加。完了
