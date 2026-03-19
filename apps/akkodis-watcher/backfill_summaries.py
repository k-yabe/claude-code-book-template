#!/usr/bin/env python3
"""
既存記事のうち summary_ja がないものを一括で日本語要約する。
通常は一度だけ実行する。以降は scraper.py が新記事のみ自動生成する。
"""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
import anthropic

OUTPUT = Path(__file__).parent / "data" / "articles.json"
SKIP_SOURCES = {"thinkers"}  # PDFはスキップ


def generate_summary_ja(client, page, url: str) -> str | None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1500)
        body_text = page.inner_text("body")
        text = re.sub(r"\s+", " ", body_text).strip()[:6000]

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": (
                    "以下の記事を日本語で3〜4文に要約してください。"
                    "マーケティング担当者向けに、記事の主旨と重要ポイントを簡潔にまとめてください。"
                    "見出しや箇条書きは使わず、本文テキストのみで出力してください。\n\n"
                    + text
                ),
            }],
        )
        return message.content[0].text.strip()
    except Exception as e:
        print(f"    エラー: {e}")
        return None


def main():
    import json

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY が設定されていません")
        return

    data = json.loads(OUTPUT.read_text())
    articles = data["articles"]

    targets = [
        a for a in articles
        if not a.get("summary_ja") and a.get("source_id") not in SKIP_SOURCES
    ]
    print(f"要約生成対象: {len(targets)} 件")

    client = anthropic.Anthropic(api_key=api_key)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for i, article in enumerate(targets, 1):
            print(f"[{i}/{len(targets)}] {article['title'][:50]}")
            summary = generate_summary_ja(client, page, article["url"])
            if summary:
                article["summary_ja"] = summary
                print(f"    ✓ 完了")
            else:
                print(f"    ✗ スキップ")

        browser.close()

    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    done = sum(1 for a in articles if a.get("summary_ja"))
    print(f"\n保存完了: {done}/{len(articles)} 件に要約あり")


if __name__ == "__main__":
    main()
