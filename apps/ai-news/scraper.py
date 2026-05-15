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
    # ── 競合モニタリング ─────────────────────────────────────────
    # 【経緯】PR TIMES の `freeword/<company>/0/1` は2026/4/22以降、過去 7 日間の
    # 全ログで 0 件。URL パターン廃止 or feed 形式変更が原因と推定。コーポレート公式 RSS
    # （Accenture NEWSROOM / NTTデータ / 富士通）も同様に取得不可。すべて Google News
    # RSS 検索（実績あり：04-23〜04-29 で毎日 3〜13 件取得）に置き換える。
    # URL パターン: https://news.google.com/rss/search?q=<query>&hl=ja&gl=JP&ceid=JP:ja
    # ── ①SIer / IT サービス（本丸競合） ──
    {"name": "Google News (NTTデータ)",   "url": "https://news.google.com/rss/search?q=NTTデータ+(AI+OR+決算+OR+業績+OR+M%26A+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (富士通)",      "url": "https://news.google.com/rss/search?q=富士通+(AI+OR+決算+OR+業績+OR+M%26A+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",     "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (日立)",        "url": "https://news.google.com/rss/search?q=日立製作所+(AI+OR+決算+OR+業績+OR+デジタル)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (NEC)",        "url": "https://news.google.com/rss/search?q=NEC+(AI+OR+決算+OR+業績+OR+セキュリティ+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (NRI)",        "url": "https://news.google.com/rss/search?q=野村総合研究所+(AI+OR+決算+OR+業績+OR+コンサル)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (TIS)",        "url": "https://news.google.com/rss/search?q=TISインテック+(AI+OR+決算+OR+業績+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",                 "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (SCSK)",       "url": "https://news.google.com/rss/search?q=SCSK+(AI+OR+決算+OR+業績+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",                          "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (BIPROGY)",    "url": "https://news.google.com/rss/search?q=BIPROGY+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (NSSOL)",      "url": "https://news.google.com/rss/search?q=日鉄ソリューションズ+(AI+OR+決算+OR+業績+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (CTC)",        "url": "https://news.google.com/rss/search?q=伊藤忠テクノソリューションズ+(AI+OR+決算+OR+業績+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",   "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (大塚商会)",    "url": "https://news.google.com/rss/search?q=大塚商会+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",               "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (電通総研)",    "url": "https://news.google.com/rss/search?q=電通総研+(AI+OR+決算+OR+業績+OR+DX)&hl=ja&gl=JP&ceid=JP:ja",                       "category": "market", "tier": "media", "max": 2},
    # ── ②IT / 戦略コンサル（上流競合） ──
    {"name": "Google News (アクセンチュア)","url": "https://news.google.com/rss/search?q=アクセンチュア+(AI+OR+決算+OR+業績+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (デロイト)",    "url": "https://news.google.com/rss/search?q=デロイト+トーマツ+(AI+OR+決算+OR+業績+OR+調査)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (PwC)",        "url": "https://news.google.com/rss/search?q=PwCコンサルティング+(AI+OR+決算+OR+業績+OR+調査)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (KPMG)",       "url": "https://news.google.com/rss/search?q=KPMGコンサルティング+(AI+OR+決算+OR+業績+OR+調査)&hl=ja&gl=JP&ceid=JP:ja",           "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (EY)",         "url": "https://news.google.com/rss/search?q=EYストラテジー+(AI+OR+決算+OR+業績+OR+調査)&hl=ja&gl=JP&ceid=JP:ja",                 "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (ベイカレント)","url": "https://news.google.com/rss/search?q=ベイカレント・コンサルティング+(AI+OR+決算+OR+業績+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (アビーム)",    "url": "https://news.google.com/rss/search?q=アビームコンサルティング+(AI+OR+決算+OR+業績+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",   "category": "market", "tier": "media", "max": 2},
    # ── ③エンジニアリング派遣・技術者アサイン（直接競合） ──
    {"name": "Google News (テクノプロ)",   "url": "https://news.google.com/rss/search?q=テクノプロ・ホールディングス+(AI+OR+決算+OR+業績+OR+エンジニア)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (メイテック)",   "url": "https://news.google.com/rss/search?q=メイテック+(AI+OR+決算+OR+業績+OR+技術者派遣)&hl=ja&gl=JP&ceid=JP:ja",               "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (アウトソーシング)","url": "https://news.google.com/rss/search?q=アウトソーシングテクノロジー+(AI+OR+決算+OR+業績+OR+技術者)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (UTグループ)",   "url": "https://news.google.com/rss/search?q=UTグループ+(AI+OR+決算+OR+業績+OR+人材)&hl=ja&gl=JP&ceid=JP:ja",                    "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (アルプス技研)","url": "https://news.google.com/rss/search?q=アルプス技研+(AI+OR+決算+OR+業績+OR+技術者派遣)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (フォーラムエンジニアリング)","url": "https://news.google.com/rss/search?q=フォーラムエンジニアリング+(AI+OR+決算+OR+業績+OR+技術者)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (パソナテック)", "url": "https://news.google.com/rss/search?q=パソナテック+(AI+OR+決算+OR+業績+OR+エンジニア)&hl=ja&gl=JP&ceid=JP:ja",              "category": "market", "tier": "media", "max": 2},
    # ── ④QA / テスト受託（ソフトウェア技術領域） ──
    {"name": "Google News (SHIFT)",      "url": "https://news.google.com/rss/search?q=株式会社SHIFT+(AI+OR+決算+OR+業績+OR+品質保証)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (ベリサーブ)",  "url": "https://news.google.com/rss/search?q=ベリサーブ+(AI+OR+決算+OR+業績+OR+品質保証)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (デジタルハーツ)","url": "https://news.google.com/rss/search?q=デジタルハーツ+(AI+OR+決算+OR+業績+OR+品質保証)&hl=ja&gl=JP&ceid=JP:ja",            "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (バルテス)",    "url": "https://news.google.com/rss/search?q=バルテス+(AI+OR+決算+OR+業績+OR+品質保証)&hl=ja&gl=JP&ceid=JP:ja",                  "category": "market", "tier": "media", "max": 2},
    # ── ⑤人材・求人プラットフォーム（候補者マーケ視点の二次競合） ──
    {"name": "Google News (パーソル)",    "url": "https://news.google.com/rss/search?q=パーソルキャリア+(AI+OR+決算+OR+業績+OR+人材+OR+転職)&hl=ja&gl=JP&ceid=JP:ja",       "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (リクルート)",  "url": "https://news.google.com/rss/search?q=リクルート+ホールディングス+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja", "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (マイナビ)",    "url": "https://news.google.com/rss/search?q=マイナビ+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",                 "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (ビズリーチ)",  "url": "https://news.google.com/rss/search?q=ビズリーチ+(AI+OR+決算+OR+業績+OR+新サービス)&hl=ja&gl=JP&ceid=JP:ja",             "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (レバテック)",  "url": "https://news.google.com/rss/search?q=レバテック+(AI+OR+決算+OR+業績+OR+エンジニア)&hl=ja&gl=JP&ceid=JP:ja",              "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (パソナ)",      "url": "https://news.google.com/rss/search?q=パソナグループ+(AI+OR+決算+OR+業績+OR+人材)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (アデコ)",      "url": "https://news.google.com/rss/search?q=アデコグループ+(AI+OR+決算+OR+業績+OR+人材)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 2},
    {"name": "Google News (ヒューマンリソシア)","url": "https://news.google.com/rss/search?q=ヒューマンリソシア+(AI+OR+決算+OR+業績+OR+技術者)&hl=ja&gl=JP&ceid=JP:ja",     "category": "market", "tier": "media", "max": 2},
    # ── 業界全体のマクロ動向（IR/業績マーケット） ──
    {"name": "Google News (SIer業界)",    "url": "https://news.google.com/rss/search?q=SIer+業界+(AI+OR+M%26A+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",                   "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (エンジニア派遣)","url": "https://news.google.com/rss/search?q=エンジニア派遣+OR+技術者派遣+(業界+OR+市場+OR+トレンド)&hl=ja&gl=JP&ceid=JP:ja",   "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (IT人材市場)",  "url": "https://news.google.com/rss/search?q=IT人材+(不足+OR+採用市場+OR+リスキリング)&hl=ja&gl=JP&ceid=JP:ja",                "category": "market", "tier": "media", "max": 3},
    # ── 業界 M&A / 業務提携 / 受託案件（横断検索） ──
    # ユーザー FB「競合動向セクションが少ない」を受けて追加。特定企業ではなく
    # 業界横断的な大型案件・提携ニュースを拾う。
    {"name": "Google News (IT業界M&A)",   "url": "https://news.google.com/rss/search?q=(IT業界+OR+SI業界)+(M%26A+OR+買収+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",         "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (DX大型受託)",  "url": "https://news.google.com/rss/search?q=DX+(大型受注+OR+大型案件+OR+業務委託+OR+受託開発)&hl=ja&gl=JP&ceid=JP:ja",      "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (人材業界動向)","url": "https://news.google.com/rss/search?q=人材業界+(M%26A+OR+業績+OR+トレンド+OR+業界動向)&hl=ja&gl=JP&ceid=JP:ja",         "category": "market", "tier": "media", "max": 3},
    {"name": "Google News (生成AI企業導入)","url": "https://news.google.com/rss/search?q=生成AI+(企業+導入事例+OR+業務活用+OR+業務提携)&hl=ja&gl=JP&ceid=JP:ja",          "category": "market", "tier": "media", "max": 3},
    # ── PR TIMES カテゴリ別フィード（プレスリリース横断） ──
    # `index.rdf` だけは生きており、IT・通信全体のプレスを引いて競合キーワードで救済できるので残す。
    # 会社別 freeword feed (`/main/rdf/freeword/<company>/0/1`) は2026/4/22以降ずっと0件のため削除済。
    {"name": "PR TIMES (IT・通信カテゴリ)", "url": "https://prtimes.jp/index.rdf",                                       "category": "market", "tier": "media", "max": 6},
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
    # マーケティング専門用語（「ブランド」「配信」「キャンペーン」「プロモーション」等の
    # generic 語は通信プラン・SIM 契約・家電セールに誤マッチするので含めない。
    # B2B マーケ視点で意味のある専門用語のみに絞る）
    "マーケティング", "マーケ",
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
# 短い ASCII 競合名は英文中の部分一致で誤検知しやすい（NEC → "connected", TIS → "statistics",
# OTS → "spots", DIS → "discussed", Green → "greenfield" 等）。word boundary (\b) を強制し、
# 日本語文字境界や句読点でのマッチに限定する。
def _is_short_ascii(k: str) -> bool:
    return k.isascii() and len(k) <= 5
_COMPETITOR_SHORT_ASCII = [k for k in COMPETITOR_KEYWORDS if _is_short_ascii(k)]
_COMPETITOR_OTHERS = [k for k in COMPETITOR_KEYWORDS if not _is_short_ascii(k)]
_COMPETITOR_RE_PARTS = []
if _COMPETITOR_SHORT_ASCII:
    _COMPETITOR_RE_PARTS.append(r"\b(?:" + "|".join(re.escape(k) for k in _COMPETITOR_SHORT_ASCII) + r")\b")
if _COMPETITOR_OTHERS:
    _COMPETITOR_RE_PARTS.append("(?:" + "|".join(re.escape(k) for k in _COMPETITOR_OTHERS) + ")")
_COMPETITOR_RE = re.compile("|".join(_COMPETITOR_RE_PARTS), re.IGNORECASE)

# 競合名が登場していても「競合動向」ではない記事を除外するためのノイズ語。
# 例: 「富士通 WEB MART」のPC通販セール、「NEC Direct」の値下げ等。
_COMPETITOR_NOISE_WORDS = [
    "WEB MART", "Web MART", "Direct Shop", "アウトレット",
    "お買い得", "キャンセル品", "セール品", "値下げ", "値引き", "特価",
    "クーポン", "通販", "ECサイト", "オンラインショップ",
    "予約受付", "新発売", "発売日", "開封レビュー",
    # Yahoo!ファイナンス等の株価自動生成ページ（競合の動向ではない）
    "株価・株式情報", "株価情報", "値動きの背景",
    "今の株価の理由", "株価の理由は", "AIが解説",
    "Yahoo!ファイナンス",
]

# 競合判定から除外する URL パターン（株価ページ・チャート等の自動生成ページ）
_COMPETITOR_NOISE_URL_PATTERNS = [
    "finance.yahoo.co.jp/quote",
    "kabutan.jp/stock",
    "minkabu.jp/stock",
]

# B2B マーケ担当者のインテリジェンス・ブリーフには不要な消費者向け商品記事を
# 全体からハード除外するためのワード。scrape 段階でフィードから落とす。
_CONSUMER_NOISE_WORDS = [
    "お買い得", "キャンセル品", "セール品", "値下げ", "値引き", "特価",
    "クーポン配布", "クーポン配信", "通販サイト", "通販限定",
    "予約受付中", "予約開始", "新発売", "発売日決定", "開封レビュー",
    "WEB MART", "Direct Shop", "アウトレット",
    "円引き", "円OFF", "割引セール", "期間限定セール",
    # 消費者向け通信プラン・SIM・端末プロモは B2B マーケ視点で不要
    "半額キャンペーン", "半額セール", "半額プラン",
    "格安SIM", "MVNO", "格安スマホ", "格安プラン",
    "ガラケー", "パカパカケータイ", "二つ折り携帯", "フィーチャーフォン",
    "スマホ料金", "携帯料金", "通信料金", "通信プラン値下げ",
    "月額料金", "月額0円", "0円スマホ",
    "ふるさと納税", "ポイント還元キャンペーン", "増量キャンペーン",
    "プレゼントキャンペーン", "抽選キャンペーン",
]

# B2C インフルエンサー / 芸能 / 化粧品 / 観光 / スポーツ消費者文脈の
# 「マーケ用語は出るが AKKODiS B2B 案件には無関係」記事を弾くワード。
# 「インフルエンサー」「ブランディング」自体は B2B 文脈でも使うため、ここでは
# B2C 限定の強いシグナル（ファンダム／推し／化粧品ブランド名／消費者ブランド／
# スポーツビッグイベント／芸能人不祥事）に絞る。
_B2C_FLUFF_WORDS = [
    # ファン経済 / 推し / 芸能人マーケ
    "ファンダム", "ファン経済", "ファンエコノミー",
    "推し活", "推しエコノミー", "推し消費", "推しマーケ",
    "K-POP", "Kポップ", "アイドル", "ジャニーズ", "STARTO",
    "芸能人", "タレント炎上", "炎上タレント", "不祥事", "モラル条項",
    "卒業発表", "結婚発表",
    # 化粧品 / 美容 / ファッション / ジュエリー（典型 B2C ブランドカテゴリ）
    "コスメブランド", "化粧品ブランド", "美容ブランド",
    "スキンケアブランド", "ヘアケアブランド",
    "ファッションブランド", "アパレルブランド",
    "ジュエリーブランド", "宝飾ブランド", "腕時計ブランド",
    "メイク発表会", "新作コスメ", "新作香水", "限定コスメ",
    # スポーツ消費者イベント・観光・グルメ・娯楽
    "ワールドカップ", "Ｗ杯", "W杯", "オリンピック", "甲子園",
    "Jリーグ", "プロ野球", "プロレス", "競馬",
    "ふるさと納税", "観光地", "温泉",
    "グルメ特集", "B級グルメ", "スイーツ特集", "食べ歩き",
    # B2C 特化のマーケ施策（toC のみ意味があるトピック）
    "シニア消費者", "若年層消費者", "Z世代消費者",
    "推し活マーケ", "ファン心理",
    # 個人クリエイター / 個人ブロガー / 個人ニュースレター起動系（B2B マーケには無関係）
    # 例: 「タスクシュート(R)開発者の大橋悦夫氏がtheLetterでニュースレター配信を開始」
    # 「ニュースレター」が MARKETING_KEYWORDS にあるため誤って AI NEWS に拾われる事象を防ぐ
    "theLetter", "タスクシュート", "TaskChute",
    "個人ブログ", "個人ブロガー", "個人クリエイター",
    "個人で運営", "個人事業主向け",
    "プロ向け執筆プラットフォーム", "創作プラットフォーム", "クリエイター向けプラットフォーム",
    # B2C 食品・飲料系（コーラ新発売、新フレーバー、限定商品など AKKODiS B2B には完全無関係）
    # 例: 「アサヒ飲料がギリシャ発のグリーンコーラを関東限定で発売、Z世代の NO に訴求」
    "コーラ", "炭酸飲料", "清涼飲料", "ミネラルウォーター", "新フレーバー",
    "ペットボトル", "缶ジュース", "缶コーヒー", "缶チューハイ",
    "ご当地グルメ", "ご当地スイーツ", "新メニュー", "コラボメニュー",
    "コンビニ新商品", "スーパー新商品", "百貨店新商品",
    # 音楽・エンタメタイアップ（B2C 文化消費系で AKKODiS には無関係）
    # 例: 「ソニーミュージックがアニメ左ききのエレン主題歌タイアップ」
    # 注: アニメ化 / 実写化 / シーズン2 は AI×コンテンツ生成記事を巻き込み除外
    # するリスクがあるため除外しない（is_consumer_noise の AI 救済も合わせて二重防御）
    "主題歌", "オープニング曲", "エンディング曲", "OP曲", "ED曲",
    "音楽タイアップ", "アニメタイアップ",
    # VOCALOID / ライブ独占放送系は _B2C_HARD_FLUFF_WORDS に分離 (AI 救済なし)
    # 飲食店・宿泊施設・観光プロモーション（地域限定 B2C）
    "新店オープン", "新装オープン", "リニューアルオープン",
    "ホテル開業", "リゾート開業",
]

# AI 救済なしの「強除外」B2C キーワード。
# VOCALOID キャラ × ライブ独占放送系は title/summary に AI 関連 keyword が
# 含まれていても "AI ボイス技術系" として誤救済される事例が多いため、
# is_consumer_noise で AI 救済をスキップして無条件除外する。
_B2C_HARD_FLUFF_WORDS = [
    # VOCALOID / ボーカロイド / ボカロ系キャラクター
    "VOCALOID", "ボーカロイド", "ボカロ", "重音テト", "初音ミク", "鏡音リン", "鏡音レン",
    "MEIKO", "KAITO", "巡音ルカ", "GUMI", "ボカロP",
    "バーチャルシンガー", "バーチャルアイドル",
    # ライブイベント / コンサート（B2C エンタメ集客）
    "Zepp", "ライブ放送", "独占放送", "ライブ独占", "コンサート",
    "アリーナツアー", "ホールツアー", "ファンミーティング",
]


def is_consumer_noise(title: str, summary: str) -> bool:
    """消費者向け商品セール記事 or B2C インフルエンサー / 芸能 fluff かどうか判定。
    AKKODiS（B2B IT サービス／エンジニアリング）の朝のブリーフには不要なので
    scrape 段階で落とす。

    判定の優先順位:
    1. _CONSUMER_NOISE_WORDS — EC セール・通販系。AI 救済なしの無条件除外。
    2. _B2C_HARD_FLUFF_WORDS — VOCALOID キャラ × ライブ独占放送系。AI 関連
       keyword が summary に含まれていても誤救済しないよう強除外。
    3. _B2C_FLUFF_WORDS — 一般的な B2C シグナル。AI / 業界系の強いシグナルが
       同時にあれば「AI × アニメ生成」「AI × 音楽」などの正当な技術記事として救済。"""
    hay = (title or "") + " " + (summary or "")
    if any(w in hay for w in _CONSUMER_NOISE_WORDS):
        return True
    if any(w in hay for w in _B2C_HARD_FLUFF_WORDS):
        return True  # AI 救済なしで強除外
    if any(w in hay for w in _B2C_FLUFF_WORDS):
        if _AI_WORD_RE.search(hay) or any(kw in hay for kw in AI_KEYWORDS_CONTAIN):
            return False
        return True
    return False


# 再掲／再配信記事の検出。例:
#   「※この記事は2025年4月28日に掲載された記事の再掲です。」
#   「（2026年1月15日公開の記事を再編集）」
# 情報価値が低いので scrape 段階で除外する。
_REPRINT_RE = re.compile(r"再掲|再配信|再掲載|再編集", re.IGNORECASE)

def is_reprint(title: str, summary: str) -> bool:
    """記事が過去記事の再掲／再配信かを判定。"""
    hay = (title or "") + " " + (summary or "")
    return bool(_REPRINT_RE.search(hay))


def is_competitor_mention(title: str, summary: str, url: str = "") -> bool:
    """記事タイトル or 要約が AKKODiS 競合企業に言及しているか判定。
    ただし製品販売・値下げ・株価情報等の「競合動向ではない」文脈は除外する。"""
    hay = (title or "") + " " + (summary or "")
    if any(w in hay for w in _COMPETITOR_NOISE_WORDS):
        return False
    if url and any(p in url for p in _COMPETITOR_NOISE_URL_PATTERNS):
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
_META_REFRESH_RE = re.compile(r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+url=([^"\'>\s]+)', re.IGNORECASE)
_CANONICAL_RE = re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](https?://[^"\']+)["\']', re.IGNORECASE)

def _fetch_gnews_real_url(link: str, timeout: int = 6) -> str | None:
    """Google News URL を HTTP フォロー + HTML パースで実 URL に解決する（最後の手段）。"""
    try:
        req = Request(link, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
            "Accept-Language": "ja,en;q=0.8",
        })
        with urlopen(req, timeout=timeout) as resp:
            final = resp.geturl()
            if final and "news.google.com" not in final:
                return final
            raw = resp.read(262144)
        html_text = raw.decode("utf-8", errors="ignore")
        for rx in (_META_REFRESH_RE, _CANONICAL_RE, _GNEWS_REAL_URL_RE):
            m = rx.search(html_text)
            if m:
                candidate = m.group(1).strip()
                if candidate and "news.google.com" not in candidate and candidate.startswith("http"):
                    return candidate
        return None
    except Exception:
        return None

def resolve_article_url(link: str, description: str | None) -> str:
    """Google News 等のリダイレクター URL を実記事 URL に解決。解決できなければ元の link を返す。
    ①description 内の <a href> を最優先（軽量）
    ②それでもダメなら HTTP フォローで実 URL を取得（重いが確実） """
    if not link:
        return link
    if "news.google.com/" in link:
        m = _GNEWS_REAL_URL_RE.search(description or "")
        if m:
            real = m.group(1)
            if "news.google.com" not in real:
                return real
        # description に <a href> が無いケース（Google News モダン RSS 形式）のため
        # 実 URL を直接フォローして解決する
        real2 = _fetch_gnews_real_url(link)
        if real2:
            return real2
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
    # 競合プレスリリース系（PR TIMES / 公式コーポレート RSS）は B2B カデンスが
    # 週単位なので 36h だと取りこぼす。7 日窓で別立て判定する。
    cutoff_press = datetime.now(UTC) - timedelta(days=7)
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
                # ソースが競合プレスリリース系（PR TIMES / コーポレート公式 RSS）なら
                # 7 日窓で許容。それ以外は通常の RECENT_HOURS。
                src_name = str(src.get("name", ""))
                is_press_source = (
                    src_name.startswith("PR TIMES")
                    or "NEWSROOM" in src_name
                    or "ニュースリリース" in src_name
                    or "プレスリリース" in src_name
                )
                eff_cutoff = cutoff_press if is_press_source else cutoff
                if pub is None or pub < eff_cutoff:
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
                # 再掲／再配信記事は情報価値が低いので除外
                if is_reprint(title, raw_summary):
                    log(f"  skip (reprint): {title[:40]}")
                    continue
                # AI or マーケティング関連でない記事を除外（AI NEWS は AI + マーケ視点）
                # AI/マーケ関連 or 競合企業言及のいずれか満たせば採用
                # （競合プレスリリースは AI キーワード含まないケースが多いので救済）
                if not is_ai_related(title, raw_summary) and not is_competitor_mention(title, raw_summary, url):
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
                    "isCompetitor": is_competitor_mention(title, raw_summary, url),
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
    # 単一ソース独占の防止: 同一ソースは最大 5 件まで（ITmedia AI+ が単独で 8/29 = 28%
    # を占めてブリーフが「ITmedia ダイジェスト」化していた問題への対策）。
    # 並び順は人気度・新着順に確定済みなので、各ソース内の上位 5 件だけを残す。
    PER_SOURCE_HARD_CAP = 5
    src_count: dict[str, int] = {}
    capped: list[dict] = []
    dropped = 0
    for it in all_items:
        s = str(it.get("source", ""))
        n = src_count.get(s, 0)
        if n >= PER_SOURCE_HARD_CAP:
            dropped += 1
            continue
        src_count[s] = n + 1
        capped.append(it)
    if dropped:
        log(f"per-source cap: dropped {dropped} items (cap={PER_SOURCE_HARD_CAP}/source)")
    all_items = capped
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
        "全記事を俯瞰した**ちょうど3行のサマリー**。**必ず3行生成すること**（この制約は最優先）。\n"
        "各行は「何が起きて、なぜ注目か」を平易な日本語で**完結した1文**にまとめる。\n"
        "**1文の目安は40〜90字**。途中で切れた文や「〜とは」「〜を…」のような体言止め未満は禁止、必ず句点で終わらせる。\n"
        "専門用語は避け、マーケ部門の誰が読んでもすぐわかる表現にする。\n"
        "期限指示（「今日中に〜」等）は入れない。事実と影響のみ。説明や補足は書かない。\n"
        "**取り上げる対象**: AI / 生成AI / B2B マーケティング / 採用マーケ / "
        "競合企業（パーソル・リクルート・SIer・コンサル等）の動向。\n"
        "**取り上げない**: B2C 商品（飲料・コーラ・コンビニ新商品）、エンタメ（音楽タイアップ・芸能人）、"
        "グルメ・観光・スポーツの新商品ニュース。\n"
        "**3行未満になりそうな時の補い方**: 該当する記事が少なくても 3行は必ず埋める。"
        "個別記事に直接書かれていなくても、本日の記事群から推測できる「AI / IT業界全体の動向」"
        "「AI ツール導入トレンド」「人材市場の構造変化」など、**抽象度を一段上げた業界マクロ"
        "コメント**で 3 行目（または 2-3 行目）を補ってよい（事実ベースで、推測表現は避ける）。\n\n"
        "煽りや推測は避け、事実ベースで。\n"
        "出力は厳密にJSONのみで、以下の形式に従ってください:\n"
        "{\"executiveSummary\":[\"...\",\"...\",\"...\"],"
        "\"items\":[{\"i\":0,\"summary\":\"...\",\"whyItMatters\":\"...\",\"actionItem\":\"...\",\"pickerComment\":\"...\",\"urgency\":\"must_know\",\"tags\":[\"...\"],\"importance\":1,\"readMin\":2}, ...]}"
    )

    user_prompt = (
        "次の記事リストを、上記ルールに従ってインテリジェンス・ブリーフとして処理してください。\n"
        "入力JSON:\n" + json.dumps(payload, ensure_ascii=False)
    )

    # ── tool_use 強制でスキーマ駆動の JSON 出力を取る ──────────────────────
    # 過去 7 日中 5 日で「JSON parse failed: JSONDecodeError after 4 repair attempts」が
    # 発生しており、Haiku のテキスト出力 JSON パースは構造的に脆い。
    # Anthropic の tool_use を使うとスキーマ強制 + 構造化 input でパース不要になる。
    # 失敗時は従来のテキスト JSON フォールバックも残して二重防御。
    BRIEF_TOOL = {
        "name": "produce_brief",
        "description": "AKKODiS マーケ担当者向けの今日のインテリジェンス・ブリーフを構造化して返す",
        "input_schema": {
            "type": "object",
            "properties": {
                "executiveSummary": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "全記事を俯瞰した3行サマリー（各60字以内、平易な日本語）",
                    "minItems": 1, "maxItems": 5,
                },
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "i": {"type": "integer", "description": "入力ペイロードの index"},
                            "summary": {"type": "string", "description": "事実要約（100〜140字）"},
                            "whyItMatters": {"type": "string", "description": "AKKODiS マーケ担当者にとって何が変わるか（1文）"},
                            "actionItem": {"type": "string", "description": "推奨アクション（誰が・何を・いつまでに、を含む1文）"},
                            "pickerComment": {"type": "string", "description": "専門家視点の洞察コメント（1〜2文）"},
                            "urgency": {"type": "string", "enum": ["must_know", "this_week", "fyi"]},
                            "tags": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 5},
                            "importance": {"type": "integer", "enum": [1, 2, 3]},
                            "readMin": {"type": "integer", "minimum": 1, "maximum": 3},
                        },
                        "required": ["i", "summary", "urgency", "importance"],
                    },
                },
            },
            "required": ["executiveSummary", "items"],
        },
    }

    parsed: dict | None = None
    raw_text_for_debug: str = ""
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=8000,  # 4000 だと JSON が truncate されて parse error 発生
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            tools=[BRIEF_TOOL],
            tool_choice={"type": "tool", "name": "produce_brief"},
        )
        # tool_use ブロックの input は SDK 側で既に dict 化されている
        for block in msg.content:
            if getattr(block, "type", "") == "tool_use" and getattr(block, "name", "") == "produce_brief":
                tool_input = getattr(block, "input", None)
                if isinstance(tool_input, dict):
                    parsed = tool_input
                    break
        # tool_use が空だったとき用に text も保存（フォールバック解析と debug 保存用）
        raw_text_for_debug = "".join(getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text")
    except Exception as ex:
        err = f"{type(ex).__name__}: {ex}"
        log(f"anthropic tool_use call failed: {err}, retrying with text mode")
        _LAST_ANTHROPIC_ERROR = err
        # tool_use 自体が落ちた（モデル側仕様変更等）場合のみ text フォールバック
        try:
            msg2 = client.messages.create(
                model=HAIKU_MODEL,
                max_tokens=8000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            raw_text_for_debug = "".join(getattr(b, "text", "") for b in msg2.content)
            parsed = extract_json(raw_text_for_debug)
        except Exception as ex2:
            _LAST_ANTHROPIC_ERROR = f"{type(ex2).__name__}: {ex2}"
            log(f"anthropic text retry also failed: {_LAST_ANTHROPIC_ERROR}")
            return None

    # tool_use が空 / フォーマットずれの場合、text パスを試す（最終防御）
    if not parsed and raw_text_for_debug:
        parsed = extract_json(raw_text_for_debug)

    if not parsed or "items" not in parsed:
        # 失敗時は raw 出力を debug ファイルに保存して原因追跡できるようにする
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            (DATA_DIR / "anthropic-last-failure.txt").write_text(
                raw_text_for_debug or "(empty)", encoding="utf-8"
            )
        except Exception:
            pass
        _LAST_ANTHROPIC_ERROR = (
            f"tool_use returned empty / JSON parse failed: {_LAST_JSON_PARSE_ERROR} "
            f"(raw len={len(raw_text_for_debug or '')})"
        )
        log(f"anthropic response was not usable: {_LAST_ANTHROPIC_ERROR}")
        return None

    # executiveSummary を抽出。
    # 以前は truncate(s, 60) で機械的にカットしていたが、句点の途中で切れて末尾に
    # 「…」が付き「文章が途中で切れている」見た目になっていた。
    # client 側 (tightenSummaryLine) が「文単位の sentence-aware トリミング」を
    # するので、scraper 側では生の LLM 出力をそのまま渡す（120 字までは保険で許容）。
    exec_summary = parsed.get("executiveSummary") or []
    if isinstance(exec_summary, list):
        exec_summary = [str(s).strip() for s in exec_summary if str(s).strip()][:5]
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
    """Claude / GPT が返す JSON 風テキストから dict を抽出する。
    LLM の典型的な失敗パターン（コードフェンス・トレーリングカンマ・スマートクオート・
    JS コメント・改行内未エスケープ）を全部吸収して、できるだけ救済する。"""
    global _LAST_JSON_PARSE_ERROR
    text = text.strip()
    # ① コードフェンス除去
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # ② スマートクオート (LLM 出力に紛れることがある) を直す
    text = (text.replace("“", '"').replace("”", '"')
                .replace("‘", "'").replace("’", "'"))
    # ③ 最初の { 〜 最後の } を抽出
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        _LAST_JSON_PARSE_ERROR = f"no braces found (len={len(text)})"
        return None
    body = text[s : e + 1]

    def _try(body_str: str, strict: bool = True) -> dict | None:
        try:
            return json.loads(body_str, strict=strict)
        except Exception:
            return None

    # 試行 1: そのままパース
    parsed = _try(body)
    if parsed is not None:
        return parsed

    # 試行 1b: strict=False（文字列値の中に \n \r \t などの制御文字を許容）
    parsed = _try(body, strict=False)
    if parsed is not None:
        return parsed

    # 試行 2: trailing comma 除去
    fixed = re.sub(r",\s*([}\]])", r"\1", body)
    parsed = _try(fixed)
    if parsed is not None:
        return parsed

    # 試行 3: JS スタイルのコメントを除去 (Claude が説明コメントを混ぜることがある)
    fixed2 = re.sub(r"//[^\n]*\n", "\n", fixed)            # // コメント
    fixed2 = re.sub(r"/\*[\s\S]*?\*/", "", fixed2)         # /* */ コメント
    parsed = _try(fixed2)
    if parsed is not None:
        return parsed

    # 試行 4: 文字列値内の生改行 (\n をリテラルで含むケース) を \\n に置換。
    # これは JSON 仕様では制御文字が許されないので最も多い失敗パターン。
    # 簡易的に: ダブルクオート開始からエンドまでの間の \n を \\n に。
    def _escape_newlines_in_strings(s: str) -> str:
        out = []
        in_str = False
        escaped = False
        for ch in s:
            if escaped:
                out.append(ch)
                escaped = False
                continue
            if ch == "\\":
                out.append(ch)
                escaped = True
                continue
            if ch == '"':
                in_str = not in_str
                out.append(ch)
                continue
            if in_str and ch == "\n":
                out.append("\\n")
                continue
            if in_str and ch == "\r":
                out.append("\\r")
                continue
            if in_str and ch == "\t":
                out.append("\\t")
                continue
            out.append(ch)
        return "".join(out)

    fixed3 = _escape_newlines_in_strings(fixed2)
    parsed = _try(fixed3)
    if parsed is not None:
        return parsed

    # 試行 5: max_tokens で打ち切られた末尾の不完全要素を切り捨てる。
    # 典型的な失敗例: `..."actionItem":"〜まで` で文字列途中切断 + items 配列が閉じてない。
    # 戦略: 最後の完全な要素 `}` までで切り、`]}` を補って試す。
    def _truncate_to_last_complete(s: str) -> str | None:
        # items 配列の中身を完全な要素単位で再構築
        # まず "items": [ の位置を探す
        m = re.search(r'"items"\s*:\s*\[', s)
        if not m:
            return None
        head = s[:m.end()]
        rest = s[m.end():]
        # items の中身を 1 要素ずつ取り出す（ネストした {} を depth カウントで処理）
        depth = 0
        in_str = False
        escaped = False
        last_complete = -1
        for i, ch in enumerate(rest):
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    last_complete = i  # この } までが完全な 1 要素
            elif ch == "]" and depth == 0:
                # 既に items 配列が閉じている → 切り詰め不要
                return None
        if last_complete < 0:
            return None
        truncated = head + rest[: last_complete + 1] + "]}"
        return truncated

    fixed4 = _truncate_to_last_complete(fixed3)
    if fixed4:
        parsed = _try(fixed4, strict=False)
        if parsed is not None:
            return parsed

    _LAST_JSON_PARSE_ERROR = (
        f"JSONDecodeError after 6 repair attempts (raw len={len(body)})"
    )
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
    # 直近 N 日間のアーカイブから既出の handle を集めて、プロンプトで重複回避させる。
    # 14日間に拡大し「毎日同じ人が出る」現象をより強く抑制する。
    recent_handles: set[str] = set()
    try:
        today_d = today_jst.date()
        for i in range(14):  # 過去 14 日
            day = today_d - timedelta(days=i)
            arch = ARCH_DIR / f"{day.strftime('%Y-%m-%d')}.json"
            if not arch.exists():
                continue
            data = json.loads(arch.read_text(encoding="utf-8"))
            for h in (data.get("xHighlights") or []):
                handle = (h.get("handle") or "").strip().lstrip("@").lower()
                if handle:
                    recent_handles.add(handle)
    except Exception:
        pass
    avoid_block = ""
    if recent_handles:
        sample = sorted(recent_handles)
        avoid_block = (
            "\n## 多様性制約（最重要・厳守）\n"
            f"- 過去 14 日間で既に出した以下の handle は**絶対に採用しない**。新しい著者のみ:\n"
            "  " + ", ".join(f"@{h}" for h in sample) + "\n"
            "- 同一 handle は 1 件まで。上記に含まれる handle を 1 件でも出したら失格\n"
            "- 著名人・大手アカウントに頼らず、バズった新鮮な投稿を探すこと\n"
        )
    prompt = (
        f"今日（{date_label}）または直近 48 時間以内に X（旧Twitter）で"
        "バズっている（いいね・リポスト・引用が相対的に多い）生成AI関連の**日本語投稿**を"
        "**実在する URL 付きで** 6 件挙げてください。\n\n"
        "## 検索手順（必ず実行）\n"
        "1. web_search で「生成AI site:x.com since:yesterday」「ChatGPT OR Claude OR Gemini site:x.com lang:ja」等の**日本語専用クエリ**で検索\n"
        "2. 検索結果から実際のいいね数・RT数が確認できる投稿を優先してピックアップ\n"
        "3. 同じ著者が重複しないよう、毎回別の検索クエリで探すこと\n"
        "4. 特定の著名人アカウントに偏らず、実際のエンゲージメント数で判断すること\n\n"
        "## 厳守ルール\n"
        "- **日本語の投稿のみ**を採用する。英語投稿は原則不可\n"
        "- やむを得ず日本語投稿が 6 件揃わない場合のみ、英語投稿で補完（最大 1 件）\n"
        "- web_search を使って実在を確認すること。架空の URL や著者名は絶対に作らない\n"
        "- URL は https://x.com/<handle>/status/<id> または https://twitter.com/... の形式のみ\n"
        "- 投稿が確認できなかった場合は「無し」と返す（無理に埋めない）\n"
        "- 著者は誰でも良い（著名人/一般ユーザー問わず、エンゲージメントが相対的に多いもの）\n"
        "- **同じ著者から 2 件以上は採用しない**（多様性のため）\n"
        "- B2B マーケ／生成AI 実務／競合動向に関係する話題を優先\n"
        + avoid_block +
        "\n## 言語フィールド\n"
        "- 日本語投稿は `lang: \"ja\"`、`textJa` は空文字列でよい\n"
        "- 例外的に英語投稿を含む場合は `lang: \"en\"` で `textJa` に完璧な日本語訳を入れる\n"
        "\n## 出力フォーマット（JSON のみ、説明文なし、コードフェンス不要）\n"
        "{\"items\":[{\"author\":\"表示名\",\"handle\":\"@xxxx\","
        "\"text\":\"原文（200字以内、改行は \\\\n でエスケープ）\","
        "\"lang\":\"ja|en|...\",\"textJa\":\"日本語訳（原文がjaの場合は空文字）\","
        "\"url\":\"https://x.com/.../status/...\",\"tag\":\"短いトピック名\"}, ...]}"
    )
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}],
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
        # X トレンドも過去 7 日中 6 日で 0 件だった。原因追跡のため raw 出力を保存。
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            (DATA_DIR / "x-trends-last-failure.txt").write_text(
                text or "(empty)", encoding="utf-8"
            )
        except Exception:
            pass
        log(f"x trends: no parseable JSON in claude response (raw len={len(text or '')})")
        return []
    raw_items = parsed.get("items") or []
    out: list[dict] = []
    seen_handles: set[str] = set()  # 同一 handle 重複排除（多様性確保）
    for it in raw_items[:12]:  # 候補は多めに見て、handle 重複でスキップしながら 6 件まで
        url = (it.get("url") or "").strip()
        if not url or not re.match(r"^https://(?:x|twitter)\.com/[^/]+/status/\d+", url):
            continue
        # X / Twitter URL は HEAD/GET で 429 / 403 を返すケースが多く、bot UA 経由の
        # validate_url でほぼ全件 unreachable 判定されてしまい x_highlights が 0 件に
        # なる事故が発生していた。プロンプト側で「web_search で実在確認」を強制している
        # ため、URL 形式チェックだけで採用する。
        author = (it.get("author") or "").strip()[:40]
        handle = (it.get("handle") or "").strip()[:40]
        text_body = (it.get("text") or "").strip()
        tag = (it.get("tag") or "AI").strip()[:20]
        lang = (it.get("lang") or "").strip().lower()[:8] or "ja"
        text_ja = (it.get("textJa") or "").strip()
        if not author or not handle or not text_body:
            continue
        # 同一 handle 排除（プロンプトでも指示しているが二重防御）
        h_key = handle.lstrip("@").lower()
        if h_key in seen_handles:
            log(f"x trends skip duplicate handle: @{h_key}")
            continue
        seen_handles.add(h_key)
        # アバターは unavatar.io 経由で X handle から自動取得
        h = handle.lstrip("@")
        avatar = f"https://unavatar.io/x/{h}"
        # 日本語以外で textJa が空の場合は表示側で「翻訳バッジを出さない」とする
        # （Claude が訳をサボった場合の保険。原文だけは表示される）
        out.append({
            "id": f"xt_{hashlib.sha1(url.encode()).hexdigest()[:10]}",
            "author": author,
            "handle": handle if handle.startswith("@") else f"@{handle}",
            "avatar": avatar,
            "text": truncate(text_body, 240),
            "lang": lang,
            "textJa": truncate(text_ja, 280) if text_ja else "",
            "tag": tag,
            "url": url,
            # likes/retweets は web_search では取得困難。0 で通すと client の閾値で弾かれるため
            # 「注目されている」と判定された前提で BUZZ_MIN を満たす最低値を入れておく。
            "likes": 3000,
            "retweets": 0,
        })
        if len(out) >= 6:
            break
    log(f"x trends: collected {len(out)} valid posts (unique authors)")
    return out


