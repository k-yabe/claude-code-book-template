# [S079] AI NEWS — 読みやすさ改善（記事リンク・詳しく読む・件数・Xリンク）

**ステータス**: 完了
**作成日**: 2026-04-17
**完了日**: 2026-04-17

---

## 背景・課題

ユーザーフィードバック（2026-04-17）:
1. 「記事を検索」の意味がわからない。元記事のURLを掲載すべき。
2. 「詳しく読む」クリック後のUIとデザインが微妙。見るべき順番と内容を精査してほしい。
3. 「その他のニュース」はスクロールしてもいいので、もう少し件数が欲しい。
4. 「𝕏 生成AIトレンド」はクリックでそのツイート（または投稿者プロフィール）にリンクしてほしい。

---

## スコープ

### やること
- [x] `articleLink()` の Google 検索フォールバックを廃止。URL なしの場合はリンクボタン自体を非表示に。
- [x] `openExternal()` を `^https?:\/\/` のみ許可にして、`data-url=""` でも誤動作しないように強化。
- [x] 「詳しく読む」の内容・順序を再設計:
  - `intel-meta`（情報源/公開日時/カテゴリ/読了目安）はカード見出しと重複するため削除
  - 順序: ①なぜ重要か → ②何をすべきか → ③専門家の視点 → タグ → 元記事リンク（存在時のみ）
  - ラベル文言を簡潔に（マーケへの影響→なぜ重要か、推奨アクション→何をすべきか）
  - `.intel-step` で 1/2/3 の番号バッジを表示し読む順を視覚化
- [x] `partition()` の `thisWeek` 上限を 6 → 4 に引き下げて「その他のニュース」に回る件数を増やす
- [x] seed データに FYI 4件、`news.json` に FYI 6件を追加して「その他のニュース」のボリュームを確保
- [x] `𝕏 生成AIトレンド` の各投稿は `x.url`（ツイートURL）があれば優先し、無ければ `@handle` からプロフィールURL (`https://x.com/${handle}`) を自動生成してリンク化。フッターに「↗ ポストを開く / ↗ プロフィールを開く」を表示
- [x] 上記に伴う CSS 調整（`.intel-step` / `.intel-source-link` / `.x-foot-link` を追加）
- [x] `index.html` の WHAT'S NEW と ai-news の onboarding updates を更新

### やらないこと
- scraper 側のデータ収集ロジック変更
- シードデータの大幅追加
- 音声ダイジェスト / キーボードショートカットの仕様変更

---

## 完了条件

- [x] URL がない記事では元記事ボタン / 検索ボタンが一切表示されない
- [x] URL がある記事では「元記事を読む →」ボタンが目立つ位置（詳細展開の末尾＋カードフッター）に表示される
- [x] 「詳しく読む」展開時に ①②③ の順で重要情報が並び、重複メタ情報が消えている
- [x] 注目ニュースは最大4件、残りは「その他のニュース」に表示される（ブラウザ検証で FYI 7件を確認）
- [x] 𝕏 セクションの全カードがクリック可能でプロフィール or ツイートURLに遷移する（Playwright で href=`https://x.com/...` を確認）
- [x] モバイルでもレイアウトが崩れない（CSS は既存のレスポンシブ規則を継承）

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/ai-news/app.js` | 変更（articleLink/renderMustKnow/renderThisWeek/renderMore/renderX/partition） |
| `apps/ai-news/index.html` | 変更（CSS 微調整 + onboarding updates） |
| `index.html` | 変更（WHAT'S NEW 追記） |
| `docs/design.md` | 変更（最終更新日とS079参照追加） |

---

## 作業ログ

- 2026-04-17: タスク起票。UX明瞭化の4点改善。
- 2026-04-17: 実装完了。`apps/ai-news/app.js` で `articleLink` 簡素化／`xLink` 新設／`openExternal` 強化／MUST-KNOW・THIS WEEK・FYI の全カードで URL 有無分岐／`partition` の `thisWeek` を 6→4／シード4件追加。`apps/ai-news/data/news.json` に FYI 6件追加し count 8→14 に更新。`apps/ai-news/index.html` に `.intel-step` `.intel-source-link` `.x-foot-link` の CSS 追加、onboarding `updates` を刷新。`index.html` の WHAT'S NEW 先頭にエントリ追加。`docs/design.md` 更新。
- 2026-04-17: Playwright 検証。シード `localStorage` でオンボーディング抑制後、MUST-KNOW 詳細の ①②③ 番号バッジ表示・FYI 7件・𝕏 全カードの `href=https://x.com/<handle>` 化を確認。アプリ JS エラー 0。外部リソース（Unsplash/unavatar/vercel analytics）の 4xx はサンドボックス環境起因で実害なし。
