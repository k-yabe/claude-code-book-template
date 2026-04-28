# AKKODiS ブランドガイド（PPTX用 抜粋）

このファイルは AKKODiS のプレゼン資料制作で守るべきルールを Skill 用に抜粋したもの。
公式ガイドと矛盾した場合は公式ガイドを優先する。

---

## 1. カラーパレット

| 用途 | 名称 | HEX | RGB |
|------|------|------|-----|
| プライマリ（背景・タイトル帯） | AKKODiS Navy | `#001f33` | 0, 31, 51 |
| アクセント（強調・KPI数値） | AKKODiS Gold | `#ffb81c` | 255, 184, 28 |
| 背景（ライトモード） | White | `#FFFFFF` | 255, 255, 255 |
| 本文 | Black | `#000000` | 0, 0, 0 |
| 補助線・罫線 | Light Gray | `#E0E4E8` | 224, 228, 232 |

**禁止事項**:
- 赤・緑・紫など派手な色を本文に使わない（凡例として最小限に留める）
- グラデーションは Navy → Gold を縦帯（フッター3px）以外で使わない

---

## 2. タイポグラフィ

| 言語 | 推奨フォント | フォールバック |
|------|------------|----------------|
| 日本語 | Noto Sans JP | Yu Gothic, Hiragino Kaku Gothic ProN, Meiryo |
| 欧文 | Inter | Arial, Helvetica |
| 数字（KPI 強調） | Inter Tight Bold | Arial Bold |

サイズ目安（16:9, 13.333 × 7.5 inch）:

- スライドタイトル: 32–40pt, Bold
- セクション見出し: 24–28pt, Semibold
- 本文（箇条書き）: 18–22pt, Regular
- 注釈: 12–14pt, Regular, Light Gray

---

## 3. レイアウト規約

- スライドサイズ: 16:9（13.333 × 7.5 inch / 9144000 × 5143500 EMU）
- 左右余白: 0.6 inch 以上
- タイトルバー（Navy 帯）: 上端から 0.7 inch、高さ 0.8 inch
- フッター: 下端から 0.4 inch 以内に Navy → Gold のグラデーション 3px 帯 + 中央にページ番号
- ロゴ配置: 左下、下端から 0.3 inch、左端から 0.4 inch、高さ 0.4 inch

---

## 4. ロゴ運用

| ファイル | 推奨背景 |
|---------|---------|
| `AKKODIS_Logo_RGB_BLUE.svg` | 白・薄色背景 |
| `AKKODIS_Logo_RGB_WHITE.svg` | Navy・濃色背景 |
| `AKKODIS_Logo_POS_RGB.svg` | カラー印刷物 |
| `AKKODIS_Logo_NEG_RGB.svg` | 黒背景 |
| `AKKODIS_Logo_RGB_BLACK.svg` | 単色印刷・FAX |

**禁止**:
- ロゴの伸縮・回転・色置換
- ロゴ周囲のクリアスペース（ロゴ高さの 1/2）を侵食する装飾

---

## 5. スライド種別と推奨テンプレート

| 種別 | テンプレート | 用途例 |
|------|------------|--------|
| 社外提案書（フォーマル） | `external-white.pptx` | 顧客向け提案、RFP回答 |
| 社外プレゼン（カンファレンス） | `external-dark.pptx` | 登壇、製品発表 |
| 社内報告（軽め） | `internal-white.pptx` | チーム共有、月次報告 |
| 社内戦略（重め） | `internal-dark.pptx` | 戦略会議、役員報告 |

---

## 6. 1スライド1メッセージ原則

- 本文は箇条書き 3〜5 行
- 1 行は 35 文字以内（日本語）
- 図表とテキストを 1 スライドに混在させすぎない
- 数字を見せたいスライドは KPI を Gold で大きく
