---
name: akkodis-xlsx
description: AKKODiSブランドガイドに準拠した Excel ワークブック（.xlsx）を生成する。Navy(#001f33) ヘッダー / Gold(#ffb81c) アクセント / 罫線・数値書式・フォントの統一スタイルで、月次レポート・KPI ダッシュボード・案件一覧・予算管理表などを作る。Writing Checker と同じ表記ルールをセル文字列にも適用する。
---

# AKKODiS XLSX Skill

このスキルは AKKODiS ブランド準拠の Excel ファイルを生成する。

## いつ使うか

- 「KPI ダッシュボードを Excel で」「案件管理表を作って」「予算管理シートが欲しい」
- 「AKKODiS のブランドで Excel」「会社の表記ルールを守った Excel」
- 「月次の売上レポートを xlsx で」

## 入力の受け取り方

ユーザーから「シート構成」と「データ」を受け取る。データは TSV / CSV / Markdown 表 / 自由記述のいずれでも可。

入力例：

```
# タイトル: 2026 Q2 KPI ダッシュボード

## サマリー
| 指標         | 目標   | 実績   | 達成率 |
| ------------ | ------ | ------ | ------ |
| リード獲得   | 5,000  | 6,120  | 122%   |
| MQL 創出     | 1,500  | 1,420  | 95%    |
| 商談化数     | 300    | 285    | 95%    |

## 案件一覧
| 案件名 | 業種   | 担当       | フェーズ | 金額（千円） |
| ------ | ------ | ---------- | -------- | ------------ |
| A社 提案  | 製造   | 田中       | 提案中   | 12,000       |
```

## 生成手順

1. `brand/style-guide.md` と `brand/notation-rules.md` を**必ず先に読む**。
2. `scripts/build_xlsx.py` を実行：
   ```bash
   python scripts/build_xlsx.py --input <入力 .md> --output <出力 .xlsx>
   ```
3. 各シートに以下を適用する：
   - ヘッダー行: Navy 背景（`001f33`）+ 白文字 Bold（Noto Sans JP, 11pt）
   - 1行おきの淡いゼブラ（`F4F6F8`）
   - 数値は3桁カンマ、パーセントは小数1桁
   - 達成率セルは閾値 100% 超で Gold（`FFB81C`）背景、80% 未満で薄い赤
   - 罫線は薄いグレー（`E0E4E8`）
   - 列幅は内容に合わせ自動調整、最低 12 / 最大 40
4. ヘッダー左上の A1 セルに「AKKODiS Internal Use」もしくはタイトルを Navy で記載。
5. すべてのセル文字列に対し `brand/notation-rules.md` を適用し、固有名詞・IOWN® 等を自動修正。

## ブランドルール（要点）

- カラー: Navy `#001f33`, Gold `#ffb81c`, White, Light Gray `#E0E4E8`
- フォント: Noto Sans JP / Inter（11pt 標準、ヘッダー Bold）
- 数値: 3 桁カンマ、通貨は「千円」「百万円」を列単位で統一
- 凡例・注釈はシート末尾に Light Gray で配置
- ロゴは挿入しないのが標準（Excel のロゴ埋め込みは保存サイズが膨らむため）。挿入する場合は `brand/AKKODIS_Logo_RGB_BLUE.svg` を PNG 変換して A1 上に配置

詳細は `brand/style-guide.md` を参照。

## ファイル構成

```
akkodis-xlsx/
├── SKILL.md
├── brand/
│   ├── style-guide.md
│   ├── notation-rules.md           # 表記ルール（Writing Checker と同一・全文）
│   └── AKKODIS_Logo_*.svg
├── scripts/
│   └── build_xlsx.py               # openpyxl ベース
└── examples/
    └── sample-input.md
```

## 依存

- Python 3.10+
- `openpyxl>=3.1.2`

未インストールの場合は `pip install openpyxl` を実行する。
