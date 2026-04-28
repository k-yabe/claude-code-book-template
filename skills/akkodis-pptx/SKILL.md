---
name: akkodis-pptx
description: AKKODiSブランドガイドに準拠した PowerPoint プレゼン資料（.pptx）を生成する。社外向け / 社内向け × ダーク / ライト の 4 テンプレートをベースに、Markdown ライクな入力からスライドを組み立てる。色（Navy #001f33 / Gold #ffb81c）、フォント、ロゴ配置、余白などのブランド規約を自動適用。提案書・案件報告・社内勉強会・営業資料など、AKKODiS の社員が PPT を作るときに使う。
---

# AKKODiS PPTX Skill

このスキルは AKKODiS ブランド準拠の PowerPoint ファイルを生成する。

## いつ使うか

ユーザーが以下のいずれかを求めたら、このスキルを使うことを検討する。

- 「AKKODiS のスライドを作って」「ブランド準拠のパワポが欲しい」
- 「社外向け／社内向けのプレゼン」「提案書を pptx で」
- 「会社のテンプレで資料化して」「Navy と Gold のスライド」

## 入力の受け取り方

ユーザーから「内容」と「用途」を受け取る。曖昧な場合は以下を簡潔に確認する。

1. **用途**: 社外向け（external） / 社内向け（internal）
2. **トーン**: ダーク（dark, 濃紺背景） / ライト（white, 白背景）
3. **タイトルとセクション構成**: 章立て + 各章の要点 3〜5個

入力例（Markdown ライクで OK）：

```
# タイトル: 2026 Q2 マーケティング戦略
# 用途: external
# トーン: white

## 現状分析
- リード獲得は前年比 120%
- CV 率は伸び悩み

## 課題
- 中盤ファネルでの離脱
- ナーチャリング不足

## 施策
1. ウェビナー連動キャンペーン
2. メール自動化のセグメント拡張
3. 業界別 LP の追加
```

## 生成手順

1. `templates/` から用途×トーンに合致する `.pptx` を選ぶ：
   - `external-dark.pptx` / `external-white.pptx`
   - `internal-dark.pptx` / `internal-white.pptx`
2. `brand/style-guide.md` を必ず先に読み、カラー・フォント・余白・ロゴ配置のルールを順守する。
3. **`brand/notation-rules.md` を必ず先に読み、表記ルール（記者ハンドブック準拠 / AKKODiS 固有名詞 / Microsoft 表記 / IOWN® 表記）を全文に適用する。** タイトル・見出し・本文・キャプションすべてに対し、固有名詞の大文字小文字、ひらがな送り仮名、IOWN® の ® 有無、Microsoft 製品名のスペース有無などを点検し、必要に応じて自動修正する。
4. `scripts/build_pptx.py` を実行して .pptx を生成する。引数：
   ```bash
   python scripts/build_pptx.py \
     --template templates/external-white.pptx \
     --input <ユーザー入力 .md> \
     --output <出力先 .pptx>
   ```
5. 表紙・各セクションスライド・まとめスライドを順に作る。各スライド左下にロゴ（`brand/AKKODIS_Logo_RGB_BLUE.svg` をPNG変換して埋め込み、または PPTX マスター上の既存ロゴをそのまま使う）。
6. 生成後、`brand/notation-rules.md` で再度全テキストを照合し、表記揺れがあれば修正版を再生成する。
7. 出力パスをユーザーに返す。

## 必ず守るブランドルール（要点）

- カラー: Navy `#001f33` / Gold `#ffb81c` / White `#FFFFFF` / Black `#000000`
- 強調色は Gold のみ。アクセントを増やしすぎない。
- 本文フォント: Noto Sans JP（日本語）、Inter / Arial（欧文）。ゴシック以外を使わない。
- タイトルスライドは Navy 背景 + Gold タイトルが基本。
- ロゴは必ず白か青のいずれかを背景コントラストに合わせて選ぶ（赤や黒の背景は使わない）。
- 1スライドの本文は箇条書き 3〜5 行、文字サイズは 18pt 以上。

詳細は `brand/style-guide.md` を参照。

## ファイル構成

```
akkodis-pptx/
├── SKILL.md                         # このファイル
├── brand/
│   ├── style-guide.md              # ブランドルール詳細（カラー・フォント・余白）
│   ├── notation-rules.md           # 表記ルール（Writing Checker と同一・全文）
│   └── AKKODIS_Logo_*.svg          # ロゴ 5 種
├── templates/
│   ├── external-dark.pptx
│   ├── external-white.pptx
│   ├── internal-dark.pptx
│   └── internal-white.pptx
├── scripts/
│   └── build_pptx.py               # python-pptx ベース生成スクリプト
└── examples/
    └── sample-input.md             # 最小サンプル入力
```

## 依存

- Python 3.10+
- `python-pptx>=0.6.23`
- `Pillow>=10.0`（ロゴ変換用、任意）

未インストールの場合は `pip install python-pptx Pillow` を実行する。
