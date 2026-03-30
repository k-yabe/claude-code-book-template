# [S036] Slide Maker V2 プロトタイプ実装

**ステータス**: 進行中 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-30
**完了日**: —

---

## 目的

S035で決定した設計（python-pptx強化 + 画像レイアウト活用 + ディープリサーチ）を実装し、Genspark AI Slides と同等のPPTX出力品質を実現する。

---

## 前提条件

- S035の設計決定が完了していること
- Vercel Proプラン（`maxDuration` 延長に必要）
- Unsplash API キー取得済み（Vercel環境変数 `UNSPLASH_ACCESS_KEY`）
- Production申請完了まではデフォルト画像OFF

---

## スコープ

### Phase 1: 画像レイアウト対応（PPTX品質向上の核心）

- [ ] `api/slide-export.py`: 画像系5レイアウトの `apply_data()` 追加
  - `text-left-picture-right` / `text-right-picture-left` / `content-left-full-picture-right` / `large-image-right` / `picture-fullscreen`
  - PICTURE placeholder への画像挿入（BytesIO経由）
- [ ] `api/slide-export.py`: Unsplash API 画像取得関数追加
  - `fetch_image(query)` — asyncio並列DL、タイムアウト5秒/画像
  - フォールバック4段階（成功→空placeholder→スキップ→layout変換）
- [ ] `api/slide-generate.js`: SYSTEM_PROMPT を16レイアウトに拡張
  - `imageQuery` フィールド追加（画像系レイアウト使用時に必須）
  - レイアウト配分ルール: content ≤20%、画像系 ≥25%、データ系 ≥25%
- [ ] `vercel.json`: slide-export.py の `maxDuration` を60に変更

### Phase 2: ディープリサーチ機能

- [ ] `api/slide-research.js`: 新規作成（Edge Function + streaming）
  - `runtime: 'edge'` 設定
  - claude-sonnet-4-6 + extended thinking + web_search (max_uses: 15)
  - SSE形式でリサーチ進捗をストリーミング
  - 出力: `{ sections: [{ title, findings: [{ fact, source_url, confidence }] }] }`
- [ ] `apps/slide-maker/index.html`: リサーチUI
  - ディープリサーチトグル（チャット画面）
  - リサーチ進捗のリアルタイム表示
  - リサーチ結果を構成生成APIのコンテキストに渡す
- [ ] `vercel.json`: slide-research.js のエンドポイント設定

### Phase 3: ファクトチェック機能

- [ ] `api/slide-factcheck.js`: 新規作成
  - claude-haiku-4-5 + web_search (max_uses: 3)
  - 入力: 単一スライドの内容
  - 出力: `{ claims: [{ text, verified, source_url }] }`
- [ ] `apps/slide-maker/index.html`: 各スライドに「ファクトチェック」ボタン追加

### Phase 4: UI品質改善

- [ ] `apps/slide-maker/index.html`: border-radius 10箇所を削除（ブランドガイドライン準拠）
- [ ] `apps/slide-maker/index.html`: Tier 2レイアウト対応（Centered Text Box、Q&A等）
- [ ] `index.html`: WHAT'S NEW 更新

### やらないこと（スコープ外）
- テンプレートPPTXファイル自体のデザイン変更
- Tier 3レイアウト（Four Text Boxes with Pictures等）— 複雑度が高く、Phase 1で十分な品質向上が見込める
- チャットUI/UXの基本フロー変更（S034で完了済み）
- Unsplash Production申請プロセス自体（手動で実施）

---

## 完了条件

- [ ] 画像系レイアウト5種が正常に動作し、PICTURE placeholder に画像が挿入される
- [ ] Unsplash API 未設定時のフォールバックが4段階すべて動作する
- [ ] SYSTEM_PROMPT 16レイアウト化により、生成されるスライドの画像含有率 ≥30%
- [ ] テキストのみスライド率 ≤30%（10枚生成テスト×3回の平均）
- [ ] ディープリサーチ機能でストリーミング進捗表示が動作する
- [ ] リサーチ結果が構成生成に反映され、出典付きスライドが生成される
- [ ] ファクトチェックボタンで各スライドの主張が検証される
- [ ] PowerPoint for Mac + PowerPoint Online で修復ダイアログなしで開ける
- [ ] border-radius がすべて削除されている
- [ ] WHAT'S NEW に更新が記録されている

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `api/slide-export.py` | 変更（画像挿入+新レイアウト） |
| `api/slide-generate.js` | 変更（SYSTEM_PROMPT 16レイアウト化） |
| `api/slide-research.js` | **新規**（ディープリサーチ Edge Function） |
| `api/slide-factcheck.js` | **新規**（ファクトチェック） |
| `apps/slide-maker/index.html` | 変更（リサーチUI + border-radius修正） |
| `vercel.json` | 変更（maxDuration + 新エンドポイント） |
| `requirements.txt` | 変更（依存追加の可能性） |
| `index.html` | 変更（WHAT'S NEW） |
| `docs/design.md` | 変更（完了後に最新化） |

---

## 参照

- `steering/S035-SlideMakerV2設計見直し.md` — 設計決定の全記録
- `docs/design.md` — Slide Maker セクション
- `steering/S034-スライドメーカー.md` — V1 ステアリング

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
