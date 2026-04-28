---
name: akkodis-docx
description: AKKODiSブランドガイドに準拠した Word 文書（.docx）を生成する。提案書・議事録・社内通達・報告書などビジネス文書を、Navy(#001f33)/Gold(#ffb81c) のブランドカラーと記者ハンドブック準拠の表記ルールで整形して出力する。表紙・見出し階層・脚注・ヘッダー/フッターを自動構成。
---

# AKKODiS DOCX Skill

このスキルは AKKODiS ブランド準拠の Word 文書を生成する。

## いつ使うか

- 「提案書を Word で書いて」「議事録のテンプレで起こして」「社内通達を docx で」
- 「AKKODiS のブランドで Word 文書」「会社の表記ルールに従った報告書」

## 入力の受け取り方

文書種別と本文（Markdown ライク）を受け取る。

文書種別:

- `proposal` … 提案書（表紙 + エグゼクティブサマリー + 本論 + 結論）
- `minutes` … 議事録（日時・参加者・議題・決定事項・宿題）
- `memo` … 社内通達 / メモ
- `report` … 報告書

入力例：

```
# 種別: proposal
# タイトル: マーケティング自動化基盤導入のご提案
# 宛先: 株式会社○○ 御中
# 作成: AKKODiS Japan / 田中

## エグゼクティブサマリー
- 現状の課題は…
- 提案する解決策は…
- 期待効果は…

## 現状分析
本文...

## 提案内容
本文...
```

## 生成手順

1. `brand/style-guide.md` と `brand/notation-rules.md` を**必ず先に読む**。
2. `scripts/build_docx.py` を実行：
   ```bash
   python scripts/build_docx.py --input <入力 .md> --output <出力 .docx>
   ```
3. 文書スタイル：
   - 表紙: Navy 背景帯 + Gold タイトル + 宛先・作成者・日付
   - ヘッダー: 文書タイトル（左）/ ページ番号（右）
   - フッター: AKKODiS ロゴ（小）+ 「AKKODiS Internal Use」 or 「AKKODiS / Confidential」
   - 見出し1: Navy・18pt Bold
   - 見出し2: Navy・14pt Bold + Gold 下線
   - 本文: Noto Sans JP 11pt
   - 箇条書き: 「・」または番号付き
4. 全文に `brand/notation-rules.md` を適用し、固有名詞・記者ハンドブック表記を整える。

## 文書種別ごとの構成

### proposal（提案書）

1. 表紙
2. 目次（自動生成）
3. エグゼクティブサマリー
4. 現状分析 / 課題
5. 提案内容
6. 実施スケジュール
7. 体制・費用
8. 結論 / 次のアクション

### minutes（議事録）

- 日時・場所・参加者
- アジェンダ
- 議論の要点
- 決定事項（チェックボックス + 担当 + 期限）
- 宿題・次回アクション

### memo（社内通達）

- 件名
- 宛先 / 発信者 / 日付
- 本文（簡潔に）
- 添付情報

### report（報告書）

- サマリー
- 詳細
- データ・根拠
- 所感・提言

## ブランドルール（要点）

- カラー: Navy `#001f33`, Gold `#ffb81c`
- フォント: Noto Sans JP（日本語）/ Inter（欧文）
- 行間: 1.5
- 余白: 上下 25mm / 左右 22mm
- ページ番号: フッター右

詳細は `brand/style-guide.md` を参照。

## ファイル構成

```
akkodis-docx/
├── SKILL.md
├── brand/
│   ├── style-guide.md
│   ├── notation-rules.md           # 表記ルール（Writing Checker と同一・全文）
│   └── AKKODIS_Logo_*.svg
├── scripts/
│   └── build_docx.py               # python-docx ベース
└── examples/
    └── sample-input.md
```

## 依存

- Python 3.10+
- `python-docx>=1.1.0`

未インストールの場合は `pip install python-docx` を実行する。
