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
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import feedparser

JST = timezone(timedelta(hours=9))
UTC = timezone.utc

# ── 監視対象 RSS フィード ──────────────────────────────────────────
# category: marketing | market | ai
SOURCES: list[dict[str, object]] = [
    # マーケティング系（正統派ニュースメディア優先）
    {"name": "MarkeZine",                "url": "https://markezine.jp/rt/new.rdf",                            "category": "marketing", "tier": "media", "max": 8},
    {"name": "Web担当者Forum",            "url": "https://webtan.impress.co.jp/rss/all",                       "category": "marketing", "tier": "media", "max": 8},
    {"name": "ferret",                   "url": "https://ferret-plus.com/feed",                               "category": "marketing", "tier": "media", "max": 6},
    {"name": "AdverTimes",               "url": "https://www.advertimes.com/feed/",                            "category": "marketing", "tier": "media", "max": 6},
    {"name": "DIGIDAY[日本版]",           "url": "https://digiday.jp/feed/",                                    "category": "marketing", "tier": "media", "max": 6},
    {"name": "AdTech Tokyo (Web担)",      "url": "https://webtan.impress.co.jp/rss/category/37",                "category": "marketing", "tier": "media", "max": 4},
    # 市場・業界（正統派ニュースメディア）
    {"name": "電通報",                    "url": "https://dentsu-ho.com/articles.atom",                         "category": "market",    "tier": "media", "max": 6},
    {"name": "ITmedia マーケティング",    "url": "https://rss.itmedia.co.jp/rss/2.0/marketing.xml",            "category": "market",    "tier": "media", "max": 6},
    # AI 総合（正統派ニュースメディア）
    {"name": "ITmedia AI+",              "url": "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",               "category": "ai",        "tier": "media", "max": 8},
    {"name": "ITmedia NEWS",             "url": "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",          "category": "ai",        "tier": "media", "max": 6},
    {"name": "ASCII.jp",                 "url": "https://ascii.jp/rss.xml",                                    "category": "ai",        "tier": "media", "max": 5},
    {"name": "Ledge.ai",                 "url": "https://ledge.ai/feed",                                       "category": "ai",        "tier": "media", "max": 6},
    {"name": "AI-SCHOLAR",               "url": "https://ai-scholar.tech/feed",                                "category": "ai",        "tier": "media", "max": 4},
    {"name": "日経クロステック AI",        "url": "https://xtech.nikkei.com/rss/xtech-it.rdf",                    "category": "ai",        "tier": "media", "max": 5},
    {"name": "TECH+ AI",                 "url": "https://news.mynavi.jp/techplus/rss/ai/",                     "category": "ai",        "tier": "media", "max": 4},
    # テック総合メディア
    {"name": "Publickey",                "url": "https://www.publickey1.jp/atom.xml",                          "category": "ai",        "tier": "media", "max": 4},
    {"name": "gihyo.jp",                 "url": "https://gihyo.jp/feed/rss2",                                  "category": "ai",        "tier": "media", "max": 3},
    # コミュニティ（各1〜2件のみ採用 → ニュースメディアを圧倒しないように）
    {"name": "Zenn (生成AI)",             "url": "https://zenn.dev/topics/生成ai/feed",                         "category": "ai",        "tier": "ugc",   "max": 2},
    {"name": "Zenn (Claude)",            "url": "https://zenn.dev/topics/claude/feed",                         "category": "ai",        "tier": "ugc",   "max": 2},
    {"name": "Qiita (AI)",               "url": "https://qiita.com/tags/ai/feed",                              "category": "ai",        "tier": "ugc",   "max": 1},
    {"name": "note (AI)",                "url": "https://note.com/hashtag/AI/rss",                             "category": "ai",        "tier": "ugc",   "max": 1},
    # 競合モニタリング（PR TIMES 会社別フリーワード検索 RSS）
    # URL パターン: https://prtimes.jp/main/rdf/freeword/<company>/0/1
    # AKKODiS の主戦場である SIer / IT コンサル / エンジニアリング派遣 / QA / 人材
    # 各カテゴリの主要競合プレスリリースを横断取得して「競合動向」セクションを充実させる。
    # ── ①SIer / IT サービス（本丸） ──
    {"name": "PR TIMES (NTTデータ)",      "url": "https://prtimes.jp/main/rdf/freeword/NTTデータ/0/1",         "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (富士通)",         "url": "https://prtimes.jp/main/rdf/freeword/富士通/0/1",            "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (日立製作所)",     "url": "https://prtimes.jp/main/rdf/freeword/日立製作所/0/1",         "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (NEC)",           "url": "https://prtimes.jp/main/rdf/freeword/NEC/0/1",                "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (NRI)",           "url": "https://prtimes.jp/main/rdf/freeword/野村総合研究所/0/1",      "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (TIS)",           "url": "https://prtimes.jp/main/rdf/freeword/TISインテック/0/1",      "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (SCSK)",          "url": "https://prtimes.jp/main/rdf/freeword/SCSK/0/1",               "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (BIPROGY)",       "url": "https://prtimes.jp/main/rdf/freeword/BIPROGY/0/1",            "category": "market",    "tier": "media", "max": 2},
    # ── ②IT / 戦略コンサル ──
    {"name": "PR TIMES (アクセンチュア)", "url": "https://prtimes.jp/main/rdf/freeword/アクセンチュア/0/1",     "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (デロイト)",       "url": "https://prtimes.jp/main/rdf/freeword/デロイト/0/1",            "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (PwC)",           "url": "https://prtimes.jp/main/rdf/freeword/PwCコンサルティング/0/1", "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (ベイカレント)",   "url": "https://prtimes.jp/main/rdf/freeword/ベイカレント/0/1",        "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (アビーム)",       "url": "https://prtimes.jp/main/rdf/freeword/アビームコンサルティング/0/1", "category": "market", "tier": "media", "max": 2},
    # ── ③エンジニアリング派遣・技術者アサイン ──
    {"name": "PR TIMES (テクノプロ)",     "url": "https://prtimes.jp/main/rdf/freeword/テクノプロ/0/1",          "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (メイテック)",     "url": "https://prtimes.jp/main/rdf/freeword/メイテック/0/1",          "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (アウトソーシング)","url": "https://prtimes.jp/main/rdf/freeword/アウトソーシングテクノロジー/0/1", "category": "market", "tier": "media", "max": 2},
    {"name": "PR TIMES (UTグループ)",     "url": "https://prtimes.jp/main/rdf/freeword/UTグループ/0/1",          "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (アルプス技研)",   "url": "https://prtimes.jp/main/rdf/freeword/アルプス技研/0/1",        "category": "market",    "tier": "media", "max": 2},
    # ── ④QA / テスト受託 ──
    {"name": "PR TIMES (SHIFT)",         "url": "https://prtimes.jp/main/rdf/freeword/株式会社SHIFT/0/1",       "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (ベリサーブ)",     "url": "https://prtimes.jp/main/rdf/freeword/ベリサーブ/0/1",          "category": "market",    "tier": "media", "max": 2},
    # ── ⑤人材・求人 ──（既存）
    {"name": "PR TIMES (パーソル)",       "url": "https://prtimes.jp/main/rdf/freeword/パーソル/0/1",          "category": "market",    "tier": "media", "max": 3},
    {"name": "PR TIMES (リクルート)",     "url": "https://prtimes.jp/main/rdf/freeword/リクルート/0/1",         "category": "market",    "tier": "media", "max": 3},
    {"name": "PR TIMES (マイナビ)",       "url": "https://prtimes.jp/main/rdf/freeword/マイナビ/0/1",          "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (ビズリーチ)",     "url": "https://prtimes.jp/main/rdf/freeword/ビズリーチ/0/1",         "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (レバテック)",     "url": "https://prtimes.jp/main/rdf/freeword/レバテック/0/1",         "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (パソナ)",         "url": "https://prtimes.jp/main/rdf/freeword/パソナ/0/1",            "category": "market",    "tier": "media", "max": 2},
    {"name": "PR TIMES (アデコ)",         "url": "https://prtimes.jp/main/rdf/freeword/アデコ/0/1",            "category": "market",    "tier": "media", "max": 2},
    # ── Google News 競合別検索（IR・決算・業績・新サービス・業務提携を幅広く拾う） ──
    # PR TIMES だけでは「自社プレスのみ」なので、第三者報道（決算記事・業界分析・M&A報道等）も
    # Google News RSS で補完。AI/IT 業界キーワードを add すると検索精度が上がる。
    # URL パターン: https://news.google.com/rss/search?q=<query>&hl=ja&gl=JP&ceid=JP:ja
    {"name": "Google News (NTTデータ)",   "url": "https://news.google.com/rss/search?q=NTTデータ+(AI+OR+決算+OR+業績+OR+M%26A+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (富士通)",      "url": "https://news.google.com/rss/search?q=富士通+(AI+OR+決算+OR+業績+OR+M%26A+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",     "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (日立)",        "url": "https://news.google.com/rss/search?q=日立製作所+(AI+OR+決算+OR+業績+OR+デジタル)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (NEC)",        "url": "https://news.google.com/rss/search?q=NEC+(AI+OR+決算+OR+業績+OR+セキュリティ+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (NRI)",        "url": "https://news.google.com/rss/search?q=野村総合研究所+(AI+OR+決算+OR+業績+OR+コンサル)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (アクセンチュア)","url": "https://news.google.com/rss/search?q=アクセンチュア+(AI+OR+決算+OR+業績+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (デロイト)",    "url": "https://news.google.com/rss/search?q=デロイト+トーマツ+(AI+OR+決算+OR+業績+OR+調査)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (テクノプロ)",   "url": "https://news.google.com/rss/search?q=テクノプロ+(AI+OR+決算+OR+業績+OR+エンジニア)&hl=ja&gl=JP&ceid=JP:ja",           "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (メイテック)",   "url": "https://news.google.com/rss/search?q=メイテック+(AI+OR+決算+OR+業績+OR+技術者)&hl=ja&gl=JP&ceid=JP:ja",               "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (SHIFT)",      "url": "https://news.google.com/rss/search?q=株式会社SHIFT+(AI+OR+決算+OR+業績+OR+品質保証)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (パーソル)",    "url": "https://news.google.com/rss/search?q=パーソル+(AI+OR+決算+OR+業績+OR+人材+OR+転職)&hl=ja&gl=JP&ceid=JP:ja",             "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (リクルート)",  "url": "https://news.google.com/rss/search?q=リクルート+ホールディングス+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (ビズリーチ)",  "url": "https://news.google.com/rss/search?q=ビズリーチ+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",             "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (レバテック)",  "url": "https://news.google.com/rss/search?q=レバテック+(AI+OR+決算+OR+業績+OR+エンジニア)&hl=ja&gl=JP&ceid=JP:ja",              "category": "market", "tier": "media", "max": 2},
    # ── 業界全体のマクロ動向（IR/業績マーケット） ──
    {"name": "Google News (SIer業界)",    "url": "https://news.google.com/rss/search?q=SIer+業界+(AI+OR+M%26A+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",                   "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (エンジニア派遣)","url": "https://news.google.com/rss/search?q=エンジニア派遣+OR+技術者派遣+(業界+OR+市場+OR+トレンド)&hl=ja&gl=JP&ceid=JP:ja",   "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (IT人材市場)",  "url": "https://news.google.com/rss/search?q=IT人材+(不足+OR+採用市場+OR+リスキリング)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 3},
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


OGP_IMAGE_RE = re.compile(
    r'<meta[^>]+(?:property|name)\s*=\s*["\'](?:og:image|twitter:image(?::src)?)["\'][^>]*content\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)
OGP_IMAGE_RE_REV = re.compile(
    r'<meta[^>]+content\s*=\s*["\']([^"\']+)["\'][^>]*(?:property|name)\s*=\s*["\'](?:og:image|twitter:image(?::src)?)["\']',
    re.IGNORECASE,
)


def validate_url(url: str, timeout: int = 4) -> bool:
    """URL が到達可能か HEAD (fallback GET) で確認。200-399 のみ有効とする。
    失敗した URL は記事ごと除外して「リンク間違いが絶対に無い」状態を担保する。
    """
    if not url or not url.startswith(("http://", "https://")):
        return False
    for method in ("HEAD", "GET"):
        try:
            req = Request(url, method=method, headers={
                "User-Agent": "AKKODiSAINewsBot/1.0 (+https://kunito-yabe.vercel.app/)",
                "Accept": "text/html,application/xhtml+xml",
            })
            with urlopen(req, timeout=timeout) as resp:
                status = resp.status
                if 200 <= status < 400:
                    return True
                # 3xx はリダイレクト先まで到達できれば OK（urlopen 自動追跡）
                return False
        except Exception:
            continue
    return False


def fetch_hatena_count(url: str, timeout: int = 4) -> int:
    """はてなブックマーク数を取得（記事の人気度シグナル）。失敗時・未登録は 0。
    エンドポイント: https://bookmark.hatenaapis.com/count/entry?url=<url>
    プレーンテキストで数字1個を返す無料API。
    """
    if not url:
        return 0
    try:
        api = f"https://bookmark.hatenaapis.com/count/entry?url={url}"
        req = Request(api, headers={"User-Agent": "Mozilla/5.0 (AKKODiSAINewsBot/1.0)"})
        with urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="ignore").strip()
            return int(text) if text.isdigit() else 0
    except Exception:
        return 0


def fetch_ogp_image(url: str, timeout: int = 5) -> str | None:
    """記事ページの HTML から og:image / twitter:image を抽出する。失敗時は None"""
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; AI-NEWS-Bot/1.0; +https://kunito-yabe.vercel.app/apps/ai-news/)",
            "Accept": "text/html,application/xhtml+xml",
        })
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read(262144)  # 先頭256KBだけ
        charset = "utf-8"
        ct = resp.headers.get("Content-Type", "")
        m = re.search(r"charset=([\w-]+)", ct, re.IGNORECASE)
        if m:
            charset = m.group(1)
        html_text = raw.decode(charset, errors="ignore")
        # <head> 内だけに絞る
        head_end = html_text.lower().find("</head>")
        if head_end > 0:
            html_text = html_text[:head_end]
        m = OGP_IMAGE_RE.search(html_text) or OGP_IMAGE_RE_REV.search(html_text)
        if not m:
            return None
        img_url = html.unescape(m.group(1)).strip()
        if not img_url:
            return None
        # 相対URLを絶対URLに解決
        img_url = urljoin(url, img_url)
        if not img_url.startswith("https://"):
            return None
        return img_url
    except Exception:
        return None


