#!/usr/bin/env python3
"""
AI日報自動生成・メール送信スクリプト

毎朝、生成AIに関する最新ニュースをClaude API（Web Search付き）で収集・まとめし、
Gmail SMTP経由でリッチHTML形式のメールを送信する。
"""

import html
import json
import os
import re
import smtplib
import sys
import time
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import anthropic

# ── 環境変数の読み込み ─────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
TO_EMAIL = os.environ.get("TO_EMAIL")  # カンマ区切りで複数指定可能

JST = timezone(timedelta(hours=9))
WEEKDAYS_JA = ["月", "火", "水", "木", "金", "土", "日"]

MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds


def validate_env():
    """必須の環境変数が設定されているか確認する。"""
    missing = []
    for name in ("ANTHROPIC_API_KEY", "GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "TO_EMAIL"):
        if not os.environ.get(name):
            missing.append(name)
    if missing:
        print(f"[ERROR] 以下の環境変数が未設定です: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)


def format_date_with_weekday(dt: datetime) -> str:
    """日本語の曜日付き日付文字列を返す。"""
    weekday = WEEKDAYS_JA[dt.weekday()]
    return dt.strftime(f"%Y年%m月%d日（{weekday}）")


def esc(text: str) -> str:
    """HTMLエスケープ。API出力の安全化。"""
    return html.escape(str(text)) if text else ""


def call_with_retry(fn, description: str):
    """リトライ付きでAPI呼び出しを行う。"""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except (anthropic.APIConnectionError, anthropic.RateLimitError,
                anthropic.InternalServerError) as e:
            if attempt == MAX_RETRIES:
                print(f"[ERROR] {description}: {MAX_RETRIES}回リトライしても失敗: {e}", file=sys.stderr)
                raise
            print(f"[WARN] {description}: リトライ {attempt}/{MAX_RETRIES} ({e})")
            time.sleep(RETRY_DELAY * attempt)


def generate_news_json(today_str: str) -> dict:
    """Claude API（Web Search付き）を使ってリアルタイムの生成AIニュースを収集・構造化する。"""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""あなたはB2Bマーケティングに精通した生成AI専門のニュースキュレーターです。
今日は{today_str}です。

まず、Web検索ツールを使って以下の情報をリアルタイムで収集してください：
1. 「生成AI 最新ニュース」「AI 企業 発表」で検索し、直近1週間のB2B向けニュースを収集
2. 「Google AI」「Microsoft AI」「OpenAI」「Anthropic」「Meta AI」で検索し、ビッグテック企業のAI関連の重大ニュースを収集（新製品発表、人事異動、提携、規制対応、人員削減など）
3. 「AI trending Twitter/X」「生成AI 話題 SNS」で検索し、X(Twitter)で話題のAIトピックを収集
4. 「AI market stats 2026」「生成AI 市場 数字」で検索し、注目の統計データを収集

収集した情報を基に、以下のJSON形式で出力してください。
必ずJSON形式のみを出力してください（前後に説明文を付けないこと）：

{{
  "greeting": "今日のAI動向を一言で表す挨拶文（例：AI業界が大きく動いた一日です）",
  "b2b_news": [
    {{
      "title": "ニュースのタイトル",
      "source_url": "出典元の実際のURL",
      "source_name": "出典元の名前（例：OpenAI Blog, TechCrunch, 日経新聞 など）",
      "what_happened": "何が起きた？（1〜2文で簡潔に）",
      "why_it_matters": "なぜ重要？（ビジネスへのインパクトを分かりやすく）",
      "how_to_use": "どう活かす？（B2Bマーケでの具体的なアクション）"
    }}
  ],
  "bigtech_moves": [
    {{
      "company": "企業名（Google, Microsoft, OpenAI, Anthropic, Meta など）",
      "title": "ニュースの見出し",
      "source_url": "出典元の実際のURL",
      "source_name": "出典元の名前",
      "summary": "何が起きたか（2〜3文）",
      "impact": "業界へのインパクト（1文）"
    }}
  ],
  "x_buzz": [
    {{
      "title": "X(Twitter)で話題のトピック",
      "summary": "何がバズっているか（2〜3行）",
      "x_search_url": "https://x.com/search?q=（関連キーワードをURLエンコードして検索URL化）",
      "engagement": "話題の規模感（例：1万件以上のポスト、トレンド入り など）"
    }}
  ],
  "trending": [
    {{
      "title": "トピックのタイトル",
      "source_url": "関連する参考URL",
      "source_name": "出典元の名前",
      "summary": "2〜3行の要約"
    }}
  ],
  "daily_action": "B2Bマーケ担当者として今日意識すべきこと（1文）",
  "key_number": {{
    "value": "今日の注目数字（例：73%、1000万人、$10B など）",
    "label": "その数字が何を表すかの短い説明（1文）",
    "source": "数字の出典元"
  }}
}}

b2b_newsは2〜3件、bigtech_movesは2〜3件、x_buzzは2〜3件、trendingは2〜3件にしてください。
source_urlは検索で見つけた実際のURLを記載してください。
読者はマーケティング担当者なので、難しいAI用語は避けて、ビジネスパーソンに伝わる言葉で書いてください。"""

    t0 = time.time()
    print("[INFO] Claude API（Web Search付き）にニュース生成をリクエスト中...")

    def api_call():
        return client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4096,
            tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 10}],
            messages=[{"role": "user", "content": prompt}],
        )

    message = call_with_retry(api_call, "Claude API呼び出し")
    elapsed = time.time() - t0
    print(f"[INFO] API応答時間: {elapsed:.1f}秒")

    # web_search付きレスポンスからテキストブロックを抽出
    raw = ""
    for block in message.content:
        if block.type == "text":
            raw = block.text.strip()

    if not raw:
        print("[ERROR] APIレスポンスにテキストが含まれていません", file=sys.stderr)
        sys.exit(1)

    # コードブロック除去
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

    # JSON部分を抽出（前後にテキストがある場合）
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        raw = json_match.group()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON解析失敗: {e}", file=sys.stderr)
        print(f"[DEBUG] 生のレスポンス:\n{raw[:500]}", file=sys.stderr)
        sys.exit(1)

    b2b_count = len(data.get("b2b_news", []))
    bigtech_count = len(data.get("bigtech_moves", []))
    x_count = len(data.get("x_buzz", []))
    trend_count = len(data.get("trending", []))
    print(f"[INFO] ニュース生成完了（B2B: {b2b_count}件, BigTech: {bigtech_count}件, "
          f"X/Twitter: {x_count}件, トレンド: {trend_count}件）")
    return data


def build_plain_text(data: dict, today_str: str) -> str:
    """プレーンテキスト版を生成（HTML非対応クライアント用）。"""
    lines = [
        f"AI Daily Report — {today_str}",
        "=" * 50,
        "",
        data.get("greeting", ""),
        "",
    ]

    # KEY NUMBER
    kn = data.get("key_number")
    if kn:
        lines += [f"[KEY NUMBER] {kn.get('value', '')} — {kn.get('label', '')}", ""]

    # B2B
    lines += ["--- B2B MARKETING ---", ""]
    for i, news in enumerate(data.get("b2b_news", []), 1):
        lines += [
            f"{i}. {news.get('title', '')}",
            f"   何が起きた？ {news.get('what_happened', '')}",
            f"   なぜ重要？ {news.get('why_it_matters', '')}",
            f"   どう活かす？ {news.get('how_to_use', '')}",
            f"   出典: {news.get('source_name', '')} {news.get('source_url', '')}",
            "",
        ]

    # BigTech
    lines += ["--- BIG TECH WATCH ---", ""]
    for move in data.get("bigtech_moves", []):
        lines += [
            f"[{move.get('company', '')}] {move.get('title', '')}",
            f"   {move.get('summary', '')}",
            f"   インパクト: {move.get('impact', '')}",
            f"   出典: {move.get('source_name', '')} {move.get('source_url', '')}",
            "",
        ]

    # X/Twitter
    lines += ["--- X / TWITTER BUZZ ---", ""]
    for topic in data.get("x_buzz", []):
        lines += [
            f"* {topic.get('title', '')} ({topic.get('engagement', '')})",
            f"  {topic.get('summary', '')}",
            f"  検索: {topic.get('x_search_url', '')}",
            "",
        ]

    # Trending
    lines += ["--- TRENDING ---", ""]
    for topic in data.get("trending", []):
        lines += [
            f"* {topic.get('title', '')}",
            f"  {topic.get('summary', '')}",
            f"  出典: {topic.get('source_name', '')} {topic.get('source_url', '')}",
            "",
        ]

    # Action
    lines += [
        "--- TODAY'S ACTION ---",
        data.get("daily_action", ""),
        "",
        "---",
        "Powered by Claude API (Web Search) + GitHub Actions",
        "※ AIがWeb検索で収集・要約したコンテンツです。出典URLから最新情報をご確認ください。",
    ]

    return "\n".join(lines)


def build_html(data: dict, today_str: str) -> str:
    """構造化データからリッチHTMLメールを生成する。"""

    # B2Bニュースカード
    b2b_cards = ""
    for i, news in enumerate(data.get("b2b_news", [])):
        num = i + 1
        source_link = ""
        if news.get("source_url"):
            source_link = f"""
          <div style="margin-top:12px; padding-top:12px; border-top:1px solid #eee;">
            <a href="{esc(news['source_url'])}" style="color:#1a73e8; font-size:12px;
               text-decoration:none; font-weight:600;"
               target="_blank">&#128279; {esc(news.get('source_name', 'Source'))} で詳しく読む &rarr;</a>
          </div>"""

        b2b_cards += f"""
        <div style="background:#fff; border-radius:12px; padding:24px; margin-bottom:16px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06); border-left:4px solid #1a73e8;">
          <div style="font-size:11px; color:#1a73e8; font-weight:700; letter-spacing:1px;
                      margin-bottom:8px;">NEWS {num:02d}</div>
          <h3 style="margin:0 0 16px; font-size:17px; color:#1a1a1a; line-height:1.5;">
            {esc(news['title'])}
          </h3>
          <div style="background:#f0f4ff; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
            <div style="font-size:11px; color:#5f6368; font-weight:700; margin-bottom:4px;">
              &#128196; 何が起きた？</div>
            <div style="font-size:14px; color:#333; line-height:1.6;">{esc(news['what_happened'])}</div>
          </div>
          <div style="background:#fff8e1; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
            <div style="font-size:11px; color:#f59e0b; font-weight:700; margin-bottom:4px;">
              &#128161; なぜ重要？</div>
            <div style="font-size:14px; color:#333; line-height:1.6;">{esc(news['why_it_matters'])}</div>
          </div>
          <div style="background:#e8f5e9; border-radius:8px; padding:14px 16px;">
            <div style="font-size:11px; color:#2e7d32; font-weight:700; margin-bottom:4px;">
              &#127919; どう活かす？</div>
            <div style="font-size:14px; color:#333; line-height:1.6;">{esc(news['how_to_use'])}</div>
          </div>{source_link}
        </div>"""

    # ビッグテック動向カード
    bigtech_cards = ""
    company_colors = {
        "Google": "#4285f4", "Microsoft": "#00a4ef", "OpenAI": "#10a37f",
        "Anthropic": "#d97706", "Meta": "#0668e1", "Apple": "#555555",
        "Amazon": "#ff9900", "NVIDIA": "#76b900",
    }
    for move in data.get("bigtech_moves", []):
        company = esc(move.get("company", ""))
        color = company_colors.get(move.get("company", ""), "#6c5ce7")
        source_link = ""
        if move.get("source_url"):
            source_link = f"""
          <div style="margin-top:10px;">
            <a href="{esc(move['source_url'])}" style="color:{color}; font-size:12px;
               text-decoration:none; font-weight:600;"
               target="_blank">&#128279; {esc(move.get('source_name', 'Source'))} &rarr;</a>
          </div>"""

        bigtech_cards += f"""
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:12px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06); border-left:4px solid {color};">
          <div style="margin-bottom:10px;">
            <span style="background:{color}; color:#fff; font-size:11px; font-weight:700;
                         padding:3px 10px; border-radius:10px;">{company}</span>
          </div>
          <div style="font-size:16px; font-weight:700; color:#1a1a1a; margin-bottom:8px;">
            {esc(move['title'])}
          </div>
          <div style="font-size:14px; color:#555; line-height:1.7; margin-bottom:6px;">
            {esc(move['summary'])}</div>
          <div style="font-size:13px; color:#e91e63; font-weight:600; line-height:1.5;">
            &#9888;&#65039; {esc(move.get('impact', ''))}</div>{source_link}
        </div>"""

    # X/Twitter バズカード
    x_buzz_items = ""
    for topic in data.get("x_buzz", []):
        engagement = esc(topic.get("engagement", ""))
        engagement_html = ""
        if engagement:
            engagement_html = f"""
            <span style="background:#e8f5fe; color:#1d9bf0; font-size:11px; font-weight:600;
                         padding:3px 10px; border-radius:12px; margin-left:8px;">{engagement}</span>"""

        x_link = ""
        if topic.get("x_search_url"):
            x_link = f"""
          <div style="margin-top:10px;">
            <a href="{esc(topic['x_search_url'])}" style="color:#1d9bf0; font-size:12px;
               text-decoration:none; font-weight:600;"
               target="_blank">&#128269; X で検索する &rarr;</a>
          </div>"""

        x_buzz_items += f"""
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:12px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06); border-left:4px solid #1d9bf0;">
          <div style="font-size:16px; font-weight:700; color:#1a1a1a; margin-bottom:8px;">
            {esc(topic['title'])}{engagement_html}
          </div>
          <div style="font-size:14px; color:#555; line-height:1.7;">{esc(topic['summary'])}</div>{x_link}
        </div>"""

    # トレンドカード
    trending_items = ""
    trend_icons = ["&#128293;", "&#9889;", "&#127775;"]
    for i, topic in enumerate(data.get("trending", [])):
        icon = trend_icons[i % len(trend_icons)]
        source_link = ""
        if topic.get("source_url"):
            source_link = f"""
          <div style="margin-top:10px;">
            <a href="{esc(topic['source_url'])}" style="color:#e91e63; font-size:12px;
               text-decoration:none; font-weight:600;"
               target="_blank">&#128279; {esc(topic.get('source_name', 'Source'))} &rarr;</a>
          </div>"""

        trending_items += f"""
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:12px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="font-size:16px; font-weight:700; color:#1a1a1a; margin-bottom:8px;">
            {icon} {esc(topic['title'])}
          </div>
          <div style="font-size:14px; color:#555; line-height:1.7;">{esc(topic['summary'])}</div>{source_link}
        </div>"""

    greeting = esc(data.get("greeting", ""))
    daily_action = esc(data.get("daily_action", ""))

    # 注目数字
    key_number_html = ""
    key_number = data.get("key_number")
    if key_number:
        source_text = ""
        if key_number.get("source"):
            source_text = f'<div style="font-size:11px; color:#aaa; margin-top:6px;">出典: {esc(key_number["source"])}</div>'
        key_number_html = f"""
    <div style="background:#fff; border-radius:16px; padding:24px; margin-bottom:24px;
                box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
      <div style="font-size:11px; color:#764ba2; font-weight:700; letter-spacing:1px;
                  margin-bottom:8px;">&#128202; KEY NUMBER</div>
      <div style="font-size:36px; font-weight:800; color:#667eea;
                  line-height:1.2; margin-bottom:8px;">{esc(key_number['value'])}</div>
      <div style="font-size:14px; color:#666; line-height:1.5;">{esc(key_number['label'])}</div>
      {source_text}
    </div>"""

    # 各セクション件数
    counts = {
        "b2b": len(data.get("b2b_news", [])),
        "bigtech": len(data.get("bigtech_moves", [])),
        "x": len(data.get("x_buzz", [])),
        "trend": len(data.get("trending", [])),
    }
    total_news = sum(counts.values())

    # 読了時間の推定（日本語: 約500文字/分）
    all_text = json.dumps(data, ensure_ascii=False)
    read_minutes = max(1, len(all_text) // 500)

    # プレヘッダー（トップニュースの見出しを含める）
    top_headline = ""
    if data.get("b2b_news"):
        top_headline = data["b2b_news"][0].get("title", "")
    preheader = f"{greeting} | {top_headline}" if top_headline else greeting
    preheader = preheader[:120]

    # 目次
    toc_items = []
    if counts["b2b"]:
        toc_items.append(f"&#128188; B2Bニュース({counts['b2b']})")
    if counts["bigtech"]:
        toc_items.append(f"&#127970; BigTech({counts['bigtech']})")
    if counts["x"]:
        toc_items.append(f"&#120143; X/Twitter({counts['x']})")
    if counts["trend"]:
        toc_items.append(f"&#128640; トレンド({counts['trend']})")
    toc_html = " &#12288; ".join(toc_items)

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f0f2f5;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN',
             'Noto Sans JP',sans-serif; color:#333;">

  <!-- プレヘッダー -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    {preheader}
  </div>

  <div style="max-width:600px; margin:0 auto; padding:20px 16px;">

    <!-- ヘッダー -->
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff;
                border-radius:16px; padding:32px 28px; margin-bottom:24px; text-align:center;">
      <div style="font-size:40px; margin-bottom:8px;">&#129302;</div>
      <h1 style="margin:0 0 4px; font-size:26px; font-weight:800; letter-spacing:1px;">
        AI Daily Report</h1>
      <p style="margin:0 0 16px; font-size:14px; opacity:0.85;">{today_str}</p>
      <div style="background:rgba(255,255,255,0.2); border-radius:8px; padding:10px 16px;
                  font-size:14px; line-height:1.5; display:inline-block;">
        {greeting}
      </div>
      <div style="margin-top:16px; font-size:12px; opacity:0.7;">
        &#128230; {total_news} 件 &#12288;&#9200; 約{read_minutes}分で読めます &#12288;&#127760; Web検索ベース</div>
    </div>

    <!-- 目次 -->
    <div style="background:#fff; border-radius:12px; padding:16px 20px; margin-bottom:24px;
                box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
      <div style="font-size:11px; color:#999; font-weight:700; letter-spacing:1px; margin-bottom:6px;">
        TODAY'S CONTENTS</div>
      <div style="font-size:13px; color:#555; line-height:2;">
        {toc_html}
      </div>
    </div>

    <!-- 注目数字 -->
    {key_number_html}

    <!-- セクション1: B2Bニュース -->
    <div style="margin-bottom:28px;">
      <div style="margin-bottom:16px;">
        <div style="background:#1a73e8; color:#fff; font-size:12px; font-weight:700;
                    padding:6px 14px; border-radius:20px; letter-spacing:0.5px; display:inline-block;">
          &#128188; B2B MARKETING</div>
      </div>
      <h2 style="margin:0 0 16px; font-size:18px; color:#1a1a1a;">
        生成AI最新ニュース</h2>
      {b2b_cards}
    </div>

    <!-- セクション2: ビッグテック動向 -->
    <div style="margin-bottom:28px;">
      <div style="margin-bottom:16px;">
        <div style="background:#6c5ce7; color:#fff; font-size:12px; font-weight:700;
                    padding:6px 14px; border-radius:20px; letter-spacing:0.5px; display:inline-block;">
          &#127970; BIG TECH WATCH</div>
      </div>
      <h2 style="margin:0 0 16px; font-size:18px; color:#1a1a1a;">
        主要企業の注目ニュース</h2>
      {bigtech_cards}
    </div>

    <!-- セクション3: X/Twitter バズ -->
    <div style="margin-bottom:28px;">
      <div style="margin-bottom:16px;">
        <div style="background:#1d9bf0; color:#fff; font-size:12px; font-weight:700;
                    padding:6px 14px; border-radius:20px; letter-spacing:0.5px; display:inline-block;">
          &#120143; X / TWITTER BUZZ</div>
      </div>
      <h2 style="margin:0 0 16px; font-size:18px; color:#1a1a1a;">
        SNSで話題のAIトピック</h2>
      {x_buzz_items}
    </div>

    <!-- セクション4: トレンド -->
    <div style="margin-bottom:28px;">
      <div style="margin-bottom:16px;">
        <div style="background:#e91e63; color:#fff; font-size:12px; font-weight:700;
                    padding:6px 14px; border-radius:20px; letter-spacing:0.5px; display:inline-block;">
          &#128640; TRENDING</div>
      </div>
      <h2 style="margin:0 0 16px; font-size:18px; color:#1a1a1a;">
        注目トピック</h2>
      {trending_items}
    </div>

    <!-- セクション5: 今日のアクション -->
    <div style="background:linear-gradient(135deg,#ff6b6b,#ffa502); border-radius:16px;
                padding:24px 28px; margin-bottom:28px; color:#fff;">
      <div style="font-size:12px; font-weight:700; letter-spacing:1px; margin-bottom:8px; opacity:0.9;">
        &#9997;&#65039; TODAY'S ACTION</div>
      <div style="font-size:16px; font-weight:600; line-height:1.6;">
        {daily_action}
      </div>
    </div>

    <!-- フッター -->
    <div style="text-align:center; padding:20px 16px; font-size:11px; color:#999; line-height:1.8;">
      <div style="border-top:1px solid #ddd; padding-top:16px; margin-bottom:4px;">
        &#128640; Powered by Claude API (Web Search) + GitHub Actions</div>
      <div>&#169; AI Daily Report &#8212; 自動生成ニュースレター</div>
      <div style="margin-top:8px; color:#bbb;">
        ※ AIがWeb検索で収集・要約したコンテンツです。出典URLから最新情報をご確認ください。</div>
    </div>

  </div>
</body>
</html>"""


def send_email(subject: str, html_content: str, plain_content: str):
    """Gmail SMTP経由でHTMLメールを送信する。複数宛先対応。"""
    recipients = [addr.strip() for addr in TO_EMAIL.split(",") if addr.strip()]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = ", ".join(recipients)
    # プレーンテキスト版（HTML非対応クライアント向け）
    msg.attach(MIMEText(plain_content, "plain", "utf-8"))
    # HTML版（優先表示）
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    print(f"[INFO] メール送信中... (To: {', '.join(recipients)}, 宛先数: {len(recipients)})")

    def smtp_send():
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.send_message(msg)

    call_with_retry(smtp_send, "メール送信")
    print("[INFO] メール送信完了")


def main():
    t_start = time.time()
    print("=" * 50)
    print("AI日報 自動生成・送信スクリプト")
    print("=" * 50)

    validate_env()

    now_jst = datetime.now(JST)
    today_str = format_date_with_weekday(now_jst)

    print(f"[INFO] 日付: {today_str}")

    # ニュース生成
    data = generate_news_json(today_str)

    # 件名にトップニュースを含める
    top_title = ""
    if data.get("b2b_news"):
        top_title = data["b2b_news"][0].get("title", "")
    if top_title:
        subject = f"【AI日報】{today_str}｜{top_title}"
    else:
        subject = f"【AI日報】{today_str}"
    # 件名が長すぎる場合は切り詰め
    if len(subject) > 80:
        subject = subject[:77] + "..."

    # HTML・プレーンテキスト生成
    html_content = build_html(data, today_str)
    plain_content = build_plain_text(data, today_str)

    # メール送信
    send_email(subject, html_content, plain_content)

    elapsed = time.time() - t_start
    print(f"[INFO] 全処理完了（所要時間: {elapsed:.1f}秒）")


if __name__ == "__main__":
    main()
