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

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

MONTHS_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

def fetch_published_date(page, url: str):
    """記事ページから公開日を取得する。2つの形式に対応:
    - Blog: "Posted On 18th of February, 2026"
    - Client Stories: "PublishedMar 27, 2025"
    """
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)

        # Blog形式: "Posted On XX of Month, YYYY"
        el = page.query_selector("p:has-text('Posted On')")
        if el:
            text = el.inner_text()
            m = re.search(r"(\d+)\w+\s+of\s+(\w+),?\s+(\d{4})", text, re.IGNORECASE)
            if m:
                day, month_str, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
                month = MONTHS.get(month_str)
                if month:
                    return datetime(year, month, day, tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Client Stories形式: "PublishedMar 27, 2025"
        body = page.inner_text("body")
        m = re.search(r"Published([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})", body)
        if m:
            month_abbr, day, year = m.group(1).lower(), int(m.group(2)), int(m.group(3))
            month = MONTHS_ABBR.get(month_abbr)
            if month:
                return datetime(year, month, day, tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        return None
    except Exception:
        return None

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
    {
        "id": "client_stories",
        "label": "Client Stories",
        "url": "https://www.akkodis.com/en/blog/client-success",
        "type": "client_stories",
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

    # thinkers-and-makers ドキュメントのみ対象（フッター等の無関係なPDFを除外）
    links = page.query_selector_all("a[href*='thinkers']")
    seen = set()
    for link in links:
        href = link.get_attribute("href") or ""
        if not href.endswith(".pdf") or href in seen:
            continue
        seen.add(href)

        url = href if href.startswith("http") else f"https://www.akkodis.com{href}"

        # ファイル名からタイトルを生成（例: thinkers_and_makers_vol3_2025.pdf → Thinkers & Makers Vol.3 2025）
        filename = href.split("/")[-1].replace(".pdf", "")
        m = re.search(r"vol[_-]?0*(\d+)[_-]?(\d{4})", filename, re.IGNORECASE)
        if m:
            title = f"Thinkers & Makers Vol.{m.group(1)} {m.group(2)}"
        else:
            title = filename.replace("_", " ").replace("-", " ").title()

        # 年をファイル名から抽出して published_date に格納（精度: 年のみ）
        year_m = re.search(r"(20\d{2})", filename)
        published_date = f"{year_m.group(1)}" if year_m else None

        slug = re.sub(r"[^a-z0-9-]", "-", filename.lower()).strip("-")
        articles.append({
            "id": slug,
            "title": title,
            "url": url,
            "source_id": source["id"],
            "source_label": source["label"],
            "published_date": published_date,
        })

    return articles


def scrape_client_stories(page, source: dict) -> list[dict]:
    """Client Success Stories ページから記事リストを取得"""
    page.goto(source["url"], wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2000)
    articles = []

    links = page.query_selector_all("a[href*='/blog/client-success/']")
    seen = set()
    for link in links:
        href = link.get_attribute("href") or ""
        if not href or href in seen:
            continue
        seen.add(href)

        url = href if href.startswith("http") else f"https://www.akkodis.com{href}"
        h2 = link.query_selector("h2")
        title = (h2.inner_text() if h2 else link.inner_text()).strip()
        # "View Client Stories" などのナビ文字を除外
        if not title or len(title) < 10 or "View Client" in title:
            continue

        slug = re.sub(r"[^a-z0-9-]", "-", href.split("/")[-1].lower()).strip("-")
        articles.append({
            "id": slug,
            "title": title,
            "url": url,
            "source_id": source["id"],
            "source_label": source["label"],
        })

    return articles


SCRAPER_MAP = {
    "blog": scrape_blog,
    "thinkers": scrape_thinkers,
    "client_stories": scrape_client_stories,
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
                        # 既存データを引き継ぐ
                        item["first_seen"] = existing[item["id"]]["first_seen"]
                        item["published_date"] = existing[item["id"]].get("published_date")
                    else:
                        item["first_seen"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                        # ブログ記事・Client Storiesは個別ページから公開日を取得
                        if source["type"] in ("blog", "client_stories"):
                            print(f"      公開日取得中: {item['url']}")
                            item["published_date"] = fetch_published_date(page, item["url"])
                        else:
                            item["published_date"] = None
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
