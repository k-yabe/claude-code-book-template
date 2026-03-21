#!/usr/bin/env python3
"""
AIニュースキュレーター
日本語AIニュースをRSSで収集し、マーケ視点で厳選してGmailで送信する。
"""

import os
import smtplib
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import re

import anthropic
import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# ── 設定 ──────────────────────────────────────────
RSS_FEEDS = [
    # 日本語（AI・B2Bマーケ）
    "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
    "https://www.sbbit.jp/rss/HotTopics.rss",
    "https://qiita.com/tags/ai/feed",
    # 英語（AI全般）
    "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    # 英語（B2Bマーケ）
    "https://martech.org/feed/",
]

HOURS = 48  # 過去何時間の記事を対象にするか

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GMAIL_ADDRESS    = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"]
TO_ADDRESS       = os.environ["TO_ADDRESS"]


# ── 記事本文取得 ────────────────────────────────────
def fetch_body(url: str, max_chars: int = 1500) -> str:
    try:
        r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = re.sub(r"\s+", " ", soup.get_text()).strip()
        return text[:max_chars]
    except Exception:
        return ""


# ── RSS収集 ────────────────────────────────────────
def fetch_recent_articles(hours: int = HOURS) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    articles = []

    for url in RSS_FEEDS:
        feed = feedparser.parse(url)
        for entry in feed.entries:
            # 公開日時を取得
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                published = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)

            if published and published >= cutoff:
                article_url = entry.get("link", "")
                body = fetch_body(article_url)
                articles.append({
                    "title": entry.get("title", ""),
                    "url": article_url,
                    "body": body if body else entry.get("summary", "")[:500],
                    "published": published.strftime("%Y-%m-%d %H:%M"),
                    "source": feed.feed.get("title", url),
                })

    return articles


# ── Claude APIでフィルタリング ──────────────────────
def curate_with_claude(articles: list[dict]) -> str:
    if not articles:
        return "過去24時間に新しい記事はありませんでした。"

    articles_text = "\n\n".join(
        f"[{i+1}] {a['source']} | {a['published']}\n"
        f"タイトル: {a['title']}\n"
        f"URL: {a['url']}\n"
        f"本文: {a['body']}"
        for i, a in enumerate(articles)
    )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": f"""以下は過去24時間の記事一覧です。

【厳選条件】以下のいずれかに該当する記事を選んでください。明らかに無関係なもの（有給休暇・採用・政治・スポーツ等）は除外する。
- AI・生成AIに関するニュース全般（新サービス・研究・規制・活用事例）
- B2Bマーケティングに関連するプラットフォーム・ツールの動向（広告、SNS、MAツール等）
- マーケティング業務に使えそうなテクノロジーの話題

選んだ記事を以下のHTML形式で出力してください。タイトルと解説は必ず日本語にしてください（英語記事も日本語に翻訳・要約する）。該当記事が0件の場合は「本日の注目記事はありませんでした。」とだけ出力してください。

出力形式（HTMLのみ、説明文不要）:
<div class="article">
  <div class="title"><a href="URL">日本語タイトル</a></div>
  <div class="source">メディア名</div>
  <div class="desc">B2Bマーケ担当者視点での意義を具体的に2〜3文で（日本語）。「何に使えるか」「どう業務に活かせるか」を明記する。</div>
</div>

記事一覧:
{articles_text}
""",
            }
        ],
    )

    return message.content[0].text


# ── メール送信 ──────────────────────────────────────
def send_email(body_html: str) -> None:
    today = datetime.now().strftime("%Y年%m月%d日")
    subject = f"【AIニュース厳選】{today}"

    html = f"""
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }}
  .wrapper {{ max-width: 600px; margin: 0 auto; }}
  .header {{ background: #1a1a2e; color: white; padding: 24px 28px; border-radius: 8px 8px 0 0; }}
  .header h1 {{ margin: 0; font-size: 18px; font-weight: 700; }}
  .header p {{ margin: 6px 0 0; font-size: 13px; color: #aaa; }}
  .body {{ background: white; padding: 24px 28px; border-radius: 0 0 8px 8px; }}
  .article {{ border-left: 3px solid #4f8ef7; padding: 14px 16px; margin-bottom: 20px; background: #f9fbff; border-radius: 0 6px 6px 0; }}
  .article .title {{ font-size: 15px; font-weight: 700; margin-bottom: 4px; }}
  .article .title a {{ color: #1a1a2e; text-decoration: none; }}
  .article .source {{ font-size: 11px; color: #888; margin-bottom: 8px; }}
  .article .desc {{ font-size: 13px; color: #444; line-height: 1.7; }}
  .footer {{ text-align: center; font-size: 11px; color: #aaa; margin-top: 16px; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>今日のAIニュース</h1>
    <p>{today} ・ マーケ視点厳選</p>
  </div>
  <div class="body">
    {body_html}
  </div>
  <div class="footer">AIニュースキュレーターにより自動生成</div>
</div>
</body></html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = GMAIL_ADDRESS
    msg["To"]      = TO_ADDRESS
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, TO_ADDRESS, msg.as_string())

    print(f"送信完了: {TO_ADDRESS}")


# ── メイン ──────────────────────────────────────────
def main():
    print("記事を収集中...")
    articles = fetch_recent_articles()
    print(f"  {len(articles)} 件取得")

    print("Claude APIでフィルタリング中...")
    curated = curate_with_claude(articles)

    print("メール送信中...")
    send_email(curated)


if __name__ == "__main__":
    main()
