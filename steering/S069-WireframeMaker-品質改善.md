# [S069] Wireframe Maker 品質改善（セキュリティ・パフォーマンス・安定性）

**ステータス**: 完了
**作成日**: 2026-04-12
**完了日**: 2026-04-12

---

## 目的

Wireframe Maker を「完璧なアプリ」として使えるレベルに引き上げる。厳しめのコードレビューで発見したセキュリティ脆弱性・パフォーマンス問題・UI不具合を修正する。

---

## スコープ

### やること
- [x] セキュリティ修正: postMessage オリジンチェック追加、innerHTML XSS対策
- [x] パフォーマンス修正: addEventListener 累積リーク修正
- [x] 描画修正: Math.random() を決定論的パターンに置換
- [x] UI修正: z-index 衝突解消
- [x] エラーハンドリング: fetch レスポンスチェック追加
- [x] ミニマップ最適化: デバウンス追加 + nullチェック修正
- [x] WHAT'S NEW 更新
- [x] 追加: getScreenCTM() nullガード（3箇所）
- [x] 追加: iframe/contentWindow nullチェック統一（3箇所）
- [x] 追加: localStorage setItem 容量超過 try-catch（3箇所）
- [x] 追加: localStorage 認証チェック例外対策
- [x] 追加: URL.createObjectURL revoke漏れ修正（2箇所）
- [x] 追加: showError/applyInlineEdit nullガード
- [x] 追加: ドラッグ transform nullチェック
- [x] 追加: 空 setInterval 削除
- [x] 追加: postMessage タイムアウト延長（1秒→5秒）

### やらないこと（スコープ外）
- モジュール分割・リファクタリング（別ステアリングで扱う）
- アクセシビリティ全面対応（別ステアリング）
- モバイル対応強化（別ステアリング）

---

## 完了条件

- [x] postMessage 全箇所でオリジンチェック実装
- [x] innerHTML にユーザー入力が直接入る箇所を全てエスケープ
- [x] renderPreview() でイベントリスナーが累積しないことを確認（AbortController導入）
- [x] drawLines() が決定論的に描画される
- [x] z-index 衝突なし（more-tools-menu 100→110）
- [x] fetch 全箇所でレスポンスステータスチェック

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/wireframe-maker/index.html` | 変更（28箇所修正） |
| `index.html` | 変更（WHAT'S NEW追加） |
| `docs/design.md` | 変更（変更ログ追加） |

---

## 参照

- `docs/design.md` — Wireframe Maker セクション
- `steering/S066-WireframeMaker-UX全面改善.md`
- `steering/S068-WireframeMaker-モード分離とテキスト編集改善.md`

---

## 作業ログ

- 2026-04-12: 厳密コードレビュー実施、28件の問題を特定・修正
  - セキュリティ: postMessageオリジンチェック（iframe/親）、innerHTML XSS 8箇所エスケープ、insert-htmlサニタイズ、rawHtmlイベントハンドラ除去、data.urlプロトコル検証
  - パフォーマンス: setupFreeTextEventsのaddEventListener累積リークをAbortControllerで解消、ミニマップデバウンス150ms、空setInterval削除
  - 安定性: getScreenCTM nullガード3箇所、iframe nullチェック3箇所、localStorage setItem try-catch 3箇所、認証チェックtry-catch、showError/applyInlineEdit nullガード、transform nullチェック
  - 描画: drawLinesのMath.random()→固定パターン配列[1.0, 0.85, 0.92, 0.7, 0.78, 0.95, 0.65, 0.88]
  - API: fetch 3箇所にres.okチェック追加、postMessageタイムアウト1秒→5秒（3箇所統一）
  - UI: more-tools-menu z-index 100→110
  - リソース: URL.createObjectURL revoke漏れ2箇所修正
