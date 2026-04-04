const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/, /^localhost$/i,
];

function isPrivateHost(hostname) {
  return PRIVATE_IP_PATTERNS.some(p => p.test(hostname));
}

module.exports = async function handler(req, res) {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('URL is required');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).send('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).send('Only HTTP/HTTPS URLs are allowed');
  }

  if (isPrivateHost(parsed.hostname)) {
    return res.status(403).send('Access to private/internal addresses is not allowed');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_SIZE) {
      return res.status(413).send('Response too large');
    }

    let html = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    // <base>タグを挿入して相対パスのリソースを元サイトから読み込む
    const baseOrigin = parsed.origin;
    const baseTag = `<base href="${baseOrigin}/">`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + baseTag);
    } else if (html.includes('<html')) {
      html = html.replace(/<html[^>]*>/, '$&<head>' + baseTag + '</head>');
    } else {
      html = baseTag + html;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).send('Request timed out');
    }
    return res.status(502).send(`Failed to fetch: ${err.message}`);
  }
};
