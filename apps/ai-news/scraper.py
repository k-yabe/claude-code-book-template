#!/usr/bin/env python3
"""
AI NEWS 収集スクリプト

複数のRSSフィード（マーケ／市場・業界／AI）を横断取得し、
Anthropic Claude Haiku で日本語サマリー + タグを生成して
apps/ai-news/data/news.json と apps/ai-news/data/archives/YYYY-MM-DD.json に保存する。

設計方針:
- API キーなしでも動作する（フォールバック: RSS description 簡易整形）
- 1ソース失敗で全体を止めない
- 重複は URL で排除
- 結果は publishedAt 降順
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Iterable

import feedparser

JST = timezone(timedelta(hours=9))
UTC = timezone.utc

# ── 監視対象 RSS フィード ──────────────────────────────────────────
# category: marketing | market | ai
SOURCES: list[dict[str, str]] = [
    # マーケティング系
    {"name": "MarkeZine",                "url": "https://markezine.jp/rt/new.rdf",                            "category": "marketing"},
    {"name": "Web担当者Forum",            "url": "https://webtan.impress.co.jp/rss/all",                       "category": "marketing"},
    {"name": "MarTech",                  "url": "https://martech.org/feed/",                                  "category": "marketing"},
    {"name": "Marketing Brew",           "url": "https://www.marketingbrew.com/feed",                          "category": "marketing"},
    {"name": "HubSpot Marketing Blog",   "url": "https://blog.hubspot.com/marketing/rss.xml",                 "category": "marketing"},
    {"name": "Search Engine Land",       "url": "https://searchengineland.com/feed",                          "category": "marketing"},
    {"name": "Search Engine Journal",    "url": "https://www.searchenginejournal.com/feed/",                  "category": "marketing"},
    # 市場・業界
    {"name": "AdExchanger",              "url": "https://www.adexchanger.com/feed/",                          "category": "market"},
    {"name": "Adweek",                   "url": "https://www.adweek.com/feed/",                               "category": "market"},
    {"name": "電通報",                    "url": "https://dentsu-ho.com/articles.atom",                         "category": "market"},
    # AI
    {"name": "TechCrunch AI",            "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "category": "ai"},
    {"name": "The Verge AI",             "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "category": "ai"},
    {"name": "VentureBeat AI",           "url": "https://venturebeat.com/category/ai/feed/",                  "category": "ai"},
    {"name": "OpenAI Blog",              "url": "https://openai.com/blog/rss.xml",                            "category": "ai"},
    {"name": "Google Research Blog",     "url": "https://research.google/blog/rss/",                          "category": "ai"},
]

# 取得上限・要約上限
RECENT_HOURS    = 36
PER_SOURCE_MAX  = 8
SUMMARIZE_MAX   = 30      # Claude に渡す件数上限
TIMEOUT_SEC     = 15      # feedparser には直接効かないため socket で設定
SUMMARY_CHARS   = 140

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
HAIKU_MODEL       = "claude-haiku-4-5-20251001"

ROOT      = Path(__file__).resolve().parent
DATA_DIR  = ROOT / "data"
ARCH_DIR  = DATA_DIR / "archives"


# ── ユーティリティ ──────────────────────────────────────────
def log(msg: str) -> None:
    print(f"[ai-news] {msg}", flush=True)


def strip_html(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def truncate(text: str, n: int) -> str:
    text = (text or "").strip()
    if len(text) <= n:
        return text
    return text[: max(0, n - 1)].rstrip() + "…"


def make_id(url: str) -> str:
    return "n_" + hashlib.sha1(url.encode("utf-8", errors="ignore")).hexdigest()[:12]


def parse_pub(entry: Any) -> datetime | None:
    """RSSエントリの公開日時を UTC datetime として返す"""
    for key in ("published", "updated", "created"):
        val = entry.get(key) if isinstance(entry, dict) else getattr(entry, key, None)
        if not val:
            continue
        try:
            dt = parsedate_to_datetime(val)
            if dt is None:
                continue
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)
        except Exception:
            continue
    # parsed 構造体
    for key in ("published_parsed", "updated_parsed"):
        val = entry.get(key) if isinstance(entry, dict) else getattr(entry, key, None)
        if val:
            try:
                return datetime(*val[:6], tzinfo=UTC)
            except Exception:
                continue
    return None


# ── 収集 ──────────────────────────────────────────
def fetch_all() -> list[dict]:
    cutoff = datetime.now(UTC) - timedelta(hours=RECENT_HOURS)
    all_items: list[dict] = []
    seen_urls: set[str] = set()

    import socket
    socket.setdefaulttimeout(TIMEOUT_SEC)

    for src in SOURCES:
        try:
            log(f"fetching {src['name']} ...")
            d = feedparser.parse(src["url"], request_headers={
                "User-Agent": "AKKODiSAINewsBot/1.0 (+https://kunito-yabe.vercel.app/)",
            })
            if d.bozo and not d.entries:
                log(f"  -> bozo & no entries: {d.bozo_exception}")
                continue
            count = 0
            for e in d.entries[:PER_SOURCE_MAX]:
                url = (getattr(e, "link", None) or "").strip()
                if not url or url in seen_urls:
                    continue
                pub = parse_pub(e)
                if pub is None or pub < cutoff:
                    continue
                title = strip_html(getattr(e, "title", "") or "").strip()
                if not title:
                    continue
                raw_summary = strip_html(getattr(e, "summary", "") or getattr(e, "description", "") or "")
                seen_urls.add(url)
                all_items.append({
                    "id": make_id(url),
                    "title": truncate(title, 200),
                    "url": url,
                    "raw_summary": raw_summary,
                    "source": src["name"],
                    "sourceType": "media",
                    "category": src["category"],
                    "publishedAt": pub.isoformat(),
                })
                count += 1
            log(f"  -> {count} new")
        except Exception as ex:
            log(f"  ! error {src['name']}: {ex}")

    all_items.sort(key=lambda x: x["publishedAt"], reverse=True)
    log(f"total collected: {len(all_items)}")
    return all_items


# ── 要約 ──────────────────────────────────────────
def fallback_summarize(items: list[dict]) -> list[dict]:
    """API無し / 失敗時の素朴フォールバック。先頭1件をTOP、次5件をBRIEFINGとする。"""
    for idx, it in enumerate(items):
        body = it.pop("raw_summary", "")
        it["summary"] = truncate(body, SUMMARY_CHARS) or it["title"]
        it["tags"] = []
        if idx == 0:
            it["importance"] = 1
        elif idx < 6:
            it["importance"] = 2
        else:
            it["importance"] = 3
        it["readMin"] = 1
    return items


def call_anthropic(items: list[dict]) -> list[dict] | None:
    """Claude Haikuで一括要約。成功時は items に summary/tags を埋めて返す。失敗時 None"""
    try:
        import anthropic  # type: ignore
    except ImportError:
        log("anthropic SDK not available, skipping AI summary")
        return None
    if not ANTHROPIC_API_KEY:
        log("ANTHROPIC_API_KEY missing, skipping AI summary")
        return None

    target = items[:SUMMARIZE_MAX]
    payload = [
        {
            "i": idx,
            "title": it["title"],
            "source": it["source"],
            "category": it["category"],
            "snippet": truncate(it.get("raw_summary", ""), 600),
        }
        for idx, it in enumerate(target)
    ]

    system_prompt = (
        "あなたはB2Bマーケティング担当者向けのニュースキュレーターです。"
        "各記事について、日本語で約100〜140字の自然な要約・3〜5個の日本語タグ・"
        "重要度（importance: 1=最重要1件のみ・本日のTOPストーリー、2=押さえるべき5件、3=その他）"
        "・推定読了時間（readMin: 1〜3、要約から想定）を作成してください。"
        "重要度1は最も影響範囲が広い1件のみ。煽りや推測は避け、事実ベースで。"
        "出力は厳密にJSONのみで、{\"items\":[{\"i\":0,\"summary\":\"...\",\"tags\":[\"...\"],\"importance\":1,\"readMin\":1}, ...]} の形式に従ってください。"
    )

    user_prompt = (
        "次の記事リストを、上記ルールに従って要約してください。\n"
        "入力JSON:\n" + json.dumps(payload, ensure_ascii=False)
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = "".join(getattr(b, "text", "") for b in msg.content)
    except Exception as ex:
        log(f"anthropic call failed: {ex}")
        return None

    parsed = extract_json(text)
    if not parsed or "items" not in parsed:
        log("anthropic response was not valid JSON")
        return None

    by_index = {int(o["i"]): o for o in parsed["items"] if "i" in o}
    top_assigned = False
    for idx, it in enumerate(target):
        o = by_index.get(idx)
        raw = it.pop("raw_summary", "")
        if o:
            it["summary"] = truncate((o.get("summary") or "").strip(), SUMMARY_CHARS) or truncate(raw, SUMMARY_CHARS)
            tags = o.get("tags") or []
            if isinstance(tags, list):
                it["tags"] = [str(t).strip() for t in tags if str(t).strip()][:5]
            else:
                it["tags"] = []
            try:
                imp = int(o.get("importance") or 3)
            except Exception:
                imp = 3
            imp = max(1, min(3, imp))
            # importance=1 は1件のみに制限
            if imp == 1 and top_assigned:
                imp = 2
            if imp == 1:
                top_assigned = True
            it["importance"] = imp
            try:
                rm = int(o.get("readMin") or 1)
            except Exception:
                rm = 1
            it["readMin"] = max(1, min(3, rm))
        else:
            it["summary"] = truncate(raw, SUMMARY_CHARS) or it["title"]
            it["tags"] = []
            it["importance"] = 3
            it["readMin"] = 1

    # 上限を超えた分はフォールバック（全部 more 扱い）
    if len(items) > SUMMARIZE_MAX:
        rest = items[SUMMARIZE_MAX:]
        fallback_summarize(rest)
        for it in rest:
            it["importance"] = 3
            it["readMin"] = 1
    return items


def extract_json(text: str) -> dict | None:
    text = text.strip()
    # コードフェンス除去
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # 最初の { 〜 最後の }
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        return None
    try:
        return json.loads(text[s : e + 1])
    except Exception:
        return None


# ── 保存 ──────────────────────────────────────────
def save(items: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARCH_DIR.mkdir(parents=True, exist_ok=True)
    today_jst = datetime.now(JST).strftime("%Y-%m-%d")
    payload = {
        "updatedAt": datetime.now(UTC).isoformat(),
        "generatedFor": today_jst,
        "count": len(items),
        "items": items,
    }
    latest = DATA_DIR / "news.json"
    archive = ARCH_DIR / f"{today_jst}.json"
    latest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    archive.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"wrote {latest.relative_to(ROOT.parent.parent)} and {archive.relative_to(ROOT.parent.parent)} ({len(items)} items)")


# ── エントリーポイント ──────────────────────────────────────────
def main() -> int:
    started = time.time()
    items = fetch_all()
    if not items:
        log("no items collected; preserving previous news.json (if exists)")
        return 0
    summarized = call_anthropic(items)
    if summarized is None:
        items = fallback_summarize(items)
    else:
        items = summarized
    save(items)
    log(f"done in {time.time() - started:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
