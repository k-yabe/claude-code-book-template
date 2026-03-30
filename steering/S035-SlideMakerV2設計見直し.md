# [S035] Slide Maker v2 設計見直し（Genspark AI同等品質を目指す）

**ステータス**: 完了 <!-- 未着手 | 進行中 | レビュー中 | 完了 -->
**作成日**: 2026-03-29
**完了日**: 2026-03-30

---

## 目的

現行 Slide Maker の PPTX 出力品質が Genspark AI Slides と大きく乖離しており、マーケティング部の実務で使えるレベルに達していない。ビジュアルデザインのアプローチを根本から見直し、参考PPTX（六稿_会社案内）と同等の品質を実現する。

**本ステアリングのスコープは「設計決定」まで。** プロトタイプ実装は別ステアリング（S036）で行う。

---

## 前提条件

### 環境制約
- **Vercel Serverless Functions**: バンドル上限250MB（Node.js）/ 500MB（Python）、メモリ512MB
  - **タイムアウト**: Hobby=10秒 / Pro=デフォルト15秒、`maxDuration` 設定で最大300秒
  - 現行設定: slide-export.py → `maxDuration: 30`、slide-generate.js → `maxDuration: 60`
  - **V2では slide-export.py を `maxDuration: 60` 以上に変更必要**（画像DL並列化しても5枚×1-3秒+PPTX生成で30秒超過リスクあり）
- **Vercel Edge Function streaming**: 初回バイト25秒以内、総計300秒まで。slide-research.js はこちらで実装
- **Puppeteer/Chromium は Vercel Serverless では不可**: Chromiumバイナリ280MBがバンドル上限を超過
- **python-pptx**: v1.0.2（現行）、pure Python でバンドル数MB
- **Vercel Proプラン前提**: 画像DL+PPTX生成のタイムアウト延長に必須

### 外部依存
- Claude API（claude-sonnet-4-6）— 既存。追加コストなし
- Unsplash API — APIキー必要。**Demo: 50リクエスト/時間 / Production: 5,000リクエスト/時間**
  - V2ではProduction申請を前提とする（申請にはアプリの説明とスクリーンショットが必要）
  - Production申請完了までの暫定対応: 画像挿入をオプション化（デフォルトOFF）
- Canva API — MCP経由で利用可能だがサーバーレスFunctionから直接呼べない

### 参考資料
- **目標品質PPTX**: ローカルファイル（リポジトリ外）`~/Downloads/六稿_20262Q_会社案内.pptx` — 1スライド20〜52 shapes、画像・図解・テーブル・装飾shapes多数。※ 社外秘のためリポジトリにコミットしない
- AKKODiSテンプレートPPTX 4種（`apps/slide-maker/templates/`）— 33種のslide_layout、うち現行は11種使用

---

## 品質基準（定量）

参考PPTXと比較して以下を満たすこと:

| 指標 | 参考PPTX | 現行 Slide Maker | 目標 |
|------|---------|-----------------|------|
| 1スライドの平均shape数 | 15〜30個 | 3〜10個 | **12個以上** |
| 画像を含むスライドの割合 | 60% | 0% | **30%以上** |
| テキストのみのスライド率 | 10% | 70% | **30%以下** |
| チャート/テーブル/フロー使用率 | 40% | 30% | **40%以上** |
| PowerPoint修復ダイアログ | なし | あり（時々） | **なし** |

**検証方法**: PowerPoint for Mac (v16.x) + PowerPoint Online で以下を確認:
- 全11レイアウトを含む10枚スライドを生成 → 修復ダイアログなしで開けること
- チャート・テーブル・画像を含むスライドが正常に表示されること
- エクスポート→再度開く→データ損失がないこと

---

## 設計分析結果

### テンプレート未使用レイアウト調査

4テンプレート共通で4スライドマスター、合計33レイアウト。現行は8種のみ使用。

**Tier 1（即時活用・高効果）— 画像対応レイアウト:**

| レイアウト名 | Master | 特徴 | Placeholder |
|------------|--------|------|-------------|
| Text left - Picture Right | 2 | テキスト左+画像右 | PICTURE idx=21 |
| Text Right- Picture Left | 2 | テキスト右+画像左 | PICTURE idx=21 |
| Content Left - Full Picture Right | 2 | テキスト左+大画像右 | PICTURE idx=12 |
| Large Image - Right | 2 | テキスト+大画像 | PICTURE idx=21 |
| Picture full screen with Title block | 2 | フルブリード画像+タイトル | PICTURE idx=32 |

**Tier 2（有用なバリエーション）:**

