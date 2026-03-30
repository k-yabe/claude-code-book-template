# [S037] Slide Maker フロントエンド16レイアウト完全対応 + 品質強化

**ステータス**: 完了 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-30
**完了日**: 2026-03-30

---

## 目的

S036で追加した画像系6レイアウト+centered-textがフロントエンド（VALID_LAYOUTS・編集モーダル・プレビュー描画）に未登録のため、UIから編集・プレビューできない致命的バグを修正する。合わせてquote/sixboxの編集モーダル追加、リサーチデータ連携強化、一括ファクトチェック機能を実装し、Genspark AI Slides を超える品質を実現する。

---

## スコープ

### やること

#### Phase 1: 致命的バグ修正（P0）
- [x] `apps/slide-maker/index.html`: VALID_LAYOUTS に6画像レイアウト + centered-text を追加
- [x] `apps/slide-maker/index.html`: LAYOUT_NAMES に6画像レイアウト + centered-text のラベルを追加
- [x] `apps/slide-maker/index.html`: LAYOUT_TO_TEMPLATE_SLIDE に画像レイアウトのマッピングを追加
- [x] `apps/slide-maker/index.html`: buildSlideHtml() に画像レイアウト + centered-text の描画を追加
- [x] `apps/slide-maker/index.html`: openEditModal() に画像レイアウト + centered-text + quote の編集UIを追加

#### Phase 2: 編集モーダル補完（P1）
- [x] `apps/slide-maker/index.html`: sixbox の編集モーダルUI追加（6ボックスのheading/body編集）
- [x] `apps/slide-maker/index.html`: imageQuery フィールドの編集UIを画像系レイアウトに追加

#### Phase 3: リサーチデータ連携強化
- [x] `apps/slide-maker/index.html`: リサーチ結果の suggested_charts を構造化データとしてスライド生成に渡す
- [x] `apps/slide-maker/index.html`: リサーチ結果プレビュー表示を改善（セクション/チャート/インサイト別表示）

#### Phase 4: 一括ファクトチェック + UX
- [x] `apps/slide-maker/index.html`: 「全スライドを検証」ボタンをクイックアクションに追加
- [x] `apps/slide-maker/index.html`: チャートタイプをドロップダウン選択に変更（bar/line/pie）
- [x] `index.html`: WHAT'S NEW 更新

### やらないこと（スコープ外）
- テンプレートPPTXファイル自体のデザイン変更
- バックエンド（slide-export.py, slide-generate.js）の変更（既に16レイアウト対応済み）
- Tier 3レイアウト（Four Text Boxes with Pictures等）

---

## 完了条件

- [x] 全16レイアウトがフロントエンドのドロップダウンから選択できる
- [x] 全16レイアウトの編集モーダルで適切なフィールドが編集できる
- [x] 全16レイアウトのプレビューサムネイルが正しく描画される
- [x] 画像系レイアウトのimageQueryがプレビュー・編集モーダルに表示される
- [x] sixboxの6ボックスが個別に編集できる
- [x] リサーチデータのsuggested_chartsが構造化JSONとしてスライド生成に渡される
- [x] 「全スライドを検証」で一括ファクトチェックが動作する
- [x] WHAT'S NEW に更新が記録されている

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/slide-maker/index.html` | 変更（レイアウト対応・編集モーダル・プレビュー） |
| `index.html` | 変更（WHAT'S NEW） |

---

## 参照

- `steering/S036-SlideMakerV2実装.md` — V2実装ステアリング
- `steering/S035-SlideMakerV2設計見直し.md` — 設計決定の全記録
- `docs/design.md` — Slide Maker セクション

---

## 作業ログ

<!-- 実装中に判明したことや決定事項をここに記録する -->