def is_japanese_text(s: str) -> bool:
    """タイトル等が日本語記事かを判定。ひらがな/カタカナ/漢字の比率が低すぎる場合は英語記事と見なす"""
    if not s:
        return False
    jp = 0
    total = 0
    for ch in s:
        if ch.isspace():
            continue
        total += 1
        code = ord(ch)
        # ひらがな U+3040–U+309F / カタカナ U+30A0–U+30FF / CJK統合漢字 U+4E00–U+9FFF
        if 0x3040 <= code <= 0x309F or 0x30A0 <= code <= 0x30FF or 0x4E00 <= code <= 0x9FFF:
            jp += 1
    if total == 0:
        return False
    return (jp / total) >= 0.25


# AI 関連を示すキーワード。短いASCIIキーワードは単語境界で、それ以外は部分一致で判定する。
AI_KEYWORDS_WORD = [
    # 短い ASCII 略語・製品名: 他の単語内に埋め込まれる誤検知を防ぐため単語境界で判定
    "AI", "GPT", "LLM", "AGI", "NLP", "RAG", "ML",
    "ChatGPT", "Claude", "Gemini", "Llama", "Bard",
    "OpenAI", "Anthropic", "DeepMind", "Perplexity",
    "Copilot", "Devin", "Cursor",
    "Sora", "Midjourney",
    "Transformer",
]
AI_KEYWORDS_CONTAIN = [
    # 日本語語彙や長い固有名詞は部分一致でOK
    "エーアイ", "人工知能",
    "生成AI", "ジェネラティブ",
    "大規模言語モデル", "言語モデル",
    "機械学習", "ディープラーニング", "深層学習",
    "ニューラルネット", "ニューラルネットワーク",
    "チャットGPT", "クロード", "ジェミニ", "ラマ",
    "オープンAI", "アンソロピック",
    "Hugging Face", "ハギングフェイス",
    "プロンプト", "AIエージェント", "AIアシスタント", "AI活用",
    "コパイロット", "パープレキシティ",
    "画像生成AI", "動画生成AI", "音声生成", "音声合成",
    "Stable Diffusion",
    "自然言語処理",
    "ディープフェイク",
    # AI ツール活用（Claude Code / Copilot / Cursor 等の実務Tips）
    "Claude Code", "GitHub Copilot",
    "バイブコーディング", "AIコーディング", "AIペアプログラミング",
    "AIエディタ", "AI補完",
]
# マーケティング関連キーワード（AI と並んで受け入れる対象）
MARKETING_KEYWORDS_WORD = [
    "SEO", "SEM", "CVR", "CTR", "CPA", "CPC", "CPM", "ROAS", "LTV",
    "CRM", "CDP", "DMP",
    "MarTech", "AdTech", "HRTech",
    "ATS",  # Applicant Tracking System（人材業界専門用語）
]
MARKETING_KEYWORDS_CONTAIN = [
    # マーケティング専門用語（「ブランド」「配信」等の generic 語は誤検知の元なので含めない）
    "マーケティング", "マーケ", "プロモーション", "キャンペーン",
    "ブランディング", "コンテンツマーケ", "コンテンツマーケティング",
    "コンバージョン", "リターゲティング", "リターゲ", "リタゲ",
    "インフルエンサー", "アフィリエイト",
    "動画広告", "ディスプレイ広告", "運用型広告", "検索連動",
    "メルマガ", "ニュースレター",
    "リード獲得", "リードナーチャ",
    # Candidate marketing（人材・採用）— AKKODiS のコア
    "採用広告", "採用マーケ", "採用マーケティング", "リクルート広告",
    "求人", "人材紹介", "転職", "新卒採用", "中途採用",
    "エンジニア採用", "タレントマネジメント", "スカウト",
    "候補者体験", "候補者", "内定",
    "パーソル", "マイナビ", "エン・ジャパン",
    "Indeed", "LinkedIn",
]
_AI_WORD_RE = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(re.escape(k) for k in AI_KEYWORDS_WORD) + r")(?![A-Za-z0-9])")
_MKT_WORD_RE = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(re.escape(k) for k in MARKETING_KEYWORDS_WORD) + r")(?![A-Za-z0-9])")