| レイアウト名 | Master | 特徴 |
|------------|--------|------|
| Agenda - Mesh Y&B | 1 | 8チャプター対応（現行は6） |
| Centered Text Box | 2 | 中央寄せコンテンツ（強調用） |
| Any questions? / Q and A | 3 | 質疑応答用クロージング |
| Title and SubTitle only | 2 | シンプルな区切りスライド |

**Tier 3（複雑だが高インパクト）:**

| レイアウト名 | Master | 特徴 |
|------------|--------|------|
| Four Text Boxes with Pictures | 2 | 4画像グリッド（14 placeholder） |
| Six Small Text Boxes - Full Picture Right | 2 | グリッド+画像（10 placeholder） |

### アプローチ決定: B（python-pptx強化）

**理由:**
1. テンプレートに画像対応レイアウト5種が未使用 → これを活用するだけで画像含有率0%→30%以上が達成可能
2. python-pptx はネイティブチャート・テーブル・AutoShape・画像挿入すべてサポート
3. Vercel Python Serverless のバンドル上限500MBに対し、python-pptx は数MB
4. ハイブリッド方式（D）はフロントCanvas画像をPPTXに埋め込む手間が大きく、テンプレートレイアウトの恩恵を受けにくい

**アプローチDを不採用にした理由:** Canvas画像はラスタライズされるため、PowerPoint上で編集不可。テンプレートのネイティブレイアウトを活用する方がプロフェッショナルな仕上がりになる。

### 画像挿入方針: Unsplash API

- **Unsplash API**（無料枠: 50リクエスト/時間）を使用
- Claude が生成する構成JSONに `imageQuery` フィールドを追加（例: `"imageQuery": "digital transformation office"`）
- slide-export.py で Unsplash API を呼び出し、画像をダウンロード→PICTURE placeholderに挿入
- APIキーは Vercel 環境変数 `UNSPLASH_ACCESS_KEY` で管理
- **フォールバック戦略**（優先順）:
  1. Unsplash API成功 → 画像をPICTURE placeholderに挿入
  2. API失敗/タイムアウト → プレースホルダーを空にする（テンプレートのデフォルト画像が表示される）
  3. レートリミット超過 → 以降の画像挿入をスキップし、テキスト系レイアウトにフォールバック
  4. UNSPLASH_ACCESS_KEY未設定 → 画像系レイアウトを自動的にcontent系に変換
- **画像DL並列化**: `asyncio` + `urllib` で複数画像を同時取得（30秒タイムアウト内に収める）

### SYSTEM_PROMPT改善方針

1. **レイアウト選択肢を拡充**: 11種→16種（画像系5種+中央テキスト+Q&A追加）
2. **`imageQuery` フィールド追加**: 画像系レイアウト使用時に必須
3. **レイアウト配分ルール強化**:
   - テキストのみ(content) ≤ 20%
   - 画像系 ≥ 25%
   - データ系(chart/table/flow) ≥ 25%
   - 構造系(sixbox/two-column) ≥ 15%
4. **shape数の目安を指示**: 1スライドあたり装飾shape 3〜5個を目標

### ディープリサーチ機能

**アーキテクチャ: クライアント側オーケストレーション（Option D）**

Genspark AI / SuperNinja と同様に、リサーチとスライド生成を分離する。

```
[ユーザー入力]
  → Phase 1: /api/slide-research（リサーチ専用、streaming）
    - claude-sonnet-4-6 + extended thinking + web_search (max_uses: 15)
    - 出力: { sections: [{ title, findings: [{ fact, source_url, confidence }] }] }
    - ストリーミングで進捗表示（「3件のソースを発見...」）
  → Phase 2: /api/slide-generate（既存、リサーチ結果をコンテキストに）
    - リサーチ結果 + ユーザー入力 → スライド構成JSON
  → (Optional) Phase 3: /api/slide-factcheck（スライド単位のファクトチェック）
    - claude-haiku-4-5 + web_search (max_uses: 3)
    - 各スライドの主張を検証、出典付き
```

**Vercelタイムアウト対策:** slide-research.js は Edge Function（`runtime: 'edge'`）+ streaming で実装。初回バイト25秒以内、総計300秒まで。`tool_choice: "auto"` で extended thinking + web_search を併用。

**UI:**
- チャット画面に「ディープリサーチ」トグル追加
- リサーチ中はストリーミングで発見事項をリアルタイム表示
- 各スライドに「ファクトチェック」ボタン（Genspark同様）

**コスト見積:**

