import { mapAnthropicError } from './_anthropic-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'APIキーが設定されていません' } });
  }

  try {
    const { _user, _app, ...body } = req.body;
    const logEndpoint = process.env.LOG_ENDPOINT;
    if (logEndpoint && _user) {
      fetch(logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: _user, action: 'generate', app: _app || '', timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) }),
      }).catch(() => {});
    }

    // Server-side guardrail: cap max_tokens to bound spend even if a client
    // requests a huge value. 8192 covers all current call sites.
    const MAX_TOKENS_CAP = 8192;
    if (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_TOKENS_CAP) {
      body.max_tokens = MAX_TOKENS_CAP;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      const { status, body: errBody } = mapAnthropicError(response.status, text);
      return res.status(status).json(errBody);
    }

    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ error: { message: 'APIエラーが発生しました。しばらく待ってから再試行してください。' } });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
