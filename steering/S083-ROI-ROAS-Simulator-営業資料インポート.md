# [S083] ROI / ROAS Simulator — 営業資料インポートによる自動入力＆AI所見

**ステータス**: 完了 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-06-19
**完了日**: 2026-06-19

---

## 目的

ROI / ROAS Simulator に「営業資料（提案書・見積・媒体資料など）をインポートすると、AI が広告費・CVR・客単価・粗利率などの前提値を読み取って自動入力し、投資判断の所見まで提示する」機能を追加する。手入力の手間を省き、資料ベースで素早く費用対効果を評価できるようにする。

---

## スコープ

### やること
- [ ] `apps/roi-roas-simulator/index.html` にファイルアップロード UI（PDF / PPTX / DOCX / TXT / MD、ドラッグ&ドロップ対応）を追加
- [ ] クライアント側テキスト抽出（PDF.js / JSZip）を url-slug-generator から流用
- [ ] 既存 `/api/generate`（汎用 Anthropic プロキシ）に抽出テキストを渡し、前提値＋所見を **厳密 JSON** で取得
- [ ] 取得値で各入力欄を自動入力し、流入モード（CPC / クリック数）も自動切替してリアルタイム再計算
- [ ] 「AI の読み取り & 所見」パネル: 読み取った前提の要約 / 投資判断（GO・要検討・見送り）/ 根拠 / リスク / 改善提案 / 読み取れなかった項目
- [ ] ハード指標（ROAS / ROI / 損益分岐）は従来どおり**決定論的に計算**し、AI 所見は定性的補足として併記
- [ ] ローディング・エラー処理・機密情報アップロード注意の明示
- [ ] WHAT'S NEW（NEW: 新機能）・オンボーディング updates を更新

### やらないこと（スコープ外）
- 複数資料の一括比較・履歴保存
- サーバー側での資料保存（テキストは都度 API に送るのみ、永続化しない）
- 画像内の数値 OCR（テキストレイヤーのない PDF/画像は対象外）

---

## 完了条件

- [ ] 営業資料（テキストを含む PDF/PPTX/DOCX/TXT/MD）をアップロードすると、広告費・CVR・客単価・粗利率等が自動入力され、ROAS/ROI が再計算される
- [ ] 読み取れた前提と投資判断・リスク・改善提案が所見パネルに表示される
- [ ] 値が読み取れない項目は欄を変更せず「読み取れなかった項目」として明示される
- [ ] API エラー・非対応ファイル・テキスト抽出失敗時に分かりやすいエラーが出る
- [ ] WHAT'S NEW とオンボーディング updates が更新されている

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/roi-roas-simulator/index.html` | 変更（アップロード UI・抽出・API 連携・所見パネル追加） |
| `index.html`（WHAT'S NEW） | 変更 |
| `docs/design.md` | 変更 |
| `steering/S083-ROI-ROAS-Simulator-営業資料インポート.md` | 新規 |

---

## 参照

- `docs/design.md` — ROI / ROAS Simulator セクション（S082）
- `apps/url-slug-generator/index.html` — ファイル抽出・`/api/generate` 連携の実装パターン
- `api/generate.js` — 汎用 Anthropic プロキシ（model / max_tokens / system / messages を受けて content を返す）

---

## 作業ログ

- 2026-06-19: 新規ステアリング作成。既存 `/api/generate` を再利用し、新規バックエンドなしで実装する方針。抽出は client-side（PDF.js / JSZip）。
- 2026-06-19: 実装完了。アップロード UI・テキスト抽出（PDF.js 8p / JSZip PPTX 20スライド・DOCX）・`/api/generate`（claude-haiku-4-5・厳密 JSON）連携・`applyExtracted()` での自動入力（流入モード自動切替・fill-flash）・`renderAiPanel()`（前提/投資判断バッジ/根拠/リスク/改善提案/未取得項目）を追加。ROAS/ROI/損益分岐は従来どおり `compute()`/`render()` で決定論的に再計算し、AI 所見は定性補足として分離。`toNum()` で表記ゆれ吸収、テキスト20字未満・JSON 解析失敗・APIエラー・非対応形式・15MB超 のフォールバック実装。インライン script 構文チェック・DOM ID 突合 OK。WHAT'S NEW（NEW）・オンボーディング features/updates・docs/design.md を更新。デザインルール順守（長方形の border-radius 不使用、ブランドカラーのみ、AI 所見アクセントは Gold）。
