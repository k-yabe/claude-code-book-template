# AKKODiS Claude Skills

AKKODiS ブランド & 表記ルール準拠のドキュメントを Claude（claude.ai / Claude Code）で生成するための **Claude Skills** 集です。

| Skill | 生成物 | ベース技術 |
|-------|--------|------------|
| `akkodis-pptx` | PowerPoint プレゼン (.pptx) | python-pptx + 既存テンプレ4種 |
| `akkodis-xlsx` | Excel ワークブック (.xlsx) | openpyxl |
| `akkodis-docx` | Word 文書 (.docx) | python-docx |

3つの Skill 共通で、AKKODiS のブランドカラー（Navy `#001f33` / Gold `#ffb81c`）・フォント・余白などのデザインルールに加え、社内 Writing Checker と同一の **表記ルール（記者ハンドブック準拠 / AKKODiS 固有名詞 / Microsoft 表記 / IOWN® 表記）** を全テキストに自動適用します。

---

## 配布形態

- 各 Skill ディレクトリは **単独で完結** しており、他ディレクトリへの依存はありません
- `dist/skills/akkodis-{pptx,xlsx,docx}.zip` を配ればそのまま使えます
- ZIP 化は `scripts/build-skill-zips.sh` で実行できます

```bash
# リポジトリルートで実行
./scripts/build-skill-zips.sh
# → dist/skills/akkodis-pptx.zip
# → dist/skills/akkodis-xlsx.zip
# → dist/skills/akkodis-docx.zip
```

---

## 使い方（claude.ai Pro / Max・個人プラン）

1. claude.ai を開いて画面右上のプロフィール → **Settings → Capabilities → Skills** へ。
2. **「Upload skill」** をクリックし、上記 ZIP のうち使いたいものをアップロード。
3. 同じ ZIP を 3 回繰り返して 3 種すべて登録するのが推奨です。
4. 通常のチャットで「AKKODiS のスライドを作って」「Excel で KPI 表が欲しい」「提案書を Word で」のように依頼すると、対応する Skill が呼び出されてブランド準拠のファイルが生成されます。

> **チームプラン共有について**: 個人 Pro/Max では Skill はアップロードしたユーザーのみで使えます。チームで共有する場合は各自が同じ ZIP をアップロードしてください。

---

## 使い方（Claude Code）

### 個人グローバル（推奨）

```bash
# どこにいてもコマンドラインで Claude Code から呼べるようにする
mkdir -p ~/.claude/skills
unzip -o dist/skills/akkodis-pptx.zip -d ~/.claude/skills/
unzip -o dist/skills/akkodis-xlsx.zip -d ~/.claude/skills/
unzip -o dist/skills/akkodis-docx.zip -d ~/.claude/skills/
```

その後 Claude Code セッション内で「AKKODiS のスライドを作って」と話しかけるだけで自動的に呼び出されます。

### プロジェクト同梱

このリポジトリではすでに `skills/` 配下に Skill 本体を配置済みです。プロジェクトを開いている Claude Code セッションは、追加設定なしで `skills/` 配下を読み込みます。

---

## 各 Skill の入力フォーマット

すべての Skill は **Markdown ライク** な入力を受け付けます。詳細は各 `examples/sample-input.md` を参照してください。

- `akkodis-pptx/examples/sample-input.md` — プレゼン入力サンプル
- `akkodis-xlsx/examples/sample-input.md` — KPI 表入力サンプル
- `akkodis-docx/examples/sample-input.md` — 提案書入力サンプル

---

## 表記ルール（共通）

3 つの Skill とも `brand/notation-rules.md` を同梱しています。これは社内 Writing Checker（`apps/writing-checker/`）と完全に同一のナレッジで、以下を含みます。

- A. 記者ハンドブック準拠 表記ガイド（接続詞のひらがな化、送り仮名、外来語カタカナなど 19 セクション）
- B. AKKODiS ブランドガイドライン（固有名詞・サービス名）
- C. Microsoft 製品・サービス表記ルール
- D. IOWN® 表記ルール（コンプライアンス）

各 Skill は本文・見出し・キャプション・セル・表など **すべての文字列に対し** このルールを照合して自動修正します。

---

## 依存

各 Skill ZIP には Python スクリプトが含まれます。実行には以下が必要です。

| Skill | 依存 |
|-------|------|
| `akkodis-pptx` | `python-pptx>=0.6.23`, （任意）`Pillow` |
| `akkodis-xlsx` | `openpyxl>=3.1.2` |
| `akkodis-docx` | `python-docx>=1.1.0` |

claude.ai 上ではサンドボックス環境に自動インストールされます。Claude Code をローカルで使う場合は `pip install` で事前インストールしておくと滑らかです。

---

## ライセンス・配布範囲

- 配布範囲は **AKKODiS Japan 社員のみ**
- AKKODiS ロゴおよびブランドガイドラインは社外秘
- 社外配布する場合は別途上長の承認を得ること

## トラブルシュート

| 症状 | 対処 |
|------|------|
| claude.ai に Skill をアップロードすると `name` が衝突する | 個人プランでは同名の Skill を 1 アカウント 1 個まで。古い版を削除してから再アップロード |
| Skill が呼ばれない | プロンプトに「PPTX で」「Excel で」「Word で」など出力フォーマットを明示する |
| Skill 実行時に `python-pptx` 等が無いと言われる | claude.ai のサンドボックスは初回に自動 install するが、長時間後に Skill を呼び直すと再 install が必要なことがある（数十秒待つ）|
| ロゴが PowerPoint で表示されない | PowerPoint のバージョンによっては SVG 表示で問題が出ることがある。`brand/AKKODIS_Logo_*.svg` を PNG に変換して差し替える |
| Word の目次が空 | TOC は Word フィールド。Word で開いて `F9` で更新 |
| 表記補正で意図しない変換が起きる | 各 Skill の `scripts/notation.py` を編集（同梱テスト `tests/test_skills.py::TestNotation` を再実行で検証） |

## テスト

リポジトリルートで pytest を実行すると、3 Skill の動作確認 + 表記補正のユニットテストが走る。

```bash
pip install pytest python-pptx openpyxl python-docx
python -m pytest tests/test_skills.py -v
# → 36 passed
```

## バージョン

- **v2.0.0（2026-04-28）** — 大幅機能強化：
  - 表記自動補正モジュール `notation.py` を導入（Akkodis→AKKODiS、頂く→いただく、IOWN→IOWN®、PowerBI→Power BI など機械的に置換可能なものは Python が自動修正）
  - PPTX: 表紙 + アジェンダ自動 + KPI スライド（Gold 大数字）+ クロージング、ロゴ自動配置、発表者ノート、Gold フッター帯、ページ番号
  - XLSX: 棒グラフ自動追加（`[chart]` 指定）、条件付き書式（CellIsRule で 100% / 80% 閾値）、オートフィルタ、印刷設定（横向き A4・タイトル行繰り返し・ヘッダー/フッター）
  - DOCX: Heading 1/2 スタイル定義、目次フィールド (TOC)、Markdown 表 → Navy ヘッダーテーブル、表紙シェーディング、ヘッダー/フッター（機密区分 + ページ番号）
  - pytest 36 ケースを `tests/test_skills.py` に整備
- v1.0.0（2026-04-28）— 初版
