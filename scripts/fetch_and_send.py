#!/usr/bin/env python3
"""
AI日報自動生成・メール送信スクリプト

毎朝、生成AIに関する最新ニュースをClaude APIで収集・まとめし、
Gmail SMTP経由でHTML形式のメールを送信する。
"""

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


def generate_news_content(today_str: str) -> str:
    """Claude APIを使って生成AIニュースのまとめを生成する。"""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""あなたはB2Bマーケティングに精通した生成AI専門のニュースキュレーターです。
今日は{today_str}です。

以下のフォーマットに従って、生成AIに関する最新ニュースのまとめを日本語で作成してください。
あなたの知識の範囲で、最近の生成AI関連の重要なニュース・トレンド・動向を取り上げてください。

---

## 【B2Bマーケ向け】生成AI最新ニュース（2〜3本）

各ニュースについて：
- **ニュースタイトル**（簡潔に）
- 事実: 何が起きたか（客観的事実のみ）
- 解釈: これが意味すること（分析・考察）
- ビジネス活用の示唆: B2Bマーケティングでどう活かせるか

## 【一般】生成AI注目トピック（2〜3本）

世間で話題になっている生成AI関連のトピックを、各2〜3行で簡潔にまとめてください。

## 【今日のアクション示唆】

B2Bマーケティング担当者として、今日意識すべきこと・やるべきことを1行で。

---

マークダウン形式で出力してください。見出しは##で統一してください。"""

    print("[INFO] Claude APIにニュース生成をリクエスト中...")
    message = client.messages.create(
        model="claude-sonnet-4-5-20241022",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    content = message.content[0].text
    print(f"[INFO] ニュース生成完了（{len(content)}文字）")
    return content


def markdown_to_html(markdown_text: str, today_str: str) -> str:
    """マークダウンのニュース内容をHTML形式のメールに変換する。"""
    lines = markdown_text.split("\n")
    html_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            html_lines.append(
                f'<h2 style="color:#1a73e8; border-bottom:2px solid #1a73e8; '
                f'padding-bottom:6px; margin-top:28px;">{stripped[3:]}</h2>'
            )
        elif stripped.startswith("### "):
            html_lines.append(
                f'<h3 style="color:#333; margin-top:20px;">{stripped[4:]}</h3>'
            )
        elif stripped.startswith("- **"):
            text = stripped[2:]
            text = text.replace("**", "<strong>", 1).replace("**", "</strong>", 1)
            html_lines.append(f'<li style="margin-bottom:4px;">{text}</li>')
        elif stripped.startswith("- "):
            html_lines.append(
                f'<li style="margin-bottom:4px;">{stripped[2:]}</li>'
            )
        elif stripped.startswith("**") and stripped.endswith("**"):
            html_lines.append(
                f'<p style="margin:12px 0;"><strong>{stripped[2:-2]}</strong></p>'
            )
        elif stripped == "---":
            html_lines.append('<hr style="border:none; border-top:1px solid #ddd; margin:24px 0;">')
        elif stripped == "":
            html_lines.append("")
        else:
            processed = stripped
            while "**" in processed:
                processed = processed.replace("**", "<strong>", 1)
                processed = processed.replace("**", "</strong>", 1)
            html_lines.append(f"<p style=\"margin:8px 0; line-height:1.7;\">{processed}</p>")

    body = "\n".join(html_lines)

    return f"""<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;
             max-width:640px; margin:0 auto; padding:20px; color:#333; line-height:1.7;">

  <div style="background:linear-gradient(135deg,#1a73e8,#6c5ce7); color:#fff;
              padding:24px; border-radius:12px; margin-bottom:24px;">
    <h1 style="margin:0; font-size:22px;">AI日報</h1>
    <p style="margin:8px 0 0; opacity:0.9; font-size:14px;">{today_str}</p>
  </div>

  <div style="padding:0 8px;">
    {body}
  </div>

  <div style="margin-top:36px; padding:16px; background:#f8f9fa;
              border-radius:8px; font-size:12px; color:#666; text-align:center;">
    このメールはGitHub Actions + Claude APIにより自動生成されています。
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

    news_content = generate_news_content(today_str)
    html_content = markdown_to_html(news_content, today_str)
    send_email(subject, html_content)

    print("[INFO] 全処理が正常に完了しました")


if __name__ == "__main__":
    main()
