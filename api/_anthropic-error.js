// Anthropic API のエラーレスポンスをユーザー向けの日本語メッセージへ変換する共通ヘルパー。
// 特にクレジット残高不足（credit balance is too low）は英文のまま露出していたため、
// 日本語で明確に案内する。他のエラーもステータスごとに定型化する。
//
// 使い方:
//   import { mapAnthropicError } from './_anthropic-error.js';
//   if (!response.ok) {
//     const errText = await response.text();
//     const { status, body } = mapAnthropicError(response.status, errText);
//     return res.status(status).json(body);
//   }

export function parseMessage(raw) {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || '';
  } catch {
    return typeof raw === 'string' ? raw : '';
  }
}

export function isCreditError(status, message) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('credit balance is too low') ||
    m.includes('credit balance too low') ||
    (m.includes('credit') && m.includes('balance') && (status === 400 || status === 402))
  );
}

// status: Anthropic API からの HTTP ステータス
// rawText: response.text() の結果（未パースで可）
// 返り値: { status, body } — res.status(status).json(body) で返せる形
export function mapAnthropicError(status, rawText) {
  const message = parseMessage(rawText);

  if (isCreditError(status, message)) {
    return {
      status: 503,
      body: {
        error: {
          code: 'credit_balance_low',
          message: 'AIの利用枠（クレジット）が不足しているため、一時的にご利用いただけません。管理者にご連絡ください。',
        },
      },
    };
  }

  if (status === 429) {
    return {
      status: 429,
      body: { error: { code: 'rate_limited', message: 'アクセスが集中しています。しばらく時間をおいて再試行してください。' } },
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      body: { error: { code: 'unauthorized', message: 'APIキーが無効か、権限がありません。管理者にご連絡ください。' } },
    };
  }

  if (status >= 500) {
    return {
      status: 502,
      body: { error: { code: 'upstream_error', message: 'AIサービス側で一時的な障害が発生しています。しばらく待ってから再試行してください。' } },
    };
  }

  return {
    status,
    body: { error: { code: 'api_error', message: `APIエラー (${status})。時間をおいて再試行してください。` } },
  };
}
