---
name: akkodis-docx
description: AKKODiSブランドガイドに準拠した Word 文書（.docx）を生成する。提案書・議事録・社内通達・報告書などビジネス文書を Navy(#001f33)/Gold(#ffb81c) のブランドカラーと記者ハンドブック準拠の表記ルールで整形して出力する。表紙には Navy の帯シェーディングを敷き、Heading 1 / Heading 2 を AKKODiS スタイルで定義。提案書では目次（TOC フィールド）を自動挿入。Markdown 表は Navy ヘッダー + Light Grid スタイルのテーブルとして埋め込み。ヘッダー / フッター（タイトル + 機密区分 + ページ番号）も自動付与。Writing Checker と同一の表記ルール（記者ハンドブック準拠 / AKKODiS 固有名詞 / Microsoft 表記 / IOWN®）を全テキストに自動補正。
---

# AKKODiS DOCX Skill

このスキルは AKKODiS ブランド準拠の Word 文書を生成する。

## いつ使うか

- 「提案書を Word で書いて」「議事録のテンプレで起こして」
- 「社内通達を docx で」「報告書を作って」
- 「AKKODiS のブランドで Word 文書」「記者ハンドブックに従って整えて」

## 入力フォーマット

```
# 種別: proposal           # proposal | minutes | memo | report
# タイトル: マーケティング自動化基盤導入のご提案
# 宛先: 株式会社○○ 御中
# 作成: AKKODiS Japan / 田中
# 機密: Confidential        # Internal | Confidential（任意・既定 Internal）

## エグゼクティブサマリー    ← Heading 1
本文（段落として認識）

- 箇条書き
- 箇条書き

### 主要指標                ← Heading 2
| 指標   | 目標 | 実績 |
| ------ | ---- | ---- |
| 値1    | 100  | 120  |
```

サポートする要素:

- `## ` → Heading 1（大見出し）
- `### ` → Heading 2（小見出し）
- `- ` / `* ` → 箇条書き
- `1. ` → 番号付きリスト
- `| ... |` → Markdown 表（Navy ヘッダーのテーブルに変換）
- 通常の段落文

## 文書種別ごとの構成

| `# 種別:` | 用途 | 自動構成 |
|-----------|------|----------|
| `proposal` | 提案書 | 表紙 + 目次（章数 ≥3 で自動）+ 本文 |
| `minutes` | 議事録 | 表紙 + 本文（目次なし） |
| `memo` | 社内通達 | 表紙 + 本文（目次なし） |
| `report` | 報告書 | 表紙 + 本文（目次なし） |

## 生成手順

1. `brand/style-guide.md` と `brand/notation-rules.md` を**必ず先に読む**。
2. `scripts/build_docx.py` を実行：
   ```bash
   python scripts/build_docx.py --input <入力 .md> --output <出力 .docx>
   ```
3. スクリプトが以下を自動で行う：
   - 表紙（Navy 帯シェーディング + Navy 32pt タイトル + 宛先 + 作成者 + 日付 + 機密区分）
   - `proposal` で章数 3 以上なら **目次フィールド (TOC)** を自動挿入（Word で開いて F9 で更新）
   - Heading 1 / Heading 2 / Normal の各スタイルを AKKODiS 仕様で再定義
   - 箇条書きは `List Bullet`、番号付きは `List Number` スタイル
   - Markdown 表は **Navy ヘッダー（白文字 Bold）** + Light Grid Accent 1 スタイル
   - ヘッダー（左寄せ・タイトル）/ フッター（中央: 機密区分、右: ページ番号フィールド）
   - 全テキストに `notation.py` の表記補正を適用

## ブランドルール（要点）

- カラー: Navy `#001f33`, Gold `#ffb81c`, Black, Gray `#5A6470`
- フォント: Noto Sans JP / Inter（11pt 本文 / 14pt H2 / 18pt H1 / 32pt 表紙）
- 行間: 1.5、余白: 上下 25mm / 左右 22mm
- 表紙はページ単独（次の見出しは改ページ後）

詳細は `brand/style-guide.md`。

## ファイル構成

```
akkodis-docx/
├── SKILL.md
├── brand/
│   ├── style-guide.md
│   ├── notation-rules.md
│   └── AKKODIS_Logo_*.svg
├── scripts/
│   ├── build_docx.py               # 本体（python-docx）
│   └── notation.py                 # 表記補正
└── examples/
    └── sample-input.md
```

## 依存

- Python 3.10+
- `python-docx>=1.1.0`

`pip install python-docx`

## トラブルシュート

- **目次が空に見える**: TOC は Word フィールドのため、初回開封時に自動更新されないことがある。Word で `F9` キー（または右クリック → フィールド更新）で更新する。
- **テーブルのヘッダー色が変**: テンプレートの「Light Grid Accent 1」スタイルが上書きされている場合がある。スタイルを「テーブル ツール → デザイン」から再選択する。
- **発表者がフォント変更したい**: `Normal` / `Heading 1` / `Heading 2` の各スタイルを Word の「スタイル」ペインから一括変更可能。

## バージョン

- v2.0.0（2026-04-28）— Heading 1/2 スタイル定義、目次フィールド自動挿入、Markdown 表 → Navy ヘッダーテーブル、表紙シェーディング強化、表記補正モジュール
- v1.0.0（2026-04-28）— 初版
