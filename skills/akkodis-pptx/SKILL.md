---
name: akkodis-pptx
description: AKKODiSブランドガイドに準拠した PowerPoint プレゼン資料（.pptx）を生成する。社外向け/社内向け × ダーク/ライト の 4 テンプレートをベースに、Markdown ライクな入力からスライドを組み立てる。表紙・自動アジェンダ・本文・KPI ダッシュボード・まとめスライドの 5 種別をサポート。各スライド左下に AKKODiS ロゴを自動配置、Gold 帯のフッター + ページ番号も自動付与。発表者ノートを `> ` 行で記述可能。Navy/Gold ブランド色・Noto Sans JP・余白などのデザイン規約に加え、Writing Checker と同一の表記ルール（記者ハンドブック準拠 / AKKODiS 固有名詞 / Microsoft 表記 / IOWN®）を全テキストに自動補正。提案書・案件報告・社内勉強会・営業資料・キックオフなど、AKKODiS の社員が PPT を作るときに使う。
---

# AKKODiS PPTX Skill

このスキルは AKKODiS ブランド準拠の PowerPoint ファイルを生成する。

## いつ使うか

- 「AKKODiS のスライドを作って」「ブランド準拠のパワポが欲しい」
- 「社外向け / 社内向けのプレゼン」「提案書を pptx で」
- 「会社のテンプレで資料化して」「Navy と Gold のスライド」
- 「KPI を大きく見せるダッシュボード形式で」

## 入力フォーマット

Markdown ライクで以下を受け取る。

```
# タイトル: 2026 Q2 マーケティング戦略
# サブタイトル: ナーチャリング自動化で SQL 創出 +30%   （任意）
# 用途: external          # external | internal（既定: external）
# トーン: white           # dark | white（既定: white）
# 作成: 田中（任意）

## 現状分析                ← 通常スライド
- リード獲得は前年比 120%
- CV 率は伸び悩み
> 発表者ノート（> 行で書ける、任意）

## KPI: SQL創出=+30% | 商談化率=+10pt | ROAS=2.4倍   ← KPI スライド
3指標を Q2 末までに達成する。

## まとめ                  ← クロージングスライド
- 結論1
- 結論2
```

特殊シンタックス:

| 記法 | スライド種別 |
|------|--------------|
| `## <名前>` | 通常スライド（タイトル + 箇条書き） |
| `## KPI: A=値1 \| B=値2 \| C=値3` | KPI スライド（数値を Gold で大きく表示） |
| `## まとめ` / `## 結論` | クロージングスライド（Navy 背景 + Thank you） |
| `> 文` | 直前のスライドの発表者ノート |

セクションが 2 つ以上ある場合、**アジェンダスライドが自動挿入** される。

## 生成手順

1. `brand/style-guide.md` と `brand/notation-rules.md` を**必ず先に読む**。
2. `scripts/build_pptx.py` を実行（`--template` 省略時は用途×トーンから自動選択）：
   ```bash
   python scripts/build_pptx.py \
     --input <ユーザー入力 .md> \
     --output <出力先 .pptx>
   ```
3. スクリプトが以下を自動で行う：
   - 用途×トーンに対応するテンプレ（`external-{dark,white}.pptx` / `internal-{dark,white}.pptx`）を選択。**用途は既定 `external`**（社外秘の internal テンプレは明示指定時のみ）
   - スライド種別ごとに **最適な layout を自動選択**：
     - 表紙 → `Wave Landscape` / `Mesh Yellow & Blue`（フルデコレーション）
     - 本文/アジェンダ/KPI → `Mesh grey` / `Full picture to insert`（IMG_Back を XML 削除して clean canvas に）
     - クロージング → `Eye Akkodis`（フルイメージ背景に Thank you を placeholder で配置）
   - 全テキストを `notation.py` で表記補正（Akkodis→AKKODiS、頂く→いただく、IOWN→IOWN® など）
   - 各スライド右下にページ番号（`X / Y`）
   - `> ` 行があれば発表者ノートに格納
4. 出力パスをユーザーに返す。

## ブランドルール（要点）

- カラー: Navy `#001f33` / Gold `#ffb81c` / White / Black
- 強調色は Gold のみ。タイトルスライドは Navy 背景 + Gold タイトル
- フォント: Noto Sans JP（日本語）、Inter / Arial（欧文）
- ロゴ: 暗背景には `RGB_WHITE`、白背景には `RGB_BLUE` を使う
- 1 スライドの本文は箇条書き 3〜5 行、18pt 以上

詳細は `brand/style-guide.md`。表記ルールは `brand/notation-rules.md`。

## ファイル構成

```
akkodis-pptx/
├── SKILL.md
├── brand/
│   ├── style-guide.md
│   ├── notation-rules.md           # 表記ルール（Writing Checker と全文同一）
│   └── AKKODIS_Logo_*.svg          # 5 種
├── templates/
│   ├── external-dark.pptx
│   ├── external-white.pptx
│   ├── internal-dark.pptx
│   └── internal-white.pptx
├── scripts/
│   ├── build_pptx.py               # 本体
│   └── notation.py                 # 表記補正モジュール
└── examples/
    └── sample-input.md
```

## 依存

- Python 3.10+
- `python-pptx>=0.6.23`

`pip install python-pptx`

## トラブルシュート

- **「テンプレートが見つかりません」**: 用途/トーンの綴り（`external` / `internal`、`dark` / `white`）を確認。テンプレ4種は `templates/` に置いてある必要がある。
- **「ロゴが表示されない」**: PowerPoint のバージョンによっては SVG 表示で問題が出ることがある。その場合 `brand/` の SVG を PNG 変換して差し替えるとよい。
- **「表記補正で意図しない変換が起きる」**: `scripts/notation.py` の `_SUBSTITUTIONS` を編集（同梱テスト `tests/test_skills.py::TestNotation` を再実行で検証）。

## バージョン

- v2.0.0（2026-04-28）— アジェンダ自動挿入、KPI スライド、まとめスライド、ロゴ自動配置、発表者ノート、表記補正モジュール
- v1.0.0（2026-04-28）— 初版