# ── AKKODiS 競合モニタリング ──────────────────────────────────────
# AKKODiS は Adecco Group 傘下の IT サービス / エンジニアリング企業。
# 主戦場は SIer / IT コンサル / エンジニアリングサービス（技術者アサイン）領域。
# 優先度順: ①SIer・IT サービス（本丸）→ ②IT/戦略コンサル（上流）
#          → ③エンジニアリング派遣 → ④人材・求人プラットフォーム（二次競合）
COMPETITOR_KEYWORDS = [
    # ── ①SIer / IT サービス（本丸競合） ──
    "NTTデータ", "NTT DATA", "NTTデータグループ",
    "富士通", "Fujitsu",
    "日立ソリューションズ", "日立製作所",
    "NEC", "日本電気",
    "日本IBM", "IBM Japan",
    "NRI", "野村総合研究所",
    "伊藤忠テクノソリューションズ", "CTC",
    "TIS", "TISインテックグループ",
    "SCSK",
    "BIPROGY", "日本ユニシス",
    "日鉄ソリューションズ", "NSSOL",
    "大塚商会",
    "オービック",
    "インフォテクノスコクサイ",
    "クラスメソッド",
    "フューチャー", "Future",
    "電通総研", "DENTSU SOKEN",
    "DIS", "ダイワボウ情報システム",
    "JBCC", "JBCCホールディングス",
    # ── ②IT / 戦略コンサル（上流競合） ──
    "アクセンチュア", "Accenture",
    "キャップジェミニ", "Capgemini",
    "デロイト", "Deloitte",
    "PwC", "プライスウォーターハウスクーパース",
    "EY Japan", "EYストラテジー",
    "KPMG", "KPMGコンサルティング",
    "ベイカレント", "ベイカレント・コンサルティング",
    "アビームコンサルティング",
    "マッキンゼー", "McKinsey",
    "ボストン コンサルティング", "BCG",
    # ※リサーチ会社（Gartner/Forrester/IDC 等）は「競合」ではなく「引用元」なので除外
    # ── ③エンジニアリング派遣・技術者アサイン ──
    "テクノプロ", "TechnoPro", "テクノプロ・ホールディングス", "テクノプロHD",
    "メイテック", "Meitec",
    "アウトソーシング", "Outsourcing Inc", "OTS",
    "UTグループ", "UT Group", "UTエイム", "UTホールディングス",
    "アルプス技研",
    "WDB", "WDBホールディングス",
    "フォーラムエンジニアリング",
    "パソナテック",
    "ヒューマンクリエイションホールディングス",
    "ワールドインテック", "ワールドホールディングス",
    "夢真ホールディングス",
    "ビーネックス", "ビーネックステクノロジーズ",
    # ── ④QA・テスト受託（ソフトウェア技術領域） ──
    "SHIFT", "シフト",
    "ベリサーブ", "Veriserve",
    "デジタルハーツ", "デジタルハーツホールディングス",
    "バルテス",
    # ── ⑤人材総合（二次競合：候補者マーケ視点） ──
    "パーソル", "パーソルキャリア", "パーソルテクノロジースタッフ", "doda", "DODA", "dodaX",
    "リクルート", "リクルートキャリア", "リクルートスタッフィング",
    "マイナビ", "マイナビ転職", "マイナビエージェント",
    "エン・ジャパン", "エンジャパン", "エン転職",
    "ビズリーチ", "BizReach", "Visional", "ビジョナル",
    "JAC リクルートメント", "JACリクルートメント",
    "パソナ", "Pasona",
    "アデコ", "Adecco",
    "ランスタッド", "Randstad",
    "ヒューマンリソシア",
    # ── ⑥エンジニア紹介・フリーランス・SES ──
    "レバレジーズ", "レバテック", "レバテックフリーランス",
    "ギークス", "geechs",
    "Midworks", "ミッドワークス",
    "ITプロパートナーズ", "ランサーズ", "クラウドワークス",
    "PE-BANK",
    # ── ⑦エンジニア向けプラットフォーム ──
    "Green", "Wantedly", "Findy", "LAPRAS", "paiza", "Indeed", "Forkwell",
]
_COMPETITOR_RE = re.compile("|".join(re.escape(k) for k in COMPETITOR_KEYWORDS), re.IGNORECASE)