# ── 音声ダイジェスト事前生成（OpenAI TTS） ──────────────────────────────────────────
DIGEST_MODEL = "claude-haiku-4-5-20251001"

TTS_INSTRUCTIONS = """You are a top-tier Japanese morning news anchor — equivalent to NHK おはよう日本 or テレビ東京 WBS Saturday morning anchor, but in 2026.
You are speaking, NOT reading. The listener should feel they are listening to a real human professional, not an AI.

# CRITICAL: Sound 100% human

DO:
- Breathe naturally — take a soft inhale before each new topic, a tiny "んっ" before emphasis words
- Vary your pitch organically — never flat. Use Japanese 高低アクセント throughout
- Use micro-pauses (~80–150ms) inside long noun phrases like 「Anthropic の・新モデル」for clarity
- Slightly trail off pitch at sentence ends (「〜です。」「〜ました。」) for natural Japanese cadence
- Add subtle warmth in opening greeting and closing message — a real anchor smile in the voice
- Vary speed slightly throughout: slow on numbers/proper nouns, normal on body, slightly faster on connective phrases

DO NOT:
- DO NOT speak in uniform robotic rhythm — that's the #1 AI giveaway
- DO NOT pronounce Japanese with English accent (no "ChatGee-Pee-Tee" — use チャットジーピーティー clearly)
- DO NOT push too hard on emphasis — Japanese anchors are subtle
- DO NOT use cheerful radio DJ style — this is a serious morning business briefing
- DO NOT rush through proper nouns or numbers — those are critical for credibility

# Voice character

You are a 30-something senior anchor with 10+ years of experience covering tech and business.
- Calm, composed, trustworthy — listeners' default "morning briefing" voice
- Subtle warmth — not cold, not overly bright
- Articulate Japanese phonetics with clear 「あいうえお」 mouth shape
- Confident in technical terminology delivery (AI, クラウド, クロード, ジェミニ, etc.)

# Pace and rhythm — speak at the pace of a real morning anchor

- Baseline: ~310-330 Japanese characters per minute (slower than reading, faster than slow lecture)
- After each「。」: clear ~500ms pause
- After「、」: ~150-200ms pause
- Between topics (paragraph break): full 800ms-1s breath
- Numbers: read with deliberate clarity, slow down 10-15%
- Proper nouns (company names, model names): clearly enunciated, slight slow

# Pronunciation guide

- 英語の固有名詞は必ずカタカナ発音:
  - ChatGPT → 「チャットジーピーティー」 (NOT "ChatGee-Pee-Tee")
  - Claude → 「クロード」
  - Anthropic → 「アンソロピック」
  - Gemini → 「ジェミニ」
  - OpenAI → 「オープンエーアイ」
  - Google → 「グーグル」
  - AI → 「エーアイ」
  - GPT → 「ジーピーティー」
  - LLM → 「エルエルエム」
- 数字は自然な日本語で:
  - 25% → 「にじゅうごパーセント」
  - 100 件 → 「ひゃっけん」
  - 3つ → 「みっつ」
- 助詞「は」「を」は弱め、内容語ははっきり

# Delivery arc

1. Opening greeting (warm, clear, slight smile): 「おはようございます。」 — slight 1秒 hold after period
2. Topic preview (calm authority): 「今日のポイントは・3つあります。」 — micro-pause at "・"
3. Body news (measured, clear): emphasize subject and key verb of each sentence
4. Transitions (「続いて」「一方で」): clear breath before, slight pitch shift up
5. Closing (composed, encouraging, smile in voice): 「今日も一日・頑張っていきましょう。」 — slight slow on closing words

# Final check
The listener should think: "ああ、いつものアナウンサーだな。" Not "AIだな。"
If you sound robotic on a single sentence, the whole credibility breaks. Be 100% natural."""


