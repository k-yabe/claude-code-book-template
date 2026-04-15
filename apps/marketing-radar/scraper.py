#!/usr/bin/env python3
"""
Marketing Radar スクレイパー
複数のマーケ/ビジネス/テック系メディアのRSSを巡回し、news.json に集約する。

使い方:
    python apps/marketing-radar/scraper.py

ソースの追加は SOURCES に辞書を足すだけ。RSSが落ちても他を止めない。
"""

import json
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from html import unescape
from pathlib import Path

import feedparser
import requests

OUTPUT = Path(__file__).parent / "data" / "news.json"
TIMEOUT = 15
MAX_PER_SOURCE = 20
USER_AGENT = "Mozilla/5.0 (compatible; MarketingRadar/1.0; +https://akkodis.example)"

# ── 監視対象リスト ─────────────────────────────────────
# category: marketing_jp / marketing_global / business / tech / sns
SOURCES = [
    # --- Marketing (JP) ---
    {"id": "markezine",       "label": "MarkeZine",         "url": "https://markezine.jp/rss/new/20/index.xml",     "category": "marketing_jp"},
    {"id": "webtan",          "label": "Web担当者Forum",    "url": "https://webtan.impress.co.jp/rss/2.0/rss.xml",   "category": "marketing_jp"},
    {"id": "advertimes",      "label": "AdverTimes",        "url": "https://www.advertimes.com/feed/",              "category": "marketing_jp"},
    {"id": "itm_marketing",   "label": "ITmedia Marketing", "url": "https://rss.itmedia.co.jp/rss/2.0/marketing.xml","category": "marketing_jp"},

    # --- Marketing (Global) ---
    {"id": "martech",         "label": "MarTech",           "url": "https://martech.org/feed/",                     "category": "marketing_global"},
    {"id": "marketingweek",   "label": "Marketing Week",    "url": "https://www.marketingweek.com/feed/",           "category": "marketing_global"},
    {"id": "hubspot",         "label": "HubSpot Marketing", "url": "https://blog.hubspot.com/marketing/rss.xml",    "category": "marketing_global"},

    # --- Business / Market ---
    {"id": "xtrend",          "label": "日経クロストレンド","url": "https://xtrend.nikkei.com/rss/index.rdf",        "category": "business"},
    {"id": "reuters_biz",     "label": "Reuters Business",  "url": "https://www.reutersagency.com/feed/?best-sectors=business-finance&post_type=best", "category": "business"},
    {"id": "prtimes_mkt",     "label": "PR TIMES (マーケ)", "url": "https://prtimes.jp/index.rdf",                   "category": "business"},

    # --- Tech / AI ---
    {"id": "techcrunch_jp",   "label": "TechCrunch Japan",  "url": "https://jp.techcrunch.com/feed/",               "category": "tech"},
    {"id": "itm_news",        "label": "ITmedia NEWS",      "url": "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml", "category": "tech"},
]

CATEGORY_LABELS = {
    "marketing_jp":     "マーケ（国内）",
    "marketing_global": "マーケ（海外）",
    "business":         "ビジネス・市場",
    "tech":             "テック・AI",
    "sns":              "SNSピック",
}

HTML_TAG = re.compile(r"<[^>]+>")

def strip_html(text: str, limit: int = 240) -> str:
    if not text:
        return ""
    text = HTML_TAG.sub("", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] + ("…" if len(text) > limit else "")

def to_iso(time_struct) -> str:
    if not time_struct:
        return ""
    try:
        dt = datetime(*time_struct[:6], tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return ""

def pick_image(entry) -> str:
    # media:thumbnail / media:content / enclosure / og-ish
    try:
        if entry.get("media_thumbnail"):
            return entry["media_thumbnail"][0].get("url", "")
        if entry.get("media_content"):
            for m in entry["media_content"]:
                if m.get("medium") == "image" or (m.get("url", "").lower().endswith((".jpg", ".jpeg", ".png", ".webp"))):
                    return m.get("url", "")
        if entry.get("links"):
            for l in entry["links"]:
                if l.get("rel") == "enclosure" and str(l.get("type", "")).startswith("image/"):
                    return l.get("href", "")
        # summary 内 <img>
        summary = entry.get("summary", "") or entry.get("description", "")
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
        if m:
            return m.group(1)
    except Exception:
        pass
    return ""

def fetch_source(source: dict) -> list:
    items = []
    try:
        resp = requests.get(source["url"], headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
    except Exception as e:
        print(f"[warn] fetch failed: {source['id']}: {e}", file=sys.stderr)
        return items

    for entry in feed.entries[:MAX_PER_SOURCE]:
        title = (entry.get("title") or "").strip()
        link  = (entry.get("link")  or "").strip()
        if not title or not link:
            continue
        summary = strip_html(entry.get("summary") or entry.get("description") or "")
        published = (
            to_iso(entry.get("published_parsed"))
            or to_iso(entry.get("updated_parsed"))
            or ""
        )
        items.append({
            "id": f"{source['id']}:{link}",
            "title": title,
            "url": link,
            "summary": summary,
            "image": pick_image(entry),
            "source_id": source["id"],
            "source_label": source["label"],
            "category": source["category"],
            "published_at": published,
        })
    return items

def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    all_items = []
    for src in SOURCES:
        print(f"[info] fetching {src['id']} ({src['label']})…", file=sys.stderr)
        items = fetch_source(src)
        print(f"[info]   got {len(items)} items", file=sys.stderr)
        all_items.extend(items)
        time.sleep(0.5)  # 軽い間隔

    # 新しい順にソート
    all_items.sort(key=lambda x: x.get("published_at", ""), reverse=True)

    # 直近14日分だけ保持（サイズ抑制）
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    kept = []
    for it in all_items:
        ts = it.get("published_at", "")
        if not ts:
            kept.append(it)
            continue
        try:
            dt = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            if dt >= cutoff:
                kept.append(it)
        except Exception:
            kept.append(it)

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": [{"id": s["id"], "label": s["label"], "category": s["category"]} for s in SOURCES],
        "categories": CATEGORY_LABELS,
        "items": kept,
    }

    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[done] wrote {len(kept)} items -> {OUTPUT}", file=sys.stderr)

if __name__ == "__main__":
    main()