# 競合名が登場していても「競合動向」ではない記事を除外するためのノイズ語。
# 例: 「富士通 WEB MART」のPC通販セール、「NEC Direct」の値下げ等。
_COMPETITOR_NOISE_WORDS = [
    "WEB MART", "Web MART", "Direct Shop", "アウトレット",
    "お買い得", "キャンセル品", "セール品", "値下げ", "値引き", "特価",
    "クーポン", "通販", "ECサイト", "オンラインショップ",
    "予約受付", "新発売", "発売日", "開封レビュー",
]

# B2B マーケ担当者のインテリジェンス・ブリーフには不要な消費者向け商品記事を
# 全体からハード除外するためのワード。scrape 段階でフィードから落とす。
_CONSUMER_NOISE_WORDS = [
    "お買い得", "キャンセル品", "セール品", "値下げ", "値引き", "特価",
    "クーポン配布", "クーポン配信", "通販サイト", "通販限定",
    "予約受付中", "予約開始", "新発売", "発売日決定", "開封レビュー",
    "WEB MART", "Direct Shop", "アウトレット",
    "円引き", "円OFF", "割引セール", "期間限定セール",
]


def is_consumer_noise(title: str, summary: str) -> bool:
    """消費者向け商品セール記事かどうか判定（B2B マーケ担当者には不要）。"""
    hay = (title or "") + " " + (summary or "")
    return any(w in hay for w in _CONSUMER_NOISE_WORDS)


def is_competitor_mention(title: str, summary: str) -> bool:
    """記事タイトル or 要約が AKKODiS 競合企業に言及しているか判定。
    ただし製品販売・値下げ等の「競合動向ではない」文脈は除外する。"""
    hay = (title or "") + " " + (summary or "")
    if any(w in hay for w in _COMPETITOR_NOISE_WORDS):
        return False
    return bool(_COMPETITOR_RE.search(hay))


def is_ai_related(title: str, summary: str) -> bool:
    """タイトル + 要約に AI or マーケティング キーワードが含まれているかを判定。
    「AI NEWS」は AI + マーケ視点でマーケ担当者が毎朝読むメディアなので、
    両方のトピックを受け入れる。純粋なエンタメ/ガジェット/スポーツは除外。
    """
    hay = (title or "") + " " + (summary or "")
    if _AI_WORD_RE.search(hay):
        return True
    if any(kw in hay for kw in AI_KEYWORDS_CONTAIN):
        return True
    if _MKT_WORD_RE.search(hay):
        return True
    if any(kw in hay for kw in MARKETING_KEYWORDS_CONTAIN):
        return True
    return False


def relevance_score(title: str, summary: str) -> int:
    """AI + マーケ両方マッチなら優先（score=2）、片方なら score=1、なしは 0。並び替え用。"""
    hay = (title or "") + " " + (summary or "")
    ai = bool(_AI_WORD_RE.search(hay)) or any(kw in hay for kw in AI_KEYWORDS_CONTAIN)
    mkt = bool(_MKT_WORD_RE.search(hay)) or any(kw in hay for kw in MARKETING_KEYWORDS_CONTAIN)
    return (1 if ai else 0) + (1 if mkt else 0)


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


# Google News RSS は news.google.com/rss/articles/... のリダイレクター URL を link に入れる。
# description の中に実際の記事 URL が <a href="..."> で含まれているので抽出する。
# こうすることで: ①OGP 画像取得が実 URL で実行できる、②ユーザーが記事を直接開ける。
_GNEWS_REAL_URL_RE = re.compile(r'<a[^>]+href=["\'](https?://[^"\']+)["\']', re.IGNORECASE)

def resolve_article_url(link: str, description: str | None) -> str:
    """Google News 等のリダイレクター URL を実記事 URL に解決。解決できなければ元の link を返す。"""
    if not link:
        return link
    if "news.google.com/" in link:
        m = _GNEWS_REAL_URL_RE.search(description or "")
        if m:
            real = m.group(1)
            # Google News 内部リンクは除外（cluster ページ等）
            if "news.google.com" not in real:
                return real
    return link


# 過去アーカイブの URL を読み込む参照日数。直近 N 日間のアーカイブに含まれる
# 記事 URL は「既出」として今日の収集からは除外する（前日との重複表示を防ぐ）。
ARCHIVE_DEDUP_DAYS = 2


def load_recent_archive_urls(days: int = ARCHIVE_DEDUP_DAYS) -> set[str]:
    """直近 N 日のアーカイブ JSON から URL を集める。存在しないファイルは黙ってスキップ。
    今日のファイルも含める（scraper 再実行時の自己重複防止）。"""
    urls: set[str] = set()
    today_jst = datetime.now(JST).date()
    for i in range(days + 1):
        day = today_jst - timedelta(days=i)
        path = ARCH_DIR / f"{day.strftime('%Y-%m-%d')}.json"
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for it in data.get("items", []) or []:
                u = (it.get("url") or "").strip()
                if u:
                    urls.add(u)
        except Exception as e:
            log(f"archive read error ({path.name}): {e}")
    return urls