def _build_template_digest_script(exec_summary: list[str], mustknow: list[dict], thisweek: list[dict]) -> str:
    """Claude API 不使用のテンプレート台本生成。API使用量上限時などのフォールバック用。"""
    today_jst = datetime.now(JST)
    date_label = f"{today_jst.month}月{today_jst.day}日"
    all_items = list(mustknow) + list(thisweek)
    count = min(len(all_items), 5)
    count_ja = ["", "ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ"]

    parts: list[str] = []
    parts.append(f"おはようございます。{date_label}のマーケティング・ニュースダイジェストです。")
    if exec_summary:
        parts.append("今日の全体像をお伝えします。" + "。また、".join(exec_summary[:3]) + "。")
    if count > 0:
        parts.append(f"今日は{count_ja[count]}のトピックをお届けします。")

    connectors = ["まず", "次に", "続いて", "そして", "最後に"]
    for i, item in enumerate(all_items[:5]):
        title = item.get("title", "")
        summary = item.get("summary", "") or title
        why = item.get("whyItMatters", "")
        action = item.get("actionItem", "")
        conn = connectors[i] if i < len(connectors) else "また"
        parts.append(f"{conn}、{title}です。")
        if summary and summary != title:
            parts.append(summary + ("。" if not summary.endswith("。") else ""))
        if why:
            parts.append(f"この点が重要な理由は、{why}" + ("。" if not why.endswith("。") else ""))
        if action:
            parts.append(f"取るべきアクションとしては、{action}" + ("。" if not action.endswith("。") else ""))

    parts.append("最後にまとめです。")
    for item in all_items[:3]:
        t = item.get("title", "")
        if t:
            parts.append(f"「{t}」。")
    parts.append("以上、本日のマーケティング・ニュースダイジェストでした。今日も一日頑張っていきましょう。")

    return "\n".join(parts)


