#!/usr/bin/env python3
"""
AKKODiS サイト監視スクレイパー
監視対象URLを巡回し、新着記事を articles.json に保存する。

監視対象を追加する場合は SOURCES リストにエントリを追加するだけ。
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT = Path(__file__).parent / "data" / "articles.json"

# ── 監視対象リスト ─────────────────────────────────────
# 追加するときはここにエントリを足す
SOURCES = [
    {
        "id": "blog",
        "label": "Akkodis Blog",
        "url": "https://www.akkodis.com/en/blog",
        "type": "blog",
    },
    {
        "id": "thinkers",
        "label": "Thinkers & Makers",
        "url": "https://www.akkodis.com/en/insights/thinkers-and-makers",
        "type": "thinkers",
    },
]


# ── スクレイパー ───────────────────────────────────────
def scrape_blog(page, source: dict) -> list[dict]:
    """ブログ一覧ページから記事リストを取得（1ページ目のみ）"""
    page.goto(source["url"], wait_until="networkidle", timeout=30000)
    articles = []

    links = page.query_selector_all("a[href*='/blog/articles/']")
    seen = set()
    for link in links:
        href = link.get_attribute("href") or ""
        if not href or href in seen:
            continue
        seen.add(href)

        url = href if href.startswith("http") else f"https://www.akkodis.com{href}"
        # タイトルはh2 or リンクテキスト
        h2 = link.query_selector("h2")
        title = (h2.inner_text() if h2 else link.inner_text()).strip()
        if not title or not url:
            continue

        articles.append({
            "id": re.sub(r"[^a-z0-9-]", "", href.split("/")[-1]),
            "title": title,
            "url": url,
            "source_id": source["id"],
            "source_label": source["label"],
        })

    return articles


def scrape_thinkers(page, source: dict) -> list[dict]:
    """Thinkers & Makers ページからPDFリンクを取得"""
    page.goto(source["url"], wait_until="networkidle", timeout=30000)
    articles = []

    links = page.query_selector_all("a[href*='.pdf']")
    seen = set()
    for link in links:
        href = link.get_attribute("href") or ""
        if not href or href in seen:
            continue
        seen.add(href)

        url = href if href.startswith("http") else f"https://www.akkodis.com{href}"
        title = link.inner_text().strip()
        if not title:
            # 親要素からタイトルを探す
            parent = link.evaluate_handle("el => el.closest('section, article, div')")
            title = parent.query_selector("h2, h3")
            title = title.inner_text().strip() if title else href.split("/")[-1]

        slug = re.sub(r"[^a-z0-9-]", "", href.split("/")[-1].replace(".pdf", "").lower())
        articles.append({
            "id": slug,
            "title": title if isinstance(title, str) else slug,
            "url": url,
            "source_id": source["id"],
            "source_label": source["label"],
        })

    return articles


SCRAPER_MAP = {
    "blog": scrape_blog,
    "thinkers": scrape_thinkers,
}


# ── メイン ────────────────────────────────────────────
def main():
    # 既存データを読み込む
    existing = {}
    if OUTPUT.exists():
        data = json.loads(OUTPUT.read_text())
        for item in data.get("articles", []):
            existing[item["id"]] = item

    scraped_ids = []
    all_articles = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for source in SOURCES:
            print(f"  [{source['label']}] スクレイピング中...")
            scraper = SCRAPER_MAP.get(source["type"])
            if not scraper:
                print(f"    スクレイパー未定義: {source['type']}")
                continue

            try:
                items = scraper(page, source)
                print(f"    {len(items)} 件取得")
                for item in items:
                    scraped_ids.append(item["id"])
                    if item["id"] in existing:
                        # 既存データの first_seen を引き継ぐ
                        item["first_seen"] = existing[item["id"]]["first_seen"]
                    else:
                        item["first_seen"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                all_articles.extend(items)
            except Exception as e:
                print(f"    エラー: {e}")

        browser.close()

    # IDの順序（新しいものが先）を保持しつつ保存
    output = {
        "last_scraped": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "articles": all_articles,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"保存完了: {OUTPUT} ({len(all_articles)} 件)")


if __name__ == "__main__":
    main()
