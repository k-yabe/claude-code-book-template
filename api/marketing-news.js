// Marketing News Radar API
// GET /api/marketing-news?window=24h&category=all
//   -> fetches multiple RSS feeds in parallel, filters by time window,
//      uses Claude Haiku to translate titles and write marketer-focused summaries,
//      and uses Claude Sonnet to produce a 3-line daily digest.

const FEEDS = [
  // AI (Japanese)
  { id: 'itmedia_ai',     name: 'ITmedia AI+',             url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',                           category: 'ai',       lang: 'ja' },
  { id: 'sbbit',          name: 'ビジネス+IT',              url: 'https://www.sbbit.jp/rss/HotTopics.rss',                                  category: 'ai',       lang: 'ja' },
  // AI (English)
  { id: 'techcrunch_ai',  name: 'TechCrunch AI',           url: 'https://techcrunch.com/category/artificial-intelligence/feed/',          category: 'ai',       lang: 'en' },
  { id: 'verge_ai',       name: 'The Verge AI',            url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',      category: 'ai',       lang: 'en' },
  { id: 'venturebeat_ai', name: 'VentureBeat AI',          url: 'https://venturebeat.com/category/ai/feed/',                               category: 'ai',       lang: 'en' },
  // Marketing
  { id: 'martech',        name: 'MarTech',                 url: 'https://martech.org/feed/',                                                category: 'marketing',lang: 'en' },
  { id: 'marketing_dive', name: 'Marketing Dive',          url: 'https://www.marketingdive.com/feeds/news/',                                category: 'marketing',lang: 'en' },
  { id: 'hubspot',        name: 'HubSpot Marketing',       url: 'https://blog.hubspot.com/marketing/rss.xml',                               category: 'marketing',lang: 'en' },
  { id: 'cmi',            name: 'Content Marketing Inst.', url: 'https://contentmarketinginstitute.com/feed/',                              category: 'marketing',lang: 'en' },
  // Community / trending
  { id: 'hn',             name: 'Hacker News',             url: 'https://hnrss.org/newest?points=100',                                      category: 'community',lang: 'en' },
  { id: 'ph',             name: 'Product Hunt',            url: 'https://www.producthunt.com/feed',                                         category: 'community',lang: 'en' },
];

// ─── In-memory cache (5min) ────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // key: `${windowH}|${category}` -> { at, payload }

// ─── Minimal XML parser for RSS 2.0 / Atom ─────────────────────────────────
function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  // Extract CDATA first (so it survives the tag-stripping regex), then strip remaining tags.
  const cdataExtracted = String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeEntities(cdataExtracted.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractFirst(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function extractLinkAtom(itemXml) {
  // Atom <link href="..." />
  const m = itemXml.match(/<link[^>]*href="([^"]+)"/i);
  if (m) return m[1];
  // RSS <link>url</link>
  const m2 = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  return m2 ? stripTags(m2[1]) : '';
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseFeed(xml, source) {
  const items = [];
  // Detect item blocks (RSS <item>, Atom <entry>)
  const blockRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(xml)) !== null) {
    const body = m[2];
    const title = stripTags(extractFirst(body, 'title'));
    const link = extractLinkAtom(body);
    const pub =
      extractFirst(body, 'pubDate') ||
      extractFirst(body, 'published') ||
      extractFirst(body, 'updated') ||
      extractFirst(body, 'dc:date');
    const desc = stripTags(
      extractFirst(body, 'description') ||
      extractFirst(body, 'summary') ||
      extractFirst(body, 'content:encoded') ||
      extractFirst(body, 'content')
    ).slice(0, 600);
    const date = parseDate(stripTags(pub));
    if (!title || !link) continue;
    items.push({
      title,
      url: link.trim(),
      summary: desc,
      published: date ? date.toISOString() : null,
      publishedAt: date ? date.getTime() : 0,
      source: source.name,
      sourceId: source.id,
      category: source.category,
      lang: source.lang,
    });
  }
  return items;
}

async function fetchFeed(source) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketingNewsRadar/1.0; +https://akkodis.com)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, source);
  } catch (_e) {
    return [];
  }
}

// ─── Claude helpers ────────────────────────────────────────────────────────
async function callClaude({ apiKey, model, max_tokens, system, userContent }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.content?.[0]?.text || '';
}