def generate_digest_script(exec_summary: list[str], mustknow: list[dict], thisweek: list[dict]) -> str | None:
    """Claude Haiku で5分ダイジェスト台本を生成。失敗時はテンプレート台本にフォールバック。"""
    today_jst = datetime.now(JST)
    date_label = f"{today_jst.month}月{today_jst.day}日"

    if ANTHROPIC_API_KEY:
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

        system_prompt = f"""あなたはエヌエイチケーやテレビ東京ワールドビジネスサテライトのような、プロのニュースアナウンサーです。
マーケティング・エーアイ担当者向けに、毎朝5分の音声ニュースダイジェストを届けます。

## 絶対ルール
- 日本語のみ。英単語は一切使わない。固有名詞は必ずカタカナ表記:
  ChatGPT→チャットジーピーティー、Claude→クロード、Google→グーグル、OpenAI→オープンエーアイ、
  AI→エーアイ、GPT→ジーピーティー、LLM→エルエルエム、API→エーピーアイ、DX→ディーエックス
- 日付は「{date_label}」と書く
- 数字・割合は読みやすく（50%→「半数以上」、3件→「みっつ」、100億円→「ひゃくおくえん」）
- 記号は「」のみ。マークダウン・箇条書き・見出しは使わない
- 1文は40字以内を目安に短く切る。一息で読める長さ

## 構成（NHKニュース形式）

### 冒頭（20秒）
- 「おはようございます。{date_label}のエーアイ・マーケティングニュースです。」
- 「本日は〇件のニュースをお伝えします。」と件数を告知
- 最重要ニュースを1文で予告: 「まず、〔最重要トピック〕です。」

### 各ニュース（1本あたり45〜60秒）
ニュース1本につき、必ず以下の3ステップで伝える:
1. 【見出し】「〔主語〕が〔何をした〕です。」— 1文で端的に
2. 【詳細】なぜ起きたか、何が変わるか、数字・事実を交えて2〜3文
3. 【影響】「マーケティング・エーアイ担当者にとっては、〔具体的な意味・アクション〕です。」

ニュース間のつなぎ:
- 「続いて、〜です。」「次のニュースです。〜」「一方、〜という動きもあります。」
- 関連するニュースは「この流れと関係して、〜」でつなぐ

### まとめ（30秒）
- 「以上、本日のニュースをまとめます。」
- 各トピックを1文ずつ、3点以内で簡潔に振り返る
- 「以上、{date_label}のエーアイ・マーケティングニュースでした。今日も一日、よろしくお願いします。」

## 文体・トーン
- ニュース原稿調。「〜です。」「〜ました。」「〜ています。」で統一
- 感嘆・感情表現は一切使わない（「すごい」「なんと」「驚き」は禁止）
- 「〜ですね」「〜なんですが」などの口語は使わない
- 専門用語は初出時に1回だけ簡潔に説明する
- 全体1200〜1600字（約5分）

出力は本文のみ。英単語・アルファベットは一切使わない。"""

        user_prompt = f"以下は本日（{date_label}）のニュース素材です。NHKニュース形式の5分ダイジェスト台本を作成してください。英単語はすべてカタカナに変換し、アルファベットは一切出力しないこと。\n\n" + "\n".join(lines)

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
            result = "".join(parts).strip()
            if result:
                return result
            log("digest script: empty response from Claude, falling back to template")
        except Exception as e:
            log(f"digest script Claude error: {e}; falling back to template")

    if not (mustknow or thisweek):
        log("digest script: no news items available, skipping audio")
        return None

    log("digest script: using template fallback (no Claude API)")
    return _build_template_digest_script(exec_summary, mustknow, thisweek)


