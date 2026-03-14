# [S012] YouTube説明文ジェネレーター

**ステータス**: 進行中 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-14
**完了日**: —

---

## 目的

YouTube動画アップ時に必要な説明文・タイトル・ハッシュタグを、AKKODiSの規定フォーマットに従ってClaude APIで自動生成する。動画担当者の作業負荷を削減する。

---

## スコープ

### やること
- [ ] `apps/youtube-desc/index.html` を新規作成（Claude API呼び出し込みの単一ファイル）
- [ ] `index.html`（ポータル）にカードを追加
- [ ] AKKODiS YouTube説明文ルールに従ったプロンプト設計

### やらないこと（スコープ外）
- バックエンドサーバーの構築
- YouTube APIとの連携
- 生成履歴の保存

---

## 完了条件

- [ ] 動画タイトル・内容概要を入力してボタンを押すと説明文が生成される
- [ ] 生成内容がAKKODiS規定フォーマット（3文冒頭・HPリンク・SNSリンク・5ハッシュタグ）を満たす
- [ ] コピーボタンでクリップボードにコピーできる
- [ ] ポータル一覧に表示される

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/youtube-desc/index.html` | 新規 |
| `index.html` | 変更（カード追加） |

---

## AKKODiS YouTube説明文ルール

### 固定HPリンク
- TOP: https://www.akkodis.com/ja
- 採用: https://www.akkodis.com/ja/careers

### 固定SNSリンク
- Facebook▶ https://www.facebook.com/akkodisjapan/
- LinkedIn▶ https://www.linkedin.com/company/akkodis
- X▶ https://x.com/AkkodisJapan

### フォーマット
1. 冒頭3文（YouTubeで表示される部分）: キーワードを含む内容要約
2. 公式HPリンク（関連するもののみ）
3. 関連動画（任意）
4. 目次・タイムスタンプ（任意）
5. SNSリンク
6. ハッシュタグ5つ

---

## 参照

- `docs/design.md`

---

## 作業ログ

- 2026-03-14: ステアリングファイル作成。ユーザーからYouTube説明文ルールを受領。
