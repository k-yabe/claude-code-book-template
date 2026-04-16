/**
 * AI NEWS — 高品質音声読み上げ API
 *
 * POST /api/ai-news-tts
 * Body: { text: "読み上げるテキスト" }
 * Response: audio/mpeg (MP3バイナリ)
 *
 * OpenAI TTS API を使用。OPENAI_API_KEY が未設定の場合は 501 を返し、
 * フロントエンドが Web Speech API にフォールバックする。
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'TTS API キーが未設定です' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 5000) {
    return res.status(400).json({ error: 'テキストは1〜5000文字で指定してください' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3',
        speed: 1.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-news-tts] OpenAI error:', response.status, errText);
      return res.status(502).json({ error: 'TTS生成に失敗しました' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[ai-news-tts] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