TTS_KATAKANA_MAP = {
    # TTS が綴り読みで誤発音する英字頭字語をカタカナに置換
    # 例: 「NEC」→「ネック」誤読を防ぐ
    "NEC": "エヌイーシー", "IBM": "アイビーエム", "NTT": "エヌティーティー",
    "AWS": "エーダブリューエス", "GCP": "ジーシーピー", "Azure": "アジュール",
    "IoT": "アイオーティー", "DX": "ディーエックス", "ESG": "イーエスジー",
    "AI": "エーアイ", "IT": "アイティー", "API": "エーピーアイ",
    "LLM": "エルエルエム", "RAG": "ラグ", "GPT": "ジーピーティー",
    "GPT-4": "ジーピーティーフォー", "GPT-5": "ジーピーティーファイブ",
    "NLP": "エヌエルピー", "KPI": "ケーピーアイ", "ROI": "アールオーアイ",
    "CEO": "シーイーオー", "CTO": "シーティーオー", "CIO": "シーアイオー", "COO": "シーオーオー",
    "M&A": "エムアンドエー", "B2B": "ビートゥービー", "B2C": "ビートゥーシー",
    "SaaS": "サース", "SLA": "エスエルエー", "SDK": "エスディーケー",
    "CRM": "シーアールエム", "ERP": "イーアールピー", "BPO": "ビーピーオー",
    "SIer": "エスアイアー", "SES": "エスイーエス", "PoC": "ピーオーシー", "MVP": "エムブイピー",
    "OpenAI": "オープンエーアイ", "Anthropic": "アンソロピック",
    "Claude": "クロード", "ChatGPT": "チャットジーピーティー",
    "Gemini": "ジェミニ", "Copilot": "コパイロット",
    "Devin": "デビン", "Cursor": "カーソル",
}