| モード | API呼び出し | 所要時間 | 推定コスト |
|--------|-----------|---------|-----------|
| Quick（現行） | 1回 | 10-15秒 | ~$0.02 |
| ディープリサーチ | 2回 | 60-90秒 | ~$0.15-0.25 |
| +ファクトチェック | +10回 | +60秒 | ~$0.30-0.50 |

---

## スコープ

### やること（設計決定フェーズ）
- [x] アプローチB（python-pptx強化）vs D（ハイブリッド）の比較検証 → **B採用**
- [x] テンプレートの未使用slide_layout調査 → **画像系5種 + バリエーション4種を特定**
- [ ] 参考PPTXの代表的スライド3枚を分解し、python-pptxでの再現可能性を検証
- [x] 画像挿入の方針決定 → **Unsplash API**
- [x] SYSTEM_PROMPTの改善方針 → **16レイアウト + imageQuery + 配分ルール強化**
- [x] ディープリサーチ機能の設計 → **クライアント側オーケストレーション + streaming**
- [x] 設計ドキュメントを `docs/design.md` に反映
- [x] S036（プロトタイプ実装）のステアリングファイルを作成 → `S036-SlideMakerV2実装.md`

### やらないこと（スコープ外）
- チャットUI/UXの基本改善（S034で対応済み）
- テンプレートPPTXファイル自体のデザイン変更
- アプローチA（Puppeteer/Chromium）— Vercel制約で技術的に不可能
- アプローチC（Canva API）— MCPセッション依存でサーバーレスから呼べない

---

## 完了条件

- [x] アプローチ（B or D）が決定し、`docs/design.md` に根拠とともに記録されている → **B採用**
- [x] テンプレートの未使用slide_layout調査結果がドキュメント化されている → **上記参照**
- [ ] 参考PPTXの代表スライド3枚について「python-pptxで再現可能/不可能」の判定リストがある
- [x] 画像挿入方針が決定している → **Unsplash API（環境変数管理）**
- [x] SYSTEM_PROMPT改善の方向性が決定している → **16レイアウト + 配分ルール**
- [x] ディープリサーチ機能の設計が完了している → **3フェーズ streaming**
- [x] S036（プロトタイプ実装）のステアリングファイルが作成されている → `steering/S036-SlideMakerV2実装.md`

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `docs/design.md` | 変更（設計決定の記録） |
| `steering/S036-*.md` | 新規（実装ステアリング） |
| `index.html` | 変更（WHAT'S NEW — 実装完了後） |

※ 実装フェーズ（S036）で変更されるファイル:
| ファイル | 変更種別 |
|---------|---------|
| `api/slide-export.py` | 変更（画像挿入+新レイアウト対応） |
| `api/slide-generate.js` | 変更（SYSTEM_PROMPT 16レイアウト化） |
| `api/slide-research.js` | **新規**（ディープリサーチ Edge Function） |
| `apps/slide-maker/index.html` | 変更（リサーチUI + border-radius削除） |
| `vercel.json` | 変更（maxDuration調整 + research endpoint追加） |
| `requirements.txt` | 変更（依存追加の可能性） |

**S036で対応すべきブランドガイドライン違反**: `apps/slide-maker/index.html` に border-radius が10箇所あり（チャットバブル、ボタン等）。AKKODiS角丸NGルールに抵触するため修正必須。

---

## 参照

- `docs/design.md` — Slide Maker セクション
- `steering/S034-スライドメーカー.md` — v1 ステアリング
- Genspark AI Slides: https://www.genspark.ai/agents?type=slides_agent

---

## 作業ログ

### 2026-03-29: v1 の限界を確認
- python-pptx の placeholder + shape 追加方式では、参考PPTXのビジュアル品質に到達不可能
- 根本的なアプローチの見直しが必要と判断
- S035として設計見直しを開始

### 2026-03-29: レビュー結果
- アプローチA（Puppeteer）はVercel制約で不可 → 候補から除外
- アプローチC（Canva API）はMCPセッション依存で不可 → 候補から除外
- B（python-pptx強化）vs D（ハイブリッド）に絞り込み
- 完了条件を定量化、フェーズを設計/実装に分割

### 2026-03-30: テンプレート調査 + 設計決定
- 4テンプレート全33レイアウトを調査。画像対応5種が未使用と判明
- アプローチB（python-pptx強化）を正式採用。理由: テンプレートのネイティブ画像レイアウトを活用でき、PowerPoint上で編集可能
- 画像挿入: Unsplash API に決定（無料50req/h、環境変数管理）
- ディープリサーチ機能: クライアント側オーケストレーション方式（リサーチ→生成→ファクトチェックの3フェーズ分離）
- SYSTEM_PROMPT: 16レイアウト化 + imageQueryフィールド + 配分ルール強化
