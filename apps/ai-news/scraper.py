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
SOURCES: list[dict[str, str]] = [
    # マーケティング系（日本語のみ）
    {"name": "MarkeZine",                "url": "https://markezine.jp/rt/new.rdf",                            "category": "marketing"},
    {"name": "Web担当者Forum",            "url": "https://webtan.impress.co.jp/rss/all",                       "category": "marketing"},
    {"name": "ferret",                   "url": "https://ferret-plus.com/feed",                               "category": "marketing"},
    # 市場・業界（日本語のみ）
    {"name": "電通報",                    "url": "https://dentsu-ho.com/articles.atom",                         "category": "market"},
    {"name": "ITmedia マーケティング",    "url": "https://rss.itmedia.co.jp/rss/2.0/marketing.xml",            "category": "market"},
    # AI（日本語のみ）
    {"name": "ITmedia AI+",              "url": "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",               "category": "ai"},
    {"name": "ITmedia NEWS",             "url": "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",          "category": "ai"},
    {"name": "ASCII.jp",                 "url": "https://ascii.jp/rss.xml",                                    "category": "ai"},
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
                # AI or マーケティング関連でない記事を除外（AI NEWS は AI + マーケ視点）
                if not is_ai_related(title, raw_summary):
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
                all_items.append({
                    "id": make_id(url),
                    "title": truncate(title, 200),
                    "url": url,
                    "image": image,
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
# 重要度 → 推定読了時間（分）。「10分で読める」を保つための予算配分。
#  importance=1 (TOP)      : 2分（じっくり）
#  importance=2 (BRIEFING) : 1分（要点だけ）
#  importance=3 (MORE)     : 1分（流し読み）
READ_MIN_BY_IMPORTANCE: dict[int, int] = {1: 2, 2: 1, 3: 1}


def normalize_read_min(importance: int) -> int:
    return READ_MIN_BY_IMPORTANCE.get(importance, 1)


def _first_sentence(s: str, max_len: int = 120) -> str:
    """要約の先頭1〜2文を切り出す（whyItMatters の簡易フォールバック用）。"""
    if not s:
        return ""
    # 句点で切る
    m = re.match(r"^[^。]{4,}。[^。]{0,40}。?", s)
    chunk = m.group(0) if m else s[:max_len]
    return truncate(chunk, max_len)


def fallback_summarize(items: list[dict]) -> list[dict]:
    """API無し / 失敗時の素朴フォールバック。先頭1件をTOP、次5件をBRIEFINGとする。
    whyItMatters は要約の冒頭を使って最低限「何が重要か」を示す。
    """
    for idx, it in enumerate(items):
        body = it.pop("raw_summary", "") or ""
        it["summary"] = truncate(body, SUMMARY_CHARS) or it["title"]
        it["tags"] = []
        # 簡易 whyItMatters: 要約冒頭の1文。空なら空のまま。
        it["whyItMatters"] = _first_sentence(body or it["summary"], 140)
        it["actionItem"] = ""
        it["pickerComment"] = ""
        if idx == 0:
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


def call_anthropic(items: list[dict]) -> tuple[list[dict], list[str]] | None:
    """Claude Haikuで一括要約。成功時は (items, executiveSummary) を返す。失敗時 None"""
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
        "専門用語は避け、マーケ部門の誰が読んでもすぐわかる表現にすること。\n"
        "期限指示（「今日中に〜」等）は入れない。事実と影響のみ。\n\n"
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

    # executiveSummary を抽出
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
def save(items: list[dict], executive_summary: list[str] | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARCH_DIR.mkdir(parents=True, exist_ok=True)
    today_jst = datetime.now(JST).strftime("%Y-%m-%d")
    payload = {
        "updatedAt": datetime.now(UTC).isoformat(),
        "generatedFor": today_jst,
        "executiveSummary": executive_summary or [],
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
    result = call_anthropic(items)
    if result is None:
        items = fallback_summarize(items)
        exec_summary: list[str] = []
    else:
        items, exec_summary = result
    save(items, exec_summary)
    log(f"done in {time.time() - started:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