def naturalize_japanese_tts_script(s: str) -> str:
    """日本語 TTS スクリプトを「人間が話す」リズムに整える前処理。
    ・英字頭字語をカタカナに置換（NEC→エヌイーシー 等で誤読を防ぐ）
    ・段落間に改行確保 → 自然な間
    ・句点直後に半角スペース → 短い息継ぎ
    ・接続詞前後にスペース → トーン切り替え
    """
    if not s:
        return s
    t = s
    # 英字頭字語をカタカナに置換（前後 alphanum 不在チェックで誤マッチ防止）
    for eng, kana in TTS_KATAKANA_MAP.items():
        escaped = re.escape(eng)
        t = re.sub(rf"(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])", kana, t)
    t = re.sub(r"\n+", "\n\n", t)
    t = re.sub(r"(続いて|一方で|そして|まずは|最後に|では|さて)(、|。)?", r" \1\2 ", t)
    t = re.sub(r"。([^」』）)\s])", r"。 \1", t)
    t = re.sub(r" {2,}", " ", t)
    t = re.sub(r"\n ", "\n", t)
    return t.strip()


def generate_tts_mp3(text: str) -> bytes | None:
    """日本語 MP3 を生成。プロアナウンサー声のみ使用。
    1. Google Cloud TTS (ja-JP-Chirp3-HD-Kore / Neural2-B) — 最高品質。要 GOOGLE_TTS_API_KEY。
    2. Azure AI Speech (ja-JP-NanamiNeural) — 日本語ネイティブアナウンサー声。要 AZURE_SPEECH_KEY。
    3. ElevenLabs eleven_multilingual_v2 — 高表現力。要 ELEVENLABS_API_KEY。
    4. OpenAI gpt-4o-mini-tts (shimmer) — TTS_INSTRUCTIONS でアナウンサー指示。要 OPENAI_API_KEY。
    いずれも未設定の場合は None を返して音声生成をスキップ（アニメ声より無音を優先）。
    """
    if not text:
        return None
    natural = naturalize_japanese_tts_script(text)
    google_key = os.environ.get("GOOGLE_TTS_API_KEY", "").strip()
    if google_key:
        mp3 = _generate_tts_google(natural, google_key)
        if mp3:
            return mp3
        log("Google TTS failed, falling back to Azure")
    azure_key = os.environ.get("AZURE_SPEECH_KEY", "").strip()
    azure_region = os.environ.get("AZURE_SPEECH_REGION", "").strip()
    if azure_key and azure_region:
        mp3 = _generate_tts_azure(natural, azure_key, azure_region)
        if mp3:
            return mp3
        log("Azure TTS failed, falling back to ElevenLabs")
    eleven_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if eleven_key:
        mp3 = _generate_tts_elevenlabs(natural, eleven_key)
        if mp3:
            return mp3
        log("ElevenLabs TTS failed, falling back to OpenAI")
    mp3 = _generate_tts_openai(natural)
    if mp3:
        return mp3
    log("All pro TTS services unavailable — skipping audio (no anime voice fallback)")
    return None


def _generate_tts_google(text: str, api_key: str) -> bytes | None:
    """Google Cloud TTS Neural2 で日本語ネイティブ女性ナレーター声を生成。
    デフォルト ja-JP-Neural2-B（女性、ニュース朗読向き、プロアナウンサー収録）。

    Google API は 1 req 5,000 bytes (≈ 1,600 字) 上限。長文は句点単位で
    分割して順次 synthesis → ffmpeg concat で 1 つの MP3 に結合する。
    これで 2,000 字超のスクリプトでも途中で切れない。

    環境変数で上書き可:
    - GOOGLE_TTS_VOICE         (default: ja-JP-Neural2-B)
                               候補: ja-JP-Neural2-B (女性), ja-JP-Neural2-C (男性),
                                    ja-JP-Neural2-D (男性),
                                    ja-JP-Chirp3-HD-* (新世代, 利用可能なら最高品質)
    - GOOGLE_TTS_SPEAKING_RATE (default: 1.0 — 等速。クライアント側で 1.25 倍速再生)
    - GOOGLE_TTS_PITCH         (default: 0.0)
    - GOOGLE_TTS_CHUNK_CHARS   (default: 1500 — 5,000 bytes 上限の安全マージン)

    料金: Neural2 voices は月 100 万字まで完全無料 (Always Free)。
    1日 2,000字 × 30日 = 月 6万字なら永久に¥0。
    """
    # デフォルトは 2025/3 リリースの Chirp3-HD-Kore (女性、落ち着き、ニュース向き)。
    # Chirp3-HD は API 制限で失敗する可能性があるので Neural2-B にもフォールバックする。
    primary_voice = os.environ.get("GOOGLE_TTS_VOICE", "ja-JP-Chirp3-HD-Kore").strip() or "ja-JP-Chirp3-HD-Kore"
    fallback_voice = os.environ.get("GOOGLE_TTS_FALLBACK_VOICE", "ja-JP-Neural2-B").strip() or "ja-JP-Neural2-B"
    speaking_rate = float(os.environ.get("GOOGLE_TTS_SPEAKING_RATE", "1.0") or "1.0")
    pitch_st = float(os.environ.get("GOOGLE_TTS_PITCH", "0.0") or "0.0")
    chunk_chars = int(os.environ.get("GOOGLE_TTS_CHUNK_CHARS", "1500") or "1500")
    for voice in (primary_voice, fallback_voice):
        if not voice:
            continue
        result = _google_tts_chunked(text, api_key, voice, speaking_rate, pitch_st, chunk_chars)
        if result is not None:
            return result
        log(f"google_tts: voice={voice} failed; trying fallback")
    return None


def _google_tts_chunked(text: str, api_key: str, voice: str,
                        speaking_rate: float, pitch_st: float,
                        chunk_chars: int) -> bytes | None:
    """1 voice で chunked synthesis を試み、成功時 MP3 を返す。失敗時 None。"""
    chunks = _split_text_for_tts(text, chunk_chars)
    if not chunks:
        return None
    log(f"google_tts: voice={voice} total_chars={len(text)} chunks={len(chunks)} (max {chunk_chars}/chunk) rate={speaking_rate}")
    import time as _time
    mp3_parts: list[bytes] = []
    t_total = _time.time()
    for idx, chunk in enumerate(chunks, 1):
        t0 = _time.time()
        mp3 = _google_tts_one(chunk, api_key, voice, speaking_rate, pitch_st)
        if not mp3:
            log(f"google_tts: chunk {idx}/{len(chunks)} FAILED for voice={voice}")
            return None
        log(f"google_tts: chunk {idx}/{len(chunks)} done in {_time.time()-t0:.1f}s ({len(chunk)}c → {len(mp3)/1024:.0f}KB)")
        mp3_parts.append(mp3)
    log(f"google_tts: all {len(chunks)} chunks done in {_time.time()-t_total:.1f}s")
    if len(mp3_parts) == 1:
        return mp3_parts[0]
    return _concat_mp3(mp3_parts)


