# [S070] WireframeMaker ゼロから完了までの導線強化

**ステータス**: 完了
**作成日**: 2026-04-11
**完了日**: 2026-04-11

---

## 目的

Wireframe Maker のユーザーが「ゼロから作り始めて、成果物（SVG/PNG などのエクスポート）にたどり着くまで」を止まらずに完了できるようにする。現状、途中で静かに失敗したり完了に導くガイドが欠けているため、成功率が低い。

---

## スコープ

### やること
- [x] 機能調査（調査済み。下記 "作業ログ" にまとめ）
- [x] クローン→WF 変換で 0 セクションになる場合に沈黙せず明確に失敗させる（iframe 未到達／空配列／API 空応答を区別）
- [x] ファイルインポート（PDF/Word/PPTX）で 15000 文字トリミング時にユーザーに通知
- [x] URL インポート時、クローンモード以外でも現在の編集内容が失われる場合に確認
- [x] SVG / PNG エクスポートに try/catch と明確なエラー表示
- [x] 構成生成成功時にエクスポートへ進むための明示ガイド（トースト＋サジェスト）
- [x] ルート `index.html` の WHAT'S NEW を更新
- [x] `docs/design.md` の Wireframe Maker セクションを更新

### やらないこと（スコープ外）
- HTML/CSS エクスポートの完全動的生成（S070 以降）
- テンプレ自動投入テキストの全面改善
- クローンモードの cross-origin 制約の根本解決

---

## 完了条件

- [x] 既存サイトモードで 0 セクション時に無言で空 WF にならず、原因が分かるエラーが出る
- [x] 大きな資料をインポートすると「（一部省略）」などの注意が出る
- [x] SVG/PNG エクスポート時の例外がユーザーに伝わる
- [x] 生成直後にエクスポートタブへ誘導するガイドが表示される
- [x] WHAT'S NEW に本日分が追加されている

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/wireframe-maker/index.html` | 変更 |
| `index.html` | 変更（WHAT'S NEW） |
| `docs/design.md` | 変更 |
| `steering/S069-*.md` | 新規 |

---

## 作業ログ

### 調査結果（要約）
- クローン→WF: `generateWireframeFromClone()`（apps/wireframe-maker/index.html:2444）が iframe postMessage 3s タイムアウト時に `resolve([])` で沈黙。さらに API が 0 件を返しても `applyImport('replace')` が空配列を流し込み、ユーザーは空の WF を見ることになる。
- ファイルインポート: `extractPdfText/Docx/Pptx`（1413-1442）が `.slice(0,15000)` で黙って切る。
- URL インポート: `handleUrlImport`（1453）は cloneMode かつ undoStack ありの場合しか失われる編集を確認しない。クローンではない既存 WF がある場合でも警告すべき。
- エクスポート: `exportSVG`（3582）/ `exportPNG`（3593）が try/catch 無しで例外時に UI が無反応になりうる。

### 実装メモ
- 構成生成成功フックは `onSectionsChanged` 付近ではなく、生成系関数の完了箇所（chat/template/file/clone）共通で呼べる `notifyReadyToExport()` を追加。
