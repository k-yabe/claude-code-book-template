// Multi-mode URL fetch handler
// - default: article text extraction (POST {url})
// - proxy: raw fetch with headers (POST {url}) via ?mode=proxy
// - ogp: raw HTML fetch (GET ?url=...) via ?mode=ogp

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

function isPrivateHost(hostname) {
  return PRIVATE_IP_PATTERNS.some(p => p.test(hostname));
}

export default async function handler(req, res) {
  const mode = req.query.mode;

  if (mode === 'proxy') return handleProxy(req, res);
  if (mode === 'ogp') return handleOgp(req, res);
  return handleArticle(req, res);
}

// --- Proxy mode: raw fetch with cache headers ---
async function handleProxy(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
  }

  if (isPrivateHost(parsed.hostname)) {
    return res.status(403).json({ error: 'Access to private/internal addresses is not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CacheChecker/1.0',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_SIZE) {
      return res.status(413).json({ error: `Response too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Max ${MAX_BODY_SIZE / 1024 / 1024}MB.` });
    }

    const body = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    const headers = {};
    const headerKeys = ['cache-control', 'age', 'last-modified', 'etag', 'x-cache', 'x-cache-hits', 'cf-cache-status', 'x-varnish', 'via', 'expires', 'date', 'content-type'];
    for (const key of headerKeys) {
      const val = response.headers.get(key);
      if (val) headers[key] = val;
    }

    return res.status(200).json({
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      url: response.url,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out (8s)' });
    }
    return res.status(502).json({ error: `Failed to fetch: ${err.message}` });
  }
}

// --- OGP mode: raw HTML fetch ---
async function handleOgp(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url パラメーターが必要です' });

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: '不正なURLです' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

// --- Article mode: extract text and title ---
async function handleArticle(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;
  if (!url || !url.startsWith('https://')) {
    return res.status(400).json({ error: '無効なURLです' });
  }

  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      },
    });
    if (!pageRes.ok) throw new Error(`記事の取得に失敗しました (${pageRes.status})`);

    const buffer = await pageRes.arrayBuffer();

    const contentType = pageRes.headers.get('content-type') || '';
    let charset = contentType.match(/charset=([^\s;]+)/i)?.[1] || 'utf-8';

    const prescan = new TextDecoder('latin1').decode(buffer.slice(0, 2048));
    const metaCharset =
      prescan.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i)?.[1] ||
      prescan.match(/charset=([^"';\s>]+)/i)?.[1];
    if (metaCharset) charset = metaCharset;

    const csNorm = charset.toLowerCase().replace(/[_\s]/g, '-');
    const safeCharset =
      ['shift-jis', 'sjis', 'x-sjis'].includes(csNorm) ? 'shift-jis' :
      csNorm === 'euc-jp' ? 'euc-jp' : 'utf-8';

    let html;
    try {
      html = new TextDecoder(safeCharset).decode(buffer);
    } catch {
      html = new TextDecoder('utf-8').decode(buffer);
    }

    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = decodeEntities(ogTitleMatch?.[1] || titleMatch?.[1] || '')
      .replace(/\s*[|｜–—]\s*.+$/, '').trim();

    const ogDescMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const ogDesc = decodeEntities(ogDescMatch?.[1]?.trim() || '');

    let cleaned = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    const content =
      cleaned.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
      cleaned.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
      cleaned.match(/<body[\s\S]*?<\/body>/i)?.[0] ||
      cleaned;

    let stripped = content
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '');

    let text = decodeEntities(
      stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    text = text
      .replace(/chevron_right|chevron_left|arrow_forward/g, '')
      .replace(/詳しく見る/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const relatedIdx = text.search(/最新コラム|関連記事|関連コンテンツ|おすすめ記事|Related/);
    if (relatedIdx > 500) text = text.slice(0, relatedIdx).trim();

    text = text.slice(0, 2000);

    const descInText = ogDesc && text.includes(ogDesc.slice(0, 30));
    const finalText = ogDesc && !descInText ? `${ogDesc}\n\n${text}` : text;

    if (!title) {
      return res.status(422).json({ error: 'ページタイトルを取得できませんでした。URLを確認してください。' });
    }
    if (finalText.length < 100) {
      return res.status(422).json({ error: 'コンテンツを取得できませんでした。ログインが必要なページの可能性があります。' });
    }
    if (/ページが見つかりません|page not found/i.test(finalText.slice(0, 200))) {
      return res.status(422).json({ error: 'ページが見つかりませんでした（404）。URLが正しいか確認してください。' });
    }

    return res.status(200).json({ title, text: finalText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