# ── 収集 ──────────────────────────────────────────
def fetch_all() -> list[dict]:
    cutoff = datetime.now(UTC) - timedelta(hours=RECENT_HOURS)
    all_items: list[dict] = []
    seen_urls: set[str] = set()
    # 前日以前に既出の URL は除外（毎朝同じニュースが並ぶのを防ぐ）
    prev_urls = load_recent_archive_urls()
    log(f"loaded {len(prev_urls)} URLs from last {ARCHIVE_DEDUP_DAYS} day archives for dedup")

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
            per_src_max = int(src.get("max", PER_SOURCE_MAX))
            src_tier = src.get("tier", "media")
            for e in d.entries[:per_src_max]:
                raw_link = (getattr(e, "link", None) or "").strip()
                raw_desc = (getattr(e, "summary", "") or getattr(e, "description", "") or "")
                # Google News 等のリダイレクター URL を実記事 URL に解決
                url = resolve_article_url(raw_link, raw_desc).strip()
                if not url or url in seen_urls:
                    continue
                if url in prev_urls:
                    # 前日以前に既出の URL はスキップ（毎朝同じ記事が並ぶのを防ぐ）
                    continue
                if not url.startswith(("http://", "https://")):
                    continue
                pub = parse_pub(e)
                if pub is None or pub < cutoff:
                    continue
                title = strip_html(getattr(e, "title", "") or "").strip()
                if not title:
                    continue
                if not is_japanese_text(title):
                    continue
                raw_summary = strip_html(getattr(e, "summary", "") or getattr(e, "description", "") or "")
                # 消費者向け商品セール記事（PC販売・通販値下げ等）は B2B マーケ視点で不要 → ハード除外
                if is_consumer_noise(title, raw_summary):
                    continue
                # AI or マーケティング関連でない記事を除外（AI NEWS は AI + マーケ視点）
                # AI/マーケ関連 or 競合企業言及のいずれか満たせば採用
                # （競合プレスリリースは AI キーワード含まないケースが多いので救済）
                if not is_ai_related(title, raw_summary) and not is_competitor_mention(title, raw_summary):
                    continue
                # URL 到達性チェック（404 / dead link を事前に除外して「リンク間違い」を根絶）
                if not validate_url(url):
                    log(f"  skip (unreachable): {url}")
                    continue
                # 画像抽出（media:content / enclosure / media:thumbnail）
                image = None
                for mc in getattr(e, "media_content", []) or []:
                    mtype = (mc.get("type") or "").lower()
                    if mtype.startswith("image/") or mc.get("url", "").split("?")[0].endswith((".jpg", ".jpeg", ".png", ".webp")):
                        image = mc.get("url")
                        break
                if not image:
                    for mt in getattr(e, "media_thumbnail", []) or []:
                        if mt.get("url"):
                            image = mt["url"]
                            break
                if not image and hasattr(e, "enclosures"):
                    for enc in e.enclosures or []:
                        if (enc.get("type") or "").startswith("image/"):
                            image = enc.get("href") or enc.get("url")
                            break
                # 画像URLの安全性検証（https のみ許可）
                if image and not image.startswith("https://"):
                    image = None
                # RSSに画像がなければOGP画像を取得（記事URL → og:image）
                if not image:
                    image = fetch_ogp_image(url)
                seen_urls.add(url)
                # 人気度シグナル: はてなブックマーク数（無い/0 は低人気扱い）
                hatena = fetch_hatena_count(url)
                all_items.append({
                    "id": make_id(url),
                    "title": truncate(title, 200),
                    "url": url,
                    "image": image,
                    "raw_summary": raw_summary,
                    "source": src["name"],
                    "sourceType": src_tier,
                    "category": src["category"],
                    "publishedAt": pub.isoformat(),
                    "hatenaCount": hatena,
                    "isCompetitor": is_competitor_mention(title, raw_summary),
                })
                count += 1
            log(f"  -> {count} new")
        except Exception as ex:
            log(f"  ! error {src['name']}: {ex}")

    # 人気度フィルタ: 「バズ」基準（緩め）。
    # はてなブックマークのインデックスは遅く、新着記事に反映されるまで
    # 最大 1〜2日かかる。厳しくすると記事がゼロになるので、フィルタは
    # 「確実に無価値な古い記事だけ落とす」発想に変更:
    #  - 24時間以内は全件通過（ブクマ数に関係なく）
    #  - 24〜72時間: hatena>=1 で通過
    #  - 72時間以降: hatena>=3 必須
    #  - ツール系キーワード（Claude Code/Copilot 等）は常に救済
    TOOL_RE = re.compile(
        r"Claude\s*Code|GitHub\s*Copilot|Copilot|Cursor|Devin|Windsurf|Cline|"
        r"バイブコーディング|AIコーディング|AIペアプロ|AIエディタ|AI補完|プロンプト",
        re.IGNORECASE,
    )
    def _is_tool(it: dict) -> bool:
        hay = (it.get("title", "") or "") + " " + (it.get("raw_summary", "") or "")
        return bool(TOOL_RE.search(hay))
    def _buzz_pass(it: dict) -> bool:
        if _is_tool(it):
            return True  # ツール系は常に救済
        h = (it.get("hatenaCount") or 0)
        age_h = (datetime.now(UTC) - datetime.fromisoformat(it["publishedAt"].replace("Z","+00:00"))).total_seconds() / 3600
        if age_h < 24:
            return True      # 24h 以内は無条件通過（はてブのインデックスが追いつかないため）
        if age_h < 72:
            return h >= 1    # 1〜3日経過: ブクマ1以上
        return h >= 3        # 3日以降: ブクマ3以上
    before = len(all_items)
    all_items = [it for it in all_items if _buzz_pass(it)]
    log(f"filtered by buzz threshold: {before} -> {len(all_items)}")
    # 並び順: メディア優先 × 人気度(はてブ数)降順 × 新着降順
    all_items.sort(key=lambda x: (
        1 if x.get("sourceType") == "ugc" else 0,        # メディア先行
        -int(x.get("hatenaCount") or 0),                  # 人気記事先行
        -int(datetime.fromisoformat(x["publishedAt"].replace("Z","+00:00")).timestamp()),  # 新着先行
    ))
    log(f"total collected (after filter): {len(all_items)}")
    return all_items


# ── 要約 ──────────────────────────────────────────
# 重要度 → 推定読了時間（分）。「10分で読める」を保つための予算配分。
#  importance=1 (TOP)      : 2分（じっくり）
#  importance=2 (BRIEFING) : 1分（要点だけ）
#  importance=3 (MORE)     : 1分（流し読み）
READ_MIN_BY_IMPORTANCE: dict[int, int] = {1: 2, 2: 1, 3: 1}


def normalize_read_min(importance: int) -> int:
    return READ_MIN_BY_IMPORTANCE.get(importance, 1)


_BOILERPLATE_HEADS = [
    "はじめに", "概要", "要約", "目次", "背景", "序論", "序章",
    "前書き", "まえがき", "導入", "この記事について", "本記事について",
    "TL;DR", "TLDR", "tl;dr", "tldr",
]
_BOILERPLATE_RE = re.compile(
    r"^(?:" + "|".join(re.escape(h) for h in _BOILERPLATE_HEADS) + r")[\s:：。、\-―ー]*",
    re.IGNORECASE,
)


def strip_boilerplate(s: str) -> str:
    """Qiita/Zenn/note 等で本文冒頭にくる見出し語（『はじめに』等）を剥がす。"""
    if not s:
        return s
    t = s.strip()
    for _ in range(3):
        new = _BOILERPLATE_RE.sub("", t).strip()
        if new == t:
            break
        t = new
    return t


def _first_sentence(s: str, max_len: int = 120) -> str:
    """要約の先頭1〜2文を切り出す（whyItMatters の簡易フォールバック用）。"""
    if not s:
        return ""
    s = strip_boilerplate(s)
    # 句点で切る
    m = re.match(r"^[^。]{4,}。[^。]{0,40}。?", s)
    chunk = m.group(0) if m else s[:max_len]
    return truncate(chunk, max_len)


def fallback_summarize(items: list[dict]) -> list[dict]:
    """API無し / 失敗時の素朴フォールバック。先頭1件をTOP、次5件をBRIEFINGとする。
    whyItMatters は要約の冒頭を使って最低限「何が重要か」を示す。
    """
    # メディア記事 → UGC の順に並べ替え、メディアから TOP/BRIEFING を埋める
    def _is_ugc(it: dict) -> bool:
        return it.get("sourceType") == "ugc"
    items.sort(key=lambda x: (1 if _is_ugc(x) else 0))
    for idx, it in enumerate(items):
        body = strip_boilerplate(it.pop("raw_summary", "") or "")
        it["summary"] = truncate(body, SUMMARY_CHARS) or it["title"]
        it["tags"] = []
        # 簡易 whyItMatters: 要約冒頭の1文。空なら空のまま。
        it["whyItMatters"] = _first_sentence(body or it["summary"], 140)
        it["actionItem"] = ""
        it["pickerComment"] = ""
        # UGC は TOP (must_know) に昇格させない。個人発信は最低でも this_week 扱い。
        if idx == 0 and not _is_ugc(it):
            it["importance"] = 1
            it["urgency"] = "must_know"
        elif idx < 6:
            it["importance"] = 2
            it["urgency"] = "this_week"
        else:
            it["importance"] = 3
            it["urgency"] = "fyi"
        it["readMin"] = normalize_read_min(it["importance"])
    return items


