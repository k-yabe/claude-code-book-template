# [S081] AKKODiS Claude Skills（PPTX / XLSX / DOCX）

**ステータス**: 進行中
**作成日**: 2026-04-28
**完了日**: —

---

## 目的

部長要望「AKKODiSブランドに準拠したスライド生成を Claude Skill として共有したい。Excel/Word 版もあると良い」に応える。
claude.ai（Pro/Max 個人プラン）および Claude Code から自然言語で AKKODiS ブランドガイドに準拠した PPTX / XLSX / DOCX を生成できる Skill 一式を作り、社内に ZIP 配布する。

---

## スコープ

### やること

- [x] `skills/akkodis-pptx/`（プレゼン資料 Skill）
  - [x] `SKILL.md`（フロントマター + 使い方）
  - [x] `brand/AKKODIS_Logo_*.svg` 同梱
  - [x] `brand/style-guide.md`（カラー・フォント・余白ルール）
  - [x] `templates/` に既存 `apps/slide-maker/templates/*.pptx` を参照（重複コピーで配布完結）
  - [x] `scripts/build_pptx.py`（python-pptx ベースの生成スクリプト）
  - [x] `examples/`（最小サンプル入力）
- [x] `skills/akkodis-xlsx/`（表・レポート Skill）
  - [x] `SKILL.md` / `brand/` / `scripts/build_xlsx.py`（openpyxl）
- [x] `skills/akkodis-docx/`（提案書・議事録 Skill）
  - [x] `SKILL.md` / `brand/` / `scripts/build_docx.py`（python-docx）
- [x] `skills/README.md`（配布手順・claude.ai Upload 手順・`~/.claude/skills/` 設置手順）
- [x] `scripts/build-skill-zips.sh`（3つのSkillをそれぞれZIP化）
- [x] `index.html` の `WHATS_NEW` に追記
- [x] `docs/design.md` に Skills セクションを追加

### やらないこと（スコープ外）

- claude.ai チームSkillsへの自動アップロード（Pro/Max個人プラン前提のため不要）
- 既存 Web アプリ `apps/slide-maker/` の置き換え（共存）
- AI画像生成や凝ったマスター変更（既存テンプレ4種を流用するに留める）
- 多言語対応（日本語のみ）

---

## 完了条件

- [x] `skills/akkodis-pptx/`, `skills/akkodis-xlsx/`, `skills/akkodis-docx/` がそれぞれ単体で配布可能な構造で揃っている
- [x] `skills/README.md` に「claude.ai に Upload する手順」「Claude Code の `~/.claude/skills/` に置く手順」が書かれている
- [x] 各 Skill の `SKILL.md` に Anthropic Skills 仕様のフロントマター（`name`, `description`）がある
- [x] `scripts/build-skill-zips.sh` で 3 つの ZIP が生成できる（`dist/skills/*.zip`）
- [x] `index.html` の `WHATS_NEW` に今日の日付でエントリ追加（バッジは `NEW`）
- [x] `docs/design.md` に「AKKODiS Claude Skills」セクションを追加
- [x] `main` までマージ、Vercel デプロイがトリガーされる

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `skills/README.md` | 新規 |
| `skills/akkodis-pptx/SKILL.md` | 新規 |
| `skills/akkodis-pptx/brand/style-guide.md` | 新規 |
| `skills/akkodis-pptx/brand/AKKODIS_Logo_*.svg` (5枚) | 新規（コピー） |
| `skills/akkodis-pptx/templates/*.pptx` (4種) | 新規（既存テンプレからコピー） |
| `skills/akkodis-pptx/scripts/build_pptx.py` | 新規 |
| `skills/akkodis-pptx/examples/sample-input.md` | 新規 |
| `skills/akkodis-xlsx/SKILL.md` | 新規 |
| `skills/akkodis-xlsx/brand/style-guide.md` | 新規 |
| `skills/akkodis-xlsx/scripts/build_xlsx.py` | 新規 |
| `skills/akkodis-xlsx/examples/sample-input.md` | 新規 |
| `skills/akkodis-docx/SKILL.md` | 新規 |
| `skills/akkodis-docx/brand/style-guide.md` | 新規 |
| `skills/akkodis-docx/scripts/build_docx.py` | 新規 |
| `skills/akkodis-docx/examples/sample-input.md` | 新規 |
| `scripts/build-skill-zips.sh` | 新規 |
| `index.html` | WHATS_NEW 追記 |
| `docs/design.md` | Skills セクション追加 |

---

## 参照

- `docs/design.md` — AKKODiS Claude Skills セクション
- 既存資産: `apps/slide-maker/templates/*.pptx`, `assets/SVG/AKKODIS_Logo_*.svg`
- Anthropic Skills 仕様: SKILL.md にフロントマター（YAML）で `name`, `description` を記述。本文に使い方とアセット参照を記述する。

---

## 作業ログ

- 2026-04-28: 開始。配布形態は「ZIP配布 + 各自で claude.ai に Upload / `~/.claude/skills/` 設置」に確定（チームプランではないため）。
- 2026-04-28: 既存 PPTX テンプレ 4 種（external/internal × dark/white）を流用する方針。AKKODiS ブランドカラーは Navy `#001f33` / Gold `#ffb81c`。
