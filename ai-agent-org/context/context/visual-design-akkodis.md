# ビジュアルデザインシステム — AKKODiS

> AKKODiSコンサルティング（本業）向けのデザインガイドライン。

## カラーパレット

### プライマリ
| 名前 | HEX | 用途 |
|------|-----|------|
| Navy | `#001f33` | メイン背景・ヘッダー |
| Gold | `#ffb81c` | アクセント・CTA・バッジ |
| White | `#ffffff` | テキスト（ダーク背景上） |

### セカンダリ
| 名前 | HEX | 用途 |
|------|-----|------|
| Light Blue | `#e8f4fd` | 薄い背景・hover |
| Dark Navy | `#001428` | より深い背景 |
| Gray | `#6c757d` | サブテキスト・無効状態 |

### ステータスカラー
| ステータス | HEX |
|------------|-----|
| 成功/完了 | `#28a745` |
| 警告/注意 | `#ffc107` |
| エラー/危険 | `#dc3545` |
| 情報/新着 | `#17a2b8` |

## タイポグラフィ

- **見出し**: bold、サイズは h1=2rem / h2=1.5rem / h3=1.25rem
- **本文**: 1rem / line-height: 1.6
- **フォントスタック**: `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif`

## バッジ・ラベル

- **NEW バッジ**: Navy背景 `#001f33` + Gold文字 `#ffb81c`
- **UPDATE バッジ**: Gold背景 `#ffb81c` + Navy文字 `#001f33`

## コンポーネントパターン

### カード
- 白背景 / border-radius: 8px / box-shadow: 0 2px 8px rgba(0,0,0,0.1)
- padding: 16-24px / hover時に軽いelevation

### ボタン
- プライマリ: Gold背景 + Navy文字
- セカンダリ: Navy背景 + White文字
- border-radius: 4-6px / padding: 8-12px 16-24px

### フォーム
- border: 1px solid #ddd / border-radius: 4px
- focus時: Gold border / outline: none

## アニメーション原則
- トランジション: 150-200ms ease
- hover効果: transform translateY(-2px) + shadow強化
- 過度なアニメーションは避ける（機能>装飾）
