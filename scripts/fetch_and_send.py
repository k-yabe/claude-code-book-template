#!/usr/bin/env python3
"""
AI日報自動生成・メール送信スクリプト

毎朝、生成AIに関する最新ニュースをClaude APIで収集・まとめし、
Gmail SMTP経由でリッチHTML形式のメールを送信する。
"""

import json
import os
import smtplib
import sys
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import anthropic

# ── 環境変数の読み込み ─────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
TO_EMAIL = os.environ.get("TO_EMAIL")

JST = timezone(timedelta(hours=9))


def validate_env():
    """必須の環境変数が設定されているか確認する。"""
    missing = []
    for name in ("ANTHROPIC_API_KEY", "GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "TO_EMAIL"):
        if not os.environ.get(name):
            missing.append(name)
    if missing:
        print(f"[ERROR] 以下の環境変数が未設定です: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)


def generate_news_json(today_str: str) -> dict:
    """Claude APIを使って生成AIニュースを構造化JSONで生成する。"""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""あなたはB2Bマーケティングに精通した生成AI専門のニュースキュレーターです。
今日は{today_str}です。

生成AIに関する最新ニュースのまとめを、以下のJSON形式で出力してください。
あなたの知識の範囲で、最近の生成AI関連の重要なニュース・トレンド・動向を取り上げてください。

必ず以下のJSON形式のみを出力してください（前後に説明文を付けないこと）：

{{
  "greeting": "今日のAI動向を一言で表す挨拶文（例：AI業界が大きく動いた一日です）",
  "b2b_news": [
    {{
      "title": "ニュースのタイトル",
      "what_happened": "何が起きた？（1〜2文で簡潔に）",
      "why_it_matters": "なぜ重要？（ビジネスへのインパクトを分かりやすく）",
      "how_to_use": "どう活かす？（B2Bマーケでの具体的なアクション）"
    }}
  ],
  "trending": [
    {{
      "title": "トピックのタイトル",
      "summary": "2〜3行の要約"
    }}
  ],
  "daily_action": "B2Bマーケ担当者として今日意識すべきこと（1文）"
}}

b2b_newsは2〜3件、trendingは2〜3件にしてください。
読者はマーケティング担当者なので、難しいAI用語は避けて、ビジネスパーソンに伝わる言葉で書いてください。"""

    print("[INFO] Claude APIにニュース生成をリクエスト中...")
    message = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # JSON部分を抽出（コードブロックで囲まれている場合に対応）
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

    data = json.loads(raw)
    print(f"[INFO] ニュース生成完了（B2B: {len(data['b2b_news'])}件, トレンド: {len(data['trending'])}件）")
    return data


def build_html(data: dict, today_str: str) -> str:
    """構造化データからリッチHTMLメールを生成する。"""

    # B2Bニュースカード生成
    b2b_cards = ""
    for i, news in enumerate(data["b2b_news"]):
        num = i + 1
        b2b_cards += f"""
        <div style="background:#fff; border-radius:12px; padding:24px; margin-bottom:16px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06); border-left:4px solid #1a73e8;">
          <div style="font-size:11px; color:#1a73e8; font-weight:700; letter-spacing:1px;
                      margin-bottom:8px;">NEWS {num:02d}</div>
          <h3 style="margin:0 0 16px; font-size:17px; color:#1a1a1a; line-height:1.5;">
            {news['title']}
          </h3>
          <div style="background:#f0f4ff; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
            <div style="font-size:11px; color:#5f6368; font-weight:700; margin-bottom:4px;">
              &#128196; 何が起きた？</div>
            <div style="font-size:14px; color:#333; line-height:1.6;">{news['what_happened']}</div>
          </div>
          <div style="background:#fff8e1; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
            <div style="font-size:11px; color:#f59e0b; font-weight:700; margin-bottom:4px;">
              &#128161; なぜ重要？</div>
            <div style="font-size:14px; color:#333; line-height:1.6;">{news['why_it_matters']}</div>
          </div>
          <div style="background:#e8f5e9; border-radius:8px; padding:14px 16px;">
            <div style="font-size:11px; color:#2e7d32; font-weight:700; margin-bottom:4px;">
              &#127919; どう活かす？</div>
            <div style="font-size:14px; color:#333; line-height:1.6;">{news['how_to_use']}</div>
          </div>
        </div>"""

    # トレンドカード生成
    trending_items = ""
    trend_icons = ["&#128293;", "&#9889;", "&#127775;"]
    for i, topic in enumerate(data["trending"]):
        icon = trend_icons[i % len(trend_icons)]
        trending_items += f"""
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:12px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="font-size:16px; font-weight:700; color:#1a1a1a; margin-bottom:8px;">
            {icon} {topic['title']}
          </div>
          <div style="font-size:14px; color:#555; line-height:1.7;">{topic['summary']}</div>
        </div>"""

    greeting = data.get("greeting", "")
    daily_action = data.get("daily_action", "")

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f0f2f5;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN',
             'Noto Sans JP',sans-serif; color:#333;">

  <div style="max-width:600px; margin:0 auto; padding:20px 16px;">

    <!-- ヘッダー -->
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff;
                border-radius:16px; padding:32px 28px; margin-bottom:24px; text-align:center;">
      <div style="font-size:40px; margin-bottom:8px;">&#129302;</div>
      <h1 style="margin:0 0 4px; font-size:26px; font-weight:800; letter-spacing:1px;">
        AI Daily Report</h1>
      <p style="margin:0 0 12px; font-size:13px; opacity:0.8;">{today_str}</p>
      <div style="background:rgba(255,255,255,0.2); border-radius:8px; padding:10px 16px;
                  font-size:14px; line-height:1.5; display:inline-block;">
        {greeting}
      </div>
    </div>

    <!-- セクション1: B2Bニュース -->
    <div style="margin-bottom:28px;">
      <div style="display:flex; align-items:center; margin-bottom:16px;">
        <div style="background:#1a73e8; color:#fff; font-size:12px; font-weight:700;
                    padding:6px 14px; border-radius:20px; letter-spacing:0.5px;">
          &#128188; B2B MARKETING</div>
      </div>
      <h2 style="margin:0 0 16px; font-size:18px; color:#1a1a1a;">
        生成AI最新ニュース</h2>
      {b2b_cards}
    </div>

    <!-- セクション2: トレンド -->
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

    <!-- セクション3: 今日のアクション -->
    <div style="background:linear-gradient(135deg,#ff6b6b,#ffa502); border-radius:16px;
                padding:24px 28px; margin-bottom:28px; color:#fff;">
      <div style="font-size:12px; font-weight:700; letter-spacing:1px; margin-bottom:8px; opacity:0.9;">
        &#9997;&#65039; TODAY'S ACTION</div>
      <div style="font-size:16px; font-weight:600; line-height:1.6;">
        {daily_action}
      </div>
    </div>

    <!-- フッター -->
    <div style="text-align:center; padding:16px; font-size:11px; color:#999; line-height:1.6;">
      <div style="margin-bottom:4px;">Powered by Claude API + GitHub Actions</div>
      <div>&#169; AI Daily Report &#8212; 自動生成ニュースレター</div>
    </div>

  </div>
</body>
</html>"""


def send_email(subject: str, html_content: str):
    """Gmail SMTP経由でHTMLメールを送信する。"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = TO_EMAIL
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    print(f"[INFO] メール送信中... (To: {TO_EMAIL})")
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.send_message(msg)

    print("[INFO] メール送信完了")


def main():
    print("=" * 50)
    print("AI日報 自動生成・送信スクリプト")
    print("=" * 50)

    validate_env()

    now_jst = datetime.now(JST)
    today_str = now_jst.strftime("%Y年%m月%d日")
    subject = f"【AI日報】{today_str}"

    print(f"[INFO] 日付: {today_str}")

    data = generate_news_json(today_str)
    html_content = build_html(data, today_str)
    send_email(subject, html_content)

    print("[INFO] 全処理が正常に完了しました")


if __name__ == "__main__":
    main()