async function enrichArticles(apiKey, articles) {
  if (!articles.length) return articles;
  // Batch request: ask Claude to translate titles and write marketer-focused summaries.
  const payload = articles.map((a, i) => ({
    i,
    title: a.title,
    source: a.source,
    lang: a.lang,
    excerpt: (a.summary || '').slice(0, 400),
  }));
  const system =
    'あなたはB2Bマーケティング担当者向けのニュースキュレーターです。' +
    '各記事について、日本語タイトルと、マーケ担当者の実務にどう活きるかを1〜2文で日本語要約してください。' +
    '出力は有効なJSONのみ。余分な説明やコードブロックは一切含めないこと。';
  const userContent =
    '以下の記事リストを JSON で処理してください。\n' +
    '各要素について、次の形式の配列を JSON として返してください:\n' +
    '[{"i":0,"title_ja":"...","summary_ja":"..."}, ...]\n\n' +
    '制約:\n' +
    '- title_ja は日本語で簡潔に。元が日本語ならそのまま整えるだけでよい。\n' +
    '- summary_ja はマーケ担当者視点で1〜2文（80〜140字目安）。抽象論でなく「何が新しいか／何に使えそうか」を具体に。\n' +
    '- 不明なときは excerpt から推測してよいが、捏造はしない。\n\n' +
    '記事:\n' + JSON.stringify(payload);

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3500,
      system,
      userContent,
    });
    // Find first JSON array
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return articles;
    const arr = JSON.parse(m[0]);
    const byIdx = new Map();
    for (const r of arr) {
      if (typeof r?.i === 'number') byIdx.set(r.i, r);
    }
    return articles.map((a, i) => {
      const r = byIdx.get(i);
      if (!r) return a;
      return {
        ...a,
        title_ja: (r.title_ja || '').trim() || a.title,
        summary_ja: (r.summary_ja || '').trim(),
      };
    });
  } catch (_e) {
    return articles;
  }
}

async function generateDigest(apiKey, articles) {
  if (!articles.length) return '';
  const top = articles.slice(0, 12).map((a, i) => `${i + 1}. [${a.source}] ${a.title_ja || a.title}`).join('\n');
  const system =
    'あなたはマーケティング担当者向けの簡潔なニュースキャスターです。' +
    '与えられた記事リストから、マーケ担当者が今日知っておくべきポイントを日本語で3行にまとめてください。' +
    '各行は1文で、60〜90字。装飾記号・箇条書き記号は使わず、改行のみで区切ること。';
  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      userContent: `記事:\n${top}\n\n3行サマリ（改行区切り、説明文不要）:`,
    });
    return text.trim();
  } catch (_e) {
    return '';
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const windowParam = String(req.query.window || '24h');
  const hours = windowParam === '7d' ? 24 * 7 : windowParam === '48h' ? 48 : 24;
  const category = String(req.query.category || 'all');
  const validCategory = ['all', 'ai', 'marketing', 'community'].includes(category) ? category : 'all';

  const cacheKey = `${hours}|${validCategory}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.payload);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 1. Fetch all feeds in parallel
  const sources = validCategory === 'all' ? FEEDS : FEEDS.filter(f => f.category === validCategory);
  const lists = await Promise.all(sources.map(fetchFeed));
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;

  let articles = lists
    .flat()
    .filter(a => a.publishedAt && a.publishedAt >= cutoff)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  // Deduplicate by title prefix
  const seen = new Set();
  articles = articles.filter(a => {
    const key = (a.title_ja || a.title || '').slice(0, 40).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Cap total articles we pass to Claude
  const MAX_ARTICLES = 40;
  if (articles.length > MAX_ARTICLES) articles = articles.slice(0, MAX_ARTICLES);

  // 2. Enrich with Claude (translation + marketer summary)
  let enriched = articles;
  let digest = '';
  if (apiKey && articles.length) {
    enriched = await enrichArticles(apiKey, articles);
    digest = await generateDigest(apiKey, enriched);
  }

  // Count per category (from full cross-category fetch? we only fetched the selected one, so caller must hit /all for full counts)
  const counts = { all: 0, ai: 0, marketing: 0, community: 0 };
  for (const a of enriched) {
    counts.all += 1;
    if (counts[a.category] !== undefined) counts[a.category] += 1;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    window: `${hours}h`,
    category: validCategory,
    digest,
    counts,
    articles: enriched,
    sources: sources.map(s => ({ id: s.id, name: s.name, category: s.category, lang: s.lang })),
    hasAI: Boolean(apiKey),
  };

  cache.set(cacheKey, { at: Date.now(), payload });
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(payload);
}