# Claude Haiku 呼び出し失敗時のエラーメッセージを main() から取り出せるよう保持
_LAST_ANTHROPIC_ERROR: str | None = None


def call_anthropic(items: list[dict]) -> tuple[list[dict], list[str]] | None:
    """Claude Haikuで一括要約。成功時は (items, executiveSummary) を返す。失敗時 None"""
    global _LAST_ANTHROPIC_ERROR
    try:
        import anthropic  # type: ignore
    except ImportError as e:
        _LAST_ANTHROPIC_ERROR = f"ImportError: {e}"
        log(f"anthropic SDK not available: {e}")
        return None
    if not ANTHROPIC_API_KEY:
        _LAST_ANTHROPIC_ERROR = "ANTHROPIC_API_KEY missing"
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
        "あなたはAKKODiS（人材サービス・ITソリューション企業）のB2Bマーケティング担当者向けニュース・インテリジェンス・キュレーターです。"
        "単なる記事要約ではなく「マーケ担当が明日から何をすべきか」がわかるブリーフを作成します。\n\n"
        "## 読者コンテキスト\n"
        "- AKKODiS Japan：採用マーケティング（新卒・中途エンジニア）とB2Bマーケティング（ITソリューション販売）が主業務\n"
        "- 人材業界・IT業界・同業他社（パーソル、リクルート、ランスタッド等）の動向は特に重要\n"
        "- AI一般論よりも、マーケ実務に直結するAI活用ニュースを優先\n\n"
        "## urgency判定の優先基準\n"
        "1. 採用マーケ・B2Bマーケに直接影響するニュース → must_know候補\n"
        "2. 人材業界・IT業界・競合の動き → must_know〜this_week\n"
        "3. マーケツール・広告プラットフォームの重要アップデート → this_week\n"
        "4. AI一般論・テック業界の大きな動き → this_week〜fyi\n\n"
        "## 各記事について以下を日本語で生成してください:\n"
        "- summary: 何が起きたかの事実要約（100〜140字）。主語・数値・固有名詞を明記。\n"
        "- whyItMatters: AKKODiSのマーケ担当にとって具体的に何が変わるか（1文）。"
        "※summaryの言い換えは禁止。「だから自分たちはどうなるのか」を書く。\n"
        "- actionItem: 推奨アクション（1文、具体的に。誰が・何を・いつまでにの要素を含む）\n"
        "- urgency: must_know（重要ニュース、最大2件）/ this_week（注目ニュース、最大5件）/ fyi（その他）\n"
        "- tags: 3〜5個の日本語タグ\n"
        "- pickerComment: 専門家の視点コメント（1〜2文）。"
        "マーケ戦略コンサルタントやCMO経験者の立場で、この記事への洞察・補足・注意点を書く。"
        "「〜に注目」「〜が鍵」のような定型は避け、具体的な業界知識に基づくコメントにする。\n"
        "- importance: 1=最重要1件のみ、2=押さえるべき5件、3=その他\n"
        "- readMin: 推定読了時間（1〜3分）\n\n"
        "## executiveSummary\n"
        "全記事を俯瞰した3行サマリー。各行は「何が起きて、なぜ注目か」を平易な日本語で1文にまとめる。\n"
        "**各行は必ず60字以内の短い1文**。専門用語は避け、マーケ部門の誰が読んでもすぐわかる表現にすること。\n"
        "期限指示（「今日中に〜」等）は入れない。事実と影響のみ。説明や補足は書かない。\n\n"
        "煽りや推測は避け、事実ベースで。\n"
        "出力は厳密にJSONのみで、以下の形式に従ってください:\n"
        "{\"executiveSummary\":[\"...\",\"...\",\"...\"],"
        "\"items\":[{\"i\":0,\"summary\":\"...\",\"whyItMatters\":\"...\",\"actionItem\":\"...\",\"pickerComment\":\"...\",\"urgency\":\"must_know\",\"tags\":[\"...\"],\"importance\":1,\"readMin\":2}, ...]}"
    )

    user_prompt = (
        "次の記事リストを、上記ルールに従ってインテリジェンス・ブリーフとして処理してください。\n"
        "入力JSON:\n" + json.dumps(payload, ensure_ascii=False)
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=8000,  # 4000 だと JSON が truncate されて parse error 発生
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = "".join(getattr(b, "text", "") for b in msg.content)
    except Exception as ex:
        err = f"{type(ex).__name__}: {ex}"
        log(f"anthropic call failed: {err}")
        # main() の debug_stats に後から取り出せるよう module global に保存
        # （global 宣言は関数冒頭で済ませている）
        _LAST_ANTHROPIC_ERROR = err
        return None

    parsed = extract_json(text)
    if not parsed or "items" not in parsed:
        _LAST_ANTHROPIC_ERROR = f"JSON parse failed: {_LAST_JSON_PARSE_ERROR} (raw len={len(text or '')})"
        log(f"anthropic response was not valid JSON: {_LAST_ANTHROPIC_ERROR}")
        return None

    # executiveSummary を抽出（各行60字に強制カット：LLMが冗長な1文を返しても短く整える）
    exec_summary = parsed.get("executiveSummary") or []
    if isinstance(exec_summary, list):
        exec_summary = [truncate(str(s).strip(), 60) for s in exec_summary if str(s).strip()][:5]
    else:
        exec_summary = []

    by_index = {int(o["i"]): o for o in parsed["items"] if "i" in o}
    top_assigned = False
    VALID_URGENCY = {"must_know", "this_week", "fyi"}
    for idx, it in enumerate(target):
        o = by_index.get(idx)
        raw = it.pop("raw_summary", "")
        if o:
            it["summary"] = truncate((o.get("summary") or "").strip(), SUMMARY_CHARS) or truncate(raw, SUMMARY_CHARS)
            it["whyItMatters"] = truncate((o.get("whyItMatters") or "").strip(), 200)
            it["actionItem"] = truncate((o.get("actionItem") or "").strip(), 200)
            it["pickerComment"] = truncate((o.get("pickerComment") or "").strip(), 250)
            urg = (o.get("urgency") or "fyi").strip()
            it["urgency"] = urg if urg in VALID_URGENCY else "fyi"
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
            # readMin は importance に連動させる（「10分で読める」予算を保つため）
            it["readMin"] = normalize_read_min(imp)
        else:
            it["summary"] = truncate(raw, SUMMARY_CHARS) or it["title"]
            it["whyItMatters"] = ""
            it["actionItem"] = ""
            it["pickerComment"] = ""
            it["urgency"] = "fyi"
            it["tags"] = []
            it["importance"] = 3
            it["readMin"] = normalize_read_min(3)

    # 上限を超えた分はフォールバック（全部 more 扱い）
    if len(items) > SUMMARIZE_MAX:
        rest = items[SUMMARIZE_MAX:]
        fallback_summarize(rest)
        for it in rest:
            it["importance"] = 3
            it["readMin"] = normalize_read_min(3)
    return items, exec_summary


_LAST_JSON_PARSE_ERROR: str | None = None


def extract_json(text: str) -> dict | None:
    global _LAST_JSON_PARSE_ERROR
    text = text.strip()
    # コードフェンス除去
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # 最初の { 〜 最後の }
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        _LAST_JSON_PARSE_ERROR = f"no braces found (len={len(text)})"
        return None
    body = text[s : e + 1]
    try:
        return json.loads(body)
    except Exception as ex:
        # よくある Claude のミス: trailing comma / 改行内の制御文字を修復して再試行
        try:
            fixed = re.sub(r",\s*([}\]])", r"\1", body)  # trailing comma 除去
            return json.loads(fixed)
        except Exception as ex2:
            _LAST_JSON_PARSE_ERROR = f"{type(ex).__name__}: {ex}"
            return None


# ── 保存 ──────────────────────────────────────────
def save(items: list[dict], executive_summary: list[str] | None = None,
         x_highlights: list[dict] | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARCH_DIR.mkdir(parents=True, exist_ok=True)
    today_jst = datetime.now(JST).strftime("%Y-%m-%d")
    payload = {
        "updatedAt": datetime.now(UTC).isoformat(),
        "generatedFor": today_jst,
        "executiveSummary": executive_summary or [],
        "count": len(items),
        "items": items,
        "xHighlights": x_highlights or [],
    }
    latest = DATA_DIR / "news.json"
    archive = ARCH_DIR / f"{today_jst}.json"
    latest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    archive.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"wrote {latest.relative_to(ROOT.parent.parent)} and {archive.relative_to(ROOT.parent.parent)} ({len(items)} items, {len(x_highlights or [])} x highlights)")


# ── X トレンド取得（Claude + web_search） ────────────────────────────
# Anthropic の web_search ツールを使って「今日の生成AI関連で話題のXポスト」を取得する。
# - 実在する X URL のみ採用（validate_url で 200 チェック）
# - author/handle/text を構造化して xHighlights に流し込む
# - 失敗・0件時はクライアント側のシードプール（日次ローテ）にフォールバックさせる
def fetch_x_trends_via_claude() -> list[dict]:
    if not ANTHROPIC_API_KEY:
        log("ANTHROPIC_API_KEY missing, skip x trends fetch")
        return []
    try:
        import anthropic  # type: ignore
    except ImportError as e:
        log(f"anthropic SDK not available for x trends: {e}")
        return []
    today_jst = datetime.now(JST)
    date_label = today_jst.strftime("%Y年%m月%d日")
    prompt = (
        f"今日（{date_label}）または直近 48 時間以内に、日本語のX（旧Twitter）で"
        "「いいね・リポスト・引用が多く付いて注目されている、生成AI関連の投稿」を"
        "**実在する URL 付きで** 6 件挙げてください。\n\n"
        "## 厳守ルール\n"
        "- web_search を使って実在を確認すること。架空の URL や著者名は絶対に作らない\n"
        "- URL は https://x.com/<handle>/status/<id> または https://twitter.com/... の形式のみ\n"
        "- 投稿が確認できなかった場合は「無し」と返す（無理に埋めない）\n"
        "- 著者は誰でも良い（著名人/一般ユーザー問わず、エンゲージメントが多いもの）\n\n"
        "## 出力フォーマット（JSON のみ、説明文なし）\n"
        "{\"items\":[{\"author\":\"表示名\",\"handle\":\"@xxxx\",\"text\":\"本文（200字以内に整形可）\","
        "\"url\":\"https://x.com/.../status/...\",\"tag\":\"短いトピック名\"}, ...]}"
    )
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": prompt}],
        )
        # tool_use の応答を含む可能性あり。最後のテキストブロックを使う。
        text_parts = [getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text"]
        text = "".join(text_parts)
    except Exception as e:
        log(f"x trends claude call failed: {type(e).__name__}: {e}")
        return []
    parsed = extract_json(text)
    if not parsed or "items" not in parsed:
        log("x trends: no parseable JSON in claude response")
        return []
    raw_items = parsed.get("items") or []
    out: list[dict] = []
    for it in raw_items[:8]:
        url = (it.get("url") or "").strip()
        if not url or not re.match(r"^https://(?:x|twitter)\.com/[^/]+/status/\d+", url):
            continue
        # URL 到達性チェック（404/凍結アカウントなどを除外）
        if not validate_url(url, timeout=5):
            log(f"x trends skip unreachable: {url}")
            continue
        author = (it.get("author") or "").strip()[:40]
        handle = (it.get("handle") or "").strip()[:40]
        text_body = (it.get("text") or "").strip()
        tag = (it.get("tag") or "AI").strip()[:20]
        if not author or not handle or not text_body:
            continue
        # アバターは unavatar.io 経由で X handle から自動取得
        h = handle.lstrip("@")
        avatar = f"https://unavatar.io/x/{h}"
        out.append({
            "id": f"xt_{hashlib.sha1(url.encode()).hexdigest()[:10]}",
            "author": author,
            "handle": handle if handle.startswith("@") else f"@{handle}",
            "avatar": avatar,
            "text": truncate(text_body, 240),
            "tag": tag,
            "url": url,
            # likes/retweets は web_search では取得困難。0 で通すと client の閾値で弾かれるため
            # 「注目されている」と判定された前提で BUZZ_MIN を満たす最低値を入れておく。
            "likes": 3000,
            "retweets": 0,
        })
    log(f"x trends: collected {len(out)} valid posts")
    return out


# ── 音声ダイジェスト事前生成（OpenAI TTS） ──────────────────────────────────────────
DIGEST_MODEL = "claude-haiku-4-5-20251001"

TTS_INSTRUCTIONS = """You are a top-tier professional Japanese news anchor delivering an NHK-quality morning business briefing to Japanese marketing professionals.

VOICE CHARACTER:
- Warm, authoritative, trustworthy — like an NHK おはよう日本 or テレビ東京 WBS anchor
- Natural Japanese pitch accent (高低アクセント), never flat or monotonic
- Calm, composed, with subtle warmth — professional composure

PACE & RHYTHM:
- Baseline pace: calm and measured (~320 Japanese characters per minute)
- Slow down on key numbers, proper nouns, and the first mention of each topic
- Clear 0.5-0.7s pause at sentence end (「。」), 0.2s at clauses (「、」)
- Longer breath (1.0s) between topic transitions

INTONATION (CRITICAL):
- Natural Japanese sentence-end falling cadence (下降調で終わる)
- Rising tone at clause boundaries to maintain listener engagement
- Emphasize subjects and action verbs with slight pitch rise
- Subtle emotional color — concerned for risks, measured for stats, uplifting at closing

PRONUNCIATION:
- All katakana loanwords: pure Japanese phonetics (NOT English accent)
  - ChatGPT = 「チャットジーピーティー」, Google = 「グーグル」, Claude = 「クロード」
  - AI = 「エーアイ」, GPT = 「ジーピーティー」, LLM = 「エルエルエム」
- Numbers: natural Japanese reading (25% = 「にじゅうごパーセント」)
- Proper nouns: crisp, slightly slower delivery

DELIVERY ARC:
- Opening greeting: warm, clear, inviting — makes the listener feel welcomed
- News body: measured authority, emphasize the 3W (what / why it matters / what to do)
- Transitions (「続いて」「一方で」): clear pause, slight tonal shift to signal topic change
- Closing (「今日も一日…」): composed, encouraging, subtle smile in voice

AVOID:
- English-accented Japanese
- Robotic, uniform, flat TTS tone
- Overly cheerful radio DJ style
- Rushing through numbers or proper nouns
- Excessive softness or whispering

TARGET: The listener should feel they are receiving a trusted, professional morning briefing from a senior Japanese business news anchor — the kind of voice they'd expect on NHK or TV Tokyo's morning business program."""


def generate_digest_script(exec_summary: list[str], mustknow: list[dict], thisweek: list[dict]) -> str | None:
    """Claude Haiku で5分ダイジェスト台本を生成。失敗時は None。"""
    if not ANTHROPIC_API_KEY:
        return None
    today_jst = datetime.now(JST)
    date_label = f"{today_jst.month}月{today_jst.day}日"

    lines = []
    if exec_summary:
        lines.append("【今日の全体像】")
        for s in exec_summary:
            lines.append(f"・{s}")
    if mustknow:
        lines.append("\n【本日の主要ニュース】")
        for n in mustknow:
            lines.append(f"■ {n.get('title','')}")
            if n.get("summary"): lines.append(f"  {n['summary']}")
            if n.get("whyItMatters"): lines.append(f"  影響: {n['whyItMatters']}")
            if n.get("actionItem"): lines.append(f"  アクション: {n['actionItem']}")
    if thisweek:
        lines.append("\n【注目ニュース】")
        for n in thisweek:
            lines.append(f"■ {n.get('title','')}")
            if n.get("summary"): lines.append(f"  {n['summary']}")

    system_prompt = f"""あなたはマーケティングチーム向けの朝の社内ラジオのパーソナリティです。毎朝5分で、最新ニュースをわかりやすくダイジェストで伝えます。

## 絶対ルール
- 日本語のみ。英単語は原則使わない。避けられない固有名詞はカタカナ表記（ChatGPT→チャットジーピーティー、Claude→クロード、Google→グーグル、AI→エーアイ、GPT→ジーピーティー、LLM→エルエルエム、SNS→エスエヌエス、LP→ランディングページ）
- 日付は「{date_label}」と書く
- 数字は読みやすく（50%→半分以上、3つ→みっつ）
- 記号は「」のみ使用。マークダウン・箇条書き・見出しは使わない

## 3幕構成
### 第1幕（冒頭30秒）
- 「おはようございます。{date_label}のマーケティング・ニュースダイジェストです。」
- 「今日のポイントは3つあります。」と予告

### 第2幕（本編3〜4分）
- 重要ニュースから順に解説
- 記事間のつながり（「この流れを受けて」「一方で」）
- 各トピックで「なぜ自分たちに関係あるか」を必ず説明
- 「あなたのチームがやるべきことは」で具体アクション

### 第3幕（30秒）
- 「最後にまとめです。」で3つ振り返り
- 「今日も一日頑張っていきましょう。」で締め

## スタイル
- 話し言葉。「〜ですね」「〜なんですが」の口語体
- 1000〜1500字（約4〜5分）
- 通勤中のマーケ担当者が聴く想定

出力は本文のみ。英単語は一切使わない。"""

    user_prompt = f"以下は本日（{date_label}）のニュースです。5分ダイジェスト台本を日本語のみで作成してください。英単語はすべてカタカナに。\n\n" + "\n".join(lines)

    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            data=json.dumps({
                "model": DIGEST_MODEL,
                "max_tokens": 3000,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            }).encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        return "".join(parts).strip() or None
    except Exception as e:
        log(f"digest script error: {e}")
        return None


def generate_tts_mp3(text: str) -> bytes | None:
    """OpenAI TTS (gpt-4o-mini-tts / voice=nova) で日本語 MP3 を生成。失敗時 None。"""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key or not text:
        return None
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps({
                "model": "gpt-4o-mini-tts",
                "voice": "nova",
                "input": text[:4800],
                "instructions": TTS_INSTRUCTIONS,
                "response_format": "mp3",
                "speed": 1.0,
            }).encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except Exception as e:
        log(f"tts error: {e}")
        return None


def save_audio(mp3: bytes, script: str) -> None:
    """MP3 と台本を apps/ai-news/data/audio/ に保存。"""
    audio_dir = DATA_DIR / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    today_jst = datetime.now(JST).strftime("%Y-%m-%d")
    mp3_path = audio_dir / f"{today_jst}.mp3"
    script_path = audio_dir / f"{today_jst}.txt"
    latest_mp3 = audio_dir / "latest.mp3"
    latest_script = audio_dir / "latest.txt"
    mp3_path.write_bytes(mp3)
    latest_mp3.write_bytes(mp3)
    script_path.write_text(script, encoding="utf-8")
    latest_script.write_text(script, encoding="utf-8")
    log(f"wrote audio: {mp3_path.relative_to(ROOT.parent.parent)} ({len(mp3)/1024:.0f} KB)")


# ── エントリーポイント ──────────────────────────────────────────
def _write_debug_stats(stats: dict) -> None:
    """scraper 動作の統計を毎回 data/debug.json に書き込む（workflow の commit 対象）。
    ログが見られない環境でも、commit diff から動作が分かるようにする。"""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        (DATA_DIR / "debug.json").write_text(
            json.dumps(stats, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except Exception as e:
        log(f"failed to write debug.json: {e}")


def main() -> int:
    started = time.time()
    debug_stats: dict = {
        "ranAt": datetime.now(UTC).isoformat(),
        "anthropicKeySet": bool(ANTHROPIC_API_KEY),
        "openaiKeySet": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
        "sources": len(SOURCES),
        "phase": "start",
    }
    # 最初に必ず debug.json を書く（以降のどこで失敗しても記録が残る）
    _write_debug_stats(debug_stats)
    try:
        items = fetch_all()
    except Exception as e:
        debug_stats["phase"] = "fetch_all_crashed"
        debug_stats["error"] = f"{type(e).__name__}: {e}"
        _write_debug_stats(debug_stats)
        log(f"fetch_all crashed: {e}")
        raise
    debug_stats["fetched_items"] = len(items)
    if not items:
        log("no items collected; preserving previous news.json (if exists)")
        debug_stats["exitedEarly"] = "no_items_after_filters"
        _write_debug_stats(debug_stats)
        return 0
    result = call_anthropic(items)
    if result is None:
        items = fallback_summarize(items)
        exec_summary: list[str] = []
        debug_stats["summarizer"] = "fallback"
        if _LAST_ANTHROPIC_ERROR:
            debug_stats["anthropicError"] = _LAST_ANTHROPIC_ERROR
    else:
        items, exec_summary = result
        debug_stats["summarizer"] = "anthropic_haiku"
    debug_stats["final_items"] = len(items)
    debug_stats["competitor_items"] = sum(1 for x in items if x.get("isCompetitor"))
    # X トレンド取得（Claude + web_search）。失敗時は空配列で client 側のシードに任せる。
    log("fetching x trends via claude + web_search...")
    x_highlights = fetch_x_trends_via_claude()
    debug_stats["x_highlights"] = len(x_highlights)
    save(items, exec_summary, x_highlights=x_highlights)

    # ── 音声ダイジェストを事前生成（GitHub Actions 実行時のみ） ──
    if os.environ.get("SKIP_AUDIO", "").strip() != "1":
        mustknow = [x for x in items if x.get("urgency") == "must_know"][:2]
        thisweek = [x for x in items if x.get("urgency") == "this_week"][:6]
        log("generating digest script...")
        script = generate_digest_script(exec_summary, mustknow, thisweek)
        if script:
            log(f"digest script: {len(script)} chars")
            log("generating TTS MP3 (OpenAI nova)...")
            mp3 = generate_tts_mp3(script)
            if mp3:
                save_audio(mp3, script)
            else:
                log("tts generation failed; static audio not saved")
        else:
            log("digest script generation failed; skipping audio")

    debug_stats["durationSec"] = round(time.time() - started, 1)
    _write_debug_stats(debug_stats)
    log(f"done in {time.time() - started:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