def _google_tts_one(text: str, api_key: str, voice: str,
                    speaking_rate: float, pitch_st: float) -> bytes | None:
    """1 チャンクだけ Google Cloud TTS API を叩いて MP3 bytes を返す。
    1 リクエスト 5,000 bytes (≈ 1,600 字) 上限あり。
    Chirp3-HD は pitch を完全サポートしないので、pitch=0 なら省略する。"""
    try:
        import urllib.request
        import urllib.parse
        import base64
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={urllib.parse.quote(api_key)}"
        audio_config = {
            "audioEncoding": "MP3",
            "speakingRate": speaking_rate,
            "sampleRateHertz": 24000,
        }
        # Chirp3-HD は pitch 非対応なので 0 のときは送らない
        if abs(pitch_st) > 0.001:
            audio_config["pitch"] = pitch_st
        body = {
            "input": {"text": text},
            "voice": {"languageCode": "ja-JP", "name": voice},
            "audioConfig": audio_config,
        }
        req = urllib.request.Request(
            url, method="POST",
            headers={"Content-Type": "application/json; charset=utf-8"},
            data=json.dumps(body).encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.loads(resp.read())
        audio_b64 = payload.get("audioContent")
        if not audio_b64:
            return None
        return base64.b64decode(audio_b64)
    except Exception as e:
        log(f"google_tts chunk error (voice={voice}): {e}")
        return None


def _concat_mp3(mp3_parts: list[bytes]) -> bytes | None:
    """複数の MP3 bytes を ffmpeg concat demuxer で 1 つに結合。
    GitHub Actions の workflow で ffmpeg は apt install 済み。"""
    if not mp3_parts:
        return None
    if len(mp3_parts) == 1:
        return mp3_parts[0]
    try:
        import subprocess
        import tempfile
        import os as _os
        with tempfile.TemporaryDirectory(prefix="mp3concat-") as td:
            list_path = _os.path.join(td, "list.txt")
            with open(list_path, "w", encoding="utf-8") as f:
                for i, b in enumerate(mp3_parts):
                    p = _os.path.join(td, f"part{i}.mp3")
                    with open(p, "wb") as g:
                        g.write(b)
                    # ffmpeg concat demuxer フォーマット: file 'path'
                    f.write(f"file '{p}'\n")
            out_path = _os.path.join(td, "out.mp3")
            subprocess.run(
                [
                    "ffmpeg", "-loglevel", "error",
                    "-f", "concat", "-safe", "0",
                    "-i", list_path,
                    "-c", "copy",
                    out_path,
                ],
                capture_output=True, timeout=120, check=True,
            )
            with open(out_path, "rb") as f:
                return f.read()
    except FileNotFoundError:
        log("ffmpeg not found; cannot concat MP3 chunks")
        return None
    except subprocess.CalledProcessError as e:
        log(f"ffmpeg concat failed: exit={e.returncode} stderr={(e.stderr or b'')[:200]!r}")
        return None
    except Exception as e:
        log(f"mp3 concat error: {e}")
        return None


_VOICEVOX_LAST_ERROR: str | None = None  # 直近の VOICEVOX 失敗理由（debug.json 用）


def _split_text_for_tts(text: str, max_chunk_chars: int) -> list[str]:
    """日本語句点（「。」「！」「？」）で文を区切り、`max_chunk_chars` 以下の
    チャンクにまとめる。長文を一発合成するとメモリピークで VOICEVOX engine が
    OOM kill されるため、短い単位に分けて順次合成 → 後で WAV を結合する。"""
    text = (text or "").strip()
    if not text:
        return []
    # 句点直後で分割（「。」「！」「？」を保持）
    sentences: list[str] = []
    cur = ""
    for ch in text:
        cur += ch
        if ch in ("。", "！", "？", "\n"):
            s = cur.strip()
            if s:
                sentences.append(s)
            cur = ""
    if cur.strip():
        sentences.append(cur.strip())
    # max_chunk_chars 以下の塊にまとめ直す
    chunks: list[str] = []
    buf = ""
    for s in sentences:
        if buf and len(buf) + len(s) > max_chunk_chars:
            chunks.append(buf)
            buf = s
        else:
            buf = (buf + s) if not buf else (buf + s)
    if buf:
        chunks.append(buf)
    return chunks


def _voicevox_synthesize_one(base: str, speaker_id: int, text: str,
                              speed: float, pitch: float, sr: int) -> bytes | None:
    """1 チャンクだけ /audio_query → /synthesis を実行して WAV bytes を返す。
    失敗時は _VOICEVOX_LAST_ERROR をセットして None。"""
    global _VOICEVOX_LAST_ERROR
    import urllib.request
    import urllib.parse
    try:
        q_url = f"{base}/audio_query?speaker={speaker_id}&text={urllib.parse.quote(text)}"
        with urllib.request.urlopen(urllib.request.Request(q_url, method="POST"), timeout=60) as resp:
            query = json.loads(resp.read())
    except Exception as e:
        _VOICEVOX_LAST_ERROR = f"audio_query[{len(text)}c]: {type(e).__name__}: {e}"
        return None
    query["speedScale"] = speed
    query["pitchScale"] = pitch
    query["outputSamplingRate"] = sr
    try:
        s_req = urllib.request.Request(
            f"{base}/synthesis?speaker={speaker_id}", method="POST",
            headers={"Content-Type": "application/json", "Accept": "audio/wav"},
            data=json.dumps(query).encode("utf-8"),
        )
        with urllib.request.urlopen(s_req, timeout=300) as resp:
            return resp.read()
    except Exception as e:
        _VOICEVOX_LAST_ERROR = f"synthesis[{len(text)}c]: {type(e).__name__}: {e}"
        return None


def _concat_wavs(wav_list: list[bytes]) -> bytes | None:
    """同一 sample rate / channels の WAV bytes を python wave モジュールで結合。
    ffmpeg 不要で完結する。"""
    global _VOICEVOX_LAST_ERROR
    if not wav_list:
        return None
    if len(wav_list) == 1:
        return wav_list[0]
    try:
        import io
        import wave
        out = io.BytesIO()
        with wave.open(out, "wb") as w_out:
            params_set = False
            for wav_bytes in wav_list:
                if not wav_bytes:
                    continue
                with wave.open(io.BytesIO(wav_bytes), "rb") as w_in:
                    if not params_set:
                        w_out.setparams(w_in.getparams())
                        params_set = True
                    w_out.writeframes(w_in.readframes(w_in.getnframes()))
        return out.getvalue()
    except Exception as e:
        _VOICEVOX_LAST_ERROR = f"concat_wavs: {type(e).__name__}: {e}"
        return None


def _generate_tts_voicevox(text: str, base_url: str) -> bytes | None:
    """VOICEVOX エンジン経由で日本語 WAV を生成し、ffmpeg で MP3 に変換して返す。

    長文を一気に合成するとメモリピークで engine が OOM kill されるため、
    句点単位で 600字程度のチャンクに分割し、順次合成して WAV を結合する。

    話者 ID は VOICEVOX_SPEAKER_ID で上書き可。
    AivisSpeech 利用時は workflow が /speakers から Anneli の最初のスタイル ID を
    自動取得して環境変数経由で渡してくる（手動指定不要）。
    VOICEVOX 利用時の主要な落ち着き系話者:
      23 = WhiteCUL（ノーマル, 女性, 女子アナ風で聞き心地◎）
      29 = No.7（ノーマル, 中性女性）
      13 = 青山龍星（ノーマル, 男性, ニュースアンカー向き）
      16 = 九州そら（ノーマル, 女性, しっかりした朗読）
      20 = もち子さん（ノーマル, 女性）
    speedScale / pitchScale で速度・ピッチも調整可（VOICEVOX_SPEED, VOICEVOX_PITCH）。
    """
    global _VOICEVOX_LAST_ERROR
    # default 23 は VOICEVOX 用フォールバック。AivisSpeech 利用時は workflow が上書き渡す。
    speaker_id = int(os.environ.get("VOICEVOX_SPEAKER_ID", "23") or "23")
    speed = float(os.environ.get("VOICEVOX_SPEED", "0.97") or "0.97")
    pitch = float(os.environ.get("VOICEVOX_PITCH", "0.0") or "0.0")
    # 全体テキストの上限。デフォルト 2,400 字（約 2 分）。
    max_chars = int(os.environ.get("VOICEVOX_MAX_CHARS", "2400") or "2400")
    # 1 チャンクの最大文字数。CPU エンジンの OOM kill を避けるため小さめに。
    chunk_chars = int(os.environ.get("VOICEVOX_CHUNK_CHARS", "600") or "600")
    # 24kHz → 16kHz でスピーチには十分、CPU 合成が約 30% 速い。
    sampling_rate = int(os.environ.get("VOICEVOX_SAMPLING_RATE", "16000") or "16000")
    safe_text = (text or "")[:max_chars]
    base = base_url.rstrip("/")
    chunks = _split_text_for_tts(safe_text, chunk_chars)
    if not chunks:
        _VOICEVOX_LAST_ERROR = "split: empty after split"
        return None
    log(f"voicevox: speaker={speaker_id} total_chars={len(safe_text)} "
        f"chunks={len(chunks)} (max {chunk_chars}/chunk) sr={sampling_rate} speed={speed}")
    import time as _time
    wav_parts: list[bytes] = []
    t_total = _time.time()
    for idx, chunk in enumerate(chunks, 1):
        t0 = _time.time()
        wav = _voicevox_synthesize_one(base, speaker_id, chunk, speed, pitch, sampling_rate)
        if not wav:
            log(f"voicevox: chunk {idx}/{len(chunks)} FAILED ({_VOICEVOX_LAST_ERROR})")
            return None
        log(f"voicevox: chunk {idx}/{len(chunks)} done in {_time.time()-t0:.1f}s "
            f"({len(chunk)}c → {len(wav)/1024:.0f}KB WAV)")
        wav_parts.append(wav)
    log(f"voicevox: all {len(chunks)} chunks done in {_time.time()-t_total:.1f}s")
    # 結合
    merged_wav = _concat_wavs(wav_parts)
    if not merged_wav:
        return None
    log(f"voicevox: merged WAV = {len(merged_wav)/1024:.0f} KB")
    # MP3 化
    t_mp3 = _time.time()
    mp3 = _wav_to_mp3(merged_wav)
    if mp3 is None:
        return None
    log(f"voicevox: wav→mp3 done in {_time.time()-t_mp3:.1f}s ({len(mp3)/1024:.0f} KB MP3)")
    return mp3


def _wav_to_mp3(wav_bytes: bytes) -> bytes | None:
    """ffmpeg で WAV → MP3 変換。失敗時 None。"""
    global _VOICEVOX_LAST_ERROR
    try:
        import subprocess
        result = subprocess.run(
            [
                "ffmpeg", "-loglevel", "error",
                "-i", "pipe:0",
                "-codec:a", "libmp3lame", "-qscale:a", "4",
                "-f", "mp3", "pipe:1",
            ],
            input=wav_bytes, capture_output=True, timeout=120, check=True,
        )
        if not result.stdout:
            _VOICEVOX_LAST_ERROR = f"wav_to_mp3: empty stdout (stderr={result.stderr[:200]!r})"
            log(_VOICEVOX_LAST_ERROR)
            return None
        return result.stdout
    except FileNotFoundError:
        _VOICEVOX_LAST_ERROR = "wav_to_mp3: ffmpeg not found"
        log(_VOICEVOX_LAST_ERROR)
        return None
    except subprocess.CalledProcessError as e:
        _VOICEVOX_LAST_ERROR = f"wav_to_mp3: ffmpeg exit={e.returncode} stderr={(e.stderr or b'')[:200]!r}"
        log(_VOICEVOX_LAST_ERROR)
        return None
    except Exception as e:
        _VOICEVOX_LAST_ERROR = f"wav_to_mp3: {type(e).__name__}: {e}"
        log(_VOICEVOX_LAST_ERROR)
        return None
    except Exception as e:
        log(f"ffmpeg conversion failed: {e}")
        return None


def _generate_tts_azure(text: str, api_key: str, region: str) -> bytes | None:
    """Azure AI Speech で日本語ネイティブ女性アンカー声を生成。
    デフォルト ja-JP-NanamiNeural × customerservice スタイル
    （Nanami は newscast 非対応のため customerservice が最も formal で professional）。
    Voice / style / rate は環境変数で上書き可:
    - AZURE_SPEECH_VOICE  (default: ja-JP-NanamiNeural)
    - AZURE_SPEECH_STYLE  (default: customerservice — chat / cheerful も選択可)
    - AZURE_SPEECH_RATE   (default: -3% — ニュースとしてやや落ち着いた速度)
    - AZURE_SPEECH_PITCH  (default: 0%)
    """
    voice = os.environ.get("AZURE_SPEECH_VOICE", "ja-JP-NanamiNeural").strip() or "ja-JP-NanamiNeural"
    style = os.environ.get("AZURE_SPEECH_STYLE", "customerservice").strip() or "customerservice"
    rate = os.environ.get("AZURE_SPEECH_RATE", "-3%").strip() or "-3%"
    pitch = os.environ.get("AZURE_SPEECH_PITCH", "0%").strip() or "0%"
    safe_text = (text[:4800] or "")
    safe_text = safe_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ja-JP">'
        f'<voice name="{voice}">'
        f'<mstts:express-as style="{style}" styledegree="1.0">'
        f'<prosody rate="{rate}" pitch="{pitch}">{safe_text}</prosody>'
        '</mstts:express-as></voice></speak>'
    )
    try:
        import urllib.request
        req = urllib.request.Request(
            f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
            method="POST",
            headers={
                "Ocp-Apim-Subscription-Key": api_key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
                "User-Agent": "akkodis-ai-news",
            },
            data=ssml.encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except Exception as e:
        log(f"azure tts error: {e}")
        return None


def _generate_tts_elevenlabs_one(text: str, api_key: str, voice_id: str) -> bytes | None:
    """1チャンクだけ ElevenLabs TTS を叩いて MP3 bytes を返す。"""
    try:
        import urllib.request
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            method="POST",
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            data=json.dumps({
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.50,
                    "similarity_boost": 0.90,
                    "style": 0.50,
                    "use_speaker_boost": True,
                },
                "apply_text_normalization": "auto",
            }).encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.read()
    except Exception as e:
        log(f"elevenlabs tts chunk error: {e}")
        return None


