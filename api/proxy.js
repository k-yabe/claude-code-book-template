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

module.exports = async function handler(req, res) {
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
};
