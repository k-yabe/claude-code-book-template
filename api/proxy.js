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

// GET /api/proxy?url=... → HTMLを直接返す（iframeプレビュー用）
// POST /api/proxy { url } → JSON（差分検出用）
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // URLを取得（GETはquery、POSTはbody）
  const url = req.method === 'GET' ? req.query.url : (req.body || {}).url;
  if (!url || typeof url !== 'string') {
    return req.method === 'GET'
      ? res.status(400).send('URL is required')
      : res.status(400).json({ error: 'URL is required' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return req.method === 'GET'
      ? res.status(400).send('Invalid URL format')
      : res.status(400).json({ error: 'Invalid URL format' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return req.method === 'GET'
      ? res.status(400).send('Only HTTP/HTTPS URLs are allowed')
      : res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
  }

  if (isPrivateHost(parsed.hostname)) {
    return req.method === 'GET'
      ? res.status(403).send('Access to private/internal addresses is not allowed')
      : res.status(403).json({ error: 'Access to private/internal addresses is not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_SIZE) {
      return req.method === 'GET'
        ? res.status(413).send('Response too large')
        : res.status(413).json({ error: `Response too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Max ${MAX_BODY_SIZE / 1024 / 1024}MB.` });
    }

    const body = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    // GET: HTMLを直接返す（iframeプレビュー用）
    if (req.method === 'GET') {
      let html = body;
      const baseTag = `<base href="${parsed.origin}/">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>' + baseTag);
      } else if (html.includes('<html')) {
        html = html.replace(/<html[^>]*>/, '$&<head>' + baseTag + '</head>');
      } else {
        html = baseTag + html;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', 'frame-ancestors \'self\'');
      return res.status(200).send(html);
    }

    // POST: JSONで返す（差分検出用）
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
      return req.method === 'GET'
        ? res.status(504).send('Request timed out')
        : res.status(504).json({ error: 'Request timed out (10s)' });
    }
    return req.method === 'GET'
      ? res.status(502).send(`Failed to fetch: ${err.message}`)
      : res.status(502).json({ error: `Failed to fetch: ${err.message}` });
  }
};