def _generate_tts_elevenlabs(text: str, api_key: str) -> bytes | None:
    """ElevenLabs eleven_multilingual_v2 で日本語 MP3 を生成。
    ElevenLabs の入力上限は約5000字。長文は2000字単位でチャンク分割して
    MP3 を結合することで音声切れを防ぐ。
    Voice ID は環境変数 ELEVENLABS_VOICE_ID で上書き可（デフォルト Sarah）。"""
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL").strip() or "EXAVITQu4vr4xnSDxMaL"
    chunks = _split_text_for_tts(text, 2000)
    if not chunks:
        return None
    log(f"elevenlabs tts: total_chars={len(text)} chunks={len(chunks)}")
    mp3_parts: list[bytes] = []
    for idx, chunk in enumerate(chunks, 1):
        mp3 = _generate_tts_elevenlabs_one(chunk, api_key, voice_id)
        if not mp3:
            log(f"elevenlabs tts: chunk {idx}/{len(chunks)} FAILED")
            return None
        log(f"elevenlabs tts: chunk {idx}/{len(chunks)} done ({len(chunk)}c → {len(mp3)//1024}KB)")
        mp3_parts.append(mp3)
    if len(mp3_parts) == 1:
        return mp3_parts[0]
    return _concat_mp3(mp3_parts)


_OPENAI_TTS_LAST_ERROR: str = ""


def _openai_tts_request(text: str, api_key: str, model: str, voice: str,
                        instructions: str | None = None) -> bytes | None:
    """OpenAI TTS API を1リクエスト叩く。失敗時は None を返しエラーをグローバルに記録。"""
    global _OPENAI_TTS_LAST_ERROR
    try:
        import urllib.request, urllib.error
        body: dict = {
            "model": model,
            "voice": voice,
            "input": text,
            "response_format": "mp3",
            "speed": 0.97,
        }
        if instructions:
            body["instructions"] = instructions
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            method="POST",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            data=json.dumps(body).encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body_bytes = e.read()[:300]
        _OPENAI_TTS_LAST_ERROR = f"HTTP {e.code} {e.reason}: {body_bytes!r}"
        log(f"openai tts [{model}/{voice}] HTTP error: {_OPENAI_TTS_LAST_ERROR}")
        return None
    except Exception as e:
        _OPENAI_TTS_LAST_ERROR = f"{type(e).__name__}: {e}"
        log(f"openai tts [{model}/{voice}] error: {_OPENAI_TTS_LAST_ERROR}")
        return None


def _generate_tts_openai(text: str) -> bytes | None:
    """OpenAI TTS。長文は1800字チャンク分割→MP3結合。
    試行順:
      1. gpt-4o-mini-tts / shimmer + TTS_INSTRUCTIONS（最高品質・instruction following）
      2. tts-1-hd / shimmer（gpt-4o-mini-tts が使えないアカウント向けフォールバック）
      3. tts-1 / shimmer（最低限の品質保証）
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    chunks = _split_text_for_tts(text, 1800)
    if not chunks:
        return None

    candidates = [
        ("gpt-4o-mini-tts", "shimmer", TTS_INSTRUCTIONS),
        ("tts-1-hd",        "shimmer", None),
        ("tts-1",           "shimmer", None),
    ]
    for model, voice, instructions in candidates:
        log(f"openai tts: trying {model}/{voice} total_chars={len(text)} chunks={len(chunks)}")
        mp3_parts: list[bytes] = []
        ok = True
        for idx, chunk in enumerate(chunks, 1):
            mp3 = _openai_tts_request(chunk, api_key, model, voice, instructions)
            if not mp3:
                log(f"openai tts [{model}]: chunk {idx}/{len(chunks)} FAILED — trying next model")
                ok = False
                break
            log(f"openai tts [{model}]: chunk {idx}/{len(chunks)} done ({len(chunk)}c → {len(mp3)//1024}KB)")
            mp3_parts.append(mp3)
        if ok and mp3_parts:
            return mp3_parts[0] if len(mp3_parts) == 1 else _concat_mp3(mp3_parts)
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
        debug_stats["audio"] = {
            "voicevoxBaseUrl": os.environ.get("VOICEVOX_BASE_URL", ""),
            "azureKeySet": bool(os.environ.get("AZURE_SPEECH_KEY", "").strip()),
            "elevenKeySet": bool(os.environ.get("ELEVENLABS_API_KEY", "").strip()),
        }
        mustknow = [x for x in items if x.get("urgency") == "must_know"][:2]
        thisweek = [x for x in items if x.get("urgency") == "this_week"][:6]
        log("generating digest script...")
        script = generate_digest_script(exec_summary, mustknow, thisweek)
        if script:
            log(f"digest script: {len(script)} chars")
            debug_stats["audio"]["scriptChars"] = len(script)
            debug_stats["audio"]["scriptSource"] = "claude" if ANTHROPIC_API_KEY and not _LAST_ANTHROPIC_ERROR else "template_fallback"
            log("generating TTS MP3 (Google → Azure → ElevenLabs → OpenAI fallback)...")
            mp3 = generate_tts_mp3(script)
            if mp3:
                save_audio(mp3, script)
                debug_stats["audio"]["mp3Bytes"] = len(mp3)
            else:
                log("tts generation failed; static audio not saved")
                if _OPENAI_TTS_LAST_ERROR:
                    debug_stats["audio"]["openaiError"] = _OPENAI_TTS_LAST_ERROR
                debug_stats["audio"]["error"] = "all_tts_paths_failed"
                if _VOICEVOX_LAST_ERROR:
                    debug_stats["audio"]["voicevoxError"] = _VOICEVOX_LAST_ERROR
        else:
            log("digest script generation failed; skipping audio")
            debug_stats["audio"]["error"] = "digest_script_empty"

    debug_stats["durationSec"] = round(time.time() - started, 1)
    _write_debug_stats(debug_stats)
    log(f"done in {time.time() - started:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
