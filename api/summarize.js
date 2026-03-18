export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { url } = req.body;
  if (!url || !url.startsWith('https://www.akkodis.com/')) {
    return res.status(400).json({ error: '無効なURLです' });
  }

  try {
    // 記事HTMLを取得
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AKKODiS-Watcher/1.0)' },
    });
    if (!pageRes.ok) throw new Error(`記事の取得に失敗しました (${pageRes.status})`);
    const html = await pageRes.text();

    // 本文テキストを簡易抽出（スクリプト・スタイル・HTMLタグを除去）
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    // Claude APIで日本語要約
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `以下の記事を日本語で3〜4文に要約してください。専門用語はそのままでOKです。マーケティング担当者向けに、記事の主旨と重要ポイントを簡潔にまとめてください。\n\n${text}`,
          },
        ],
      }),
    });

    const data = await claudeRes.json();
    const summary = data?.content?.[0]?.text?.trim() || '';
    if (!summary) throw new Error('要約の生成に失敗しました');

    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
