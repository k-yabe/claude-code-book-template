import { mapAnthropicError } from './_anthropic-error.js';
import { checkBudget, recordCost, MONTHLY_BUDGET_USD } from './_budget.js';

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
    // requests a huge value.
    const MAX_TOKENS_CAP = 4096;
    if (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_TOKENS_CAP) {
      body.max_tokens = MAX_TOKENS_CAP;
    }

    // Server-side prompt caching: auto-stamp cache_control on long system
    // prompts and on the last user message in multi-turn chats. This makes
    // every /api/generate caller (Prompt Maker chat, Writing Checker, etc.)
    // benefit transparently — no client-side change required.
    //
    // Thresholds:
    // - System ≥ 8000 chars (~2000 tokens) clears Sonnet's 2048-token minimum
    //   cacheable prefix. Smaller prefixes silently no-op (no cache write
    //   premium charged), so this is a safe default.
    // - Multi-turn messages (length ≥ 2) means the conversation prefix is
    //   reusable across turns. Single-shot calls skip caching to avoid the
    //   1.25× write premium with no read.
    if (typeof body.system === 'string' && body.system.length >= 8000) {
      body.system = [
        { type: 'text', text: body.system, cache_control: { type: 'ephemeral' } },
      ];
    }
    if (Array.isArray(body.messages) && body.messages.length >= 2) {
      const lastIdx = body.messages.length - 1;
      const last = body.messages[lastIdx];
      if (last && typeof last.content === 'string') {
        body.messages = body.messages.slice();
        body.messages[lastIdx] = {
          ...last,
          content: [
            { type: 'text', text: last.content, cache_control: { type: 'ephemeral' } },
          ],
        };
      }
    }

    const budget = await checkBudget();
    if (!budget.allowed) {
      return res.status(429).json({ error: { message: `月額API予算（$${MONTHLY_BUDGET_USD}）に達しました。翌月までお待ちください。` } });
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
    if (data.usage && body.model) await recordCost(body.model, data.usage);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
