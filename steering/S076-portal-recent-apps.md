# [S076] ポータル — 最近開いたアプリ

**ステータス**: 完了
**作成日**: 2026-04-16
**完了日**: 2026-04-16

---

## 目的

15アプリの一覧から毎回目当てのアプリを探す手間を省くため、
ポータルトップに「最近開いたアプリ」のクイックアクセス行を追加する。

---

## スコープ

### やること

- [x] カードクリック時にアプリ名・アイコン・URLをlocalStorageに保存（直近5件・URL重複排除）
- [x] ポータル表示時に「RECENT」行を All Apps の上に表示
- [x] コンパクトな pill 形式（アイコン + アプリ名）で横並び
- [x] 履歴ゼロ時は非表示（初回ユーザーに余計なUIを見せない）
- [x] WHAT'S NEW + design.md 更新

### やらないこと

- 「最近」の自動削除（30日期限など）— 5件上限で十分管理される
- ドラッグ並び替えへの影響 — RECENT は並び替え対象外（All Apps のみ）

---

## 完了条件

- [x] アプリを開くたびに localStorage `recentApps` が更新される
- [x] 2回目以降のポータル表示で RECENT 行が出る
- [x] 同一アプリの重複がない（最新1件のみ保持）
- [x] 初回（履歴ゼロ）ではセクション非表示
- [x] WHAT'S NEW に UPDATE エントリ追加

---

## 影響ファイル

| ファイル | 種別 |
|---------|------|
| `index.html` | 変更（CSS + HTML + JS） |
| `docs/design.md` | 変更 |

---

## 作業ログ

- 2026-04-16: 実装完了。CSS（.recent-section/.recent-pill）+ HTML（#recent-section / #recent-row）+ JS（getRecentApps / saveRecentApp / renderRecents + grid click handler）。
