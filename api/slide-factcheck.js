/**
 * Vercel Serverless Function: スライド単位のファクトチェック
 * 各スライドの主張をWeb検索で検証し、出典付きの結果を返す。
 */

const FACTCHECK_SYSTEM_PROMPT = `あなたはファクトチェッカーです。
プレゼンスライドの内容を検証し、事実関係を確認してください。

## 検証の方針

1. スライドに含まれる主張・数値・統計を抽出する
2. Web検索で裏取りする
3. 各主張について検証結果を報告する

## 出力形式（必ずこのJSON形式のみを返す）

\`\`\`json
{
  "claims": [
    {
      "text": "検証対象の主張",
      "verified": true|false|null,
      "source_url": "裏付けとなるURL（見つかった場合）",
      "source_name": "出典名",
      "note": "補足説明（正確な数値との差異、注意点など）"
    }
  ],
  "summary": "全体の検証サマリー（1〜2文）"
}
\`\`\`

- verified: true=裏付けあり、false=事実と異なる、null=検証不能
- 数値の主張は特に厳密に検証する
- 主張が見つからない（意見・提案のみの）スライドは claims を空配列にする
- 必ずJSON形式のみを返してください`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { slide, _user } = req.body;

  if (!slide) {
    return res.status(400).json({ error: 'slide is required' });
  }

  // ログ送信
  const logEndpoint = process.env.LOG_ENDPOINT;
  if (logEndpoint && _user) {
    fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: _user,
        action: 'slide-factcheck',
        app: 'slide-maker',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      }),
    }).catch(() => {});
  }

  // スライド内容をテキスト化
  const parts = [];
  if (slide.title) parts.push(`タイトル: ${slide.title}`);
  if (slide.body) parts.push(`本文: ${slide.body}`);
  if (slide.leftBody) parts.push(`左列: ${slide.leftBody}`);
  if (slide.rightBody) parts.push(`右列: ${slide.rightBody}`);
  if (slide.chart) {
    parts.push(`チャート: ${slide.chart.title || ''} (${(slide.chart.labels || []).join(', ')} / ${(slide.chart.data || []).join(', ')} ${slide.chart.unit || ''})`);
  }
  if (slide.table) {
    parts.push(`テーブル: ${(slide.table.headers || []).join(' | ')}`);
    (slide.table.rows || []).forEach(r => parts.push(`  ${r.join(' | ')}`));
  }
  if (slide.boxes) {
    slide.boxes.forEach(b => parts.push(`ボックス: ${b.heading || ''} - ${b.body || ''}`));
  }
  if (slide.notes) parts.push(`ノート: ${slide.notes}`);

  const slideText = parts.join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        temperature: 0.1,
        system: FACTCHECK_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `以下のプレゼンスライドの内容をファクトチェックしてください。\n\nレイアウト: ${slide.layout}\n${slideText}`,
        }],
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
          user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' },
        }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'しばらく時間をおいて再試行してください。' });
      }
      return res.status(response.status).json({ error: `APIエラー (${response.status})` });
    }

    const data = await response.json();
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const rawText = textBlocks.map(b => b.text).join('');

    // JSONを抽出
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'ファクトチェック結果のパースに失敗しました。' });
    }

    const result = JSON.parse(jsonMatch[1].trim());
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'サーバーエラーが発生しました。' });
  }
}
